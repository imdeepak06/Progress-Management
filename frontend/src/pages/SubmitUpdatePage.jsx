import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Camera,
  Wifi,
  Zap,
  MapPin,
  ClipboardList,
  Image,
  Wrench,
  AlertCircle,
  Upload,
  Minus,
  Plus,
} from 'lucide-react';

const TYPE_META = {
  camera: { label: 'Camera',       Icon: Camera },
  wifi:   { label: 'WiFi',         Icon: Wifi   },
  power:  { label: 'Power Supply', Icon: Zap    },
};

export default function SubmitUpdatePage() {
  const { user }     = useAuth();
  const navigate     = useNavigate();
  const { updateId } = useParams();
  const [searchParams] = useSearchParams();
  const prefillLocation = searchParams.get('locationId');
  const prefillType     = searchParams.get('type');

  const [locations, setLocations]   = useState([]);
  const [existing,  setExisting]    = useState(null);
  const [files,     setFiles]       = useState([]);
  const [previews,  setPreviews]    = useState([]);
  const [saving,    setSaving]      = useState(false);
  const [loading,   setLoading]     = useState(true);
  // Stats for selected location — used to enforce max counts
  const [locStats, setLocStats] = useState(null);

  const [form, setForm] = useState({
    locationId: prefillLocation || '',
    type: ['camera', 'wifi', 'power'].includes(prefillType) ? prefillType : 'camera',
    installedCount: 1,
    title: '', description: '',
    latitude: '', longitude: '',
    installationDate: format(new Date(), 'yyyy-MM-dd'),
  });

  // Fetch stats whenever location changes
  const fetchLocStats = async (locId) => {
    if (!locId) { setLocStats(null); return; }
    try {
      const { data } = await api.get(`/locations/${locId}`);
      setLocStats(data.stats || null);
    } catch {
      setLocStats(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: locs } = await api.get('/locations');
        setLocations(locs);

        if (updateId) {
          const { data: upd } = await api.get(`/updates/${updateId}`);
          setExisting(upd);
          const locId = upd.location?._id || '';
          setForm({
            locationId:       locId,
            type:             upd.type || 'camera',
            installedCount:   upd.installedCount || 1,
            title:            upd.title || '',
            description:      upd.description || '',
            latitude:         upd.latitude  || '',
            longitude:        upd.longitude || '',
            installationDate: upd.installationDate ? format(new Date(upd.installationDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
          });
          if (upd.photos?.length) setPreviews(upd.photos.map(p => ({ url: p.url, existing: true })));
          await fetchLocStats(locId);
        } else if (prefillLocation) {
          const loc = locs.find(l => l._id === prefillLocation);
          if (loc) setForm(f => ({ ...f, latitude: loc.latitude || '', longitude: loc.longitude || '' }));
          await fetchLocStats(prefillLocation);
        }
      } catch { toast.error('Failed to load data'); }
      finally { setLoading(false); }
    };
    init();
  }, [updateId, prefillLocation]);

  const onDrop = useCallback((accepted) => {
    const toAdd = accepted.slice(0, 10 - files.length);
    setFiles(p => [...p, ...toAdd]);
    setPreviews(p => [...p, ...toAdd.map(f => ({ url: URL.createObjectURL(f), existing: false }))]);
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg','.jpeg','.png','.webp'] }, maxSize: 10 * 1024 * 1024,
  });

  const removeFile = (i) => {
    setFiles(p => p.filter((_, j) => j !== i));
    setPreviews(p => p.filter((_, j) => j !== i));
  };

  const handleLocationChange = async (locId) => {
    const loc = locations.find(l => l._id === locId);
    setForm(f => ({ ...f, locationId: locId, latitude: loc?.latitude || f.latitude, longitude: loc?.longitude || f.longitude }));
    await fetchLocStats(locId);
  };

  // Compute max allowed for current type based on location stats
  const getMaxForType = (type) => {
    if (!locStats) return Infinity;
    const planned = locStats.planned || {};
    const typeData = locStats[type] || {};
    const totalPlanned = (type === 'camera' ? planned.camera : type === 'wifi' ? planned.wifi : planned.power) || 0;
    // Already verified count
    const alreadyVerified = typeData.verified || 0;
    // Already pending (submitted but not yet verified) — add pending too so admin can't over-submit
    const pending = typeData.pending || 0;
    const remaining = Math.max(0, totalPlanned - alreadyVerified - pending);
    return remaining;
  };

  const maxCount = getMaxForType(form.type);

  const clampCount = (val, type) => {
    const max = getMaxForType(type);
    return Math.min(Math.max(1, val), max === 0 ? 1 : max);
  };

  const isPower = form.type === 'power';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.locationId) return toast.error('Select a location');
    if (!isPower) {
      if (!form.installedCount || form.installedCount < 1) return toast.error('Enter how many units were installed');
      if (maxCount !== Infinity && form.installedCount > maxCount) {
        return toast.error(`Cannot submit more than ${maxCount} ${TYPE_META[form.type].label}(s). Remaining capacity: ${maxCount}`);
      }
    }
    if (isPower && maxCount === 0) {
      return toast.error('Power supply limit already reached for this location');
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('locationId', form.locationId);
      fd.append('type', form.type);
      if (!isPower) {
        fd.append('installedCount', String(form.installedCount));
        if (form.title) fd.append('title', form.title);
        if (form.description) fd.append('description', form.description);
        if (form.installationDate) fd.append('installationDate', form.installationDate);
      } else {
        if (form.description) fd.append('description', form.description);
      }
      if (form.latitude) fd.append('latitude', form.latitude);
      if (form.longitude) fd.append('longitude', form.longitude);
      files.forEach(f => fd.append('photos', f));
      const headers = { 'Content-Type': 'multipart/form-data' };

      if (updateId) {
        await api.put(`/updates/${updateId}/resubmit`, fd, { headers });
        toast.success('Resubmitted! Company notified.');
      } else {
        await api.post('/updates', fd, { headers });
        toast.success('Submitted! Company notified.');
      }
      navigate('/dashboard/updates');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  const meta = TYPE_META[form.type];
  const MetaIcon = meta.Icon;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          {updateId ? 'Resubmit Update' : 'Submit Update'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {updateId ? 'Fix issues and resubmit for review' : 'Record installation progress for verification'}
        </p>
      </div>

      {existing?.rejectionReason && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4">
          <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Rejection Reason
          </p>
          <p className="text-sm text-red-300">{existing.rejectionReason}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector */}
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Update Type
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {['camera', 'wifi', 'power'].map(t => {
              const TIcon = TYPE_META[t].Icon;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!!updateId}
                  onClick={() => {
                    const newType = t;
                    const newMax = getMaxForType(newType);
                    setForm(f => ({
                      ...f,
                      type: newType,
                      installedCount: newType === 'power' ? 1 : Math.min(f.installedCount, newMax === 0 ? 1 : newMax),
                    }));
                  }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-all
                    ${form.type === t
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-surface-200 text-slate-400 border-surface-400 hover:text-slate-200'}
                    ${updateId ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <TIcon className="w-5 h-5" />
                  {TYPE_META[t].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Location */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Location
          </h3>
          <div>
            <label className="label">Select Location *</label>
            <select className="select" required value={form.locationId}
              onChange={e => handleLocationChange(e.target.value)} disabled={!!updateId}>
              <option value="">-- Choose location --</option>
              {locations.map(l => (
                <option key={l._id} value={l._id}>{l.name} — {l.thana} ({l.district})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input type="number" step="any" className="input" placeholder="28.6139"
                value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input type="number" step="any" className="input" placeholder="77.2090"
                value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
            </div>
          </div>
        </div>

        {isPower ? (
          /* Power supply — just an optional remark + submit */
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Power Supply
            </h3>
            <p className="text-xs text-slate-500">
              No details required — this just informs that power supply has been connected at this location.
            </p>
            {/* Capacity indicator for power */}
            {locStats && (
              <div className={`text-xs px-3 py-2 rounded-lg border ${
                maxCount === 0
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-surface-200 border-surface-400 text-slate-400'
              }`}>
                {maxCount === 0
                  ? 'Power supply limit already reached for this location'
                  : `Remaining capacity: ${maxCount} power supply`}
              </div>
            )}
            <div>
              <label className="label">Remark (optional)</label>
              <textarea rows={3} className="input resize-none"
                placeholder="e.g. Connected to main line / meter no. ..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        ) : (
          <>
            {/* Count + Details */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Details
              </h3>

              <div>
                <label className="label">How many {meta.label}(s) installed? *</label>
                {/* Capacity info */}
                {locStats && (
                  <p className={`text-xs mb-2 ${maxCount === 0 ? 'text-red-400' : 'text-slate-500'}`}>
                    {maxCount === 0
                      ? `No more ${meta.label}s can be submitted — limit reached`
                      : `Remaining capacity: ${maxCount} ${meta.label}(s)`}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <button type="button"
                    onClick={() => setForm(f => ({ ...f, installedCount: Math.max(1, (parseInt(f.installedCount) || 1) - 1) }))}
                    className="btn-secondary px-3 py-2">
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={maxCount === Infinity ? undefined : maxCount}
                    className="input text-center w-24"
                    value={form.installedCount}
                    onChange={e => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      const clamped = maxCount !== Infinity ? Math.min(val, maxCount) : val;
                      setForm(f => ({ ...f, installedCount: clamped }));
                    }}
                  />
                  <button type="button"
                    onClick={() => {
                      const next = (parseInt(form.installedCount) || 1) + 1;
                      const clamped = maxCount !== Infinity ? Math.min(next, maxCount) : next;
                      if (maxCount !== Infinity && next > maxCount) {
                        toast.error(`Max allowed is ${maxCount} ${meta.label}(s) for this location`);
                        return;
                      }
                      setForm(f => ({ ...f, installedCount: clamped }));
                    }}
                    disabled={maxCount !== Infinity && form.installedCount >= maxCount}
                    className="btn-secondary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-slate-500">
                    This single update counts {form.installedCount} {meta.label.toLowerCase()}(s) toward the total.
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Title</label>
                <input className="input" placeholder={`${meta.label} installation at…`}
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={4} className="input resize-none"
                  placeholder="Describe the installation work done…"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Installation Date</label>
                <input type="date" className="input"
                  value={form.installationDate} onChange={e => setForm(f => ({ ...f, installationDate: e.target.value }))} />
              </div>
            </div>

            {/* Photos */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Image className="w-4 h-4" /> Photos
                </h3>
                <span className="text-[11px] text-slate-600">Max 10 · 10MB each</span>
              </div>
              <div {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${isDragActive ? 'border-brand-500 bg-brand-500/5' : 'border-surface-500 hover:border-surface-600 hover:bg-surface-200/50'}`}>
                <input {...getInputProps()} />
                <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">{isDragActive ? 'Drop here…' : 'Drag & drop or click to browse'}</p>
                <p className="text-xs text-slate-700 mt-1">JPG, PNG, WEBP</p>
              </div>
              {previews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {previews.map((p, i) => (
                    <div key={i} className="relative group">
                      <img src={p.url} alt="" className="w-full h-20 object-cover rounded-xl border border-surface-400" />
                      {!p.existing && (
                        <button type="button" onClick={() => removeFile(i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          ✕
                        </button>
                      )}
                      {p.existing && <div className="absolute bottom-1 left-1 text-[10px] bg-surface-100/80 text-slate-400 rounded px-1">saved</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-3">
            {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</> : updateId ? 'Resubmit' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}