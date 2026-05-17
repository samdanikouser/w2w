import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eprReportsApi, sitesApi, type EprReportPayload } from '../api/endpoints';
import { Plus, Download, FileText, X, Edit2, Trash2 } from 'lucide-react';
import { StatCard, RowBtn } from './SitesPage';
import { exportCsv } from '../utils/csv';

const STATUS_BADGES: Record<string, string> = {
  DRAFT: 'badge bk',
  SUBMITTED: 'badge ba',
  APPROVED_REPORT: 'badge bg',
  REJECTED_REPORT: 'badge br',
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED_REPORT: 'Approved',
  REJECTED_REPORT: 'Rejected',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMPTY: EprReportPayload = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  siteId: null,
  totalTonnes: 0,
  totalRevenue: 0,
  status: 'DRAFT',
};

export default function EPRReportsPage() {
  const qc = useQueryClient();
  const [yearFilter, setYearFilter] = useState('all');
  const [modal, setModal] = useState<'add' | 'edit' | 'view' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<EprReportPayload>(EMPTY);

  const { data: reports = [] } = useQuery({ queryKey: ['epr-reports'], queryFn: () => eprReportsApi.list() });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];

  const createMut = useMutation({
    mutationFn: (p: EprReportPayload) => eprReportsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epr-reports'] }); setModal(null); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, p }: { id: string; p: Partial<EprReportPayload> }) => eprReportsApi.update(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epr-reports'] }); setModal(null); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => eprReportsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epr-reports'] }),
  });

  const list = reports as any[];
  const years = Array.from(new Set(list.map((r) => r.year))).sort((a, b) => b - a);
  const filtered = list.filter((r) => yearFilter === 'all' || r.year === Number(yearFilter));

  const totalTonnes = list.reduce((s, r) => s + (Number(r.totalTonnes) || 0), 0);
  const totalRevenue = list.reduce((s, r) => s + (Number(r.totalRevenue) || 0), 0);
  const approved = list.filter((r) => r.status === 'APPROVED_REPORT').length;
  const drafts = list.filter((r) => r.status === 'DRAFT').length;

  const openAdd = () => { setForm({ ...EMPTY }); setActive(null); setModal('add'); };
  const openEdit = (r: any) => {
    setForm({
      month: r.month, year: r.year, siteId: r.siteId || null,
      totalTonnes: r.totalTonnes, totalRevenue: r.totalRevenue, status: r.status,
    });
    setActive(r); setModal('edit');
  };
  const openView = (r: any) => { setActive(r); setModal('view'); };
  const save = () => {
    if (!form.month || !form.year) return;
    if (modal === 'edit' && active) updateMut.mutate({ id: active.id, p: form });
    else createMut.mutate(form);
  };
  const remove = (r: any) => {
    if (confirm(`Delete EPR report for ${MONTHS[r.month - 1]} ${r.year}?`)) deleteMut.mutate(r.id);
  };

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Monthly EPR Reporting</div>
          <div className="ps">Extended Producer Responsibility submissions · {list.length} report{list.length === 1 ? '' : 's'} on file</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-accent" onClick={openAdd}><Plus size={13} /> New Report</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('epr-reports', filtered, [
            { key: 'period', label: 'Period', map: (r: any) => `${MONTHS[r.month - 1]} ${r.year}` },
            { key: 'month', label: 'Month' },
            { key: 'year', label: 'Year' },
            { key: 'totalTonnes', label: 'Tonnes' },
            { key: 'totalRevenue', label: 'Revenue (R)' },
            { key: 'status', label: 'Status' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="stats-grid mt14">
        <StatCard label="Reports On File" value={String(list.length)} sub={`${approved} approved`} icon="📄" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Total Reported" value={totalTonnes.toFixed(1) + 't'} sub="Across all submissions" icon="♻" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Total Revenue" value={'R ' + Math.round(totalRevenue / 1000) + 'k'} sub="EPR-linked" icon="💰" rail="sc-purple" color="var(--color-purple)" />
        <StatCard label="Drafts" value={String(drafts)} sub="Pending submission" icon="📝" rail="sc-amber" color="var(--color-amber)" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <select className="fc" style={{ width: 130 }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="all">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="cb" style={{ padding: 48, textAlign: 'center', color: 'var(--color-text3)' }}>
            <div style={{ fontSize: 36, marginBottom: 8, opacity: 0.3 }}>📊</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text2)' }}>No EPR reports yet</p>
            <p style={{ fontSize: 11 }}>Click "New Report" to create your first monthly submission.</p>
          </div>
        </div>
      ) : (
        <div className="g3">
          {filtered.map((r: any) => (
            <div key={r.id} className="card">
              <div className="ch">
                <div>
                  <div className="ct">{MONTHS[r.month - 1]} {r.year}</div>
                  <div className="cs">Period · M{r.month}/{r.year}</div>
                </div>
                <span className={STATUS_BADGES[r.status] || 'badge bk'}>{STATUS_LABELS[r.status] || r.status}</span>
              </div>
              <div className="cb">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase', fontWeight: 600 }}>Tonnes</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-w2w)' }}>{Number(r.totalTonnes).toFixed(1)}t</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--color-text3)', textTransform: 'uppercase', fontWeight: 600 }}>Revenue</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-green)' }}>R {Math.round(Number(r.totalRevenue) / 1000)}k</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openView(r)}>
                    <FileText size={11} /> View
                  </button>
                  <RowBtn title="Edit" onClick={() => openEdit(r)}><Edit2 size={13} /></RowBtn>
                  <RowBtn title="Delete" danger onClick={() => remove(r)}><Trash2 size={13} /></RowBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Edit EPR Report' : 'New EPR Report'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="fg"><label className="fl">Month</label>
                  <select className="fc" value={form.month} onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Year</label>
                  <input className="fc" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })} /></div>
                <div className="fg"><label className="fl">Tonnes Recovered</label>
                  <input className="fc" type="number" step="0.1" value={form.totalTonnes ?? 0} onChange={(e) => setForm({ ...form, totalTonnes: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Revenue (R)</label>
                  <input className="fc" type="number" step="0.01" value={form.totalRevenue ?? 0} onChange={(e) => setForm({ ...form, totalRevenue: parseFloat(e.target.value) || 0 })} /></div>
                <div className="fg"><label className="fl">Site</label>
                  <select className="fc" value={form.siteId || ''} onChange={(e) => setForm({ ...form, siteId: e.target.value || null })}>
                    <option value="">— Programme-wide —</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="APPROVED_REPORT">Approved</option>
                    <option value="REJECTED_REPORT">Rejected</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={createMut.isPending || updateMut.isPending}>
                {(createMut.isPending || updateMut.isPending) ? 'Saving…' : modal === 'edit' ? 'Update Report' : 'Create Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'view' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">EPR Report — {MONTHS[active.month - 1]} {active.year}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="g3 mb14">
                <div className="stat-card sc-blue">
                  <div className="stat-label">Period</div>
                  <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>{MONTHS[active.month - 1]}</div>
                  <div className="stat-sub">{active.year}</div>
                </div>
                <div className="stat-card sc-green">
                  <div className="stat-label">Tonnes Recovered</div>
                  <div className="stat-val" style={{ color: 'var(--color-green)' }}>{Number(active.totalTonnes).toFixed(1)}t</div>
                  <div className="stat-sub">Reported volume</div>
                </div>
                <div className="stat-card sc-purple">
                  <div className="stat-label">Revenue Reported</div>
                  <div className="stat-val" style={{ color: 'var(--color-purple)' }}>R {Math.round(active.totalRevenue).toLocaleString()}</div>
                  <div className="stat-sub">EPR-linked income</div>
                </div>
              </div>
              <div className="drow"><div className="dlb">Status</div><div className="dvl"><span className={STATUS_BADGES[active.status]}>{STATUS_LABELS[active.status]}</span></div></div>
              <div className="drow"><div className="dlb">Site</div><div className="dvl">{sites.find((s) => s.id === active.siteId)?.name || 'Programme-wide'}</div></div>
              <div className="drow"><div className="dlb">Submitted At</div><div className="dvl">{active.submittedAt ? new Date(active.submittedAt).toLocaleString() : '—'}</div></div>
              <div className="drow"><div className="dlb">Created</div><div className="dvl">{new Date(active.createdAt).toLocaleString()}</div></div>
              <div className="alert alert-blue mt14">
                <span>The full PRO-formatted XLSX export with supporting evidence will be generated from this record. Use the <b>Export</b> button on the parent page for the CSV summary.</span>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => openEdit(active)}><Edit2 size={13} /> Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
