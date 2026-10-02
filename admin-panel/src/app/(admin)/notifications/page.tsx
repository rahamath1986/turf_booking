'use client';

import { useState } from 'react';
import api from '@/lib/api';
import Modal from '@/components/ui/Modal';
import NotificationsInbox from '@/components/notifications/NotificationsInbox';
import toast from 'react-hot-toast';
import { HiOutlineMegaphone } from 'react-icons/hi2';

export default function AdminNotificationsPage() {
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);

  async function broadcast() {
    if (!title.trim() || !body.trim()) { toast.error('Title and message are required'); return; }
    setBusy(true);
    try {
      const payload: Record<string, string> = { title: title.trim(), body: body.trim() };
      if (role) payload.role = role;
      const { data } = await api.post('/admin/notifications/broadcast', payload);
      const count = (data?.data ?? data)?.recipientCount;
      toast.success(`Broadcast sent to ${count ?? 'all'} user(s)`);
      setShowBroadcast(false);
      setTitle('');
      setBody('');
      setRole('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Broadcast failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowBroadcast(true)} className="btn-primary w-fit text-xs">
          <HiOutlineMegaphone className="h-4 w-4" /> Broadcast
        </button>
      </div>
      <NotificationsInbox accent="blue" />

      <Modal isOpen={showBroadcast} onClose={() => setShowBroadcast(false)} title="Broadcast Notification" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Sends an in-app system notification. Target everyone, one role, or leave it global.
          </p>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} placeholder="Weekend offer is live!" className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Message *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Use code WEEKEND20…" className="input-field h-24 resize-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-400">Audience</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="select-field">
              <option value="">All active users</option>
              <option value="CUSTOMER">Customers</option>
              <option value="TURF_OWNER">Turf owners</option>
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Managers</option>
              <option value="ADMIN">Admins</option>
              <option value="SUPER_ADMIN">Super admins</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowBroadcast(false)} className="btn-secondary">Cancel</button>
            <button onClick={broadcast} disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Send Broadcast'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
