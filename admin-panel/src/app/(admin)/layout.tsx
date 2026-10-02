'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, isAdminRole } from '@/lib/auth';
import Sidebar from '@/components/layout/Sidebar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, homeFor } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
    } else if (!isAdminRole(user.roles)) {
      router.push(homeFor());
    }
  }, [user, isLoading, homeFor, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
