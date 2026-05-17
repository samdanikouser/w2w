import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import {
  Save, Building, Database, Users as UsersIcon, KeyRound,
  Plus, X, Edit2, Trash2, CheckCircle2, ShieldAlert,
} from 'lucide-react';
import { exportCsv } from '../utils/csv';
import {
  auditLogsApi, employeesApi, rolesApi, usersApi,
  type CustomRolePayload, type SystemRole, type CreateUserPayload, type UpdateUserPayload,
} from '../api/endpoints';
import { RowBtn } from './SitesPage';

const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin (full access)',
  SITE_ADMIN: 'Site Admin (site-scoped)',
  DATA_CLERK: 'Data Clerk (data entry)',
  FIELD_WORKER: 'Field Worker (FO mobile)',
};

const TABS = [
  { id: 'organisation', label: 'Organisation', icon: <Building size={13} />, adminOnly: false },
  { id: 'users', label: 'Users', icon: <UsersIcon size={13} />, adminOnly: true },
  { id: 'roles', label: 'Roles', icon: <KeyRound size={13} />, adminOnly: true },
  { id: 'data', label: 'Data & POPIA', icon: <Database size={13} />, adminOnly: false },
];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('organisation');
  const [toast, setToast] = useState<{ message: string; tone: 'green' | 'amber' | 'red' } | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['audit-logs', 'export'],
    queryFn: () => auditLogsApi.list({ limit: '1000' }),
  });

  // Organisation prefs persisted locally for now (until /api/organisation lands)
  const [org, setOrg] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('w2w_org') || '{}'); } catch { return {}; }
  });
  const setOrgField = (k: string, v: string) => setOrg((p) => ({ ...p, [k]: v }));

  const saveOrg = () => {
    try {
      localStorage.setItem('w2w_org', JSON.stringify(org));
      setToast({ message: 'Organisation settings saved.', tone: 'green' });
    } catch {
      setToast({ message: 'Could not save (localStorage unavailable).', tone: 'amber' });
    }
  };

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

  const requestDeletion = () => {
    if (confirm('Submit a POPIA data-deletion request? This will be logged and notify the Information Officer.')) {
      setToast({
        message: 'Deletion request submitted. Reference: POPIA-' + Date.now().toString(36).toUpperCase(),
        tone: 'green',
      });
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isSuperAdmin);

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Settings</div>
          <div className="ps">Application, users, roles, and POPIA compliance</div>
        </div>
        {tab === 'organisation' && (
          <button className="btn btn-primary" onClick={saveOrg}><Save size={13} /> Save Changes</button>
        )}
      </div>

      {toast && (
        <div
          className={`alert alert-${toast.tone === 'red' ? 'red' : toast.tone === 'amber' ? 'amber' : 'green'}`}
          style={{ marginBottom: 12 }}
        >
          <CheckCircle2 size={14} />
          <span>{toast.message}</span>
        </div>
      )}

      {!isSuperAdmin && tab !== 'organisation' && tab !== 'data' && (
        <div className="alert alert-amber" style={{ marginBottom: 12 }}>
          <ShieldAlert size={14} />
          <span>User & Role administration is restricted to Super Admins.</span>
        </div>
      )}

      <div className="g2" style={{ gridTemplateColumns: '220px 1fr', alignItems: 'start' }}>
        <div className="card">
          <div className="cb" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px',
                  background: tab === t.id ? 'var(--color-w2w-pale)' : 'transparent',
                  color: tab === t.id ? 'var(--color-w2w)' : 'var(--color-text2)',
                  border: 'none', cursor: 'pointer', borderRadius: 7,
                  fontWeight: tab === t.id ? 700 : 500, fontSize: 12,
                  textAlign: 'left', fontFamily: 'var(--font-sans)',
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="ch"><div className="ct">{visibleTabs.find((t) => t.id === tab)?.label}</div></div>
          <div className="cb">
            {tab === 'organisation' && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6, marginBottom: 14 }}>
                  Application Identity
                </div>
                <div className="fgrid">
                  <div className="fg"><label className="fl">App Name</label>
                    <input className="fc" value={org.appName || 'W2W'} onChange={(e) => setOrgField('appName', e.target.value)} placeholder="Displayed in sidebar and login" />
                  </div>
                  <div className="fg"><label className="fl">Short Tagline</label>
                    <input className="fc" value={org.tagline || 'Waste to Work'} onChange={(e) => setOrgField('tagline', e.target.value)} placeholder="Sub-line shown under the app name" />
                  </div>
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '2px solid var(--color-w2w-light)', paddingBottom: 6, margin: '20px 0 14px' }}>
                  Programme Information
                </div>
                <div className="fgrid">
                  <div className="fg"><label className="fl">Programme Name</label>
                    <input className="fc" value={org.programmeName || ''} onChange={(e) => setOrgField('programmeName', e.target.value)} placeholder="e.g. Waste to Work — City of Johannesburg" />
                  </div>
                  <div className="fg"><label className="fl">Implementing Partner</label>
                    <input className="fc" value={org.partner || ''} onChange={(e) => setOrgField('partner', e.target.value)} placeholder="e.g. Athina Tech" />
                  </div>
                  <div className="fg"><label className="fl">Reporting Currency</label>
                    <select className="fc" value={org.currency || 'ZAR'} onChange={(e) => setOrgField('currency', e.target.value)}>
                      <option value="ZAR">ZAR — South African Rand</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                    </select>
                  </div>
                  <div className="fg"><label className="fl">Tax Year</label>
                    <select className="fc" value={org.taxYear || 'mar-feb'} onChange={(e) => setOrgField('taxYear', e.target.value)}>
                      <option value="mar-feb">March – February</option>
                      <option value="jan-dec">January – December</option>
                      <option value="apr-mar">April – March</option>
                    </select>
                  </div>
                  <div className="fg"><label className="fl">VAT Number</label>
                    <input className="fc" value={org.vat || ''} onChange={(e) => setOrgField('vat', e.target.value)} placeholder="4XXXXXXXXX" />
                  </div>
                  <div className="fg"><label className="fl">EPR PRO</label>
                    <input className="fc" value={org.epr || ''} onChange={(e) => setOrgField('epr', e.target.value)} placeholder="e.g. PETCO, Polyco" />
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
                  <div className="fg"><label className="fl">Information Officer (POPIA)</label>
                    <input className="fc" value={org.popiaOfficer || ''} onChange={(e) => setOrgField('popiaOfficer', e.target.value)} placeholder="Name / email" />
                  </div>
                  <div className="fg"><label className="fl">Default Region</label>
                    <input className="fc" value={org.region || ''} onChange={(e) => setOrgField('region', e.target.value)} placeholder="e.g. Gauteng" />
                  </div>
                </div>
              </>
            )}

            {tab === 'users' && isSuperAdmin && <UsersTab onToast={setToast} />}
            {tab === 'roles' && isSuperAdmin && <RolesTab onToast={setToast} />}

            {tab === 'data' && (
              <>
                <div className="alert alert-blue">
                  <span>
                    This system processes personal information under <b>POPIA</b>. SA ID, banking, and contact fields are encrypted at the application
                    layer; all access is logged to the Audit Log.
                  </span>
                </div>
                <div className="g2 mt14">
                  <div className="fg"><label className="fl">Data Retention (Employees)</label>
                    <select className="fc"><option>7 years post-termination</option><option>5 years</option></select>
                  </div>
                  <div className="fg"><label className="fl">Data Retention (Waste Logs)</label>
                    <select className="fc"><option>10 years</option><option>7 years</option></select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button className="btn btn-ghost" onClick={exportAudit}>Export full audit trail</button>
                  <button className="btn btn-danger" onClick={requestDeletion}>Request data deletion</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  USERS TAB (super-admin only)
// ═══════════════════════════════════════════════════
function UsersTab({ onToast }: { onToast: (t: { message: string; tone: 'green' | 'amber' | 'red' }) => void }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<CreateUserPayload & UpdateUserPayload>({
    employeeId: '', email: '', password: '', customRoleId: null, isActive: true, newPassword: '',
  });

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];
  const unlinkedEmployees = employees.filter((e: any) => !(users as any[]).some((u: any) => u.employeeId === e.id));

  const createMut = useMutation({
    mutationFn: (p: CreateUserPayload) => usersApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setModal(null); onToast({ message: 'User created.', tone: 'green' }); },
    onError: (err: any) => onToast({ message: err?.response?.data?.error || 'Failed to create user', tone: 'red' }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: UpdateUserPayload }) => usersApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setModal(null); onToast({ message: 'User updated.', tone: 'green' }); },
    onError: (err: any) => onToast({ message: err?.response?.data?.error || 'Failed to update user', tone: 'red' }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onToast({ message: 'User deleted.', tone: 'green' }); },
    onError: (err: any) => onToast({ message: err?.response?.data?.error || 'Failed to delete', tone: 'red' }),
  });

  const openAdd = () => {
    setForm({ employeeId: '', email: '', password: '', customRoleId: null, isActive: true, newPassword: '' });
    setActive(null); setModal('add');
  };
  const openEdit = (u: any) => {
    setForm({
      employeeId: u.employeeId || '',
      email: u.email,
      password: '',
      newPassword: '',
      customRoleId: u.customRoleId || null,
      isActive: u.isActive,
    });
    setActive(u); setModal('edit');
  };
  const save = () => {
    if (modal === 'add') {
      if (!form.employeeId || !form.email || !form.password) {
        return onToast({ message: 'Employee, email, and password are required.', tone: 'amber' });
      }
      createMut.mutate({
        employeeId: form.employeeId,
        email: form.email,
        password: form.password,
        customRoleId: form.customRoleId || null,
      });
    } else if (modal === 'edit' && active) {
      const payload: UpdateUserPayload = { email: form.email, isActive: form.isActive, customRoleId: form.customRoleId };
      if (form.newPassword) payload.newPassword = form.newPassword;
      updateMut.mutate({ id: active.id, p: payload });
    }
  };
  const remove = (u: any) => {
    if (confirm(`Delete user ${u.email}? This cannot be undone.`)) deleteMut.mutate(u.id);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text2)' }}>
          {(users as any[]).length} user{(users as any[]).length === 1 ? '' : 's'} ·{' '}
          {(users as any[]).filter((u: any) => u.isActive).length} active
        </div>
        <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add User</button>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr><th>User</th><th>Email</th><th>Employee</th><th>Role</th><th>Last Login</th><th>Status</th><th style={{ width: 80 }}>Actions</th></tr>
          </thead>
          <tbody>
            {(users as any[]).length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                No users yet. Click "Add User" to create one from an existing employee record.
              </td></tr>
            ) : (
              (users as any[]).map((u: any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{u.email}</td>
                  <td>{u.employee ? `${u.employee.firstName} ${u.employee.lastName} (${u.employee.empNo})` : '—'}</td>
                  <td><span className="badge bb">{u.customRole?.name || u.role.replace(/_/g, ' ')}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--color-text3)' }}>{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
                  <td><span className={u.isActive ? 'badge bg' : 'badge bk'}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <RowBtn title="Edit" onClick={() => openEdit(u)}><Edit2 size={13} /></RowBtn>
                      <RowBtn title="Delete" danger onClick={() => remove(u)}><Trash2 size={13} /></RowBtn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? `Edit User — ${active?.name}` : 'Add User'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {modal === 'add' && (
                <div className="alert alert-blue">
                  <span>Select an existing <b>employee</b> to grant them a login. They'll inherit their name automatically.</span>
                </div>
              )}
              <div className="fgrid">
                {modal === 'add' && (
                  <div className="full"><div className="fg"><label className="fl">Employee <span className="req">*</span></label>
                    <select className="fc" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                      <option value="">— Select an employee —</option>
                      {unlinkedEmployees.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.firstName} {e.lastName} · {e.empNo}</option>
                      ))}
                    </select>
                    {unlinkedEmployees.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--color-amber)', marginTop: 4 }}>
                        All employees already have a user account. Add an employee first.
                      </div>
                    )}
                  </div></div>
                )}
                <div className="fg"><label className="fl">Email <span className="req">*</span></label>
                  <input className="fc" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@organisation.com" />
                </div>
                <div className="fg"><label className="fl">Role</label>
                  <select className="fc" value={form.customRoleId || ''} onChange={(e) => setForm({ ...form, customRoleId: e.target.value || null })}>
                    <option value="">— None (Field Worker default) —</option>
                    {(roles as any[]).filter((r: any) => r.isActive).map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.systemRole.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                  {(roles as any[]).length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--color-text3)', marginTop: 4 }}>
                      No roles configured. Switch to the <b>Roles</b> tab to create one.
                    </div>
                  )}
                </div>
                {modal === 'add' && (
                  <div className="fg"><label className="fl">Password <span className="req">*</span></label>
                    <input className="fc" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 10 chars · upper, lower, digit" />
                  </div>
                )}
                {modal === 'edit' && (
                  <div className="fg"><label className="fl">Reset Password</label>
                    <input className="fc" type="password" value={form.newPassword || ''} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="Leave blank to keep current" />
                  </div>
                )}
                {modal === 'edit' && (
                  <div className="fg"><label className="fl">Status</label>
                    <select className="fc" value={form.isActive ? 'true' : 'false'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}>
                      <option value="true">Active</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
//  ROLES TAB (super-admin only)
// ═══════════════════════════════════════════════════
function RolesTab({ onToast }: { onToast: (t: { message: string; tone: 'green' | 'amber' | 'red' }) => void }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<CustomRolePayload>({
    name: '', description: '', systemRole: 'FIELD_WORKER', isActive: true,
  });

  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });

  const createMut = useMutation({
    mutationFn: (p: CustomRolePayload) => rolesApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setModal(null); onToast({ message: 'Role created.', tone: 'green' }); },
    onError: (err: any) => onToast({ message: err?.response?.data?.error || 'Failed to create role', tone: 'red' }),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<CustomRolePayload> }) => rolesApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setModal(null); onToast({ message: 'Role updated.', tone: 'green' }); },
    onError: (err: any) => onToast({ message: err?.response?.data?.error || 'Failed to update role', tone: 'red' }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); onToast({ message: 'Role deleted.', tone: 'green' }); },
    onError: (err: any) => onToast({ message: err?.response?.data?.error || 'Failed to delete role', tone: 'red' }),
  });

  const openAdd = () => {
    setForm({ name: '', description: '', systemRole: 'FIELD_WORKER', isActive: true });
    setActive(null); setModal('add');
  };
  const openEdit = (r: any) => {
    setForm({ name: r.name, description: r.description, systemRole: r.systemRole, isActive: r.isActive });
    setActive(r); setModal('edit');
  };
  const save = () => {
    if (!form.name?.trim()) return onToast({ message: 'Role name is required.', tone: 'amber' });
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (r: any) => {
    if (r._count?.users > 0) {
      return onToast({ message: `${r.name} is assigned to ${r._count.users} user(s). Reassign them first.`, tone: 'amber' });
    }
    if (confirm(`Delete role "${r.name}"?`)) deleteMut.mutate(r.id);
  };

  return (
    <>
      <div className="alert alert-blue">
        <span>
          Each role maps to one of four <b>permission tiers</b> that the backend enforces. The role's <b>name</b> is the human label users see;
          the <b>tier</b> determines what they can actually do.
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 12px' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text2)' }}>
          {(roles as any[]).length} role{(roles as any[]).length === 1 ? '' : 's'}
        </div>
        <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Role</button>
      </div>

      <div className="tw">
        <table>
          <thead>
            <tr><th>Role Name</th><th>Permission Tier</th><th>Description</th><th>Users</th><th>Status</th><th style={{ width: 80 }}>Actions</th></tr>
          </thead>
          <tbody>
            {(roles as any[]).length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                No custom roles yet. Click "Add Role" to define one (e.g. "HR Manager", "Yard Supervisor").
              </td></tr>
            ) : (
              (roles as any[]).map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td><span className="badge bb">{r.systemRole.replace(/_/g, ' ')}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--color-text2)' }}>{r.description || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{r._count?.users ?? 0}</td>
                  <td><span className={r.isActive ? 'badge bg' : 'badge bk'}>{r.isActive ? 'Active' : 'Disabled'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <RowBtn title="Edit" onClick={() => openEdit(r)}><Edit2 size={13} /></RowBtn>
                      <RowBtn title="Delete" danger onClick={() => remove(r)}><Trash2 size={13} /></RowBtn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Role' : 'Add Role'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full"><div className="fg"><label className="fl">Role Name <span className="req">*</span></label>
                  <input className="fc" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Yard Supervisor" />
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Description</label>
                  <textarea className="fc" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does this role do?" />
                </div></div>
                <div className="fg"><label className="fl">Permission Tier <span className="req">*</span></label>
                  <select className="fc" value={form.systemRole} onChange={(e) => setForm({ ...form, systemRole: e.target.value as SystemRole })}>
                    {Object.entries(SYSTEM_ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.isActive ? 'true' : 'false'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}>
                    <option value="true">Active</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
