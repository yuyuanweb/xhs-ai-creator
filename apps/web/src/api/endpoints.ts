import { api } from './client';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; user: AuthUser }>('/auth/login', { username, password }),
  me: () => api.get<AuthUser>('/auth/me'),
};
