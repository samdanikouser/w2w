import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import {
  Recycle, BookOpen, DollarSign, Landmark, Settings, Plus, Trash2, Edit3, Save, X, CheckCircle2,
  Building, Users as UsersIcon, KeyRound, Database, Search, Shield, Layers, AlertTriangle, Clock, FileText, Download, MapPin, Truck, Warehouse,
} from 'lucide-react';
import { UsersTab, RolesTab } from './SettingsPage';
import { auditLogsApi, rolesApi, deletionRequestsApi, wasteTypesApi, trainingApi } from '../api/endpoints';
import { exportCsv } from '../utils/csv';
import { loadGeography, saveGeography } from '../utils/geography';
import {
  loadPLTypes, savePLTypes, loadPLCategories, savePLCategories,
  loadPLCostCentres, savePLCostCentres, getDefaultPLTypes, getDefaultPLCategories,
  loadPLGroups, savePLGroups, getDefaultPLGroups,
  type PLType,
} from '../utils/plSettings';
import {
  type ProgrammeSettings,
  type WasteCategory,
  type TrainingModule,
  type PaymentScale,
  type CostCenter,
  type CostCenter,
} from '../utils/programmeSettings';
import { useSettingsStore } from '../stores/settingsStore';

// ── Grouped navigation ──
interface NavItem { id: string; label: string; icon: React.ReactNode; keywords: string; description: string }
interface NavGroup { title: string; icon: React.ReactNode; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Access Control',
    icon: <Shield size={12} />,
    items: [
      { id: 'users', label: 'Users', icon: <UsersIcon size={14} />, keywords: 'user account login employee password', description: 'Manage user accounts, reset passwords, and assign roles' },
      { id: 'roles', label: 'Roles & Permissions', icon: <KeyRound size={14} />, keywords: 'role permission module access tier', description: 'Create roles and control which modules each role can access' },
      { id: 'geography', label: 'Geography', icon: <MapPin size={14} />, keywords: 'province municipality sub-region planning region geographic location', description: 'Set up provinces, municipalities, and sub-regions' },
    ],
  },
  {
    title: 'Programme',
    icon: <Layers size={12} />,
    items: [
      { id: 'waste-cats', label: 'Waste Categories', icon: <Recycle size={14} />, keywords: 'waste category epr plastic glass metal price', description: 'Define waste types, EPR groups, PRO buyers, and per-kg pricing' },
      { id: 'training-modules', label: 'Training Modules', icon: <BookOpen size={14} />, keywords: 'training module mandatory optional safety', description: 'Manage mandatory & optional training modules for employees' },
      { id: 'payment-scale', label: 'Payment Scale', icon: <DollarSign size={14} />, keywords: 'payment salary scale basic allowance ctc', description: 'Set basic pay and allowances for each worker role' },
      { id: 'cost-centers', label: 'Cost Centers', icon: <Landmark size={14} />, keywords: 'cost center budget operational administrative', description: 'Define budget cost centres for P&L and expense tracking' },
      { id: 'pro-partners', label: 'PRO Partners', icon: <Building size={14} />, keywords: 'pro partner petco polyco fibre cycle cooperative', description: 'Manage Producer Responsibility Organisation partners for cooperatives' },
      { id: 'pl-config', label: 'P&L Configuration', icon: <DollarSign size={14} />, keywords: 'pl profit loss type category cost centre', description: 'Configure P&L entry types, categories, and cost centres' },
      { id: 'vehicle-types', label: 'Vehicle Types', icon: <Truck size={14} />, keywords: 'vehicle type fleet bakkie truck trolley', description: 'Manage vehicle type options for the fleet register' },
      { id: 'employee-fields', label: 'Employee Fields', icon: <UsersIcon size={14} />, keywords: 'employee department designation role bank', description: 'Manage dynamic dropdown lists for employee creation' },
    ],
  },
  {
    title: 'System & Compliance',
    icon: <Settings size={12} />,
    items: [
      { id: 'organisation', label: 'Organisation', icon: <Building size={14} />, keywords: 'org company name admin email partner vat', description: 'Company details, programme info, VAT, and contact settings' },
      { id: 'system', label: 'System Info', icon: <Settings size={14} />, keywords: 'system programme client metro version reference', description: 'View platform version, client info, and system identifiers' },
      { id: 'data', label: 'Data & POPIA', icon: <Database size={14} />, keywords: 'popia data retention audit export deletion privacy', description: 'Data retention, POPIA deletion requests, and audit trail export' },
    ],
  },
];

// Using utils/programmeSettings.ts for settings data

export default function W2WSettingsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('organisation');
  const [toast, setToast] = useState<{ message: string; tone: 'green' | 'amber' | 'red' } | null>(null);

  const settings = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const org = useSettingsStore(s => s.org);
  const updateOrg = useSettingsStore(s => s.updateOrg);

  const update = (partial: Partial<ProgrammeSettings>) => {
    updateSettings(partial);
  };

  // Sync training modules from settings → backend DB
  const syncTrainingModules = (modules: TrainingModule[]) => {
    const payload = modules.map(m => ({
      settingsId: m.id,
      name: m.name,
      type: m.type.toUpperCase(),
    }));
    trainingApi.syncModules(payload).catch(() => {/* silent — best effort */});
  };

  // Sync on mount so the DB is always seeded from settings
  useEffect(() => {
    syncTrainingModules(settings.trainingModules);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (message: string, tone: 'green' | 'amber' | 'red' = 'green') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  };

  const setOrgField = (k: string, v: string) => updateOrg({ [k]: v });
  
  const saveOrg = async () => {
    try {
      await updateOrg(org);
      setToast({ message: 'Organisation settings saved.', tone: 'green' });
    } catch {
      setToast({ message: 'Could not save organisation settings to server.', tone: 'amber' });
    }
  };

  // Audit data for POPIA tab
  const { data: auditEvents = [] } = useQuery({
    queryKey: ['audit-logs', 'export'],
    queryFn: () => auditLogsApi.list({ limit: '1000' }),
  });

  const exportAudit = () => {
    exportCsv('audit-trail', auditEvents as any[], [
      { key: 'createdAt', label: 'Timestamp', map: (r: any) => new Date(r.createdAt).toISOString() },
      { key: 'user', label: 'User', map: (r: any) => r.user?.name || '' },
      { key: 'action', label: 'Action' },
      { key: 'entity', label: 'Entity' },
      { key: 'entityId', label: 'Reference' },
      { key: 'detail', label: 'Detail' },
      { key: 'ipAddress', label: 'IP' },
    ]);
    setToast({ message: 'Audit trail exported.', tone: 'green' });
  };



  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Search filtering
  const [search, setSearch] = useState('');
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return NAV_GROUPS;
    const q = search.toLowerCase();
    return NAV_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  // Find current tab label
  const currentItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === tab);

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">⚙️ Platform Settings</div>
          <div className="ps">Configure your W2W platform — access control, programme data, and system compliance</div>
        </div>
        {tab === 'organisation' && (
          <button className="btn btn-primary" onClick={saveOrg}><Save size={13} /> Save Changes</button>
        )}
      </div>

      {toast && (
        <div className={`alert alert-${toast.tone === 'red' ? 'red' : toast.tone === 'amber' ? 'amber' : 'green'}`} style={{ marginBottom: 12 }}>
          <CheckCircle2 size={14} />
          <span>{toast.message}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, alignItems: 'start' }}>
        {/* ── Sidebar ── */}
        <div className="card" style={{ position: 'sticky', top: 16, padding: 0, overflow: 'hidden' }}>
          {/* Sidebar header */}
          <div style={{ padding: '14px 16px 10px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>📚 Settings Menu</div>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text3)' }} />
              <input
                className="fc"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search settings…"
                style={{ paddingLeft: 30, fontSize: 12 }}
              />
            </div>
          </div>

          {/* Groups */}
          <div style={{ padding: '8px 10px 14px' }}>
            {filteredGroups.map((group) => (
              <div key={group.title} style={{ marginBottom: 14 }}>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 8px 5px',
                  fontSize: 10, fontWeight: 800,
                  color: 'var(--color-w2w)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderBottom: '1px solid var(--color-border)',
                  marginBottom: 4,
                }}>
                  {group.icon}
                  {group.title}
                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, background: 'var(--color-surface3)', color: 'var(--color-text3)', borderRadius: 8, padding: '1px 6px' }}>{group.items.length}</span>
                </div>

                {/* Items */}
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setTab(item.id); setSearch(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '8px 10px',
                      background: tab === item.id ? 'var(--color-w2w-pale, rgba(20,100,132,0.08))' : 'transparent',
                      color: tab === item.id ? 'var(--color-w2w)' : 'var(--color-text)',
                      border: tab === item.id ? '1px solid var(--color-w2w-light, rgba(20,100,132,0.18))' : '1px solid transparent',
                      cursor: 'pointer', borderRadius: 7,
                      fontWeight: tab === item.id ? 700 : 500, fontSize: 12,
                      textAlign: 'left', fontFamily: 'var(--font-sans)',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (tab !== item.id) {
                        e.currentTarget.style.background = 'var(--color-surface2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (tab !== item.id) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                    title={item.description}
                  >
                    <span style={{ color: tab === item.id ? 'var(--color-w2w)' : 'var(--color-text3)', flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}

            {filteredGroups.length === 0 && (
              <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 11, color: 'var(--color-text3)' }}>
                No settings match "{search}"
              </div>
            )}
          </div>
        </div>

        {/* ── Content Panel ── */}
        <div>
          {/* Content header with breadcrumb + description */}
          <div style={{
            marginBottom: 18, paddingBottom: 14,
            borderBottom: '2px solid var(--color-border)',
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Settings › {NAV_GROUPS.find(g => g.items.some(i => i.id === tab))?.title || ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
              {currentItem?.icon}
              {currentItem?.label}
            </div>
            {currentItem?.description && (
              <div style={{ fontSize: 12, color: 'var(--color-text2)', marginTop: 4, lineHeight: 1.4 }}>
                {currentItem.description}
              </div>
            )}
          </div>

          {tab === 'organisation' && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6, marginBottom: 14 }}>
                Organisation Details
              </div>
              <div className="fgrid">
                <div className="fg"><label className="fl">Organisation Name</label>
                  <input className="fc" value={org.orgName || user?.siteName || ''} onChange={(e) => setOrgField('orgName', e.target.value)} placeholder="As registered" />
                </div>
                <div className="fg"><label className="fl">Admin Name</label>
                  <input className="fc" value={user?.name || ''} disabled style={{ opacity: 0.6 }} />
                </div>
                <div className="fg"><label className="fl">Admin Email</label>
                  <input className="fc" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                </div>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6, margin: '20px 0 14px' }}>
                Programme Information
              </div>
              <div className="fgrid">
                <div className="fg"><label className="fl">Programme Name</label>
                  <input className="fc" value={org.programmeName || 'Waste To Work'} disabled style={{ opacity: 0.6 }} />
                </div>
                <div className="fg"><label className="fl">Implementing Partner</label>
                  <input className="fc" value={org.partner || 'SCM'} disabled style={{ opacity: 0.6 }} />
                </div>
                <div className="fg"><label className="fl">Reporting Currency</label>
                  <select className="fc" value={org.currency || 'ZAR'} onChange={(e) => setOrgField('currency', e.target.value)}>
                    <option value="ZAR">ZAR — South African Rand</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">VAT Number</label>
                  <input className="fc" value={org.vat || ''} onChange={(e) => setOrgField('vat', e.target.value)} placeholder="4XXXXXXXXX" />
                </div>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6, margin: '20px 0 14px' }}>
                Contact
              </div>
              <div className="fgrid">
                <div className="fg"><label className="fl">Support Email</label>
                  <input className="fc" type="email" value={org.supportEmail || ''} onChange={(e) => setOrgField('supportEmail', e.target.value)} placeholder="support@yourorg.com" />
                </div>
                <div className="fg"><label className="fl">Support Phone</label>
                  <input className="fc" value={org.supportPhone || ''} onChange={(e) => setOrgField('supportPhone', e.target.value)} placeholder="+27 …" />
                </div>
                <div className="fg"><label className="fl">Default Region</label>
                  <input className="fc" value={org.region || ''} onChange={(e) => setOrgField('region', e.target.value)} placeholder="e.g. Gauteng" />
                </div>
              </div>
            </>
          )}

          {tab === 'users' && <UsersTab onToast={setToast} />}
          {tab === 'roles' && <RolesTab onToast={setToast} />}
          {tab === 'geography' && <GeographySettingsTab onToast={showToast} />}

          {tab === 'waste-cats' && <WasteCategoriesTab onToast={showToast} />}
          {tab === 'training-modules' && <TrainingModulesTab data={settings.trainingModules} onUpdate={(d) => { update({ trainingModules: d }); syncTrainingModules(d); showToast('Training modules updated & synced.'); }} />}
          {tab === 'payment-scale' && <PaymentScaleTab data={settings.paymentScales} onUpdate={(d) => { update({ paymentScales: d }); showToast('Payment scale updated.'); }} />}
          {tab === 'cost-centers' && <CostCentersTab data={settings.costCenters} onUpdate={(d) => { update({ costCenters: d }); showToast('Cost centers updated.'); }} />}
          {tab === 'pro-partners' && <ProPartnersTab data={settings.proPartners || []} onUpdate={(d) => { update({ proPartners: d }); showToast('PRO Partners updated.'); }} />}
          {tab === 'employee-fields' && <EmployeeFieldsTab settings={settings} onUpdate={update} onToast={showToast} />}
          {tab === 'pl-config' && <PLConfigTab onToast={showToast} />}
          {tab === 'vehicle-types' && <VehicleTypesTab onToast={showToast} />}
          {tab === 'depot-types' && <DepotTypesTab onToast={showToast} />}
          {tab === 'system' && <SystemTab settings={settings} siteName={user?.siteName} org={org} />}

          {tab === 'data' && <DataPopiaTab exportAudit={exportAudit} onToast={showToast} retentionEmployees={org.retentionEmployees || '7'} retentionWaste={org.retentionWaste || '10'} onRetentionChange={(key, val) => { setOrgField(key, val); }} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  ♻ Waste Categories Tab
// ═══════════════════════════════════════════════════
function WasteCategoriesTab({ onToast }: { onToast: (msg: string) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: wasteTypes = [] } = useQuery({
    queryKey: ['waste-types'],
    queryFn: () => wasteTypesApi.list(),
  });

  const createMut = useMutation({
    mutationFn: (payload: any) => wasteTypesApi.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['waste-types'] }); onToast('Waste type added.'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => wasteTypesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['waste-types'] }); onToast('Waste type updated.'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => wasteTypesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['waste-types'] }); onToast('Waste type deactivated.'); },
  });

  const blank = { name: '', category: '', unit: 'kg', pricePerUnit: 0, pricePerKg: 0, buyer: '', colour: '#146484' };

  const save = (item: any) => {
    if (item.id) {
      updateMut.mutate({ id: item.id, data: { ...item, id: undefined, createdAt: undefined, updatedAt: undefined, isActive: undefined } });
    } else {
      createMut.mutate(item);
    }
    setEditing(null);
    setShowAdd(false);
  };

  const remove = (id: string) => {
    if (confirm('Are you sure you want to deactivate this waste type?')) {
      deleteMut.mutate(id);
    }
  };

  return (
    <>
      <div className="alert alert-amber" style={{ marginBottom: 14 }}>
        <span><b>Admin only:</b> Pricing changes apply immediately to all new waste revenue and P&L calculations.</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => { setEditing(blank); setShowAdd(true); }}><Plus size={13} /> Add Waste Stream</button>
      </div>
      <div className="tw">
        <table>
          <thead><tr>
            <th style={{ width: 10 }}></th>
            <th>Name</th><th>Category Group</th><th>Unit</th><th>EPR Price/kg</th><th>Buyer</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {wasteTypes.map((cat: any) => (
              <tr key={cat.id}>
                <td><div style={{ width: 12, height: 12, borderRadius: 3, background: cat.colour }} /></td>
                <td style={{ fontWeight: 600 }}>{cat.name}</td>
                <td>{cat.category || '—'}</td>
                <td>{cat.unit}</td>
                <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>R {cat.pricePerKg?.toFixed(2) || '0.00'}</td>
                <td>{cat.buyer || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(cat)}><Edit3 size={11} /> Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(cat.id)}><Trash2 size={11} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {wasteTypes.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 16 }}>No waste categories defined</td></tr>}
          </tbody>
        </table>
      </div>

      {(editing || showAdd) && (
        <ItemModal
          title={editing?.id ? 'Edit Waste Category' : 'Add Waste Stream'}
          onClose={() => { setEditing(null); setShowAdd(false); }}
          onSave={() => editing && save(editing)}
        >
          <div className="fgrid">
            <div className="fg"><label className="fl">Category Name *</label>
              <input className="fc" value={editing?.name || ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} placeholder="e.g. PET Plastic" />
            </div>
            <div className="fg"><label className="fl">Category Group</label>
              <input className="fc" value={editing?.category || ''} onChange={(e) => setEditing({ ...editing!, category: e.target.value })} placeholder="e.g. Plastics" />
            </div>
            <div className="fg"><label className="fl">Unit</label>
              <input className="fc" value={editing?.unit || ''} onChange={(e) => setEditing({ ...editing!, unit: e.target.value })} placeholder="e.g. kg" />
            </div>
            <div className="fg"><label className="fl">EPR Price per kg (R)</label>
              <input className="fc" type="number" value={editing?.pricePerKg ?? 0} onChange={(e) => setEditing({ ...editing!, pricePerKg: parseFloat(e.target.value) || 0 })} min="0" step="0.10" />
            </div>
            <div className="full"><div className="fg"><label className="fl">EPR Buyer (PRO Partner)</label>
              <input className="fc" value={editing?.buyer || ''} onChange={(e) => setEditing({ ...editing!, buyer: e.target.value })} placeholder="e.g. Petco" />
            </div></div>
            <div className="fg"><label className="fl">Colour</label>
              <input className="fc" type="color" value={editing?.colour || '#146484'} onChange={(e) => setEditing({ ...editing!, colour: e.target.value })} style={{ height: 36, padding: 2 }} />
            </div>
          </div>
        </ItemModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  🎓 Training Modules Tab
// ═══════════════════════════════════════════════════
function TrainingModulesTab({ data, onUpdate }: { data: TrainingModule[]; onUpdate: (d: TrainingModule[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<TrainingModule | null>(null);

  const save = (item: TrainingModule) => {
    if (item.id) {
      onUpdate(data.map((d) => (d.id === item.id ? item : d)));
    } else {
      onUpdate([...data, { ...item, id: `TM-${Date.now().toString(36)}` }]);
    }
    setEditItem(null);
    setShowAdd(false);
  };

  const remove = (id: string) => onUpdate(data.filter((d) => d.id !== id));

  const mandatory = data.filter((m) => m.type === 'mandatory');
  const optional = data.filter((m) => m.type === 'optional');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button type="button" className="btn btn-primary" onClick={() => { setEditItem({ id: '', name: '', type: 'mandatory' }); setShowAdd(true); }}>
          <Plus size={13} /> Add Module
        </button>
      </div>

      {/* Mandatory */}
      <div className="card mb14">
        <div className="ch"><div className="ct">Mandatory Training Modules</div><div className="cs">All active employees must complete these</div></div>
        <div className="cb">
          {mandatory.length === 0 && <div style={{ color: 'var(--color-text3)', fontSize: 12, padding: 10 }}>No mandatory modules defined</div>}
          {mandatory.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, background: 'var(--color-w2w)', color: 'white', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditItem(m); setShowAdd(true); }}><Edit3 size={11} /></button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(m.id)}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional */}
      <div className="card">
        <div className="ch"><div className="ct">Optional Training Modules</div><div className="cs">Supplementary skill development</div></div>
        <div className="cb">
          {optional.length === 0 && <div style={{ color: 'var(--color-text3)', fontSize: 12, padding: 10 }}>No optional modules defined</div>}
          {optional.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, background: 'var(--color-surface3)', border: '1px solid var(--color-border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditItem(m); setShowAdd(true); }}><Edit3 size={11} /></button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(m.id)}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && editItem && (
        <TrainingModuleModal
          item={editItem}
          onSave={save}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
        />
      )}
    </>
  );
}

function TrainingModuleModal({ item, onSave, onClose }: { item: TrainingModule; onSave: (i: TrainingModule) => void; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [type, setType] = useState<'mandatory' | 'optional'>(item.type);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ ...item, name: name.trim(), type });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 520 }}>
        <div className="modal-header">
          <h3>{item.id ? 'Edit Training Module' : 'Add Training Module'}</h3>
          <button type="button" className="mc" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="fg" style={{ marginBottom: 14 }}>
            <label className="fl">Module Name *</label>
            <input className="fc" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chemical Handling Safety" autoFocus />
          </div>
          <div className="fg">
            <label className="fl">Type</label>
            <select className="fc" value={type} onChange={(e) => setType(e.target.value as 'mandatory' | 'optional')}>
              <option value="mandatory">Mandatory</option>
              <option value="optional">Optional</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
            <Save size={13} /> {item.id ? 'Save Changes' : 'Add Module'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  💰 Payment Scale Tab
// ═══════════════════════════════════════════════════
function PaymentScaleTab({ data, onUpdate }: { data: PaymentScale[]; onUpdate: (d: PaymentScale[]) => void }) {
  const [editing, setEditing] = useState<PaymentScale | null>(null);

  // Fetch custom roles from backend
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });

  // Roles that don't have a payment scale yet (for the add dropdown)
  const existingRoleNames = data.map((d) => d.role);
  const availableRoles = roles.filter((r: any) => r.isActive && !existingRoleNames.includes(r.name));

  const save = (item: PaymentScale) => {
    const idx = data.findIndex((d) => d.role === item.role);
    if (idx >= 0) {
      onUpdate(data.map((d, i) => (i === idx ? item : d)));
    } else {
      onUpdate([...data, item]);
    }
    setEditing(null);
  };

  const remove = (role: string) => onUpdate(data.filter((d) => d.role !== role));

  return (
    <>
      <div className="alert alert-blue" style={{ marginBottom: 14 }}>
        <span>Reference salary scales used when loading role defaults in the employee form.</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button type="button" className="btn btn-primary" onClick={() => setEditing({ role: '', basic: 0, allowances: 0 })}><Plus size={13} /> Add Payment Scale</button>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Role</th><th>Basic (pm)</th><th>Allowances (pm)</th><th>Total CTC</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.role}>
                <td style={{ fontWeight: 600, fontSize: 12 }}>{s.role}</td>
                <td>R {s.basic.toLocaleString()}</td>
                <td>R {s.allowances.toLocaleString()}</td>
                <td style={{ fontWeight: 700, color: 'var(--color-green)' }}>R {(s.basic + s.allowances).toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(s)}><Edit3 size={11} /> Edit</button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(s.role)}><Trash2 size={11} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 16 }}>No payment scales defined</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <ItemModal title={editing.role ? 'Edit Payment Scale' : 'Add Payment Scale'} onClose={() => setEditing(null)} onSave={() => save(editing)}>
          <div className="fgrid">
            <div className="fg"><label className="fl">Role *</label>
              {editing.role && data.find((d) => d.role === editing.role) ? (
                /* Editing existing — show as read-only */
                <input className="fc" value={editing.role} disabled style={{ opacity: 0.6 }} />
              ) : (
                /* Adding new — show dropdown of available roles */
                <select className="fc" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                  <option value="">Select a role…</option>
                  {availableRoles.map((r: any) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                  {availableRoles.length === 0 && (
                    <option disabled>No roles available — add roles first</option>
                  )}
                </select>
              )}
            </div>
            <div className="fg"><label className="fl">Basic Salary (pm)</label>
              <input className="fc" type="number" value={editing.basic} onChange={(e) => setEditing({ ...editing, basic: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="fg"><label className="fl">Allowances (pm)</label>
              <input className="fc" type="number" value={editing.allowances} onChange={(e) => setEditing({ ...editing, allowances: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          {/* Dynamic Total CTC */}
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8,
            background: 'var(--color-green-light)', border: '1px solid #bbf7d0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>Total CTC (per month)</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-green)' }}>R {(editing.basic + editing.allowances).toLocaleString()}</span>
          </div>
        </ItemModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  💸 Cost Centers Tab
// ═══════════════════════════════════════════════════
function CostCentersTab({ data, onUpdate }: { data: CostCenter[]; onUpdate: (d: CostCenter[]) => void }) {
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const blank: CostCenter = { id: '', code: '', name: '', type: 'Operational', budget: 0, notes: '' };

  const save = (item: CostCenter) => {
    if (item.id) {
      onUpdate(data.map((d) => (d.id === item.id ? item : d)));
    } else {
      onUpdate([...data, { ...item, id: `CC-${Date.now().toString(36)}` }]);
    }
    setEditing(null);
    setShowAdd(false);
  };

  const remove = (id: string) => onUpdate(data.filter((d) => d.id !== id));
  const totalBudget = data.reduce((s, c) => s + c.budget, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text2)' }}>
          Total Budget: <b style={{ color: 'var(--color-w2w)' }}>R {totalBudget.toLocaleString()}</b> across {data.length} center{data.length !== 1 ? 's' : ''}
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(blank); setShowAdd(true); }}><Plus size={13} /> Add Cost Center</button>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Budget (R)</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((cc) => (
              <tr key={cc.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-w2w)' }}>{cc.code}</td>
                <td style={{ fontWeight: 600, fontSize: 12 }}>{cc.name}</td>
                <td><span className="badge bb" style={{ fontSize: 10 }}>{cc.type}</span></td>
                <td style={{ fontWeight: 600 }}>R {cc.budget.toLocaleString()}</td>
                <td style={{ fontSize: 11, color: 'var(--color-text2)' }}>{cc.notes}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(cc)}><Edit3 size={11} /> Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(cc.id)}><Trash2 size={11} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 16 }}>No cost centers defined</td></tr>}
          </tbody>
        </table>
      </div>

      {(editing || showAdd) && (
        <ItemModal title={editing?.id ? 'Edit Cost Center' : 'Add Cost Center'} onClose={() => { setEditing(null); setShowAdd(false); }} onSave={() => editing && save(editing)}>
          <div className="fgrid">
            <div className="fg"><label className="fl">Code *</label>
              <input className="fc" value={editing?.code || ''} onChange={(e) => setEditing({ ...editing!, code: e.target.value.toUpperCase() })} placeholder="e.g. OPS-002" />
            </div>
            <div className="fg"><label className="fl">Name *</label>
              <input className="fc" value={editing?.name || ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} placeholder="e.g. Site Operations" />
            </div>
            <div className="fg"><label className="fl">Type</label>
              <select className="fc" value={editing?.type || 'Operational'} onChange={(e) => setEditing({ ...editing!, type: e.target.value })}>
                <option>Operational</option>
                <option>Administrative</option>
                <option>Regulatory</option>
                <option>Capital</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Budget (R)</label>
              <input className="fc" type="number" value={editing?.budget ?? 0} onChange={(e) => setEditing({ ...editing!, budget: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="fg full"><label className="fl">Notes</label>
              <input className="fc" value={editing?.notes || ''} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} placeholder="Optional notes" />
            </div>
          </div>
        </ItemModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  🔒 Data & POPIA Tab (Production-Ready)
// ═══════════════════════════════════════════════════
interface DataPopiaProps {
  exportAudit: () => void;
  onToast: (msg: string, tone?: string) => void;
  retentionEmployees: string;
  retentionWaste: string;
  onRetentionChange: (key: string, value: string) => void;
}

function DataPopiaTab({ exportAudit, onToast, retentionEmployees, retentionWaste, onRetentionChange }: DataPopiaProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'SITE_ADMIN';

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState('all');

  // Fetch deletion requests
  const { data: requests = [] } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => deletionRequestsApi.list(),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { reason: string; scope: string }) => deletionRequestsApi.create(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      onToast(`Deletion request submitted. Reference: ${res.reference}`);
      setShowRequestModal(false);
      setReason('');
      setScope('all');
    },
    onError: () => onToast('Failed to submit request.', 'red'),
  });

  // Status update mutation (admin)
  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      deletionRequestsApi.updateStatus(id, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-requests'] });
      onToast('Request status updated.');
    },
  });

  const submitRequest = () => {
    if (!reason.trim()) return;
    createMutation.mutate({ reason: reason.trim(), scope });
  };

  const statusColor: Record<string, string> = {
    PENDING: 'var(--color-amber)',
    PROCESSING: 'var(--color-blue)',
    COMPLETED: 'var(--color-green)',
    REJECTED: 'var(--color-red)',
  };

  return (
    <>
      {/* POPIA Notice */}
      <div className="alert alert-blue">
        <Shield size={14} />
        <span>
          This system processes personal information under <b>POPIA (Protection of Personal Information Act)</b>.
          SA ID, banking, and contact fields are encrypted at the application layer. All access is logged to the Audit Log.
        </span>
      </div>

      {/* Retention Policies */}
      <div className="card mt14">
        <div className="ch"><div className="ct">Data Retention Policies</div></div>
        <div className="cb">
          <div className="fgrid">
            <div className="fg"><label className="fl">Employee Records Retention</label>
              <select className="fc" value={retentionEmployees} onChange={(e) => onRetentionChange('retentionEmployees', e.target.value)}>
                <option value="5">5 years post-termination</option>
                <option value="7">7 years post-termination</option>
                <option value="10">10 years post-termination</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Waste Log Records Retention</label>
              <select className="fc" value={retentionWaste} onChange={(e) => onRetentionChange('retentionWaste', e.target.value)}>
                <option value="5">5 years</option>
                <option value="7">7 years</option>
                <option value="10">10 years</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text3)', marginTop: 8 }}>
            Records older than the retention period will be flagged for review. Automatic deletion requires explicit admin approval.
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card mt14">
        <div className="ch"><div className="ct">Compliance Actions</div></div>
        <div className="cb">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={exportAudit}>
              <Download size={13} /> Export Audit Trail
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setShowRequestModal(true)}>
              <AlertTriangle size={13} /> Request Data Deletion
            </button>
          </div>
        </div>
      </div>

      {/* Request History */}
      <div className="card mt14">
        <div className="ch"><div className="ct">Deletion Request History</div><div className="cs">{requests.length} request{requests.length !== 1 ? 's' : ''}</div></div>
        <div className="cb" style={{ padding: 0 }}>
          {requests.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--color-text3)' }}>
              <FileText size={20} style={{ margin: '0 auto 8', opacity: 0.4 }} />
              No deletion requests have been submitted.
            </div>
          ) : (
            <div className="tw">
              <table>
                <thead>
                  <tr><th>Reference</th><th>Requested By</th><th>Scope</th><th>Reason</th><th>Status</th><th>Date</th>{isAdmin && <th>Action</th>}</tr>
                </thead>
                <tbody>
                  {requests.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{r.reference}</td>
                      <td style={{ fontSize: 12 }}>{r.user?.name || '—'}</td>
                      <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{r.scope}</td>
                      <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                          background: `${statusColor[r.status]}20`, color: statusColor[r.status],
                        }}>
                          <Clock size={9} /> {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--color-text3)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      {isAdmin && (
                        <td>
                          {r.status === 'PENDING' && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'PROCESSING' })}>Process</button>
                              <button type="button" className="btn btn-danger btn-sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'REJECTED', notes: 'Rejected by admin' })}>Reject</button>
                            </div>
                          )}
                          {r.status === 'PROCESSING' && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => statusMutation.mutate({ id: r.id, status: 'COMPLETED', notes: 'Data deleted' })}>
                              <CheckCircle2 size={11} /> Complete
                            </button>
                          )}
                          {(r.status === 'COMPLETED' || r.status === 'REJECTED') && (
                            <span style={{ fontSize: 10, color: 'var(--color-text3)' }}>{r.notes || '—'}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
            <div className="modal-header">
              <h3>Request Data Deletion (POPIA)</h3>
              <button type="button" className="mc" onClick={() => setShowRequestModal(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-amber" style={{ marginBottom: 16 }}>
                <AlertTriangle size={14} />
                <span>This will log a formal POPIA data-deletion request and notify the Information Officer. This action cannot be undone once processed.</span>
              </div>
              <div className="fg" style={{ marginBottom: 14 }}>
                <label className="fl">Data Scope *</label>
                <select className="fc" value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="all">All Personal Data</option>
                  <option value="employees">Employee Records Only</option>
                  <option value="waste-logs">Waste Logs Only</option>
                  <option value="financial">Financial Records Only</option>
                </select>
              </div>
              <div className="fg">
                <label className="fl">Reason for Deletion *</label>
                <textarea className="fc" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe why this data deletion is being requested…" style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowRequestModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={submitRequest} disabled={!reason.trim() || createMutation.isPending}>
                <AlertTriangle size={13} /> {createMutation.isPending ? 'Submitting…' : 'Submit Deletion Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  ⚙ System Tab
// ═══════════════════════════════════════════════════
function SystemTab({ settings, siteName, org }: { settings: ProgrammeSettings; siteName?: string; org: Record<string, string> }) {
  const rows = [
    ['Programme', 'Waste to Work (W2W)'],
    ['Organisation', siteName || '—'],
    ['Implementing Partner', org.partner || '—'],
    ['Reporting Currency', org.currency || 'ZAR'],
    ['Tax Year', org.taxYear ? (org.taxYear === 'jan-dec' ? 'January – December' : org.taxYear === 'apr-mar' ? 'April – March' : 'March – February') : '—'],
    ['VAT Number', org.vat || '—'],
    ['EPR PRO', org.epr || '—'],
  ];

  return (
    <div className="g2">
      <div className="card">
        <div className="ch"><div className="ct">Programme Constants</div></div>
        <div className="cb">
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text2)' }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="ch"><div className="ct">Quick Stats</div></div>
        <div className="cb">
          {[
            ['Waste Categories', `${settings.wasteCategories.length} configured`],
            ['Training Modules', `${settings.trainingModules.length} (${settings.trainingModules.filter((m) => m.type === 'mandatory').length} mandatory)`],
            ['Payment Roles', `${settings.paymentScales.length} defined`],
            ['Cost Centers', `${settings.costCenters.length} active`],
            ['Total Budget', `R ${settings.costCenters.reduce((s, c) => s + c.budget, 0).toLocaleString()}`],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text2)' }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  Shared Modal
// ═══════════════════════════════════════════════════
function ItemModal({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 14, width: 720, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div className="ch" style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
          <div className="ct">{title}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="cb">{children}</div>
        <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave}><Save size={13} /> Save</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  Geography Settings Tab
// ═══════════════════════════════════════════════════
function GeographySettingsTab({ onToast }: { onToast: (msg: string) => void }) {
  const [geo, setGeo] = useState(loadGeography);
  const [modal, setModal] = useState<{ type: 'province' | 'municipality' | 'subRegion'; mode: 'add' | 'edit'; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const persist = (updated: any) => { setGeo(updated); saveGeography(updated); };

  const openAdd = (type: 'province' | 'municipality' | 'subRegion') => { setForm({}); setModal({ type, mode: 'add' }); };
  const openEdit = (type: 'province' | 'municipality' | 'subRegion', item: any) => { setForm({ ...item }); setModal({ type, mode: 'edit', item }); };

  const remove = (type: 'province' | 'municipality' | 'subRegion', id: string) => {
    const key = type === 'province' ? 'provinces' : type === 'municipality' ? 'municipalities' : 'subRegions';
    if (!confirm('Delete this entry?')) return;
    persist({ ...geo, [key]: geo[key].filter((x: any) => x.id !== id) });
    onToast('Deleted.');
  };

  const handleSave = () => {
    if (!modal) return;
    const { type, mode, item } = modal;
    const key = type === 'province' ? 'provinces' : type === 'municipality' ? 'municipalities' : 'subRegions';
    if (!form.name?.trim()) { alert('Name is required'); return; }
    if (mode === 'edit' && item) {
      persist({ ...geo, [key]: (geo[key] || []).map((x: any) => x.id === item.id ? { ...x, ...form } : x) });
    } else {
      const prefix = type === 'province' ? 'PROV' : type === 'municipality' ? 'MUN' : 'SR';
      persist({ ...geo, [key]: [...(geo[key] || []), { ...form, id: prefix + '-' + Date.now().toString(36).toUpperCase() }] });
    }
    setModal(null);
    onToast(mode === 'edit' ? 'Updated.' : 'Added.');
  };

  const typeLabel = (t: string) => t === 'province' ? 'Province' : t === 'municipality' ? 'Municipality' : 'Sub-Region';

  const sectionHead: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase',
    letterSpacing: '0.1em', borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6,
    marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  };
  const actionBtn: React.CSSProperties = {
    background: 'none', border: '1px solid var(--color-border)', borderRadius: 5,
    padding: '3px 6px', cursor: 'pointer', color: 'var(--color-text2)', fontSize: 11, lineHeight: 1,
  };
  const dangerBtn: React.CSSProperties = { ...actionBtn, color: 'var(--color-red)', borderColor: 'var(--color-red)' };

  return (
    <>
      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Provinces', value: geo.provinces.length, icon: '🇿🇦', color: 'var(--color-w2w)' },
          { label: 'Municipalities', value: geo.municipalities.length, icon: '🏛', color: 'var(--color-green)' },
          { label: 'Sub-Regions', value: geo.subRegions.length, icon: '📍', color: 'var(--color-amber)' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '12px 14px', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 9, color: 'var(--color-text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="alert alert-blue" style={{ marginBottom: 18 }}>
        <span>Geography settings define the <b>provinces</b>, <b>municipalities</b>, and <b>sub-regions</b> available across the platform. These appear in site forms, employee records, and reports.</span>
      </div>

      {/* Provinces */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>🇿🇦 Provinces</div>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>South African provinces where the programme operates</div>
          </div>
          <button className="btn btn-accent btn-sm" onClick={() => openAdd('province')}><Plus size={11} /> Add Province</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Premier</th><th style={{ width: 90 }}>Actions</th></tr></thead>
            <tbody>
              {geo.provinces.map((p: any) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td><span className="badge bb">{p.code}</span></td>
                  <td style={{ fontSize: 11 }}>{p.premier || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={actionBtn} title="Edit" onClick={() => openEdit('province', p)}><Edit3 size={13} /></button>
                      <button style={dangerBtn} title="Delete" onClick={() => remove('province', p.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {geo.provinces.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 20 }}>No provinces added yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Municipalities */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>🏛 Municipalities</div>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>Metro, district, and local municipalities linked to provinces</div>
          </div>
          <button className="btn btn-accent btn-sm" onClick={() => openAdd('municipality')}><Plus size={11} /> Add Municipality</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Type</th><th>Province</th><th style={{ width: 90 }}>Actions</th></tr></thead>
            <tbody>
              {geo.municipalities.map((m: any) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td><span className="badge bb">{m.code}</span></td>
                  <td style={{ fontSize: 11 }}>{m.type || '—'}</td>
                  <td style={{ fontSize: 11 }}>{geo.provinces.find((p: any) => p.id === m.provinceId)?.name || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={actionBtn} title="Edit" onClick={() => openEdit('municipality', m)}><Edit3 size={13} /></button>
                      <button style={dangerBtn} title="Delete" onClick={() => remove('municipality', m.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {geo.municipalities.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 20 }}>No municipalities added yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-Regions */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>📍 Sub-Regions / Planning Regions</div>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>Operational planning areas within municipalities (used for site grouping)</div>
          </div>
          <button className="btn btn-accent btn-sm" onClick={() => openAdd('subRegion')}><Plus size={11} /> Add Sub-Region</button>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Name</th><th>Code</th><th>Description</th><th>Municipality</th><th style={{ width: 90 }}>Actions</th></tr></thead>
            <tbody>
              {geo.subRegions.map((sr: any) => (
                <tr key={sr.id}>
                  <td style={{ fontWeight: 600 }}>{sr.name}</td>
                  <td><span className="badge bb">{sr.code}</span></td>
                  <td style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sr.description || '—'}</td>
                  <td style={{ fontSize: 11 }}>{geo.municipalities.find((m: any) => m.id === sr.municipalityId)?.name || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={actionBtn} title="Edit" onClick={() => openEdit('subRegion', sr)}><Edit3 size={13} /></button>
                      <button style={dangerBtn} title="Delete" onClick={() => remove('subRegion', sr.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {geo.subRegions.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 20 }}>No sub-regions added yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>



      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal.mode === 'edit' ? 'Edit' : 'Add'} {typeLabel(modal.type)}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Name <span className="req">*</span></label>
                  <input className="fc" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`e.g. ${modal.type === 'province' ? 'Gauteng' : modal.type === 'municipality' ? 'City of Johannesburg' : 'Planning Region C'}`} />
                </div>
                <div className="fg"><label className="fl">Code</label>
                  <input className="fc" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder={`e.g. ${modal.type === 'province' ? 'GP' : modal.type === 'municipality' ? 'COJ' : 'C'}`} />
                </div>

                {modal.type === 'province' && (
                  <div className="fg"><label className="fl">Premier</label>
                    <input className="fc" value={form.premier || ''} onChange={(e) => setForm({ ...form, premier: e.target.value })} placeholder="e.g. Panyaza Lesufi" />
                  </div>
                )}

                {modal.type === 'municipality' && (
                  <>
                    <div className="fg"><label className="fl">Type</label>
                      <select className="fc" value={form.type || ''} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        <option value="">Select</option>
                        <option>Metropolitan</option>
                        <option>District</option>
                        <option>Local</option>
                      </select>
                    </div>
                    <div className="fg"><label className="fl">Province</label>
                      <select className="fc" value={form.provinceId || ''} onChange={(e) => setForm({ ...form, provinceId: e.target.value })}>
                        <option value="">Select</option>
                        {geo.provinces.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {modal.type === 'subRegion' && (
                  <>
                    <div className="fg full"><label className="fl">Description</label>
                      <input className="fc" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Areas covered by this region" />
                    </div>
                    <div className="fg"><label className="fl">Municipality</label>
                      <select className="fc" value={form.municipalityId || ''} onChange={(e) => setForm({ ...form, municipalityId: e.target.value })}>
                        <option value="">Select</option>
                        {geo.municipalities.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  </>
                )}


              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{modal.mode === 'edit' ? 'Update' : 'Add'} {typeLabel(modal.type)}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  💵 P&L Configuration Tab
// ═══════════════════════════════════════════════════
function PLConfigTab({ onToast }: { onToast: (msg: string, tone?: 'green' | 'amber' | 'red') => void }) {
  const [types, setTypes] = useState<PLType[]>(loadPLTypes);
  const [categories, setCategories] = useState<string[]>(loadPLCategories);
  const [costCentres, setCostCentres] = useState<string[]>(loadPLCostCentres);
  const [groups, setGroups] = useState<string[]>(loadPLGroups);

  const [editingType, setEditingType] = useState<PLType | null>(null);
  const [showAddType, setShowAddType] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newCostCentre, setNewCostCentre] = useState('');
  const [newGroup, setNewGroup] = useState('');

  // ── P&L Group CRUD ──
  const addGroup = () => {
    const g = newGroup.trim();
    if (!g) return;
    if (groups.includes(g)) { onToast('Group already exists.', 'amber'); return; }
    const updated = [...groups, g];
    setGroups(updated);
    savePLGroups(updated);
    setNewGroup('');
    onToast('Group added.');
  };
  const removeGroup = (g: string) => {
    const usedCount = types.filter((t) => t.group === g).length;
    if (usedCount > 0) { onToast(`Cannot delete "${g}" — it has ${usedCount} type(s) assigned. Remove or reassign them first.`, 'amber'); return; }
    const updated = groups.filter((x) => x !== g);
    setGroups(updated);
    savePLGroups(updated);
    onToast('Group removed.');
  };
  const resetGroups = () => {
    if (!confirm('Reset groups to defaults? Custom groups will be lost.')) return;
    const defaults = getDefaultPLGroups();
    setGroups(defaults);
    savePLGroups(defaults);
    onToast('Groups reset to defaults.');
  };

  // ── P&L Type CRUD ──
  const saveTypeEdit = (item: PLType) => {
    if (!item.label.trim() || !item.group.trim()) { alert('Group and label are required'); return; }
    let updated: PLType[];
    if (item.id && types.find((t) => t.id === item.id)) {
      updated = types.map((t) => (t.id === item.id ? item : t));
    } else {
      let maxSerial = 0;
      for (const t of types) {
        const m = t.id.match(/^PLT-(\d+)$/);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > maxSerial) maxSerial = num;
        }
      }
      const newId = `PLT-${String(maxSerial + 1).padStart(3, '0')}`;
      updated = [...types, { ...item, id: newId }];
    }
    setTypes(updated);
    savePLTypes(updated);
    setEditingType(null);
    setShowAddType(false);
    onToast('P&L type saved.');
  };
  const removeType = (id: string) => {
    if (!confirm('Delete this P&L type?')) return;
    const updated = types.filter((t) => t.id !== id);
    setTypes(updated);
    savePLTypes(updated);
    onToast('P&L type removed.');
  };
  const resetTypes = () => {
    if (!confirm('Reset P&L types to defaults? Custom types will be lost.')) return;
    const defaults = getDefaultPLTypes();
    setTypes(defaults);
    savePLTypes(defaults);
    onToast('P&L types reset to defaults.');
  };

  // ── Category CRUD ──
  const addCategory = () => {
    const cat = newCategory.trim();
    if (!cat) return;
    if (categories.includes(cat)) { onToast('Category already exists.', 'amber'); return; }
    const updated = [...categories, cat];
    setCategories(updated);
    savePLCategories(updated);
    setNewCategory('');
    onToast('Category added.');
  };
  const removeCategory = (cat: string) => {
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    savePLCategories(updated);
    onToast('Category removed.');
  };
  const resetCategories = () => {
    if (!confirm('Reset categories to defaults?')) return;
    const defaults = getDefaultPLCategories();
    setCategories(defaults);
    savePLCategories(defaults);
    onToast('Categories reset to defaults.');
  };

  // ── Cost Centre CRUD ──
  const addCostCentre = () => {
    const cc = newCostCentre.trim();
    if (!cc) return;
    if (costCentres.includes(cc)) { onToast('Cost centre already exists.', 'amber'); return; }
    const updated = [...costCentres, cc];
    setCostCentres(updated);
    savePLCostCentres(updated);
    setNewCostCentre('');
    onToast('Cost centre added.');
  };
  const removeCostCentre = (cc: string) => {
    const updated = costCentres.filter((c) => c !== cc);
    setCostCentres(updated);
    savePLCostCentres(updated);
    onToast('Cost centre removed.');
  };

  // ── Group types ──
  const groupedTypes = useMemo(() => {
    const map = new Map<string, PLType[]>();
    types.forEach((t) => {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    });
    return Array.from(map.entries());
  }, [types]);

  const sectionHead: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase',
    letterSpacing: '0.1em', borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6,
    marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  };

  return (
    <>
      {/* ── P&L Entry Types ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={sectionHead}>
          <span>📋 P&L Entry Types ({types.length})</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={resetTypes}>Reset Defaults</button>
            <button className="btn btn-accent btn-sm" onClick={() => { setEditingType({ id: '', group: 'Income', label: '' }); setShowAddType(true); }}><Plus size={11} /> Add Type</button>
          </div>
        </div>
        {groupedTypes.map(([group, items]) => (
          <div key={group} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text2)', marginBottom: 6, paddingLeft: 4 }}>{group} ({items.length})</div>
            <div className="tw">
              <table>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text3)', width: 80 }}>{t.id}</td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{t.label}</td>
                      <td style={{ width: 100 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingType(t)}><Edit3 size={11} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => removeType(t.id)}><Trash2 size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>


      {/* ── P&L Groups ── */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>📁 P&L Groups ({groups.length})</div>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>Broad classifications for P&L entry types (e.g. Income, Expenses)</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={resetGroups}>Reset Defaults</button>
        </div>
        <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="fc" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New group name…" style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') addGroup(); }} />
          <button className="btn btn-accent btn-sm" onClick={addGroup}><Plus size={11} /> Add</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {groups.map((g) => (
            <span key={g} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'var(--color-surface3)', border: '1px solid var(--color-border)',
            }}>
              {g}
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-red)', lineHeight: 1 }}
                onClick={() => removeGroup(g)}
                title="Remove"
              ><X size={11} /></button>
            </span>
          ))}
        </div>
      </div>
      </div>

      {/* ── P&L Categories ── */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>🏷 P&L Categories ({categories.length})</div>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>Specific categories for each transaction (e.g. Waste Sales — Plastics, Fuel)</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={resetCategories}>Reset Defaults</button>
        </div>
        <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="fc" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category name…" style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} />
          <button className="btn btn-accent btn-sm" onClick={addCategory}><Plus size={11} /> Add</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <span key={cat} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'var(--color-surface3)', border: '1px solid var(--color-border)',
            }}>
              {cat}
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-red)', lineHeight: 1 }}
                onClick={() => removeCategory(cat)}
                title="Remove"
              ><X size={11} /></button>
            </span>
          ))}
        </div>
      </div>
      </div>

      {/* ── P&L Cost Centres ── */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>🏢 Cost Centres for P&L ({costCentres.length})</div>
            <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 2 }}>Budget cost centres available in the P&L entry form dropdown</div>
          </div>
        </div>
        <div style={{ padding: 14 }}>
        <div className="alert alert-blue" style={{ marginBottom: 12 }}>
          <span>These are the cost centres available in the P&L entry form. They default from the Cost Centers tab in Programme settings.</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input className="fc" value={newCostCentre} onChange={(e) => setNewCostCentre(e.target.value)} placeholder="New cost centre (e.g. OPS-002 — Sorting)…" style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter') addCostCentre(); }} />
          <button className="btn btn-accent btn-sm" onClick={addCostCentre}><Plus size={11} /> Add</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {costCentres.map((cc) => (
            <span key={cc} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'var(--color-surface3)', border: '1px solid var(--color-border)',
            }}>
              {cc}
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-red)', lineHeight: 1 }}
                onClick={() => removeCostCentre(cc)}
                title="Remove"
              ><X size={11} /></button>
            </span>
          ))}
        </div>
      </div>
      </div>

      {/* ── Add/Edit Type Modal ── */}
      {(editingType || showAddType) && editingType && (
        <ItemModal
          title={editingType.id && types.find((t) => t.id === editingType.id) ? 'Edit P&L Type' : 'Add P&L Type'}
          onClose={() => { setEditingType(null); setShowAddType(false); }}
          onSave={() => saveTypeEdit(editingType)}
        >
          <div className="fgrid">
            <div className="fg"><label className="fl">Group *</label>
              <select className="fc" value={editingType.group} onChange={(e) => setEditingType({ ...editingType, group: e.target.value })}>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="fg"><label className="fl">Label *</label>
              <input className="fc" value={editingType.label} onChange={(e) => setEditingType({ ...editingType, label: e.target.value })} placeholder="e.g. Revenue — Consulting" />
            </div>
          </div>
        </ItemModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  🚛 Vehicle Types Tab
// ═══════════════════════════════════════════════════
const LS_VEH_TYPES = 'w2w_vehicle_types';
const DEFAULT_VEH_TYPES = [
  'Electric 3-Wheeler', 'Pull Trolley', 'Bakkie', 'Truck', 'Van', 'Bicycle', 'Motorbike', 'Other',
];

export function loadVehicleTypes(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_VEH_TYPES) || 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch { /* ignore */ }
  localStorage.setItem(LS_VEH_TYPES, JSON.stringify(DEFAULT_VEH_TYPES));
  return DEFAULT_VEH_TYPES;
}

function saveVehicleTypes(types: string[]) {
  localStorage.setItem(LS_VEH_TYPES, JSON.stringify(types));
}

function VehicleTypesTab({ onToast }: { onToast: (msg: string, tone?: 'green' | 'amber' | 'red') => void }) {
  const [types, setTypes] = useState<string[]>(loadVehicleTypes);
  const [newType, setNewType] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const add = () => {
    const trimmed = newType.trim();
    if (!trimmed || types.includes(trimmed)) return;
    const next = [...types, trimmed];
    setTypes(next); saveVehicleTypes(next); setNewType('');
    onToast('Vehicle type added.');
  };

  const startEdit = (i: number) => { setEditIdx(i); setEditVal(types[i]); };
  const saveEdit = () => {
    if (editIdx === null || !editVal.trim()) return;
    const next = [...types]; next[editIdx] = editVal.trim();
    setTypes(next); saveVehicleTypes(next); setEditIdx(null);
    onToast('Vehicle type updated.');
  };

  const remove = (i: number) => {
    const next = types.filter((_, idx) => idx !== i);
    setTypes(next); saveVehicleTypes(next);
    onToast('Vehicle type removed.', 'amber');
  };

  return (
    <>
      <div className="alert alert-blue" style={{ marginBottom: 14 }}>
        <span>These vehicle types will appear in the <b>Add Vehicle</b> form's Type dropdown across the platform.</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input className="fc" value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="New vehicle type…" style={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button className="btn btn-primary" onClick={add} disabled={!newType.trim()}><Plus size={13} /> Add</button>
      </div>

      <div className="tw">
        <table>
          <thead><tr><th>#</th><th>Vehicle Type</th><th style={{ width: 120 }}>Actions</th></tr></thead>
          <tbody>
            {types.map((t, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--color-text3)', fontSize: 11 }}>{i + 1}</td>
                <td>
                  {editIdx === i ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="fc" value={editVal} onChange={(e) => setEditVal(e.target.value)} style={{ flex: 1 }}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }} autoFocus />
                      <button className="btn btn-primary btn-sm" onClick={saveEdit}><Save size={11} /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditIdx(null)}><X size={11} /></button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{t}</span>
                  )}
                </td>
                <td>
                  {editIdx !== i && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEdit(i)}><Edit3 size={11} /> Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(i)}><Trash2 size={11} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {types.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 20 }}>No vehicle types defined. Add one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════
//  🏭 Depot Types Tab
// ═══════════════════════════════════════════════════
const LS_DEPOT_TYPES = 'w2w_depot_types';
const DEFAULT_DEPOT_TYPES = [
  { code: 'IWMC', name: 'Integrated Waste Management Centre' },
  { code: 'MRC', name: 'Material Recovery Centre' },
  { code: 'BBC', name: 'Buy-Back Centre' },
  { code: 'TS', name: 'Transfer Station' },
  { code: 'SH', name: 'Sorting Hub' },
];

export function loadDepotTypes(): { code: string; name: string }[] {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_DEPOT_TYPES) || 'null');
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch { /* ignore */ }
  localStorage.setItem(LS_DEPOT_TYPES, JSON.stringify(DEFAULT_DEPOT_TYPES));
  return DEFAULT_DEPOT_TYPES;
}

function saveDepotTypes(types: { code: string; name: string }[]) {
  localStorage.setItem(LS_DEPOT_TYPES, JSON.stringify(types));
}

function DepotTypesTab({ onToast }: { onToast: (msg: string, tone?: 'green' | 'amber' | 'red') => void }) {
  const [types, setTypes] = useState(loadDepotTypes);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<{ code: string; name: string } | null>(null);
  const [editForm, setEditForm] = useState({ code: '', name: '' });

  const openAdd = () => { setEditForm({ code: '', name: '' }); setEditing(null); setShowAdd(true); };
  const openEdit = (t: { code: string; name: string }) => { setEditForm({ ...t }); setEditing(t); setShowAdd(true); };

  const save = () => {
    if (!editForm.code.trim() || !editForm.name.trim()) return;
    if (editing) {
      const next = types.map((t) => t.code === editing.code ? { code: editForm.code.toUpperCase().trim(), name: editForm.name.trim() } : t);
      setTypes(next); saveDepotTypes(next);
      onToast('Depot type updated.');
    } else {
      const next = [...types, { code: editForm.code.toUpperCase().trim(), name: editForm.name.trim() }];
      setTypes(next); saveDepotTypes(next);
      onToast('Depot type added.');
    }
    setShowAdd(false); setEditing(null);
  };

  const remove = (code: string) => {
    const next = types.filter((t) => t.code !== code);
    setTypes(next); saveDepotTypes(next);
    onToast('Depot type removed.', 'amber');
  };

  return (
    <>
      <div className="alert alert-blue" style={{ marginBottom: 14 }}>
        <span>These depot types will appear in the <b>Add Depot</b> form's Type dropdown across the platform.</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={13} /> Add Depot Type</button>
      </div>

      <div className="tw">
        <table>
          <thead><tr><th>Code</th><th>Full Name</th><th style={{ width: 120 }}>Actions</th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.code}>
                <td><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-w2w)' }}>{t.code}</span></td>
                <td style={{ fontWeight: 600 }}>{t.name}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}><Edit3 size={11} /> Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(t.code)}><Trash2 size={11} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {types.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 20 }}>No depot types defined.</td></tr>}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <ItemModal
          title={editing ? 'Edit Depot Type' : 'Add Depot Type'}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          onSave={save}
        >
          <div className="fgrid">
            <div className="fg"><label className="fl">Code *</label>
              <input className="fc" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="e.g. IWMC" style={{ textTransform: 'uppercase' }} /></div>
            <div className="fg"><label className="fl">Full Name *</label>
              <input className="fc" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="e.g. Integrated Waste Management Centre" /></div>
          </div>
        </ItemModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  🤝 PRO Partners Tab
// ═══════════════════════════════════════════════════
function ProPartnersTab({ data, onUpdate }: { data: string[]; onUpdate: (d: string[]) => void }) {
  const [partners, setPartners] = useState([...data]);
  const [newPartner, setNewPartner] = useState('');

  const add = () => {
    if (!newPartner.trim()) return;
    if (partners.includes(newPartner.trim())) return;
    const updated = [...partners, newPartner.trim()];
    setPartners(updated);
    onUpdate(updated);
    setNewPartner('');
  };

  const remove = (i: number) => {
    const updated = partners.filter((_, idx) => idx !== i);
    setPartners(updated);
    onUpdate(updated);
  };

  return (
    <div className="card">
      <div className="ch">
        <div className="ct">PRO Partners</div>
        <div className="cs">Producer Responsibility Organisation partners available in the Cooperative form</div>
      </div>
      <div className="cb">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="fc" value={newPartner} onChange={(e) => setNewPartner(e.target.value)}
            placeholder="Add PRO partner name..." onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <button className="btn btn-primary" onClick={add}><Plus size={14} /></button>
        </div>
        {partners.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text3)', fontSize: 12, fontStyle: 'italic' }}>
            No PRO partners configured. Add one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {partners.map((p, i) => (
              <div key={i} className="badge bg" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', fontSize: 12 }}>
                {p}
                <X size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => remove(i)} />
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-text3)' }}>
          {partners.length} partner{partners.length !== 1 ? 's' : ''} configured · Used in the Add Cooperative form
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  👥 Employee Fields Tab
// ═══════════════════════════════════════════════════
function EmployeeFieldsTab({ settings, onUpdate, onToast }: { settings: ProgrammeSettings; onUpdate: (p: Partial<ProgrammeSettings>) => void; onToast: (m: string) => void }) {
  const [departments, setDepartments] = useState([...settings.departments]);
  const [designations, setDesignations] = useState([...settings.designations]);
  const [banks, setBanks] = useState([...settings.banks]);

  const [newDept, setNewDept] = useState('');
  const [newDesig, setNewDesig] = useState('');
  const [newBank, setNewBank] = useState('');

  const saveList = (key: 'departments' | 'designations' | 'banks', list: string[]) => {
    onUpdate({ [key]: list });
    onToast(`${key} updated successfully.`);
  };

  return (
    <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {/* Departments */}
      <div className="card">
        <div className="ch"><div className="ct">Departments</div></div>
        <div className="cb">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input className="fc" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Add department..." onKeyDown={(e) => {
              if (e.key === 'Enter' && newDept.trim()) {
                const updated = [...departments, newDept.trim()];
                setDepartments(updated);
                saveList('departments', updated);
                setNewDept('');
              }
            }} />
            <button className="btn btn-primary" onClick={() => {
              if (newDept.trim()) {
                const updated = [...departments, newDept.trim()];
                setDepartments(updated);
                saveList('departments', updated);
                setNewDept('');
              }
            }}><Plus size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {departments.map((d, i) => (
              <div key={i} className="badge bc" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
                {d}
                <X size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => {
                  const updated = departments.filter((_, idx) => idx !== i);
                  setDepartments(updated);
                  saveList('departments', updated);
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Designations */}
      <div className="card">
        <div className="ch"><div className="ct">Designations (Roles)</div></div>
        <div className="cb">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input className="fc" value={newDesig} onChange={(e) => setNewDesig(e.target.value)} placeholder="Add designation..." onKeyDown={(e) => {
              if (e.key === 'Enter' && newDesig.trim()) {
                const updated = [...designations, newDesig.trim()];
                setDesignations(updated);
                saveList('designations', updated);
                setNewDesig('');
              }
            }} />
            <button className="btn btn-primary" onClick={() => {
              if (newDesig.trim()) {
                const updated = [...designations, newDesig.trim()];
                setDesignations(updated);
                saveList('designations', updated);
                setNewDesig('');
              }
            }}><Plus size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {designations.map((d, i) => (
              <div key={i} className="badge bb" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
                {d}
                <X size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => {
                  const updated = designations.filter((_, idx) => idx !== i);
                  setDesignations(updated);
                  saveList('designations', updated);
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Banks */}
      <div className="card">
        <div className="ch"><div className="ct">Banks</div></div>
        <div className="cb">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input className="fc" value={newBank} onChange={(e) => setNewBank(e.target.value)} placeholder="Add bank..." onKeyDown={(e) => {
              if (e.key === 'Enter' && newBank.trim()) {
                const updated = [...banks, newBank.trim()];
                setBanks(updated);
                saveList('banks', updated);
                setNewBank('');
              }
            }} />
            <button className="btn btn-primary" onClick={() => {
              if (newBank.trim()) {
                const updated = [...banks, newBank.trim()];
                setBanks(updated);
                saveList('banks', updated);
                setNewBank('');
              }
            }}><Plus size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {banks.map((b, i) => (
              <div key={i} className="badge bp" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
                {b}
                <X size={12} style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => {
                  const updated = banks.filter((_, idx) => idx !== i);
                  setBanks(updated);
                  saveList('banks', updated);
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
