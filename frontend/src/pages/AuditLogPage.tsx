import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '../api/endpoints';
import { Download, ShieldCheck } from 'lucide-react';
import { StatCard, FilterInput } from './SitesPage';
import { exportCsv } from '../utils/csv';

const ACTION_BADGES: Record<string, string> = {
  CREATE: 'badge bg',
  UPDATE: 'badge bb',
  DELETE: 'badge br',
  APPROVE: 'badge bg',
  REJECT: 'badge br',
  EXPORT: 'badge bp',
  LOGIN: 'badge bk',
};

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');

  const { data: events = [] } = useQuery({
    queryKey: ['audit-logs', entityFilter],
    queryFn: () => auditLogsApi.list(entityFilter !== 'all' ? { entity: entityFilter, limit: '500' } : { limit: '500' }),
  });

  const list = events as any[];

  const filtered = list.filter((e) => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (!search) return true;
    const userName = e.user?.name || '';
    return `${userName} ${e.entity} ${e.detail || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  const entities = Array.from(new Set(list.map((e) => e.entity)));

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Audit Log</div>
          <div className="ps">POPIA-compliant trail · {list.length} event{list.length === 1 ? '' : 's'} (last 500)</div>
        </div>
        <button className="btn btn-ghost" onClick={() => exportCsv('audit-log', filtered, [
          { key: 'createdAt', label: 'Timestamp', map: (r: any) => new Date(r.createdAt).toISOString() },
          { key: 'user', label: 'User', map: (r: any) => r.user?.name || '' },
          { key: 'action', label: 'Action' },
          { key: 'entity', label: 'Entity' },
          { key: 'entityId', label: 'Reference' },
          { key: 'detail', label: 'Detail' },
          { key: 'ipAddress', label: 'IP' },
        ])}><Download size={13} /> Export</button>
      </div>

      <div className="alert alert-blue">
        <span><ShieldCheck size={13} style={{ display: 'inline', marginRight: 6 }} /> Live audit trail. Every CRUD, login, and export action is captured with timestamp, user, IP, and entity reference for POPIA compliance.</span>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Events" value={String(list.length)} sub="Most recent 500" icon="🛡" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Sensitive Edits" value={String(list.filter((e) => e.action === 'UPDATE' || e.action === 'DELETE').length)} sub="Update / Delete" icon="✏" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Approvals" value={String(list.filter((e) => e.action === 'APPROVE').length)} sub="Workflow events" icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Exports" value={String(list.filter((e) => e.action === 'EXPORT').length)} sub="Data egress" icon="📤" rail="sc-purple" color="var(--color-purple)" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Event Stream</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FilterInput value={search} onChange={setSearch} placeholder="Search events…" />
            <select className="fc" style={{ width: 140 }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
              <option value="all">All actions</option>
              {Object.keys(ACTION_BADGES).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="fc" style={{ width: 140 }} value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              <option value="all">All entities</option>
              {entities.map((e) => <option key={e as string} value={e as string}>{e as string}</option>)}
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Reference</th><th>Detail</th><th>IP</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  {list.length === 0 ? 'No audit events yet. Activity in the system will appear here.' : 'No events match your filter.'}
                </td></tr>
              ) : (
                filtered.map((e: any) => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{new Date(e.createdAt).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{e.user?.name || '—'}</td>
                    <td><span className={ACTION_BADGES[e.action] || 'badge bk'}>{e.action}</span></td>
                    <td>{e.entity}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{e.entityId || '—'}</td>
                    <td style={{ fontSize: 11 }}>{e.detail || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text3)' }}>{e.ipAddress || '—'}</td>
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
