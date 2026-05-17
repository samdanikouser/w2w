import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi, wasteLogsApi } from '../api/endpoints';
import { Plus, Download } from 'lucide-react';
import { StatCard, FilterInput } from './SitesPage';
import { exportCsv } from '../utils/csv';
import { useNavStore } from '../stores/navStore';

export default function BeneficiaryPage() {
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const setActivePage = useNavStore((s) => s.setActivePage);

  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const { data: logData } = useQuery({ queryKey: ['waste-logs', 'all'], queryFn: () => wasteLogsApi.list({}) });

  const employees: any[] = empData?.data || [];
  const logs: any[] = logData?.data || [];

  // Beneficiaries are field workers / collectors in active programme
  const beneficiaries = useMemo(() => {
    return employees
      .filter((e: any) => (e.role || '').toLowerCase().includes('collect') || (e.role || '').toLowerCase().includes('sorter') || (e.role || '').toLowerCase().includes('field'))
      .map((e: any) => {
        const empLogs = logs.filter((l: any) => l.collectorId === e.id || l.employeeId === e.id);
        const totalKg = empLogs.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
        const stipend = empLogs.reduce((s, l) => s + (Number(l.totalValue) || 0), 0);
        return { ...e, totalKg, stipend, deliveries: empLogs.length };
      });
  }, [employees, logs]);

  // If no role matches, fall back to all active employees so the page is never empty
  const list = beneficiaries.length > 0 ? beneficiaries : employees.map((e: any) => ({ ...e, totalKg: 0, stipend: 0, deliveries: 0 }));

  const sites = Array.from(new Set(list.map((b) => b.site?.name || b.siteName).filter(Boolean))) as string[];
  const filtered = list.filter((b: any) => {
    if (siteFilter !== 'all' && (b.site?.name || b.siteName) !== siteFilter) return false;
    if (!search) return true;
    return `${b.firstName} ${b.lastName} ${b.empNo}`.toLowerCase().includes(search.toLowerCase());
  });

  const totalKg = list.reduce((s, b) => s + b.totalKg, 0);
  const totalStipend = list.reduce((s, b) => s + b.stipend, 0);
  const activeCount = list.filter((b) => b.status === 'ACTIVE').length;

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Beneficiary Tracker</div>
          <div className="ps">{list.length} programme participant{list.length === 1 ? '' : 's'} enrolled</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={() => setActivePage('employees', 'openAdd')}><Plus size={13} /> Add Beneficiary</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('beneficiaries', filtered, [
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'empNo', label: 'Emp #' },
            { key: 'role', label: 'Designation' },
            { key: 'siteName', label: 'Site', map: (r: any) => r.site?.name || r.siteName || '' },
            { key: 'deliveries', label: 'Deliveries' },
            { key: 'totalKg', label: 'Recovered (kg)', map: (r: any) => r.totalKg.toFixed(1) },
            { key: 'stipend', label: 'Stipend (R)', map: (r: any) => r.stipend.toFixed(2) },
            { key: 'status', label: 'Status' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="alert alert-blue">
        <span>To add a new beneficiary, use <b>Employees → Add Employee</b> and fill in the Programme Assignment section (Site, Cooperative, W2W Programme Reference, Stipend). This page shows programme performance for all enrolled participants.</span>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Total Beneficiaries" value={String(list.length)} sub="In the programme" icon="❤" rail="sc-purple" color="var(--color-purple)" />
        <StatCard label="Active" value={String(activeCount)} sub={`${Math.round((activeCount / Math.max(list.length, 1)) * 100)}% of total`} icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Total Recovered" value={(totalKg / 1000).toFixed(2) + 't'} sub="Across all collectors" icon="♻" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Stipends Earned" value={'R ' + Math.round(totalStipend).toLocaleString()} sub="Programme-wide" icon="💰" rail="sc-amber" color="var(--color-amber)" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Beneficiary Programme Performance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilterInput value={search} onChange={setSearch} placeholder="Search by name, emp #…" />
            <select className="fc" style={{ width: 160 }} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
              <option value="all">All sites</option>
              {sites.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Beneficiary</th>
                <th>Emp #</th>
                <th>Designation</th>
                <th>Site</th>
                <th>Deliveries</th>
                <th>Recovered</th>
                <th>Stipend Earned</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No beneficiaries match your filter.
                </td></tr>
              ) : (
                filtered.map((b: any) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.firstName} {b.lastName}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{b.empNo}</td>
                    <td>{b.role || '—'}</td>
                    <td>{b.site?.name || b.siteName || '—'}</td>
                    <td>{b.deliveries}</td>
                    <td>{(b.totalKg / 1000).toFixed(2)} t</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>R {Math.round(b.stipend).toLocaleString()}</td>
                    <td><span className={b.status === 'ACTIVE' ? 'badge bg' : 'badge bk'}>{b.status}</span></td>
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
