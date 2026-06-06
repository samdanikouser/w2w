import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { violationsApi, employeesApi, type ViolationPayload } from '../api/endpoints';
import { Plus, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { usePermissions } from '../hooks/usePermissions';

/* ── Severity mappings ───────────────────────────── */
const SEVERITY_LABELS: Record<string, string> = {
  VERBAL: 'Level 1 – Verbal',
  WRITTEN: 'Level 2 – Written',
  FINAL_WRITTEN: 'Level 3 – Final',
  DISMISSAL: 'Level 4 – Dismissal',
};
const SEVERITY_BADGES: Record<string, string> = {
  VERBAL: 'badge bb',
  WRITTEN: 'badge ba',
  FINAL_WRITTEN: 'badge br',
  DISMISSAL: 'badge bp',
};
const SEVERITY_BORDER: Record<string, string> = {
  VERBAL: 'var(--color-w2w)',
  WRITTEN: 'var(--color-amber)',
  FINAL_WRITTEN: 'var(--color-red)',
  DISMISSAL: 'var(--color-red)',
};
const STATUS_BADGES: Record<string, string> = {
  OPEN: 'badge br',
  ACKNOWLEDGED: 'badge ba',
  CLOSED: 'badge bg',
};
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  CLOSED: 'Resolved',
};

const NEXT_SEVERITY: Record<string, string> = {
  VERBAL: 'WRITTEN',
  WRITTEN: 'FINAL_WRITTEN',
  FINAL_WRITTEN: 'DISMISSAL',
};

const VIOLATION_TYPES = [
  'PPE Non-Compliance',
  'Unauthorized Vehicle Use',
  'Absenteeism / Tardiness',
  'Insubordination',
  'Safety Violation',
  'Misconduct',
  'Fraud',
  'Other',
];

/* ── Helpers ──────────────────────────────────────── */
function empName(e: any): string {
  return `${e.firstName} ${e.lastName}`;
}
function empInitials(e: any): string {
  return `${(e.firstName || '')[0] || ''}${(e.lastName || '')[0] || ''}`.toUpperCase();
}
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

interface ParsedNotes {
  description: string;
  action: string;
  issuedBy: string;
}
function parseNotes(raw: string | undefined): ParsedNotes {
  if (!raw) return { description: '', action: '', issuedBy: '' };
  try {
    const obj = JSON.parse(raw);
    return {
      description: obj.description || '',
      action: obj.action || '',
      issuedBy: obj.issuedBy || '',
    };
  } catch {
    return { description: raw, action: '', issuedBy: '' };
  }
}
function buildNotes(description: string, action: string, issuedBy: string): string {
  return JSON.stringify({ description, action, issuedBy });
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── Form state ──────────────────────────────────── */
interface WarningForm {
  employeeId: string;
  severity: string;
  type: string;
  otherType: string;
  date: string;
  description: string;
  action: string;
  issuedBy: string;
}
const EMPTY_FORM: WarningForm = {
  employeeId: '',
  severity: 'VERBAL',
  type: VIOLATION_TYPES[0],
  otherType: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
  action: '',
  issuedBy: '',
};

/* ════════════════════════════════════════════════════
   ViolationsPage
   ════════════════════════════════════════════════════ */
export default function ViolationsPage() {
  const qc = useQueryClient();
  const { canCreate, canEdit } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'site_admin';

  const [modal, setModal] = useState<'issue' | null>(null);
  const [letterViolation, setLetterViolation] = useState<any>(null);
  const [form, setForm] = useState<WarningForm>({ ...EMPTY_FORM, issuedBy: user?.name || '' });

  /* ── Data ── */
  const { data: violations = [] } = useQuery({ queryKey: ['violations'], queryFn: () => violationsApi.list() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const employees: any[] = empData?.data || [];

  const allViolations = violations as any[];
  const openViolations = allViolations.filter((v) => v.status === 'OPEN');

  /* ── Mutations ── */
  const createMut = useMutation({
    mutationFn: (p: ViolationPayload) => violationsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['violations'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || "Something went wrong."),
  });
  const resolveMut = useMutation({
    mutationFn: (id: string) => violationsApi.update(id, { status: 'CLOSED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violations'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || "Something went wrong."),
  });
  const escalateMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      violationsApi.update(id, { severity: next as ViolationPayload['severity'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violations'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || "Something went wrong."),
  });

  /* ── Handlers ── */
  const openIssue = () => {
    setForm({ ...EMPTY_FORM, issuedBy: user?.name || '' });
    setModal('issue');
  };
  const submitWarning = () => {
    if (!form.employeeId || !form.type) return;
    const finalType = form.type === 'Other' && form.otherType.trim() ? `Other — ${form.otherType.trim()}` : form.type;
    createMut.mutate({
      employeeId: form.employeeId,
      date: form.date,
      type: finalType,
      severity: form.severity as ViolationPayload['severity'],
      status: 'OPEN',
      notes: buildNotes(form.description, form.action, form.issuedBy),
    });
  };
  const handleResolve = (v: any) => resolveMut.mutate(v.id);
  const handleEscalate = (v: any) => {
    const next = NEXT_SEVERITY[v.severity];
    if (next) escalateMut.mutate({ id: v.id, next });
  };

  /* helper to find employee */
  const findEmp = (v: any) => v.employee || employees.find((e) => e.id === v.employeeId);

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Warnings &amp; Violations</div>
          <div className="ps">{allViolations.length} record{allViolations.length === 1 ? '' : 's'} · {openViolations.length} open</div>
        </div>
        {canCreate('violations') && <button className="btn btn-accent" onClick={openIssue}><Plus size={13} /> Issue Warning</button>}
      </div>

      {/* ── Open Violations Cards ── */}
      {openViolations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, marginBottom: 20 }}>
          {openViolations.map((v) => {
            const emp = findEmp(v);
            const notes = parseNotes(v.notes);
            const canEscalate = isAdmin && v.severity !== 'DISMISSAL';
            return (
              <div key={v.id} style={{
                background: 'var(--color-card)', borderRadius: 10,
                border: '1px solid var(--color-border)',
                borderLeft: `4px solid ${SEVERITY_BORDER[v.severity] || 'var(--color-text3)'}`,
                padding: '16px 20px',
              }}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {emp && (
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: avatarColor(emp.id), color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 13,
                      }}>{empInitials(emp)}</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {emp ? empName(emp) : '—'}
                        {emp?.empNo && <span style={{ fontWeight: 400, color: 'var(--color-text3)', marginLeft: 6, fontSize: 11 }}>({emp.empNo})</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text3)' }}>
                        {fmtDate(v.date)}{notes.issuedBy && ` · Issued by ${notes.issuedBy}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className={SEVERITY_BADGES[v.severity] || 'badge bk'}>{SEVERITY_LABELS[v.severity] || v.severity}</span>
                    <span className={STATUS_BADGES[v.status] || 'badge bk'}>{STATUS_LABELS[v.status] || v.status}</span>
                  </div>
                </div>
                {/* Card Body */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{v.type}</div>
                  {notes.description && <div style={{ fontSize: 12, color: 'var(--color-text2)', marginBottom: 6 }}>{notes.description}</div>}
                  {notes.action && (
                    <div style={{
                      background: 'var(--color-surface3)', borderRadius: 6,
                      padding: '8px 12px', fontSize: 12, color: 'var(--color-text2)',
                    }}>
                      <strong>Action Taken:</strong> {notes.action}
                    </div>
                  )}
                </div>
                {/* Card Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setLetterViolation(v)}>View Letter</button>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => handleResolve(v)}
                    disabled={resolveMut.isPending}>Resolve</button>
                  {canEscalate && (
                    <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--color-red)', borderColor: 'var(--color-red-light)' }}
                      onClick={() => handleEscalate(v)} disabled={escalateMut.isPending}>Escalate</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── All Violations History ── */}
      <div className="card">
        <div className="ch"><div className="ct">All Violations History</div></div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Employee</th><th>Type</th><th>Level</th><th>Date</th><th>Status</th><th style={{ width: 80 }}>Actions</th></tr>
            </thead>
            <tbody>
              {allViolations.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No violations recorded yet. Click "Issue Warning" to create one.
                </td></tr>
              ) : (
                allViolations.map((v) => {
                  const emp = findEmp(v);
                  return (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{emp ? empName(emp) : '—'}</td>
                      <td>{v.type}</td>
                      <td><span className={SEVERITY_BADGES[v.severity] || 'badge bk'}>{SEVERITY_LABELS[v.severity] || v.severity}</span></td>
                      <td>{fmtDate(v.date)}</td>
                      <td><span className={STATUS_BADGES[v.status] || 'badge bk'}>{STATUS_LABELS[v.status] || v.status}</span></td>
                      <td>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setLetterViolation(v)}>Letter</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Issue Warning Modal ── */}
      {modal === 'issue' && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Issue Warning</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Employee <span className="req">*</span></label>
                  <select className="fc" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    <option value="">— Select employee —</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{empName(e)} ({e.empNo})</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Warning Level</label>
                  <select className="fc" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                    {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Violation Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, otherType: '' })}>
                    {VIOLATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                {form.type === 'Other' && (
                  <div className="fg"><label className="fl">Specify Other <span className="req">*</span></label>
                    <input className="fc" value={form.otherType} onChange={(e) => setForm({ ...form, otherType: e.target.value })} placeholder="Describe the violation type…" />
                  </div>
                )}
                <div className="fg"><label className="fl">Incident Date</label>
                  <input className="fc" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="full"><div className="fg"><label className="fl">Description</label>
                  <textarea className="fc" rows={3} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Detailed incident description..." />
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Action Taken</label>
                  <textarea className="fc" rows={2} value={form.action}
                    onChange={(e) => setForm({ ...form, action: e.target.value })}
                    placeholder="Corrective action required..." />
                </div></div>
                <div className="fg"><label className="fl">Issued By</label>
                  <input className="fc" value={form.issuedBy}
                    onChange={(e) => setForm({ ...form, issuedBy: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitWarning} disabled={createMut.isPending}>
                {createMut.isPending ? 'Issuing…' : 'Issue Warning'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Warning Letter Modal ── */}
      {letterViolation && (
        <WarningLetterModal
          violation={letterViolation}
          employee={findEmp(letterViolation)}
          onClose={() => setLetterViolation(null)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Warning Letter Modal
   ════════════════════════════════════════════════════ */
function WarningLetterModal({ violation, employee, onClose }: {
  violation: any;
  employee: any;
  onClose: () => void;
}) {
  const v = violation;
  const emp = employee;
  const notes = parseNotes(v.notes);
  const levelLabel = SEVERITY_LABELS[v.severity] || v.severity;

  return (
    <div className="modal-ov open" onClick={onClose}>
      <div className="modal" style={{ width: 780, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <span className="mt">Warning Letter — {v.id?.slice(0, 8) || 'N/A'}</span>
          <button onClick={onClose} className="mc"><X size={15} /></button>
        </div>
        <div className="mb" style={{ padding: 0 }}>
          <div style={{
            border: '1px solid var(--color-border)', background: '#fff', color: '#111',
            padding: '40px 48px', margin: 16, borderRadius: 8, fontFamily: 'Georgia, serif',
            fontSize: 13, lineHeight: 1.7,
          }}>
            {/* Letterhead */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' }}>WASTE TO WORK (W2W)</div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                Johannesburg, Gauteng · South Africa
              </div>
              <div style={{
                margin: '14px auto 0', padding: '6px 20px', display: 'inline-block',
                background: v.severity === 'VERBAL' ? '#e8f0fe' : v.severity === 'WRITTEN' ? '#fff3cd' : '#fde8e8',
                color: v.severity === 'VERBAL' ? '#1a56db' : v.severity === 'WRITTEN' ? '#92400e' : '#c81e1e',
                borderRadius: 6, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-sans, sans-serif)',
              }}>
                {levelLabel.toUpperCase()} WARNING
              </div>
            </div>

            {/* Reference */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#555', marginBottom: 20 }}>
              <span>Ref: {v.id?.slice(0, 8) || 'N/A'}</span>
              <span>Date: {fmtDate(v.date)}</span>
            </div>

            {/* Employee details */}
            <div style={{ marginBottom: 20, fontSize: 12 }}>
              <div><strong>To:</strong> {emp ? empName(emp) : '—'}</div>
              <div><strong>Employee ID:</strong> {emp?.empNo || '—'}</div>
              <div><strong>Designation:</strong> {emp?.role || emp?.department || '—'}</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 20 }}>
              <p>Dear {emp ? emp.firstName : 'Employee'},</p>
              <p>
                This letter serves as a formal <strong>{levelLabel.toLowerCase()}</strong> regarding:
              </p>
              <p><strong>{v.type}</strong></p>
              {notes.description && <p>{notes.description}</p>}
            </div>

            {/* Action Required */}
            {notes.action && (
              <div style={{
                borderLeft: '4px solid var(--color-red, #c81e1e)',
                background: '#fef2f2', padding: '12px 16px', borderRadius: '0 6px 6px 0',
                marginBottom: 20,
              }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#991b1b' }}>Required Action</div>
                <div style={{ fontSize: 12 }}>{notes.action}</div>
              </div>
            )}

            <p style={{ fontStyle: 'italic', color: '#666', fontSize: 12 }}>
              Continued non-compliance may result in escalated disciplinary action up to and including dismissal.
            </p>

            {/* Signatures */}
            <div style={{ display: 'flex', gap: 40, marginTop: 36 }}>
              <div style={{ flex: 1 }}>
                <div style={{ borderBottom: '1px solid #999', height: 40 }} />
                <div style={{ fontSize: 11, marginTop: 4, color: '#555' }}>Issued by: {notes.issuedBy || '—'}</div>
                <div style={{ fontSize: 10, color: '#999' }}>Signature / Date</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ borderBottom: '1px solid #999', height: 40 }} />
                <div style={{ fontSize: 11, marginTop: 4, color: '#555' }}>Employee Acknowledgement</div>
                <div style={{ fontSize: 10, color: '#999' }}>Signature / Date</div>
              </div>
            </div>
          </div>
        </div>
        <div className="mf">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print</button>
        </div>
      </div>
    </div>
  );
}
