import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, wasteLogsApi, rolesApi, sitesApi, depotsApi, cooperativesApi, type EmployeePayload } from '../api/endpoints';
import { useNavStore } from '../stores/navStore';
import { exportCsv } from '../utils/csv';
import {
  Plus, Search, Download,
  Edit2, Trash2, Eye, X, CreditCard, Filter,
  Printer, Recycle, CheckCircle,
} from 'lucide-react';

import { loadSettings } from '../utils/programmeSettings';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'badge bg',
  ON_LEAVE: 'badge ba',
  TERMINATED: 'badge br',
  PROBATION: 'badge bp',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On Leave',
  TERMINATED: 'Terminated',
  PROBATION: 'Probation',
};

const STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'PROBATION'];

const EMPTY_FORM: EmployeePayload = {
  empNo: '',
  firstName: '',
  lastName: '',
  idNumber: '',
  role: '',
  department: '',
  siteId: null,
  status: 'ACTIVE',
  email: '',
  phone: '',
  startDate: '',
  dailyRate: 0,
  bankName: '',
  bankAccount: '',
  bankBranch: '',
  dateOfBirth: '',
  gender: '',
  race: '',
  nationality: 'South African',
  disability: 'None',
  bloodGroup: 'Unknown',
  epwpRefNo: '',
  epwpEnrolmentDate: '',
  epwpYouth: false,
  stipend: 0,
  serviceFee: 0,
  attendancePct: 100,
  exitDate: '',
  exitReason: '',
  incomeBeforeW2W: 0,
  currentAddress: '',
  permanentAddress: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  customRoleId: '',
  loginPassword: '',
};

const VIEW_TABS = [
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'training', label: 'Training' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'documents', label: 'Documents' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'waste', label: 'Waste Logs' },
];

function avatarColor(id: string): string {
  const palette = ['#146484', '#00c896', '#d97706', '#6d28d9', '#c0392b', '#1a9ec4', '#10b981', '#9b7fe8'];
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

const initials = (first?: string, last?: string) =>
  ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || '—';

const fmtZAR = (n: number) => 'R ' + Math.round(n).toLocaleString('en-ZA');

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const consumePendingAction = useNavStore((s) => s.consumePendingAction);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);
  const [viewTab, setViewTab] = useState('personal');
  const [formData, setFormData] = useState<EmployeePayload>(EMPTY_FORM);

  const settings = useMemo(() => loadSettings(), []);
  const DEPARTMENTS = settings.departments;
  const ROLES = settings.designations;
  const BANKS = settings.banks;

  // ── Queries ──
  const { data, isLoading } = useQuery({
    queryKey: ['employees', searchQuery, filterStatus, filterDept],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (searchQuery) params.search = searchQuery;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterDept !== 'all') params.department = filterDept;
      return employeesApi.list(params);
    },
  });

  // Waste logs (for per-employee breakdown in view modal)
  const { data: wasteLogsData } = useQuery({
    queryKey: ['waste-logs', 'all'],
    queryFn: () => wasteLogsApi.list({}),
  });

  const { data: customRoles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });

  const { data: sitesData = [] } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list(),
  });

  const { data: depotsData = [] } = useQuery({
    queryKey: ['depots'],
    queryFn: () => depotsApi.list(),
  });
  const { data: coopsData = [] } = useQuery({
    queryKey: ['cooperatives'],
    queryFn: () => cooperativesApi.list(),
  });

  const allLogs: any[] = wasteLogsData?.data || [];

  const employees: any[] = data?.data || [];
  const total = data?.total || 0;

  const employeeLogs = useMemo(() => {
    if (!viewingEmployee) return [];
    return allLogs.filter((l: any) => l.collectorId === viewingEmployee.id || l.employeeId === viewingEmployee.id);
  }, [viewingEmployee, allLogs]);

  const empLogStats = useMemo(() => {
    const totalKg = employeeLogs.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const totalRev = employeeLogs.reduce((s, l) => s + (Number(l.totalValue) || 0), 0);
    const byType = new Map<string, { name: string; kg: number; rev: number; count: number }>();
    employeeLogs.forEach((l: any) => {
      const name = l.wasteTypeName || 'Unknown';
      const row = byType.get(name) || { name, kg: 0, rev: 0, count: 0 };
      row.kg += Number(l.quantity) || 0;
      row.rev += Number(l.totalValue) || 0;
      row.count += 1;
      byType.set(name, row);
    });
    return { totalKg, totalRev, byType: Array.from(byType.values()).sort((a, b) => b.kg - a.kg) };
  }, [employeeLogs]);

  // ── Mutations ──
  const createMut = useMutation({
    mutationFn: (payload: EmployeePayload) => employeesApi.create(payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setShowModal(false); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Failed to create employee')
  });
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EmployeePayload> }) =>
      employeesApi.update(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setShowModal(false); },
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Failed to update employee')
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
    onError: (err: any) => alert(err?.response?.data?.error || err.message || 'Something went wrong.'),
  });

  // ── Handlers ──
  const openAdd = () => {
    setEditingId(null);
    const ts = Date.now().toString(36).toUpperCase().slice(-5);
    setFormData({ ...EMPTY_FORM, empNo: `W2W-${ts}` });
    setShowModal(true);
  };

  // Open the Add/Edit modal if another page navigated us here with that intent
  useEffect(() => {
    const action = consumePendingAction();
    if (action === 'openAdd') openAdd();
    else if (action?.startsWith('edit:')) {
      const empId = action.slice(5);
      const emp = employees.find((e: any) => e.id === empId);
      if (emp) openEdit(emp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  const openEdit = (emp: any) => {
    setEditingId(emp.id);
    setFormData({
      empNo: emp.empNo,
      firstName: emp.firstName,
      lastName: emp.lastName,
      idNumber: emp.idNumber || '',
      role: emp.role || '',
      department: emp.department || '',
      siteId: emp.siteId || null,
      status: emp.status,
      email: emp.email || '',
      phone: emp.phone || '',
      startDate: emp.startDate ? emp.startDate.split('T')[0] : '',
      dailyRate: emp.dailyRate || 0,
      bankName: emp.bankName || '',
      bankAccount: emp.bankAccount || '',
      bankBranch: emp.bankBranch || '',
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
      gender: emp.gender || '',
      race: emp.race || '',
      nationality: emp.nationality || 'South African',
      disability: emp.disability || 'None',
      bloodGroup: emp.bloodGroup || 'Unknown',
      epwpRefNo: emp.epwpRefNo || '',
      epwpEnrolmentDate: emp.epwpEnrolmentDate ? emp.epwpEnrolmentDate.split('T')[0] : '',
      epwpYouth: emp.epwpYouth || false,
      stipend: emp.stipend || 0,
      serviceFee: emp.serviceFee || 0,
      attendancePct: emp.attendancePct ?? 100,
      exitDate: emp.exitDate ? emp.exitDate.split('T')[0] : '',
      exitReason: emp.exitReason || '',
      incomeBeforeW2W: emp.incomeBeforeW2W || 0,
      currentAddress: emp.currentAddress || '',
      permanentAddress: emp.permanentAddress || '',
      emergencyName: emp.emergencyName || '',
      emergencyRelationship: emp.emergencyRelationship || '',
      emergencyPhone: emp.emergencyPhone || '',
      customRoleId: '', // Fetching existing user's role is complex, typically handled in Users page
      loginPassword: '',
    });
    setShowModal(true);
  };

  const openView = (emp: any) => {
    setViewingEmployee(emp);
    setViewTab('personal');
    setShowViewModal(true);
  };

  const openIdCard = (emp: any) => {
    setViewingEmployee(emp);
    setShowIdCardModal(true);
  };

  const printIdCard = () => {
    window.print();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) deleteMut.mutate(id);
  };

  const handleSave = () => {
    if (!formData.firstName || !formData.lastName) return;
    if (editingId) updateMut.mutate({ id: editingId, payload: formData });
    else createMut.mutate(formData);
  };

  const updateField = <K extends keyof EmployeePayload>(key: K, value: EmployeePayload[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      {/* ══ Page Header ══ */}
      <div className="ph">
        <div>
          <div className="pt">Employee Directory</div>
          <div className="ps">{total} staff member{total === 1 ? '' : 's'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openAdd} className="btn btn-accent"><Plus size={13} /> Add Employee</button>
          <button className="btn btn-ghost" onClick={() => exportCsv('employees', employees, [
            { key: 'empNo', label: 'Emp #' },
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
            { key: 'idNumber', label: 'ID Number' },
            { key: 'department', label: 'Department' },
            { key: 'role', label: 'Designation' },
            { key: 'siteName', label: 'Site', map: (r: any) => r.site?.name || r.siteName || '' },
            { key: 'status', label: 'Status' },
            { key: 'startDate', label: 'Start Date' },
            { key: 'dailyRate', label: 'Daily Rate (R)' },
          ])}><Download size={13} /> Export</button>
        </div>
      </div>

      {/* ══ Filters ══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 14,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 7,
            background: 'var(--color-surface3)',
            border: '1px solid var(--color-border)',
            flex: 1,
            maxWidth: 320,
          }}
        >
          <Search size={13} style={{ color: 'var(--color-text3)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name, ID, employee #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={13} style={{ color: 'var(--color-text3)' }} />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="fc"
            style={{ width: 160 }}
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="fc"
            style={{ width: 140 }}
          >
            <option value="all">All Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>




      {/* ══ Table ══ */}
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>ID #</th>
                <th>Designation</th>
                <th>Dept</th>
                <th>Phone</th>
                <th>License</th>
                <th>Status</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text3)' }}>
                    {total === 0 ? 'No employees yet. Click "Add Employee" to create your first record.' : 'No employees match your search criteria.'}
                  </td>
                </tr>
              ) : (
                employees.map((emp: any) => {
                  const noId = !emp.idNumber;
                  const hasLicense = Boolean(emp.licenseCode || emp.drivers);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            className="avt"
                            style={{
                              width: 30,
                              height: 30,
                              fontSize: 10,
                              background: avatarColor(emp.id || emp.empNo),
                            }}
                          >
                            {initials(emp.firstName, emp.lastName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12 }}>
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{emp.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{emp.empNo}</td>
                      <td>{emp.role || '—'}</td>
                      <td>{emp.department || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{emp.phone || '—'}</td>
                      <td>
                        {hasLicense ? (
                          <span className="badge bc">{emp.licenseCode || 'C1'}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text3)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={STATUS_STYLES[emp.status] || 'badge bk'}>
                          {STATUS_LABELS[emp.status] || emp.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <ActionIcon title="View" onClick={() => openView(emp)}><Eye size={13} /></ActionIcon>
                          <ActionIcon title="Edit" onClick={() => openEdit(emp)}><Edit2 size={13} /></ActionIcon>
                          <ActionIcon title="Waste breakdown" onClick={() => { openView(emp); setViewTab('waste'); }}>
                            <Recycle size={13} />
                          </ActionIcon>
                          <ActionIcon title="Print ID card" onClick={() => openIdCard(emp)}>
                            <Printer size={13} />
                          </ActionIcon>
                          {noId && (
                            <span title="No SA ID number on file" style={{ fontSize: 12 }}>⚠</span>
                          )}
                          <ActionIcon title="Delete" onClick={() => handleDelete(emp.id)} danger>
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
        <div className="cf">
          <span style={{ fontSize: 11, color: 'var(--color-text3)' }}>
            Showing {employees.length} of {total} employees
          </span>
        </div>
      </div>

      {/* ══ ADD/EDIT MODAL ══ */}
      {showModal && (
        <div className="modal-ov open">
          <div className="modal" style={{ width: 780, maxHeight: '90vh' }}>
            <div className="mh">
              <span className="mt">{editingId ? 'Edit Employee' : 'Add New Employee'}</span>
              <button onClick={() => setShowModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* ── Personal Information ── */}
              <div className="fsec">Personal Information</div>
              <div className="fgrid">
                <FormField label="First Name" required><input className="fc" value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} placeholder="Enter first name" /></FormField>
                <FormField label="Last Name" required><input className="fc" value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} placeholder="Enter last name" /></FormField>
                <FormField label="ID Number"><input className="fc" value={formData.idNumber || ''} onChange={(e) => updateField('idNumber', e.target.value)} placeholder="SA ID number" /></FormField>
                <FormField label="Email"><input className="fc" type="email" value={formData.email || ''} onChange={(e) => updateField('email', e.target.value)} placeholder="email@example.com" /></FormField>
                <FormField label="Phone"><input className="fc" value={formData.phone || ''} onChange={(e) => updateField('phone', e.target.value)} placeholder="082 xxx xxxx" /></FormField>
                <FormField label="Employee Number"><input className="fc" value={formData.empNo} onChange={(e) => updateField('empNo', e.target.value)} placeholder="W2W-0001" /></FormField>
                <FormField label="Date of Birth"><input className="fc" type="date" value={formData.dateOfBirth || ''} onChange={(e) => updateField('dateOfBirth', e.target.value)} /></FormField>
                <FormField label="Gender">
                  <select className="fc" value={formData.gender || ''} onChange={(e) => updateField('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </FormField>
                <FormField label="Race (EE Reporting)">
                  <select className="fc" value={formData.race || ''} onChange={(e) => updateField('race', e.target.value)}>
                    <option value="">Select race</option>
                    <option value="Black African">Black African</option>
                    <option value="White">White</option>
                    <option value="Coloured">Coloured</option>
                    <option value="Indian">Indian</option>
                    <option value="Asian">Asian</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>
                <FormField label="Nationality">
                  <select className="fc" value={formData.nationality || 'South African'} onChange={(e) => updateField('nationality', e.target.value)}>
                    <option value="South African">South African</option>
                    <option value="Zimbabwean">Zimbabwean</option>
                    <option value="Mozambican">Mozambican</option>
                    <option value="Lesotho">Lesotho (Basotho)</option>
                    <option value="Swazi">Swazi</option>
                    <option value="Namibian">Namibian</option>
                    <option value="Botswana">Botswana (Motswana)</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>
                <FormField label="Disability">
                  <select className="fc" value={formData.disability || 'None'} onChange={(e) => updateField('disability', e.target.value)}>
                    <option value="None">None</option>
                    <option value="Physical">Physical</option>
                    <option value="Visual">Visual</option>
                    <option value="Hearing">Hearing</option>
                    <option value="Intellectual">Intellectual</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>
                <FormField label="Blood Group">
                  <select className="fc" value={formData.bloodGroup || 'Unknown'} onChange={(e) => updateField('bloodGroup', e.target.value)}>
                    <option value="Unknown">Unknown</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </FormField>
              </div>

              {/* ── Employment Details ── */}
              <div className="fsec">Employment Details</div>
              <div className="fgrid">
                <FormField label="Department">
                  <select className="fc" value={formData.department || ''} onChange={(e) => updateField('department', e.target.value)}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </FormField>
                <FormField label="Designation">
                  <select className="fc" value={formData.role || ''} onChange={(e) => updateField('role', e.target.value)}>
                    <option value="">Select designation</option>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>
                <FormField label="Assigned Site / Depot / Cooperative">
                  <select className="fc" value={formData.siteId || ''} onChange={(e) => updateField('siteId', e.target.value || null)}>
                    <option value="">No Assignment (Global/HQ)</option>
                    {sitesData.length > 0 && (
                      <optgroup label="🏗 Sites">
                        {sitesData.map((s: any) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {depotsData.length > 0 && (
                      <optgroup label="🏭 Depots">
                        {depotsData.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {coopsData.length > 0 && (
                      <optgroup label="🤝 Cooperatives">
                        {coopsData.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className="fc" value={formData.status || 'ACTIVE'} onChange={(e) => updateField('status', e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </FormField>
                <FormField label="Start Date"><input className="fc" type="date" value={formData.startDate || ''} onChange={(e) => updateField('startDate', e.target.value)} /></FormField>
                <FormField label="Daily Rate (R)"><input className="fc" type="number" value={formData.dailyRate || ''} onChange={(e) => updateField('dailyRate', parseFloat(e.target.value) || 0)} placeholder="0.00" /></FormField>
              </div>

              {/* ── EPWP Enrolment ── */}
              <div className="fsec">EPWP Enrolment</div>
              <div className="fgrid">
                <FormField label="EPWP Reference No."><input className="fc" value={formData.epwpRefNo || ''} onChange={(e) => updateField('epwpRefNo', e.target.value)} placeholder="EPWP ref number" /></FormField>
                <FormField label="Enrolment Date"><input className="fc" type="date" value={formData.epwpEnrolmentDate || ''} onChange={(e) => updateField('epwpEnrolmentDate', e.target.value)} /></FormField>
                <FormField label="Youth (Under 35)">
                  <select className="fc" value={formData.epwpYouth ? 'Yes' : 'No'} onChange={(e) => updateField('epwpYouth', e.target.value === 'Yes')}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </FormField>
              </div>

              {/* ── Remuneration ── */}
              <div className="fsec">Remuneration</div>
              <div className="fgrid">
                <FormField label="Stipend (R)"><input className="fc" type="number" value={formData.stipend || ''} onChange={(e) => updateField('stipend', parseFloat(e.target.value) || 0)} placeholder="0.00" /></FormField>
                <FormField label="Service Fee (R)"><input className="fc" type="number" value={formData.serviceFee || ''} onChange={(e) => updateField('serviceFee', parseFloat(e.target.value) || 0)} placeholder="0.00" /></FormField>
                <FormField label="Attendance %"><input className="fc" type="number" min={0} max={100} value={formData.attendancePct ?? ''} onChange={(e) => updateField('attendancePct', parseFloat(e.target.value) || 0)} placeholder="100" /></FormField>
              </div>

              {/* ── Exit (editing only) ── */}
              {editingId && (
                <>
                  <div className="fsec">Exit</div>
                  <div className="fgrid">
                    <FormField label="Exit Date"><input className="fc" type="date" value={formData.exitDate || ''} onChange={(e) => updateField('exitDate', e.target.value)} /></FormField>
                    <FormField label="Exit Reason">
                      <select className="fc" value={formData.exitReason || ''} onChange={(e) => updateField('exitReason', e.target.value)}>
                        <option value="">Select reason</option>
                        <option value="Resigned">Resigned</option>
                        <option value="Dropped Out">Dropped Out</option>
                        <option value="Dismissed">Dismissed</option>
                        <option value="Health">Health</option>
                        <option value="Relocated">Relocated</option>
                        <option value="Deceased">Deceased</option>
                        <option value="Other">Other</option>
                      </select>
                    </FormField>
                  </div>
                </>
              )}

              {/* ── Income Uplift ── */}
              <div className="fsec">Income Uplift</div>
              <div className="fgrid">
                <FormField label="Monthly Income BEFORE joining W2W (R)"><input className="fc" type="number" value={formData.incomeBeforeW2W || ''} onChange={(e) => updateField('incomeBeforeW2W', parseFloat(e.target.value) || 0)} placeholder="e.g. 800" /></FormField>
              </div>

              {/* ── Contact Details ── */}
              <div className="fsec">Contact Details</div>
              <div className="fgrid">
                <FormField label="Current Address"><textarea className="fc" rows={2} value={formData.currentAddress || ''} onChange={(e) => updateField('currentAddress', e.target.value)} placeholder="Current residential address" style={{ resize: 'vertical', minHeight: 48 }} /></FormField>
                <FormField label="Permanent Address"><textarea className="fc" rows={2} value={formData.permanentAddress || ''} onChange={(e) => updateField('permanentAddress', e.target.value)} placeholder="Permanent address (if different)" style={{ resize: 'vertical', minHeight: 48 }} /></FormField>
              </div>

              {/* ── Emergency Contact ── */}
              <div className="fsec">Emergency Contact</div>
              <div className="fgrid">
                <FormField label="Name"><input className="fc" value={formData.emergencyName || ''} onChange={(e) => updateField('emergencyName', e.target.value)} placeholder="Emergency contact name" /></FormField>
                <FormField label="Relationship">
                  <select className="fc" value={formData.emergencyRelationship || ''} onChange={(e) => updateField('emergencyRelationship', e.target.value)}>
                    <option value="">Select relationship</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend</option>
                    <option value="Other">Other</option>
                  </select>
                </FormField>
                <FormField label="Phone"><input className="fc" type="tel" value={formData.emergencyPhone || ''} onChange={(e) => updateField('emergencyPhone', e.target.value)} placeholder="082 xxx xxxx" /></FormField>
              </div>

              {/* ── Banking Details ── */}
              <div className="fsec">Banking Details</div>
              <div className="fgrid3">
                <FormField label="Bank Name">
                  <select className="fc" value={formData.bankName || ''} onChange={(e) => updateField('bankName', e.target.value)}>
                    <option value="">Select bank</option>
                    {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                    {!BANKS.includes('Other') && <option value="Other">Other</option>}
                  </select>
                </FormField>
                <FormField label="Account Number"><input className="fc" value={formData.bankAccount || ''} onChange={(e) => updateField('bankAccount', e.target.value)} placeholder="Account number" /></FormField>
                <FormField label="Branch Code"><input className="fc" value={formData.bankBranch || ''} onChange={(e) => updateField('bankBranch', e.target.value)} placeholder="Branch code" /></FormField>
              </div>

              {/* ── System Access ── */}
              <div className="fsec">System Access</div>
              <div className="fgrid">
                <FormField label="System Role (Custom)">
                  <select className="fc" value={formData.customRoleId || ''} onChange={(e) => updateField('customRoleId', e.target.value)}>
                    <option value="">Select role</option>
                    {customRoles?.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Login Password"><input className="fc" type="text" value={formData.loginPassword || ''} onChange={(e) => updateField('loginPassword', e.target.value)} placeholder="Set login password" /></FormField>
              </div>
            </div>
            <div className="mf">
              <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="btn btn-primary">
                {createMut.isPending || updateMut.isPending ? 'Saving...' : editingId ? 'Update Employee' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TABBED VIEW MODAL ══ */}
      {showViewModal && viewingEmployee && (
        <div className="modal-ov open">
          <div className="modal modal-lg">
            <div className="mh">
              <div>
                <div className="mt">{viewingEmployee.firstName} {viewingEmployee.lastName}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text3)' }}>
                  {viewingEmployee.empNo} · {viewingEmployee.role || '—'} · {viewingEmployee.department || '—'}
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="mc"><X size={15} /></button>
            </div>

            <div style={{ padding: '0 22px', borderBottom: '1px solid var(--color-border)' }}>
              <div className="tabs" style={{ marginBottom: 0, gap: 0, flexWrap: 'wrap' }}>
                {VIEW_TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setViewTab(t.id)}
                    className={`tab ${viewTab === t.id ? 'active' : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb">
              {viewTab === 'personal' && <PersonalTab emp={viewingEmployee} />}
              {viewTab === 'employment' && <EmploymentTab emp={viewingEmployee} />}
              {viewTab === 'training' && <EmptyTab icon="🎓" title="Training records" hint="No training records on file yet." />}
              {viewTab === 'warnings' && <EmptyTab icon="⚠" title="Warnings & Violations" hint="No disciplinary actions recorded." />}
              {viewTab === 'documents' && <EmptyTab icon="📄" title="Documents" hint="No documents uploaded yet. Use the upload zone to attach contracts, IDs, certificates." />}
              {viewTab === 'payroll' && <PayrollTab emp={viewingEmployee} />}
              {viewTab === 'waste' && (
                <WasteTabContent
                  emp={viewingEmployee}
                  logs={employeeLogs}
                  totalKg={empLogStats.totalKg}
                  totalRev={empLogStats.totalRev}
                  byType={empLogStats.byType}
                />
              )}
            </div>

            <div className="mf">
              <button onClick={() => { setShowViewModal(false); openIdCard(viewingEmployee); }} className="btn btn-ghost">
                <Printer size={13} /> Print ID
              </button>
              <button onClick={() => { setShowViewModal(false); openEdit(viewingEmployee); }} className="btn btn-primary">
                <Edit2 size={13} /> Edit
              </button>
              <button onClick={() => setShowViewModal(false)} className="btn btn-ghost">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ID CARD MODAL (print-friendly) ══ */}
      {showIdCardModal && viewingEmployee && (
        <div className="modal-ov open">
          <div className="modal" style={{ width: 720 }}>
            <div className="mh">
              <span className="mt">Employee ID Card</span>
              <button onClick={() => setShowIdCardModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <IdCard emp={viewingEmployee} />
            </div>
            <div className="mf">
              <button onClick={() => setShowIdCardModal(false)} className="btn btn-ghost">Close</button>
              <button onClick={printIdCard} className="btn btn-primary">
                <Printer size={13} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  TAB COMPONENTS
// ═══════════════════════════════════════════════════
function PersonalTab({ emp }: { emp: any }) {
  return (
    <>
      <IdCardSmall emp={emp} />
      <div style={{ height: 16 }} />
      {([
        ['Full Name', `${emp.firstName} ${emp.lastName}`],
        ['Employee #', emp.empNo],
        ['Email', emp.email],
        ['Phone', emp.phone],
        ['SA ID Number', emp.idNumber ? '•••••••' + emp.idNumber.slice(-4) : '—'],
        ['Start Date', emp.startDate ? new Date(emp.startDate).toLocaleDateString() : '—'],
      ] as [string, any][]).map(([label, value]) => (
        <div key={label} className="drow">
          <div className="dlb">{label}</div>
          <div className="dvl">{value || '—'}</div>
        </div>
      ))}
    </>
  );
}

function EmploymentTab({ emp }: { emp: any }) {
  return (
    <>
      {([
        ['Department', emp.department],
        ['Designation / Role', emp.role],
        ['Site', emp.site?.name || emp.siteName],
        ['Status', STATUS_LABELS[emp.status] || emp.status],
        ['Daily Rate', emp.dailyRate ? fmtZAR(emp.dailyRate) + ' / day' : '—'],
        ['Bank', emp.bankName],
        ['Account Number', emp.bankAccount ? '••••' + String(emp.bankAccount).slice(-4) : '—'],
        ['Branch Code', emp.bankBranch],
      ] as [string, any][]).map(([label, value]) => (
        <div key={label} className="drow">
          <div className="dlb">{label}</div>
          <div className="dvl">{value || '—'}</div>
        </div>
      ))}
    </>
  );
}

function PayrollTab({ emp }: { emp: any }) {
  const rate = Number(emp.dailyRate || 0);
  // Stylised monthly estimate
  const daysWorked = 22;
  const gross = rate * daysWorked;
  const uif = gross * 0.01;
  const net = gross - uif;
  return (
    <>
      <div className="alert alert-blue">
        <span>Payroll integration is not yet connected. Estimates below assume <b>{daysWorked}</b> working days at the daily rate on file.</span>
      </div>
      <div className="g2 mt14">
        <div className="stat-card sc-blue">
          <div className="stat-label">Gross / month</div>
          <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>{fmtZAR(gross)}</div>
          <div className="stat-sub">{daysWorked} days × {fmtZAR(rate)}</div>
        </div>
        <div className="stat-card sc-green">
          <div className="stat-label">Estimated Net</div>
          <div className="stat-val" style={{ color: 'var(--color-green)' }}>{fmtZAR(net)}</div>
          <div className="stat-sub">After UIF only (stylised)</div>
        </div>
      </div>
    </>
  );
}

function WasteTabContent({
  logs,
  totalKg,
  totalRev,
  byType,
}: {
  emp: any;
  logs: any[];
  totalKg: number;
  totalRev: number;
  byType: Array<{ name: string; kg: number; rev: number; count: number }>;
}) {
  if (logs.length === 0) {
    return <EmptyTab icon="♻" title="No waste collected yet" hint="This employee hasn't logged any waste collections." />;
  }
  return (
    <>
      <div className="g3 mb14">
        <div className="stat-card sc-blue">
          <div className="stat-label">Total Volume</div>
          <div className="stat-val" style={{ color: 'var(--color-w2w)' }}>{(totalKg / 1000).toFixed(2)}t</div>
          <div className="stat-sub">{totalKg.toLocaleString()} kg</div>
        </div>
        <div className="stat-card sc-green">
          <div className="stat-label">Revenue Generated</div>
          <div className="stat-val" style={{ color: 'var(--color-green)' }}>{fmtZAR(totalRev)}</div>
          <div className="stat-sub">{logs.length} deliveries</div>
        </div>
        <div className="stat-card sc-purple">
          <div className="stat-label">Avg / delivery</div>
          <div className="stat-val" style={{ color: 'var(--color-purple)' }}>{logs.length > 0 ? fmtZAR(totalRev / logs.length) : 'R 0'}</div>
          <div className="stat-sub">Avg revenue</div>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text3)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '14px 0 6px' }}>
        By Category
      </div>
      <table>
        <thead>
          <tr><th>Category</th><th>Deliveries</th><th>Volume (kg)</th><th>Revenue</th></tr>
        </thead>
        <tbody>
          {byType.map((b) => (
            <tr key={b.name}>
              <td style={{ fontWeight: 600 }}>{b.name}</td>
              <td>{b.count}</td>
              <td>{b.kg.toLocaleString()}</td>
              <td style={{ fontWeight: 600, color: 'var(--color-green)' }}>{fmtZAR(b.rev)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function EmptyTab({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="no-access" style={{ padding: 40 }}>
      <div style={{ fontSize: 36, opacity: 0.35 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text2)' }}>{title}</div>
      <div style={{ fontSize: 11 }}>{hint}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  ID CARD
// ═══════════════════════════════════════════════════
function IdCard({ emp }: { emp: any }) {
  return (
    <div className="id-card no-print" style={{ transform: 'scale(1.05)' }}>
      <IdCardInner emp={emp} />
    </div>
  );
}

function IdCardSmall({ emp }: { emp: any }) {
  return (
    <div className="id-card" style={{ margin: '0 auto' }}>
      <IdCardInner emp={emp} />
    </div>
  );
}

function IdCardInner({ emp }: { emp: any }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, position: 'relative', zIndex: 2 }}>
        <CreditCard size={14} color="white" />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' }}>W2W PLATFORM</span>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {emp.firstName} {emp.lastName}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{emp.role || '—'}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 8, lineHeight: 1.7 }}>
            {emp.department && <div>Dept: {emp.department}</div>}
            {(emp.site?.name || emp.siteName) && <div>Site: {emp.site?.name || emp.siteName}</div>}
            {emp.phone && <div>Tel: {emp.phone}</div>}
          </div>
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            background: 'white',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-w2w)',
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          {initials(emp.firstName, emp.lastName)}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, position: 'relative', zIndex: 2 }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)' }}>{emp.empNo}</span>
        <span className={STATUS_STYLES[emp.status] || 'badge bk'} style={{ fontSize: 9 }}>
          {STATUS_LABELS[emp.status] || emp.status}
        </span>
      </div>
      <div style={{ height: 3, background: 'linear-gradient(90deg, var(--color-accent), transparent)', borderRadius: 20, marginTop: 4 }} />
    </>
  );
}

// ═══════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════
function ActionIcon({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
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
        t.style.background = danger ? 'var(--color-red-light)' : 'var(--color-surface3)';
        t.style.color = danger ? 'var(--color-red)' : 'var(--color-w2w)';
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

function FormField({
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
