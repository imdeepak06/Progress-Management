import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function ReviewsPage() {
  const [updates,  setUpdates]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [status,   setStatus]   = useState('pending');
  const [modal,    setModal]    = useState(null); // { update, action }
  const [reason,   setReason]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [detail,   setDetail]   = useState(null);

  useEffect(() => { load(); }, [status]);

  const load = async () => {
    setLoading(true);
    try {
      const p = status ? `?status=${status}` : '';
      const { data } = await api.get(`/updates${p}`);
      setUpdates(data);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  const handleReview = async () => {
    if (modal.action === 'reject' && !reason.trim()) return toast.error('Rejection reason required');
    setSaving(true);
    try {
      await api.put(`/updates/${modal.update._id}/review`, {
        action: modal.action,
        rejectionReason: modal.action === 'reject' ? reason : undefined,
      });
      toast.success(modal.action === 'verify' ? '✓ Verified!' : '✗ Rejected');
      setModal(null); setReason(''); setDetail(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const pending = updates.filter(u => u.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Reviews</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {pending > 0 ? <span className="text-amber-400 font-medium">{pending} pending</span> : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {['pending','verified','rejected',''].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${status === s ? 'bg-brand-500 text-white' : 'bg-surface-300 text-slate-500 hover:text-slate-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center h-48 items-center"><div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="space-y-3">
          {updates.length === 0 && <div className="card p-12 text-center text-slate-600">Nothing here</div>}
          {updates.map(u => (
            <div key={u._id} className={`card p-4 transition-all ${u.status === 'pending' ? 'border-amber-500/20' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 badge-${u.type} border-0`}>
                  {u.type === 'camera' ? '📷' : u.type === 'wifi' ? '📡' : '⚡'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-100 text-sm">{u.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{u.location?.name} · {u.location?.thana}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge-${u.status}`}>{u.status}</span>
                      {u.resubmissionCount > 0 && <span className="text-[10px] text-slate-600">#{u.resubmissionCount}</span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{u.description}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-600 mt-2">
                    <span>By: <span className="text-slate-300">{u.submittedBy?.name}</span></span>
                    <span>{format(new Date(u.installationDate), 'dd MMM yyyy')}</span>
                    {u.photos?.length > 0 && <span>{u.photos.length} photo(s)</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => setDetail(u)} className="btn-ghost text-xs py-1.5">Details</button>
                  {u.status === 'pending' && (
                    <>
                      <button onClick={() => setModal({ update: u, action: 'verify' })} className="btn-success text-xs py-1.5">✓ Verify</button>
                      <button onClick={() => { setModal({ update: u, action: 'reject' }); setReason(''); }} className="btn-danger text-xs py-1.5">✗ Reject</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 text-sm">{detail.title}</h3>
              <button onClick={() => setDetail(null)} className="btn-ghost p-1 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex gap-2"><span className={`badge-${detail.status}`}>{detail.status}</span><span className={`badge-${detail.type}`}>{detail.type}</span></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="label">Location</p><p className="text-slate-300">{detail.location?.name}</p></div>
                <div><p className="label">Thana</p><p className="text-slate-300">{detail.location?.thana}</p></div>
                <div><p className="label">Submitted By</p><p className="text-slate-300">{detail.submittedBy?.name}</p></div>
                <div><p className="label">Date</p><p className="text-slate-300">{format(new Date(detail.installationDate), 'dd MMM yyyy')}</p></div>
                {detail.latitude && <div><p className="label">Coords</p><p className="text-slate-300 font-mono text-xs">{detail.latitude?.toFixed(4)}, {detail.longitude?.toFixed(4)}</p></div>}
              </div>
              <div><p className="label">Description</p><p className="text-sm text-slate-400">{detail.description}</p></div>
              {detail.photos?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {detail.photos.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                      <img src={p.url} alt="" className="w-full h-20 object-cover rounded-xl border border-surface-400 hover:border-brand-500 transition-colors" />
                    </a>
                  ))}
                </div>
              )}
              {detail.previousVersions?.length > 0 && (
                <div>
                  <p className="label">Previous Versions</p>
                  <div className="space-y-1.5">
                    {detail.previousVersions.map((v, i) => (
                      <div key={i} className="bg-surface-200 rounded-xl px-3 py-2 text-xs">
                        <p className="text-slate-400">{v.title}</p>
                        {v.rejectionReason && <p className="text-red-400 mt-0.5">Rejected: {v.rejectionReason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.status === 'pending' && (
                <div className="flex gap-3 pt-2 border-t border-surface-300">
                  <button onClick={() => { setDetail(null); setModal({ update: detail, action: 'verify' }); }} className="btn-success flex-1 justify-center">✓ Verify</button>
                  <button onClick={() => { setDetail(null); setModal({ update: detail, action: 'reject' }); setReason(''); }} className="btn-danger flex-1 justify-center">✗ Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md">
            <div className="card-header">
              <h3 className={`font-semibold text-sm ${modal.action === 'verify' ? 'text-emerald-400' : 'text-red-400'}`}>
                {modal.action === 'verify' ? '✓ Confirm Verify' : '✗ Confirm Reject'}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-400">
                {modal.action === 'verify'
                  ? `Verify "${modal.update.title}"? Operator and SuperAdmin will be notified.`
                  : `Reject "${modal.update.title}"? Provide reason — operator will be notified.`}
              </p>
              {modal.action === 'reject' && (
                <div>
                  <label className="label">Rejection Reason *</label>
                  <textarea rows={4} className="input resize-none"
                    placeholder="Explain clearly what needs to be fixed…"
                    value={reason} onChange={e => setReason(e.target.value)} />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={handleReview} disabled={saving}
                  className={`flex-1 justify-center inline-flex items-center gap-2 font-medium rounded-xl px-4 py-2.5 text-sm transition-all
                    ${modal.action === 'verify' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'} text-white`}>
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : modal.action === 'verify' ? 'Verify' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
