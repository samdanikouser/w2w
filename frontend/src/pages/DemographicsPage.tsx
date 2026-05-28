import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, sitesApi } from '../api/endpoints';
import { Download } from 'lucide-react';
import { exportCsv } from '../utils/csv';

const REGIONS = ['Region C', 'Region D', 'Region F', 'Region G'] as const;

const GENDER_COLORS: Record<string, string> = {
  Male: '#2980b9',
  Female: '#8e44ad',
  'Non-binary / Other': '#16a085',
  'Not recorded': 'var(--color-text3)',
};

const RACE_COLORS: Record<string, string> = {
  'Black African': '#146484',
  White: '#27ae60',
  Coloured: '#e67e22',
  'Indian/Asian': '#8e44ad',
  Other: '#95a5a6',
};

/* ── Progress bar component (matching prototype) ── */
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 10, background: 'var(--color-surface3)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 5 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, width: 30, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function DemographicsPage() {
  const { data: empData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesApi.list({}),
  });
  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });

  const employees: any[] = empData?.data || [];
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];

  // Build siteId → region lookup
  const siteRegionMap = useMemo(() => {
    const m = new Map<string, string>();
    sites.forEach((s: any) => m.set(s.id, s.region || ''));
    return m;
  }, [sites]);

  const active = useMemo(() => employees.filter((e: any) => e.status === 'ACTIVE'), [employees]);

  /* ── Aggregate counts ── */
  const stats = useMemo(() => {
    let male = 0;
    let female = 0;
    let genderNA = 0;
    let fieldWorkers = 0;

    active.forEach((e: any) => {
      const g = (e.gender || '').toLowerCase();
      if (g === 'male') male++;
      else if (g === 'female') female++;
      else genderNA++;
      if ((e.role || '').toLowerCase().includes('field') || (e.department || '').toLowerCase().includes('field')) {
        fieldWorkers++;
      }
    });
    return { total: active.length, male, female, genderNA, fieldWorkers };
  }, [active]);

  /* ── Gender distribution breakdown ── */
  const genderDist = useMemo(() => {
    const counts: Record<string, number> = {
      Male: 0,
      Female: 0,
      'Non-binary / Other': 0,
      'Not recorded': 0,
    };
    active.forEach((e: any) => {
      const g = (e.gender || '').toLowerCase();
      if (g === 'male') counts['Male']++;
      else if (g === 'female') counts['Female']++;
      else if (g && g !== 'n/a' && g !== 'unknown') counts['Non-binary / Other']++;
      else counts['Not recorded']++;
    });
    return counts;
  }, [active]);

  /* ── Race distribution breakdown ── */
  const raceDist = useMemo(() => {
    const counts: Record<string, number> = {
      'Black African': 0,
      White: 0,
      Coloured: 0,
      'Indian/Asian': 0,
      Other: 0,
    };
    active.forEach((e: any) => {
      const r = (e.race || '').trim();
      if (counts[r] !== undefined) counts[r]++;
      else counts['Other']++;
    });
    return counts;
  }, [active]);

  /* ── Region breakdown table ── */
  const regionData = useMemo(() => {
    const rows = REGIONS.map((region) => {
      const regionEmps = active.filter((e: any) => {
        const empRegion = e.site?.region || siteRegionMap.get(e.siteId) || '';
        return empRegion === region;
      });
      const total = regionEmps.length;
      let male = 0;
      let female = 0;
      const raceMap: Record<string, number> = { 'Black African': 0, White: 0, Coloured: 0, 'Indian/Asian': 0 };
      let notRecorded = 0;

      regionEmps.forEach((e: any) => {
        const g = (e.gender || '').toLowerCase();
        if (g === 'male') male++;
        else if (g === 'female') female++;

        const r = (e.race || '').trim();
        if (raceMap[r] !== undefined) raceMap[r]++;
        else notRecorded++;
      });

      return { region, total, male, female, ...raceMap, notRecorded };
    });

    // Totals row
    const totals = rows.reduce(
      (acc, r) => ({
        region: 'TOTAL',
        total: acc.total + r.total,
        male: acc.male + r.male,
        female: acc.female + r.female,
        'Black African': acc['Black African'] + r['Black African'],
        White: acc.White + r.White,
        Coloured: acc.Coloured + r.Coloured,
        'Indian/Asian': acc['Indian/Asian'] + r['Indian/Asian'],
        notRecorded: acc.notRecorded + r.notRecorded,
      }),
      { region: 'TOTAL', total: 0, male: 0, female: 0, 'Black African': 0, White: 0, Coloured: 0, 'Indian/Asian': 0, notRecorded: 0 },
    );

    return { rows, totals };
  }, [active, siteRegionMap]);

  const onExport = () => {
    exportCsv('demographics-by-region', [...regionData.rows, regionData.totals], [
      { key: 'region', label: 'Region' },
      { key: 'total', label: 'Total' },
      { key: 'male', label: 'Male' },
      { key: 'female', label: 'Female' },
      { key: 'Black African', label: 'Black African' },
      { key: 'White', label: 'White' },
      { key: 'Coloured', label: 'Coloured' },
      { key: 'Indian/Asian', label: 'Indian/Asian' },
      { key: 'notRecorded', label: 'Not Recorded' },
    ]);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Demographics</div>
          <div className="ps">
            Workforce composition by gender, race, and region · {stats.total} active employees
          </div>
        </div>
      </div>

      {/* ── 5 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <DemoStatCard icon="👥" label="Total Active" value={stats.total} color="var(--color-w2w)" />
        <DemoStatCard icon="👨" label="Male" value={stats.male} color="#2980b9" />
        <DemoStatCard icon="👩" label="Female" value={stats.female} color="#8e44ad" />
        <DemoStatCard icon="❓" label="Gender N/A" value={stats.genderNA} color="var(--color-text3)" />
        <DemoStatCard icon="👷" label="Field Workers" value={stats.fieldWorkers} color="var(--color-green)" />
      </div>

      {/* ── Gender + Race Distribution ── */}
      <div className="g2 mb14">
        {/* Gender Distribution */}
        <div className="card">
          <div className="ch">
            <div className="ct">Gender Distribution</div>
            <div className="cs">All active employees</div>
          </div>
          <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(genderDist).map(([label, count]) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text2)', fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <ProgressBar value={count} max={stats.total} color={GENDER_COLORS[label] || 'var(--color-text3)'} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Race / Population Group */}
        <div className="card">
          <div className="ch">
            <div className="ct">Race / Population Group</div>
            <div className="cs">Employment Equity categories</div>
          </div>
          <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(raceDist).map(([label, count]) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text2)', fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <ProgressBar value={count} max={stats.total} color={RACE_COLORS[label] || '#95a5a6'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Demographics by Region Table ── */}
      <div className="card">
        <div className="ch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="ct">Demographics by Region</div>
            <div className="cs">Gender and race breakdown per CoJ planning region</div>
          </div>
          <button className="btn btn-ghost" onClick={onExport}>
            <Download size={13} /> Export
          </button>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Region</th>
                <th>Total</th>
                <th>Male</th>
                <th>Female</th>
                <th>Black African</th>
                <th>White</th>
                <th>Coloured</th>
                <th>Indian/Asian</th>
                <th>Not Recorded</th>
              </tr>
            </thead>
            <tbody>
              {regionData.rows.map((r) => (
                <tr key={r.region}>
                  <td style={{ fontWeight: 600 }}>{r.region}</td>
                  <td style={{ fontWeight: 700 }}>{r.total}</td>
                  <td>{r.male}</td>
                  <td>{r.female}</td>
                  <td>{r['Black African']}</td>
                  <td>{r.White}</td>
                  <td>{r.Coloured}</td>
                  <td>{r['Indian/Asian']}</td>
                  <td>{r.notRecorded}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--color-w2w-light)', fontWeight: 700 }}>
                <td>{regionData.totals.region}</td>
                <td>{regionData.totals.total}</td>
                <td>{regionData.totals.male}</td>
                <td>{regionData.totals.female}</td>
                <td>{regionData.totals['Black African']}</td>
                <td>{regionData.totals.White}</td>
                <td>{regionData.totals.Coloured}</td>
                <td>{regionData.totals['Indian/Asian']}</td>
                <td>{regionData.totals.notRecorded}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Stat card for demographics (borderLeft style matching prototype) ── */
function DemoStatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div
      className="card"
      style={{
        borderLeft: `3px solid ${color}`,
        padding: '16px 14px',
        margin: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: 'var(--color-text)' }}>{value}</div>
    </div>
  );
}
