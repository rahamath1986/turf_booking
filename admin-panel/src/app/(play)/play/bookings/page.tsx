'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineEye, HiOutlineQrCode } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Booking = Record<string, any>;

export default function PlayBookingsPage() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<Booking | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [qr, setQr] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [resched, setResched] = useState({ date: '', start: '', end: '' });
  const [showResched, setShowResched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await api.get('/bookings', { params });
      const list = unwrap<Booking[] | { items: Booking[] }>(res);
      setItems(Array.isArray(list) ? list : (list.items ?? []));
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function viewDetail(id: string) {
    try {
      const { data: res } = await api.get(`/bookings/${id}`);
      setDetail(unwrap<Booking>(res));
      setQr(null);
    } catch {
      toast.error('Failed to load booking');
    }
  }

  async function loadQr(id: string) {
    try {
      const { data: res } = await api.get(`/bookings/${id}/qr`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setQr(unwrap<any>(res));
    } catch {
      toast.error('QR unavailable');
    }
  }

  async function confirmCancel() {
    if (!detail) return;
    try {
      await api.post(`/bookings/${detail.id}/cancel`, cancelReason.trim() ? { reason: cancelReason.trim() } : {});
      toast.success('Booking cancelled');
      setShowCancel(false);
      setCancelReason('');
      setDetail(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Cancel failed');
    }
  }

  async function confirmReschedule() {
    if (!detail || !resched.date || !resched.start) { toast.error('Date and start time required'); return; }
    try {
      const payload: Record<string, string> = { newDate: resched.date, newStartTime: resched.start };
      if (resched.end) payload.newEndTime = resched.end;
      await api.post(`/bookings/${detail.id}/reschedule`, payload);
      toast.success('Rescheduled');
      setShowResched(false);
      setDetail(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Reschedule failed');
    }
  }

  const active = (b: Booking) => !['CANCELLED', 'REFUNDED', 'EXPIRED'].includes(String(b.status));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">{items.length} booking(s)</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field w-44">
          <option value="">All Status</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-400">No bookings yet</p>
          <a href="/play" className="btn-primary mx-auto mt-4 w-fit text-xs">Find a Turf</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((b) => (
            <div key={b.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold text-emerald-400">{b.bookingNumber}</p>
                  <p className="mt-1 font-medium text-white">{b.turf?.name || b.turfName || 'Turf'}</p>
                  <p className="text-xs text-gray-500">{String(b.bookingDate || '').split('T')[0]} • {b.startTime}–{b.endTime}</p>
                </div>
                <Badge label={String(b.status || 'CONFIRMED')} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="font-bold text-white">₹{Number(b.totalPrice ?? 0).toLocaleString()}</p>
                <div className="flex gap-2">
                  <button onClick={() => viewDetail(b.id)} title="Details + QR" className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
                    <HiOutlineEye className="h-4 w-4" />
                  </button>
                  {active(b) && (
                    <>
                      <button onClick={() => { setDetail(b); setResched({ date: String(b.bookingDate || '').split('T')[0], start: b.startTime || '', end: b.endTime || '' }); setShowResched(true); }} className="rounded bg-blue-500/10 px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/20">Reschedule</button>
                      <button onClick={() => { setDetail(b); setShowCancel(true); }} className="rounded bg-rose-500/10 px-2 py-1 text-xs text-rose-400 hover:bg-rose-500/20">Cancel</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!detail} onClose={() => { setDetail(null); setQr(null); }} title={`Booking ${detail?.bookingNumber || ''}`} size="lg">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500">Turf</p><p className="text-white">{detail.turf?.name || detail.turfName || '—'}</p></div>
              <div><p className="text-gray-500">Status</p><Badge label={String(detail.status)} /></div>
              <div><p className="text-gray-500">Date</p><p className="text-white">{String(detail.bookingDate || '').split('T')[0]}</p></div>
              <div><p className="text-gray-500">Time</p><p className="text-white">{detail.startTime} – {detail.endTime}</p></div>
              <div><p className="text-gray-500">Total</p><p className="text-lg font-bold text-white">₹{Number(detail.totalPrice ?? 0).toLocaleString()}</p></div>
              <div><p className="text-gray-500">Paid</p><p className="text-white">₹{Number(detail.paidAmount ?? detail.totalPrice ?? 0).toLocaleString()}</p></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => loadQr(detail.id)} className="btn-secondary text-xs">
                <HiOutlineQrCode className="h-4 w-4" /> Show Check-in QR
              </button>
              {active(detail) && (
                <>
                  <button onClick={() => { setResched({ date: String(detail.bookingDate || '').split('T')[0], start: detail.startTime || '', end: detail.endTime || '' }); setShowResched(true); }} className="btn-secondary text-xs">Reschedule</button>
                  <button onClick={() => setShowCancel(true)} className="btn-danger text-xs">Cancel Booking</button>
                </>
              )}
            </div>
            {qr && (
              <div className="rounded-lg border border-gray-800 bg-white p-4 text-center">
                {qr.qrImage || qr.qrCodeUrl || qr.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr.qrImage || qr.qrCodeUrl || qr.image} alt="Check-in QR" className="mx-auto h-48 w-48" />
                ) : (
                  <p className="break-all font-mono text-xs text-gray-800">{qr.qrToken || JSON.stringify(qr).slice(0, 200)}</p>
                )}
                <p className="mt-2 text-xs text-gray-600">Show this at the venue gate</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={showCancel} onClose={() => { setShowCancel(false); setCancelReason(''); }} title="Cancel Booking" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Refunds (if any) are processed automatically to the original payment method.</p>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (optional)…" className="input-field h-20 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCancel(false); setCancelReason(''); }} className="btn-secondary">Keep Booking</button>
            <button onClick={confirmCancel} className="btn-danger">Cancel Booking</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showResched} onClose={() => setShowResched(false)} title="Reschedule" size="sm">
        <div className="space-y-3">
          <input type="date" value={resched.date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setResched({ ...resched, date: e.target.value })} className="input-field" />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" value={resched.start} onChange={(e) => setResched({ ...resched, start: e.target.value })} className="input-field" />
            <input type="time" value={resched.end} onChange={(e) => setResched({ ...resched, end: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowResched(false)} className="btn-secondary">Close</button>
            <button onClick={confirmReschedule} className="btn-primary">Move Booking</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
