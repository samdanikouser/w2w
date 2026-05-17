import { create } from 'zustand';

interface NavState {
  activePage: string;
  /** One-shot intent that the landing page can consume (e.g. open add modal) */
  pendingAction: string | null;
  setActivePage: (page: string, pendingAction?: string) => void;
  consumePendingAction: () => string | null;
}

export const useNavStore = create<NavState>((set, get) => ({
  activePage: 'dashboard',
  pendingAction: null,
  setActivePage: (page, pendingAction) => set({ activePage: page, pendingAction: pendingAction ?? null }),
  consumePendingAction: () => {
    const a = get().pendingAction;
    if (a) set({ pendingAction: null });
    return a;
  },
}));
