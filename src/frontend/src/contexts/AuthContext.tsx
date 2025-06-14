import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginRequest } from '@shared/types';
import { apiService } from '../services/api.service';
import { useLiff } from './LiffContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { liff, isInClient } = useLiff();

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = apiService.getToken();
      
      if (token) {
        const user = await apiService.getProfile();
        setUser(user);
      } else if (isInClient && liff?.isLoggedIn()) {
        // Auto-login with LINE if in LIFF client
        const accessToken = liff.getAccessToken();
        if (accessToken) {
          await login({ provider: 'line', token: accessToken });
        }
      }
    } catch (err: any) {
      console.error('Failed to load user:', err);
      setError(err.message);
      apiService.clearToken();
    } finally {
      setLoading(false);
    }
  }, [liff, isInClient]);

  const login = useCallback(async (request: LoginRequest) => {
    try {
      setLoading(true);
      setError(null);

      const { user, token } = await apiService.login(request);
      apiService.setToken(token);
      setUser(user);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await apiService.logout();
      setUser(null);

      // Also logout from LIFF if in client
      if (isInClient && liff?.isLoggedIn()) {
        liff.logout();
      }
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, [liff, isInClient]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!user) throw new Error('No user logged in');

    try {
      setLoading(true);
      setError(null);

      const updatedUser = await apiService.updateProfile(updates);
      setUser(updatedUser);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      const freshUser = await apiService.getProfile();
      setUser(freshUser);
    } catch (err: any) {
      console.error('Failed to refresh user:', err);
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}