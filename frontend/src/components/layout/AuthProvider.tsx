'use client';

import { useState, useEffect, ReactNode } from 'react';
import { AuthContext, User, getStoredAuth, storeAuth, clearAuth } from '@/lib/auth';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<'teacher' | 'student' | null>(null);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setToken(stored.token);
      setRole(stored.role as 'teacher' | 'student');
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch { /* ignore */ }
      }
    }
  }, []);

  const login = (newToken: string, newUser: User, newRole: 'teacher' | 'student') => {
    setToken(newToken);
    setUser(newUser);
    setRole(newRole);
    storeAuth(newToken, newUser, newRole);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setRole(null);
    clearAuth();
  };

  return (
    <AuthContext value={{ user, token, role, login, logout }}>
      {children}
    </AuthContext>
  );
}
