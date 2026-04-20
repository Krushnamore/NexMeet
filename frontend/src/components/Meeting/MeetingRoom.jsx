import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useAgoraRTC } from '../../hooks/useAgoraRTC';
import api from '../../services/api';

import VideoTile from './VideoTile';
import ChatPanel from './ChatPanel';
import ControlsBar from './ControlsBar';
import BreakoutRoomsPanel from './BreakoutRoomsPanel';
import ParticipantsPanel from './ParticipantsPanel';

const REACTIONS_TIMEOUT = 3000;

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { connect } = useSocket();
  const agora = useAgoraRTC();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [activePanel, setActivePanel] = useState(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showBreakout, setShowBreakout] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [reactions, setReactions] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const [screenShareRequests, setScreenShareRequests] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [screenShareSupported] = useState(!!(navigator.mediaDevices?.getDisplayMedia));

  const socketRef = useRef(null);
  const recordingIdRef = useRef(null);
  const agoraJoinedRef = useRef(false);
  const agoraRef = useRef(agora);
  agoraRef.current = agora;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isHost = meeting && user && (
    String(meeting.host?._id || meeting.host) === String(user._id)
  );

  // ── Load meeting ─────────────────────────────────────────────
  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const res = await api.post(`/meetings/${meetingId}/join`, {});
        setMeeting(res.data.meeting);
        const active = res.data.meeting.participants?.filter(p => p.isActive) || [];
        setParticipants(active.map(p => ({
          userId: String(p.user?._id || p.user),
          name: p.name,
          role: p.role,
          isMuted: p.isMuted,
          isVideoOff: p.isVideoOff,
          isHandRaised: p.isHandRaised,
          isLocal: String(p.user?._id || p.user) === String(user?._id),
        })));
      } catch (err) {
        setConnectionError(err.response?.data?.error || 'Failed to join meeting');
      } finally {
        setLoading(false);
      }
    };
    loadMeeting();
  }, [meetingId]);

  // ── Socket + Agora ───────────────────────────────────────────
  useEffect(() => {
    if (!meeting || connectionError) return;

    const token = localStorage.getItem('accessToken');
    const socket = connect(token);
    socketRef.current = socket;
    socket.emit('meeting:join', { meetingId });

    socket.on('participant:joined', ({ userId, name }) => {
      const uid = String(userId);
      setParticipants(prev => {
        if (prev.find(p => p.userId === uid)) return prev;
        return [...prev, { userId: uid, name, isLocal: false, isMuted: false, isVideoOff: false }];
      });
      toast(`${name} joined`, { icon: '👋', duration: 2000 });
    });

    socket.on('participant:left', ({ userId }) => {
      setParticipants(prev => prev.filter(p => p.userId !== String(userId)));
    });

    socket.on('participant:removed', ({ userId }) => {
      if (String(userId) === String(user?._id)) {
        toast.error('You were removed from the meeting');
        navigate('/dashboard');
      } else {
        setParticipants(prev => prev.filter(p => p.userId !== String(userId)));
      }
    });

    socket.on('host:kicked', () => {
      toast.error('You were removed by the host');
      navigate('/dashboard');
    });

    socket.on('meeting:ended', () => {
      toast('Meeting ended by host', { icon: '🏁' });
      navigate('/dashboard');
    });

    socket.on('media:audio', ({ userId, muted }) => {
      setParticipants(prev => prev.map(p =>
        p.userId === String(userId) ? { ...p, isMuted: muted } : p
      ));
    });

    socket.on('media:video', ({ userId, off }) => {
      setParticipants(prev => prev.map(p =>
        p.userId === String(userId) ? { ...p, isVideoOff: off } : p
      ));
    });

    socket.on('hand:raise', ({ userId, raised, name }) => {
      setParticipants(prev => prev.map(p =>
        p.userId === String(userId) ? { ...p, isHandRaised: raised } : p
      ));
      if (raised) toast(`${name} raised hand`, { icon: '✋', duration: 3000 });
    });

    socket.on('reaction', ({ userId, emoji }) => {
      const uid = String(userId);
      setReactions(prev => ({ ...prev, [uid]: emoji }));
      setTimeout(() => {
        setReactions(prev => { const n = { ...prev }; delete n[uid]; return n; });
      }, REACTIONS_TIMEOUT);
    });

    // ── Screen share: host receives request ──────────────────
    socket.on('screenshare:request', ({ userId, name }) => {
      const uid = String(userId);
      const currentIsHost = String(meeting?.host?._id || meeting?.host) === String(user?._id);
      if (currentIsHost) {
        setScreenShareRequests(prev => [
          ...prev.filter(r => r.userId !== uid),
          { userId: uid, name },
        ]);
        toast(`${name} wants to share screen`, { icon: '🖥️', duration: 6000 });
      }
    });

    // ── Screen share: participant receives approval ───────────
    socket.on('screenshare:approved', ({ userId }) => {
      const incomingId = String(userId);
      const myId = String(user?._id);
      console.log('[screenshare:approved] incoming:', incomingId, 'mine:', myId);

      if (incomingId === myId) {
        // ✅ Check mobile support first
        if (!navigator.mediaDevices?.getDisplayMedia) {
          toast.error('Screen sharing is not supported on mobile browsers. Use desktop Chrome/Edge/Firefox.', { duration: 5000 });
          return;
        }

        toast.success('Approved! Select a window to share.');
        setTimeout(async () => {
          try {
            await agoraRef.current.startScreenShare();
            socketRef.current?.emit('media:screenShare', { meetingId, sharing: true });
            toast.success('Screen sharing started ✅');
          } catch (err) {
            console.error('startScreenShare error:', err);
            if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('cancel')) {
              toast.error('Screen share cancelled — you closed the dialog.');
            } else if (err.name === 'NotSupportedError') {
              toast.error('Screen sharing not supported on this browser.');
            } else {
              toast.error('Screen share failed: ' + err.message);
            }
          }
        }, 300);
      }
    });

    socket.on('screenshare:denied', ({ userId }) => {
      if (String(userId) === String(user?._id)) {
        toast.error('Screen share request denied by host');
      }
    });

    socket.on('host:mute', () => {
      agoraRef.current.toggleAudio();
      toast('Muted by host', { icon: '🔇' });
    });

    socket.on('participant:roleChanged', ({ userId, role }) => {
      setParticipants(prev => prev.map(p =>
        p.userId === String(userId) ? { ...p, role } : p
      ));
      if (String(userId) === String(user?._id)) {
        toast(`You are now a ${role}`, { icon: '⭐' });
      }
    });

    socket.on('recording:started', ({ startedBy }) => {
      setIsRecording(true);
      toast(`Recording started by ${startedBy}`, { icon: '🔴' });
    });

    socket.on('recording:stopped', () => {
      setIsRecording(false);
      toast('Recording stopped', { icon: '⏹️' });
    });

    socket.on('meeting:lockChanged', ({ isLocked }) => {
      toast(isLocked ? 'Meeting locked' : 'Meeting unlocked', {
        icon: isLocked ? '🔒' : '🔓',
      });
    });

    // ── Join Agora ───────────────────────────────────────────
    if (!agoraJoinedRef.current) {
      agoraJoinedRef.current = true;
      const uid = parseInt(String(user?._id || '0').slice(-8), 16) % 2147483647
        || Math.floor(Math.random() * 1000000);

      agora.join({ channelName: meetingId, uid })
        .then((result) => {
          setJoined(true);
          const errors = result?.errors || {};
          if (errors.audio && errors.video) {
            toast('Camera & mic unavailable. You can still chat.', { icon: '⚠️', duration: 5000 });
          } else if (errors.video) {
            toast(errors.video, { icon: '📷', duration: 5000 });
          } else if (errors.audio) {
            toast(errors.audio, { icon: '🎙️', duration: 5000 });
          }
        })
        .catch(err => {
          console.error('Agora join failed:', err);
          agoraJoinedRef.current = false;

          // Ignore React StrictMode double-invoke artifact
          if (err.code === 'OPERATION_ABORTED' || err.message?.includes('cancel')) {
            setJoined(true);
            return;
          }
          if (err.code === 'INVALID_VENDOR_KEY' || err.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
            toast.error('Invalid Agora App ID. Go to console.agora.io → disable App Certificate.', { duration: 8000 });
          } else {
            toast.error(`Media connection failed: ${err.message}`, { duration: 6000 });
          }
          setJoined(true);
        });
    }

    return () => {
      socket.emit('meeting:leave', { meetingId });
      [
        'participant:joined', 'participant:left', 'participant:removed',
        'host:kicked', 'meeting:ended', 'media:audio', 'media:video',
        'hand:raise', 'reaction', 'screenshare:request', 'screenshare:approved',
        'screenshare:denied', 'host:mute', 'participant:roleChanged',
        'recording:started', 'recording:stopped', 'meeting:lockChanged',
      ].forEach(ev => socket.off(ev));
      agora.leave();
    };
  }, [meeting]);

  // ── Handlers ─────────────────────────────────────────────────

  const handleScreenShareApprove = useCallback((userId) => {
    const uid = String(userId);
    socketRef.current?.emit('screenshare:approved', { meetingId, userId: uid });
    setScreenShareRequests(prev => prev.filter(r => r.userId !== uid));
    toast.success('Screen share approved');
  }, [meetingId]);

  const handleScreenShareDeny = useCallback((userId) => {
    const uid = String(userId);
    socketRef.current?.emit('screenshare:denied', { meetingId, userId: uid });
    setScreenShareRequests(prev => prev.filter(r => r.userId !== uid));
  }, [meetingId]);

  const handleToggleAudio = useCallback(async () => {
    await agora.toggleAudio();
    // ✅ Emit immediately without waiting
    socketRef.current?.emit('media:audio', { meetingId, muted: !agora.isAudioMuted });
  }, [agora, meetingId]);

  const handleToggleVideo = useCallback(async () => {
    await agora.toggleVideo();
    socketRef.current?.emit('media:video', { meetingId, off: !agora.isVideoOff });
  }, [agora, meetingId]);

  const handleToggleScreenShare = useCallback(async () => {
    if (agora.isScreenSharing) {
      await agora.stopScreenShare();
      socketRef.current?.emit('media:screenShare', { meetingId, sharing: false });
      toast('Screen sharing stopped');
      return;
    }

    // ✅ Check mobile support
    if (!screenShareSupported) {
      toast.error('Screen sharing is not supported on mobile browsers. Please use desktop Chrome, Edge or Firefox.', { duration: 5000 });
      return;
    }

    if (isHost) {
      // Host can share directly
      try {
        await agora.startScreenShare();
        socketRef.current?.emit('media:screenShare', { meetingId, sharing: true });
        toast.success('Screen sharing started');
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('cancel')) {
          toast.error('Screen share cancelled');
        } else if (err.name === 'NotSupportedError') {
          toast.error('Screen sharing not supported on this device/browser.');
        } else {
          toast.error('Screen share failed: ' + err.message);
        }
      }
    } else {
      // ✅ Participant sends request to host
      socketRef.current?.emit('screenshare:request', {
        meetingId,
        userId: String(user._id),
        name: user.name,
      });
      toast('Screen share request sent to host. Waiting for approval…', { icon: '📤', duration: 4000 });
    }
  }, [agora, meetingId, isHost, user, screenShareSupported]);

  const handleToggleHand = useCallback(() => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    socketRef.current?.emit('hand:raise', { meetingId, raised: newState, name: user?.name });
    setParticipants(prev => prev.map(p => p.isLocal ? { ...p, isHandRaised: newState } : p));
    if (newState) toast('Hand raised — host has been notified', { icon: '✋' });
  }, [isHandRaised, meetingId, user]);

  const handleReaction = useCallback((emoji) => {
    socketRef.current?.emit('reaction', { meetingId, emoji });
    const myId = String(user._id);
    setReactions(prev => ({ ...prev, [myId]: emoji }));
    setTimeout(() => {
      setReactions(prev => { const n = { ...prev }; delete n[myId]; return n; });
    }, REACTIONS_TIMEOUT);
  }, [meetingId, user]);

  const handleToggleRecording = useCallback(async () => {
    if (!isHost) return;
    if (isRecording) {
      try {
        if (recordingIdRef.current) await api.post(`/recordings/${recordingIdRef.current}/stop`);
        setIsRecording(false);
        socketRef.current?.emit('recording:stopped', { meetingId });
        toast.success('Recording saved');
      } catch { toast.error('Failed to stop recording'); }
    } else {
      try {
        const res = await api.post(`/recordings/${meetingId}/start`);
        recordingIdRef.current = res.data.recording._id;
        setIsRecording(true);
        socketRef.current?.emit('recording:started', { meetingId });
        toast.success('Recording started');
      } catch { toast.error('Failed to start recording'); }
    }
  }, [isHost, isRecording, meetingId]);

  const handleRemoveParticipant = useCallback(async (userId) => {
    if (!isHost) return;
    try {
      await api.delete(`/meetings/${meetingId}/participants/${userId}`);
      socketRef.current?.emit('host:kick', { meetingId, targetUserId: String(userId) });
      setParticipants(prev => prev.filter(p => p.userId !== String(userId)));
      toast.success('Participant removed');
    } catch { toast.error('Failed to remove participant'); }
  }, [isHost, meetingId]);

  const handleMuteParticipant = useCallback(async (userId) => {
    if (!isHost) return;
    try {
      await api.post(`/meetings/${meetingId}/mute`, { userId, muted: true });
      socketRef.current?.emit('host:mute', { meetingId, targetUserId: String(userId), muted: true });
      setParticipants(prev => prev.map(p =>
        p.userId === String(userId) ? { ...p, isMuted: true } : p
      ));
      toast.success('Participant muted');
    } catch { toast.error('Failed to mute'); }
  }, [isHost, meetingId]);

  const handleLeaveMeeting = useCallback(async () => {
    try { await api.post(`/meetings/${meetingId}/leave`); } catch {}
    navigate('/dashboard');
  }, [meetingId, navigate]);

  const handleEndMeeting = useCallback(async () => {
    if (!isHost) return;
    try {
      await api.post(`/meetings/${meetingId}/end`);
      navigate('/dashboard');
    } catch { toast.error('Failed to end meeting'); }
  }, [isHost, meetingId, navigate]);

  const handleToggleLock = useCallback(async () => {
    try { await api.post(`/meetings/${meetingId}/lock`); }
    catch { toast.error('Failed to toggle lock'); }
  }, [meetingId]);

  const copyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    toast.success('Meeting ID copied!');
  };

  // ── Tile data ─────────────────────────────────────────────────

  const localParticipant = {
    userId: String(user?._id),
    name: user?.name,
    isLocal: true,
    isMuted: agora.isAudioMuted,
    isVideoOff: agora.isVideoOff,
    isHandRaised,
    videoTrack: agora.localVideoTrack,
    role: isHost ? 'host' : 'participant',
  };

  // ✅ Match remote Agora users to participant names
  const remoteWithTracks = agora.remoteUsers.map((ru, index) => {
    let p = participants.find(pp => pp.agoraUid === ru.uid);
    if (!p) {
      const matched = new Set(
        agora.remoteUsers
          .map(r => participants.find(pp => pp.agoraUid === r.uid)?.userId)
          .filter(Boolean)
      );
      const unmatched = participants.filter(pp => !pp.isLocal && !matched.has(pp.userId));
      p = unmatched[index] || {};
    }
    return {
      ...p,
      agoraUid: ru.uid,
      name: p.name || `User ${index + 1}`,
      videoTrack: ru.videoTrack || null,
      audioTrack: ru.audioTrack || null,
      isVideoOff: p.isVideoOff !== undefined ? p.isVideoOff : !ru.hasVideo,
      isMuted: p.isMuted !== undefined ? p.isMuted : !ru.hasAudio,
    };
  });

  const allTiles = [localParticipant, ...remoteWithTracks];
  const pinnedTile = pinnedUserId
    ? allTiles.find(t => String(t.userId || t.agoraUid) === pinnedUserId)
    : null;
  const gridTiles = pinnedTile ? allTiles.filter(t => t !== pinnedTile) : allTiles;

  const gridClass =
    gridTiles.length <= 1 ? 'video-grid-1' :
    gridTiles.length <= 2 ? 'video-grid-2' :
    gridTiles.length <= 4 ? 'video-grid-4' : 'video-grid-many';

  const allParticipantsForPanel = [
    { ...localParticipant, isLocal: true },
    ...participants.filter(p => !p.isLocal),
  ];

  // ── Screens ───────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'Syne, sans-serif' }}>Joining meeting…</p>
      </div>
    </div>
  );

  if (connectionError) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card p-8 text-center animate-slideUp" style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Cannot join meeting</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{connectionError}</p>
        <button className="btn-primary" style={{ width: '100%' }} onClick={() => navigate('/dashboard')}>Back to dashboard</button>
      </div>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        padding: '8px 12px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0, gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, flexShrink: 0, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 14 }}>⬡</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meeting?.title || 'Meeting'}
            </h1>
            <button onClick={copyMeetingId} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {meetingId} · tap to copy
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: joined ? 'var(--success)' : 'var(--warning)', boxShadow: joined ? '0 0 6px var(--success)' : 'none' }} />
          <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>👥 {allTiles.length}</span>
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="recording-indicator" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>REC</span>
            </div>
          )}
          {isHost && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost" style={{ fontSize: '0.7rem', padding: '4px 8px' }} onClick={() => setShowBreakout(true)}>🏠</button>
              <button className="btn-ghost" style={{ fontSize: '0.7rem', padding: '4px 8px' }} onClick={handleToggleLock}>🔒</button>
            </div>
          )}
        </div>
      </div>

      {/* Screen share request banner */}
      {isHost && screenShareRequests.length > 0 && (
        <div style={{ background: 'rgba(59,130,246,0.12)', borderBottom: '1px solid var(--accent)', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {screenShareRequests.map(req => (
            <div key={req.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                🖥️ <strong>{req.name}</strong> wants to share their screen
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '4px 14px' }}
                  onClick={() => handleScreenShareApprove(req.userId)}>Allow</button>
                <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 14px' }}
                  onClick={() => handleScreenShareDeny(req.userId)}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Video grid */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 8, gap: 8, minWidth: 0 }}>

          {pinnedTile && (
            <div style={{ height: '55%', flexShrink: 0 }}>
              <VideoTile
                uid={pinnedTile.userId || pinnedTile.agoraUid}
                name={pinnedTile.name}
                videoTrack={pinnedTile.videoTrack}
                audioTrack={pinnedTile.audioTrack}
                isMuted={pinnedTile.isMuted}
                isVideoOff={pinnedTile.isVideoOff}
                isLocal={pinnedTile.isLocal}
                isPinned
                isHandRaised={pinnedTile.isHandRaised}
                reaction={reactions[String(pinnedTile.userId || pinnedTile.agoraUid)]}
                onPin={() => setPinnedUserId(null)}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          )}

          <div style={{ flex: 1, display: 'grid', gap: 8, overflow: 'hidden', alignContent: 'start' }} className={gridClass}>
            {gridTiles.map((tile, i) => {
              const tileId = String(tile.userId || tile.agoraUid);
              return (
                <VideoTile
                  key={tileId || i}
                  uid={tile.userId || tile.agoraUid}
                  name={tile.name || `User ${i + 1}`}
                  videoTrack={tile.videoTrack}
                  audioTrack={tile.audioTrack}
                  isMuted={tile.isMuted}
                  isVideoOff={tile.isVideoOff}
                  isLocal={tile.isLocal}
                  isHandRaised={tile.isHandRaised}
                  reaction={reactions[tileId]}
                  isPinned={pinnedUserId === tileId}
                  onPin={() => setPinnedUserId(prev => prev === tileId ? null : tileId)}
                />
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        {activePanel && (
          <div style={{
            width: isMobile ? '100%' : 300, flexShrink: 0,
            position: isMobile ? 'absolute' : 'relative',
            right: 0, top: 0, bottom: 0, zIndex: 20,
          }} className="animate-slideRight">
            {activePanel === 'chat' ? (
              <ChatPanel
                socket={socketRef.current}
                meetingId={meetingId}
                participants={allParticipantsForPanel}
                onClose={() => setActivePanel(null)}
              />
            ) : (
              <ParticipantsPanel
                participants={allParticipantsForPanel}
                isHost={isHost}
                currentUserId={String(user?._id)}
                onRemove={handleRemoveParticipant}
                onMute={handleMuteParticipant}
                onClose={() => setActivePanel(null)}
                meetingId={meetingId}
                socket={socketRef.current}
              />
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <ControlsBar
        isAudioMuted={agora.isAudioMuted}
        isVideoOff={agora.isVideoOff}
        isScreenSharing={agora.isScreenSharing}
        isRecording={isRecording}
        isHandRaised={isHandRaised}
        activePanel={activePanel}
        networkQuality={agora.networkQuality}
        participantCount={allTiles.length}
        screenShareSupported={screenShareSupported}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onToggleHand={handleToggleHand}
        onToggleChat={() => setActivePanel(p => p === 'chat' ? null : 'chat')}
        onToggleParticipants={() => setActivePanel(p => p === 'participants' ? null : 'participants')}
        onReaction={handleReaction}
        onEndMeeting={handleEndMeeting}
        onLeaveMeeting={handleLeaveMeeting}
        isHost={isHost}
        meetingId={meetingId}
      />

      {showBreakout && (
        <BreakoutRoomsPanel
          meetingId={meetingId}
          participants={allParticipantsForPanel}
          isHost={isHost}
          onClose={() => setShowBreakout(false)}
          socket={socketRef.current}
        />
      )}

      {/* Reactions */}
      <div style={{ position: 'fixed', bottom: 100, right: activePanel ? 316 : 16, zIndex: 100, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(reactions).map(([uid, emoji]) => (
          <div key={uid} className="reaction-float" style={{ fontSize: '2.5rem' }}>{emoji}</div>
        ))}
      </div>
    </div>
  );
}
