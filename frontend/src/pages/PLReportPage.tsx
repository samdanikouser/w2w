import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '../api/endpoints';
import { useNavStore } from '../stores/navStore';
import { exportCsv } from '../utils/csv';
import SvgLineChart from '../components/charts/SvgLineChart';
import type { ReportFilter } from '../components/charts/ReportFilterBar';
import { ReportFilterBar, DEFAULT_FILTER, matchesFilter } from '../components/charts/ReportFilterBar';

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

const fmtZAR = (n: number) => 'R ' + Math.round(Math.abs(n)).toLocaleString('en-ZA');
const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function PLReportPage() {
  const { setActivePage } = useNavStore();
  const [filter, setFilter] = useState<ReportFilter>(DEFAULT_FILTER);

  // ── Data fetching ──
  const { data: txResponse, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', 'pl-report'],
    queryFn: () => transactionsApi.list({ limit: '9999' }),
  });

  const allTransactions: Record<string, unknown>[] = txResponse?.data || [];
  const transactions = useMemo(() => allTransactions.filter(t => matchesFilter(String(t.date || ''), filter)), [allTransactions, filter]);
  const summary = txResponse?.summary || { totalRevenue: 0, totalExpense: 0, net: 0 };

  // Available years for filter
  const availableYears = useMemo(() => {
    const yrs = new Set<string>();
    allTransactions.forEach(t => {
      const y = String(t.date || '').slice(0, 4);
      if (y && y.length === 4) yrs.add(y);
    });
    return Array.from(yrs).sort();
  }, [allTransactions]);

  // ── Cost centers from localStorage ──
  const costCenters = useMemo(() => {
    try {
      const raw = localStorage.getItem('w2w_programme_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.costCenters)) return parsed.costCenters as string[];
      }
    } catch { /* ignore */ }
    return [] as string[];
  }, []);

  // ═══════════════════════════════════════════════
  //  Computed analytics
  // ═══════════════════════════════════════════════

  const analytics = useMemo(() => {
    const revenue = transactions.filter((t) => String(t.type || '').toUpperCase() === 'REVENUE');
    const expense = transactions.filter((t) => String(t.type || '').toUpperCase() === 'EXPENSE');

    const totalRevenue = filter.mode === 'all'
      ? (summary.totalRevenue || revenue.reduce((s, t) => s + (Number(t.amount) || 0), 0))
      : revenue.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalExpense = filter.mode === 'all'
      ? (summary.totalExpense || expense.reduce((s, t) => s + (Number(t.amount) || 0), 0))
      : expense.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netSurplus = filter.mode === 'all' ? (summary.net ?? (totalRevenue - totalExpense)) : (totalRevenue - totalExpense);

    // Budget utilisation (if budget info exists in settings)
    let budgetTotal = 0;
    try {
      const raw = localStorage.getItem('w2w_programme_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        budgetTotal = Number(parsed?.totalBudget) || 0;
      }
    } catch { /* ignore */ }
    const budgetUtil = budgetTotal > 0 ? Math.round((totalExpense / budgetTotal) * 100) : 0;

    // Monthly aggregation
    const monthRevenue = new Map<string, number>();
    const monthExpense = new Map<string, number>();

    revenue.forEach((t) => {
      const m = String(t.date || '').slice(0, 7);
      if (m) monthRevenue.set(m, (monthRevenue.get(m) || 0) + (Number(t.amount) || 0));
    });
    expense.forEach((t) => {
      const m = String(t.date || '').slice(0, 7);
      if (m) monthExpense.set(m, (monthExpense.get(m) || 0) + (Number(t.amount) || 0));
    });

    const allMonths = new Set([...monthRevenue.keys(), ...monthExpense.keys()]);
    const monthlyData = Array.from(allMonths)
      .sort()
      .map((m) => {
        const rev = monthRevenue.get(m) || 0;
        const exp = monthExpense.get(m) || 0;
        return {
          month: m,
          revenue: rev,
          expense: exp,
          net: rev - exp,
          margin: rev > 0 ? Math.round(((rev - exp) / rev) * 100) : 0,
        };
      });

    // Revenue by category
    const revCatMap = new Map<string, number>();
    revenue.forEach((t) => {
      const cat = String(t.category || 'Uncategorised');
      revCatMap.set(cat, (revCatMap.get(cat) || 0) + (Number(t.amount) || 0));
    });
    const revCategories = Array.from(revCatMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Expense by category
    const expCatMap = new Map<string, number>();
    expense.forEach((t) => {
      const cat = String(t.category || 'Uncategorised');
      expCatMap.set(cat, (expCatMap.get(cat) || 0) + (Number(t.amount) || 0));
    });
    const expCategories = Array.from(expCatMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Cost center utilisation
    const ccMap = new Map<string, number>();
    expense.forEach((t) => {
      const cc = String(t.category || 'Other');
      if (costCenters.length === 0 || costCenters.includes(cc)) {
        ccMap.set(cc, (ccMap.get(cc) || 0) + (Number(t.amount) || 0));
      }
    });
    const costCenterData = Array.from(ccMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Period range
    const dates = transactions.map((t) => String(t.date || '')).filter(Boolean).sort();
    const periodStart = dates[0] || '';
    const periodEnd = dates[dates.length - 1] || '';

    return {
      totalRevenue,
      totalExpense,
      netSurplus,
      budgetUtil,
      budgetTotal,
      monthlyData,
      revCategories,
      expCategories,
      costCenterData,
      periodStart,
      periodEnd,
      monthCount: monthlyData.length,
    };
  }, [transactions, summary, costCenters, filter]);

  // ── Donut helpers ──
  const CAT_COLORS = ['#15803d', '#146484', '#d97706', '#8e44ad', '#e74c3c', '#16a085', '#2980b9', '#e67e22', '#922b21', '#5d6d7e'];

  const makeDonut = (items: { name: string; amount: number }[]) => {
    const total = items.reduce((s, i) => s + i.amount, 0);
    if (total === 0) return 'conic-gradient(var(--color-surface3) 0deg 360deg)';
    const segments: string[] = [];
    let cumDeg = 0;
    items.forEach((item, idx) => {
      const deg = (item.amount / total) * 360;
      segments.push(`${CAT_COLORS[idx % CAT_COLORS.length]} ${cumDeg}deg ${cumDeg + deg}deg`);
      cumDeg += deg;
    });
    return `conic-gradient(${segments.join(', ')})`;
  };

  // ── Excel export ──
  const handleExport = () => {
    exportCsv('pl-report', analytics.monthlyData as unknown as Record<string, unknown>[], [
      { key: 'month', label: 'Month' },
      { key: 'revenue', label: 'Revenue (R)', map: (r: Record<string, unknown>) => Math.round(Number(r.revenue) || 0) },
      { key: 'expense', label: 'Expenditure (R)', map: (r: Record<string, unknown>) => Math.round(Number(r.expense) || 0) },
      { key: 'net', label: 'Net P&L (R)', map: (r: Record<string, unknown>) => Math.round(Number(r.net) || 0) },
      { key: 'margin', label: 'Margin %' },
    ]);
  };

  // ── Chart scaling ──
  const maxCCAmount = analytics.costCenterData[0]?.amount || 1;

  const fmtMonth = (m: string) => {
    const parts = m.split('-');
    if (parts.length === 2) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
    }
    return m;
  };

  // ── Line chart data ──
  const revByMonth = analytics.monthlyData.map(m => ({ label: m.month.slice(2).replace('-', '/'), value: m.revenue }));
  const expByMonth = analytics.monthlyData.map(m => ({ label: m.month.slice(2).replace('-', '/'), value: m.expense }));
  const netByMonth = analytics.monthlyData.map(m => ({ label: m.month.slice(2).replace('-', '/'), value: m.net }));

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
            💰 P&amp;L Financial Report
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text3)', marginTop: 3 }}>
            Programme Profit &amp; Loss Statement · W2W Pilot · City of Johannesburg
          </div>
        </div>
        <div style={{
          textAlign: 'right', fontSize: 11, color: 'var(--color-text3)', lineHeight: 1.7,
        }}>
          <div><b style={{ color: 'var(--color-text2)' }}>Generated:</b> {fmtDate(new Date())}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Period:</b> {analytics.periodStart ? `${analytics.periodStart} — ${analytics.periodEnd}` : 'N/A'}</div>
          <div><b style={{ color: 'var(--color-text2)' }}>Months:</b> {analytics.monthCount}</div>
        </div>
      </div>

      {/* ═══ Action Buttons ═══ */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={() => setActivePage('reports')}>
          ← Back to Reports
        </button>
        <button className="btn btn-ghost" onClick={() => setActivePage('pl-register')}>
          📋 Full P&amp;L Entry Register
        </button>
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨 Print / PDF
        </button>
        <button className="btn btn-ghost" onClick={handleExport}>
          📥 Export to Excel
        </button>
      </div>

      <ReportFilterBar filter={filter} onChange={setFilter} years={availableYears} />

      {/* ═══ Loading state ═══ */}
      {txLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text3)' }}>
          Loading financial data…
        </div>
      )}

      {!txLoading && (
        <>
          {/* ═══ KPI Row (4 cards) ═══ */}
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <div className="stat-card card" style={{ borderBottom: '3px solid #15803d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Total Revenue</div>
                <span style={{ fontSize: 18 }}>💚</span>
              </div>
              <div className="stat-val" style={{ color: '#15803d' }}>{fmtZAR(analytics.totalRevenue)}</div>
              <div className="stat-sub">All income streams</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #dc2626' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Total Expenditure</div>
                <span style={{ fontSize: 18 }}>🔴</span>
              </div>
              <div className="stat-val" style={{ color: '#dc2626' }}>{fmtZAR(analytics.totalExpense)}</div>
              <div className="stat-sub">All expense categories</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: `3px solid ${analytics.netSurplus >= 0 ? '#15803d' : '#dc2626'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Net {analytics.netSurplus >= 0 ? 'Surplus' : 'Deficit'}</div>
                <span style={{ fontSize: 18 }}>{analytics.netSurplus >= 0 ? '📈' : '📉'}</span>
              </div>
              <div className="stat-val" style={{ color: analytics.netSurplus >= 0 ? '#15803d' : '#dc2626' }}>
                {analytics.netSurplus >= 0 ? '' : '-'}{fmtZAR(analytics.netSurplus)}
              </div>
              <div className="stat-sub">Revenue minus expenditure</div>
            </div>

            <div className="stat-card card" style={{ borderBottom: '3px solid #7c3aed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div className="stat-label">Budget Utilisation</div>
                <span style={{ fontSize: 18 }}>📊</span>
              </div>
              <div className="stat-val" style={{ color: '#7c3aed' }}>
                {analytics.budgetTotal > 0 ? `${analytics.budgetUtil}%` : 'N/A'}
              </div>
              <div className="stat-sub">{analytics.budgetTotal > 0 ? `of ${fmtZAR(analytics.budgetTotal)} budget` : 'No budget set'}</div>
            </div>
          </div>

          {/* ═══ Charts Row 1 — Revenue Trend + Expenditure Trend ═══ */}
          <div className="g2 mb14">
            {/* Revenue Trend */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Revenue Trend</div>
                  <div className="cs">Monthly income breakdown</div>
                </div>
              </div>
              <div className="cb">
                <SvgLineChart data={revByMonth} color="#15803d" />
              </div>
            </div>

            {/* Expenditure Trend */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Expenditure Trend</div>
                  <div className="cs">Monthly expense breakdown</div>
                </div>
              </div>
              <div className="cb">
                <SvgLineChart data={expByMonth} color="#c0392b" />
              </div>
            </div>
          </div>

          {/* ═══ Net Surplus/Deficit Trend (full width) ═══ */}
          <div className="card mb14">
            <div className="ch">
              <div>
                <div className="ct">Net Surplus / Deficit Trend</div>
                <div className="cs">Monthly net P&amp;L position</div>
              </div>
            </div>
            <div className="cb">
              <SvgLineChart data={netByMonth} color={analytics.netSurplus >= 0 ? '#15803d' : '#c0392b'} />
            </div>
          </div>

          {/* ═══ Charts Row 2 — Revenue by Category + Expenditure by Category ═══ */}
          <div className="g2 mb14">
            {/* Revenue by Category Donut */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Revenue by Category</div>
                  <div className="cs">Income breakdown by source</div>
                </div>
              </div>
              <div className="cb">
                {analytics.revCategories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No revenue data
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{
                      width: 150, height: 150, borderRadius: '50%',
                      background: makeDonut(analytics.revCategories),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        width: 85, height: 85, borderRadius: '50%',
                        background: 'var(--color-surface)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d', letterSpacing: '-0.03em' }}>
                          {fmtZAR(analytics.totalRevenue)}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text3)' }}>revenue</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                      {analytics.revCategories.slice(0, 6).map((c, i) => (
                        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                          <div style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', flexShrink: 0 }}>{fmtZAR(c.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expenditure by Category Donut */}
            <div className="card">
              <div className="ch">
                <div>
                  <div className="ct">Expenditure by Category</div>
                  <div className="cs">Spend breakdown by cost type</div>
                </div>
              </div>
              <div className="cb">
                {analytics.expCategories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)', fontSize: 12 }}>
                    No expenditure data
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{
                      width: 150, height: 150, borderRadius: '50%',
                      background: makeDonut(analytics.expCategories),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        width: 85, height: 85, borderRadius: '50%',
                        background: 'var(--color-surface)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.03em' }}>
                          {fmtZAR(analytics.totalExpense)}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--color-text3)' }}>expense</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
                      {analytics.expCategories.slice(0, 6).map((c, i) => (
                        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                          <div style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', flexShrink: 0 }}>{fmtZAR(c.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Budget Utilisation by Cost Center ═══ */}
          {analytics.costCenterData.length > 0 && (
            <div className="card mb14">
              <div className="ch">
                <div>
                  <div className="ct">Budget Utilisation by Cost Center</div>
                  <div className="cs">Expense distribution across cost centers</div>
                </div>
              </div>
              <div className="cb">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {analytics.costCenterData.map((cc, idx) => {
                    const pct = Math.max((cc.amount / maxCCAmount) * 100, 3);
                    const barColors = ['#7c3aed', '#146484', '#d97706', '#15803d', '#dc2626', '#e67e22', '#8e44ad', '#16a085'];
                    return (
                      <div key={cc.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{cc.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-text2)', fontFamily: 'var(--font-mono)' }}>
                            {fmtZAR(cc.amount)}
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
              </div>
            </div>
          )}

          {/* ═══ Monthly P&L Summary Table ═══ */}
          <div className="card">
            <div className="ch">
              <div>
                <div className="ct">Monthly P&amp;L Summary</div>
                <div className="cs">Revenue vs expenditure by month</div>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Expenditure</th>
                    <th style={{ textAlign: 'right' }}>Net P&amp;L</th>
                    <th style={{ textAlign: 'right' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.monthlyData.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text3)' }}>
                        No transaction data
                      </td>
                    </tr>
                  ) : (
                    <>
                      {analytics.monthlyData.map((m) => (
                        <tr key={m.month}>
                          <td style={{ fontWeight: 600 }}>{fmtMonth(m.month)}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#15803d', fontWeight: 600 }}>
                            {fmtZAR(m.revenue)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#dc2626', fontWeight: 600 }}>
                            {fmtZAR(m.expense)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: m.net >= 0 ? '#15803d' : '#dc2626' }}>
                            {m.net >= 0 ? '' : '-'}{fmtZAR(m.net)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                            {m.margin}%
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr style={{ background: '#146484', color: 'white', fontWeight: 700 }}>
                        <td style={{ color: 'white' }}><span style={{ fontWeight: 800 }}>TOTAL</span></td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white' }}>
                          {fmtZAR(analytics.totalRevenue)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white' }}>
                          {fmtZAR(analytics.totalExpense)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'white', fontSize: 13 }}>
                          {analytics.netSurplus >= 0 ? '' : '-'}{fmtZAR(analytics.netSurplus)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.8)' }}>
                          {analytics.totalRevenue > 0 ? Math.round(((analytics.totalRevenue - analytics.totalExpense) / analytics.totalRevenue) * 100) : 0}%
                        </td>
                      </tr>
                    </>
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
