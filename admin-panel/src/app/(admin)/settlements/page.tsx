'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { PaginatedResponse } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatsCard from '@/components/ui/StatsCard';
import toast from 'react-hot-toast';
import { HiOutlineBanknotes, HiOutlineReceiptPercent, HiOutlineClock, HiOutlinePlus } from 'react-icons/hi2';
import { useAuth, isSuperAdmin } from '@/lib/auth';
import { downloadCsv } from '@/lib/csv';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Settlement = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Summary = Record<string, any>;

export default function SettlementsPage() {
  const { user: me } = useAuth();
  const superAdmin = isSuperAdmin(me?.roles ?? []);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [data, setData] = useState<PaginatedResponse<Settlement> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [ownerLabel, setOwnerLabel] = useState('');
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; businessName: string }[]>([]);
  const [page, setPage] = useState(1);
  const [processTarget, setProcessTarget] = useState<Settlement | null>(null);
  const [processNotes, setProcessNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genOwnerId, setGenOwnerId] = useState('');
  const [genOwnerLabel, setGenOwnerLabel] = useState('');
  const [genQuery, setGenQuery] = useState('');
  const [genOptions, setGenOptions] = useState<{ id: string; businessName: string }[]>([]);

  const loadSummary = useCallback(async () => {
    try {
      const { data: res } = await api.get('/admin/commission');
      setSummary(unwrap<Summary>(res));
    } catch {
      toast.error('Failed to load commission summary');
    }
  }, []);

  const loadSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (ownerId) params.ownerId = ownerId;
      const { data: res } = await api.get('/admin/settlements', { params });
      setData(unwrap<PaginatedResponse<Settlement>>(res));
    } catch {
      toast.error('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, ownerId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadSettlements(); }, [loadSettlements]);

  async function searchOwners(q: string, which: 'filter' | 'gen') {
    if (which === 'filter') setOwnerQuery(q); else setGenQuery(q);
    if (q.trim().length < 2) {
      if (which === 'filter') setOwnerOptions([]); else setGenOptions([]);
      return;
    }
    try {
      const { data: res } = await api.get('/admin/owners', { params: { search: q.trim(), limit: 8 } });
      const items = unwrap<{ items: { id: string; businessName: string }[] }>(res).items ?? [];
      if (which === 'filter') setOwnerOptions(items); else setGenOptions(items);
    } catch {
      if (which === 'filter') setOwnerOptions([]); else setGenOptions([]);
    }
  }

  async function generate() {
    if (!genOwnerId) { toast.error('Select an owner'); return; }
    setBusy(true);
    try {
      const { data: res } = await api.post(`/admin/settlements/generate/${genOwnerId}`);
      const s = unwrap<{ id?: string }>(res);
      toast.success('Settlement generated' + (s.id ? ` (${String(s.id).slice(0, 8)}…)` : ''));
      setShowGenerate(false);
      setGenOwnerId('');
      setGenOwnerLabel('');
      loadSettlements();
      loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Generate failed (maybe nothing unsettled)');
    } finally {
      setBusy(false);
    }
  }

  async function confirmProcess() {
    if (!processTarget) return;
    setBusy(true);
    try {
      await api.post(
        `/admin/settlements/${processTarget.id}/process`,
        processNotes.trim() ? { notes: processNotes.trim() } : {},
      );
      toast.success('Settlement marked completed');
      setProcessTarget(null);
      setProcessNotes('');
      loadSettlements();
      loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Process failed');
    } finally {
      setBusy(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totals = (summary?.totals ?? summary ?? {}) as Record<string, any>;
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settlements & Commission</h1>
          <p className="mt-1 text-sm text-gray-500">Owner payouts and platform earnings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              downloadCsv(`settlements-${new Date().toISOString().split('T')[0]}.csv`, (data?.items ?? []).map((s) => ({
                id: s.id,
                owner: s.owner?.businessName || s.turfOwner?.businessName || s.ownerId || '',
                amount: s.amount ?? s.netAmount ?? s.total ?? '',
                status: s.status || '',
                createdAt: s.createdAt || '',
              })))
            }
            className="btn-secondary w-fit text-xs"
          >
            Export CSV
          </button>
          <button onClick={() => setShowGenerate(true)} className="btn-primary w-fit">
            <HiOutlinePlus className="h-4 w-4" /> Generate Settlement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatsCard title="Gross Volume" value={`₹${num(totals.grossAmount ?? totals.gross).toLocaleString()}`} icon={<HiOutlineBanknotes className="h-6 w-6" />} color="blue" />
        <StatsCard title="Commission Earned" value={`₹${num(totals.commissionAmount ?? totals.commission).toLocaleString()}`} icon={<HiOutlineReceiptPercent className="h-6 w-6" />} color="emerald" />
        <StatsCard title="Payable to Owners" value={`₹${num(totals.netOwnerEarning ?? totals.net ?? totals.payable).toLocaleString()}`} icon={<HiOutlineClock className="h-6 w-6" />} color="amber" />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap items-center gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="select-field w-44">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="ON_HOLD">On Hold</option>
        </select>
        <div className="relative w-64">
          <input
            value={ownerId ? ownerLabel : ownerQuery}
            onChange={(e) => { setOwnerId(''); setOwnerLabel(''); searchOwners(e.target.value, 'filter'); }}
            placeholder="Filter by owner…"
            className="input-field pr-8"
          />
          {ownerId && (
            <button onClick={() => { setOwnerId(''); setOwnerLabel(''); setOwnerQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">✕</button>
          )}
          {ownerOptions.length > 0 && !ownerId && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              {ownerOptions.map((o) => (
                <button key={o.id} onClick={() => { setOwnerId(o.id); setOwnerLabel(o.businessName); setOwnerOptions([]); setOwnerQuery(''); setPage(1); }}
                  className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-800">{o.businessName}</button>
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
                  <th>ID</th>
                  <th>Owner</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs text-blue-400">{String(s.id).slice(0, 8)}…</td>
                    <td className="text-white">{s.owner?.businessName || s.turfOwner?.businessName || s.ownerId || '—'}</td>
                    <td className="font-medium text-white">₹{num(s.amount ?? s.netAmount ?? s.total).toLocaleString()}</td>
                    <td><Badge label={String(s.status || 'PENDING')} /></td>
                    <td className="text-xs text-gray-400">{s.createdAt ? String(s.createdAt).split('T')[0] : '—'}</td>
                    <td>
                      {String(s.status) !== 'COMPLETED' && superAdmin && (
                        <button onClick={() => { setProcessTarget(s); setProcessNotes(''); }} title="Super admin only" className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20">
                          Mark Completed
                        </button>
                      )}
                      {String(s.status) !== 'COMPLETED' && !superAdmin && (
                        <span className="text-xs text-gray-600" title="Super admin only">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500">No settlements found</td></tr>
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

      <Modal isOpen={!!processTarget} onClose={() => { setProcessTarget(null); setProcessNotes(''); }} title="Complete Settlement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Mark this payout as completed (e.g. after bank transfer). Record a reference in notes.
          </p>
          <textarea value={processNotes} onChange={(e) => setProcessNotes(e.target.value)} placeholder="UTR / transfer reference…" className="input-field h-24 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setProcessTarget(null); setProcessNotes(''); }} className="btn-secondary">Cancel</button>
            <button onClick={confirmProcess} disabled={busy} className="btn-primary">{busy ? 'Processing…' : 'Mark Completed'}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showGenerate} onClose={() => { setShowGenerate(false); setGenOwnerId(''); }} title="Generate Settlement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Bundles all unsettled transactions for an owner into a payout.</p>
          <div className="relative">
            <input
              value={genOwnerId ? genOwnerLabel : genQuery}
              onChange={(e) => { setGenOwnerId(''); setGenOwnerLabel(''); searchOwners(e.target.value, 'gen'); }}
              placeholder="Search owner…"
              className="input-field"
            />
            {genOptions.length > 0 && !genOwnerId && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                {genOptions.map((o) => (
                  <button key={o.id} onClick={() => { setGenOwnerId(o.id); setGenOwnerLabel(o.businessName); setGenOptions([]); setGenQuery(''); }}
                    className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-800">{o.businessName}</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowGenerate(false); setGenOwnerId(''); }} className="btn-secondary">Cancel</button>
            <button onClick={generate} disabled={busy} className="btn-primary">{busy ? 'Generating…' : 'Generate'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
