'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Home() {
  const { user, isLoading, homeFor } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? homeFor() : '/login');
  }, [user, isLoading, homeFor, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <LoadingSpinner size="lg" />
    </div>
  );
}
