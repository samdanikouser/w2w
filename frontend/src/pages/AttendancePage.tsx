import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, attendanceApi, type AttendancePayload } from '../api/endpoints';
import { Download, Plus, X } from 'lucide-react';
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

export default function AttendancePage() {
  const qc = useQueryClient();
  const today = new Date();
  const [month, setMonth] = useState(today.toISOString().slice(0, 7));
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AttendancePayload>({
    employeeId: '',
    date: today.toISOString().slice(0, 10),
    status: 'PRESENT',
  });

  const { data: empData } = useQuery({ queryKey: ['employees', 'all'], queryFn: () => employeesApi.list({}) });
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance', month],
    queryFn: () => attendanceApi.list({ month }),
  });

  const employees: any[] = empData?.data || [];
  const records: any[] = attendanceData as any[];

  const createMut = useMutation({
    mutationFn: (p: AttendancePayload) => attendanceApi.upsert(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); setShowAdd(false); },
  });

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

  const filtered = grid.filter((r) =>
    !search || `${r.emp.firstName} ${r.emp.lastName} ${r.emp.empNo}`.toLowerCase().includes(search.toLowerCase()),
  );

  const total = grid.reduce((s, r) => s + r.present + r.late + r.absent + r.leave, 0);
  const totalPresent = grid.reduce((s, r) => s + r.present, 0);
  const attendancePct = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
  const recordedDays = records.length;

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Attendance Report</div>
          <div className="ps">{employees.length} active employees · {recordedDays} record{recordedDays === 1 ? '' : 's'} logged in {month}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" className="fc" style={{ width: 160 }} value={month} onChange={(e) => setMonth(e.target.value)} />
          <button className="btn btn-accent" onClick={() => setShowAdd(true)}><Plus size={13} /> Record Attendance</button>
          <button className="btn btn-ghost" onClick={() => exportCsv(`attendance-${month}`, filtered.map((r) => ({
            employee: `${r.emp.firstName} ${r.emp.lastName}`,
            empNo: r.emp.empNo,
            month,
            present: r.present,
            late: r.late,
            absent: r.absent,
            leave: r.leave,
            attendancePct: Math.round((r.present / Math.max(r.present + r.late + r.absent + r.leave, 1)) * 100),
          })), [
            { key: 'employee', label: 'Employee' },
            { key: 'empNo', label: 'Emp #' },
            { key: 'month', label: 'Month' },
            { key: 'present', label: 'Present' },
            { key: 'late', label: 'Late' },
            { key: 'absent', label: 'Absent' },
            { key: 'leave', label: 'Leave' },
            { key: 'attendancePct', label: 'Attendance %' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Attendance Rate" value={attendancePct + '%'} sub="Across the month" icon="📅" rail="sc-green" color="var(--color-green)" />
        <StatCard label="Total Present" value={String(totalPresent)} sub="Person-days" icon="✅" rail="sc-blue" color="var(--color-w2w)" />
        <StatCard label="Late Arrivals" value={String(grid.reduce((s, r) => s + r.late, 0))} sub="This month" icon="⏰" rail="sc-amber" color="var(--color-amber)" />
        <StatCard label="Absences" value={String(grid.reduce((s, r) => s + r.absent, 0))} sub="Unauthorised" icon="❌" rail="sc-red" color="var(--color-red)" />
      </div>

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
              {filtered.length === 0 ? (
                <tr><td colSpan={days.length + 5} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>No active employees.</td></tr>
              ) : (
                filtered.map((r) => (
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

      {showAdd && (
        <div className="modal-ov open" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
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
