'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OwnerTurf = Record<string, any>;
interface RefItem { id: string; name: string }

const emptyForm = {
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
  coverImageUrl: '',
  advancePaymentAllowed: true,
  minAdvancePercentage: 20,
  minAdvanceAmount: 0,
};

export default function OwnerTurfsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cities, setCities] = useState<RefItem[]>([]);
  const [areas, setAreas] = useState<RefItem[]>([]);
  const [sports, setSports] = useState<RefItem[]>([]);
  const [facilities, setFacilities] = useState<RefItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OwnerTurf | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  interface GalleryImage { id: string; imageUrl: string; caption: string | null; isCover?: boolean }
  interface TurfVideo { id: string; videoUrl: string; title: string | null }
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [videos, setVideos] = useState<TurfVideo[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageCaption, setNewImageCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadTurfs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1, limit: 50 };
      if (search) params.search = search;
      const { data: res } = await api.get('/owner/turfs', { params });
      const list = unwrap<OwnerTurf[] | { items: OwnerTurf[] }>(res);
      setItems(Array.isArray(list) ? list : (list.items ?? []));
    } catch {
      toast.error('Failed to load turfs');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadTurfs(); }, [loadTurfs]);

  useEffect(() => {
    async function loadRefs() {
      try {
        const [cRes, sRes, fRes] = await Promise.all([
          api.get('/locations/cities'),
          api.get('/sports'),
          api.get('/facilities/amenities'),
        ]);
        const c = unwrap<RefItem[] | { items: RefItem[] }>(cRes.data);
        setCities(Array.isArray(c) ? c : (c.items ?? []));
        const s = unwrap<RefItem[] | { items: RefItem[] }>(sRes.data);
        setSports(Array.isArray(s) ? s : (s.items ?? []));
        const f = unwrap<RefItem[] | { items: RefItem[] }>(fRes.data);
        setFacilities(Array.isArray(f) ? f : (f.items ?? []));
      } catch { /* non-blocking */ }
    }
    loadRefs();
  }, []);

  async function loadAreas(cityId: string) {
    if (!cityId) { setAreas([]); return; }
    try {
      const { data: res } = await api.get(`/locations/cities/${cityId}/areas`);
      const list = unwrap<RefItem[] | { items?: RefItem[]; areas?: RefItem[] }>(res);
      setAreas(Array.isArray(list) ? list : (list.items ?? list.areas ?? []));
    } catch { setAreas([]); }
  }

  function toggleId(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setAreas([]);
    setShowModal(true);
  }

  async function openEdit(id: string) {
    try {
      const { data: res } = await api.get(`/owner/turfs/${id}`);
      const t = unwrap<OwnerTurf>(res);
      setEditing(t);
      setGallery(Array.isArray(t.images) ? t.images : []);
      setVideos(Array.isArray(t.videos) ? t.videos : []);
      setNewImageUrl('');
      setNewImageCaption('');
      setNewVideoUrl('');
      setForm({
        name: t.name || '',
        cityId: t.cityId || t.city?.id || '',
        areaId: t.areaId || t.area?.id || '',
        addressLine: t.addressLine || '',
        description: t.description || '',
        contactPhone: t.contactPhone || '',
        contactEmail: t.contactEmail || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sportIds: (t.turfSports ?? t.sports ?? []).map((s: any) => s.sport?.id || s.id).filter(Boolean),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        facilityIds: (t.turfFacilities ?? t.facilities ?? []).map((s: any) => s.facility?.id || s.id).filter(Boolean),
        openTime: t.openTime || '06:00',
        closeTime: t.closeTime || '22:00',
        slotDurationMinutes: t.slotDurationMinutes ?? 60,
        coverImageUrl: t.coverImageUrl || '',
        advancePaymentAllowed: t.advancePaymentAllowed ?? true,
        minAdvancePercentage: Number(t.minAdvancePercentage ?? 20),
        minAdvanceAmount: Number(t.minAdvanceAmount ?? 0),
      });
      if (t.cityId || t.city?.id) loadAreas(t.cityId || t.city?.id);
      setShowModal(true);
    } catch {
      toast.error('Failed to load turf');
    }
  }

  async function refreshGallery(id: string) {
    try {
      const { data: res } = await api.get(`/owner/turfs/${id}`);
      const t = unwrap<OwnerTurf>(res);
      setGallery(Array.isArray(t.images) ? t.images : []);
      setVideos(Array.isArray(t.videos) ? t.videos : []);
      setEditing(t);
    } catch {
      toast.error('Failed to refresh gallery');
    }
  }

  async function addVideoUrl() {
    if (!editing || !newVideoUrl.trim()) { toast.error('Enter a video URL'); return; }
    try {
      await api.post(`/owner/turfs/${editing.id}/videos`, { videoUrl: newVideoUrl.trim() });
      toast.success('Video added');
      setNewVideoUrl('');
      refreshGallery(editing.id);
    } catch {
      toast.error('Failed to add video');
    }
  }

  async function uploadVideoFile(files: FileList | null) {
    if (!editing || !files || files.length === 0) return;
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      await api.post(`/owner/turfs/${editing.id}/videos/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Video uploaded');
      refreshGallery(editing.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Video upload failed');
    } finally {
      setUploadingVideo(false);
    }
  }

  async function deleteVideo(videoId: string) {
    if (!editing) return;
    try {
      await api.delete(`/owner/turfs/${editing.id}/videos/${videoId}`);
      toast.success('Video deleted');
      refreshGallery(editing.id);
    } catch {
      toast.error('Failed to delete video');
    }
  }

  async function addImageUrl() {
    if (!editing || !newImageUrl.trim()) { toast.error('Enter an image URL'); return; }
    try {
      await api.post(`/owner/turfs/${editing.id}/images`, {
        imageUrl: newImageUrl.trim(),
        caption: newImageCaption.trim() || undefined,
      });
      toast.success('Image added');
      setNewImageUrl('');
      setNewImageCaption('');
      refreshGallery(editing.id);
    } catch {
      toast.error('Failed to add image');
    }
  }

  async function uploadGalleryFile(files: FileList | null) {
    if (!editing || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/owner/turfs/${editing.id}/images/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success('Image(s) uploaded');
      refreshGallery(editing.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function deleteGalleryImage(imageId: string) {
    if (!editing) return;
    try {
      await api.delete(`/owner/turfs/${editing.id}/images/${imageId}`);
      toast.success('Image deleted');
      refreshGallery(editing.id);
    } catch {
      toast.error('Failed to delete image');
    }
  }

  async function setGalleryCover(imageId: string) {
    if (!editing) return;
    try {
      await api.post(`/owner/turfs/${editing.id}/images/${imageId}/cover`);
      toast.success('Cover updated');
      refreshGallery(editing.id);
    } catch {
      toast.error('Failed to set cover');
    }
  }

  async function submit() {
    if (!form.name.trim() || !form.cityId || !form.addressLine.trim()) {
      toast.error('Name, city and address are required');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        cityId: form.cityId,
        addressLine: form.addressLine.trim(),
        openTime: form.openTime,
        closeTime: form.closeTime,
        slotDurationMinutes: Number(form.slotDurationMinutes),
        advancePaymentAllowed: form.advancePaymentAllowed,
        minAdvancePercentage: Number(form.minAdvancePercentage),
        minAdvanceAmount: Number(form.minAdvanceAmount),
      };
      if (form.areaId) payload.areaId = form.areaId;
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.contactPhone.trim()) payload.contactPhone = form.contactPhone.trim();
      if (form.contactEmail.trim()) payload.contactEmail = form.contactEmail.trim();
      if (form.coverImageUrl.trim()) payload.coverImageUrl = form.coverImageUrl.trim();
      if (form.sportIds.length) payload.sportIds = form.sportIds;
      if (form.facilityIds.length) payload.facilityIds = form.facilityIds;
      if (editing) {
        await api.put(`/owner/turfs/${editing.id}`, payload);
        toast.success('Turf updated');
      } else {
        await api.post('/owner/turfs', payload);
        toast.success('Turf submitted for approval');
      }
      setShowModal(false);
      loadTurfs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(t: OwnerTurf) {
    try {
      await api.patch(`/owner/turfs/${t.id}/status`, { isActive: !t.isActive });
      toast.success(t.isActive ? 'Turf closed' : 'Turf opened');
      loadTurfs();
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function removeTurf(t: OwnerTurf) {
    if (!confirm(`Delete "${t.name}"? This hides it from the platform.`)) return;
    try {
      await api.delete(`/owner/turfs/${t.id}`);
      toast.success('Turf deleted');
      loadTurfs();
    } catch {
      toast.error('Delete failed');
    }
  }

  const set = (patch: Partial<typeof emptyForm>) => setForm({ ...form, ...patch });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Turfs</h1>
          <p className="mt-1 text-sm text-gray-500">{items.length} venue(s)</p>
        </div>
        <button onClick={openCreate} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" /> Add Turf
        </button>
      </div>

      <div className="mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search my turfs…"
          className="input-field max-w-sm"
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : items.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-gray-400">No turfs yet</p>
          <p className="mt-1 text-sm text-gray-500">Add your first venue — it goes live after admin approval.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((t) => (
            <div key={t.id} className="card overflow-hidden !p-0">
              <div className="h-36 bg-gray-800">
                {t.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.coverImageUrl} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-600/30 to-indigo-600/30 text-4xl font-bold text-white/40">
                    {String(t.name || '?').charAt(0)}
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white">{t.name}</p>
                  <Badge label={t.isApproved ? (t.isActive ? 'live' : 'closed') : 'pending'} />
                </div>
                <p className="mt-1 text-xs text-gray-500">{t.city?.name || ''} • {t.openTime}–{t.closeTime}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => openEdit(t.id)} className="btn-secondary text-xs">
                    <HiOutlinePencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => toggleStatus(t)} className="btn-secondary text-xs">
                    {t.isActive ? 'Close' : 'Open'}
                  </button>
                  <button onClick={() => removeTurf(t)} className="btn-danger text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Turf' : 'Add Turf'} size="xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Turf Name *</label>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Address *</label>
            <input value={form.addressLine} onChange={(e) => set({ addressLine: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">City *</label>
            <select value={form.cityId} onChange={(e) => { set({ cityId: e.target.value, areaId: '' }); loadAreas(e.target.value); }} className="select-field">
              <option value="">Select city</option>
              {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Area</label>
            <select value={form.areaId} onChange={(e) => set({ areaId: e.target.value })} className="select-field">
              <option value="">Select area</option>
              {areas.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-gray-400">Description</label>
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} className="input-field h-20 resize-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Contact Phone</label>
            <input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Contact Email</label>
            <input value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Sports</label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800/50 p-2">
              {sports.map((s) => (
                <button key={s.id} onClick={() => set({ sportIds: toggleId(form.sportIds, s.id) })}
                  className={`rounded-full px-2.5 py-1 text-xs ${form.sportIds.includes(s.id) ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700/60 text-gray-400'}`}>{s.name}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Facilities</label>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800/50 p-2">
              {facilities.map((s) => (
                <button key={s.id} onClick={() => set({ facilityIds: toggleId(form.facilityIds, s.id) })}
                  className={`rounded-full px-2.5 py-1 text-xs ${form.facilityIds.includes(s.id) ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700/60 text-gray-400'}`}>{s.name}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Opens</label>
              <input type="time" value={form.openTime} onChange={(e) => set({ openTime: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Closes</label>
              <input type="time" value={form.closeTime} onChange={(e) => set({ closeTime: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Slot (min)</label>
              <input type="number" min={15} max={720} value={form.slotDurationMinutes} onChange={(e) => set({ slotDurationMinutes: Number(e.target.value) })} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Min Advance %</label>
              <input type="number" min={1} max={100} value={form.minAdvancePercentage} onChange={(e) => set({ minAdvancePercentage: Number(e.target.value) })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Min Advance ₹</label>
              <input type="number" min={0} value={form.minAdvanceAmount} onChange={(e) => set({ minAdvanceAmount: Number(e.target.value) })} className="input-field" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
            <input type="checkbox" checked={form.advancePaymentAllowed} onChange={(e) => set({ advancePaymentAllowed: e.target.checked })} className="h-4 w-4 accent-blue-500" />
            Allow advance (partial) payments
          </label>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-gray-400">Cover Image URL</label>
            <input value={form.coverImageUrl} onChange={(e) => set({ coverImageUrl: e.target.value })} placeholder="https://…" className="input-field" />
          </div>
        </div>
        {!editing && <p className="mt-3 text-xs text-gray-500">New turfs go live after admin approval. Gallery images can be added later from this page.</p>}
        {editing && (
          <div className="mt-5 border-t border-gray-800 pt-4">
            <p className="mb-2 font-medium text-gray-400">Gallery ({gallery.length})</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gallery.map((img) => (
                <div key={img.id} className="relative overflow-hidden rounded-lg border border-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl} alt={img.caption || editing.name} className="h-28 w-full object-cover" loading="lazy" />
                  {img.isCover && <span className="absolute left-1 top-1 rounded bg-blue-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">COVER</span>}
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    {!img.isCover && (
                      <button onClick={() => setGalleryCover(img.id)} title="Set as cover" className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-black/80">Cover</button>
                    )}
                    <button onClick={() => deleteGalleryImage(img.id)} title="Delete image" className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-black/80">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Image URL https://…" className="input-field flex-1" />
              <input value={newImageCaption} onChange={(e) => setNewImageCaption(e.target.value)} placeholder="Caption" className="input-field w-40" />
              <button onClick={addImageUrl} className="btn-secondary whitespace-nowrap text-xs">Add URL</button>
              <label className="cursor-pointer whitespace-nowrap rounded-lg border border-dashed border-gray-700 px-3 py-2 text-center text-xs text-gray-300 hover:border-blue-500 hover:text-white">
                {uploading ? 'Uploading…' : '+ Upload file'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
                  onChange={(e) => { uploadGalleryFile(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        )}
        {editing && (
          <div className="mt-5 border-t border-gray-800 pt-4">
            <p className="mb-2 font-medium text-gray-400">Videos ({videos.length})</p>
            {videos.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {videos.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-800/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{v.title || 'Untitled video'}</p>
                      <p className="truncate font-mono text-xs text-gray-500">{v.videoUrl}</p>
                    </div>
                    <button onClick={() => deleteVideo(v.id)} title="Delete video" className="shrink-0 rounded p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} placeholder="Video URL https://… (mp4)" className="input-field flex-1" />
              <button onClick={addVideoUrl} className="btn-secondary whitespace-nowrap text-xs">Add URL</button>
              <label className="cursor-pointer whitespace-nowrap rounded-lg border border-dashed border-gray-700 px-3 py-2 text-center text-xs text-gray-300 hover:border-blue-500 hover:text-white">
                {uploadingVideo ? 'Uploading…' : '+ Upload mp4'}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={uploadingVideo}
                  onChange={(e) => { uploadVideoFile(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Submit Turf'}</button>
        </div>
      </Modal>
    </div>
  );
}
