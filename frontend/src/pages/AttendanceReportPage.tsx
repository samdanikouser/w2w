import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, employeesApi, sitesApi } from '../api/endpoints';
import { useNavStore } from '../stores/navStore';
import { exportCsv } from '../utils/csv';
import SvgLineChart from '../components/charts/SvgLineChart';
import type { ReportFilter } from '../components/charts/ReportFilterBar';
import { ReportFilterBar, DEFAULT_FILTER, matchesFilter } from '../components/charts/ReportFilterBar';

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (t: string | null | undefined) => {
  if (!t) return '—';
  // If it's already formatted (HH:mm), return as-is
  if (/^\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
  // Try parsing as date string
  const d = new Date(t);
  if (isNaN(d.getTime())) return t;
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
};

const statusColor = (status: string) => {
  switch (status.toUpperCase()) {
    case 'PRESENT': return { bg: '#dcfce7', color: '#15803d' };
    case 'LATE': return { bg: '#fef3c7', color: '#d97706' };
    case 'ABSENT': return { bg: '#fee2e2', color: '#dc2626' };
    case 'HALF_DAY': return { bg: '#e0e7ff', color: '#4f46e5' };
    case 'LEAVE': return { bg: '#f3e8ff', color: '#7c3aed' };
    default: return { bg: '#f3f4f6', color: '#6b7280' };
  }
};

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function AttendanceReportPage() {
  const { setActivePage } = useNavStore();
  const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER);

  // ── Data fetching ──
  const { data: attendanceData, isLoading: attLoading } = useQuery({
    queryKey: ['attendance', 'report'],
    queryFn: () => attendanceApi.list({ limit: '9999' } as Record<string, string>),
  });
  const { data: empResponse } = useQuery({
    queryKey: ['employees', 'attendance-report'],
    queryFn: () => employeesApi.list({ limit: '9999' }),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  });

  const allAttendance: Record<string, unknown>[] = Array.isArray(attendanceData) ? attendanceData : [];
  const attendance = useMemo(() => allAttendance.filter(a => matchesFilter(String(a.date || '').slice(0, 10), filter)), [allAttendance, filter]);

  // Available years for filter
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    allAttendance.forEach(a => {
      const y = String(a.date || '').slice(0, 4);
      if (y && y.length === 4) yrs.add(y);
    });
    return Array.from(yrs).sort();
  }, [allAttendance]);
  const employees: Record<string, unknown>[] = empResponse?.data || [];
  const activeEmployees = useMemo(
    () => employees.filter((e) => String(e.status || '').toUpperCase() !== 'INACTIVE'),
    [employees],
  );

  const sites: Record<string, unknown>[] = (() => {
    if (Array.isArray(sitesData)) return sitesData;
    if (sitesData && typeof sitesData === 'object' && 'data' in (sitesData as Record<string, unknown>))
      return (sitesData as Record<string, unknown>).data as Record<string, unknown>[];
    return [];
  })();

  const empLookup = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    employees.forEach((e) => m.set(String(e.id), e));
    return m;
  }, [employees]);

  const siteLookup = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s) => m.set(String(s.id), String(s.name || 'Unknown')));
    return m;
  }, [sites]);

  // ═══════════════════════════════════════════════
  //  Computed analytics
  // ═══════════════════════════════════════════════

  const analytics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    // Today's present count
    const todayRecords = attendance.filter((a) => String(a.date || '').slice(0, 10) === today);
    const todayPresent = todayRecords.filter((a) => {
      const s = String(a.status || '').toUpperCase();
      return s === 'PRESENT' || s === 'LATE' || s === 'HALF_DAY';
    }).length;

    // This month shifts
    const monthRecords = attendance.filter((a) => {
      const d = String(a.date || '').slice(0, 10);
      return d >= monthStart && d <= today;
    });
    const monthShifts = monthRecords.length;

    // Average hours per shift
    let totalHours = 0;
    let hoursCount = 0;
    attendance.forEach((a) => {
      const hrs = Number(a.hoursWorked || 0);
      if (hrs > 0) { totalHours += hrs; hoursCount++; }
    });
    const avgHours = hoursCount > 0 ? (totalHours / hoursCount).toFixed(1) : '0.0';

    // Total records
    const totalRecords = attendance.length;

    // Daily attendance trend (last 14 days)
    const days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const count = attendance.filter((a) => {
        const ad = String(a.date || '').slice(0, 10);
        const s = String(a.status || '').toUpperCase();
        return ad === ds && (s === 'PRESENT' || s === 'LATE' || s === 'HALF_DAY');
      }).length;
      days.push({ date: ds, count });
    }

    // Shifts this month by site
    const siteShifts = new Map<string, number>();
    monthRecords.forEach((a) => {
      const emp = empLookup.get(String(a.employeeId || ''));
      const siteId = emp ? String(emp.siteId || '') : '';
      if (siteId) siteShifts.set(siteId, (siteShifts.get(siteId) || 0) + 1);
    });
    const siteShiftEntries = Array.from(siteShifts.entries())
      .map(([id, count]) => ({ id, name: siteLookup.get(id) || id, count }))
      .sort((a, b) => b.count - a.count);

    // Recent records (last 50)
    const recentRecords = [...attendance]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 50)
      .map((a) => {
        const emp = empLookup.get(String(a.employeeId || ''));
        const empName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : String(a.employeeId || '');
        const siteId = emp ? String(emp.siteId || '') : '';
        const siteName = siteLookup.get(siteId) || '—';
        return {
          date: String(a.date || '').slice(0, 10),
          employee: empName,
          site: siteName,
          clockIn: String(a.clockIn || ''),
          clockOut: String(a.clockOut || ''),
          hours: Number(a.hoursWorked || 0),
          status: String(a.status || 'PRESENT'),
        };
      });

    return {
      todayPresent,
      monthShifts,
      avgHours,
      totalRecords,
      days,
      siteShiftEntries,
      recentRecords,
      activeCount: activeEmployees.length,
      siteCount: sites.length,
    };
  }, [attendance, empLookup, siteLookup, activeEmployees, sites]);

  // ── Excel export ──
  const handleExport = () => {
    exportCsv('attendance-report', analytics.recentRecords as unknown as Record<string, unknown>[], [
      { key: 'date', label: 'Date' },
      { key: 'employee', label: 'Employee' },
      { key: 'site', label: 'Site' },
      { key: 'clockIn', label: 'Check-In' },
      { key: 'clockOut', label: 'Check-Out' },
      { key: 'hours', label: 'Hours' },
      { key: 'status', label: 'Status' },
    ]);
  };

  const maxSiteShifts = analytics.siteShiftEntries[0]?.count || 1;

  // ── Line chart data ──
  const trendData = analytics.days.map(d => {
    const dd = new Date(d.date + 'T00:00:00');
    return {
      label: dd.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }).replace(' ', '/'),
      value: d.count,
    };
  });

  // ═══════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════

  return (
    <div className="report-page" style={{ maxWidth: 1200 }}>
      {/* ═══ Report Header ═══ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 20, gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.025em' }}>
            ⏰ Attendance Report
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text3)', marginTop: 3 }}>
            Check-in/check-out analysis · W2W Field Workers · {fmtDate(new Date())}
          </div>
        </div>
        <div style={{
          textAlign: 'right', fontSize: 11, color: 'var(--color-text3)', lineHeight: 1.7,
        }}>
          <div><b style={{ color: 'var(--color-text2)' }}>Sites:</b> {analytics.siteCount}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Active Employees:</b> {analytics.activeCount}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Generated:</b> {fmtDate(new Date())}</div>
        </div>
      </div>

      {/* ═══ Action Buttons ═══ */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => setActivePage('reports')}>
          ← Back to Reports
        </button>
        <button className="btn btn-ghost" onClick={() => setActivePage('attendance')}>
          📋 Detailed Filter View
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Print / PDF
        </button>
        <button className="btn btn-ghost" onClick={handleExport}>
          📥 Excel
        </button>
      </div>

      <ReportFilterBar filter={filter} onChange={setFilter} years={availableYears} />

      {/* ═══ Loading state ═══ */}
      {attLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text3)' }}>
          Loading attendance data…
        </div>
      )}

      {!attLoading && (
        <>
          {/* ═══ KPI Row (4 cards) ═══ */}
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <div className="stat-card card" style={{ borderBottom: '3px solid #15803d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Today Present</div>
                <span style={{ fontSize: 18 }}>✅</span>
              </div>
              <div className="stat-val" style={{ color: '#15803d' }}>{analytics.todayPresent}</div>
              <div className="stat-sub">Checked in today</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #146484' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">This Month Shifts</div>
                <span style={{ fontSize: 18 }}>📅</span>
              </div>
              <div className="stat-val" style={{ color: '#146484' }}>{analytics.monthShifts}</div>
              <div className="stat-sub">Current month total</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Avg Hours/Shift</div>
                <span style={{ fontSize: 18 }}>⏱</span>
              </div>
              <div className="stat-val" style={{ color: '#d97706' }}>{analytics.avgHours}h</div>
              <div className="stat-sub">Average hours worked</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #7c3aed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Total Records</div>
                <span style={{ fontSize: 18 }}>📊</span>
              </div>
              <div className="stat-val" style={{ color: '#7c3aed' }}>{analytics.totalRecords}</div>
              <div className="stat-sub">All attendance entries</div>
            </div>
          </div>

          {/* ═══ Charts Row — Daily Trend + Site Shifts ═══ */}
          <div className="g2 mb14">
            {/* Daily Attendance Trend */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Daily Attendance Trend</div>
                  <div className="cs">Present count · last 14 days</div>
                </div>
              </div>
              <div className="cb">
                <SvgLineChart data={trendData} color="#146484" />
              </div>
            </div>

            {/* Shifts This Month by Site */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Shifts This Month by Site</div>
                  <div className="cs">Ranked by total shifts</div>
                </div>
              </div>
              <div className="cb">
                {analytics.siteShiftEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No site shift data available
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analytics.siteShiftEntries.slice(0, 10).map((s, idx) => {
                      const pct = Math.max((s.count / maxSiteShifts) * 100, 3);
                      const barColors = [
                        '#146484', '#2980b9', '#27ae60', '#e67e22', '#8e44ad',
                        '#e74c3c', '#16a085', '#d4ac0d', '#922b21', '#5d6d7e',
                      ];
                      return (
                        <div key={s.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                              {s.name}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--color-text2)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                              {s.count} shifts
                            </span>
                          </div>
                          <div style={{
                            height: 14, background: 'var(--color-surface3)',
                            borderRadius: 4, overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: barColors[idx % barColors.length], borderRadius: 4,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Recent Attendance Records Table ═══ */}
          <div className="card">
            <div className="ch">
              <div>
                <div className="ct">Recent Attendance Records</div>
                <div className="cs">Latest 50 entries · sorted by date</div>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Site</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th style={{ textAlign: 'right' }}>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text3)' }}>
                        No attendance records found
                      </td>
                    </tr>
                  ) : (
                    analytics.recentRecords.map((r, i) => {
                      const badge = statusColor(r.status);
                      return (
                        <tr key={i}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.date}</td>
                          <td><span style={{ fontWeight: 600 }}>{r.employee}</span></td>
                          <td>{r.site}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{fmtTime(r.clockIn)}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{fmtTime(r.clockOut)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {r.hours > 0 ? r.hours.toFixed(1) : '—'}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                              fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color,
                            }}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
