import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi, sitesApi, employeesApi, type VehiclePayload } from '../api/endpoints';
import { Plus, X, Edit2 } from 'lucide-react';
import { StatCard, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';
import { loadVehicleTypes } from './W2WSettingsPage';

/* ── Status display: DB enum → label + badge ── */
const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  OPERATIONAL: { label: 'Available', badge: 'badge bg' },
  ACTIVE:      { label: 'Active', badge: 'badge bb' },
  MAINTENANCE: { label: 'Under Repair', badge: 'badge ba' },
  UNDER_REPAIR:{ label: 'Under Repair', badge: 'badge br' },
  DECOMMISSIONED:{ label: 'Decommissioned', badge: 'badge br' },
  INACTIVE:    { label: 'Inactive', badge: 'badge ba' },
};

const CONDITION_BADGES: Record<string, string> = {
  Good: 'badge bg',
  Fair: 'badge ba',
  Poor: 'badge br',
};

const EMPTY: VehiclePayload & { condition?: string; assignedTo?: string } = {
  registration: '', make: '', model: '', year: null, siteId: null,
  status: 'OPERATIONAL', fuelType: 'Electric 3-Wheeler', lastService: null, nextService: null, odometerKm: null,
  condition: 'Good', assignedTo: '',
};

export default function VehiclesPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | 'assign' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [assignEmpId, setAssignEmpId] = useState('');

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => vehiclesApi.list() });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const employees: any[] = empData?.data || [];
  const allVehicles: any[] = vehicles as any[];

  const createMut = useMutation({
    mutationFn: (p: VehiclePayload) => vehiclesApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || "Something went wrong."),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<VehiclePayload> }) => vehiclesApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || "Something went wrong."),
  });

  const avail = allVehicles.filter((v) => v.status === 'OPERATIONAL').length;
  const activeCount = allVehicles.filter((v) => v.status === 'ACTIVE').length;
  const assigned = allVehicles.filter((v) => v.assignedTo).length;

  const empName = (id: string) => {
    const e = employees.find((x: any) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : '';
  };

  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (v: any) => {
    setForm({
      registration: v.registration || '', make: v.make || '', model: v.model || '',
      year: v.year ?? null, siteId: v.siteId || null,
      status: v.status || 'OPERATIONAL', fuelType: v.fuelType || 'Electric 3-Wheeler',
      lastService: v.lastService ? v.lastService.slice(0, 10) : null,
      nextService: v.nextService ? v.nextService.slice(0, 10) : null,
      odometerKm: v.odometerKm ?? null,
      condition: v.condition || 'Good',
      assignedTo: v.assignedTo || '',
    });
    setActive(v); setModal('edit');
  };
  const openAssign = (v: any) => {
    setActive(v);
    setAssignEmpId(v.assignedTo || '');
    setModal('assign');
  };
  const save = () => {
    if (!form.registration?.trim()) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form as any });
    else createMut.mutate(form as any);
  };
  const saveAssign = () => {
    if (!active) return;
    updateMut.mutate({
      id: active.id,
      p: {
        assignedTo: assignEmpId,
        status: assignEmpId ? 'ACTIVE' : 'OPERATIONAL',
      } as any,
    });
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Vehicles & Fleet</div>
          <div className="ps">{allVehicles.length} vehicle{allVehicles.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Vehicle</button>
      </div>

      {/* ── Stat Cards (3 — matches prototype) ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <StatCard label="Available" value={String(avail)} sub="Ready to deploy" icon="✅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Active" value={String(activeCount)} sub="Currently deployed" icon="🚛" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Assigned" value={String(assigned)} sub="To employees" icon="👤" rail="sc-amber" color="var(--color-amber)" />
      </div>

      {/* ── Fleet Register Tab ── */}
      <div className="tabs mb14">
        <div className="tab active">🚛 Fleet Register</div>
      </div>

      {/* ── Fleet Table ── */}
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Reg No.</th>
                <th>Status</th>
                <th>Condition</th>
                <th>Assigned To</th>
                <th>Site</th>
                <th>Last Service</th>
                <th style={{ textAlign: 'center', width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allVehicles.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No vehicles yet. Click "+ Add Vehicle" to register one.
                </td></tr>
              ) : (
                allVehicles.map((v: any) => {
                  const emp = v.assignedTo ? empName(v.assignedTo) : '';
                  const site = v.site?.name || '';
                  const sm = STATUS_MAP[v.status] || { label: v.status, badge: 'badge bk' };
                  const condition = v.condition || 'Good';
                  const condBadge = CONDITION_BADGES[condition] || 'badge bk';
                  return (
                    <tr key={v.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avt" style={{ width: 28, height: 28, fontSize: 16, background: 'var(--color-surface3)' }}>🛺</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>{v.registration}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{v.fuelType || ''}{v.make ? ` · ${v.make}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{v.registration}</td>
                      <td><span className={sm.badge}>{sm.label}</span></td>
                      <td><span className={condBadge}>{condition}</span></td>
                      <td style={{ fontSize: 11 }}>
                        {emp || <span style={{ color: 'var(--color-text3)' }}>Unassigned</span>}
                      </td>
                      <td style={{ fontSize: 11 }}>{site || '—'}</td>
                      <td style={{ fontSize: 11 }}>{v.lastService ? new Date(v.lastService).toLocaleDateString() : '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => openEdit(v)}>Edit</button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => openAssign(v)}>Assign</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Add / Edit Vehicle Modal ══ */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? `Edit — ${active?.registration || ''}` : 'Add Vehicle'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Reg No. <span className="req">*</span></label>
                  <input className="fc" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="e.g. GP 123-456" /></div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={form.fuelType || 'Electric 3-Wheeler'} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
                    {loadVehicleTypes().map((t) => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="OPERATIONAL">Available</option>
                    <option value="ACTIVE">Active</option>
                    <option value="UNDER_REPAIR">Under Repair</option>
                    <option value="INACTIVE">Inactive</option>
                  </select></div>
                <div className="fg"><label className="fl">Condition</label>
                  <select className="fc" value={form.condition || 'Good'} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select></div>
                <div className="fg"><label className="fl">Site</label>
                  <select className="fc" value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value || null })}>
                    <option value="">None</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div className="fg"><label className="fl">Last Service</label>
                  <input className="fc" type="date" value={form.lastService || ''} onChange={(e) => setForm({ ...form, lastService: e.target.value || null })} /></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Assign Vehicle Modal ══ */}
      {modal === 'assign' && active && (() => {
        const eligible = employees.filter((e: any) => e.status === 'ACTIVE');
        return (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Assign Vehicle — {active.registration}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="alert alert-blue" style={{ marginBottom: 12, fontSize: 11 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
                </svg>
                <span>Only employees with a valid driving license AND at least 2 mandatory training completions are eligible.</span>
              </div>
              <div className="fgrid">
                <div className="fg full"><label className="fl">Assign To</label>
                  <select className="fc" value={assignEmpId} onChange={(e) => setAssignEmpId(e.target.value)}>
                    <option value="">Unassign</option>
                    {eligible.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.role || e.department || ''}</option>
                    ))}
                  </select></div>
              </div>
              {eligible.length === 0 && (
                <div className="alert alert-red" style={{ marginTop: 12, fontSize: 11 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  </svg>
                  <span>No eligible employees. Ensure driving license and mandatory training are complete.</span>
                </div>
              )}
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAssign} disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Saving…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
