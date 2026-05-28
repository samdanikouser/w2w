import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, sitesApi, type TransactionPayload } from '../api/endpoints';
import { Plus, Download, TrendingUp, TrendingDown, X, Edit2, Trash2, Lock, Unlock } from 'lucide-react';
import { StatCard, FilterInput, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';
import {
  loadPLTypes, loadPLCategories, loadPLCostCentres,
  loadLockedMonths, saveLockedMonths,
  getTypeGroups, isMonthLocked,
  type PLType,
} from '../utils/plSettings';

const EMPTY: TransactionPayload = {
  date: new Date().toISOString().slice(0, 10),
  type: 'REVENUE', category: '', description: '', amount: 0, siteId: null, reference: '',
};

export default function PLRegisterPage() {
  const qc = useQueryClient();

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // ── Modals ──
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [lockModal, setLockModal] = useState(false);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<TransactionPayload>(EMPTY);

  // ── Lock state ──
  const [lockedMonths, setLockedMonths] = useState<string[]>(loadLockedMonths);
  const [lockMonth, setLockMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // ── Settings-driven data ──
  const plTypes = useMemo(() => loadPLTypes(), []);
  const plCategories = useMemo(() => loadPLCategories(), []);
  const plCostCentres = useMemo(() => loadPLCostCentres(), []);
  const typeGroups = useMemo(() => getTypeGroups(plTypes), [plTypes]);

  // ── API queries ──
  const { data } = useQuery({
    queryKey: ['transactions', typeFilter],
    queryFn: () => transactionsApi.list(typeFilter !== 'all' ? { type: typeFilter } : {}),
  });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });

  const tx: any[] = data?.data || [];
  const summary = data?.summary || { totalRevenue: 0, totalExpense: 0, net: 0 };
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: (p: TransactionPayload) => transactionsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<TransactionPayload> }) => transactionsApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });

  // ── Filtering ──
  const filtered = useMemo(() => {
    return tx.filter((t) => {
      if (search && !`${t.category} ${t.description} ${t.reference || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (monthFilter !== 'all' && t.date && !t.date.startsWith(monthFilter)) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      return true;
    });
  }, [tx, search, monthFilter, categoryFilter]);

  // ── Unique months + categories for filter dropdowns ──
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    tx.forEach((t) => { if (t.date) months.add(t.date.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [tx]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    tx.forEach((t) => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [tx]);

  // ── Monthly P&L Summary ──
  const monthlySummary = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();
    tx.forEach((t) => {
      if (!t.date) return;
      const m = t.date.slice(0, 7);
      if (!map.has(m)) map.set(m, { revenue: 0, expenses: 0 });
      const entry = map.get(m)!;
      if (t.type === 'REVENUE') entry.revenue += Math.abs(t.amount);
      else entry.expenses += Math.abs(t.amount);
    });
    return Array.from(map.entries())
      .map(([month, d]) => ({
        month,
        revenue: d.revenue,
        expenses: d.expenses,
        net: d.revenue - d.expenses,
        margin: d.revenue > 0 ? Math.round(((d.revenue - d.expenses) / d.revenue) * 100) : 0,
        locked: lockedMonths.includes(month),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [tx, lockedMonths]);

  // ── Derived values ──
  const margin = summary.totalRevenue > 0 ? Math.round((summary.net / summary.totalRevenue) * 100) : 0;
  const fmt = (n: number) => 'R ' + Math.round(Math.abs(n)).toLocaleString('en-ZA');
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(mo, 10) - 1]} ${y}`;
  };

  // ── Handlers ──
  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (t: any) => {
    const entryMonth = t.date ? t.date.slice(0, 7) : '';
    if (isMonthLocked(t.date, lockedMonths)) {
      alert(`🔒 ${fmtMonth(entryMonth)} is locked. Editing is not allowed. Unlock requires IT Admin.`);
      return;
    }
    setForm({
      date: t.date ? t.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: t.type, category: t.category, description: t.description,
      amount: Math.abs(t.amount), siteId: t.siteId || null, reference: t.reference || '',
    });
    setActive(t); setModal('edit');
  };
  const save = () => {
    if (!form.amount || Math.abs(form.amount) <= 0) return;
    // Check locked month for new entries
    if (modal === 'add' && isMonthLocked(form.date, lockedMonths)) {
      alert(`🔒 ${fmtMonth(form.date.slice(0, 7))} is locked. New entries for locked months are blocked.\nLocking a month freezes all revenue at current prices. Later price changes will not affect locked months. Unlock requires IT Admin.`);
      return;
    }
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (t: any) => {
    if (isMonthLocked(t.date, lockedMonths)) {
      alert(`🔒 This entry is in a locked month. Deletion is not allowed. Unlock requires IT Admin.`);
      return;
    }
    if (confirm(`Delete transaction "${t.description || t.category}"?`)) deleteMut.mutate(t.id);
  };

  // ── Lock month handler ──
  const handleLockMonth = () => {
    if (lockedMonths.includes(lockMonth)) {
      alert(`${fmtMonth(lockMonth)} is already locked.`);
      return;
    }
    const updated = [...lockedMonths, lockMonth];
    setLockedMonths(updated);
    saveLockedMonths(updated);
    setLockModal(false);
  };

  const isEntryLocked = (t: any) => t.date && isMonthLocked(t.date, lockedMonths);

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="ph">
        <div>
          <div className="pt">P&L Entry Register</div>
          <div className="ps">{tx.length} transactions · period to date</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Entry</button>
          <button className="btn btn-ghost" onClick={() => setLockModal(true)}><Lock size={13} /> Lock Month</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('pl-register', filtered, [
            { key: 'date', label: 'Date', map: (r: any) => r.date ? new Date(r.date).toISOString().slice(0, 10) : '' },
            { key: 'type', label: 'Type' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount (R)' },
            { key: 'description', label: 'Source / Cost Centre' },
            { key: 'reference', label: 'Notes' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid mt14">
        <StatCard label="Total Revenue" value={fmt(summary.totalRevenue)} sub={`${tx.filter((t) => t.type === 'REVENUE').length} entries`} icon="💰" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Total Expenditure" value={fmt(summary.totalExpense)} sub={`${tx.filter((t) => t.type === 'EXPENSE').length} entries`} icon="💸" rail="sc-red" color="var(--color-red)" />
        <StatCard label="Net Position" value={fmt(summary.net)} sub={summary.net >= 0 ? 'Surplus' : 'Deficit'} icon={summary.net >= 0 ? '📈' : '📉'} rail={summary.net >= 0 ? 'sc-green' : 'sc-red'} color={summary.net >= 0 ? 'var(--color-green)' : 'var(--color-red)'} />
        <StatCard label="Margin %" value={margin + '%'} sub="Net / Revenue" icon="📊" rail="sc-blue" color="var(--color-w2w)" />
      </div>

      {/* ── Income & Expenditure Statements ── */}
      <div className="g2" style={{ marginBottom: 20 }}>
        {/* Income Statement */}
        <div className="card">
          <div className="ch"><div className="ct">Income Statement</div><div className="cs">Revenue by category</div></div>
          <div className="tw"><table><thead><tr><th>Income Category</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {(() => {
              const revByCat: Record<string, number> = {};
              tx.filter(t => t.type === 'REVENUE').forEach(t => { revByCat[t.category] = (revByCat[t.category] || 0) + Math.abs(t.amount); });
              const entries = Object.entries(revByCat);
              if (!entries.length) return <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 12 }}>No income entries</td></tr>;
              return (<>
                {entries.map(([cat, amt]) => (
                  <tr key={cat}>
                    <td style={{ fontSize: 12 }}>{cat}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-green)', textAlign: 'right' }}>R {Math.round(amt).toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--color-surface3)', fontWeight: 700 }}>
                  <td>TOTAL INCOME</td>
                  <td style={{ color: 'var(--color-green)', textAlign: 'right' }}>R {Math.round(summary.totalRevenue).toLocaleString()}</td>
                </tr>
              </>);
            })()}
          </tbody></table></div>
        </div>

        {/* Expenditure Statement */}
        <div className="card">
          <div className="ch"><div className="ct">Expenditure Statement</div><div className="cs">Expenses by category</div></div>
          <div className="tw"><table><thead><tr><th>Expense Category</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
          <tbody>
            {(() => {
              const expByCat: Record<string, number> = {};
              tx.filter(t => t.type === 'EXPENSE').forEach(t => { expByCat[t.category] = (expByCat[t.category] || 0) + Math.abs(t.amount); });
              const entries = Object.entries(expByCat);
              if (!entries.length) return <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 12 }}>No expense entries</td></tr>;
              return (<>
                {entries.map(([cat, amt]) => (
                  <tr key={cat}>
                    <td style={{ fontSize: 12 }}>{cat}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-red)', textAlign: 'right' }}>R {Math.round(amt).toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--color-surface3)', fontWeight: 700 }}>
                  <td>TOTAL EXPENDITURE</td>
                  <td style={{ color: 'var(--color-red)', textAlign: 'right' }}>R {Math.round(summary.totalExpense).toLocaleString()}</td>
                </tr>
                <tr style={{ background: 'var(--color-w2w-light)', fontWeight: 700 }}>
                  <td>{summary.net >= 0 ? 'NET SURPLUS' : 'NET DEFICIT'}</td>
                  <td style={{ color: summary.net >= 0 ? 'var(--color-green)' : 'var(--color-red)', textAlign: 'right', fontSize: 14 }}>R {Math.round(Math.abs(summary.net)).toLocaleString()}</td>
                </tr>
              </>);
            })()}
          </tbody></table></div>
        </div>
      </div>

      {/* ── P&L Statement ── */}
      <div className="card">
        <div className="ch">
          <div className="ct">P&L Statement</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <FilterInput value={search} onChange={setSearch} placeholder="Search…" />
            <select className="fc" style={{ width: 140 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
            </select>
            <select className="fc" style={{ width: 150 }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="all">All months</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{fmtMonth(m)}{lockedMonths.includes(m) ? ' 🔒' : ''}</option>
              ))}
            </select>
            <select className="fc" style={{ width: 180 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th>Source / Cost Centre</th><th>Notes</th><th style={{ width: 80 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No transactions yet. Click "Add Entry" to record one.
                </td></tr>
              ) : (
                filtered.map((t: any) => {
                  const locked = isEntryLocked(t);
                  return (
                    <tr key={t.id} style={locked ? { opacity: 0.75 } : undefined}>
                      <td>{t.date ? new Date(t.date).toLocaleDateString() : '—'}</td>
                      <td>
                        <span className={t.type === 'REVENUE' ? 'badge bg' : 'badge br'}>
                          {t.type === 'REVENUE' ? <><TrendingUp size={11} /> Revenue</> : <><TrendingDown size={11} /> Expense</>}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.category}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'REVENUE' ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {t.type === 'REVENUE' ? '+' : '−'} {fmt(t.amount)}
                      </td>
                      <td style={{ fontSize: 11 }}>{t.description || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.reference || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {locked ? (
                            <>
                              <RowBtn title="Locked — cannot edit" onClick={() => alert('🔒 This month is locked. Unlock requires IT Admin.')}><Lock size={13} /></RowBtn>
                              <RowBtn title="Locked — cannot delete" onClick={() => alert('🔒 This month is locked. Unlock requires IT Admin.')}><Lock size={13} /></RowBtn>
                            </>
                          ) : (
                            <>
                              <RowBtn title="Edit" onClick={() => openEdit(t)}><Edit2 size={13} /></RowBtn>
                              <RowBtn title="Delete" danger onClick={() => remove(t)}><Trash2 size={13} /></RowBtn>
                            </>
                          )}
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

      {/* ── Monthly P&L Summary ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch">
          <div className="ct">Monthly P&L Summary</div>
          <div className="cs">{monthlySummary.length} month{monthlySummary.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Month</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Expenses</th><th style={{ textAlign: 'right' }}>Net P&L</th><th style={{ textAlign: 'right' }}>Margin %</th></tr>
            </thead>
            <tbody>
              {monthlySummary.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--color-text3)' }}>No data yet</td></tr>
              ) : (
                monthlySummary.map((m) => (
                  <tr key={m.month}>
                    <td style={{ fontWeight: 600 }}>
                      {m.locked && <span title="Month is locked" style={{ marginRight: 6 }}>🔒</span>}
                      {fmtMonth(m.month)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-green)', fontWeight: 600 }}>+{fmt(m.revenue)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-red)', fontWeight: 600 }}>−{fmt(m.expenses)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: m.net >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{fmt(m.net)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.margin}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Entry Modal ── */}
      {modal && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit Entry' : 'New P&L Entry'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Date <span className="req">*</span></label>
                  <input className="fc" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any, category: '' })}>
                    {typeGroups.map((group) => (
                      <optgroup key={group} label={group}>
                        {plTypes.filter((t: PLType) => t.group === group).map((t: PLType) => (
                          <option key={t.id} value={t.group === 'Income' ? 'REVENUE' : 'EXPENSE'}>{t.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="fg"><label className="fl">Category</label>
                  <select className="fc" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">— Select —</option>
                    {plCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Amount (R) <span className="req">*</span></label>
                  <input className="fc" type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                <div className="fg"><label className="fl">Source / Cost Centre</label>
                  <select className="fc" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}>
                    <option value="">— Select —</option>
                    {plCostCentres.map((cc) => <option key={cc} value={cc}>{cc}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Site</label>
                  <select className="fc" value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value || null })}>
                    <option value="">— Programme-wide —</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="full"><div className="fg"><label className="fl">Notes</label>
                  <input className="fc" value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Optional notes or reference" /></div></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lock Month Modal ── */}
      {lockModal && (
        <div className="modal-ov open" onClick={() => setLockModal(false)}>
          <div className="modal" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Monthly P&L Lock</span>
              <button onClick={() => setLockModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="alert alert-blue" style={{ marginBottom: 12 }}>
                <span>Locking a month freezes all revenue at current prices. Later price changes will not affect locked months. Unlock requires IT Admin.</span>
              </div>
              {monthlySummary.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text3)', fontSize: 12 }}>No monthly data to lock.</div>
              ) : (
                <div className="tw">
                  <table>
                    <thead><tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Action</th></tr></thead>
                    <tbody>
                      {monthlySummary.map((ms) => {
                        const isLocked = lockedMonths.includes(ms.month);
                        return (
                          <tr key={ms.month} style={isLocked ? { background: 'rgba(21,128,61,0.07)' } : undefined}>
                            <td style={{ fontSize: 12, fontWeight: 700 }}>{ms.month}</td>
                            <td style={{ fontSize: 11, color: 'var(--color-green)' }}>R {Math.round(ms.revenue).toLocaleString()}</td>
                            <td style={{ fontSize: 11, color: 'var(--color-red)' }}>R {Math.round(ms.expenses).toLocaleString()}</td>
                            <td>
                              {isLocked ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, color: 'var(--color-green)', fontWeight: 700 }}>🔒 Locked</span>
                                  <button className="btn btn-ghost btn-sm" onClick={() => {
                                    if (confirm(`Unlock ${ms.month}? This normally requires IT Admin approval.`)) {
                                      const updated = lockedMonths.filter((lm) => lm !== ms.month);
                                      setLockedMonths(updated);
                                      saveLockedMonths(updated);
                                    }
                                  }}>Unlock</button>
                                </div>
                              ) : (
                                <button className="btn btn-primary btn-sm" onClick={() => {
                                  if (confirm(`Lock ${ms.month}?\n\nThis will freeze all P&L revenue entries for this month. Price changes will NOT affect locked months.\n\nThis cannot be undone without IT Admin access.`)) {
                                    const updated = [...lockedMonths, ms.month];
                                    setLockedMonths(updated);
                                    saveLockedMonths(updated);
                                  }
                                }}>Lock Month</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setLockModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
