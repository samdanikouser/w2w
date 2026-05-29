// ── Single source of truth for all sidebar modules ──
// Used by the frontend Sidebar and SettingsPage, and by the backend for defaults.

export interface ModuleDef {
  id: string;
  label: string;
  section: string;
  icon: string;
}

export const ALL_MODULES: ModuleDef[] = [
  // Overview
  { id: 'dashboard', label: 'Dashboard', section: 'Overview', icon: 'LayoutDashboard' },
  { id: 'facilities', label: 'Facility Hierarchy', section: 'Overview', icon: 'MapPin' },

  // Waste Operations
  { id: 'waste-logs', label: 'Record Waste', section: 'Waste Operations', icon: 'RefreshCw' },
  { id: 'depot-scanner', label: 'Depot Scanner', section: 'Waste Operations', icon: 'ScanLine' },

  // Inventory & Assets
  { id: 'stock-register', label: 'Stock Register', section: 'Inventory & Assets', icon: 'Package' },
  { id: 'stock-variance', label: 'Stock Variance', section: 'Inventory & Assets', icon: 'AlertTriangle' },
  { id: 'vehicles', label: 'Vehicles & Fleet', section: 'Inventory & Assets', icon: 'Truck' },

  // Human Resources
  { id: 'employees', label: 'Employees', section: 'Human Resources', icon: 'Users' },
  { id: 'onboarding', label: 'Onboarding', section: 'Human Resources', icon: 'UserPlus' },
  { id: 'attendance', label: 'Attendance Report', section: 'Human Resources', icon: 'Clock' },
  { id: 'check-in-out', label: 'Check In / Check Out', section: 'Human Resources', icon: 'LogIn' },
  { id: 'training', label: 'Training Tracker', section: 'Human Resources', icon: 'BookOpen' },
  { id: 'beneficiary', label: 'Beneficiary Tracker', section: 'Human Resources', icon: 'Heart' },

  // Finance & Reporting
  { id: 'pl-register', label: 'P&L Entry Register', section: 'Finance & Reporting', icon: 'DollarSign' },
  { id: 'epr-reports', label: 'EPR Monthly Reports', section: 'Finance & Reporting', icon: 'BarChart3' },
  { id: 'reports', label: 'Reports & Export', section: 'Finance & Reporting', icon: 'TrendingUp' },
  { id: 'demographics', label: 'Demographics', section: 'Finance & Reporting', icon: 'Users' },

  // Compliance & System
  { id: 'violations', label: 'Warnings', section: 'Compliance & System', icon: 'AlertTriangle' },
  { id: 'audit-log', label: 'Audit Log', section: 'Compliance & System', icon: 'CheckSquare' },
  { id: 'w2w-settings', label: 'W2W Settings', section: 'Compliance & System', icon: 'Settings' },
];

export const ALL_MODULE_IDS = ALL_MODULES.map((m) => m.id);

// Group modules by section for display in role editor
export function getModulesBySection(): { section: string; modules: ModuleDef[] }[] {
  const map = new Map<string, ModuleDef[]>();
  for (const m of ALL_MODULES) {
    if (!map.has(m.section)) map.set(m.section, []);
    map.get(m.section)!.push(m);
  }
  return Array.from(map.entries()).map(([section, modules]) => ({ section, modules }));
}
