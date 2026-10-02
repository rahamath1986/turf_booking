'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { unwrap } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineTrash, HiOutlineStar } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fav = Record<string, any>;

export default function PlayFavoritesPage() {
  const [items, setItems] = useState<Fav[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get('/favorites', { params: { page: 1, limit: 50 } });
      const list = unwrap<Fav[] | { items: Fav[] }>(res);
      setItems(Array.isArray(list) ? list : (list.items ?? []));
    } catch {
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(turfId: string) {
    try {
      await api.delete(`/favorites/${turfId}`);
      toast.success('Removed');
      load();
    } catch {
      toast.error('Remove failed');
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Favorites</h1>
        <p className="mt-1 text-sm text-gray-500">{items.length} saved venue(s)</p>
      </div>

      {items.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-400">No favorites yet</p>
          <Link href="/play" className="btn-primary mx-auto mt-4 w-fit text-xs">Discover Turfs</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((f, i) => {
            const t = f.turf || f;
            const id = f.turfId || t.id;
            return (
              <div key={f.id || i} className="card flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-800">
                  {t.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.coverImageUrl} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl font-bold text-white/30">{String(t.name || '?').charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/play/turfs/${t.slug || id}`} className="truncate font-medium text-white hover:text-emerald-300">
                    {t.name || 'Turf'}
                  </Link>
                  <p className="flex items-center gap-1 text-xs text-amber-400">
                    <HiOutlineStar className="h-3 w-3 fill-current" /> {Number(t.ratingAverage ?? 0).toFixed(1)}
                    <span className="text-gray-500">• {t.city?.name || ''}</span>
                  </p>
                </div>
                <button onClick={() => remove(id)} title="Remove" className="rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400">
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
