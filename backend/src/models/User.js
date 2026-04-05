const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // ← this already creates the index
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  avatar: { type: String, default: null },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
  }],
  meetingsHosted: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' }],
  meetingsJoined: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' }],
  settings: {
    defaultMicOn: { type: Boolean, default: false },
    defaultVideoOn: { type: Boolean, default: true },
    theme: { type: String, default: 'dark' },
    notifications: { type: Boolean, default: true },
  },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  return obj;
};

// ✅ FIXED: removed duplicate `email: 1` index (unique:true above already creates it)
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);