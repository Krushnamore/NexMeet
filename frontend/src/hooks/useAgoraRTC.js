import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

AgoraRTC.setLogLevel(2);

const isIOS     = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

const useAgoraRTC = ({ appId, channel, token, uid, onUserJoined, onUserLeft }) => {
  const clientRef         = useRef(null);
  const localAudioRef     = useRef(null);
  const localVideoRef     = useRef(null);
  const screenTrackRef    = useRef(null);
  const screenClientRef   = useRef(null);
  const audioLevelTimerRef = useRef(null);

  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers,     setRemoteUsers]     = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel,      setAudioLevel]      = useState(0);
  const [joined,          setJoined]          = useState(false);
  const [error,           setError]           = useState(null);

  // ── INIT ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!appId || !channel || !token) return;

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    const handleUserPublished = async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => {
        const exists = prev.find((u) => u.uid === user.uid);
        return exists
          ? prev.map((u) => (u.uid === user.uid ? { ...u, ...user } : u))
          : [...prev, user];
      });
      onUserJoined?.(user, mediaType);
    };

    const handleUserUnpublished = (user) => {
      setRemoteUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, ...user } : u))
      );
    };

    const handleUserLeft = (user) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      onUserLeft?.(user);
    };

    client.on('user-published',   handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left',        handleUserLeft);

    const join = async () => {
      try {
        await client.join(appId, channel, token, uid);
        console.log('✅ Agora joined:', channel, 'uid:', uid);

        // Audio with full echo/noise cancellation
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'music_standard',
          AEC: true,  // Acoustic Echo Cancellation
          ANS: true,  // Automatic Noise Suppression
          AGC: true,  // Automatic Gain Control
        });
        localAudioRef.current = audioTrack;
        setLocalAudioTrack(audioTrack);

        // Camera
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width:       { ideal: 1280 },
            height:      { ideal: 720  },
            frameRate:   24,
            bitrateMin:  400,
            bitrateMax:  1500,
          },
          facingMode: 'user',
        });
        localVideoRef.current = videoTrack;
        setLocalVideoTrack(videoTrack);

        await client.publish([audioTrack, videoTrack]);
        console.log('✅ Published 2 track(s)');
        setJoined(true);

        // Audio level meter (0-100, correct direction for volume bar)
        audioLevelTimerRef.current = setInterval(() => {
          const level = audioTrack.getVolumeLevel?.() ?? 0;
          setAudioLevel(Math.round(level * 100));
        }, 200);

      } catch (err) {
        console.error('Agora join error:', err);
        setError(err.message || 'Failed to join call');
      }
    };

    join();

    return () => {
      clearInterval(audioLevelTimerRef.current);
      client.off('user-published',   handleUserPublished);
      client.off('user-unpublished', handleUserUnpublished);
      client.off('user-left',        handleUserLeft);
      localAudioRef.current?.close();
      localVideoRef.current?.close();
      screenTrackRef.current?.close();
      screenClientRef.current?.leave();
      client.leave();
    };
  }, [appId, channel, token, uid]);

  // ── MUTE / UNMUTE ────────────────────────────────────────────────────────
  const muteAudio = useCallback(async () => {
    await localAudioRef.current?.setMuted(true);
  }, []);

  const unmuteAudio = useCallback(async () => {
    await localAudioRef.current?.setMuted(false);
  }, []);

  // ── VIDEO ON / OFF ───────────────────────────────────────────────────────
  const disableVideo = useCallback(async () => {
    await localVideoRef.current?.setMuted(true);
  }, []);

  const enableVideo = useCallback(async () => {
    await localVideoRef.current?.setMuted(false);
  }, []);

  // ── STOP SCREEN SHARE ────────────────────────────────────────────────────
  const stopScreenShare = useCallback(async () => {
    try {
      screenTrackRef.current?.close();
      screenTrackRef.current = null;
      await screenClientRef.current?.leave();
      screenClientRef.current = null;
      setIsScreenSharing(false);
    } catch (err) {
      console.error('stopScreenShare error:', err);
    }
  }, []);

  // ── START SCREEN SHARE ───────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {

    // ── iOS: completely blocked by Apple, no workaround ──────────────────
    if (isIOS()) {
      throw new Error(
        'Screen sharing is not supported on iPhone or iPad. This is an Apple restriction and cannot be worked around in a browser. Please use a laptop or desktop.'
      );
    }

    // ── Android: tab capture only via getDisplayMedia ────────────────────
    if (isAndroid()) {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error(
          'Your browser does not support screen sharing. Please open this page in Chrome on Android and try again.'
        );
      }

      try {
        // Request tab capture — Android Chrome 94+ supports this
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            preferCurrentTab: true, // share the current browser tab
            frameRate:        { ideal: 15 },
            width:            { ideal: 1280 },
            height:           { ideal: 720  },
          },
          audio: false,
        });

        // Create a separate Agora client for the screen share stream
        // so it appears as its own tile, never overlapping the camera
        const screenClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        screenClientRef.current = screenClient;

        const screenUid = uid + 10000; // offset so it's a unique UID in the channel
        await screenClient.join(appId, channel, token, screenUid);

        // Wrap the native MediaStreamTrack in an Agora custom video track
        const screenTrack = await AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: stream.getVideoTracks()[0],
          frameRate:   15,
          bitrateMax:  1500,
        });

        screenTrackRef.current = screenTrack;
        await screenClient.publish(screenTrack);

        // Handle user clicking "Stop sharing" in the browser UI
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          stopScreenShare();
        });

        setIsScreenSharing(true);
        return screenUid;

      } catch (err) {
        screenClientRef.current?.leave();
        screenClientRef.current = null;

        if (err.name === 'NotAllowedError') {
          throw new Error(
            'Screen share permission was denied. Please tap Allow when the browser asks for permission.'
          );
        }
        if (err.name === 'NotSupportedError') {
          throw new Error(
            'Tab sharing is not supported on this Android browser. Please use Chrome.'
          );
        }
        throw new Error(`Screen share failed: ${err.message}`);
      }
    }

    // ── Desktop: full screen / window / tab picker ───────────────────────
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error(
        'Screen sharing is not supported in this browser. Please use Chrome, Edge, or Firefox.'
      );
    }

    try {
      const screenClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      screenClientRef.current = screenClient;

      const screenUid = uid + 10000;
      await screenClient.join(appId, channel, token, screenUid);

      const screenTrack = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: {
            width:       { ideal: 1920, max: 1920 },
            height:      { ideal: 1080, max: 1080 },
            frameRate:   15,
            bitrateMax:  3000,
          },
          optimizationMode: 'detail', // crisp text & UI
        },
        'disable' // don't capture system audio — avoids echo
      );

      screenTrackRef.current = screenTrack;
      await screenClient.publish(screenTrack);

      // Handle "Stop sharing" button in the browser toolbar
      screenTrack.on('track-ended', () => {
        stopScreenShare();
      });

      setIsScreenSharing(true);
      return screenUid;

    } catch (err) {
      screenClientRef.current?.leave();
      screenClientRef.current = null;

      if (err.name === 'NotAllowedError') {
        throw new Error('Screen share cancelled or permission denied.');
      }
      throw err;
    }
  }, [appId, channel, token, uid, stopScreenShare]);

  return {
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    isScreenSharing,
    audioLevel,
    joined,
    error,
    muteAudio,
    unmuteAudio,
    disableVideo,
    enableVideo,
    startScreenShare,
    stopScreenShare,
    client: clientRef.current,
  };
};

export default useAgoraRTC;