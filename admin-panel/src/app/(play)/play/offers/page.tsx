'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineTicket } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Coupon = Record<string, any>;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PlayOffersPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: res } = await api.get('/coupons');
        const list = unwrap<Coupon[] | { items: Coupon[] } | { coupons: Coupon[] }>(res);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const arr = Array.isArray(list) ? list : ((list as any).items ?? (list as any).coupons ?? []);
        setItems(arr);
      } catch {
        toast.error('Failed to load offers');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => toast.success(`Copied ${code}`),
      () => toast.error('Copy failed'),
    );
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Offers For You</h1>
        <p className="mt-1 text-sm text-gray-500">Apply these codes while booking to save</p>
      </div>

      {items.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">No active offers right now. Check back soon!</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((c, i) => (
            <div key={c.id || i} className="card relative overflow-hidden">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-3">
                    <HiOutlineTicket className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold tracking-wide text-white">{c.code}</p>
                    <p className="text-xs text-gray-500">{c.description || 'Discount on your booking'}</p>
                  </div>
                </div>
                <button onClick={() => copy(String(c.code))} className="btn-secondary shrink-0 py-1.5 text-xs">Copy</button>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-emerald-400">
                  {String(c.discountType).toUpperCase() === 'FLAT' ? `₹${Number(c.discountValue).toLocaleString()} off` : `${Number(c.discountValue)}% off`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.maxDiscountAmount != null && <Badge label={`up to ₹${Number(c.maxDiscountAmount).toLocaleString()}`} />}
                  {Number(c.minOrderAmount) > 0 && <Badge label={`min ₹${Number(c.minOrderAmount).toLocaleString()}`} />}
                  {Array.isArray(c.validDays) && c.validDays.length > 0 && (
                    <Badge label={c.validDays.length === 2 && c.validDays.includes(0) && c.validDays.includes(6) ? 'Weekend' : c.validDays.map((d: number) => DAYS[d]).join(', ')} />
                  )}
                  {c.isFirstBookingOnly && <Badge label="First booking" />}
                  {c.endDate && <Badge label={`till ${new Date(c.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
