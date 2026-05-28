import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sitesApi, wasteTypesApi } from '../api/endpoints';
import { Plus, X, Eye, Printer } from 'lucide-react';
import { loadGeography } from '../utils/geography';









const MATERIALS: Record<MaterialCode, MaterialMeta> = {
  PET:       { label: 'PET',       pricePerKg: 4.50, priceDisplay: 'R4.50/kg', buyer: 'Petco' },
  HDPE:      { label: 'HDPE',      pricePerKg: 3.80, priceDisplay: 'R3.80/kg', buyer: 'Polyco' },
  LDPE:      { label: 'LDPE',      pricePerKg: 2.20, priceDisplay: 'R2.20/kg', buyer: 'Polyco' },
  PP:        { label: 'PP',        pricePerKg: 2.80, priceDisplay: 'R2.80/kg', buyer: 'Polyco' },
  METAL:     { label: 'METAL',     pricePerKg: 4.80, priceDisplay: 'R4.80/kg', buyer: 'Metpac' },
  PAPER:     { label: 'PAPER',     pricePerKg: 1.20, priceDisplay: 'R1.20/kg', buyer: 'Fibre Cycle' },
  CARDBOARD: { label: 'CARDBOARD', pricePerKg: 1.00, priceDisplay: 'R1.00/kg', buyer: 'Fibre Cycle' },
  GLASS:     { label: 'GLASS',     pricePerKg: 0.85, priceDisplay: 'R0.85/kg', buyer: 'Consol' },
  EWASTE:    { label: 'EWASTE',    pricePerKg: 8.50, priceDisplay: 'R8.50/kg', buyer: 'E-Wasa' },
  OTHER:     { label: 'OTHER',     pricePerKg: 0.30, priceDisplay: 'R0.30/kg', buyer: 'TBD' },
};

/* ═══════════════════════════════════════════════════════
   EPR Report Data Model (localStorage-backed)
   ═══════════════════════════════════════════════════════ */

type EprStatus = 'Submitted' | 'Overdue' | 'Draft';

type MaterialBreakdown = Record<string, number>;

interface EprReport {
  id: string;
  month: string;
  dateFrom: string;
  dateTo: string;
  siteId: string;
  preparedBy: string;
  submittedDate: string;
  status: EprStatus;
  materialBreakdown: MaterialBreakdown;
  verifiedTonnage: number;
  buyerConfirmation: string;
  traceabilityRef: string;
  eprCompliant: boolean;
  notes: string;
}

const LS_KEY = 'w2w_epr_reports';

const SEED_REPORTS: EprReport[] = [];

function loadReports(): EprReport[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as EprReport[];
  } catch { /* ignore */ }
  localStorage.setItem(LS_KEY, JSON.stringify(SEED_REPORTS));
  return [...SEED_REPORTS];
}

function saveReports(reports: EprReport[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(reports));
}

/* ═══════════════════════════════════════════════════════
   Helper functions
   ═══════════════════════════════════════════════════════ */

function emptyBreakdown(types: any[] = []): MaterialBreakdown {
  const bd: Record<string, number> = {};
  types.forEach(t => bd[t.id] = 0);
  return bd;
}

function sumBreakdown(bd: MaterialBreakdown): number {
  return Object.values(bd).reduce((s, val) => s + (val || 0), 0);
}

function nextId(reports: EprReport[]): string {
  const nums = reports.map(r => {
    const m = r.id.match(/MR-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  return `MR-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

interface CreateForm {
  dateFrom: string;
  dateTo: string;
  siteId: string;
  buyerConfirmation: string;
  traceabilityRef: string;
  materialBreakdown: MaterialBreakdown;
}



export default function EPRReportsPage() {
  const [reports, setReports] = useState<EprReport[]>(loadReports);
  const [modal, setModal] = useState<'create' | 'view' | null>(null);
  const [active, setActive] = useState<EprReport | null>(null);
  const [form, setForm] = useState<CreateForm>({ dateFrom: '', dateTo: '', siteId: '', buyerConfirmation: '', traceabilityRef: '', materialBreakdown: {} });

  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: wasteTypes = [] } = useQuery({ queryKey: ['waste-types'], queryFn: () => wasteTypesApi.list() });
  const sites: { id: string; name: string; ward?: string; municipalityId?: string }[] =
    Array.isArray(sitesData) ? sitesData : (sitesData as Record<string, unknown>)?.data as { id: string; name: string; ward?: string; municipalityId?: string }[] || [];

  // persist whenever reports change
  useEffect(() => { saveReports(reports); }, [reports]);

  const siteName = useCallback((siteId: string) => {
    if (!siteId) return '—';
    const s = sites.find(x => x.id === siteId);
    return s ? s.name : '—';
  }, [sites]);

  const siteSubText = useCallback((siteId: string) => {
    if (!siteId) return '';
    const s = sites.find(x => x.id === siteId);
    return s?.ward ? s.ward : '';
  }, [sites]);

  /* ── Computed stats ── */
  const submitted = reports.filter(r => r.status === 'Submitted').length;
  const overdue = reports.filter(r => r.status === 'Overdue').length;
  const totalTonnage = reports.reduce((s, r) => s + (r.verifiedTonnage || 0), 0);

  /* ── Material aggregation for the categories card ── */
  const materialTotals: Record<string, number> = {};
  for (const wt of (wasteTypes as any[])) {
    materialTotals[wt.id] = reports.reduce((s, r) => s + (r.materialBreakdown[wt.id] ?? 0), 0);
  }

  /* ── Handlers ── */
  const openCreate = () => {
    setForm({ dateFrom: '', dateTo: '', siteId: '', buyerConfirmation: '', traceabilityRef: '', materialBreakdown: emptyBreakdown(wasteTypes as any[]) });
    setModal('create');
  };

  const openView = (r: EprReport) => {
    setActive(r);
    setModal('view');
  };

  const handleCreate = () => {
    if (!form.dateFrom || !form.dateTo) return;
    const bd = form.materialBreakdown;
    const tonnage = sumBreakdown(bd);
    const monthStr = form.dateFrom.substring(0, 7); // YYYY-MM
    const newReport: EprReport = {
      id: nextId(reports),
      month: monthStr,
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      siteId: form.siteId,
      preparedBy: '', // could be set from auth context
      submittedDate: new Date().toISOString().split('T')[0],
      status: 'Submitted',
      materialBreakdown: { ...bd },
      verifiedTonnage: parseFloat(tonnage.toFixed(1)),
      buyerConfirmation: form.buyerConfirmation,
      traceabilityRef: form.traceabilityRef,
      eprCompliant: tonnage > 0,
      notes: '',
    };
    setReports(prev => [...prev, newReport]);
    setModal(null);
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
        <button className="btn btn-accent" onClick={openCreate}>+ Create Report</button>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="stats-grid">
        <div className="stat-card sc-blue card">
          <div className="stat-label">Reports On File</div>
          <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>{reports.length}</div>
          <div className="stat-sub">{submitted} submitted</div>
        </div>
        <div className="stat-card sc-green card">
          <div className="stat-label">Submitted</div>
          <div className="stat-val" style={{ color: 'var(--color-green)' }}>{submitted}</div>
          <div className="stat-sub">Status = Submitted</div>
        </div>
        <div className="stat-card sc-red card">
          <div className="stat-label">Overdue</div>
          <div className="stat-val" style={{ color: 'var(--color-red)' }}>{overdue}</div>
          <div className="stat-sub">Status = Overdue</div>
        </div>
        <div className="stat-card sc-purple card">
          <div className="stat-label">Total Verified Tonnage</div>
          <div className="stat-val" style={{ color: 'var(--color-purple)' }}>{totalTonnage.toFixed(1)}t</div>
          <div className="stat-sub">All reports combined</div>
        </div>
      </div>

      {/* ═══ Monthly Reports TABLE ═══ */}
      <div className="card mb14">
        <div className="ch">
          <div>
            <div className="ct">Monthly Reports</div>
            <div className="cs">{reports.length} report{reports.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Site</th>
                <th>Prepared By</th>
                <th>Submitted</th>
                <th>Tonnage</th>
                <th>Buyer Confirm</th>
                <th>EPR Status</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text3)' }}>
                    No EPR reports yet. Click &quot;+ Create Report&quot; to get started.
                  </td>
                </tr>
              ) : reports.map(r => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {r.dateFrom && r.dateTo
                        ? `${fmtDate(r.dateFrom)} → ${fmtDate(r.dateTo)}`
                        : r.month}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{siteName(r.siteId)}</div>
                    {siteSubText(r.siteId) && (
                      <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{siteSubText(r.siteId)}</div>
                    )}
                  </td>
                  <td>{r.preparedBy || '—'}</td>
                  <td>{r.submittedDate ? fmtDate(r.submittedDate) : '—'}</td>
                  <td style={{ fontWeight: 700 }}>{r.verifiedTonnage}t</td>
                  <td>{r.buyerConfirmation || '—'}</td>
                  <td>
                    <span className={`badge ${r.eprCompliant ? 'bg' : 'br'}`}>
                      {r.eprCompliant ? 'Compliant' : 'Non-Compliant'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'Submitted' ? 'bg' : r.status === 'Overdue' ? 'br' : 'ba'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openView(r)}>
                      <Eye size={12} /> View
                    </button>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {(wasteTypes as any[]).map(wt => {
              return (
                <div key={wt.id} style={{
                  padding: '12px 14px', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', background: 'var(--color-surface2)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {wt.name}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                    {(materialTotals[wt.id] || 0).toFixed(1)}t
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 4 }}>
                    R{(wt.pricePerKg || 0).toFixed(2)}/kg · {wt.buyer || 'No Buyer'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ View Modal ═══ */}
      {modal === 'view' && active && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">EPR Report — {active.id}</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              {/* Report Details section */}
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Report Details
              </div>
              <div className="drow"><div className="dlb">Report ID</div><div className="dvl">{active.id}</div></div>
              <div className="drow"><div className="dlb">Month</div><div className="dvl" style={{ fontFamily: 'var(--font-mono)' }}>{active.month}</div></div>
              <div className="drow"><div className="dlb">Site</div><div className="dvl">{siteName(active.siteId)}</div></div>
              <div className="drow"><div className="dlb">Prepared By</div><div className="dvl">{active.preparedBy || '—'}</div></div>
              <div className="drow"><div className="dlb">Submitted Date</div><div className="dvl">{active.submittedDate ? fmtDate(active.submittedDate) : '—'}</div></div>
              <div className="drow"><div className="dlb">Traceability Ref</div><div className="dvl" style={{ fontFamily: 'var(--font-mono)' }}>{active.traceabilityRef || '—'}</div></div>
              <div className="drow"><div className="dlb">Buyer Confirmation</div><div className="dvl">{active.buyerConfirmation || '—'}</div></div>
              <div className="drow"><div className="dlb">EPR Compliant</div><div className="dvl"><span className={`badge ${active.eprCompliant ? 'bg' : 'br'}`}>{active.eprCompliant ? 'Yes' : 'No'}</span></div></div>
              <div className="drow" style={{ borderBottom: 'none' }}><div className="dlb">Status</div><div className="dvl"><span className={`badge ${active.status === 'Submitted' ? 'bg' : active.status === 'Overdue' ? 'br' : 'ba'}`}>{active.status}</span></div></div>

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
                    {MATERIAL_CODES.map(code => {
                      const tons = active.materialBreakdown[code] ?? 0;
                      const meta = MATERIALS[code];
                      const revenue = tons * 1000 * meta.pricePerKg; // tons→kg
                      return (
                        <tr key={code}>
                          <td style={{ fontWeight: 600 }}>{meta.label}</td>
                          <td>{tons.toFixed(1)}t</td>
                          <td>{meta.priceDisplay}</td>
                          <td style={{ fontWeight: 600 }}>R {revenue.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ fontWeight: 700, background: 'var(--color-surface2)' }}>
                      <td>TOTAL</td>
                      <td>{active.verifiedTonnage.toFixed(1)}t</td>
                      <td></td>
                      <td>R {(wasteTypes as any[]).reduce((s: number, wt: any) => s + ((active.materialBreakdown[wt.id] ?? 0) * 1000 * (wt.pricePerKg || 0)), 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}><Printer size={13} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Create Report Modal ═══ */}
      {modal === 'create' && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 800 }} onClick={e => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Create Monthly EPR Report</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
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
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 14 }}>
                {(wasteTypes as any[]).map(wt => (
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
              <button className="btn btn-primary" onClick={handleCreate}
                disabled={!form.dateFrom || !form.dateTo}>
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
