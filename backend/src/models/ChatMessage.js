const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderName: { type: String, required: true },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['text', 'file', 'image', 'system'],
    default: 'text',
  },
  // For private messages
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null = group message
  },
  recipientName: { type: String, default: null },
  isPrivate: { type: Boolean, default: false },
  // For breakout room messages
  breakoutRoomId: { type: String, default: null },
  // File attachments
  attachment: {
    url: String,
    name: String,
    size: Number,
    mimeType: String,
  },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
  }],
  isDeleted: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
}, {
  timestamps: true,
});

chatMessageSchema.index({ meeting: 1, createdAt: 1 });
chatMessageSchema.index({ sender: 1 });
chatMessageSchema.index({ isPrivate: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
