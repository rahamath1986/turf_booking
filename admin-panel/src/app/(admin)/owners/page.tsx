'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { TurfOwner, PaginatedResponse } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlinePlus } from 'react-icons/hi2';

const emptyCreateForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  businessName: '',
  legalName: '',
  panNumber: '',
  gstNumber: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
  isVerified: false,
  isActive: false,
};

const emptyEditForm = {
  businessName: '',
  legalName: '',
  panNumber: '',
  gstNumber: '',
  bankAccountNumber: '',
  bankIfsc: '',
  bankName: '',
  fullName: '',
  phone: '',
  isVerified: false,
  isActive: true,
};

export default function OwnersPage() {
  const [data, setData] = useState<PaginatedResponse<TurfOwner> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOwner, setSelectedOwner] = useState<TurfOwner | null>(null);
  const [detailOwner, setDetailOwner] = useState<TurfOwner | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionModal, setActionModal] = useState<{ type: 'reject' | 'suspend'; ownerId: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [editingOwner, setEditingOwner] = useState<TurfOwner | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [deletingOwner, setDeletingOwner] = useState<TurfOwner | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadOwners = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (verifiedFilter) params.isVerified = verifiedFilter;
      const { data: res } = await api.get('/admin/owners', { params });
      setData(unwrap<PaginatedResponse<TurfOwner>>(res));
    } catch {
      toast.error('Failed to load owners');
    } finally {
      setLoading(false);
    }
  }, [page, search, verifiedFilter]);

  useEffect(() => { loadOwners(); }, [loadOwners]);

  async function approveOwner(id: string) {
    try {
      await api.post(`/admin/owners/${id}/approve`);
      toast.success('Owner approved');
      loadOwners();
    } catch {
      toast.error('Failed to approve owner');
    }
  }

  async function rejectOwner() {
    if (!actionModal) return;
    try {
      await api.post(`/admin/owners/${actionModal.ownerId}/reject`, { reason: actionReason });
      toast.success('Owner rejected');
      setActionModal(null);
      setActionReason('');
      loadOwners();
    } catch {
      toast.error('Failed to reject owner');
    }
  }

  async function suspendOwner() {
    if (!actionModal) return;
    try {
      await api.post(`/admin/owners/${actionModal.ownerId}/suspend`, { reason: actionReason });
      toast.success('Owner suspended');
      setActionModal(null);
      setActionReason('');
      loadOwners();
    } catch {
      toast.error('Failed to suspend owner');
    }
  }

  async function viewOwnerDetail(id: string) {
    try {
      const { data: detail } = await api.get(`/admin/owners/${id}`);
      setDetailOwner(unwrap<TurfOwner>(detail));
    } catch {
      toast.error('Failed to load owner details');
    }
  }

  async function openEditOwner(owner: TurfOwner) {
    try {
      const { data: detail } = await api.get(`/admin/owners/${owner.id}`);
      const full = unwrap<TurfOwner>(detail);
      setEditingOwner(full);
      setEditForm({
        businessName: full.businessName || '',
        legalName: (full as unknown as Record<string, string | null>).legalName || '',
        panNumber: (full as unknown as Record<string, string | null>).panNumber || '',
        gstNumber: (full as unknown as Record<string, string | null>).gstNumber || '',
        bankAccountNumber: (full as unknown as Record<string, string | null>).bankAccountNumber || '',
        bankIfsc: (full as unknown as Record<string, string | null>).bankIfsc || '',
        bankName: (full as unknown as Record<string, string | null>).bankName || '',
        fullName: full.user?.fullName || '',
        phone: full.user?.phone || '',
        isVerified: full.isVerified,
        isActive: full.isActive,
      });
    } catch {
      toast.error('Failed to load owner details');
    }
  }

  async function submitCreate() {
    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.password) {
      toast.error('Full name, email and password are required');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        isVerified: createForm.isVerified,
        isActive: createForm.isActive,
      };
      if (createForm.phone.trim()) payload.phone = createForm.phone.trim();
      if (createForm.businessName.trim()) payload.businessName = createForm.businessName.trim();
      if (createForm.legalName.trim()) payload.legalName = createForm.legalName.trim();
      if (createForm.panNumber.trim()) payload.panNumber = createForm.panNumber.trim();
      if (createForm.gstNumber.trim()) payload.gstNumber = createForm.gstNumber.trim();
      if (createForm.bankAccountNumber.trim()) payload.bankAccountNumber = createForm.bankAccountNumber.trim();
      if (createForm.bankIfsc.trim()) payload.bankIfsc = createForm.bankIfsc.trim();
      if (createForm.bankName.trim()) payload.bankName = createForm.bankName.trim();
      await api.post('/admin/owners', payload);
      toast.success('Owner created');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      loadOwners();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create owner'));
    } finally {
      setCreating(false);
    }
  }

  async function submitEdit() {
    if (!editingOwner) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        businessName: editForm.businessName.trim(),
        legalName: editForm.legalName.trim() || null,
        panNumber: editForm.panNumber.trim() || null,
        gstNumber: editForm.gstNumber.trim() || null,
        bankAccountNumber: editForm.bankAccountNumber.trim() || null,
        bankIfsc: editForm.bankIfsc.trim() || null,
        bankName: editForm.bankName.trim() || null,
        fullName: editForm.fullName.trim(),
        isVerified: editForm.isVerified,
        isActive: editForm.isActive,
      };
      if (editForm.phone.trim()) payload.phone = editForm.phone.trim();
      await api.patch(`/admin/owners/${editingOwner.id}`, payload);
      toast.success('Owner updated');
      setEditingOwner(null);
      loadOwners();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to update owner'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingOwner) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/owners/${deletingOwner.id}`, { data: { reason: deleteReason } });
      toast.success('Owner deleted');
      setDeletingOwner(null);
      setDeleteReason('');
      loadOwners();
    } catch {
      toast.error('Failed to delete owner');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Owner Management</h1>
          <p className="mt-1 text-sm text-gray-500">{data?.meta?.total || 0} total owners</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" />
          Add Owner
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by business name, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10"
          />
        </div>
        <select
          value={verifiedFilter}
          onChange={(e) => { setVerifiedFilter(e.target.value); setPage(1); }}
          className="select-field w-44"
        >
          <option value="">All Verification</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
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
                  <th>Business Name</th>
                  <th>Owner</th>
                  <th>Email</th>
                  <th>Turfs</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((owner) => (
                  <tr key={owner.id}>
                    <td className="font-medium text-white">{owner.businessName}</td>
                    <td>{owner.user?.fullName || '—'}</td>
                    <td className="text-gray-400">{owner.user?.email || '—'}</td>
                    <td className="text-center">{owner._count?.turfs ?? 0}</td>
                    <td><Badge label={owner.isVerified ? 'verified' : 'unverified'} /></td>
                    <td><Badge label={owner.isActive ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedOwner(owner); viewOwnerDetail(owner.id); }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                          title="View details"
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </button>
                        {!owner.isVerified && (
                          <button
                            onClick={() => approveOwner(owner.id)}
                            className="rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20"
                          >
                            Approve
                          </button>
                        )}
                        {!owner.isVerified && (
                          <button
                            onClick={() => setActionModal({ type: 'reject', ownerId: owner.id })}
                            className="rounded bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20"
                          >
                            Reject
                          </button>
                        )}
                        {owner.isActive && (
                          <button
                            onClick={() => setActionModal({ type: 'suspend', ownerId: owner.id })}
                            className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          onClick={() => openEditOwner(owner)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                          title="Edit owner"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingOwner(owner)}
                          className="rounded p-1 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                          title="Delete owner"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">No owners found</td>
                  </tr>
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

      {/* Owner Detail Modal */}
      <Modal
        isOpen={!!selectedOwner && !!detailOwner}
        onClose={() => { setSelectedOwner(null); setDetailOwner(null); }}
        title={`Owner: ${detailOwner?.businessName || ''}`}
        size="lg"
      >
        {detailOwner && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500">Business Name</p><p className="font-medium text-white">{detailOwner.businessName}</p></div>
              <div><p className="text-gray-500">Owner Name</p><p className="text-white">{detailOwner.user?.fullName || '—'}</p></div>
              <div><p className="text-gray-500">Email</p><p className="text-white">{detailOwner.user?.email || '—'}</p></div>
              <div><p className="text-gray-500">Phone</p><p className="text-white">{detailOwner.user?.phone || '—'}</p></div>
              <div><p className="text-gray-500">Verified</p><Badge label={detailOwner.isVerified ? 'verified' : 'unverified'} /></div>
              <div><p className="text-gray-500">Status</p><Badge label={detailOwner.isActive ? 'active' : 'inactive'} /></div>
            </div>
            {detailOwner.turfs && detailOwner.turfs.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-gray-400">Turfs ({detailOwner.turfs.length})</p>
                <div className="space-y-2">
                  {detailOwner.turfs.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2">
                      <span className="text-white">{t.name}</span>
                      <div className="flex gap-2">
                        <Badge label={t.isApproved ? 'approved' : 'rejected'} />
                        <Badge label={t.isActive ? 'active' : 'inactive'} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detailOwner.commissionConfig && (
              <div>
                <p className="text-gray-500">Commission Rate</p>
                <p className="text-white">{detailOwner.commissionConfig.commissionPercentage}%</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject / Suspend Reason Modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => { setActionModal(null); setActionReason(''); }}
        title={actionModal?.type === 'reject' ? 'Reject Owner' : 'Suspend Owner'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Reason</label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter reason…"
              className="input-field h-24 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setActionModal(null); setActionReason(''); }} className="btn-secondary">Cancel</button>
            <button
              onClick={actionModal?.type === 'reject' ? rejectOwner : suspendOwner}
              className="btn-danger"
            >
              {actionModal?.type === 'reject' ? 'Reject' : 'Suspend'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Owner Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(emptyCreateForm); }}
        title="Add Turf Owner"
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Full Name *</label>
            <input value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} placeholder="Vikram Malhotra" className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Email *</label>
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="owner@example.com" className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Password *</label>
            <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Min 8 characters" className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Phone</label>
            <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+919876543210" className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-gray-400">Business Name</label>
            <input value={createForm.businessName} onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })} placeholder="Defaults to “<Name>’s Sports Arena”" className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Legal Name</label>
            <input value={createForm.legalName} onChange={(e) => setCreateForm({ ...createForm, legalName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">PAN</label>
            <input value={createForm.panNumber} onChange={(e) => setCreateForm({ ...createForm, panNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">GST</label>
            <input value={createForm.gstNumber} onChange={(e) => setCreateForm({ ...createForm, gstNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Bank Name</label>
            <input value={createForm.bankName} onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Account Number</label>
            <input value={createForm.bankAccountNumber} onChange={(e) => setCreateForm({ ...createForm, bankAccountNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">IFSC</label>
            <input value={createForm.bankIfsc} onChange={(e) => setCreateForm({ ...createForm, bankIfsc: e.target.value })} className="input-field" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={createForm.isVerified} onChange={(e) => setCreateForm({ ...createForm, isVerified: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Verify immediately
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Activate immediately
          </label>
        </div>
        <p className="mt-3 text-xs text-gray-500">New owners default to unverified + inactive until approved.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => { setShowCreate(false); setCreateForm(emptyCreateForm); }} className="btn-secondary">Cancel</button>
          <button onClick={submitCreate} disabled={creating} className="btn-primary">{creating ? 'Creating…' : 'Create Owner'}</button>
        </div>
      </Modal>

      {/* Edit Owner Modal */}
      <Modal
        isOpen={!!editingOwner}
        onClose={() => setEditingOwner(null)}
        title={`Edit Owner: ${editingOwner?.businessName || ''}`}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Business Name</label>
            <input value={editForm.businessName} onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Contact Person</label>
            <input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Phone</label>
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Legal Name</label>
            <input value={editForm.legalName} onChange={(e) => setEditForm({ ...editForm, legalName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">PAN</label>
            <input value={editForm.panNumber} onChange={(e) => setEditForm({ ...editForm, panNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">GST</label>
            <input value={editForm.gstNumber} onChange={(e) => setEditForm({ ...editForm, gstNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Bank Name</label>
            <input value={editForm.bankName} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Account Number</label>
            <input value={editForm.bankAccountNumber} onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">IFSC</label>
            <input value={editForm.bankIfsc} onChange={(e) => setEditForm({ ...editForm, bankIfsc: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Verification</label>
            <select value={editForm.isVerified ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, isVerified: e.target.value === 'true' })} className="select-field">
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Status</label>
            <select value={editForm.isActive ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'true' })} className="select-field">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditingOwner(null)} className="btn-secondary">Cancel</button>
          <button onClick={submitEdit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </Modal>

      {/* Delete Owner Confirm Modal */}
      <Modal
        isOpen={!!deletingOwner}
        onClose={() => { setDeletingOwner(null); setDeleteReason(''); }}
        title={`Delete Owner: ${deletingOwner?.businessName || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            This soft-deletes the owner profile, deactivates their login and all their venues.
            Booking and financial history is preserved. This cannot be undone from the panel.
          </p>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Reason</label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Enter reason…"
              className="input-field h-24 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setDeletingOwner(null); setDeleteReason(''); }} className="btn-secondary">Cancel</button>
            <button onClick={confirmDelete} disabled={deleting} className="btn-danger">{deleting ? 'Deleting…' : 'Delete Owner'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
