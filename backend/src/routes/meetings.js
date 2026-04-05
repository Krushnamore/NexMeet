const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const { auth } = require('../middleware/auth');

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

module.exports = router;
