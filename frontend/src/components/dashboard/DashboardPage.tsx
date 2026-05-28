import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, wasteLogsApi, sitesApi, wasteTypesApi, transactionsApi } from '../../api/endpoints';

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
  // Fetch P&L transaction data
  const { data: txData } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: () => transactionsApi.list(),
  });

  const totalRevenue = txData?.summary?.totalRevenue || totalValue;
  const totalExpense = txData?.summary?.totalExpense || 0;
  const netSurplus = totalRevenue - totalExpense;

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

  return (
    <>
      <div className="g3 mb20">
        <StatCard label="Total Programme Revenue" value={fmtZAR(totalRevenue)} sub="All income sources" icon="📈" rail="sc-green" />
        <StatCard label="Total Expenditure" value={fmtZAR(totalExpense)} sub="All cost categories" icon="📉" rail="sc-red" />
        <StatCard
          label="Net Surplus / Deficit"
          value={fmtZAR(Math.abs(netSurplus))}
          sub={netSurplus >= 0 ? 'Surplus ▲' : 'Deficit ▼'}
          icon={netSurplus >= 0 ? '✅' : '⚠️'}
          rail={netSurplus >= 0 ? 'sc-green' : 'sc-red'}
        />
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
  // Fetch P&L transaction data
  const { data: txData } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: () => transactionsApi.list(),
  });

  // Load cost centers from localStorage settings
  const costCenters = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('w2w_programme_settings') || '{}');
      return saved.costCenters || [];
    } catch { return []; }
  }, []);

  const transactions: any[] = txData?.data || [];
  const totalExpense = txData?.summary?.totalExpense || 0;
  const totalBudget = costCenters.reduce((s: number, c: any) => s + (c.budget || 0), 0);
  const budgetUsedPct = totalBudget > 0 ? Math.min(100, Math.round((totalExpense / totalBudget) * 100)) : 0;

  // Monthly burn rate
  const expenseMonths = [...new Set(
    transactions
      .filter((t: any) => t.type === 'EXPENSE' && t.date)
      .map((t: any) => t.date?.slice(0, 7))
      .filter(Boolean)
  )].length || 1;
  const monthlyBurn = Math.round(totalExpense / expenseMonths);

  // Per cost center breakdown
  const expensesByCenter = costCenters.map((cc: any) => {
    const ccExpenses = transactions.filter((t: any) =>
      t.type === 'EXPENSE' && (
        (t.category && t.category.toLowerCase().includes((cc.name || '').toLowerCase().split(' ')[0])) ||
        (t.description && t.description.toLowerCase().includes((cc.name || '').toLowerCase()))
      )
    );
    const spent = ccExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    const budget = cc.budget || 0;
    const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const statusColor = pct > 90 ? 'var(--color-red)' : pct > 70 ? 'var(--color-amber)' : 'var(--color-green)';
    return { cc, spent, budget, pct, statusColor };
  });

  return (
    <>
      <div className="g2 mb20">
        <StatCard label="Total Budget Allocated" value={fmtZAR(totalBudget)} sub={`${costCenters.length} cost centers`} icon="📋" rail="sc-blue" />
        <StatCard label="Total Expenditure" value={fmtZAR(totalExpense)} sub="Across all categories" icon="💸" rail="sc-red" />
        <StatCard
          label="Budget Utilisation"
          value={budgetUsedPct + '%'}
          sub={totalBudget > 0 ? (budgetUsedPct > 80 ? '⚠ High utilisation' : budgetUsedPct > 50 ? 'On track' : 'Under budget') : 'Set budgets in Settings → Cost Centers'}
          icon="📊"
          rail={budgetUsedPct > 80 ? 'sc-red' : budgetUsedPct > 50 ? 'sc-amber' : 'sc-green'}
        />
        <StatCard label="Monthly Burn Rate" value={fmtZAR(monthlyBurn)} sub={`Average per month · ${expenseMonths} month${expenseMonths !== 1 ? 's' : ''}`} icon="🔥" rail="sc-amber" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Budget Utilisation by Cost Center</div>
          {totalBudget === 0 && <span className="badge ba" style={{ fontSize: 10 }}>Set budgets in Settings → Cost Centers</span>}
        </div>
        <div className="cb">
          {expensesByCenter.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 32 }}>
              No cost centers configured. Add them in Settings → Cost Centers.
            </div>
          ) : (
            <>
              {expensesByCenter.map((d: any) => (
                <div key={d.cc.id || d.cc.code} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{d.cc.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text3)', marginLeft: 6, fontFamily: 'var(--mono, monospace)' }}>{d.cc.code}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: d.statusColor }}>{d.pct}%</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text3)', marginLeft: 6 }}>R{d.spent.toLocaleString()} of R{d.budget.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ height: 12, background: 'var(--color-surface3)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: d.pct + '%', background: d.statusColor, borderRadius: 6, transition: 'width 0.4s' }} />
                  </div>
                  {d.pct > 90 && <div style={{ fontSize: 10, color: 'var(--color-red)', marginTop: 3 }}>⚠ Budget nearly exhausted</div>}
                  {d.pct > 80 && d.pct <= 90 && <div style={{ fontSize: 10, color: 'var(--color-amber)', marginTop: 3 }}>⚠ Approaching limit</div>}
                </div>
              ))}

              {/* Total footer */}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '2px solid var(--color-w2w-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Total Expenditure vs Budget</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>Across all cost centers</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: budgetUsedPct > 80 ? 'var(--color-red)' : 'var(--color-w2w)' }}>{budgetUsedPct}%</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>R{totalExpense.toLocaleString()} / R{totalBudget.toLocaleString()}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════
//  IMPACT METRICS TAB
// ═══════════════════════════════════════════════════

interface ImpactCardProps {
  label: string;
  value: string;
  sub: string;
  detail: string;
  color: string;
  icon: string;
}

function ImpactCard({ label, value, sub, detail, color, icon }: ImpactCardProps) {
  return (
    <div className="stat-card sc-blue" style={{ borderLeft: `4px solid ${color}`, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="stat-label" style={{ fontSize: 11 }}>{label}</div>
        <span style={{ fontSize: 20 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text3)' }}>{sub}</div>
      <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--color-border)' }}>{detail}</div>
    </div>
  );
}

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
  // Fetch P&L transaction data
  const { data: txData } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: () => transactionsApi.list(),
  });

  // Fetch sites for cooperative viability
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });
  const sites: any[] = Array.isArray(sitesData) ? sitesData : sitesData?.data || [];

  // Fetch employees for jobs/income data
  const { data: empData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesApi.list({}),
  });
  const employees: any[] = empData?.data || [];

  // Fetch logs for site revenue
  const { data: logData } = useQuery({
    queryKey: ['waste-logs', 'all'],
    queryFn: () => wasteLogsApi.list({}),
  });
  const logs: any[] = logData?.data || [];

  const transactions: any[] = txData?.data || [];
  const totalRevenue = txData?.summary?.totalRevenue || totalValue;
  const totalInvestment = txData?.summary?.totalExpense || 0;

  // Jobs = active field workers / collectors (W2W IS the job)
  const activeEmps = employees.filter((e: any) => (e.status || '').toUpperCase() === 'ACTIVE');
  const fieldWorkers = activeEmps.filter((e: any) =>
    (e.role || '').toLowerCase().includes('collect') ||
    (e.role || '').toLowerCase().includes('field') ||
    (e.department || '').toLowerCase().includes('field')
  );
  const jobsCreated = fieldWorkers.length || collectors;

  // Cost per job
  const costPerJob = jobsCreated > 0 ? Math.round(totalInvestment / jobsCreated) : 0;

  // Revenue per beneficiary
  const revPerBen = jobsCreated > 0 ? Math.round(totalRevenue / jobsCreated) : 0;

  // Tonnes
  const totalTonnes = (totalKg / 1000).toFixed(2);

  // ROI
  const roi = totalInvestment > 0 ? Math.round(((totalRevenue - totalInvestment) / totalInvestment) * 100) : 0;
  const roiColor = roi >= 0 ? 'var(--color-green)' : 'var(--color-red)';

  // Income uplift (from employee records if available)
  const withBothIncomes = activeEmps.filter((e: any) => (e.preIncomeMonthly || 0) > 0 && (e.currentIncome || e.dailyRate * 22 || 0) > 0);
  const avgPreInc = withBothIncomes.length > 0 ? Math.round(withBothIncomes.reduce((s: number, e: any) => s + (e.preIncomeMonthly || 0), 0) / withBothIncomes.length) : 0;
  const avgCurInc = withBothIncomes.length > 0 ? Math.round(withBothIncomes.reduce((s: number, e: any) => s + (e.currentIncome || e.dailyRate * 22 || 0), 0) / withBothIncomes.length) : 0;
  const avgUplift = avgCurInc - avgPreInc;
  const upliftPct = avgPreInc > 0 ? Math.round((avgUplift / avgPreInc) * 100) : 0;

  // Cost of Sales breakdown
  const cosCats = ['HR Costs', 'Systems Costs', 'Site Clearing Costs', 'Project Management Fees'];
  const cosColors = ['#146484', '#7c3aed', '#d97706', '#15803d'];
  const cosData = cosCats.map((cat) => {
    const amt = transactions
      .filter((t: any) => t.type === 'EXPENSE' && t.category && t.category.toLowerCase().includes(cat.toLowerCase().split(' ')[0]))
      .reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    return { cat, amt };
  });
  const totalCoS = cosData.reduce((s, d) => s + d.amt, 0);
  const cosCostPerBen = jobsCreated > 0 ? Math.round(totalCoS / jobsCreated) : 0;

  // Cooperatives (matching W2W reference prototype)
  const COOPERATIVES = [
    { id: 'COOP-001', name: 'Florida Lake Green Collective', siteId: 'SITE-001', region: 'Region C' },
    { id: 'COOP-002', name: 'Fleurhof Recyclers Cooperative', siteId: 'SITE-002', region: 'Region C' },
    { id: 'COOP-003', name: 'Doornkop Waste Enterprise', siteId: 'SITE-003', region: 'Region C' },
    { id: 'COOP-004', name: 'Zandspruit Community Sorters', siteId: 'SITE-004', region: 'Region C' },
    { id: 'COOP-005', name: 'Newtown Recycle Cooperative', siteId: 'SITE-005', region: 'Region F' },
    { id: 'COOP-006', name: 'Marshalltown Waste Pickers Coop', siteId: 'SITE-006', region: 'Region F' },
    { id: 'COOP-007', name: 'Naledi Community Collective', siteId: 'SITE-007', region: 'Region D' },
    { id: 'COOP-008', name: 'Jabulani Rail Recyclers', siteId: 'SITE-008', region: 'Region D' },
    { id: 'COOP-009', name: 'Jabulile Youth Recyclers', siteId: 'SITE-009', region: 'Region G' },
    { id: 'COOP-010', name: 'Sepona Park Waste Enterprise', siteId: 'SITE-010', region: 'Region G' },
    { id: 'COOP-011', name: 'Lenasia Recyclers Cooperative', siteId: 'SITE-011', region: 'Region G' },
    { id: 'COOP-012', name: 'Zodiac School Community Coop', siteId: 'SITE-012', region: 'Region G' },
    { id: 'COOP-013', name: 'Alice Street Sorters', siteId: 'SITE-013', region: 'Region G' },
    { id: 'COOP-014', name: 'Pikitup Garden Waste Coop', siteId: 'SITE-014', region: 'Region G' },
    { id: 'COOP-015', name: 'Freedom Park Waste Collective', siteId: 'SITE-015', region: 'Region G' },
  ];

  // Map DB site IDs for matching
  const siteIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    sites.forEach((s: any) => { map[s.name?.toLowerCase().split(' ')[0] || ''] = s.id; });
    return map;
  }, [sites]);

  // Cooperative viability — match cooperatives to DB sites by name prefix
  const coopViability = useMemo(() => {
    return COOPERATIVES.map((co) => {
      // Try to match cooperative's reference siteId to a real DB site
      const matchedSite = sites.find((s: any) =>
        s.id === co.siteId ||
        (s.name && co.name.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]))
      );
      const siteId = matchedSite?.id;
      const siteLogs = siteId ? logs.filter((l: any) => l.siteId === siteId) : [];
      const rev = siteLogs.reduce((s: number, l: any) => s + (Number(l.totalValue) || 0), 0);
      const members = siteId ? employees.filter((e: any) => e.siteId === siteId && (e.status || '').toUpperCase() === 'ACTIVE').length : 0;
      const name = co.name.length > 30 ? co.name.slice(0, 30) + '…' : co.name;
      return { name, region: co.region, rev: Math.round(rev), members, logs: siteLogs.length };
    }).sort((a, b) => b.rev - a.rev);
  }, [sites, logs, employees]);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Explainer banner */}
      <div className="alert alert-blue" style={{ marginBottom: 16 }}>
        <span>
          <b>W2W is the job.</b> Jobs created = total enrolled programme beneficiaries.
          Cost per job = total programme investment ÷ enrolled beneficiaries.
          Income uplift = what participants earned as informal pickers <b>before</b> W2W vs their current W2W stipend.
        </span>
      </div>

      {/* Row 1 — Core KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        <ImpactCard
          label="Programme Jobs Created" value={String(jobsCreated)} sub="All enrolled W2W beneficiaries" color="var(--color-green)" icon="🏆"
          detail="W2W enrolment = formal programme job opportunity"
        />
        <ImpactCard
          label="Cost Per Job Created" value={fmtZAR(costPerJob)} sub="Total investment ÷ beneficiaries" color="#146484" icon="💼"
          detail={`Total spend: ${fmtZAR(totalInvestment)} across ${jobsCreated} jobs`}
        />
        <ImpactCard
          label="Return on Investment" value={roi + '%'} sub="Revenue vs total programme investment" color={roiColor} icon="📊"
          detail={`(Revenue − Investment) ÷ Investment · ${fmtZAR(totalRevenue)} revenue · ${fmtZAR(totalInvestment)} invested`}
        />
      </div>

      {/* Row 2 — Revenue, Tonnes, Uplift */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <ImpactCard
          label="Revenue Per Beneficiary" value={fmtZAR(revPerBen)} sub="Waste sales revenue ÷ beneficiaries" color="var(--color-green)" icon="💰"
          detail={`${fmtZAR(totalRevenue)} total revenue · ${jobsCreated} beneficiaries`}
        />
        <ImpactCard
          label="Tonnes Diverted from Landfill" value={totalTonnes + 't'} sub="All EPR waste collected to date" color="#146484" icon="♻"
          detail={`${deliveries} depot deliveries across all sites`}
        />
        <ImpactCard
          label="Income Uplift Per Participant"
          value={avgUplift > 0 ? fmtZAR(avgUplift) + '/month' : 'Capture baseline data'}
          sub="Pre-W2W informal income → W2W stipend"
          color={avgUplift > 0 ? 'var(--color-green)' : 'var(--color-amber)'}
          icon="📈"
          detail={withBothIncomes.length > 0
            ? `Pre-W2W avg: ${fmtZAR(avgPreInc)} → W2W stipend avg: ${fmtZAR(avgCurInc)} (${upliftPct}% uplift) · ${withBothIncomes.length} tracked`
            : `Set "Current W2W Stipend" in employee records to unlock this KPI`}
        />
      </div>

      {/* Cost of Sales + Site Viability */}
      <div className="g2" style={{ marginBottom: 16 }}>
        {/* Cost of Sales */}
        <div className="card">
          <div className="ch">
            <div className="ct">Cost of Sales — Investment Breakdown</div>
            <div className="cs">What it costs to develop one waste recycler</div>
          </div>
          <div className="cb">
            {cosData.map((d, i) => {
              const pct = totalCoS > 0 ? Math.round((d.amt / totalCoS) * 100) : 0;
              return (
                <div key={d.cat} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{d.cat}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: cosColors[i] }}>{fmtZAR(d.amt)}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text3)', marginLeft: 6 }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-surface3)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: cosColors[i], borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '2px solid var(--color-w2w-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--color-surface3)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase' }}>Total CoS</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#146484' }}>{fmtZAR(totalCoS)}</div>
              </div>
              <div style={{ background: 'var(--color-surface3)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase' }}>CoS / Beneficiary</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#7c3aed' }}>{fmtZAR(cosCostPerBen)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Cooperative / Site Viability */}
        <div className="card">
          <div className="ch">
            <div className="ct">Cooperative Viability</div>
            <div className="cs">Waste revenue generated per site — building towards self-sustainability</div>
          </div>
          {coopViability.length === 0 ? (
            <div className="cb" style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 32 }}>
              No sites configured.
            </div>
          ) : (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Cooperative / Site</th>
                    <th>Region</th>
                    <th>Members</th>
                    <th>Deliveries</th>
                    <th>Revenue</th>
                    <th>Viability</th>
                  </tr>
                </thead>
                <tbody>
                  {coopViability.slice(0, 10).map((co) => (
                    <tr key={co.name}>
                      <td style={{ fontSize: 11, fontWeight: 600 }}>{co.name}</td>
                      <td><span className="badge bb" style={{ fontSize: 10 }}>{co.region}</span></td>
                      <td style={{ textAlign: 'center' }}>{co.members}</td>
                      <td style={{ textAlign: 'center' }}>{co.logs}</td>
                      <td style={{ fontWeight: 700, color: co.rev > 0 ? 'var(--color-green)' : 'var(--color-text3)' }}>
                        {co.rev > 0 ? 'R ' + co.rev.toLocaleString() : '—'}
                      </td>
                      <td>
                        {co.rev > 0
                          ? <span style={{ color: 'var(--color-green)', fontWeight: 700 }}>● Active</span>
                          : <span style={{ color: 'var(--color-text3)' }}>○ Pending</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Income uplift data completeness */}
      {withBothIncomes.length < jobsCreated && jobsCreated > 0 && (
        <div className="alert alert-amber">
          <span>
            <b>{jobsCreated - withBothIncomes.length} beneficiaries</b> are missing income uplift data.
            Open each employee record → Income Uplift Tracking → enter their monthly income <b>before joining W2W</b> and their <b>current W2W stipend</b>.
            This unlocks the Income Uplift KPI for funders and EPR impact reporting.
          </span>
        </div>
      )}
    </div>
  );
}
