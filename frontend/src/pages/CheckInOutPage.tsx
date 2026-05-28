import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, attendanceApi } from '../api/endpoints';
import { useAuthStore } from '../stores/authStore';
import { LogOut } from 'lucide-react';

function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const initials = (first?: string, last?: string) =>
  ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '—';

const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtTime = (dt: string | null | undefined): string => {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '—'; }
};

const fmtDate = (dt: string | null | undefined): string => {
  if (!dt) return '—';
  try { return new Date(dt).toISOString().slice(0, 10); } catch { return '—'; }
};

// ── Styles ──
const S = {
  page: {
    position: 'fixed' as const, inset: 0, zIndex: 9999,
    background: 'linear-gradient(180deg, #0d2b3e 0%, #0a1f2e 40%, #071a27 100%)',
    color: 'white', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', background: 'rgba(0,0,0,0.25)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 16, fontWeight: 800 as const, color: 'white' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  body: {
    flex: 1, overflowY: 'auto' as const, padding: '24px 20px 100px',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
  },
  date: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  name: { fontSize: 17, fontWeight: 800 as const, color: 'white', marginBottom: 20 },
  card: {
    width: '100%', maxWidth: 440,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 20, textAlign: 'center' as const, marginBottom: 20,
  },
  statusIcon: { fontSize: 28, marginBottom: 6 },
  statusLabel: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 10 },
  timeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  timeVal: { fontSize: 18, fontWeight: 700 as const },
  timeLbl: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  msg: {
    width: '100%', maxWidth: 440, fontSize: 12,
    color: 'rgba(255,255,255,0.3)', padding: 12,
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    textAlign: 'center' as const, marginBottom: 20,
  },
  btn: (color: string) => ({
    width: '100%', maxWidth: 440, padding: 16,
    background: color, border: 'none', borderRadius: 12,
    color: 'white', fontSize: 15, fontWeight: 700 as const,
    fontFamily: 'var(--font)', cursor: 'pointer', letterSpacing: '0.02em',
    marginBottom: 20,
  }),
  historyHeader: {
    fontSize: 10, color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    marginBottom: 8, textAlign: 'left' as const, width: '100%', maxWidth: 440,
  },
  historyRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
    width: '100%', maxWidth: 440,
  },
  bottomNav: {
    position: 'fixed' as const, bottom: 0, left: 0, right: 0,
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '8px 0 env(safe-area-inset-bottom, 8px)',
  },
  navItem: (active: boolean) => ({
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    gap: 3, padding: '6px 0', cursor: 'pointer', border: 'none', background: 'none',
    color: active ? '#00c896' : 'rgba(255,255,255,0.35)',
    fontSize: 10, fontWeight: active ? 700 : 400 as const, fontFamily: 'var(--font)',
  }),
  avt: (bg: string) => ({
    width: 28, height: 28, borderRadius: '50%', background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700 as const, color: 'white',
  }),
};

// ── Tabs ──
type FoTab = 'attendance' | 'profile' | 'report' | 'sos';

export default function CheckInOutPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const today = todayISO();
  const [tab, setTab] = useState<FoTab>('attendance');

  // ── Data ──
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];

  // Try to find the current user's linked employee
  const myEmp = useMemo(() => {
    if (!user) return employees[0];
    // Match by email or employeeId
    const byEmail = employees.find((e: any) => e.email && e.email.toLowerCase() === user.email?.toLowerCase());
    if (byEmail) return byEmail;
    // If user has employeeId link
    if ((user as any).employeeId) return employees.find((e: any) => e.id === (user as any).employeeId);
    // Fallback: first active employee for demo
    return employees.find((e: any) => e.status === 'ACTIVE') || employees[0];
  }, [employees, user]);

  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance', today.slice(0, 7)],
    queryFn: () => attendanceApi.list({ month: today.slice(0, 7) }),
  });
  const records: any[] = attendanceData as any[];

  // Today's record for this employee
  const todayRec = useMemo(() => {
    if (!myEmp) return null;
    return records.find((r: any) =>
      r.employeeId === myEmp.id && new Date(r.date).toISOString().slice(0, 10) === today,
    ) || null;
  }, [records, myEmp, today]);

  const isIn = todayRec && todayRec.clockIn && !todayRec.clockOut;
  const isDone = todayRec && todayRec.clockIn && todayRec.clockOut;

  // Hours worked
  const hoursWorked = useMemo(() => {
    if (!todayRec?.clockIn || !todayRec?.clockOut) return null;
    const diff = (new Date(todayRec.clockOut).getTime() - new Date(todayRec.clockIn).getTime()) / (1000 * 60 * 60);
    return diff.toFixed(1);
  }, [todayRec]);

  // Recent history (last 7 shifts for this employee)
  const history = useMemo(() => {
    if (!myEmp) return [];
    return records
      .filter((r: any) => r.employeeId === myEmp.id)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7);
  }, [records, myEmp]);

  // ── Mutations ──
  const checkInMut = useMutation({
    mutationFn: () => {
      if (!myEmp) throw new Error('No employee');
      const now = new Date().toISOString();
      return attendanceApi.upsert({
        employeeId: myEmp.id,
        date: today,
        status: 'PRESENT',
        clockIn: now,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const checkOutMut = useMutation({
    mutationFn: () => {
      if (!myEmp || !todayRec) throw new Error('No check-in');
      const now = new Date().toISOString();
      return attendanceApi.upsert({
        employeeId: myEmp.id,
        date: today,
        status: 'PRESENT',
        clockIn: todayRec.clockIn,
        clockOut: now,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const isBusy = checkInMut.isPending || checkOutMut.isPending;
  const empName = myEmp ? `${myEmp.firstName} ${myEmp.lastName}` : user?.name || 'Employee';

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>Attendance</div>
          <div style={S.headerSub}>Waste to Work</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={S.avt(avatarColor(myEmp?.id || user?.name || ''))}>
            {initials(myEmp?.firstName || user?.name?.split(' ')[0], myEmp?.lastName || user?.name?.split(' ')[1])}
          </div>
          <button
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, padding: '6px 12px', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font)',
            }}
            onClick={() => window.location.hash = '#dashboard'}
          >
            <LogOut size={12} /> Back
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={S.body}>
        {tab === 'attendance' && (
          <>
            {/* Date + Name */}
            <div style={S.date}>{today}</div>
            <div style={S.name}>{empName}</div>

            {/* Status Card */}
            <div style={S.card}>
              {isDone ? (
                <>
                  <div style={S.statusIcon}>✅</div>
                  <div style={S.statusLabel}>Shift Complete</div>
                  <div style={S.timeGrid}>
                    <div>
                      <div style={{ ...S.timeVal, color: '#00c896' }}>{fmtTime(todayRec?.clockIn)}</div>
                      <div style={S.timeLbl}>Check-in</div>
                    </div>
                    <div>
                      <div style={{ ...S.timeVal, color: '#ef4444' }}>{fmtTime(todayRec?.clockOut)}</div>
                      <div style={S.timeLbl}>Check-out</div>
                    </div>
                    <div>
                      <div style={{ ...S.timeVal, color: 'white' }}>{hoursWorked ? hoursWorked + 'h' : '—'}</div>
                      <div style={S.timeLbl}>Hours</div>
                    </div>
                  </div>
                </>
              ) : isIn ? (
                <>
                  <div style={S.statusIcon}>🟢</div>
                  <div style={S.statusLabel}>Currently Checked In</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#00c896', marginBottom: 4 }}>
                    {fmtTime(todayRec?.clockIn)}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    Checked in at {fmtTime(todayRec?.clockIn)} · {today}
                  </div>
                </>
              ) : (
                <>
                  <div style={S.statusIcon}>⏰</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Not checked in today</div>
                </>
              )}
            </div>

            {/* Action Button */}
            {isDone ? (
              <div style={S.msg}>Shift recorded. See you tomorrow!</div>
            ) : isIn ? (
              <button
                style={S.btn('#ef4444')}
                onClick={() => checkOutMut.mutate()}
                disabled={isBusy}
              >
                {isBusy ? 'Processing…' : '⏹ Check Out'}
              </button>
            ) : (
              <button
                style={S.btn('#00c896')}
                onClick={() => checkInMut.mutate()}
                disabled={isBusy}
              >
                {isBusy ? 'Processing…' : '▶ Check In'}
              </button>
            )}

            {/* Recent Attendance */}
            {history.length > 0 && (
              <>
                <div style={S.historyHeader}>Recent Attendance</div>
                {history.map((s: any, i: number) => {
                  const inT = fmtTime(s.clockIn);
                  const outT = s.clockOut ? fmtTime(s.clockOut) : 'Active';
                  return (
                    <div key={i} style={S.historyRow}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{fmtDate(s.date)}</span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{inT} → {outT}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {tab === 'profile' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{empName}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              {myEmp?.empNo || '—'} · {myEmp?.department || '—'}
            </div>
            <div style={{ display: 'grid', gap: 10, maxWidth: 300, margin: '0 auto', textAlign: 'left' }}>
              {[
                ['Email', myEmp?.email],
                ['Phone', myEmp?.phone],
                ['Site', myEmp?.site?.name],
                ['Status', myEmp?.status],
                ['Start Date', myEmp?.startDate ? new Date(myEmp.startDate).toLocaleDateString() : '—'],
              ].map(([label, val]) => (
                <div key={label as string} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{val || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'report' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>My Report</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
              Attendance summary for the current month
            </div>
            {(() => {
              const myRecs = records.filter((r: any) => r.employeeId === myEmp?.id);
              const present = myRecs.filter((r: any) => r.status === 'PRESENT').length;
              const late = myRecs.filter((r: any) => r.status === 'LATE').length;
              const absent = myRecs.filter((r: any) => r.status === 'ABSENT').length;
              const totalHrs = myRecs.reduce((s: number, r: any) => {
                if (r.clockIn && r.clockOut) {
                  return s + (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / (1000 * 60 * 60);
                }
                return s;
              }, 0);
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 300, margin: '0 auto' }}>
                  {[
                    ['Days Present', present, '#00c896'],
                    ['Late Arrivals', late, '#d97706'],
                    ['Absences', absent, '#ef4444'],
                    ['Total Hours', totalHrs.toFixed(1) + 'h', '#146484'],
                  ].map(([label, val, color]) => (
                    <div key={label as string} style={{
                      padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, textAlign: 'center',
                      borderLeft: `3px solid ${color}`,
                    }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: color as string }}>{val}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {tab === 'sos' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🚨</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Emergency SOS</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
              In case of emergency, press the button below to notify your supervisor and emergency contacts.
            </div>
            <button style={{
              width: '100%', maxWidth: 300, padding: 18, background: '#ef4444', border: 'none',
              borderRadius: 14, color: 'white', fontSize: 16, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}>
              🚨 SEND SOS ALERT
            </button>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 16 }}>
              This will notify your site supervisor and log the alert.
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={S.bottomNav}>
        {([
          { id: 'attendance' as FoTab, icon: '🕐', label: 'Attendance' },
          { id: 'profile' as FoTab, icon: '👤', label: 'Profile' },
          { id: 'report' as FoTab, icon: '📊', label: 'My Report' },
          { id: 'sos' as FoTab, icon: '⚠️', label: 'SOS' },
        ] as const).map((item) => (
          <button key={item.id} style={S.navItem(tab === item.id)} onClick={() => setTab(item.id)}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
