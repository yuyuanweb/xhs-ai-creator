import { create } from 'zustand';
import { authApi, type AuthUser } from '../api/endpoints';
import { getToken, setToken } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (username, password) => {
    const { token, user } = await authApi.login(username, password);
    setToken(token);
    set({ user });
  },

  logout: () => {
    setToken(null);
    set({ user: null });
  },

  restore: async () => {
    if (!getToken()) {
      set({ loading: false });
      return;
    }
    try {
      set({ user: await authApi.me() });
    } catch {
      setToken(null);
    } finally {
      set({ loading: false });
    }
  },
}));
