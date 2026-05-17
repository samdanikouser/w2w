import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { StatCard } from './SitesPage';

const MOCK_VARIANCE = [
  { id: 'v1', date: '2026-05-08', site: 'Diepkloof Depot', category: 'PET Bottles', expected: 412.0, actual: 398.5, variance: -13.5, varPct: -3.3, reason: 'Moisture loss after rain', resolved: false },
  { id: 'v2', date: '2026-05-07', site: 'Soweto Coop', category: 'Mixed Paper', expected: 880.0, actual: 892.0, variance: 12.0, varPct: 1.4, reason: '—', resolved: true },
  { id: 'v3', date: '2026-05-05', site: 'Alexandra', category: 'Aluminium Cans', expected: 64.0, actual: 51.3, variance: -12.7, varPct: -19.8, reason: 'Pending investigation', resolved: false },
  { id: 'v4', date: '2026-05-04', site: 'Orange Farm', category: 'Glass', expected: 230.0, actual: 230.0, variance: 0, varPct: 0, reason: '—', resolved: true },
  { id: 'v5', date: '2026-05-02', site: 'Diepkloof Depot', category: 'HDPE', expected: 154.0, actual: 162.0, variance: 8.0, varPct: 5.2, reason: 'Late-shift sort recovery', resolved: true },
];

export default function StockVariancePage() {
  const totalNeg = MOCK_VARIANCE.filter((v) => v.variance < 0).reduce((s, v) => s + Math.abs(v.variance), 0);
  const totalPos = MOCK_VARIANCE.filter((v) => v.variance > 0).reduce((s, v) => s + v.variance, 0);
  const open = MOCK_VARIANCE.filter((v) => !v.resolved).length;

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Stock Variance Report</div>
          <div className="ps">{MOCK_VARIANCE.length} reconciliation entries · {open} unresolved</div>
        </div>
      </div>

      <div className="alert alert-amber">
        <span>Stock-variance API isn't wired yet. Sample data shows how expected vs actual weights reconcile across sites and recyclable streams.</span>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Reconciliations" value={String(MOCK_VARIANCE.length)} sub="In period" icon="⚖" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Negative Variance" value={'-' + totalNeg.toFixed(1) + 'kg'} sub="Shortfall total" icon="📉" rail="sc-red" color="var(--color-red)" />
        <StatCard label="Positive Variance" value={'+' + totalPos.toFixed(1) + 'kg'} sub="Recovery total" icon="📈" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Open Cases" value={String(open)} sub="Under investigation" icon="🔍" rail="sc-amber" color="var(--color-amber)" />
      </div>

      <div className="card">
        <div className="ch"><div className="ct">Variance Register</div></div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Date</th><th>Site</th><th>Category</th><th>Expected (kg)</th><th>Actual (kg)</th><th>Variance</th><th>%</th><th>Reason</th><th>Status</th></tr>
            </thead>
            <tbody>
              {MOCK_VARIANCE.map((v) => (
                <tr key={v.id}>
                  <td>{v.date}</td>
                  <td style={{ fontWeight: 600 }}>{v.site}</td>
                  <td>{v.category}</td>
                  <td>{v.expected.toFixed(1)}</td>
                  <td>{v.actual.toFixed(1)}</td>
                  <td style={{ fontWeight: 700, color: v.variance < 0 ? 'var(--color-red)' : v.variance > 0 ? 'var(--color-green)' : 'var(--color-text3)' }}>
                    {v.variance > 0 ? <TrendingUp size={12} /> : v.variance < 0 ? <TrendingDown size={12} /> : null} {v.variance.toFixed(1)}
                  </td>
                  <td style={{ color: v.varPct < -5 ? 'var(--color-red)' : 'var(--color-text2)' }}>{v.varPct.toFixed(1)}%</td>
                  <td style={{ fontSize: 11, color: 'var(--color-text2)' }}>{v.reason}</td>
                  <td>
                    {v.resolved ? (
                      <span className="badge bg">Resolved</span>
                    ) : (
                      <span className="badge ba"><AlertCircle size={11} /> Open</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
