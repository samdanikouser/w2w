import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi, employeesApi, wasteLogsApi, cooperativesApi, depotsApi, type SitePayload } from '../api/endpoints';
import { MapPin, Building2, Plus, Download, Search, X, Edit2, Trash2, Eye } from 'lucide-react';
import { exportCsv } from '../utils/csv';
import { loadGeography } from '../utils/geography';
import { loadDepotTypes } from './W2WSettingsPage';

const BASE_TYPE_LABELS: Record<string, string> = {
  COOPERATIVE: 'Cooperative',
  DEPOT: 'Depot',
  BUYBACK_CENTRE: 'Buyback Centre',
};

function getTypeLabels(): Record<string, string> {
  const labels = { ...BASE_TYPE_LABELS };
  loadDepotTypes().forEach((dt) => { labels[dt.code] = dt.name; });
  return labels;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'badge bg',
  INACTIVE: 'badge bk',
};

const EMPTY: SitePayload = {
  name: '', type: 'IWMC', region: '', address: '', lat: null, lng: null, status: 'ACTIVE',
  ward: '', gps: '', supervisor: '', beneficiaries: 30, ohsRating: 80, monthlyTonnage: 0,
  phase: 'Month 1', focus: '', cleanliness: 'Good', launched: '', notes: '',
  provinceId: '', municipalityId: '', subRegionId: '',
};

export default function SitesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<SitePayload>(EMPTY);

  const { data: sitesData = [], isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });

  const { data: coopsData = [] } = useQuery({
    queryKey: ['cooperatives'],
    queryFn: () => cooperativesApi.list(),
  });

  const { data: logData } = useQuery({
    queryKey: ['waste-logs'],
    queryFn: () => wasteLogsApi.list({}),
  });

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  });

  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const employees: any[] = empData?.data || [];
  const logs: any[] = logData?.data || [];
  const cooperatives: any[] = Array.isArray(coopsData) ? coopsData : (coopsData as any)?.data || [];

  const createMut = useMutation({
    mutationFn: (p: SitePayload) => sitesApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setModal(null); },
    onError: (err: any) => { alert('Failed to create site: ' + (err?.response?.data?.message || err?.message || 'Unknown error')); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<SitePayload> }) => sitesApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setModal(null); },
    onError: (err: any) => { alert('Failed to update site: ' + (err?.response?.data?.message || err?.message || 'Unknown error')); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => sitesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
    onError: (err: any) => { alert('Failed to delete site: ' + (err?.response?.data?.message || err?.message || 'Unknown error')); },
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
      name: s.name || '', type: s.type || 'IWMC', region: s.region || '',
      address: s.address || '', lat: s.lat ?? null, lng: s.lng ?? null, status: s.status || 'ACTIVE',
      ward: s.ward || '', gps: s.gps || '', supervisor: s.supervisor || '',
      beneficiaries: s.beneficiaries ?? 30, ohsRating: s.ohsRating ?? 80,
      monthlyTonnage: s.monthlyTonnage ?? 0, phase: s.phase || 'Month 1',
      focus: s.focus || '', cleanliness: s.cleanliness || 'Good',
      launched: s.launched || '', notes: s.notes || '',
      provinceId: s.provinceId || '', municipalityId: s.municipalityId || '',
      subRegionId: s.subRegionId || '',
    });
    setActive(s); setModal('edit');
  };
  const openView = (s: any) => { setActive(s); setModal('view'); };
  const save = () => {
    if (!form.name?.trim()) return;
    // Coerce numeric fields
    const payload: SitePayload = {
      ...form,
      beneficiaries: Number(form.beneficiaries) || 0,
      ohsRating: Number(form.ohsRating) || 80,
      monthlyTonnage: Number(form.monthlyTonnage) || 0,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
    };
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: payload });
    else createMut.mutate(payload);
  };
  const remove = (s: any) => {
    if (confirm(`Delete site "${s.name}"?`)) deleteMut.mutate(s.id);
  };
  const onExport = () => {
    exportCsv('sites', filtered, [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type', map: (r: any) => getTypeLabels()[r.type] || r.type },
      { key: 'region', label: 'Region' },
      { key: 'address', label: 'Address' },
      { key: 'empCount', label: 'Employees' },
      { key: 'deliveries', label: 'Deliveries' },
      { key: 'totalKg', label: 'Recovered (kg)', map: (r: any) => r.totalKg.toFixed(1) },
      { key: 'totalRev', label: 'Revenue (R)', map: (r: any) => r.totalRev.toFixed(2) },
      { key: 'status', label: 'Status' },
    ]);
  };

  // ── Aggregated stats matching reference ──
  const totalBens = sites.reduce((s, si: any) => s + (si.beneficiaries || 0), 0);
  const totalTons = sites.reduce((s, si: any) => s + (si.monthlyTonnage || 0), 0);
  const avgOHS = sites.length > 0 ? Math.round(sites.reduce((s, si: any) => s + (si.ohsRating || 0), 0) / sites.length) : 0;
  const ohsAlertSites = sites.filter((s: any) => (s.ohsRating || 80) < 70);

  // ── Group sites by sub-region / region for hierarchy view ──
  const regionGroups = useMemo(() => {
    const geo = loadGeography();
    const srMap = new Map<string, any>();
    (geo.subRegions || []).forEach((sr: any) => srMap.set(sr.id, sr));

    const map = new Map<string, { sites: any[]; description: string }>();
    filtered.forEach((s) => {
      // Resolve region name: first try subRegionId → geography name, then fall back to region field
      let regionName = s.region || '';
      let description = '';
      if (s.subRegionId && srMap.has(s.subRegionId)) {
        const sr = srMap.get(s.subRegionId)!;
        regionName = sr.name || regionName;
        description = sr.description || '';
      }
      if (!regionName) regionName = 'Unassigned';

      if (!map.has(regionName)) map.set(regionName, { sites: [], description });
      map.get(regionName)!.sites.push(s);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, sites: data.sites, description: data.description }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const [siteTab, setSiteTab] = useState<'sites' | 'coops'>('sites');

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Sites, Regions & Cooperatives</div>
          <div className="ps" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} /> Gauteng · CoJ Metro · {regionGroups.length} Planning Regions · {sites.length} Sites · {cooperatives.length} Cooperatives
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Site</button>
          <button className="btn btn-ghost" onClick={onExport}><Download size={13} /> Export</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--color-border)' }}>
        <button
          onClick={() => setSiteTab('sites')}
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', border: 'none', borderBottom: siteTab === 'sites' ? '3px solid var(--color-w2w)' : '3px solid transparent',
            color: siteTab === 'sites' ? 'var(--color-w2w)' : 'var(--color-text3)', transition: 'all 0.2s',
          }}
        >🏗 Sites & Regions</button>
        <button
          onClick={() => setSiteTab('coops')}
          style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'transparent', border: 'none', borderBottom: siteTab === 'coops' ? '3px solid var(--color-w2w)' : '3px solid transparent',
            color: siteTab === 'coops' ? 'var(--color-w2w)' : 'var(--color-text3)', transition: 'all 0.2s',
          }}
        >🤝 Cooperatives ({cooperatives.length})</button>
      </div>

      {siteTab === 'coops' ? (
        <CooperativesSection sites={sites} employees={employees} logs={logs} cooperatives={cooperatives} />
      ) : (
        <>
          {/* OHS Alert */}
          {ohsAlertSites.length > 0 && (
            <div className="alert alert-red" style={{ marginBottom: 16 }}>
              <b>OHS Alert:</b> {ohsAlertSites.map((s: any) => <span key={s.id}><b>{s.name}</b> ({s.ohsRating}%) </span>)} require corrective action.
            </div>
          )}

          {/* Stats */}
          <div className="g4 mb20">
            <StatCard label="Active Sites" value={String(stats.active)} sub={`of ${stats.total} total`} icon="🏗" rail="sc-blue" />
            <StatCard label="Total Beneficiaries" value={String(totalBens)} sub="across all sites" icon="👷" rail="sc-green" />
            <StatCard label="Monthly Tonnage" value={totalTons + 't'} sub="" icon="⚖" rail="sc-amber" />
            <StatCard label="Avg OHS Rating" value={avgOHS + '%'} sub="" icon="🛡" rail="sc-purple" />
          </div>

          {/* Province & Municipality — dynamic from Geography settings */}
          {(() => {
            const geo = loadGeography();
            const province = geo.provinces?.[0];
            const municipality = geo.municipalities?.[0];
            return (
              <>
                {/* Province Header */}
                {province && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ background: 'var(--color-ink)', color: 'var(--color-accent)', padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🇿🇦 Province</div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{province.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text3)' }}>Code: {province.code}{province.premier ? ` · Premier: ${province.premier}` : ''}</div>
                  </div>
                )}

                {/* Municipality */}
                {municipality && (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--color-w2w-light)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: 'var(--color-w2w)', color: 'white', padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{municipality.type || 'Municipality'}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{municipality.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>Code: {municipality.code} · {sites.length} sites · {regionGroups.length} planning regions</div>
                        </div>
                      </div>
                      <span className="badge bg">Active</span>
                    </div>

            {/* Sub-Regions with Sites LIST */}
            <div style={{ padding: 14 }}>
              {regionGroups.map((group) => {
                const regionName = group.name;
                const regionSites = group.sites;
                const srCoops = cooperatives.filter((co: any) => regionSites.find((s: any) => s.id === co.siteId || co.region === regionName));
                const srBens = regionSites.reduce((sum: number, s: any) => sum + (s.beneficiaries || 0), 0);
                const srTons = regionSites.reduce((sum: number, s: any) => sum + (s.monthlyTonnage || 0), 0);

                return (
                  <div key={regionName} style={{ marginBottom: 18 }}>
                    {/* Sub-Region Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '8px 12px', background: 'var(--color-surface3)', borderRadius: 8, borderLeft: '3px solid var(--color-accent)' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)' }}>📍 {regionName}</div>
                        {group.description && <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>{group.description}</div>}
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <span className="badge bb" style={{ fontSize: 9 }}>{regionSites.length} site{regionSites.length !== 1 ? 's' : ''}</span>
                        <span className="badge bc" style={{ fontSize: 9 }}>{srCoops.length} coop{srCoops.length !== 1 ? 's' : ''}</span>
                        <span className="badge bg" style={{ fontSize: 9 }}>{srBens} beneficiaries</span>
                        <span className="badge ba" style={{ fontSize: 9 }}>{srTons}t/mo</span>
                      </div>
                    </div>

                    {/* Sites Table */}
                    <div className="tw" style={{ paddingLeft: 12 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Site</th>
                            <th>Type</th>
                            <th>Ward</th>
                            <th>Tonnage</th>
                            <th>Beneficiaries</th>
                            <th>OHS</th>
                            <th>Supervisor</th>
                            <th>Staff</th>
                            <th>Status</th>
                            <th style={{ width: 80 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {regionSites.map((s: any) => {
                            const ohsRating = s.ohsRating || 80;
                            const ohsColor = ohsRating >= 80 ? 'var(--color-green)' : ohsRating >= 65 ? 'var(--color-amber)' : 'var(--color-red)';
                            return (
                              <tr key={s.id}>
                                <td>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 12 }}>{s.name}</div>
                                    <div style={{ fontSize: 9, color: 'var(--color-text3)', fontFamily: 'var(--mono, monospace)' }}>{s.id?.slice(0, 8)}</div>
                                  </div>
                                </td>
                                <td><span className="badge bb" style={{ fontSize: 10 }}>{getTypeLabels()[s.type] || s.type}</span></td>
                                <td style={{ fontSize: 11 }}>{s.ward || '—'}</td>
                                <td style={{ fontWeight: 700, fontSize: 12 }}>{s.monthlyTonnage || 0}t</td>
                                <td style={{ fontWeight: 700, fontSize: 12 }}>{s.beneficiaries || 0}</td>
                                <td style={{ minWidth: 80 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, background: 'var(--color-surface3)', borderRadius: 3, height: 4 }}>
                                      <div style={{ width: ohsRating + '%', background: ohsColor, borderRadius: 3, height: 4 }} />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: ohsColor, minWidth: 28 }}>{ohsRating}%</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: 11 }}>
                                  {s.supervisor ? <span style={{ fontWeight: 600 }}>{s.supervisor}</span> : <span style={{ color: 'var(--color-red)', fontSize: 10 }}>Unassigned</span>}
                                </td>
                                <td style={{ fontWeight: 600, textAlign: 'center' }}>{s.empCount}</td>
                                <td><span className={`badge ${s.status === 'ACTIVE' ? 'bg' : 'ba'}`} style={{ fontSize: 9 }}>{s.status === 'ACTIVE' ? 'Active' : s.status}</span></td>
                                <td>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <RowBtn title="Edit" onClick={() => openEdit(s)}><Edit2 size={13} /></RowBtn>
                                    <RowBtn title="Delete" danger onClick={() => remove(s)}><Trash2 size={13} /></RowBtn>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* ── Add/Edit Modal ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Site' : 'Add Site'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full">
                  <div className="fg"><label className="fl">Site Name <span className="req">*</span></label>
                    <input className="fc" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diepsloot Dumping Site" />
                  </div>
                </div>
                <div className="fg"><label className="fl">Province</label>
                  <select className="fc" value={form.provinceId || ''} onChange={(e) => setForm({ ...form, provinceId: e.target.value })}>
                    <option value="">Select province</option>
                    {loadGeography().provinces.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Municipality</label>
                  <select className="fc" value={form.municipalityId || ''} onChange={(e) => setForm({ ...form, municipalityId: e.target.value })}>
                    <option value="">Select municipality</option>
                    {loadGeography().municipalities.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Sub-Region (Planning Region)</label>
                  <select className="fc" value={form.subRegionId || ''} onChange={(e) => setForm({ ...form, subRegionId: e.target.value })}>
                    <option value="">Select sub-region</option>
                    {loadGeography().subRegions.map((sr: any) => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {Object.entries(getTypeLabels()).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Ward</label>
                  <input className="fc" value={form.ward || ''} onChange={(e) => setForm({ ...form, ward: e.target.value })} placeholder="Ward number" />
                </div>
                <div className="fg"><label className="fl">GPS Coordinates</label>
                  <input className="fc" value={form.gps || ''} onChange={(e) => setForm({ ...form, gps: e.target.value })} placeholder="-26.1234,28.0456" />
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4, fontSize: 11 }} onClick={() => {
                    navigator.geolocation?.getCurrentPosition((p) => {
                      setForm((prev) => ({ ...prev, gps: p.coords.latitude.toFixed(6) + ',' + p.coords.longitude.toFixed(6) }));
                    });
                  }}>📍 Get GPS</button>
                </div>
                <div className="fg"><label className="fl">Address</label>
                  <input className="fc" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, suburb" />
                </div>
                <div className="fg"><label className="fl">Supervisor</label>
                  <input className="fc" value={form.supervisor || ''} onChange={(e) => setForm({ ...form, supervisor: e.target.value })} placeholder="Supervisor name or ID" />
                </div>
                <div className="fg"><label className="fl">Target Beneficiaries</label>
                  <input className="fc" type="number" value={form.beneficiaries ?? 30} onChange={(e) => setForm({ ...form, beneficiaries: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="fg"><label className="fl">OHS Rating (%)</label>
                  <input className="fc" type="number" min={0} max={100} value={form.ohsRating ?? 80} onChange={(e) => setForm({ ...form, ohsRating: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="fg"><label className="fl">Monthly Tonnage (t)</label>
                  <input className="fc" type="number" step="0.1" value={form.monthlyTonnage ?? 0} onChange={(e) => setForm({ ...form, monthlyTonnage: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="fg"><label className="fl">Launch Date</label>
                  <input className="fc" type="date" value={form.launched || ''} onChange={(e) => setForm({ ...form, launched: e.target.value })} />
                </div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Latitude</label>
                  <input className="fc" type="number" step="0.000001" value={form.lat ?? ''} onChange={(e) => setForm({ ...form, lat: e.target.value ? parseFloat(e.target.value) : null })} placeholder="-26.123456" />
                </div>
                <div className="fg"><label className="fl">Longitude</label>
                  <input className="fc" type="number" step="0.000001" value={form.lng ?? ''} onChange={(e) => setForm({ ...form, lng: e.target.value ? parseFloat(e.target.value) : null })} placeholder="27.123456" />
                </div>
                <div className="full">
                  <div className="fg"><label className="fl">Focus / Description</label>
                    <input className="fc" value={form.focus || ''} onChange={(e) => setForm({ ...form, focus: e.target.value })} placeholder="e.g. High-volume plastics recovery" />
                  </div>
                </div>
                <div className="full">
                  <div className="fg"><label className="fl">Notes</label>
                    <textarea className="fc" rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
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
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{active.name}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {[
                ['Type', getTypeLabels()[active.type] || active.type],
                ['Province', active.provinceId],
                ['Municipality', active.municipalityId],
                ['Sub-Region', active.subRegionId],
                ['Programme Region', active.region],
                ['Ward', active.ward],
                ['GPS', active.gps],
                ['Address', active.address],
                ['Latitude', active.lat],
                ['Longitude', active.lng],
                ['Supervisor', active.supervisor],
                ['Target Beneficiaries', active.beneficiaries],
                ['OHS Rating', active.ohsRating ? active.ohsRating + '%' : ''],
                ['Monthly Tonnage', active.monthlyTonnage ? active.monthlyTonnage + ' t' : ''],
                ['Phase', active.phase],
                ['Focus', active.focus],
                ['Cleanliness', active.cleanliness],
                ['Launch Date', active.launched],
                ['Status', active.status],
                ['Notes', active.notes],
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

// ═══════════════════════════════════════════════════
//  Cooperatives Section
// ═══════════════════════════════════════════════════

function CooperativesSection({ sites, employees, logs, cooperatives }: { sites: any[]; employees: any[]; logs: any[]; cooperatives: any[] }) {
  const qc = useQueryClient();
  const mutCreate = useMutation({
    mutationFn: cooperativesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cooperatives'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.'),
  });
  const mutUpdate = useMutation({
    mutationFn: ({ id, payload }: { id: string, payload: any }) => cooperativesApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cooperatives'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.'),
  });
  const mutDelete = useMutation({
    mutationFn: cooperativesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cooperatives'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.'),
  });

  const [coopModal, setCoopModal] = useState<'add' | 'edit' | null>(null);
  const [editingCoopId, setEditingCoopId] = useState<string | null>(null);
  const [coopForm, setCoopForm] = useState({
    name: '', registration: '', siteId: '', stage: 'Formation', proPartner: '', mentor: '', focus: '', notes: '', region: '',
  });

  const openAddCoop = () => {
    setCoopForm({ name: '', registration: '', siteId: '', stage: 'Formation', proPartner: '', mentor: '', focus: '', notes: '', region: '' });
    setEditingCoopId(null);
    setCoopModal('add');
  };
  const openEditCoop = (co: any) => {
    setCoopForm({
      name: co.name || '', registration: co.registration || '', siteId: co.siteId || '',
      stage: co.stage || 'Formation', proPartner: co.proPartner || '', mentor: co.mentor || '',
      focus: co.focus || '', notes: co.notes || '', region: co.region || '',
    });
    setEditingCoopId(co.id);
    setCoopModal('edit');
  };
  const deleteCoop = (co: any) => {
    if (confirm(`Delete cooperative "${co.name}"?`)) {
      mutDelete.mutate(co.id);
    }
  };

  const coopData = useMemo(() => {
    return cooperatives.map((co: any) => {
      const matchedSite = sites.find((s: any) =>
        s.id === co.siteId ||
        (s.name && co.name.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]))
      );
      const siteId = matchedSite?.id;
      const siteName = matchedSite?.name || '—';
      const siteLogs = siteId ? logs.filter((l: any) => l.siteId === siteId) : [];
      const rev = siteLogs.reduce((s: number, l: any) => s + (Number(l.totalValue) || 0), 0);
      const members = siteId ? employees.filter((e: any) => e.siteId === siteId && (e.status || '').toUpperCase() === 'ACTIVE').length : 0;
      return { ...co, siteName, rev: Math.round(rev), members, deliveries: siteLogs.length };
    });
  }, [cooperatives, sites, employees, logs]);

  const activeCoops = coopData.filter((c: any) => c.rev > 0 || c.members > 0).length;

  const handleSaveCoop = () => {
    if (!coopForm.name.trim()) { alert('Cooperative name is required'); return; }
    if (!coopForm.siteId) { alert('Please assign a site'); return; }
    const selectedSite = sites.find((s: any) => s.id === coopForm.siteId);
    if (coopModal === 'edit' && editingCoopId) {
      mutUpdate.mutate({
        id: editingCoopId, payload: {
          name: coopForm.name, siteId: coopForm.siteId,
          region: selectedSite?.region || coopForm.region || '',
          focus: coopForm.focus, mentor: coopForm.mentor || coopForm.proPartner || '',
          registration: coopForm.registration, stage: coopForm.stage,
          proPartner: coopForm.proPartner, notes: coopForm.notes,
        }
      });
    } else {
      mutCreate.mutate({
        name: coopForm.name, siteId: coopForm.siteId,
        region: selectedSite?.region || coopForm.region || '',
        focus: coopForm.focus, mentor: coopForm.mentor || coopForm.proPartner || 'SCM PMO',
        registration: coopForm.registration, stage: coopForm.stage,
        proPartner: coopForm.proPartner, notes: coopForm.notes,
      });
    }
    setCoopModal(null);
  };

  return (
    <>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="ch">
          <div className="ct">Cooperatives</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="cs">{cooperatives.length} cooperatives · {activeCoops} active</div>
            <button className="btn btn-accent btn-sm" onClick={openAddCoop}><Plus size={12} /> Add Cooperative</button>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Cooperative</th>
                <th>Linked Site</th>
                <th>Region</th>
                <th>Focus</th>
                <th>Mentor</th>
                <th>Members</th>
                <th>Deliveries</th>
                <th>Revenue</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coopData.map((co: any) => (
                <tr key={co.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>🤝</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{co.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)', fontFamily: 'var(--mono, monospace)' }}>{co.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 11 }}>{co.siteName}</td>
                  <td><span className="badge bb" style={{ fontSize: 10 }}>{co.region}</span></td>
                  <td style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.focus}</td>
                  <td style={{ fontSize: 11 }}>{co.mentor}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{co.members}</td>
                  <td style={{ textAlign: 'center' }}>{co.deliveries}</td>
                  <td style={{ fontWeight: 700, color: co.rev > 0 ? 'var(--color-green)' : 'var(--color-text3)' }}>
                    {co.rev > 0 ? 'R ' + co.rev.toLocaleString() : '—'}
                  </td>
                  <td>
                    {co.rev > 0 || co.members > 0
                      ? <span style={{ color: 'var(--color-green)', fontWeight: 700, fontSize: 11 }}>● Active</span>
                      : <span style={{ color: 'var(--color-text3)', fontSize: 11 }}>○ Formation</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <RowBtn title="Edit" onClick={() => openEditCoop(co)}><Edit2 size={13} /></RowBtn>
                      <RowBtn title="Delete" danger onClick={() => deleteCoop(co)}><Trash2 size={13} /></RowBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Cooperative Modal */}
      {coopModal && (
        <div className="modal-ov open" onClick={() => setCoopModal(null)}>
          <div className="modal" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{coopModal === 'edit' ? `Edit ${coopForm.name || 'Cooperative'}` : 'Add Cooperative'}</span>
              <button onClick={() => setCoopModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Cooperative Name <span className="req">*</span></label>
                  <input className="fc" value={coopForm.name} onChange={(e) => setCoopForm({ ...coopForm, name: e.target.value })} placeholder="e.g. Diepsloot Greens Cooperative" />
                </div>
                <div className="fg"><label className="fl">Registration No.</label>
                  <input className="fc" value={coopForm.registration} onChange={(e) => setCoopForm({ ...coopForm, registration: e.target.value })} placeholder="e.g. CK2023/001234" />
                </div>
                <div className="fg"><label className="fl">Assigned Site <span className="req">*</span></label>
                  <select className="fc" value={coopForm.siteId} onChange={(e) => setCoopForm({ ...coopForm, siteId: e.target.value })}>
                    <option value="">Select site</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Stage</label>
                  <select className="fc" value={coopForm.stage} onChange={(e) => setCoopForm({ ...coopForm, stage: e.target.value })}>
                    <option>Formation</option>
                    <option>Registered</option>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">PRO Partner</label>
                  <select className="fc" value={coopForm.proPartner} onChange={(e) => setCoopForm({ ...coopForm, proPartner: e.target.value })}>
                    <option value="">None</option>
                    {(() => { const geo = loadGeography(); return (geo.proPartners || []).map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>); })()}
                  </select>
                </div>
                <div className="fg"><label className="fl">Mentor / PRO Partner</label>
                  <input className="fc" value={coopForm.mentor} onChange={(e) => setCoopForm({ ...coopForm, mentor: e.target.value })} placeholder="Mentor or facilitator name" />
                </div>
                <div className="fg"><label className="fl">Focus / Activities</label>
                  <input className="fc" value={coopForm.focus} onChange={(e) => setCoopForm({ ...coopForm, focus: e.target.value })} placeholder="e.g. Plastics, Paper, Mixed" />
                </div>
                <div className="fg full"><label className="fl">Notes</label>
                  <input className="fc" value={coopForm.notes} onChange={(e) => setCoopForm({ ...coopForm, notes: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setCoopModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveCoop}>{coopModal === 'edit' ? 'Update Cooperative' : 'Add Cooperative'}</button>
            </div>
          </div>
        </div>
      )}
    </>
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
