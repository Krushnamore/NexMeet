import { useState, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

AgoraRTC.setLogLevel(4);

export const useAgoraRTC = () => {
  const clientRef = useRef(null);
  const localTracksRef = useRef({ audio: null, video: null, screen: null });
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [networkQuality, setNetworkQuality] = useState({ uplink: 0, downlink: 0 });

  const getClient = () => {
    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }
    return clientRef.current;
  };

  const join = useCallback(async ({ channelName, uid }) => {
    const client = getClient();

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') user.audioTrack?.play();
      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === user.uid);
        if (exists) return prev.map(u => u.uid === user.uid ? { ...u, ...user } : u);
        return [...prev, user];
      });
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') user.audioTrack?.stop();
      setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, ...user } : u));
    });

    client.on('user-left', (user) => {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    });

    client.on('connection-state-change', (state) => setConnectionState(state));

    client.on('network-quality', (stats) => {
      setNetworkQuality({ uplink: stats.uplinkNetworkQuality, downlink: stats.downlinkNetworkQuality });
    });

    const appId = import.meta.env.VITE_AGORA_APP_ID;
    await client.join(appId, channelName, null, uid);

    let audioTrack = null;
    let videoTrack = null;

    try {
      audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'high_quality',
        AEC: true,
        ANS: true,
        AGC: true,
      });
      localTracksRef.current.audio = audioTrack;
      setLocalAudioTrack(audioTrack);
    } catch (err) {
      console.warn('Microphone access failed:', err.message);
    }

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
    } catch (err) {
      console.warn('Camera access failed:', err.message);
    }

    const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
    if (tracksToPublish.length > 0) await client.publish(tracksToPublish);

    return { audioTrack, videoTrack };
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
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setConnectionState('DISCONNECTED');
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
    if (!client) return;
    const screenTrack = await AgoraRTC.createScreenVideoTrack(
      { encoderConfig: { width: 1920, height: 1080, frameRate: 15, bitrateMax: 1500 } },
      'disable'
    );
    const videoTrack = localTracksRef.current.video;
    if (videoTrack) { try { await client.unpublish(videoTrack); } catch {} }
    await client.publish(screenTrack);
    localTracksRef.current.screen = screenTrack;
    screenTrack.on('track-ended', () => stopScreenShare());
    setIsScreenSharing(true);
    return screenTrack;
  }, []);

  const stopScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    const screenTrack = localTracksRef.current.screen;
    if (screenTrack) {
      try { await client.unpublish(screenTrack); screenTrack.stop(); screenTrack.close(); } catch {}
      localTracksRef.current.screen = null;
    }
    const videoTrack = localTracksRef.current.video;
    if (videoTrack) { try { await client.publish(videoTrack); } catch {} }
    setIsScreenSharing(false);
  }, []);

  return {
    join, leave, toggleAudio, toggleVideo, startScreenShare, stopScreenShare,
    localVideoTrack, localAudioTrack, remoteUsers,
    isAudioMuted, isVideoOff, isScreenSharing, connectionState, networkQuality,
  };
};