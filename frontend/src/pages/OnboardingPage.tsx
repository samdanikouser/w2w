import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '../api/endpoints';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { StatCard } from './SitesPage';

const STAGES = [
  { id: 'application', label: 'Application' },
  { id: 'docs', label: 'Documents' },
  { id: 'induction', label: 'Induction' },
  { id: 'ppe', label: 'PPE Issue' },
  { id: 'training', label: 'Initial Training' },
  { id: 'active', label: 'Active' },
];

export default function OnboardingPage() {
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];

  // Pipeline derived from employee status: PROBATION = onboarding in progress; ACTIVE recent = newly onboarded
  const pipeline = useMemo(() => {
    const today = new Date();
    return employees
      .map((e: any) => {
        const start = e.startDate ? new Date(e.startDate) : null;
        const daysIn = start ? Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        // Crude stage allocation from status + tenure
        let stage = STAGES.length - 1;
        if (e.status === 'PROBATION' && daysIn < 30) stage = 4; // training
        else if (e.status === 'PROBATION' && daysIn < 7) stage = 3; // ppe
        else if (e.status === 'PROBATION' && daysIn < 3) stage = 2; // induction
        else if (e.status === 'PROBATION') stage = 4;
        else if (e.status === 'ACTIVE' && daysIn < 30) stage = 5;
        else stage = STAGES.length - 1;
        return { ...e, daysIn, stage };
      })
      .filter((e: any) => e.status === 'PROBATION' || (e.status === 'ACTIVE' && e.daysIn < 60))
      .sort((a, b) => a.daysIn - b.daysIn);
  }, [employees]);

  const stageCounts = STAGES.map((s, idx) => pipeline.filter((p) => p.stage === idx).length);
  const inProgress = pipeline.filter((p) => p.stage < STAGES.length - 1).length;
  const completed = pipeline.filter((p) => p.stage === STAGES.length - 1).length;

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Onboarding</div>
          <div className="ps">{pipeline.length} new hire{pipeline.length === 1 ? '' : 's'} in pipeline · {inProgress} in progress</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="In Pipeline" value={String(pipeline.length)} sub="Recent hires" icon="🚀" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="In Progress" value={String(inProgress)} sub="Awaiting steps" icon="⏳" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Completed (30d)" value={String(completed)} sub="Recently activated" icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Stages" value={String(STAGES.length)} sub="Per new hire" icon="📋" rail="sc-purple" color="var(--color-purple)" />
      </div>

      {/* Stage funnel */}
      <div className="card mb14">
        <div className="ch"><div className="ct">Onboarding Funnel</div><div className="cs">Pipeline distribution by stage</div></div>
        <div className="cb" style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGES.length}, 1fr)`, gap: 8 }}>
          {STAGES.map((stage, idx) => {
            const count = stageCounts[idx];
            return (
              <div key={stage.id} style={{
                padding: '14px 12px',
                background: count > 0 ? 'var(--color-w2w-pale)' : 'var(--color-surface2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: count > 0 ? 'var(--color-w2w)' : 'var(--color-text3)' }}>{count}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginTop: 4 }}>
                  {stage.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active onboarding list */}
      <div className="card">
        <div className="ch"><div className="ct">Active Onboarding</div><div className="cs">Click a row to mark steps complete</div></div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>New Hire</th>
                <th>Emp #</th>
                <th>Designation</th>
                <th>Site</th>
                <th>Start Date</th>
                <th>Days In</th>
                <th>Stage</th>
                <th style={{ width: 220 }}>Checklist</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No active onboardings. New hires set to <b>Probation</b> appear here automatically.
                </td></tr>
              ) : (
                pipeline.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.empNo}</td>
                    <td>{p.role || '—'}</td>
                    <td>{p.site?.name || p.siteName || '—'}</td>
                    <td>{p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'}</td>
                    <td>{p.daysIn} d</td>
                    <td><span className={`badge ${p.stage === STAGES.length - 1 ? 'bg' : 'ba'}`}>{STAGES[p.stage]?.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {STAGES.map((s, idx) => (
                          <span key={s.id} title={s.label}>
                            {idx < p.stage ? (
                              <CheckCircle2 size={14} style={{ color: 'var(--color-green)' }} />
                            ) : idx === p.stage ? (
                              <AlertCircle size={14} style={{ color: 'var(--color-amber)' }} />
                            ) : (
                              <Circle size={14} style={{ color: 'var(--color-text3)' }} />
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
