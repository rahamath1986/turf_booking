'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import {
  RevenueReport,
  BookingsReport,
  UsersReport,
  TurfsReport,
  CommissionReport,
  RefundsReport,
} from '@/lib/types';
import StatsCard from '@/components/ui/StatsCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineUsers,
  HiOutlineMapPin,
  HiOutlineReceiptPercent,
  HiOutlineArrowUturnLeft,
} from 'react-icons/hi2';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type ReportTab = 'revenue' | 'bookings' | 'users' | 'turfs' | 'commission' | 'refunds';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('revenue');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [bookings, setBookings] = useState<BookingsReport | null>(null);
  const [users, setUsers] = useState<UsersReport | null>(null);
  const [turfs, setTurfs] = useState<TurfsReport | null>(null);
  const [commission, setCommission] = useState<CommissionReport | null>(null);
  const [refunds, setRefunds] = useState<RefundsReport | null>(null);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startDate, endDate, groupBy]);

  async function loadReport() {
    setLoading(true);
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (groupBy) params.groupBy = groupBy;

    try {
      switch (activeTab) {
        case 'revenue': {
          const { data } = await api.get('/admin/reports/revenue', { params });
          setRevenue(unwrap<RevenueReport>(data));
          break;
        }
        case 'bookings': {
          const { data } = await api.get('/admin/reports/bookings', { params });
          setBookings(unwrap<BookingsReport>(data));
          break;
        }
        case 'users': {
          const { data } = await api.get('/admin/reports/users', { params });
          setUsers(unwrap<UsersReport>(data));
          break;
        }
        case 'turfs': {
          const { data } = await api.get('/admin/reports/turfs', { params });
          setTurfs(unwrap<TurfsReport>(data));
          break;
        }
        case 'commission': {
          const { data } = await api.get('/admin/reports/commission', { params });
          setCommission(unwrap<CommissionReport>(data));
          break;
        }
        case 'refunds': {
          const { data } = await api.get('/admin/reports/refunds', { params });
          setRefunds(unwrap<RefundsReport>(data));
          break;
        }
      }
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { key: ReportTab; label: string; icon: typeof HiOutlineBanknotes }[] = [
    { key: 'revenue', label: 'Revenue', icon: HiOutlineBanknotes },
    { key: 'bookings', label: 'Bookings', icon: HiOutlineCalendarDays },
    { key: 'users', label: 'Users', icon: HiOutlineUsers },
    { key: 'turfs', label: 'Turfs', icon: HiOutlineMapPin },
    { key: 'commission', label: 'Commission', icon: HiOutlineReceiptPercent },
    { key: 'refunds', label: 'Refunds', icon: HiOutlineArrowUturnLeft },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Platform insights and performance metrics</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-transparent'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field w-40" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field w-40" />
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')} className="select-field w-36">
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div>
          {/* Revenue Report */}
          {activeTab === 'revenue' && revenue && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Total Revenue" value={`₹${revenue.totals.revenue.toLocaleString()}`} icon={<HiOutlineBanknotes className="h-6 w-6" />} color="emerald" />
                <StatsCard title="Bookings" value={revenue.totals.bookingsCount} icon={<HiOutlineCalendarDays className="h-6 w-6" />} color="blue" />
                <StatsCard title="Tax Collected" value={`₹${revenue.totals.taxAmount.toLocaleString()}`} icon={<HiOutlineReceiptPercent className="h-6 w-6" />} color="purple" />
                <StatsCard title="Discounts Given" value={`₹${revenue.totals.discountAmount.toLocaleString()}`} icon={<HiOutlineArrowUturnLeft className="h-6 w-6" />} color="amber" />
              </div>
              {revenue.trend.length > 0 && (
                <div className="card">
                  <p className="mb-4 font-medium text-white">Revenue Trend</p>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={revenue.trend}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Bookings Report */}
          {activeTab === 'bookings' && bookings && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <StatsCard title="Total Bookings" value={bookings.total} icon={<HiOutlineCalendarDays className="h-6 w-6" />} color="blue" />
                {Object.entries(bookings.byStatus).map(([status, count]) => (
                  <div key={status} className="card flex items-center justify-between">
                    <div>
                      <Badge label={status} />
                      <p className="mt-2 text-2xl font-bold text-white">{count}</p>
                    </div>
                  </div>
                ))}
              </div>
              {bookings.trend.length > 0 && (
                <div className="card">
                  <p className="mb-4 font-medium text-white">Bookings Trend</p>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={bookings.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }} />
                      <Bar dataKey="CONFIRMED" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="COMPLETED" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="CANCELLED" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Users Report */}
          {activeTab === 'users' && users && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Total Users" value={users.totalUsers} icon={<HiOutlineUsers className="h-6 w-6" />} color="blue" />
                <StatsCard title="New Users" value={users.newUsersInPeriod} subtitle="In selected period" icon={<HiOutlineUsers className="h-6 w-6" />} color="emerald" />
                <StatsCard title="Verified Users" value={users.verifiedUsers} icon={<HiOutlineUsers className="h-6 w-6" />} color="purple" />
                <StatsCard title="Verification Rate" value={`${users.verificationRate}%`} icon={<HiOutlineUsers className="h-6 w-6" />} color="amber" />
              </div>
              {users.byRole.length > 0 && (
                <div className="card">
                  <p className="mb-4 font-medium text-white">Users by Role</p>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={users.byRole} dataKey="count" nameKey="role" cx="50%" cy="50%" outerRadius={100} label={(props: unknown) => {
                        const p = props as Record<string, unknown>;
                        return `${String(p.role ?? '')}: ${String(p.count ?? '')}`;
                      }}>
                        {users.byRole.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Turfs Report */}
          {activeTab === 'turfs' && turfs && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard title="Total Turfs" value={turfs.total} icon={<HiOutlineMapPin className="h-6 w-6" />} color="blue" />
                <StatsCard title="Approved" value={turfs.approved} icon={<HiOutlineMapPin className="h-6 w-6" />} color="emerald" />
                <StatsCard title="Active" value={turfs.active} icon={<HiOutlineMapPin className="h-6 w-6" />} color="purple" />
                <StatsCard title="Approval Rate" value={`${turfs.approvalRate}%`} icon={<HiOutlineMapPin className="h-6 w-6" />} color="amber" />
              </div>
              {turfs.byCity.length > 0 && (
                <div className="card">
                  <p className="mb-4 font-medium text-white">Turfs by City</p>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={turfs.byCity} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis dataKey="cityName" type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} width={120} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }} />
                      <Bar dataKey="turfCount" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Commission Report */}
          {activeTab === 'commission' && commission && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <StatsCard title="Gross Amount" value={`₹${commission.totals.grossAmount.toLocaleString()}`} subtitle={`${commission.totals.transactionCount} transactions`} icon={<HiOutlineBanknotes className="h-6 w-6" />} color="blue" />
                <StatsCard title="Commission Earned" value={`₹${commission.totals.commissionAmount.toLocaleString()}`} icon={<HiOutlineReceiptPercent className="h-6 w-6" />} color="emerald" />
                <StatsCard title="Owner Earnings" value={`₹${commission.totals.netOwnerEarning.toLocaleString()}`} icon={<HiOutlineBanknotes className="h-6 w-6" />} color="purple" />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="card">
                  <p className="mb-3 font-medium text-emerald-400">✅ Settled</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Transactions</span><span className="text-white">{commission.settled.count}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Commission</span><span className="text-white">₹{commission.settled.commissionAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Owner Earning</span><span className="text-white">₹{commission.settled.netOwnerEarning.toLocaleString()}</span></div>
                  </div>
                </div>
                <div className="card">
                  <p className="mb-3 font-medium text-amber-400">⏳ Unsettled</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Transactions</span><span className="text-white">{commission.unsettled.count}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Commission</span><span className="text-white">₹{commission.unsettled.commissionAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Owner Earning</span><span className="text-white">₹{commission.unsettled.netOwnerEarning.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Refunds Report */}
          {activeTab === 'refunds' && refunds && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <StatsCard title="Total Refunds" value={refunds.totalCount} icon={<HiOutlineArrowUturnLeft className="h-6 w-6" />} color="rose" />
                <StatsCard title="Total Amount" value={`₹${refunds.totalAmount.toLocaleString()}`} icon={<HiOutlineBanknotes className="h-6 w-6" />} color="amber" />
                <StatsCard title="Cancellation Fees" value={`₹${refunds.totalCancellationFees.toLocaleString()}`} icon={<HiOutlineReceiptPercent className="h-6 w-6" />} color="purple" />
              </div>
              {refunds.byStatus.length > 0 && (
                <div className="card">
                  <p className="mb-4 font-medium text-white">Refunds by Status</p>
                  <div className="space-y-3">
                    {refunds.byStatus.map((s) => (
                      <div key={s.status} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3">
                        <Badge label={s.status} />
                        <div className="text-right">
                          <p className="font-medium text-white">{s.count} refunds</p>
                          <p className="text-sm text-gray-400">₹{s.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
