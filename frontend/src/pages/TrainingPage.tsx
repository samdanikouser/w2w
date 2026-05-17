import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, employeesApi, type TrainingModulePayload, type TrainingRecordPayload } from '../api/endpoints';
import { Plus, BookOpen, Award, X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, FilterInput, RowBtn } from './SitesPage';

const STATUS_BADGES: Record<string, string> = {
  COMPLETED: 'badge bg',
  IN_PROGRESS: 'badge ba',
  NOT_STARTED: 'badge bk',
  EXPIRED: 'badge br',
};
const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
  NOT_STARTED: 'Not Started',
  EXPIRED: 'Expired',
};

const EMPTY_MOD: TrainingModulePayload = { name: '', description: '', durationHrs: 0, isActive: true };
const EMPTY_REC: TrainingRecordPayload = { employeeId: '', trainingModuleId: '', status: 'NOT_STARTED' };

export default function TrainingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modModal, setModModal] = useState<'add' | 'edit' | null>(null);
  const [recModal, setRecModal] = useState<'add' | 'edit' | null>(null);
  const [activeMod, setActiveMod] = useState<any>(null);
  const [activeRec, setActiveRec] = useState<any>(null);
  const [modForm, setModForm] = useState<TrainingModulePayload>(EMPTY_MOD);
  const [recForm, setRecForm] = useState<TrainingRecordPayload>(EMPTY_REC);

  const { data: modules = [] } = useQuery({ queryKey: ['training', 'modules'], queryFn: () => trainingApi.listModules() });
  const { data: records = [] } = useQuery({ queryKey: ['training', 'records'], queryFn: () => trainingApi.listRecords() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];

  const createModMut = useMutation({
    mutationFn: (p: TrainingModulePayload) => trainingApi.createModule(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); setModModal(null); },
  });
  const updateModMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<TrainingModulePayload> }) => trainingApi.updateModule(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); setModModal(null); },
  });
  const deleteModMut = useMutation({
    mutationFn: (id: string) => trainingApi.deleteModule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training', 'modules'] }),
  });
  const createRecMut = useMutation({
    mutationFn: (p: TrainingRecordPayload) => trainingApi.createRecord(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'records'] }); setRecModal(null); },
  });
  const updateRecMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<TrainingRecordPayload> }) => trainingApi.updateRecord(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'records'] }); setRecModal(null); },
  });
  const deleteRecMut = useMutation({
    mutationFn: (id: string) => trainingApi.deleteRecord(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training', 'records'] }),
  });

  const filteredRecords = (records as any[]).filter((r) => {
    if (!search) return true;
    const empName = r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '';
    const modName = r.trainingModule?.name || '';
    return `${empName} ${modName}`.toLowerCase().includes(search.toLowerCase());
  });

  const totalEnrolled = (records as any[]).length;
  const totalCompleted = (records as any[]).filter((r) => r.status === 'COMPLETED').length;
  const totalExpiring = (records as any[]).filter((r) => {
    if (!r.expiryDate) return false;
    const days = (new Date(r.expiryDate).getTime() - Date.now()) / 86400000;
    return days > 0 && days < 60;
  }).length;
  const completionPct = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;

  // Module CRUD handlers
  const openAddMod = () => { setModForm({ ...EMPTY_MOD }); setActiveMod(null); setModModal('add'); };
  const openEditMod = (m: any) => {
    setModForm({ name: m.name, description: m.description, durationHrs: m.durationHrs, isActive: m.isActive });
    setActiveMod(m); setModModal('edit');
  };
  const saveMod = () => {
    if (!modForm.name?.trim()) return;
    if (modModal === 'edit' && activeMod) updateModMut.mutate({ id: activeMod.id, p: modForm });
    else createModMut.mutate(modForm);
  };
  const removeMod = (m: any) => {
    if (confirm(`Delete module "${m.name}"?`)) deleteModMut.mutate(m.id);
  };

  // Record CRUD handlers
  const openAddRec = () => { setRecForm({ ...EMPTY_REC }); setActiveRec(null); setRecModal('add'); };
  const openEditRec = (r: any) => {
    setRecForm({
      employeeId: r.employeeId, trainingModuleId: r.trainingModuleId,
      status: r.status, completedDate: r.completedDate?.slice(0, 10) || null,
      expiryDate: r.expiryDate?.slice(0, 10) || null, score: r.score ?? null,
    });
    setActiveRec(r); setRecModal('edit');
  };
  const saveRec = () => {
    if (!recForm.employeeId || !recForm.trainingModuleId) return;
    if (recModal === 'edit' && activeRec) updateRecMut.mutate({ id: activeRec.id, p: recForm });
    else createRecMut.mutate(recForm);
  };
  const removeRec = (r: any) => {
    if (confirm('Delete this training record?')) deleteRecMut.mutate(r.id);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Training Tracker</div>
          <div className="ps">{(modules as any[]).length} modules · {totalEnrolled} enrolments</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={openAddRec}><Plus size={13} /> Enrol Employee</button>
          <button className="btn btn-accent" onClick={openAddMod}><Plus size={13} /> New Module</button>
        </div>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Active Modules" value={String((modules as any[]).filter((m) => m.isActive).length)} sub="Available courses" icon="📚" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Completion Rate" value={completionPct + '%'} sub={`${totalCompleted} / ${totalEnrolled}`} icon="🎓" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Expiring Soon" value={String(totalExpiring)} sub="Within 60 days" icon="⏰" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Certified Staff" value={String(totalCompleted)} sub="Across modules" icon="🏆" rail="sc-purple" color="var(--color-purple)" />
      </div>

      <div className="g2 mb14">
        <div className="card">
          <div className="ch"><div className="ct">Training Modules</div></div>
          <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(modules as any[]).length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 24, fontSize: 12 }}>
                No modules yet. Click "New Module" to add one.
              </div>
            ) : (
              (modules as any[]).map((m: any) => {
                const modRecords = (records as any[]).filter((r) => r.trainingModuleId === m.id);
                const completed = modRecords.filter((r) => r.status === 'COMPLETED').length;
                const pct = modRecords.length > 0 ? Math.round((completed / modRecords.length) * 100) : 0;
                return (
                  <div key={m.id} style={{ padding: 10, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <BookOpen size={14} style={{ color: 'var(--color-w2w)' }} />
                      <div style={{ flex: 1, fontWeight: 600, fontSize: 12 }}>{m.name}</div>
                      <span className="badge bb">{m.durationHrs}h</span>
                      <RowBtn title="Edit" onClick={() => openEditMod(m)}><Edit2 size={13} /></RowBtn>
                      <RowBtn title="Delete" danger onClick={() => removeMod(m)}><Trash2 size={13} /></RowBtn>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text2)', marginBottom: 6 }}>
                      <span>Enrolled: <b>{modRecords.length}</b></span>
                      <span>Completed: <b style={{ color: 'var(--color-green)' }}>{completed}</b></span>
                    </div>
                    <div className="pb"><div className="pf pf-g" style={{ width: pct + '%' }} /></div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="ch"><div className="ct">Recent Certifications</div></div>
          <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(records as any[]).filter((r) => r.status === 'COMPLETED').slice(0, 8).map((r: any) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--color-surface2)', borderRadius: 8 }}>
                <Award size={18} style={{ color: 'var(--color-amber)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.employee?.firstName} {r.employee?.lastName}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{r.trainingModule?.name}{r.score ? ` · scored ${r.score}%` : ''}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{r.completedDate ? new Date(r.completedDate).toLocaleDateString() : '—'}</div>
              </div>
            ))}
            {(records as any[]).filter((r) => r.status === 'COMPLETED').length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 16, fontSize: 12 }}>
                No certifications yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ch"><div className="ct">Employee Training Records</div><FilterInput value={search} onChange={setSearch} placeholder="Search…" /></div>
        <div className="tw">
          <table>
            <thead><tr><th>Employee</th><th>Module</th><th>Status</th><th>Completed</th><th>Score</th><th>Expires</th><th style={{ width: 80 }}>Actions</th></tr></thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No training records yet. Click "Enrol Employee" to start.
                </td></tr>
              ) : (
                filteredRecords.map((r: any) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</td>
                    <td>{r.trainingModule?.name || '—'}</td>
                    <td><span className={STATUS_BADGES[r.status] || 'badge bk'}>{STATUS_LABELS[r.status]}</span></td>
                    <td>{r.completedDate ? new Date(r.completedDate).toLocaleDateString() : '—'}</td>
                    <td>{r.score != null ? r.score + '%' : '—'}</td>
                    <td>{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '—'}</td>
                    <td><div style={{ display: 'flex', gap: 4 }}><RowBtn title="Edit" onClick={() => openEditRec(r)}><Edit2 size={13} /></RowBtn><RowBtn title="Delete" danger onClick={() => removeRec(r)}><Trash2 size={13} /></RowBtn></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Module modal ── */}
      {modModal && (
        <div className="modal-ov open" onClick={() => setModModal(null)}>
          <div className="modal" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modModal === 'edit' ? 'Edit Module' : 'New Training Module'}</span>
              <button onClick={() => setModModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full"><div className="fg"><label className="fl">Module Name <span className="req">*</span></label>
                  <input className="fc" value={modForm.name} onChange={(e) => setModForm({ ...modForm, name: e.target.value })} placeholder="e.g. Workplace Safety (OSH)" /></div></div>
                <div className="full"><div className="fg"><label className="fl">Description</label>
                  <textarea className="fc" value={modForm.description || ''} onChange={(e) => setModForm({ ...modForm, description: e.target.value })} placeholder="Brief module description…" /></div></div>
                <div className="fg"><label className="fl">Duration (hours)</label>
                  <input className="fc" type="number" value={modForm.durationHrs ?? 0} onChange={(e) => setModForm({ ...modForm, durationHrs: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Active</label>
                  <select className="fc" value={modForm.isActive ? 'true' : 'false'} onChange={(e) => setModForm({ ...modForm, isActive: e.target.value === 'true' })}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMod} disabled={createModMut.isPending || updateModMut.isPending}>
                {(createModMut.isPending || updateModMut.isPending) ? 'Saving…' : modModal === 'edit' ? 'Update' : 'Add Module'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record modal ── */}
      {recModal && (
        <div className="modal-ov open" onClick={() => setRecModal(null)}>
          <div className="modal" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{recModal === 'edit' ? 'Edit Record' : 'Enrol Employee in Module'}</span>
              <button onClick={() => setRecModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Employee <span className="req">*</span></label>
                  <select className="fc" value={recForm.employeeId} onChange={(e) => setRecForm({ ...recForm, employeeId: e.target.value })}>
                    <option value="">— Select —</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empNo})</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Module <span className="req">*</span></label>
                  <select className="fc" value={recForm.trainingModuleId} onChange={(e) => setRecForm({ ...recForm, trainingModuleId: e.target.value })}>
                    <option value="">— Select —</option>
                    {(modules as any[]).map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={recForm.status} onChange={(e) => setRecForm({ ...recForm, status: e.target.value as any })}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Score (%)</label>
                  <input className="fc" type="number" value={recForm.score ?? ''} onChange={(e) => setRecForm({ ...recForm, score: e.target.value ? parseFloat(e.target.value) : null })} /></div>
                <div className="fg"><label className="fl">Completed Date</label>
                  <input className="fc" type="date" value={recForm.completedDate || ''} onChange={(e) => setRecForm({ ...recForm, completedDate: e.target.value || null })} /></div>
                <div className="fg"><label className="fl">Expiry Date</label>
                  <input className="fc" type="date" value={recForm.expiryDate || ''} onChange={(e) => setRecForm({ ...recForm, expiryDate: e.target.value || null })} /></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setRecModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveRec} disabled={createRecMut.isPending || updateRecMut.isPending}>
                {(createRecMut.isPending || updateRecMut.isPending) ? 'Saving…' : recModal === 'edit' ? 'Update' : 'Enrol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
