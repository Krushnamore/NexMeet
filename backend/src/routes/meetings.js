const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { auth } = require('../middleware/auth');

// ADD THIS LINE ↓
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

router.use(auth);

router.post('/', meetingController.createMeeting);
router.get('/', meetingController.getUserMeetings);
router.get('/:meetingId', meetingController.getMeeting);
router.post('/:meetingId/start', meetingController.startMeeting);
router.post('/:meetingId/join', meetingController.joinMeeting);
router.post('/:meetingId/leave', meetingController.leaveMeeting);
router.post('/:meetingId/end', meetingController.endMeeting);
router.post('/:meetingId/lock', meetingController.toggleLock);
router.post('/:meetingId/mute', meetingController.muteParticipant);
router.delete('/:meetingId/participants/:userId', meetingController.removeParticipant);
router.post('/:meetingId/breakout-rooms', meetingController.createBreakoutRooms);
router.post('/:meetingId/co-host', meetingController.promoteToCoHost);

// ADD THIS ROUTE ↓
router.get('/:meetingId/agora-token', async (req, res) => {
  try {
    const appId          = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    // If no certificate configured, return a dummy token for dev/testing
    if (!appCertificate || appCertificate === 'your_certificate_here') {
      const uid = Math.floor(Math.random() * 100000);
      return res.json({ token: null, uid, channel: req.params.meetingId });
    }

    const uid               = Math.floor(Math.random() * 100000);
    const role              = RtcRole.PUBLISHER;
    const expireTime        = 7200; // 2 hours
    const privilegeExpireTs = Math.floor(Date.now() / 1000) + expireTime;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      req.params.meetingId,
      uid,
      role,
      privilegeExpireTs
    );

    res.json({ token, uid, channel: req.params.meetingId });
  } catch (err) {
    console.error('agora-token error:', err.message);
    res.status(500).json({ message: 'Failed to generate Agora token', error: err.message });
  }
});

module.exports = router;