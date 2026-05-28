import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sitesApi, wasteLogsApi } from '../api/endpoints';
import { StatCard } from './SitesPage';
import { exportCsv } from '../utils/csv';

/* ── Waste categories (same constant used across the app) ── */
const WASTE_CATS = [
  { code: 'PET', name: 'PET Plastic', color: '#2196F3', pricePerKg: 4.50 },
  { code: 'HDPE', name: 'HDPE', color: '#4CAF50', pricePerKg: 3.80 },
  { code: 'LDPE', name: 'LDPE Film', color: '#00BCD4', pricePerKg: 2.20 },
  { code: 'PP', name: 'Polypropylene', color: '#FF9800', pricePerKg: 2.80 },
  { code: 'METAL', name: 'Metals', color: '#607D8B', pricePerKg: 4.80 },
  { code: 'PAPER', name: 'Paper', color: '#795548', pricePerKg: 1.20 },
  { code: 'CARDBOARD', name: 'Cardboard', color: '#8D6E63', pricePerKg: 1.00 },
  { code: 'GLASS', name: 'Glass', color: '#9E9E9E', pricePerKg: 0.85 },
  { code: 'EWASTE', name: 'E-Waste', color: '#E91E63', pricePerKg: 8.50 },
  { code: 'OTHER', name: 'Other', color: '#9C27B0', pricePerKg: 0.30 },
];

const CAT_MAP = Object.fromEntries(WASTE_CATS.map((c) => [c.code, c]));

/* ── Helpers ── */
function fmt(n: number): string {
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function pct(variance: number, received: number): number {
  if (received === 0) return 0;
  return Math.abs(variance / received) * 100;
}

function varBadge(variance: number): { label: string; cls: string } {
  if (variance === 0) return { label: '✓ Balanced', cls: 'badge bg' };
  if (variance > 0) return { label: `⚠ +${fmt(variance)} kg unsold`, cls: 'badge ba' };
  return { label: `✗ ${fmt(Math.abs(variance))} kg over-reported`, cls: 'badge br' };
}

function varianceIcon(variance: number): string {
  if (variance === 0) return '✅';
  if (variance > 0) return '⚠️';
  return '🚨';
}

function varianceColor(variance: number): string {
  if (variance === 0) return 'var(--color-green)';
  if (variance > 0) return 'var(--color-amber)';
  return 'var(--color-red)';
}

function rowBg(variance: number): string | undefined {
  if (variance > 0) return 'rgba(255,152,0,0.06)';
  if (variance < 0) return 'rgba(244,67,54,0.06)';
  return undefined;
}

/* ── Types ── */
interface EprReport {
  siteId: string;
  materialBreakdown?: Record<string, number>;
  verifiedTonnage?: number;
  [k: string]: any;
}

interface SiteVariance {
  siteId: string;
  siteName: string;
  region: string;
  received: number;
  sold: number;
  variance: number;
  variancePct: number;
  eprCount: number;
  categories: CatVariance[];
}

interface CatVariance {
  code: string;
  name: string;
  received: number;
  sold: number;
  variance: number;
  estRevenue: number;
}

/* ══════════════════════════════════════════════════════════════ */
export default function StockVariancePage() {
  /* ── Filter state ── */
  const [filterMode, setFilterMode] = useState<'all' | 'month' | 'year' | 'range'>('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<{ mode: string; month: string; year: string; from: string; to: string }>({ mode: 'all', month: '', year: '', from: '', to: '' });

  const applyFilter = () => setAppliedFilter({ mode: filterMode, month: filterMonth, year: filterYear, from: filterFrom, to: filterTo });
  const clearFilter = () => { setFilterMode('all'); setFilterMonth(''); setFilterYear(''); setFilterFrom(''); setFilterTo(''); setAppliedFilter({ mode: 'all', month: '', year: '', from: '', to: '' }); };
  const isFiltered = appliedFilter.mode !== 'all';

  /* ── Data fetching ── */
  const { data: sitesRaw = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: logsRaw } = useQuery({ queryKey: ['waste-logs', 'all'], queryFn: () => wasteLogsApi.list({}) });

  const sites: any[] = Array.isArray(sitesRaw) ? sitesRaw : (sitesRaw as any)?.data || [];
  const allLogs: any[] = logsRaw?.data || [];

  /* ── Filter logs by applied period ── */
  const logs = useMemo(() => {
    if (appliedFilter.mode === 'all') return allLogs;
    return allLogs.filter((l: any) => {
      const d = l.date || l.createdAt || '';
      if (appliedFilter.mode === 'month') return d.startsWith(appliedFilter.month);
      if (appliedFilter.mode === 'year') return d.startsWith(appliedFilter.year);
      if (appliedFilter.mode === 'range') return d >= appliedFilter.from && d <= appliedFilter.to;
      return true;
    });
  }, [allLogs, appliedFilter]);

  /* Available years for dropdown */
  const availableYears = useMemo(() => {
    const yrs = new Set(allLogs.map((l: any) => (l.date || l.createdAt || '').slice(0, 4)).filter(Boolean));
    return [...yrs].sort().reverse();
  }, [allLogs]);

  /* ── EPR reports from localStorage ── */
  const eprReports: EprReport[] = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('w2w_epr_reports') || '[]');
    } catch {
      return [];
    }
  }, []);

  /* ── Build site variance data ── */
  const siteVariances: SiteVariance[] = useMemo(() => {
    return sites.map((site: any) => {
      const siteId = site.id;
      const siteName = site.name || 'Unknown';
      const region = site.region || '—';

      /* Received per category from waste logs */
      const siteLogs = logs.filter((l: any) => l.siteId === siteId);
      const receivedByCat: Record<string, number> = {};
      siteLogs.forEach((l: any) => {
        const catCode = (l.wasteType?.category || l.wasteTypeId || 'OTHER').toUpperCase();
        receivedByCat[catCode] = (receivedByCat[catCode] || 0) + (Number(l.quantity) || 0);
      });

      /* Sold per category from EPR reports */
      const siteEpr = eprReports.filter((r) => r.siteId === siteId);
      const soldByCat: Record<string, number> = {};
      siteEpr.forEach((r) => {
        if (r.materialBreakdown) {
          Object.entries(r.materialBreakdown).forEach(([catCode, tonnes]) => {
            const code = catCode.toUpperCase();
            // EPR reports store tonnage – convert to kg (×1000)
            soldByCat[code] = (soldByCat[code] || 0) + (Number(tonnes) || 0) * 1000;
          });
        } else if (r.verifiedTonnage) {
          soldByCat['OTHER'] = (soldByCat['OTHER'] || 0) + (Number(r.verifiedTonnage) || 0) * 1000;
        }
      });

      /* Per-category breakdown */
      const allCats = new Set([...Object.keys(receivedByCat), ...Object.keys(soldByCat)]);
      const categories: CatVariance[] = [];
      allCats.forEach((code) => {
        const rec = receivedByCat[code] || 0;
        const sol = soldByCat[code] || 0;
        const cat = CAT_MAP[code];
        categories.push({
          code,
          name: cat?.name || code,
          received: rec,
          sold: sol,
          variance: rec - sol,
          estRevenue: rec * (cat?.pricePerKg || 0),
        });
      });
      categories.sort((a, b) => a.name.localeCompare(b.name));

      const totalReceived = Object.values(receivedByCat).reduce((s, v) => s + v, 0);
      const totalSold = Object.values(soldByCat).reduce((s, v) => s + v, 0);
      const variance = totalReceived - totalSold;

      return {
        siteId,
        siteName,
        region,
        received: totalReceived,
        sold: totalSold,
        variance,
        variancePct: pct(variance, totalReceived),
        eprCount: siteEpr.length,
        categories,
      };
    });
  }, [sites, logs, eprReports]);

  /* ── Aggregated totals ── */
  const totalReceived = siteVariances.reduce((s, v) => s + v.received, 0);
  const totalSold = siteVariances.reduce((s, v) => s + v.sold, 0);
  const totalVariance = totalReceived - totalSold;
  const totalVariancePct = pct(totalVariance, totalReceived);

  /* Sites with data for per-category breakdown */
  const sitesWithData = siteVariances.filter((v) => v.categories.length > 0);

  /* Sites with received but no EPR */
  const sitesNoEpr = siteVariances.filter((v) => v.received > 0 && v.eprCount === 0);

  /* ── CSV Export ── */
  const handleExport = () => {
    const rows: any[] = [];
    siteVariances.forEach((sv) => {
      if (sv.categories.length === 0) {
        rows.push({
          site: sv.siteName,
          region: sv.region,
          category: '—',
          received: sv.received,
          sold: sv.sold,
          variance: sv.variance,
          variancePct: sv.variancePct.toFixed(1) + '%',
          status: varBadge(sv.variance).label,
          estRevenue: 0,
        });
      } else {
        sv.categories.forEach((cat) => {
          rows.push({
            site: sv.siteName,
            region: sv.region,
            category: cat.name,
            received: cat.received,
            sold: cat.sold,
            variance: cat.variance,
            variancePct: pct(cat.variance, cat.received).toFixed(1) + '%',
            status: varBadge(cat.variance).label,
            estRevenue: cat.estRevenue.toFixed(2),
          });
        });
      }
    });

    exportCsv('stock-variance', rows, [
      { key: 'site', label: 'Site' },
      { key: 'region', label: 'Region' },
      { key: 'category', label: 'Category' },
      { key: 'received', label: 'Received (kg)', map: (r: any) => fmt(r.received) },
      { key: 'sold', label: 'Sold/Reported (kg)', map: (r: any) => fmt(r.sold) },
      { key: 'variance', label: 'Variance (kg)', map: (r: any) => fmt(r.variance) },
      { key: 'variancePct', label: 'Variance %' },
      { key: 'status', label: 'Status' },
      { key: 'estRevenue', label: 'Est Revenue (R)' },
    ]);
  };

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Stock Variance Report</div>
          <div className="ps">
            Waste Received (Depot Scanner) vs Sold (EPR Monthly Report) · Flags any stock discrepancy
          </div>
        </div>
        <button className="btn btn-ghost" onClick={handleExport}>📥 Export to Excel</button>
      </div>

      {/* ── Period Filter Bar (matches prototype reportFilterBar) ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', background: 'var(--color-surface3)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--color-text3)', display: 'block', marginBottom: 3, textTransform: 'uppercase' }}>Period</label>
          <select className="fc" style={{ width: 130, fontSize: 11 }} value={filterMode} onChange={(e) => setFilterMode(e.target.value as any)}>
            <option value="all">All time</option>
            <option value="month">Specific month</option>
            <option value="year">By year</option>
            <option value="range">Date range</option>
          </select>
        </div>
        {filterMode === 'month' && (
          <div>
            <label style={{ fontSize: 10, color: 'var(--color-text3)', display: 'block', marginBottom: 3 }}>Month</label>
            <input className="fc" type="month" style={{ fontSize: 11 }} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          </div>
        )}
        {filterMode === 'year' && (
          <div>
            <label style={{ fontSize: 10, color: 'var(--color-text3)', display: 'block', marginBottom: 3 }}>Year</label>
            <select className="fc" style={{ fontSize: 11, width: 100 }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="">Select</option>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {filterMode === 'range' && (
          <>
            <div>
              <label style={{ fontSize: 10, color: 'var(--color-text3)', display: 'block', marginBottom: 3 }}>From</label>
              <input className="fc" type="date" style={{ fontSize: 11 }} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: 'var(--color-text3)', display: 'block', marginBottom: 3 }}>To</label>
              <input className="fc" type="date" style={{ fontSize: 11 }} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 1 }}>
          <button className="btn btn-primary btn-sm" onClick={applyFilter}>Apply Filter</button>
          {isFiltered && <button className="btn btn-ghost btn-sm" onClick={clearFilter}>Clear</button>}
          {isFiltered && (
            <span style={{ fontSize: 10, color: 'var(--color-w2w)', fontWeight: 700, background: 'var(--color-w2w-light, rgba(20,100,132,0.08))', padding: '3px 8px', borderRadius: 5 }}>
              📅 {appliedFilter.mode === 'month' ? appliedFilter.month : appliedFilter.mode === 'year' ? appliedFilter.year : `${appliedFilter.from} → ${appliedFilter.to}`}
            </span>
          )}
        </div>
      </div>

      {/* ── Blue Info Alert ── */}
      <div className="alert alert-blue" style={{ marginBottom: 16 }}>
        <span>
          <b>How this works:</b> Received = total kg entered in the Depot Scanner for this site.
          Sold = total kg submitted in EPR Monthly Reports for this site.
          Variance = Received minus Sold. A positive variance means stock was received but not yet
          reported sold — this should be investigated. Zero variance = fully balanced.
          Negative variance = more sold than received (data entry error).
        </span>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="stats-grid mt14">
        <StatCard
          label="Total Received"
          value={fmt(totalReceived) + ' kg'}
          sub="from depot scanner logs"
          icon="📥"
          rail="sc-blue"
          color="#146484"
        />
        <StatCard
          label="Total Sold / Reported"
          value={fmt(totalSold) + ' kg'}
          sub="from EPR monthly reports"
          icon="📤"
          rail="sc-green"
          color="var(--color-green)"
        />
        <StatCard
          label="Total Variance"
          value={fmt(Math.abs(totalVariance)) + ' kg'}
          sub={totalVariance === 0 ? 'Balanced' : totalVariance > 0 ? 'Unsold stock' : 'Over-reported'}
          icon={varianceIcon(totalVariance)}
          rail={totalVariance === 0 ? 'sc-green' : totalVariance > 0 ? 'sc-amber' : 'sc-red'}
          color={varianceColor(totalVariance)}
        />
        <StatCard
          label="Variance %"
          value={totalVariancePct.toFixed(1) + '%'}
          sub="|variance / received × 100|"
          icon="📊"
          rail="sc-blue"
          color="#146484"
        />
      </div>

      {/* ── Site-by-Site Variance Summary Table ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ch">
          <div>
            <div className="ct">Site-by-Site Variance Summary</div>
            <div className="cs">Each row = one site · Received vs Sold vs Variance</div>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Region</th>
                <th>Received (kg)</th>
                <th>Sold/Reported (kg)</th>
                <th>Variance (kg)</th>
                <th>Variance %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {siteVariances.map((sv) => {
                const badge = varBadge(sv.variance);
                return (
                  <tr key={sv.siteId} style={{ background: rowBg(sv.variance) }}>
                    <td style={{ fontWeight: 700 }}>{sv.siteName}</td>
                    <td><span className="badge bb">{sv.region}</span></td>
                    <td>{fmt(sv.received)}</td>
                    <td>{fmt(sv.sold)}</td>
                    <td style={{ fontWeight: 700, color: varianceColor(sv.variance) }}>
                      {sv.variance > 0 ? '+' : ''}{fmt(sv.variance)}
                    </td>
                    <td>{sv.variancePct.toFixed(1)}%</td>
                    <td><span className={badge.cls}>{badge.label}</span></td>
                  </tr>
                );
              })}

              {/* Footer total row */}
              <tr style={{ fontWeight: 800, borderTop: '2px solid var(--color-border)', background: 'var(--color-surface3)' }}>
                <td>TOTAL — ALL SITES</td>
                <td></td>
                <td>{fmt(totalReceived)}</td>
                <td>{fmt(totalSold)}</td>
                <td style={{ color: varianceColor(totalVariance) }}>
                  {totalVariance > 0 ? '+' : ''}{fmt(totalVariance)}
                </td>
                <td>{totalVariancePct.toFixed(1)}%</td>
                <td><span className={varBadge(totalVariance).cls}>{varBadge(totalVariance).label}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Per-Category Breakdown Cards ── */}
      {sitesWithData.map((sv) => {
        const borderColor = sv.variance === 0 ? 'var(--color-green)' : sv.variance > 0 ? 'var(--color-amber)' : 'var(--color-red)';
        return (
          <div className="card" key={sv.siteId} style={{ borderLeft: `4px solid ${borderColor}`, marginBottom: 14 }}>
            <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="ct">{sv.siteName}</div>
                <div className="cs">
                  {fmt(sv.received)} kg received · {fmt(sv.sold)} kg sold · Variance: {sv.variance >= 0 ? '+' : ''}{fmt(sv.variance)} kg
                </div>
              </div>
              <div style={{ fontSize: 11, color: sv.eprCount > 0 ? 'var(--color-text2)' : 'var(--color-amber)', fontWeight: 600 }}>
                {sv.eprCount > 0 ? `${sv.eprCount} EPR report${sv.eprCount !== 1 ? 's' : ''} submitted` : '⚠ No EPR reports yet'}
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Received (kg)</th>
                    <th>Sold (kg)</th>
                    <th>Variance (kg)</th>
                    <th>Est. Revenue (R)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sv.categories.map((cat) => {
                    const catBadge = varBadge(cat.variance);
                    return (
                      <tr key={cat.code} style={{ background: rowBg(cat.variance) }}>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: CAT_MAP[cat.code]?.color || '#999', marginRight: 6 }} />
                          {cat.name}
                        </td>
                        <td>{fmt(cat.received)}</td>
                        <td>{fmt(cat.sold)}</td>
                        <td style={{ fontWeight: 700, color: varianceColor(cat.variance) }}>
                          {cat.variance > 0 ? '+' : ''}{fmt(cat.variance)}
                        </td>
                        <td>R {cat.estRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td><span className={catBadge.cls}>{catBadge.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* ── Conditional Alert: sites with received but no EPR ── */}
      {sitesNoEpr.length > 0 && (
        <div className="alert alert-amber" style={{ marginTop: 16 }}>
          <span>
            Some sites have waste received but <b>no EPR Monthly Reports submitted yet</b>.
            All received stock will show as unaccounted until a report is submitted for those sites.
          </span>
        </div>
      )}
    </div>
  );
}
