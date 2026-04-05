// routes/recordings.js
const express = require('express');
const router = express.Router();
const Recording = require('../models/Recording');
const Meeting = require('../models/Meeting');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/:meetingId', async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const recordings = await Recording.find({ meeting: meeting._id })
      .populate('initiatedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ recordings });
  } catch (err) {
    next(err);
  }
});

router.post('/:meetingId/start', async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId });
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const recording = await Recording.create({
      meeting: meeting._id,
      initiatedBy: req.user._id,
      status: 'recording',
    });

    meeting.isRecording = true;
    meeting.recordings.push(recording._id);
    await meeting.save();

    res.status(201).json({ recording });
  } catch (err) {
    next(err);
  }
});

router.post('/:recordingId/stop', async (req, res, next) => {
  try {
    const recording = await Recording.findById(req.params.recordingId);
    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    recording.status = 'completed';
    recording.endedAt = new Date();
    recording.duration = Math.floor((recording.endedAt - recording.startedAt) / 1000);
    await recording.save();

    const meeting = await Meeting.findById(recording.meeting);
    if (meeting) { meeting.isRecording = false; await meeting.save(); }

    res.json({ recording });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
