import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sitesApi, wasteTypesApi, depotsApi, cooperativesApi, eprReportsApi } from '../api/endpoints';
import { Plus, X, Eye, Printer, Check, XCircle, Edit2 } from 'lucide-react';
import { loadGeography } from '../utils/geography';
import { useSettingsStore } from '../stores/settingsStore';
import { usePermissions } from '../hooks/usePermissions';
import { useAuthStore } from '../stores/authStore';

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

type MaterialBreakdown = Record<string, number>;

function emptyBreakdown(types: any[] = []): MaterialBreakdown {
  const bd: Record<string, number> = {};
  types.forEach(t => bd[t.id] = 0);
  return bd;
}

function sumBreakdown(bd: MaterialBreakdown): number {
  return Object.values(bd).reduce((s, val) => s + (val || 0), 0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge bk',
  SUBMITTED: 'badge ba',
  APPROVED_REPORT: 'badge bg',
  REJECTED_REPORT: 'badge br',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Pending Approval',
  APPROVED_REPORT: 'Approved',
  REJECTED_REPORT: 'Rejected',
};

/* ═══════════════════════════════════════════════════════
   Create Form
   ═══════════════════════════════════════════════════════ */
interface CreateForm {
  dateFrom: string;
  dateTo: string;
  siteId: string;
  buyerConfirmation: string;
  traceabilityRef: string;
  materialBreakdown: MaterialBreakdown;
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */
export default function EPRReportsPage() {
  const qc = useQueryClient();
  const { canCreate, canApprove, canEdit } = usePermissions();
  const settings = useSettingsStore(s => s.settings);
  const user = useAuthStore(s => s.user);
  const currentUserId = user?.id;

  const [modal, setModal] = useState<'create' | 'view' | 'reject' | 'edit' | null>(null);
  const [active, setActive] = useState<any>(null);
  const [form, setForm] = useState<CreateForm>({ dateFrom: '', dateTo: '', siteId: '', buyerConfirmation: '', traceabilityRef: '', materialBreakdown: {} });
  const [rejectReason, setRejectReason] = useState('');

  /* ── Data Queries ── */
  const { data: reports = [], isLoading } = useQuery({ queryKey: ['epr-reports'], queryFn: () => eprReportsApi.list() });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: depotsData = [] } = useQuery({ queryKey: ['depots'], queryFn: () => depotsApi.list() });
  const { data: coopsData = [] } = useQuery({ queryKey: ['coops'], queryFn: () => cooperativesApi.list() });
  const { data: wasteTypes = [] } = useQuery({ queryKey: ['waste-types'], queryFn: () => wasteTypesApi.list() });

  const rawSites = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const rawDepots = Array.isArray(depotsData) ? depotsData : (depotsData as any)?.data || [];
  const rawCoops = Array.isArray(coopsData) ? coopsData : (coopsData as any)?.data || [];
  const rawApiTypes = Array.isArray(wasteTypes) ? wasteTypes : (wasteTypes as any)?.data || [];

  const rawWasteTypes: any[] = useMemo(() => {
    if (rawApiTypes.length > 0) {
      return rawApiTypes.map((wt: any) => ({ ...wt, pricePerKg: wt.pricePerKg ?? wt.pricePerUnit ?? 0 }));
    }
    return settings.wasteCategories.map(c => ({
      id: c.id, name: c.name, category: c.eprGroup || '',
      buyer: c.buyer || '', pricePerKg: c.pricePerKg || 0, colour: c.color || '#146484',
    }));
  }, [rawApiTypes, settings.wasteCategories]);

  const sites = useMemo(() => [...rawSites, ...rawDepots, ...rawCoops], [rawSites, rawDepots, rawCoops]);

  const siteName = useCallback((siteId: string) => {
    if (!siteId) return '—';
    const s = sites.find((x: any) => x.id === siteId);
    return s ? s.name : '—';
  }, [sites]);

  /* ── Mutations ── */
  const createMut = useMutation({
    mutationFn: (p: any) => eprReportsApi.create(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epr-reports'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Failed to create report'),
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => eprReportsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epr-reports'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Failed to update report'),
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => eprReportsApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epr-reports'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); setModal(null); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Failed to approve'),
  });
  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => eprReportsApi.reject(id, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['epr-reports'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); setModal(null); setRejectReason(''); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Failed to reject'),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => eprReportsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['epr-reports'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Failed to delete'),
  });

  /* ── Stats ── */
  const allReports: any[] = reports as any[];
  const submitted = allReports.filter(r => r.status === 'SUBMITTED').length;
  const approved = allReports.filter(r => r.status === 'APPROVED_REPORT').length;
  const rejected = allReports.filter(r => r.status === 'REJECTED_REPORT').length;
  const totalTonnage = allReports.reduce((s, r) => s + (r.totalTonnes || 0), 0);

  /* ── Material aggregation ── */
  const materialTotals: Record<string, number> = {};
  for (const wt of rawWasteTypes) {
    materialTotals[wt.id] = allReports.reduce((s, r) => {
      const bd = r.data?.materialBreakdown || {};
      return s + (bd[wt.id] ?? 0);
    }, 0);
  }

  /* ── Handlers ── */
  const openCreate = () => {
    setForm({ dateFrom: '', dateTo: '', siteId: '', buyerConfirmation: '', traceabilityRef: '', materialBreakdown: emptyBreakdown(rawWasteTypes) });
    setModal('create');
  };
  const openView = (r: any) => { setActive(r); setModal('view'); };
  const openEdit = (r: any) => {
    const bd = r.data?.materialBreakdown || emptyBreakdown(rawWasteTypes);
    setForm({
      dateFrom: r.dateFrom ? new Date(r.dateFrom).toISOString().slice(0, 10) : '',
      dateTo: r.dateTo ? new Date(r.dateTo).toISOString().slice(0, 10) : '',
      siteId: r.siteId || '',
      buyerConfirmation: r.buyerConfirmation || '',
      traceabilityRef: r.traceabilityRef || '',
      materialBreakdown: bd,
    });
    setActive(r);
    setModal('edit');
  };
  const openReject = (r: any) => { setActive(r); setRejectReason(''); setModal('reject'); };

  const handleCreate = () => {
    if (!form.dateFrom || !form.dateTo) return;
    const bd = form.materialBreakdown;
    const tonnage = sumBreakdown(bd);
    const month = parseInt(form.dateFrom.substring(5, 7));
    const year = parseInt(form.dateFrom.substring(0, 4));
    createMut.mutate({
      month, year,
      siteId: form.siteId || null,
      totalTonnes: parseFloat(tonnage.toFixed(3)),
      totalRevenue: rawWasteTypes.reduce((s, wt) => s + ((bd[wt.id] || 0) * 1000 * (wt.pricePerKg || 0)), 0),
      status: 'SUBMITTED',
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      buyerConfirmation: form.buyerConfirmation,
      traceabilityRef: form.traceabilityRef,
      data: { materialBreakdown: bd },
    });
  };

  const handleEdit = () => {
    if (!active || !form.dateFrom || !form.dateTo) return;
    const bd = form.materialBreakdown;
    const tonnage = sumBreakdown(bd);
    const month = parseInt(form.dateFrom.substring(5, 7));
    const year = parseInt(form.dateFrom.substring(0, 4));
    updateMut.mutate({
      id: active.id,
      data: {
        month, year,
        siteId: form.siteId || null,
        totalTonnes: parseFloat(tonnage.toFixed(3)),
        totalRevenue: rawWasteTypes.reduce((s, wt) => s + ((bd[wt.id] || 0) * 1000 * (wt.pricePerKg || 0)), 0),
        status: 'SUBMITTED',
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        buyerConfirmation: form.buyerConfirmation,
        traceabilityRef: form.traceabilityRef,
        data: { materialBreakdown: bd },
      },
    });
  };

  const updateMaterial = (code: string, val: string) => {
    setForm(prev => ({
      ...prev,
      materialBreakdown: { ...prev.materialBreakdown, [code]: parseFloat(val) || 0 },
    }));
  };

  return (
    <div>
      {/* ═══ Page Header ═══ */}
      <div className="ph">
        <div>
          <div className="pt">Monthly EPR Reporting</div>
          <div className="ps">Material classification · Verified tonnage · Buyer confirmation · Traceability</div>
        </div>
        {canCreate('epr-reports') && (
          <button className="btn btn-accent" onClick={openCreate}><Plus size={13} /> Create Report</button>
        )}
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="stats-grid">
        <div className="stat-card sc-blue card">
          <div className="stat-label">Total Reports</div>
          <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>{allReports.length}</div>
          <div className="stat-sub">{submitted} pending</div>
        </div>
        <div className="stat-card sc-amber card">
          <div className="stat-label">Pending Approval</div>
          <div className="stat-val" style={{ color: 'var(--color-amber)' }}>{submitted}</div>
          <div className="stat-sub">Awaiting review</div>
        </div>
        <div className="stat-card sc-green card">
          <div className="stat-label">Approved</div>
          <div className="stat-val" style={{ color: 'var(--color-green)' }}>{approved}</div>
          <div className="stat-sub">Compliant reports</div>
        </div>
        <div className="stat-card sc-red card">
          <div className="stat-label">Rejected</div>
          <div className="stat-val" style={{ color: 'var(--color-red)' }}>{rejected}</div>
          <div className="stat-sub">Requires revision</div>
        </div>
      </div>

      {/* ═══ Pending Approval Section (for approvers) ═══ */}
      {canApprove('epr-reports') && allReports.filter(r => r.status === 'SUBMITTED').length > 0 && (
        <div className="card mb14">
          <div className="ch">
            <div>
              <div className="ct">⏳ Pending Approval</div>
              <div className="cs">{submitted} report{submitted !== 1 ? 's' : ''} awaiting your review</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
            {allReports.filter(r => r.status === 'SUBMITTED').map(r => {
              const isOwnReport = r.createdById === currentUserId;
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', border: '1px solid var(--color-border)',
                  borderLeft: '4px solid var(--color-amber)', borderRadius: 8,
                  background: 'var(--color-surface2)',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      EPR Report — {r.month}/{r.year}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text3)', marginTop: 2 }}>
                      Site: {r.site?.name || siteName(r.siteId)} · {r.totalTonnes?.toFixed(1)}t · Submitted by {r.createdByUser?.name || '—'} on {fmtDate(r.submittedAt)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openView(r)}><Eye size={12} /> View</button>
                    {!isOwnReport && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => approveMut.mutate(r.id)} disabled={approveMut.isPending}>
                          <Check size={12} /> Approve
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-red)', borderColor: 'var(--color-red-light)' }} onClick={() => openReject(r)}>
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                    {isOwnReport && (
                      <span style={{ fontSize: 10, color: 'var(--color-text3)', fontStyle: 'italic' }}>Your report — cannot self-approve</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ All Reports Table ═══ */}
      <div className="card mb14">
        <div className="ch">
          <div>
            <div className="ct">All EPR Reports</div>
            <div className="cs">{allReports.length} report{allReports.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Site</th>
                <th>Submitted By</th>
                <th>Submitted</th>
                <th>Tonnage</th>
                <th>Buyer Confirm</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allReports.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text3)' }}>
                    {isLoading ? 'Loading…' : 'No EPR reports yet. Click "+ Create Report" to get started.'}
                  </td>
                </tr>
              ) : allReports.map(r => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {r.dateFrom && r.dateTo
                        ? `${fmtDate(r.dateFrom)} → ${fmtDate(r.dateTo)}`
                        : `${r.month}/${r.year}`}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{r.site?.name || siteName(r.siteId)}</div>
                  </td>
                  <td style={{ fontSize: 11 }}>{r.createdByUser?.name || '—'}</td>
                  <td>{fmtDate(r.submittedAt)}</td>
                  <td style={{ fontWeight: 700 }}>{(r.totalTonnes || 0).toFixed(1)}t</td>
                  <td>{r.buyerConfirmation || '—'}</td>
                  <td><span className={STATUS_BADGE[r.status] || 'badge bk'}>{STATUS_LABEL[r.status] || r.status}</span></td>
                  <td style={{ fontSize: 11 }}>
                    {r.approvedByUser?.name || '—'}
                    {r.approvedAt && <div style={{ fontSize: 9, color: 'var(--color-text3)' }}>{fmtDate(r.approvedAt)}</div>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openView(r)}><Eye size={12} /></button>
                      {/* Creator can edit rejected reports */}
                      {r.status === 'REJECTED_REPORT' && r.createdById === currentUserId && canEdit('epr-reports') && (
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}><Edit2 size={12} /></button>
                      )}
                      {/* Approvers can approve/reject submitted reports (not their own) */}
                      {r.status === 'SUBMITTED' && canApprove('epr-reports') && r.createdById !== currentUserId && (
                        <>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-green)' }} onClick={() => approveMut.mutate(r.id)} disabled={approveMut.isPending}>
                            <Check size={12} />
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-red)' }} onClick={() => openReject(r)}>
                            <XCircle size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ EPR Material Categories Card ═══ */}
      <div className="card">
        <div className="ch">
          <div>
            <div className="ct">EPR Material Categories</div>
            <div className="cs">PMU consolidation per EPR regulations</div>
          </div>
        </div>
        <div className="cb">
          <div className="tw" style={{ overflowX: 'auto', paddingBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {rawWasteTypes.map(wt => (
                <div key={wt.id} style={{
                  padding: '12px 14px', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', background: 'var(--color-surface2)', minWidth: 140,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {wt.name}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                    {(materialTotals[wt.id] || 0).toFixed(1)}t
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 4 }}>
                    R{(wt.pricePerKg || wt.pricePerUnit || 0).toFixed(2)}/kg · {wt.buyer || 'No Buyer'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ View Modal ═══ */}
      {modal === 'view' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">EPR Report — {active.id?.slice(0, 8)}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {/* Report Details */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Report Details
              </div>
              <div className="drow"><div className="dlb">Report ID</div><div className="dvl" style={{ fontFamily: 'var(--font-mono)' }}>{active.id?.slice(0, 8)}</div></div>
              <div className="drow"><div className="dlb">Period</div><div className="dvl">{fmtDate(active.dateFrom)} → {fmtDate(active.dateTo)}</div></div>
              <div className="drow"><div className="dlb">Site</div><div className="dvl">{active.site?.name || siteName(active.siteId)}</div></div>
              <div className="drow"><div className="dlb">Submitted By</div><div className="dvl">{active.createdByUser?.name || '—'}</div></div>
              <div className="drow"><div className="dlb">Submitted Date</div><div className="dvl">{fmtDate(active.submittedAt)}</div></div>
              <div className="drow"><div className="dlb">Traceability Ref</div><div className="dvl" style={{ fontFamily: 'var(--font-mono)' }}>{active.traceabilityRef || '—'}</div></div>
              <div className="drow"><div className="dlb">Buyer Confirmation</div><div className="dvl">{active.buyerConfirmation || '—'}</div></div>
              <div className="drow"><div className="dlb">Total Tonnage</div><div className="dvl" style={{ fontWeight: 700 }}>{(active.totalTonnes || 0).toFixed(1)}t</div></div>
              <div className="drow"><div className="dlb">Status</div><div className="dvl"><span className={STATUS_BADGE[active.status] || 'badge bk'}>{STATUS_LABEL[active.status] || active.status}</span></div></div>

              {/* Approval Info */}
              {(active.status === 'APPROVED_REPORT' || active.status === 'REJECTED_REPORT') && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: active.status === 'APPROVED_REPORT' ? 'var(--color-green)' : 'var(--color-red)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '18px 0 10px', paddingTop: 12, borderTop: '2px solid var(--color-border)' }}>
                    {active.status === 'APPROVED_REPORT' ? '✅ Approval Details' : '❌ Rejection Details'}
                  </div>
                  <div className="drow"><div className="dlb">{active.status === 'APPROVED_REPORT' ? 'Approved By' : 'Rejected By'}</div><div className="dvl">{active.approvedByUser?.name || '—'}</div></div>
                  <div className="drow"><div className="dlb">Date</div><div className="dvl">{fmtDate(active.approvedAt)}</div></div>
                  {active.rejectedReason && (
                    <div className="drow" style={{ borderBottom: 'none' }}>
                      <div className="dlb">Reason</div>
                      <div className="dvl" style={{ color: 'var(--color-red)', fontWeight: 600 }}>{active.rejectedReason}</div>
                    </div>
                  )}
                </>
              )}

              {/* Material Breakdown table */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '18px 0 10px', paddingTop: 12, borderTop: '2px solid var(--color-w2w-light)' }}>
                Material Breakdown
              </div>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Verified Tonnage</th>
                      <th>Price/kg</th>
                      <th>Est. Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawWasteTypes.map(wt => {
                      const bd = active.data?.materialBreakdown || {};
                      const tons = bd[wt.id] ?? 0;
                      const price = wt.pricePerKg || wt.pricePerUnit || 0;
                      const revenue = tons * 1000 * price;
                      return (
                        <tr key={wt.id}>
                          <td style={{ fontWeight: 600 }}>{wt.name}</td>
                          <td>{tons.toFixed(1)}t</td>
                          <td>R{price.toFixed(2)}/kg</td>
                          <td style={{ fontWeight: 600 }}>R {revenue.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ fontWeight: 700, background: 'var(--color-surface2)' }}>
                      <td>TOTAL</td>
                      <td>{(active.totalTonnes || 0).toFixed(1)}t</td>
                      <td></td>
                      <td>R {(active.totalRevenue || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button>
              {active.status === 'SUBMITTED' && canApprove('epr-reports') && active.createdById !== currentUserId && (
                <>
                  <button className="btn btn-primary" onClick={() => approveMut.mutate(active.id)} disabled={approveMut.isPending}>
                    <Check size={13} /> Approve
                  </button>
                  <button className="btn btn-ghost" style={{ color: 'var(--color-red)' }} onClick={() => { setModal(null); setTimeout(() => openReject(active), 100); }}>
                    <XCircle size={13} /> Reject
                  </button>
                </>
              )}
              {active.status === 'REJECTED_REPORT' && active.createdById === currentUserId && canEdit('epr-reports') && (
                <button className="btn btn-primary" onClick={() => { setModal(null); setTimeout(() => openEdit(active), 100); }}>
                  <Edit2 size={13} /> Revise & Resubmit
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={13} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Create / Edit Report Modal ═══ */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 800 }} onClick={e => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modal === 'edit' ? 'Revise & Resubmit EPR Report' : 'Create Monthly EPR Report'}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {modal === 'edit' && active?.rejectedReason && (
                <div className="alert alert-red" style={{ marginBottom: 16 }}>
                  <b>Rejection reason:</b> {active.rejectedReason}
                </div>
              )}
              <div className="fgrid">
                <div className="fg">
                  <label className="fl">Report From Date <span className="req">*</span></label>
                  <input className="fc" type="date" value={form.dateFrom}
                    onChange={e => setForm(p => ({ ...p, dateFrom: e.target.value }))} />
                </div>
                <div className="fg">
                  <label className="fl">Report To Date <span className="req">*</span></label>
                  <input className="fc" type="date" value={form.dateTo}
                    onChange={e => setForm(p => ({ ...p, dateTo: e.target.value }))} />
                </div>
                <div className="fg">
                  <label className="fl">Site <span className="req">*</span></label>
                  <select className="fc" value={form.siteId}
                    onChange={e => setForm(p => ({ ...p, siteId: e.target.value }))}>
                    <option value="">— Select site —</option>
                    {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="fg">
                  <label className="fl">Buyer Confirmation</label>
                  <select className="fc" value={form.buyerConfirmation}
                    onChange={e => setForm(p => ({ ...p, buyerConfirmation: e.target.value }))}>
                    <option value="">— Select PRO Partner —</option>
                    {(loadGeography().proPartners || []).map((p: any) => (
                      <option key={p.id} value={`${p.name} — signed`}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="fg full">
                  <label className="fl">Traceability Reference</label>
                  <input className="fc" type="text" placeholder="TR-2026-XX-XXX" value={form.traceabilityRef}
                    onChange={e => setForm(p => ({ ...p, traceabilityRef: e.target.value }))} />
                </div>
              </div>

              {/* Material Breakdown */}
              <div className="fsec">Material Breakdown (tonnes)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
                {rawWasteTypes.map(wt => (
                  <div className="fg" key={wt.id} style={{ marginBottom: 0 }}>
                    <label className="fl">{wt.name}</label>
                    <input className="fc" type="number" step={0.1} min={0}
                      value={form.materialBreakdown[wt.id] || 0}
                      onChange={e => updateMaterial(wt.id, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={modal === 'edit' ? handleEdit : handleCreate}
                disabled={!form.dateFrom || !form.dateTo || createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? 'Submitting…' : modal === 'edit' ? 'Resubmit Report' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Reject Modal ═══ */}
      {modal === 'reject' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Reject EPR Report</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--color-text2)' }}>
                Rejecting EPR report for <b>{active.month}/{active.year}</b> submitted by <b>{active.createdByUser?.name || '—'}</b>.
              </div>
              <div className="fg">
                <label className="fl">Rejection Reason <span className="req">*</span></label>
                <textarea className="fc" rows={3} value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Explain why this report is being rejected…" />
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--color-red)' }}
                disabled={!rejectReason.trim() || rejectMut.isPending}
                onClick={() => rejectMut.mutate({ id: active.id, reason: rejectReason })}>
                {rejectMut.isPending ? 'Rejecting…' : 'Reject Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
