import api from '../../services/api';
import { toast } from 'react-hot-toast';

const Avatar = ({ name, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: 8, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--purple))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.34, fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif',
  }}>
    {name?.slice(0, 2).toUpperCase() || '??'}
  </div>
);

export default function ParticipantsPanel({
  participants = [],
  isHost,
  currentUserId,
  onRemove,
  onMute,
  onClose,
  meetingId,
  socket,
}) {
  const handlePromoteCoHost = async (userId) => {
    try {
      await api.post(`/meetings/${meetingId}/co-host`, { userId });
      toast.success('Promoted to co-host');
    } catch { toast.error('Failed to promote'); }
  };

  return (
    <div className="panel" style={{ width: '100%', height: '100%', background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Participants ({participants.length})
        </h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {participants.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', padding: '2rem' }}>No participants yet</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {participants.map((p, i) => {
              const isCurrentUser = p.userId === currentUserId || p.isLocal;
              return (
                <div key={p.userId || i} style={{
                  padding: '10px 12px', borderRadius: 12, background: 'var(--bg-card)',
                  border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Avatar name={p.name} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}{isCurrentUser ? ' (You)' : ''}
                      </span>
                      {p.role && (
                        <span className={`badge badge-${p.role === 'host' ? 'blue' : p.role === 'co-host' ? 'purple' : 'green'}`} style={{ fontSize: '0.6rem' }}>
                          {p.role}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      {p.isMuted && <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>🔇 muted</span>}
                      {p.isVideoOff && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>📷 off</span>}
                      {p.isHandRaised && <span style={{ fontSize: '0.7rem', color: 'var(--warning)' }}>✋ raised</span>}
                    </div>
                  </div>

                  {isHost && !isCurrentUser && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => onMute(p.userId)} title="Mute"
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-hover)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        🔇
                      </button>
                      <button onClick={() => handlePromoteCoHost(p.userId)} title="Make co-host"
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-hover)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        ⭐
                      </button>
                      <button onClick={() => { if (window.confirm(`Remove ${p.name} from the meeting?`)) onRemove(p.userId); }} title="Remove"
                        style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--danger)', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isHost && participants.length > 1 && (
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn-ghost" style={{ width: '100%', fontSize: '0.8125rem' }}
            onClick={() => { participants.filter(p => !p.isLocal).forEach(p => onMute(p.userId)); toast.success('All participants muted'); }}>
            🔇 Mute all participants
          </button>
        </div>
      )}
    </div>
  );
}