import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Camera,
  Wifi,
  Zap,
  HelpCircle,
  MapPin,
  ChevronLeft,
  AlertTriangle,
  Send,
} from 'lucide-react';

const CATEGORIES = [
  { value: 'camera',       label: 'Camera',       Icon: Camera,       color: 'cyan',   desc: 'CCTV / camera not working or missing' },
  { value: 'wifi',         label: 'WiFi / Network',Icon: Wifi,         color: 'violet', desc: 'Internet connectivity or network issues' },
  { value: 'power_supply', label: 'Power Supply',  Icon: Zap,          color: 'orange', desc: 'Power failure, UPS, electrical issues' },
  { value: 'other',        label: 'Other',         Icon: HelpCircle,   color: 'slate',  desc: 'Any other issue at the location' },
];

const PRIORITIES = [
  { value: 'low',      label: 'Low',      color: 'emerald', desc: 'Non-urgent, can wait' },
  { value: 'medium',   label: 'Medium',   color: 'amber',   desc: 'Needs attention soon' },
  { value: 'high',     label: 'High',     color: 'orange',  desc: 'Urgent, affects operations' },
  { value: 'critical', label: 'Critical', color: 'red',     desc: 'Site is completely down' },
];

export default function RaiseQueryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillLocation = searchParams.get('locationId');

  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    locationId:  prefillLocation || '',
    category:    'camera',
    priority:    'medium',
    title:       '',
    description: '',
  });

  useEffect(() => {
    api.get('/locations')
      .then(({ data }) => setLocations(data))
      .catch(() => toast.error('Failed to load locations'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.locationId) return toast.error('Select a location');
    if (!form.title.trim()) return toast.error('Enter a title for the query');
    setSaving(true);
    try {
      await api.post('/queries', {
        locationId:  form.locationId,
        category:    form.category,
        priority:    form.priority,
        title:       form.title.trim(),
        description: form.description.trim(),
      });
      toast.success('Query raised successfully! Company has been notified.');
      navigate('/dashboard/queries');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to raise query');
    } finally {
      setSaving(false);
    }
  };

  const selectedLocation = locations.find(l => l._id === form.locationId);

  if (loading) return (
    <div className="flex justify-center h-64 items-center">
      <div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary self-start flex-shrink-0">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Raise a Query</h1>
          <p className="text-slate-500 text-sm mt-0.5">Report an issue at your location for after-sale service</p>
        </div>
      </div>

      {/* Notice banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-300">
          Once submitted, this query will be sent to the company team via WhatsApp and in-app notifications.
          A query admin will be assigned to resolve it at your location.
        </p>
      </div>

      {/* Location */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-400" /> Location
        </h2>
        <select
          value={form.locationId}
          onChange={e => set('locationId', e.target.value)}
          className="input-field w-full"
        >
          <option value="">— Select your location —</option>
          {locations.map(l => (
            <option key={l._id} value={l._id}>{l.name} — {l.thana}</option>
          ))}
        </select>
        {selectedLocation && (
          <p className="text-xs text-slate-500">
            {selectedLocation.thana} · {selectedLocation.district}
          </p>
        )}
      </div>

      {/* Category */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Issue Category</h2>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(cat => {
            const active = form.category === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => set('category', cat.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? `border-${cat.color}-500/60 bg-${cat.color}-500/10`
                    : 'border-surface-300 hover:border-surface-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <cat.Icon className={`w-4 h-4 text-${cat.color}-400`} />
                  <span className={`text-sm font-medium ${active ? `text-${cat.color}-300` : 'text-slate-300'}`}>
                    {cat.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">{cat.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority */}
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Priority</h2>
        <div className="grid grid-cols-2 gap-2">
          {PRIORITIES.map(p => {
            const active = form.priority === p.value;
            return (
              <button
                key={p.value}
                onClick={() => set('priority', p.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active
                    ? `border-${p.color}-500/60 bg-${p.color}-500/10`
                    : 'border-surface-300 hover:border-surface-400'
                }`}
              >
                <span className={`text-sm font-semibold ${active ? `text-${p.color}-400` : 'text-slate-400'}`}>
                  {p.label}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Title & Description */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Query Details</h2>
        <div>
          <label className="label-sm mb-1.5">Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Camera #3 not recording since last night"
            maxLength={120}
            className="input-field w-full"
          />
          <p className="text-[11px] text-slate-500 mt-1">{form.title.length}/120 characters</p>
        </div>
        <div>
          <label className="label-sm mb-1.5">Description <span className="text-slate-500">(optional)</span></label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={4}
            placeholder="Provide additional context — what happened, since when, what was tried, etc."
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !form.locationId || !form.title.trim()}
        className="btn-primary w-full justify-center py-3"
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {saving ? 'Submitting…' : 'Submit Query'}
      </button>
    </div>
  );
}