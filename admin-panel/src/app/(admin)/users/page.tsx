'use client';

import { useEffect, useState, useCallback } from 'react';
import api, { unwrap } from '@/lib/api';
import { User, PaginatedResponse } from '@/lib/types';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineEye, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi2';
import { useAuth, isSuperAdmin } from '@/lib/auth';

const ALL_ROLES = ['CUSTOMER', 'TURF_OWNER', 'STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

const emptyCreateForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  roles: ['CUSTOMER'],
  isActive: true,
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const superAdmin = isSuperAdmin(me?.roles ?? []);
  const [data, setData] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailUser, setDetailUser] = useState<Record<string, unknown> | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.isActive = statusFilter;
      const { data: res } = await api.get('/admin/users', { params });
      setData(unwrap<PaginatedResponse<User>>(res));
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function toggleUserStatus(userId: string, isActive: boolean) {
    try {
      await api.patch(`/admin/users/${userId}/status`, { isActive: !isActive });
      toast.success(`User ${!isActive ? 'activated' : 'deactivated'}`);
      loadUsers();
    } catch {
      toast.error('Failed to update status');
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [userBusy, setUserBusy] = useState(false);

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    setUserBusy(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      toast.success('User deleted');
      setDeleteTarget(null);
      loadUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Delete failed');
    } finally {
      setUserBusy(false);
    }
  }

  async function confirmResetPassword() {
    if (!resetTarget) return;
    if (newPassword.length < 8) { toast.error('Minimum 8 characters'); return; }
    setUserBusy(true);
    try {
      await api.post(`/admin/users/${resetTarget.id}/reset-password`, { newPassword });
      toast.success('Password reset — user must sign in again');
      setResetTarget(null);
      setNewPassword('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Reset failed');
    } finally {
      setUserBusy(false);
    }
  }

  async function viewUserDetail(userId: string) {
    try {
      const { data: detail } = await api.get(`/admin/users/${userId}`);
      setDetailUser(unwrap<Record<string, unknown>>(detail));
    } catch {
      toast.error('Failed to load user details');
    }
  }

  function toggleCreateRole(role: string) {
    setCreateForm((f) => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role],
    }));
  }

  async function submitCreate() {
    if (!createForm.fullName.trim() || !createForm.email.trim() || !createForm.password) {
      toast.error('Full name, email and password are required');
      return;
    }
    if (createForm.roles.length === 0) {
      toast.error('Select at least one role');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        roles: createForm.roles,
        isActive: createForm.isActive,
      };
      if (createForm.phone.trim()) payload.phone = createForm.phone.trim();
      await api.post('/admin/users', payload);
      toast.success('User created');
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      loadUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create user'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data?.meta?.total || 0} total users
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary w-fit">
          <HiOutlinePlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="select-field w-40"
        >
          <option value="">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="TURF_OWNER">Turf Owner</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="select-field w-36"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Roles</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Bookings</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-xs font-bold text-white">
                          {user.fullName?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="text-gray-400">{user.email}</td>
                    <td className="text-gray-400">{user.phone || '—'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((r) => (
                          <Badge key={r} label={r} />
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge label={user.isEmailVerified ? 'verified' : 'unverified'} />
                    </td>
                    <td>
                      <Badge label={user.isActive ? 'active' : 'inactive'} />
                    </td>
                    <td className="text-center">{user._count?.bookings ?? 0}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setSelectedUser(user); viewUserDetail(user.id); }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                          title="View details"
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(user.id, user.isActive)}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            user.isActive
                              ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {superAdmin && (
                          <>
                            <button
                              onClick={() => { setResetTarget(user); setNewPassword(''); }}
                              title="Reset password (super admin)"
                              className="rounded px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                            >
                              Reset PW
                            </button>
                            <button
                              onClick={() => setDeleteTarget(user)}
                              title="Delete user (super admin)"
                              className="rounded p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <HiOutlineTrash className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {data.meta.page} of {data.meta.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary text-xs"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.meta.totalPages}
                  className="btn-secondary text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedUser && !!detailUser}
        onClose={() => { setSelectedUser(null); setDetailUser(null); }}
        title={`User: ${selectedUser?.fullName || ''}`}
        size="lg"
      >
        {detailUser && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-500">Email</p><p className="text-white">{(detailUser as Record<string, unknown>).email as string}</p></div>
              <div><p className="text-gray-500">Phone</p><p className="text-white">{(detailUser as Record<string, unknown>).phone as string || '—'}</p></div>
              <div><p className="text-gray-500">Email Verified</p><Badge label={(detailUser as Record<string, unknown>).isEmailVerified ? 'verified' : 'unverified'} /></div>
              <div><p className="text-gray-500">Phone Verified</p><Badge label={(detailUser as Record<string, unknown>).isPhoneVerified ? 'verified' : 'unverified'} /></div>
              <div><p className="text-gray-500">Status</p><Badge label={(detailUser as Record<string, unknown>).isActive ? 'active' : 'inactive'} /></div>
              <div><p className="text-gray-500">Joined</p><p className="text-white">{new Date((detailUser as Record<string, unknown>).createdAt as string).toLocaleDateString()}</p></div>
            </div>
            <div>
              <p className="text-gray-500">Roles</p>
              <div className="mt-1 flex gap-1">
                {((detailUser as Record<string, unknown>).roles as string[] || []).map((r: string) => (
                  <Badge key={r} label={r} />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreateForm(emptyCreateForm); }}
        title="Add User"
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Full Name *</label>
            <input value={createForm.fullName} onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })} placeholder="Rahul Sharma" className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Email *</label>
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="user@example.com" className="input-field" />
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
            <label className="mb-1.5 block text-sm text-gray-400">Roles *</label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    createForm.roles.includes(role)
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={createForm.roles.includes(role)}
                    onChange={() => toggleCreateRole(role)}
                    className="h-3.5 w-3.5 accent-emerald-500"
                  />
                  {role}
                </label>
              ))}
            </div>
            {createForm.roles.includes('TURF_OWNER') && (
              <p className="mt-2 text-xs text-amber-400/90">An (unapproved, inactive) turf-owner profile will be created for the approval queue.</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
            <input type="checkbox" checked={createForm.isActive} onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })} className="h-4 w-4 accent-emerald-500" />
            Activate immediately
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => { setShowCreate(false); setCreateForm(emptyCreateForm); }} className="btn-secondary">Cancel</button>
          <button onClick={submitCreate} disabled={creating} className="btn-primary">{creating ? 'Creating…' : 'Create User'}</button>
        </div>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`Delete User: ${deleteTarget?.fullName || ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Soft-deletes {deleteTarget?.email}. Blocked for owners and users with active bookings — deactivate those instead.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
            <button onClick={confirmDeleteUser} disabled={userBusy} className="btn-danger">{userBusy ? 'Deleting…' : 'Delete User'}</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!resetTarget} onClose={() => { setResetTarget(null); setNewPassword(''); }} title={`Reset Password: ${resetTarget?.fullName || ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Sets a new password and signs the user out everywhere.</p>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="input-field" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setResetTarget(null); setNewPassword(''); }} className="btn-secondary">Cancel</button>
            <button onClick={confirmResetPassword} disabled={userBusy} className="btn-primary">{userBusy ? 'Resetting…' : 'Reset Password'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
