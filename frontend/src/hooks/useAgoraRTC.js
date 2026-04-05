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
      setRemoteUsers(prev => {
        const exists = prev.find(u => u.uid === user.uid);
        if (exists) return prev.map(u => u.uid === user.uid ? user : u);
        return [...prev, user];
      });
    });

    client.on('user-unpublished', (user) => {
      setRemoteUsers(prev => prev.map(u => u.uid === user.uid ? user : u));
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

    const appId = import.meta.env.VITE_AGORA_APP_ID;

    // Join with null token — works when App Certificate is disabled in Agora console
    await client.join(appId, channelName, null, uid);

    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
      { encoderConfig: 'high_quality' },
      { encoderConfig: { width: 1280, height: 720, frameRate: 30, bitrateMax: 1500 } }
    );

    localTracksRef.current.audio = audioTrack;
    localTracksRef.current.video = videoTrack;

    await client.publish([audioTrack, videoTrack]);

    setLocalAudioTrack(audioTrack);
    setLocalVideoTrack(videoTrack);

    return { audioTrack, videoTrack };
  }, []);

  const leave = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    Object.values(localTracksRef.current).forEach(track => {
      if (track) { track.stop(); track.close(); }
    });
    localTracksRef.current = { audio: null, video: null, screen: null };

    await client.leave();
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
    if (!track) return;
    await track.setMuted(!isAudioMuted);
    setIsAudioMuted(prev => !prev);
  }, [isAudioMuted]);

  const toggleVideo = useCallback(async () => {
    const track = localTracksRef.current.video;
    if (!track) return;
    await track.setMuted(!isVideoOff);
    setIsVideoOff(prev => !prev);
  }, [isVideoOff]);

  const startScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const screenTrack = await AgoraRTC.createScreenVideoTrack(
      { encoderConfig: { width: 1920, height: 1080, frameRate: 15, bitrateMax: 1500 } },
      'disable'
    );

    const videoTrack = localTracksRef.current.video;
    if (videoTrack) await client.unpublish(videoTrack);

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
      await client.unpublish(screenTrack);
      screenTrack.stop();
      screenTrack.close();
      localTracksRef.current.screen = null;
    }

    const videoTrack = localTracksRef.current.video;
    if (videoTrack) await client.publish(videoTrack);

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
  };
};