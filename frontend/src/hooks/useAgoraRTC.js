import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import api from '../services/api';

AgoraRTC.setLogLevel(2);

const isIOS     = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

const useAgoraRTC = ({ appId, channel, token, uid, onUserJoined, onUserLeft }) => {
  const clientRef          = useRef(null);
  const localAudioRef      = useRef(null);
  const localVideoRef      = useRef(null);
  const screenTrackRef     = useRef(null);
  const screenClientRef    = useRef(null);
  const audioLevelTimerRef = useRef(null);

  // onUserJoined/onUserLeft come from the parent as inline callbacks that
  // often get a new identity on unrelated re-renders (e.g. MeetingRoom's
  // handleUserLeft changes identity whenever screenSharerUid changes).
  // Keeping them in the join/leave effect's dependency array would tear
  // down and rebuild the whole Agora client — leave channel, close tracks,
  // rejoin — every time that happens. Refs sidestep that: the effect reads
  // the latest callback via the ref without needing it as a dependency.
  const onUserJoinedRef = useRef(onUserJoined);
  const onUserLeftRef   = useRef(onUserLeft);
  useEffect(() => { onUserJoinedRef.current = onUserJoined; }, [onUserJoined]);
  useEffect(() => { onUserLeftRef.current   = onUserLeft;   }, [onUserLeft]);

  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [remoteUsers,     setRemoteUsers]     = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel,      setAudioLevel]      = useState(0);
  const [joined,          setJoined]          = useState(false);
  const [error,           setError]           = useState(null);

  // ── CREATE CLIENT ONCE ───────────────────────────────────────────────────
  // Created lazily on first use so `join` (below) always has a client to
  // work with, even before the auto-join effect has run.
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }
    return clientRef.current;
  }, []);

  // ── JOIN ──────────────────────────────────────────────────────────────
  // Declared once, at the top level, as a stable useCallback. This is the
  // ONLY definition of `join` — the old code had a second, dead-code copy
  // declared *after* the `return` statement, which caused:
  //   "Uncaught ReferenceError: Cannot access 'join' before initialization"
  const join = useCallback(async () => {
    if (!appId || !channel || !token) return;
    const client = getClient();

    try {
      console.log('Joining Agora with:', { appId, channel, uid, hasToken: !!token });
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
          width:      { ideal: 1280 },
          height:     { ideal: 720  },
          frameRate:  24,
          bitrateMin: 400,
          bitrateMax: 1500,
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
      console.error('❌ Agora join failed:', err.code, err.message);
      setError(err.message || 'Failed to join call');
    }
  }, [appId, channel, token, uid, getClient]);

  // ── INIT / AUTO-JOIN ON MOUNT ────────────────────────────────────────────
  useEffect(() => {
    if (!appId || !channel || !token) return;

    const client = getClient();

    // NOTE: `user` (IAgoraRTCRemoteUser) exposes `videoTrack` / `audioTrack`
    // as GETTERS defined on its prototype (get videoTrack(){...}), not as
    // the instance's own enumerable properties. `{ ...u, ...user }` only
    // copies OWN enumerable properties, so every spread silently dropped
    // videoTrack/audioTrack from the resulting object -> the second
    // 'user-published' event (audio publishes, then video, or vice versa)
    // overwrote the working entry with one where videoTrack/audioTrack were
    // undefined. That's why the remote tile stayed on the placeholder even
    // though the SDK had genuinely subscribed successfully.
    // Fix: keep the SAME live `user` reference (Agora reuses one instance
    // per uid and updates it in place), just swap it into a NEW array so
    // React re-renders. Reading u.videoTrack later goes through the getter
    // and always reflects the current subscription state.
    const handleUserPublished = async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      setRemoteUsers((prev) => {
        const idx = prev.findIndex((u) => u.uid === user.uid);
        if (idx === -1) return [...prev, user];
        const next = [...prev];
        next[idx] = user;
        return next;
      });
      onUserJoinedRef.current?.(user, mediaType);
    };

    const handleUserUnpublished = (user) => {
      setRemoteUsers((prev) => prev.map((u) => (u.uid === user.uid ? user : u)));
    };

    const handleUserLeft = (user) => {
      setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      onUserLeftRef.current?.(user);
    };

    client.on('user-published',   handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left',        handleUserLeft);

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
      clientRef.current = null;
    };
  }, [appId, channel, token, uid, join, getClient]);

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

        // The main `token` is cryptographically bound to `uid` — it will NOT
        // authorize a join with `screenUid`. Fetch a fresh token for this uid.
        const { data: screenTokenRes } = await api.post('/agora/rtc-token', {
          channelName: channel,
          uid: screenUid,
        });
        await screenClient.join(appId, channel, screenTokenRes.token, screenUid);

        // Wrap the native MediaStreamTrack in an Agora custom video track
        const screenTrack = await AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: stream.getVideoTracks()[0],
          frameRate:  15,
          bitrateMax: 1500,
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

      // Same fix as the Android path above: the main token is bound to
      // `uid` and will be rejected for `screenUid` — fetch a fresh one.
      const { data: screenTokenRes } = await api.post('/agora/rtc-token', {
        channelName: channel,
        uid: screenUid,
      });
      await screenClient.join(appId, channel, screenTokenRes.token, screenUid);

      const screenTrack = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: {
            width:      { ideal: 1920, max: 1920 },
            height:     { ideal: 1080, max: 1080 },
            frameRate:  15,
            bitrateMax: 3000,
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
    join,
  };
};

export default useAgoraRTC;