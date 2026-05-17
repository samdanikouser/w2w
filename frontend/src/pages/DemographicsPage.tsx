import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '../api/endpoints';
import { StatCard } from './SitesPage';

export default function DemographicsPage() {
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];

  const dist = useMemo(() => {
    const byDept = new Map<string, number>();
    const byRole = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const bySite = new Map<string, number>();
    employees.forEach((e: any) => {
      const inc = (m: Map<string, number>, k: string) => m.set(k || '—', (m.get(k || '—') || 0) + 1);
      inc(byDept, e.department);
      inc(byRole, e.role);
      inc(byStatus, e.status);
      inc(bySite, e.site?.name || e.siteName);
    });
    return {
      byDept: [...byDept.entries()].sort((a, b) => b[1] - a[1]),
      byRole: [...byRole.entries()].sort((a, b) => b[1] - a[1]),
      byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
      bySite: [...bySite.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [employees]);

  const total = employees.length || 1;
  const active = employees.filter((e: any) => e.status === 'ACTIVE').length;
  const onLeave = employees.filter((e: any) => e.status === 'ON_LEAVE').length;
  const probation = employees.filter((e: any) => e.status === 'PROBATION').length;

  const avgRate =
    employees.length > 0
      ? employees.reduce((s, e: any) => s + (Number(e.dailyRate) || 0), 0) / employees.length
      : 0;

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Demographics</div>
          <div className="ps">Workforce composition · {employees.length} employees on file</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Workforce" value={String(employees.length)} sub="All statuses" icon="👥" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Active" value={String(active)} sub={`${Math.round((active / total) * 100)}% of total`} icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="On Leave" value={String(onLeave)} sub={`${Math.round((onLeave / total) * 100)}% of total`} icon="🌴" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Probation" value={String(probation)} sub={`Avg daily R ${Math.round(avgRate)}`} icon="📋" rail="sc-purple" color="var(--color-purple)" />
      </div>

      <div className="g2 mb14">
        <DistributionCard title="By Department" subtitle="Workforce per business unit" data={dist.byDept} colour="var(--color-w2w)" total={employees.length} />
        <DistributionCard title="By Designation" subtitle="Job titles across the programme" data={dist.byRole} colour="var(--color-accent)" total={employees.length} />
      </div>

      <div className="g2">
        <DistributionCard title="By Site" subtitle="Headcount per location" data={dist.bySite} colour="var(--color-purple)" total={employees.length} />
        <DistributionCard title="By Status" subtitle="Lifecycle distribution" data={dist.byStatus} colour="var(--color-amber)" total={employees.length} />
      </div>

      <div className="alert alert-blue mt14">
        <span>
          Demographics covering <b>gender</b>, <b>age band</b>, <b>race</b>, <b>nationality</b>, and <b>disability</b> require those fields on the Employee record.
          Add them via the Employee form (Personal Information section) to unlock POPIA-compliant equity reporting.
        </span>
      </div>
    </div>
  );
}

function DistributionCard({
  title, subtitle, data, colour, total,
}: { title: string; subtitle: string; data: Array<[string, number]>; colour: string; total: number; }) {
  if (data.length === 0) {
    return (
      <div className="card">
        <div className="ch"><div className="ct">{title}</div><div className="cs">{subtitle}</div></div>
        <div className="cb" style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 24, fontSize: 12 }}>
          No data yet.
        </div>
      </div>
    );
  }
  const max = data[0]?.[1] || 1;
  return (
    <div className="card">
      <div className="ch"><div className="ct">{title}</div><div className="cs">{subtitle}</div></div>
      <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.map(([label, count]) => {
          const pct = Math.round((count / max) * 100);
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={label}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text2)', fontWeight: 600 }}>{count}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text3)', width: 38, textAlign: 'right' }}>{share}%</div>
              </div>
              <div className="pb" style={{ height: 8 }}>
                <div className="pf" style={{ width: pct + '%', background: colour, height: '100%' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
