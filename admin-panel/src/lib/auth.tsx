'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

export interface PortalUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
}

interface AuthContextType {
  user: PortalUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  homeFor: (roles?: string[]) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const norm = (r: string) => r.toLowerCase();

export function isAdminRole(roles: string[]) {
  return roles.some((r) => ['super_admin', 'admin', 'superadmin'].includes(norm(r)));
}

export function isOwnerRole(roles: string[]) {
  return roles.some((r) => ['turf_owner', 'manager', 'staff'].includes(norm(r)));
}

export function isSuperAdmin(roles: string[]) {
  return roles.some((r) => norm(r) === 'super_admin');
}

export function isStaffOnly(roles: string[]) {
  const n = roles.map(norm);
  return n.includes('staff') && !isAdminRole(roles) && !n.includes('turf_owner') && !n.includes('manager');
}

/** Landing page per role priority: admin > owner/manager > staff > customer. */
export function homeForRoles(roles: string[]): string {
  if (isAdminRole(roles)) return '/dashboard';
  if (isStaffOnly(roles)) return '/owner/scan';
  if (isOwnerRole(roles)) return '/owner';
  return '/play';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
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

    const roles: string[] = userData?.roles || [];
    if (roles.length === 0) {
      throw new Error('Login succeeded but no roles were assigned. Contact support.');
    }

    localStorage.setItem('admin_access_token', accessToken);
    if (refreshToken) localStorage.setItem('admin_refresh_token', refreshToken);

    const portalUser: PortalUser = {
      id: userData.id,
      email: userData.email,
      fullName: userData.fullName || userData.full_name || '',
      roles,
    };
    localStorage.setItem('admin_user', JSON.stringify(portalUser));
    setUser(portalUser);
    router.push(homeForRoles(roles));
  }

  function logout() {
    clearStorage();
    setUser(null);
    router.push('/login');
  }

  function hasRole(...roles: string[]) {
    if (!user) return false;
    const mine = user.roles.map(norm);
    return roles.some((r) => mine.includes(norm(r)));
  }

  function homeFor(roles?: string[]) {
    return homeForRoles(roles ?? user?.roles ?? []);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole, homeFor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
