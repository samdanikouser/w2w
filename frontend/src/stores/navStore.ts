import { create } from 'zustand';

// ── Valid pages (used to validate hash on load) ──
const VALID_PAGES = new Set([
  'dashboard', 'employees', 'waste-logs', 'sites', 'epr-reports',
  'pl-register', 'reports', 'demographics', 'onboarding', 'attendance',
  'check-in-out', 'beneficiary', 'stock-register', 'stock-variance', 'vehicles', 'depots',
  'depot-scanner', 'training', 'violations', 'audit-log', 'w2w-settings',
  'profile', 'help-docs', 'waste-report',
  'training-report', 'demographics-report', 'attendance-report', 'pl-report',
]);

/** Read active page from URL hash (e.g. #employees → 'employees') */
function getPageFromHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return VALID_PAGES.has(hash) ? hash : 'dashboard';
}

interface NavState {
  activePage: string;
  /** One-shot intent that the landing page can consume (e.g. open add modal) */
  pendingAction: string | null;
  setActivePage: (page: string, pendingAction?: string) => void;
  consumePendingAction: () => string | null;
}

export const useNavStore = create<NavState>((set, get) => ({
  activePage: getPageFromHash(),
  pendingAction: null,
  setActivePage: (page, pendingAction) => {
    // Update URL hash without full page reload
    window.history.pushState(null, '', `#${page}`);
    set({ activePage: page, pendingAction: pendingAction ?? null });
  },
  consumePendingAction: () => {
    const a = get().pendingAction;
    if (a) set({ pendingAction: null });
    return a;
  },
}));

// ── Listen for browser back/forward navigation ──
window.addEventListener('popstate', () => {
  const page = getPageFromHash();
  useNavStore.setState({ activePage: page, pendingAction: null });
});
