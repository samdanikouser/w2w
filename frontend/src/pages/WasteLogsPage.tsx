import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  wasteLogsApi,
  wasteTypesApi,
  sitesApi,
  depotsApi,
  employeesApi,
  type WasteLogPayload,
} from '../api/endpoints';
import {
  Plus, Search, X, Check, XCircle, Trash2, Download, Edit2,
} from 'lucide-react';
import { exportCsv } from '../utils/csv';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'badge ba',
  APPROVED: 'badge bg',
  REJECTED: 'badge br',
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const fmtZAR = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');
const fmtKg = (kg: number) =>
  kg >= 1000 ? (kg / 1000).toFixed(2) + 't' : kg.toLocaleString() + ' kg';

export default function WasteLogsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [siteFilter, setSiteFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(''); // e.g. "2026-05"
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    siteId: '',
    depotId: '',
    collectorId: '',
    notes: '',
  });
  const [wasteInputs, setWasteInputs] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function genDN() {
    return 'DN-' + String(Math.floor(Math.random() * 90000) + 10000);
  }

  // ── Queries ──
  const { data, isLoading } = useQuery({
    queryKey: ['waste-logs', statusFilter, siteFilter, monthFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (siteFilter !== 'all') params.siteId = siteFilter;
      if (monthFilter) params.month = monthFilter;
      return wasteLogsApi.list(params);
    },
  });

  const { data: wasteTypes = [] } = useQuery({
    queryKey: ['waste-types'],
    queryFn: wasteTypesApi.list,
  });
  const { data: sitesData = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: sitesApi.list,
  });
  const { data: depotsData = [] } = useQuery({
    queryKey: ['depots'],
    queryFn: depotsApi.list,
  });
  const { data: empData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesApi.list({}),
  });

  const logs: any[] = data?.data || [];
  const summary = data?.summary || { totalEntries: 0, totalQuantity: 0, totalValue: 0 };
  const wasteTypeList = Array.isArray(wasteTypes) ? (wasteTypes as any[]) : (wasteTypes as any).data || [];
  const sites: any[] = Array.isArray(sitesData) ? (sitesData as any[]) : (sitesData as any).data || [];
  const depots: any[] = Array.isArray(depotsData) ? (depotsData as any[]) : (depotsData as any).data || [];
  const employees: any[] = empData?.data || [];

  // ── Client-side search filter ──
  const filtered = logs.filter((l: any) => {
    if (!search) return true;
    const hay = `${l.wasteType?.name || ''} ${l.site?.name || ''} ${l.collector?.firstName || ''} ${l.collector?.lastName || ''} ${l.notes || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  // ── Per-category breakdown for the chart card ──
  const perCategory = useMemo(() => {
    const map = new Map<string, { id: string; name: string; colour: string; kg: number; rev: number; count: number }>();
    filtered.forEach((l: any) => {
      const id = l.wasteType?.id || l.wasteTypeId || l.wasteTypeName || 'unknown';
      const name = l.wasteType?.name || l.wasteTypeName || 'Unknown';
      const colour = l.wasteType?.colour || '#7a98ab';
      const row = map.get(id) || { id, name, colour, kg: 0, rev: 0, count: 0 };
      row.kg += Number(l.quantity) || 0;
      row.rev += Number(l.totalValue) || 0;
      row.count += 1;
      map.set(id, row);
    });
    return Array.from(map.values()).sort((a, b) => b.kg - a.kg);
  }, [filtered]);
  const maxCatKg = perCategory[0]?.kg || 1;

  // ── KPIs (4 cards) ──
  const totalKg = filtered.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalValue = filtered.reduce((s, l) => s + (Number(l.totalValue) || 0), 0);
  const totalEntries = filtered.length;
  const activeSites = new Set(filtered.map((l: any) => l.siteId).filter(Boolean)).size;
  const pendingCount = logs.filter((l: any) => l.status === 'PENDING').length;

  // ── Mutations ──
  const approveMut = useMutation({ mutationFn: (id: string) => wasteLogsApi.approve(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waste-logs'] }), onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.') });
  const rejectMut = useMutation({ mutationFn: (id: string) => wasteLogsApi.reject(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waste-logs'] }), onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.') });
  const deleteMut = useMutation({ mutationFn: (id: string) => wasteLogsApi.delete(id), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waste-logs'] }), onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.') });

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const dnRef = genDN();
      const activeCats = wasteTypeList.filter((c: any) => wasteInputs[c.id] > 0);
      
      if (activeCats.length === 0) {
        alert("Please enter at least one waste quantity.");
        setIsSubmitting(false);
        return;
      }

      const promises = activeCats.map((c: any) => {
        const qty = wasteInputs[c.id];
        let depotName = '';
        if (form.depotId) {
          const d = depots.find((dd: any) => dd.id === form.depotId);
          if (d) depotName = d.name;
        }

        const noteStr = [
          `Ref: ${dnRef}`,
          depotName ? `Depot: ${depotName}` : '',
          form.notes ? `Notes: ${form.notes}` : '',
        ].filter(Boolean).join(' | ');

        return wasteLogsApi.create({
          date: form.date,
          siteId: form.siteId || null,
          quantity: qty,
          unit: c.unit || 'kg',
          pricePerUnit: c.pricePerKg || c.pricePerUnit || 0,
          wasteTypeId: c.id || null,
          collectorId: form.collectorId || null,
          notes: noteStr,
        });
      });

      await Promise.all(promises);
      
      queryClient.invalidateQueries({ queryKey: ['waste-logs'] });
      setShowModal(false);
      setForm({ date: new Date().toISOString().split('T')[0], siteId: '', depotId: '', collectorId: '', notes: '' });
      setWasteInputs({});
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.error || err.message || 'Failed to save waste collection.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this waste log entry?')) deleteMut.mutate(id);
  };

  const totalInputKg = useMemo(
    () => Object.values(wasteInputs).reduce((s, v) => s + v, 0),
    [wasteInputs],
  );

  return (
    <div>
      {/* ══ Page Header (above stats, matches prototype) ══ */}
      <div className="ph">
        <div>
          <div className="pt">Record Waste</div>
          <div className="ps">
            {summary.totalEntries || 0} record{summary.totalEntries === 1 ? '' : 's'}
            {pendingCount > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--color-amber)' }}>{pendingCount} pending approval</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus size={13} /> Record Waste
          </button>
          <button className="btn btn-ghost" onClick={() => exportCsv('waste-logs', filtered, [
            { key: 'date', label: 'Date', map: (r: any) => r.date ? new Date(r.date).toISOString().slice(0, 10) : '' },
            { key: 'siteName', label: 'Site', map: (r: any) => r.site?.name || r.siteName || '' },
            { key: 'collectorName', label: 'Collector', map: (r: any) => r.collector ? `${r.collector.firstName} ${r.collector.lastName}` : (r.collectorName || '') },
            { key: 'wasteTypeName', label: 'Waste Type', map: (r: any) => r.wasteType?.name || r.wasteTypeName || '' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'unit', label: 'Unit' },
            { key: 'pricePerUnit', label: 'Price / Unit (R)' },
            { key: 'totalValue', label: 'Total (R)' },
            { key: 'status', label: 'Status' },
            { key: 'notes', label: 'Notes' },
          ])}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* ══ 4 Summary Cards with rails ══ */}
      <div className="stats-grid">
        <div className="stat-card sc-blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div className="stat-label">Total Recovered</div>
            <span style={{ fontSize: 18 }}>♻</span>
          </div>
          <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>{fmtKg(totalKg)}</div>
          <div className="stat-sub">{fmtKg(summary.totalQuantity || 0)} all-time</div>
        </div>
        <div className="stat-card sc-green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div className="stat-label">Deliveries</div>
            <span style={{ fontSize: 18 }}>📦</span>
          </div>
          <div className="stat-val" style={{ color: 'var(--color-accent)' }}>{totalEntries}</div>
          <div className="stat-sub">In view</div>
        </div>
        <div className="stat-card sc-amber">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div className="stat-label">Active Sites</div>
            <span style={{ fontSize: 18 }}>📍</span>
          </div>
          <div className="stat-val" style={{ color: 'var(--color-amber)' }}>{activeSites}</div>
          <div className="stat-sub">With deliveries</div>
        </div>
        <div className="stat-card sc-purple">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div className="stat-label">Est. Revenue</div>
            <span style={{ fontSize: 18 }}>💰</span>
          </div>
          <div className="stat-val" style={{ color: 'var(--color-purple)' }}>{fmtZAR(totalValue)}</div>
          <div className="stat-sub">{fmtZAR(summary.totalValue || 0)} all-time</div>
        </div>
      </div>

      {/* ══ Waste-by-Category bar-chart card (prototype's signature visual) ══ */}
      <div className="card mb14">
        <div className="ch">
          <div className="ct">Waste by Category</div>
          <div className="cs">Volume and revenue per recyclable stream</div>
        </div>
        <div className="cb">
          {perCategory.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 24, fontSize: 12 }}>
              No waste collected yet. Click <b>Record Waste</b> to log a delivery.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {perCategory.map((c) => {
                const pct = maxCatKg > 0 ? Math.round((c.kg / maxCatKg) * 100) : 0;
                const sharePct = totalKg > 0 ? Math.round((c.kg / totalKg) * 100) : 0;
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: c.colour, flexShrink: 0 }} />
                      <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text2)' }}>{fmtKg(c.kg)}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-green)', fontWeight: 600, width: 90, textAlign: 'right' }}>
                        {fmtZAR(c.rev)}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text3)', width: 36, textAlign: 'right' }}>{sharePct}%</div>
                    </div>
                    <div className="pb" style={{ height: 8 }}>
                      <div className="pf" style={{ width: pct + '%', background: c.colour, height: '100%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ Table card with filters in card header (prototype style) ══ */}
      <div className="card">
        <div className="ch">
          <div>
            <div className="ct">Collection Records</div>
            <div className="cs">Showing {filtered.length} of {data?.total || 0} entries</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 7,
                background: 'var(--color-surface3)',
                border: '1px solid var(--color-border)',
                width: 200,
              }}
            >
              <Search size={12} style={{ color: 'var(--color-text3)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  padding: 0,
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--color-text)',
                  flex: 1,
                }}
              />
            </div>
            <select className="fc" style={{ width: 140 }} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
              <option value="all">All Sites</option>
              {sites.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="month"
              className="fc"
              style={{ width: 150 }}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
            <select className="fc" style={{ width: 130 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Collector</th>
                <th>Waste Type</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Status</th>
                <th style={{ width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                    {logs.length === 0 ? 'No waste logs yet. Click "Record Waste" to log a collection.' : 'No logs match your filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((log: any) => {
                  const coll = log.collector;
                  const collName = coll ? `${coll.firstName || ''} ${coll.lastName || ''}`.trim() : (log.collectorName || '');
                  return (
                    <tr key={log.id}>
                      <td>{log.date ? new Date(log.date).toLocaleDateString() : '—'}</td>
                      <td>{log.site?.name || log.siteName || '—'}</td>
                      <td style={{ fontSize: 11 }}>{collName || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              flexShrink: 0,
                              background: log.wasteType?.colour || '#999',
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>{log.wasteType?.name || log.wasteTypeName || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{log.quantity} {log.unit || 'kg'}</td>
                      <td>{log.pricePerUnit != null ? `R ${Number(log.pricePerUnit).toFixed(2)}` : '—'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-green)' }}>
                        {log.totalValue != null ? `R ${Number(log.totalValue).toFixed(2)}` : '—'}
                      </td>
                      <td>
                        <span className={STATUS_STYLES[log.status] || 'badge bk'}>
                          {STATUS_LABELS[log.status] || log.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {log.status === 'PENDING' && (
                            <>
                              <ActionIcon title="Approve" tone="green" onClick={() => approveMut.mutate(log.id)}>
                                <Check size={13} />
                              </ActionIcon>
                              <ActionIcon title="Reject" tone="red" onClick={() => rejectMut.mutate(log.id)}>
                                <XCircle size={13} />
                              </ActionIcon>
                            </>
                          )}
                          <ActionIcon title="Edit" tone="blue" onClick={() => {
                            setForm({
                              date: log.date ? new Date(log.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                              siteId: log.siteId || '',
                              depotId: '',
                              collectorId: log.collectorId || '',
                              notes: log.notes || '',
                            });
                            const wInputs: Record<string, number> = {};
                            if (log.wasteTypeId) {
                              wInputs[log.wasteTypeId] = Number(log.quantity) || 0;
                            }
                            setWasteInputs(wInputs);
                            setShowModal(true);
                          }}>
                            <Edit2 size={13} />
                          </ActionIcon>
                          <ActionIcon title="Delete" tone="red" onClick={() => handleDelete(log.id)}>
                            <Trash2 size={13} />
                          </ActionIcon>
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

      {/* ══ ADD MODAL ══ */}
      {showModal && (
        <div className="modal-ov open">
          <div className="modal" style={{ width: 720 }}>
            <div className="mh">
              <span className="mt">Record Waste Collection</span>
              <button onClick={() => setShowModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <Field label="Date" required>
                  <input className="fc" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Field>
                <Field label="Site">
                  <select className="fc" value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
                    <option value="">Select site</option>
                    {sites.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Depot">
                  <select className="fc" value={form.depotId} onChange={(e) => setForm({ ...form, depotId: e.target.value })}>
                    <option value="">Select depot</option>
                    {depots.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Collector">
                  <select className="fc" value={form.collectorId} onChange={(e) => setForm({ ...form, collectorId: e.target.value })}>
                    <option value="">Select collector</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empNo})</option>
                    ))}
                  </select>
                </Field>
                <div className="full" style={{ background: 'var(--color-surface3)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', marginBottom: 12 }}>
                    Waste Streams (kg per category)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {wasteTypeList.map((cat: any) => (
                      <div key={cat.id}>
                        <label className="fl" style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: cat.colour || '#146484' }} />
                          {cat.name}
                        </label>
                        <input
                          className="fc"
                          type="number"
                          min="0"
                          value={wasteInputs[cat.id] || ''}
                          onChange={(e) => setWasteInputs({ ...wasteInputs, [cat.id]: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, padding: 10, background: 'var(--color-w2w-light)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>Total Weight:</span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-w2w)' }}>
                      {(totalInputKg / 1000).toFixed(1)} t
                    </span>
                  </div>
                </div>

                <div className="full">
                  <Field label="Notes / Reference No.">
                    <input className="fc" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Delivery note ref, vehicle reg, etc." />
                  </Field>
                </div>
              </div>
            </div>
            <div className="mf">
              <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={isSubmitting || totalInputKg <= 0} className="btn btn-primary">
                {isSubmitting ? 'Saving...' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactElement;
}) {
  return (
    <div className="fg">
      <label className="fl">
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>
  );
}

function ActionIcon({
  children,
  title,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  tone?: 'red' | 'green' | 'blue';
}) {
  const hoverBg =
    tone === 'red' ? 'var(--color-red-light)' :
    tone === 'green' ? 'var(--color-green-light)' :
    tone === 'blue' ? 'var(--color-w2w-light)' :
    'var(--color-surface3)';
  const hoverFg =
    tone === 'red' ? 'var(--color-red)' :
    tone === 'green' ? 'var(--color-green)' :
    tone === 'blue' ? 'var(--color-w2w)' :
    'var(--color-w2w)';
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: 4,
        borderRadius: 4,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--color-text3)',
        display: 'flex',
        alignItems: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        const t = e.currentTarget;
        t.style.background = hoverBg;
        t.style.color = hoverFg;
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget;
        t.style.background = 'transparent';
        t.style.color = 'var(--color-text3)';
      }}
    >
      {children}
    </button>
  );
}
