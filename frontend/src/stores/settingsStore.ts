import { create } from 'zustand';
import { settingsApi } from '../api/endpoints';
import { ProgrammeSettings, loadSettings, saveSettings } from '../utils/programmeSettings';

interface SettingsState {
  settings: ProgrammeSettings;
  org: Record<string, string>;
  isLoading: boolean;
  error: string | null;

  // Initialize from local storage, then fetch from API
  fetchSettings: () => Promise<void>;
  
  // Update locally and API
  updateSettings: (partial: Partial<ProgrammeSettings>) => Promise<void>;
  
  // Update org settings locally and API
  updateOrg: (partial: Record<string, string>) => Promise<void>;
}

// Helper to get local org settings
function loadLocalOrg(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('w2w_org') || '{}');
  } catch {
    return {};
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Initialize with local defaults so the app renders immediately
  settings: loadSettings(),
  org: loadLocalOrg(),
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const dbSettings = await settingsApi.get();
      
      const newSettings = { ...get().settings };
      const newOrg = { ...get().org };

      if (dbSettings.programme_settings) {
        Object.assign(newSettings, dbSettings.programme_settings);
      }
      if (dbSettings.org_settings) {
        Object.assign(newOrg, dbSettings.org_settings);
      }

      // Sync down to local storage as cache
      saveSettings(newSettings);
      localStorage.setItem('w2w_org', JSON.stringify(newOrg));

      set({ settings: newSettings, org: newOrg, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial };
    
    // Optimistic UI update
    set({ settings: next });
    saveSettings(next);

    try {
      await settingsApi.update({ programme_settings: next });
    } catch (error: any) {
      console.error('Failed to sync settings to API', error);
      set({ error: 'Failed to sync settings' });
    }
  },

  updateOrg: async (partial) => {
    const next = { ...get().org, ...partial };
    
    // Optimistic UI update
    set({ org: next });
    localStorage.setItem('w2w_org', JSON.stringify(next));

    try {
      await settingsApi.update({ org_settings: next });
    } catch (error: any) {
      console.error('Failed to sync org settings to API', error);
      set({ error: 'Failed to sync org settings' });
    }
  }
}));
