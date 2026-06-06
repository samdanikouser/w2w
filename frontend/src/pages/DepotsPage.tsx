import { useState, useMemo } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi, employeesApi } from '../api/endpoints';
import api from '../api/client';
import { X, Edit2, Plus, Eye } from 'lucide-react';
import { StatCard, RowBtn } from './SitesPage';

// ═══════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════

const TYPE_OPTIONS = ['IWMC', 'MRC', 'BBC'] as const;
const STATUS_OPTIONS = ['Active', 'Inactive', 'Under Construction'] as const;

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg',
  Inactive: 'br',
  'Under Construction': 'ba',
};

const avatarColor = (id: string) => {
  const p = ['#146484','#00c896','#d97706','#6d28d9','#c0392b','#1a9ec4','#10b981','#9b7fe8'];
  let h = 0; for (let i = 0; i < (id||'').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return p[h % p.length];
};

// ═══════════════════════════════════════════════════
//  Empty form default
// ═══════════════════════════════════════════════════

interface DepotForm {
  name: string;
  code: string;
  type: string;
  status: string;
  address: string;
  gps: string;
  phone: string;
  operatingHours: string;
  capacity: number;
  currentStock: number;
  linkedSiteIds: string[];
  managerUserId: string;
  notes: string;
}

const EMPTY_FORM: DepotForm = {
  name: '',
  code: '',
  type: 'IWMC',
  status: 'Active',
  address: '',
  gps: '',
  phone: '',
  operatingHours: '',
  capacity: 0,
  currentStock: 0,
  linkedSiteIds: [],
  managerUserId: '',
  notes: '',
};

// ═══════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════

export default function DepotsPage() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const qc = useQueryClient();

  // ── UI state ──
  const [modal, setModal] = useState<'view' | 'form' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeDepot, setActiveDepot] = useState<any>(null);
  const [form, setForm] = useState<DepotForm>({ ...EMPTY_FORM });

  // ═══════════════════════════════════════════════
  //  Queries
  // ═══════════════════════════════════════════════

  const { data: depotsRaw = [], isLoading } = useQuery({
    queryKey: ['depots'],
    queryFn: () => api.get('/depots').then(r => r.data),
  });

  const { data: sitesRaw = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  });

  const { data: usersRaw = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const depots: any[] = Array.isArray(depotsRaw) ? depotsRaw : (depotsRaw as any)?.data || [];
  const sites: any[] = Array.isArray(sitesRaw) ? sitesRaw : (sitesRaw as any)?.data || [];
  const employees: any[] = empData?.data || [];
  const users: any[] = Array.isArray(usersRaw) ? usersRaw : [];

  // ═══════════════════════════════════════════════
  //  Mutations
  // ═══════════════════════════════════════════════

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/depots', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['depots'] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.error || err?.response?.data?.message || err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put('/depots/' + id, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['depots'] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.error || err?.response?.data?.message || err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete('/depots/' + id).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['depots'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err?.response?.data?.message || err.message),
  });

  // ═══════════════════════════════════════════════
  //  Computed
  // ═══════════════════════════════════════════════

  const stats = useMemo(() => {
    const total = depots.length;
    const active = depots.filter((d: any) => d.status === 'Active').length;
    const totalCapacity = depots.reduce((sum: number, d: any) => sum + (Number(d.capacity) || 0), 0);
    const depotUtils = depots
      .filter((d: any) => Number(d.capacity) > 0)
      .map((d: any) => (Number(d.currentStock) || 0) / Number(d.capacity) * 100);
    const avgUtil = depotUtils.length > 0
      ? Math.round(depotUtils.reduce((s, v) => s + v, 0) / depotUtils.length)
      : 0;
    return { total, active, totalCapacity, avgUtil };
  }, [depots]);

  const capacityAlerts = useMemo(
    () => depots.filter((d: any) => {
      const cap = Number(d.capacity) || 0;
      if (cap <= 0) return false;
      return (Number(d.currentStock) || 0) / cap > 0.8;
    }),
    [depots],
  );

  // ── Lookup helpers ──
  const siteName = (siteId: string | null) => {
    if (!siteId) return '—';
    const s = sites.find((si: any) => si.id === siteId);
    return s?.name || '—';
  };

  const managerName = (userId: string | null) => {
    if (!userId) return null;
    const u = users.find((usr: any) => usr.id === userId);
    if (!u) return null;
    return u.name || u.email || null;
  };

  const utilPct = (d: any) => {
    const cap = Number(d.capacity) || 0;
    if (cap <= 0) return 0;
    return Math.round((Number(d.currentStock) || 0) / cap * 100);
  };

  const utilRail = (pct: number) =>
    pct > 80 ? 'sc-red' : pct > 50 ? 'sc-amber' : 'sc-green';

  const utilBarColor = (pct: number) =>
    pct > 80 ? 'var(--color-red)' : pct > 50 ? 'var(--color-amber)' : 'var(--color-green)';

  // ═══════════════════════════════════════════════
  //  Handlers
  // ═══════════════════════════════════════════════

  const closeModal = () => { setModal(null); setEditingId(null); setActiveDepot(null); };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModal('form');
  };

  const openEdit = (d: any) => {
    setEditingId(d.id);
    setForm({
      name: d.name || '',
      code: d.code || '',
      type: d.type || 'IWMC',
      status: d.status || 'Active',
      address: d.address || '',
      gps: d.gps || '',
      phone: d.phone || '',
      operatingHours: d.operatingHours || '',
      capacity: d.capacity ?? 0,
      currentStock: d.currentStock ?? 0,
      linkedSiteIds: (d.sites || []).map((s: any) => s.id),
      managerUserId: d.managerUserId || '',
      notes: d.notes || '',
    });
    setModal('form');
  };

  const openView = (d: any) => {
    setActiveDepot(d);
    setModal('view');
  };

  const toggleSite = (siteId: string) => {
    setForm(prev => ({
      ...prev,
      linkedSiteIds: prev.linkedSiteIds.includes(siteId)
        ? prev.linkedSiteIds.filter(id => id !== siteId)
        : [...prev.linkedSiteIds, siteId],
    }));
  };

  const submitForm = () => {
    if (!form.name.trim()) { alert('Depot name is required'); return; }
    const payload: any = {
      name: form.name.trim(),
      code: form.code.trim() || null,
      type: form.type,
      status: form.status,
      address: form.address.trim() || null,
      gps: form.gps.trim() || null,
      phone: form.phone.trim() || null,
      operatingHours: form.operatingHours.trim() || null,
      capacity: Number(form.capacity) || 0,
      currentStock: Number(form.currentStock) || 0,
      linkedSiteIds: form.linkedSiteIds,
      managerUserId: form.managerUserId || null,
      notes: form.notes.trim() || null,
    };
    if (editingId) updateMut.mutate({ id: editingId, data: payload });
    else createMut.mutate(payload);
  };

  const removeDepot = (d: any) => {
    if (confirm(`Delete depot "${d.name}"?`)) deleteMut.mutate(d.id);
  };

  const getGps = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setForm((prev) => ({
        ...prev,
        gps: p.coords.latitude.toFixed(6) + ',' + p.coords.longitude.toFixed(6),
      })),
      () => alert('Unable to get GPS position'),
    );
  };

  // ═══════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text3)' }}>
        Loading depots…
      </div>
    );
  }

  return (
    <div>
      {/* ══ Page Header ══ */}
      <div className="ph">
        <div>
          <div className="pt">Depot Management</div>
          <div className="ps">{depots.length} depots registered</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreate('depots') && <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Depot</button>}
        </div>
      </div>

      {/* ══ Stats Row ══ */}
      <div className="stats-grid mb20" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard label="Total Depots" value={String(stats.total)} sub="" icon="🏭" rail="sc-blue" />
        <StatCard label="Active Depots" value={String(stats.active)} sub={`of ${stats.total} total`} icon="✅" rail="sc-green" />
        <StatCard label="Total Capacity" value={stats.totalCapacity.toFixed(1) + 't'} sub="in tonnes" icon="📦" rail="sc-amber" />
        <StatCard label="Avg Utilisation" value={stats.avgUtil + '%'} sub="" icon="📊" rail="sc-purple" />
      </div>

      {/* ══ Capacity Alert ══ */}
      {capacityAlerts.length > 0 && (
        <div className="alert alert-red" style={{ marginBottom: 16 }}>
          <b>Capacity Alert:</b>{' '}
          {capacityAlerts.map((d: any) => (
            <span key={d.id}><b>{d.name}</b> ({utilPct(d)}%) </span>
          ))}
          nearing full capacity.
        </div>
      )}

      {/* ══ Depot Card Grid ══ */}
      {depots.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
          No depots yet. Click "Add Depot" to create your first.
        </div>
      ) : (
        <div className="g3">
          {depots.map((d: any) => {
            const pct = utilPct(d);
            const mgr = managerName(d.managerUserId);
            return (
              <div key={d.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Top color rail */}
                <div style={{
                  height: 3,
                  background: pct > 80 ? 'var(--color-red)' : pct > 50 ? 'var(--color-amber)' : 'var(--color-green)',
                }} />
                <div style={{ padding: '12px 14px' }}>
                  {/* Header: Name + status */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{d.name}</div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--mono, monospace)', color: 'var(--color-text3)' }}>
                        {d.id?.slice(0, 8)} · {d.code || '—'} · {d.type}
                      </div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[d.status] || 'bk'}`} style={{ fontSize: 9, flexShrink: 0 }}>
                      {d.status}
                    </span>
                  </div>

                  {/* Address */}
                  {d.address && (
                    <div style={{ fontSize: 12, color: 'var(--color-text3)', marginBottom: 4 }}>
                      {d.address}
                    </div>
                  )}

                  {/* GPS */}
                  {d.gps && (
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono, monospace)', color: 'var(--color-text3)', marginBottom: 8 }}>
                      📍 {d.gps}
                    </div>
                  )}

                  {/* 2-column mini stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11, marginBottom: 8 }}>
                    <div style={{ color: 'var(--color-text3)' }}>📦 Capacity</div>
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>{Number(d.capacity || 0).toFixed(1)}t</div>
                    <div style={{ color: 'var(--color-text3)' }}>📋 Current Stock</div>
                    <div style={{ fontWeight: 600, textAlign: 'right' }}>{Number(d.currentStock || 0).toFixed(1)}t</div>
                  </div>

                  {/* Utilisation progress bar */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--color-text3)' }}>Utilisation</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: utilBarColor(pct) }}>{pct}%</span>
                    </div>
                    <div className="pb">
                      <div className="pf" style={{ width: Math.min(pct, 100) + '%', background: utilBarColor(pct) }} />
                    </div>
                  </div>

                  {/* Phone & Hours */}
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text3)', marginBottom: 8 }}>
                    {d.phone && <span>📞 {d.phone}</span>}
                    {d.operatingHours && <span>⏰ {d.operatingHours}</span>}
                  </div>

                  {/* Linked Sites */}
                  {d.sites?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--color-text3)', marginBottom: 4 }}>📍 Linked Sites ({d.sites.length})</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {d.sites.map((s: any) => (
                          <span key={s.id} className="badge bb" style={{ fontSize: 9 }}>{s.name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manager */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {mgr ? (
                      <>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: avatarColor(d.managerUserId),
                          color: 'white', fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {mgr.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{mgr}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--color-red)', fontWeight: 600 }}>Unassigned</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                    <RowBtn title="View" onClick={() => openView(d)}><Eye size={12} /> <span style={{ fontSize: 11 }}>View</span></RowBtn>
                    {canEdit('depots') && <RowBtn title="Edit" onClick={() => openEdit(d)}><Edit2 size={12} /> <span style={{ fontSize: 11 }}>Edit</span></RowBtn>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════
           View Depot Detail Modal
          ═══════════════════════════════════════════ */}
      {modal === 'view' && activeDepot && (
        <div className="modal-ov open" onClick={closeModal}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{activeDepot.name} — Depot Detail</span>
              <button onClick={closeModal} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {/* 2x2 Mini stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                {([
                  ['Type', activeDepot.type, '🏭'],
                  ['Linked Sites', (activeDepot.sites?.length || 0) + ' sites', '📍'],
                  ['Capacity', (Number(activeDepot.capacity) || 0).toFixed(1) + 't', '📦'],
                  ['Status', activeDepot.status, '🔄'],
                ] as [string, string, string][]).map(([label, val, ico]) => (
                  <div key={label} style={{
                    background: 'var(--color-surface3)', borderRadius: 8, padding: '10px 14px',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{ico}</span> {label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Detail table */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6 }}>
                Details
              </div>
              {([
                ['Manager', managerName(activeDepot.managerUserId) || '—'],
                ['Address', activeDepot.address],
                ['GPS', activeDepot.gps],
                ['Phone', activeDepot.phone],
                ['Operating Hours', activeDepot.operatingHours],
                ['Current Stock', activeDepot.currentStock != null ? Number(activeDepot.currentStock).toFixed(1) + 't' : '—'],
                ['Utilisation', Number(activeDepot.capacity) > 0 ? utilPct(activeDepot) + '%' : '—'],
                ['Notes', activeDepot.notes],
              ] as [string, any][]).map(([k, v]) => (
                <div key={k} className="drow">
                  <div className="dlb">{k}</div>
                  <div className="dvl">{v || '—'}</div>
                </div>
              ))}

              {/* Linked Sites */}
              {activeDepot.sites?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6 }}>
                    Linked Sites ({activeDepot.sites.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {activeDepot.sites.map((s: any) => (
                      <span key={s.id} className="badge bb" style={{ fontSize: 10 }}>📍 {s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={closeModal}>Close</button>
              {canEdit('depots') && <button className="btn btn-primary" onClick={() => { closeModal(); openEdit(activeDepot); }}>
                <Edit2 size={13} /> Edit
              </button>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           Add / Edit Depot Modal
          ═══════════════════════════════════════════ */}
      {modal === 'form' && (
        <div className="modal-ov open" onClick={closeModal}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{editingId ? 'Edit Depot' : 'Add Depot'}</span>
              <button onClick={closeModal} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                {/* Depot Name — full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Depot Name <span className="req">*</span></label>
                    <input
                      className="fc"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Johannesburg Central Depot"
                    />
                  </div>
                </div>

                {/* Code */}
                <div className="fg">
                  <label className="fl">Code</label>
                  <input
                    className="fc"
                    value={form.code}
                    onInput={(e) => {
                      const t = e.target as HTMLInputElement;
                      t.value = t.value.toUpperCase();
                      setForm({ ...form, code: t.value });
                    }}
                    placeholder="e.g. FLAK"
                  />
                </div>

                {/* Type */}
                <div className="fg">
                  <label className="fl">Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Status */}
                <div className="fg">
                  <label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Phone */}
                <div className="fg">
                  <label className="fl">Phone</label>
                  <input
                    className="fc"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+27 11 123 4567"
                  />
                </div>

                {/* Address — full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Address</label>
                    <input
                      className="fc"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Full street address"
                    />
                  </div>
                </div>

                {/* GPS Coordinates */}
                <div className="fg">
                  <label className="fl">GPS Coordinates</label>
                  <input
                    className="fc"
                    value={form.gps}
                    onChange={(e) => setForm({ ...form, gps: e.target.value })}
                    placeholder="-26.1234,28.0456"
                  />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, fontSize: 11 }} onClick={getGps}>
                    📍 Get GPS
                  </button>
                </div>

                {/* Operating Hours */}
                <div className="fg">
                  <label className="fl">Operating Hours</label>
                  <input
                    className="fc"
                    value={form.operatingHours}
                    onChange={(e) => setForm({ ...form, operatingHours: e.target.value })}
                    placeholder="06:00–18:00"
                  />
                </div>

                {/* Capacity */}
                <div className="fg">
                  <label className="fl">Capacity (tonnes)</label>
                  <input
                    className="fc"
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {/* Current Stock */}
                <div className="fg">
                  <label className="fl">Current Stock (tonnes)</label>
                  <input
                    className="fc"
                    type="number"
                    min={0}
                    step="0.1"
                    value={form.currentStock}
                    onChange={(e) => setForm({ ...form, currentStock: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                {/* Linked Sites (multi-select) */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Linked Sites ({form.linkedSiteIds.length} selected)</label>
                    <div style={{
                      border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 10px',
                      maxHeight: 160, overflow: 'auto', background: 'var(--color-surface3)',
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px',
                    }}>
                      {sites.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--color-text3)', gridColumn: '1/-1', textAlign: 'center', padding: 8 }}>No sites available</div>
                      ) : sites.map((s: any) => (
                        <label key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                          padding: '4px 6px', borderRadius: 6, cursor: 'pointer',
                          background: form.linkedSiteIds.includes(s.id) ? 'var(--color-w2w-light)' : 'transparent',
                        }}>
                          <input
                            type="checkbox"
                            checked={form.linkedSiteIds.includes(s.id)}
                            onChange={() => toggleSite(s.id)}
                            style={{ accentColor: 'var(--color-w2w)' }}
                          />
                          <span style={{ fontWeight: form.linkedSiteIds.includes(s.id) ? 600 : 400 }}>{s.name}</span>
                          <span className={`badge ${s.status === 'ACTIVE' ? 'bg' : 'bk'}`} style={{ fontSize: 8, marginLeft: 'auto' }}>{s.type || ''}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Depot Manager */}
                <div className="fg">
                  <label className="fl">Depot Manager</label>
                  <select className="fc" value={form.managerUserId} onChange={(e) => setForm({ ...form, managerUserId: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes — full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Notes</label>
                    <textarea
                      className="fc"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Optional notes about this depot"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitForm}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : editingId ? 'Update Depot' : 'Add Depot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
