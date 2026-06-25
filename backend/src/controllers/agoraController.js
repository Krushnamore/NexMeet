const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

exports.generateRtcToken = async (req, res, next) => {
  try {
    const { channelName, uid } = req.body;
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return res.status(500).json({ error: 'Agora credentials missing from server environment' });
    }

    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600; // 1 hour token
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // ✅ Generate the actual token
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs
    );

    res.json({ token, appId, uid, channel: channelName });
  } catch (err) {
    next(err);
  }
};

exports.generateRtmToken = async (req, res, next) => {
  try {
    // Note: If you use Agora RTM (chat), you will need RtmTokenBuilder here too.
    const appId = process.env.AGORA_APP_ID;
    res.json({ token: null, appId, userId: req.body.userId });
  } catch (err) {
    next(err);
  }
};

exports.getAppId = (req, res) => {
  res.json({ appId: process.env.AGORA_APP_ID });
};