'use client';

import { useState } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { HiOutlineQrCode } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScanResult = Record<string, any>;

export default function OwnerScanPage() {
  const [qrToken, setQrToken] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [bookingId, setBookingId] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);

  async function scan() {
    if (!qrToken.trim()) { toast.error('Paste or type the QR token'); return; }
    setScanning(true);
    setResult(null);
    try {
      const { data: res } = await api.post('/staff/bookings/scan', { qrToken: qrToken.trim() });
      setResult(unwrap<ScanResult>(res));
      toast.success('QR verified');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Invalid or expired QR');
    } finally {
      setScanning(false);
    }
  }

  async function checkIn() {
    if (!bookingId.trim()) { toast.error('Enter a booking ID'); return; }
    setCheckingIn(true);
    try {
      await api.post(`/bookings/${bookingId.trim()}/check-in`, {});
      toast.success('Checked in');
      setBookingId('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Scan & Check-in</h1>
        <p className="mt-1 text-sm text-gray-500">Verify player QR codes at the gate</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <HiOutlineQrCode className="h-5 w-5 text-blue-400" />
            <p className="font-medium text-white">Scan QR Token</p>
          </div>
          <textarea
            value={qrToken}
            onChange={(e) => setQrToken(e.target.value)}
            placeholder="Paste QR token from the player's app…"
            className="input-field h-28 resize-none font-mono text-xs"
          />
          <button onClick={scan} disabled={scanning} className="btn-primary mt-3 text-xs">
            {scanning ? 'Verifying…' : 'Verify QR'}
          </button>

          {result && (
            <div className="mt-4 space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-emerald-300">Verified</p>
                {result.status && <Badge label={String(result.status)} />}
              </div>
              {Object.entries(result).slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-gray-500">{k}</span>
                  <span className="truncate text-right text-gray-200">{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <p className="mb-4 font-medium text-white">Manual Check-in by Booking ID</p>
          <input
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            placeholder="Booking UUID…"
            className="input-field font-mono text-xs"
          />
          <button onClick={checkIn} disabled={checkingIn} className="btn-primary mt-3 text-xs">
            {checkingIn ? 'Checking in…' : 'Check In'}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-gray-500">
            Use this when the player cannot show a QR (dead phone, screenshot issues).
            Every scan and check-in is audit-logged with your staff identity.
          </p>
        </div>
      </div>
    </div>
  );
}
