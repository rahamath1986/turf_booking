'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { Booking, PaginatedResponse, User } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineEye, HiOutlinePlus } from 'react-icons/hi2';

interface SportRef { id: string; name: string }
interface QuotePreview {
  feeBreakdown?: { basePrice?: number; platformFee?: number; taxes?: number; discount?: number; totalAmount?: number };
}

export default function BookingsPage() {
  const [data, setData] = useState<PaginatedResponse<Booking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [turfId, setTurfId] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detailBooking, setDetailBooking] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  // Autocomplete filter state (replaces raw UUID inputs)
  const [turfQuery, setTurfQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turfOptions, setTurfOptions] = useState<any[]>([]);
  const [turfLabel, setTurfLabel] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<User[]>([]);
  const [userLabel, setUserLabel] = useState('');

  const ACTIVE_BOOKING = ['CONFIRMED', 'PENDING', 'PAYMENT_PENDING'];

  async function searchTurfs(q: string) {
    setTurfQuery(q);
    if (q.trim().length < 2) { setTurfOptions([]); return; }
    try {
      const { data: res } = await api.get('/admin/turfs', { params: { search: q.trim(), limit: 8 } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTurfOptions(unwrap<{ items: any[] }>(res).items ?? []);
    } catch {
      setTurfOptions([]);
    }
  }

  async function searchFilterUsers(q: string) {
    setUserQuery(q);
    if (q.trim().length < 2) { setUserOptions([]); return; }
    try {
      const { data: res } = await api.get('/admin/users', { params: { search: q.trim(), limit: 8 } });
      setUserOptions(unwrap<PaginatedResponse<User>>(res).items ?? []);
    } catch {
      setUserOptions([]);
    }
  }

  async function markStatus(id: string, status: 'NO_SHOW' | 'COMPLETED') {
    setActionBusy(true);
    try {
      await api.patch(`/bookings/${id}`, { status });
      toast.success(`Booking marked as ${status === 'NO_SHOW' ? 'No-Show' : 'Completed'}`);
      setDetailBooking(null);
      loadBookings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Status update failed');
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setActionBusy(true);
    try {
      await api.post(
        `/bookings/${cancelTarget.id}/cancel`,
        cancelReason.trim() ? { reason: cancelReason.trim() } : {},
      );
      toast.success('Booking cancelled');
      setCancelTarget(null);
      setCancelReason('');
      setDetailBooking(null);
      loadBookings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Cancel failed');
    } finally {
      setActionBusy(false);
    }
  }
  // Create booking state
  const [showCreate, setShowCreate] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [createUser, setCreateUser] = useState<User | null>(null);
  const [venueSearch, setVenueSearch] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [venueResults, setVenueResults] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [createTurf, setCreateTurf] = useState<any | null>(null);
  const [turfSports, setTurfSports] = useState<SportRef[]>([]);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:00');
  const [sportId, setSportId] = useState('');
  const [quote, setQuote] = useState<QuotePreview | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (turfId.trim()) params.turfId = turfId.trim();
      if (userId.trim()) params.userId = userId.trim();
      const { data: res } = await api.get('/admin/bookings', { params });
      setData(unwrap<PaginatedResponse<Booking>>(res));
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, startDate, endDate, turfId, userId]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  async function viewBookingDetail(id: string) {
    try {
      const { data: detail } = await api.get(`/admin/bookings/${id}`);
      setDetailBooking(unwrap(detail));
    } catch {
      toast.error('Failed to load booking details');
    }
  }

  async function searchUsers(q: string) {
    setUserSearch(q);
    if (q.trim().length < 2) { setUserResults([]); return; }
    try {
      const { data: res } = await api.get('/admin/users', { params: { search: q.trim(), limit: 10 } });
      setUserResults(unwrap<PaginatedResponse<User>>(res).items ?? []);
    } catch {
      setUserResults([]);
    }
  }

  async function searchVenues(q: string) {
    setVenueSearch(q);
    if (q.trim().length < 2) { setVenueResults([]); return; }
    try {
      const { data: res } = await api.get('/admin/turfs', { params: { search: q.trim(), limit: 10 } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setVenueResults(unwrap<{ items: any[] }>(res).items ?? []);
    } catch {
      setVenueResults([]);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function selectTurf(t: any) {
    setCreateTurf(t);
    setVenueSearch('');
    setVenueResults([]);
    setSportId('');
    setQuote(null);
    try {
      const { data: detail } = await api.get(`/admin/turfs/${t.id}`);
      const full = unwrap<{ turfSports?: { sport: SportRef }[] }>(detail);
      setTurfSports((full.turfSports ?? []).map((ts) => ts.sport));
    } catch {
      setTurfSports([]);
    }
  }

  async function previewQuote() {
    if (!createTurf) { toast.error('Select a turf'); return; }
    if (!bookingDate || !startTime || !endTime) { toast.error('Pick date and time'); return; }
    setQuoting(true);
    setQuote(null);
    try {
      const payload: Record<string, string> = {
        turfId: createTurf.id,
        bookingDate,
        startTime,
        endTime,
      };
      if (sportId) payload.sportId = sportId;
      const { data: res } = await api.post('/bookings/calculate-quote', payload);
      setQuote(unwrap<QuotePreview>(res));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Quote failed — slot may be unavailable'));
    } finally {
      setQuoting(false);
    }
  }

  async function submitCreate() {
    if (!createUser) { toast.error('Select a customer'); return; }
    if (!createTurf) { toast.error('Select a turf'); return; }
    setCreating(true);
    try {
      const payload: Record<string, string> = {
        userId: createUser.id,
        turfId: createTurf.id,
        bookingDate,
        startTime,
        endTime,
      };
      if (sportId) payload.sportId = sportId;
      const { data: res } = await api.post('/admin/bookings', payload);
      const created = unwrap<{ bookingNumber?: string }>(res);
      toast.success(`Booking ${created.bookingNumber || ''} created`.trim());
      setShowCreate(false);
      resetCreate();
      loadBookings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create booking'));
    } finally {
      setCreating(false);
    }
  }

  function resetCreate() {
    setCreateUser(null);
    setCreateTurf(null);
    setTurfSports([]);
    setUserSearch('');
    setUserResults([]);
    setVenueSearch('');
    setVenueResults([]);
    setSportId('');
    setQuote(null);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Booking Management</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.meta?.total || 0} total bookings</p>
        </div>
        <button onClick={() => { resetCreate(); setShowCreate(true); }} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" />
          Add Booking
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by booking #, name, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="select-field w-44"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PAYMENT_PENDING">Payment Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No Show</option>
          <option value="EXPIRED">Expired</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="input-field w-40"
          placeholder="Start Date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="input-field w-40"
          placeholder="End Date"
        />
        <div className="relative w-56">
          <input
            type="text"
            value={turfId ? turfLabel : turfQuery}
            onChange={(e) => { setTurfId(''); setTurfLabel(''); searchTurfs(e.target.value); }}
            className="input-field pr-8"
            placeholder="Filter by turf…"
          />
          {turfId && (
            <button onClick={() => { setTurfId(''); setTurfLabel(''); setTurfQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" title="Clear">✕</button>
          )}
          {turfOptions.length > 0 && !turfId && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              {turfOptions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTurfId(t.id); setTurfLabel(t.name); setTurfOptions([]); setTurfQuery(''); setPage(1); }}
                  className="block w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                >
                  <span className="font-medium text-white">{t.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{t.city?.name || ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative w-56">
          <input
            type="text"
            value={userId ? userLabel : userQuery}
            onChange={(e) => { setUserId(''); setUserLabel(''); searchFilterUsers(e.target.value); }}
            className="input-field pr-8"
            placeholder="Filter by customer…"
          />
          {userId && (
            <button onClick={() => { setUserId(''); setUserLabel(''); setUserQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" title="Clear">✕</button>
          )}
          {userOptions.length > 0 && !userId && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              {userOptions.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setUserId(u.id); setUserLabel(u.fullName); setUserOptions([]); setUserQuery(''); setPage(1); }}
                  className="block w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                >
                  <span className="font-medium text-white">{u.fullName}</span>
                  <span className="ml-2 text-xs text-gray-500">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
                  <th>Sport</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs text-emerald-400">{b.bookingNumber}</td>
                    <td>
                      <div>
                        <p className="text-white">{b.customer?.fullName}</p>
                        <p className="text-xs text-gray-500">{b.customer?.email}</p>
                      </div>
                    </td>
                    <td className="text-white">{b.turfName || '—'}</td>
                    <td>{b.sport || '—'}</td>
                    <td>{formatDate(b.bookingDate)}</td>
                    <td className="text-xs">{b.startTime} – {b.endTime}</td>
                    <td className="font-medium text-white">₹{b.totalPrice.toLocaleString()}</td>
                    <td><Badge label={b.status} /></td>
                    <td><Badge label={b.paymentStatus || 'PENDING'} /></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => viewBookingDetail(b.id)}
                          title="View details"
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </button>
                        {ACTIVE_BOOKING.includes(b.status) && (
                          <>
                            <button
                              onClick={() => markStatus(b.id, 'COMPLETED')}
                              disabled={actionBusy}
                              title="Mark completed"
                              className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => markStatus(b.id, 'NO_SHOW')}
                              disabled={actionBusy}
                              title="Mark no-show"
                              className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                            >
                              No-Show
                            </button>
                            <button
                              onClick={() => { setCancelTarget(b); setCancelReason(''); }}
                              title="Cancel booking"
                              className="rounded bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.items || data.items.length === 0) && (
                  <tr><td colSpan={10} className="py-8 text-center text-gray-500">No bookings found</td></tr>
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

      {/* Booking Detail Modal */}
      <Modal isOpen={!!detailBooking} onClose={() => setDetailBooking(null)} title="Booking Details" size="xl">
        {detailBooking && (
          <div className="space-y-5 text-sm">
            {ACTIVE_BOOKING.includes(detailBooking.status as string) && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                <span className="w-full text-xs font-medium uppercase tracking-wide text-gray-500">Admin actions</span>
                <button
                  onClick={() => markStatus(detailBooking.id as string, 'COMPLETED')}
                  disabled={actionBusy}
                  className="rounded bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  Mark Completed
                </button>
                <button
                  onClick={() => markStatus(detailBooking.id as string, 'NO_SHOW')}
                  disabled={actionBusy}
                  className="rounded bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                >
                  Mark No-Show
                </button>
                <button
                  onClick={() => setCancelTarget({ id: detailBooking.id, bookingNumber: detailBooking.bookingNumber } as Booking)}
                  className="rounded bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
                >
                  Cancel Booking
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div><p className="text-gray-500">Booking #</p><p className="font-mono text-emerald-400">{detailBooking.bookingNumber as string}</p></div>
              <div><p className="text-gray-500">Status</p><Badge label={detailBooking.status as string} /></div>
              <div><p className="text-gray-500">Booking Date</p><p className="text-white">{formatDate(detailBooking.bookingDate as string)}</p></div>
              <div><p className="text-gray-500">Start Time</p><p className="text-white">{detailBooking.startTime as string}</p></div>
              <div><p className="text-gray-500">End Time</p><p className="text-white">{detailBooking.endTime as string}</p></div>
              <div><p className="text-gray-500">Total Price</p><p className="text-lg font-bold text-white">₹{Number(detailBooking.totalPrice).toLocaleString()}</p></div>
            </div>

            {/* Price Breakdown */}
            <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
              <p className="mb-2 font-medium text-gray-400">Price Breakdown</p>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-gray-500">Base Price</p><p className="text-white">₹{Number(detailBooking.basePrice ?? 0).toLocaleString()}</p></div>
                <div><p className="text-gray-500">Tax</p><p className="text-white">₹{Number(detailBooking.taxAmount ?? 0).toLocaleString()}</p></div>
                <div><p className="text-gray-500">Discount</p><p className="text-emerald-400">-₹{Number(detailBooking.discountAmount ?? 0).toLocaleString()}</p></div>
              </div>
            </div>

            {/* Customer */}
            {detailBooking.user && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Customer</p>
                <div className="grid grid-cols-3 gap-4">
                  <div><p className="text-gray-500">Name</p><p className="text-white">{String((detailBooking.user as Record<string, unknown>).fullName ?? '—')}</p></div>
                  <div><p className="text-gray-500">Email</p><p className="text-white">{String((detailBooking.user as Record<string, unknown>).email ?? '—')}</p></div>
                  <div><p className="text-gray-500">Phone</p><p className="text-white">{String((detailBooking.user as Record<string, unknown>).phone ?? '—')}</p></div>
                </div>
              </div>
            )}

            {/* Payments */}
            {Array.isArray(detailBooking.payments) && (detailBooking.payments as Record<string, unknown>[]).length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Payments</p>
                <div className="space-y-2">
                  {(detailBooking.payments as Record<string, unknown>[]).map((p: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2">
                      <span className="text-white">₹{Number(p.amount).toLocaleString()}</span>
                      <div className="flex gap-2">
                        <Badge label={p.status as string} />
                        <span className="text-xs text-gray-500">{p.provider as string}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refunds */}
            {Array.isArray(detailBooking.refunds) && detailBooking.refunds.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Refunds ({detailBooking.refunds.length})</p>
                <div className="space-y-2">
                  {detailBooking.refunds.map((r: { amount?: unknown; status?: unknown; cancellationFee?: unknown }, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2">
                      <span className="text-white">₹{Number(r.amount ?? 0).toLocaleString()}</span>
                      <div className="flex items-center gap-2">
                        <Badge label={String(r.status ?? 'UNKNOWN')} />
                        {r.cancellationFee != null && (
                          <span className="text-xs text-gray-500">fee ₹{Number(r.cancellationFee).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status history / audit trail */}
            {Array.isArray(detailBooking.statusHistory) && detailBooking.statusHistory.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Audit Trail ({detailBooking.statusHistory.length})</p>
                <div className="space-y-2">
                  {detailBooking.statusHistory.map((h: { fromStatus?: unknown; toStatus?: unknown; createdAt?: unknown; changedBy?: unknown }, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
                      <span className="text-gray-300">
                        {String(h.fromStatus ?? '—')} → <span className="font-medium text-white">{String(h.toStatus ?? '—')}</span>
                      </span>
                      <span className="text-gray-500">
                        {h.createdAt ? new Date(String(h.createdAt)).toLocaleString('en-IN') : '—'}
                        {h.changedBy ? ` • ${String(h.changedBy)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Check-in audits */}
            {Array.isArray(detailBooking.checkInAudits) && detailBooking.checkInAudits.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Check-in Audits ({detailBooking.checkInAudits.length})</p>
                <div className="space-y-2">
                  {detailBooking.checkInAudits.map((a: { action?: unknown; performedAt?: unknown; performedBy?: unknown }, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
                      <span className="text-white">{String(a.action ?? 'Check-in')}</span>
                      <span className="text-gray-500">
                        {a.performedAt ? new Date(String(a.performedAt)).toLocaleString('en-IN') : '—'}
                        {a.performedBy ? ` • ${String(a.performedBy)}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellation */}
            {detailBooking.cancelledAt && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                <p className="font-medium text-rose-400">Cancelled</p>
                <p className="mt-1 text-gray-400">{detailBooking.cancellationReason as string || 'No reason provided'}</p>
                <p className="mt-1 text-xs text-gray-500">At {formatDate(detailBooking.cancelledAt as string)}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create Booking Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); resetCreate(); }}
        title="Add Booking (on behalf of customer)"
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <label className="mb-1.5 block text-sm text-gray-400">Customer *</label>
            <input
              value={createUser ? `${createUser.fullName} (${createUser.email})` : userSearch}
              onChange={(e) => { setCreateUser(null); searchUsers(e.target.value); }}
              placeholder="Type 2+ letters to search users…"
              className="input-field"
            />
            {userResults.length > 0 && !createUser && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                {userResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setCreateUser(u); setUserResults([]); setUserSearch(''); }}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                  >
                    <span className="font-medium text-white">{u.fullName}</span>
                    <span className="ml-2 text-xs text-gray-500">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-sm text-gray-400">Turf *</label>
            <input
              value={createTurf ? createTurf.name : venueSearch}
              onChange={(e) => { setCreateTurf(null); searchVenues(e.target.value); }}
              placeholder="Type 2+ letters to search turfs…"
              className="input-field"
            />
            {venueResults.length > 0 && !createTurf && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                {venueResults.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => selectTurf(t)}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                  >
                    <span className="font-medium text-white">{t.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{t.city?.name || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Date *</label>
              <input type="date" value={bookingDate} onChange={(e) => { setBookingDate(e.target.value); setQuote(null); }} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Start *</label>
              <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setQuote(null); }} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">End *</label>
              <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setQuote(null); }} className="input-field" />
            </div>
          </div>

          {turfSports.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Sport</label>
              <select value={sportId} onChange={(e) => { setSportId(e.target.value); setQuote(null); }} className="select-field">
                <option value="">Select sport (optional)</option>
                {turfSports.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          )}

          {quote?.feeBreakdown && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
              <p className="mb-2 font-medium text-emerald-300">Price Preview</p>
              <div className="grid grid-cols-2 gap-2 text-gray-300">
                <span className="text-gray-500">Base</span><span className="text-right">₹{Number(quote.feeBreakdown.basePrice ?? 0).toLocaleString()}</span>
                <span className="text-gray-500">Platform fee + tax</span><span className="text-right">₹{(Number(quote.feeBreakdown.platformFee ?? 0) + Number(quote.feeBreakdown.taxes ?? 0)).toLocaleString()}</span>
                {Number(quote.feeBreakdown.discount ?? 0) > 0 && (<><span className="text-gray-500">Discount</span><span className="text-right text-emerald-400">-₹{Number(quote.feeBreakdown.discount ?? 0).toLocaleString()}</span></>)}
                <span className="font-medium text-white">Total</span><span className="text-right text-lg font-bold text-white">₹{Number(quote.feeBreakdown.totalAmount ?? 0).toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => { setShowCreate(false); resetCreate(); }} className="btn-secondary">Cancel</button>
            <button onClick={previewQuote} disabled={quoting} className="btn-secondary text-xs">{quoting ? 'Checking…' : 'Preview Price'}</button>
            <button onClick={submitCreate} disabled={creating} className="btn-primary">{creating ? 'Creating…' : 'Create Booking'}</button>
          </div>
        </div>
      </Modal>

      {/* Cancel Booking Modal */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title={`Cancel Booking ${cancelTarget?.bookingNumber || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            The slot is freed and any auto-refund is processed. This cannot be undone.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Cancellation reason (optional)…"
            className="input-field h-24 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setCancelTarget(null); setCancelReason(''); }} className="btn-secondary">Keep Booking</button>
            <button onClick={confirmCancel} disabled={actionBusy} className="btn-danger">
              {actionBusy ? 'Cancelling…' : 'Cancel Booking'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
