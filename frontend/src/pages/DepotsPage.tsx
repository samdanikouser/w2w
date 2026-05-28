import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi, wasteLogsApi, employeesApi, type SitePayload } from '../api/endpoints';
import { Plus, X, Edit2 } from 'lucide-react';
import { StatCard } from './SitesPage';
import { loadDepotTypes } from './W2WSettingsPage';

/* ── Local-storage depot data (prototype parity — extra fields not in Site model) ── */
const LS_DEPOTS = 'w2w_depots_extra';
type DepotExtra = {
  siteId: string; code: string; depotType: string; phone: string; operatingHours: string;
  gps: string; capacity: number; currentStock: number; manager: string; notes: string;
};
function loadExtras(): Record<string, DepotExtra> {
  try { return JSON.parse(localStorage.getItem(LS_DEPOTS) || '{}'); } catch { return {}; }
}
function saveExtras(m: Record<string, DepotExtra>) { localStorage.setItem(LS_DEPOTS, JSON.stringify(m)); }

const EMPTY: SitePayload = {
  name: '', type: 'DEPOT', region: '', address: '', lat: null, lng: null, status: 'ACTIVE',
};

const EMPTY_EXTRA: DepotExtra = {
  siteId: '', code: '', depotType: 'IWMC', phone: '', operatingHours: '06:00–18:00',
  gps: '', capacity: 50, currentStock: 0, manager: '', notes: '',
};

export default function DepotsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<SitePayload>(EMPTY);
  const [extra, setExtra] = useState<DepotExtra>(EMPTY_EXTRA);
  const [extras, setExtras] = useState<Record<string, DepotExtra>>(loadExtras());

  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: logData } = useQuery({ queryKey: ['waste-logs', 'all'], queryFn: () => wasteLogsApi.list({}) });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });

  const allSites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const logs: any[] = logData?.data || [];
  const employees: any[] = empData?.data || [];

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

  const depots = useMemo(() => {
    return allSites
      .filter((s: any) => s.type === 'DEPOT' || s.type === 'BUYBACK_CENTRE')
      .map((s: any) => {
        const ex = extras[s.id] || { ...EMPTY_EXTRA, siteId: s.id };
        const siteLogs = logs.filter((l: any) => l.siteId === s.id);
        return { ...s, ...ex, siteId: s.id, deliveries: siteLogs.length };
      });
  }, [allSites, logs, extras]);

  // Stat counts by depot type — dynamic from settings
  const depotTypes = loadDepotTypes();
  const typeCounts = depotTypes.map((dt) => ({
    ...dt,
    count: depots.filter((d) => d.depotType === dt.code).length,
  }));
  const depotTypeName = (code: string) => depotTypes.find((dt) => dt.code === code)?.name || code;

  const empName = (id: string) => {
    const e = employees.find((x: any) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : '';
  };

  const openAdd = () => {
    setForm({ ...EMPTY }); setExtra({ ...EMPTY_EXTRA }); setActive(null); setModal('add');
  };
  const openEdit = (d: any) => {
    setForm({
      name: d.name || '', type: d.type || 'DEPOT', region: d.region || '',
      address: d.address || '', lat: d.lat ?? null, lng: d.lng ?? null, status: d.status || 'ACTIVE',
    });
    setExtra({
      siteId: d.id, code: d.code || '', depotType: d.depotType || 'IWMC',
      phone: d.phone || '', operatingHours: d.operatingHours || '06:00–18:00',
      gps: d.gps || '', capacity: d.capacity ?? 50, currentStock: d.currentStock ?? 0,
      manager: d.manager || '', notes: d.notes || '',
    });
    setActive(d); setModal('edit');
  };
  const openView = (d: any) => { setActive(d); setModal('view'); };

  const save = () => {
    if (!form.name?.trim()) return;
    if (modal === 'edit' && active) {
      updateMut.mutate({ id: active.id, p: form });
      const updated = { ...extras, [active.id]: { ...extra, siteId: active.id } };
      setExtras(updated); saveExtras(updated);
    } else {
      // Create — save extras after creation via onSuccess
      createMut.mutate(form, {
        onSuccess: (data: any) => {
          const id = data?.id || '';
          if (id) {
            const updated = { ...extras, [id]: { ...extra, siteId: id } };
            setExtras(updated); saveExtras(updated);
          }
        },
      });
    }
  };
  const remove = (d: any) => {
    if (confirm(`Delete depot "${d.name}"?`)) {
      deleteMut.mutate(d.id);
      const updated = { ...extras }; delete updated[d.id]; setExtras(updated); saveExtras(updated);
    }
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Depot Management</div>
          <div className="ps">{depots.length} depot{depots.length !== 1 ? 's' : ''} · {depotTypes.map((dt) => dt.name).slice(0, 3).join(', ')}</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Depot</button>
      </div>

      {/* ── Stat Cards (dynamic from settings) ── */}
      <div className="stats-grid">
        {typeCounts.slice(0, 3).map((tc, i) => {
          const rails = ['sc-blue', 'sc-green', 'sc-amber'];
          const colors = ['var(--color-w2w)', 'var(--color-green)', 'var(--color-amber)'];
          const icons = ['🏭', '♻️', '🏪'];
          return <StatCard key={tc.code} label={tc.name} value={String(tc.count)} sub={tc.code} icon={icons[i] || '📦'} rail={rails[i] || 'sc-blue'} color={colors[i] || 'var(--color-w2w)'} />;
        })}
        <StatCard label="Total Depots" value={String(depots.length)} sub="All types" icon="📊" rail="sc-purple" color="var(--color-purple)" />
      </div>

      {/* ── Depot Cards Grid (matches prototype) ── */}
      {depots.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
          No depots yet. Click "+ Add Depot" to create one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {depots.map((d: any) => {
            const pct = d.capacity ? Math.round((d.currentStock / d.capacity) * 100) : 0;
            const mgr = d.manager ? empName(d.manager) : '';
            const barColor = pct > 80 ? 'var(--color-red)' : pct > 50 ? 'var(--color-amber)' : 'var(--color-w2w)';
            return (
              <div className="card" key={d.id} style={{ overflow: 'hidden' }}>
                {/* colour rail */}
                <div style={{ height: 4, background: barColor, borderRadius: 'var(--r-lg) var(--r-lg) 0 0' }} />
                <div className="cb">
                  {/* Name + Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{d.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>
                        {d.id.slice(0, 8)} · {d.code || '—'} · {depotTypeName(d.depotType || d.type)}
                      </div>
                    </div>
                    <span className={`badge ${d.status === 'ACTIVE' ? 'bg' : 'ba'}`}>
                      {d.status === 'ACTIVE' ? 'Active' : d.status}
                    </span>
                  </div>

                  {/* Address */}
                  <div style={{ fontSize: 11, color: 'var(--color-text2)', marginBottom: 8 }}>{d.address || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text3)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                    GPS: {d.gps || '—'}
                  </div>

                  {/* Capacity / Stock mini cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div style={{ background: 'var(--color-surface3)', borderRadius: 7, padding: 8, fontSize: 11 }}>
                      <div style={{ color: 'var(--color-text3)' }}>Capacity</div>
                      <b>{(d.capacity || 0).toLocaleString()} t</b>
                    </div>
                    <div style={{ background: 'var(--color-surface3)', borderRadius: 7, padding: 8, fontSize: 11 }}>
                      <div style={{ color: 'var(--color-text3)' }}>Current Stock</div>
                      <b style={{ color: pct > 80 ? 'var(--color-red)' : undefined }}>{(d.currentStock || 0).toLocaleString()} t</b>
                    </div>
                  </div>

                  {/* Utilisation bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span>Utilisation</span><b>{pct}%</b>
                    </div>
                    <div className="pb"><div className="pf" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} /></div>
                  </div>

                  {/* Phone & Hours */}
                  <div style={{ fontSize: 11, color: 'var(--color-text2)', marginBottom: 4 }}>📞 {d.phone || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text2)', marginBottom: 10 }}>⏰ {d.operatingHours || '—'}</div>

                  {/* Manager */}
                  <div style={{ fontSize: 11, marginBottom: 10 }}>
                    Manager: {mgr ? <b>{mgr}</b> : <span style={{ color: 'var(--color-red)' }}>Unassigned</span>}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => openView(d)}>View</button>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => openEdit(d)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: 'var(--color-red)' }} onClick={() => remove(d)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ Add / Edit Depot Modal ══ */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? `Edit Depot — ${active?.name || ''}` : 'Add Depot'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Depot Name <span className="req">*</span></label>
                  <input className="fc" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Florida Lake Sorting Hub" /></div>
                <div className="fg"><label className="fl">Code</label>
                  <input className="fc" value={extra.code} onChange={(e) => setExtra({ ...extra, code: e.target.value.toUpperCase() })} placeholder="e.g. FLAK" style={{ textTransform: 'uppercase' }} /></div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={extra.depotType} onChange={(e) => setExtra({ ...extra, depotType: e.target.value })}>
                    {loadDepotTypes().map((dt) => <option key={dt.code} value={dt.code}>{dt.code} — {dt.name}</option>)}
                  </select></div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select></div>
                <div className="fg full"><label className="fl">Address</label>
                  <input className="fc" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" /></div>
                <div className="fg"><label className="fl">GPS Coordinates</label>
                  <input className="fc" value={extra.gps} onChange={(e) => setExtra({ ...extra, gps: e.target.value })} placeholder="-26.2041,28.0473" /></div>
                <div className="fg"><label className="fl">Phone</label>
                  <input className="fc" value={extra.phone} onChange={(e) => setExtra({ ...extra, phone: e.target.value })} placeholder="+27 11 000 0000" /></div>
                <div className="fg"><label className="fl">Operating Hours</label>
                  <input className="fc" value={extra.operatingHours} onChange={(e) => setExtra({ ...extra, operatingHours: e.target.value })} /></div>
                <div className="fg"><label className="fl">Capacity (tonnes)</label>
                  <input className="fc" type="number" value={extra.capacity} min={0}
                    onChange={(e) => setExtra({ ...extra, capacity: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Current Stock (tonnes)</label>
                  <input className="fc" type="number" value={extra.currentStock} min={0}
                    onChange={(e) => setExtra({ ...extra, currentStock: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Linked Site</label>
                  <select className="fc" value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })}>
                    <option value="">— No site —</option>
                    {allSites.filter((s: any) => s.type !== 'DEPOT' && s.type !== 'BUYBACK_CENTRE').map((s: any) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select></div>
                <div className="fg"><label className="fl">Depot Manager</label>
                  <select className="fc" value={extra.manager} onChange={(e) => setExtra({ ...extra, manager: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                    ))}
                  </select></div>
                <div className="fg full"><label className="fl">Notes</label>
                  <textarea className="fc" style={{ minHeight: 60 }} value={extra.notes} onChange={(e) => setExtra({ ...extra, notes: e.target.value })} /></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Save Changes' : 'Save Depot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ View Depot Detail Modal ══ */}
      {modal === 'view' && active && (() => {
        const siteLogs = logs.filter((l: any) => l.siteId === active.id);
        const site = allSites.find((s: any) => s.name === active.region);
        return (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{active.name} — Depot Detail</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {/* Mini stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                <StatCard label="Type" value={depotTypeName(active.depotType || active.type)} sub="" icon="" rail="sc-blue" color="var(--color-w2w)" />
                <StatCard label="Site" value={site?.name || active.region || '—'} sub="" icon="" rail="sc-green" color="var(--color-green)" />
                <StatCard label="Capacity" value={active.capacity ? `${active.capacity}t` : '—'} sub="" icon="" rail="sc-amber" color="var(--color-amber)" />
                <StatCard label="Waste Logs" value={String(siteLogs.length)} sub="" icon="" rail="sc-purple" color="var(--color-purple)" />
              </div>
              {/* Detail table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface3)' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Field</th>
                    <th style={{ padding: '7px 10px', textAlign: 'left' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Code', active.code || '—'],
                    ['Manager', active.manager ? empName(active.manager) : '—'],
                    ['Address', active.address || '—'],
                    ['GPS', active.gps || '—'],
                    ['Phone', active.phone || '—'],
                    ['Operating Hours', active.operatingHours || '—'],
                    ['Current Stock', `${active.currentStock || 0}t / ${active.capacity || 0}t`],
                    ['Status', active.status === 'ACTIVE' ? 'Active' : active.status],
                    ['Notes', active.notes || '—'],
                  ].map(([k, v]) => (
                    <tr key={k as string}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text3)' }}>{k}</td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => openEdit(active)}><Edit2 size={13} /> Edit</button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
