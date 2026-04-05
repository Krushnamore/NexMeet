const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const ChatMessage = require('../models/ChatMessage');
const logger = require('../utils/logger');

const meetingRooms = new Map(); // meetingId → Set of socketIds
const socketUsers = new Map();  // socketId → { userId, userName, meetingId }

const setupSocketHandlers = (io) => {

  // ── Auth middleware ──────────────────────────────────────────────────────
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

    // ── Join meeting room ──────────────────────────────────────────────────
    socket.on('meeting:join', async ({ meetingId }) => {
      try {
        socket.join(meetingId);
        if (!meetingRooms.has(meetingId)) meetingRooms.set(meetingId, new Set());
        meetingRooms.get(meetingId).add(socket.id);
        socketUsers.set(socket.id, {
          userId: socket.user._id.toString(),
          userName: socket.user.name,
          meetingId,
        });
        socket.to(meetingId).emit('participant:joined', {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        });
        logger.info(`${socket.user.name} joined room ${meetingId}`);
      } catch (err) {
        logger.error('meeting:join error:', err);
        socket.emit('error', { message: 'Failed to join meeting room' });
      }
    });

    // ── Leave meeting room ─────────────────────────────────────────────────
    socket.on('meeting:leave', ({ meetingId }) => {
      handleLeave(socket, meetingId, io);
    });

    // ── Chat message ───────────────────────────────────────────────────────
    // EMIT FIRST pattern: message is delivered instantly via socket,
    // DB save happens async in background — a DB error never blocks delivery.
    socket.on('chat:message', async ({ meetingId, content, recipientId, recipientName, breakoutRoomId }) => {
      try {
        if (!content || !content.trim()) return;

        const trimmedContent = content.trim();
        const isPrivate = !!recipientId;

        const msgData = {
          _id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          content: trimmedContent,
          senderName: socket.user.name,
          senderId: socket.user._id.toString(),
          senderAvatar: socket.user.avatar,
          isPrivate,
          recipientId: recipientId || null,
          recipientName: recipientName || null,
          breakoutRoomId: breakoutRoomId || null,
          timestamp: new Date().toISOString(),
        };

        if (isPrivate) {
          // Private: send to recipient + echo back to sender
          const recipientSocket = findSocketByUserId(recipientId, meetingId);
          if (recipientSocket) io.to(recipientSocket).emit('chat:message', msgData);
          socket.emit('chat:message', msgData);
        } else {
          // ✅ socket.to() excludes sender — frontend optimistic add handles sender's own bubble
          socket.to(meetingId).emit('chat:message', msgData);
        }

        // Save to DB in background (non-blocking)
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
        logger.error('chat:message handler error:', err);
        socket.emit('chat:error', { error: 'Failed to send message' });
      }
    });

    // ── Hand raise ─────────────────────────────────────────────────────────
    socket.on('hand:raise', ({ meetingId, raised, name }) => {
      io.to(meetingId).emit('hand:raise', {
        userId: socket.user._id,
        name: name || socket.user.name,
        raised,
      });
    });

    // ── Reactions ──────────────────────────────────────────────────────────
    socket.on('reaction', ({ meetingId, emoji }) => {
      io.to(meetingId).emit('reaction', {
        userId: socket.user._id,
        name: socket.user.name,
        emoji,
      });
    });

    // ── Media state ────────────────────────────────────────────────────────
    socket.on('media:audio', ({ meetingId, muted }) => {
      socket.to(meetingId).emit('media:audio', { userId: socket.user._id, muted });
    });

    socket.on('media:video', ({ meetingId, off }) => {
      socket.to(meetingId).emit('media:video', { userId: socket.user._id, off });
    });

    socket.on('media:screenShare', ({ meetingId, sharing }) => {
      socket.to(meetingId).emit('media:screenShare', {
        userId: socket.user._id,
        name: socket.user.name,
        sharing,
      });
    });

    // ── Screen share request (participant → host) ──────────────────────────
    socket.on('screenshare:request', ({ meetingId }) => {
      Meeting.findOne({ meetingId })
        .then(meeting => {
          if (!meeting) return;
          const hostSocket = findSocketByUserId(meeting.host.toString(), meetingId);
          if (hostSocket) {
            io.to(hostSocket).emit('screenshare:request', {
              userId: socket.user._id.toString(), // ✅ always send as string
              name: socket.user.name,
            });
          }
        })
        .catch(err => logger.error('screenshare:request error:', err));
    });

    // ── Screen share approved (host → participant) ─────────────────────────
    socket.on('screenshare:approved', ({ meetingId, userId }) => {
      const userIdStr = userId?.toString();
      const targetSocket = findSocketByUserId(userIdStr, meetingId);
      logger.info(`screenshare:approved → target userId: ${userIdStr}, socket: ${targetSocket}`);
      if (targetSocket) {
        io.to(targetSocket).emit('screenshare:approved', { userId: userIdStr }); // ✅ send as string
      } else {
        logger.warn(`screenshare:approved: no socket found for userId ${userIdStr} in room ${meetingId}`);
      }
    });

    // ── Screen share denied (host → participant) ───────────────────────────
    socket.on('screenshare:denied', ({ meetingId, userId }) => {
      const userIdStr = userId?.toString();
      const targetSocket = findSocketByUserId(userIdStr, meetingId);
      if (targetSocket) {
        io.to(targetSocket).emit('screenshare:denied', { userId: userIdStr });
      }
    });

    // ── Host controls ──────────────────────────────────────────────────────
    socket.on('host:mute', ({ meetingId, targetUserId }) => {
      const target = findSocketByUserId(targetUserId?.toString(), meetingId);
      if (target) io.to(target).emit('host:mute');
    });

    socket.on('host:kick', ({ meetingId, targetUserId }) => {
      const target = findSocketByUserId(targetUserId?.toString(), meetingId);
      if (target) io.to(target).emit('host:kicked');
    });

    // ── Breakout rooms ─────────────────────────────────────────────────────
    socket.on('breakout:assign', ({ meetingId, assignments }) => {
      assignments.forEach(({ userId, roomId }) => {
        const target = findSocketByUserId(userId?.toString(), meetingId);
        if (target) io.to(target).emit('breakout:assigned', { roomId });
      });
      io.to(meetingId).emit('breakout:updated', { assignments });
    });

    socket.on('breakout:end', ({ meetingId }) => {
      io.to(meetingId).emit('breakout:ended');
    });

    // ── Recording ──────────────────────────────────────────────────────────
    socket.on('recording:started', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:started', { startedBy: socket.user.name });
    });

    socket.on('recording:stopped', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:stopped');
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
      const userInfo = socketUsers.get(socket.id);
      if (userInfo) handleLeave(socket, userInfo.meetingId, io);
    });
  });
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function handleLeave(socket, meetingId, io) {
  if (!meetingId) return;
  socket.leave(meetingId);
  if (meetingRooms.has(meetingId)) {
    meetingRooms.get(meetingId).delete(socket.id);
    if (meetingRooms.get(meetingId).size === 0) meetingRooms.delete(meetingId);
  }
  socketUsers.delete(socket.id);
  socket.to(meetingId).emit('participant:left', {
    userId: socket.user?._id,
    name: socket.user?.name,
  });
  logger.info(`${socket.user?.name} left room ${meetingId}`);
}

function findSocketByUserId(userId, meetingId) {
  if (!userId) return null;
  const userIdStr = userId.toString();
  for (const [socketId, info] of socketUsers.entries()) {
    if (info.userId === userIdStr && info.meetingId === meetingId) {
      return socketId;
    }
  }
  return null;
}

module.exports = setupSocketHandlers;