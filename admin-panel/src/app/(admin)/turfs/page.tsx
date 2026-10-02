'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { Turf, PaginatedResponse } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineEye, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi2';
import { VideoAdder, TurfSchedules } from '@/components/turfs/TurfExtras';

interface RefItem { id: string; name: string }
interface OwnerRef { id: string; businessName: string; user?: { fullName: string; email: string } }
interface GalleryImage { id: string; imageUrl: string; caption: string | null; isCover?: boolean }

const emptyTurfForm = {
  ownerId: '',
  ownerLabel: '',
  name: '',
  cityId: '',
  areaId: '',
  addressLine: '',
  description: '',
  contactPhone: '',
  contactEmail: '',
  sportIds: [] as string[],
  facilityIds: [] as string[],
  openTime: '06:00',
  closeTime: '22:00',
  slotDurationMinutes: 60,
  advancePaymentAllowed: true,
  minAdvancePercentage: 20,
  minAdvanceAmount: 0,
  coverImageUrl: '',
  isApproved: true,
  isActive: true,
  isFeatured: false,
};

export default function TurfsPage() {
  const [data, setData] = useState<PaginatedResponse<Turf> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [approvedFilter, setApprovedFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [cities, setCities] = useState<RefItem[]>([]);
  const [page, setPage] = useState(1);
  const [detailTurf, setDetailTurf] = useState<Turf | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionModal, setActionModal] = useState<{ type: 'reject' | 'suspend'; turfId: string } | null>(null);
  // Create / edit state
  const [sports, setSports] = useState<RefItem[]>([]);
  const [facilities, setFacilities] = useState<RefItem[]>([]);
  const [areas, setAreas] = useState<RefItem[]>([]);
  const [areasCityId, setAreasCityId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyTurfForm);
  const [creating, setCreating] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerResults, setOwnerResults] = useState<OwnerRef[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [urlImages, setUrlImages] = useState<{ imageUrl: string; caption: string }[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');
  const [editingTurf, setEditingTurf] = useState<Turf | null>(null);
  const [editForm, setEditForm] = useState(emptyTurfForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadTurfs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (approvedFilter) params.isApproved = approvedFilter;
      if (cityFilter) params.cityId = cityFilter;
      const { data: res } = await api.get('/admin/turfs', { params });
      setData(unwrap<PaginatedResponse<Turf>>(res));
    } catch {
      toast.error('Failed to load turfs');
    } finally {
      setLoading(false);
    }
  }, [page, search, approvedFilter, cityFilter]);

  useEffect(() => { loadTurfs(); }, [loadTurfs]);

  useEffect(() => {
    async function loadCities() {
      try {
        const { data: res } = await api.get('/locations/cities');
        const list = unwrap<{ id: string; name: string }[] | { items: { id: string; name: string }[] }>(res);
        setCities(Array.isArray(list) ? list : (list.items ?? []));
      } catch {
        // Non-blocking: city filter just stays empty
      }
    }
    loadCities();
  }, []);

  useEffect(() => {
    async function loadRefs() {
      try {
        const [sportsRes, facRes] = await Promise.all([
          api.get('/sports'),
          api.get('/facilities/amenities'),
        ]);
        const sList = unwrap<RefItem[] | { items: RefItem[] }>(sportsRes.data);
        const fList = unwrap<RefItem[] | { items: RefItem[] }>(facRes.data);
        setSports(Array.isArray(sList) ? sList : (sList.items ?? []));
        setFacilities(Array.isArray(fList) ? fList : (fList.items ?? []));
      } catch {
        // Non-blocking: selectors stay empty
      }
    }
    loadRefs();
  }, []);

  async function loadAreas(cityId: string) {
    if (!cityId || cityId === areasCityId) return;
    try {
      const { data: res } = await api.get(`/locations/cities/${cityId}/areas`);
      const list = unwrap<RefItem[] | { items?: RefItem[]; areas?: RefItem[] }>(res);
      setAreas(Array.isArray(list) ? list : (list.items ?? list.areas ?? []));
      setAreasCityId(cityId);
    } catch {
      setAreas([]);
      setAreasCityId(cityId);
    }
  }

  async function searchOwners(q: string) {
    setOwnerSearch(q);
    if (q.trim().length < 2) { setOwnerResults([]); return; }
    try {
      const { data: res } = await api.get('/admin/owners', { params: { search: q.trim(), limit: 10 } });
      setOwnerResults(unwrap<{ items: OwnerRef[] }>(res).items ?? []);
    } catch {
      setOwnerResults([]);
    }
  }

  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function buildTurfPayload(f: typeof emptyTurfForm): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      name: f.name.trim(),
      cityId: f.cityId,
      addressLine: f.addressLine.trim(),
      openTime: f.openTime,
      closeTime: f.closeTime,
      slotDurationMinutes: Number(f.slotDurationMinutes),
      advancePaymentAllowed: f.advancePaymentAllowed,
      minAdvancePercentage: Number(f.minAdvancePercentage),
      minAdvanceAmount: Number(f.minAdvanceAmount),
      isApproved: f.isApproved,
      isActive: f.isActive,
      isFeatured: f.isFeatured,
    };
    if (f.ownerId) payload.ownerId = f.ownerId;
    if (f.areaId) payload.areaId = f.areaId;
    if (f.description.trim()) payload.description = f.description.trim();
    if (f.contactPhone.trim()) payload.contactPhone = f.contactPhone.trim();
    if (f.contactEmail.trim()) payload.contactEmail = f.contactEmail.trim();
    if (f.coverImageUrl.trim()) payload.coverImageUrl = f.coverImageUrl.trim();
    if (f.sportIds.length) payload.sportIds = f.sportIds;
    if (f.facilityIds.length) payload.facilityIds = f.facilityIds;
    return payload;
  }

  async function uploadImageFile(turfId: string, file: File, caption?: string) {
    const fd = new FormData();
    fd.append('file', file);
    if (caption) fd.append('caption', caption);
    const { data: res } = await api.post(`/admin/turfs/${turfId}/images/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap<GalleryImage>(res);
  }

  async function refreshDetail(id: string) {
    try {
      const { data: detail } = await api.get(`/admin/turfs/${id}`);
      const full = unwrap<Turf>(detail);
      setDetailTurf(full);
      if (editingTurf?.id === id) setEditingTurf(full);
    } catch {
      toast.error('Failed to refresh turf details');
    }
  }

  async function submitCreate() {
    if (!createForm.ownerId) { toast.error('Select an owner'); return; }
    if (!createForm.name.trim() || !createForm.cityId || !createForm.addressLine.trim()) {
      toast.error('Owner, name, city and address are required');
      return;
    }
    setCreating(true);
    try {
      const { data: res } = await api.post('/admin/turfs', buildTurfPayload(createForm));
      const created = unwrap<Turf>(res);
      // Attach URL images
      for (const img of urlImages) {
        await api.post(`/admin/turfs/${created.id}/images`, { imageUrl: img.imageUrl, caption: img.caption || undefined });
      }
      // Upload pending files
      for (const file of pendingFiles) {
        await uploadImageFile(created.id, file);
      }
      toast.success('Turf created');
      setShowCreate(false);
      setCreateForm(emptyTurfForm);
      setPendingFiles([]);
      setUrlImages([]);
      setOwnerSearch('');
      setOwnerResults([]);
      loadTurfs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create turf'));
    } finally {
      setCreating(false);
    }
  }

  async function openEdit(turf: Turf) {
    setNewImageUrl('');
    setNewImageCaption('');
    setOwnerSearch('');
    setOwnerResults([]);
    try {
      const { data: detail } = await api.get(`/admin/turfs/${turf.id}`);
      const full = unwrap<Turf>(detail);
      setEditingTurf(full);
      setEditForm({
        ...emptyTurfForm,
        ownerId: full.ownerId || full.owner?.id || '',
        ownerLabel: full.owner?.businessName || '',
        name: full.name || '',
        cityId: full.cityId || '',
        areaId: full.areaId || '',
        addressLine: full.addressLine || '',
        description: full.description || '',
        contactPhone: full.contactPhone || '',
        contactEmail: full.contactEmail || '',
        sportIds: (full.turfSports ?? []).map((s) => s.sport.id),
        facilityIds: (full.turfFacilities ?? []).map((f) => f.facility.id),
        openTime: full.openTime || '06:00',
        closeTime: full.closeTime || '22:00',
        slotDurationMinutes: full.slotDurationMinutes ?? 60,
        advancePaymentAllowed: full.advancePaymentAllowed ?? true,
        minAdvancePercentage: Number(full.minAdvancePercentage ?? 20),
        minAdvanceAmount: Number(full.minAdvanceAmount ?? 0),
        coverImageUrl: full.coverImageUrl || '',
        isApproved: full.isApproved,
        isActive: full.isActive,
        isFeatured: full.isFeatured ?? false,
      });
      if (full.cityId) loadAreas(full.cityId);
    } catch {
      toast.error('Failed to load turf details');
    }
  }

  async function submitEdit() {
    if (!editingTurf) return;
    if (!editForm.name.trim() || !editForm.addressLine.trim()) {
      toast.error('Name and address are required');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/admin/turfs/${editingTurf.id}`, buildTurfPayload(editForm));
      toast.success('Turf updated');
      setEditingTurf(null);
      loadTurfs();
      refreshDetail(editingTurf.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to update turf'));
    } finally {
      setSaving(false);
    }
  }

  async function addImageUrl(turfId: string) {
    if (!newImageUrl.trim()) { toast.error('Enter an image URL'); return; }
    try {
      await api.post(`/admin/turfs/${turfId}/images`, {
        imageUrl: newImageUrl.trim(),
        caption: newImageCaption.trim() || undefined,
      });
      toast.success('Image added');
      setNewImageUrl('');
      setNewImageCaption('');
      refreshDetail(turfId);
    } catch {
      toast.error('Failed to add image');
    }
  }

  async function uploadToGallery(turfId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadImageFile(turfId, file);
      }
      toast.success('Image(s) uploaded');
      refreshDetail(turfId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Upload failed (storage may not be configured)');
    } finally {
      setUploading(false);
    }
  }

  async function deleteGalleryImage(turfId: string, imageId: string) {
    try {
      await api.delete(`/admin/turfs/${turfId}/images/${imageId}`);
      toast.success('Image deleted');
      refreshDetail(turfId);
    } catch {
      toast.error('Failed to delete image');
    }
  }

  async function setGalleryCover(turfId: string, imageId: string) {
    try {
      await api.post(`/admin/turfs/${turfId}/images/${imageId}/cover`);
      toast.success('Cover image updated');
      refreshDetail(turfId);
    } catch {
      toast.error('Failed to set cover');
    }
  }

  async function approveTurf(id: string) {
    try {
      await api.post(`/admin/turfs/${id}/approve`);
      toast.success('Turf approved');
      loadTurfs();
    } catch {
      toast.error('Failed to approve turf');
    }
  }

  async function executeAction() {
    if (!actionModal) return;
    try {
      const endpoint = actionModal.type === 'reject' ? 'reject' : 'suspend';
      await api.post(`/admin/turfs/${actionModal.turfId}/${endpoint}`, { reason: actionReason });
      toast.success(`Turf ${actionModal.type === 'reject' ? 'rejected' : 'suspended'}`);
      setActionModal(null);
      setActionReason('');
      loadTurfs();
    } catch {
      toast.error(`Failed to ${actionModal.type} turf`);
    }
  }

  async function viewTurfDetail(id: string) {
    try {
      const { data: detail } = await api.get(`/admin/turfs/${id}`);
      setDetailTurf(unwrap<Turf>(detail));
    } catch {
      toast.error('Failed to load turf details');
    }
  }

  function renderTurfFields(
    f: typeof emptyTurfForm,
    setF: (v: typeof emptyTurfForm) => void,
  ) {
    const set = (patch: Partial<typeof emptyTurfForm>) => setF({ ...f, ...patch });
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative sm:col-span-2">
          <label className="mb-1.5 block text-sm text-gray-400">Owner *</label>
          <input
            value={f.ownerId ? f.ownerLabel : ownerSearch}
            onChange={(e) => { set({ ownerId: '', ownerLabel: '' }); searchOwners(e.target.value); }}
            placeholder="Type 2+ letters to search owners…"
            className="input-field"
          />
          {ownerResults.length > 0 && !f.ownerId && (
            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
              {ownerResults.map((o) => (
                <button
                  key={o.id}
                  onClick={() => { set({ ownerId: o.id, ownerLabel: o.businessName }); setOwnerResults([]); setOwnerSearch(''); }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                >
                  <span className="font-medium text-white">{o.businessName}</span>
                  <span className="ml-2 text-xs text-gray-500">{o.user?.fullName} • {o.user?.email}</span>
                </button>
              ))}
            </div>
          )}
          {f.ownerId && <p className="mt-1 text-xs text-emerald-400">Selected: {f.ownerLabel}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Turf Name *</label>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Arena 7s Football" className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Address *</label>
          <input value={f.addressLine} onChange={(e) => set({ addressLine: e.target.value })} placeholder="Street, landmark…" className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">City *</label>
          <select
            value={f.cityId}
            onChange={(e) => { set({ cityId: e.target.value, areaId: '' }); loadAreas(e.target.value); }}
            className="select-field"
          >
            <option value="">Select city</option>
            {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Area</label>
          <select value={f.areaId} onChange={(e) => set({ areaId: e.target.value })} className="select-field">
            <option value="">Select area</option>
            {areas.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-gray-400">Description</label>
          <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} className="input-field h-20 resize-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Contact Phone</label>
          <input value={f.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Contact Email</label>
          <input value={f.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Sports</label>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800/50 p-2">
            {sports.map((s) => (
              <button
                key={s.id}
                onClick={() => set({ sportIds: toggleId(f.sportIds, s.id) })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${f.sportIds.includes(s.id) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700/60 text-gray-400 hover:text-gray-200'}`}
              >
                {s.name}
              </button>
            ))}
            {sports.length === 0 && <span className="text-xs text-gray-500">No sports found</span>}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-400">Facilities</label>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800/50 p-2">
            {facilities.map((s) => (
              <button
                key={s.id}
                onClick={() => set({ facilityIds: toggleId(f.facilityIds, s.id) })}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${f.facilityIds.includes(s.id) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700/60 text-gray-400 hover:text-gray-200'}`}
              >
                {s.name}
              </button>
            ))}
            {facilities.length === 0 && <span className="text-xs text-gray-500">No facilities found</span>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Opens</label>
            <input type="time" value={f.openTime} onChange={(e) => set({ openTime: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Closes</label>
            <input type="time" value={f.closeTime} onChange={(e) => set({ closeTime: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Slot (min)</label>
            <input type="number" min={15} max={720} value={f.slotDurationMinutes} onChange={(e) => set({ slotDurationMinutes: Number(e.target.value) })} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Min Advance %</label>
            <input type="number" min={1} max={100} value={f.minAdvancePercentage} onChange={(e) => set({ minAdvancePercentage: Number(e.target.value) })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Min Advance ₹</label>
            <input type="number" min={0} value={f.minAdvanceAmount} onChange={(e) => set({ minAdvanceAmount: Number(e.target.value) })} className="input-field" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-gray-400">Cover Image URL</label>
          <input value={f.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} placeholder="https://…" className="input-field" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={f.advancePaymentAllowed} onChange={(e) => set({ advancePaymentAllowed: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
          Advance payment allowed
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={f.isApproved} onChange={(e) => set({ isApproved: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Approved
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={f.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Featured
          </label>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Turf Management</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.meta?.total || 0} total turfs</p>
        </div>
        <button onClick={() => { setNewImageUrl(''); setNewImageCaption(''); setOwnerSearch(''); setOwnerResults([]); setShowCreate(true); }} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" />
          Add Turf
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, address…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10"
          />
        </div>
        <select
          value={approvedFilter}
          onChange={(e) => { setApprovedFilter(e.target.value); setPage(1); }}
          className="select-field w-44"
        >
          <option value="">All Approval</option>
          <option value="true">Approved</option>
          <option value="false">Pending</option>
        </select>
        <select
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className="select-field w-44"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
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
                  <th>Turf Name</th>
                  <th>Owner</th>
                  <th>City</th>
                  <th>Rating</th>
                  <th>Bookings</th>
                  <th>Advance %</th>
                  <th>Approved</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((turf) => (
                  <tr key={turf.id}>
                    <td>
                      <div>
                        <p className="font-medium text-white">{turf.name}</p>
                        <p className="text-xs text-gray-500">{turf.slug}</p>
                      </div>
                    </td>
                    <td className="text-gray-400">{turf.owner?.businessName || '—'}</td>
                    <td>{turf.city?.name || '—'}</td>
                    <td>
                      <span className="text-amber-400">★</span> {Number(turf.ratingAverage).toFixed(1)}
                    </td>
                    <td className="text-center">{turf._count?.bookings ?? 0}</td>
                    <td className="text-center">{Number(turf.minAdvancePercentage)}%</td>
                    <td><Badge label={turf.isApproved ? 'approved' : 'rejected'} /></td>
                    <td><Badge label={turf.isActive ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewTurfDetail(turf.id)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                          title="View details"
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(turf)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                          title="Edit turf"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        {!turf.isApproved && (
                          <button onClick={() => approveTurf(turf.id)} className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20">
                            Approve
                          </button>
                        )}
                        {!turf.isApproved && (
                          <button onClick={() => setActionModal({ type: 'reject', turfId: turf.id })} className="rounded bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20">
                            Reject
                          </button>
                        )}
                        {turf.isActive && (
                          <button onClick={() => setActionModal({ type: 'suspend', turfId: turf.id })} className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20">
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.items || data.items.length === 0) && (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-500">No turfs found</td></tr>
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

      {/* Turf Detail Modal */}
      <Modal isOpen={!!detailTurf} onClose={() => setDetailTurf(null)} title={`Turf: ${detailTurf?.name || ''}`} size="xl">
        {detailTurf && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <div><p className="text-gray-500">Name</p><p className="font-medium text-white">{detailTurf.name}</p></div>
              <div><p className="text-gray-500">Slug</p><p className="text-white">{detailTurf.slug}</p></div>
              <div><p className="text-gray-500">Owner</p><p className="text-white">{detailTurf.owner?.businessName || '—'}</p></div>
              <div><p className="text-gray-500">City</p><p className="text-white">{detailTurf.city?.name || '—'}</p></div>
              <div><p className="text-gray-500">Area</p><p className="text-white">{detailTurf.area?.name || '—'}</p></div>
              <div><p className="text-gray-500">Address</p><p className="text-white">{detailTurf.addressLine}</p></div>
              <div><p className="text-gray-500">Rating</p><p className="text-white">★ {Number(detailTurf.ratingAverage).toFixed(1)} ({detailTurf.totalReviews} reviews)</p></div>
              <div><p className="text-gray-500">Operating Hours</p><p className="text-white">{detailTurf.openTime} – {detailTurf.closeTime}</p></div>
              <div><p className="text-gray-500">Slot Duration</p><p className="text-white">{detailTurf.slotDurationMinutes} min</p></div>
            </div>

            {/* Payment Settings */}
            <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
              <p className="mb-3 font-medium text-amber-400">💳 Advance Payment Settings</p>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-gray-500">Allowed</p><Badge label={detailTurf.advancePaymentAllowed ? 'true' : 'false'} /></div>
                <div><p className="text-gray-500">Min Percentage</p><p className="text-lg font-bold text-white">{Number(detailTurf.minAdvancePercentage)}%</p></div>
                <div><p className="text-gray-500">Min Amount</p><p className="text-lg font-bold text-white">₹{Number(detailTurf.minAdvanceAmount)}</p></div>
              </div>
            </div>

            {/* Images */}
            {detailTurf.images && detailTurf.images.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Images ({detailTurf.images.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {detailTurf.images.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.imageUrl}
                      alt={img.caption || detailTurf.name}
                      title={img.caption || undefined}
                      className="h-24 w-full rounded-lg border border-gray-800 object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sports */}
            {detailTurf.turfSports && detailTurf.turfSports.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Sports</p>
                <div className="flex flex-wrap gap-2">
                  {detailTurf.turfSports.map((ts) => (
                    <Badge key={ts.sport.id} label={ts.sport.name} />
                  ))}
                </div>
              </div>
            )}

            {/* Facilities */}
            {detailTurf.turfFacilities && detailTurf.turfFacilities.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Facilities</p>
                <div className="flex flex-wrap gap-2">
                  {detailTurf.turfFacilities.map((tf) => (
                    <Badge key={tf.facility.id} label={tf.facility.name} />
                  ))}
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500">Contact Phone</p><p className="text-white">{detailTurf.contactPhone || '—'}</p></div>
              <div><p className="text-gray-500">Contact Email</p><p className="text-white">{detailTurf.contactEmail || '—'}</p></div>
            </div>

            {/* Status */}
            <div className="flex gap-4">
              <div><p className="text-gray-500">Approved</p><Badge label={detailTurf.isApproved ? 'approved' : 'rejected'} /></div>
              <div><p className="text-gray-500">Active</p><Badge label={detailTurf.isActive ? 'active' : 'inactive'} /></div>
              <div><p className="text-gray-500">Featured</p><Badge label={detailTurf.isFeatured ? 'true' : 'false'} /></div>
            </div>

            {detailTurf.rejectionReason && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
                <p className="font-medium text-rose-400">Rejection Reason</p>
                <p className="mt-1 text-sm text-gray-300">{detailTurf.rejectionReason}</p>
              </div>
            )}

            {/* Videos */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-gray-400">Videos ({(detailTurf.videos ?? []).length})</p>
              </div>
              {(detailTurf.videos ?? []).length > 0 && (
                <div className="mb-2 space-y-2">
                  {(detailTurf.videos ?? []).map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{v.title || 'Untitled video'}</p>
                        <a href={v.videoUrl} target="_blank" rel="noreferrer" className="block truncate font-mono text-xs text-blue-400 hover:underline">{v.videoUrl}</a>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await api.delete(`/admin/turfs/${detailTurf.id}/videos/${v.id}`);
                            toast.success('Video deleted');
                            const { data } = await api.get(`/admin/turfs/${detailTurf.id}`);
                            setDetailTurf(unwrap<Turf>(data));
                            loadTurfs();
                          } catch {
                            toast.error('Failed to delete video');
                          }
                        }}
                        className="shrink-0 rounded p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                        title="Delete video"
                      >
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <VideoAdder
                onAdd={async (payload) => {
                  await api.post(`/admin/turfs/${detailTurf.id}/videos`, payload);
                  const { data } = await api.get(`/admin/turfs/${detailTurf.id}`);
                  setDetailTurf(unwrap<Turf>(data));
                }}
                onUpload={async (file) => {
                  const fd = new FormData();
                  fd.append('file', file);
                  await api.post(`/admin/turfs/${detailTurf.id}/videos/upload`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  const { data } = await api.get(`/admin/turfs/${detailTurf.id}`);
                  setDetailTurf(unwrap<Turf>(data));
                }}
              />
            </div>

            {/* Schedules: hours, blocks, pricing */}
            {detailTurf && <TurfSchedules turfId={detailTurf.id} />}
          </div>
        )}
      </Modal>

      {/* Action Reason Modal */}
      <Modal isOpen={!!actionModal} onClose={() => { setActionModal(null); setActionReason(''); }} title={actionModal?.type === 'reject' ? 'Reject Turf' : 'Suspend Turf'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Reason</label>
            <textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Enter reason…" className="input-field h-24 resize-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setActionModal(null); setActionReason(''); }} className="btn-secondary">Cancel</button>
            <button onClick={executeAction} className="btn-danger">{actionModal?.type === 'reject' ? 'Reject' : 'Suspend'}</button>
          </div>
        </div>
      </Modal>

      {/* Create Turf Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(emptyTurfForm); setPendingFiles([]); setUrlImages([]); setOwnerSearch(''); setOwnerResults([]); }}
        title="Add Turf (on behalf of owner)"
        size="xl"
      >
        <div className="space-y-5">
          {renderTurfFields(createForm, setCreateForm)}
          <div>
            <p className="mb-2 font-medium text-gray-400">Gallery Images</p>
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-lg border border-dashed border-gray-700 px-4 py-2 text-sm text-gray-300 hover:border-emerald-500 hover:text-white">
                + Upload files
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {pendingFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {pendingFiles.map((f, i) => (
                  <span key={i} className="flex items-center gap-2 rounded-lg bg-gray-800/60 px-3 py-1.5 text-xs text-gray-300">
                    {f.name}
                    <button onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))} className="text-rose-400 hover:text-rose-300">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Image URL https://…" className="input-field flex-1" />
              <input value={newImageCaption} onChange={(e) => setNewImageCaption(e.target.value)} placeholder="Caption (optional)" className="input-field w-48" />
              <button
                onClick={() => {
                  if (!newImageUrl.trim()) { toast.error('Enter an image URL'); return; }
                  setUrlImages((prev) => [...prev, { imageUrl: newImageUrl.trim(), caption: newImageCaption.trim() }]);
                  setNewImageUrl('');
                  setNewImageCaption('');
                }}
                className="btn-secondary whitespace-nowrap text-xs"
              >
                Add URL
              </button>
            </div>
            {urlImages.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {urlImages.map((img, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
                    <span className="truncate text-gray-300">{img.imageUrl}{img.caption ? ` — ${img.caption}` : ''}</span>
                    <button onClick={() => setUrlImages((prev) => prev.filter((_, j) => j !== i))} className="ml-2 text-rose-400 hover:text-rose-300">✕</button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">Files upload on create (requires blob storage configured); URLs attach directly.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCreate(false); setCreateForm(emptyTurfForm); setPendingFiles([]); setUrlImages([]); }} className="btn-secondary">Cancel</button>
            <button onClick={submitCreate} disabled={creating} className="btn-primary">{creating ? 'Creating…' : 'Create Turf'}</button>
          </div>
        </div>
      </Modal>

      {/* Edit Turf Modal */}
      <Modal
        isOpen={!!editingTurf}
        onClose={() => setEditingTurf(null)}
        title={`Edit Turf: ${editingTurf?.name || ''}`}
        size="xl"
      >
        <div className="space-y-5">
          {renderTurfFields(editForm, setEditForm)}
          {editingTurf && (
            <div>
              <p className="mb-2 font-medium text-gray-400">Gallery ({((editingTurf.images ?? []) as GalleryImage[]).length})</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {((editingTurf.images ?? []) as GalleryImage[]).map((img) => (
                  <div key={img.id} className="relative overflow-hidden rounded-lg border border-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt={img.caption || editingTurf.name} className="h-28 w-full object-cover" loading="lazy" />
                    {img.isCover && <span className="absolute left-1 top-1 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">COVER</span>}
                    <div className="absolute bottom-1 right-1 flex gap-1">
                      {!img.isCover && (
                        <button onClick={() => setGalleryCover(editingTurf.id, img.id)} title="Set as cover" className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-black/80">Cover</button>
                      )}
                      <button onClick={() => deleteGalleryImage(editingTurf.id, img.id)} title="Delete image" className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-black/80">
                        <HiOutlineTrash className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Image URL https://…" className="input-field flex-1" />
                <input value={newImageCaption} onChange={(e) => setNewImageCaption(e.target.value)} placeholder="Caption" className="input-field w-40" />
                <button onClick={() => addImageUrl(editingTurf.id)} className="btn-secondary whitespace-nowrap text-xs">Add URL</button>
                <label className="cursor-pointer whitespace-nowrap rounded-lg border border-dashed border-gray-700 px-3 py-2 text-center text-xs text-gray-300 hover:border-emerald-500 hover:text-white">
                  {uploading ? 'Uploading…' : '+ Upload file'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { uploadToGallery(editingTurf.id, e.target.files); e.target.value = ''; }}
                  />
                </label>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditingTurf(null)} className="btn-secondary">Cancel</button>
            <button onClick={submitEdit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
