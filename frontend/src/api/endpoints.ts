import api from './client';

// ═══════════════════════════════════════════════
//  Auth API
// ═══════════════════════════════════════════════

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role?: string;
  siteId?: string;
  orgName?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    siteId: string | null;
    siteName: string | null;
    modules: string[];
    roleName: string | null;
  };
}

export const authApi = {
  login: (data: LoginPayload) => api.post<AuthResponse>('/auth/login', data).then((r) => r.data),
  register: (data: RegisterPayload) => api.post<AuthResponse>('/auth/register', data).then((r) => r.data),
  me: () => api.get<AuthResponse['user']>('/auth/me').then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<{ message: string; tempPassword?: string }>('/auth/forgot-password', { email }).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Employees API
// ═══════════════════════════════════════════════

export interface EmployeePayload {
  empNo: string;
  firstName: string;
  lastName: string;
  idNumber?: string;
  role?: string;
  department?: string;
  siteId?: string | null;
  status?: string;
  email?: string;
  phone?: string;
  startDate?: string;
  dailyRate?: number;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  // Personal extended
  dateOfBirth?: string;
  gender?: string;
  race?: string;
  nationality?: string;
  disability?: string;
  bloodGroup?: string;
  // EPWP Enrolment
  epwpRefNo?: string;
  epwpEnrolmentDate?: string;
  epwpYouth?: boolean;
  // Remuneration
  stipend?: number;
  serviceFee?: number;
  attendancePct?: number;
  // Exit
  exitDate?: string;
  exitReason?: string;
  // Income Uplift
  incomeBeforeW2W?: number;
  // Contact
  currentAddress?: string;
  permanentAddress?: string;
  // Emergency Contact
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  // System Access
  customRoleId?: string;
  loginPassword?: string;
  // Onboarding
  onboardStatus?: string;
  uniformIssued?: boolean;
  ppeIssued?: boolean;
  trainingComplete?: number;
}

export interface EmployeeListResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

export const employeesApi = {
  list: (params?: Record<string, string>) =>
    api.get<EmployeeListResponse>('/employees', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/employees/${id}`).then((r) => r.data),
  create: (data: EmployeePayload) => api.post('/employees', data).then((r) => r.data),
  update: (id: string, data: Partial<EmployeePayload>) => api.put(`/employees/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/employees/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Waste Logs API
// ═══════════════════════════════════════════════

export interface WasteLogPayload {
  date: string;
  siteId?: string | null;
  wasteTypeId?: string | null;
  quantity: number;
  unit?: string;
  pricePerUnit?: number;
  collectorId?: string | null;
  notes?: string;
}

export interface WasteLogListResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalEntries: number;
    totalQuantity: number;
    totalValue: number;
  };
}

export const wasteLogsApi = {
  list: (params?: Record<string, string>) =>
    api.get<WasteLogListResponse>('/waste-logs', { params }).then((r) => r.data),
  create: (data: WasteLogPayload) => api.post('/waste-logs', data).then((r) => r.data),
  approve: (id: string) => api.patch(`/waste-logs/${id}/approve`).then((r) => r.data),
  reject: (id: string) => api.patch(`/waste-logs/${id}/reject`).then((r) => r.data),
  delete: (id: string) => api.delete(`/waste-logs/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Sites API
// ═══════════════════════════════════════════════

export interface SitePayload {
  name: string;
  type?: string;
  region?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  status?: string;
  ward?: string;
  gps?: string;
  supervisor?: string;
  beneficiaries?: number;
  ohsRating?: number;
  monthlyTonnage?: number;
  phase?: string;
  focus?: string;
  cleanliness?: string;
  launched?: string;
  notes?: string;
  provinceId?: string;
  municipalityId?: string;
  subRegionId?: string;
}

export const sitesApi = {
  list: () => api.get('/sites').then((r) => r.data),
  create: (data: SitePayload) => api.post('/sites', data).then((r) => r.data),
  update: (id: string, data: Partial<SitePayload>) => api.put(`/sites/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/sites/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Waste Types API
// ═══════════════════════════════════════════════

export interface WasteTypePayload {
  name: string;
  category?: string;
  unit?: string;
  pricePerUnit?: number;
  pricePerKg?: number;
  buyer?: string;
  colour?: string;
  isActive?: boolean;
}

export const wasteTypesApi = {
  list: () => api.get('/waste-types').then((r) => r.data),
  create: (data: WasteTypePayload) => api.post('/waste-types', data).then((r) => r.data),
  update: (id: string, data: Partial<WasteTypePayload>) => api.put(`/waste-types/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/waste-types/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Vehicles API
// ═══════════════════════════════════════════════
export interface VehiclePayload {
  registration: string;
  make?: string;
  model?: string;
  year?: number | null;
  siteId?: string | null;
  status?: 'OPERATIONAL' | 'ACTIVE' | 'MAINTENANCE' | 'UNDER_REPAIR' | 'DECOMMISSIONED' | 'INACTIVE';
  condition?: string;
  assignedTo?: string;
  fuelType?: string;
  lastService?: string | null;
  nextService?: string | null;
  odometerKm?: number | null;
}
export const vehiclesApi = {
  list: () => api.get<any[]>('/vehicles').then((r) => r.data),
  create: (data: VehiclePayload) => api.post('/vehicles', data).then((r) => r.data),
  update: (id: string, data: Partial<VehiclePayload>) => api.put(`/vehicles/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/vehicles/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Training API
// ═══════════════════════════════════════════════
export interface TrainingModulePayload {
  name: string;
  description?: string;
  type?: string;
  durationHrs?: number;
  isActive?: boolean;
}
export interface TrainingRecordPayload {
  employeeId: string;
  trainingModuleId: string;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  completedDate?: string | null;
  expiryDate?: string | null;
  score?: number | null;
}
export const trainingApi = {
  listModules: () => api.get<any[]>('/training/modules').then((r) => r.data),
  createModule: (data: TrainingModulePayload) => api.post('/training/modules', data).then((r) => r.data),
  updateModule: (id: string, data: Partial<TrainingModulePayload>) => api.put(`/training/modules/${id}`, data).then((r) => r.data),
  deleteModule: (id: string) => api.delete(`/training/modules/${id}`).then((r) => r.data),
  listRecords: () => api.get<any[]>('/training/records').then((r) => r.data),
  createRecord: (data: TrainingRecordPayload) => api.post('/training/records', data).then((r) => r.data),
  updateRecord: (id: string, data: Partial<TrainingRecordPayload>) => api.put(`/training/records/${id}`, data).then((r) => r.data),
  deleteRecord: (id: string) => api.delete(`/training/records/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Transactions (P&L) API
// ═══════════════════════════════════════════════
export interface TransactionPayload {
  date: string;
  type: 'REVENUE' | 'EXPENSE';
  category?: string;
  description?: string;
  amount: number;
  siteId?: string | null;
  reference?: string | null;
}
export interface TransactionListResponse {
  data: any[];
  total: number;
  summary: { totalRevenue: number; totalExpense: number; net: number };
}
export const transactionsApi = {
  list: (params?: Record<string, string>) => api.get<TransactionListResponse>('/transactions', { params }).then((r) => r.data),
  create: (data: TransactionPayload) => api.post('/transactions', data).then((r) => r.data),
  update: (id: string, data: Partial<TransactionPayload>) => api.put(`/transactions/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/transactions/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  EPR Reports API
// ═══════════════════════════════════════════════
export interface EprReportPayload {
  month: number;
  year: number;
  siteId?: string | null;
  totalTonnes?: number;
  totalRevenue?: number;
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED_REPORT' | 'REJECTED_REPORT';
  data?: any;
}
export const eprReportsApi = {
  list: (params?: Record<string, string>) => api.get<any[]>('/epr-reports', { params }).then((r) => r.data),
  create: (data: EprReportPayload) => api.post('/epr-reports', data).then((r) => r.data),
  update: (id: string, data: Partial<EprReportPayload>) => api.put(`/epr-reports/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/epr-reports/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Audit Log API
// ═══════════════════════════════════════════════
export const auditLogsApi = {
  list: (params?: Record<string, string>) => api.get<any[]>('/audit-logs', { params }).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Attendance API
// ═══════════════════════════════════════════════
export interface AttendancePayload {
  employeeId: string;
  date: string;
  status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE';
  clockIn?: string | null;
  clockOut?: string | null;
  hoursWorked?: number | null;
  notes?: string | null;
}
export const attendanceApi = {
  list: (params?: Record<string, string>) => api.get<any[]>('/attendance', { params }).then((r) => r.data),
  upsert: (data: AttendancePayload) => api.post('/attendance', data).then((r) => r.data),
  delete: (id: string) => api.delete(`/attendance/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Violations API
// ═══════════════════════════════════════════════
export interface ViolationPayload {
  employeeId: string;
  date: string;
  type: string;
  severity?: 'VERBAL' | 'WRITTEN' | 'FINAL_WRITTEN' | 'DISMISSAL';
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';
  notes?: string;
}
export const violationsApi = {
  list: () => api.get<any[]>('/violations').then((r) => r.data),
  create: (data: ViolationPayload) => api.post('/violations', data).then((r) => r.data),
  update: (id: string, data: Partial<ViolationPayload>) => api.put(`/violations/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/violations/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Stock Items API
// ═══════════════════════════════════════════════
export interface StockItemPayload {
  code: string;
  item: string;
  category?: string;
  uom?: string;
  onHand?: number;
  reorderAt?: number;
  siteId?: string | null;
}
export const stockItemsApi = {
  list: () => api.get<any[]>('/stock-items').then((r) => r.data),
  create: (data: StockItemPayload) => api.post('/stock-items', data).then((r) => r.data),
  update: (id: string, data: Partial<StockItemPayload>) => api.put(`/stock-items/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/stock-items/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Custom Roles API
// ═══════════════════════════════════════════════
export type SystemRole = 'SUPER_ADMIN' | 'SITE_ADMIN' | 'DATA_CLERK' | 'FIELD_WORKER';
export interface CustomRolePayload {
  name: string;
  description?: string;
  systemRole: SystemRole;
  isActive?: boolean;
  modules?: string[];
}
export const rolesApi = {
  list: () => api.get<any[]>('/roles').then((r) => r.data),
  create: (data: CustomRolePayload) => api.post('/roles', data).then((r) => r.data),
  update: (id: string, data: Partial<CustomRolePayload>) => api.put(`/roles/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/roles/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Users API (admin-only)
// ═══════════════════════════════════════════════
export interface CreateUserPayload {
  employeeId: string;
  email: string;
  password: string;
  customRoleId?: string | null;
}
export interface UpdateUserPayload {
  email?: string;
  isActive?: boolean;
  customRoleId?: string | null;
  newPassword?: string;
}
export const usersApi = {
  list: () => api.get<any[]>('/users').then((r) => r.data),
  create: (data: CreateUserPayload) => api.post('/users', data).then((r) => r.data),
  update: (id: string, data: UpdateUserPayload) => api.put(`/users/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/users/${id}`).then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  Notifications API
// ═══════════════════════════════════════════════

export interface Notification {
  id: string;
  userId: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  icon: string;
  title: string;
  message: string;
  action: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationsApi = {
  list: (params?: { unreadOnly?: boolean; limit?: number }) =>
    api.get<Notification[]>('/notifications', { params }).then((r) => r.data),
  unreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),
  markAsRead: (id: string) =>
    api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllAsRead: () =>
    api.patch('/notifications/read-all').then((r) => r.data),
  dismiss: (id: string) =>
    api.delete(`/notifications/${id}`).then((r) => r.data),
  clearRead: () =>
    api.delete('/notifications').then((r) => r.data),
};

// ═══════════════════════════════════════════════
//  POPIA Deletion Requests API
// ═══════════════════════════════════════════════
export const deletionRequestsApi = {
  list: () => api.get<any[]>('/deletion-requests').then((r) => r.data),
  create: (data: { reason: string; scope: string }) =>
    api.post('/deletion-requests', data).then((r) => r.data),
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.patch(`/deletion-requests/${id}/status`, data).then((r) => r.data),
};
