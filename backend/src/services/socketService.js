const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const ChatMessage = require('../models/ChatMessage');
const logger = require('../utils/logger');

// roomId -> Set of socketIds
const meetingRooms = new Map();
// socketId -> { userId, userName, meetingId }
const socketUsers = new Map();
// meetingId -> Set of BANNED userIds (permanent within session — ban only)
const bannedUsers = new Map();

// NOTE: There is NO serverMuted map anymore.
// Host mute is a one-time signal — it mutes the participant's mic once.
// The participant is always free to unmute themselves afterward.
// If the host wants to silence someone permanently, they should use Ban.

const setupSocketHandlers = (io) => {

  // ── AUTH ─────────────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || '').replace('Bearer ', '');

      if (!token) return next(new Error('Authentication required: no token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('name email avatar');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      logger.error('Socket auth failed:', err.name, err.message);
      if (err.name === 'TokenExpiredError')
        return next(new Error('Token expired – please refresh the page'));
      next(new Error(`Invalid token: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (${socket.user?.name})`);

    // ── JOIN ──────────────────────────────────────────────────────────────
    socket.on('meeting:join', async ({ meetingId }) => {
      try {
        const userId = String(socket.user._id);

        // Only BANNED users are blocked. Kicked users can freely rejoin.
        if (bannedUsers.get(meetingId)?.has(userId)) {
          socket.emit('host:banned', { reason: 'You have been banned from this meeting.' });
          return;
        }

        socket.join(meetingId);
        if (!meetingRooms.has(meetingId)) meetingRooms.set(meetingId, new Set());
        meetingRooms.get(meetingId).add(socket.id);

        socketUsers.set(socket.id, {
          userId,
          userName: socket.user.name,
          avatar: socket.user.avatar,
          meetingId,
        });

        // Tell everyone else this person joined
        socket.to(meetingId).emit('participant:joined', {
          userId,
          name: socket.user.name,
          avatar: socket.user.avatar,
          socketId: socket.id,
        });

        // Send the new joiner a snapshot of everyone already in the room
        const participants = [];
        for (const [sid, info] of socketUsers.entries()) {
          if (info.meetingId === meetingId && sid !== socket.id) {
            participants.push({
              socketId: sid,
              userId: info.userId,
              name: info.userName,
              avatar: info.avatar,
            });
          }
        }
        socket.emit('meeting:participants', { participants });

        logger.info(`${socket.user.name} joined room ${meetingId}`);
      } catch (err) {
        logger.error('meeting:join error:', err);
        socket.emit('error', { message: 'Failed to join meeting room' });
      }
    });

    socket.on('meeting:leave', ({ meetingId }) => handleLeave(socket, meetingId, io));

    // ── CHAT ──────────────────────────────────────────────────────────────
    socket.on('chat:message', async ({ meetingId, content, recipientId, recipientName, breakoutRoomId }) => {
      try {
        if (!content?.trim()) return;
        const trimmedContent = content.trim();
        const isPrivate = !!recipientId;

        const msgData = {
          _id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
          // Only relay to recipient — sender already added optimistically
          const recipientSocket = findSocketByUserId(String(recipientId), meetingId);
          if (recipientSocket) io.to(recipientSocket).emit('chat:message', msgData);
        } else {
          // Broadcast to everyone except sender — sender added optimistically
          socket.to(meetingId).emit('chat:message', msgData);
        }

        // Persist
        const meeting = await Meeting.findOne({ meetingId });
        if (meeting) {
          await ChatMessage.create({
            meeting: meeting._id,
            sender: socket.user._id,
            senderName: socket.user.name,
            content: trimmedContent,
            isPrivate,
            recipient: recipientId || null,
            recipientName: recipientName || null,
            breakoutRoomId: breakoutRoomId || null,
          });
        }
      } catch (err) {
        logger.error('chat:message error:', err);
        socket.emit('chat:error', { error: 'Failed to send message' });
      }
    });

    // ── REACTIONS & HAND ──────────────────────────────────────────────────
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

    // ── MEDIA STATE ───────────────────────────────────────────────────────
    socket.on('media:audio', ({ meetingId, muted }) => {
      socket.to(meetingId).emit('media:audio', { userId: String(socket.user._id), muted });
    });

    socket.on('media:video', ({ meetingId, off }) => {
      socket.to(meetingId).emit('media:video', { userId: String(socket.user._id), off });
    });

    socket.on('media:screenShare', ({ meetingId, sharing, agoraUid }) => {
      io.to(meetingId).emit('media:screenShare', {
        userId: String(socket.user._id),
        name: socket.user.name,
        sharing,
        agoraUid,
      });
    });

    // ── SCREEN SHARE ──────────────────────────────────────────────────────
    socket.on('screenshare:request', async ({ meetingId }) => {
      try {
        const meeting = await Meeting.findOne({ meetingId });
        if (!meeting) return;
        const hostSocket = findSocketByUserId(String(meeting.host), meetingId);
        const payload = { userId: String(socket.user._id), name: socket.user.name };
        if (hostSocket) io.to(hostSocket).emit('screenshare:request', payload);
        else socket.to(meetingId).emit('screenshare:request', payload);
      } catch (err) { logger.error('screenshare:request error:', err); }
    });

    socket.on('screenshare:approved', ({ meetingId, userId }) => {
      const target = findSocketByUserId(String(userId), meetingId);
      if (target) io.to(target).emit('screenshare:approved', { userId: String(userId) });
    });

    socket.on('screenshare:denied', ({ meetingId, userId }) => {
      const target = findSocketByUserId(String(userId), meetingId);
      if (target) io.to(target).emit('screenshare:denied', { userId: String(userId) });
    });

    // ── ADMIN: MUTE (one-time signal — participant can self-unmute after) ──
    socket.on('host:mute', ({ meetingId, targetUserId }) => {
      const targetId = String(targetUserId);
      const target = findSocketByUserId(targetId, meetingId);

      // Tell the target: mute your mic right now
      if (target) {
        io.to(target).emit('host:mute', {
          forced: true,
          mutedBy: socket.user.name,
          // canSelfUnmute: true means the participant can freely unmute afterward
          canSelfUnmute: true,
        });
      }

      // Tell everyone in the room so the UI shows the muted icon
      io.to(meetingId).emit('participant:muted', {
        userId: targetId,
        muted: true,
        byName: socket.user.name,
      });
    });

    // ── ADMIN: UNMUTE ─────────────────────────────────────────────────────
    socket.on('host:unmute', ({ meetingId, targetUserId }) => {
      const targetId = String(targetUserId);
      const target = findSocketByUserId(targetId, meetingId);
      if (target) io.to(target).emit('host:unmute', { unmuteBy: socket.user.name });
      io.to(meetingId).emit('participant:muted', { userId: targetId, muted: false });
    });

    // ── UNMUTE REQUEST from participant → host ────────────────────────────
    socket.on('unmute:request', async ({ meetingId }) => {
      try {
        const meeting = await Meeting.findOne({ meetingId });
        if (!meeting) return;
        const hostSocket = findSocketByUserId(String(meeting.host), meetingId);
        if (hostSocket) {
          io.to(hostSocket).emit('unmute:request', {
            userId: String(socket.user._id),
            name: socket.user.name,
          });
        }
      } catch (err) { logger.error('unmute:request error:', err); }
    });

    // ── ADMIN: KICK (temporary — user can rejoin freely) ──────────────────
    socket.on('host:kick', ({ meetingId, targetUserId }) => {
      const targetId = String(targetUserId);
      const target = findSocketByUserId(targetId, meetingId);

      if (target) {
        // Tell them they were kicked — frontend will navigate to /join page
        // (NOT /dashboard, so they can see the option to rejoin)
        io.to(target).emit('host:kicked', {
          kickedBy: socket.user.name,
          canRejoin: true, // signal to frontend: this is not a ban
        });
      }

      // Remove them from the room immediately
      io.to(meetingId).emit('participant:left', {
        userId: targetId,
        name: socketUsers.get(target)?.userName,
        reason: 'kicked',
      });
    });

    // ── ADMIN: BAN (permanent — user CANNOT rejoin) ───────────────────────
    socket.on('host:ban', ({ meetingId, targetUserId }) => {
      const targetId = String(targetUserId);
      if (!bannedUsers.has(meetingId)) bannedUsers.set(meetingId, new Set());
      bannedUsers.get(meetingId).add(targetId);

      const target = findSocketByUserId(targetId, meetingId);
      if (target) {
        io.to(target).emit('host:banned', {
          bannedBy: socket.user.name,
          canRejoin: false, // permanent
        });
      }

      io.to(meetingId).emit('participant:left', {
        userId: targetId,
        name: socketUsers.get(target)?.userName,
        reason: 'banned',
      });
    });

    // ── ADMIN: UNBAN ──────────────────────────────────────────────────────
    socket.on('host:unban', ({ meetingId, targetUserId }) => {
      bannedUsers.get(meetingId)?.delete(String(targetUserId));
      socket.emit('participant:unbanned', { userId: String(targetUserId) });
    });

    // ── BREAKOUT ──────────────────────────────────────────────────────────
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

    // ── DISCONNECT ────────────────────────────────────────────────────────
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
    if (meetingRooms.get(meetingId).size === 0) {
      meetingRooms.delete(meetingId);
      bannedUsers.delete(meetingId); // clear bans when room is empty
    }
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
  for (const [socketId, info] of socketUsers.entries()) {
    if (info.userId === String(userId) && info.meetingId === meetingId) return socketId;
  }
  return null;
}

module.exports = setupSocketHandlers;
