'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { PaginatedResponse } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineCheckCircle } from 'react-icons/hi2';
import { downloadCsv } from '@/lib/csv';

interface Refund {
  id: string;
  refundNumber: string;
  amount: number;
  cancellationFee: number;
  refundPercentage: number | null;
  refundType: string;
  status: string;
  reason: string | null;
  failureReason: string | null;
  gatewayRefundId: string | null;
  processedAt: string | null;
  createdAt: string;
  booking?: { id: string; bookingNumber: string; turf?: { id: string; name: string } };
  user?: { id: string; fullName: string; email: string; phone: string | null };
}

export default function RefundsPage() {
  const [data, setData] = useState<PaginatedResponse<Refund> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [processTarget, setProcessTarget] = useState<Refund | null>(null);
  const [outcome, setOutcome] = useState<'COMPLETED' | 'FAILED'>('COMPLETED');
  const [failureReason, setFailureReason] = useState('');
  const [gatewayId, setGatewayId] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const { data: res } = await api.get('/admin/refunds', { params });
      setData(unwrap<PaginatedResponse<Refund>>(res));
    } catch {
      toast.error('Failed to load refunds');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { loadRefunds(); }, [loadRefunds]);

  async function confirmProcess() {
    if (!processTarget) return;
    if (outcome === 'FAILED' && !failureReason.trim()) {
      toast.error('Failure reason is required');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/admin/refunds/${processTarget.id}/process`, {
        status: outcome,
        ...(outcome === 'FAILED' ? { failureReason: failureReason.trim() } : {}),
        ...(gatewayId.trim() ? { gatewayRefundId: gatewayId.trim() } : {}),
      });
      toast.success(`Refund marked ${outcome.toLowerCase()}`);
      setProcessTarget(null);
      setFailureReason('');
      setGatewayId('');
      loadRefunds();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Process failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Refunds Management</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.meta?.total || 0} total refunds</p>
        </div>
        <button
          onClick={() =>
            downloadCsv(`refunds-${new Date().toISOString().split('T')[0]}.csv`, (data?.items ?? []).map((r) => ({
              refundNumber: r.refundNumber,
              bookingNumber: r.booking?.bookingNumber || '',
              customer: r.user?.fullName || '',
              email: r.user?.email || '',
              amount: r.amount,
              cancellationFee: r.cancellationFee,
              status: r.status,
              createdAt: r.createdAt || '',
            })))
          }
          className="btn-secondary w-fit text-xs"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search refund #, booking #, user…"
            className="input-field pl-10"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="select-field w-44">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
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
                  <th>Refund #</th>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-amber-400">{r.refundNumber}</td>
                    <td>
                      <p className="font-mono text-xs text-white">{r.booking?.bookingNumber || '—'}</p>
                      <p className="text-xs text-gray-500">{r.booking?.turf?.name || ''}</p>
                    </td>
                    <td>
                      <p className="text-white">{r.user?.fullName || '—'}</p>
                      <p className="text-xs text-gray-500">{r.user?.email || ''}</p>
                    </td>
                    <td className="font-medium text-white">₹{Number(r.amount).toLocaleString()}</td>
                    <td className="text-gray-400">₹{Number(r.cancellationFee).toLocaleString()}</td>
                    <td><Badge label={r.status} /></td>
                    <td className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>
                      {r.status === 'PENDING' ? (
                        <button
                          onClick={() => { setProcessTarget(r); setOutcome('COMPLETED'); setFailureReason(''); setGatewayId(r.gatewayRefundId || ''); }}
                          className="flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <HiOutlineCheckCircle className="h-3.5 w-3.5" /> Process
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {r.processedAt ? new Date(r.processedAt).toLocaleDateString('en-IN') : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-500">No refunds found</td></tr>
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

      <Modal isOpen={!!processTarget} onClose={() => setProcessTarget(null)} title={`Process Refund ${processTarget?.refundNumber || ''}`} size="sm">
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium text-white">₹{Number(processTarget?.amount ?? 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Booking</span><span className="font-mono text-xs text-white">{processTarget?.booking?.bookingNumber}</span></div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as 'COMPLETED' | 'FAILED')} className="select-field">
              <option value="COMPLETED">Completed (money returned)</option>
              <option value="FAILED">Failed (gateway rejected)</option>
            </select>
          </div>
          {outcome === 'FAILED' && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Failure Reason *</label>
              <textarea value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Why did the refund fail?…" className="input-field h-20 resize-none" />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Gateway Refund ID (optional)</label>
            <input value={gatewayId} onChange={(e) => setGatewayId(e.target.value)} placeholder="e.g. rfnd_…" className="input-field font-mono text-xs" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setProcessTarget(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmProcess} disabled={busy} className={outcome === 'FAILED' ? 'btn-danger' : 'btn-primary'}>
              {busy ? 'Saving…' : outcome === 'FAILED' ? 'Mark Failed' : 'Mark Completed'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
