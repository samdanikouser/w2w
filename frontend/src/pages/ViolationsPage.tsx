import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { violationsApi, employeesApi, type ViolationPayload } from '../api/endpoints';
import { Plus, AlertTriangle, X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, FilterInput, RowBtn } from './SitesPage';

const SEVERITY_BADGES: Record<string, string> = {
  VERBAL: 'badge ba',
  WRITTEN: 'badge ba',
  FINAL_WRITTEN: 'badge br',
  DISMISSAL: 'badge br',
};
const SEVERITY_LABELS: Record<string, string> = {
  VERBAL: 'Verbal',
  WRITTEN: 'Written',
  FINAL_WRITTEN: 'Final Written',
  DISMISSAL: 'Dismissal',
};
const STATUS_BADGES: Record<string, string> = {
  OPEN: 'badge br',
  ACKNOWLEDGED: 'badge ba',
  CLOSED: 'badge bg',
};

const VIOLATION_TYPES = [
  'Late Arrival', 'Absence (no notice)', 'PPE Non-compliance', 'Procedure Violation',
  'Vehicle Damage', 'Insubordination', 'Misconduct', 'Other',
];

const EMPTY: ViolationPayload = {
  employeeId: '', date: new Date().toISOString().slice(0, 10),
  type: '', severity: 'VERBAL', status: 'OPEN', notes: '',
};

export default function ViolationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<ViolationPayload>(EMPTY);

  const { data: violations = [] } = useQuery({ queryKey: ['violations'], queryFn: () => violationsApi.list() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];

  const createMut = useMutation({
    mutationFn: (p: ViolationPayload) => violationsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['violations'] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<ViolationPayload> }) => violationsApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['violations'] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => violationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violations'] }),
  });

  const filtered = (violations as any[]).filter((v) => {
    if (!search) return true;
    const empName = v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : '';
    return `${empName} ${v.type} ${v.notes}`.toLowerCase().includes(search.toLowerCase());
  });

  const open = (violations as any[]).filter((v) => v.status === 'OPEN').length;
  const final = (violations as any[]).filter((v) => v.severity === 'FINAL_WRITTEN').length;

  const openAdd = () => { setForm({ ...EMPTY, type: VIOLATION_TYPES[0] }); setActive(null); setModal('add'); };
  const openEdit = (v: any) => {
    setForm({
      employeeId: v.employeeId, date: v.date ? v.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: v.type, severity: v.severity, status: v.status, notes: v.notes || '',
    });
    setActive(v); setModal('edit');
  };
  const save = () => {
    if (!form.employeeId || !form.type) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (v: any) => {
    if (confirm('Delete this disciplinary record?')) deleteMut.mutate(v.id);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Warnings & Violations</div>
          <div className="ps">{(violations as any[]).length} disciplinary record{(violations as any[]).length === 1 ? '' : 's'} · {open} open</div>
        </div>
        <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> New Warning</button>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Total Records" value={String((violations as any[]).length)} sub="All-time" icon="📋" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Open Cases" value={String(open)} sub="Awaiting resolution" icon="⚠" rail="sc-red" color="var(--color-red)" />
        <StatCard label="Final Written" value={String(final)} sub="Serious incidents" icon="🚨" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Closed" value={String((violations as any[]).filter((v) => v.status === 'CLOSED').length)} sub="Resolved" icon="✅" rail="sc-green" color="var(--color-green)" />
      </div>

      <div className="card">
        <div className="ch"><div className="ct">Disciplinary Register</div><FilterInput value={search} onChange={setSearch} placeholder="Search…" /></div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Date</th><th>Employee</th><th>Violation</th><th>Severity</th><th>Issued By</th><th>Status</th><th>Notes</th><th style={{ width: 80 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No records yet. Click "New Warning" to record one.
                </td></tr>
              ) : (
                filtered.map((v: any) => (
                  <tr key={v.id}>
                    <td>{v.date ? new Date(v.date).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight: 600 }}>{v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : '—'}</td>
                    <td><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><AlertTriangle size={13} style={{ color: 'var(--color-amber)' }} /> {v.type}</div></td>
                    <td><span className={SEVERITY_BADGES[v.severity] || 'badge bk'}>{SEVERITY_LABELS[v.severity] || v.severity}</span></td>
                    <td>{v.issuedBy?.name || '—'}</td>
                    <td><span className={STATUS_BADGES[v.status] || 'badge bk'}>{v.status}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--color-text2)' }}>{v.notes}</td>
                    <td><div style={{ display: 'flex', gap: 4 }}><RowBtn title="Edit" onClick={() => openEdit(v)}><Edit2 size={13} /></RowBtn><RowBtn title="Delete" danger onClick={() => remove(v)}><Trash2 size={13} /></RowBtn></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Warning' : 'New Warning'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Employee <span className="req">*</span></label>
                  <select className="fc" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    <option value="">— Select employee —</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empNo})</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Date</label>
                  <input className="fc" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="fg"><label className="fl">Violation Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="">— Select —</option>
                    {VIOLATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Severity</label>
                  <select className="fc" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as any })}>
                    {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="OPEN">Open</option>
                    <option value="ACKNOWLEDGED">Acknowledged</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div className="full"><div className="fg"><label className="fl">Notes</label>
                  <textarea className="fc" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Describe the incident…" /></div></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update' : 'Record Warning'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
