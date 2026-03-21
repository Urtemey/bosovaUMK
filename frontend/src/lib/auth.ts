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
  role: 'teacher' | 'student' | null;
  login: (token: string, user: User, role: 'teacher' | 'student') => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  role: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function getStoredAuth(): { token: string; role: string } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  if (token && role) return { token, role };
  return null;
}

export function storeAuth(token: string, user: User, role: string) {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('user');
}
