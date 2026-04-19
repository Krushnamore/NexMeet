import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDistanceToNow, format } from 'date-fns';

const Avatar = ({ name, size = 36 }) => {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, flexShrink: 0,
      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif',
    }}>
      {initials}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = { active: 'badge-green', scheduled: 'badge-blue', ended: 'badge-purple', cancelled: 'badge-red' };
  return <span className={`badge ${map[status] || 'badge-blue'}`}>{status}</span>;
};

const MeetingCard = ({ meeting, onJoin }) => (
  <div className="card animate-fadeIn" style={{ padding: '16px 18px', marginBottom: 10 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meeting.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge status={meeting.status} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>ID: {meeting.meetingId}</span>
        </div>
      </div>
      {meeting.status !== 'ended' && (
        <button className="btn-primary" style={{ fontSize: '0.8rem', padding: '6px 14px', flexShrink: 0 }}
          onClick={() => onJoin(meeting.meetingId)}>
          Join
        </button>
      )}
    </div>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>👤 {meeting.host?.name}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        🕐 {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
      </span>
    </div>
  </div>
);

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [newMeeting, setNewMeeting] = useState({ title: '', scheduledAt: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('upcoming');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await api.get('/meetings');
      setMeetings(res.data.meetings);
    } catch { toast.error('Failed to load meetings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const createMeeting = async (e) => {
    e.preventDefault();
    if (!newMeeting.title.trim()) return toast.error('Meeting title required');
    setCreating(true);
    try {
      const res = await api.post('/meetings', { title: newMeeting.title, scheduledAt: newMeeting.scheduledAt || null });
      toast.success('Meeting created!');
      setShowCreate(false);
      setNewMeeting({ title: '', scheduledAt: '' });
      navigate(`/meeting/${res.data.meeting.meetingId}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create meeting');
    } finally { setCreating(false); }
  };

  const joinMeeting = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return toast.error('Enter a meeting ID');
    navigate(`/meeting/${code}`);
  };

  const handleLogout = async () => { await logout(); navigate('/'); };

  const filteredMeetings = meetings.filter(m => {
    if (tab === 'upcoming') return m.status !== 'ended' && m.status !== 'cancelled';
    if (tab === 'past') return m.status === 'ended';
    return true;
  });

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>⬡</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>NexMeet</span>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button className="sidebar-nav-item active" style={{ border: 'none', width: '100%', textAlign: 'left' }}>
          🏠 Dashboard
        </button>
        <button className="sidebar-nav-item" style={{ border: 'none', width: '100%', textAlign: 'left' }}
          onClick={() => { setShowCreate(true); setSidebarOpen(false); }}>
          ➕ New Meeting
        </button>
        <button className="sidebar-nav-item" style={{ border: 'none', width: '100%', textAlign: 'left' }}
          onClick={() => { navigate('/join'); setSidebarOpen(false); }}>
          🔗 Join Meeting
        </button>
      </nav>

      {/* User profile */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
          <Avatar name={user?.name} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
          </div>
        </div>
        <button className="sidebar-nav-item" style={{ border: 'none', width: '100%', textAlign: 'left', color: 'var(--danger)' }} onClick={handleLogout}>
          🚪 Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex' }}>

      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <aside style={{ width: 240, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', flexShrink: 0, height: '100vh', position: 'sticky', top: 0, overflow: 'auto' }}>
          <SidebarContent />
        </aside>
      )}

      {/* ── Mobile Sidebar Overlay ── */}
      {isMobile && sidebarOpen && (
        <>
          {/* Backdrop */}
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          {/* Drawer */}
          <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 260, zIndex: 50, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', overflow: 'auto', animation: 'slideRight 0.25s ease-out' }}>
            <SidebarContent />
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.5rem', lineHeight: 1, padding: 4 }}>
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 14 }}>⬡</span>
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>NexMeet</span>
            </div>
            <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={() => setShowCreate(true)}>+ New</button>
          </div>
        )}

        <div style={{ maxWidth: 860, margin: '0 auto', padding: isMobile ? '16px' : '32px 24px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: isMobile ? '1.375rem' : '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {format(new Date(), 'EEEE, MMMM do yyyy')}
              </p>
            </div>
            {!isMobile && (
              <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New meeting</button>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            <div className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => setShowCreate(true)}>
              <div style={{ fontSize: '1.75rem', marginBottom: 6 }}>🎬</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>New Meeting</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Start instantly</p>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: '1.75rem', marginBottom: 6 }}>🔗</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Join by ID</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="input" style={{ fontSize: '0.75rem', padding: '6px 10px', flex: 1, minWidth: 0 }}
                  placeholder="Meeting ID"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && joinMeeting()} />
                <button className="btn-primary" style={{ padding: '6px 10px', fontSize: '0.75rem', flexShrink: 0 }} onClick={joinMeeting}>Join</button>
              </div>
            </div>

            <div className="card" style={{ padding: 16, gridColumn: isMobile ? '1 / -1' : 'auto' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: 6 }}>📊</div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Total meetings</h3>
              <p style={{ fontFamily: 'Syne, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{meetings.length}</p>
            </div>
          </div>

          {/* Meetings list */}
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              {[['upcoming', '📅 Upcoming'], ['past', '📋 Past'], ['all', '🗂 All']].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '0.8125rem',
                  color: tab === key ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
                  marginBottom: -1, transition: 'all 0.2s',
                }}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading meetings…</div>
            ) : filteredMeetings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '3rem' }}>🎯</div>
                <p style={{ color: 'var(--text-muted)', fontFamily: 'Syne, sans-serif' }}>No meetings yet. Create your first one!</p>
                <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New meeting</button>
              </div>
            ) : (
              filteredMeetings.map(m => (
                <MeetingCard key={m._id} meeting={m} onJoin={(id) => navigate(`/meeting/${id}`)} />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Create meeting modal */}
      {showCreate && (
        <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '1rem' }}>
          <div className="card animate-scaleIn" style={{ width: '100%', maxWidth: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Create meeting</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={createMeeting} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Meeting title</label>
                <input className="input" placeholder="Weekly team sync" value={newMeeting.title}
                  onChange={e => setNewMeeting(p => ({ ...p, title: e.target.value }))} required autoFocus />
              </div>
              <div>
                <label className="label">Schedule (optional)</label>
                <input className="input" type="datetime-local" value={newMeeting.scheduledAt}
                  onChange={e => setNewMeeting(p => ({ ...p, scheduledAt: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={creating}>
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