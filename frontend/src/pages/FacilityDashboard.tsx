import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi, employeesApi, cooperativesApi, type SitePayload } from '../api/endpoints';
import api from '../api/client';
import { X, Edit2, Trash2, Plus, Eye, MapPin } from 'lucide-react';
import { loadGeography } from '../utils/geography';
import { useSettingsStore } from '../stores/settingsStore';
import { StatCard, RowBtn } from './SitesPage';

// ═══════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════

const TYPE_LABELS: Record<string, string> = {
  IWMC: 'IWMC',
  MRC: 'MRC',
  BBC: 'BBC',
  COOPERATIVE: 'Cooperative',
  DEPOT: 'Depot',
};

const STATUS_MAP: Record<string, string> = {
  Active: 'ACTIVE',
  Inactive: 'INACTIVE',
  Planned: 'PLANNED',
};
const STATUS_REVERSE: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PLANNED: 'Planned',
};

const STAGE_BADGE: Record<string, string> = {
  Formation: 'bb',
  Registered: 'bg',
  Active: 'bg',
  Inactive: 'ba',
  Identified: 'ba',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  borderBottom: active ? '3px solid var(--color-w2w)' : '3px solid transparent',
  color: active ? 'var(--color-w2w)' : 'var(--color-text3)',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

// ═══════════════════════════════════════════════════
//  Empty form defaults
// ═══════════════════════════════════════════════════

const EMPTY_SITE: SitePayload = {
  name: '', type: 'IWMC', status: 'ACTIVE', ward: '', gps: '',
  supervisor: '', beneficiaries: 30, ohsRating: 80, monthlyTonnage: 0,
  focus: '', cleanliness: 'Good', launched: '', notes: '',
  provinceId: '', municipalityId: '', subRegionId: '',
  phase: '', region: '',
};

const EMPTY_COOP = {
  name: '', siteId: '', stage: 'Formation', registration: '',
  contactPerson: '', contactNumber: '', totalMembers: 0,
  hasBalingMachine: false, dailyTonsRecovered: 0,
  focus: '', mentor: '', proPartner: '', revenue: 0, notes: '',
  materialRates: {} as Record<string, number>,
};

// ═══════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════

export default function FacilityDashboard() {
  const qc = useQueryClient();
  const geo = useMemo(() => loadGeography(), []);
  const settings = useSettingsStore(s => s.settings);

  // ── Tabs & UI state ──
  const [activeTab, setActiveTab] = useState<'sites' | 'coops'>('sites');
  const [modal, setModal] = useState<'site-view' | 'site-form' | 'coop-form' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeSite, setActiveSite] = useState<any>(null);

  // ── Form state ──
  const [siteForm, setSiteForm] = useState<SitePayload>({ ...EMPTY_SITE });
  const [coopForm, setCoopForm] = useState({ ...EMPTY_COOP });

  // ═══════════════════════════════════════════════
  //  Queries
  // ═══════════════════════════════════════════════

  const { data: allSites = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });

  const { data: empData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  });

  const { data: allCoops = [] } = useQuery({
    queryKey: ['cooperatives'],
    queryFn: () => cooperativesApi.list(),
  });

  const sites: any[] = Array.isArray(allSites) ? allSites : (allSites as any)?.data || [];
  const employees: any[] = empData?.data || [];
  const cooperatives: any[] = Array.isArray(allCoops) ? allCoops : (allCoops as any)?.data || [];

  // ═══════════════════════════════════════════════
  //  Mutations — Sites
  // ═══════════════════════════════════════════════

  const createSite = useMutation({
    mutationFn: (data: SitePayload) => sitesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.message || err.message),
  });
  const updateSite = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SitePayload> }) => sitesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.message || err.message),
  });
  const deleteSite = useMutation({
    mutationFn: (id: string) => sitesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
    onError: (err: any) => alert(err?.response?.data?.message || err.message),
  });

  // ═══════════════════════════════════════════════
  //  Mutations — Cooperatives (direct api calls)
  // ═══════════════════════════════════════════════

  const createCoop = useMutation({
    mutationFn: (data: any) => api.post('/cooperatives', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cooperatives'] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.message || err.message),
  });
  const updateCoop = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/cooperatives/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cooperatives'] }); closeModal(); },
    onError: (err: any) => alert(err?.response?.data?.message || err.message),
  });

  // ═══════════════════════════════════════════════
  //  Computed
  // ═══════════════════════════════════════════════

  const stats = useMemo(() => {
    const active = sites.filter((s: any) => s.status === 'ACTIVE').length;
    const totalBens = sites.reduce((sum: number, s: any) => sum + (s.beneficiaries || 0), 0);
    const totalTons = sites.reduce((sum: number, s: any) => sum + (s.monthlyTonnage || 0), 0);
    const avgOHS = sites.length > 0
      ? Math.round(sites.reduce((sum: number, s: any) => sum + (s.ohsRating || 0), 0) / sites.length)
      : 0;
    return { active, total: sites.length, totalBens, totalTons, avgOHS };
  }, [sites]);

  const ohsAlertSites = useMemo(
    () => sites.filter((s: any) => (s.ohsRating || 80) < 70),
    [sites],
  );

  const staffBySite = useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((e: any) => {
      if (e.siteId) map.set(e.siteId, (map.get(e.siteId) || 0) + 1);
    });
    return map;
  }, [employees]);

  const coopsBySite = useMemo(() => {
    const map = new Map<string, any[]>();
    cooperatives.forEach((c: any) => {
      if (c.siteId) {
        if (!map.has(c.siteId)) map.set(c.siteId, []);
        map.get(c.siteId)!.push(c);
      }
    });
    return map;
  }, [cooperatives]);

  // ── Hierarchical geography tree ──
  const geoTree = useMemo(() => {
    const provinces = geo.provinces || [];
    const municipalities = geo.municipalities || [];
    const subRegions = geo.subRegions || [];

    const srMap = new Map<string, any>();
    subRegions.forEach((sr: any) => srMap.set(sr.id, sr));

    // Map sites into sub-regions
    const sitesBySubRegion = new Map<string, any[]>();
    const unassigned: any[] = [];

    sites.forEach((s: any) => {
      if (s.subRegionId && srMap.has(s.subRegionId)) {
        if (!sitesBySubRegion.has(s.subRegionId)) sitesBySubRegion.set(s.subRegionId, []);
        sitesBySubRegion.get(s.subRegionId)!.push(s);
      } else {
        unassigned.push(s);
      }
    });

    return { tree: provinces.map((prov: any) => {
      const provMunis = municipalities.filter((m: any) => m.provinceId === prov.id);
      return {
        province: prov,
        municipalities: provMunis.map((muni: any) => {
          const muniSRs = subRegions.filter((sr: any) => sr.municipalityId === muni.id);
          const muniSiteCount = muniSRs.reduce(
            (sum: number, sr: any) => sum + (sitesBySubRegion.get(sr.id)?.length || 0),
            0,
          );
          return {
            municipality: muni,
            subRegions: muniSRs.map((sr: any) => ({
              subRegion: sr,
              sites: sitesBySubRegion.get(sr.id) || [],
            })),
            siteCount: muniSiteCount,
          };
        }),
      };
    }), unassigned };
  }, [geo, sites]);

  // ── Breadcrumb ──
  const province = geo.provinces?.[0];
  const municipality = geo.municipalities?.[0];
  const regionCount = geo.subRegions?.length || 0;

  // ═══════════════════════════════════════════════
  //  Handlers
  // ═══════════════════════════════════════════════

  const closeModal = () => { setModal(null); setEditingId(null); setActiveSite(null); };

  // ── Site handlers ──
  const openAddSite = () => {
    setEditingId(null);
    setSiteForm({ ...EMPTY_SITE });
    setModal('site-form');
  };

  const openEditSite = (s: any) => {
    setEditingId(s.id);
    setSiteForm({
      name: s.name || '', type: s.type || 'IWMC', region: s.region || '',
      status: s.status || 'ACTIVE', ward: s.ward || '', gps: s.gps || '',
      supervisor: s.supervisor || '', beneficiaries: s.beneficiaries ?? 30,
      ohsRating: s.ohsRating ?? 80, monthlyTonnage: s.monthlyTonnage ?? 0,
      phase: s.phase || '', focus: s.focus || '', cleanliness: s.cleanliness || 'Good',
      launched: s.launched || '', notes: s.notes || '',
      provinceId: s.provinceId || '', municipalityId: s.municipalityId || '',
      subRegionId: s.subRegionId || '',
    });
    setModal('site-form');
  };

  const openViewSite = (s: any) => {
    setActiveSite(s);
    setModal('site-view');
  };

  const submitSite = () => {
    if (!siteForm.name?.trim()) { alert('Site name is required'); return; }
    const payload: SitePayload = {
      ...siteForm,
      beneficiaries: Number(siteForm.beneficiaries) || 0,
      ohsRating: Number(siteForm.ohsRating) || 80,
      monthlyTonnage: Number(siteForm.monthlyTonnage) || 0,
    };
    if (editingId) updateSite.mutate({ id: editingId, data: payload });
    else createSite.mutate(payload);
  };

  const removeSite = (s: any) => {
    if (confirm(`Delete site "${s.name}"?`)) deleteSite.mutate(s.id);
  };

  // ── Coop handlers ──
  const openAddCoop = () => {
    setEditingId(null);
    setCoopForm({ ...EMPTY_COOP });
    setModal('coop-form');
  };

  const openEditCoop = (c: any) => {
    setEditingId(c.id);
    const rates = c.materialPayoutRates || {};
    setCoopForm({
      name: c.name || '', siteId: c.siteId || '', stage: c.stage || 'Formation',
      registration: c.registrationNumber || c.registration || '',
      contactPerson: c.contactPerson || '', contactNumber: c.contactNumber || '',
      totalMembers: c.totalMembers || 0, hasBalingMachine: c.hasBalingMachine || false,
      dailyTonsRecovered: c.dailyTonsRecovered || 0,
      focus: c.focus || '', mentor: c.mentor || '', proPartner: c.proPartner || '',
      revenue: c.revenue || 0, notes: c.notes || '',
      materialRates: typeof rates === 'object' ? { ...rates } : {},
    });
    setModal('coop-form');
  };

  const submitCoop = () => {
    if (!coopForm.name.trim()) { alert('Cooperative name is required'); return; }
    const payload = {
      name: coopForm.name,
      siteId: coopForm.siteId || null,
      stage: coopForm.stage,
      registrationNumber: coopForm.registration,
      contactPerson: coopForm.contactPerson,
      contactNumber: coopForm.contactNumber,
      totalMembers: Number(coopForm.totalMembers) || 0,
      hasBalingMachine: coopForm.hasBalingMachine,
      dailyTonsRecovered: Number(coopForm.dailyTonsRecovered) || 0,
      focus: coopForm.focus,
      mentor: coopForm.mentor,
      proPartner: coopForm.proPartner,
      revenue: Number(coopForm.revenue) || 0,
      notes: coopForm.notes,
      materialPayoutRates: coopForm.materialRates,
    };
    if (editingId) updateCoop.mutate({ id: editingId, data: payload });
    else createCoop.mutate(payload);
  };

  // ── Geography-filtered selects ──
  const filteredMunicipalities = useMemo(() => {
    if (!siteForm.provinceId) return geo.municipalities || [];
    return (geo.municipalities || []).filter((m: any) => m.provinceId === siteForm.provinceId);
  }, [geo, siteForm.provinceId]);

  const filteredSubRegions = useMemo(() => {
    if (!siteForm.municipalityId) return geo.subRegions || [];
    return (geo.subRegions || []).filter((sr: any) => sr.municipalityId === siteForm.municipalityId);
  }, [geo, siteForm.municipalityId]);

  // OHS color helper
  const ohsColor = (rating: number) =>
    rating >= 80 ? 'var(--color-green)' : rating >= 60 ? 'var(--color-amber)' : 'var(--color-red)';

  const ohsBadgeClass = (rating: number) =>
    rating >= 80 ? 'bg' : rating >= 60 ? 'ba' : 'br';

  // ═══════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════

  return (
    <div>
      {/* ══ Page Header ══ */}
      <div className="ph">
        <div>
          <div className="pt">Sites, Regions &amp; Cooperatives</div>
          <div className="ps" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} /> {province?.name || 'Gauteng'} › {municipality?.name?.replace('Municipality', 'Metro').replace('Metropolitan ', '') || 'CoJ Metro'} › Planning Regions › {sites.length} Sites › {cooperatives.length} Cooperatives
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'sites' && (
            <button className="btn btn-accent" onClick={openAddSite}><Plus size={13} /> Add Site</button>
          )}
          {activeTab === 'coops' && (
            <button className="btn btn-accent" onClick={openAddCoop}><Plus size={13} /> Add Cooperative</button>
          )}
        </div>
      </div>

      {/* ══ Tabs ══ */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--color-border)' }}>
        <button onClick={() => setActiveTab('sites')} style={tabStyle(activeTab === 'sites')}>
          <span>🏗</span> Sites &amp; Regions
        </button>
        <button onClick={() => setActiveTab('coops')} style={tabStyle(activeTab === 'coops')}>
          <span>🤝</span> Cooperatives
          <span style={{
            background: activeTab === 'coops' ? 'var(--color-w2w)' : 'var(--color-surface3)',
            color: activeTab === 'coops' ? 'white' : 'var(--color-text3)',
            padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
          }}>{cooperatives.length}</span>
        </button>
      </div>

      {/* ══ Stats Row ══ */}
      <div className="g4 mb20">
        <StatCard label="Active Sites" value={String(stats.active)} sub={`of ${stats.total} total`} icon="🏗" rail="sc-blue" />
        <StatCard label="Total Beneficiaries" value={String(stats.totalBens)} sub="across all sites" icon="👷" rail="sc-green" />
        <StatCard label="Monthly Tonnage" value={stats.totalTons + 't'} sub="" icon="⚖" rail="sc-amber" />
        <StatCard label="Avg OHS Rating" value={stats.avgOHS + '%'} sub="" icon="🛡" rail="sc-purple" />
      </div>

      {/* ══ OHS Alert ══ */}
      {ohsAlertSites.length > 0 && (
        <div className="alert alert-red" style={{ marginBottom: 16 }}>
          <b>OHS Alert:</b>{' '}
          {ohsAlertSites.map((s: any) => (
            <span key={s.id}><b>{s.name}</b> ({s.ohsRating}%) </span>
          ))}
          require corrective action.
        </div>
      )}

      {/* ═══════════════════════════════════════════
           Sites & Regions Tab
          ═══════════════════════════════════════════ */}
      {activeTab === 'sites' && (
        <>
          {geoTree.tree.map((provGroup: any) => (
            <div key={provGroup.province.id}>
              {/* Province Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  background: 'var(--color-ink)', color: 'var(--color-accent)',
                  padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>🇿🇦 Province</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{provGroup.province.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text3)' }}>
                  Code: {provGroup.province.code}
                  {provGroup.province.premier ? ` · Premier: ${provGroup.province.premier}` : ''}
                </div>
              </div>

              {/* Municipalities */}
              {provGroup.municipalities.map((muniGroup: any) => (
                <div key={muniGroup.municipality.id} style={{
                  border: '1px solid var(--color-border)', borderRadius: 12,
                  marginBottom: 16, overflow: 'hidden',
                }}>
                  {/* Municipality Header */}
                  <div style={{
                    background: 'var(--color-w2w-light)', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        background: 'var(--color-w2w)', color: 'white',
                        padding: '3px 10px', borderRadius: 6, fontSize: 10,
                        fontWeight: 700, textTransform: 'uppercase',
                      }}>{muniGroup.municipality.type || 'Municipality'}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{muniGroup.municipality.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>
                          Code: {muniGroup.municipality.code} · {muniGroup.siteCount} site{muniGroup.siteCount !== 1 ? 's' : ''} · {muniGroup.subRegions.length} sub-region{muniGroup.subRegions.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <span className="badge bg">Active</span>
                  </div>

                  {/* Sub-Regions with Sites */}
                  <div style={{ padding: 14 }}>
                    {muniGroup.subRegions.map((srGroup: any) => {
                      const srSites = srGroup.sites;
                      const srCoops = cooperatives.filter((co: any) =>
                        srSites.some((s: any) => s.id === co.siteId),
                      );
                      const srBens = srSites.reduce((sum: number, s: any) => sum + (s.beneficiaries || 0), 0);
                      const srTons = srSites.reduce((sum: number, s: any) => sum + (s.monthlyTonnage || 0), 0);

                      return (
                        <div key={srGroup.subRegion.id} style={{ marginBottom: 18 }}>
                          {/* Sub-Region Header */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            marginBottom: 10, padding: '8px 12px',
                            background: 'var(--color-surface3)', borderRadius: 8,
                            borderLeft: '3px solid var(--color-accent)',
                          }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)' }}>
                                📍 {srGroup.subRegion.name}
                              </div>
                              {srGroup.subRegion.description && (
                                <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>
                                  {srGroup.subRegion.description}
                                </div>
                              )}
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                              <span className="badge bb" style={{ fontSize: 9 }}>{srSites.length} site{srSites.length !== 1 ? 's' : ''}</span>
                              <span className="badge bk" style={{ fontSize: 9 }}>{srCoops.length} coop{srCoops.length !== 1 ? 's' : ''}</span>
                              <span className="badge bg" style={{ fontSize: 9 }}>{srBens} beneficiaries</span>
                              <span className="badge ba" style={{ fontSize: 9 }}>{srTons}t/mo</span>
                            </div>
                          </div>

                          {/* Site Cards Grid */}
                          {srSites.length === 0 ? (
                            <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--color-text3)', fontStyle: 'italic' }}>
                              No sites assigned to this region yet.
                            </div>
                          ) : (
                            <div className="g3" style={{ paddingLeft: 12 }}>
                              {srSites.map((s: any) => {
                                const ohs = s.ohsRating || 80;
                                const empCount = staffBySite.get(s.id) || 0;
                                const siteCoops = coopsBySite.get(s.id) || [];
                                return (
                                  <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    {/* Card top rail */}
                                    <div style={{
                                      height: 3,
                                      background: s.status === 'ACTIVE' ? 'var(--color-green)' : s.status === 'PLANNED' ? 'var(--color-amber)' : 'var(--color-text3)',
                                    }} />
                                    <div style={{ padding: '12px 14px' }}>
                                      {/* Row 1: Name + badges */}
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div>
                                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{s.name}</div>
                                          <div style={{ display: 'flex', gap: 4 }}>
                                            <span className="badge bb" style={{ fontSize: 9 }}>{TYPE_LABELS[s.type] || s.type}</span>
                                            <span className={`badge ${s.status === 'ACTIVE' ? 'bg' : s.status === 'PLANNED' ? 'ba' : 'bk'}`} style={{ fontSize: 9 }}>
                                              {STATUS_REVERSE[s.status] || s.status}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* OHS Rating bar */}
                                      <div style={{ marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                          <span style={{ fontSize: 10, color: 'var(--color-text3)' }}>OHS Rating</span>
                                          <span style={{ fontSize: 11, fontWeight: 700, color: ohsColor(ohs) }}>{ohs}%</span>
                                        </div>
                                        <div style={{ background: 'var(--color-surface3)', borderRadius: 3, height: 4 }}>
                                          <div style={{ width: ohs + '%', background: ohsColor(ohs), borderRadius: 3, height: 4, transition: 'width 0.3s' }} />
                                        </div>
                                      </div>

                                      {/* Key metrics */}
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11, marginBottom: 10 }}>
                                        <div style={{ color: 'var(--color-text3)' }}>👷 Beneficiaries</div>
                                        <div style={{ fontWeight: 600, textAlign: 'right' }}>{s.beneficiaries || 0}</div>
                                        <div style={{ color: 'var(--color-text3)' }}>⚖ Monthly Tonnage</div>
                                        <div style={{ fontWeight: 600, textAlign: 'right' }}>{s.monthlyTonnage || 0}t</div>
                                        <div style={{ color: 'var(--color-text3)' }}>👥 Staff Assigned</div>
                                        <div style={{ fontWeight: 600, textAlign: 'right' }}>{empCount}</div>
                                        <div style={{ color: 'var(--color-text3)' }}>🤝 Cooperatives</div>
                                        <div style={{ fontWeight: 600, textAlign: 'right' }}>{siteCoops.length}</div>
                                      </div>

                                      {/* Actions */}
                                      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => openViewSite(s)}>
                                          <Eye size={12} /> View
                                        </button>
                                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => openEditSite(s)}>
                                          <Edit2 size={12} /> Edit
                                        </button>
                                        <button
                                          className="btn btn-ghost"
                                          style={{ fontSize: 11, padding: '4px 10px', marginLeft: 'auto', color: 'var(--color-red)' }}
                                          onClick={() => removeSite(s)}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {muniGroup.subRegions.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text3)', fontSize: 12 }}>
                        No planning regions configured. Add sub-regions in Settings → Geography.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {geoTree.tree.length === 0 && geoTree.unassigned.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
              No geography data configured. Set up provinces, municipalities and sub-regions in Settings.
            </div>
          )}

          {/* Unassigned sites (no sub-region) */}
          {geoTree.unassigned.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 10, padding: '8px 12px',
                background: 'var(--color-surface3)', borderRadius: 8,
                borderLeft: '3px solid var(--color-warning, #f59e0b)',
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-warning, #f59e0b)' }}>
                    📍 Unassigned Region
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>
                    Sites not assigned to any sub-region
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span className="badge ba" style={{ fontSize: 9 }}>{geoTree.unassigned.length} site{geoTree.unassigned.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="g3" style={{ paddingLeft: 12 }}>
                {geoTree.unassigned.map((s: any) => {
                  const ohs = s.ohsRating || 80;
                  const empCount = staffBySite.get(s.id) || 0;
                  const siteCoops = coopsBySite.get(s.id) || [];
                  return (
                    <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{
                        height: 5,
                        background: ohs >= 90 ? 'var(--color-success)' : ohs >= 70 ? 'var(--color-warning, #f59e0b)' : 'var(--color-danger)',
                      }} />
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text3)', marginTop: 2 }}>
                          {s.type || 'IWMC'} · {s.region || '—'}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <span className="badge bg" style={{ fontSize: 9 }}>OHS {ohs}%</span>
                          <span className="badge bb" style={{ fontSize: 9 }}>{empCount} staff</span>
                          <span className="badge bk" style={{ fontSize: 9 }}>{siteCoops.length} coop{siteCoops.length !== 1 ? 's' : ''}</span>
                          <span className="badge ba" style={{ fontSize: 9 }}>{s.monthlyTonnage || 0}t/mo</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════
           Cooperatives Tab
          ═══════════════════════════════════════════ */}
      {activeTab === 'coops' && (
        <>
          {(() => {
            // Group coops by site
            const grouped = new Map<string, { site: any; coops: any[] }>();
            const unlinked: any[] = [];

            cooperatives.forEach((c: any) => {
              if (c.siteId) {
                if (!grouped.has(c.siteId)) {
                  const site = sites.find((s: any) => s.id === c.siteId);
                  grouped.set(c.siteId, { site: site || { name: 'Unknown Site' }, coops: [] });
                }
                grouped.get(c.siteId)!.coops.push(c);
              } else {
                unlinked.push(c);
              }
            });

            const groups = Array.from(grouped.values());

            return (
              <>
                {groups.map((group) => (
                  <div key={group.site?.id || 'unknown'} style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--color-w2w)',
                      marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <MapPin size={12} /> {group.site?.name || 'Unknown Site'}
                      <span className="badge bb" style={{ fontSize: 9 }}>{group.coops.length} cooperative{group.coops.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="g3">
                      {group.coops.map((c: any) => (
                        <CoopCard
                          key={c.id}
                          coop={c}
                          siteName={group.site?.name}
                          employees={employees}
                          onEdit={() => openEditCoop(c)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {unlinked.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--color-text3)',
                      marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      Unlinked Cooperatives
                      <span className="badge bk" style={{ fontSize: 9 }}>{unlinked.length}</span>
                    </div>
                    <div className="g3">
                      {unlinked.map((c: any) => (
                        <CoopCard
                          key={c.id}
                          coop={c}
                          siteName="—"
                          employees={employees}
                          onEdit={() => openEditCoop(c)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {cooperatives.length === 0 && (
                  <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                    No cooperatives yet. Click "Add Cooperative" to create your first.
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* ═══════════════════════════════════════════
           Site Detail Modal
          ═══════════════════════════════════════════ */}
      {modal === 'site-view' && activeSite && (
        <div className="modal-ov open" onClick={closeModal}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{activeSite.name}</span>
              <button onClick={closeModal} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {/* Site Details */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6 }}>
                Site Details
              </div>
              {([
                ['ID', activeSite.id?.slice(0, 12)],
                ['Name', activeSite.name],
                ['Region', (() => {
                  const sr = (geo.subRegions || []).find((s: any) => s.id === activeSite.subRegionId);
                  return sr?.name || activeSite.region || '—';
                })()],
                ['Type', TYPE_LABELS[activeSite.type] || activeSite.type],
                ['Ward', activeSite.ward],
                ['GPS', activeSite.gps],
                ['Status', STATUS_REVERSE[activeSite.status] || activeSite.status],
                ['Phase', activeSite.phase],
                ['Launch Date', activeSite.launched],
              ] as [string, any][]).map(([k, v]) => (
                <div key={k} className="drow">
                  <div className="dlb">{k}</div>
                  <div className="dvl">{v || '—'}</div>
                </div>
              ))}

              {/* Operations */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 10, borderBottom: '2px solid var(--color-amber-light, #fef3c7)', paddingBottom: 6 }}>
                Operations
              </div>
              {([
                ['Supervisor', activeSite.supervisor],
                ['Beneficiaries', activeSite.beneficiaries],
                ['Monthly Tonnage', activeSite.monthlyTonnage ? activeSite.monthlyTonnage + ' t' : '—'],
                ['OHS Rating', activeSite.ohsRating != null ? activeSite.ohsRating + '%' : '—'],
                ['Cleanliness', activeSite.cleanliness],
              ] as [string, any][]).map(([k, v]) => (
                <div key={k} className="drow">
                  <div className="dlb">{k}</div>
                  <div className="dvl">{v || '—'}</div>
                </div>
              ))}

              {/* Cooperatives linked */}
              {(() => {
                const siteCoops = cooperatives.filter((c: any) => c.siteId === activeSite.id);
                return (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 10, borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6 }}>
                      Cooperatives ({siteCoops.length}/3)
                    </div>
                    {siteCoops.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--color-text3)', padding: '8px 0' }}>No cooperatives linked to this site.</div>
                    ) : (
                      siteCoops.map((c: any) => (
                        <div key={c.id} className="drow" style={{ alignItems: 'center' }}>
                          <div className="dlb">🤝 {c.name}</div>
                          <div className="dvl">
                            <span className={`badge ${STAGE_BADGE[c.stage] || 'bk'}`} style={{ fontSize: 9 }}>{c.stage || 'Unknown'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                );
              })()}

              {/* Focus / Notes */}
              {(activeSite.focus || activeSite.notes) && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 10, borderBottom: '2px solid var(--color-border)', paddingBottom: 6 }}>
                    Additional
                  </div>
                  {activeSite.focus && <div className="drow"><div className="dlb">Focus</div><div className="dvl">{activeSite.focus}</div></div>}
                  {activeSite.notes && <div className="drow"><div className="dlb">Notes</div><div className="dvl">{activeSite.notes}</div></div>}
                </>
              )}
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={closeModal}>Close</button>
              <button className="btn btn-primary" onClick={() => { closeModal(); openEditSite(activeSite); }}>
                <Edit2 size={13} /> Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           Add / Edit Site Modal
          ═══════════════════════════════════════════ */}
      {modal === 'site-form' && (
        <div className="modal-ov open" onClick={closeModal}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{editingId ? 'Edit Site' : 'Add Site'}</span>
              <button onClick={closeModal} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                {/* Site Name - full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Site Name <span className="req">*</span></label>
                    <input className="fc" value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="e.g. Diepsloot Recovery Site" />
                  </div>
                </div>

                {/* Province */}
                <div className="fg">
                  <label className="fl">Province <span className="req">*</span></label>
                  <select className="fc" value={siteForm.provinceId || ''} onChange={(e) => setSiteForm({ ...siteForm, provinceId: e.target.value, municipalityId: '', subRegionId: '' })}>
                    <option value="">Select province</option>
                    {(geo.provinces || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                {/* Municipality */}
                <div className="fg">
                  <label className="fl">Municipality <span className="req">*</span></label>
                  <select className="fc" value={siteForm.municipalityId || ''} onChange={(e) => setSiteForm({ ...siteForm, municipalityId: e.target.value, subRegionId: '' })}>
                    <option value="">Select municipality</option>
                    {filteredMunicipalities.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                {/* Sub-Region */}
                <div className="fg">
                  <label className="fl">Sub-Region / Planning Region</label>
                  <select className="fc" value={siteForm.subRegionId || ''} onChange={(e) => setSiteForm({ ...siteForm, subRegionId: e.target.value })}>
                    <option value="">Select sub-region</option>
                    {filteredSubRegions.map((sr: any) => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                  </select>
                </div>

                {/* Type */}
                <div className="fg">
                  <label className="fl">Type</label>
                  <select className="fc" value={siteForm.type} onChange={(e) => setSiteForm({ ...siteForm, type: e.target.value })}>
                    <option value="IWMC">IWMC</option>
                    <option value="MRC">MRC</option>
                    <option value="BBC">BBC</option>
                  </select>
                </div>

                {/* Ward */}
                <div className="fg">
                  <label className="fl">Ward</label>
                  <input className="fc" value={siteForm.ward || ''} onChange={(e) => setSiteForm({ ...siteForm, ward: e.target.value })} placeholder="Ward number" />
                </div>

                {/* GPS */}
                <div className="fg">
                  <label className="fl">GPS Coordinates</label>
                  <input className="fc" value={siteForm.gps || ''} onChange={(e) => setSiteForm({ ...siteForm, gps: e.target.value })} placeholder="-26.1234,28.0456" />
                  <button type="button" className="btn btn-ghost" style={{ marginTop: 4, fontSize: 11, padding: '2px 8px' }} onClick={() => {
                    navigator.geolocation?.getCurrentPosition((p) => {
                      setSiteForm((prev) => ({ ...prev, gps: p.coords.latitude.toFixed(6) + ',' + p.coords.longitude.toFixed(6) }));
                    });
                  }}>📍 Get GPS</button>
                </div>

                {/* Supervisor */}
                <div className="fg">
                  <label className="fl">Supervisor</label>
                  <select className="fc" value={siteForm.supervisor || ''} onChange={(e) => setSiteForm({ ...siteForm, supervisor: e.target.value })}>
                    <option value="">Select supervisor</option>
                    {employees.filter((e: any) => (e.status || '').toUpperCase() === 'ACTIVE').map((e: any) => (
                      <option key={e.id} value={`${e.firstName} ${e.lastName}`}>{e.firstName} {e.lastName} ({e.empNo})</option>
                    ))}
                  </select>
                </div>

                {/* Beneficiaries */}
                <div className="fg">
                  <label className="fl">Target Beneficiaries</label>
                  <input className="fc" type="number" min={0} value={siteForm.beneficiaries ?? 30} onChange={(e) => setSiteForm({ ...siteForm, beneficiaries: parseInt(e.target.value) || 0 })} />
                </div>

                {/* OHS Rating */}
                <div className="fg">
                  <label className="fl">OHS Rating %</label>
                  <input className="fc" type="number" min={0} max={100} value={siteForm.ohsRating ?? 80} onChange={(e) => setSiteForm({ ...siteForm, ohsRating: parseInt(e.target.value) || 0 })} />
                </div>

                {/* Monthly Tonnage */}
                <div className="fg">
                  <label className="fl">Monthly Tonnage (t)</label>
                  <input className="fc" type="number" step="0.1" min={0} value={siteForm.monthlyTonnage ?? 0} onChange={(e) => setSiteForm({ ...siteForm, monthlyTonnage: parseFloat(e.target.value) || 0 })} />
                </div>

                {/* Launch Date */}
                <div className="fg">
                  <label className="fl">Launch Date</label>
                  <input className="fc" type="date" value={siteForm.launched || ''} onChange={(e) => setSiteForm({ ...siteForm, launched: e.target.value })} />
                </div>

                {/* Status */}
                <div className="fg">
                  <label className="fl">Status</label>
                  <select className="fc" value={siteForm.status} onChange={(e) => setSiteForm({ ...siteForm, status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="PLANNED">Planned</option>
                  </select>
                </div>

                {/* Focus - full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Focus / Description</label>
                    <input className="fc" value={siteForm.focus || ''} onChange={(e) => setSiteForm({ ...siteForm, focus: e.target.value })} placeholder="e.g. High-volume plastics recovery" />
                  </div>
                </div>

                {/* Notes - full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Notes</label>
                    <textarea className="fc" rows={3} value={siteForm.notes || ''} onChange={(e) => setSiteForm({ ...siteForm, notes: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitSite}
                disabled={createSite.isPending || updateSite.isPending}
              >
                {(createSite.isPending || updateSite.isPending) ? 'Saving…' : editingId ? 'Update Site' : 'Add Site'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
           Add / Edit Cooperative Modal
          ═══════════════════════════════════════════ */}
      {modal === 'coop-form' && (
        <div className="modal-ov open" onClick={closeModal}>
          <div className="modal" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{editingId ? 'Edit Cooperative' : 'Add Cooperative'}</span>
              <button onClick={closeModal} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                {/* Name */}
                <div className="fg">
                  <label className="fl">Cooperative Name <span className="req">*</span></label>
                  <input className="fc" value={coopForm.name} onChange={(e) => setCoopForm({ ...coopForm, name: e.target.value })} placeholder="e.g. Diepsloot Greens Cooperative" />
                </div>

                {/* Site */}
                <div className="fg">
                  <label className="fl">Site <span className="req">*</span></label>
                  <select className="fc" value={coopForm.siteId} onChange={(e) => setCoopForm({ ...coopForm, siteId: e.target.value })}>
                    <option value="">Select site</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Stage */}
                <div className="fg">
                  <label className="fl">Stage</label>
                  <select className="fc" value={coopForm.stage} onChange={(e) => setCoopForm({ ...coopForm, stage: e.target.value })}>
                    <option>Identified</option>
                    <option>Formation</option>
                    <option>Registered</option>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>

                {/* Registration */}
                <div className="fg">
                  <label className="fl">Registration Number</label>
                  <input className="fc" value={coopForm.registration} onChange={(e) => setCoopForm({ ...coopForm, registration: e.target.value })} placeholder="e.g. CK2023/001234" />
                </div>

                {/* Contact Person */}
                <div className="fg">
                  <label className="fl">Contact Person</label>
                  <input className="fc" value={coopForm.contactPerson} onChange={(e) => setCoopForm({ ...coopForm, contactPerson: e.target.value })} placeholder="Primary contact name" />
                </div>

                {/* Contact Number */}
                <div className="fg">
                  <label className="fl">Contact Number</label>
                  <input className="fc" value={coopForm.contactNumber} onChange={(e) => setCoopForm({ ...coopForm, contactNumber: e.target.value })} placeholder="e.g. 0821234567" />
                </div>

                {/* Total Members */}
                <div className="fg">
                  <label className="fl">Total Members</label>
                  <input className="fc" type="number" min={0} value={coopForm.totalMembers} onChange={(e) => setCoopForm({ ...coopForm, totalMembers: parseInt(e.target.value) || 0 })} />
                </div>

                {/* Has Baling Machine */}
                <div className="fg">
                  <label className="fl">Baling Machine</label>
                  <select className="fc" value={coopForm.hasBalingMachine ? 'Yes' : 'No'} onChange={(e) => setCoopForm({ ...coopForm, hasBalingMachine: e.target.value === 'Yes' })}>
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>

                {/* Daily Tons Recovered */}
                <div className="fg">
                  <label className="fl">Daily Tons Recovered</label>
                  <input className="fc" type="number" min={0} step={0.1} value={coopForm.dailyTonsRecovered} onChange={(e) => setCoopForm({ ...coopForm, dailyTonsRecovered: parseFloat(e.target.value) || 0 })} />
                </div>

                {/* Focus - full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Focus / Activities</label>
                    <input className="fc" value={coopForm.focus} onChange={(e) => setCoopForm({ ...coopForm, focus: e.target.value })} placeholder="e.g. Plastics, Paper, Mixed recycling" />
                  </div>
                </div>

                {/* Mentor */}
                <div className="fg">
                  <label className="fl">Mentor Name</label>
                  <input className="fc" value={coopForm.mentor} onChange={(e) => setCoopForm({ ...coopForm, mentor: e.target.value })} placeholder="Mentor or facilitator" />
                </div>

                {/* PRO Partner */}
                <div className="fg">
                  <label className="fl">PRO Partner</label>
                  <select className="fc" value={coopForm.proPartner} onChange={(e) => setCoopForm({ ...coopForm, proPartner: e.target.value })}>
                    {<option value="">None</option>}
                    {(settings.proPartners || []).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Revenue */}
                <div className="fg">
                  <label className="fl">Revenue (R)</label>
                  <input className="fc" type="number" min={0} value={coopForm.revenue} onChange={(e) => setCoopForm({ ...coopForm, revenue: parseFloat(e.target.value) || 0 })} />
                </div>

                {/* ── Material Payout Rates (from Settings → Waste Categories) ── */}
                <div className="full" style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingBottom: 4, borderBottom: '2px solid var(--color-w2w-light)' }}>Material Payout Rates (ZAR/kg)</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)', marginBottom: 8 }}>Rates sourced from Settings → Waste Categories. Set each cooperative's buy price per kg.</div>
                </div>
                {(settings.wasteCategories || []).map((wc: any) => (
                  <div className="fg" key={wc.code}>
                    <label className="fl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {wc.color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: wc.color, display: 'inline-block' }} />}
                      {wc.name} (R/kg)
                    </label>
                    <input className="fc" type="number" min={0} step={0.5}
                      value={coopForm.materialRates[wc.code] ?? wc.pricePerKg ?? 0}
                      onChange={(e) => setCoopForm({
                        ...coopForm,
                        materialRates: { ...coopForm.materialRates, [wc.code]: parseFloat(e.target.value) || 0 },
                      })}
                    />
                  </div>
                ))}

                {/* Notes - full width */}
                <div className="full">
                  <div className="fg">
                    <label className="fl">Notes</label>
                    <textarea className="fc" rows={3} value={coopForm.notes} onChange={(e) => setCoopForm({ ...coopForm, notes: e.target.value })} placeholder="Optional notes" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitCoop}
                disabled={createCoop.isPending || updateCoop.isPending}
              >
                {(createCoop.isPending || updateCoop.isPending) ? 'Saving…' : editingId ? 'Update Cooperative' : 'Add Cooperative'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  Cooperative Card (used in Cooperatives tab)
// ═══════════════════════════════════════════════════

function CoopCard({
  coop,
  siteName,
  employees,
  onEdit,
}: {
  coop: any;
  siteName: string;
  employees: any[];
  onEdit: () => void;
}) {
  const members = coop.siteId
    ? employees.filter((e: any) => e.siteId === coop.siteId && (e.status || '').toUpperCase() === 'ACTIVE').length
    : 0;

  const stageBadge = STAGE_BADGE[coop.stage] || 'bk';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        height: 3,
        background: coop.stage === 'Active' || coop.stage === 'Registered'
          ? 'var(--color-green)'
          : coop.stage === 'Inactive' || coop.stage === 'Identified'
            ? 'var(--color-amber)'
            : 'var(--color-w2w)',
      }} />
      <div style={{ padding: '12px 14px' }}>
        {/* Name + Stage badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>🤝 {coop.name}</div>
          <span className={`badge ${stageBadge}`} style={{ fontSize: 9 }}>{coop.stage || 'Unknown'}</span>
        </div>

        {/* Site name */}
        <div style={{ fontSize: 11, color: 'var(--color-text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={10} /> {siteName}
        </div>

        {/* Metrics grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11, marginBottom: 10 }}>
          <div style={{ color: 'var(--color-text3)' }}>Members</div>
          <div style={{ fontWeight: 600, textAlign: 'right' }}>{members}</div>
          <div style={{ color: 'var(--color-text3)' }}>Beneficiaries</div>
          <div style={{ fontWeight: 600, textAlign: 'right' }}>{coop.beneficiaries || members || 0}</div>
          {coop.mentor && <>
            <div style={{ color: 'var(--color-text3)' }}>Mentor</div>
            <div style={{ fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coop.mentor}</div>
          </>}
          {coop.proPartner && <>
            <div style={{ color: 'var(--color-text3)' }}>PRO Partner</div>
            <div style={{ fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coop.proPartner}</div>
          </>}
        </div>

        {/* Edit button */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={onEdit}>
            <Edit2 size={12} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}
