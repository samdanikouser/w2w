// ═══════════════════════════════════════════════════
//  P&L Settings Utilities — localStorage helpers
// ═══════════════════════════════════════════════════

// ── Types ──
export interface PLType {
  id: string;
  group: string;
  label: string;
}

// ── Default P&L Types ──
const DEFAULT_PL_TYPES: PLType[] = [
  // Income
  { id: 'PLT-001', group: 'Income', label: 'Revenue — Waste Sales' },
  { id: 'PLT-002', group: 'Income', label: 'Revenue — Grant / Subsidy' },
  { id: 'PLT-003', group: 'Income', label: 'Revenue — EPR Producer Payment' },
  { id: 'PLT-004', group: 'Income', label: 'Revenue — Other Income' },
  // Cost of Sales
  { id: 'PLT-005', group: 'Cost of Sales', label: 'CoS — HR Costs' },
  { id: 'PLT-006', group: 'Cost of Sales', label: 'CoS — Systems Costs' },
  { id: 'PLT-007', group: 'Cost of Sales', label: 'CoS — Site Clearing Costs' },
  { id: 'PLT-008', group: 'Cost of Sales', label: 'CoS — Project Management Fees' },
  // Expenditure
  { id: 'PLT-009', group: 'Expenditure', label: 'Expense — Salaries & Stipends' },
  { id: 'PLT-010', group: 'Expenditure', label: 'Expense — Operations' },
  { id: 'PLT-011', group: 'Expenditure', label: 'Expense — Transport' },
  { id: 'PLT-012', group: 'Expenditure', label: 'Expense — Equipment & PPE' },
  { id: 'PLT-013', group: 'Expenditure', label: 'Expense — Training' },
  { id: 'PLT-014', group: 'Expenditure', label: 'Expense — Administrative' },
  { id: 'PLT-015', group: 'Expenditure', label: 'Expense — Other' },
  // Balance
  { id: 'PLT-016', group: 'Balance', label: 'Opening Balance' },
  { id: 'PLT-017', group: 'Balance', label: 'Closing Balance' },
  { id: 'PLT-018', group: 'Balance', label: 'Transfer In' },
  { id: 'PLT-019', group: 'Balance', label: 'Transfer Out' },
];

const DEFAULT_PL_CATEGORIES: string[] = [
  'Waste Sales — Plastics',
  'Waste Sales — Paper',
  'Waste Sales — Glass',
  'Waste Sales — Metals',
  'EPR Subsidy',
  'Grant Income',
  'Stipends',
  'Fuel',
  'PPE Procurement',
  'Vehicle Maintenance',
  'Utilities',
  'Administrative',
  'Training',
  'Other',
];

// ── Keys ──
const PL_TYPES_KEY = 'w2w_pl_types';
const PL_CATEGORIES_KEY = 'w2w_pl_categories';
const PL_COST_CENTRES_KEY = 'w2w_pl_cost_centres';
const PL_LOCKED_MONTHS_KEY = 'w2w_pl_locked_months';
const PROGRAMME_SETTINGS_KEY = 'w2w_programme_settings';

// ── P&L Types ──
export function loadPLTypes(): PLType[] {
  try {
    const saved = localStorage.getItem(PL_TYPES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_PL_TYPES;
}

export function savePLTypes(types: PLType[]): void {
  localStorage.setItem(PL_TYPES_KEY, JSON.stringify(types));
}

// ── P&L Categories ──
export function loadPLCategories(): string[] {
  try {
    const saved = localStorage.getItem(PL_CATEGORIES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_PL_CATEGORIES;
}

export function savePLCategories(categories: string[]): void {
  localStorage.setItem(PL_CATEGORIES_KEY, JSON.stringify(categories));
}

// ── P&L Cost Centres ──
export function loadPLCostCentres(): string[] {
  try {
    const saved = localStorage.getItem(PL_COST_CENTRES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  // Fall back to programme settings cost centers
  try {
    const ps = localStorage.getItem(PROGRAMME_SETTINGS_KEY);
    if (ps) {
      const parsed = JSON.parse(ps);
      if (Array.isArray(parsed.costCenters) && parsed.costCenters.length > 0) {
        return parsed.costCenters.map((cc: { name: string; code: string }) => `${cc.code} — ${cc.name}`);
      }
    }
  } catch { /* ignore */ }
  return ['OPS-001 — Field Operations', 'HR-001 — Human Resources', 'VEH-001 — Fleet & Transport', 'ADM-001 — General Admin', 'EPR-001 — EPR Compliance'];
}

export function savePLCostCentres(centres: string[]): void {
  localStorage.setItem(PL_COST_CENTRES_KEY, JSON.stringify(centres));
}

// ── Locked Months ──
export function loadLockedMonths(): string[] {
  try {
    const saved = localStorage.getItem(PL_LOCKED_MONTHS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

export function saveLockedMonths(months: string[]): void {
  localStorage.setItem(PL_LOCKED_MONTHS_KEY, JSON.stringify(months));
}

// ── Helpers ──
export function isMonthLocked(dateStr: string, lockedMonths: string[]): boolean {
  if (!dateStr) return false;
  const month = dateStr.slice(0, 7); // "YYYY-MM"
  return lockedMonths.includes(month);
}

/** Get unique groups from types array, preserving order */
export function getTypeGroups(types: PLType[]): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const t of types) {
    if (!seen.has(t.group)) {
      seen.add(t.group);
      groups.push(t.group);
    }
  }
  return groups;
}

/** Determine if a PL type label is income (revenue) */
export function isIncomeType(label: string): boolean {
  const lower = label.toLowerCase();
  return lower.startsWith('revenue') || lower.includes('grant') || lower.includes('subsidy') || lower.includes('income') || lower.includes('epr');
}

/** Default PL types accessor (for resetting in settings) */
export function getDefaultPLTypes(): PLType[] {
  return [...DEFAULT_PL_TYPES];
}

/** Default PL categories accessor */
export function getDefaultPLCategories(): string[] {
  return [...DEFAULT_PL_CATEGORIES];
}

// ── P&L Groups (dynamic) ──
const PL_GROUPS_KEY = 'w2w_pl_groups';
const DEFAULT_PL_GROUPS: string[] = ['Income', 'Cost of Sales', 'Expenditure', 'Balance'];

export function loadPLGroups(): string[] {
  try {
    const saved = localStorage.getItem(PL_GROUPS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_PL_GROUPS];
}

export function savePLGroups(groups: string[]): void {
  localStorage.setItem(PL_GROUPS_KEY, JSON.stringify(groups));
}

export function getDefaultPLGroups(): string[] {
  return [...DEFAULT_PL_GROUPS];
}
