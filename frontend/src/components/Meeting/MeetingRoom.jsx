import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import useAgoraRTC from '../../hooks/useAgoraRTC';
import ChatPanel from './ChatPanel';
import ControlsBar from './ControlsBar';
import ParticipantsPanel from './ParticipantsPanel';
import VideoTile from './VideoTile';
import api from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID;

// ── Wake Lock: prevents phone screen from sleeping during call ────────────────
function useWakeLock() {
  const wakeLockRef = useRef(null);
  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn('Wake lock not available:', err.message);
    }
  }, []);
  const release = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) await acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [acquire]);
  return { acquire, release };
}

async function sendBrowserNotif(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
}

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [meetingInfo, setMeetingInfo] = useState(null);
  const [agoraToken, setAgoraToken] = useState(null);
  const [agoraUid, setAgoraUid] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [screenSharerUid, setScreenSharerUid] = useState(null);
  const [screenSharerName, setScreenSharerName] = useState('');
  const [pinnedId, setPinnedId] = useState(null); // 'local' or a remote agora uid
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [handRaisers, setHandRaisers] = useState([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [loading, setLoading] = useState(true);

  const { acquire: acquireWakeLock, release: releaseWakeLock } = useWakeLock();
  // meetingInfo.host is a POPULATED object ({_id, name, email, avatar}) because
  // getMeeting() does .populate('host', ...) — so we must compare host._id,
  // not host itself (String(object) would always produce "[object Object]").
  const isHost =
    String(meetingInfo?.host?._id || meetingInfo?.host) === String(user?._id) ||
    String(meetingInfo?.hostId) === String(user?._id);

  // ── AGORA ─────────────────────────────────────────────────────────────────
  const handleUserLeft = useCallback((agoraUser) => {
    if (agoraUser.uid === screenSharerUid) {
      setScreenSharerUid(null);
      setScreenSharerName('');
    }
  }, [screenSharerUid]);

  const {
    localVideoTrack, localAudioTrack, remoteUsers,
    isScreenSharing, audioLevel, joined, error: agoraError,
    muteAudio, unmuteAudio, disableVideo, enableVideo,
    startScreenShare, stopScreenShare,
  } = useAgoraRTC({
    appId: AGORA_APP_ID,
    channel: meetingId,
    token: agoraToken,
    uid: agoraUid,
    onUserLeft: handleUserLeft,
  });

  // ── FETCH MEETING & AGORA TOKEN ───────────────────────────────────────────
  useEffect(() => {
    if (!meetingId) return;
    const init = async () => {
      try {
        const [meetingRes, tokenRes] = await Promise.all([
          api.get(`/meetings/${meetingId}`),
          api.get(`/meetings/${meetingId}/agora-token`),
        ]);
        setMeetingInfo(meetingRes.data?.meeting || meetingRes.data);
        setAgoraToken(tokenRes.data.token);
        setAgoraUid(tokenRes.data.uid);
        setLoading(false);
        if ('Notification' in window && Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        await acquireWakeLock();
      } catch (err) {
        console.error('Meeting init error:', err);
        toast.error('Failed to join meeting');
        navigate('/dashboard');
      }
    };
    init();
    return () => releaseWakeLock();
  }, [meetingId]);

  // ── JOIN SOCKET ROOM (once Agora is connected) ────────────────────────────
  // agoraUid is included here — the backend stores it against this socket
  // and broadcasts it to everyone else, so remote clients can map an
  // incoming Agora video stream's numeric uid back to a name.
  //
  // IMPORTANT: this used to only run once (on mount, when `joined` first
  // became true). socket.io-client keeps reconnecting the SAME client
  // instance under the hood after any drop (flaky mobile network, Render
  // free-tier idling out, etc) — `socket` never changes identity, so this
  // effect never re-ran. The server, meanwhile, sees a brand-new socket.id
  // on every reconnect and has already forgotten the old one, so the
  // client silently stopped receiving 'participant:joined', 'chat:message',
  // and every other room broadcast until the page was hard-reloaded.
  // Fix: listen for socket.io's own 'connect' event (fires on the initial
  // connect AND every reconnect) and re-run the join handshake each time.
  useEffect(() => {
    if (!socket || !meetingId) return;

    const doJoin = () => {
      if (joined) socket.emit('meeting:join', { meetingId, agoraUid });
    };

    doJoin(); // covers the normal case where we're already connected
    socket.on('connect', doJoin);
    return () => socket.off('connect', doJoin);
  }, [socket, meetingId, joined, agoraUid]);

  // ── SOCKET EVENTS ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onParticipants = ({ participants: list }) => setParticipants(list);

    const onJoined = ({ userId, name, avatar, agoraUid: joinerAgoraUid }) => {
      setParticipants((prev) =>
        prev.find((p) => p.userId === userId)
          ? prev
          : [...prev, { userId, name, avatar, agoraUid: joinerAgoraUid ?? null }]
      );
      toast(`${name} joined`, { icon: '👋' });
      sendBrowserNotif('NexMeet', `${name} joined the meeting`);
    };

    // Covers the case where a client's Agora uid becomes known slightly
    // after they joined the socket room (rare, but the id is only valid
    // once the token/uid fetch resolves on their end).
    const onParticipantAgoraUid = ({ userId, agoraUid: updatedUid }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.userId === userId ? { ...p, agoraUid: updatedUid } : p))
      );
    };

    const onLeft = ({ userId, name }) => {
      setParticipants((prev) => prev.filter((p) => p.userId !== userId));
      if (name) toast(`${name} left`, { icon: '🚪' });
    };

    const onChatMessage = (msg) => {
      if (!showChat) setUnreadChat((n) => n + 1);
      toast(msg.content.slice(0, 60), {
        icon: msg.isPrivate ? '🔒' : '💬',
        duration: 3000,
      });
      sendBrowserNotif(
        msg.isPrivate ? `Private from ${msg.senderName}` : msg.senderName,
        msg.content.slice(0, 80)
      );
    };

    const onScreenShare = ({ name, sharing, agoraUid: sharerUid }) => {
      if (sharing) {
        setScreenSharerUid(sharerUid || null);
        setScreenSharerName(name);
        toast(`${name} is sharing their screen`, { icon: '🖥️' });
      } else {
        setScreenSharerUid(null);
        setScreenSharerName('');
        toast(`${name} stopped sharing`, { icon: '🖥️' });
      }
    };

    // Host muted this user — mute mic once, but user CAN self-unmute afterward
    const onHostMute = ({ mutedBy, canSelfUnmute }) => {
      muteAudio();
      setIsMuted(true);
      socket.emit('media:audio', { meetingId, muted: true });
      if (canSelfUnmute) {
        toast(`You were muted by ${mutedBy || 'host'}. You can unmute yourself.`, {
          icon: '🔇',
          duration: 5000,
        });
      } else {
        toast.error(`You were muted by ${mutedBy || 'host'}`);
      }
    };

    // Host explicitly unmuted this user
    const onHostUnmute = ({ unmuteBy }) => {
      toast.success(`${unmuteBy || 'Host'} unmuted you`);
    };

    // Broadcast: someone's mute status changed (for participant list UI)
    const onParticipantMuted = ({ userId, muted }) => {
      setParticipants((prev) =>
        prev.map((p) => p.userId === userId ? { ...p, isMutedByHost: muted } : p)
      );
    };

    // Unmute request from a participant (host only sees this)
    const onUnmuteRequest = ({ userId, name }) => {
      toast(
        (t) => (
          <span className="flex items-center gap-2">
            <span><b>{name}</b> wants to unmute</span>
            <button
              className="px-2 py-1 bg-green-500 text-white text-xs rounded"
              onClick={() => {
                socket.emit('host:unmute', { meetingId, targetUserId: userId });
                toast.dismiss(t.id);
              }}
            >Allow</button>
            <button
              className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
              onClick={() => toast.dismiss(t.id)}
            >Ignore</button>
          </span>
        ),
        { duration: 10000 }
      );
    };

    // KICK — temporary, user can rejoin
    const onKicked = ({ kickedBy, canRejoin }) => {
      toast.error(`You were removed by ${kickedBy || 'the host'}`);
      releaseWakeLock();
      if (canRejoin) {
        // Navigate to the join page for this meeting so they can rejoin with one click
        navigate(`/join/${meetingId}?rejoined=true`);
      } else {
        navigate('/dashboard');
      }
    };

    // BAN — permanent, navigate away with no rejoin option
    const onBanned = ({ bannedBy }) => {
      toast.error(`You were banned by ${bannedBy || 'the host'}`);
      releaseWakeLock();
      navigate('/dashboard');
    };

    const onReaction = ({ name, emoji }) => {
      const id = Date.now();
      setReactions((prev) => [...prev, { id, name, emoji }]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
    };

    const onHandRaise = ({ userId, name, raised }) => {
      setHandRaisers((prev) =>
        raised
          ? prev.find((h) => h.userId === userId) ? prev : [...prev, { userId, name }]
          : prev.filter((h) => h.userId !== userId)
      );
      if (raised) toast(`${name} raised their hand ✋`, { duration: 4000 });
    };

    // MEETING ENDED — host ended it for everyone. Every client (including
    // the host, once their own request completes) lands here and leaves.
    const onMeetingEnded = () => {
      toast.error('Meeting has been ended by the host');
      releaseWakeLock();
      navigate('/dashboard');
    };

    socket.on('meeting:participants', onParticipants);
    socket.on('participant:joined', onJoined);
    socket.on('participant:agoraUid', onParticipantAgoraUid);
    socket.on('participant:left', onLeft);
    socket.on('chat:message', onChatMessage);
    socket.on('media:screenShare', onScreenShare);
    socket.on('host:mute', onHostMute);
    socket.on('host:unmute', onHostUnmute);
    socket.on('participant:muted', onParticipantMuted);
    socket.on('unmute:request', onUnmuteRequest);
    socket.on('host:kicked', onKicked);
    socket.on('host:banned', onBanned);
    socket.on('reaction', onReaction);
    socket.on('hand:raise', onHandRaise);
    socket.on('meeting:ended', onMeetingEnded);

    return () => {
      socket.off('meeting:participants', onParticipants);
      socket.off('participant:joined', onJoined);
      socket.off('participant:agoraUid', onParticipantAgoraUid);
      socket.off('participant:left', onLeft);
      socket.off('chat:message', onChatMessage);
      socket.off('media:screenShare', onScreenShare);
      socket.off('host:mute', onHostMute);
      socket.off('host:unmute', onHostUnmute);
      socket.off('participant:muted', onParticipantMuted);
      socket.off('unmute:request', onUnmuteRequest);
      socket.off('host:kicked', onKicked);
      socket.off('host:banned', onBanned);
      socket.off('reaction', onReaction);
      socket.off('hand:raise', onHandRaise);
      socket.off('meeting:ended', onMeetingEnded);
    };
  }, [socket, meetingId, showChat]);

  // ── CONTROLS ──────────────────────────────────────────────────────────────

  // Mute toggle — always works freely; host mute is just a one-time push
  const toggleMute = async () => {
    if (isMuted) {
      await unmuteAudio();
      setIsMuted(false);
      socket?.emit('media:audio', { meetingId, muted: false });
    } else {
      await muteAudio();
      setIsMuted(true);
      socket?.emit('media:audio', { meetingId, muted: true });
    }
  };

  const toggleVideo = async () => {
    if (isVideoOff) {
      await enableVideo();
      setIsVideoOff(false);
      socket?.emit('media:video', { meetingId, off: false });
    } else {
      await disableVideo();
      setIsVideoOff(true);
      socket?.emit('media:video', { meetingId, off: true });
    }
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      socket?.emit('media:screenShare', { meetingId, sharing: false });
      setScreenSharerUid(null);
    } else {
      try {
        const screenUid = await startScreenShare();
        socket?.emit('media:screenShare', { meetingId, sharing: true, agoraUid: screenUid });
        setScreenSharerUid(screenUid);
        setScreenSharerName('You');
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  // Click/tap a tile's profile to pin it large in the grid; tap again to unpin.
  const handleTogglePin = (id) => {
    setPinnedId((prev) => (prev === id ? null : id));
  };

  // If the pinned participant leaves the call, drop the pin instead of
  // showing an empty large tile.
  useEffect(() => {
    if (pinnedId == null || pinnedId === 'local') return;
    if (!remoteUsers.some((u) => u.uid === pinnedId)) setPinnedId(null);
  }, [remoteUsers, pinnedId]);

  const handleReaction = (emoji) => {
    socket?.emit('reaction', { meetingId, emoji });
    const id = Date.now();
    setReactions((prev) => [...prev, { id, name: 'You', emoji }]);
    setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
  };

  const handleHandRaise = (raised) => {
    socket?.emit('hand:raise', { meetingId, raised, name: user?.name });
  };

  const handleLeave = () => {
    socket?.emit('meeting:leave', { meetingId });
    releaseWakeLock();
    navigate('/dashboard');
  };

  // Host-only: end the meeting for EVERYONE, regardless of co-hosts.
  // Calls the REST endpoint (server re-validates host/co-host permission),
  // which marks the meeting ended and broadcasts 'meeting:ended' to the
  // whole room — every other participant's onMeetingEnded handler above
  // fires and boots them out automatically.
  const handleEndMeeting = async () => {
    if (!window.confirm('End this meeting for everyone? This cannot be undone.')) return;
    try {
      await api.post(`/meetings/${meetingId}/end`);
      releaseWakeLock();
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end meeting');
    }
  };

  // Admin actions
  const handleAdminMute   = (uid) => socket?.emit('host:mute',   { meetingId, targetUserId: uid });
  const handleAdminUnmute = (uid) => socket?.emit('host:unmute', { meetingId, targetUserId: uid });
  const handleAdminKick   = (uid) => socket?.emit('host:kick',   { meetingId, targetUserId: uid });
  const handleAdminBan    = (uid) => socket?.emit('host:ban',    { meetingId, targetUserId: uid });
  const handleAdminUnban  = (uid) => socket?.emit('host:unban',  { meetingId, targetUserId: uid });

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500 mx-auto mb-4" />
          <p>Joining meeting...</p>
        </div>
      </div>
    );
  }

  const screenShareUser = remoteUsers.find((u) => u.uid === screenSharerUid);

  const allVideoUsers = [
    {
      id: 'local',
      isLocal: true,
      videoTrack: localVideoTrack,
      audioTrack: localAudioTrack,
      name: `${user?.name} (You)`,
      userId: user?._id,
      isMuted,
      isVideoOff,
      audioLevel,
    },
    ...remoteUsers
      .filter((u) => u.uid !== screenSharerUid)
      .map((u) => ({
        id: u.uid,
        isLocal: false,
        uid: u.uid,
        videoTrack: u.videoTrack,
        audioTrack: u.audioTrack,
        // u.uid is the Agora RTC numeric uid — match it against the
        // agoraUid we now receive over the socket join handshake, not
        // against socketId (a Socket.IO connection id — unrelated value).
        name: participants.find((p) => Number(p.agoraUid) === Number(u.uid))?.name || 'Participant',
      })),
  ];

  const pinnedUser = pinnedId != null ? allVideoUsers.find((u) => u.id === pinnedId) : null;
  const otherUsers = pinnedUser ? allVideoUsers.filter((u) => u.id !== pinnedId) : allVideoUsers;

  const hasScreenShare = !!(screenShareUser || isScreenSharing);

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Toaster position="top-right" />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="min-w-0">
            <h1 className="font-semibold text-sm truncate max-w-[50vw] sm:max-w-none">{meetingInfo?.title || 'Meeting'}</h1>
            <button
              className="text-xs text-gray-400 hover:text-white truncate"
              onClick={() => { navigator.clipboard.writeText(meetingId); toast('Meeting ID copied!'); }}
            >
              {meetingId} · tap to copy
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="text-xs text-gray-400 whitespace-nowrap">{participants.length + 1} participants</div>
            {isHost && (
              <button
                onClick={handleEndMeeting}
                className="px-2.5 sm:px-3 py-1.5 bg-red-600 hover:bg-red-700 transition-colors rounded-lg text-xs font-semibold whitespace-nowrap"
              >
                End Meeting
              </button>
            )}
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 overflow-hidden p-1.5 sm:p-2">
          {/* Screen share — full width when active (takes priority over pin) */}
          {hasScreenShare && (
            <div className="w-full h-2/3 mb-2 rounded-xl overflow-hidden bg-black relative">
              <div className="absolute top-2 left-2 z-10 bg-black/60 text-xs px-2 py-1 rounded">
                🖥️ {isScreenSharing ? 'Your screen' : `${screenSharerName}'s screen`}
              </div>
              {isScreenSharing ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                  You are sharing your screen
                </div>
              ) : screenShareUser?.videoTrack ? (
                <VideoTile
                  videoTrack={screenShareUser.videoTrack}
                  isScreen
                  name={`${screenSharerName}'s screen`}
                />
              ) : null}
            </div>
          )}

          {/* Pinned participant — large, everyone else in a thumbnail strip.
              Tapping a tile's profile toggles the pin (see VideoTile's onPin). */}
          {!hasScreenShare && pinnedUser ? (
            <div className="flex flex-col h-full gap-2">
              <div className="flex-1 min-h-0">
                <VideoTile
                  videoTrack={pinnedUser.videoTrack}
                  audioTrack={pinnedUser.audioTrack}
                  isLocal={pinnedUser.isLocal}
                  name={pinnedUser.name}
                  isMuted={pinnedUser.isMuted}
                  isVideoOff={pinnedUser.isVideoOff}
                  audioLevel={pinnedUser.isLocal ? audioLevel : undefined}
                  isPinned
                  onPin={() => handleTogglePin(pinnedUser.id)}
                />
              </div>
              {otherUsers.length > 0 && (
                <div className="flex gap-2 overflow-x-auto h-20 sm:h-24 shrink-0 pb-1">
                  {otherUsers.map((u) => (
                    <div key={u.id} className="h-full aspect-video shrink-0">
                      <VideoTile
                        videoTrack={u.videoTrack}
                        audioTrack={u.audioTrack}
                        isLocal={u.isLocal}
                        name={u.name}
                        isMuted={u.isMuted}
                        isVideoOff={u.isVideoOff}
                        audioLevel={u.isLocal ? audioLevel : undefined}
                        onPin={() => handleTogglePin(u.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Participant grid — 1 col on phones, more columns as space/count allow */
            <div
              className={`grid gap-1.5 sm:gap-2 ${hasScreenShare ? 'h-1/3' : 'h-full'} ${
                allVideoUsers.length === 1 ? 'grid-cols-1' :
                allVideoUsers.length <= 4 ? 'grid-cols-2' :
                'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {allVideoUsers.map((u) => (
                <VideoTile
                  key={u.id}
                  videoTrack={u.videoTrack}
                  audioTrack={u.audioTrack}
                  isLocal={u.isLocal}
                  name={u.name}
                  isMuted={u.isMuted}
                  isVideoOff={u.isVideoOff}
                  audioLevel={u.isLocal ? audioLevel : undefined}
                  onPin={hasScreenShare ? undefined : () => handleTogglePin(u.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Floating reactions */}
        {reactions.length > 0 && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-3 pointer-events-none z-50">
            {reactions.map((r) => (
              <span key={r.id} className="animate-bounce text-4xl select-none">{r.emoji}</span>
            ))}
          </div>
        )}

        {/* Controls */}
        <ControlsBar
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          audioLevel={audioLevel}
          unreadChat={unreadChat}
          handRaisers={handRaisers}
          showChat={showChat}
          showParticipants={showParticipants}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onScreenShare={handleScreenShare}
          onReaction={handleReaction}
          onHandRaise={handleHandRaise}
          onToggleChat={() => { setShowChat((v) => !v); setUnreadChat(0); }}
          onToggleParticipants={() => setShowParticipants((v) => !v)}
          onLeave={handleLeave}
        />
      </div>

      {/* Chat panel */}
      {showChat && (
        <ChatPanel
          meetingId={meetingId}
          participants={participants}
          currentUser={user}
          socket={socket}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Participants panel */}
      {showParticipants && (
        <ParticipantsPanel
          meetingId={meetingId}
          participants={participants}
          currentUser={user}
          isHost={isHost}
          handRaisers={handRaisers}
          pinnedId={pinnedId}
          onTogglePin={handleTogglePin}
          onMute={handleAdminMute}
          onUnmute={handleAdminUnmute}
          onKick={handleAdminKick}
          onBan={handleAdminBan}
          onUnban={handleAdminUnban}
          onClose={() => setShowParticipants(false)}
        />
      )}
    </div>
  );
}