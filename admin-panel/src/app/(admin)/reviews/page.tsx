'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { PaginatedResponse } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineTrash } from 'react-icons/hi2';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  ownerReply: string | null;
  ownerRepliedAt: string | null;
  createdAt: string;
  user?: { id: string; fullName: string; email: string };
  turf?: { id: string; name: string };
}

export default function ReviewsPage() {
  const [data, setData] = useState<PaginatedResponse<Review> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search.trim()) params.search = search.trim();
      if (ratingFilter) params.rating = ratingFilter;
      const { data: res } = await api.get('/admin/reviews', { params });
      setData(unwrap<PaginatedResponse<Review>>(res));
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [page, search, ratingFilter]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/admin/reviews/${deleting.id}`);
      toast.success('Review deleted');
      setDeleting(null);
      loadReviews();
    } catch {
      toast.error('Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Reviews Moderation</h1>
        <p className="mt-1 text-sm text-gray-500">{data?.meta?.total || 0} total reviews</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search comment, user, turf…"
            className="input-field pl-10"
          />
        </div>
        <select value={ratingFilter} onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }} className="select-field w-40">
          <option value="">All Ratings</option>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="space-y-3">
            {(data?.items ?? []).map((r) => (
              <div key={r.id} className="card !p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-amber-400">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      <span className="font-medium text-white">{r.user?.fullName || 'Player'}</span>
                      <span className="text-xs text-gray-500">on {r.turf?.name || '—'}</span>
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm text-gray-300">{r.comment}</p>}
                    {r.ownerReply && (
                      <div className="mt-2 rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
                        <p className="font-medium text-blue-400">Owner reply</p>
                        <p className="mt-0.5 text-gray-300">{r.ownerReply}</p>
                      </div>
                    )}
                    <p className="mt-1.5 text-xs text-gray-600">{new Date(r.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                  <button onClick={() => setDeleting(r)} title="Delete review" className="rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400">
                    <HiOutlineTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {(data?.items ?? []).length === 0 && (
              <div className="card py-8 text-center text-gray-500">No reviews found</div>
            )}
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

      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Delete Review" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Delete this {deleting?.rating}-star review by {deleting?.user?.fullName || 'a player'}? The turf rating is recalculated automatically.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmDelete} disabled={busy} className="btn-danger">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
