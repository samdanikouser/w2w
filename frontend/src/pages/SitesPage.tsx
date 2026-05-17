import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi, employeesApi, wasteLogsApi, type SitePayload } from '../api/endpoints';
import { MapPin, Building2, Plus, Download, Search, X, Edit2, Trash2, Eye } from 'lucide-react';
import { exportCsv } from '../utils/csv';

const TYPE_LABELS: Record<string, string> = {
  COOPERATIVE: 'Cooperative',
  DEPOT: 'Depot',
  BUYBACK_CENTRE: 'Buyback Centre',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'badge bg',
  INACTIVE: 'badge bk',
};

const EMPTY: SitePayload = {
  name: '', type: 'COOPERATIVE', region: '', address: '', lat: null, lng: null, status: 'ACTIVE',
};

export default function SitesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<SitePayload>(EMPTY);

  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const { data: logData } = useQuery({ queryKey: ['waste-logs', 'all'], queryFn: () => wasteLogsApi.list({}) });

  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const employees: any[] = empData?.data || [];
  const logs: any[] = logData?.data || [];

  const createMut = useMutation({
    mutationFn: (p: SitePayload) => sitesApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<SitePayload> }) => sitesApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => sitesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });

  const enriched = useMemo(() => {
    return sites.map((s: any) => {
      const empCount = employees.filter((e: any) => e.siteId === s.id).length;
      const siteLogs = logs.filter((l: any) => l.siteId === s.id);
      const totalKg = siteLogs.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
      const totalRev = siteLogs.reduce((sum, l) => sum + (Number(l.totalValue) || 0), 0);
      return { ...s, empCount, totalKg, totalRev, deliveries: siteLogs.length };
    });
  }, [sites, employees, logs]);

  const filtered = enriched.filter((s) => {
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    if (!search) return true;
    return `${s.name} ${s.region} ${s.address}`.toLowerCase().includes(search.toLowerCase());
  });

  const stats = {
    total: sites.length,
    active: sites.filter((s) => s.status === 'ACTIVE').length,
    coops: sites.filter((s) => s.type === 'COOPERATIVE').length,
    depots: sites.filter((s) => s.type === 'DEPOT').length,
  };

  // ── Handlers ──
  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (s: any) => {
    setForm({
      name: s.name || '', type: s.type || 'COOPERATIVE', region: s.region || '',
      address: s.address || '', lat: s.lat ?? null, lng: s.lng ?? null, status: s.status || 'ACTIVE',
    });
    setActive(s); setModal('edit');
  };
  const openView = (s: any) => { setActive(s); setModal('view'); };
  const save = () => {
    if (!form.name?.trim()) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (s: any) => {
    if (confirm(`Delete site "${s.name}"?`)) deleteMut.mutate(s.id);
  };
  const onExport = () => {
    exportCsv('sites', filtered, [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type', map: (r: any) => TYPE_LABELS[r.type] || r.type },
      { key: 'region', label: 'Region' },
      { key: 'address', label: 'Address' },
      { key: 'empCount', label: 'Employees' },
      { key: 'deliveries', label: 'Deliveries' },
      { key: 'totalKg', label: 'Recovered (kg)', map: (r: any) => r.totalKg.toFixed(1) },
      { key: 'totalRev', label: 'Revenue (R)', map: (r: any) => r.totalRev.toFixed(2) },
      { key: 'status', label: 'Status' },
    ]);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Sites & Regions</div>
          <div className="ps">{sites.length} location{sites.length === 1 ? '' : 's'} across the programme</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Site</button>
          <button className="btn btn-ghost" onClick={onExport}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Sites" value={String(stats.total)} sub="All types combined" icon="📍" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Active Sites" value={String(stats.active)} sub={`${stats.total - stats.active} inactive`} icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Cooperatives" value={String(stats.coops)} sub="Collection sites" icon="🤝" rail="sc-purple" color="var(--color-purple)" />
        <StatCard label="Depots" value={String(stats.depots)} sub="Buyback locations" icon="🏢" rail="sc-amber" color="var(--color-amber)" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Sites Directory</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilterInput value={search} onChange={setSearch} placeholder="Search site, region…" />
            <select className="fc" style={{ width: 160 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Site</th>
                <th>Type</th>
                <th>Region</th>
                <th>Employees</th>
                <th>Deliveries</th>
                <th>Recovered</th>
                <th>Revenue</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  {sites.length === 0 ? 'No sites yet. Click "Add Site" to create your first.' : 'No sites match your filter.'}
                </td></tr>
              ) : (
                filtered.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.type === 'DEPOT' ? <Building2 size={14} style={{ color: 'var(--color-amber)' }} /> : <MapPin size={14} style={{ color: 'var(--color-w2w)' }} />}
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{s.address || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge bb">{TYPE_LABELS[s.type] || s.type}</span></td>
                    <td>{s.region || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{s.empCount}</td>
                    <td>{s.deliveries}</td>
                    <td>{(s.totalKg / 1000).toFixed(2)} t</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>R {Math.round(s.totalRev).toLocaleString()}</td>
                    <td><span className={STATUS_STYLES[s.status] || 'badge bk'}>{s.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <RowBtn title="View" onClick={() => openView(s)}><Eye size={13} /></RowBtn>
                        <RowBtn title="Edit" onClick={() => openEdit(s)}><Edit2 size={13} /></RowBtn>
                        <RowBtn title="Delete" danger onClick={() => remove(s)}><Trash2 size={13} /></RowBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Site' : 'Add Site'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full">
                  <div className="fg"><label className="fl">Site Name <span className="req">*</span></label>
                    <input className="fc" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diepkloof Buyback Depot" />
                  </div>
                </div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Region</label>
                  <input className="fc" value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="e.g. Region D — Soweto" />
                </div>
                <div className="fg"><label className="fl">Address</label>
                  <input className="fc" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, suburb" />
                </div>
                <div className="fg"><label className="fl">Latitude</label>
                  <input className="fc" type="number" step="0.000001" value={form.lat ?? ''} onChange={(e) => setForm({ ...form, lat: e.target.value ? parseFloat(e.target.value) : null })} placeholder="-26.123456" />
                </div>
                <div className="fg"><label className="fl">Longitude</label>
                  <input className="fc" type="number" step="0.000001" value={form.lng ?? ''} onChange={(e) => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })} placeholder="27.123456" />
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update Site' : 'Add Site'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {modal === 'view' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{active.name}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {[
                ['Type', TYPE_LABELS[active.type] || active.type],
                ['Region', active.region],
                ['Address', active.address],
                ['Latitude', active.lat],
                ['Longitude', active.lng],
                ['Status', active.status],
              ].map(([k, v]) => (
                <div key={k as string} className="drow">
                  <div className="dlb">{k}</div>
                  <div className="dvl">{v || '—'}</div>
                </div>
              ))}
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => openEdit(active)}><Edit2 size={13} /> Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared exports (reused across module pages) ───
export function StatCard({
  label, value, sub, icon, rail,
}: {
  label: string; value: string; sub: string; icon: string; rail: string;
  /** Legacy — value now always uses --color-text. Prop kept so existing callers compile. */
  color?: string;
}) {
  return (
    <div className={`stat-card ${rail}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="stat-label">{label}</div>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div className="stat-val">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function FilterInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string; }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 7,
      background: 'var(--color-surface3)', border: '1px solid var(--color-border)', width: 220,
    }}>
      <Search size={12} style={{ color: 'var(--color-text3)', flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none',
          padding: 0, fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-text)', flex: 1,
        }}
      />
    </div>
  );
}

export function RowBtn({
  children, title, onClick, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 4, borderRadius: 4, background: 'transparent', border: 'none',
        cursor: 'pointer', color: 'var(--color-text3)',
        display: 'flex', alignItems: 'center', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.background = danger ? 'var(--color-red-light)' : 'var(--color-surface3)';
        t.style.color = danger ? 'var(--color-red)' : 'var(--color-w2w)';
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget as HTMLButtonElement;
        t.style.background = 'transparent';
        t.style.color = 'var(--color-text3)';
      }}
    >{children}</button>
  );
}
