import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavStore } from '../../stores/navStore';
import { useAuthStore } from '../../stores/authStore';
import { notificationsApi } from '../../api/endpoints';
import type { Notification } from '../../api/endpoints';
import { Search, Bell, X, User, Settings, LogOut, ChevronDown, HelpCircle } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  'waste-logs': 'Waste Collection Logs',
  'stock-variance': 'Stock Variance Report',
  'stock-register': 'Stock Register',
  'pl-register': 'P&L Entry Register',
  'epr-reports': 'Monthly EPR Reporting',
  reports: 'Reports & Analytics',
  training: 'Training Tracker',
  vehicles: 'Vehicles & Fleet',
  sites: 'Sites & Regions',
  facilities: 'Facility Hierarchy',
  settings: 'Settings',
  'audit-log': 'Audit Log',
  demographics: 'Demographics',
  onboarding: 'Onboarding',
  attendance: 'Attendance Report',
  beneficiary: 'Beneficiary Tracker',
  depots: 'Depot Management',
  'depot-scanner': 'Depot Scanner',
  violations: 'Warnings & Violations',
  profile: 'My Profile',
  'w2w-settings': 'W2W Settings',
  'help-docs': 'Help & Documentation',
};

const PAGE_SUBTITLES: Record<string, string> = {
  dashboard: 'Programme-wide view',
  employees: 'Staff directory',
  'waste-logs': 'Collection records',
  'pl-register': 'Financial transactions',
  'epr-reports': 'Compliance submissions',
  reports: 'Operational insights',
  training: 'Skills & certifications',
  vehicles: 'Fleet operations',
  sites: 'Cooperatives, depots, buyback',
  facilities: 'Regional Depots & Associated Sites',
  settings: 'System preferences',
  'audit-log': 'POPIA event trail',
  demographics: 'Workforce composition',
  onboarding: 'New hires in pipeline',
  attendance: 'Daily check-in / out',
  beneficiary: 'Programme participants',
  depots: 'Buyback locations',
  'depot-scanner': 'Live QR intake',
  violations: 'Disciplinary register',
  'stock-register': 'PPE, consumables, equipment',
  'stock-variance': 'Reconciliation report',
  profile: 'Personal info, notifications, security',
  'w2w-settings': 'Waste categories, training, payments, cost centers',
  'help-docs': 'Guides, FAQ, shortcuts & support',
};

function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function TopBar() {
  const { activePage, setActivePage } = useNavStore();
  const { user, logout } = useAuthStore();
  const title = PAGE_TITLES[activePage] || 'Dashboard';
  const subtitle = PAGE_SUBTITLES[activePage] || '';

  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Production notification system (API-backed) ──
  const queryClient = useQueryClient();

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    refetchInterval: 30_000, // poll every 30s for new notifications
    enabled: !!user,
  });

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const unread = unreadData?.count ?? notifs.filter((n: Notification) => !n.read).length;

  const invalidateNotifs = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  };

  const markAsReadMut = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: invalidateNotifs,
  });

  const markAllAsReadMut = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: invalidateNotifs,
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onSuccess: invalidateNotifs,
  });

  const markAsRead = (id: string) => markAsReadMut.mutate(id);
  const markAllAsRead = () => markAllAsReadMut.mutate();
  const dismissNotif = (id: string) => dismissMut.mutate(id);

  const formatRelativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const initials = user
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '';
  const avColor = user ? avatarColor(user.id) : '#146484';
  const roleLabel = user ? (user.roleName?.toUpperCase() || user.role.replace(/_/g, ' ').toUpperCase()) : '';
  const roleFull = user ? (user.roleName || user.role.replace(/_/g, ' ')) : '';
  const firstName = user ? user.name.split(' ')[0] : '';

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        width: '100%',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        padding: '0 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
        boxSizing: 'border-box',
      }}
    >
      {/* ── Title block ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <h1
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--color-text3)', marginTop: 1, lineHeight: 1 }}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* ── Search ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          width: 280,
          borderRadius: 8,
          background: searchFocused ? 'var(--color-surface)' : 'var(--color-surface2)',
          border: searchFocused ? '1px solid var(--color-w2w)' : '1px solid var(--color-border)',
          boxShadow: searchFocused ? '0 0 0 3px rgba(20,100,132,0.1)' : 'none',
          transition: 'all 0.15s',
        }}
      >
        <Search size={13} style={{ color: 'var(--color-text3)', flexShrink: 0 }} />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search employees, sites, logs…"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            flex: 1,
            fontFamily: 'var(--font-sans)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            padding: 0,
            fontSize: 12,
            color: 'var(--color-text)',
          }}
        />
        {!searchFocused && (
          <kbd
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              padding: '2px 5px',
              borderRadius: 4,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text3)',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            ⌘K
          </kbd>
        )}
      </div>

      {/* ── Quick action: Help ── */}
      <IconButton title="Help & docs" onClick={() => setActivePage('help-docs')}>
        <HelpCircle size={15} />
      </IconButton>

      {/* ── Notifications ── */}
      <div style={{ position: 'relative' }}>
        <IconButton title="Notifications" onClick={() => setShowNotifs((s) => !s)} active={showNotifs}>
          <Bell size={15} />
          {unread > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                background: 'var(--color-red)',
                color: 'white',
                fontSize: 9,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid white',
                lineHeight: 1,
              }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </IconButton>
        {showNotifs && (
          <>
            <div onClick={() => setShowNotifs(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 360,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 101,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'var(--color-surface2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: 'var(--color-red)',
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: 10,
                    }}
                  >
                    {unread} new
                  </span>
                </div>
                <button onClick={() => setShowNotifs(false)} className="mc" style={{ width: 24, height: 24 }}>
                  <X size={12} />
                </button>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {notifs.length === 0 && (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--color-text3)', fontSize: 12 }}>
                    🎉 You're all caught up!
                  </div>
                )}
                {notifs.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      markAsRead(n.id);
                      if (n.action) setActivePage(n.action);
                      setShowNotifs(false);
                    }}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--color-surface3)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background: n.read ? 'transparent' : 'var(--color-w2w-pale)',
                      opacity: n.read ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'transparent' : 'var(--color-w2w-pale)')}
                  >
                    {/* Unread dot */}
                    <div style={{ width: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      {!n.read && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-w2w)' }} />
                      )}
                    </div>
                    <div
                      style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                        background:
                          n.type === 'ERROR' ? 'var(--color-red-light)' :
                          n.type === 'WARNING' ? 'var(--color-amber-light)' :
                          n.type === 'SUCCESS' ? 'var(--color-green-light)' :
                          'var(--color-surface3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15,
                      }}
                    >
                      {n.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: n.read ? 400 : 600, lineHeight: 1.4 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>{formatRelativeTime(n.createdAt)}</div>
                    </div>
                    {/* Dismiss button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissNotif(n.id); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-text3)', padding: 2, flexShrink: 0,
                        borderRadius: 4, display: 'flex', alignItems: 'center',
                      }}
                      title="Dismiss"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              {notifs.length > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    width: '100%',
                    padding: 10,
                    background: 'var(--color-surface2)',
                    border: 'none',
                    borderTop: '1px solid var(--color-border)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: unread > 0 ? 'var(--color-w2w)' : 'var(--color-text3)',
                    cursor: unread > 0 ? 'pointer' : 'default',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {unread > 0 ? 'Mark all as read' : 'All read ✓'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── User avatar + dropdown ── */}
      {user && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu((s) => !s)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px 4px 4px',
              borderRadius: 999,
              background: showUserMenu ? 'var(--color-w2w-pale)' : 'var(--color-surface2)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={(e) => { if (!showUserMenu) e.currentTarget.style.background = 'var(--color-surface3)'; }}
            onMouseLeave={(e) => { if (!showUserMenu) e.currentTarget.style.background = 'var(--color-surface2)'; }}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: 'white',
                background: avColor,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{firstName}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-w2w)', letterSpacing: '0.04em' }}>
                {roleLabel}
              </span>
            </div>
            <ChevronDown
              size={12}
              style={{
                color: 'var(--color-text3)',
                transform: showUserMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
              }}
            />
          </button>
          {showUserMenu && (
            <>
              <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 240,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 101,
                  overflow: 'hidden',
                }}
              >
                {/* User card */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'var(--color-surface2)',
                  }}
                >
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, color: 'white',
                      background: avColor,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.email}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--color-w2w)', fontWeight: 700, letterSpacing: '0.04em', marginTop: 2 }}>
                      {roleFull.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <MenuItem icon={<User size={13} />} onClick={() => { setShowUserMenu(false); setActivePage('profile'); }}>
                  My Profile
                </MenuItem>
                <MenuItem icon={<HelpCircle size={13} />} onClick={() => { setShowUserMenu(false); setActivePage('help-docs'); }}>
                  Help & Docs
                </MenuItem>
                <div style={{ borderTop: '1px solid var(--color-border)' }}>
                  <MenuItem
                    icon={<LogOut size={13} />}
                    danger
                    onClick={() => { setShowUserMenu(false); logout(); }}
                  >
                    Sign Out
                  </MenuItem>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// ─── Helpers ───
function IconButton({
  children,
  title,
  onClick,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        background: active ? 'var(--color-w2w-pale)' : 'var(--color-surface2)',
        border: '1px solid var(--color-border)',
        color: active ? 'var(--color-w2w)' : 'var(--color-text2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--color-surface3)';
          e.currentTarget.style.color = 'var(--color-w2w)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--color-surface2)';
          e.currentTarget.style.color = 'var(--color-text2)';
        }
      }}
    >
      {children}
    </button>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'var(--font-sans)',
        color: danger ? 'var(--color-red)' : 'var(--color-text)',
        transition: 'background 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--color-red-light)' : 'var(--color-surface2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', color: danger ? 'var(--color-red)' : 'var(--color-text3)' }}>
        {icon}
      </span>
      <span style={{ fontWeight: 500 }}>{children}</span>
    </button>
  );
}
