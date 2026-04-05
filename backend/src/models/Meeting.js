const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const participantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['host', 'co-host', 'participant'], default: 'participant' },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  isMuted: { type: Boolean, default: false },
  isVideoOff: { type: Boolean, default: false },
  isHandRaised: { type: Boolean, default: false },
  reaction: { type: String, default: null },
  breakoutRoom: { type: String, default: null },
}, { _id: false });

const breakoutRoomSchema = new mongoose.Schema({
  id: { type: String, default: () => uuidv4() },
  name: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const meetingSchema = new mongoose.Schema({
  meetingId: {
    type: String,
    unique: true, // ← this already creates the index
    default: () => uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase(),
  },
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coHosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  participants: [participantSchema],
  status: {
    type: String,
    enum: ['scheduled', 'active', 'ended', 'cancelled'],
    default: 'scheduled',
  },
  scheduledAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  settings: {
    password: { type: String, default: null },
    waitingRoom: { type: Boolean, default: false },
    allowParticipantsUnmute: { type: Boolean, default: true },
    allowParticipantsVideo: { type: Boolean, default: true },
    allowScreenShare: { type: Boolean, default: true },
    allowChat: { type: Boolean, default: true },
    recordMeeting: { type: Boolean, default: false },
    maxParticipants: { type: Number, default: 0 },
    muteOnEntry: { type: Boolean, default: false },
    videoOffOnEntry: { type: Boolean, default: false },
  },
  isLocked: { type: Boolean, default: false },
  isRecording: { type: Boolean, default: false },
  breakoutRooms: [breakoutRoomSchema],
  waitingRoom: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    joinedAt: { type: Date, default: Date.now },
  }],
  agoraChannel: { type: String },
  recordings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recording' }],
  chatMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' }],
}, { timestamps: true });

meetingSchema.pre('save', function(next) {
  if (!this.agoraChannel) this.agoraChannel = this.meetingId;
  next();
});

// ✅ FIXED: removed duplicate `meetingId: 1` index (unique:true above already creates it)
meetingSchema.index({ host: 1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ scheduledAt: 1 });
meetingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Meeting', meetingSchema);