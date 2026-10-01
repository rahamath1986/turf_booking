'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
}

interface AuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('admin_user');
    const token = localStorage.getItem('admin_access_token');
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        clearStorage();
      }
    }
    setIsLoading(false);
  }, []);

  function clearStorage() {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
  }

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });

    const tokenData = data.data || data;
    const accessToken = tokenData.accessToken || tokenData.access_token;
    const refreshToken = tokenData.refreshToken || tokenData.refresh_token;
    const userData = tokenData.user;

    // Verify the user has admin role
    const roles: string[] = userData?.roles || [];
    const isAdmin = roles.some(
      (r: string) =>
        r.toLowerCase() === 'super_admin' ||
        r.toLowerCase() === 'admin' ||
        r.toLowerCase() === 'superadmin',
    );

    if (!isAdmin) {
      throw new Error('Access denied. Admin privileges required.');
    }

    localStorage.setItem('admin_access_token', accessToken);
    if (refreshToken) localStorage.setItem('admin_refresh_token', refreshToken);

    const adminUser: AdminUser = {
      id: userData.id,
      email: userData.email,
      fullName: userData.fullName || userData.full_name || '',
      roles,
    };
    localStorage.setItem('admin_user', JSON.stringify(adminUser));
    setUser(adminUser);
    router.push('/dashboard');
  }

  function logout() {
    clearStorage();
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
