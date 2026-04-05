const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const logger = require('../utils/logger');

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return { accessToken, refreshToken };
};

// Register
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });
    const { accessToken, refreshToken } = generateTokens(user._id);

    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'Registration successful',
      user: user.toJSON(),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// Login
exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account has been deactivated' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token (keep only last 5)
    user.refreshTokens.push({ token: refreshToken });
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    user.lastSeen = new Date();
    await user.save();

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

// Refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
    if (!tokenExists) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id);

    // Replace old refresh token
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
    user.refreshTokens.push({ token: newRefreshToken });
    await user.save();

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    next(err);
  }
};

// Logout
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const user = await User.findById(req.user._id);
    if (user && refreshToken) {
      user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
      await user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// Get current user
exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

// Update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, settings, avatar } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (settings) updates.settings = { ...req.user.settings, ...settings };
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};
