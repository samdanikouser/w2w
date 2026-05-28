import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, attendanceApi, sitesApi, type AttendancePayload } from '../api/endpoints';
import { Plus, X } from 'lucide-react';
import { StatCard, FilterInput } from './SitesPage';
import { exportCsv } from '../utils/csv';

type Cell = 'P' | 'L' | 'A' | 'O' | 'H' | 'W' | '';

const STATUS_TO_CELL: Record<string, Cell> = {
  PRESENT: 'P',
  LATE: 'L',
  ABSENT: 'A',
  LEAVE: 'O',
  HALF_DAY: 'H',
};
const CELL_COLOR: Record<Cell, string> = {
  P: 'var(--color-green)',
  L: 'var(--color-amber)',
  A: 'var(--color-red)',
  O: 'var(--color-purple)',
  H: 'var(--color-w2w)',
  W: 'var(--color-text3)',
  '': 'var(--color-text3)',
};

function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const ini = (first?: string, last?: string) =>
  ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '—';

const fmtTime = (dt: string | null | undefined): string => {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return '—'; }
};

export default function AttendancePage() {
  const qc = useQueryClient();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // ── Filters ──
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [dateFilter, setDateFilter] = useState('');
  const [empFilter, setEmpFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AttendancePayload>({
    employeeId: '',
    date: todayStr,
    status: 'PRESENT',
  });

  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const { data: sitesData } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance', month],
    queryFn: () => attendanceApi.list({ month }),
  });

  const employees: any[] = empData?.data || [];
  const records: any[] = attendanceData as any[];
  const sitesRaw: any[] = Array.isArray(sitesData) ? sitesData : (sitesData as any)?.data || [];
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    sitesRaw.forEach((s: any) => m.set(s.id, s.name));
    return m;
  }, [sitesRaw]);

  const createMut = useMutation({
    mutationFn: (p: AttendancePayload) => attendanceApi.upsert(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); setShowAdd(false); },
  });

  // ── Grid for month view ──
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const grid = useMemo(() => {
    return employees
      .filter((e: any) => e.status === 'ACTIVE')
      .map((e: any) => {
        const cells: Cell[] = days.map((d) => {
          const dow = new Date(year, monthNum - 1, d).getDay();
          if (dow === 0 || dow === 6) return 'W';
          const rec = records.find(
            (r: any) =>
              r.employeeId === e.id &&
              new Date(r.date).getDate() === d &&
              new Date(r.date).getMonth() + 1 === monthNum,
          );
          return rec ? (STATUS_TO_CELL[rec.status] || '') : '';
        });
        const present = cells.filter((c) => c === 'P').length;
        const late = cells.filter((c) => c === 'L').length;
        const absent = cells.filter((c) => c === 'A').length;
        const leave = cells.filter((c) => c === 'O').length;
        return { emp: e, cells, present, late, absent, leave };
      });
  }, [employees, records, days, year, monthNum]);

  const gridFiltered = grid.filter((r) =>
    !search || `${r.emp.firstName} ${r.emp.lastName} ${r.emp.empNo}`.toLowerCase().includes(search.toLowerCase()),
  );

  const total = grid.reduce((s, r) => s + r.present + r.late + r.absent + r.leave, 0);
  const totalPresent = grid.reduce((s, r) => s + r.present, 0);
  const attendancePct = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

  // ── Today's check-in records (matching prototype's table view) ──
  const todayRecords = useMemo(() => {
    return records
      .filter((r: any) => {
        const d = new Date(r.date).toISOString().slice(0, 10);
        // Apply date or month filter
        if (dateFilter) return d === dateFilter;
        return d.startsWith(month);
      })
      .filter((r: any) => !empFilter || r.employeeId === empFilter)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, dateFilter, empFilter, month]);

  // Stats for filtered records
  const filteredComplete = todayRecords.filter((r: any) => r.clockIn && r.clockOut).length;
  const filteredTotalHrs = todayRecords.reduce((s: number, r: any) => {
    if (r.clockIn && r.clockOut) {
      return s + (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / (1000 * 60 * 60);
    }
    return s;
  }, 0);
  const avgHrs = filteredComplete > 0 ? (filteredTotalHrs / filteredComplete).toFixed(1) : '0';

  const handleReset = () => {
    setMonth(today.toISOString().slice(0, 7));
    setDateFilter('');
    setEmpFilter('');
    setSearch('');
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="ph">
        <div>
          <div className="pt">Attendance Report</div>
          <div className="ps">Check-in and check-out records · All sites</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-accent" onClick={() => setShowAdd(true)}><Plus size={13} /> Record Attendance</button>
          <button className="btn btn-ghost" onClick={() => exportCsv(`attendance-${month}`, todayRecords.map((r: any) => {
            const emp = employees.find((e: any) => e.id === r.employeeId);
            const hrs = r.clockIn && r.clockOut
              ? ((new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / (1000 * 60 * 60)).toFixed(1)
              : '';
            return {
              date: new Date(r.date).toISOString().slice(0, 10),
              employee: emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId,
              site: emp?.siteId ? siteMap.get(emp.siteId) || '—' : '—',
              checkIn: fmtTime(r.clockIn),
              checkOut: fmtTime(r.clockOut),
              hours: hrs,
              status: r.clockOut ? 'Complete' : r.clockIn ? 'Active' : r.status,
            };
          }), [
            { key: 'date', label: 'Date' },
            { key: 'employee', label: 'Employee' },
            { key: 'site', label: 'Site' },
            { key: 'checkIn', label: 'Check-In' },
            { key: 'checkOut', label: 'Check-Out' },
            { key: 'hours', label: 'Hours' },
            { key: 'status', label: 'Status' },
          ])}>📥 Export to Excel</button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        <StatCard label="Attendance Rate" value={attendancePct + '%'} sub="Across the month" icon="📅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Total Present" value={String(totalPresent)} sub="Person-days" icon="✅" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Late Arrivals" value={String(grid.reduce((s, r) => s + r.late, 0))} sub="This month" icon="⏰" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Absences" value={String(grid.reduce((s, r) => s + r.absent, 0))} sub="Unauthorised" icon="❌" rail="sc-red" color="var(--color-red)" />
      </div>

      {/* ── Filter Bar (matches prototype) ── */}
      <div className="card mb14">
        <div className="cb" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="fg" style={{ flex: 1, minWidth: 160 }}>
            <label className="fl">Filter by Month</label>
            <input
              className="fc"
              type="month"
              value={dateFilter ? '' : month}
              onChange={(e) => { setMonth(e.target.value || today.toISOString().slice(0, 7)); setDateFilter(''); }}
            />
          </div>
          <div className="fg" style={{ flex: 1, minWidth: 160 }}>
            <label className="fl">Filter by Date</label>
            <input
              className="fc"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                if (e.target.value) {
                  // Set month to match the date so records load
                  setMonth(e.target.value.slice(0, 7));
                }
              }}
            />
          </div>
          <div className="fg" style={{ flex: 1, minWidth: 160 }}>
            <label className="fl">Employee</label>
            <select className="fc" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
              <option value="">All Employees</option>
              {employees.filter((e: any) => e.status === 'ACTIVE').map((e: any) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <button className="btn btn-ghost" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </div>

      {/* ── Check-in Records Table (prototype style) ── */}
      <div className="card mb14" id="att-table-card">
        {todayRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text3)' }}>
            No attendance records for the selected period.<br />
            <span style={{ fontSize: 11 }}>Records are created when field workers check in via the mobile app.</span>
          </div>
        ) : (
          <>
            <div className="ch">
              <div className="ct">Attendance Records ({todayRecords.length})</div>
              <div className="cs">{filteredComplete} complete · Avg {avgHrs}h/shift</div>
            </div>
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Employee</th>
                    <th>Site</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayRecords.map((r: any, idx: number) => {
                    const emp = employees.find((e: any) => e.id === r.employeeId);
                    const site = emp?.siteId ? siteMap.get(emp.siteId) || '—' : emp?.site?.name || '—';
                    const hasIn = !!r.clockIn;
                    const hasOut = !!r.clockOut;
                    let hrs = '—';
                    let statusLabel = r.status || 'No Record';
                    let statusColor = 'var(--color-amber)';
                    if (hasIn && hasOut) {
                      const diff = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / (1000 * 60 * 60);
                      hrs = diff.toFixed(1) + 'h';
                      statusLabel = 'Complete';
                      statusColor = 'var(--color-green)';
                    } else if (hasIn) {
                      statusLabel = 'Active';
                      statusColor = 'var(--color-amber)';
                    }

                    return (
                      <tr key={r.id || idx}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {new Date(r.date).toISOString().slice(0, 10)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            {emp && (
                              <div className="avt" style={{ width: 24, height: 24, fontSize: 9, background: avatarColor(emp.id) }}>
                                {ini(emp.firstName, emp.lastName)}
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>
                                {emp ? `${emp.firstName} ${emp.lastName}` : r.employeeId}
                              </div>
                              {emp && (
                                <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>
                                  {emp.role || emp.department || '—'}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 11 }}>{site}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-green)', fontWeight: 600 }}>
                          {fmtTime(r.clockIn)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-red)', fontWeight: 600 }}>
                          {fmtTime(r.clockOut)}
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {hasIn && !hasOut
                            ? <span style={{ color: 'var(--color-amber)' }}>In Progress</span>
                            : hrs}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: statusColor + '22',
                              color: statusColor,
                              border: `1px solid ${statusColor}44`,
                              fontSize: 10,
                            }}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Monthly Grid ── */}
      <div className="card">
        <div className="ch">
          <div className="ct">Daily Attendance Grid · {month}</div>
          <FilterInput value={search} onChange={setSearch} placeholder="Filter employees…" />
        </div>
        <div className="tw">
          <table style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--color-surface2)', zIndex: 1 }}>Employee</th>
                {days.map((d) => <th key={d} style={{ textAlign: 'center', padding: '6px 4px', minWidth: 22 }}>{d}</th>)}
                <th>P</th><th>L</th><th>A</th><th>O</th>
              </tr>
            </thead>
            <tbody>
              {gridFiltered.length === 0 ? (
                <tr><td colSpan={days.length + 5} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>No active employees.</td></tr>
              ) : (
                gridFiltered.map((r) => (
                  <tr key={r.emp.id}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--color-surface)', fontWeight: 600 }}>
                      {r.emp.firstName} {r.emp.lastName}
                    </td>
                    {r.cells.map((c, i) => (
                      <td key={i} style={{
                        textAlign: 'center',
                        padding: '6px 0',
                        fontWeight: 700,
                        fontSize: 10,
                        color: CELL_COLOR[c],
                      }}>{c || '·'}</td>
                    ))}
                    <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>{r.present}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-amber)' }}>{r.late}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-red)' }}>{r.absent}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-purple)' }}>{r.leave}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="cf">
          <span style={{ fontSize: 10, color: 'var(--color-text3)' }}>
            Legend: <b style={{ color: 'var(--color-green)' }}>P</b> Present · <b style={{ color: 'var(--color-amber)' }}>L</b> Late · <b style={{ color: 'var(--color-red)' }}>A</b> Absent · <b style={{ color: 'var(--color-purple)' }}>O</b> On leave · <b style={{ color: 'var(--color-w2w)' }}>H</b> Half-day · W Weekend · · No record
          </span>
        </div>
      </div>

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="modal-ov open" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Record Attendance</span>
              <button onClick={() => setShowAdd(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full"><div className="fg"><label className="fl">Employee <span className="req">*</span></label>
                  <select className="fc" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    <option value="">— Select —</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.empNo})</option>)}
                  </select>
                </div></div>
                <div className="fg"><label className="fl">Date</label>
                  <input className="fc" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="fg"><label className="fl">Status</label>
                  <select className="fc" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="PRESENT">Present</option>
                    <option value="LATE">Late</option>
                    <option value="ABSENT">Absent</option>
                    <option value="HALF_DAY">Half Day</option>
                    <option value="LEAVE">On Leave</option>
                  </select>
                </div>
                <div className="fg"><label className="fl">Clock In</label>
                  <input className="fc" type="time" onChange={(e) => setForm({ ...form, clockIn: e.target.value ? `${form.date}T${e.target.value}` : null })} /></div>
                <div className="fg"><label className="fl">Clock Out</label>
                  <input className="fc" type="time" onChange={(e) => setForm({ ...form, clockOut: e.target.value ? `${form.date}T${e.target.value}` : null })} /></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { if (form.employeeId) createMut.mutate(form); }} disabled={createMut.isPending}>
                {createMut.isPending ? 'Saving…' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
