import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDistanceToNow, format } from 'date-fns';

const Avatar = ({ name, size = 36, className = '' }) => {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = { active: 'badge-green', scheduled: 'badge-blue', ended: 'badge-purple', cancelled: 'badge-red' };
  return <span className={`badge ${map[status] || 'badge-blue'}`}>{status}</span>;
};

const MeetingCard = ({ meeting, onJoin, onEnd }) => (
  <div className="card p-5 hover:border-blue-500/20 transition-all duration-200 animate-fadeIn">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex-1 min-w-0">
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }} className="truncate">
          {meeting.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={meeting.status} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            ID: {meeting.meetingId}
          </span>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {meeting.status !== 'ended' && (
          <button className="btn-primary text-xs px-3 py-1.5" onClick={() => onJoin(meeting.meetingId)}>
            Join
          </button>
        )}
      </div>
    </div>
    <div className="flex items-center gap-4" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
      <span>👤 {meeting.host?.name || 'Unknown'}</span>
      <span>👥 {meeting.participants?.filter(p => p.isActive).length || 0} active</span>
      <span>🕐 {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}</span>
    </div>
  </div>
);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newMeeting, setNewMeeting] = useState({ title: '', scheduledAt: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState('upcoming');

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await api.get('/meetings');
      setMeetings(res.data.meetings);
    } catch (err) {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const createMeeting = async (e) => {
    e.preventDefault();
    if (!newMeeting.title.trim()) return toast.error('Meeting title required');
    setCreating(true);
    try {
      const res = await api.post('/meetings', {
        title: newMeeting.title,
        scheduledAt: newMeeting.scheduledAt || null,
      });
      const meeting = res.data.meeting;
      toast.success('Meeting created!');
      setShowCreate(false);
      setNewMeeting({ title: '', scheduledAt: '' });
      navigate(`/meeting/${meeting.meetingId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create meeting');
    } finally {
      setCreating(false);
    }
  };

  const joinMeeting = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return toast.error('Enter a meeting ID');
    navigate(`/meeting/${code}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const filteredMeetings = meetings.filter(m => {
    if (tab === 'upcoming') return m.status !== 'ended' && m.status !== 'cancelled';
    if (tab === 'past') return m.status === 'ended';
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem', flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-8 px-2">
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>⬡</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>NexMeet</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <button className="sidebar-nav-item active" style={{ border: 'none', textAlign: 'left', width: '100%' }}>
            <span>🏠</span> Dashboard
          </button>
          <button className="sidebar-nav-item" style={{ border: 'none', textAlign: 'left', width: '100%' }}
            onClick={() => setShowCreate(true)}>
            <span>➕</span> New Meeting
          </button>
          <button className="sidebar-nav-item" style={{ border: 'none', textAlign: 'left', width: '100%' }}
            onClick={() => navigate('/join')}>
            <span>🔗</span> Join Meeting
          </button>
        </nav>

        {/* User profile */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: 'auto' }}>
          <div className="flex items-center gap-3 px-2">
            <Avatar name={user?.name} size={34} />
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">{user?.name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="truncate">{user?.email}</p>
            </div>
          </div>
          <button className="sidebar-nav-item w-full mt-2" style={{ border: 'none', textAlign: 'left', color: 'var(--danger)', fontSize: '0.875rem' }}
            onClick={handleLogout}>
            <span>🚪</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {format(new Date(), 'EEEE, MMMM do yyyy')}
              </p>
            </div>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              + New meeting
            </button>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card p-5 cursor-pointer hover:border-blue-500/30 transition-all" onClick={() => setShowCreate(true)}>
              <div style={{ fontSize: '1.75rem', marginBottom: 8 }}>🎬</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>New Meeting</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Start instantly</p>
            </div>
            <div className="card p-5" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '1.75rem' }}>🔗</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>Join by ID</h3>
              <div className="flex gap-2">
                <input className="input" style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  placeholder="Meeting ID" value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && joinMeeting()} />
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0 }}
                  onClick={joinMeeting}>Join</button>
              </div>
            </div>
            <div className="card p-5">
              <div style={{ fontSize: '1.75rem', marginBottom: 8 }}>📊</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Total meetings</h3>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{meetings.length}</p>
            </div>
          </div>

          {/* Meetings list */}
          <div>
            <div className="flex items-center gap-1 mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              {[['upcoming', '📅 Upcoming'], ['past', '📋 Past'], ['all', '🗂 All']].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif', fontSize: '0.875rem', fontWeight: 600,
                  color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
                  transition: 'all 0.2s', marginBottom: -1,
                }}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
                Loading meetings…
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div style={{ fontSize: '3rem' }}>🎯</div>
                <p style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif' }}>No meetings yet. Create your first one!</p>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New meeting</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredMeetings.map(m => (
                  <MeetingCard
                    key={m._id}
                    meeting={m}
                    onJoin={(id) => navigate(`/meeting/${id}`)}
                    onEnd={(id) => {}}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create meeting modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowCreate(false)}>
          <div className="card p-8 animate-scaleIn" style={{ width: '100%', maxWidth: 440 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
              Create meeting
            </h2>
            <form onSubmit={createMeeting} className="flex flex-col gap-4">
              <div>
                <label className="label">Meeting title</label>
                <input className="input" placeholder="Weekly team sync" value={newMeeting.title}
                  onChange={e => setNewMeeting(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Schedule (optional)</label>
                <input className="input" type="datetime-local" value={newMeeting.scheduledAt}
                  onChange={e => setNewMeeting(p => ({ ...p, scheduledAt: e.target.value }))} />
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" className="btn-ghost flex-1" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>
                  {creating ? 'Creating…' : 'Start meeting →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
