import { useState } from 'react';

const ControlButton = ({ icon, label, onClick, active = false, danger = false, disabled = false, badge = null }) => (
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

export default function ControlsBar({
  isAudioMuted, isVideoOff, isScreenSharing, isRecording, isHandRaised,
  activePanel, networkQuality, participantCount,
  onToggleAudio, onToggleVideo, onToggleScreenShare, onToggleRecording,
  onToggleHand, onToggleChat, onToggleParticipants, onReaction,
  onEndMeeting, onLeaveMeeting, isHost, meetingId,
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🔥', '👏', '✅'];

  return (
    <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '8px 12px', flexShrink: 0, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>

        <ControlButton icon={isAudioMuted ? '🔇' : '🎙️'} label={isAudioMuted ? 'Unmute' : 'Mute'} onClick={onToggleAudio} active={!isAudioMuted} danger={isAudioMuted} />
        <ControlButton icon={isVideoOff ? '📷' : '📹'} label={isVideoOff ? 'Start vid' : 'Stop vid'} onClick={onToggleVideo} active={!isVideoOff} danger={isVideoOff} />
        <ControlButton icon="🖥️" label={isScreenSharing ? 'Stop' : 'Share'} onClick={onToggleScreenShare} active={isScreenSharing} danger={isScreenSharing} />

        <div style={{ position: 'relative' }}>
          <ControlButton icon="😊" label="React" onClick={() => setShowReactions(p => !p)} active={showReactions} />
          {showReactions && (
            <div className="animate-scaleIn" style={{ position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4, width: 176, zIndex: 50 }}>
              {REACTIONS.map(e => (
                <button key={e} onClick={() => { onReaction(e); setShowReactions(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: 4, borderRadius: 6 }}>{e}</button>
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

        <div style={{ position: 'relative' }}>
          <ControlButton icon="⋯" label="More" onClick={() => setShowMore(p => !p)} active={showMore} />
          {showMore && (
            <div className="animate-scaleIn" style={{ position: 'absolute', bottom: '110%', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, marginBottom: 6, minWidth: 160, zIndex: 50 }}>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${meetingId}`); setShowMore(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', width: '100%' }}>
                🔗 Copy meeting link
              </button>
              <button onClick={() => { navigator.clipboard.writeText(meetingId); setShowMore(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '8px 12px', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', width: '100%' }}>
                📋 Copy meeting ID
              </button>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 32, background: 'var(--border)', margin: '0 4px' }} />

        {isHost ? (
          <button onClick={onEndMeeting} style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: '0.75rem', fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            End for all
          </button>
        ) : (
          <button onClick={onLeaveMeeting} style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 10, padding: '8px 14px', fontSize: '0.75rem', fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Leave
          </button>
        )}
      </div>

      {/* Network quality bars */}
      <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'flex-end', gap: 2 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: 3, height: 4 + i * 3, borderRadius: 2, background: (networkQuality?.uplink || 0) === 0 || (networkQuality?.uplink || 0) <= i ? 'var(--success)' : 'var(--border)', opacity: 0.8 }} />
        ))}
      </div>
    </div>
  );
}