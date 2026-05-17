import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi, sitesApi, type VehiclePayload } from '../api/endpoints';
import { Plus, Download, Truck, Wrench, X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, FilterInput, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';

const STATUS_BADGES: Record<string, string> = {
  OPERATIONAL: 'badge bg',
  MAINTENANCE: 'badge ba',
  DECOMMISSIONED: 'badge br',
};

const EMPTY: VehiclePayload = {
  registration: '', make: '', model: '', year: null, siteId: null,
  status: 'OPERATIONAL', fuelType: 'Diesel', lastService: null, nextService: null, odometerKm: null,
};

export default function VehiclesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<VehiclePayload>(EMPTY);

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.list() });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];

  const createMut = useMutation({
    mutationFn: (p: VehiclePayload) => vehiclesApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<VehiclePayload> }) => vehiclesApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => vehiclesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const filtered = (vehicles as any[]).filter((v) => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (!search) return true;
    return `${v.registration} ${v.make} ${v.model} ${v.site?.name || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  const operational = (vehicles as any[]).filter((v) => v.status === 'OPERATIONAL').length;
  const inMaint = (vehicles as any[]).filter((v) => v.status === 'MAINTENANCE').length;
  const totalKm = (vehicles as any[]).reduce((s, v) => s + (Number(v.odometerKm) || 0), 0);

  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (v: any) => {
    setForm({
      registration: v.registration || '', make: v.make || '', model: v.model || '',
      year: v.year ?? null, siteId: v.siteId || null,
      status: v.status || 'OPERATIONAL', fuelType: v.fuelType || 'Diesel',
      lastService: v.lastService ? v.lastService.slice(0, 10) : null,
      nextService: v.nextService ? v.nextService.slice(0, 10) : null,
      odometerKm: v.odometerKm ?? null,
    });
    setActive(v); setModal('edit');
  };
  const save = () => {
    if (!form.registration?.trim()) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (v: any) => {
    if (confirm(`Delete vehicle "${v.registration}"?`)) deleteMut.mutate(v.id);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Vehicles & Fleet</div>
          <div className="ps">{(vehicles as any[]).length} vehicles · {operational} operational · {inMaint} in maintenance</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Vehicle</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('vehicles', filtered, [
            { key: 'registration', label: 'Registration' },
            { key: 'make', label: 'Make' },
            { key: 'model', label: 'Model' },
            { key: 'year', label: 'Year' },
            { key: 'fuelType', label: 'Fuel' },
            { key: 'site', label: 'Site', map: (r: any) => r.site?.name || '' },
            { key: 'odometerKm', label: 'Odometer (km)' },
            { key: 'lastService', label: 'Last Service' },
            { key: 'nextService', label: 'Next Service' },
            { key: 'status', label: 'Status' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Fleet" value={String((vehicles as any[]).length)} sub="Across all sites" icon="🚛" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Operational" value={String(operational)} sub="Available now" icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="In Maintenance" value={String(inMaint)} sub="Scheduled service" icon="🔧" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Combined Mileage" value={(totalKm / 1000).toFixed(0) + 'k km'} sub="Lifetime fleet odo" icon="📊" rail="sc-purple" color="var(--color-purple)" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Fleet Directory</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FilterInput value={search} onChange={setSearch} placeholder="Search reg, make…" />
            <select className="fc" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="DECOMMISSIONED">Decommissioned</option>
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Year</th>
                <th>Fuel</th>
                <th>Site</th>
                <th>Odometer</th>
                <th>Last Service</th>
                <th>Next Service</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  {(vehicles as any[]).length === 0 ? 'No vehicles yet. Click "Add Vehicle" to register one.' : 'No vehicles match your filter.'}
                </td></tr>
              ) : (
                filtered.map((v: any) => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Truck size={14} style={{ color: 'var(--color-w2w)' }} />
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{v.registration}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{v.make} {v.model}</div>
                        </div>
                      </div>
                    </td>
                    <td>{v.year || '—'}</td>
                    <td>{v.fuelType || '—'}</td>
                    <td>{v.site?.name || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{v.odometerKm ? Number(v.odometerKm).toLocaleString() + ' km' : '—'}</td>
                    <td>{v.lastService ? new Date(v.lastService).toLocaleDateString() : '—'}</td>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {v.status === 'MAINTENANCE' && <Wrench size={12} style={{ color: 'var(--color-amber)' }} />}
                      {v.nextService ? new Date(v.nextService).toLocaleDateString() : '—'}
                    </td>
                    <td><span className={STATUS_BADGES[v.status] || 'badge bk'}>{v.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <RowBtn title="Edit" onClick={() => openEdit(v)}><Edit2 size={13} /></RowBtn>
                        <RowBtn title="Delete" danger onClick={() => remove(v)}><Trash2 size={13} /></RowBtn>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Vehicle' : 'Add Vehicle'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Registration <span className="req">*</span></label>
                  <input className="fc" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="CA 123-456" /></div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="OPERATIONAL">Operational</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="DECOMMISSIONED">Decommissioned</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Make</label>
                  <input className="fc" value={form.make || ''} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Isuzu" /></div>
                <div className="fg"><label className="fl">Model</label>
                  <input className="fc" value={form.model || ''} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="NPR 400" /></div>
                <div className="fg"><label className="fl">Year</label>
                  <input className="fc" type="number" value={form.year ?? ''} onChange={(e) => setForm({ ...form, year: e.target.value ? parseInt(e.target.value) : null })} placeholder="2022" /></div>
                <div className="fg"><label className="fl">Fuel</label>
                  <input className="fc" value={form.fuelType || ''} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} placeholder="Diesel" /></div>
                <div className="fg"><label className="fl">Site</label>
                  <select className="fc" value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value || null })}>
                    <option value="">— Unassigned —</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Odometer (km)</label>
                  <input className="fc" type="number" value={form.odometerKm ?? ''} onChange={(e) => setForm({ ...form, odometerKm: e.target.value ? parseFloat(e.target.value) : null })} placeholder="0" /></div>
                <div className="fg"><label className="fl">Last Service</label>
                  <input className="fc" type="date" value={form.lastService || ''} onChange={(e) => setForm({ ...form, lastService: e.target.value || null })} /></div>
                <div className="fg"><label className="fl">Next Service</label>
                  <input className="fc" type="date" value={form.nextService || ''} onChange={(e) => setForm({ ...form, nextService: e.target.value || null })} /></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update' : 'Add Vehicle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
