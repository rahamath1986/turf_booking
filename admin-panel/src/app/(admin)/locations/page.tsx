'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineGlobeAlt, HiOutlineMap, HiOutlineMapPin, HiOutlineBuildingOffice2 } from 'react-icons/hi2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loc = Record<string, any>;
type Tab = 'countries' | 'states' | 'cities' | 'areas';

interface TabConfig {
  key: Tab;
  label: string;
  icon: typeof HiOutlineGlobeAlt;
  endpoint: string;
  singular: string;
}

const TABS: TabConfig[] = [
  { key: 'countries', label: 'Countries', icon: HiOutlineGlobeAlt, endpoint: '/admin/locations/countries', singular: 'Country' },
  { key: 'states', label: 'States', icon: HiOutlineMap, endpoint: '/admin/locations/states', singular: 'State' },
  { key: 'cities', label: 'Cities', icon: HiOutlineMapPin, endpoint: '/admin/locations/cities-admin', singular: 'City' },
  { key: 'areas', label: 'Areas', icon: HiOutlineBuildingOffice2, endpoint: '/admin/locations/areas-admin', singular: 'Area' },
];

export default function LocationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('cities');
  const [items, setItems] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<Loc[]>([]);
  const [parentFilter, setParentFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Loc | null>(null);
  const [form, setForm] = useState<Loc>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Loc | null>(null);
  const [busy, setBusy] = useState(false);

  const cfg = TABS.find((t) => t.key === activeTab)!;
  const parentKey = activeTab === 'states' ? 'countryId' : activeTab === 'cities' ? 'stateId' : activeTab === 'areas' ? 'cityId' : '';
  const parentEndpoint =
    activeTab === 'states' ? '/admin/locations/countries'
    : activeTab === 'cities' ? '/admin/locations/states'
    : activeTab === 'areas' ? '/admin/locations/cities-admin'
    : '';

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (parentKey && parentFilter) params[parentKey] = parentFilter;
      const { data: res } = await api.get(cfg.endpoint, { params });
      const list = unwrap<Loc[] | { items: Loc[] }>(res);
      setItems(Array.isArray(list) ? list : (list.items ?? []));
    } catch {
      toast.error(`Failed to load ${cfg.label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [cfg, parentKey, parentFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  useEffect(() => {
    async function loadParents() {
      if (!parentEndpoint) { setParents([]); return; }
      try {
        const { data: res } = await api.get(parentEndpoint);
        const list = unwrap<Loc[] | { items: Loc[] }>(res);
        setParents(Array.isArray(list) ? list : (list.items ?? []));
      } catch {
        setParents([]);
      }
    }
    loadParents();
    setParentFilter('');
  }, [activeTab, parentEndpoint]);

  function parentName(item: Loc): string {
    return (
      item.country?.name || item.state?.name || item.city?.name ||
      parents.find((p) => p.id === (item.countryId || item.stateId || item.cityId))?.name || '—'
    );
  }

  function usageOf(item: Loc): string {
    const c = item._count;
    if (!c) return '—';
    const parts: string[] = [];
    if (c.states != null) parts.push(`${c.states} states`);
    if (c.cities != null) parts.push(`${c.cities} cities`);
    if (c.areas != null) parts.push(`${c.areas} areas`);
    if (c.turfs != null) parts.push(`${c.turfs} turfs`);
    return parts.length ? parts.join(', ') : 'unused';
  }

  function openCreate() {
    setEditing(null);
    setForm({ isActive: true, ...(parentKey && parentFilter ? { [parentKey]: parentFilter } : {}) });
    setShowModal(true);
  }

  function openEdit(item: Loc) {
    setEditing(item);
    setForm({
      name: item.name || '',
      code: item.code || '',
      slug: item.slug || '',
      phoneCode: item.phoneCode || '',
      currency: item.currency || '',
      postalCode: item.postalCode || '',
      latitude: item.latitude ?? '',
      longitude: item.longitude ?? '',
      isActive: item.isActive,
      ...(parentKey ? { [parentKey]: item.countryId || item.stateId || item.cityId || '' } : {}),
    });
    setShowModal(true);
  }

  async function submit() {
    if (!String(form.name || '').trim()) { toast.error('Name is required'); return; }
    if (parentKey && !form[parentKey] && !editing) { toast.error(`Select a parent ${parentKey.replace('Id', '')}`); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: String(form.name).trim(), isActive: form.isActive ?? true };
      for (const k of ['code', 'slug', 'phoneCode', 'currency', 'postalCode']) {
        if (form[k] !== undefined && String(form[k]).trim() !== '') payload[k] = String(form[k]).trim();
      }
      for (const k of ['latitude', 'longitude']) {
        if (form[k] !== undefined && form[k] !== '' && form[k] !== null) payload[k] = Number(form[k]);
      }
      if (parentKey && form[parentKey]) payload[parentKey] = form[parentKey];
      if (editing) {
        await api.patch(`${cfg.endpoint}/${editing.id}`, payload);
        toast.success(`${cfg.singular} updated`);
      } else {
        await api.post(cfg.endpoint, payload);
        toast.success(`${cfg.singular} created`);
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

  async function toggleActive(item: Loc) {
    try {
      await api.patch(`${cfg.endpoint}/${item.id}`, { isActive: !item.isActive });
      toast.success(`${item.name} ${!item.isActive ? 'activated' : 'deactivated'}`);
      loadItems();
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`${cfg.endpoint}/${deleting.id}`);
      toast.success('Deleted');
      setDeleting(null);
      loadItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Delete failed (may be in use)');
    } finally {
      setBusy(false);
    }
  }

  const set = (patch: Loc) => setForm({ ...form, ...patch });
  const parentLabel = parentKey ? parentKey.replace('Id', '') : '';

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Locations</h1>
          <p className="mt-1 text-sm text-gray-500">Country → State → City → Area hierarchy</p>
        </div>
        <button onClick={openCreate} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" /> Add {cfg.singular}
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
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
        {parentKey && parents.length > 0 && (
          <select value={parentFilter} onChange={(e) => setParentFilter(e.target.value)} className="select-field ml-auto w-52">
            <option value="">All {parentLabel}s</option>
            {parents.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {activeTab !== 'countries' && <th>Parent</th>}
                {(activeTab === 'countries' || activeTab === 'states') && <th>Code</th>}
                {activeTab !== 'countries' && activeTab !== 'states' && <th>Slug</th>}
                <th>Usage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-white">
                    {item.name}
                    {item.postalCode && <span className="ml-2 text-xs text-gray-500">{item.postalCode}</span>}
                  </td>
                  {activeTab !== 'countries' && <td className="text-gray-400">{parentName(item)}</td>}
                  {(activeTab === 'countries' || activeTab === 'states') && <td className="font-mono text-xs text-gray-400">{item.code}</td>}
                  {activeTab !== 'countries' && activeTab !== 'states' && <td className="font-mono text-xs text-gray-400">{item.slug}</td>}
                  <td className="text-xs text-gray-400">{usageOf(item)}</td>
                  <td><Badge label={item.isActive ? 'active' : 'inactive'} /></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(item)} title="Edit" className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white">
                        <HiOutlinePencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(item)}
                        className={`rounded px-2 py-1 text-xs font-medium ${item.isActive ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
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
                <tr><td colSpan={7} className="py-8 text-center text-gray-500">No {cfg.label.toLowerCase()} found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? `Edit ${cfg.singular}` : `Add ${cfg.singular}`} size="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {parentKey && (
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm capitalize text-gray-400">Parent {parentLabel} *</label>
              <select value={form[parentKey] || ''} onChange={(e) => set({ [parentKey]: e.target.value })} className="select-field" disabled={!!editing && activeTab === 'areas'}>
                <option value="">Select {parentLabel}</option>
                {parents.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Name *</label>
            <input value={form.name || ''} onChange={(e) => set({ name: e.target.value })} className="input-field" />
          </div>
          {(activeTab === 'countries' || activeTab === 'states') && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Code *</label>
              <input value={form.code || ''} onChange={(e) => set({ code: e.target.value })} placeholder={activeTab === 'countries' ? 'IN' : 'KA'} className="input-field font-mono" />
            </div>
          )}
          {(activeTab === 'cities' || activeTab === 'areas') && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Slug (auto if empty)</label>
              <input value={form.slug || ''} onChange={(e) => set({ slug: e.target.value })} className="input-field font-mono" />
            </div>
          )}
          {activeTab === 'countries' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Phone Code *</label>
                <input value={form.phoneCode || ''} onChange={(e) => set({ phoneCode: e.target.value })} placeholder="+91" className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Currency</label>
                <input value={form.currency || ''} onChange={(e) => set({ currency: e.target.value })} placeholder="INR" className="input-field" />
              </div>
            </>
          )}
          {activeTab === 'areas' && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Postal Code</label>
              <input value={form.postalCode || ''} onChange={(e) => set({ postalCode: e.target.value })} className="input-field" />
            </div>
          )}
          {(activeTab === 'cities' || activeTab === 'areas') && (
            <>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Latitude</label>
                <input type="number" step="any" value={form.latitude ?? ''} onChange={(e) => set({ latitude: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-gray-400">Longitude</label>
                <input type="number" step="any" value={form.longitude ?? ''} onChange={(e) => set({ longitude: e.target.value })} className="input-field" />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
            <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => set({ isActive: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Active
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button>
        </div>
      </Modal>

      <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${cfg.singular}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Delete <span className="font-medium text-white">{deleting?.name}</span>? Only unused records can be deleted — otherwise deactivate instead.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleting(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmDelete} disabled={busy} className="btn-danger">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
