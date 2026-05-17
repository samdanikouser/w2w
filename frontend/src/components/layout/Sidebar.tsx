import { useAuthStore } from '../../stores/authStore';
import { useNavStore } from '../../stores/navStore';
import type { Role } from '../../types';
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
  LogOut,
  DollarSign,
  Clock,
} from 'lucide-react';

interface NavItemDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: 'red' | 'amber' | 'accent';
}

interface NavSection {
  sec: string;
  items: NavItemDef[];
}

// Icon factory ─ keeps NAV_ITEMS readable
const I = {
  dashboard: <LayoutDashboard size={14} />,
  mapPin: <MapPin size={14} />,
  fileText: <FileText size={14} />,
  trending: <TrendingUp size={14} />,
  barChart: <BarChart3 size={14} />,
  users: <Users size={14} />,
  userPlus: <UserPlus size={14} />,
  clipboard: <ClipboardCheck size={14} />,
  heart: <Heart size={14} />,
  package: <Package size={14} />,
  truck: <Truck size={14} />,
  home: <Home size={14} />,
  book: <BookOpen size={14} />,
  alert: <AlertTriangle size={14} />,
  check: <CheckSquare size={14} />,
  refresh: <RefreshCw size={14} />,
  settings: <Settings size={14} />,
  scan: <ScanLine size={14} />,
  dollar: <DollarSign size={14} />,
  clock: <Clock size={14} />,
};

// ─── NAV_ITEMS ─ Ported from prototype W2W_Platform_v10.html ~L1574 ───
// React role names → prototype role groups:
//   super_admin → it / chairman / ceo (full access)
//   site_admin  → supervisor (own site only)
//   data_clerk  → admin (data capture, no financial)
//   field_worker→ field (FO mobile — handled elsewhere)
const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  super_admin: [
    { sec: 'Programme', items: [
      { id: 'dashboard', label: 'Dashboard', icon: I.dashboard },
      { id: 'sites', label: 'Sites & Regions', icon: I.mapPin },
      { id: 'epr-reports', label: 'EPR Monthly Reports', icon: I.barChart },
    ]},
    { sec: 'Finance', items: [
      { id: 'pl-register', label: 'P&L Entry Register', icon: I.dollar },
      { id: 'reports', label: 'Reports & Export', icon: I.trending },
      { id: 'demographics', label: 'Demographics', icon: I.users },
    ]},
    { sec: 'People', items: [
      { id: 'employees', label: 'Employees', icon: I.users },
      { id: 'onboarding', label: 'Onboarding', icon: I.userPlus },
      { id: 'attendance', label: 'Attendance Report', icon: I.clock },
      { id: 'beneficiary', label: 'Beneficiary Tracker', icon: I.heart },
    ]},
    { sec: 'Inventory', items: [
      { id: 'stock-register', label: 'Stock Register', icon: I.package },
    ]},
    { sec: 'Assets', items: [
      { id: 'vehicles', label: 'Vehicles & Fleet', icon: I.truck },
      { id: 'depots', label: 'Depot Management', icon: I.home },
    ]},
    { sec: 'Training', items: [
      { id: 'training', label: 'Training Tracker', icon: I.book },
    ]},
    { sec: 'Compliance', items: [
      { id: 'violations', label: 'Warnings', icon: I.alert },
      { id: 'audit-log', label: 'Audit Log', icon: I.check },
    ]},
    { sec: 'Waste Ops', items: [
      { id: 'waste-logs', label: 'Waste Collection', icon: I.refresh },
    ]},
    { sec: 'System', items: [
      { id: 'settings', label: 'Settings', icon: I.settings },
    ]},
  ],
  site_admin: [
    { sec: 'My Site', items: [
      { id: 'dashboard', label: 'Dashboard', icon: I.dashboard },
      { id: 'employees', label: 'Site Employees', icon: I.users },
      { id: 'attendance', label: 'Attendance Report', icon: I.clock },
    ]},
    { sec: 'Operations', items: [
      { id: 'waste-logs', label: 'Waste Collection', icon: I.refresh },
      { id: 'depot-scanner', label: 'Depot Scanner', icon: I.scan },
      { id: 'stock-variance', label: 'Stock Variance', icon: I.alert },
      { id: 'vehicles', label: 'Vehicles', icon: I.truck },
      { id: 'depots', label: 'Depot Management', icon: I.home },
    ]},
    { sec: 'Compliance', items: [
      { id: 'training', label: 'Training', icon: I.book },
      { id: 'violations', label: 'Warnings', icon: I.alert },
      { id: 'epr-reports', label: 'EPR Reports', icon: I.barChart },
    ]},
  ],
  data_clerk: [
    { sec: 'Register', items: [
      { id: 'dashboard', label: 'Dashboard', icon: I.dashboard },
      { id: 'employees', label: 'Register Employee', icon: I.users },
      { id: 'onboarding', label: 'Onboarding Checklist', icon: I.userPlus },
      { id: 'attendance', label: 'Attendance Report', icon: I.clock },
    ]},
    { sec: 'Waste', items: [
      { id: 'waste-logs', label: 'Record Waste', icon: I.refresh },
      { id: 'depot-scanner', label: 'Depot Scanner', icon: I.scan },
      { id: 'stock-variance', label: 'Stock Variance', icon: I.alert },
    ]},
    { sec: 'Assets', items: [
      { id: 'vehicles', label: 'Vehicles & Fleet', icon: I.truck },
      { id: 'stock-register', label: 'Stock Register', icon: I.package },
      { id: 'depots', label: 'Depot Management', icon: I.home },
    ]},
    { sec: 'Programme', items: [
      { id: 'demographics', label: 'Demographics', icon: I.users },
      { id: 'training', label: 'Training', icon: I.book },
      { id: 'violations', label: 'Warnings', icon: I.alert },
      { id: 'epr-reports', label: 'EPR Reports', icon: I.barChart },
    ]},
  ],
  field_worker: [
    { sec: 'Field', items: [
      { id: 'fo-attend', label: 'Attendance', icon: I.clock },
    ]},
  ],
};

// Colors for avatar backgrounds (kept from prior version)
const AVATAR_COLORS: Record<string, string> = {
  super_admin: '#146484',
  site_admin: '#00c896',
  data_clerk: '#d97706',
  field_worker: '#6d28d9',
};

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'IT Administrator',
  site_admin: 'Site Supervisor',
  data_clerk: 'Administrator',
  field_worker: 'Field Worker',
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { activePage, setActivePage } = useNavStore();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const avatarColor = AVATAR_COLORS[user.role] || '#146484';
  const sections: NavSection[] = NAV_BY_ROLE[user.role] || NAV_BY_ROLE.super_admin;
  const roleLabel = ROLE_LABELS[user.role] || user.role;

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
      <div className="sb-header" style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="sb-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            className="sb-badge"
            style={{
              width: 36,
              height: 36,
              background: 'var(--color-accent)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <RefreshCw size={20} color="white" strokeWidth={2.4} />
          </div>
          <div>
            <div className="sb-name" style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>W2W</div>
            <div className="sb-tagline" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Waste to Work
            </div>
          </div>
        </div>
      </div>

      {/* ── User card ── */}
      <div
        className="sb-user"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.05)',
          margin: 8,
          borderRadius: 9,
        }}
      >
        <div
          className="sb-uav avt"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: 'white',
            flexShrink: 0,
            background: avatarColor,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="sb-uname" style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.8)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </div>
          <div className="sb-urole" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
            {roleLabel} • BOH
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
                  {item.badge !== undefined && (
                    <span
                      className={`sb-badge-pill${item.badgeColor === 'amber' ? ' amber' : item.badgeColor === 'accent' ? ' accent' : ''}`}
                    >
                      {item.badge}
                    </span>
                  )}
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
          }}
        >
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
            © 2026 Waste To Work
            <br />
            Powered by Athina Tech
          </div>
        </div>
      </div>
    </aside>
  );
}
