const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const ChatMessage = require('../models/ChatMessage');
const logger = require('../utils/logger');

// Track connected users per meeting
const meetingRooms = new Map(); // meetingId -> Set of socket IDs
const socketUsers = new Map(); // socketId -> { userId, userName, meetingId }

const setupSocketHandlers = (io) => {
  // Auth middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('name email avatar');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (${socket.user?.name})`);

    // Join meeting room
    socket.on('meeting:join', async ({ meetingId }) => {
      try {
        const meeting = await Meeting.findOne({ meetingId });
        if (!meeting) return socket.emit('error', { message: 'Meeting not found' });

        socket.join(meetingId);

        if (!meetingRooms.has(meetingId)) {
          meetingRooms.set(meetingId, new Set());
        }
        meetingRooms.get(meetingId).add(socket.id);

        socketUsers.set(socket.id, {
          userId: socket.user._id.toString(),
          userName: socket.user.name,
          meetingId,
        });

        // Notify others
        socket.to(meetingId).emit('participant:joined', {
          userId: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        });

        // Send current participants to new joiner
        const participants = [];
        if (meetingRooms.has(meetingId)) {
          for (const sid of meetingRooms.get(meetingId)) {
            const u = socketUsers.get(sid);
            if (u && u.userId !== socket.user._id.toString()) {
              participants.push(u);
            }
          }
        }
        socket.emit('meeting:participants', { participants });

        logger.info(`${socket.user.name} joined meeting ${meetingId}`);
      } catch (err) {
        logger.error('meeting:join error:', err);
        socket.emit('error', { message: 'Failed to join meeting' });
      }
    });

    // Leave meeting room
    socket.on('meeting:leave', ({ meetingId }) => {
      handleLeave(socket, meetingId, io);
    });

    // Chat message
    socket.on('chat:message', async ({ meetingId, content, recipientId, recipientName, breakoutRoomId }) => {
      try {
        const isPrivate = !!recipientId;
        const message = await ChatMessage.create({
          meeting: (await Meeting.findOne({ meetingId }))?._id,
          sender: socket.user._id,
          senderName: socket.user.name,
          content,
          isPrivate,
          recipient: recipientId || null,
          recipientName: recipientName || null,
          breakoutRoomId: breakoutRoomId || null,
        });

        const msgData = {
          _id: message._id,
          content,
          senderName: socket.user.name,
          senderId: socket.user._id,
          senderAvatar: socket.user.avatar,
          isPrivate,
          recipientId,
          recipientName,
          breakoutRoomId,
          timestamp: message.createdAt,
        };

        if (isPrivate) {
          // Send to recipient and sender only
          const recipientSocket = findSocketByUserId(recipientId, meetingId);
          if (recipientSocket) {
            io.to(recipientSocket).emit('chat:message', msgData);
          }
          socket.emit('chat:message', msgData);
        } else {
          // Broadcast to entire meeting room
          io.to(meetingId).emit('chat:message', msgData);
        }
      } catch (err) {
        logger.error('chat:message error:', err);
      }
    });

    // Raise/lower hand
    socket.on('hand:raise', ({ meetingId, raised }) => {
      socket.to(meetingId).emit('hand:raise', {
        userId: socket.user._id,
        name: socket.user.name,
        raised,
      });
    });

    // Reaction
    socket.on('reaction', ({ meetingId, emoji }) => {
      io.to(meetingId).emit('reaction', {
        userId: socket.user._id,
        name: socket.user.name,
        emoji,
      });
    });

    // Media state updates
    socket.on('media:audio', ({ meetingId, muted }) => {
      socket.to(meetingId).emit('media:audio', {
        userId: socket.user._id,
        muted,
      });
    });

    socket.on('media:video', ({ meetingId, off }) => {
      socket.to(meetingId).emit('media:video', {
        userId: socket.user._id,
        off,
      });
    });

    socket.on('media:screenShare', ({ meetingId, sharing }) => {
      socket.to(meetingId).emit('media:screenShare', {
        userId: socket.user._id,
        name: socket.user.name,
        sharing,
      });
    });

    // Breakout room assignment
    socket.on('breakout:assign', ({ meetingId, assignments }) => {
      assignments.forEach(({ userId, roomId }) => {
        const targetSocket = findSocketByUserId(userId, meetingId);
        if (targetSocket) {
          io.to(targetSocket).emit('breakout:assigned', { roomId });
        }
      });
      io.to(meetingId).emit('breakout:updated', { assignments });
    });

    // Host controls
    socket.on('host:mute', ({ meetingId, targetUserId, muted }) => {
      const targetSocket = findSocketByUserId(targetUserId, meetingId);
      if (targetSocket) {
        io.to(targetSocket).emit('host:mute', { muted });
      }
    });

    socket.on('host:kick', ({ meetingId, targetUserId }) => {
      const targetSocket = findSocketByUserId(targetUserId, meetingId);
      if (targetSocket) {
        io.to(targetSocket).emit('host:kicked');
      }
    });

    // Recording state
    socket.on('recording:started', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:started', {
        startedBy: socket.user.name,
      });
    });

    socket.on('recording:stopped', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:stopped');
    });

    // Disconnect
    socket.on('disconnect', () => {
      const userInfo = socketUsers.get(socket.id);
      if (userInfo) {
        handleLeave(socket, userInfo.meetingId, io);
      }
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });
};

function handleLeave(socket, meetingId, io) {
  if (!meetingId) return;

  socket.leave(meetingId);

  if (meetingRooms.has(meetingId)) {
    meetingRooms.get(meetingId).delete(socket.id);
    if (meetingRooms.get(meetingId).size === 0) {
      meetingRooms.delete(meetingId);
    }
  }

  socketUsers.delete(socket.id);

  socket.to(meetingId).emit('participant:left', {
    userId: socket.user?._id,
    name: socket.user?.name,
  });
}

function findSocketByUserId(userId, meetingId) {
  for (const [socketId, info] of socketUsers.entries()) {
    if (info.userId === userId.toString() && info.meetingId === meetingId) {
      return socketId;
    }
  }
  return null;
}

module.exports = setupSocketHandlers;
