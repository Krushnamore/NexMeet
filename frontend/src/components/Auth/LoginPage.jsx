import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const AuthLayout = ({ children, title, subtitle }) => (
  <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
    <div style={{ width: '100%', maxWidth: 440 }}>
      <div className="flex items-center gap-2 mb-10">
        <Link to="/" className="flex items-center gap-2">
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>⬡</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>NexMeet</span>
        </Link>
      </div>
      <div className="card p-8 animate-slideUp">
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>{subtitle}</p>
        {children}
      </div>
    </div>
  </div>
);

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your NexMeet account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
        </div>
        <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in →'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        No account?{' '}
        <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Create one free</Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Free forever. No credit card required.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Full Name</label>
          <input className="input" type="text" placeholder="Alex Johnson" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="you@example.com" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="Min. 8 characters" value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
        </div>
        <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export default LoginPage;
