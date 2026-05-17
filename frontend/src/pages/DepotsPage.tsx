import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi, wasteLogsApi, type SitePayload } from '../api/endpoints';
import { Plus, Download, Building2, X, Edit2, Trash2, Eye } from 'lucide-react';
import { StatCard, FilterInput, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';

const EMPTY: SitePayload = {
  name: '', type: 'DEPOT', region: '', address: '', lat: null, lng: null, status: 'ACTIVE',
};

export default function DepotsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<SitePayload>(EMPTY);

  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: logData } = useQuery({ queryKey: ['waste-logs', 'all'], queryFn: () => wasteLogsApi.list({}) });

  const allSites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
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

  // Depots are sites of type DEPOT or BUYBACK_CENTRE
  const depots = useMemo(() => {
    return allSites
      .filter((s: any) => s.type === 'DEPOT' || s.type === 'BUYBACK_CENTRE')
      .map((s: any) => {
        const siteLogs = logs.filter((l: any) => l.siteId === s.id);
        const intake = siteLogs.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
        const revenue = siteLogs.reduce((sum, l) => sum + (Number(l.totalValue) || 0), 0);
        return { ...s, intake, revenue, deliveries: siteLogs.length };
      });
  }, [allSites, logs]);

  const filtered = depots.filter((d) => !search || `${d.name} ${d.region}`.toLowerCase().includes(search.toLowerCase()));

  const totalIntake = depots.reduce((s, d) => s + d.intake, 0);
  const totalRev = depots.reduce((s, d) => s + d.revenue, 0);

  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (d: any) => {
    setForm({
      name: d.name || '', type: d.type || 'DEPOT', region: d.region || '',
      address: d.address || '', lat: d.lat ?? null, lng: d.lng ?? null, status: d.status || 'ACTIVE',
    });
    setActive(d); setModal('edit');
  };
  const openView = (d: any) => { setActive(d); setModal('view'); };
  const save = () => {
    if (!form.name?.trim()) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (d: any) => {
    if (confirm(`Delete depot "${d.name}"?`)) deleteMut.mutate(d.id);
  };
  const onExport = () => {
    exportCsv('depots', filtered, [
      { key: 'name', label: 'Depot' },
      { key: 'type', label: 'Type' },
      { key: 'region', label: 'Region' },
      { key: 'address', label: 'Address' },
      { key: 'deliveries', label: 'Deliveries' },
      { key: 'intake', label: 'Intake (kg)', map: (r: any) => r.intake.toFixed(1) },
      { key: 'revenue', label: 'Revenue (R)', map: (r: any) => r.revenue.toFixed(2) },
      { key: 'status', label: 'Status' },
    ]);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Depot Management</div>
          <div className="ps">{depots.length} buyback & depot location{depots.length === 1 ? '' : 's'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Depot</button>
          <button className="btn btn-ghost" onClick={onExport}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Depots" value={String(depots.length)} sub="Active intake points" icon="🏢" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Intake Volume" value={(totalIntake / 1000).toFixed(2) + 't'} sub="All-time delivered" icon="📥" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Revenue Through" value={'R ' + Math.round(totalRev).toLocaleString()} sub="Across all depots" icon="💰" rail="sc-purple" color="var(--color-purple)" />
        <StatCard label="Avg / Depot" value={depots.length > 0 ? (totalIntake / depots.length / 1000).toFixed(2) + 't' : '0t'} sub="Mean intake" icon="📊" rail="sc-amber" color="var(--color-amber)" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Depot Directory</div>
          <FilterInput value={search} onChange={setSearch} placeholder="Search depots…" />
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Depot</th>
                <th>Region</th>
                <th>Type</th>
                <th>Deliveries</th>
                <th>Intake</th>
                <th>Revenue</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No depots yet. Click "Add Depot" to create one (type=Depot or Buyback Centre).
                </td></tr>
              ) : (
                filtered.map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Building2 size={14} style={{ color: 'var(--color-amber)' }} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{d.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{d.address || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{d.region || '—'}</td>
                    <td><span className="badge bb">{d.type === 'BUYBACK_CENTRE' ? 'Buyback' : 'Depot'}</span></td>
                    <td>{d.deliveries}</td>
                    <td>{(d.intake / 1000).toFixed(2)} t</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>R {Math.round(d.revenue).toLocaleString()}</td>
                    <td><span className={d.status === 'ACTIVE' ? 'badge bg' : 'badge bk'}>{d.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <RowBtn title="View" onClick={() => openView(d)}><Eye size={13} /></RowBtn>
                        <RowBtn title="Edit" onClick={() => openEdit(d)}><Edit2 size={13} /></RowBtn>
                        <RowBtn title="Delete" danger onClick={() => remove(d)}><Trash2 size={13} /></RowBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Depot' : 'Add Depot'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full">
                  <div className="fg"><label className="fl">Depot Name <span className="req">*</span></label>
                    <input className="fc" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diepkloof Buyback Depot" />
                  </div>
                </div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="DEPOT">Depot</option>
                    <option value="BUYBACK_CENTRE">Buyback Centre</option>
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
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update' : 'Add Depot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'view' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{active.name}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {[
                ['Type', active.type === 'BUYBACK_CENTRE' ? 'Buyback Centre' : 'Depot'],
                ['Region', active.region],
                ['Address', active.address],
                ['Status', active.status],
                ['Deliveries', active.deliveries],
                ['Intake (kg)', active.intake?.toFixed(1)],
                ['Revenue (R)', Math.round(active.revenue).toLocaleString()],
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
