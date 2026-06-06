// ── Single source of truth for all sidebar modules ──
// Used by the frontend Sidebar and SettingsPage, and by the backend for defaults.

export type ActionType = 'create' | 'edit' | 'delete' | 'approve';

export interface ModuleDef {
  id: string;
  label: string;
  section: string;
  icon: string;
  /** Which CRUD actions this module supports. Empty = view-only (e.g. Dashboard). */
  actions: ActionType[];
}

export const ALL_MODULES: ModuleDef[] = [
  // Overview
  { id: 'dashboard', label: 'Dashboard', section: 'Overview', icon: 'LayoutDashboard', actions: [] },

  // Facility Management
  { id: 'facilities', label: 'Sites & Regions', section: 'Facility Management', icon: 'MapPin', actions: ['create', 'edit', 'delete'] },
  { id: 'depots', label: 'Depot Management', section: 'Facility Management', icon: 'Warehouse', actions: ['create', 'edit', 'delete'] },

  // Waste Operations
  { id: 'waste-logs', label: 'Record Waste', section: 'Waste Operations', icon: 'RefreshCw', actions: ['create', 'edit', 'delete'] },
  { id: 'depot-scanner', label: 'Depot Scanner', section: 'Waste Operations', icon: 'ScanLine', actions: [] },

  // Inventory & Assets
  { id: 'stock-register', label: 'Stock Register', section: 'Inventory & Assets', icon: 'Package', actions: ['create', 'edit', 'delete'] },
  { id: 'vehicles', label: 'Vehicles & Fleet', section: 'Inventory & Assets', icon: 'Truck', actions: ['create', 'edit', 'delete'] },

  // Human Resources
  { id: 'employees', label: 'Employees', section: 'Human Resources', icon: 'Users', actions: ['create', 'edit', 'delete'] },
  { id: 'onboarding', label: 'Onboarding', section: 'Human Resources', icon: 'UserPlus', actions: [] },
  { id: 'attendance', label: 'Attendance Report', section: 'Human Resources', icon: 'Clock', actions: ['create', 'delete'] },
  { id: 'check-in-out', label: 'Check In / Check Out', section: 'Human Resources', icon: 'LogIn', actions: ['create'] },
  { id: 'training', label: 'Training Tracker', section: 'Human Resources', icon: 'BookOpen', actions: ['create', 'edit', 'delete'] },
  { id: 'beneficiary', label: 'Beneficiary Tracker', section: 'Human Resources', icon: 'Heart', actions: [] },

  // Finance & Reporting
  { id: 'pl-register', label: 'P&L Entry Register', section: 'Finance & Reporting', icon: 'DollarSign', actions: ['create', 'edit', 'delete'] },
  { id: 'epr-reports', label: 'EPR Monthly Reports', section: 'Finance & Reporting', icon: 'BarChart3', actions: ['create', 'edit', 'delete', 'approve'] },
  { id: 'reports', label: 'Reports & Export', section: 'Finance & Reporting', icon: 'TrendingUp', actions: [] },
  { id: 'demographics', label: 'Demographics', section: 'Finance & Reporting', icon: 'Users', actions: [] },

  // Compliance & System
  { id: 'violations', label: 'Warnings', section: 'Compliance & System', icon: 'AlertTriangle', actions: ['create', 'edit', 'delete'] },
  { id: 'audit-log', label: 'Audit Log', section: 'Compliance & System', icon: 'CheckSquare', actions: [] },
  { id: 'w2w-settings', label: 'W2W Settings', section: 'Compliance & System', icon: 'Settings', actions: [] },
];

export const ALL_MODULE_IDS = ALL_MODULES.map((m) => m.id);

/**
 * Returns all module IDs including all action permissions.
 * Used for creating admin roles with full access.
 */
export function getAllPermissions(): string[] {
  const perms: string[] = [];
  for (const m of ALL_MODULES) {
    perms.push(m.id);
    for (const a of m.actions) {
      perms.push(`${m.id}:${a}`);
    }
  }
  return perms;
}

// Group modules by section for display in role editor
export function getModulesBySection(): { section: string; modules: ModuleDef[] }[] {
  const map = new Map<string, ModuleDef[]>();
  for (const m of ALL_MODULES) {
    if (!map.has(m.section)) map.set(m.section, []);
    map.get(m.section)!.push(m);
  }
  return Array.from(map.entries()).map(([section, modules]) => ({ section, modules }));
}
