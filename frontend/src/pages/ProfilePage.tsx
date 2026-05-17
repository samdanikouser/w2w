import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/endpoints';
import { Save, User, Bell, Shield, CheckCircle2 } from 'lucide-react';

const TABS = [
  { id: 'info', label: 'My Info', icon: <User size={13} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={13} /> },
  { id: 'security', label: 'Security', icon: <Shield size={13} /> },
];

const ROLE_FULL: Record<string, string> = {
  super_admin: 'IT Administrator',
  site_admin: 'Site Supervisor',
  data_clerk: 'Administrator',
  field_worker: 'Field Worker',
};

function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const initials = (name: string) =>
  (name || '').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '—';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('info');
  const [toast, setToast] = useState<{ message: string; tone: 'green' | 'amber' | 'red' } | null>(null);

  // Per-user preferences kept locally (key includes user id so each account has its own)
  const prefKey = `w2w_profile_prefs:${user?.id || 'anon'}`;
  const [prefs, setPrefs] = useState<Record<string, any>>(() => {
    try { return JSON.parse(localStorage.getItem(prefKey) || '{}'); } catch { return {}; }
  });

  const savePrefs = () => {
    try {
      localStorage.setItem(prefKey, JSON.stringify(prefs));
      setToast({ message: 'Preferences saved.', tone: 'green' });
    } catch {
      setToast({ message: 'Could not save (localStorage unavailable).', tone: 'amber' });
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!user) return null;

  const roleLabel = ROLE_FULL[user.role] || user.role;
  const avatarBg = avatarColor(user.id);

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">My Profile</div>
          <div className="ps">Personal information, notifications, and account security</div>
        </div>
        {tab !== 'security' && (
          <button className="btn btn-primary" onClick={savePrefs}>
            <Save size={13} /> Save Changes
          </button>
        )}
      </div>

      {toast && (
        <div
          className={`alert alert-${toast.tone === 'red' ? 'red' : toast.tone === 'amber' ? 'amber' : 'green'}`}
          style={{ marginBottom: 12 }}
        >
          <CheckCircle2 size={14} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Identity card */}
      <div className="card mb14">
        <div className="cb" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20 }}>
          <div
            className="avt"
            style={{
              width: 64, height: 64, borderRadius: '50%',
              fontSize: 22, fontWeight: 800, color: 'white',
              background: avatarBg, flexShrink: 0,
            }}
          >
            {initials(user.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{user.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text2)', marginTop: 2 }}>{user.email}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span className="badge bb">{roleLabel}</span>
              {user.siteName && <span className="badge bk">{user.siteName}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed content */}
      <div className="g2" style={{ gridTemplateColumns: '220px 1fr', alignItems: 'start' }}>
        <div className="card">
          <div className="cb" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px',
                  background: tab === t.id ? 'var(--color-w2w-pale)' : 'transparent',
                  color: tab === t.id ? 'var(--color-w2w)' : 'var(--color-text2)',
                  border: 'none', cursor: 'pointer', borderRadius: 7,
                  fontWeight: tab === t.id ? 700 : 500, fontSize: 12,
                  textAlign: 'left', fontFamily: 'var(--font-sans)',
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="ch"><div className="ct">{TABS.find((t) => t.id === tab)?.label}</div></div>
          <div className="cb">
            {tab === 'info' && (
              <>
                <div className="fgrid">
                  <div className="fg"><label className="fl">Full Name</label>
                    <input className="fc" value={user.name} disabled />
                  </div>
                  <div className="fg"><label className="fl">Email</label>
                    <input className="fc" value={user.email} disabled />
                  </div>
                  <div className="fg"><label className="fl">System Role</label>
                    <input className="fc" value={roleLabel} disabled />
                  </div>
                  <div className="fg"><label className="fl">Site</label>
                    <input className="fc" value={user.siteName || '—'} disabled />
                  </div>
                  <div className="fg"><label className="fl">Language</label>
                    <select className="fc" value={prefs.lang || 'en-ZA'} onChange={(e) => setPrefs({ ...prefs, lang: e.target.value })}>
                      <option value="en-ZA">English (en-ZA)</option>
                      <option value="zu">isiZulu</option>
                      <option value="st">Sesotho</option>
                      <option value="tn">Setswana</option>
                    </select>
                  </div>
                  <div className="fg"><label className="fl">Time Zone</label>
                    <select className="fc" value={prefs.tz || 'Africa/Johannesburg'} onChange={(e) => setPrefs({ ...prefs, tz: e.target.value })}>
                      <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                <div className="alert alert-blue mt14">
                  <span>
                    To change your name, email, or role, contact an administrator. They can update your account under
                    <b> Settings → Users</b>.
                  </span>
                </div>
              </>
            )}

            {tab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Toggle label="Pending waste-log approvals (email)" prefs={prefs} setPrefs={setPrefs} prefKey="notif_pending" defaultOn />
                <Toggle label="Daily attendance summary (email)" prefs={prefs} setPrefs={setPrefs} prefKey="notif_attendance" />
                <Toggle label="Stock low / out alerts (SMS)" prefs={prefs} setPrefs={setPrefs} prefKey="notif_stock" defaultOn />
                <Toggle label="EPR submission reminders" prefs={prefs} setPrefs={setPrefs} prefKey="notif_epr" defaultOn />
                <Toggle label="My training expiring soon" prefs={prefs} setPrefs={setPrefs} prefKey="notif_training" defaultOn />
                <Toggle label="Sign-in from new device" prefs={prefs} setPrefs={setPrefs} prefKey="notif_login" defaultOn />
              </div>
            )}

            {tab === 'security' && <SecurityTab onToast={setToast} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Security: real password change against /api/auth/change-password ───
function SecurityTab({ onToast }: { onToast: (t: { message: string; tone: 'green' | 'amber' | 'red' }) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!current || !next) return onToast({ message: 'All password fields are required.', tone: 'amber' });
    if (next !== confirm) return onToast({ message: 'Passwords do not match.', tone: 'amber' });
    if (next.length < 10) return onToast({ message: 'Password must be at least 10 characters.', tone: 'amber' });
    if (!/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/[0-9]/.test(next)) {
      return onToast({ message: 'Password must include upper, lower, and a digit.', tone: 'amber' });
    }
    setLoading(true);
    try {
      await authApi.changePassword(current, next);
      onToast({ message: 'Password changed.', tone: 'green' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: any) {
      onToast({ message: err?.response?.data?.error || 'Could not change password.', tone: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="alert alert-blue">
        <span>Choose a strong password: at least 10 characters, with upper-case, lower-case, and a digit.</span>
      </div>
      <div className="fgrid mt14">
        <div className="fg"><label className="fl">Current Password</label>
          <input className="fc" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="fg"><label className="fl">New Password</label>
          <input className="fc" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min 10 · upper, lower, digit" autoComplete="new-password" />
        </div>
        <div className="fg"><label className="fl">Confirm New Password</label>
          <input className="fc" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
      </div>
      <button className="btn btn-primary mt14" onClick={submit} disabled={loading}>
        {loading ? 'Changing…' : 'Change Password'}
      </button>
    </>
  );
}

function Toggle({
  label, prefs, setPrefs, prefKey, defaultOn,
}: {
  label: string; prefs: any; setPrefs: (p: any) => void; prefKey: string; defaultOn?: boolean;
}) {
  const on = prefs[prefKey] ?? !!defaultOn;
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px',
        background: 'var(--color-surface2)', borderRadius: 8, cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={() => setPrefs({ ...prefs, [prefKey]: !on })}
        style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
      />
      <span style={{ fontSize: 12, color: 'var(--color-text)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: on ? 'var(--color-green)' : 'var(--color-text3)', fontWeight: 700 }}>
        {on ? 'ON' : 'OFF'}
      </span>
    </label>
  );
}
