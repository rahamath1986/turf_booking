'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  HiOutlineMagnifyingGlass,
  HiOutlineCalendarDays,
  HiOutlineHeart,
  HiOutlineUserCircle,
  HiOutlineTicket,
  HiOutlineBell,
} from 'react-icons/hi2';

const navItems = [
  { href: '/play', label: 'Find Turfs', icon: HiOutlineMagnifyingGlass },
  { href: '/play/bookings', label: 'My Bookings', icon: HiOutlineCalendarDays },
  { href: '/play/favorites', label: 'Favorites', icon: HiOutlineHeart },
  { href: '/play/offers', label: 'Offers', icon: HiOutlineTicket },
  { href: '/play/notifications', label: 'Notifications', icon: HiOutlineBell },
  { href: '/play/profile', label: 'Profile', icon: HiOutlineUserCircle },
];

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

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
      <WorkspaceSidebar
        title="TurfPlay"
        subtitle="Book your game"
        initials="TP"
        gradient="from-emerald-500 to-teal-600"
        navItems={navItems}
        activeClass="bg-emerald-500/10 text-emerald-400"
        dotClass="bg-emerald-400"
      />
      <main className="ml-64 min-h-screen">
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
