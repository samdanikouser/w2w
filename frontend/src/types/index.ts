// ── Roles ──
export type Role = 'super_admin' | 'site_admin' | 'data_clerk' | 'field_worker';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: Role;
  siteId?: string;
  siteName?: string;
  avatar?: string;
  modules?: string[];
  roleName?: string;
  depotId?: string;
  depotName?: string;
  managedSiteIds?: string[];
  isDepotManager?: boolean;
}

// ── Sites ──
export interface Site {
  id: string;
  name: string;
  type: 'cooperative' | 'depot' | 'buyback_centre';
  region: string;
  address: string;
  lat?: number;
  lng?: number;
  status: 'active' | 'inactive';
}

// ── Employees ──
export type EmployeeStatus = 'Active' | 'On Leave' | 'Terminated' | 'Probation';

export interface Employee {
  id: string;
  empNo: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  role: string;
  department: string;
  siteId: string;
  siteName: string;
  status: EmployeeStatus;
  email: string;
  phone: string;
  startDate: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  dailyRate: number;
  photo?: string;
}

// ── Waste Types ──
export interface WasteType {
  id: string;
  name: string;
  category: string;
  unit: string;
  pricePerUnit: number;
  colour: string;
}

// ── Waste Logs ──
export interface WasteLog {
  id: string;
  date: string;
  siteId: string;
  siteName: string;
  wasteTypeId: string;
  wasteTypeName: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalValue: number;
  collectorId?: string;
  collectorName?: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

// ── Dashboard Stats ──
export interface DashboardStats {
  totalEmployees: number;
  activeToday: number;
  tonnesCollected: number;
  revenue: number;
  expenses: number;
  netPosition: number;
  pendingLogs: number;
  alertCount: number;
}

// ── Navigation ──
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number;
  badgeColor?: 'red' | 'amber' | 'accent';
  roles?: Role[];
  section?: string;
}

// ── Tab ──
export interface Tab {
  id: string;
  label: string;
}
