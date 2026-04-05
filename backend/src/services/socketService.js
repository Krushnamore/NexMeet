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
    } catch (err) {
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
        socketUsers.set(socket.id, { userId: socket.user._id.toString(), userName: socket.user.name, meetingId });
        socket.to(meetingId).emit('participant:joined', { userId: socket.user._id, name: socket.user.name, avatar: socket.user.avatar });
        logger.info(`${socket.user.name} joined meeting ${meetingId}`);
      } catch (err) {
        logger.error('meeting:join error:', err);
        socket.emit('error', { message: 'Failed to join meeting' });
      }
    });

    socket.on('meeting:leave', ({ meetingId }) => { handleLeave(socket, meetingId, io); });

    socket.on('chat:message', async ({ meetingId, content, recipientId, recipientName, breakoutRoomId }) => {
      try {
        const meeting = await Meeting.findOne({ meetingId });
        if (!meeting) return;
        const isPrivate = !!recipientId;
        const message = await ChatMessage.create({
          meeting: meeting._id, sender: socket.user._id, senderName: socket.user.name,
          content, isPrivate, recipient: recipientId || null,
          recipientName: recipientName || null, breakoutRoomId: breakoutRoomId || null,
        });
        const msgData = {
          _id: message._id, content, senderName: socket.user.name, senderId: socket.user._id,
          senderAvatar: socket.user.avatar, isPrivate, recipientId, recipientName,
          breakoutRoomId, timestamp: message.createdAt,
        };
        if (isPrivate) {
          const recipientSocket = findSocketByUserId(recipientId, meetingId);
          if (recipientSocket) io.to(recipientSocket).emit('chat:message', msgData);
          socket.emit('chat:message', msgData);
        } else {
          io.to(meetingId).emit('chat:message', msgData);
        }
      } catch (err) { logger.error('chat:message error:', err); }
    });

    socket.on('hand:raise', ({ meetingId, raised, name }) => {
      io.to(meetingId).emit('hand:raise', { userId: socket.user._id, name: name || socket.user.name, raised });
    });

    socket.on('reaction', ({ meetingId, emoji }) => {
      io.to(meetingId).emit('reaction', { userId: socket.user._id, name: socket.user.name, emoji });
    });

    socket.on('media:audio', ({ meetingId, muted }) => {
      socket.to(meetingId).emit('media:audio', { userId: socket.user._id, muted });
    });

    socket.on('media:video', ({ meetingId, off }) => {
      socket.to(meetingId).emit('media:video', { userId: socket.user._id, off });
    });

    socket.on('media:screenShare', ({ meetingId, sharing }) => {
      socket.to(meetingId).emit('media:screenShare', { userId: socket.user._id, name: socket.user.name, sharing });
    });

    socket.on('screenshare:request', ({ meetingId }) => {
      Meeting.findOne({ meetingId }).then(meeting => {
        if (!meeting) return;
        const hostSocket = findSocketByUserId(meeting.host.toString(), meetingId);
        if (hostSocket) io.to(hostSocket).emit('screenshare:request', { userId: socket.user._id, name: socket.user.name });
      });
    });

    socket.on('screenshare:approved', ({ meetingId, userId }) => {
      const targetSocket = findSocketByUserId(userId, meetingId);
      if (targetSocket) io.to(targetSocket).emit('screenshare:approved', { userId });
    });

    socket.on('screenshare:denied', ({ meetingId, userId }) => {
      const targetSocket = findSocketByUserId(userId, meetingId);
      if (targetSocket) io.to(targetSocket).emit('screenshare:denied', { userId });
    });

    socket.on('breakout:assign', ({ meetingId, assignments }) => {
      assignments.forEach(({ userId, roomId }) => {
        const targetSocket = findSocketByUserId(userId, meetingId);
        if (targetSocket) io.to(targetSocket).emit('breakout:assigned', { roomId });
      });
      io.to(meetingId).emit('breakout:updated', { assignments });
    });

    socket.on('breakout:end', ({ meetingId }) => { io.to(meetingId).emit('breakout:ended'); });

    socket.on('host:mute', ({ meetingId, targetUserId, muted }) => {
      const targetSocket = findSocketByUserId(targetUserId, meetingId);
      if (targetSocket) io.to(targetSocket).emit('host:mute', { muted });
    });

    socket.on('host:kick', ({ meetingId, targetUserId }) => {
      const targetSocket = findSocketByUserId(targetUserId, meetingId);
      if (targetSocket) io.to(targetSocket).emit('host:kicked');
    });

    socket.on('recording:started', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:started', { startedBy: socket.user.name });
    });

    socket.on('recording:stopped', ({ meetingId }) => {
      socket.to(meetingId).emit('recording:stopped');
    });

    socket.on('disconnect', () => {
      const userInfo = socketUsers.get(socket.id);
      if (userInfo) handleLeave(socket, userInfo.meetingId, io);
      logger.info(`Socket disconnected: ${socket.id}`);
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
  socket.to(meetingId).emit('participant:left', { userId: socket.user?._id, name: socket.user?.name });
}

function findSocketByUserId(userId, meetingId) {
  for (const [socketId, info] of socketUsers.entries()) {
    if (info.userId === userId.toString() && info.meetingId === meetingId) return socketId;
  }
  return null;
}

module.exports = setupSocketHandlers;