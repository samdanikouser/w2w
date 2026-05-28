import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wasteLogsApi, sitesApi } from '../api/endpoints';
import { useNavStore } from '../stores/navStore';
import { exportCsv } from '../utils/csv';
import SvgLineChart from '../components/charts/SvgLineChart';
import type { ReportFilter } from '../components/charts/ReportFilterBar';
import { ReportFilterBar, DEFAULT_FILTER, matchesFilter } from '../components/charts/ReportFilterBar';

/* ═══════════════════════════════════════════════════════
   EPR Waste Categories — constants from prototype
   ═══════════════════════════════════════════════════════ */

const WASTE_CATEGORIES = [
  { code: 'PET', name: 'PET Plastic', color: '#146484', pricePerKg: 4.50, buyer: 'Petco' },
  { code: 'HDPE', name: 'HDPE Plastic', color: '#2980b9', pricePerKg: 3.80, buyer: 'Polyco' },
  { code: 'LDPE', name: 'LDPE Plastic', color: '#27ae60', pricePerKg: 2.20, buyer: 'Polyco' },
  { code: 'PP', name: 'PP Plastic', color: '#e67e22', pricePerKg: 2.80, buyer: 'Polyco' },
  { code: 'METAL', name: 'Metals & Cans', color: '#8e44ad', pricePerKg: 4.80, buyer: 'Metpac' },
  { code: 'PAPER', name: 'Paper', color: '#e74c3c', pricePerKg: 1.20, buyer: 'Fibre Cycle' },
  { code: 'CARDBOARD', name: 'Cardboard', color: '#16a085', pricePerKg: 1.00, buyer: 'Fibre Cycle' },
  { code: 'GLASS', name: 'Glass', color: '#d4ac0d', pricePerKg: 0.85, buyer: 'Consol' },
  { code: 'EWASTE', name: 'E-Waste', color: '#922b21', pricePerKg: 8.50, buyer: 'E-Wasa' },
  { code: 'OTHER', name: 'Other / Mixed', color: '#5d6d7e', pricePerKg: 0.30, buyer: 'TBD' },
] as const;

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

const fmtZAR = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');
const fmtT = (kg: number) => (kg / 1000).toFixed(2) + ' t';
const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

/** Map a waste-log row to an EPR category code */
function resolveCategory(log: Record<string, unknown>): string {
  // The API waste-type name might match our category names or codes
  const typeName = String(
    (log as Record<string, unknown>).wasteType &&
    typeof log.wasteType === 'object' &&
    log.wasteType !== null
      ? (log.wasteType as Record<string, unknown>).name ?? ''
      : log.wasteTypeName ?? ''
  ).toUpperCase();

  const typeCategory = String(
    (log as Record<string, unknown>).wasteType &&
    typeof log.wasteType === 'object' &&
    log.wasteType !== null
      ? (log.wasteType as Record<string, unknown>).category ?? ''
      : ''
  ).toUpperCase();

  for (const cat of WASTE_CATEGORIES) {
    const c = cat.code.toUpperCase();
    const n = cat.name.toUpperCase();
    if (typeName === c || typeName === n || typeCategory === c || typeCategory === n) return cat.code;
    if (typeName.includes(c) || typeCategory.includes(c)) return cat.code;
  }
  return 'OTHER';
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function WasteReportPage() {
  const { setActivePage } = useNavStore();
  const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER);

  // ── Data fetching ──
  const { data: logsResponse, isLoading: logsLoading } = useQuery({
    queryKey: ['waste-logs', 'all-report'],
    queryFn: () => wasteLogsApi.list({ limit: '9999' }),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  });

  const allLogs: Record<string, unknown>[] = logsResponse?.data || [];
  const logs = useMemo(() => allLogs.filter(log => matchesFilter(String(log.date || ''), filter)), [allLogs, filter]);
  const sites: Record<string, unknown>[] = Array.isArray(sitesData)
    ? sitesData
    : (sitesData as Record<string, unknown> | undefined)?.data
      ? (sitesData as Record<string, unknown>).data as Record<string, unknown>[]
      : [];

  // Available years for filter
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    allLogs.forEach(log => {
      const y = String(log.date || '').slice(0, 4);
      if (y && y.length === 4) yrs.add(y);
    });
    return Array.from(yrs).sort();
  }, [allLogs]);

  const siteLookup = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s) => m.set(String(s.id), String(s.name || 'Unknown')));
    return m;
  }, [sites]);

  // ═══════════════════════════════════════════════
  //  Computed analytics
  // ═══════════════════════════════════════════════

  const analytics = useMemo(() => {
    // Per-category aggregation
    const catMap = new Map<string, { kg: number; count: number }>();
    WASTE_CATEGORIES.forEach((c) => catMap.set(c.code, { kg: 0, count: 0 }));

    // Per-site aggregation
    const siteMap = new Map<string, number>();

    // Per-month aggregation
    const monthMap = new Map<string, number>();

    let totalKg = 0;
    let totalDeliveries = 0;

    logs.forEach((log) => {
      const qty = Number(log.quantity) || 0;
      const cat = resolveCategory(log);
      const siteId = String(log.siteId || '');
      const dateStr = String(log.date || '');
      const month = dateStr.slice(0, 7); // YYYY-MM

      totalKg += qty;
      totalDeliveries += 1;

      const catRow = catMap.get(cat) || { kg: 0, count: 0 };
      catRow.kg += qty;
      catRow.count += 1;
      catMap.set(cat, catRow);

      if (siteId) {
        siteMap.set(siteId, (siteMap.get(siteId) || 0) + qty);
      }

      if (month) {
        monthMap.set(month, (monthMap.get(month) || 0) + qty);
      }
    });

    // Category breakdown sorted by kg desc
    const categories = WASTE_CATEGORIES.map((c) => {
      const d = catMap.get(c.code) || { kg: 0, count: 0 };
      const tonnes = d.kg / 1000;
      return {
        ...c,
        kg: d.kg,
        tonnes,
        count: d.count,
        revenue: d.kg * c.pricePerKg,
        share: totalKg > 0 ? (d.kg / totalKg) * 100 : 0,
      };
    });
    const categoriesSorted = [...categories].sort((a, b) => b.kg - a.kg);

    // Active categories (with data > 0)
    const activeCategories = categories.filter((c) => c.kg > 0).length;

    // Total estimated revenue
    const totalRevenue = categories.reduce((s, c) => s + c.revenue, 0);

    // Sites sorted by tonnes
    const siteEntries = Array.from(siteMap.entries())
      .map(([id, kg]) => ({ id, name: siteLookup.get(id) || id, kg, tonnes: kg / 1000 }))
      .sort((a, b) => b.kg - a.kg);

    // Monthly trend sorted chronologically
    const monthEntries = Array.from(monthMap.entries())
      .map(([m, kg]) => ({ month: m, kg, tonnes: kg / 1000 }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalKg,
      totalTonnes: totalKg / 1000,
      totalRevenue,
      totalDeliveries,
      activeCategories,
      categories,
      categoriesSorted,
      siteEntries,
      monthEntries,
    };
  }, [logs, siteLookup]);

  // ── Donut chart conic-gradient ──
  const donutGradient = useMemo(() => {
    if (analytics.totalKg === 0) return 'conic-gradient(var(--color-surface3) 0deg 360deg)';
    const segments: string[] = [];
    let cumDeg = 0;
    analytics.categoriesSorted
      .filter((c) => c.kg > 0)
      .forEach((c) => {
        const deg = (c.kg / analytics.totalKg) * 360;
        segments.push(`${c.color} ${cumDeg}deg ${cumDeg + deg}deg`);
        cumDeg += deg;
      });
    return `conic-gradient(${segments.join(', ')})`;
  }, [analytics]);

  // ── Excel export (CSV) ──
  const handleExport = () => {
    exportCsv('waste-report', analytics.categoriesSorted as unknown as Record<string, unknown>[], [
      { key: 'code', label: 'Category Code' },
      { key: 'name', label: 'Category' },
      { key: 'buyer', label: 'PRO Buyer' },
      { key: 'tonnes', label: 'Tonnes', map: (r: Record<string, unknown>) => (Number(r.tonnes) || 0).toFixed(3) },
      { key: 'share', label: '% Share', map: (r: Record<string, unknown>) => (Number(r.share) || 0).toFixed(1) },
      { key: 'pricePerKg', label: 'Rate R/t', map: (r: Record<string, unknown>) => (Number(r.pricePerKg) || 0) * 1000 },
      { key: 'revenue', label: 'Est. Revenue (R)', map: (r: Record<string, unknown>) => Math.round(Number(r.revenue) || 0) },
    ]);
  };

  // ── Max values for bar scaling ──
  const maxCatKg = analytics.categoriesSorted[0]?.kg || 1;
  const maxSiteKg = analytics.siteEntries[0]?.kg || 1;

  // ── Line chart data ──
  const monthlyChartData = analytics.monthEntries.map(m => ({
    label: m.month.slice(2).replace('-', '/'),
    value: m.tonnes,
  }));

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
            ♻ Waste Collection Report
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text3)', marginTop: 3 }}>
            Programme-wide EPR material recovery · W2W Pilot · City of Johannesburg
          </div>
        </div>
        <div style={{
          textAlign: 'right', fontSize: 11, color: 'var(--color-text3)', lineHeight: 1.7,
        }}>
          <div><b style={{ color: 'var(--color-text2)' }}>Generated:</b> {fmtDate(new Date())}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Sites:</b> {sites.length}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Period:</b> All time</div>
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
      {logsLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text3)' }}>
          Loading waste data…
        </div>
      )}

      {!logsLoading && (
        <>
          {/* ═══ KPI Row (4 cards) ═══ */}
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            {/* Total Collected */}
            <div className="stat-card card" style={{ borderBottom: '3px solid #146484' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Total Collected</div>
                <span style={{ fontSize: 18 }}>♻</span>
              </div>
              <div className="stat-val" style={{ color: '#146484' }}>
                {analytics.totalTonnes.toFixed(2)} t
              </div>
              <div className="stat-sub">All categories · all time</div>
            </div>

            {/* Estimated Revenue */}
            <div className="stat-card card" style={{ borderBottom: '3px solid #15803d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Estimated Revenue</div>
                <span style={{ fontSize: 18 }}>💰</span>
              </div>
              <div className="stat-val" style={{ color: '#15803d' }}>
                {fmtZAR(analytics.totalRevenue)}
              </div>
              <div className="stat-sub">Based on PRO prices</div>
            </div>

            {/* Total Deliveries */}
            <div className="stat-card card" style={{ borderBottom: '3px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Total Deliveries</div>
                <span style={{ fontSize: 18 }}>📦</span>
              </div>
              <div className="stat-val" style={{ color: '#d97706' }}>
                {analytics.totalDeliveries}
              </div>
              <div className="stat-sub">Depot submissions</div>
            </div>

            {/* Active Categories */}
            <div className="stat-card card" style={{ borderBottom: '3px solid #7c3aed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Active Categories</div>
                <span style={{ fontSize: 18 }}>📊</span>
              </div>
              <div className="stat-val" style={{ color: '#7c3aed' }}>
                {analytics.activeCategories}
              </div>
              <div className="stat-sub">of 10 EPR streams</div>
            </div>
          </div>

          {/* ═══ Charts Row 1 — Material Mix + Category Breakdown ═══ */}
          <div className="g2 mb14">
            {/* Donut Chart: Material Mix */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Material Mix</div>
                  <div className="cs">Tonnes recovered by EPR category</div>
                </div>
              </div>
              <div className="cb">
                {analytics.totalKg === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No waste data available
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
                          {analytics.totalTonnes.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>tonnes</div>
                      </div>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                      {analytics.categoriesSorted.filter((c) => c.kg > 0).map((c) => (
                        <div key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: 2,
                            background: c.color, flexShrink: 0,
                          }} />
                          <div style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', flexShrink: 0 }}>
                            {c.share.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal Bar Chart: Category Breakdown */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Category Breakdown (t)</div>
                  <div className="cs">Sorted by highest recovery</div>
                </div>
              </div>
              <div className="cb">
                {analytics.totalKg === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No waste data available
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analytics.categoriesSorted.filter((c) => c.kg > 0).map((c) => {
                      const pct = Math.max((c.kg / maxCatKg) * 100, 2);
                      return (
                        <div key={c.code}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 600 }}>{c.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--color-text2)', fontFamily: 'var(--font-mono)' }}>
                              {c.tonnes.toFixed(2)} t
                            </span>
                          </div>
                          <div style={{
                            height: 14, background: 'var(--color-surface3)',
                            borderRadius: 4, overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: c.color, borderRadius: 4,
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

          {/* ═══ Charts Row 2 — Monthly Trend + Tonnes by Site ═══ */}
          <div className="g2 mb14">
            {/* Monthly Collection Trend */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Monthly Collection Trend</div>
                  <div className="cs">Total tonnes per month</div>
                </div>
              </div>
              <div className="cb">
                <SvgLineChart data={monthlyChartData} color="#146484" unit="t" />
              </div>
            </div>

            {/* Tonnes by Site */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Tonnes by Site</div>
                  <div className="cs">Ranked by total recovery</div>
                </div>
              </div>
              <div className="cb">
                {analytics.siteEntries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No site data available
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analytics.siteEntries.slice(0, 10).map((s, idx) => {
                      const pct = Math.max((s.kg / maxSiteKg) * 100, 3);
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
                              {s.tonnes.toFixed(2)} t
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

          {/* ═══ EPR Category Summary Table ═══ */}
          <div className="card">
            <div className="ch">
              <div>
                <div className="ct">EPR Category Summary Table</div>
                <div className="cs">Full breakdown by material stream</div>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>PRO Buyer</th>
                    <th style={{ textAlign: 'right' }}>Tonnes (t)</th>
                    <th>% Share</th>
                    <th style={{ textAlign: 'right' }}>Rate (R/t)</th>
                    <th style={{ textAlign: 'right' }}>Est. Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.categoriesSorted.map((c) => (
                    <tr key={c.code}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: c.color, flexShrink: 0,
                          }} />
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                        </div>
                      </td>
                      <td>{c.buyer}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {c.tonnes.toFixed(3)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                          <div className="pb" style={{ flex: 1, height: 6 }}>
                            <div className="pf" style={{
                              width: `${c.share}%`, background: c.color, height: '100%',
                            }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--color-text2)', width: 36, textAlign: 'right' }}>
                            {c.share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        R {(c.pricePerKg * 1000).toLocaleString('en-ZA')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                        {fmtZAR(c.revenue)}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr style={{ background: '#146484', color: 'white', fontWeight: 700 }}>
                    <td style={{ color: 'white' }}>
                      <span style={{ fontWeight: 800 }}>TOTAL</span>
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.7)' }}>{analytics.activeCategories} streams</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white' }}>
                      {analytics.totalTonnes.toFixed(3)}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.8)' }}>100%</td>
                    <td style={{ color: 'rgba(255,255,255,0.7)' }}>—</td>
                    <td style={{ textAlign: 'right', color: 'white', fontSize: 13 }}>
                      {fmtZAR(analytics.totalRevenue)}
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
