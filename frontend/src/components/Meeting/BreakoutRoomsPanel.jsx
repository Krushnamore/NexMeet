import { useState } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

export default function BreakoutRoomsPanel({ meetingId, participants, isHost, onClose, socket }) {
  const [rooms, setRooms] = useState([{ name: 'Room 1', participants: [] }, { name: 'Room 2', participants: [] }]);
  const [created, setCreated] = useState(false);
  const [loading, setLoading] = useState(false);

  const addRoom = () => {
    setRooms(prev => [...prev, { name: `Room ${prev.length + 1}`, participants: [] }]);
  };

  const removeRoom = (idx) => {
    if (rooms.length <= 1) return;
    setRooms(prev => prev.filter((_, i) => i !== idx));
  };

  const assignParticipant = (participantId, roomIdx) => {
    setRooms(prev => prev.map((room, i) => ({
      ...room,
      participants: i === roomIdx
        ? [...new Set([...room.participants, participantId])]
        : room.participants.filter(id => id !== participantId),
    })));
  };

  const autoAssign = () => {
    const participantIds = participants.map(p => p.userId || p._id).filter(Boolean);
    const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
    const roomCount = rooms.length;

    setRooms(prev => prev.map((room, i) => ({
      ...room,
      participants: shuffled.filter((_, j) => j % roomCount === i),
    })));
  };

  const createRooms = async () => {
    setLoading(true);
    try {
      await api.post(`/meetings/${meetingId}/breakout-rooms`, { rooms });
      setCreated(true);

      // Emit socket assignments
      if (socket) {
        const assignments = rooms.flatMap((room, i) =>
          room.participants.map(userId => ({ userId, roomId: room.id || `room_${i}` }))
        );
        socket.emit('breakout:assign', { meetingId, assignments });
      }

      toast.success('Breakout rooms created!');
    } catch (err) {
      toast.error('Failed to create breakout rooms');
    } finally {
      setLoading(false);
    }
  };

  const endAllRooms = () => {
    setRooms([{ name: 'Room 1', participants: [] }, { name: 'Room 2', participants: [] }]);
    setCreated(false);
    if (socket) socket.emit('breakout:end', { meetingId });
    toast.success('Breakout rooms ended');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="card animate-scaleIn" style={{ width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>Breakout Rooms</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2 }}>{rooms.length} rooms · {participants.length} participants</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Actions */}
          {isHost && !created && (
            <div className="flex gap-2 flex-wrap">
              <button className="btn-ghost text-sm" onClick={autoAssign}>🎲 Auto-assign</button>
              <button className="btn-ghost text-sm" onClick={addRoom}>+ Add room</button>
            </div>
          )}

          {/* Unassigned participants */}
          {!created && (
            <div>
              <p className="label">Unassigned participants</p>
              <div className="flex flex-wrap gap-2">
                {participants
                  .filter(p => !rooms.some(r => r.participants.includes(p.userId || p._id)))
                  .map((p, i) => (
                    <span key={i} style={{
                      background: 'var(--bg-hover)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '4px 10px', fontSize: '0.8rem', color: 'var(--text-secondary)',
                      cursor: 'default',
                    }}>
                      {p.name || p.userName}
                    </span>
                  ))
                }
                {participants.filter(p => !rooms.some(r => r.participants.includes(p.userId || p._id))).length === 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>All participants assigned ✓</span>
                )}
              </div>
            </div>
          )}

          {/* Rooms */}
          {rooms.map((room, idx) => (
            <div key={idx} className="card" style={{ padding: '1rem' }}>
              <div className="flex items-center justify-between mb-3">
                <input
                  value={room.name}
                  onChange={e => setRooms(prev => prev.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                  disabled={created}
                  style={{
                    background: 'none', border: 'none', outline: 'none',
                    fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.9375rem',
                    color: 'var(--text-primary)', cursor: created ? 'default' : 'text',
                  }}
                />
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{room.participants.length} participants</span>
                  {!created && rooms.length > 1 && (
                    <button onClick={() => removeRoom(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.875rem' }}>Remove</button>
                  )}
                </div>
              </div>

              {/* Assigned participants */}
              <div className="flex flex-wrap gap-2">
                {room.participants.map(pId => {
                  const p = participants.find(p => (p.userId || p._id) === pId);
                  return p ? (
                    <span key={pId} style={{
                      background: 'rgba(59,130,246,0.15)', border: '1px solid var(--accent)',
                      borderRadius: 8, padding: '3px 10px', fontSize: '0.8rem', color: 'var(--accent)',
                      display: 'flex', alignItems: 'center', gap: 6, cursor: created ? 'default' : 'pointer',
                    }}
                    onClick={() => !created && assignParticipant(pId, -1)}>
                      {p.name || p.userName}
                      {!created && <span style={{ opacity: 0.6 }}>×</span>}
                    </span>
                  ) : null;
                })}

                {/* Add participants dropdown */}
                {!created && (
                  <div style={{ position: 'relative' }}>
                    <select
                      onChange={e => { if (e.target.value) assignParticipant(e.target.value, idx); e.target.value = ''; }}
                      defaultValue=""
                      style={{
                        background: 'var(--bg-hover)', border: '1px dashed var(--border)',
                        borderRadius: 8, padding: '3px 10px', fontSize: '0.8rem', color: 'var(--text-muted)',
                        cursor: 'pointer', outline: 'none',
                      }}>
                      <option value="">+ Add participant</option>
                      {participants
                        .filter(p => !rooms.some(r => r.participants.includes(p.userId || p._id)))
                        .map((p, i) => (
                          <option key={i} value={p.userId || p._id}>{p.name || p.userName}</option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {isHost && (
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            {created ? (
              <button className="btn-danger" onClick={endAllRooms}>End all rooms</button>
            ) : (
              <button className="btn-primary" onClick={createRooms} disabled={loading}>
                {loading ? 'Creating…' : 'Open rooms →'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
