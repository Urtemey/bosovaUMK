'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthContext, User, getStoredAuth, storeAuth, clearAuth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [role, setRole] = useState<'teacher' | 'student' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to refresh the access token using the refresh token
  const tryRefresh = useCallback(async (rToken: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${rToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        return data.access_token || null;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  // Validate token by calling /auth/me, refresh if expired
  const validateAndHydrate = useCallback(async (stored: { token: string; refreshToken: string | null; role: string }) => {
    try {
      // Try current token
      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${stored.token}` },
      });

      if (meRes.ok) {
        // Token is valid
        const meData = await meRes.json();
        setToken(stored.token);
        setRefreshToken(stored.refreshToken);
        setRole(meData.role as 'teacher' | 'student');
        setUser(meData.user);
        // Update localStorage with fresh user data
        storeAuth(stored.token, stored.refreshToken, meData.user, meData.role);
        return;
      }

      // Token expired — try refresh
      if (meRes.status === 401 && stored.refreshToken) {
        const newToken = await tryRefresh(stored.refreshToken);
        if (newToken) {
          // Validate the new token
          const meRes2 = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${newToken}` },
          });
          if (meRes2.ok) {
            const meData = await meRes2.json();
            setToken(newToken);
            setRefreshToken(stored.refreshToken);
            setRole(meData.role as 'teacher' | 'student');
            setUser(meData.user);
            storeAuth(newToken, stored.refreshToken, meData.user, meData.role);
            return;
          }
        }
      }

      // All failed — clear auth
      clearAuth();
    } catch {
      // Network error — use cached data as fallback
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setToken(stored.token);
          setRefreshToken(stored.refreshToken);
          setRole(stored.role as 'teacher' | 'student');
          setUser(JSON.parse(storedUser));
          return;
        } catch { /* ignore */ }
      }
      clearAuth();
    }
  }, [tryRefresh]);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      validateAndHydrate(stored).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [validateAndHydrate]);

  const login = (newToken: string, newRefreshToken: string | null, newUser: User, newRole: 'teacher' | 'student') => {
    setToken(newToken);
    setRefreshToken(newRefreshToken);
    setUser(newUser);
    setRole(newRole);
    storeAuth(newToken, newRefreshToken, newUser, newRole);
  };

  const logout = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setRole(null);
    clearAuth();
  };

  return (
    <AuthContext value={{ user, token, refreshToken, role, isLoading, login, logout }}>
      {children}
    </AuthContext>
  );
}
