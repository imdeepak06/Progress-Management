// ============================================================
// UpdatesPage
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

/* ── small upload modal ──────────────────────────────────── */
function UploadPhotosModal({ update, onClose, onDone }) {
  const [files, setFiles]       = useState([]);
  const [previews, setPreviews] = useState([]);
  const [saving, setSaving]     = useState(false);

  const onDrop = useCallback((accepted) => {
    setFiles(prev => [...prev, ...accepted]);
    setPreviews(prev => [...prev, ...accepted.map(f => URL.createObjectURL(f))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 10,
  });

  const removeFile = (i) => {
    setFiles(f => f.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleUpload = async () => {
    if (!files.length) return toast.error('Select at least one photo');
    setSaving(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('photos', f));
      await api.post(`/updates/${update._id}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Photos uploaded');
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="card-header flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Upload Photos</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[260px]">{update.title}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* existing photos */}
          {update.photos?.length > 0 && (
            <div>
              <p className="label mb-2">Existing Photos ({update.photos.length})</p>
              <div className="grid grid-cols-4 gap-2">
                {update.photos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                    <img src={p.url} alt="" className="w-full h-16 object-cover rounded-lg border border-surface-400 hover:border-brand-500 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* dropzone */}
          <div>
            <p className="label mb-2">Add New Photos</p>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-brand-500 bg-brand-500/10' : 'border-surface-400 hover:border-brand-500/50 hover:bg-surface-200/40'}`}>
              <input {...getInputProps()} />
              <svg className="w-8 h-8 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-400">
                {isDragActive ? 'Drop images here' : 'Drag & drop or click to select images'}
              </p>
              <p className="text-xs text-slate-600 mt-1">Max 10 images</p>
            </div>
          </div>

          {/* new previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="w-full h-16 object-cover rounded-lg border border-surface-400" />
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
            <button onClick={handleUpload} disabled={saving || !files.length}
              className="btn-primary flex-1 text-sm py-2 disabled:opacity-50">
              {saving ? 'Uploading…' : `Upload ${files.length > 0 ? `(${files.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export function UpdatesPage() {
  const { user } = useAuth();
  const [updates,      setUpdates]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filters,      setFilters]      = useState({ type: '', status: '' });
  const [selected,     setSelected]     = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null); // update being uploaded to

  const isCompany = user?.role === 'company';
  const canUpload = user?.role === 'company' || user?.role === 'admin';

  useEffect(() => { load(); }, [filters]);

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.type)   p.append('type',   filters.type);
      if (filters.status) p.append('status', filters.status);
      const { data } = await api.get(`/updates?${p}`);
      setUpdates(data);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  const handleUploadDone = () => {
    setUploadTarget(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Updates</h1>
          <p className="text-slate-500 text-sm mt-0.5">{updates.length} records</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['','camera','wifi','power'].map(t => (
            <button key={t} onClick={() => setFilters(f => ({ ...f, type: t }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${filters.type === t ? 'bg-brand-500 text-white' : 'bg-surface-300 text-slate-500 hover:text-slate-200'}`}>
              {t || 'All Types'}
            </button>
          ))}
          {['','pending','verified','rejected'].map(s => (
            <button key={s} onClick={() => setFilters(f => ({ ...f, status: s }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${filters.status === s ? 'bg-brand-500 text-white' : 'bg-surface-300 text-slate-500 hover:text-slate-200'}`}>
              {s || 'All Status'}
            </button>
          ))}
          {user?.role === 'admin' && (
            <Link to="/dashboard/updates/submit" className="btn-primary text-xs py-1.5">+ Submit</Link>
          )}
        </div>
      </div>

      {loading
        ? <div className="flex justify-center h-48 items-center"><div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-surface-300">
                    {['Title','Location','Type','Status','Date','By',''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {updates.length === 0
                    ? <tr><td colSpan={7} className="text-center py-12 text-slate-600">No updates</td></tr>
                    : updates.map(u => (
                      <tr key={u._id} className="border-b border-surface-300/40 hover:bg-surface-200/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-slate-200 truncate max-w-[180px]">{u.title}</p>
                          <p className="text-xs text-slate-600 truncate max-w-[180px]">{u.description}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          <p>{u.location?.name}</p><p className="text-slate-600">{u.location?.thana}</p>
                        </td>
                        <td className="px-4 py-3"><span className={`badge-${u.type}`}>{u.type}</span></td>
                        <td className="px-4 py-3"><span className={`badge-${u.status}`}>{u.status}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(u.installationDate), 'dd MMM yy')}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{u.submittedBy?.name}</td>
                        <td className="px-4 py-3 flex items-center gap-3">
                          <button onClick={() => setSelected(u)} className="text-xs text-brand-400 hover:text-brand-300">View</button>
                          {/* Company can upload photos to wifi & camera updates */}
                          {canUpload && ['wifi','camera','power'].includes(u.type) && (
                            <button
                              onClick={() => setUploadTarget(u)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Photos
                            </button>
                          )}
                          {u.status === 'rejected' && u.submittedBy?._id === user?._id && (
                            <Link to={`/dashboard/updates/submit/${u._id}`} className="text-xs text-amber-400 hover:text-amber-300">Fix</Link>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* View detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="btn-ghost p-1 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <span className={`badge-${selected.status}`}>{selected.status}</span>
                <span className={`badge-${selected.type}`}>{selected.type}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="label">Location</p><p className="text-slate-300">{selected.location?.name}</p></div>
                <div><p className="label">Thana</p><p className="text-slate-300">{selected.location?.thana}</p></div>
                <div><p className="label">By</p><p className="text-slate-300">{selected.submittedBy?.name}</p></div>
                <div><p className="label">Date</p><p className="text-slate-300">{format(new Date(selected.installationDate), 'dd MMM yyyy')}</p></div>
              </div>
              <div><p className="label">Description</p><p className="text-sm text-slate-400">{selected.description}</p></div>
              {selected.photos?.length > 0 && (
                <div>
                  <p className="label mb-2">Photos ({selected.photos.length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.photos.map((p, i) => (
                      <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                        <img src={p.url} alt="" className="w-full h-20 object-cover rounded-xl border border-surface-400 hover:border-brand-500 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {selected.status === 'rejected' && selected.rejectionReason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-400 mb-1">Rejection Reason</p>
                  <p className="text-xs text-red-300">{selected.rejectionReason}</p>
                </div>
              )}
              {/* Company upload shortcut from detail modal */}
              {canUpload && ['wifi','camera','power'].includes(selected.type) && (
                <button
                  onClick={() => { setSelected(null); setUploadTarget(selected); }}
                  className="btn-primary w-full text-sm py-2 mt-1 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Photos
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload photos modal */}
      {uploadTarget && (
        <UploadPhotosModal
          update={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onDone={handleUploadDone}
        />
      )}
    </div>
  );
}

export default UpdatesPage;