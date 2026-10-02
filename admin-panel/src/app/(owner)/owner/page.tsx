'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { unwrap } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import StatsCard from '@/components/ui/StatsCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineChartBarSquare,
  HiOutlineXCircle,
} from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Summary = Record<string, any>;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/owner/dashboard');
        setSummary(unwrap<Summary>(data));
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  const revenue = summary?.todayRevenue ?? summary?.revenue?.today ?? summary?.monthRevenue ?? 0;
  const monthRevenue = summary?.monthRevenue ?? summary?.revenue?.month ?? revenue;
  const bookings = summary?.totalBookings ?? summary?.bookings?.total ?? summary?.todayBookings ?? 0;
  const occupancy = summary?.occupancyRate ?? summary?.occupancy ?? 0;
  const cancellations = summary?.cancellations ?? summary?.cancelledBookings ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent: any[] = summary?.recentBookings ?? summary?.upcomingBookings ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Here is what is happening across your venues</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Revenue (month)" value={`₹${num(monthRevenue).toLocaleString()}`} icon={<HiOutlineBanknotes className="h-6 w-6" />} color="emerald" />
        <StatsCard title="Bookings" value={num(bookings).toLocaleString()} icon={<HiOutlineCalendarDays className="h-6 w-6" />} color="blue" />
        <StatsCard title="Occupancy" value={`${num(occupancy)}%`} icon={<HiOutlineChartBarSquare className="h-6 w-6" />} color="purple" />
        <StatsCard title="Cancellations" value={num(cancellations).toLocaleString()} icon={<HiOutlineXCircle className="h-6 w-6" />} color="rose" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-medium text-white">Recent Bookings</p>
            <Link href="/owner/bookings" className="text-xs font-medium text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No recent bookings</p>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 6).map((b, i) => (
                <div key={b.id || i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-white">{b.bookingNumber || b.customerName || b.user?.fullName || 'Booking'}</p>
                    <p className="text-xs text-gray-500">{b.turfName || b.turf?.name || ''} {b.bookingDate ? `• ${String(b.bookingDate).split('T')[0]}` : ''}</p>
                  </div>
                  <Badge label={String(b.status || 'CONFIRMED')} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="mb-4 font-medium text-white">Quick Actions</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/owner/bookings?action=walkin" className="rounded-lg border border-gray-800 bg-gray-800/30 p-4 transition-colors hover:border-blue-500/30">
              <p className="font-medium text-white">Walk-in Booking</p>
              <p className="mt-1 text-xs text-gray-500">Register an on-the-spot sale</p>
            </Link>
            <Link href="/owner/availability" className="rounded-lg border border-gray-800 bg-gray-800/30 p-4 transition-colors hover:border-blue-500/30">
              <p className="font-medium text-white">Manage Slots</p>
              <p className="mt-1 text-xs text-gray-500">Hours, pricing & blocks</p>
            </Link>
            <Link href="/owner/turfs" className="rounded-lg border border-gray-800 bg-gray-800/30 p-4 transition-colors hover:border-blue-500/30">
              <p className="font-medium text-white">My Turfs</p>
              <p className="mt-1 text-xs text-gray-500">Add or edit venues</p>
            </Link>
            <Link href="/owner/scan" className="rounded-lg border border-gray-800 bg-gray-800/30 p-4 transition-colors hover:border-blue-500/30">
              <p className="font-medium text-white">Gate Check-in</p>
              <p className="mt-1 text-xs text-gray-500">Scan player QR codes</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
