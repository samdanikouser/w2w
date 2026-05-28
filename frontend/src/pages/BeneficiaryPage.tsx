import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, sitesApi, trainingApi } from '../api/endpoints';
import { useNavStore } from '../stores/navStore';
import { StatCard } from './SitesPage';
import { exportCsv } from '../utils/csv';

// ── Helpers ──

function isFieldWorker(emp: any): boolean {
  const role = (emp.role || '').toLowerCase();
  const dept = (emp.department || '').toLowerCase();
  return (
    role.includes('collector') ||
    role.includes('sorter') ||
    role.includes('field') ||
    dept === 'collections' ||
    dept === 'sorting'
  );
}

function getPreIncome(emp: any): number {
  return Number(emp.preIncomeMonthly) || 0;
}

function getCurrentIncome(emp: any): number {
  return (
    Number(emp.currentIncome) ||
    Number(emp.stipend) ||
    (Number(emp.dailyRate) || 0) * 22 ||
    0
  );
}

function fmtRand(val: number): string {
  return 'R ' + Math.round(val).toLocaleString();
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(first: string, last: string): string {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase();
}

// ── Component ──

type TabKey = 'active' | 'uplift' | 'missing' | 'exited';

export default function BeneficiaryPage() {
  const { setActivePage } = useNavStore();
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  // ── Fetch data ──
  const { data: empData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesApi.list({}),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });
  const { data: trainingRecords } = useQuery({
    queryKey: ['training-records'],
    queryFn: () => trainingApi.listRecords(),
  });
  const { data: trainingModules } = useQuery({
    queryKey: ['training-modules'],
    queryFn: () => trainingApi.listModules(),
  });

  const employees: any[] = empData?.data || [];
  const sitesRaw: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const tRecords: any[] = Array.isArray(trainingRecords) ? trainingRecords : [];
  const tModules: any[] = Array.isArray(trainingModules) ? trainingModules : [];

  // Site lookup
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    sitesRaw.forEach((s: any) => m.set(s.id, s.name));
    return m;
  }, [sitesRaw]);

  // Filter field workers
  const fieldWorkers = useMemo(() => employees.filter(isFieldWorker), [employees]);

  // Enriched beneficiary records
  const beneficiaries = useMemo(() => {
    return fieldWorkers.map((emp: any) => {
      const preIncome = getPreIncome(emp);
      const currentIncome = getCurrentIncome(emp);
      const uplift = currentIncome - preIncome;
      const epwpRef = emp.epwpRef || '';
      const enrollDate = emp.enrollDate || emp.startDate || '';
      const exitDate = emp.exitDate || '';
      const exitReason = emp.exitReason || 'Not recorded';
      const siteName = siteMap.get(emp.siteId) || emp.site?.name || emp.siteName || '—';

      // Training: count completed / total modules
      const empTraining = tRecords.filter((r: any) => r.employeeId === emp.id);
      const completedTraining = empTraining.filter(
        (r: any) => (r.status || '').toUpperCase() === 'COMPLETED',
      ).length;
      const totalTraining = tModules.length || empTraining.length || 0;

      return {
        ...emp,
        preIncome,
        currentIncome,
        uplift,
        epwpRef,
        enrollDate,
        exitDate,
        exitReason,
        siteName,
        completedTraining,
        totalTraining,
      };
    });
  }, [fieldWorkers, siteMap, tRecords, tModules]);

  // ── Stat computations ──
  const activeBeneficiaries = beneficiaries.filter(
    (b) => (b.status || '').toUpperCase() === 'ACTIVE',
  );

  const incomeTracked = beneficiaries.filter((b) => b.preIncome > 0 && b.currentIncome > 0);
  const avgUplift =
    incomeTracked.length > 0
      ? incomeTracked.reduce((s, b) => s + b.uplift, 0) / incomeTracked.length
      : 0;

  // ── Tab-specific lists ──
  const exitedBeneficiaries = beneficiaries.filter((b) => {
    const st = (b.status || '').toUpperCase();
    return st === 'INACTIVE' || st === 'TERMINATED';
  });
  const missingBaseline = activeBeneficiaries.filter((b) => b.preIncome <= 0);

  // ── Export ──
  const handleExport = () => {
    exportCsv('beneficiary-tracker', beneficiaries, [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'empNo', label: 'Emp #' },
      { key: 'siteName', label: 'Site' },
      { key: 'epwpRef', label: 'EPWP Ref' },
      { key: 'enrollDate', label: 'Enrolled', map: (r: any) => fmtDate(r.enrollDate) },
      { key: 'preIncome', label: 'Pre-Income', map: (r: any) => r.preIncome },
      { key: 'currentIncome', label: 'Current Income', map: (r: any) => r.currentIncome },
      { key: 'uplift', label: 'Uplift', map: (r: any) => r.uplift },
      { key: 'status', label: 'Status' },
    ]);
  };



  // ── Income Uplift tab stats ──
  const avgPreIncome =
    incomeTracked.length > 0
      ? incomeTracked.reduce((s, b) => s + b.preIncome, 0) / incomeTracked.length
      : 0;
  const avgCurrentIncome =
    incomeTracked.length > 0
      ? incomeTracked.reduce((s, b) => s + b.currentIncome, 0) / incomeTracked.length
      : 0;
  const avgUpliftPct = avgPreIncome > 0 ? ((avgUplift / avgPreIncome) * 100).toFixed(0) : '0';

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Beneficiary Outcome Tracker</div>
          <div className="ps">
            Tracks who is enrolled in the W2W programme · Income uplift (before W2W vs current W2W stipend) · Exit reasons · All sites
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={handleExport}>
            📥 Export to Excel
          </button>
        </div>
      </div>

      {/* ── Explainer Alert ── */}
      <div className="alert alert-blue" style={{ marginBottom: 16 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
        </svg>
        <span>
          <b>W2W is the job.</b> This tracker shows who is enrolled (= employed), what their income was before joining W2W, what their current W2W stipend is, and why participants left if they exited.
          Income uplift = the difference between informal picking income before W2W and their current structured programme stipend.
        </span>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        <StatCard
          label="Active Beneficiaries"
          value={String(activeBeneficiaries.length)}
          sub="Currently enrolled in W2W"
          icon="👥"
          rail="sc-blue"
          color="#146484"
        />
        <StatCard
          label="Baseline Income Captured"
          value={`${incomeTracked.length} / ${activeBeneficiaries.length}`}
          sub="Pre-W2W income recorded"
          icon="📋"
          rail="sc-green"
          color={incomeTracked.length === activeBeneficiaries.length ? 'var(--color-green)' : '#f59e0b'}
        />
        <StatCard
          label="Avg Income Uplift"
          value={avgUplift > 0 ? `${fmtRand(avgUplift)}/mo` : 'Pending data'}
          sub={`Pre-W2W → W2W stipend · ${avgUpliftPct}%`}
          icon="📈"
          rail="sc-green"
          color={avgUplift > 0 ? 'var(--color-green)' : 'var(--color-text3)'}
        />
        <StatCard
          label="Total Exited"
          value={String(exitedBeneficiaries.length)}
          sub="Left the programme (any reason)"
          icon="🚪"
          rail="sc-amber"
          color={exitedBeneficiaries.length > 0 ? '#d97706' : 'var(--color-text3)'}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="tabs mb14">
        {[
          { key: 'active' as TabKey, label: `Active Beneficiaries (${activeBeneficiaries.length})` },
          { key: 'uplift' as TabKey, label: 'Income Uplift' },
          { key: 'missing' as TabKey, label: `Missing Baseline (${missingBaseline.length})` },
          { key: 'exited' as TabKey, label: `Exited (${exitedBeneficiaries.length})` },
        ].map((t) => (
          <div
            key={t.key}
            className={`tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            style={{ cursor: 'pointer' }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div style={{ marginTop: 20 }}>
        {activeTab === 'active' && (
          <ActiveTab beneficiaries={activeBeneficiaries} />
        )}
        {activeTab === 'uplift' && (
          <UpliftTab
            tracked={incomeTracked}
            avgPreIncome={avgPreIncome}
            avgCurrentIncome={avgCurrentIncome}
            avgUplift={avgUplift}
            avgUpliftPct={avgUpliftPct}
          />
        )}
        {activeTab === 'missing' && (
          <MissingBaselineTab missing={missingBaseline} onEditEmployee={(id) => setActivePage('employees', 'edit:' + id)} />
        )}
        {activeTab === 'exited' && (
          <ExitedTab exited={exitedBeneficiaries} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Tab 1: Active Beneficiaries
// ═══════════════════════════════════════════════

function ActiveTab({ beneficiaries }: { beneficiaries: any[] }) {
  return (
    <div className="card">
      <div className="ch">
        <div className="ct">Active W2W Beneficiaries</div>
        <div className="cs">W2W enrolment = programme job · each row = one job created</div>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Site</th>
              <th>Cooperative</th>
              <th>Enrolled</th>
              <th>Pre-W2W Income</th>
              <th>W2W Stipend</th>
              <th>Uplift</th>
              <th>Training</th>
            </tr>
          </thead>
          <tbody>
            {beneficiaries.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No active beneficiaries
                </td>
              </tr>
            ) : (
              beneficiaries.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--color-w2w-light)',
                          color: 'var(--color-w2w)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        {initials(b.firstName, b.lastName)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>
                          {b.firstName} {b.lastName}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--color-text3)',
                            fontFamily: 'var(--mono, monospace)',
                          }}
                        >
                          {b.empNo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{b.siteName}</td>
                  <td style={{ fontSize: 12 }}>{b.siteName !== '—' ? 'W2W Cooperative' : '—'}</td>
                  <td style={{ fontSize: 11 }}>{fmtDate(b.enrollDate)}</td>
                  <td style={{ fontSize: 12 }}>
                    {b.preIncome > 0 ? fmtRand(b.preIncome) : <span style={{ color: 'var(--color-text3)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-green)' }}>
                    {b.currentIncome > 0 ? fmtRand(b.currentIncome) : <span style={{ color: 'var(--color-text3)', fontWeight: 400 }}>—</span>}
                  </td>
                  <td>
                    {b.preIncome > 0 && b.currentIncome > 0 ? (
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 12,
                          color: b.uplift >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                        }}
                      >
                        {b.uplift >= 0 ? '+' : ''}
                        {fmtRand(b.uplift)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text3)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: 11 }}>
                    {b.totalTraining > 0 ? (
                      <span>
                        {b.completedTraining}/{b.totalTraining} completed
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-text3)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  Tab 2: Income Uplift
// ═══════════════════════════════════════════════

function UpliftTab({
  tracked,
  avgPreIncome,
  avgCurrentIncome,
  avgUplift,
  avgUpliftPct,
}: {
  tracked: any[];
  avgPreIncome: number;
  avgCurrentIncome: number;
  avgUplift: number;
  avgUpliftPct: string;
}) {
  const maxIncome = tracked.reduce(
    (m, b) => Math.max(m, b.currentIncome, b.preIncome),
    1,
  );

  return (
    <div className="card">
      <div className="ch">
        <div className="ct">Income Uplift Analysis</div>
        <div className="cs">Monthly income before joining W2W as informal picker → current W2W programme stipend</div>
      </div>
      <div style={{ padding: 20 }}>
        {/* Summary Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ padding: 12, background: 'var(--color-w2w-light, var(--color-surface3))', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase' }}>Avg Pre-W2W Income</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#c0392b', marginTop: 4 }}>{fmtRand(avgPreIncome)}/mo</div>
          </div>
          <div style={{ padding: 12, background: 'var(--color-w2w-light, var(--color-surface3))', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase' }}>Avg W2W Stipend</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-green)', marginTop: 4 }}>{fmtRand(avgCurrentIncome)}/mo</div>
          </div>
          <div style={{ padding: 12, background: 'var(--color-w2w-light, var(--color-surface3))', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase' }}>Avg Uplift</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#146484', marginTop: 4 }}>+ {fmtRand(avgUplift)}/mo ({avgUpliftPct}%)</div>
          </div>
        </div>

        {/* Per-employee uplift bars */}
        {tracked.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: 'var(--color-text3)',
              border: '2px dashed var(--color-border)',
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>No income uplift data yet</div>
            <div style={{ fontSize: 11, marginTop: 8, lineHeight: 1.7 }}>
              To capture income uplift for each participant:<br />
              1. Open their employee record → <b>Income Uplift Tracking</b> section<br />
              2. Enter <b>Monthly Income BEFORE joining W2W</b> (their informal picking income)<br />
              3. Enter <b>Current Monthly W2W Stipend</b> (their programme stipend amount)<br />
              The uplift is calculated automatically.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tracked.map((b: any) => {
              const pct = maxIncome > 0 ? (b.currentIncome / maxIncome) * 100 : 0;
              const prePct = maxIncome > 0 ? (b.preIncome / maxIncome) * 100 : 0;
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 140, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {b.firstName} {b.lastName}
                  </div>
                  <div style={{ width: 90, fontSize: 11, color: 'var(--color-text3)', flexShrink: 0 }}>
                    Before: {fmtRand(b.preIncome)}
                  </div>
                  <div style={{ width: 90, fontSize: 11, color: 'var(--color-green)', fontWeight: 600, flexShrink: 0 }}>
                    Now: {fmtRand(b.currentIncome)}
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: 18, background: 'var(--color-surface3)', borderRadius: 4 }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: prePct + '%',
                        background: 'var(--color-border)',
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        height: '100%',
                        width: pct + '%',
                        background: b.uplift >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                        borderRadius: 4,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 80,
                      fontSize: 12,
                      fontWeight: 700,
                      color: b.uplift >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                      textAlign: 'right',
                      flexShrink: 0,
                    }}
                  >
                    {b.uplift >= 0 ? '+' : ''}
                    {fmtRand(b.uplift)}
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

// ═══════════════════════════════════════════════
//  Tab 3: Missing Baseline
// ═══════════════════════════════════════════════

function MissingBaselineTab({ missing, onEditEmployee }: { missing: any[]; onEditEmployee: (id: string) => void }) {
  if (missing.length === 0) {
    return (
      <div className="card">
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: 'var(--color-green)', fontSize: 14 }}>
            All beneficiaries have baseline income recorded
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="alert alert-amber" style={{ marginBottom: 14 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <span><b>{missing.length} beneficiaries</b> have not had their pre-W2W income captured. Ask each participant: <b>"What did you earn per month before joining W2W?"</b> — enter the amount in their employee record → Income Uplift Tracking.</span>
      </div>
      <div className="card">
      <div className="ch">
        <div className="ct">Missing Baseline Income Data</div>
        <div className="cs">These participants need their pre-W2W income recorded to enable uplift tracking</div>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Site</th>
              <th>Enrolled</th>
              <th>W2W Stipend Set?</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((b: any) => (
              <tr key={b.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#fef3c7',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {initials(b.firstName, b.lastName)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        {b.firstName} {b.lastName}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--color-text3)',
                          fontFamily: 'var(--mono, monospace)',
                        }}
                      >
                        {b.empNo}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{b.siteName}</td>
                <td style={{ fontSize: 11 }}>{fmtDate(b.enrollDate)}</td>
                <td>
                  {b.currentIncome > 0 ? (
                    <span className="badge bg" style={{ fontSize: 10 }}>
                      Yes — {fmtRand(b.currentIncome)}
                    </span>
                  ) : (
                    <span className="badge ba" style={{ fontSize: 10 }}>
                      No
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => onEditEmployee(b.id)}
                  >
                    Update Record
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}

// ═══════════════════════════════════════════════
//  Tab 4: Exited Participants
// ═══════════════════════════════════════════════

function ExitedTab({ exited }: { exited: any[] }) {
  return (
    <div className="card">
      <div className="ch">
        <div className="ct">Exited Participants ({exited.length})</div>
        <div className="cs">Why participants left the W2W programme</div>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Site</th>
              <th>Reason for Leaving</th>
              <th>Exit Date</th>
              <th>Pre-W2W Income</th>
              <th>W2W Stipend</th>
            </tr>
          </thead>
          <tbody>
            {exited.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No exited participants.
                </td>
              </tr>
            ) : (
              exited.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--color-surface3)',
                          color: 'var(--color-text3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 11,
                          flexShrink: 0,
                        }}
                      >
                        {initials(b.firstName, b.lastName)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>
                          {b.firstName} {b.lastName}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--color-text3)',
                            fontFamily: 'var(--mono, monospace)',
                          }}
                        >
                          {b.empNo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{b.siteName}</td>
                  <td style={{ fontSize: 12 }}>{b.exitReason}</td>
                  <td style={{ fontSize: 11 }}>{fmtDate(b.exitDate)}</td>
                  <td style={{ fontSize: 12 }}>
                    {b.preIncome > 0 ? fmtRand(b.preIncome) : <span style={{ color: 'var(--color-text3)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {b.currentIncome > 0 ? fmtRand(b.currentIncome) : <span style={{ color: 'var(--color-text3)' }}>—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
