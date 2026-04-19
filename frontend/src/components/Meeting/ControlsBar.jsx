import { useState, useEffect } from 'react';

// Check if screen sharing is supported in this browser
const isScreenShareSupported = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
};

const ControlButton = ({ icon, label, onClick, active = false, danger = false, disabled = false, badge = null, hidden = false }) => {
  if (hidden) return null;
  return (
    <button onClick={onClick} disabled={disabled} title={label} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 2, padding: '8px 6px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${danger ? 'var(--danger)' : active ? 'var(--accent)' : 'var(--border)'}`,
      background: danger ? 'var(--danger)' : active ? 'var(--accent)' : 'var(--bg-card)',
      color: (danger || active) ? '#fff' : 'var(--text-secondary)',
      opacity: disabled ? 0.5 : 1, minWidth: 52, transition: 'all 0.15s ease',
      boxShadow: active ? '0 0 12px var(--accent-glow)' : 'none', position: 'relative',
    }}>
      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: '0.6rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      {badge && (
        <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--danger)', color: '#fff', width: 16, height: 16, borderRadius: '50%', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {badge}
        </div>
      )}
    </button>
  );
};

export default function ControlsBar({
  isAudioMuted, isVideoOff, isScreenSharing, isRecording, isHandRaised,
  activePanel, networkQuality, participantCount,
  onToggleAudio, onToggleVideo, onToggleScreenShare, onToggleRecording,
  onToggleHand, onToggleChat, onToggleParticipants, onReaction,
  onEndMeeting, onLeaveMeeting, isHost, meetingId,
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [screenShareOk] = useState(isScreenShareSupported());

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🔥', '👏', '✅'];

  const handleScreenShare = () => {
    if (!screenShareOk) {
      import('react-hot-toast').then(({ toast }) => {
        toast.error('Screen sharing is not supported on mobile browsers. Please use a desktop browser.', { duration: 4000 });
      });
      return;
    }
    onToggleScreenShare();
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
      padding: isMobile ? '8px 6px' : '8px 12px', flexShrink: 0, position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: isMobile ? 4 : 6, flexWrap: 'wrap',
      }}>

        <ControlButton icon={isAudioMuted ? '🔇' : '🎙️'} label={isAudioMuted ? 'Unmute' : 'Mute'} onClick={onToggleAudio} active={!isAudioMuted} danger={isAudioMuted} />
        <ControlButton icon={isVideoOff ? '📷' : '📹'} label={isVideoOff ? 'Start vid' : 'Stop vid'} onClick={onToggleVideo} active={!isVideoOff} danger={isVideoOff} />

        {/* Screen share — show on all but indicate not supported on mobile */}
        <ControlButton
          icon="🖥️"
          label={isScreenSharing ? 'Stop' : 'Share'}
          onClick={handleScreenShare}
          active={isScreenSharing}
          danger={isScreenSharing}
          disabled={!screenShareOk && !isScreenSharing}
        />

        {/* Reactions */}
        <div style={{ position: 'relative' }}>
          <ControlButton icon="😊" label="React" onClick={() => setShowReactions(p => !p)} active={showReactions} />
          {showReactions && (
            <div className="animate-scaleIn" style={{
              position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 10, marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4, width: 176, zIndex: 50,
            }}>
              {REACTIONS.map(e => (
                <button key={e} onClick={() => { onReaction(e); setShowReactions(false); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: 4, borderRadius: 6,
                }}>{e}</button>
              ))}
            </div>
          )}
        </div>

        <ControlButton icon="✋" label={isHandRaised ? 'Lower' : 'Hand'} onClick={onToggleHand} active={isHandRaised} />
        <ControlButton icon="💬" label="Chat" onClick={onToggleChat} active={activePanel === 'chat'} />
        <ControlButton icon="👥" label="People" onClick={onToggleParticipants} active={activePanel === 'participants'} badge={participantCount > 1 ? participantCount : null} />

        {isHost && (
          <ControlButton icon={isRecording ? '⏹️' : '🔴'} label={isRecording ? 'Stop' : 'Record'} onClick={onToggleRecording} active={isRecording} danger={isRecording} />
        )}

        {/* More menu */}
        <div style={{ position: 'relative' }}>
          <ControlButton icon="⋯" label="More" onClick={() => setShowMore(p => !p)} active={showMore} />
          {showMore && (
            <div className="animate-scaleIn" style={{
              position: 'absolute', bottom: '110%', right: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 6, marginBottom: 6, minWidth: 180, zIndex: 50,
            }}>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${meetingId}`); setShowMore(false); import('react-hot-toast').then(({toast}) => toast.success('Link copied!')); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 14px',
                borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', width: '100%',
              }}>
                🔗 Copy meeting link
              </button>
              <button onClick={() => { navigator.clipboard.writeText(meetingId); setShowMore(false); import('react-hot-toast').then(({toast}) => toast.success('ID copied!')); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 14px',
                borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', width: '100%',
              }}>
                📋 Copy meeting ID
              </button>
              {!screenShareOk && (
                <div style={{ padding: '8px 14px', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                  📵 Screen share not available on mobile browsers
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 2px' }} />

        {isHost ? (
          <button onClick={onEndMeeting} style={{
            background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 10,
            padding: isMobile ? '8px 10px' : '8px 14px',
            fontSize: isMobile ? '0.7rem' : '0.75rem',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            End for all
          </button>
        ) : (
          <button onClick={onLeaveMeeting} style={{
            background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 10,
            padding: isMobile ? '8px 10px' : '8px 14px',
            fontSize: isMobile ? '0.7rem' : '0.75rem',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            Leave
          </button>
        )}
      </div>

      {/* Network bars */}
      <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 3, height: 4 + i * 3, borderRadius: 2,
            background: (networkQuality?.uplink || 0) === 0 || (networkQuality?.uplink || 0) <= i ? 'var(--success)' : 'var(--border)',
          }} />
        ))}
      </div>
    </div>
  );
}