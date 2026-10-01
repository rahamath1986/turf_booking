'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineTrophy, HiOutlineSparkles } from 'react-icons/hi2';

interface CatalogItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  minPlayers?: number;
  maxPlayers?: number;
  isActive: boolean;
  _count?: { turfSports?: number; turfFacilities?: number };
}

type Tab = 'sports' | 'facilities';

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  iconUrl: '',
  minPlayers: 2,
  maxPlayers: 22,
  isActive: true,
};

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sports');
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const endpoint = activeTab === 'sports' ? '/admin/sports' : '/admin/facilities';

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(activeTab === 'sports' ? '/admin/sports' : '/admin/facilities');
      const list = unwrap<CatalogItem[] | { items: CatalogItem[] }>(res);
      setItems(Array.isArray(list) ? list : (list.items ?? []));
    } catch {
      toast.error(`Failed to load ${activeTab}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadItems(); }, [loadItems]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(item: CatalogItem) {
    setEditing(item);
    setForm({
      name: item.name || '',
      slug: item.slug || '',
      description: item.description || '',
      iconUrl: item.iconUrl || '',
      minPlayers: item.minPlayers ?? 2,
      maxPlayers: item.maxPlayers ?? 22,
      isActive: item.isActive,
    });
    setShowModal(true);
  }

  function usageOf(item: CatalogItem): number {
    return item._count?.turfSports ?? item._count?.turfFacilities ?? 0;
  }

  async function submit() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (activeTab === 'sports' && Number(form.minPlayers) > Number(form.maxPlayers)) {
      toast.error('Min players cannot exceed max players');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        iconUrl: form.iconUrl.trim() || null,
        isActive: form.isActive,
      };
      if (form.slug.trim()) payload.slug = form.slug.trim();
      if (activeTab === 'sports') {
        payload.minPlayers = Number(form.minPlayers);
        payload.maxPlayers = Number(form.maxPlayers);
      }
      if (editing) {
        await api.patch(`${endpoint}/${editing.id}`, payload);
        toast.success(`${activeTab === 'sports' ? 'Sport' : 'Facility'} updated`);
      } else {
        await api.post(endpoint, payload);
        toast.success(`${activeTab === 'sports' ? 'Sport' : 'Facility'} created`);
      }
      setShowModal(false);
      loadItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Save failed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: CatalogItem) {
    try {
      await api.patch(`${endpoint}/${item.id}`, { isActive: !item.isActive });
      toast.success(`${item.name} ${!item.isActive ? 'activated' : 'deactivated'}`);
      loadItems();
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await api.delete(`${endpoint}/${deleting.id}`);
      toast.success('Deleted');
      setDeleting(null);
      loadItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Delete failed');
    } finally {
      setDeletingBusy(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof HiOutlineTrophy }[] = [
    { key: 'sports', label: 'Sports', icon: HiOutlineTrophy },
    { key: 'facilities', label: 'Facilities', icon: HiOutlineSparkles },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Sports & facilities assigned to turfs</p>
        </div>
        <button onClick={openCreate} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" />
          Add {activeTab === 'sports' ? 'Sport' : 'Facility'}
        </button>
      </div>

      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border border-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                {activeTab === 'sports' && <th>Players</th>}
                <th>Turfs</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {item.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.iconUrl} alt={item.name} className="h-8 w-8 rounded-lg border border-gray-800 object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        {item.description && <p className="max-w-xs truncate text-xs text-gray-500">{item.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-gray-400">{item.slug}</td>
                  {activeTab === 'sports' && (
                    <td className="text-center text-gray-300">{item.minPlayers ?? '—'}–{item.maxPlayers ?? '—'}</td>
                  )}
                  <td className="text-center">{usageOf(item)}</td>
                  <td><Badge label={item.isActive ? 'active' : 'inactive'} /></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(item)} title="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white">
                        <HiOutlinePencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(item)}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          item.isActive
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => setDeleting(item)} title="Delete" className="rounded p-1 text-gray-400 hover:bg-red-500/10 hover:text-red-400">
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={activeTab === 'sports' ? 6 : 5} className="py-8 text-center text-gray-500">No {activeTab} found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Edit ${activeTab === 'sports' ? 'Sport' : 'Facility'}` : `Add ${activeTab === 'sports' ? 'Sport' : 'Facility'}`}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={activeTab === 'sports' ? 'Football' : 'Floodlights'} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Slug (auto if empty)</label>
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="lowercase-with-dashes" className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-gray-400">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field h-20 resize-none" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-gray-400">Icon Image URL</label>
            <input value={form.iconUrl} onChange={(e) => setForm({ ...form, iconUrl: e.target.value })} placeholder="https://…" className="input-field" />
          </div>
          {activeTab === 'sports' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Min Players</label>
                <input type="number" min={1} max={100} value={form.minPlayers} onChange={(e) => setForm({ ...form, minPlayers: Number(e.target.value) })} className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Max Players</label>
                <input type="number" min={1} max={100} value={form.maxPlayers} onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })} className="input-field" />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Active
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${activeTab === 'sports' ? 'Sport' : 'Facility'}: ${deleting?.name || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {activeTab === 'sports'
              ? 'This soft-deletes the sport (hidden everywhere, history preserved).'
              : 'Facilities can only be deleted when no turf uses them — otherwise deactivate instead.'}
            {deleting && usageOf(deleting) > 0 && (
              <span className="mt-1 block text-amber-400">Currently used by {usageOf(deleting)} turf(s).</span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmDelete} disabled={deletingBusy} className="btn-danger">{deletingBusy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
