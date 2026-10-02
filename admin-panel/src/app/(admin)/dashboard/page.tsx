'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import { PlatformStats } from '@/lib/types';
import StatsCard from '@/components/ui/StatsCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  HiOutlineUsers,
  HiOutlineMapPin,
  HiOutlineCalendarDays,
  HiOutlineBanknotes,
  HiOutlineTrophy,
  HiOutlineBuildingOffice2,
  HiOutlineExclamationTriangle,
  HiOutlineCheckBadge,
} from 'react-icons/hi2';

export default function DashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(unwrap<PlatformStats>(data));
    } catch {
      toast.error('Failed to load platform stats');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Users"
          value={stats?.users?.toLocaleString() || '0'}
          icon={<HiOutlineUsers className="h-6 w-6" />}
          color="blue"
        />
        <StatsCard
          title="Total Turfs"
          value={stats?.turfs?.toLocaleString() || '0'}
          icon={<HiOutlineMapPin className="h-6 w-6" />}
          color="emerald"
        />
        <StatsCard
          title="Total Bookings"
          value={stats?.bookings?.total?.toLocaleString() || '0'}
          subtitle={`${stats?.bookings?.active || 0} active`}
          icon={<HiOutlineCalendarDays className="h-6 w-6" />}
          color="purple"
        />
        <StatsCard
          title="Total Revenue"
          value={`₹${(stats?.totalRevenue || 0).toLocaleString()}`}
          icon={<HiOutlineBanknotes className="h-6 w-6" />}
          color="amber"
        />
      </div>

      {/* Secondary Stats */}
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Sports"
          value={stats?.sports || 0}
          icon={<HiOutlineTrophy className="h-6 w-6" />}
          color="cyan"
        />
        <StatsCard
          title="Cities"
          value={stats?.cities || 0}
          icon={<HiOutlineBuildingOffice2 className="h-6 w-6" />}
          color="blue"
        />
        <StatsCard
          title="Pending Owners"
          value={stats?.pendingApprovals?.owners || 0}
          icon={<HiOutlineExclamationTriangle className="h-6 w-6" />}
          color="rose"
        />
        <StatsCard
          title="Pending Turfs"
          value={stats?.pendingApprovals?.turfs || 0}
          icon={<HiOutlineCheckBadge className="h-6 w-6" />}
          color="amber"
        />
        <StatsCard
          title="Total Owners"
          value={stats?.owners ?? '—'}
          icon={<HiOutlineBuildingOffice2 className="h-6 w-6" />}
          color="purple"
        />
        <StatsCard
          title="Refunds"
          value={stats?.refunds ? `${stats.refunds.total} (₹${stats.refunds.totalAmount.toLocaleString()})` : '—'}
          subtitle={stats?.refunds?.pending != null ? `${stats.refunds.pending} pending` : undefined}
          icon={<HiOutlineBanknotes className="h-6 w-6" />}
          color="rose"
        />
        <StatsCard
          title="Pending Settlements"
          value={stats?.pendingSettlements ?? '—'}
          icon={<HiOutlineBanknotes className="h-6 w-6" />}
          color="amber"
        />
        <StatsCard
          title="Active Coupons"
          value={stats?.activeCoupons ?? '—'}
          icon={<HiOutlineCheckBadge className="h-6 w-6" />}
          color="emerald"
        />
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <a
            href="/owners"
            className="card flex items-center gap-4 transition-colors hover:border-amber-500/30"
          >
            <div className="rounded-lg bg-amber-500/10 p-3">
              <HiOutlineExclamationTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-white">Review Pending Owners</p>
              <p className="text-sm text-gray-500">
                {stats?.pendingApprovals?.owners || 0} awaiting approval
              </p>
            </div>
          </a>

          <a
            href="/turfs"
            className="card flex items-center gap-4 transition-colors hover:border-emerald-500/30"
          >
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <HiOutlineMapPin className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-white">Review Pending Turfs</p>
              <p className="text-sm text-gray-500">
                {stats?.pendingApprovals?.turfs || 0} awaiting approval
              </p>
            </div>
          </a>

          <a
            href="/reports"
            className="card flex items-center gap-4 transition-colors hover:border-blue-500/30"
          >
            <div className="rounded-lg bg-blue-500/10 p-3">
              <HiOutlineBanknotes className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-white">Revenue Reports</p>
              <p className="text-sm text-gray-500">View analytics & trends</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
