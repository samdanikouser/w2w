import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, wasteTypesApi, sitesApi, wasteLogsApi } from '../api/endpoints';
import { ScanLine, CheckCircle2, X } from 'lucide-react';
import { StatCard } from './SitesPage';

export default function DepotScannerPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [matched, setMatched] = useState<any>(null);
  const [siteId, setSiteId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const { data: typesData = [] } = useQuery({ queryKey: ['waste-types'], queryFn: () => wasteTypesApi.list() });
  const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: logData } = useQuery({ queryKey: ['waste-logs', 'today'], queryFn: () => wasteLogsApi.list({}) });

  const employees: any[] = empData?.data || [];
  const wasteTypes: any[] = Array.isArray(typesData) ? (typesData as any[]) : (typesData as any)?.data || [];
  const sites: any[] = Array.isArray(sitesData) ? (sitesData as any[]) : (sitesData as any)?.data || [];
  const logs: any[] = logData?.data || [];

  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = useMemo(() => logs.filter((l: any) => l.date?.startsWith(today)), [logs, today]);
  const todayKg = todayLogs.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const todayValue = todayLogs.reduce((s, l) => s + (Number(l.totalValue) || 0), 0);

  const createMut = useMutation({
    mutationFn: () => wasteLogsApi.create({
      date: today,
      siteId: siteId || null,
      wasteTypeId: typeId || null,
      quantity: parseFloat(qty) || 0,
      pricePerUnit: parseFloat(price) || 0,
      collectorId: matched?.id || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waste-logs'] });
      setToast(`Logged ${qty} kg for ${matched?.firstName} ${matched?.lastName}.`);
      setQty(''); setPrice(''); setTypeId(''); setMatched(null); setCode('');
      setTimeout(() => setToast(null), 4000);
    },
  });

  const lookup = () => {
    const query = code.trim().toLowerCase();
    if (!query) return;
    const emp = employees.find(
      (e: any) =>
        e.empNo?.toLowerCase() === query ||
        e.id?.toLowerCase() === query ||
        `${e.firstName} ${e.lastName}`.toLowerCase() === query,
    );
    if (emp) {
      setMatched(emp);
      setToast(null);
    } else {
      setMatched(null);
      setToast(`No employee found for "${code}".`);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const onTypeChange = (id: string) => {
    setTypeId(id);
    const t = wasteTypes.find((w: any) => w.id === id);
    if (t?.pricePerUnit != null) setPrice(String(t.pricePerUnit));
  };

  const submit = () => {
    if (!matched || !typeId || !qty) return;
    createMut.mutate();
  };

  const fmt = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Depot Scanner</div>
          <div className="ps">Scan a collector's W2W QR / employee badge to log an intake delivery</div>
        </div>
      </div>

      {toast && (
        <div className="alert alert-green" style={{ marginBottom: 12 }}>
          <CheckCircle2 size={14} /> <span>{toast}</span>
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Scans Today" value={String(todayLogs.length)} sub="Intake events" icon="📷" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Intake Volume" value={todayKg.toFixed(1) + 'kg'} sub="Across categories" icon="⚖" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Value Captured" value={fmt(todayValue)} sub="Today's totals" icon="💰" rail="sc-purple" color="var(--color-purple)" />
        <StatCard label="Unique Collectors" value={String(new Set(todayLogs.map((l: any) => l.collectorId).filter(Boolean)).size)} sub="Visiting today" icon="👷" rail="sc-amber" color="var(--color-amber)" />
      </div>

      <div className="g2">
        <div className="card">
          <div className="ch"><div className="ct">Scanner</div><div className="cs">Aim camera at QR or enter manually</div></div>
          <div className="cb">
            <div style={{
              background: 'var(--color-ink)',
              borderRadius: 14,
              padding: 24,
              textAlign: 'center',
              marginBottom: 14,
            }}>
              <div style={{
                width: 220, height: 220,
                border: '3px solid var(--color-accent)',
                borderRadius: 12,
                margin: '0 auto 14px',
                position: 'relative',
                background: 'rgba(0,200,150,0.04)',
              }}>
                <ScanLine size={68} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)', color: 'rgba(0,200,150,0.55)',
                }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                Live scanner — connect camera permission to enable
              </div>
            </div>

            <div className="fg">
              <label className="fl">Manual Entry — Employee # or Name</label>
              <input
                className="fc"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="e.g. W2W-0004 or Lindiwe Zulu"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={lookup}
              disabled={!code.trim()}
            >
              Look up collector →
            </button>

            {matched && (
              <div style={{
                marginTop: 14,
                padding: 12,
                background: 'var(--color-w2w-pale)',
                border: '1px solid var(--color-w2w-light)',
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--color-green)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{matched.firstName} {matched.lastName}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text3)', fontFamily: 'var(--font-mono)' }}>{matched.empNo}</div>
                  </div>
                  <button className="mc" onClick={() => setMatched(null)}><X size={14} /></button>
                </div>
                <div className="fgrid">
                  <div className="fg"><label className="fl">Site</label>
                    <select className="fc" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                      <option value="">— Select —</option>
                      {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="fg"><label className="fl">Waste Type</label>
                    <select className="fc" value={typeId} onChange={(e) => onTypeChange(e.target.value)}>
                      <option value="">— Select —</option>
                      {wasteTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="fg"><label className="fl">Qty (kg)</label>
                    <input className="fc" type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></div>
                  <div className="fg"><label className="fl">Price/kg (R)</label>
                    <input className="fc" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
                </div>
                {qty && price && (
                  <div style={{ fontSize: 11, marginBottom: 8 }}>
                    Estimated value: <b style={{ color: 'var(--color-green)' }}>{fmt(parseFloat(qty) * parseFloat(price))}</b>
                  </div>
                )}
                <button
                  className="btn btn-accent"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={submit}
                  disabled={!typeId || !qty || createMut.isPending}
                >
                  {createMut.isPending ? 'Logging…' : 'Log Intake →'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="ch"><div className="ct">Today's Scans</div><div className="cs">Latest first</div></div>
          <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayLogs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text3)', padding: 24, fontSize: 12 }}>
                No intakes recorded today.
              </div>
            ) : (
              todayLogs.slice(0, 10).map((l: any) => {
                const collName = l.collector ? `${l.collector.firstName} ${l.collector.lastName}` : 'Unknown';
                const time = new Date(l.createdAt || l.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={l.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: 10,
                    background: 'var(--color-surface2)', borderRadius: 8,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'var(--color-w2w-pale)', color: 'var(--color-w2w)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
                    }}>{time}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{collName} <span style={{ color: 'var(--color-text3)', fontWeight: 400, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.collector?.empNo || ''}</span></div>
                      <div style={{ fontSize: 11, color: 'var(--color-text2)' }}>{l.wasteType?.name || '—'} · {l.quantity} kg</div>
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--color-green)', fontSize: 13 }}>{fmt(Number(l.totalValue) || 0)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
