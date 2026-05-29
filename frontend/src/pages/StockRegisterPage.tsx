import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockItemsApi, sitesApi, employeesApi, type StockItemPayload } from '../api/endpoints';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';

/* ── Local-storage helpers for Tools & Issue Log ── */
const LS_TOOLS = 'w2w_tools';
const LS_MOVEMENTS = 'w2w_stock_movements';

type Tool = {
  id: string; name: string; category: string; serial: string;
  assignedTo: string; assignedSite: string; condition: string;
  issued: string; notes: string;
};
type Movement = {
  id: string; date: string; itemName: string; qty: number;
  toLocation: string; fromLocation: string; issuedBy: string; notes: string;
};

function loadTools(): Tool[] {
  try { return JSON.parse(localStorage.getItem(LS_TOOLS) || '[]'); } catch { return []; }
}
function saveTools(t: Tool[]) { localStorage.setItem(LS_TOOLS, JSON.stringify(t)); }
function loadMovements(): Movement[] {
  try { return JSON.parse(localStorage.getItem(LS_MOVEMENTS) || '[]'); } catch { return []; }
}
function saveMovements(m: Movement[]) { localStorage.setItem(LS_MOVEMENTS, JSON.stringify(m)); }

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_BADGES: Record<string, string> = {
  OK: 'badge bg',
  LOW: 'badge ba',
  OUT: 'badge br',
};

const EMPTY: StockItemPayload & { size?: string; unitCost?: number; supplier?: string; notes?: string } = {
  code: '', item: '', category: 'PPE', uom: 'each', onHand: 0, reorderAt: 0, siteId: null,
  size: '', unitCost: 0, supplier: '', notes: '',
};

type TabKey = 'stock' | 'tools' | 'issued';

export default function StockRegisterPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('stock');
  const [modal, setModal] = useState<'add' | 'edit' | 'issue' | 'issueHeader' | 'restock' | 'addTool' | 'editTool' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [issueForm, setIssueForm] = useState({ itemId: '', qty: 1, employeeId: '', date: today(), notes: '' });
  const [restockForm, setRestockForm] = useState({ qty: 0, supplier: '', date: today(), unitCost: 0, notes: '' });
  const [toolForm, setToolForm] = useState<Partial<Tool>>({});
  const [tools, setTools] = useState<Tool[]>(loadTools());
  const [movements, setMovements] = useState<Movement[]>(loadMovements());

  const { data: items = [] } = useQuery({ queryKey: ['stock-items'], queryFn: () => stockItemsApi.list() });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const employees: any[] = empData?.data || [];
  const allItems: any[] = items as any[];

  const createMut = useMutation({
    mutationFn: (p: StockItemPayload) => stockItemsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-items'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<StockItemPayload> }) => stockItemsApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-items'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => stockItemsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-items'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.'),
  });

  const lowStock = allItems.filter((s) => s.status === 'LOW' || s.status === 'OUT');
  const totalValue = allItems.reduce((s, i) => s + (i.onHand || 0) * ((i as any).unitCost || 0), 0);

  // ── Handlers ──
  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (s: any) => {
    setForm({
      code: s.code, item: s.item, category: s.category, uom: s.uom,
      onHand: s.onHand, reorderAt: s.reorderAt, siteId: s.siteId || null,
      size: (s as any).size || '', unitCost: (s as any).unitCost || 0,
      supplier: (s as any).supplier || '', notes: (s as any).notes || '',
    });
    setActive(s); setModal('edit');
  };
  const openIssue = (s: any) => { setActive(s); setIssueForm({ itemId: s.id, qty: 1, employeeId: '', date: today(), notes: '' }); setModal('issue'); };
  const openIssueHeader = () => { setActive(null); setIssueForm({ itemId: '', qty: 1, employeeId: '', date: today(), notes: '' }); setModal('issueHeader'); };
  const openRestock = (s: any) => {
    setActive(s);
    setRestockForm({ qty: 0, supplier: (s as any).supplier || '', date: today(), unitCost: (s as any).unitCost || 0, notes: '' });
    setModal('restock');
  };
  const openAddTool = () => {
    setToolForm({ name: '', category: 'Tool/Equipment', serial: '', assignedTo: '', assignedSite: '', condition: 'Good', notes: '' });
    setActive(null); setModal('addTool');
  };
  const openEditTool = (t: Tool) => {
    setToolForm({ ...t });
    setActive(t); setModal('editTool');
  };

  const save = () => {
    if (!form.code?.trim() || !form.item?.trim()) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (s: any) => {
    if (confirm(`Delete stock item "${s.item}"?`)) deleteMut.mutate(s.id);
  };

  const submitIssue = () => {
    // Resolve the target item from active (row-level) or issueForm.itemId (header-level)
    const target = active || allItems.find((i: any) => i.id === issueForm.itemId);
    if (!target || issueForm.qty <= 0) return;
    if (issueForm.qty > target.onHand) { alert('Insufficient stock. Available: ' + target.onHand); return; }
    const emp = employees.find((e: any) => e.id === issueForm.employeeId);
    const mv: Movement = {
      id: `MV-${Date.now().toString(36)}`,
      date: issueForm.date || today(),
      itemName: target.item,
      qty: issueForm.qty,
      toLocation: emp ? `${emp.firstName} ${emp.lastName}` : 'General Issue',
      fromLocation: 'Stock',
      issuedBy: 'Current User',
      notes: issueForm.notes,
    };
    const updated = [...movements, mv];
    setMovements(updated);
    saveMovements(updated);
    // Reduce on hand
    updateMut.mutate({ id: target.id, p: { onHand: Math.max(0, target.onHand - issueForm.qty) } });
    setModal(null);
  };

  const submitRestock = () => {
    if (!active || restockForm.qty <= 0) { alert('Enter a quantity greater than 0'); return; }
    // Log restock movement
    const mv: Movement = {
      id: `MV-${Date.now().toString(36)}`,
      date: restockForm.date || today(),
      itemName: active.item,
      qty: restockForm.qty,
      toLocation: 'Stock',
      fromLocation: restockForm.supplier || 'Supplier',
      issuedBy: 'Current User',
      notes: restockForm.notes,
    };
    const updatedMv = [...movements, mv];
    setMovements(updatedMv);
    saveMovements(updatedMv);
    // Update stock qty (and unit cost if changed)
    const payload: Partial<StockItemPayload> = { onHand: active.onHand + restockForm.qty };
    updateMut.mutate({ id: active.id, p: payload });
    setModal(null);
  };

  const submitTool = () => {
    if (!toolForm.name?.trim()) return;
    if (modal === 'editTool' && active) {
      // Update existing tool
      const updated = tools.map((t) => t.id === active.id ? { ...t, ...toolForm } as Tool : t);
      setTools(updated);
      saveTools(updated);
    } else {
      // Create new tool
      const t: Tool = {
        id: `TL-${Date.now().toString(36)}`,
        name: toolForm.name || '',
        category: toolForm.category || 'Tool/Equipment',
        serial: toolForm.serial || '',
        assignedTo: toolForm.assignedTo || '',
        assignedSite: toolForm.assignedSite || '',
        condition: toolForm.condition || 'Good',
        issued: today(),
        notes: toolForm.notes || '',
      };
      const updated = [...tools, t];
      setTools(updated);
      saveTools(updated);
    }
    setModal(null);
  };

  const removeTool = (id: string) => {
    const updated = tools.filter((t) => t.id !== id);
    setTools(updated);
    saveTools(updated);
  };

  const empName = (id: string) => {
    const e = employees.find((e: any) => e.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id || '—';
  };
  const siteName = (id: string) => sites.find((s: any) => s.id === id)?.name || id || '—';

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Stock Register</div>
          <div className="ps">{allItems.length} PPE / uniform items · {tools.length} tools registered</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={openIssueHeader}>📤 Issue Stock</button>
          <button className="btn btn-ghost" onClick={openAdd}><Plus size={13} /> Add Item</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('stock-register', allItems, [
            { key: 'item', label: 'Item' },
            { key: 'code', label: 'SKU' },
            { key: 'category', label: 'Category' },
            { key: 'onHand', label: 'In Stock' },
            { key: 'reorderAt', label: 'Reorder At' },
            { key: 'status', label: 'Status' },
          ])}>📥 Export</button>
        </div>
      </div>

      {/* ── Low Stock Alert ── */}
      {lowStock.length > 0 && (
        <div className="alert alert-red" style={{ marginBottom: 14 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14, flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          <span>
            <b>{lowStock.length} item{lowStock.length > 1 ? 's' : ''} at or below reorder level:</b>{' '}
            {lowStock.map((i: any) => `${i.item} (${i.onHand} left)`).join(', ')}
          </span>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        <StatCard label="PPE & Uniforms" value={String(allItems.length)} sub="Stock-keeping units" icon="🧰" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard
          label="Total Stock Value"
          value={'R ' + Math.round(totalValue).toLocaleString('en-ZA')}
          sub="On-hand × unit cost"
          icon="💰"
          rail="sc-green"
          color="var(--color-green)"
        />
        <StatCard label="Low Stock" value={String(lowStock.length)} sub="At or below reorder" icon="⚠️" rail="sc-red" color="var(--color-red)" />
        <StatCard label="Tools Registered" value={String(tools.length)} sub="Equipment tracked" icon="🔧" rail="sc-amber" color="var(--color-amber)" />
      </div>

      {/* ── Tabs ── */}
      <div className="tabs mb14">
        {([
          { key: 'stock' as TabKey, label: `🧰 PPE & Uniforms (${allItems.length})` },
          { key: 'tools' as TabKey, label: `🔧 Tools & Equipment (${tools.length})` },
          { key: 'issued' as TabKey, label: `📋 Issue Log (${movements.length})` },
        ]).map((t) => (
          <div
            key={t.key}
            className={`tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
            style={{ cursor: 'pointer' }}
          >
            {t.label}
          </div>
        ))}
      </div>

      {/* ══ TAB 1: PPE & Uniforms ══ */}
      {tab === 'stock' && (
        <div className="card">
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>In Stock</th>
                  <th>Issued</th>
                  <th>Reorder At</th>
                  <th>Unit Cost</th>
                  <th>Last Restocked</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allItems.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                    No stock items yet. Click "Add Item" to register inventory.
                  </td></tr>
                ) : (
                  allItems.map((s: any) => {
                    const isLow = s.status === 'LOW' || s.status === 'OUT';
                    const issued = movements.filter((m) => m.itemName === s.item).reduce((sum, m) => sum + m.qty, 0);
                    return (
                      <tr key={s.id} style={isLow ? { background: 'rgba(220,38,38,0.04)' } : undefined}>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{s.item}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text3)' }}>{s.code || '—'}</td>
                        <td>
                          <span className={`badge ${s.category === 'PPE' ? 'br' : 'bb'}`} style={{ fontSize: 9 }}>
                            {s.category}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>{(s as any).size || '—'}</td>
                        <td style={{ fontWeight: 700, color: isLow ? 'var(--color-red)' : 'var(--color-green)' }}>
                          {s.onHand}
                        </td>
                        <td style={{ fontSize: 11 }}>{issued}</td>
                        <td style={{ fontSize: 11, color: isLow ? 'var(--color-red)' : 'var(--color-text3)' }}>
                          {s.reorderAt}
                        </td>
                        <td style={{ fontSize: 11 }}>R{(s as any).unitCost || 0}</td>
                        <td style={{ fontSize: 10, color: 'var(--color-text3)' }}>
                          {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {isLow ? (
                            <span className="badge br" style={{ fontSize: 9 }}>⚠ Low</span>
                          ) : (
                            <span className="badge bg" style={{ fontSize: 9 }}>OK</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => openIssue(s)}>Issue</button>
                            <RowBtn title="Edit" onClick={() => openEdit(s)}><Edit2 size={13} /></RowBtn>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => openRestock(s)}>Restock</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ TAB 2: Tools & Equipment ══ */}
      {tab === 'tools' && (
        <div className="card">
          <div className="ch">
            <div className="ct">Tools & Equipment Register</div>
            <button className="btn btn-accent btn-sm" onClick={openAddTool}><Plus size={12} /> Add Tool</button>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Serial No.</th>
                  <th>Assigned To</th>
                  <th>Site</th>
                  <th>Condition</th>
                  <th>Issue Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                    No tools registered yet. Click "Add Tool" to register equipment.
                  </td></tr>
                ) : (
                  tools.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{t.name}</td>
                      <td style={{ fontSize: 11 }}>{t.category}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text3)' }}>{t.serial || '—'}</td>
                      <td style={{ fontSize: 11 }}>
                        {t.assignedTo ? empName(t.assignedTo) : <span style={{ color: 'var(--color-text3)' }}>Unassigned</span>}
                      </td>
                      <td style={{ fontSize: 11 }}>{t.assignedSite ? siteName(t.assignedSite) : '—'}</td>
                      <td>
                        <span className={`badge ${t.condition === 'Good' ? 'bg' : t.condition === 'Fair' ? 'ba' : 'br'}`} style={{ fontSize: 9 }}>
                          {t.condition || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: 10, color: 'var(--color-text3)' }}>{t.issued || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <RowBtn title="Edit" onClick={() => openEditTool(t)}><Edit2 size={13} /></RowBtn>
                          <RowBtn title="Delete" danger onClick={() => { if (confirm(`Delete "${t.name}"?`)) removeTool(t.id); }}>
                            <Trash2 size={13} />
                          </RowBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ TAB 3: Issue Log ══ */}
      {tab === 'issued' && (
        <div className="card">
          <div className="ch">
            <div className="ct">Stock Issue Log</div>
            <div className="cs">All items issued to employees or sites</div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Issued To</th>
                  <th>Location</th>
                  <th>Issued By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--color-text3)' }}>
                    No items issued yet
                  </td></tr>
                ) : (
                  [...movements].reverse().map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 11 }}>{m.date}</td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{m.itemName}</td>
                      <td style={{ fontWeight: 700 }}>{m.qty}</td>
                      <td style={{ fontSize: 11 }}>{m.toLocation || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--color-text3)' }}>{m.fromLocation || '—'}</td>
                      <td style={{ fontSize: 11 }}>{m.issuedBy || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--color-text3)' }}>{m.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* Add / Edit Item */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Stock Item' : 'Add Stock Item'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Item Name <span className="req">*</span></label>
                  <input className="fc" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. Reflective Overall" /></div>
                <div className="fg"><label className="fl">Category</label>
                  <select className="fc" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="PPE">PPE</option>
                    <option value="Uniform">Uniform</option>
                    <option value="Consumable">Consumable</option>
                    <option value="Equipment">Equipment</option>
                  </select></div>
                <div className="fg"><label className="fl">SKU / Code</label>
                  <input className="fc" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. PPE-VEST-M" /></div>
                <div className="fg"><label className="fl">Size</label>
                  <input className="fc" value={form.size || ''} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="S / M / L / XL or N/A" /></div>
                <div className="fg"><label className="fl">Qty in Stock</label>
                  <input className="fc" type="number" value={form.onHand ?? 0} min={0}
                    onChange={(e) => setForm({ ...form, onHand: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Reorder Level</label>
                  <input className="fc" type="number" value={form.reorderAt ?? 5} min={0}
                    onChange={(e) => setForm({ ...form, reorderAt: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Unit Cost (R)</label>
                  <input className="fc" type="number" value={form.unitCost ?? 0} min={0}
                    onChange={(e) => setForm({ ...form, unitCost: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Supplier</label>
                  <input className="fc" value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" /></div>
                <div className="full"><div className="fg"><label className="fl">Notes</label>
                  <input className="fc" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" /></div></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Modal (row-level) */}
      {modal === 'issue' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Issue — {active.item}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="alert alert-blue" style={{ marginBottom: 12 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
                </svg>
                <span>Available: <b>{active.onHand}</b> units in stock.</span>
              </div>
              <div className="fgrid">
                <div className="fg"><label className="fl">Qty to Issue <span className="req">*</span></label>
                  <input className="fc" type="number" value={issueForm.qty} min={1} max={active.onHand} placeholder="e.g. 5"
                    onChange={(e) => setIssueForm({ ...issueForm, qty: parseInt(e.target.value) || 1 })} /></div>
                <div className="fg"><label className="fl">Issue to Employee</label>
                  <select className="fc" value={issueForm.employeeId} onChange={(e) => setIssueForm({ ...issueForm, employeeId: e.target.value })}>
                    <option value="">— Site / General issue —</option>
                    {employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.role || e.department || ''}</option>
                    ))}
                  </select></div>
                <div className="fg"><label className="fl">Issue Date</label>
                  <input className="fc" type="date" value={issueForm.date}
                    onChange={(e) => setIssueForm({ ...issueForm, date: e.target.value })} /></div>
                <div className="fg" />
                <div className="full"><div className="fg"><label className="fl">Notes</label>
                  <input className="fc" value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} placeholder="Purpose or reference" /></div></div>
              </div>
              {issueForm.qty > 0 && (
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text3)' }}>
                  After issue: <b>{active.onHand}</b> − <b>{issueForm.qty}</b> = <b>{Math.max(0, active.onHand - issueForm.qty)}</b> units
                </div>
              )}
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitIssue} disabled={updateMut.isPending || issueForm.qty <= 0}>
                {updateMut.isPending ? 'Issuing…' : 'Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Stock (header-level with item selector) */}
      {modal === 'issueHeader' && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Issue Stock</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Item <span className="req">*</span></label>
                  <select className="fc" value={issueForm.itemId} onChange={(e) => setIssueForm({ ...issueForm, itemId: e.target.value })}>
                    <option value="">Select item</option>
                    {allItems.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.item}{(i as any).size ? ` (${(i as any).size})` : ''} — {i.onHand} in stock
                      </option>
                    ))}
                  </select>
                  {issueForm.itemId && (() => {
                    const sel = allItems.find((i: any) => i.id === issueForm.itemId);
                    return sel ? <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 3 }}>Available: {sel.onHand} units</div> : null;
                  })()}
                </div>
                <div className="fg"><label className="fl">Qty to Issue <span className="req">*</span></label>
                  <input className="fc" type="number" value={issueForm.qty} min={1}
                    onChange={(e) => setIssueForm({ ...issueForm, qty: parseInt(e.target.value) || 1 })} /></div>
                <div className="fg"><label className="fl">Issue to Employee</label>
                  <select className="fc" value={issueForm.employeeId} onChange={(e) => setIssueForm({ ...issueForm, employeeId: e.target.value })}>
                    <option value="">— Site / General issue —</option>
                    {employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.role || e.department || ''}</option>
                    ))}
                  </select></div>
                <div className="fg"><label className="fl">Issue Date</label>
                  <input className="fc" type="date" value={issueForm.date}
                    onChange={(e) => setIssueForm({ ...issueForm, date: e.target.value })} /></div>
                <div className="full"><div className="fg"><label className="fl">Notes</label>
                  <input className="fc" value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })} placeholder="Purpose or reference" /></div></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitIssue} disabled={updateMut.isPending || !issueForm.itemId || issueForm.qty <= 0}>
                {updateMut.isPending ? 'Issuing…' : 'Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {modal === 'restock' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Restock — {active.item}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="alert alert-blue" style={{ marginBottom: 12 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 13, height: 13, flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
                </svg>
                <span>Current stock: <b>{active.onHand}</b> units. Enter the quantity received to add to stock.</span>
              </div>
              <div className="fgrid">
                <div className="fg"><label className="fl">Qty Received <span className="req">*</span></label>
                  <input className="fc" type="number" value={restockForm.qty || ''} min={1} placeholder="e.g. 20"
                    onChange={(e) => setRestockForm({ ...restockForm, qty: parseInt(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Supplier</label>
                  <input className="fc" value={restockForm.supplier} placeholder="Supplier name"
                    onChange={(e) => setRestockForm({ ...restockForm, supplier: e.target.value })} /></div>
                <div className="fg"><label className="fl">Delivery Date</label>
                  <input className="fc" type="date" value={restockForm.date}
                    onChange={(e) => setRestockForm({ ...restockForm, date: e.target.value })} /></div>
                <div className="fg"><label className="fl">Unit Cost (R)</label>
                  <input className="fc" type="number" value={restockForm.unitCost} min={0}
                    onChange={(e) => setRestockForm({ ...restockForm, unitCost: parseFloat(e.target.value) || 0 })} /></div>
                <div className="full"><div className="fg"><label className="fl">Notes / Reference</label>
                  <input className="fc" value={restockForm.notes} placeholder="e.g. delivery note ref, invoice number"
                    onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })} /></div></div>
              </div>
              {restockForm.qty > 0 && (
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text3)' }}>
                  After restock: <b>{active.onHand}</b> + <b>{restockForm.qty}</b> = <b>{active.onHand + restockForm.qty}</b> units
                </div>
              )}
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitRestock} disabled={updateMut.isPending || restockForm.qty <= 0}>
                {updateMut.isPending ? 'Adding…' : 'Add to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Tool Modal */}
      {(modal === 'addTool' || modal === 'editTool') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'editTool' ? `Edit — ${toolForm.name || ''}` : 'Register Tool / Equipment'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Item Name <span className="req">*</span></label>
                  <input className="fc" value={toolForm.name || ''} onChange={(e) => setToolForm({ ...toolForm, name: e.target.value })} placeholder="e.g. Grabber Tool" /></div>
                <div className="fg"><label className="fl">Category</label>
                  <select className="fc" value={toolForm.category || 'Tool/Equipment'} onChange={(e) => setToolForm({ ...toolForm, category: e.target.value })}>
                    <option value="Tool/Equipment">Tool / Equipment</option>
                    <option value="Hand Tool">Hand Tool</option>
                    <option value="Power Tool">Power Tool</option>
                    <option value="Safety Equipment">Safety Equipment</option>
                  </select></div>
                <div className="fg"><label className="fl">Serial No.</label>
                  <input className="fc" value={toolForm.serial || ''} onChange={(e) => setToolForm({ ...toolForm, serial: e.target.value })} placeholder="SN-XXX" /></div>
                <div className="fg"><label className="fl">Condition</label>
                  <select className="fc" value={toolForm.condition || 'Good'} onChange={(e) => setToolForm({ ...toolForm, condition: e.target.value })}>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select></div>
                <div className="fg"><label className="fl">Assign To (Employee)</label>
                  <select className="fc" value={toolForm.assignedTo || ''} onChange={(e) => setToolForm({ ...toolForm, assignedTo: e.target.value })}>
                    <option value="">Unassigned</option>
                    {employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                    ))}
                  </select></div>
                <div className="fg"><label className="fl">Site</label>
                  <select className="fc" value={toolForm.assignedSite || ''} onChange={(e) => setToolForm({ ...toolForm, assignedSite: e.target.value })}>
                    <option value="">— None —</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div className="full"><div className="fg"><label className="fl">Notes</label>
                  <input className="fc" value={toolForm.notes || ''} onChange={(e) => setToolForm({ ...toolForm, notes: e.target.value })} placeholder="Optional" /></div></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitTool}>{modal === 'editTool' ? 'Save' : 'Add Tool'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
