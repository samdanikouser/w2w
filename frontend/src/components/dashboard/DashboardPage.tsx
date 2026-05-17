import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, wasteLogsApi, sitesApi, wasteTypesApi } from '../../api/endpoints';

const TABS = [
  { id: 'performance', label: '👷 Employee Performance' },
  { id: 'financial', label: '💰 Financial Performance' },
  { id: 'tonnes', label: '♻ Tons by Category' },
  { id: 'budget', label: '📊 Budget Utilisation' },
  { id: 'impact', label: '🌍 Impact Metrics' },
];

type Period = 'all' | 'month' | 'quarter' | 'year' | 'custom';

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  /** Legacy prop — value now always uses --color-text. Kept so other pages don't break. */
  color?: string;
  icon: string;
  rail: 'sc-blue' | 'sc-green' | 'sc-amber' | 'sc-red' | 'sc-purple';
}

function StatCard({ label, value, sub, icon, rail }: StatCardProps) {
  return (
    <div className={`stat-card ${rail}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="stat-label">{label}</div>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div className="stat-val">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

const fmtZAR = (n: number) =>
  'R ' + Math.round(n).toLocaleString('en-ZA');

const fmtKg = (kg: number) =>
  kg >= 1000 ? (kg / 1000).toFixed(2) + 't' : kg.toLocaleString() + ' kg';

const initials = (name: string) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// Deterministic avatar colour from any id string
function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('performance');
  const [period, setPeriod] = useState<Period>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // ── Fetch data ──
  const { data: empData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesApi.list({}),
  });
  const { data: logData } = useQuery({
    queryKey: ['waste-logs', 'all'],
    queryFn: () => wasteLogsApi.list({}),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });
  const { data: typesData } = useQuery({
    queryKey: ['waste-types'],
    queryFn: () => wasteTypesApi.list(),
  });

  const employees: any[] = empData?.data || [];
  const logs: any[] = logData?.data || [];
  const sites: any[] = Array.isArray(sitesData) ? sitesData : sitesData?.data || [];
  const wasteTypes: any[] = Array.isArray(typesData) ? typesData : typesData?.data || [];

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // ── Date filtering ──
  const filteredLogs = useMemo(() => {
    if (period === 'all') return logs;
    return logs.filter((l: any) => {
      if (!l.date) return false;
      const d = new Date(l.date);
      if (Number.isNaN(d.getTime())) return false;

      if (period === 'month') {
        return l.date.startsWith(monthFilter || thisMonthKey);
      }
      if (period === 'quarter') {
        const q = Math.floor(now.getMonth() / 3);
        const qStart = new Date(now.getFullYear(), q * 3, 1);
        const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
        return d >= qStart && d <= qEnd;
      }
      if (period === 'year') {
        return d.getFullYear() === now.getFullYear();
      }
      if (period === 'custom') {
        if (fromDate && d < new Date(fromDate)) return false;
        if (toDate && d > new Date(toDate)) return false;
        return true;
      }
      return true;
    });
  }, [logs, period, fromDate, toDate, monthFilter, thisMonthKey, now]);

  // ── KPI numbers ──
  const totalKg = filteredLogs.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalTonnes = totalKg / 1000;
  const totalValue = filteredLogs.reduce((s, l) => s + (Number(l.totalValue) || 0), 0);
  const monthLogs = logs.filter((l: any) => l.date?.startsWith(thisMonthKey));
  const monthKg = monthLogs.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  const activeSites = sites.filter((s: any) => (s.status || '').toLowerCase() === 'active').length || sites.length;
  const activeCollectors = employees.filter(
    (e: any) =>
      (e.status || '').toLowerCase() === 'active' &&
      ((e.role || '').toLowerCase().includes('collect') || (e.systemRole || '').toLowerCase() === 'field')
  ).length;

  const setPeriodAndReset = (p: Period) => {
    setPeriod(p);
    if (p !== 'month') setMonthFilter('');
    if (p !== 'custom') {
      setFromDate('');
      setToDate('');
    }
  };

  return (
    <div>
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <div className="pt">Dashboard</div>
          <div className="ps">Programme-wide view</div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="stats-grid">
        <StatCard
          label="Total tonnes Recovered"
          value={totalTonnes > 0 ? totalTonnes.toFixed(1) + 't' : '0t'}
          sub={`${period === 'all' ? 'All time' : 'Selected period'} · ${filteredLogs.length} ${filteredLogs.length === 1 ? 'delivery' : 'deliveries'}`}
          icon="♻"
          rail="sc-blue"
        />
        <StatCard
          label="This Month"
          value={monthKg >= 1000 ? (monthKg / 1000).toFixed(2) + 't' : monthKg.toLocaleString() + ' kg'}
          sub={`${monthLogs.length} ${monthLogs.length === 1 ? 'delivery' : 'deliveries'} in ${thisMonthKey}`}
          icon="📦"
          rail="sc-green"
        />
        <StatCard
          label="Active Collectors"
          value={String(activeCollectors || employees.length)}
          sub={`Across ${activeSites || sites.length} site${(activeSites || sites.length) === 1 ? '' : 's'}`}
          icon="👷"
          rail="sc-purple"
        />
        <StatCard
          label="Sites Active"
          value={String(activeSites)}
          sub={`of ${sites.length} total ${sites.length === 1 ? 'site' : 'sites'}`}
          icon="📍"
          rail="sc-amber"
        />
      </div>

      {/* ── Tabs + inline filter ── */}
      <div
        className="tabs"
        style={{
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          flexWrap: 'nowrap',
          minWidth: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.06em' }}>Period</span>
          <select
            className="fc"
            style={{ width: 110, padding: '5px 10px', fontSize: 11 }}
            value={period}
            onChange={(e) => setPeriodAndReset(e.target.value as Period)}
          >
            <option value="all">All time</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
            <option value="custom">Custom</option>
          </select>
          {period === 'month' && (
            <input
              type="month"
              className="fc"
              style={{ width: 140, padding: '5px 10px', fontSize: 11 }}
              value={monthFilter || thisMonthKey}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          )}
          {period === 'custom' && (
            <>
              <input type="date" className="fc" style={{ width: 130, padding: '5px 10px', fontSize: 11 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <input type="date" className="fc" style={{ width: 130, padding: '5px 10px', fontSize: 11 }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </>
          )}
          <span style={{ fontSize: 10, color: 'var(--color-text3)', marginLeft: 4 }}>
            {filteredLogs.length}/{logs.length}
          </span>
        </div>
      </div>

      {/* ── TAB: Employee Performance ── */}
      {activeTab === 'performance' && (
        <PerformanceTab employees={employees} logs={filteredLogs} sites={sites} thisMonthKey={thisMonthKey} />
      )}

      {/* ── TAB: Financial Performance ── */}
      {activeTab === 'financial' && (
        <FinancialTab logs={filteredLogs} sites={sites} totalValue={totalValue} totalKg={totalKg} />
      )}

      {/* ── TAB: Tons by Category ── */}
      {activeTab === 'tonnes' && (
        <TonsTab logs={filteredLogs} wasteTypes={wasteTypes} sites={sites} totalKg={totalKg} />
      )}

      {/* ── TAB: Budget Utilisation ── */}
      {activeTab === 'budget' && <BudgetTab totalValue={totalValue} />}

      {/* ── TAB: Impact Metrics ── */}
      {activeTab === 'impact' && (
        <ImpactTab
          totalKg={totalKg}
          totalValue={totalValue}
          deliveries={filteredLogs.length}
          collectors={activeCollectors}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  PERFORMANCE TAB
// ═══════════════════════════════════════════════════
function PerformanceTab({
  employees,
  logs,
  sites,
  thisMonthKey,
}: {
  employees: any[];
  logs: any[];
  sites: any[];
  thisMonthKey: string;
}) {
  const perf = useMemo(() => {
    const sitesById: Record<string, any> = Object.fromEntries(sites.map((s: any) => [s.id, s]));
    return employees
      .map((e: any) => {
        const empLogs = logs.filter((l: any) => l.collectorId === e.id || l.employeeId === e.id);
        const totalKg = empLogs.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
        const monthKg = empLogs
          .filter((l: any) => l.date?.startsWith(thisMonthKey))
          .reduce((s, l) => s + (Number(l.quantity) || 0), 0);
        const rev = empLogs.reduce((s, l) => s + (Number(l.totalValue) || 0), 0);
        return {
          emp: e,
          totalKg,
          monthKg,
          deliveries: empLogs.length,
          rev,
          siteName: e.siteName || sitesById[e.siteId]?.name || '—',
        };
      })
      .sort((a, b) => b.totalKg - a.totalKg);
  }, [employees, logs, sites, thisMonthKey]);

  const maxKg = perf[0]?.totalKg || 1;

  if (perf.length === 0) {
    return (
      <div className="alert alert-blue">
        <span>No employees found. Add employees and record waste logs to populate this view.</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="ch">
        <div className="ct">Collector Performance</div>
        <div className="cs">Sorted by total tonnes collected</div>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Collector</th>
              <th>Site</th>
              <th>Total (t)</th>
              <th>This Month (kg)</th>
              <th>Deliveries</th>
              <th>Est. Revenue</th>
              <th style={{ width: 140 }}>Performance</th>
            </tr>
          </thead>
          <tbody>
            {perf.map((d, i) => {
              const pct = maxKg > 0 ? Math.round((d.totalKg / maxKg) * 100) : 0;
              const barColor = pct > 66 ? 'var(--color-green)' : pct > 33 ? 'var(--color-amber)' : 'var(--color-red)';
              const empName = d.emp.name || `${d.emp.firstName || ''} ${d.emp.lastName || ''}`.trim() || '—';
              return (
                <tr key={d.emp.id}>
                  <td style={{ fontWeight: 700, color: 'var(--color-text3)', fontSize: 11 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        className="avt"
                        style={{ width: 28, height: 28, fontSize: 10, background: avatarColor(d.emp.id || empName) }}
                      >
                        {initials(empName)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{empName}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>
                          {d.emp.empNo || d.emp.employeeId || d.emp.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 11 }}>{d.siteName}</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-w2w)' }}>{(d.totalKg / 1000).toFixed(2)}</td>
                  <td style={{ fontWeight: 600 }}>{d.monthKg.toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>{d.deliveries}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>{fmtZAR(d.rev)}</td>
                  <td>
                    {d.totalKg > 0 ? (
                      <>
                        <div className="pb">
                          <div className="pf" style={{ width: pct + '%', background: barColor }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>{pct}% of top</div>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--color-text3)' }}>— no data —</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  FINANCIAL TAB
// ═══════════════════════════════════════════════════
function FinancialTab({
  logs,
  sites,
  totalValue,
  totalKg,
}: {
  logs: any[];
  sites: any[];
  totalValue: number;
  totalKg: number;
}) {
  const perSite = useMemo(() => {
    const map = new Map<string, { siteId: string; siteName: string; rev: number; kg: number; count: number }>();
    logs.forEach((l: any) => {
      const id = l.siteId || 'unknown';
      const name = l.siteName || sites.find((s: any) => s.id === id)?.name || 'Unknown site';
      const row = map.get(id) || { siteId: id, siteName: name, rev: 0, kg: 0, count: 0 };
      row.rev += Number(l.totalValue) || 0;
      row.kg += Number(l.quantity) || 0;
      row.count += 1;
      map.set(id, row);
    });
    return Array.from(map.values()).sort((a, b) => b.rev - a.rev);
  }, [logs, sites]);

  const maxRev = perSite[0]?.rev || 1;
  const avgPerKg = totalKg > 0 ? totalValue / totalKg : 0;

  return (
    <>
      <div className="g3 mb20">
        <StatCard label="Gross Revenue" value={fmtZAR(totalValue)} sub={`From ${logs.length} deliveries`} color="var(--color-green)" icon="💰" rail="sc-green" />
        <StatCard label="Avg. R / kg" value={fmtZAR(avgPerKg)} sub="Across all categories" color="var(--color-w2w)" icon="⚖" rail="sc-blue" />
        <StatCard label="Revenue Sites" value={String(perSite.length)} sub="With recorded sales" color="var(--color-purple)" icon="🏢" rail="sc-purple" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Revenue by Site</div>
          <div className="cs">Total recyclable income by collection site</div>
        </div>
        {perSite.length === 0 ? (
          <div className="cb" style={{ textAlign: 'center', color: 'var(--color-text3)', padding: '32px' }}>
            No revenue-producing logs in the selected period.
          </div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Deliveries</th>
                  <th>Volume (kg)</th>
                  <th>Revenue</th>
                  <th style={{ width: 200 }}>% of total</th>
                </tr>
              </thead>
              <tbody>
                {perSite.map((s) => {
                  const pct = maxRev > 0 ? Math.round((s.rev / maxRev) * 100) : 0;
                  return (
                    <tr key={s.siteId}>
                      <td style={{ fontWeight: 600 }}>{s.siteName}</td>
                      <td>{s.count}</td>
                      <td>{s.kg.toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-green)' }}>{fmtZAR(s.rev)}</td>
                      <td>
                        <div className="pb">
                          <div className="pf pf-g" style={{ width: pct + '%' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>{pct}%</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════
//  TONS BY CATEGORY TAB
// ═══════════════════════════════════════════════════
function TonsTab({
  logs,
  wasteTypes,
  totalKg,
}: {
  logs: any[];
  wasteTypes: any[];
  sites: any[];
  totalKg: number;
}) {
  const perCat = useMemo(() => {
    const typeById: Record<string, any> = Object.fromEntries(wasteTypes.map((t: any) => [t.id, t]));
    const map = new Map<string, { id: string; name: string; colour: string; kg: number; rev: number; count: number }>();
    logs.forEach((l: any) => {
      const t = typeById[l.wasteTypeId] || {};
      const id = l.wasteTypeId || l.wasteTypeName || 'unknown';
      const name = t.name || l.wasteTypeName || 'Unknown';
      const colour = t.colour || '#7a98ab';
      const row = map.get(id) || { id, name, colour, kg: 0, rev: 0, count: 0 };
      row.kg += Number(l.quantity) || 0;
      row.rev += Number(l.totalValue) || 0;
      row.count += 1;
      map.set(id, row);
    });
    return Array.from(map.values()).sort((a, b) => b.kg - a.kg);
  }, [logs, wasteTypes]);

  const maxKg = perCat[0]?.kg || 1;

  return (
    <div className="card">
      <div className="ch">
        <div className="ct">Waste by Category</div>
        <div className="cs">Volume and revenue per recyclable stream</div>
      </div>
      <div className="cb">
        {perCat.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text3)', padding: '32px' }}>
            No waste logs in the selected period.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {perCat.map((c) => {
              const pct = maxKg > 0 ? Math.round((c.kg / maxKg) * 100) : 0;
              const sharePct = totalKg > 0 ? Math.round((c.kg / totalKg) * 100) : 0;
              return (
                <div key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: c.colour,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text2)' }}>{fmtKg(c.kg)}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-green)', fontWeight: 600, width: 90, textAlign: 'right' }}>
                      {fmtZAR(c.rev)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text3)', width: 36, textAlign: 'right' }}>
                      {sharePct}%
                    </div>
                  </div>
                  <div className="pb" style={{ height: 8 }}>
                    <div className="pf" style={{ width: pct + '%', background: c.colour, height: '100%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  BUDGET TAB
// ═══════════════════════════════════════════════════
function BudgetTab({ totalValue }: { totalValue: number }) {
  // Until P&L data is wired, show a simple summary derived from revenue.
  // Treat operational expense as a stylised 60% of revenue for visualisation only.
  const operatingBudget = Math.max(0, Math.round(totalValue * 0.6));
  const utilisationPct = totalValue > 0 ? Math.min(100, Math.round((operatingBudget / totalValue) * 100)) : 0;

  return (
    <div className="card">
      <div className="ch">
        <div className="ct">Budget Utilisation</div>
        <div className="cs">P&L register data is not yet captured — placeholder estimate shown</div>
      </div>
      <div className="cb">
        <div className="alert alert-amber">
          <span>
            Connect cost-centre budgets from the <b>P&amp;L Entry Register</b> to see real budget vs spend. The numbers
            below are a stylised illustration only.
          </span>
        </div>
        <div className="g3 mt14">
          <div className="stat-card sc-blue">
            <div className="stat-label">Revenue (selected period)</div>
            <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>{fmtZAR(totalValue)}</div>
            <div className="stat-sub">From waste-log totals</div>
          </div>
          <div className="stat-card sc-amber">
            <div className="stat-label">Illustrative Operating Spend</div>
            <div className="stat-val" style={{ color: 'var(--color-amber)' }}>{fmtZAR(operatingBudget)}</div>
            <div className="stat-sub">≈ 60% of revenue (placeholder)</div>
          </div>
          <div className="stat-card sc-green">
            <div className="stat-label">Utilisation</div>
            <div className="stat-val" style={{ color: 'var(--color-green)' }}>{utilisationPct}%</div>
            <div className="stat-sub">Of revenue consumed</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  IMPACT METRICS TAB
// ═══════════════════════════════════════════════════
function ImpactTab({
  totalKg,
  totalValue,
  deliveries,
  collectors,
}: {
  totalKg: number;
  totalValue: number;
  deliveries: number;
  collectors: number;
}) {
  // Standard sustainability coefficients (industry averages)
  const co2Saved = totalKg * 1.8; // kg CO2 saved per kg recycled (mixed)
  const treesEquivalent = co2Saved / 21; // 21 kg CO2 / tree / year
  const waterSavedL = totalKg * 30; // litres water saved per kg
  const landfillM3 = totalKg * 0.003; // m³ landfill diverted

  return (
    <>
      <div className="g4 mb20">
        <div className="stat-card sc-green">
          <div className="stat-label">CO₂ Avoided</div>
          <div className="stat-val" style={{ color: 'var(--color-green)' }}>
            {(co2Saved / 1000).toFixed(1)}t
          </div>
          <div className="stat-sub">{co2Saved.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg total</div>
        </div>
        <div className="stat-card sc-blue">
          <div className="stat-label">Trees Equivalent</div>
          <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>
            {Math.round(treesEquivalent).toLocaleString()}
          </div>
          <div className="stat-sub">Annual CO₂ uptake</div>
        </div>
        <div className="stat-card sc-purple">
          <div className="stat-label">Water Saved</div>
          <div className="stat-val" style={{ color: 'var(--color-purple)' }}>
            {(waterSavedL / 1000).toFixed(0)}kL
          </div>
          <div className="stat-sub">From recycling vs virgin</div>
        </div>
        <div className="stat-card sc-amber">
          <div className="stat-label">Landfill Diverted</div>
          <div className="stat-val" style={{ color: 'var(--color-amber)' }}>
            {landfillM3.toFixed(2)} m³
          </div>
          <div className="stat-sub">Out of municipal stream</div>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Social & Economic Impact</div>
          <div className="cs">Programme contribution to livelihoods</div>
        </div>
        <div className="cb">
          <div className="g2">
            <div className="drow">
              <div className="dlb">Recyclable income generated</div>
              <div className="dvl" style={{ fontWeight: 700, color: 'var(--color-green)' }}>{fmtZAR(totalValue)}</div>
            </div>
            <div className="drow">
              <div className="dlb">Collectors with income</div>
              <div className="dvl" style={{ fontWeight: 700 }}>{collectors}</div>
            </div>
            <div className="drow">
              <div className="dlb">Total deliveries</div>
              <div className="dvl" style={{ fontWeight: 700 }}>{deliveries.toLocaleString()}</div>
            </div>
            <div className="drow">
              <div className="dlb">Avg. per collector</div>
              <div className="dvl" style={{ fontWeight: 700 }}>
                {collectors > 0 ? fmtZAR(totalValue / collectors) : 'R 0'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
