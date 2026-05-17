import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, sitesApi, type TransactionPayload } from '../api/endpoints';
import { Plus, Download, TrendingUp, TrendingDown, X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, FilterInput, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';

const EMPTY: TransactionPayload = {
  date: new Date().toISOString().slice(0, 10),
  type: 'REVENUE', category: '', description: '', amount: 0, siteId: null, reference: '',
};

const CATEGORIES_REV = ['Recyclable Sales', 'EPR Subsidy', 'Grants', 'Other Revenue'];
const CATEGORIES_EXP = ['Stipends', 'Fuel', 'PPE Procurement', 'Vehicle Maintenance', 'Utilities', 'Other Expense'];

export default function PLRegisterPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<TransactionPayload>(EMPTY);

  const { data } = useQuery({
    queryKey: ['transactions', typeFilter],
    queryFn: () => transactionsApi.list(typeFilter !== 'all' ? { type: typeFilter } : {}),
  });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });

  const tx: any[] = data?.data || [];
  const summary = data?.summary || { totalRevenue: 0, totalExpense: 0, net: 0 };
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];

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

  const filtered = useMemo(() => {
    return tx.filter((t) => {
      if (!search) return true;
      return `${t.category} ${t.description} ${t.reference || ''}`.toLowerCase().includes(search.toLowerCase());
    });
  }, [tx, search]);

  const margin = summary.totalRevenue > 0 ? Math.round((summary.net / summary.totalRevenue) * 100) : 0;
  const fmt = (n: number) => 'R ' + Math.round(Math.abs(n)).toLocaleString('en-ZA');

  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (t: any) => {
    setForm({
      date: t.date ? t.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      type: t.type, category: t.category, description: t.description,
      amount: Math.abs(t.amount), siteId: t.siteId || null, reference: t.reference || '',
    });
    setActive(t); setModal('edit');
  };
  const save = () => {
    if (!form.amount || Math.abs(form.amount) <= 0) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (t: any) => {
    if (confirm(`Delete transaction "${t.description || t.category}"?`)) deleteMut.mutate(t.id);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">P&L Entry Register</div>
          <div className="ps">{tx.length} transactions · period to date</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> New Entry</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('pl-register', filtered, [
            { key: 'date', label: 'Date', map: (r: any) => r.date ? new Date(r.date).toISOString().slice(0, 10) : '' },
            { key: 'type', label: 'Type' },
            { key: 'category', label: 'Category' },
            { key: 'description', label: 'Description' },
            { key: 'reference', label: 'Reference' },
            { key: 'amount', label: 'Amount (R)' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Total Revenue" value={fmt(summary.totalRevenue)} sub={`${tx.filter((t) => t.type === 'REVENUE').length} entries`} icon="💰" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Total Expenses" value={fmt(summary.totalExpense)} sub={`${tx.filter((t) => t.type === 'EXPENSE').length} entries`} icon="💸" rail="sc-red" color="var(--color-red)" />
        <StatCard label="Net Position" value={fmt(summary.net)} sub={summary.net >= 0 ? 'Surplus' : 'Deficit'} icon={summary.net >= 0 ? '📈' : '📉'} rail={summary.net >= 0 ? 'sc-green' : 'sc-red'} color={summary.net >= 0 ? 'var(--color-green)' : 'var(--color-red)'} />
        <StatCard label="Margin" value={margin + '%'} sub="Net / Revenue" icon="📊" rail="sc-blue" color="var(--color-w2w)" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Transaction Register</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FilterInput value={search} onChange={setSearch} placeholder="Search…" />
            <select className="fc" style={{ width: 140 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Reference</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ width: 80 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No transactions yet. Click "New Entry" to record one.
                </td></tr>
              ) : (
                filtered.map((t: any) => (
                  <tr key={t.id}>
                    <td>{t.date ? new Date(t.date).toLocaleDateString() : '—'}</td>
                    <td>
                      <span className={t.type === 'REVENUE' ? 'badge bg' : 'badge br'}>
                        {t.type === 'REVENUE' ? <><TrendingUp size={11} /> Revenue</> : <><TrendingDown size={11} /> Expense</>}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{t.category}</td>
                    <td style={{ fontSize: 11 }}>{t.description}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.reference || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: t.type === 'REVENUE' ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {t.type === 'REVENUE' ? '+' : '−'} {fmt(t.amount)}
                    </td>
                    <td><div style={{ display: 'flex', gap: 4 }}><RowBtn title="Edit" onClick={() => openEdit(t)}><Edit2 size={13} /></RowBtn><RowBtn title="Delete" danger onClick={() => remove(t)}><Trash2 size={13} /></RowBtn></div></td>
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
              <span className="mt">{modal === 'edit' ? 'Edit Entry' : 'New P&L Entry'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Date <span className="req">*</span></label>
                  <input className="fc" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any, category: '' })}>
                    <option value="REVENUE">Revenue</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Category</label>
                  <select className="fc" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">— Select —</option>
                    {(form.type === 'REVENUE' ? CATEGORIES_REV : CATEGORIES_EXP).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Amount (R) <span className="req">*</span></label>
                  <input className="fc" type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" /></div>
                <div className="full"><div className="fg"><label className="fl">Description</label>
                  <input className="fc" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" /></div></div>
                <div className="fg"><label className="fl">Site</label>
                  <select className="fc" value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value || null })}>
                    <option value="">— Programme-wide —</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Reference</label>
                  <input className="fc" value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="INV-2026-0001" /></div>
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
    </div>
  );
}
