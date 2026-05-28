// ── Single source of truth for all sidebar modules ──
// Used by the frontend Sidebar and SettingsPage, and by the backend for defaults.

export interface ModuleDef {
  id: string;
  label: string;
  section: string;
  icon: string;
}

export const ALL_MODULES: ModuleDef[] = [
  // Programme
  { id: 'dashboard', label: 'Dashboard', section: 'Programme', icon: 'LayoutDashboard' },
  { id: 'sites', label: 'Sites & Regions', section: 'Programme', icon: 'MapPin' },
  { id: 'epr-reports', label: 'EPR Monthly Reports', section: 'Programme', icon: 'BarChart3' },
  // Finance
  { id: 'pl-register', label: 'P&L Entry Register', section: 'Finance', icon: 'DollarSign' },
  { id: 'reports', label: 'Reports & Export', section: 'Finance', icon: 'TrendingUp' },
  // People
  { id: 'employees', label: 'Employees', section: 'People', icon: 'Users' },
  { id: 'onboarding', label: 'Onboarding', section: 'People', icon: 'UserPlus' },
  { id: 'attendance', label: 'Attendance Report', section: 'People', icon: 'Clock' },
  { id: 'check-in-out', label: 'Check In / Check Out', section: 'People', icon: 'LogIn' },
  { id: 'beneficiary', label: 'Beneficiary Tracker', section: 'People', icon: 'Heart' },
  { id: 'demographics', label: 'Demographics', section: 'People', icon: 'Users' },
  // Inventory
  { id: 'stock-register', label: 'Stock Register', section: 'Inventory', icon: 'Package' },
  // Assets
  { id: 'vehicles', label: 'Vehicles & Fleet', section: 'Assets', icon: 'Truck' },
  { id: 'depots', label: 'Depot Management', section: 'Assets', icon: 'Home' },
  { id: 'depot-scanner', label: 'Depot Scanner', section: 'Waste Ops', icon: 'ScanLine' },
  { id: 'stock-variance', label: 'Stock Variance', section: 'Waste Ops', icon: 'AlertTriangle' },
  // Training
  { id: 'training', label: 'Training Tracker', section: 'Training', icon: 'BookOpen' },
  // Compliance
  { id: 'violations', label: 'Warnings', section: 'Compliance', icon: 'AlertTriangle' },
  { id: 'audit-log', label: 'Audit Log', section: 'Compliance', icon: 'CheckSquare' },
  // Waste Ops
  { id: 'waste-logs', label: 'Record Waste', section: 'Waste Ops', icon: 'RefreshCw' },
  // System
  { id: 'w2w-settings', label: 'W2W Settings', section: 'System', icon: 'Settings' },
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
