exports.generateRtcToken = async (req, res, next) => {
  try {
    const { channelName, uid } = req.body;
    const appId = process.env.AGORA_APP_ID;
    res.json({ token: null, appId, uid, channel: channelName });
  } catch (err) {
    next(err);
  }
};

exports.generateRtmToken = async (req, res, next) => {
  try {
    const appId = process.env.AGORA_APP_ID;
    res.json({ token: null, appId, userId: req.body.userId });
  } catch (err) {
    next(err);
  }
};

exports.getAppId = (req, res) => {
  res.json({ appId: process.env.AGORA_APP_ID });
};