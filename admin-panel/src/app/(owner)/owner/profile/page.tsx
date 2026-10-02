'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Profile = Record<string, any>;

export default function OwnerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [changing, setChanging] = useState(false);
  const [biz, setBiz] = useState({
    businessName: '',
    legalName: '',
    panNumber: '',
    gstNumber: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankName: '',
  });
  const [bizStatus, setBizStatus] = useState<{ isVerified?: boolean; isActive?: boolean }>({});
  const [savingBiz, setSavingBiz] = useState(false);

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
    }
    try {
      const { data: bres } = await api.get('/owners/profile');
      const b = unwrap<Profile>(bres);
      setBiz({
        businessName: String(b.businessName || ''),
        legalName: String(b.legalName || ''),
        panNumber: String(b.panNumber || ''),
        gstNumber: String(b.gstNumber || ''),
        bankAccountNumber: String(b.bankAccountNumber || ''),
        bankIfsc: String(b.bankIfsc || ''),
        bankName: String(b.bankName || ''),
      });
      setBizStatus({ isVerified: b.isVerified, isActive: b.isActive });
    } catch {
      // Owner profile may not exist for staff accounts — that is fine.
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

  async function saveBiz() {
    if (!biz.businessName.trim()) { toast.error('Business name is required'); return; }
    setSavingBiz(true);
    try {
      await api.patch('/owners/profile', {
        businessName: biz.businessName.trim(),
        legalName: biz.legalName.trim() || null,
        panNumber: biz.panNumber.trim() || null,
        gstNumber: biz.gstNumber.trim() || null,
        bankAccountNumber: biz.bankAccountNumber.trim() || null,
        bankIfsc: biz.bankIfsc.trim() || null,
        bankName: biz.bankName.trim() || null,
      });
      toast.success('Business profile updated');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Update failed');
    } finally {
      setSavingBiz(false);
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
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Account details and security</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-white">Account</p>
            {profile?.isActive !== undefined && <Badge label={profile.isActive ? 'active' : 'inactive'} />}
          </div>
          <div>
            <p className="mb-1.5 text-sm text-gray-500">Email</p>
            <p className="text-white">{String(profile?.email || '—')}</p>
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
          <div className="flex items-center justify-between">
            <p className="font-medium text-white">Business Profile</p>
            <div className="flex gap-1.5">
              {bizStatus.isVerified !== undefined && <Badge label={bizStatus.isVerified ? 'verified' : 'unverified'} />}
              {bizStatus.isActive !== undefined && <Badge label={bizStatus.isActive ? 'active' : 'inactive'} />}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm text-gray-400">Business Name *</label>
              <input value={biz.businessName} onChange={(e) => setBiz({ ...biz, businessName: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Legal Name</label>
              <input value={biz.legalName} onChange={(e) => setBiz({ ...biz, legalName: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">PAN</label>
              <input value={biz.panNumber} onChange={(e) => setBiz({ ...biz, panNumber: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">GST</label>
              <input value={biz.gstNumber} onChange={(e) => setBiz({ ...biz, gstNumber: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Bank Name</label>
              <input value={biz.bankName} onChange={(e) => setBiz({ ...biz, bankName: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">Account Number</label>
              <input value={biz.bankAccountNumber} onChange={(e) => setBiz({ ...biz, bankAccountNumber: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-gray-400">IFSC</label>
              <input value={biz.bankIfsc} onChange={(e) => setBiz({ ...biz, bankIfsc: e.target.value })} className="input-field" />
            </div>
          </div>
          <button onClick={saveBiz} disabled={savingBiz} className="btn-primary text-xs">{savingBiz ? 'Saving…' : 'Save Business Profile'}</button>
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
