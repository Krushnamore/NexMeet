import { useState, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

AgoraRTC.setLogLevel(3);

// ✅ Low latency mode
AgoraRTC.setParameter('SUBSCRIBE_TCC', true);

export const useAgoraRTC = () => {
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null, screen: null });
  const joinedRef = useRef(false);
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
      clientRef.current = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8',
        // ✅ Low latency optimizations
        role: 'host',
      });
    }
    return clientRef.current;
  };

  const join = useCallback(async ({ channelName, uid }) => {
    if (joinedRef.current) {
      console.warn('Already joined, skipping duplicate join');
      return {
        audioTrack: localTracksRef.current.audio,
        videoTrack: localTracksRef.current.video,
        errors: {},
      };
    }
    joinedRef.current = true;

    const client = getClient();

    // ✅ user-published: fast subscribe
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

    // ✅ Get App ID
    let appId = import.meta.env.VITE_AGORA_APP_ID;
    if (!appId || appId.trim() === '') {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/agora/app-id`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } }
        );
        const data = await res.json();
        appId = data.appId;
      } catch {
        joinedRef.current = false;
        throw new Error('Agora App ID missing');
      }
    }

    try {
      await client.join(appId, channelName, null, uid);
      console.log('✅ Agora joined:', channelName, 'uid:', uid);
    } catch (err) {
      joinedRef.current = false;
      throw err;
    }

    let audioTrack = null;
    let videoTrack = null;
    const errors = { audio: null, video: null };

    // ✅ Create mic and camera in PARALLEL for speed
    const [audioResult, videoResult] = await Promise.allSettled([
      AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: {
          sampleRate: 48000,
          stereo: false,
          bitrate: 64,
        },
        AEC: true,
        ANS: true,
        AGC: true,
      }),
      AgoraRTC.createCameraVideoTrack({
        encoderConfig: {
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 24, min: 15 },
          bitrateMax: 800,
          bitrateMin: 200,
        },
        facingMode: 'user',
        optimizationMode: 'motion', // ✅ Better for video calls
      }),
    ]);

    if (audioResult.status === 'fulfilled') {
      audioTrack = audioResult.value;
      localTracksRef.current.audio = audioTrack;
      setLocalAudioTrack(audioTrack);
      console.log('✅ Mic ready');
    } else {
      const err = audioResult.reason;
      console.warn('❌ Mic error:', err.name, err.message);
      if (err.name === 'NotAllowedError') errors.audio = 'Mic blocked. Click 🔒 → allow Microphone → refresh.';
      else if (err.name === 'NotFoundError') errors.audio = 'No microphone found.';
      else if (err.name === 'NotReadableError') errors.audio = 'Mic busy. Close other apps.';
      else errors.audio = err.message;
    }

    if (videoResult.status === 'fulfilled') {
      videoTrack = videoResult.value;
      localTracksRef.current.video = videoTrack;
      setLocalVideoTrack(videoTrack);
      console.log('✅ Camera ready');
    } else {
      const err = videoResult.reason;
      console.warn('❌ Camera error:', err.name, err.message);
      if (err.name === 'NotAllowedError') errors.video = 'Camera blocked. Click 🔒 → allow Camera → refresh.';
      else if (err.name === 'NotFoundError') errors.video = 'No camera found.';
      else if (err.name === 'NotReadableError') errors.video = 'Camera busy. Use a different browser for testing.';
      else errors.video = err.message;
    }

    setDeviceError(errors);

    // ✅ Publish all tracks at once
    const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
    if (tracksToPublish.length > 0) {
      await client.publish(tracksToPublish);
      console.log('✅ Published', tracksToPublish.length, 'track(s)');
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

    // ✅ Check browser support first
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw Object.assign(new Error('Screen sharing is not supported on this browser/device.'), { name: 'NotSupportedError' });
    }

    const screenTrack = await AgoraRTC.createScreenVideoTrack(
      {
        encoderConfig: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: 15,
          bitrateMax: 1000,
        },
      },
      'disable'
    );

    const videoTrack = localTracksRef.current.video;
    if (videoTrack) {
      try { await client.unpublish(videoTrack); } catch {}
    }

    await client.publish(screenTrack);
    localTracksRef.current.screen = screenTrack;

    // Auto stop when user clicks "Stop sharing" in browser
    const stopFn = async () => {
      if (localTracksRef.current.screen === screenTrack) {
        await stopScreenShare();
      }
    };

    if (Array.isArray(screenTrack)) {
      screenTrack[0]?.on('track-ended', stopFn);
    } else {
      screenTrack.on('track-ended', stopFn);
    }

    setIsScreenSharing(true);
    return screenTrack;
  }, []);

  const stopScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const screenTrack = localTracksRef.current.screen;
    if (screenTrack) {
      try {
        if (Array.isArray(screenTrack)) {
          await client.unpublish(screenTrack);
          screenTrack.forEach(t => { try { t.stop(); t.close(); } catch {} });
        } else {
          await client.unpublish(screenTrack);
          screenTrack.stop();
          screenTrack.close();
        }
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
