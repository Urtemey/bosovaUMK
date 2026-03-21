'use client';

import { createContext, useContext } from 'react';

export interface User {
  id: number;
  login: string;
  display_name: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  role: 'teacher' | 'student' | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string | null, user: User, role: 'teacher' | 'student') => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  refreshToken: null,
  role: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function getStoredAuth(): { token: string; refreshToken: string | null; role: string } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const refreshToken = localStorage.getItem('refreshToken');
  if (token && role) return { token, refreshToken, role };
  return null;
}

export function storeAuth(token: string, refreshToken: string | null, user: User, role: string) {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  localStorage.setItem('user', JSON.stringify(user));
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('user');
  localStorage.removeItem('refreshToken');
}
