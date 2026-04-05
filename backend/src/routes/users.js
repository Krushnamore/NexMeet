const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

router.use(auth);

router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });

    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
      isActive: true,
    }).select('name email avatar').limit(10);

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.get('/:userId', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('name email avatar');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
