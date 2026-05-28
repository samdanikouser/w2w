import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/endpoints';

export default function LoginPage({ onGoToRegister }: { onGoToRegister?: () => void }) {
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ message: string; tempPassword?: string } | null>(null);
  const [forgotError, setForgotError] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotResult(null);
    setForgotLoading(true);
    try {
      const result = await authApi.forgotPassword(forgotEmail);
      setForgotResult(result);
    } catch (err: any) {
      setForgotError(err?.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

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



          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 18px' }}>
            A complete workforce &amp; waste management platform for sustainable operations in South Africa.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              'Employee lifecycle management & onboarding',
              'Real-time waste collection & depot tracking',
              'Fleet & electric vehicle management',
              'PPE, uniform & tool allocation',
              'ID cards & field SOS reporting',
            ].map((feature) => (
              <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-accent)',
                    flexShrink: 0,
                  }}
                />
                {feature}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 20, letterSpacing: '0.02em', textAlign: 'center' }}>
            © 2026 Waste To Work &nbsp;·&nbsp; Powered by Elanora Systems
          </div>
        </div>

        {/* ── RIGHT: Sign-in form ── */}
        <div className="login-form-panel" style={{ padding: 36, borderRadius: '0 24px 24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 14px',
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
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: 10,
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ textAlign: 'right', marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotResult(null); setForgotError(''); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer', padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
              >
                Forgot password?
              </button>
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

            {onGoToRegister && (
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={onGoToRegister}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Need to register an organization?
                </button>
              </div>
            )}
          </form>

          <div
            style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 12 }}
          >
            🔒 POPIA Compliant · Secured · Built for South Africa
          </div>

          {/* ── Forgot Password Modal ── */}
          {showForgot && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}
              onClick={() => setShowForgot(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'linear-gradient(160deg, rgba(10,40,60,0.95) 0%, rgba(15,50,70,0.98) 100%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 16,
                  padding: 28,
                  width: 400,
                  maxWidth: '90vw',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 6 }}>Reset Password</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
                  Enter your email to receive a temporary password.
                </div>

                {forgotError && (
                  <div style={{ background: 'rgba(192,57,43,0.2)', border: '1px solid rgba(192,57,43,0.4)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ff8a7a', marginBottom: 12 }}>
                    {forgotError}
                  </div>
                )}

                {forgotResult && (
                  <div style={{ background: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#2ecc71', marginBottom: 6 }}>{forgotResult.message}</div>
                    {forgotResult.tempPassword && (
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'white', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 6, letterSpacing: '0.05em', fontWeight: 700 }}>
                        {forgotResult.tempPassword}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
                      Use this password to sign in, then change it in Profile → Security.
                    </div>
                  </div>
                )}

                {!forgotResult && (
                  <form onSubmit={handleForgotPassword}>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@organisation.com"
                        required
                        autoFocus
                        style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, fontSize: 13, color: 'white', outline: 'none' }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      style={{ width: '100%', padding: 11, background: 'var(--color-accent)', border: 'none', borderRadius: 9, color: 'var(--color-ink)', fontSize: 13, fontWeight: 700, cursor: forgotLoading ? 'wait' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}
                    >
                      {forgotLoading ? 'Resetting…' : 'Reset Password'}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  style={{ width: '100%', marginTop: 10, padding: 9, background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}
                >
                  {forgotResult ? 'Back to Sign In' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          <div
            style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 12, display: 'none' }}
          >
          </div>
        </div>
      </div>
    </div>
  );
}
