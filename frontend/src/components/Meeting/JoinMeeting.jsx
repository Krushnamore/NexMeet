import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function JoinMeeting() {
  const { meetingId: paramId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetingId, setMeetingId] = useState(paramId || '');
  const [loading, setLoading] = useState(false);

  const handleJoin = (e) => {
    e.preventDefault();
    const id = meetingId.trim().toUpperCase();
    if (!id) return toast.error('Please enter a meeting ID');
    if (!user) {
      sessionStorage.setItem('pendingMeetingId', id);
      navigate('/login');
      return;
    }
    navigate('/meeting/' + id);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40, textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>⬡</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>NexMeet</span>
        </Link>

        <div className="card p-8 animate-slideUp">
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.75rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Join a meeting</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>Enter the meeting ID shared by the host</p>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Meeting ID</label>
              <input className="input" placeholder="e.g. AB12CD34EF" value={meetingId}
                onChange={e => setMeetingId(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}
                autoFocus />
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} type="submit" disabled={loading}>
              {loading ? 'Joining…' : 'Join meeting →'}
            </button>
          </form>

          {!user && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10 }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                You'll be asked to sign in before joining.{' '}
                <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Create a free account</Link>
              </p>
            </div>
          )}
          {user && (
            <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Or <Link to="/dashboard" style={{ color: 'var(--accent)', textDecoration: 'none' }}>start a new meeting</Link> from your dashboard
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
