import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../api/endpoints';
import { StatCard } from './SitesPage';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'badge bg',
  ON_LEAVE: 'badge ba',
  TERMINATED: 'badge br',
  PROBATION: 'badge bp',
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On Leave',
  TERMINATED: 'Terminated',
  PROBATION: 'Probation',
};

const STAGES = [
  { id: 'application', label: 'Application' },
  { id: 'docs', label: 'Documents' },
  { id: 'induction', label: 'Induction' },
  { id: 'ppe', label: 'PPE Issue' },
  { id: 'training', label: 'Initial Training' },
  { id: 'active', label: 'Active' },
];

function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const initials = (first?: string, last?: string) =>
  ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '—';

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];

  // ── Pipeline (funnel view) ──
  const pipeline = useMemo(() => {
    const today = new Date();
    return employees
      .map((e: any) => {
        const start = e.startDate ? new Date(e.startDate) : null;
        const daysIn = start ? Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 999;
        let stage = STAGES.length - 1;
        if (e.status === 'PROBATION' && daysIn < 30) stage = 4;
        else if (e.status === 'PROBATION' && daysIn < 7) stage = 3;
        else if (e.status === 'PROBATION' && daysIn < 3) stage = 2;
        else if (e.status === 'PROBATION') stage = 4;
        else if (e.status === 'ACTIVE' && daysIn < 30) stage = 5;
        else stage = STAGES.length - 1;
        return { ...e, daysIn, stage };
      })
      .filter((e: any) => e.status === 'PROBATION' || (e.status === 'ACTIVE' && e.daysIn < 60))
      .sort((a, b) => a.daysIn - b.daysIn);
  }, [employees]);

  const stageCounts = STAGES.map((_, idx) => pipeline.filter((p) => p.stage === idx).length);
  const inProgress = pipeline.filter((p) => p.stage < STAGES.length - 1).length;
  const completed = pipeline.filter((p) => p.stage === STAGES.length - 1).length;

  // ── Onboarding Pipeline (Uniform / PPE / Issue) ──
  const pendingOnboard = useMemo(() => {
    return employees.filter((e: any) => {
      const ob = e.onboardStatus || '';
      return ob !== 'Complete' && (e.status === 'ACTIVE' || e.status === 'PROBATION' || !ob);
    });
  }, [employees]);

  // ── Mutations for Issue / Complete ──
  const issueMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      employeesApi.update(id, payload as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const handleIssueUniform = (emp: any) => {
    issueMut.mutate({ id: emp.id, payload: { uniformIssued: true } });
  };
  const handleIssuePPE = (emp: any) => {
    issueMut.mutate({ id: emp.id, payload: { ppeIssued: true } });
  };
  const handleCompleteOnboard = (emp: any) => {
    issueMut.mutate({ id: emp.id, payload: { onboardStatus: 'Complete' } });
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Employee Onboarding</div>
          <div className="ps">{pipeline.length} new hire{pipeline.length === 1 ? '' : 's'} in pipeline · {inProgress} in progress</div>
        </div>
      </div>

      {/* Info alert */}
      <div className="alert alert-blue" style={{ marginBottom: 14 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
        </svg>
        <span>New employees are automatically assigned all mandatory training modules. Complete each checklist step to mark onboarding as complete.</span>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="In Pipeline" value={String(pipeline.length)} sub="Recent hires" icon="🚀" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="In Progress" value={String(inProgress)} sub="Awaiting steps" icon="⏳" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Completed (30d)" value={String(completed)} sub="Recently activated" icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Pending Onboard" value={String(pendingOnboard.length)} sub="Uniform / PPE / Training" icon="📋" rail="sc-purple" color="var(--color-purple)" />
      </div>

      {/* ── Onboarding Pipeline (matches prototype exactly) ── */}
      <div className="card mb14">
        <div className="ch">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="ct">Onboarding Pipeline</div>
            <span className="badge ba" style={{ fontSize: 10 }}>{pendingOnboard.length} pending</span>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Hire Date</th>
                <th>Uniform</th>
                <th>PPE</th>
                <th style={{ minWidth: 120 }}>Mandatory Training</th>
                <th>Status</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)' }}>
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map((emp: any) => {
                  const uniformOk = emp.uniformIssued === true;
                  const ppeOk = emp.ppeIssued === true;
                  const trainingCount = emp.trainingComplete ?? 0;
                  const mandatoryTotal = 5; // default mandatory training count
                  const pct = mandatoryTotal > 0 ? Math.round((trainingCount / mandatoryTotal) * 100) : 0;
                  const ob = emp.onboardStatus || 'In Progress';
                  const isComplete = ob === 'Complete';
                  const canComplete = uniformOk && ppeOk && pct >= 60;

                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avt" style={{ width: 26, height: 26, fontSize: 9, background: avatarColor(emp.id || emp.empNo) }}>
                            {initials(emp.firstName, emp.lastName)}
                          </div>
                          <b style={{ fontSize: 12 }}>{emp.firstName} {emp.lastName}</b>
                        </div>
                      </td>
                      <td style={{ fontSize: 11 }}>{emp.startDate ? new Date(emp.startDate).toLocaleDateString() : '—'}</td>
                      <td>
                        {uniformOk ? (
                          <span className="badge bg" style={{ fontSize: 10 }}>✓ Issued</span>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 10 }}
                            onClick={() => handleIssueUniform(emp)}
                            disabled={issueMut.isPending}
                          >
                            Issue
                          </button>
                        )}
                      </td>
                      <td>
                        {ppeOk ? (
                          <span className="badge bg" style={{ fontSize: 10 }}>✓ Issued</span>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 10 }}
                            onClick={() => handleIssuePPE(emp)}
                            disabled={issueMut.isPending}
                          >
                            Issue
                          </button>
                        )}
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div className="pb" style={{ marginBottom: 3 }}>
                          <div className="pf pf-b" style={{ width: pct + '%' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>
                          {trainingCount}/{mandatoryTotal} ({pct}%)
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isComplete ? 'bg' : 'ba'}`} style={{ fontSize: 10 }}>
                          {ob}
                        </span>
                      </td>
                      <td>
                        {!isComplete && canComplete ? (
                          <button
                            className="btn btn-accent btn-sm"
                            style={{ fontSize: 10 }}
                            onClick={() => handleCompleteOnboard(emp)}
                            disabled={issueMut.isPending}
                          >
                            Complete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}

