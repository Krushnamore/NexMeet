const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const ChatMessage = require('../models/ChatMessage');
const logger = require('../utils/logger');

const meetingRooms = new Map();
const socketUsers = new Map();

const setupSocketHandlers = (io) => {

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('name email avatar');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (${socket.user?.name})`);

    socket.on('meeting:join', async ({ meetingId }) => {
      try {
        socket.join(meetingId);
        if (!meetingRooms.has(meetingId)) meetingRooms.set(meetingId, new Set());
        meetingRooms.get(meetingId).add(socket.id);
        socketUsers.set(socket.id, {
          userId: String(socket.user._id),
          userName: socket.user.name,
          meetingId,
        });
        socket.to(meetingId).emit('participant:joined', {
          userId: String(socket.user._id),
          name: socket.user.name,
          avatar: socket.user.avatar,
        });
        logger.info(`${socket.user.name} joined room ${meetingId}`);
      } catch (err) {
        logger.error('meeting:join error:', err);
        socket.emit('error', { message: 'Failed to join meeting room' });
      }
    });

    socket.on('meeting:leave', ({ meetingId }) => {
      handleLeave(socket, meetingId, io);
    });

    socket.on('chat:message', async ({ meetingId, content, recipientId, recipientName, breakoutRoomId }) => {
      try {
        if (!content || !content.trim()) return;
        const trimmedContent = content.trim();
        const isPrivate = !!recipientId;

        const msgData = {
          _id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          content: trimmedContent,
          senderName: socket.user.name,
          senderId: String(socket.user._id),
          senderAvatar: socket.user.avatar,
          isPrivate,
          recipientId: recipientId || null,
          recipientName: recipientName || null,
          breakoutRoomId: breakoutRoomId || null,
          timestamp: new Date().toISOString(),
        };

        if (isPrivate) {
          const recipientSocket = findSocketByUserId(String(recipientId), meetingId);
          if (recipientSocket) io.to(recipientSocket).emit('chat:message', msgData);
          socket.emit('chat:message', msgData);
        } else {
          socket.to(meetingId).emit('chat:message', msgData);
        }

        Meeting.findOne({ meetingId })
          .then(meeting => {
            if (!meeting) return;
            return ChatMessage.create({
              meeting: meeting._id,
              sender: socket.user._id,
              senderName: socket.user.name,
              content: trimmedContent,
              isPrivate,
              recipient: recipientId || null,
              recipientName: recipientName || null,
              breakoutRoomId: breakoutRoomId || null,
            });
          })
          .catch(err => logger.error('ChatMessage DB save failed:', err.message));

      } catch (err) {
        logger.error('chat:message error:', err);
        socket.emit('chat:error', { error: 'Failed to send message' });
      }
    });

    socket.on('hand:raise', ({ meetingId, raised, name }) => {
      io.to(meetingId).emit('hand:raise', {
        userId: String(socket.user._id),
        name: name || socket.user.name,
        raised,
      });
    });

    socket.on('reaction', ({ meetingId, emoji }) => {
      io.to(meetingId).emit('reaction', {
        userId: String(socket.user._id),
        name: socket.user.name,
        emoji,
      });
    });

    socket.on('media:audio', ({ meetingId, muted }) => {
      socket.to(meetingId).emit('media:audio', {
        userId: String(socket.user._id),
        muted,
      });
    });

    socket.on('media:video', ({ meetingId, off }) => {
      socket.to(meetingId).emit('media:video', {
        userId: String(socket.user._id),
        off,
      });
    });

    socket.on('media:screenShare', ({ meetingId, sharing }) => {
      socket.to(meetingId).emit('media:screenShare', {
        userId: String(socket.user._id),
        name: socket.user.name,
        sharing,
      });
    });

    // Participant requests screen share → find host and notify
    socket.on('screenshare:request', ({ meetingId }) => {
      const requesterId = String(socket.user._id);
      const requesterName = socket.user.name;
      logger.info(`[screenshare:request] from ${requesterName} (${requesterId}) in room ${meetingId}`);

      Meeting.findOne({ meetingId })
        .then(meeting => {
          if (!meeting) return;
          const hostIdStr = String(meeting.host);
          const hostSocket = findSocketByUserId(hostIdStr, meetingId);
          logger.info(`[screenshare:request] host=${hostIdStr}, hostSocket=${hostSocket}`);

          const payload = { userId: requesterId, name: requesterName };

          if (hostSocket) {
            io.to(hostSocket).emit('screenshare:request', payload);
          } else {
            // Fallback: broadcast to room, host will filter
            socket.to(meetingId).emit('screenshare:request', payload);
          }
        })
        .catch(err => logger.error('screenshare:request DB error:', err));
    });

    // Host approves → find participant socket and notify
    socket.on('screenshare:approved', ({ meetingId, userId }) => {
      const userIdStr = String(userId);
      logger.info(`[screenshare:approved] host approving userId=${userIdStr} in room ${meetingId}`);

      const targetSocket = findSocketByUserId(userIdStr, meetingId);
      logger.info(`[screenshare:approved] targetSocket=${targetSocket}`);

      if (targetSocket) {
        io.to(targetSocket).emit('screenshare:approved', { userId: userIdStr });
      } else {
        // Fallback: broadcast to room, participant filters by userId
        logger.warn(`[screenshare:approved] no socket found for ${userIdStr}, broadcasting to room`);
        io.to(meetingId).emit('screenshare:approved', { userId: userIdStr });
      }
    });

    // Host denies → notify participant
    socket.on('screenshare:denied', ({ meetingId, userId }) => {
      const userIdStr = String(userId);
      const targetSocket = findSocketByUserId(userIdStr, meetingId);
      if (targetSocket) {
        io.to(targetSocket).emit('screenshare:denied', { userId: userIdStr });
      } else {
        io.to(meetingId).emit('screenshare:denied', { userId: userIdStr });
      }
    });

    socket.on('host:mute', ({ meetingId, targetUserId }) => {
      const target = findSocketByUserId(String(targetUserId), meetingId);
      if (target) io.to(target).emit('host:mute');
    });

    socket.on('host:kick', ({ meetingId, targetUserId }) => {
      const target = findSocketByUserId(String(targetUserId), meetingId);
      if (target) io.to(target).emit('host:kicked');
    });

    socket.on('breakout:assign', ({ meetingId, assignments }) => {
      assignments.forEach(({ userId, roomId }) => {
        const target = findSocketByUserId(String(userId), meetingId);
        if (target) io.to(target).emit('breakout:assigned', { roomId });
      });
      io.to(meetingId).emit('breakout:updated', { assignments });
    });

    socket.on('breakout:end', ({ meetingId }) => {
      io.to(meetingId).emit('breakout:ended');
    });

    socket.on('recording:started', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:started', { startedBy: socket.user.name });
    });

    socket.on('recording:stopped', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:stopped');
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
      const userInfo = socketUsers.get(socket.id);
      if (userInfo) handleLeave(socket, userInfo.meetingId, io);
    });
  });
};

function handleLeave(socket, meetingId, io) {
  if (!meetingId) return;
  socket.leave(meetingId);
  if (meetingRooms.has(meetingId)) {
    meetingRooms.get(meetingId).delete(socket.id);
    if (meetingRooms.get(meetingId).size === 0) meetingRooms.delete(meetingId);
  }
  socketUsers.delete(socket.id);
  socket.to(meetingId).emit('participant:left', {
    userId: String(socket.user?._id),
    name: socket.user?.name,
  });
  logger.info(`${socket.user?.name} left room ${meetingId}`);
}

function findSocketByUserId(userId, meetingId) {
  if (!userId) return null;
  const userIdStr = String(userId);
  for (const [socketId, info] of socketUsers.entries()) {
    if (info.userId === userIdStr && info.meetingId === meetingId) {
      return socketId;
    }
  }
  return null;
}

module.exports = setupSocketHandlers;