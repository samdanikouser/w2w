import { useAuthStore } from '../../stores/authStore';
import { useNavStore } from '../../stores/navStore';
import { ALL_MODULES } from '../../config/moduleRegistry';
import type { ModuleDef } from '../../config/moduleRegistry';
import {
  LayoutDashboard,
  MapPin,
  FileText,
  TrendingUp,
  BarChart3,
  Users,
  UserPlus,
  ClipboardCheck,
  Heart,
  Package,
  Truck,
  Home,
  BookOpen,
  AlertTriangle,
  CheckSquare,
  RefreshCw,
  Settings,
  ScanLine,
  LogIn,
  LogOut,
  DollarSign,
  Clock,
} from 'lucide-react';

// Map icon name strings from moduleRegistry to actual React icon elements
const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard size={14} />,
  MapPin: <MapPin size={14} />,
  FileText: <FileText size={14} />,
  TrendingUp: <TrendingUp size={14} />,
  BarChart3: <BarChart3 size={14} />,
  Users: <Users size={14} />,
  UserPlus: <UserPlus size={14} />,
  ClipboardCheck: <ClipboardCheck size={14} />,
  Heart: <Heart size={14} />,
  Package: <Package size={14} />,
  Truck: <Truck size={14} />,
  Home: <Home size={14} />,
  BookOpen: <BookOpen size={14} />,
  AlertTriangle: <AlertTriangle size={14} />,
  CheckSquare: <CheckSquare size={14} />,
  RefreshCw: <RefreshCw size={14} />,
  Settings: <Settings size={14} />,
  ScanLine: <ScanLine size={14} />,
  DollarSign: <DollarSign size={14} />,
  Clock: <Clock size={14} />,
  LogIn: <LogIn size={14} />,
};

function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

interface NavSection {
  sec: string;
  items: { id: string; label: string; icon: React.ReactNode }[];
}

function buildSections(modules: ModuleDef[]): NavSection[] {
  const map = new Map<string, { id: string; label: string; icon: React.ReactNode }[]>();
  for (const m of modules) {
    if (!map.has(m.section)) map.set(m.section, []);
    map.get(m.section)!.push({
      id: m.id,
      label: m.label,
      icon: ICON_MAP[m.icon] || <LayoutDashboard size={14} />,
    });
  }
  return Array.from(map.entries()).map(([sec, items]) => ({ sec, items }));
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { activePage, setActivePage } = useNavStore();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const avColor = avatarColor(user.id);

  // Determine allowed modules: if user.modules exists and has items, use it.
  // Otherwise if role is 'super_admin', show ALL_MODULES.
  let allowedIds = user.modules && user.modules.length > 0
    ? user.modules
    : user.role === 'super_admin'
      ? ALL_MODULES.map((m) => m.id)
      : [];

  // Backward compat: map old 'settings' → 'w2w-settings'
  if (allowedIds.includes('settings') && !allowedIds.includes('w2w-settings')) {
    allowedIds = allowedIds.map((id) => id === 'settings' ? 'w2w-settings' : id);
  }

  const filteredModules = ALL_MODULES.filter((m) => allowedIds.includes(m.id));
  const sections = buildSections(filteredModules);
  const roleLabel = user.roleName || user.role.replace(/_/g, ' ');

  return (
    <aside
      className="boh-sidebar"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-w2w-darker)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflowY: 'auto',
        position: 'relative',
      }}
    >
      {/* ── Header / Logo ── */}
      <div className="sb-header" style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="sb-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              background: 'white',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            <img src="/elanora-logo.png" alt="Elanora Systems" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          </div>
          <div>
            <div className="sb-name" style={{ fontSize: 13, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>Elanora Systems</div>
            <div className="sb-tagline" style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Waste to Work Platform
            </div>
          </div>
        </div>
      </div>


      {/* ── Navigation ── */}
      <nav style={{ flex: 1, paddingTop: 4, paddingBottom: 4 }}>
        {sections.map((section) => (
          <div key={section.sec}>
            <div
              className="sb-section"
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.22)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '10px 16px 3px',
                fontWeight: 600,
              }}
            >
              {section.sec}
            </div>
            {section.items.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`sb-item${isActive ? ' active' : ''}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.48)',
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 400,
                    transition: 'all 0.15s',
                    borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                    borderTop: 'none',
                    borderRight: 'none',
                    borderBottom: 'none',
                    margin: '1px 0',
                    background: isActive ? 'rgba(20,100,132,0.4)' : 'transparent',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.48)';
                    }
                  }}
                >
                  <span style={{ flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer / Logout + Copyright ── */}
      <div className="sb-footer" style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={logout}
          className="sb-logout"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: 'rgba(255,255,255,0.3)',
            fontSize: 11,
            cursor: 'pointer',
            padding: 6,
            background: 'none',
            border: 'none',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)')}
        >
          <LogOut size={13} />
          Sign Out
        </button>
        <div
          style={{
            padding: '8px 0 0',
            textAlign: 'center',
            marginTop: 6,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <img src="/elanora-logo.png" alt="Elanora" style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'contain', background: 'white', padding: 1 }} />
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
            © 2026 Elanora Systems
            <br />
            Waste to Work Platform
          </div>
        </div>
      </div>
    </aside>
  );
}
