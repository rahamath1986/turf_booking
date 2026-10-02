'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineStar, HiOutlineHeart, HiOutlineMapPin, HiOutlineClock } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Turf = Record<string, any>;
interface Slot { startTime: string; endTime: string; isAvailable: boolean; price?: number }
interface Review { id: string; rating: number; comment?: string; user?: { fullName?: string }; createdAt?: string }

export default function PlayTurfDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');
  const [turf, setTurf] = useState<Turf | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turfSports, setTurfSports] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFav, setIsFav] = useState(false);
  // booking state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sportId, setSportId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [coupon, setCoupon] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);
  // review form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [tRes, sRes, rRes] = await Promise.all([
          api.get(`/turfs/${id}`),
          api.get(`/turfs/${id}/sports`).catch(() => null),
          api.get(`/turfs/${id}/reviews`, { params: { limit: 10 } }).catch(() => null),
        ]);
        const t = unwrap<Turf>(tRes.data);
        setTurf(t);
        if (sRes) {
          const s = unwrap<Turf[] | { items: Turf[] }>(sRes.data);
          setTurfSports(Array.isArray(s) ? s : (s.items ?? []));
        } else if (t.turfSports) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setTurfSports(t.turfSports.map((x: any) => x.sport || x));
        }
        if (rRes) {
          const r = unwrap<Review[] | { items: Review[] }>(rRes.data);
          setReviews(Array.isArray(r) ? r : (r.items ?? []));
        }
      } catch {
        toast.error('Failed to load turf');
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  const loadSlots = useCallback(async () => {
    if (!turf?.id || !date) return;
    setSlotsLoading(true);
    setQuote(null);
    try {
      const params: Record<string, string> = { date };
      if (sportId) params.sportId = sportId;
      const { data: res } = await api.get(`/turfs/${turf.id}/available-slots`, { params });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = unwrap<any>(res);
      setSlots(payload.slots ?? []);
    } catch {
      toast.error('Failed to load slots');
    } finally {
      setSlotsLoading(false);
    }
  }, [turf?.id, date, sportId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  async function toggleFav() {
    if (!turf?.id) return;
    try {
      if (isFav) {
        await api.delete(`/favorites/${turf.id}`);
        setIsFav(false);
      } else {
        await api.post(`/favorites/${turf.id}`);
        setIsFav(true);
        toast.success('Saved to favorites');
      }
    } catch {
      toast.error('Sign in to save favorites');
    }
  }

  async function previewQuote() {
    if (!turf?.id || !startTime || !endTime) { toast.error('Pick start and end time'); return; }
    setQuoting(true);
    setQuote(null);
    try {
      const payload: Record<string, string> = { turfId: turf.id, bookingDate: date, startTime, endTime };
      if (sportId) payload.sportId = sportId;
      if (coupon.trim()) payload.couponCode = coupon.trim().toUpperCase();
      const { data: res } = await api.post('/bookings/calculate-quote', payload);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setQuote(unwrap<any>(res));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Quote failed — slot may be unavailable');
    } finally {
      setQuoting(false);
    }
  }

  async function bookNow() {
    if (!turf?.id || !startTime || !endTime) { toast.error('Pick start and end time'); return; }
    setBooking(true);
    try {
      const payload: Record<string, string> = { turfId: turf.id, bookingDate: date, startTime, endTime };
      if (sportId) payload.sportId = sportId;
      if (coupon.trim()) payload.couponCode = coupon.trim().toUpperCase();
      const { data: res } = await api.post('/bookings', payload);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = unwrap<any>(res);
      toast.success(`Booked! ${created.bookingNumber || ''}`.trim());
      router.push('/play/bookings');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Booking failed'));
    } finally {
      setBooking(false);
    }
  }

  async function submitReview() {
    if (!turf?.id) return;
    setReviewing(true);
    try {
      await api.post(`/turfs/${turf.id}/reviews`, { rating, comment: comment.trim() || undefined });
      toast.success('Review posted');
      setComment('');
      const { data: res } = await api.get(`/turfs/${turf.id}/reviews`, { params: { limit: 10 } });
      const r = unwrap<Review[] | { items: Review[] }>(res);
      setReviews(Array.isArray(r) ? r : (r.items ?? []));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Review failed');
    } finally {
      setReviewing(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!turf) return <div className="card py-12 text-center text-gray-500">Turf not found</div>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const images: any[] = turf.images ?? [];
  const fee = quote?.feeBreakdown;

  return (
    <div>
      <div className="card mb-5 overflow-hidden !p-0">
        <div className="h-56 bg-gray-800 sm:h-72">
          {turf.coverImageUrl || images[0]?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={turf.coverImageUrl || images[0]?.imageUrl} alt={turf.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-600/30 to-teal-600/30 text-7xl font-bold text-white/40">
              {String(turf.name || '?').charAt(0)}
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">{turf.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                <HiOutlineMapPin className="h-4 w-4" /> {turf.addressLine} {turf.city?.name ? `• ${turf.city.name}` : ''}
              </p>
            </div>
            <button onClick={toggleFav} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${isFav ? 'border-rose-500/40 text-rose-400' : 'border-gray-700 text-gray-400 hover:text-white'}`}>
              <HiOutlineHeart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} /> {isFav ? 'Saved' : 'Save'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-amber-400">
              <HiOutlineStar className="h-4 w-4 fill-current" /> {Number(turf.ratingAverage ?? 0).toFixed(1)}
              <span className="text-gray-500">({turf.totalReviews ?? 0} reviews)</span>
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <HiOutlineClock className="h-4 w-4" /> {turf.openTime} – {turf.closeTime}
            </span>
            {(turfSports ?? []).map((s) => (<Badge key={s.id || s.name} label={s.name} />))}
          </div>
          {turf.description && <p className="mt-4 text-sm leading-relaxed text-gray-300">{turf.description}</p>}
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {images.slice(0, 8).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.imageUrl} alt={img.caption || turf.name} className="h-20 w-full rounded-lg object-cover" loading="lazy" />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card">
          <p className="mb-4 font-medium text-white">Pick a Slot</p>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <input type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={(e) => setDate(e.target.value)} className="input-field" />
            {turfSports.length > 0 && (
              <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="select-field">
                <option value="">Any sport</option>
                {turfSports.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            )}
          </div>
          {slotsLoading ? (
            <LoadingSpinner />
          ) : slots.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No slots for this date</p>
          ) : (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {slots.map((s, i) => {
                const selected = startTime === s.startTime && endTime === s.endTime;
                return (
                  <button
                    key={i}
                    disabled={!s.isAvailable}
                    onClick={() => { setStartTime(s.startTime); setEndTime(s.endTime); setQuote(null); }}
                    className={`rounded-lg border px-2 py-2 text-center text-xs transition-all ${
                      selected
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                        : s.isAvailable
                          ? 'border-gray-700 bg-gray-800/50 text-gray-200 hover:border-emerald-500/40'
                          : 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600 line-through'
                    }`}
                  >
                    <p className="font-medium">{s.startTime}–{s.endTime}</p>
                    <p className="mt-0.5 text-gray-500">₹{Number(s.price ?? 0).toLocaleString()}</p>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input type="time" value={startTime} onChange={(e) => { setStartTime(e.target.value); setQuote(null); }} className="input-field" />
            <input type="time" value={endTime} onChange={(e) => { setEndTime(e.target.value); setQuote(null); }} className="input-field" />
          </div>
          <input value={coupon} onChange={(e) => { setCoupon(e.target.value); setQuote(null); }} placeholder="Coupon code (optional)" className="input-field mt-3 font-mono" />
          {fee && (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
              <div className="grid grid-cols-2 gap-1.5 text-gray-300">
                <span className="text-gray-500">Base</span><span className="text-right">₹{Number(fee.basePrice ?? fee.turfPrice ?? 0).toLocaleString()}</span>
                <span className="text-gray-500">Fee + tax</span><span className="text-right">₹{(Number(fee.platformFee ?? 0) + Number(fee.taxes ?? 0)).toLocaleString()}</span>
                {Number(fee.discount ?? 0) > 0 && (<><span className="text-gray-500">Discount</span><span className="text-right text-emerald-400">-₹{Number(fee.discount).toLocaleString()}</span></>)}
                <span className="font-medium text-white">Total</span><span className="text-right text-lg font-bold text-white">₹{Number(fee.totalAmount ?? 0).toLocaleString()}</span>
              </div>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={previewQuote} disabled={quoting} className="btn-secondary flex-1 justify-center text-xs">{quoting ? 'Checking…' : 'Check Price'}</button>
            <button onClick={bookNow} disabled={booking} className="btn-primary flex-1 justify-center">{booking ? 'Booking…' : 'Book Now'}</button>
          </div>
        </div>

        <div className="card">
          <p className="mb-4 font-medium text-white">Reviews ({reviews.length})</p>
          {reviews.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No reviews yet — be the first!</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg bg-gray-800/50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{r.user?.fullName || 'Player'}</p>
                    <span className="text-amber-400">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-gray-400">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 border-t border-gray-800 pt-4">
            <p className="mb-2 text-sm font-medium text-gray-300">Write a review</p>
            <div className="mb-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} className={`text-xl ${s <= rating ? 'text-amber-400' : 'text-gray-700'}`}>★</button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was your game?" className="input-field h-20 resize-none" />
            <button onClick={submitReview} disabled={reviewing} className="btn-secondary mt-2 text-xs">{reviewing ? 'Posting…' : 'Post Review'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
