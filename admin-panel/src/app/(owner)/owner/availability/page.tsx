'use client';

import { useEffect, useState } from 'react';
import api, { unwrap } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Turf = Record<string, any>;
interface DayRow { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function OwnerAvailabilityPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [turfs, setTurfs] = useState<any[]>([]);
  const [turfId, setTurfId] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [info, setInfo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<DayRow[]>([]);
  const [slotDuration, setSlotDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [block, setBlock] = useState({ date: new Date().toISOString().split('T')[0], startTime: '', endTime: '', reason: '' });
  const [blocking, setBlocking] = useState(false);
  const [rule, setRule] = useState({ ruleName: '', dayType: 'PEAK', startTime: '', endTime: '', hourlyPrice: '', dayOfWeek: '' });
  const [ruleBusy, setRuleBusy] = useState(false);

  useEffect(() => {
    async function loadTurfs() {
      try {
        const { data: res } = await api.get('/owner/turfs', { params: { page: 1, limit: 50 } });
        const list = unwrap<Turf[] | { items: Turf[] }>(res);
        const arr = Array.isArray(list) ? list : (list.items ?? []);
        setTurfs(arr);
        if (arr.length > 0) setTurfId(arr[0].id);
      } catch {
        toast.error('Failed to load turfs');
      }
    }
    loadTurfs();
  }, []);

  useEffect(() => {
    if (!turfId) return;
    async function load() {
      setLoading(true);
      try {
        const { data: res } = await api.get(`/owner/turfs/${turfId}/availability`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const full = unwrap<any>(res);
        setInfo(full);
        const hours = full.operatingHours ?? full.hours ?? [];
        if (hours.length > 0) {
          setDays(hours.map((h: DayRow) => ({
            dayOfWeek: h.dayOfWeek,
            openTime: h.openTime || '06:00',
            closeTime: h.closeTime || '22:00',
            isClosed: !!h.isClosed,
          })).sort((a: DayRow, b: DayRow) => a.dayOfWeek - b.dayOfWeek));
        } else {
          setDays(Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, openTime: '06:00', closeTime: '22:00', isClosed: false })));
        }
        setSlotDuration(full.slotDurationMinutes ?? 60);
      } catch {
        toast.error('Failed to load availability');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [turfId]);

  async function saveHours() {
    if (!turfId) return;
    setSaving(true);
    try {
      const payload = {
        slotDurationMinutes: Number(slotDuration),
        operatingHours: days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          openTime: d.openTime,
          closeTime: d.closeTime,
          isClosed: d.isClosed,
          slotDurationMinutes: Number(slotDuration),
        })),
      };
      try {
        await api.put(`/owner/turfs/${turfId}/availability`, payload);
      } catch {
        await api.post(`/owner/turfs/${turfId}/availability`, payload);
      }
      toast.success('Operating hours saved');
    } catch {
      toast.error('Failed to save hours');
    } finally {
      setSaving(false);
    }
  }

  async function blockSlot() {
    if (!turfId || !block.date || !block.startTime || !block.endTime) {
      toast.error('Date, start and end are required');
      return;
    }
    setBlocking(true);
    try {
      await api.post(`/owner/turfs/${turfId}/block-slot`, {
        blockDate: block.date,
        startTime: block.startTime,
        endTime: block.endTime,
        reason: block.reason.trim() || 'Maintenance',
      });
      toast.success('Slot blocked');
      setBlock({ ...block, startTime: '', endTime: '', reason: '' });
      const { data: res } = await api.get(`/owner/turfs/${turfId}/availability`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInfo(unwrap<any>(res));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Block failed');
    } finally {
      setBlocking(false);
    }
  }

  async function unblock(slotId: string) {
    if (!turfId) return;
    try {
      await api.delete(`/owner/turfs/${turfId}/block-slot/${slotId}`);
      toast.success('Slot unblocked');
      const { data: res } = await api.get(`/owner/turfs/${turfId}/availability`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInfo(unwrap<any>(res));
    } catch {
      toast.error('Unblock failed');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blockedSlots: any[] = info?.blockedSlots ?? info?.blocks ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pricing: any[] = info?.pricingRules ?? info?.pricing ?? [];

  async function persistRules(next: typeof pricing) {
    if (!turfId) return;
    setRuleBusy(true);
    try {
      await api.put(`/owner/turfs/${turfId}/availability`, {
        operatingHours: days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          openTime: d.openTime,
          closeTime: d.closeTime,
          isClosed: d.isClosed,
          slotDurationMinutes: slotDuration,
        })),
        pricingRules: next.map((p) => ({
          ruleName: p.ruleName,
          dayType: p.dayType || 'ALL',
          ...(p.dayOfWeek != null && p.dayOfWeek !== '' ? { dayOfWeek: Number(p.dayOfWeek) } : {}),
          ...(p.specificDate ? { specificDate: p.specificDate } : {}),
          startTime: p.startTime,
          endTime: p.endTime,
          hourlyPrice: Number(p.hourlyPrice),
          ...(p.sportId ? { sportId: p.sportId } : {}),
        })),
      });
      toast.success('Pricing updated');
      const { data: res } = await api.get(`/owner/turfs/${turfId}/availability`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInfo(unwrap<any>(res));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : (msg || 'Pricing update failed'));
    } finally {
      setRuleBusy(false);
    }
  }

  async function addRule() {
    if (!rule.ruleName.trim() || !rule.startTime || !rule.endTime || rule.hourlyPrice === '') {
      toast.error('Name, times and price are required');
      return;
    }
    await persistRules([...pricing, {
      ruleName: rule.ruleName.trim(),
      dayType: rule.dayType,
      startTime: rule.startTime,
      endTime: rule.endTime,
      hourlyPrice: Number(rule.hourlyPrice),
      ...(rule.dayOfWeek !== '' ? { dayOfWeek: Number(rule.dayOfWeek) } : {}),
    }]);
    setRule({ ruleName: '', dayType: 'PEAK', startTime: '', endTime: '', hourlyPrice: '', dayOfWeek: '' });
  }

  async function deleteRule(index: number) {
    const next = pricing.filter((_, i) => i !== index);
    if (next.length === 0) {
      toast.error('At least one rule must remain — edit it instead');
      return;
    }
    await persistRules(next);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Availability</h1>
          <p className="mt-1 text-sm text-gray-500">Hours, blocks and pricing per venue</p>
        </div>
        <select value={turfId} onChange={(e) => setTurfId(e.target.value)} className="select-field w-64">
          {turfs.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium text-white">Operating Hours</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                Slot (min)
                <input type="number" min={15} max={720} value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} className="input-field w-20 py-1" />
              </div>
            </div>
            <div className="space-y-2">
              {days.map((d, i) => (
                <div key={d.dayOfWeek} className="flex items-center gap-2 text-sm">
                  <span className="w-10 font-medium text-gray-300">{DAY_NAMES[d.dayOfWeek]}</span>
                  <input type="time" value={d.openTime} disabled={d.isClosed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, openTime: e.target.value } : x)))} className="input-field py-1.5" />
                  <input type="time" value={d.closeTime} disabled={d.isClosed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, closeTime: e.target.value } : x)))} className="input-field py-1.5" />
                  <label className="flex items-center gap-1.5 text-xs text-gray-400">
                    <input type="checkbox" checked={d.isClosed} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, isClosed: e.target.checked } : x)))} className="h-3.5 w-3.5 accent-rose-500" />
                    Closed
                  </label>
                </div>
              ))}
            </div>
            <button onClick={saveHours} disabled={saving} className="btn-primary mt-4 text-xs">{saving ? 'Saving…' : 'Save Hours'}</button>
          </div>

          <div className="space-y-5">
            <div className="card">
              <p className="mb-4 font-medium text-white">Block a Slot</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} className="input-field" />
                <input value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} placeholder="Reason (Maintenance)" className="input-field" />
                <input type="time" value={block.startTime} onChange={(e) => setBlock({ ...block, startTime: e.target.value })} className="input-field" />
                <input type="time" value={block.endTime} onChange={(e) => setBlock({ ...block, endTime: e.target.value })} className="input-field" />
              </div>
              <button onClick={blockSlot} disabled={blocking} className="btn-danger mt-3 text-xs">{blocking ? 'Blocking…' : 'Block Slot'}</button>

              {blockedSlots.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {blockedSlots.map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
                      <span className="text-gray-300">{String(b.blockDate || b.date || '').split('T')[0]} • {b.startTime}–{b.endTime} • {b.reason || 'Blocked'}</span>
                      <button onClick={() => unblock(b.id)} className="text-emerald-400 hover:text-emerald-300">Unblock</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <p className="mb-3 font-medium text-white">Pricing Rules</p>
              {pricing.length === 0 ? (
                <p className="text-sm text-gray-500">Default pricing applies. Add a rule below for peak/weekend rates.</p>
              ) : (
                <div className="mb-3 space-y-1.5">
                  {pricing.map((p, i) => (
                    <div key={p.id || i} className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2 text-xs">
                      <span className="text-white">{p.ruleName || p.dayType || 'Rule'}</span>
                      <div className="flex items-center gap-2">
                        <Badge label={p.dayType || 'ALL'} />
                        <span className="text-gray-400">{p.startTime}–{p.endTime}</span>
                        <span className="font-medium text-emerald-400">₹{Number(p.hourlyPrice ?? p.price ?? 0).toLocaleString()}/hr</span>
                        <button onClick={() => deleteRule(i)} title="Delete rule" className="rounded p-0.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input value={rule.ruleName} onChange={(e) => setRule({ ...rule, ruleName: e.target.value })} placeholder="Rule name *" className="input-field py-1.5 text-xs sm:col-span-1 col-span-2" />
                <select value={rule.dayType} onChange={(e) => setRule({ ...rule, dayType: e.target.value })} className="select-field py-1.5 text-xs">
                  <option value="ALL">All days</option>
                  <option value="WEEKDAY">Weekdays</option>
                  <option value="WEEKEND">Weekend</option>
                  <option value="PEAK">Peak</option>
                  <option value="OFF_PEAK">Off-peak</option>
                  <option value="HOLIDAY">Holiday</option>
                  <option value="SPECIAL">Special</option>
                </select>
                <input type="time" value={rule.startTime} onChange={(e) => setRule({ ...rule, startTime: e.target.value })} className="input-field py-1.5 text-xs" />
                <input type="time" value={rule.endTime} onChange={(e) => setRule({ ...rule, endTime: e.target.value })} className="input-field py-1.5 text-xs" />
                <input type="number" min={0} value={rule.hourlyPrice} onChange={(e) => setRule({ ...rule, hourlyPrice: e.target.value })} placeholder="₹/hr *" className="input-field py-1.5 text-xs" />
                <select value={rule.dayOfWeek} onChange={(e) => setRule({ ...rule, dayOfWeek: e.target.value })} className="select-field py-1.5 text-xs">
                  <option value="">Any day</option>
                  {DAY_NAMES.map((d, i) => (<option key={d} value={i}>{d}</option>))}
                </select>
              </div>
              <button onClick={addRule} disabled={ruleBusy} className="btn-secondary mt-2 text-xs">{ruleBusy ? 'Saving…' : '+ Add Rule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
