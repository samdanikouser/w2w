import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { employeesApi, sitesApi, depotsApi, wasteLogsApi, wasteTypesApi } from '../api/endpoints';

function genDN() {
  return 'DN-' + String(Math.floor(Math.random() * 90000) + 10000);
}

export default function DepotScannerPage() {
  const qc = useQueryClient();

  /* ─── state ─── */
  const [scanId, setScanId] = useState('');
  const [foundEmployee, setFoundEmployee] = useState<any>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [depotId, setDepotId] = useState('');
  const [wasteInputs, setWasteInputs] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ─── queries ─── */
  const { data: empData } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesApi.list({}),
  });
  const { data: sitesData = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });
  const { data: depotsData = [] } = useQuery({
    queryKey: ['depots'],
    queryFn: () => depotsApi.list(),
  });
  const { data: logData } = useQuery({
    queryKey: ['waste-logs', 'today'],
    queryFn: () => wasteLogsApi.list({}),
  });
  const { data: wasteTypesData = [] } = useQuery({
    queryKey: ['waste-types'],
    queryFn: () => wasteTypesApi.list(),
  });

  const employees: any[] = empData?.data || [];
  const sites: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const depots: any[] = Array.isArray(depotsData) ? depotsData : (depotsData as any)?.data || [];
  const logs: any[] = logData?.data || [];

  const wasteTypes = Array.isArray(wasteTypesData) ? wasteTypesData : (wasteTypesData as any)?.data || [];

  /* today's logs */
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = useMemo(() => {
    const dailyLogs = logs
      .filter((l: any) => l.date?.startsWith(today) || l.createdAt?.startsWith(today))
      .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

    // Group by DN Ref
    const grouped = new Map<string, any>();
    dailyLogs.forEach((l: any) => {
      const dnMatch = l.notes?.match(/Ref:\s*(DN-\d+)/);
      const dnRef = dnMatch ? dnMatch[1] : `TEMP-${l.id}`;
      
      if (!grouped.has(dnRef)) {
        grouped.set(dnRef, { ...l, dnRef, totalQuantity: 0, categories: [] });
      }
      
      const g = grouped.get(dnRef);
      g.totalQuantity += Number(l.quantity) || 0;
      g.categories.push(l);
    });
    
    return Array.from(grouped.values());
  }, [logs, today]);

  /* ─── derived ─── */
  const totalKg = useMemo(
    () => Object.values(wasteInputs).reduce((s, v) => s + v, 0),
    [wasteInputs],
  );
  const totalValue = useMemo(
    () => wasteTypes.reduce((s: number, c: any) => s + (wasteInputs[c.id] || 0) * (c.pricePerUnit || 0), 0),
    [wasteInputs, wasteTypes],
  );

  /* ─── mutation ─── */
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFoundEmployee(null);
    setScanId('');
    setNotFound(null);
    setDepotId('');
    setNotes('');
    setWasteInputs({});
  };

  /* ─── helpers ─── */


  const lookup = () => {
    const q = scanId.trim().toLowerCase();
    if (!q) return;
    const emp = employees.find((e: any) => 
      e.empNo?.toLowerCase() === q || 
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)
    );
    if (emp) {
      setFoundEmployee(emp);
      setNotFound(null);
    } else {
      setFoundEmployee(null);
      setNotFound(scanId.trim());
    }
  };

  const submit = async () => {
    if (!foundEmployee || totalKg <= 0) return;
    setIsSubmitting(true);

    try {
      const dnRef = genDN();
      
      const activeCats = wasteTypes.filter((c: any) => wasteInputs[c.id] > 0);
      
      const promises = activeCats.map((c: any) => {
        const qty = wasteInputs[c.id];
        const noteStr = [
          `Ref: ${dnRef}`,
          notes ? `Notes: ${notes}` : '',
        ].filter(Boolean).join(' | ');

        return wasteLogsApi.create({
          date: today,
          siteId: depotId || null,
          quantity: qty,
          unit: c.unit || 'kg',
          pricePerUnit: c.pricePerUnit,
          wasteTypeId: c.id,
          collectorId: foundEmployee.id,
          notes: noteStr,
        });
      });

      await Promise.all(promises);
      
      qc.invalidateQueries({ queryKey: ['waste-logs'] });
      setSuccessMsg(`Collection logged — ${totalKg} kg · R ${totalValue.toFixed(2)} · ${dnRef}`);
      resetForm();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error(err);
      alert("Failed to submit collection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const setWaste = (code: string, val: number) => {
    setWasteInputs((prev) => ({ ...prev, [code]: val < 0 ? 0 : val }));
  };

  const initials = (e: any) => {
    const f = (e.firstName || '')[0] || '';
    const l = (e.lastName || '')[0] || '';
    return (f + l).toUpperCase();
  };

  const empSite = (e: any) => {
    const s = sites.find((s: any) => s.id === e.siteId);
    return s?.name || '—';
  };

  const empTotalCollected = (e: any) => {
    const empLogs = logs.filter((l: any) => l.collectorId === e.id);
    return empLogs.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Depot Scanner</div>
          <div className="ps">
            Scan or enter employee ID · capture waste per category · submit delivery note
          </div>
        </div>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="alert alert-green" style={{ marginBottom: 14 }}>
          ✓ {successMsg}
        </div>
      )}

      {/* ── 2-Column Layout ── */}
      <div className="g2">
        {/* ═════ LEFT: Employee Lookup ═════ */}
        <div className="card">
          <div className="ch">
            <div className="ct">Employee Lookup</div>
          </div>
          <div className="cb">
            {/* Info alert */}
            <div
              className="alert alert-blue"
              style={{ marginBottom: 16, fontSize: 12 }}
            >
              ℹ️ Enter the employee's ID number (e.g. W2W-002) or their name. The waste submission
              will be linked to their performance record.
            </div>

            {/* Search row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                className="fc"
                list="employee-suggestions"
                value={scanId}
                onChange={(e) => setScanId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && lookup()}
                placeholder="Search by Employee ID or Name..."
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                }}
              />
              <datalist id="employee-suggestions">
                {employees.map((e: any) => (
                  <option key={e.id} value={e.empNo}>
                    {e.firstName} {e.lastName} ({e.department || 'No Dept'})
                  </option>
                ))}
              </datalist>
              <button
                className="btn btn-primary"
                onClick={lookup}
                disabled={!scanId.trim()}
              >
                🔍 Look Up
              </button>
            </div>

            {/* Not found */}
            {notFound && (
              <div className="alert alert-red" style={{ marginBottom: 14 }}>
                Employee not found: <b>{notFound}</b>. Check the ID and try again.
              </div>
            )}

            {/* ── Employee found ── */}
            {foundEmployee && (
              <>
                {/* Green verification banner */}
                <div
                  style={{
                    background: 'rgba(76, 175, 80, 0.08)',
                    border: '1px solid rgba(76, 175, 80, 0.25)',
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: '#4CAF50',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      {initials(foundEmployee)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {foundEmployee.firstName} {foundEmployee.lastName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text3)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <span>{foundEmployee.role || foundEmployee.department || 'Collector'}</span>
                        <span>·</span>
                        <span
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {foundEmployee.empNo}
                        </span>
                        <span>·</span>
                        <span>{empSite(foundEmployee)}</span>
                        <span>·</span>
                        <span>
                          Total: {empTotalCollected(foundEmployee).toFixed(1)} kg
                        </span>
                      </div>
                    </div>

                    {/* Verified badge */}
                    <span
                      style={{
                        background: '#4CAF50',
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Verified ✓
                    </span>
                  </div>
                </div>

                {/* Depot dropdown */}
                <div className="fg" style={{ marginBottom: 14 }}>
                  <label className="fl">Depot / Collection Point</label>
                  <select
                    className="fc"
                    value={depotId}
                    onChange={(e) => setDepotId(e.target.value)}
                  >
                    <option value="">— Select depot —</option>
                    {depots.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Waste categories header */}
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginBottom: 10,
                    borderBottom: '1px solid var(--color-border)',
                    paddingBottom: 6,
                  }}
                >
                  Waste by Category (kg)
                </div>

                {/* 3-column grid of waste inputs */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {wasteTypes.map((cat: any) => (
                    <div key={cat.id}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: cat.colour || '#146484',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        {cat.name} <span style={{color: 'var(--color-text3)', fontSize: 9}}>({cat.unit})</span>
                      </label>
                      <input
                        className="fc"
                        type="number"
                        min={0}
                        value={wasteInputs[cat.id] || ''}
                        onChange={(e) =>
                          setWaste(cat.id, parseFloat(e.target.value) || 0)
                        }
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                </div>

                {/* Total weight bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--color-surface3)',
                    borderRadius: 8,
                    marginBottom: 14,
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  <span>Total Weight:</span>
                  <span>
                    {totalKg.toFixed(1)} kg{' '}
                    <span
                      style={{
                        fontWeight: 400,
                        fontSize: 11,
                        color: 'var(--color-text3)',
                      }}
                    >
                      · R {totalValue.toFixed(2)}
                    </span>
                  </span>
                </div>

                {/* Notes */}
                <div className="fg" style={{ marginBottom: 14 }}>
                  <label className="fl">Notes (optional)</label>
                  <input
                    className="fc"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes…"
                  />
                </div>

                {/* Submit */}
                <button
                  className="btn btn-accent"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={submit}
                  disabled={totalKg <= 0 || isSubmitting}
                >
                  {isSubmitting
                    ? 'Submitting…'
                    : '✓ Submit Collection & Generate Delivery Note'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ═════ RIGHT: Today's Submissions ═════ */}
        <div className="card">
          <div className="ch">
            <div className="ct">Today's Submissions</div>
            <div className="cs">Last 10 depot-scanned entries</div>
          </div>
          <div className="cb">
            {todayLogs.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text3)',
                  padding: 32,
                  fontSize: 12,
                }}
              >
                No submissions today
              </div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Total (t)</th>
                      <th>Time</th>
                      <th>Depot</th>
                      <th>DN Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayLogs.slice(0, 10).map((l: any) => {
                      const collName = l.collector
                        ? `${l.collector.firstName} ${l.collector.lastName}`
                        : 'Unknown';
                      const time = new Date(
                        l.createdAt || l.date,
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const depotName =
                        l.site?.name ||
                        sites.find((s: any) => s.id === l.siteId)?.name ||
                        '—';
                      const tons = ((Number(l.totalQuantity) || 0) / 1000).toFixed(3);
                      return (
                        <tr key={l.dnRef}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>
                              {collName}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: 'var(--color-text3)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {l.collector?.empNo || ''}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{tons}</td>
                          <td>{time}</td>
                          <td style={{ fontSize: 11 }}>{depotName}</td>
                          <td>
                            <span
                              className="badge bb"
                              style={{ fontSize: 10 }}
                            >
                              {l.dnRef}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
