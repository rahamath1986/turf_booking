'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api, { unwrap } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineStar, HiOutlineHeart, HiOutlineMapPin } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Turf = Record<string, any>;
interface RefItem { id: string; name: string }

export default function PlayBrowsePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [cities, setCities] = useState<RefItem[]>([]);
  const [sports, setSports] = useState<RefItem[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadTurfs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 12 };
      if (cityFilter) params.cityId = cityFilter;
      if (sportFilter) params.sportId = sportFilter;
      const { data: res } = await api.get('/turfs', { params });
      const payload = unwrap<{ items: Turf[]; meta?: { totalPages?: number } } | Turf[]>(res);
      const arr = Array.isArray(payload) ? payload : (payload.items ?? []);
      setItems(arr);
      setTotalPages(!Array.isArray(payload) ? (payload.meta?.totalPages ?? 1) : 1);
    } catch {
      toast.error('Failed to load turfs');
    } finally {
      setLoading(false);
    }
  }, [page, cityFilter, sportFilter]);

  useEffect(() => { loadTurfs(); }, [loadTurfs]);

  useEffect(() => {
    async function loadRefs() {
      try {
        const [cRes, sRes] = await Promise.all([api.get('/locations/cities'), api.get('/sports')]);
        const c = unwrap<RefItem[] | { items: RefItem[] }>(cRes.data);
        setCities(Array.isArray(c) ? c : (c.items ?? []));
        const s = unwrap<RefItem[] | { items: RefItem[] }>(sRes.data);
        setSports(Array.isArray(s) ? s : (s.items ?? []));
      } catch { /* ignore */ }
      try {
        const { data: res } = await api.get('/favorites', { params: { page: 1, limit: 100 } });
        const list = unwrap<Turf[] | { items: Turf[] }>(res);
        const arr = Array.isArray(list) ? list : (list.items ?? []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFavorites(new Set(arr.map((t: any) => t.turfId || t.turf?.id || t.id)));
      } catch { /* not logged in for favorites */ }
    }
    loadRefs();
  }, []);

  async function toggleFavorite(id: string) {
    const isFav = favorites.has(id);
    try {
      if (isFav) {
        await api.delete(`/favorites/${id}`);
        setFavorites((prev) => { const n = new Set(prev); n.delete(id); return n; });
      } else {
        await api.post(`/favorites/${id}`);
        setFavorites((prev) => new Set(prev).add(id));
      }
    } catch {
      toast.error('Please sign in to save favorites');
    }
  }

  const visible = items.filter((t) =>
    search ? String(t.name || '').toLowerCase().includes(search.toLowerCase()) : true,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Find Your Turf</h1>
        <p className="mt-1 text-sm text-gray-500">Book slots at top-rated venues near you</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search venues…" className="input-field pl-10" />
        </div>
        <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className="select-field w-44">
          <option value="">All Cities</option>
          {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </select>
        <select value={sportFilter} onChange={(e) => { setSportFilter(e.target.value); setPage(1); }} className="select-field w-44">
          <option value="">All Sports</option>
          {sports.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : visible.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">No venues found. Try different filters.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((t) => (
              <div key={t.id} className="card overflow-hidden !p-0 transition-colors hover:border-emerald-500/30">
                <Link href={`/play/turfs/${t.slug || t.id}`}>
                  <div className="h-40 bg-gray-800">
                    {t.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.coverImageUrl} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-600/30 to-teal-600/30 text-5xl font-bold text-white/40">
                        {String(t.name || '?').charAt(0)}
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/play/turfs/${t.slug || t.id}`} className="font-semibold text-white hover:text-emerald-300">
                      {t.name}
                    </Link>
                    <button onClick={() => toggleFavorite(t.id)} title="Favorite" className={favorites.has(t.id) ? 'text-rose-400' : 'text-gray-600 hover:text-rose-400'}>
                      <HiOutlineHeart className={`h-5 w-5 ${favorites.has(t.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <HiOutlineMapPin className="h-3 w-3" /> {t.city?.name || t.area?.name || ''} • {t.openTime}–{t.closeTime}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-amber-400">
                      <HiOutlineStar className="h-4 w-4 fill-current" /> {Number(t.ratingAverage ?? 0).toFixed(1)}
                      <span className="text-xs text-gray-500">({t.totalReviews ?? 0})</span>
                    </span>
                    <Link href={`/play/turfs/${t.slug || t.id}`} className="btn-primary py-1.5 text-xs">Book Now</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
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
