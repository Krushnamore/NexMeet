import { Link } from 'react-router-dom';

const FeatureCard = ({ icon, title, desc }) => (
  <div className="card p-6 flex flex-col gap-3 group hover:border-blue-500/30 transition-all duration-300">
    <div className="text-3xl">{icon}</div>
    <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.05rem', color: 'var(--text-primary)' }}>{title}</h3>
    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.6' }}>{desc}</p>
  </div>
);

const Stat = ({ val, label }) => (
  <div className="flex flex-col items-center gap-1">
    <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }} className="text-gradient">{val}</span>
    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{label}</span>
  </div>
);

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }} className="animate-fadeIn">
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(30,45,69,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(30,45,69,0.4) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10 }} className="flex items-center justify-between px-8 py-5 glass border-b border-transparent">
        <div className="flex items-center gap-2">
          <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 10 }} className="flex items-center justify-center">
            <span style={{ fontSize: 18 }}>⬡</span>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>NexMeet</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
          <Link to="/register" className="btn-primary text-sm">Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 1 }} className="flex flex-col items-center text-center px-6 pt-24 pb-20">
        <div className="badge badge-blue mb-6" style={{ padding: '6px 16px', fontSize: '0.75rem' }}>
          ✦ Completely free · No time limits · Unlimited participants
        </div>
        <h1 style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 800,
          fontSize: 'clamp(2.5rem, 7vw, 5rem)',
          lineHeight: 1.05,
          maxWidth: 800,
          marginBottom: '1.5rem',
        }}>
          Video meetings{' '}
          <span className="text-gradient">without limits.</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: 560, lineHeight: 1.7, marginBottom: '2.5rem' }}>
          Enterprise-grade video conferencing powered by Agora SDK. No subscriptions, no time caps, no participant restrictions. Just connect.
        </p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Link to="/register" className="btn-primary px-8 py-3" style={{ fontSize: '0.9375rem' }}>
            Start a meeting →
          </Link>
          <Link to="/join" className="btn-ghost px-8 py-3" style={{ fontSize: '0.9375rem' }}>
            Join with code
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-12 mt-20 flex-wrap justify-center">
          <Stat val="∞" label="Meeting duration" />
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <Stat val="∞" label="Participants" />
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <Stat val="$0" label="Cost forever" />
          <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
          <Stat val="<100ms" label="Global latency" />
        </div>
      </section>

      {/* Features */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '0 2rem 6rem' }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '2rem', textAlign: 'center', marginBottom: '3rem', color: 'var(--text-primary)' }}>
          Everything you need
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <FeatureCard icon="🎥" title="HD Video & Audio" desc="Crystal-clear 1080p video powered by Agora's global infrastructure with adaptive bitrate." />
          <FeatureCard icon="🖥️" title="Screen Sharing" desc="Share your full screen, specific windows, or browser tabs with participants instantly." />
          <FeatureCard icon="💬" title="Live Chat" desc="Group and private messaging with file sharing, reactions, and persistent chat history." />
          <FeatureCard icon="🔴" title="Cloud Recording" desc="Record meetings and store them in free cloud storage. Shareable links for later." />
          <FeatureCard icon="🏠" title="Breakout Rooms" desc="Split participants into smaller groups for focused discussions. Reassign anytime." />
          <FeatureCard icon="👑" title="Host Controls" desc="Mute all, remove participants, lock meetings, assign co-hosts, waiting room." />
          <FeatureCard icon="✋" title="Reactions & Hands" desc="Raise hand, emoji reactions, participant polls — full engagement toolkit." />
          <FeatureCard icon="🔒" title="Secure by Default" desc="JWT auth, meeting passwords, role-based access, and end-to-end encrypted signaling." />
          <FeatureCard icon="🌍" title="Global CDN" desc="Powered by Agora's 200+ data centers worldwide for sub-100ms latency everywhere." />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          NexMeet · Free · Open Source · Built with Agora, React & Node.js
        </p>
      </footer>
    </div>
  );
}
