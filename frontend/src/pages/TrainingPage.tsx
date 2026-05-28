import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingApi, employeesApi, type TrainingRecordPayload } from '../api/endpoints';
import { X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, RowBtn } from './SitesPage';

function ActionIcon({ children, title, onClick, tone }: any) {
  const c = tone === 'red' ? 'var(--color-red)' : 'var(--color-w2w)';
  return <button title={title} onClick={onClick} style={{ background: 'transparent', border: 'none', color: c, cursor: 'pointer', padding: 4 }}>{children}</button>;
}

/* ── Constants ── */



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

const today = () => new Date().toISOString().slice(0, 10);



type Tab = 'records' | 'modules' | 'matrix';

export default function TrainingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('records');
  const [assignModal, setAssignModal] = useState(false);
  const [assignAllModal, setAssignAllModal] = useState(false);

  // Filters for Records tab
  const [filterEmp, setFilterEmp] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Module lists
  
  const [modModal, setModModal] = useState(false);
  const [modForm, setModForm] = useState({ id: '', name: '', description: '', type: 'MANDATORY', durationHrs: 0 });

  
  const isMandatory = (name: string) => {
    const m = (modules as any[]).find(x => x.name.toLowerCase() === name.toLowerCase());
    return m ? m.type === 'MANDATORY' : false;
  };


  /* ── Data ── */
  const { data: modules = [] } = useQuery({ queryKey: ['training', 'modules'], queryFn: () => trainingApi.listModules() });
  const { data: records = [] } = useQuery({ queryKey: ['training', 'records'], queryFn: () => trainingApi.listRecords() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];
  const activeEmployees = employees.filter((e: any) => (e.status || '').toUpperCase() === 'ACTIVE');

  /* ── Stats ── */
  const allRecords: any[] = records as any[];
  const totalRecords = allRecords.length;
  const completedCount = allRecords.filter((r) => r.status === 'COMPLETED').length;
  const expiredCount = allRecords.filter((r) => r.status === 'EXPIRED').length;
  const inProgressCount = allRecords.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'NOT_STARTED').length;

  /* ── Mutations ── */
  const createModMut = useMutation({
    mutationFn: (p: any) => trainingApi.createModule(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); setModModal(false); }
  });
  const updateModMut = useMutation({
    mutationFn: ({ id, p }: any) => trainingApi.updateModule(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); setModModal(false); }
  });
  const deleteModMut = useMutation({
    mutationFn: (id: string) => trainingApi.deleteModule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); }
  });

  const createRecMut = useMutation({
    mutationFn: (p: TrainingRecordPayload) => trainingApi.createRecord(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'records'] }); },
  });
  const updateRecMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<TrainingRecordPayload> }) => trainingApi.updateRecord(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'records'] }); },
  });

  /* ── Filtered records ── */
  const filteredRecords = allRecords.filter((r) => {
    if (filterEmp) {
      if (r.employeeId !== filterEmp) return false;
    }
    if (filterStatus) {
      if (r.status !== filterStatus) return false;
    }
    return true;
  });

  /* ── Mark as Done ── */
  const markDone = (r: any) => {
    const threeYears = new Date();
    threeYears.setFullYear(threeYears.getFullYear() + 3);
    updateRecMut.mutate({
      id: r.id,
      p: {
        status: 'COMPLETED',
        completedDate: today(),
        expiryDate: threeYears.toISOString().slice(0, 10),
      },
    });
  };

  /* ── Assign Training Modal state ── */
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    moduleName: '',
    type: 'Mandatory',
    assignedDate: today(),
    dueDate: '',
    trainer: '',
  });

  const openAssign = () => {
    setAssignForm({ employeeId: '', moduleName: '', type: 'Mandatory', assignedDate: today(), dueDate: '', trainer: '' });
    setAssignModal(true);
  };

  

  const submitAssign = () => {
    
    if (!assignForm.employeeId || !assignForm.moduleName) return;
    const modId = assignForm.moduleName;

    createRecMut.mutate({
      employeeId: assignForm.employeeId,
      trainingModuleId: modId,
      status: 'NOT_STARTED',
      completedDate: null,
      expiryDate: assignForm.dueDate || null,
      score: null,
    }, { onSuccess: () => setAssignModal(false) });
  };

  /* ── Assign to All Modal state ── */
  const [assignAllForm, setAssignAllForm] = useState({
    moduleName: '',
    assignedDate: today(),
    trainer: '',
  });

  const openAssignAll = () => {
    setAssignAllForm({ moduleName: '', assignedDate: today(), trainer: '' });
    setAssignAllModal(true);
  };

  const submitAssignAll = async () => {
    
    if (!assignAllForm.moduleName) return;
    const modId = assignAllForm.moduleName;

    const promises = activeEmployees.map((emp: any) =>
      createRecMut.mutateAsync({
        employeeId: emp.id,
        trainingModuleId: modId,
        status: 'NOT_STARTED',
        completedDate: null,
        expiryDate: null,
        score: null,
      })
    );
    Promise.all(promises).then(() => {
      qc.invalidateQueries({ queryKey: ['training', 'records'] });
      setAssignAllModal(false);
    });
  };

  /* ── Assign All for specific module (Modules tab) ── */
  
  const assignAllForModule = async (modId: string) => {

    const promises = activeEmployees.map((emp: any) =>
      createRecMut.mutateAsync({
        employeeId: emp.id,
        trainingModuleId: modId,
        status: 'NOT_STARTED',
        completedDate: null,
        expiryDate: null,
        score: null,
      })
    );
    Promise.all(promises).then(() => {
      qc.invalidateQueries({ queryKey: ['training', 'records'] });
    });
  };

  /* ── Helper: get module records ── */
  
  const getModuleRecords = (modId: string) => {
    return allRecords.filter((r) => r.trainingModuleId === modId);
  };


  
  const getCompletedCount = (modId: string) =>
    getModuleRecords(modId).filter((r) => r.status === 'COMPLETED').length;


  /* ── All module names (for select) ── */
  const allModules = (modules as any[]);

  /* ── Tab styles ── */
  const tabStyle = (t: Tab) => ({
    padding: '10px 20px', fontSize: 13, fontWeight: 700 as const, cursor: 'pointer' as const,
    background: 'transparent', border: 'none',
    borderBottom: tab === t ? '3px solid var(--color-w2w)' : '3px solid transparent',
    color: tab === t ? 'var(--color-w2w)' : 'var(--color-text3)',
    transition: 'all 0.2s',
  });

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Training Tracker</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'modules' && <button className="btn btn-primary" onClick={() => { setModForm({ id: '', name: '', description: '', type: 'MANDATORY', durationHrs: 0 }); setModModal(true); }}>+ New Module</button>}

          <button className="btn btn-accent" onClick={openAssign}>+ Assign Training</button>
          <button className="btn btn-ghost" onClick={openAssignAll}>📋 Assign to All</button>
        </div>
      </div>

      {/* ── Overdue Alert ── */}
      {expiredCount > 0 && (
        <div className="alert alert-red" style={{ marginBottom: 16 }}>
          <b>{expiredCount} training record{expiredCount !== 1 ? 's are' : ' is'} overdue or expired.</b>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="stats-grid mt14">
        <StatCard label="Total Records" value={String(totalRecords)} sub="All training records" icon="📋" rail="sc-blue" />
        <StatCard label="Completed" value={String(completedCount)} sub="Successfully completed" icon="✅" rail="sc-green" />
        <StatCard label="Overdue / Expired" value={String(expiredCount)} sub="Requires attention" icon="⚠️" rail="sc-red" />
        <StatCard label="In Progress" value={String(inProgressCount)} sub="Currently active" icon="⏳" rail="sc-amber" />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--color-border)' }}>
        <button onClick={() => setTab('records')} style={tabStyle('records')}>📋 Records</button>
        <button onClick={() => setTab('modules')} style={tabStyle('modules')}>📚 Modules</button>
        <button onClick={() => setTab('matrix')} style={tabStyle('matrix')}>📊 Compliance Matrix</button>
      </div>

      {/* ═══ TAB 1: Records ═══ */}
      {tab === 'records' && (
        <>
          {/* Filter bar */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="cb" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px' }}>
              <select className="fc" style={{ flex: 1, maxWidth: 260 }} value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}>
                <option value="">All Employees</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
              <select className="fc" style={{ flex: 1, maxWidth: 200 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Records table */}
          <div className="card">
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Module</th>
                    <th>Type</th>
                    <th>Assigned</th>
                    <th>Completed</th>
                    <th>Trainer</th>
                    <th>Status</th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                      No training records found.
                    </td></tr>
                  ) : (
                    filteredRecords.map((r: any) => {
                      const empName = r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '—';
                      const initials = r.employee ? `${(r.employee.firstName || '')[0] || ''}${(r.employee.lastName || '')[0] || ''}`.toUpperCase() : '??';
                      const modName = r.trainingModule?.name || '—';
                      const typeBadge = isMandatory(modName)
                        ? <span className="badge br" style={{ fontSize: 9 }}>Mandatory</span>
                        : <span className="badge bb" style={{ fontSize: 9 }}>Optional</span>;
                      return (
                        <tr key={r.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                                background: 'var(--color-w2w-light)', color: 'var(--color-w2w)',
                              }}>{initials}</div>
                              <span style={{ fontWeight: 600 }}>{empName}</span>
                            </div>
                          </td>
                          <td>{modName}</td>
                          <td>{typeBadge}</td>
                          <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                          <td>{r.completedDate ? new Date(r.completedDate).toLocaleDateString() : '—'}</td>
                          <td style={{ fontSize: 11, color: 'var(--color-text3)' }}>—</td>
                          <td><span className={STATUS_BADGES[r.status] || 'badge bk'}>{STATUS_LABELS[r.status] || r.status}</span></td>
                          <td>
                            {r.status !== 'COMPLETED' ? (
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={() => markDone(r)}
                                disabled={updateRecMut.isPending}
                              >✓ Done</button>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--color-green)' }}>✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══ TAB 2: Modules ═══ */}
      {tab === 'modules' && (
        <div className="g2">
          {/* Mandatory */}
          <div className="card">
            <div className="ch">
              <div>
                <div className="ct">Mandatory Modules</div>
                <div className="cs">Required for all active employees</div>
              </div>
            </div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modules.filter((m:any) => m.type === 'MANDATORY').map((mod: any, i: number) => {
                const name = mod.name;
                const completed = getCompletedCount(mod.id);
                const total = activeEmployees.length;
                return (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                      background: 'var(--color-green-light, #e6f9ee)', color: 'var(--color-green)',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{completed}/{total} completed</div>
                    </div>
                    <span className="badge br" style={{ fontSize: 9 }}>Mandatory</span>
                    
<ActionIcon title="Edit" tone="blue" onClick={() => { setModForm({ id: mod.id, name: mod.name, description: mod.description || '', type: mod.type || 'MANDATORY', durationHrs: mod.durationHrs || 0 }); setModModal(true); }}><Edit2 size={13}/></ActionIcon>
<ActionIcon title="Delete" tone="red" onClick={() => deleteModMut.mutate(mod.id)}><Trash2 size={13}/></ActionIcon>
<button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => assignAllForModule(mod.id)}>Assign All</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional */}
          <div className="card">
            <div className="ch">
              <div>
                <div className="ct">Optional Modules</div>
              </div>
            </div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modules.filter((m:any) => m.type === 'OPTIONAL').map((mod: any, i: number) => {
                const name = mod.name;
                const completed = getCompletedCount(mod.id);
                return (
                  <div key={name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 6, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                      background: 'var(--color-surface3)', color: 'var(--color-text3)',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{completed} completed</div>
                    </div>
                    <span className="badge bb" style={{ fontSize: 9 }}>Optional</span>
                    
<ActionIcon title="Edit" tone="blue" onClick={() => { setModForm({ id: mod.id, name: mod.name, description: mod.description || '', type: mod.type || 'MANDATORY', durationHrs: mod.durationHrs || 0 }); setModModal(true); }}><Edit2 size={13}/></ActionIcon>
<ActionIcon title="Delete" tone="red" onClick={() => deleteModMut.mutate(mod.id)}><Trash2 size={13}/></ActionIcon>
<button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => assignAllForModule(mod.id)}>Assign All</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 3: Compliance Matrix ═══ */}
      {tab === 'matrix' && (
        <div className="card">
          <div className="ch">
            <div>
              <div className="ct">Compliance Matrix</div>
              <div className="cs">✓ Completed · ⏳ In Progress · ✗ Not assigned</div>
            </div>
          </div>
          <div className="tw" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 'max-content' }}>
              <thead>
                <tr style={{ background: 'var(--color-ink)', color: 'white' }}>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--color-ink)', zIndex: 2, minWidth: 180 }}>Employee</th>
                  {modules.filter((m:any)=>m.type==='MANDATORY').map((m:any) => (
                    <th key={m.id} style={{ fontSize: 10, whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 6px', maxWidth: 100 }}>{m.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeEmployees.length === 0 ? (
                  <tr><td colSpan={modules.filter((m:any)=>m.type==='MANDATORY').length + 1} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>No active employees found.</td></tr>
                ) : (
                  activeEmployees.map((emp: any) => {
                    const initials = `${(emp.firstName || '')[0] || ''}${(emp.lastName || '')[0] || ''}`.toUpperCase();
                    return (
                      <tr key={emp.id}>
                        <td style={{ position: 'sticky', left: 0, background: 'var(--color-surface)', zIndex: 1, fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                              background: 'var(--color-w2w-light)', color: 'var(--color-w2w)',
                            }}>{initials}</div>
                            <span style={{ fontSize: 12 }}>{emp.firstName} {emp.lastName}</span>
                          </div>
                        </td>
                        {modules.filter((m:any)=>m.type==='MANDATORY').map((mod:any) => {
                          const rec = allRecords.find((r: any) => r.employeeId === emp.id && r.trainingModuleId === mod.id);
                          let cell = <span style={{ color: 'var(--color-text3)' }}>✗</span>;
                          if (rec) {
                            if (rec.status === 'COMPLETED') cell = <span style={{ color: 'var(--color-green)', fontWeight: 700 }}>✓</span>;
                            else cell = <span style={{ color: 'var(--color-amber)', fontWeight: 700 }}>⏳</span>;
                          }
                          return <td key={mod.id} style={{ textAlign: 'center' }}>{cell}</td>;
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Assign Training Modal ═══ */}
      {assignModal && (
        <div className="modal-ov open" onClick={() => setAssignModal(false)}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Assign Training</span>
              <button onClick={() => setAssignModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Employee <span className="req">*</span></label>
                  <select className="fc" value={assignForm.employeeId} onChange={(e) => setAssignForm({ ...assignForm, employeeId: e.target.value })}>
                    <option value="">— Select —</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empNo})</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Training Module <span className="req">*</span></label>
                  <select className="fc" value={assignForm.moduleName} onChange={(e) => setAssignForm({ ...assignForm, moduleName: e.target.value })}>
                    <option value="">— Select —</option>
                    <optgroup label="Mandatory">
                      {modules.filter((m:any) => m.type==='MANDATORY').map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                    <optgroup label="Optional">
                      {modules.filter((m:any) => m.type==='OPTIONAL').map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={assignForm.type} onChange={(e) => setAssignForm({ ...assignForm, type: e.target.value })}>
                    <option>Mandatory</option>
                    <option>Optional</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Assigned Date</label>
                  <input className="fc" type="date" value={assignForm.assignedDate} onChange={(e) => setAssignForm({ ...assignForm, assignedDate: e.target.value })} />
                </div>
                <div className="fg"><label className="fl">Due / Expiry Date</label>
                  <input className="fc" type="date" value={assignForm.dueDate} onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })} />
                </div>
                <div className="fg"><label className="fl">Trainer / Provider</label>
                  <input className="fc" value={assignForm.trainer} onChange={(e) => setAssignForm({ ...assignForm, trainer: e.target.value })} placeholder="Name or company" />
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setAssignModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitAssign} disabled={createRecMut.isPending}>
                {createRecMut.isPending ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Assign to All Modal ═══ */}
      {assignAllModal && (
        <div className="modal-ov open" onClick={() => setAssignAllModal(false)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Assign to All</span>
              <button onClick={() => setAssignAllModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full"><div className="fg"><label className="fl">Training Module <span className="req">*</span></label>
                  <select className="fc" value={assignAllForm.moduleName} onChange={(e) => setAssignAllForm({ ...assignAllForm, moduleName: e.target.value })}>
                    <option value="">— Select —</option>
                    <optgroup label="Mandatory">
                      {modules.filter((m:any) => m.type==='MANDATORY').map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                    <optgroup label="Optional">
                      {modules.filter((m:any) => m.type==='OPTIONAL').map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>
                  </select>
                </div></div>
                <div className="fg"><label className="fl">Assigned Date</label>
                  <input className="fc" type="date" value={assignAllForm.assignedDate} onChange={(e) => setAssignAllForm({ ...assignAllForm, assignedDate: e.target.value })} />
                </div>
                <div className="fg"><label className="fl">Trainer</label>
                  <input className="fc" value={assignAllForm.trainer} onChange={(e) => setAssignAllForm({ ...assignAllForm, trainer: e.target.value })} placeholder="Name or company" />
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setAssignAllModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitAssignAll} disabled={createRecMut.isPending}>
                {createRecMut.isPending ? 'Assigning…' : 'Assign to All'}
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* ═══ Module Modal ═══ */}
      {modModal && (
        <div className="modal-ov open" onClick={() => setModModal(false)}>
          <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modForm.id ? 'Edit Module' : 'New Module'}</span>
              <button onClick={() => setModModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full"><div className="fg"><label className="fl">Module Name <span className="req">*</span></label>
                  <input className="fc" value={modForm.name} onChange={(e) => setModForm({ ...modForm, name: e.target.value })} />
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={modForm.type} onChange={(e) => setModForm({ ...modForm, type: e.target.value })}>
                    <option value="MANDATORY">Mandatory</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Description</label>
                  <textarea className="fc" value={modForm.description} onChange={(e) => setModForm({ ...modForm, description: e.target.value })} />
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Duration (Hours)</label>
                  <input className="fc" type="number" value={modForm.durationHrs} onChange={(e) => setModForm({ ...modForm, durationHrs: Number(e.target.value) })} />
                </div></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={createModMut.isPending || updateModMut.isPending} onClick={() => {
                if (!modForm.name) return;
                if (modForm.id) updateModMut.mutate({ id: modForm.id, p: { name: modForm.name, type: modForm.type, description: modForm.description, durationHrs: modForm.durationHrs } });
                else createModMut.mutate({ name: modForm.name, type: modForm.type, description: modForm.description, durationHrs: modForm.durationHrs });
              }}>
                {modForm.id ? 'Save Changes' : 'Create Module'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
