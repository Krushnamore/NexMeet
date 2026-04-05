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
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showBreakout, setShowBreakout] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [reactions, setReactions] = useState({});
  const [connectionError, setConnectionError] = useState(null);
  const socketRef = useRef(null);
  const recordingIdRef = useRef(null);
  const agoraJoinedRef = useRef(false);

  const isHost = meeting && user && (
    meeting.host?._id === user._id || meeting.host === user._id
  );

  useEffect(() => {
    const loadMeeting = async () => {
      try {
        const joinRes = await api.post(`/meetings/${meetingId}/join`, {});
        setMeeting(joinRes.data.meeting);
        const activeParts = joinRes.data.meeting.participants?.filter(p => p.isActive) || [];
        setParticipants(activeParts.map(p => ({
          userId: p.user?._id || p.user,
          name: p.name,
          role: p.role,
          isMuted: p.isMuted,
          isVideoOff: p.isVideoOff,
          isHandRaised: p.isHandRaised,
          isLocal: (p.user?._id || p.user) === user?._id,
        })));
      } catch (err) {
        setConnectionError(err.response?.data?.error || 'Failed to join meeting');
      } finally {
        setLoading(false);
      }
    };
    loadMeeting();
  }, [meetingId]);

  useEffect(() => {
    if (!meeting || connectionError) return;

    const token = localStorage.getItem('accessToken');
    const socket = connect(token);
    socketRef.current = socket;
    socket.emit('meeting:join', { meetingId });

    socket.on('participant:joined', ({ userId, name }) => {
      setParticipants(prev => {
        if (prev.find(p => p.userId === userId)) return prev;
        return [...prev, { userId, name, isLocal: false }];
      });
      toast(`${name} joined`, { icon: '👋', duration: 2000 });
    });

    socket.on('participant:left', ({ userId, name }) => {
      setParticipants(prev => prev.filter(p => p.userId !== userId));
    });

    socket.on('participant:removed', ({ userId }) => {
      if (userId === user?._id) {
        toast.error('You were removed from the meeting');
        navigate('/dashboard');
      } else {
        setParticipants(prev => prev.filter(p => p.userId !== userId));
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
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, isMuted: muted } : p));
    });

    socket.on('media:video', ({ userId, off }) => {
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, isVideoOff: off } : p));
    });

    socket.on('hand:raise', ({ userId, raised }) => {
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, isHandRaised: raised } : p));
      if (raised) toast('Hand raised', { icon: '✋', duration: 2000 });
    });

    socket.on('reaction', ({ userId, emoji }) => {
      setReactions(prev => ({ ...prev, [userId]: emoji }));
      setTimeout(() => {
        setReactions(prev => { const n = { ...prev }; delete n[userId]; return n; });
      }, REACTIONS_TIMEOUT);
    });

    socket.on('host:mute', () => {
      agora.toggleAudio();
      toast('Muted by host', { icon: '🎙️' });
    });

    socket.on('participant:roleChanged', ({ userId, role }) => {
      setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, role } : p));
      if (userId === user?._id) toast(`You are now a ${role}`, { icon: '⭐' });
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
      toast(isLocked ? 'Meeting locked by host' : 'Meeting unlocked', { icon: isLocked ? '🔒' : '🔓' });
    });

    if (!agoraJoinedRef.current) {
      agoraJoinedRef.current = true;
      const uid = parseInt((user?._id || '0').slice(-8), 16) % 2147483647 || Math.floor(Math.random() * 1000000);
      agora.join({ channelName: meetingId, uid, role: 'host' })
        .then(() => setJoined(true))
        .catch(err => {
          console.error('Agora join error:', err);
          toast.error('Camera/mic access failed — joined in view-only mode');
          setJoined(true);
        });
    }

    return () => {
      socket.emit('meeting:leave', { meetingId });
      ['participant:joined','participant:left','participant:removed','host:kicked',
       'meeting:ended','media:audio','media:video','hand:raise','reaction',
       'host:mute','participant:roleChanged','recording:started','recording:stopped','meeting:lockChanged']
        .forEach(ev => socket.off(ev));
      agora.leave();
    };
  }, [meeting]);

  const handleToggleAudio = useCallback(async () => {
    await agora.toggleAudio();
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
    } else {
      try {
        await agora.startScreenShare();
        socketRef.current?.emit('media:screenShare', { meetingId, sharing: true });
        toast.success('Screen sharing started');
      } catch {
        toast.error('Screen share failed or permission denied');
      }
    }
  }, [agora, meetingId]);

  const handleToggleHand = useCallback(() => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    socketRef.current?.emit('hand:raise', { meetingId, raised: newState });
  }, [isHandRaised, meetingId]);

  const handleReaction = useCallback((emoji) => {
    socketRef.current?.emit('reaction', { meetingId, emoji });
    setReactions(prev => ({ ...prev, [user._id]: emoji }));
    setTimeout(() => {
      setReactions(prev => { const n = { ...prev }; delete n[user._id]; return n; });
    }, REACTIONS_TIMEOUT);
  }, [meetingId, user]);

  const handleToggleRecording = useCallback(async () => {
    if (!isHost) return;
    if (isRecording) {
      try {
        if (recordingIdRef.current) await api.post(`/recordings/${recordingIdRef.current}/stop`);
        setIsRecording(false);
        socketRef.current?.emit('recording:stopped', { meetingId });
        toast.success('Recording saved to cloud');
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
    try {
      await api.post(`/meetings/${meetingId}/lock`);
    } catch { toast.error('Failed to toggle lock'); }
  }, [meetingId]);

  const localParticipant = {
    userId: user?._id,
    name: user?.name,
    isLocal: true,
    isMuted: agora.isAudioMuted,
    isVideoOff: agora.isVideoOff,
    isHandRaised,
    videoTrack: agora.localVideoTrack,
    role: isHost ? 'host' : 'participant',
  };

  const remoteWithTracks = agora.remoteUsers.map(ru => {
    const p = participants.find(p => p.agoraUid === ru.uid) || {};
    return {
      ...p,
      agoraUid: ru.uid,
      name: p.name || `User ${ru.uid}`,
      videoTrack: ru.videoTrack || null,
      audioTrack: ru.audioTrack || null,
    };
  });

  const allTiles = [localParticipant, ...remoteWithTracks];
  const pinnedTile = pinnedUserId ? allTiles.find(t => (t.userId || t.agoraUid) === pinnedUserId) : null;
  const gridTiles = pinnedTile ? allTiles.filter(t => t !== pinnedTile) : allTiles;

  const gridClass = gridTiles.length <= 1 ? 'video-grid-1' :
    gridTiles.length <= 2 ? 'video-grid-2' :
    gridTiles.length <= 4 ? 'video-grid-4' : 'video-grid-many';

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="flex flex-col items-center gap-4">
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'Syne, sans-serif' }}>Joining meeting…</p>
      </div>
    </div>
  );

  if (connectionError) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card p-8 text-center animate-slideUp" style={{ maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Cannot join meeting</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{connectionError}</p>
        <button className="btn-primary w-full" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
      </div>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 7 }} className="flex items-center justify-center">
            <span style={{ fontSize: 14 }}>⬡</span>
          </div>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {meeting?.title || 'Meeting'}
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{meetingId}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: joined ? 'var(--success)' : 'var(--warning)', boxShadow: joined ? '0 0 8px var(--success)' : 'none' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{joined ? 'Connected' : 'Connecting…'}</span>
          </div>
          <span className="badge badge-blue">👥 {allTiles.length}</span>
          {isRecording && (
            <div className="flex items-center gap-1.5">
              <div className="recording-indicator" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>REC</span>
            </div>
          )}
          {isHost && (
            <div className="flex gap-2">
              <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => setShowBreakout(true)}>🏠 Breakout</button>
              <button className="btn-ghost" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={handleToggleLock}>🔒 Lock</button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Video area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 10, gap: 10 }}>
          {pinnedTile && (
            <div style={{ height: '56%', flexShrink: 0 }}>
              <VideoTile
                uid={pinnedTile.userId || pinnedTile.agoraUid}
                name={pinnedTile.name}
                videoTrack={pinnedTile.videoTrack}
                isMuted={pinnedTile.isMuted}
                isVideoOff={pinnedTile.isVideoOff}
                isLocal={pinnedTile.isLocal}
                isPinned
                isHandRaised={pinnedTile.isHandRaised}
                reaction={reactions[pinnedTile.userId || pinnedTile.agoraUid]}
                onPin={() => setPinnedUserId(null)}
                className="w-full h-full"
              />
            </div>
          )}
          <div style={{ flex: 1, display: 'grid', gap: 10, overflow: 'hidden', alignContent: 'start' }} className={gridClass}>
            {gridTiles.map((tile, i) => (
              <VideoTile
                key={tile.userId || tile.agoraUid || i}
                uid={tile.userId || tile.agoraUid}
                name={tile.name || `User ${i + 1}`}
                videoTrack={tile.videoTrack}
                isMuted={tile.isMuted}
                isVideoOff={tile.isVideoOff}
                isLocal={tile.isLocal}
                isHandRaised={tile.isHandRaised}
                reaction={reactions[tile.userId || tile.agoraUid]}
                isPinned={pinnedUserId === (tile.userId || tile.agoraUid)}
                onPin={() => setPinnedUserId(prev =>
                  prev === (tile.userId || tile.agoraUid) ? null : (tile.userId || tile.agoraUid)
                )}
              />
            ))}
          </div>
        </div>

        {/* Chat panel */}
        {isChatOpen && (
          <div className="animate-slideRight" style={{ flexShrink: 0 }}>
            <ChatPanel
              socket={socketRef.current}
              meetingId={meetingId}
              participants={[{ ...localParticipant, isLocal: true }, ...participants]}
            />
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
        isChatOpen={isChatOpen}
        networkQuality={agora.networkQuality}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onToggleHand={handleToggleHand}
        onToggleChat={() => setIsChatOpen(p => !p)}
        onReaction={handleReaction}
        onEndMeeting={handleEndMeeting}
        onLeaveMeeting={handleLeaveMeeting}
        isHost={isHost}
        meetingId={meetingId}
      />

      {showBreakout && (
        <BreakoutRoomsPanel
          meetingId={meetingId}
          participants={[localParticipant, ...participants]}
          isHost={isHost}
          onClose={() => setShowBreakout(false)}
          socket={socketRef.current}
        />
      )}
    </div>
  );
}
