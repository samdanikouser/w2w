import { useState, useMemo } from 'react';
import {
  Search, BookOpen, ChevronDown, ChevronRight, ExternalLink,
  LayoutDashboard, MapPin, BarChart3, DollarSign, TrendingUp, Users,
  UserPlus, Clock, Heart, Package, AlertTriangle, Truck, Home, ScanLine,
  RefreshCw, Settings, CheckSquare, Shield, Keyboard, MessageCircle, HelpCircle,
  FileText, Database, Bell, Lock,
} from 'lucide-react';

// ── Module documentation data ──
interface ModuleDoc {
  id: string;
  title: string;
  icon: React.ReactNode;
  section: string;
  description: string;
  features: string[];
  tips?: string[];
}

const MODULE_DOCS: ModuleDoc[] = [
  {
    id: 'dashboard', title: 'Dashboard', icon: <LayoutDashboard size={16} />, section: 'Overview',
    description: 'Your central command centre showing real-time programme metrics, waste collection trends, employee stats, and financial summaries.',
    features: ['Live KPI cards (employees, waste, revenue, sites)', 'Weekly collection trend chart', 'Quick navigation to all modules', 'Programme health indicators'],
    tips: ['The dashboard auto-refreshes every 60 seconds', 'Click any stat card to navigate to the detailed page'],
  },
  {
    id: 'facilities', title: 'Facility Hierarchy', icon: <MapPin size={16} />, section: 'Overview',
    description: 'Manage all cooperatives, depots, and buyback centres. Track site status, regions, and assign employees.',
    features: ['Add/edit/delete/deactivate sites', 'Categorise by type (Cooperative, Depot, Buyback Centre)', 'Region-based filtering', 'View employees assigned per site', 'Dynamic conditional metrics for each facility type'],
  },
  {
    id: 'waste-logs', title: 'Record Waste', icon: <RefreshCw size={16} />, section: 'Waste Operations',
    description: 'Core waste collection logging — record daily pickups, quantities, and values per site and waste type.',
    features: ['Grid-based entry for all waste streams simultaneously', 'Depot source tracking for external collections', 'Approval workflow (Pending → Approved / Rejected)', 'Bulk entry and CSV import'],
    tips: ['Logs in "Pending" status require admin approval before counting toward EPR reports', 'Use the date range filter to review specific periods'],
  },
  {
    id: 'depot-scanner', title: 'Depot Scanner', icon: <ScanLine size={16} />, section: 'Waste Operations',
    description: 'Live QR code scanning for waste intake at depots — real-time weight capture and logging.',
    features: ['QR code scanning', 'Weight input and capture', 'Auto-log waste entries', 'Real-time depot dashboard'],
  },
  {
    id: 'stock-register', title: 'Stock Register', icon: <Package size={16} />, section: 'Inventory & Assets',
    description: 'Manage PPE, consumables, and equipment inventory across all sites.',
    features: ['Item catalogue with categories (PPE, Consumables, Equipment)', 'Quantity on-hand tracking', 'Reorder point alerts', 'Stock status indicators (OK, Low, Out)'],
    tips: ['Set reorder points to get automatic low-stock warnings'],
  },
  {
    id: 'stock-variance', title: 'Stock Variance', icon: <AlertTriangle size={16} />, section: 'Inventory & Assets',
    description: 'Reconciliation report comparing expected vs actual stock levels to identify discrepancies.',
    features: ['System vs Physical count comparison', 'Variance calculation', 'Shrinkage identification', 'Audit trail for stock adjustments'],
  },
  {
    id: 'vehicles', title: 'Vehicles & Fleet', icon: <Truck size={16} />, section: 'Inventory & Assets',
    description: 'Fleet management for collection vehicles — service schedules, odometer tracking, and status.',
    features: ['Vehicle registration and details', 'Service due date tracking', 'Odometer (km) logging', 'Status management (Operational, Maintenance, Decommissioned)'],
    tips: ['Vehicles with overdue services are flagged with a red badge in the table'],
  },
  {
    id: 'employees', title: 'Employees', icon: <Users size={16} />, section: 'Human Resources',
    description: 'Full employee lifecycle management — from onboarding to termination. Manage personal details, banking, and ID cards.',
    features: ['Employee directory with search & filter', 'Personal info, banking, and ID management', 'Status tracking (Active, On Leave, Probation, Terminated)', 'Digital ID card generation', 'Payslip viewer'],
    tips: ['SA ID and banking details are encrypted (POPIA compliant)', 'Use the filter bar to quickly find employees by site or status'],
  },
  {
    id: 'onboarding', title: 'Onboarding', icon: <UserPlus size={16} />, section: 'Human Resources',
    description: 'Track new hire pipeline — from application through induction to active status.',
    features: ['Multi-stage onboarding pipeline', 'Document checklist', 'Induction scheduling', 'Auto-transition to active employee'],
  },
  {
    id: 'attendance', title: 'Attendance Report', icon: <Clock size={16} />, section: 'Human Resources',
    description: 'Daily check-in/check-out tracking for all employees. Monitor punctuality and leave patterns.',
    features: ['Daily clock-in/out records', 'Attendance status (Present, Absent, Late, Half Day, Leave)', 'Hours worked calculation', 'Monthly attendance summary'],
  },
  {
    id: 'check-in-out', title: 'Check In / Check Out', icon: <Clock size={16} />, section: 'Human Resources',
    description: 'Daily check-in/check-out portal for employees.',
    features: ['Quick check-in', 'Location tracking (if enabled)'],
  },
  {
    id: 'training', title: 'Training Tracker', icon: <BookOpen size={16} />, section: 'Human Resources',
    description: 'Track employee training progress, certifications, and compliance with mandatory modules.',
    features: ['Dynamic creation and management of Training Modules', 'Assign specific modules to all active employees instantly', 'Mandatory vs optional classification', 'Employee enrolment and progress tracking', 'Completion dates and scores'],
  },
  {
    id: 'beneficiary', title: 'Beneficiary Tracker', icon: <Heart size={16} />, section: 'Human Resources',
    description: 'Track programme beneficiaries and their participation metrics.',
    features: ['Beneficiary registration', 'Participation tracking', 'Impact metrics', 'Reporting for funders'],
  },
  {
    id: 'pl-register', title: 'P&L Entry Register', icon: <DollarSign size={16} />, section: 'Finance & Reporting',
    description: 'Record all financial transactions — revenue from waste sales and programme expenses.',
    features: ['Revenue and expense tracking', 'Category-based classification', 'Reference number linking', 'Monthly P&L summary'],
  },
  {
    id: 'epr-reports', title: 'EPR Monthly Reports', icon: <BarChart3 size={16} />, section: 'Finance & Reporting',
    description: 'Extended Producer Responsibility monthly compliance reporting. Generate, submit, and track report status.',
    features: ['Dynamic material breakdown based on configured Waste Types', 'Auto-calculate tonnage from waste logs', 'Monthly breakdown by waste type and PRO partner', 'Export reports for PRO submission'],
  },
  {
    id: 'reports', title: 'Reports & Export', icon: <TrendingUp size={16} />, section: 'Finance & Reporting',
    description: 'Generate detailed analytics and export reports for stakeholders, funders, and compliance bodies.',
    features: ['Revenue vs Expense charts', 'Waste collection analytics', 'Employee productivity metrics', 'CSV/PDF export capability'],
  },
  {
    id: 'demographics', title: 'Demographics', icon: <Users size={16} />, section: 'Finance & Reporting',
    description: 'Workforce composition analytics — gender, age, disability status, and geographic distribution.',
    features: ['Gender ratio breakdown', 'Age distribution charts', 'Disability status tracking', 'Regional workforce mapping'],
  },
  {
    id: 'violations', title: 'Warnings & Violations', icon: <AlertTriangle size={16} />, section: 'Compliance & System',
    description: 'Disciplinary record keeping — from verbal warnings through to dismissal documentation.',
    features: ['Severity levels (Verbal, Written, Final Written, Dismissal)', 'Status tracking (Open, Acknowledged, Closed)', 'Issued-by user attribution', 'Notes and evidence attachment'],
  },
  {
    id: 'audit-log', title: 'Audit Log', icon: <CheckSquare size={16} />, section: 'Compliance & System',
    description: 'POPIA-compliant event trail logging all system actions — creates, updates, deletes, logins, and data exports.',
    features: ['Full action history', 'User attribution and IP logging', 'Entity-level tracking', 'CSV export for compliance audits', 'Retention-period compliant'],
  },
  {
    id: 'w2w-settings', title: 'W2W Settings', icon: <Settings size={16} />, section: 'Compliance & System',
    description: 'Central configuration hub for the entire programme — organisation details, waste categories, training, payments, and access control.',
    features: [
      'Organisation — name, programme info, VAT, EPR PRO, support contacts',
      'Users — manage user accounts, assign roles, reset passwords',
      'Roles & Permissions — create custom roles with module-level access control',
      'Waste Categories — define EPR waste types with pricing per kg and PRO partner / buyer configuration',
      'Training Modules — dynamic creation of mandatory and optional training definitions',
      'Payment Scale — salary grades by role with allowances',
      'Cost Centers — budget allocation by category',
      'System Info — programme constants, version, reference data',
      'Data & POPIA — data retention settings, audit export, deletion requests',
    ],
    tips: ['Use the search bar in the settings sidebar to quickly find any setting'],
  },
];

// ── FAQ data ──
interface FAQ { q: string; a: string }
const FAQS: FAQ[] = [
  { q: 'How do I add a new employee?', a: 'Navigate to People → Employees and click the "+ Add Employee" button. Fill in the required fields (Employee No, First Name, Last Name) and click Save. You can then link them to a user account in Settings → Users.' },
  { q: 'How do I approve waste logs?', a: 'Go to Waste Ops → Waste Collection. Logs in "Pending" status have an approve/reject action. Click the row to view details, then approve or reject. Only users with the appropriate role permissions can approve logs.' },
  { q: 'How do roles and permissions work?', a: 'Go to W2W Settings → Roles & Permissions. Each custom role maps to a permission tier (Super Admin, Site Admin, Data Clerk, Field Worker) and can be assigned specific sidebar modules. Users inherit the modules of their assigned role.' },
  { q: 'Can I export data?', a: 'Yes! Most tables have an export button. The Audit Log, EPR Reports, and Reports pages all support CSV export. For POPIA compliance, data exports are logged in the audit trail.' },
  { q: 'What is POPIA compliance?', a: 'The Protection of Personal Information Act (POPIA) is South Africa\'s data privacy law. W2W encrypts SA ID numbers, banking details, and contact information at the application layer. All data access is logged. You can request data deletion from Settings → Data & POPIA.' },
  { q: 'How do I reset a user\'s password?', a: 'Go to W2W Settings → Users, find the user, and click Edit. You can set a new temporary password. The user should change it on next login. Admins can also use the "Forgot Password" feature on the login page.' },
  { q: 'What are the keyboard shortcuts?', a: 'Press ⌘K (Mac) or Ctrl+K (Windows) to focus the global search bar. Use Tab to navigate between form fields. Press Escape to close modals and dropdowns.' },
  { q: 'How do notifications work?', a: 'Notifications appear in the bell icon on the top bar. They are per-user and persist across sessions. Click a notification to navigate to the relevant page. Use "Mark all as read" to clear the badge count.' },
  { q: 'Who can access what modules?', a: 'Module access is controlled by roles. Super Admins see everything. Other roles see only the modules assigned to them in W2W Settings → Roles & Permissions.' },
  { q: 'How is data backed up?', a: 'The platform uses PostgreSQL with automated backups. For additional safety, admins can export audit trails and critical data via the export functions available throughout the app.' },
];

// ── Keyboard shortcuts ──
interface Shortcut { keys: string; description: string }
const SHORTCUTS: Shortcut[] = [
  { keys: '⌘K / Ctrl+K', description: 'Focus global search' },
  { keys: 'Escape', description: 'Close modal / dropdown' },
  { keys: 'Tab', description: 'Navigate form fields' },
  { keys: 'Enter', description: 'Submit form / confirm action' },
];

// ── Component ──
export default function HelpDocsPage() {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('getting-started');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Group modules by section
  const sections = useMemo(() => {
    const map = new Map<string, ModuleDoc[]>();
    MODULE_DOCS.forEach((m) => {
      if (!map.has(m.section)) map.set(m.section, []);
      map.get(m.section)!.push(m);
    });
    return Array.from(map.entries());
  }, []);

  // Filter modules by search
  const filteredModules = useMemo(() => {
    if (!search.trim()) return MODULE_DOCS;
    const q = search.toLowerCase();
    return MODULE_DOCS.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.features.some((f) => f.toLowerCase().includes(q))
    );
  }, [search]);

  // Filter FAQs by search
  const filteredFaqs = useMemo(() => {
    if (!search.trim()) return FAQS;
    const q = search.toLowerCase();
    return FAQS.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [search]);

  const NAV = [
    { id: 'getting-started', label: 'Getting Started', icon: <HelpCircle size={14} /> },
    { id: 'modules', label: 'Module Guide', icon: <BookOpen size={14} /> },
    { id: 'faq', label: 'FAQ', icon: <MessageCircle size={14} /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard size={14} /> },
    { id: 'popia', label: 'POPIA & Security', icon: <Shield size={14} /> },
    { id: 'support', label: 'Contact Support', icon: <MessageCircle size={14} /> },
  ];

  return (
    <div>
      <div className="ph">
        <div>
          <div className="pt">Help & Documentation</div>
          <div className="ps">Everything you need to know about the W2W Platform</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Sidebar ── */}
        <div className="card" style={{ position: 'sticky', top: 16 }}>
          {/* Search */}
          <div style={{ padding: '12px 12px 8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text3)' }} />
              <input
                className="fc"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search help…"
                style={{ paddingLeft: 30, fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{ padding: '4px 8px 12px' }}>
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setSearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 10px',
                  background: activeSection === item.id ? 'var(--color-w2w-pale)' : 'transparent',
                  color: activeSection === item.id ? 'var(--color-w2w)' : 'var(--color-text)',
                  border: activeSection === item.id ? '1px solid var(--color-w2w-light)' : '1px solid transparent',
                  cursor: 'pointer', borderRadius: 7,
                  fontWeight: activeSection === item.id ? 700 : 500, fontSize: 12,
                  textAlign: 'left', fontFamily: 'var(--font-sans)', transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => { if (activeSection !== item.id) e.currentTarget.style.background = 'var(--color-surface2)'; }}
                onMouseLeave={(e) => { if (activeSection !== item.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: activeSection === item.id ? 'var(--color-w2w)' : 'var(--color-text3)', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* Version */}
          <div style={{ padding: '8px 16px 12px', borderTop: '1px solid var(--color-border)', fontSize: 10, color: 'var(--color-text3)' }}>
            W2W Platform v1.0 • Powered by Elanora
          </div>
        </div>

        {/* ── Content ── */}
        <div>
          {/* ── Getting Started ── */}
          {activeSection === 'getting-started' && (
            <div>
              <SectionTitle icon={<HelpCircle size={16} />} title="Getting Started" />
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="cb">
                  <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.7, marginBottom: 16 }}>
                    Welcome to the <strong>Waste to Work (W2W) Platform</strong> — a comprehensive programme management system designed for
                    waste collection cooperatives, buyback centres, and EPR compliance tracking across South Africa.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {[
                      { step: '1', title: 'Configure your organisation', desc: 'Set up programme details, currency, and VAT in W2W Settings → Organisation.', color: 'var(--color-w2w)' },
                      { step: '2', title: 'Define waste categories', desc: 'Add waste types with EPR groups and pricing in W2W Settings → Waste Categories.', color: 'var(--color-accent)' },
                      { step: '3', title: 'Add sites & employees', desc: 'Register cooperatives/depots and onboard your workforce.', color: '#d97706' },
                      { step: '4', title: 'Start logging waste', desc: 'Begin recording daily waste collections from Waste Ops → Waste Collection.', color: '#6d28d9' },
                    ].map((s) => (
                      <div key={s.step} style={{
                        display: 'flex', gap: 12, padding: 14, borderRadius: 10,
                        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, background: s.color,
                          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 800, flexShrink: 0,
                        }}>
                          {s.step}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginBottom: 3 }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text3)', lineHeight: 1.5 }}>{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="alert alert-blue">
                    <span>
                      <strong>Need help?</strong> Contact your system administrator or use the support form at the bottom of this page.
                    </span>
                  </div>
                </div>
              </div>

              {/* Role overview */}
              <div className="card">
                <div className="ch">
                  <div className="ct">Permission Tiers</div>
                </div>
                <div className="cb">
                  <table>
                    <thead>
                      <tr>
                        <th>Tier</th>
                        <th>Description</th>
                        <th>Typical Use</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td style={{ fontWeight: 600 }}>Super Admin</td><td>Full access to all modules and settings</td><td>Programme managers, IT admins</td></tr>
                      <tr><td style={{ fontWeight: 600 }}>Site Admin</td><td>Manage a specific site's data and users</td><td>Site supervisors, cooperative leads</td></tr>
                      <tr><td style={{ fontWeight: 600 }}>Data Clerk</td><td>Enter and view data, no admin access</td><td>Data capture staff, admin assistants</td></tr>
                      <tr><td style={{ fontWeight: 600 }}>Field Worker</td><td>Limited view access</td><td>Collectors, field operatives</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Module Guide ── */}
          {activeSection === 'modules' && (
            <div>
              <SectionTitle icon={<BookOpen size={16} />} title="Module Guide" />
              <p style={{ fontSize: 12, color: 'var(--color-text3)', marginBottom: 16 }}>
                Detailed documentation for every module in the platform. Click a module to expand its details.
              </p>

              {(search.trim() ? [['Search Results', filteredModules]] as [string, ModuleDoc[]][] : sections).map(([sectionName, mods]) => (
                <div key={sectionName as string} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: 'var(--color-text3)', textTransform: 'uppercase',
                    letterSpacing: '0.1em', padding: '6px 0', marginBottom: 6,
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    {sectionName as string}
                  </div>

                  {(mods as ModuleDoc[]).map((mod) => (
                    <div key={mod.id} className="card" style={{ marginBottom: 8, overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: 'var(--font-sans)', textAlign: 'left',
                        }}
                      >
                        <span style={{ color: 'var(--color-w2w)', flexShrink: 0 }}>{mod.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>{mod.title}</span>
                        <span style={{ fontSize: 10, color: 'var(--color-text3)', background: 'var(--color-surface2)', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                          {mod.section}
                        </span>
                        {expandedModule === mod.id ? <ChevronDown size={14} color="var(--color-text3)" /> : <ChevronRight size={14} color="var(--color-text3)" />}
                      </button>

                      {expandedModule === mod.id && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border)' }}>
                          <p style={{ fontSize: 12, color: 'var(--color-text2)', lineHeight: 1.7, margin: '12px 0' }}>
                            {mod.description}
                          </p>

                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                            Features
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: 'var(--color-text)' }}>
                            {mod.features.map((f, i) => <li key={i}>{f}</li>)}
                          </ul>

                          {mod.tips && mod.tips.length > 0 && (
                            <>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-accent-dark)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 14, marginBottom: 8 }}>
                                💡 Tips
                              </div>
                              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 1.8, color: 'var(--color-text2)' }}>
                                {mod.tips.map((t, i) => <li key={i}>{t}</li>)}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {(mods as ModuleDoc[]).length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--color-text3)' }}>
                      No modules match your search.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── FAQ ── */}
          {activeSection === 'faq' && (
            <div>
              <SectionTitle icon={<MessageCircle size={16} />} title="Frequently Asked Questions" />

              {filteredFaqs.map((faq, i) => (
                <div key={i} className="card" style={{ marginBottom: 8, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      background: expandedFaq === i ? 'var(--color-w2w)' : 'var(--color-surface3)',
                      color: expandedFaq === i ? 'white' : 'var(--color-text3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, transition: 'all 0.15s',
                    }}>
                      Q
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', flex: 1 }}>{faq.q}</span>
                    {expandedFaq === i ? <ChevronDown size={14} color="var(--color-text3)" /> : <ChevronRight size={14} color="var(--color-text3)" />}
                  </button>

                  {expandedFaq === i && (
                    <div style={{ padding: '0 16px 16px 48px', borderTop: '1px solid var(--color-border)' }}>
                      <p style={{ fontSize: 12, color: 'var(--color-text2)', lineHeight: 1.8, marginTop: 12 }}>
                        {faq.a}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {filteredFaqs.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', fontSize: 12, color: 'var(--color-text3)' }}>
                  No FAQ matches your search.
                </div>
              )}
            </div>
          )}

          {/* ── Keyboard Shortcuts ── */}
          {activeSection === 'shortcuts' && (
            <div>
              <SectionTitle icon={<Keyboard size={16} />} title="Keyboard Shortcuts" />
              <div className="card">
                <div className="cb">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 180 }}>Shortcut</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SHORTCUTS.map((s, i) => (
                        <tr key={i}>
                          <td>
                            <kbd style={{
                              fontSize: 11, fontFamily: 'var(--font-mono)', padding: '3px 8px',
                              borderRadius: 5, background: 'var(--color-surface2)',
                              border: '1px solid var(--color-border)', color: 'var(--color-text)',
                              fontWeight: 600,
                            }}>
                              {s.keys}
                            </kbd>
                          </td>
                          <td style={{ fontSize: 12 }}>{s.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── POPIA & Security ── */}
          {activeSection === 'popia' && (
            <div>
              <SectionTitle icon={<Shield size={16} />} title="POPIA & Security" />

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="ch">
                  <div className="ct">🔒 Data Protection</div>
                </div>
                <div className="cb">
                  <p style={{ fontSize: 12, color: 'var(--color-text)', lineHeight: 1.8, marginBottom: 14 }}>
                    The W2W Platform is built to comply with the <strong>Protection of Personal Information Act (POPIA)</strong> —
                    South Africa's primary data privacy legislation.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { icon: <Lock size={14} />, title: 'Encryption', desc: 'SA ID numbers, banking details, and contact information are encrypted at the application layer.' },
                      { icon: <FileText size={14} />, title: 'Audit Trail', desc: 'Every create, update, delete, login, and export is logged with user attribution and IP address.' },
                      { icon: <Database size={14} />, title: 'Data Retention', desc: 'Configurable retention periods — 7 years post-termination for employees, 10 years for waste logs.' },
                      { icon: <Bell size={14} />, title: 'Breach Notification', desc: 'Automated alerts and audit exports support breach notification requirements under POPIA.' },
                    ].map((item, i) => (
                      <div key={i} style={{
                        padding: 14, borderRadius: 10, border: '1px solid var(--color-border)',
                        display: 'flex', gap: 10,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: 'var(--color-w2w-pale)', color: 'var(--color-w2w)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {item.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text3)', lineHeight: 1.5 }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="ch">
                  <div className="ct">🛡️ Access Control</div>
                </div>
                <div className="cb">
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 2, color: 'var(--color-text)' }}>
                    <li><strong>JWT Authentication</strong> — Secure token-based sessions with expiry</li>
                    <li><strong>Password Policy</strong> — Minimum 10 characters, mixed case, digits required</li>
                    <li><strong>Rate Limiting</strong> — 10 login attempts per 15 minutes, 200 API requests per window</li>
                    <li><strong>Role-Based Access</strong> — 4 permission tiers with per-module granularity</li>
                    <li><strong>Session Management</strong> — Automatic logout on token expiry</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ── Contact Support ── */}
          {activeSection === 'support' && (
            <div>
              <SectionTitle icon={<MessageCircle size={16} />} title="Contact Support" />

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="cb">
                  <p style={{ fontSize: 12, color: 'var(--color-text)', lineHeight: 1.7, marginBottom: 16 }}>
                    If you need assistance or want to report an issue, reach out through any of the channels below.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {[
                      { icon: '📧', label: 'Email', value: 'support@elanora.co.za', desc: 'Response within 24 hours' },
                      { icon: '📞', label: 'Phone', value: '+27 11 000 0000', desc: 'Mon–Fri, 08:00–17:00 SAST' },
                      { icon: '💬', label: 'In-App', value: 'Notifications', desc: 'Admin can send announcements' },
                    ].map((ch, i) => (
                      <div key={i} style={{
                        padding: 18, borderRadius: 10, border: '1px solid var(--color-border)',
                        textAlign: 'center', background: 'var(--color-surface)',
                      }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{ch.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{ch.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--color-w2w)', fontWeight: 600, marginBottom: 4 }}>{ch.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text3)' }}>{ch.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="alert alert-blue">
                <span>
                  <strong>System Information:</strong> W2W Platform v1.0 • Built by Elanora • Powered by React, Node.js, PostgreSQL
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section title component ──
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      fontSize: 15, fontWeight: 700, color: 'var(--color-text)',
      marginBottom: 16, paddingBottom: 10,
      borderBottom: '2px solid var(--color-border)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ color: 'var(--color-w2w)' }}>{icon}</span>
      {title}
    </div>
  );
}
