const { v4: uuidv4 } = require('uuid');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const logger = require('../utils/logger');

// Create meeting
exports.createMeeting = async (req, res, next) => {
  try {
    const { title, description, scheduledAt, settings } = req.body;

    const meeting = await Meeting.create({
      title,
      description,
      host: req.user._id,
      scheduledAt: scheduledAt || null,
      settings: settings || {},
    });

    await User.findByIdAndUpdate(req.user._id, {
      $push: { meetingsHosted: meeting._id },
    });

    await meeting.populate('host', 'name email avatar');
    logger.info(`Meeting created: ${meeting.meetingId} by ${req.user.email}`);

    res.status(201).json({ meeting });
  } catch (err) {
    next(err);
  }
};

// Get meeting by meetingId
exports.getMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId })
      .populate('host', 'name email avatar')
      .populate('coHosts', 'name email avatar')
      .populate('participants.user', 'name email avatar');

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ meeting });
  } catch (err) {
    next(err);
  }
};

// Start meeting
exports.startMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can start the meeting' });
    }

    meeting.status = 'active';
    meeting.startedAt = new Date();
    await meeting.save();

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('meeting:started', { meetingId: meeting.meetingId });

    res.json({ meeting });
  } catch (err) {
    next(err);
  }
};

// Join meeting
exports.joinMeeting = async (req, res, next) => {
  try {
    const { password } = req.body;
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });

    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.status === 'ended') return res.status(400).json({ error: 'Meeting has ended' });
    if (meeting.status === 'cancelled') return res.status(400).json({ error: 'Meeting was cancelled' });
    if (meeting.isLocked) return res.status(403).json({ error: 'Meeting is locked by host' });

    // Check password
    if (meeting.settings.password && meeting.settings.password !== password) {
      return res.status(403).json({ error: 'Incorrect meeting password' });
    }

    // Check if already a participant
    const existingParticipant = meeting.participants.find(
      p => p.user.toString() === req.user._id.toString() && p.isActive
    );

    if (!existingParticipant) {
      const role = meeting.host.toString() === req.user._id.toString() ? 'host' :
        meeting.coHosts.some(ch => ch.toString() === req.user._id.toString()) ? 'co-host' : 'participant';

      meeting.participants.push({
        user: req.user._id,
        name: req.user.name,
        role,
        isMuted: meeting.settings.muteOnEntry,
        isVideoOff: meeting.settings.videoOffOnEntry,
      });

      if (meeting.status === 'scheduled' && role === 'host') {
        meeting.status = 'active';
        meeting.startedAt = new Date();
      }

      await meeting.save();

      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { meetingsJoined: meeting._id },
      });
    }

    await meeting.populate('host', 'name email avatar');
    await meeting.populate('participants.user', 'name email avatar');

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('participant:joined', {
      participant: { user: req.user, name: req.user.name },
    });

    res.json({ meeting });
  } catch (err) {
    next(err);
  }
};

// Leave meeting
exports.leaveMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const participant = meeting.participants.find(
      p => p.user.toString() === req.user._id.toString() && p.isActive
    );

    if (participant) {
      participant.isActive = false;
      participant.leftAt = new Date();
      await meeting.save();
    }

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('participant:left', { userId: req.user._id });

    // End meeting if host leaves and no co-hosts
    if (meeting.host.toString() === req.user._id.toString()) {
      const activeCoHosts = meeting.participants.filter(
        p => p.role === 'co-host' && p.isActive
      );
      if (activeCoHosts.length === 0) {
        meeting.status = 'ended';
        meeting.endedAt = new Date();
        await meeting.save();
        io.to(meeting.meetingId).emit('meeting:ended', { meetingId: meeting.meetingId });
      }
    }

    res.json({ message: 'Left meeting successfully' });
  } catch (err) {
    next(err);
  }
};

// End meeting (host only)
exports.endMeeting = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.host.toString() !== req.user._id.toString()) {
      const isCoHost = meeting.coHosts.some(ch => ch.toString() === req.user._id.toString());
      if (!isCoHost) return res.status(403).json({ error: 'Only host or co-host can end the meeting' });
    }

    meeting.status = 'ended';
    meeting.endedAt = new Date();
    meeting.participants.forEach(p => {
      if (p.isActive) { p.isActive = false; p.leftAt = new Date(); }
    });
    await meeting.save();

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('meeting:ended', { meetingId: meeting.meetingId });

    res.json({ message: 'Meeting ended successfully' });
  } catch (err) {
    next(err);
  }
};

// Host controls - mute participant
exports.muteParticipant = async (req, res, next) => {
  try {
    const { userId, muted } = req.body;
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const isHostOrCoHost = meeting.host.toString() === req.user._id.toString() ||
      meeting.coHosts.some(ch => ch.toString() === req.user._id.toString());

    if (!isHostOrCoHost) return res.status(403).json({ error: 'Insufficient permissions' });

    const participant = meeting.participants.find(p => p.user.toString() === userId && p.isActive);
    if (participant) {
      participant.isMuted = muted;
      await meeting.save();
    }

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('participant:muted', { userId, muted });

    res.json({ message: 'Participant mute status updated' });
  } catch (err) {
    next(err);
  }
};

// Remove participant
exports.removeParticipant = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can remove participants' });
    }

    const participant = meeting.participants.find(p => p.user.toString() === userId && p.isActive);
    if (participant) {
      participant.isActive = false;
      participant.leftAt = new Date();
      await meeting.save();
    }

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('participant:removed', { userId });

    res.json({ message: 'Participant removed' });
  } catch (err) {
    next(err);
  }
};

// Lock/unlock meeting
exports.toggleLock = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can lock the meeting' });
    }

    meeting.isLocked = !meeting.isLocked;
    await meeting.save();

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('meeting:lockChanged', { isLocked: meeting.isLocked });

    res.json({ isLocked: meeting.isLocked });
  } catch (err) {
    next(err);
  }
};

// Create breakout rooms
exports.createBreakoutRooms = async (req, res, next) => {
  try {
    const { rooms } = req.body; // [{ name, participants: [userId] }]
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can create breakout rooms' });
    }

    meeting.breakoutRooms = rooms.map(r => ({
      id: uuidv4(),
      name: r.name,
      participants: r.participants || [],
      isActive: true,
    }));
    await meeting.save();

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('breakoutRooms:created', { rooms: meeting.breakoutRooms });

    res.json({ breakoutRooms: meeting.breakoutRooms });
  } catch (err) {
    next(err);
  }
};

// Get user meetings
exports.getUserMeetings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = {
      $or: [
        { host: req.user._id },
        { 'participants.user': req.user._id },
      ],
    };
    if (status) query.status = status;

    const meetings = await Meeting.find(query)
      .populate('host', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Meeting.countDocuments(query);

    res.json({ meetings, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// Promote to co-host
exports.promoteToCoHost = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only host can assign co-hosts' });
    }

    if (!meeting.coHosts.includes(userId)) {
      meeting.coHosts.push(userId);
    }
    const participant = meeting.participants.find(p => p.user.toString() === userId);
    if (participant) participant.role = 'co-host';

    await meeting.save();

    const io = req.app.get('io');
    io.to(meeting.meetingId).emit('participant:roleChanged', { userId, role: 'co-host' });

    res.json({ message: 'User promoted to co-host' });
  } catch (err) {
    next(err);
  }
};
