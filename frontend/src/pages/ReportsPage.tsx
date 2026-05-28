import { useNavStore } from '../stores/navStore';

type ReportCard = {
  icon: string;
  title: string;
  sub: string;
  route: string;
  color: string;
};

const REPORTS: ReportCard[] = [
  { icon: '♻', title: 'Waste Collection Report', sub: 'Tonnage by category · Site comparison · Monthly trend · Revenue', route: 'waste-report', color: '#146484' },
  { icon: '🎓', title: 'Training Compliance Report', sub: 'Compliance rates · Per-module breakdown · Site matrix', route: 'training-report', color: '#15803d' },
  { icon: '👥', title: 'Demographic Report', sub: 'Gender · Race · Region breakdown · Employment equity', route: 'demographics-report', color: '#7c3aed' },
  { icon: '⏰', title: 'Attendance Report', sub: 'Daily trends · Hours worked · Punctuality analysis', route: 'attendance-report', color: '#d97706' },
  { icon: '💰', title: 'P&L Financial Report', sub: 'Revenue vs Expenditure · Monthly trend · Cost centres', route: 'pl-report', color: '#c0392b' },
];

export default function ReportsPage() {
  const { setActivePage } = useNavStore();

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Reports &amp; Analytics</div>
          <div className="ps">Visual dashboard reports · Filter · Print · Export to Excel</div>
        </div>
        <div className="report-actions" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print / Save PDF</button>
        </div>
      </div>

      <div className="g2" style={{ marginBottom: 20 }}>
        {REPORTS.map((r) => (
          <div
            key={r.route}
            className="card"
            style={{
              padding: 0, overflow: 'hidden', cursor: 'pointer',
              transition: 'all 0.15s', borderLeft: `4px solid ${r.color}`,
            }}
            onClick={() => setActivePage(r.route)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{r.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--color-text1)', marginBottom: 5 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text3)', marginBottom: 12, lineHeight: 1.5 }}>{r.sub}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={(e) => { e.stopPropagation(); setActivePage(r.route); }}
                >View Report</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
