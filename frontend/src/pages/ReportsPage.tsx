import { useState } from 'react';
import { FileText, BarChart3, Recycle, DollarSign, Users, ClipboardCheck, AlertTriangle, BookOpen, Truck } from 'lucide-react';
import { useNavStore } from '../stores/navStore';
import NotWiredModal from '../components/ui/NotWiredModal';

type ReportRoute = {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  /** Navigate to a sidebar page (uses navStore.setActivePage) */
  navigateTo?: string;
};

const REPORTS: ReportRoute[] = [
  { id: 'waste-collection', icon: <Recycle size={20} />, title: 'Waste Collection Report', desc: 'Daily/weekly/monthly recyclables by site and category.', color: 'var(--color-w2w)', navigateTo: 'waste-logs' },
  { id: 'financial-pl', icon: <DollarSign size={20} />, title: 'P&L Financial Report', desc: 'Revenue vs expense, cost-centre roll-up, net position.', color: 'var(--color-green)', navigateTo: 'pl-register' },
  { id: 'training', icon: <BookOpen size={20} />, title: 'Training Compliance', desc: 'Modules completed, certifications expiring, % compliant.', color: 'var(--color-accent)', navigateTo: 'training' },
  { id: 'demographics', icon: <Users size={20} />, title: 'Demographic Report', desc: 'Equity and inclusion breakdowns of the workforce.', color: 'var(--color-purple)', navigateTo: 'demographics' },
  { id: 'attendance', icon: <ClipboardCheck size={20} />, title: 'Attendance Report', desc: 'Daily check-in / check-out summary, late & absent days.', color: 'var(--color-amber)', navigateTo: 'attendance' },
  { id: 'fleet', icon: <Truck size={20} />, title: 'Fleet Utilisation', desc: 'Vehicle uptime, fuel logs, maintenance compliance.', color: '#1a9ec4', navigateTo: 'vehicles' },
  { id: 'violations', icon: <AlertTriangle size={20} />, title: 'Disciplinary Summary', desc: 'Warnings, written notices, dismissals by category.', color: 'var(--color-red)', navigateTo: 'violations' },
  { id: 'epr', icon: <BarChart3 size={20} />, title: 'EPR Monthly Submission', desc: 'PRO-formatted EPR compliance pack for the period.', color: 'var(--color-w2w-mid)', navigateTo: 'epr-reports' },
];

export default function ReportsPage() {
  const { setActivePage } = useNavStore();
  const [notReady, setNotReady] = useState<ReportRoute | null>(null);

  const onOpen = (r: ReportRoute) => {
    if (r.navigateTo) setActivePage(r.navigateTo);
    else setNotReady(r);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Reports & Analytics</div>
          <div className="ps">{REPORTS.length} report templates · click a tile to open</div>
        </div>
      </div>

      <div className="g4">
        {REPORTS.map((r) => (
          <div
            key={r.id}
            className="card"
            onClick={() => onOpen(r)}
            style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
          >
            <div className="cb" style={{ padding: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: `${r.color}15`, color: r.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                {r.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text2)', lineHeight: 1.5 }}>{r.desc}</div>
              <button
                className="btn btn-ghost btn-sm mt14"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={(e) => { e.stopPropagation(); onOpen(r); }}
              >
                <FileText size={11} /> Open Report
              </button>
            </div>
          </div>
        ))}
      </div>

      {notReady && (
        <NotWiredModal
          open={!!notReady}
          onClose={() => setNotReady(null)}
          title={notReady.title}
          module={notReady.title}
        />
      )}
    </div>
  );
}
