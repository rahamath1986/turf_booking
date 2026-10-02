'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { PaginatedResponse } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineMagnifyingGlass } from 'react-icons/hi2';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startDate: string;
  endDate: string;
  totalUsageLimit: number | null;
  currentUsageCount: number;
  perUserLimit: number;
  turfIds: string[];
  ownerIds: string[];
  validDays: number[];
  sportTypes: string[];
  isFirstBookingOnly: boolean;
  isActive: boolean;
  totalRedemptions?: number;
}

interface RefItem { id: string; name: string; businessName?: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyForm = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT',
  discountValue: 10,
  minOrderAmount: 0,
  maxDiscountAmount: '',
  startDate: '',
  endDate: '',
  totalUsageLimit: '',
  perUserLimit: 1,
  ownerIds: [] as string[],
  turfIds: [] as string[],
  validDays: [] as number[],
  sportTypes: [] as string[],
  isFirstBookingOnly: false,
  isActive: true,
};

export default function OffersPage() {
  const [data, setData] = useState<PaginatedResponse<Coupon> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sports, setSports] = useState<RefItem[]>([]);
  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({});
  const [turfMap, setTurfMap] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerResults, setOwnerResults] = useState<{ id: string; businessName: string }[]>([]);
  const [turfSearch, setTurfSearch] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turfResults, setTurfResults] = useState<any[]>([]);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (statusFilter) params.isActive = statusFilter;
      const { data: res } = await api.get('/admin/coupons', { params });
      setData(unwrap<PaginatedResponse<Coupon>>(res));
    } catch {
      toast.error('Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  useEffect(() => {
    async function loadRefs() {
      try {
        const [sRes, oRes, tRes] = await Promise.all([
          api.get('/sports'),
          api.get('/admin/owners', { params: { limit: 100 } }),
          api.get('/admin/turfs', { params: { limit: 100 } }),
        ]);
        const sList = unwrap<RefItem[] | { items: RefItem[] }>(sRes.data);
        setSports(Array.isArray(sList) ? sList : (sList.items ?? []));
        const oList = unwrap<{ items: { id: string; businessName: string }[] }>(oRes.data);
        const om: Record<string, string> = {};
        for (const o of oList.items ?? []) om[o.id] = o.businessName;
        setOwnerMap(om);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tList = unwrap<{ items: any[] }>(tRes.data);
        const tm: Record<string, string> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const t of tList.items ?? []) tm[t.id] = t.name;
        setTurfMap(tm);
      } catch {
        // Non-blocking
      }
    }
    loadRefs();
  }, []);

  const filtered = (data?.items ?? []).filter((c) =>
    search ? c.code.toLowerCase().includes(search.toLowerCase()) : true,
  );

  function scopeBadges(c: Coupon) {
    const badges: string[] = [];
    if ((!c.ownerIds || c.ownerIds.length === 0) && (!c.turfIds || c.turfIds.length === 0)) {
      badges.push('Global');
    }
    if (c.ownerIds?.length) badges.push(`${c.ownerIds.length} owner${c.ownerIds.length > 1 ? 's' : ''}`);
    if (c.turfIds?.length) badges.push(`${c.turfIds.length} turf${c.turfIds.length > 1 ? 's' : ''}`);
    if (c.validDays?.length) {
      const sorted = [...c.validDays].sort((a, b) => a - b);
      const isWeekend = sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6;
      badges.push(isWeekend ? 'Weekend' : sorted.map((d) => DAYS[d]).join(', '));
    }
    if (c.sportTypes?.length) badges.push(c.sportTypes.join(', '));
    if (c.isFirstBookingOnly) badges.push('First booking');
    return badges;
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, startDate: new Date().toISOString().split('T')[0] });
    setOwnerSearch('');
    setOwnerResults([]);
    setTurfSearch('');
    setTurfResults([]);
    setShowModal(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description || '',
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      minOrderAmount: Number(c.minOrderAmount ?? 0),
      maxDiscountAmount: c.maxDiscountAmount != null ? String(Number(c.maxDiscountAmount)) : '',
      startDate: c.startDate ? c.startDate.split('T')[0] : '',
      endDate: c.endDate ? c.endDate.split('T')[0] : '',
      totalUsageLimit: c.totalUsageLimit != null ? String(c.totalUsageLimit) : '',
      perUserLimit: c.perUserLimit ?? 1,
      ownerIds: c.ownerIds ?? [],
      turfIds: c.turfIds ?? [],
      validDays: c.validDays ?? [],
      sportTypes: c.sportTypes ?? [],
      isFirstBookingOnly: c.isFirstBookingOnly,
      isActive: c.isActive,
    });
    setOwnerSearch('');
    setOwnerResults([]);
    setTurfSearch('');
    setTurfResults([]);
    setShowModal(true);
  }

  function toggleList(list: string[], v: string): string[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function toggleDay(d: number) {
    setForm((f) => ({
      ...f,
      validDays: f.validDays.includes(d) ? f.validDays.filter((x) => x !== d) : [...f.validDays, d],
    }));
  }

  async function searchOwners(q: string) {
    setOwnerSearch(q);
    if (q.trim().length < 2) { setOwnerResults([]); return; }
    try {
      const { data: res } = await api.get('/admin/owners', { params: { search: q.trim(), limit: 10 } });
      setOwnerResults(unwrap<{ items: { id: string; businessName: string }[] }>(res).items ?? []);
    } catch {
      setOwnerResults([]);
    }
  }

  async function searchTurfs(q: string) {
    setTurfSearch(q);
    if (q.trim().length < 2) { setTurfResults([]); return; }
    try {
      const { data: res } = await api.get('/admin/turfs', { params: { search: q.trim(), limit: 10 } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = unwrap<{ items: any[] }>(res).items ?? [];
      setTurfResults(items);
      const tm = { ...turfMap };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of items) tm[t.id] = t.name;
      setTurfMap(tm);
    } catch {
      setTurfResults([]);
    }
  }

  async function submit() {
    if (!form.code.trim()) { toast.error('Coupon code is required'); return; }
    if (!form.endDate) { toast.error('End date is required'); return; }
    if (Number(form.discountValue) <= 0) { toast.error('Discount value must be positive'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        endDate: new Date(form.endDate).toISOString(),
        perUserLimit: Number(form.perUserLimit) || 1,
        ownerIds: form.ownerIds,
        turfIds: form.turfIds,
        validDays: [...form.validDays].sort((a, b) => a - b),
        sportTypes: form.sportTypes,
        isFirstBookingOnly: form.isFirstBookingOnly,
        isActive: form.isActive,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.maxDiscountAmount !== '') payload.maxDiscountAmount = Number(form.maxDiscountAmount);
      if (form.startDate) payload.startDate = new Date(form.startDate).toISOString();
      if (form.totalUsageLimit !== '') payload.totalUsageLimit = Number(form.totalUsageLimit);
      if (editing) {
        await api.put(`/admin/coupons/${editing.id}`, payload);
        toast.success('Offer updated');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('Offer created');
      }
      setShowModal(false);
      loadCoupons();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Coupon) {
    try {
      await api.put(`/admin/coupons/${c.id}`, { isActive: !c.isActive });
      toast.success(`${c.code} ${!c.isActive ? 'activated' : 'deactivated'}`);
      loadCoupons();
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`/admin/coupons/${deleting.id}`);
      toast.success('Offer deleted');
      setDeleting(null);
      loadCoupons();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeletingBusy(false);
    }
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Offers & Discounts</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.meta?.total || 0} total offers</p>
        </div>
        <button onClick={openCreate} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" />
          Add Offer
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="select-field w-36">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
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
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Scope</th>
                  <th>Validity</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="font-mono text-sm font-bold text-emerald-400">{c.code}</span>
                      {c.description && <p className="max-w-xs truncate text-xs text-gray-500">{c.description}</p>}
                    </td>
                    <td className="whitespace-nowrap font-medium text-white">
                      {c.discountType === 'PERCENTAGE' ? `${Number(c.discountValue)}%` : `₹${Number(c.discountValue).toLocaleString()}`}
                      {c.discountType === 'PERCENTAGE' && c.maxDiscountAmount != null && (
                        <span className="block text-xs font-normal text-gray-500">up to ₹{Number(c.maxDiscountAmount).toLocaleString()}</span>
                      )}
                      {Number(c.minOrderAmount) > 0 && (
                        <span className="block text-xs font-normal text-gray-500">min ₹{Number(c.minOrderAmount).toLocaleString()}</span>
                      )}
                    </td>
                    <td>
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {scopeBadges(c).map((b) => (<Badge key={b} label={b} />))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-xs text-gray-400">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</td>
                    <td className="text-center text-gray-300">
                      {c.totalRedemptions ?? c.currentUsageCount}{c.totalUsageLimit != null ? ` / ${c.totalUsageLimit}` : ''}
                    </td>
                    <td><Badge label={c.isActive ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(c)} title="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white">
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(c)}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            c.isActive
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => setDeleting(c)} title="Delete" className="rounded p-1 text-gray-400 hover:bg-red-500/10 hover:text-red-400">
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-500">No offers found</td></tr>
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Edit Offer: ${editing.code}` : 'Add Offer'}
        size="xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Coupon Code *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WEEKEND20" className="input-field font-mono" disabled={!!editing} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="20% off on weekends" className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Discount Type *</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'PERCENTAGE' | 'FLAT' })} className="select-field">
                <option value="PERCENTAGE">Percentage %</option>
                <option value="FLAT">Flat ₹</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Value * {form.discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}</label>
              <input type="number" min={0} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Min Order ₹</label>
              <input type="number" min={0} value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Max Discount Cap ₹ (% only)</label>
              <input type="number" min={0} value={form.maxDiscountAmount} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })} placeholder="No cap" className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">End Date *</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Total Usage Limit</label>
              <input type="number" min={1} value={form.totalUsageLimit} onChange={(e) => setForm({ ...form, totalUsageLimit: e.target.value })} placeholder="Unlimited" className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Per-User Limit</label>
              <input type="number" min={1} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} className="input-field" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Valid Days <span className="text-gray-600">(empty = all days)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => toggleDay(i)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${form.validDays.includes(i) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700/60 text-gray-400 hover:text-gray-200'}`}
                >
                  {d}
                </button>
              ))}
              <span className="mx-1 text-gray-700">|</span>
              <button onClick={() => setForm({ ...form, validDays: [0, 6] })} className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20">Weekend</button>
              <button onClick={() => setForm({ ...form, validDays: [1, 2, 3, 4, 5] })} className="rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20">Weekdays</button>
              <button onClick={() => setForm({ ...form, validDays: [] })} className="rounded-full bg-gray-700/60 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200">All days</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
              <label className="mb-1.5 block text-sm text-gray-400">Owner-wise <span className="text-gray-600">(empty = all owners)</span></label>
              <input value={ownerSearch} onChange={(e) => searchOwners(e.target.value)} placeholder="Search owners…" className="input-field" />
              {ownerResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                  {ownerResults.filter((o) => !form.ownerIds.includes(o.id)).map((o) => (
                    <button key={o.id} onClick={() => { setForm({ ...form, ownerIds: [...form.ownerIds, o.id] }); setOwnerResults([]); setOwnerSearch(''); }} className="block w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800">
                      {o.businessName}
                    </button>
                  ))}
                </div>
              )}
              {form.ownerIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.ownerIds.map((id) => (
                    <span key={id} className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                      {ownerMap[id] || `${id.slice(0, 8)}…`}
                      <button onClick={() => setForm({ ...form, ownerIds: form.ownerIds.filter((x) => x !== id) })} className="hover:text-white">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="mb-1.5 block text-sm text-gray-400">Turf-specific <span className="text-gray-600">(empty = all turfs)</span></label>
              <input value={turfSearch} onChange={(e) => searchTurfs(e.target.value)} placeholder="Search turfs…" className="input-field" />
              {turfResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                  {turfResults.filter((t) => !form.turfIds.includes(t.id)).map((t) => (
                    <button key={t.id} onClick={() => { setForm({ ...form, turfIds: [...form.turfIds, t.id] }); setTurfResults([]); setTurfSearch(''); }} className="block w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800">
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              {form.turfIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.turfIds.map((id) => (
                    <span key={id} className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300">
                      {turfMap[id] || `${id.slice(0, 8)}…`}
                      <button onClick={() => setForm({ ...form, turfIds: form.turfIds.filter((x) => x !== id) })} className="hover:text-white">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Sports <span className="text-gray-600">(empty = all)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {sports.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setForm({ ...form, sportTypes: toggleList(form.sportTypes, s.name.toUpperCase()) })}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${form.sportTypes.includes(s.name.toUpperCase()) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700/60 text-gray-400 hover:text-gray-200'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.isFirstBookingOnly} onChange={(e) => setForm({ ...form, isFirstBookingOnly: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
              First booking only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Offer'}</button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete Offer: ${deleting?.code || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">This permanently removes the offer and its configuration. Redemption history is preserved.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmDelete} disabled={deletingBusy} className="btn-danger">{deletingBusy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
