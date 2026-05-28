import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, sitesApi } from '../api/endpoints';
import { useNavStore } from '../stores/navStore';
import { exportCsv } from '../utils/csv';
import type { ReportFilter } from '../components/charts/ReportFilterBar';
import { ReportFilterBar, DEFAULT_FILTER, matchesFilter } from '../components/charts/ReportFilterBar';

/* ═══════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════ */

const REGIONS = ['Region C', 'Region D', 'Region F', 'Region G'] as const;
const RACE_CATS = ['Black African', 'White', 'Coloured', 'Indian/Asian', 'Other'] as const;
const RACE_COLORS: Record<string, string> = {
  'Black African': '#146484',
  'White': '#15803d',
  'Coloured': '#d97706',
  'Indian/Asian': '#8e44ad',
  'Other': '#888',
};
const GENDER_COLORS: Record<string, string> = {
  Female: '#e91e8e',
  Male: '#146484',
  Other: '#888',
};

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function DemographicsReportPage() {
  const { setActivePage } = useNavStore();
  const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER);

  // ── Data fetching ──
  const { data: empResponse, isLoading: empLoading } = useQuery({
    queryKey: ['employees', 'demographics-report'],
    queryFn: () => employeesApi.list({ limit: '9999' }),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  });

  const employees: Record<string, unknown>[] = empResponse?.data || [];
  const activeEmployees = useMemo(
    () => employees
      .filter((e) => String(e.status || '').toUpperCase() !== 'INACTIVE')
      .filter((e) => matchesFilter(String(e.hireDate || e.startDate || ''), filter)),
    [employees, filter],
  );

  // Available years for filter
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    employees.forEach(e => {
      const y = String(e.hireDate || e.startDate || '').slice(0, 4);
      if (y && y.length === 4) yrs.add(y);
    });
    return Array.from(yrs).sort();
  }, [employees]);

  const sites: Record<string, unknown>[] = (() => {
    if (Array.isArray(sitesData)) return sitesData;
    if (sitesData && typeof sitesData === 'object' && 'data' in (sitesData as Record<string, unknown>))
      return (sitesData as Record<string, unknown>).data as Record<string, unknown>[];
    return [];
  })();

  const siteLookup = useMemo(() => {
    const m = new Map<string, Record<string, unknown>>();
    sites.forEach((s) => m.set(String(s.id), s));
    return m;
  }, [sites]);

  // ═══════════════════════════════════════════════
  //  Computed analytics
  // ═══════════════════════════════════════════════

  const analytics = useMemo(() => {
    const total = activeEmployees.length;

    // Gender counts
    let female = 0;
    let male = 0;
    let genderNotRecorded = 0;
    activeEmployees.forEach((e) => {
      const g = String(e.gender || '').toLowerCase();
      if (g === 'female' || g === 'f') female++;
      else if (g === 'male' || g === 'm') male++;
      else genderNotRecorded++;
    });

    // Race counts
    const raceCounts: Record<string, number> = {};
    RACE_CATS.forEach((r) => (raceCounts[r] = 0));
    let noRaceData = 0;
    activeEmployees.forEach((e) => {
      const race = String(e.race || e.ethnicity || '').trim();
      if (!race) { noRaceData++; return; }
      const matched = RACE_CATS.find((r) => r.toLowerCase() === race.toLowerCase());
      if (matched) raceCounts[matched]++;
      else raceCounts['Other']++;
    });

    // Region breakdown
    const regionData = REGIONS.map((region) => {
      const regionSiteIds = sites
        .filter((s) => String(s.region || '').toLowerCase() === region.toLowerCase())
        .map((s) => String(s.id));
      const regionEmps = activeEmployees.filter((e) =>
        regionSiteIds.includes(String(e.siteId || '')),
      );
      let rMale = 0;
      let rFemale = 0;
      const rRace: Record<string, number> = {};
      RACE_CATS.forEach((r) => (rRace[r] = 0));
      let rNoRace = 0;

      regionEmps.forEach((e) => {
        const g = String(e.gender || '').toLowerCase();
        if (g === 'female' || g === 'f') rFemale++;
        else if (g === 'male' || g === 'm') rMale++;

        const race = String(e.race || e.ethnicity || '').trim();
        if (!race) { rNoRace++; return; }
        const matched = RACE_CATS.find((r) => r.toLowerCase() === race.toLowerCase());
        if (matched) rRace[matched]++;
        else rRace['Other']++;
      });

      return {
        region,
        total: regionEmps.length,
        male: rMale,
        female: rFemale,
        race: rRace,
        noRaceData: rNoRace,
      };
    });

    return {
      total,
      female,
      male,
      genderNotRecorded,
      raceCounts,
      noRaceData,
      regionData,
      uniqueRegions: REGIONS.length,
      siteCount: sites.length,
    };
  }, [activeEmployees, sites]);

  // ── Gender donut ──
  const genderDonut = useMemo(() => {
    if (analytics.total === 0) return 'conic-gradient(var(--color-surface3) 0deg 360deg)';
    const segments: string[] = [];
    let cumDeg = 0;
    [
      { val: analytics.female, color: GENDER_COLORS.Female },
      { val: analytics.male, color: GENDER_COLORS.Male },
      { val: analytics.genderNotRecorded, color: GENDER_COLORS.Other },
    ].forEach((s) => {
      if (s.val === 0) return;
      const deg = (s.val / analytics.total) * 360;
      segments.push(`${s.color} ${cumDeg}deg ${cumDeg + deg}deg`);
      cumDeg += deg;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }, [analytics]);

  // ── Race donut ──
  const raceDonut = useMemo(() => {
    const raceTotal = Object.values(analytics.raceCounts).reduce((a, b) => a + b, 0) + analytics.noRaceData;
    if (raceTotal === 0) return 'conic-gradient(var(--color-surface3) 0deg 360deg)';
    const segments: string[] = [];
    let cumDeg = 0;
    RACE_CATS.forEach((r) => {
      const val = analytics.raceCounts[r] || 0;
      if (val === 0) return;
      const deg = (val / raceTotal) * 360;
      segments.push(`${RACE_COLORS[r]} ${cumDeg}deg ${cumDeg + deg}deg`);
      cumDeg += deg;
    });
    if (analytics.noRaceData > 0) {
      const deg = (analytics.noRaceData / raceTotal) * 360;
      segments.push(`#ccc ${cumDeg}deg ${cumDeg + deg}deg`);
    }
    return `conic-gradient(${segments.join(', ')})`;
  }, [analytics]);

  // ── Excel export ──
  const handleExport = () => {
    const rows = analytics.regionData.map((r) => ({
      region: r.region,
      total: r.total,
      male: r.male,
      female: r.female,
      ...r.race,
      noRaceData: r.noRaceData,
    }));
    exportCsv('demographics-report', rows as unknown as Record<string, unknown>[], [
      { key: 'region', label: 'Region' },
      { key: 'total', label: 'Total' },
      { key: 'male', label: 'Male' },
      { key: 'female', label: 'Female' },
      ...RACE_CATS.map((r) => ({ key: r, label: r })),
      { key: 'noRaceData', label: 'No Race Data' },
    ]);
  };

  // Bar chart max
  const maxRegionTotal = Math.max(...analytics.regionData.map((r) => r.total), 1);
  const maxRaceVal = Math.max(...Object.values(analytics.raceCounts), 1);

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
            👥 Demographic Report
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text3)', marginTop: 3 }}>
            Employment equity · Gender &amp; race composition · W2W Workforce · {fmtDate(new Date())}
          </div>
        </div>
        <div style={{
          textAlign: 'right', fontSize: 11, color: 'var(--color-text3)', lineHeight: 1.7,
        }}>
          <div><b style={{ color: 'var(--color-text2)' }}>Total Active:</b> {analytics.total}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Planning Regions:</b> {analytics.uniqueRegions}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Sites:</b> {analytics.siteCount}</div>
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
          Loading demographic data…
        </div>
      )}

      {!empLoading && (
        <>
          {/* ═══ KPI Row (4 cards) ═══ */}
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <div className="stat-card card" style={{ borderBottom: '3px solid #146484' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Total Active Staff</div>
                <span style={{ fontSize: 18 }}>👥</span>
              </div>
              <div className="stat-val" style={{ color: '#146484' }}>{analytics.total}</div>
              <div className="stat-sub">Across all regions & sites</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #e91e8e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Female</div>
                <span style={{ fontSize: 18 }}>♀</span>
              </div>
              <div className="stat-val" style={{ color: '#e91e8e' }}>
                {analytics.female}
              </div>
              <div className="stat-sub">{analytics.total > 0 ? Math.round((analytics.female / analytics.total) * 100) : 0}% of workforce</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #146484' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Male</div>
                <span style={{ fontSize: 18 }}>♂</span>
              </div>
              <div className="stat-val" style={{ color: '#146484' }}>
                {analytics.male}
              </div>
              <div className="stat-sub">{analytics.total > 0 ? Math.round((analytics.male / analytics.total) * 100) : 0}% of workforce</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #888' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Not Recorded</div>
                <span style={{ fontSize: 18 }}>❓</span>
              </div>
              <div className="stat-val" style={{ color: '#888' }}>
                {analytics.genderNotRecorded}
              </div>
              <div className="stat-sub">Gender data missing</div>
            </div>
          </div>

          {/* ═══ Charts Row 1 — Gender Donut + Race Donut ═══ */}
          <div className="g2 mb14">
            {/* Gender Distribution */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Gender Distribution</div>
                  <div className="cs">Active workforce by gender</div>
                </div>
              </div>
              <div className="cb">
                {analytics.total === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No data available
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{
                      width: 160, height: 160, borderRadius: '50%',
                      background: genderDonut,
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
                          {analytics.total}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>staff</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                      {[
                        { label: 'Female', val: analytics.female, color: GENDER_COLORS.Female },
                        { label: 'Male', val: analytics.male, color: GENDER_COLORS.Male },
                        { label: 'Not Recorded', val: analytics.genderNotRecorded, color: GENDER_COLORS.Other },
                      ].filter((s) => s.val > 0).map((s) => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                          <div style={{ fontSize: 11, flex: 1 }}>{s.label}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)' }}>
                            {s.val} ({analytics.total > 0 ? Math.round((s.val / analytics.total) * 100) : 0}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Race Distribution Donut */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Race / Population Group</div>
                  <div className="cs">Workforce by population group</div>
                </div>
              </div>
              <div className="cb">
                {analytics.total === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No data available
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{
                      width: 160, height: 160, borderRadius: '50%',
                      background: raceDonut,
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
                          {analytics.total}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>staff</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      {RACE_CATS.map((r) => {
                        const val = analytics.raceCounts[r] || 0;
                        if (val === 0) return null;
                        return (
                          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 2, background: RACE_COLORS[r], flexShrink: 0 }} />
                            <div style={{ fontSize: 11, flex: 1 }}>{r}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)' }}>
                              {val} ({analytics.total > 0 ? Math.round((val / analytics.total) * 100) : 0}%)
                            </div>
                          </div>
                        );
                      })}
                      {analytics.noRaceData > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#ccc', flexShrink: 0 }} />
                          <div style={{ fontSize: 11, flex: 1 }}>No Data</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)' }}>
                            {analytics.noRaceData}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Charts Row 2 — Gender by Region + Race Bars ═══ */}
          <div className="g2 mb14">
            {/* Gender by Region (stacked bars) */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Gender by Region</div>
                  <div className="cs">Male vs Female per planning region</div>
                </div>
              </div>
              <div className="cb">
                <div style={{
                  display: 'flex', alignItems: 'flex-end', gap: 12,
                  height: 160, padding: '0 4px',
                }}>
                  {analytics.regionData.map((r) => {
                    const maleH = maxRegionTotal > 0 ? Math.max((r.male / maxRegionTotal) * 100, 2) : 2;
                    const femaleH = maxRegionTotal > 0 ? Math.max((r.female / maxRegionTotal) * 100, 2) : 2;
                    return (
                      <div key={r.region} style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', gap: 2, minWidth: 0,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text2)', fontFamily: 'var(--font-mono)' }}>
                          {r.total}
                        </div>
                        <div style={{ width: '100%', maxWidth: 40, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <div style={{
                            width: '100%', height: `${femaleH}%`, minHeight: r.female > 0 ? 6 : 0,
                            background: GENDER_COLORS.Female, borderRadius: '4px 4px 0 0',
                            transition: 'height 0.4s ease',
                          }} />
                          <div style={{
                            width: '100%', height: `${maleH}%`, minHeight: r.male > 0 ? 6 : 0,
                            background: GENDER_COLORS.Male, borderRadius: '0 0 4px 4px',
                            transition: 'height 0.4s ease',
                          }} />
                        </div>
                        <div style={{
                          fontSize: 9, color: 'var(--color-text3)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          maxWidth: '100%', textAlign: 'center',
                        }}>
                          {r.region}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
                  {[{ label: 'Female', color: GENDER_COLORS.Female }, { label: 'Male', color: GENDER_COLORS.Male }].map((l) => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                      <span style={{ fontSize: 10, color: 'var(--color-text3)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Race Distribution (horizontal bars) */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Race Distribution</div>
                  <div className="cs">Population group breakdown</div>
                </div>
              </div>
              <div className="cb">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {RACE_CATS.map((r) => {
                    const val = analytics.raceCounts[r] || 0;
                    const pct = Math.max((val / maxRaceVal) * 100, 2);
                    return (
                      <div key={r}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{r}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-text2)', fontFamily: 'var(--font-mono)' }}>
                            {val}
                          </span>
                        </div>
                        <div style={{
                          height: 14, background: 'var(--color-surface3)',
                          borderRadius: 4, overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: RACE_COLORS[r], borderRadius: 4,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Full Breakdown by Region Table ═══ */}
          <div className="card">
            <div className="ch">
              <div>
                <div className="ct">Full Breakdown by Region</div>
                <div className="cs">Gender and race composition per planning region</div>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Region</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Male</th>
                    <th style={{ textAlign: 'right' }}>Female</th>
                    {RACE_CATS.map((r) => (
                      <th key={r} style={{ textAlign: 'right' }}>{r}</th>
                    ))}
                    <th style={{ textAlign: 'right' }}>No Race Data</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.regionData.map((r) => (
                    <tr key={r.region}>
                      <td><span style={{ fontWeight: 600 }}>{r.region}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{r.total}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.male}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.female}</td>
                      {RACE_CATS.map((cat) => (
                        <td key={cat} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {r.race[cat] || 0}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text3)' }}>
                        {r.noRaceData}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr style={{ background: '#146484', color: 'white', fontWeight: 700 }}>
                    <td style={{ color: 'white' }}><span style={{ fontWeight: 800 }}>TOTAL</span></td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white' }}>{analytics.total}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white' }}>{analytics.male}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white' }}>{analytics.female}</td>
                    {RACE_CATS.map((cat) => (
                      <td key={cat} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white' }}>
                        {analytics.raceCounts[cat] || 0}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>
                      {analytics.noRaceData}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
