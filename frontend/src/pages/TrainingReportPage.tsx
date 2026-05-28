import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, trainingApi, sitesApi } from '../api/endpoints';
import { useNavStore } from '../stores/navStore';
import { exportCsv } from '../utils/csv';
import type { ReportFilter } from '../components/charts/ReportFilterBar';
import { ReportFilterBar, DEFAULT_FILTER, matchesFilter } from '../components/charts/ReportFilterBar';

/* ═══════════════════════════════════════════════════════
   Mandatory Training Modules
   ═══════════════════════════════════════════════════════ */

const MANDATORY_TRAININGS = [
  'Health & Safety Induction',
  'Fire Safety',
  'Waste Sorting & Classification',
  'PPE Usage & Care',
  'Chemical Handling (if applicable)',
  'Environmental Awareness',
  'First Aid Level 1',
  'COVID-19 Protocols',
  'Manual Handling',
  'Incident Reporting',
] as const;

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

const statusBadge = (rate: number) => {
  if (rate >= 80) return { label: 'On Track', bg: '#dcfce7', color: '#15803d' };
  if (rate >= 50) return { label: 'Needs Attention', bg: '#fef3c7', color: '#d97706' };
  return { label: 'Critical', bg: '#fee2e2', color: '#dc2626' };
};

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function TrainingReportPage() {
  const { setActivePage } = useNavStore();
  const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER);

  // ── Data fetching ──
  const { data: empResponse, isLoading: empLoading } = useQuery({
    queryKey: ['employees', 'training-report'],
    queryFn: () => employeesApi.list({ limit: '9999' }),
  });
  const { data: recordsData } = useQuery({
    queryKey: ['training-records'],
    queryFn: trainingApi.listRecords,
  });
  const { data: modulesData } = useQuery({
    queryKey: ['training-modules'],
    queryFn: trainingApi.listModules,
  });
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  });

  const employees: Record<string, unknown>[] = empResponse?.data || [];
  const activeEmployees = useMemo(
    () => employees.filter((e) => String(e.status || '').toUpperCase() !== 'INACTIVE'),
    [employees],
  );
  const allRecords: Record<string, unknown>[] = Array.isArray(recordsData) ? recordsData : [];
  const records = useMemo(() => allRecords.filter(r => matchesFilter(String(r.completedDate || r.date || ''), filter)), [allRecords, filter]);
  const modules: Record<string, unknown>[] = Array.isArray(modulesData) ? modulesData : [];

  // Available years for filter
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    allRecords.forEach(r => {
      const y = String(r.completedDate || r.date || '').slice(0, 4);
      if (y && y.length === 4) yrs.add(y);
    });
    return Array.from(yrs).sort();
  }, [allRecords]);
  const sites: Record<string, unknown>[] = (() => {
    if (Array.isArray(sitesData)) return sitesData;
    if (sitesData && typeof sitesData === 'object' && 'data' in (sitesData as Record<string, unknown>))
      return (sitesData as Record<string, unknown>).data as Record<string, unknown>[];
    return [];
  })();

  const siteLookup = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s) => m.set(String(s.id), String(s.name || 'Unknown')));
    return m;
  }, [sites]);

  // ── Map module IDs to names ──
  const moduleLookup = useMemo(() => {
    const m = new Map<string, string>();
    modules.forEach((mod) => m.set(String(mod.id), String(mod.name || '')));
    return m;
  }, [modules]);

  // ═══════════════════════════════════════════════
  //  Computed analytics
  // ═══════════════════════════════════════════════

  const analytics = useMemo(() => {
    const totalStaff = activeEmployees.length;
    const totalModules = MANDATORY_TRAININGS.length;

    // Build a map: empId -> Set of completed module names
    const empCompleted = new Map<string, Set<string>>();
    activeEmployees.forEach((e) => empCompleted.set(String(e.id), new Set()));

    records.forEach((r) => {
      const empId = String(r.employeeId || '');
      const status = String(r.status || '').toUpperCase();
      if (status !== 'COMPLETED') return;
      const modId = String(r.trainingModuleId || '');
      const modName = moduleLookup.get(modId) || '';
      if (empCompleted.has(empId)) {
        empCompleted.get(empId)!.add(modName);
      }
    });

    // Per-employee compliance
    let fullyCompliant = 0;
    let inProgress = 0;
    let notStarted = 0;

    empCompleted.forEach((completedSet) => {
      const count = MANDATORY_TRAININGS.filter((t) => completedSet.has(t)).length;
      if (count >= totalModules) fullyCompliant++;
      else if (count > 0) inProgress++;
      else notStarted++;
    });

    const complianceRate = totalStaff > 0 ? Math.round((fullyCompliant / totalStaff) * 100) : 0;

    // Per-module compliance
    const moduleStats = MANDATORY_TRAININGS.map((modName) => {
      let completed = 0;
      empCompleted.forEach((set) => {
        if (set.has(modName)) completed++;
      });
      const rate = totalStaff > 0 ? Math.round((completed / totalStaff) * 100) : 0;
      return { name: modName, completed, total: totalStaff, rate };
    });

    // Per-site compliance
    const siteStaffMap = new Map<string, string[]>();
    activeEmployees.forEach((e) => {
      const sId = String(e.siteId || '');
      if (!sId) return;
      if (!siteStaffMap.has(sId)) siteStaffMap.set(sId, []);
      siteStaffMap.get(sId)!.push(String(e.id));
    });

    const siteStats = Array.from(siteStaffMap.entries()).map(([siteId, empIds]) => {
      const siteStaffCount = empIds.length;
      let compliantCount = 0;
      empIds.forEach((eId) => {
        const set = empCompleted.get(eId);
        if (set) {
          const count = MANDATORY_TRAININGS.filter((t) => set.has(t)).length;
          if (count >= totalModules) compliantCount++;
        }
      });
      const rate = siteStaffCount > 0 ? Math.round((compliantCount / siteStaffCount) * 100) : 0;
      return { siteId, name: siteLookup.get(siteId) || siteId, staff: siteStaffCount, compliant: compliantCount, rate };
    }).sort((a, b) => b.rate - a.rate);

    return {
      totalStaff,
      totalModules,
      fullyCompliant,
      inProgress,
      notStarted,
      complianceRate,
      moduleStats,
      siteStats,
    };
  }, [activeEmployees, records, moduleLookup, siteLookup]);

  // ── Donut chart ──
  const donutGradient = useMemo(() => {
    const total = analytics.totalStaff;
    if (total === 0) return 'conic-gradient(var(--color-surface3) 0deg 360deg)';
    const segments: string[] = [];
    let cumDeg = 0;
    const slices = [
      { val: analytics.fullyCompliant, color: '#15803d' },
      { val: analytics.inProgress, color: '#d97706' },
      { val: analytics.notStarted, color: '#dc2626' },
    ];
    slices.forEach((s) => {
      const deg = (s.val / total) * 360;
      segments.push(`${s.color} ${cumDeg}deg ${cumDeg + deg}deg`);
      cumDeg += deg;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }, [analytics]);

  // ── Excel export ──
  const handleExport = () => {
    exportCsv('training-compliance', analytics.moduleStats as unknown as Record<string, unknown>[], [
      { key: 'name', label: 'Module' },
      { key: 'completed', label: 'Completed' },
      { key: 'total', label: 'Total Staff' },
      { key: 'rate', label: 'Rate %' },
    ]);
  };

  const maxModuleCompleted = Math.max(...analytics.moduleStats.map((m) => m.completed), 1);

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
            🎓 Training Compliance Report
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text3)', marginTop: 3 }}>
            Mandatory training completion · {MANDATORY_TRAININGS.length} required modules · W2W Pilot
          </div>
        </div>
        <div style={{
          textAlign: 'right', fontSize: 11, color: 'var(--color-text3)', lineHeight: 1.7,
        }}>
          <div><b style={{ color: 'var(--color-text2)' }}>Generated:</b> {fmtDate(new Date())}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Active Staff:</b> {analytics.totalStaff}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Modules:</b> {analytics.totalModules}</div>
        </div>
      </div>

      {/* ═══ Action Buttons ═══ */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => setActivePage('reports')}>
          ← Back to Reports
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
      {empLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text3)' }}>
          Loading training data…
        </div>
      )}

      {!empLoading && (
        <>
          {/* ═══ KPI Row (4 cards) ═══ */}
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            {/* Fully Compliant */}
            <div className="stat-card card" style={{ borderBottom: '3px solid #15803d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Fully Compliant</div>
                <span style={{ fontSize: 18 }}>✅</span>
              </div>
              <div className="stat-val" style={{ color: '#15803d' }}>
                {analytics.fullyCompliant}/{analytics.totalStaff}
              </div>
              <div className="stat-sub">All {analytics.totalModules} modules completed</div>
            </div>

            {/* Compliance Rate */}
            <div className="stat-card card" style={{ borderBottom: `3px solid ${analytics.complianceRate >= 80 ? '#15803d' : analytics.complianceRate >= 50 ? '#d97706' : '#dc2626'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Compliance Rate</div>
                <span style={{ fontSize: 18 }}>📊</span>
              </div>
              <div className="stat-val" style={{ color: analytics.complianceRate >= 80 ? '#15803d' : analytics.complianceRate >= 50 ? '#d97706' : '#dc2626' }}>
                {analytics.complianceRate}%
              </div>
              <div className="stat-sub">Overall programme target: 100%</div>
            </div>

            {/* In Progress */}
            <div className="stat-card card" style={{ borderBottom: '3px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">In Progress</div>
                <span style={{ fontSize: 18 }}>🔄</span>
              </div>
              <div className="stat-val" style={{ color: '#d97706' }}>
                {analytics.inProgress}
              </div>
              <div className="stat-sub">Partial completion</div>
            </div>

            {/* Not Started */}
            <div className="stat-card card" style={{ borderBottom: '3px solid #dc2626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Not Started</div>
                <span style={{ fontSize: 18 }}>⚠️</span>
              </div>
              <div className="stat-val" style={{ color: '#dc2626' }}>
                {analytics.notStarted}
              </div>
              <div className="stat-sub">No modules completed</div>
            </div>
          </div>

          {/* ═══ Charts Row — Donut + Per-Module Bars ═══ */}
          <div className="g2 mb14">
            {/* Donut Chart: Compliance Overview */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Compliance Overview</div>
                  <div className="cs">Staff by compliance status</div>
                </div>
              </div>
              <div className="cb">
                {analytics.totalStaff === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No employee data available
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    {/* Donut */}
                    <div style={{
                      width: 160, height: 160, borderRadius: '50%',
                      background: donutGradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        width: 90, height: 90, borderRadius: '50%',
                        background: 'var(--color-surface)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
                          {analytics.complianceRate}%
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>compliant</div>
                      </div>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {[
                        { label: 'Fully Compliant', val: analytics.fullyCompliant, color: '#15803d' },
                        { label: 'Partial / In Progress', val: analytics.inProgress, color: '#d97706' },
                        { label: 'Not Started', val: analytics.notStarted, color: '#dc2626' },
                      ].map((s) => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                          <div style={{ fontSize: 11, flex: 1 }}>{s.label}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)' }}>{s.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal Bar: Completion per Module */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Completion per Module</div>
                  <div className="cs">Staff who completed each module</div>
                </div>
              </div>
              <div className="cb">
                {analytics.totalStaff === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No data available
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analytics.moduleStats.map((m) => {
                      const pct = Math.max((m.completed / maxModuleCompleted) * 100, 2);
                      const badge = statusBadge(m.rate);
                      return (
                        <div key={m.name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
                              {m.name}
                            </span>
                            <span style={{ fontSize: 10, color: badge.color, fontWeight: 600 }}>
                              {m.completed}/{m.total} ({m.rate}%)
                            </span>
                          </div>
                          <div style={{
                            height: 12, background: 'var(--color-surface3)',
                            borderRadius: 4, overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: badge.color === '#15803d' ? '#15803d' : badge.color === '#d97706' ? '#d97706' : '#dc2626',
                              borderRadius: 4,
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

          {/* ═══ Module Compliance Rates Table ═══ */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div>
                <div className="ct">Module Compliance Rates</div>
                <div className="cs">Status of each mandatory training module</div>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Completed</th>
                    <th style={{ textAlign: 'right' }}>Rate %</th>
                    <th>Progress</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.moduleStats.map((m) => {
                    const badge = statusBadge(m.rate);
                    return (
                      <tr key={m.name}>
                        <td><span style={{ fontWeight: 600 }}>{m.name}</span></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{m.completed}/{m.total}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {m.rate}%
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                            <div className="pb" style={{ flex: 1, height: 6 }}>
                              <div className="pf" style={{
                                width: `${m.rate}%`, background: badge.color, height: '100%',
                              }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                            fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color,
                          }}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ Compliance by Site Table ═══ */}
          <div className="card">
            <div className="ch">
              <div>
                <div className="ct">Compliance by Site</div>
                <div className="cs">Full compliance rate per operational site</div>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th style={{ textAlign: 'right' }}>Staff</th>
                    <th style={{ textAlign: 'right' }}>Compliant</th>
                    <th style={{ textAlign: 'right' }}>Rate %</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.siteStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text3)' }}>
                        No site data available
                      </td>
                    </tr>
                  ) : (
                    analytics.siteStats.map((s) => {
                      const badge = statusBadge(s.rate);
                      return (
                        <tr key={s.siteId}>
                          <td><span style={{ fontWeight: 600 }}>{s.name}</span></td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{s.staff}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{s.compliant}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {s.rate}%
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                              <div className="pb" style={{ flex: 1, height: 6 }}>
                                <div className="pf" style={{
                                  width: `${s.rate}%`, background: badge.color, height: '100%',
                                }} />
                              </div>
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                                fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color,
                              }}>
                                {badge.label}
                              </span>
                            </div>
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
