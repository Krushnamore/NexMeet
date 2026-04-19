import { useEffect, useRef } from 'react';

const Avatar = ({ name, size = 72 }) => {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff',
      fontFamily: 'Syne, sans-serif', letterSpacing: '-0.02em', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
};

export default function VideoTile({
  uid, name, videoTrack, audioTrack,
  isMuted, isVideoOff, isLocal = false,
  isScreenShare = false, isHandRaised = false,
  isPinned = false, reaction = null,
  onPin, className = '', style = {},
}) {
  const containerRef = useRef(null);
  const playingTrackRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Stop old track if different track comes in
    if (playingTrackRef.current && playingTrackRef.current !== videoTrack) {
      try { playingTrackRef.current.stop(); } catch {}
      playingTrackRef.current = null;
    }

    if (videoTrack && !isVideoOff) {
      try {
        videoTrack.play(container);
        playingTrackRef.current = videoTrack;
      } catch (err) {
        console.warn('Video play error for', name, ':', err.message);
      }
    } else {
      if (playingTrackRef.current) {
        try { playingTrackRef.current.stop(); } catch {}
        playingTrackRef.current = null;
      }
    }

    return () => {
      if (playingTrackRef.current) {
        try { playingTrackRef.current.stop(); } catch {}
        playingTrackRef.current = null;
      }
    };
  }, [videoTrack, isVideoOff, name]);

  // Play remote audio separately
  useEffect(() => {
    if (!isLocal && audioTrack) {
      try { audioTrack.play(); } catch (err) {
        console.warn('Audio play error:', err.message);
      }
    }
    return () => {
      if (!isLocal && audioTrack) {
        try { audioTrack.stop(); } catch {}
      }
    };
  }, [audioTrack, isLocal]);

  const hasVideo = !!(videoTrack && !isVideoOff);

  return (
    <div
      onClick={onPin}
      className={className}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16,
        background: '#0d1520', cursor: 'pointer',
        border: `2px solid ${isPinned ? '#8b5cf6' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', aspectRatio: '16/9',
        ...style,
      }}
    >
      {/* Video container */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          display: hasVideo ? 'block' : 'none',
          background: '#000', overflow: 'hidden',
        }}
      />

      {/* Avatar when no video */}
      {!hasVideo && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', gap: 8,
        }}>
          <Avatar name={name} size={72} />
          <span style={{
            fontSize: '0.75rem', color: 'var(--text-muted)',
            fontFamily: 'Syne, sans-serif',
          }}>
            {isVideoOff ? 'Camera off' : 'No video'}
          </span>
        </div>
      )}

      {/* Badges top */}
      <div style={{
        position: 'absolute', top: 8, left: 8, right: 8,
        display: 'flex', justifyContent: 'space-between', zIndex: 5, pointerEvents: 'none',
      }}>
        {isScreenShare && (
          <span style={{ background: 'rgba(59,130,246,0.9)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
            🖥️ Screen
          </span>
        )}
        {isPinned && (
          <span style={{ background: 'rgba(139,92,246,0.9)', color: '#fff', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, marginLeft: 'auto' }}>
            📌 Pinned
          </span>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        padding: '24px 10px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem',
            color: '#fff', fontFamily: 'Syne, sans-serif', fontWeight: 600,
            maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name || 'User'}{isLocal ? ' (You)' : ''}
          </span>
          {isHandRaised && <span style={{ fontSize: 16 }}>✋</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {isMuted && (
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>🔇</div>
          )}
          {!hasVideo && (
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📷</div>
          )}
        </div>
      </div>

      {/* Reaction */}
      {reaction && (
        <div style={{
          position: 'absolute', top: '30%', left: '50%',
          transform: 'translateX(-50%)', fontSize: '3rem', zIndex: 10,
          animation: 'reactionFloat 2s ease-out forwards', pointerEvents: 'none',
        }}>
          {reaction}
        </div>
      )}
    </div>
  );
}