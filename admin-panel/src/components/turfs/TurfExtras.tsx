'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayRow { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }

// ---------------------------------------------------------------- VideoAdder ---

export function VideoAdder({
  onAdd,
  onUpload,
}: {
  onAdd: (payload: Record<string, string>) => Promise<void>;
  onUpload?: (file: File) => Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function submit() {
    if (!url.trim()) { toast.error('Enter a video URL'); return; }
    setBusy(true);
    try {
      const payload: Record<string, string> = { videoUrl: url.trim() };
      if (title.trim()) payload.title = title.trim();
      await onAdd(payload);
      toast.success('Video added');
      setUrl('');
      setTitle('');
    } catch {
      toast.error('Failed to add video');
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || !onUpload) return;
    setUploading(true);
    try {
      await onUpload(files[0]);
      toast.success('Video uploaded');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Video upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Video URL https://… (mp4)" className="input-field flex-1" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input-field w-40" />
      <button onClick={submit} disabled={busy} className="btn-secondary whitespace-nowrap text-xs">
        {busy ? 'Adding…' : 'Add URL'}
      </button>
      {onUpload && (
        <label className="cursor-pointer whitespace-nowrap rounded-lg border border-dashed border-gray-700 px-3 py-2 text-center text-xs text-gray-300 hover:border-emerald-500 hover:text-white">
          {uploading ? 'Uploading…' : '+ Upload mp4'}
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            disabled={uploading}
            onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
          />
        </label>
      )}
    </div>
  );
}

// ------------------------------------------------------------ TurfSchedules ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Avail = Record<string, any>;

export function TurfSchedules({ turfId }: { turfId: string }) {
  const [info, setInfo] = useState<Avail | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DayRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [block, setBlock] = useState({ date: '', startTime: '', endTime: '', reason: '' });

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/admin/turfs/${turfId}/availability`);
      const full = unwrap<Avail>(res);
      setInfo(full);
      const hours = full.operatingHours ?? full.hours ?? [];
      setDays(
        (hours.length > 0 ? hours : Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, openTime: '06:00', closeTime: '22:00', isClosed: false })))
          .map((h: DayRow) => ({ dayOfWeek: h.dayOfWeek, openTime: h.openTime || '06:00', closeTime: h.closeTime || '22:00', isClosed: !!h.isClosed }))
          .sort((a: DayRow, b: DayRow) => a.dayOfWeek - b.dayOfWeek),
      );
    } catch {
      toast.error('Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [turfId]);

  async function saveHours() {
    setSaving(true);
    try {
      await api.put(`/admin/turfs/${turfId}/availability`, {
        operatingHours: days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          openTime: d.openTime,
          closeTime: d.closeTime,
          isClosed: d.isClosed,
        })),
      });
      toast.success('Hours saved');
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function blockSlot() {
    if (!block.date || !block.startTime || !block.endTime) { toast.error('Date and times required'); return; }
    try {
      await api.post(`/admin/turfs/${turfId}/blocks`, {
        blockDate: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        reason: block.reason.trim() || 'Maintenance',
      });
      toast.success('Slot blocked');
      setBlock({ date: '', startTime: '', endTime: '', reason: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Block failed');
    }
  }

  async function unblock(slotId: string) {
    try {
      await api.delete(`/admin/turfs/${turfId}/blocks/${slotId}`);
      toast.success('Slot unblocked');
      load();
    } catch {
      toast.error('Unblock failed');
    }
  }

  if (loading) return <LoadingSpinner />;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocked: any[] = info?.blockedSlots ?? info?.blocks ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pricing: any[] = info?.pricingRules ?? info?.pricing ?? [];

  return (
    <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-800/30 p-4">
      <p className="font-medium text-white">Schedules, Blocks & Pricing</p>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-400">Operating Hours</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {days.map((d, i) => (
            <div key={d.dayOfWeek} className="flex items-center gap-1.5 text-xs">
              <span className="w-9 font-medium text-gray-300">{DAY_NAMES[d.dayOfWeek]}</span>
              <input type="time" value={d.openTime} disabled={d.isClosed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, openTime: e.target.value } : x)))} className="input-field py-1" />
              <input type="time" value={d.closeTime} disabled={d.isClosed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, closeTime: e.target.value } : x)))} className="input-field py-1" />
              <label className="flex items-center gap-1 text-gray-500">
                <input type="checkbox" checked={d.isClosed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, isClosed: e.target.checked } : x)))} className="h-3.5 w-3.5 accent-rose-500" />
                X
              </label>
            </div>
          ))}
        </div>
        <button onClick={saveHours} disabled={saving} className="btn-secondary mt-2 text-xs">{saving ? 'Saving…' : 'Save Hours'}</button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-400">Block Slot</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input type="date" value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} className="input-field py-1.5 text-xs" />
          <input type="time" value={block.startTime} onChange={(e) => setBlock({ ...block, startTime: e.target.value })} className="input-field py-1.5 text-xs" />
          <input type="time" value={block.endTime} onChange={(e) => setBlock({ ...block, endTime: e.target.value })} className="input-field py-1.5 text-xs" />
          <input value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} placeholder="Reason" className="input-field py-1.5 text-xs" />
        </div>
        <button onClick={blockSlot} className="btn-danger mt-2 text-xs">Block</button>
        {blocked.length > 0 && (
          <div className="mt-2 space-y-1">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded bg-gray-900/60 px-2 py-1.5 text-xs">
                <span className="text-gray-300">{String(b.blockDate || b.date || '').split('T')[0]} • {b.startTime}–{b.endTime} • {b.reason || ''}</span>
                <button onClick={() => unblock(b.id)} className="text-emerald-400 hover:text-emerald-300">Unblock</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-400">Pricing Rules ({pricing.length})</p>
        {pricing.length === 0 ? (
          <p className="text-xs text-gray-500">Default pricing applies. Custom rules are set at creation.</p>
        ) : (
          <div className="space-y-1">
            {pricing.map((p, i) => (
              <div key={p.id || i} className="flex items-center justify-between rounded bg-gray-900/60 px-2 py-1.5 text-xs">
                <span className="text-white">{p.ruleName || 'Rule'}</span>
                <div className="flex items-center gap-2">
                  <Badge label={p.dayType || 'ALL'} />
                  <span className="text-gray-400">{p.startTime}–{p.endTime}</span>
                  <span className="font-medium text-emerald-400">₹{Number(p.hourlyPrice ?? 0).toLocaleString()}/hr</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
