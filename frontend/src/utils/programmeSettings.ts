export interface WasteCategory {
  id: string;
  name: string;
  code: string;
  eprGroup: string;
  buyer: string;
  pricePerKg: number;
  color: string;
}

export interface TrainingModule {
  id: string;
  name: string;
  type: 'mandatory' | 'optional';
}

export interface PaymentScale {
  role: string;
  basic: number;
  allowances: number;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  type: string;
  budget: number;
  notes: string;
}

export interface ProgrammeSettings {
  wasteCategories: WasteCategory[];
  trainingModules: TrainingModule[];
  paymentScales: PaymentScale[];
  costCenters: CostCenter[];
  proPartners: string[];
  system: Record<string, string>;
  // Dynamic Employee Fields
  departments: string[];
  designations: string[];
  banks: string[];
}

const DEFAULTS: ProgrammeSettings = {
  wasteCategories: [
    { id: 'WC-001', name: 'PET Plastic', code: 'PET', eprGroup: 'Plastics', buyer: 'Petco', pricePerKg: 4.50, color: '#3b82f6' },
    { id: 'WC-002', name: 'HDPE Plastic', code: 'HDPE', eprGroup: 'Plastics', buyer: 'Petco', pricePerKg: 5.20, color: '#10b981' },
    { id: 'WC-003', name: 'Cardboard', code: 'CARD', eprGroup: 'Paper & Packaging', buyer: 'Mpact', pricePerKg: 1.80, color: '#d97706' },
    { id: 'WC-004', name: 'Glass (Mixed)', code: 'GLASS', eprGroup: 'Glass', buyer: 'Consol', pricePerKg: 0.60, color: '#6366f1' },
    { id: 'WC-005', name: 'Aluminium Cans', code: 'ALU', eprGroup: 'Metals', buyer: 'Collect-a-Can', pricePerKg: 15.00, color: '#ef4444' },
    { id: 'WC-006', name: 'Tin/Steel Cans', code: 'TIN', eprGroup: 'Metals', buyer: 'Collect-a-Can', pricePerKg: 2.50, color: '#64748b' },
    { id: 'WC-007', name: 'LDPE Plastic', code: 'LDPE', eprGroup: 'Plastics', buyer: 'Polyco', pricePerKg: 3.00, color: '#8b5cf6' },
    { id: 'WC-008', name: 'Mixed Paper', code: 'PAPER', eprGroup: 'Paper & Packaging', buyer: 'Mpact', pricePerKg: 1.20, color: '#f59e0b' },
  ],
  trainingModules: [
    { id: 'TM-001', name: 'Health & Safety', type: 'mandatory' },
    { id: 'TM-002', name: 'Safe Clearing of Illegal Dumping Sites', type: 'mandatory' },
    { id: 'TM-003', name: 'Waste Sorting & Separation', type: 'mandatory' },
    { id: 'TM-004', name: 'Recycling Best Practices', type: 'mandatory' },
    { id: 'TM-005', name: 'PPE Usage & Maintenance', type: 'mandatory' },
    { id: 'TM-006', name: 'Basic First Aid', type: 'mandatory' },
    { id: 'TM-007', name: 'Fire Safety', type: 'mandatory' },
    { id: 'TM-008', name: 'Environmental Awareness', type: 'optional' },
    { id: 'TM-009', name: 'Basic Literacy & Numeracy', type: 'optional' },
    { id: 'TM-010', name: 'Customer Service', type: 'optional' },
    { id: 'TM-011', name: 'Leadership Skills', type: 'optional' },
  ],
  paymentScales: [
    { role: 'Cooperative Leader', basic: 4500, allowances: 1200 },
    { role: 'Team Leader', basic: 3800, allowances: 800 },
    { role: 'Sorter', basic: 3200, allowances: 500 },
    { role: 'Collector', basic: 3000, allowances: 600 },
    { role: 'Driver', basic: 4200, allowances: 1000 },
    { role: 'General Worker', basic: 2800, allowances: 400 },
  ],
  costCenters: [
    { id: 'CC-001', code: 'OPS-001', name: 'Field Operations', type: 'Operational', budget: 450000, notes: 'Collection routes, equipment' },
    { id: 'CC-002', code: 'HR-001', name: 'Human Resources', type: 'Administrative', budget: 280000, notes: 'Salaries, training, PPE' },
    { id: 'CC-003', code: 'VEH-001', name: 'Fleet & Transport', type: 'Operational', budget: 180000, notes: 'Fuel, maintenance, insurance' },
    { id: 'CC-004', code: 'ADM-001', name: 'General Admin', type: 'Administrative', budget: 120000, notes: 'Office, IT, communications' },
    { id: 'CC-005', code: 'EPR-001', name: 'EPR Compliance', type: 'Regulatory', budget: 95000, notes: 'Audits, reporting, PRO fees' },
  ],
  system: {
    programme: 'Waste to Work (W2W) Pilot',
    client: 'SCM Management Consulting (Pty) Ltd',
    metro: 'City of Johannesburg Metro, Gauteng',
    version: 'W2W Platform v10',
    reference: 'ACS-SW-2026-047',
  },
  proPartners: ['Petco', 'Polyco', 'Fibre Cycle', 'Metpac', 'E-Wasa', 'Circular Energy'],
  departments: ['Collections', 'Sorting', 'Admin', 'Transport', 'Security', 'Management'],
  designations: ['Collector', 'Sorter', 'Driver', 'Supervisor', 'Admin Officer', 'Manager', 'Security Guard'],
  banks: ['Standard Bank', 'FNB', 'ABSA', 'Nedbank', 'Capitec'],
};

const LS_KEY = 'w2w_programme_settings';

export function loadSettings(): ProgrammeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    
    // Merge defaults for new arrays if missing
    if (!saved.departments || !Array.isArray(saved.departments)) saved.departments = [...DEFAULTS.departments];
    if (!saved.designations || !Array.isArray(saved.designations)) saved.designations = [...DEFAULTS.designations];
    if (!saved.banks || !Array.isArray(saved.banks)) saved.banks = [...DEFAULTS.banks];
    
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: ProgrammeSettings) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}
