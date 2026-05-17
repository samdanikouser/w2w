import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stockItemsApi, sitesApi, type StockItemPayload } from '../api/endpoints';
import { Plus, Download, Package, AlertTriangle, X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, FilterInput, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';

const STATUS_BADGES: Record<string, string> = {
  OK: 'badge bg',
  LOW: 'badge ba',
  OUT: 'badge br',
};

const EMPTY: StockItemPayload = {
  code: '', item: '', category: 'PPE', uom: 'each', onHand: 0, reorderAt: 0, siteId: null,
};

export default function StockRegisterPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<StockItemPayload>(EMPTY);

  const { data: items = [] } = useQuery({ queryKey: ['stock-items'], queryFn: () => stockItemsApi.list() });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];

  const createMut = useMutation({
    mutationFn: (p: StockItemPayload) => stockItemsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-items'] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<StockItemPayload> }) => stockItemsApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-items'] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => stockItemsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-items'] }),
  });

  const filtered = (items as any[]).filter((s) => {
    if (cat !== 'all' && s.category !== cat) return false;
    if (!search) return true;
    return `${s.item} ${s.code} ${s.site?.name || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  const low = (items as any[]).filter((s) => s.status === 'LOW' || s.status === 'OUT').length;
  const categories = Array.from(new Set((items as any[]).map((s) => s.category)));

  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (s: any) => {
    setForm({
      code: s.code, item: s.item, category: s.category, uom: s.uom,
      onHand: s.onHand, reorderAt: s.reorderAt, siteId: s.siteId || null,
    });
    setActive(s); setModal('edit');
  };
  const save = () => {
    if (!form.code?.trim() || !form.item?.trim()) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (s: any) => {
    if (confirm(`Delete stock item "${s.item}"?`)) deleteMut.mutate(s.id);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Stock Register</div>
          <div className="ps">{(items as any[]).length} stock-keeping units · {low} need attention</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> Add Item</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('stock-register', filtered, [
            { key: 'code', label: 'Code' },
            { key: 'item', label: 'Item' },
            { key: 'category', label: 'Category' },
            { key: 'site', label: 'Site', map: (r: any) => r.site?.name || '' },
            { key: 'uom', label: 'UOM' },
            { key: 'onHand', label: 'On Hand' },
            { key: 'reorderAt', label: 'Reorder At' },
            { key: 'status', label: 'Status' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Total SKUs" value={String((items as any[]).length)} sub="All categories" icon="📦" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="PPE Items" value={String((items as any[]).filter((s) => s.category === 'PPE').length)} sub="Safety equipment" icon="🦺" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Low Stock" value={String((items as any[]).filter((s) => s.status === 'LOW').length)} sub="Below reorder point" icon="⚠" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Out of Stock" value={String((items as any[]).filter((s) => s.status === 'OUT').length)} sub="Urgent restock" icon="🚨" rail="sc-red" color="var(--color-red)" />
      </div>

      <div className="card">
        <div className="ch">
          <div className="ct">Inventory Register</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <FilterInput value={search} onChange={setSearch} placeholder="Search items…" />
            <select className="fc" style={{ width: 150 }} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Code</th><th>Item</th><th>Category</th><th>Site</th><th>UOM</th><th>On Hand</th><th>Reorder At</th><th>Status</th><th style={{ width: 80 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                  No stock items yet. Click "Add Item" to register inventory.
                </td></tr>
              ) : (
                filtered.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.code}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Package size={14} style={{ color: 'var(--color-w2w)' }} /><span style={{ fontWeight: 600 }}>{s.item}</span></div></td>
                    <td><span className="badge bb">{s.category}</span></td>
                    <td>{s.site?.name || '—'}</td>
                    <td>{s.uom}</td>
                    <td style={{ fontWeight: 700, color: s.status === 'OUT' ? 'var(--color-red)' : s.status === 'LOW' ? 'var(--color-amber)' : 'var(--color-text)' }}>{s.onHand}</td>
                    <td>{s.reorderAt}</td>
                    <td><span className={STATUS_BADGES[s.status]}>{s.status !== 'OK' && <AlertTriangle size={11} />} {s.status}</span></td>
                    <td><div style={{ display: 'flex', gap: 4 }}><RowBtn title="Edit" onClick={() => openEdit(s)}><Edit2 size={13} /></RowBtn><RowBtn title="Delete" danger onClick={() => remove(s)}><Trash2 size={13} /></RowBtn></div></td>
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
              <span className="mt">{modal === 'edit' ? 'Edit Item' : 'Add Stock Item'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Code <span className="req">*</span></label>
                  <input className="fc" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="PPE-VST" /></div>
                <div className="fg"><label className="fl">Item <span className="req">*</span></label>
                  <input className="fc" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="High-Vis Vest" /></div>
                <div className="fg"><label className="fl">Category</label>
                  <select className="fc" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="PPE">PPE</option>
                    <option value="Consumable">Consumable</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Spare">Spare Part</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">UOM</label>
                  <select className="fc" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })}>
                    <option value="each">each</option>
                    <option value="pair">pair</option>
                    <option value="pack">pack</option>
                    <option value="roll">roll</option>
                    <option value="litre">litre</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">On Hand</label>
                  <input className="fc" type="number" value={form.onHand ?? 0} onChange={(e) => setForm({ ...form, onHand: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Reorder At</label>
                  <input className="fc" type="number" value={form.reorderAt ?? 0} onChange={(e) => setForm({ ...form, reorderAt: parseFloat(e.target.value) || 0 })} /></div>
                <div className="full"><div className="fg"><label className="fl">Site</label>
                  <select className="fc" value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value || null })}>
                    <option value="">— Programme-wide —</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div></div>
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
    </div>
  );
}
