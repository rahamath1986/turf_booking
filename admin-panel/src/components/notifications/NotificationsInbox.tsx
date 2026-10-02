'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Notification = Record<string, any>;

export default function NotificationsInbox({ accent }: { accent: 'emerald' | 'blue' }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (filter) params.isRead = filter;
      const [listRes, unreadRes] = await Promise.all([
        api.get('/notifications', { params }),
        api.get('/notifications/unread').catch(() => null),
      ]);
      const list = unwrap<Notification[] | { items: Notification[]; meta?: { totalPages?: number } }>(listRes.data);
      const arr = Array.isArray(list) ? list : (list.items ?? []);
      setItems(arr);
      setTotalPages(!Array.isArray(list) ? (list.meta?.totalPages ?? 1) : 1);
      if (unreadRes) {
        const u = unwrap<Notification[] | { items?: Notification[]; count?: number; total?: number }>(unreadRes.data);
        const uArr = Array.isArray(u) ? u : (u.items ?? []);
        const obj = Array.isArray(u) ? ({} as { count?: number; total?: number }) : u;
        setUnread(typeof obj.count === 'number' ? obj.count : typeof obj.total === 'number' ? obj.total : uArr.length);
      }
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    try {
      await api.post(`/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      toast.error('Failed to mark as read');
    }
  }

  async function readAll() {
    try {
      await api.post('/notifications/read-all');
      toast.success('All marked as read');
      load();
    } catch {
      toast.error('Failed');
    }
  }

  const dot = accent === 'blue' ? 'bg-blue-400' : 'bg-emerald-400';

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            Notifications
            {unread > 0 && (
              <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-bold text-rose-400">{unread} new</span>
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Booking updates, approvals and payouts</p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="select-field w-36">
            <option value="">All</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
          <button onClick={readAll} className="btn-secondary whitespace-nowrap text-xs">Mark all read</button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">You are all caught up 🎉</div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                className={`card flex cursor-pointer items-start gap-3 !p-4 transition-colors ${n.isRead ? 'opacity-70' : 'border-gray-700'}`}
              >
                {!n.isRead && <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.isRead ? 'text-gray-300' : 'font-medium text-white'}`}>{n.title || n.type || 'Notification'}</p>
                  {(n.body || n.message) && <p className="mt-0.5 text-sm text-gray-500">{n.body || n.message}</p>}
                  <p className="mt-1 text-xs text-gray-600">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString('en-IN') : ''}
                    {n.type ? ` • ${n.type}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-xs">Previous</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary text-xs">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
