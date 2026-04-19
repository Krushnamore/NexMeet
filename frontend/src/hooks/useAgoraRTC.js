import { useState, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

AgoraRTC.setLogLevel(3);

export const useAgoraRTC = () => {
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null, screen: null });
  const joinedRef = useRef(false); // ✅ prevent double-join
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [networkQuality, setNetworkQuality] = useState({ uplink: 0, downlink: 0 });
  const [deviceError, setDeviceError] = useState({ audio: null, video: null });

  const getClient = () => {
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }
    return clientRef.current;
  };

  const join = useCallback(async ({ channelName, uid }) => {
    // ✅ Prevent double join (React StrictMode or effect re-run)
    if (joinedRef.current) {
      console.warn('Agora join already in progress or completed, skipping');
      return { audioTrack: localTracksRef.current.audio, videoTrack: localTracksRef.current.video, errors: {} };
    }
    joinedRef.current = true;

    const client = getClient();

    client.on('user-published', async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
        setRemoteUsers(prev => {
          const others = prev.filter(u => u.uid !== user.uid);
          return [...others, {
            uid: user.uid,
            videoTrack: user.videoTrack,
            audioTrack: user.audioTrack,
            hasVideo: user.hasVideo,
            hasAudio: user.hasAudio,
            _ts: Date.now(),
          }];
        });
      } catch (err) {
        console.error('Subscribe error:', err);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio' && user.audioTrack) {
        try { user.audioTrack.stop(); } catch {}
      }
      setRemoteUsers(prev => {
        const others = prev.filter(u => u.uid !== user.uid);
        return [...others, {
          uid: user.uid,
          videoTrack: user.videoTrack,
          audioTrack: user.audioTrack,
          hasVideo: user.hasVideo,
          hasAudio: user.hasAudio,
          _ts: Date.now(),
        }];
      });
    });

    client.on('user-left', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    client.on('connection-state-change', (state) => {
      setConnectionState(state);
    });

    client.on('network-quality', (stats) => {
      setNetworkQuality({
        uplink: stats.uplinkNetworkQuality,
        downlink: stats.downlinkNetworkQuality,
      });
    });

    // ✅ Get App ID from env or backend
    let appId = import.meta.env.VITE_AGORA_APP_ID;
    if (!appId || appId.trim() === '') {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/agora/app-id`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } }
        );
        const data = await res.json();
        appId = data.appId;
      } catch (err) {
        joinedRef.current = false;
        throw new Error('Agora App ID missing. Check VITE_AGORA_APP_ID in frontend .env');
      }
    }

    console.log('Joining Agora channel:', channelName, '| uid:', uid, '| appId:', appId?.slice(0, 8) + '...');

    try {
      await client.join(appId, channelName, null, uid);
      console.log('✅ Agora channel joined successfully');
    } catch (err) {
      joinedRef.current = false;
      throw err;
    }

    let audioTrack = null;
    let videoTrack = null;
    const errors = { audio: null, video: null };

    // ✅ Try microphone
    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'high_quality',
        AEC: true,
        ANS: true,
        AGC: true,
      });
      localTracksRef.current.audio = audioTrack;
      setLocalAudioTrack(audioTrack);
      console.log('✅ Microphone ready');
    } catch (err) {
      console.warn('❌ Mic error:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        errors.audio = 'Mic blocked. Click 🔒 in address bar → allow Microphone → refresh.';
      } else if (err.name === 'NotFoundError') {
        errors.audio = 'No microphone found on this device.';
      } else if (err.name === 'NotReadableError') {
        errors.audio = 'Mic busy. Close other apps using it and refresh.';
      } else {
        errors.audio = `Mic error: ${err.message}`;
      }
    }

    // ✅ Try camera
    try {
      videoTrack = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 360 },
          frameRate: 30,
          bitrateMax: 1500,
        },
        facingMode: 'user',
      });
      localTracksRef.current.video = videoTrack;
      setLocalVideoTrack(videoTrack);
      console.log('✅ Camera ready');
    } catch (err) {
      console.warn('❌ Camera error:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        errors.video = 'Camera blocked. Click 🔒 in address bar → allow Camera → refresh.';
      } else if (err.name === 'NotFoundError') {
        errors.video = 'No camera found.';
      } else if (err.name === 'NotReadableError') {
        errors.video = 'Camera busy. Another tab is using it. Use Edge/Firefox for the second participant.';
      } else {
        errors.video = `Camera error: ${err.message}`;
      }
    }

    setDeviceError(errors);

    // ✅ Publish tracks
    const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
    if (tracksToPublish.length > 0) {
      await client.publish(tracksToPublish);
      console.log('✅ Published', tracksToPublish.length, 'track(s)');
    } else {
      console.warn('⚠️ No tracks published — listen-only mode');
    }

    return { audioTrack, videoTrack, errors };
  }, []);

  const leave = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    Object.values(localTracksRef.current).forEach(track => {
      if (track) { try { track.stop(); track.close(); } catch {} }
    });
    localTracksRef.current = { audio: null, video: null, screen: null };

    try { await client.leave(); } catch {}
    clientRef.current = null;
    joinedRef.current = false;

    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setConnectionState('DISCONNECTED');
    setDeviceError({ audio: null, video: null });
  }, []);

  const toggleAudio = useCallback(async () => {
    const track = localTracksRef.current.audio;
    if (!track) return false;
    const newMuted = !isAudioMuted;
    await track.setMuted(newMuted);
    setIsAudioMuted(newMuted);
    return newMuted;
  }, [isAudioMuted]);

  const toggleVideo = useCallback(async () => {
    const track = localTracksRef.current.video;
    if (!track) return false;
    const newOff = !isVideoOff;
    await track.setMuted(newOff);
    setIsVideoOff(newOff);
    return newOff;
  }, [isVideoOff]);

  const startScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client) throw new Error('Not connected');

    const screenTrack = await AgoraRTC.createScreenVideoTrack(
      { encoderConfig: { width: 1920, height: 1080, frameRate: 15, bitrateMax: 1500 } },
      'disable'
    );

    const videoTrack = localTracksRef.current.video;
    if (videoTrack) {
      try { await client.unpublish(videoTrack); } catch {}
    }

    await client.publish(screenTrack);
    localTracksRef.current.screen = screenTrack;

    screenTrack.on('track-ended', async () => {
      await stopScreenShare();
    });

    setIsScreenSharing(true);
    return screenTrack;
  }, []);

  const stopScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const screenTrack = localTracksRef.current.screen;
    if (screenTrack) {
      try {
        await client.unpublish(screenTrack);
        screenTrack.stop();
        screenTrack.close();
      } catch {}
      localTracksRef.current.screen = null;
    }

    const videoTrack = localTracksRef.current.video;
    if (videoTrack) {
      try { await client.publish(videoTrack); } catch {}
    }

    setIsScreenSharing(false);
  }, []);

  return {
    join,
    leave,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    connectionState,
    networkQuality,
    deviceError,
  };
};