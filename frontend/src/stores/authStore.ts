import { create } from 'zustand';
import type { Role, User } from '../types';
import { authApi } from '../api/endpoints';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  appMode: 'boh' | 'fo';
  isLoading: boolean;

  /** Attempt login via API. Returns true on success. */
  login: (email: string, password: string) => Promise<boolean>;

  /** Attempt register via API. Returns true on success. */
  register: (data: any) => Promise<boolean>;

  /** Log out and clear token. */
  logout: () => void;

  setAppMode: (mode: 'boh' | 'fo') => void;

  /** Restore session from stored JWT on app load. */
  restoreSession: () => Promise<void>;
}

function mapApiUser(apiUser: any): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role ? (apiUser.role.toLowerCase() as Role) : undefined,
    siteId: apiUser.siteId || undefined,
    siteName: apiUser.siteName || undefined,
    modules: apiUser.modules || [],
    roleName: apiUser.roleName || undefined,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  appMode: 'boh',
  isLoading: false,

  login: async (email: string, password: string) => {
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem('w2w_token', res.token);
      const user = mapApiUser(res.user);
      const mode = user.modules?.includes('dashboard') ? 'boh' : 'fo';
      set({ user, isAuthenticated: true, appMode: mode });
      return true;
    } catch {
      return false;
    }
  },

  register: async (data: any) => {
    try {
      const res = await authApi.register(data);
      localStorage.setItem('w2w_token', res.token);
      const user = mapApiUser(res.user);
      const mode = user.modules?.includes('dashboard') ? 'boh' : 'fo';
      set({ user, isAuthenticated: true, appMode: mode });
      return true;
    } catch (err: any) {
      console.error("Register error:", err);
      if (err.response?.data) {
        const data = err.response.data;
        if (data.details && Array.isArray(data.details)) {
          const msgs = data.details.map((d: any) => d.message).join(', ');
          throw new Error(`${data.error || 'Validation error'}: ${msgs}`);
        }
        if (data.error) {
          throw new Error(data.error);
        }
      }
      // If it's a network error (no response) or Vite proxy error (HTML instead of JSON)
      throw new Error(err.message || 'Network error or backend is unreachable.');
    }
  },

  logout: () => {
    localStorage.removeItem('w2w_token');
    set({ user: null, isAuthenticated: false, appMode: 'boh' });
  },

  setAppMode: (mode: 'boh' | 'fo') => {
    set({ appMode: mode });
  },

  restoreSession: async () => {
    const token = localStorage.getItem('w2w_token');
    if (!token) return;

    set({ isLoading: true });
    try {
      const apiUser = await authApi.me();
      const user = mapApiUser(apiUser);
      const mode = user.modules?.includes('dashboard') ? 'boh' : 'fo';
      set({ user, isAuthenticated: true, appMode: mode, isLoading: false });
    } catch {
      localStorage.removeItem('w2w_token');
      set({ isLoading: false });
    }
  },
}));
