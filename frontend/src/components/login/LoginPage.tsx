import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

export default function LoginPage() {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const success = await login(email, password);
    if (!success) {
      setError('Invalid email or password');
    }
    setIsLoading(false);
  };

  return (
    <div
      id="login-screen"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(145deg, var(--color-w2w-darker) 0%, var(--color-w2w) 45%, #1a9ec4 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        overflowY: 'auto',
        padding: '20px 0',
      }}
    >
      <div
        className="login-bg-pattern"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `
            radial-gradient(circle at 15% 85%, rgba(20,100,132,0.25) 0%, transparent 45%),
            radial-gradient(circle at 85% 15%, rgba(0,200,150,0.15) 0%, transparent 45%),
            radial-gradient(circle at 50% 50%, rgba(20,100,132,0.08) 0%, transparent 70%)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Login card */}
      <div
        className="login-wrap"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          width: 920,
          maxWidth: '100%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          overflow: 'visible',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
          margin: 'auto',
        }}
      >
        {/* ── LEFT: Brand panel ── */}
        <div
          className="login-brand"
          style={{
            padding: '32px 28px',
            background: 'linear-gradient(160deg, rgba(5,30,50,0.7) 0%, rgba(10,60,40,0.5) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            borderRadius: '24px 0 0 24px',
          }}
        >
          <div
            style={{
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 6px 32px rgba(0,0,0,0.4)',
              background: '#000',
              lineHeight: 0,
              marginBottom: 20,
            }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block', borderRadius: 14 }}
            >
              <source src="/w2w_video.mp4" type="video/mp4" />
            </video>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                background: 'white',
                padding: '4px 8px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img src="/athina_logo.jpg" alt="Athina Tech" style={{ height: 22, width: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>W2W</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Waste to Work
              </div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 2, letterSpacing: '0.04em' }}>
                Powered by Athina
              </div>
            </div>
          </div>

          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>
            EPWP Waste Recycling Programme Management Platform for the City of Johannesburg.
          </p>
        </div>

        {/* ── RIGHT: Sign-in form ── */}
        <div className="login-form-panel" style={{ padding: 36, borderRadius: '0 24px 24px 0' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>Sign In</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
            Enter your credentials to access the platform
          </div>

          {error && (
            <div
              id="login-error"
              style={{
                background: 'rgba(192,57,43,0.2)',
                border: '1px solid rgba(192,57,43,0.4)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                color: '#ff8a7a',
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organisation.com"
                autoComplete="username"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 9,
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  color: 'white',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 9,
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  color: 'white',
                  outline: 'none',
                  transition: 'border 0.2s',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: 12,
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: 9,
                color: 'var(--color-ink)',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                cursor: isLoading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.01em',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? 'Signing in…' : 'Access Platform →'}
            </button>
          </form>

          <div
            style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 12 }}
          >
            🔒 POPIA Compliant · Secured · Built for South Africa
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '7px 20px',
          textAlign: 'center',
          background: 'rgba(10,30,40,0.85)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          zIndex: 10000,
        }}
      >
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.04em' }}>
          © 2026 Waste To Work &nbsp;·&nbsp; Powered by Athina Tech
        </div>
      </div>
    </div>
  );
}
