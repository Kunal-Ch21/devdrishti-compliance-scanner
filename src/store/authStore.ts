import { create } from 'zustand';
import { Inspector } from '@/types';
import { inspectors } from '@/data/inspectorProfiles';

interface AuthState {
  inspector: Inspector | null;
  isLoggedIn: boolean;
  login: (inspectorId: string, password: string) => boolean;
  logout: () => void;
  getInspectorDetails: () => Inspector | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  inspector: null,
  isLoggedIn: false,

  login: (inspectorId: string, password: string) => {
    const inspector = inspectors.find(
      (insp) => insp.id === inspectorId && insp.password === password
    );

    if (inspector) {
      set({ inspector, isLoggedIn: true });
      localStorage.setItem('inspector_id', inspectorId);
      localStorage.setItem('inspector_name', inspector.name);
      return true;
    }
    return false;
  },

  logout: () => {
    set({ inspector: null, isLoggedIn: false });
    localStorage.removeItem('inspector_id');
    localStorage.removeItem('inspector_name');
  },

  getInspectorDetails: () => {
    return get().inspector;
  },
}));
