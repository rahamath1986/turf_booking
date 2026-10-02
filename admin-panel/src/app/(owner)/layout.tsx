'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, isOwnerRole, isAdminRole, isStaffOnly } from '@/lib/auth';
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  HiOutlineChartBarSquare,
  HiOutlineMapPin,
  HiOutlineCalendarDays,
  HiOutlineClock,
  HiOutlineBanknotes,
  HiOutlineQrCode,
  HiOutlineBell,
  HiOutlineUserCircle,
} from 'react-icons/hi2';

const navItems = [
  { href: '/owner', label: 'Overview', icon: HiOutlineChartBarSquare },
  { href: '/owner/turfs', label: 'My Turfs', icon: HiOutlineMapPin },
  { href: '/owner/bookings', label: 'Bookings', icon: HiOutlineCalendarDays },
  { href: '/owner/availability', label: 'Availability', icon: HiOutlineClock },
  { href: '/owner/earnings', label: 'Earnings', icon: HiOutlineBanknotes },
  { href: '/owner/scan', label: 'Scan & Check-in', icon: HiOutlineQrCode },
  { href: '/owner/notifications', label: 'Notifications', icon: HiOutlineBell },
  { href: '/owner/profile', label: 'Profile', icon: HiOutlineUserCircle },
];

const STAFF_PATHS = ['/owner/scan', '/owner/notifications', '/owner/profile'];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, homeFor } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const staffOnly = !!user && isStaffOnly(user.roles);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
    } else if (!isOwnerRole(user.roles) && !isAdminRole(user.roles)) {
      router.push(homeFor());
    } else if (
      isStaffOnly(user.roles) &&
      pathname &&
      !STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
    ) {
      // Gate staff see scan + inbox + profile only (backend 403s everything else).
      router.push('/owner/scan');
    }
  }, [user, isLoading, homeFor, router, pathname]);

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
        title="Owner Studio"
        subtitle="Venue management"
        initials="OS"
        gradient="from-blue-500 to-indigo-600"
        navItems={staffOnly ? navItems.filter((n) => STAFF_PATHS.includes(n.href)) : navItems}
        activeClass="bg-blue-500/10 text-blue-400"
        dotClass="bg-blue-400"
      />
      <main className="ml-64 min-h-screen">
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
