// routes/chat.js
const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const Meeting = require('../models/Meeting');
const { auth } = require('../middleware/auth');

router.use(auth);

// Get chat history for a meeting
router.get('/:meetingId', async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const { page = 1, limit = 50 } = req.query;
    const query = {
      meeting: meeting._id,
      isDeleted: false,
      $or: [
        { isPrivate: false },
        { sender: req.user._id },
        { recipient: req.user._id },
      ],
    };

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sender', 'name avatar')
      .populate('recipient', 'name');

    const total = await ChatMessage.countDocuments(query);

    res.json({ messages, total, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
});

// Delete a message (sender only)
router.delete('/message/:messageId', async (req, res, next) => {
  try {
    const message = await ChatMessage.findById(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Cannot delete others\' messages' });
    }
    message.isDeleted = true;
    await message.save();
    res.json({ message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
