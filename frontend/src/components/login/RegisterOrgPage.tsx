import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function RegisterOrgPage({ onGoToLogin }: { onGoToLogin: () => void }) {
  const { register } = useAuthStore();
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Removed the localStorage check so the form isn't permanently blocked after one registration.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    
    try {
      const isSuccess = await register({
        email,
        password,
        name: adminName,
        orgName,
      });
      if (!isSuccess) {
        setError('Registration failed. Please check your inputs.');
        return;
      }
      setSuccess('Organization registered successfully! Signing you in...');
      // It will automatically redirect to dashboard because useAuthStore sets isAuthenticated = true
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="register-screen"
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
            Powered by Elanora
          </div>
        </div>

        {/* ── RIGHT: Register form ── */}
        <div className="login-form-panel" style={{ padding: 36, borderRadius: '0 24px 24px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 6 }}>Register Organization</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
            Create a new organization and admin account.
          </div>

          {error && (
            <div
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

          {success && (
            <div
              style={{
                background: 'rgba(46, 204, 113, 0.2)',
                border: '1px solid rgba(46, 204, 113, 0.4)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                color: '#2ecc71',
                marginBottom: 12,
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ overflowY: 'auto', maxHeight: '400px', paddingRight: '10px' }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, fontSize: 13, color: 'white', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Admin Full Name
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="John Doe"
                  required
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, fontSize: 13, color: 'white', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Admin Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organisation.com"
                  required
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, fontSize: 13, color: 'white', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{ width: '100%', padding: '10px 42px 10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, fontSize: 13, color: 'white', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    tabIndex={-1}
                    style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', display: 'flex', padding: 4 }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, fontSize: 13, color: 'white', outline: 'none' }}
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
                  cursor: isLoading ? 'wait' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  marginBottom: 12
                }}
              >
                {isLoading ? 'Registering…' : 'Register Organization →'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={onGoToLogin}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Already have an account? Sign in here.
                </button>
              </div>
            </form>

          <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 12 }}>
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
