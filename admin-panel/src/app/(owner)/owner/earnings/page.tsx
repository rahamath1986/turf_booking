'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import StatsCard from '@/components/ui/StatsCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { HiOutlineBanknotes, HiOutlineReceiptPercent, HiOutlineClock } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;

export default function OwnerEarningsPage() {
  const [summary, setSummary] = useState<Any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [txns, setTxns] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settleFilter, setSettleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sRes, tRes] = await Promise.all([
          api.get('/owner/commission'),
          api.get('/owner/commission/transactions', { params: { page: 1, limit: 20 } }),
        ]);
        setSummary(unwrap<Any>(sRes.data));
        const tList = unwrap<Any[] | { items: Any[] }>(tRes.data);
        setTxns(Array.isArray(tList) ? tList : (tList.items ?? []));
      } catch {
        toast.error('Failed to load earnings');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadSettlements() {
      try {
        const params: Record<string, string | number> = { page: 1, limit: 20 };
        if (settleFilter) params.status = settleFilter;
        const { data: res } = await api.get('/owner/settlements', { params });
        const list = unwrap<Any[] | { items: Any[] }>(res);
        setSettlements(Array.isArray(list) ? list : (list.items ?? []));
      } catch {
        toast.error('Failed to load settlements');
      }
    }
    loadSettlements();
  }, [settleFilter]);

  if (loading) return <LoadingSpinner />;

  const rate = summary?.commissionRate ?? summary?.rate ?? summary?.commissionPercentage;
  const earnings = summary?.totalEarnings ?? summary?.netEarnings ?? summary?.totalNet ?? 0;
  const pending = summary?.pendingAmount ?? summary?.unsettledAmount ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Earnings</h1>
        <p className="mt-1 text-sm text-gray-500">Commission, ledger and payouts</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatsCard title="Commission Rate" value={rate != null ? `${Number(rate)}%` : '—'} icon={<HiOutlineReceiptPercent className="h-6 w-6" />} color="purple" />
        <StatsCard title="Total Earnings" value={`₹${Number(earnings).toLocaleString()}`} icon={<HiOutlineBanknotes className="h-6 w-6" />} color="emerald" />
        <StatsCard title="Pending Payout" value={`₹${Number(pending).toLocaleString()}`} icon={<HiOutlineClock className="h-6 w-6" />} color="amber" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <p className="mb-4 font-medium text-white">Recent Transactions</p>
          {txns.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {txns.slice(0, 10).map((t, i) => (
                <div key={t.id || i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-sm">
                  <div>
                    <p className="text-white">₹{Number(t.netAmount ?? t.netOwnerEarning ?? t.amount ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{t.bookingNumber || t.booking?.bookingNumber || ''} {t.createdAt ? `• ${String(t.createdAt).split('T')[0]}` : ''}</p>
                  </div>
                  <Badge label={String(t.status || (t.isSettled ? 'SETTLED' : 'PENDING'))} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-medium text-white">Settlements</p>
            <select value={settleFilter} onChange={(e) => setSettleFilter(e.target.value)} className="select-field w-40">
              <option value="">All</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="ON_HOLD">On Hold</option>
            </select>
          </div>
          {settlements.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No settlements yet</p>
          ) : (
            <div className="space-y-2">
              {settlements.slice(0, 10).map((s, i) => (
                <div key={s.id || i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-sm">
                  <div>
                    <p className="text-white">₹{Number(s.amount ?? s.netAmount ?? s.total ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{s.createdAt ? String(s.createdAt).split('T')[0] : ''}</p>
                  </div>
                  <Badge label={String(s.status || 'PENDING')} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
