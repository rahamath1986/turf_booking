'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api, { unwrap } from '@/lib/api';
import { PaginatedResponse } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineEye, HiOutlinePlus } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OwnerBooking = Record<string, any>;

const emptyWalkin = {
  turfId: '',
  bookingDate: new Date().toISOString().split('T')[0],
  startTime: '18:00',
  endTime: '19:00',
  sportId: '',
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  price: '',
  paymentMethod: 'CASH',
  notes: '',
};

function BookingsInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaginatedResponse<OwnerBooking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [turfFilter, setTurfFilter] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turfs, setTurfs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<OwnerBooking | null>(null);
  const [showWalkin, setShowWalkin] = useState(searchParams.get('action') === 'walkin');
  const [walkin, setWalkin] = useState(emptyWalkin);
  const [creating, setCreating] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OwnerBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reschedTarget, setReschedTarget] = useState<OwnerBooking | null>(null);
  const [resched, setResched] = useState({ newDate: '', newStartTime: '', newEndTime: '' });

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (turfFilter) params.turfId = turfFilter;
      const { data: res } = await api.get('/owner/bookings', { params });
      setData(unwrap<PaginatedResponse<OwnerBooking>>(res));
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, turfFilter]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    async function loadTurfs() {
      try {
        const { data: res } = await api.get('/owner/turfs', { params: { page: 1, limit: 50 } });
        const list = unwrap<OwnerBooking[] | { items: OwnerBooking[] }>(res);
        setTurfs(Array.isArray(list) ? list : (list.items ?? []));
      } catch { /* ignore */ }
    }
    loadTurfs();
  }, []);

  async function viewDetail(id: string) {
    try {
      const { data: res } = await api.get(`/owner/bookings/${id}`);
      setDetail(unwrap<OwnerBooking>(res));
    } catch {
      toast.error('Failed to load booking');
    }
  }

  async function submitWalkin() {
    if (!walkin.turfId || !walkin.customerName.trim() || !walkin.customerPhone.trim()) {
      toast.error('Turf, customer name and phone are required');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        turfId: walkin.turfId,
        bookingDate: walkin.bookingDate,
        startTime: walkin.startTime,
        endTime: walkin.endTime,
        customerName: walkin.customerName.trim(),
        customerPhone: walkin.customerPhone.trim(),
        paymentMethod: walkin.paymentMethod,
      };
      if (walkin.sportId) payload.sportId = walkin.sportId;
      if (walkin.customerEmail.trim()) payload.customerEmail = walkin.customerEmail.trim();
      if (walkin.price !== '') payload.price = Number(walkin.price);
      if (walkin.notes.trim()) payload.notes = walkin.notes.trim();
      const { data: res } = await api.post('/owner/bookings/walk-in', payload);
      const created = unwrap<{ bookingNumber?: string }>(res);
      toast.success(`Walk-in ${created.bookingNumber || ''} recorded`.trim());
      setShowWalkin(false);
      setWalkin(emptyWalkin);
      loadBookings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Walk-in failed — slot may be taken'));
    } finally {
      setCreating(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget || !cancelReason.trim()) { toast.error('Reason is required'); return; }
    try {
      await api.post(`/owner/bookings/${cancelTarget.id}/cancel`, { reason: cancelReason.trim() });
      toast.success('Booking cancelled');
      setCancelTarget(null);
      setCancelReason('');
      setDetail(null);
      loadBookings();
    } catch {
      toast.error('Cancel failed');
    }
  }

  async function confirmReschedule() {
    if (!reschedTarget || !resched.newDate || !resched.newStartTime) { toast.error('New date and start time are required'); return; }
    try {
      const payload: Record<string, string> = { newDate: resched.newDate, newStartTime: resched.newStartTime };
      if (resched.newEndTime) payload.newEndTime = resched.newEndTime;
      await api.post(`/owner/bookings/${reschedTarget.id}/reschedule`, payload);
      toast.success('Booking rescheduled');
      setReschedTarget(null);
      setResched({ newDate: '', newStartTime: '', newEndTime: '' });
      setDetail(null);
      loadBookings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Reschedule failed — slot may be taken');
    }
  }

  const setW = (patch: Partial<typeof emptyWalkin>) => setWalkin({ ...walkin, ...patch });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.meta?.total || 0} bookings across my turfs</p>
        </div>
        <button onClick={() => setShowWalkin(true)} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" /> Walk-in Booking
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search booking #, name, phone…" className="input-field max-w-xs flex-1" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="select-field w-44">
          <option value="">All Status</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No Show</option>
        </select>
        <select value={turfFilter} onChange={(e) => { setTurfFilter(e.target.value); setPage(1); }} className="select-field w-52">
          <option value="">All Turfs</option>
          {turfs.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Booking #</th>
                  <th>Customer</th>
                  <th>Turf</th>
                  <th>Date / Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs text-blue-400">{b.bookingNumber}</td>
                    <td>
                      <p className="text-white">{b.customerName || b.user?.fullName || b.customer?.fullName || '—'}</p>
                      <p className="text-xs text-gray-500">{b.customerPhone || b.user?.phone || ''}</p>
                    </td>
                    <td>{b.turfName || b.turf?.name || '—'}</td>
                    <td className="text-xs">{String(b.bookingDate || '').split('T')[0]} • {b.startTime}–{b.endTime}</td>
                    <td className="font-medium text-white">₹{Number(b.totalPrice ?? b.amount ?? 0).toLocaleString()}</td>
                    <td><Badge label={String(b.status || 'CONFIRMED')} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => viewDetail(b.id)} title="View" className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white">
                          <HiOutlineEye className="h-4 w-4" />
                        </button>
                        {String(b.status) !== 'CANCELLED' && (
                          <>
                            <button onClick={() => { setReschedTarget(b); setResched({ newDate: String(b.bookingDate || '').split('T')[0], newStartTime: b.startTime || '', newEndTime: b.endTime || '' }); }} className="rounded bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/20">Reschedule</button>
                            <button onClick={() => setCancelTarget(b)} className="rounded bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20">Cancel</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-500">No bookings found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {data && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-xs">Previous</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.meta.totalPages} className="btn-secondary text-xs">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={`Booking ${detail?.bookingNumber || ''}`} size="lg">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500">Customer</p><p className="text-white">{detail.customerName || detail.user?.fullName || '—'}</p></div>
              <div><p className="text-gray-500">Phone</p><p className="text-white">{detail.customerPhone || detail.user?.phone || '—'}</p></div>
              <div><p className="text-gray-500">Turf</p><p className="text-white">{detail.turfName || detail.turf?.name || '—'}</p></div>
              <div><p className="text-gray-500">Status</p><Badge label={String(detail.status)} /></div>
              <div><p className="text-gray-500">Date</p><p className="text-white">{String(detail.bookingDate || '').split('T')[0]}</p></div>
              <div><p className="text-gray-500">Time</p><p className="text-white">{detail.startTime} – {detail.endTime}</p></div>
              <div><p className="text-gray-500">Amount</p><p className="text-lg font-bold text-white">₹{Number(detail.totalPrice ?? detail.amount ?? 0).toLocaleString()}</p></div>
              <div><p className="text-gray-500">Payment</p><p className="text-white">{detail.paymentMethod || detail.paymentStatus || '—'}</p></div>
            </div>
            {detail.notes && <div><p className="text-gray-500">Notes</p><p className="text-white">{String(detail.notes)}</p></div>}
          </div>
        )}
      </Modal>

      <Modal isOpen={showWalkin} onClose={() => setShowWalkin(false)} title="Walk-in Booking" size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Turf *</label>
            <select value={walkin.turfId} onChange={(e) => setW({ turfId: e.target.value })} className="select-field">
              <option value="">Select turf</option>
              {turfs.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Date *</label>
            <input type="date" value={walkin.bookingDate} onChange={(e) => setW({ bookingDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Start *</label>
            <input type="time" value={walkin.startTime} onChange={(e) => setW({ startTime: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">End *</label>
            <input type="time" value={walkin.endTime} onChange={(e) => setW({ endTime: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Customer Name *</label>
            <input value={walkin.customerName} onChange={(e) => setW({ customerName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Customer Phone *</label>
            <input value={walkin.customerPhone} onChange={(e) => setW({ customerPhone: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Customer Email</label>
            <input value={walkin.customerEmail} onChange={(e) => setW({ customerEmail: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Price ₹ (auto if empty)</label>
            <input type="number" min={0} value={walkin.price} onChange={(e) => setW({ price: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Payment Method</label>
            <select value={walkin.paymentMethod} onChange={(e) => setW({ paymentMethod: e.target.value })} className="select-field">
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Notes</label>
            <input value={walkin.notes} onChange={(e) => setW({ notes: e.target.value })} className="input-field" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowWalkin(false)} className="btn-secondary">Cancel</button>
          <button onClick={submitWalkin} disabled={creating} className="btn-primary">{creating ? 'Recording…' : 'Record Walk-in'}</button>
        </div>
      </Modal>

      <Modal isOpen={!!cancelTarget} onClose={() => { setCancelTarget(null); setCancelReason(''); }} title="Cancel Booking" size="sm">
        <div className="space-y-4">
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (required)…" className="input-field h-24 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setCancelTarget(null); setCancelReason(''); }} className="btn-secondary">Keep</button>
            <button onClick={confirmCancel} className="btn-danger">Cancel Booking</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!reschedTarget} onClose={() => setReschedTarget(null)} title="Reschedule Booking" size="sm">
        <div className="space-y-4">
          <input type="date" value={resched.newDate} onChange={(e) => setResched({ ...resched, newDate: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" value={resched.newStartTime} onChange={(e) => setResched({ ...resched, newStartTime: e.target.value })} className="input-field" />
            <input type="time" value={resched.newEndTime} onChange={(e) => setResched({ ...resched, newEndTime: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setReschedTarget(null)} className="btn-secondary">Close</button>
            <button onClick={confirmReschedule} className="btn-primary">Move Booking</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function OwnerBookingsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BookingsInner />
    </Suspense>
  );
}
