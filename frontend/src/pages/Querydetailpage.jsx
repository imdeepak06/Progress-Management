import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Camera, Wifi, Zap, HelpCircle, Clock, CheckCircle, XCircle,
  Loader2, ChevronLeft, X, Upload, User, Image as ImageIcon,
  AlertTriangle, RotateCcw, ThumbsUp, ThumbsDown,
  ChevronRight, ChevronLeft as PrevIcon, SwitchCamera,
} from 'lucide-react';

/* ── helpers ── */
const CAT_META = {
  camera:       { label: 'Camera',       Icon: Camera,     color: 'cyan'   },
  wifi:         { label: 'WiFi',         Icon: Wifi,       color: 'violet' },
  power_supply: { label: 'Power Supply', Icon: Zap,        color: 'orange' },
  other:        { label: 'Other',        Icon: HelpCircle, color: 'slate'  },
};

const STATUS_META = {
  open:        { label: 'Open',        Icon: Clock,       text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  in_progress: { label: 'In Progress', Icon: Loader2,     text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30'    },
  resolved:    { label: 'Resolved',    Icon: CheckCircle, text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  rejected:    { label: 'Rejected',    Icon: XCircle,     text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30'     },
};

const PRIORITY_META = {
  low:      { label: 'Low',      color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  medium:   { label: 'Medium',   color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
  high:     { label: 'High',     color: 'text-orange-400',  bg: 'bg-orange-500/10'  },
  critical: { label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/10'     },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.open;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${m.bg} ${m.text} ${m.border}`}>
      <m.Icon className="w-3.5 h-3.5" />
      {m.label}
    </span>
  );
}

/* Image lightbox */
function ImageModal({ images, index, onClose }) {
  const [cur, setCur] = useState(index);
  useEffect(() => { setCur(index); }, [index]);

  if (index === null || !images.length) return null;
  const hasPrev = cur > 0;
  const hasNext = cur < images.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-surface-100 border border-surface-400 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
        <img src={images[cur].url || images[cur]} alt="" className="w-full max-h-[80vh] object-contain rounded-2xl border border-surface-400" />
        {images[cur].label && <p className="text-xs text-slate-400">{images[cur].label}</p>}
        {images.length > 1 && (
          <div className="flex items-center gap-4">
            <button onClick={() => setCur(c => Math.max(0, c - 1))} disabled={!hasPrev}
              className="w-9 h-9 rounded-full bg-surface-100 border border-surface-400 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30">
              <PrevIcon className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 font-mono">{cur + 1} / {images.length}</span>
            <button onClick={() => setCur(c => Math.min(images.length - 1, c + 1))} disabled={!hasNext}
              className="w-9 h-9 rounded-full bg-surface-100 border border-surface-400 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Camera capture with front/back switch ── */
function SelfieCapture({ onCapture, captured }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [active,   setActive]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // default: back camera

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCam = async (facing) => {
    stopStream();
    setLoading(true);
    try {
      const constraints = {
        video: { facingMode: { ideal: facing } },
        audio: false,
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      setActive(true);
      setFacingMode(facing);
      // attach to video element after state update
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err) {
      // If specific facing mode fails (e.g. desktop only has one cam), try without constraint
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = s;
        setActive(true);
        setFacingMode(facing);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }
        }, 50);
      } catch {
        toast.error('Camera access denied or unavailable');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    startCam(next);
  };

  const stopCam = () => {
    stopStream();
    setActive(false);
  };

  const capture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      toast.error('Camera not ready yet, please wait');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    // Mirror front camera capture so it looks natural
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) { toast.error('Capture failed, try again'); return; }
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file, URL.createObjectURL(blob));
      stopCam();
    }, 'image/jpeg', 0.92);
  };

  useEffect(() => () => stopStream(), []);

  if (captured) {
    return (
      <div className="relative">
        <img src={captured} alt="Captured" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
        <button onClick={() => { onCapture(null, null); }} className="absolute top-2 right-2 w-7 h-7 bg-red-600 rounded-full flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-white" />
        </button>
        <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Photo captured
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {active ? (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden bg-black" style={{ maxHeight: 220 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl"
              style={{
                maxHeight: 220,
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />
            {/* Switch camera button overlay */}
            <button
              onClick={switchCamera}
              className="absolute top-2 right-2 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
              title="Switch camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            {/* Camera label */}
            <div className="absolute bottom-2 left-2 bg-black/50 rounded-md px-2 py-0.5">
              <p className="text-[10px] text-white/80">
                {facingMode === 'user' ? 'Front camera' : 'Back camera'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={capture} className="btn-primary flex-1 justify-center">
              <Camera className="w-4 h-4" /> Capture
            </button>
            <button onClick={stopCam} className="btn-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => startCam('environment')} disabled={loading} className="btn-secondary w-full justify-center">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Camera className="w-4 h-4" />}
            {loading ? 'Starting camera…' : 'Take Photo (Back Camera)'}
          </button>
          <button onClick={() => startCam('user')} disabled={loading} className="btn-secondary w-full justify-center text-slate-400">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SwitchCamera className="w-4 h-4" />}
            {loading ? 'Starting camera…' : 'Take Selfie (Front Camera)'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function QueryDetailPage() {
  const { id }  = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const isCompany    = user?.role === 'company';
  const isSuperadmin = user?.role === 'superadmin';
  const isQueryAdmin = user?.role === 'queryAdmin';

  const [query,    setQuery]    = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [imgModal, setImgModal] = useState({ open: false, images: [], index: 0 });

  // Company review modal
  const [reviewModal, setReviewModal]   = useState(null); // 'approve' | 'reject'
  const [rejectionReason, setRejReason] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  // Reopen modal
  const [reopenModal,  setReopenModal]  = useState(false);
  const [reopenSaving, setReopenSaving] = useState(false);

  // Resolve modal (queryAdmin)
  const [resolveOpen, setResolveOpen]   = useState(false);
  const [resolveForm, setResolveForm]   = useState({ resolverName: '', details: '' });
  const [selfieFile,  setSelfieFile]    = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [proofFiles,  setProofFiles]    = useState([]);
  const [proofPreviews, setProofPreviews] = useState([]);
  const [resolveSaving, setResolveSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: q }, { data: tl }] = await Promise.all([
        api.get(`/queries/${id}`),
        api.get(`/queries/${id}/timeline`),
      ]);
      setQuery(q);
      setTimeline(tl.timeline);
    } catch {
      toast.error('Failed to load query');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* Proof photo dropzone */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 10,
    onDrop: useCallback(accepted => {
      const newFiles = [...proofFiles, ...accepted].slice(0, 10);
      setProofFiles(newFiles);
      setProofPreviews(newFiles.map(f => URL.createObjectURL(f)));
    }, [proofFiles]),
  });

  const removeProof = idx => {
    const next = proofFiles.filter((_, i) => i !== idx);
    setProofFiles(next);
    setProofPreviews(next.map(f => URL.createObjectURL(f)));
  };

  /* Company review */
  const submitReview = async (action) => {
    if (action === 'reject' && !rejectionReason.trim()) {
      return toast.error('Please provide a rejection reason');
    }
    setReviewSaving(true);
    try {
      const { data } = await api.put(`/queries/${id}/review`, {
        action,
        rejectionReason: action === 'reject' ? rejectionReason.trim() : undefined,
      });
      setQuery(data);
      toast.success(action === 'approve' ? 'Query approved — now in progress' : 'Query rejected');
      setReviewModal(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setReviewSaving(false);
    }
  };

  /* Superadmin reopen */
  const submitReopen = async () => {
    setReopenSaving(true);
    try {
      const { data } = await api.put(`/queries/${id}/reopen`);
      setQuery(data);
      toast.success('Query reopened');
      setReopenModal(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setReopenSaving(false);
    }
  };

  /* QueryAdmin resolve */
  const submitResolve = async () => {
    if (!resolveForm.resolverName.trim()) return toast.error('Enter the name of the person resolving this');
    if (!resolveForm.details.trim()) return toast.error('Enter resolution details');
    if (!selfieFile) return toast.error('Photo of the resolver is required');

    setResolveSaving(true);
    const toastId = toast.loading('Submitting resolution…');
    try {
      const fd = new FormData();
      fd.append('resolverName', resolveForm.resolverName.trim());
      fd.append('details', resolveForm.details.trim());
      fd.append('resolverPhoto', selfieFile);
      proofFiles.forEach(f => fd.append('photos', f));

      const { data } = await api.put(`/queries/${id}/resolve`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setQuery(data);
      toast.success('Query resolved!', { id: toastId });
      setResolveOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to resolve', { id: toastId });
    } finally {
      setResolveSaving(false);
    }
  };

  /* Open image modal */
  const openImages = (images, index = 0) => setImgModal({ open: true, images, index });

  if (loading) return (
    <div className="flex justify-center h-64 items-center">
      <div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!query) return <div className="text-center text-slate-500 mt-20">Query not found</div>;

  const cat  = CAT_META[query.category] || CAT_META.other;
  const sm   = STATUS_META[query.status] || STATUS_META.open;
  const pm   = PRIORITY_META[query.priority] || PRIORITY_META.medium;

  const allResolutionImages = [
    ...(query.resolution?.resolverPhoto?.url ? [{ url: query.resolution.resolverPhoto.url, label: 'Resolver Photo' }] : []),
    ...(query.resolution?.photos || []).map((p, i) => ({ url: p.url, label: `Proof Photo ${i + 1}` })),
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {imgModal.open && (
        <ImageModal images={imgModal.images} index={imgModal.index} onClose={() => setImgModal(m => ({ ...m, open: false }))} />
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary self-start flex-shrink-0">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatusBadge status={query.status} />
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${pm.bg} ${pm.color}`}>
              {pm.label}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">#{query._id.slice(-8).toUpperCase()}</span>
          </div>
          <h1 className="font-display text-xl font-bold text-white leading-tight">{query.title}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {query.locationName} · {query.thana}{query.district ? ` · ${query.district}` : ''}
          </p>
        </div>
      </div>

      {/* Info card */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Category</p>
            <div className={`flex items-center gap-1.5 text-${cat.color}-400`}>
              <cat.Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{cat.label}</span>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Raised By</p>
            <p className="text-sm text-purple-400 font-medium">{query.superadmin?.name || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Raised On</p>
            <p className="text-sm text-slate-300">{format(new Date(query.createdAt), 'dd MMM yyyy')}</p>
            <p className="text-[11px] text-slate-500">{format(new Date(query.createdAt), 'HH:mm')}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 mb-1">Last Updated</p>
            <p className="text-sm text-slate-300">{format(new Date(query.updatedAt), 'dd MMM yyyy')}</p>
            <p className="text-[11px] text-slate-500">{format(new Date(query.updatedAt), 'HH:mm')}</p>
          </div>
        </div>

        {query.description && (
          <div className="border-t border-surface-300 pt-4">
            <p className="text-[11px] text-slate-500 mb-1">Description</p>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{query.description}</p>
          </div>
        )}
      </div>

      {/* Rejection block */}
      {query.status === 'rejected' && query.rejectionReason && (
        <div className="card p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-400 mb-1">Rejection Reason</p>
              <p className="text-sm text-slate-300">{query.rejectionReason}</p>
            </div>
          </div>
          {isSuperadmin && (
            <button onClick={() => setReopenModal(true)} className="btn-secondary mt-3 text-amber-400 border-amber-500/30 hover:bg-amber-500/10">
              <RotateCcw className="w-4 h-4" /> Reopen Query
            </button>
          )}
        </div>
      )}

      {/* Resolution block */}
      {query.status === 'resolved' && query.resolution && (
        <div className="card p-5 border-emerald-500/30 bg-emerald-500/5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-400">Resolution Details</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-slate-500 mb-1">Resolved By (Person)</p>
              <p className="text-sm font-bold text-emerald-300">{query.resolution.resolverName || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 mb-1">QueryAdmin Account</p>
              <p className="text-sm text-slate-300">{query.resolution.resolvedBy?.name || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 mb-1">Resolved On</p>
              <p className="text-sm text-slate-300">
                {query.resolution.resolvedAt ? format(new Date(query.resolution.resolvedAt), 'dd MMM yyyy, HH:mm') : '—'}
              </p>
            </div>
          </div>
          {query.resolution.details && (
            <div>
              <p className="text-[11px] text-slate-500 mb-1">Resolution Notes</p>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{query.resolution.details}</p>
            </div>
          )}

          {/* Resolution photos */}
          {allResolutionImages.length > 0 && (
            <div>
              <p className="text-[11px] text-slate-500 mb-2">Proof Photos ({allResolutionImages.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {allResolutionImages.map((img, i) => (
                  <button key={i} onClick={() => openImages(allResolutionImages, i)} className="relative group rounded-xl overflow-hidden border border-surface-300 hover:border-surface-400 transition-all">
                    <img src={img.url} alt={img.label} className="w-full h-24 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <p className="text-[10px] text-white truncate">{img.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {/* Company: approve or reject if open */}
        {isCompany && query.status === 'open' && (
          <>
            <button onClick={() => setReviewModal('approve')} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
              <ThumbsUp className="w-4 h-4" /> Approve Query
            </button>
            <button onClick={() => setReviewModal('reject')} className="btn-secondary text-red-400 border-red-500/30 hover:bg-red-500/10">
              <ThumbsDown className="w-4 h-4" /> Reject
            </button>
          </>
        )}
        {/* QueryAdmin: resolve if in_progress */}
        {isQueryAdmin && query.status === 'in_progress' && (
          <button onClick={() => setResolveOpen(true)} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle className="w-4 h-4" /> Resolve Query
          </button>
        )}
        {/* Superadmin: reopen if rejected */}
        {isSuperadmin && query.status === 'rejected' && (
          <button onClick={() => setReopenModal(true)} className="btn-secondary text-amber-400 border-amber-500/30">
            <RotateCcw className="w-4 h-4" /> Reopen Query
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="card p-5 space-y-1">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Query Timeline</h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">No timeline events yet.</p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-surface-300" />
            <div className="space-y-5">
              {timeline.map((ev, i) => (
                <div key={i} className="relative flex gap-4 pl-6">
                  {/* Dot */}
                  <div className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 z-10 ${
                    i === 0 ? 'border-brand-400 bg-brand-500' : 'border-surface-400 bg-surface-200'
                  }`} />
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-200">{ev.event}</p>
                      <p className="text-[11px] text-slate-500 flex-shrink-0">
                        {ev.createdAt ? format(new Date(ev.createdAt), 'dd MMM, HH:mm') : ''}
                      </p>
                    </div>
                    {ev.actor && (
                      <p className="text-xs text-brand-400 mt-0.5">
                        {ev.actor} <span className="text-slate-500">({ev.actorRole})</span>
                      </p>
                    )}
                    {ev.remark && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{ev.remark}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════
          MODALS
          ═══════════════════════════════════════ */}

      {/* Review Modal (company) */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">
                {reviewModal === 'approve' ? '✅ Approve Query' : '❌ Reject Query'}
              </h3>
              <button onClick={() => setReviewModal(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            {reviewModal === 'approve' ? (
              <p className="text-sm text-slate-400">
                Approving this query will mark it as <strong className="text-blue-400">In Progress</strong> and a query admin
                will be assigned to resolve it at the location.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400">Please provide a reason for rejection:</p>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Duplicate query, issue already resolved, insufficient details..."
                  className="input-field w-full resize-none"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setReviewModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => submitReview(reviewModal)}
                disabled={reviewSaving}
                className={`flex-1 btn ${reviewModal === 'approve' ? 'btn-primary bg-emerald-600 hover:bg-emerald-700' : 'btn bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-sm shadow-lg'}`}
              >
                {reviewSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                {reviewModal === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {reopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" /> Reopen Query
            </h3>
            <p className="text-sm text-slate-400">
              This will reopen the rejected query and resubmit it to the company for review.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setReopenModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitReopen} disabled={reopenSaving} className="btn-primary flex-1 justify-center">
                {reopenSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal (queryAdmin) */}
      {resolveOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="card w-full max-w-lg p-4 sm:p-6 space-y-4 sm:space-y-5 my-4 sm:my-8 mx-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> Resolve Query
              </h3>
              <button onClick={() => setResolveOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            {/* Resolver name */}
            <div>
              <label className="label-sm mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Name of Person Resolving <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={resolveForm.resolverName}
                onChange={e => setResolveForm(f => ({ ...f, resolverName: e.target.value }))}
                placeholder="Enter the actual person's full name"
                className="input-field w-full"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                This is for tracking — enter the real technician's name, not the account name.
              </p>
            </div>

            {/* Camera capture */}
            <div>
              <label className="label-sm mb-1.5 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" /> Resolver Photo at Site <span className="text-red-400">*</span>
              </label>
              <SelfieCapture
                onCapture={(file, preview) => { setSelfieFile(file); setSelfiePreview(preview); }}
                captured={selfiePreview}
              />
            </div>

            {/* Resolution details */}
            <div>
              <label className="label-sm mb-1.5">Resolution Details <span className="text-red-400">*</span></label>
              <textarea
                value={resolveForm.details}
                onChange={e => setResolveForm(f => ({ ...f, details: e.target.value }))}
                rows={4}
                placeholder="Describe what was done to resolve the issue, parts replaced, etc."
                className="input-field w-full resize-none"
              />
            </div>

            {/* Date/time auto note */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-surface-200 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5" />
              Resolution date & time will be captured automatically as: <strong className="text-slate-300">{format(new Date(), 'dd MMM yyyy, HH:mm')}</strong>
            </div>

            {/* Proof photos */}
            <div>
              <label className="label-sm mb-1.5 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" /> Proof Photos <span className="text-slate-500">(up to 10)</span>
              </label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-brand-400 bg-brand-500/5' : 'border-surface-400 hover:border-surface-500'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="text-xs text-slate-400">
                  {isDragActive ? 'Drop here' : 'Drag & drop or click to upload proof photos'}
                </p>
              </div>
              {proofPreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {proofPreviews.map((src, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-surface-300">
                      <img src={src} alt="" className="w-full h-16 object-cover" />
                      <button onClick={() => removeProof(i)} className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setResolveOpen(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitResolve} disabled={resolveSaving} className="btn-primary flex-1 justify-center bg-emerald-600 hover:bg-emerald-700">
                {resolveSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {resolveSaving ? 'Submitting…' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}