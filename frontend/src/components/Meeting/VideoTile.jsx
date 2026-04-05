import { useEffect, useRef } from 'react';

const Avatar = ({ name, size = 64 }) => {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
};

export default function VideoTile({
  uid,
  name,
  videoTrack,
  audioTrack,
  isMuted,
  isVideoOff,
  isLocal = false,
  isScreenShare = false,
  isSpeaking = false,
  isHandRaised = false,
  isPinned = false,
  reaction = null,
  onPin,
  className = '',
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoTrack && videoRef.current && !isVideoOff) {
      videoTrack.play(videoRef.current);
    }
    return () => {
      if (videoTrack) {
        try { videoTrack.stop(); } catch {}
      }
    };
  }, [videoTrack, isVideoOff]);

  return (
    <div
      className={`video-tile ${className}`}
      style={{
        outline: isSpeaking ? '2px solid var(--accent)' : isPinned ? '2px solid var(--purple)' : 'none',
        outlineOffset: 2,
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={onPin}
    >
      {/* Video element */}
      {!isVideoOff && videoTrack ? (
        <div ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)' }}>
          <Avatar name={name} size={isScreenShare ? 80 : 64} />
        </div>
      )}

      {/* Screen share indicator */}
      {isScreenShare && (
        <div style={{ position: 'absolute', top: 8, left: 8 }}>
          <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>🖥️ Screen</span>
        </div>
      )}

      {/* Pinned indicator */}
      {isPinned && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>📌 Pinned</span>
        </div>
      )}

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        padding: '20px 10px 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="flex items-center gap-2">
          <span style={{
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', color: '#fff',
            fontFamily: 'Syne, sans-serif', fontWeight: 600,
          }}>
            {name}{isLocal ? ' (You)' : ''}
          </span>
          {isHandRaised && <span title="Hand raised" style={{ fontSize: 16 }}>✋</span>}
        </div>
        <div className="flex items-center gap-1">
          {isMuted && (
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10
            }}>🔇</div>
          )}
          {isVideoOff && (
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10
            }}>📷</div>
          )}
        </div>
      </div>

      {/* Reaction overlay */}
      {reaction && (
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
          fontSize: '3rem', zIndex: 10,
        }} className="reaction-float">
          {reaction}
        </div>
      )}
    </div>
  );
}
