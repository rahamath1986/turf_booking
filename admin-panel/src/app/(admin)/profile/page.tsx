'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Profile = Record<string, any>;

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [changing, setChanging] = useState(false);

  async function load() {
    try {
      const { data: res } = await api.get('/users/profile');
      const p = unwrap<Profile>(res);
      setProfile(p);
      setFullName(String(p.fullName || ''));
      setPhone(String(p.phone || ''));
      setAvatarUrl(String(p.avatarUrl || ''));
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!fullName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, string> = { fullName: fullName.trim() };
      if (phone.trim()) payload.phone = phone.trim();
      payload.avatarUrl = avatarUrl.trim() || '';
      await api.patch('/users/profile', payload);
      toast.success('Profile updated');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!pw.currentPassword || !pw.newPassword) { toast.error('Both password fields are required'); return; }
    setChanging(true);
    try {
      await api.post('/auth/change-password', pw);
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Password change failed');
    } finally {
      setChanging(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Account details and security</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {avatarUrl || profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl || profile?.avatarUrl} alt="Avatar" className="h-14 w-14 rounded-full border border-gray-700 object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-xl font-bold text-white">
                  {fullName.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
              <div>
                <p className="font-medium text-white">{String(profile?.email || '')}</p>
                <div className="mt-1 flex gap-1">
                  {(profile?.roles?.map((r: { role?: { name?: string } } | string) => (typeof r === 'string' ? r : r.role?.name || '')) || []).map((r: string) => (
                    <Badge key={r} label={r} />
                  ))}
                </div>
              </div>
            </div>
            {profile?.isActive !== undefined && <Badge label={profile.isActive ? 'active' : 'inactive'} />}
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Avatar Image URL</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="input-field" />
          </div>
          <button onClick={save} disabled={saving} className="btn-primary text-xs">{saving ? 'Saving…' : 'Save Profile'}</button>
        </div>

        <div className="card space-y-4">
          <p className="font-medium text-white">Change Password</p>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Current Password</label>
            <input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">New Password</label>
            <input type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} className="input-field" />
          </div>
          <button onClick={changePassword} disabled={changing} className="btn-primary text-xs">{changing ? 'Changing…' : 'Change Password'}</button>
        </div>
      </div>
    </div>
  );
}
