import { create } from 'zustand';
import type { Role, User } from '../types';
import { authApi } from '../api/endpoints';
import { setAccessToken, getAccessToken } from '../api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  appMode: 'boh' | 'fo';
  isLoading: boolean;

  /** Attempt login via API. Returns true on success. */
  login: (email: string, password: string) => Promise<boolean>;

  /** Attempt register via API. Returns true on success. */
  register: (data: any) => Promise<boolean>;

  /** Log out, revoke refresh token, and clear session. */
  logout: () => Promise<void>;

  setAppMode: (mode: 'boh' | 'fo') => void;

  /** Restore session from refresh token cookie on app load. */
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
    depotId: apiUser.depotId || undefined,
    depotName: apiUser.depotName || undefined,
    managedSiteIds: apiUser.managedSiteIds || [],
    isDepotManager: apiUser.isDepotManager || false,
  };
}

function updateOrgName(siteName: string | undefined) {
  if (siteName) {
    try {
      const org = JSON.parse(localStorage.getItem('w2w_org') || '{}');
      org.orgName = siteName;
      localStorage.setItem('w2w_org', JSON.stringify(org));
    } catch (e) {}
  }
}

export const useAuthStore = create<AuthState>((set) => {
  // Listen for session expiry events from the API client
  if (typeof window !== 'undefined') {
    window.addEventListener('w2w:session-expired', () => {
      setAccessToken(null);
      window.location.hash = '';
      set({ user: null, isAuthenticated: false, appMode: 'boh' });
    });
  }

  return {
    user: null,
    isAuthenticated: false,
    appMode: 'boh',
    isLoading: false,

    login: async (email: string, password: string) => {
      try {
        const res = await authApi.login({ email, password });
        // Store access token in memory only (never localStorage)
        setAccessToken(res.token);
        const user = mapApiUser(res.user);
        const mode = user.modules?.includes('dashboard') ? 'boh' : 'fo';
        updateOrgName(user.siteName);
        window.location.hash = 'dashboard';
        set({ user, isAuthenticated: true, appMode: mode });
        return true;
      } catch {
        return false;
      }
    },

    register: async (data: any) => {
      try {
        const res = await authApi.register(data);
        // Store access token in memory only
        setAccessToken(res.token);
        const user = mapApiUser(res.user);
        const mode = user.modules?.includes('dashboard') ? 'boh' : 'fo';
        updateOrgName(user.siteName);
        window.location.hash = 'dashboard';
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
        throw new Error(err.message || 'Network error or backend is unreachable.');
      }
    },

    logout: async () => {
      try {
        // Call backend to revoke refresh token and clear cookie
        await authApi.logout();
      } catch (_) { /* best-effort */ }
      setAccessToken(null);
      window.location.hash = '';
      set({ user: null, isAuthenticated: false, appMode: 'boh' });
    },

    setAppMode: (mode: 'boh' | 'fo') => {
      set({ appMode: mode });
    },

    restoreSession: async () => {
      // Try to get a new access token using the httpOnly refresh cookie
      set({ isLoading: true });
      try {
        const res = await authApi.refresh();
        setAccessToken(res.token);
        const user = mapApiUser(res.user);
        const mode = user.modules?.includes('dashboard') ? 'boh' : 'fo';
        updateOrgName(user.siteName);
        set({ user, isAuthenticated: true, appMode: mode, isLoading: false });
      } catch {
        setAccessToken(null);
        set({ isLoading: false });
      }
    },
  };
});
