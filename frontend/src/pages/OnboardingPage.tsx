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

  // ── Stats based on actual onboardStatus ──
  const completedOnboard = useMemo(() =>
    employees.filter((e: any) => e.onboardStatus === 'Complete'),
  [employees]);

  const inProgressOnboard = useMemo(() =>
    employees.filter((e: any) => {
      const ob = e.onboardStatus || '';
      return ob !== 'Complete' && (e.status === 'ACTIVE' || e.status === 'PROBATION');
    }),
  [employees]);

  const pendingOnboard = useMemo(() =>
    employees.filter((e: any) => {
      const ob = e.onboardStatus || '';
      return ob !== 'Complete' && (e.status === 'ACTIVE' || e.status === 'PROBATION');
    }),
  [employees]);

  const totalActive = employees.filter((e: any) => e.status === 'ACTIVE' || e.status === 'PROBATION').length;

  // ── Mutations for Issue / Complete ──
  const issueMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      employeesApi.update(id, payload as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || "Something went wrong."),
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
          <div className="ps">{totalActive} active employee{totalActive === 1 ? '' : 's'} · {inProgressOnboard.length} in progress</div>
        </div>
      </div>

      {/* Info alert */}
      <div className="alert alert-blue" style={{ marginBottom: 14 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
        </svg>
        <span>Issue uniform and PPE, then mark onboarding as complete for each employee.</span>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Employees" value={String(totalActive)} sub="Active & Probation" icon="👥" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="In Progress" value={String(inProgressOnboard.length)} sub="Awaiting steps" icon="⏳" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Completed" value={String(completedOnboard.length)} sub="Onboarding done" icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Pending Onboard" value={String(pendingOnboard.length)} sub="Uniform / PPE needed" icon="📋" rail="sc-purple" color="var(--color-purple)" />
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
                  // Use actual assigned training count; if none assigned, training is satisfied
                  const mandatoryTotal = emp.trainings?.filter((t: any) => t.trainingModule?.type === 'MANDATORY').length || 0;
                  const hasTraining = mandatoryTotal > 0;
                  const pct = hasTraining ? Math.round((trainingCount / mandatoryTotal) * 100) : 100;
                  const ob = emp.onboardStatus || 'In Progress';
                  const isComplete = ob === 'Complete';
                  const canComplete = uniformOk && ppeOk;

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
                        {hasTraining ? (
                          <>
                            <div className="pb" style={{ marginBottom: 3 }}>
                              <div className="pf pf-b" style={{ width: pct + '%' }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>
                              {trainingCount}/{mandatoryTotal} ({pct}%)
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--color-text3)' }}>✓ No mandatory training</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isComplete ? 'bg' : 'ba'}`} style={{ fontSize: 10 }}>
                          {ob}
                        </span>
                      </td>
                      <td>
                        {isComplete ? (
                          <span className="badge bg" style={{ fontSize: 10 }}>✓ Completed</span>
                        ) : canComplete ? (
                          <button
                            className="btn btn-accent btn-sm"
                            style={{ fontSize: 10 }}
                            onClick={() => handleCompleteOnboard(emp)}
                            disabled={issueMut.isPending}
                          >
                            Complete
                          </button>
                        ) : (
                          <div style={{ fontSize: 10, color: 'var(--color-text3)', lineHeight: 1.5 }}>
                            {(() => {
                              const pending: string[] = [];
                              if (!uniformOk) pending.push('Uniform');
                              if (!ppeOk) pending.push('PPE');
                              return pending.length > 0
                                ? <span style={{ color: 'var(--color-amber)' }}>⏳ Awaiting {pending.join(' & ')}</span>
                                : <span style={{ color: 'var(--color-green)' }}>✓ Ready to complete</span>;
                            })()}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

