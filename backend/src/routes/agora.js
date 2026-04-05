const express = require('express');
const router = express.Router();
const agoraController = require('../controllers/agoraController');
const { auth } = require('../middleware/auth');

router.get('/app-id', agoraController.getAppId);
router.post('/rtc-token', auth, agoraController.generateRtcToken);
router.post('/rtm-token', auth, agoraController.generateRtmToken);

module.exports = router;
