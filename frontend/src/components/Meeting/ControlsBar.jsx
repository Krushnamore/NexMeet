import { useState } from 'react';

const ControlButton = ({ icon, label, onClick, active = false, danger = false, disabled = false }) => (
  <button
    className={`control-btn ${active ? 'active' : ''} ${danger ? 'danger' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={label}
    style={{ minWidth: 64, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none' }}
  >
    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{icon}</span>
    <span style={{ fontSize: '0.6875rem', fontFamily: 'Syne, sans-serif', fontWeight: 600, letterSpacing: '0.02em' }}>
      {label}
    </span>
  </button>
);

const NetworkQualityDot = ({ quality }) => {
  const color = quality === 0 ? 'var(--text-muted)' :
    quality <= 2 ? 'var(--success)' :
    quality <= 4 ? 'var(--warning)' : 'var(--danger)';
  const label = quality === 0 ? 'Unknown' : quality <= 2 ? 'Excellent' : quality <= 4 ? 'Fair' : 'Poor';
  return (
    <div className="flex items-center gap-1.5" title={`Network: ${label}`}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif' }}>{label}</span>
    </div>
  );
};

export default function ControlsBar({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isRecording,
  isHandRaised,
  isChatOpen,
  isParticipantsOpen,
  networkQuality,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleRecording,
  onToggleHand,
  onToggleChat,
  onReaction,
  onEndMeeting,
  onLeaveMeeting,
  isHost,
  meetingId,
}) {
  const [showReactions, setShowReactions] = useState(false);
  const [showMoreControls, setShowMoreControls] = useState(false);

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/join/${meetingId}`;
    navigator.clipboard.writeText(link);
  };

  const REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🔥', '👏', '✅'];

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Left: meeting info */}
      <div className="flex items-center gap-4" style={{ minWidth: 180 }}>
        <div>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {meetingId}
          </p>
          <NetworkQualityDot quality={networkQuality?.uplink || 0} />
        </div>
        {isRecording && (
          <div className="flex items-center gap-1.5">
            <div className="recording-indicator" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>REC</span>
          </div>
        )}
      </div>

      {/* Center: main controls */}
      <div className="flex items-center gap-2">
        <ControlButton
          icon={isAudioMuted ? '🔇' : '🎙️'}
          label={isAudioMuted ? 'Unmute' : 'Mute'}
          onClick={onToggleAudio}
          active={!isAudioMuted}
          danger={isAudioMuted}
        />
        <ControlButton
          icon={isVideoOff ? '📷' : '📹'}
          label={isVideoOff ? 'Start video' : 'Stop video'}
          onClick={onToggleVideo}
          active={!isVideoOff}
          danger={isVideoOff}
        />
        <ControlButton
          icon="🖥️"
          label={isScreenSharing ? 'Stop share' : 'Share'}
          onClick={onToggleScreenShare}
          active={isScreenSharing}
          danger={isScreenSharing}
        />

        {/* Reactions */}
        <div style={{ position: 'relative' }}>
          <ControlButton icon="😊" label="React" onClick={() => setShowReactions(p => !p)} active={showReactions} />
          {showReactions && (
            <div className="animate-scaleIn" style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 10, marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4, width: 180,
            }}>
              {REACTIONS.map(e => (
                <button key={e} onClick={() => { onReaction(e); setShowReactions(false); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', padding: 4, borderRadius: 6,
                  transition: 'transform 0.1s',
                }} className="hover:scale-125">
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <ControlButton
          icon="✋"
          label={isHandRaised ? 'Lower hand' : 'Raise hand'}
          onClick={onToggleHand}
          active={isHandRaised}
        />

        <ControlButton
          icon="💬"
          label="Chat"
          onClick={onToggleChat}
          active={isChatOpen}
        />

        {isHost && (
          <ControlButton
            icon={isRecording ? '⏹️' : '🔴'}
            label={isRecording ? 'Stop rec' : 'Record'}
            onClick={onToggleRecording}
            active={isRecording}
            danger={isRecording}
          />
        )}

        {/* More */}
        <div style={{ position: 'relative' }}>
          <ControlButton icon="⋯" label="More" onClick={() => setShowMoreControls(p => !p)} active={showMoreControls} />
          {showMoreControls && (
            <div className="animate-scaleIn" style={{
              position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 8, marginBottom: 8, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <button onClick={() => { copyMeetingLink(); setShowMoreControls(false); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                padding: '8px 12px', borderRadius: 8, fontSize: '0.875rem', color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif',
              }} className="hover:bg-blue-500/10">
                🔗 Copy meeting link
              </button>
              <button onClick={() => { navigator.clipboard.writeText(meetingId); setShowMoreControls(false); }} style={{
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                padding: '8px 12px', borderRadius: 8, fontSize: '0.875rem', color: 'var(--text-primary)',
                fontFamily: 'DM Sans, sans-serif',
              }} className="hover:bg-blue-500/10">
                📋 Copy meeting ID
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: leave/end */}
      <div className="flex items-center gap-2" style={{ minWidth: 180, justifyContent: 'flex-end' }}>
        {isHost ? (
          <button className="btn-danger" style={{ fontSize: '0.875rem', padding: '10px 18px' }} onClick={onEndMeeting}>
            End for all
          </button>
        ) : (
          <button className="btn-ghost" style={{ fontSize: '0.875rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={onLeaveMeeting}>
            Leave meeting
          </button>
        )}
      </div>
    </div>
  );
}
