const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['recording', 'processing', 'completed', 'failed'],
    default: 'recording',
  },
  storageProvider: {
    type: String,
    enum: ['firebase', 'supabase', 'local'],
    default: 'firebase',
  },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileSize: { type: Number, default: 0 }, // bytes
  duration: { type: Number, default: 0 }, // seconds
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  metadata: {
    resolution: String,
    format: { type: String, default: 'webm' },
    participants: Number,
    agoraResourceId: String,
    agoraSid: String,
  },
}, {
  timestamps: true,
});

recordingSchema.index({ meeting: 1 });
recordingSchema.index({ initiatedBy: 1 });

module.exports = mongoose.model('Recording', recordingSchema);
