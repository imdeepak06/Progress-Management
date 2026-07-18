import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { downloadSvgAsPng } from "../utils/qrDownload";
import {
  Camera,
  Wifi,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  QrCode,
  Plus,
  MapPin,
  Image,
  Phone,
  AlertTriangle,
  Server,
  Shield,
  FileDown,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { generateLocationPDF } from "../utils/generateLocationPDF";
import { generateQueryPDF } from "../utils/generateQueryPDF";
import {
  HelpCircle,
  Loader2,
  Radio,
  History,
} from "lucide-react";

const StatusBadge = ({ status }) => {
  if (status === "verified")
    return (
      <span className="badge-verified flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> Verified
      </span>
    );
  if (status === "rejected")
    return (
      <span className="badge-rejected flex items-center gap-1">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  return (
    <span className="badge-pending flex items-center gap-1">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
};

// Image Modal with prev/next navigation
const ImageModal = ({ images, index, onClose, onPrev, onNext }) => {
  if (index === null || !images.length) return null;
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-surface-100 border border-surface-400 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <img
          src={images[index]}
          alt="Preview"
          className="w-full max-h-[80vh] object-contain rounded-2xl border border-surface-400"
        />

        {images.length > 1 && (
          <div className="flex items-center gap-4">
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="w-9 h-9 rounded-full bg-surface-100 border border-surface-400 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 font-mono">
              {index + 1} / {images.length}
            </span>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="w-9 h-9 rounded-full bg-surface-100 border border-surface-400 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Visual progress boxes (camera / wifi / power) ── */
const ProgressBoxes = ({ label, icon: Icon, verified, planned, accent }) => {
  const total = Math.max(planned || 0, verified || 0);
  const boxes = Array.from({ length: total }, (_, i) => i < verified);
  return (
    <div className="card-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
          <Icon className="w-4 h-4" /> {label}
        </span>
        <span className={`text-xs font-bold ${accent}`}>
          {verified} / {planned || 0}
        </span>
      </div>
      {total === 0 ? (
        <p className="text-xs text-slate-600">No units planned</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {boxes.map((done, i) => (
            <div
              key={i}
              title={done ? "Installed" : "Pending"}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold border transition-colors
                ${done
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                  : "bg-surface-200 border-surface-400 text-slate-600"}`}
            >
              {done ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Inline upload for a single timeline update (admin + company) ── */
function InlineUpload({ updateId, onDone }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [saving, setSaving] = useState(false);

  const onDrop = useCallback((accepted) => {
    setFiles((p) => [...p, ...accepted]);
    setPreviews((p) => [...p, ...accepted.map((f) => URL.createObjectURL(f))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
  });

  const removeFile = (i) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const handleUpload = async () => {
    if (!files.length) return toast.error("Select at least one photo");
    setSaving(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("photos", f));
      await api.post(`/updates/${updateId}/photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Photos added");
      setFiles([]);
      setPreviews([]);
      setOpen(false);
      onDone?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
      >
        <Upload className="w-3.5 h-3.5" />
        Add Photos
      </button>
    );
  }

  return (
    <div className="mt-3 bg-surface-200/50 border border-surface-400 rounded-xl p-3 space-y-3">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors text-xs
          ${isDragActive ? "border-brand-500 bg-brand-500/10" : "border-surface-400 hover:border-brand-500/50"}`}
      >
        <input {...getInputProps()} />
        <p className="text-slate-400">
          {isDragActive ? "Drop images here" : "Click or drop images to add"}
        </p>
      </div>
      {previews.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative group">
              <img src={src} alt="" className="w-full h-12 object-cover rounded-lg border border-surface-400" />
              <button
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => { setOpen(false); setFiles([]); setPreviews([]); }} className="btn-ghost flex-1 text-xs py-1.5">Cancel</button>
        <button onClick={handleUpload} disabled={saving || !files.length} className="btn-primary flex-1 text-xs py-1.5">
          {saving ? "Uploading…" : `Upload ${files.length ? `(${files.length})` : ""}`}
        </button>
      </div>
    </div>
  );
}

/* ── Equipment field component (defined OUTSIDE EquipmentTables to prevent focus loss) ── */
const EquipmentField = ({ label, value, mono, onChange }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-slate-500">{label}</label>
    <input
      className={`input py-1.5 text-xs mt-0.5 ${mono ? "font-mono" : ""}`}
      placeholder={label}
      value={value}
      onChange={onChange}
    />
  </div>
);

const EquipmentRow = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-[11px] uppercase tracking-wider text-slate-500 pt-0.5">{label}</span>
    <span className={`text-xs text-slate-300 text-right break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
  </div>
);

/* ── NVR / WIFI credentials (single fixed row each — company + admin) ── */
function EquipmentTables({ locationId }) {
  const [nvr, setNvr] = useState({ ipAddress: "", password: "", remark: "" });
  const [wifi, setWifi] = useState({ name: "", password: "", remark: "" });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'nvr' | 'wifi' | null
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/locations/${locationId}/equipment`);
      setNvr(data.nvr || { ipAddress: "", password: "", remark: "" });
      setWifi(data.wifi || { name: "", password: "", remark: "" });
    } catch (e) {
      // 403 just means not allowed; ignore quietly
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [locationId]);

  const startEdit = (kind) => {
    setEditing(kind);
    setDraft(
      kind === "nvr"
        ? { ipAddress: nvr.ipAddress || "", password: nvr.password || "", remark: nvr.remark || "" }
        : { name: wifi.name || "", password: wifi.password || "", remark: wifi.remark || "" }
    );
  };
  const cancel = () => { setEditing(null); setDraft({}); };

  const save = async () => {
    setBusy(true);
    try {
      const body = editing === "nvr" ? { nvr: draft } : { wifi: draft };
      const { data } = await api.put(`/locations/${locationId}/equipment`, body);
      setNvr(data.nvr || nvr);
      setWifi(data.wifi || wifi);
      toast.success("Saved");
      cancel();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <div className="card p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Server className="w-4 h-4 text-brand-400" />
          Equipment Credentials
        </h3>
        <button onClick={() => setShowPw((s) => !s)} className="text-[11px] text-slate-500 hover:text-slate-300">
          {showPw ? "Hide passwords" : "Show passwords"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NVR */}
        <div className="bg-surface-200/50 border border-surface-300 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">NVR</p>
            {editing !== "nvr" && (
              <button onClick={() => startEdit("nvr")} className="text-xs text-brand-400 hover:text-brand-300">Edit</button>
            )}
          </div>
          {editing === "nvr" ? (
            <div className="space-y-2">
              <EquipmentField
                label="IP Address"
                value={draft.ipAddress || ""}
                mono
                onChange={(e) => setDraft((d) => ({ ...d, ipAddress: e.target.value }))}
              />
              <EquipmentField
                label="Password"
                value={draft.password || ""}
                mono
                onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              />
              <EquipmentField
                label="Remark"
                value={draft.remark || ""}
                onChange={(e) => setDraft((d) => ({ ...d, remark: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <button onClick={save} disabled={busy} className="btn-primary text-xs py-1 px-3">{busy ? "Saving…" : "Save"}</button>
                <button onClick={cancel} className="btn-secondary text-xs py-1 px-3">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-surface-300/40">
              <EquipmentRow label="IP Address" value={nvr.ipAddress} mono />
              <EquipmentRow label="Password" value={nvr.password ? (showPw ? nvr.password : "••••••••") : ""} mono />
              <EquipmentRow label="Remark" value={nvr.remark} />
            </div>
          )}
        </div>

        {/* WIFI */}
        <div className="bg-surface-200/50 border border-surface-300 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">WIFI</p>
            {editing !== "wifi" && (
              <button onClick={() => startEdit("wifi")} className="text-xs text-brand-400 hover:text-brand-300">Edit</button>
            )}
          </div>
          {editing === "wifi" ? (
            <div className="space-y-2">
              <EquipmentField
                label="Name"
                value={draft.name || ""}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
              <EquipmentField
                label="Password"
                value={draft.password || ""}
                mono
                onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
              />
              <EquipmentField
                label="Remark"
                value={draft.remark || ""}
                onChange={(e) => setDraft((d) => ({ ...d, remark: e.target.value }))}
              />
              <div className="flex gap-2 pt-1">
                <button onClick={save} disabled={busy} className="btn-primary text-xs py-1 px-3">{busy ? "Saving…" : "Save"}</button>
                <button onClick={cancel} className="btn-secondary text-xs py-1 px-3">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-surface-300/40">
              <EquipmentRow label="Name" value={wifi.name} />
              <EquipmentRow label="Password" value={wifi.password ? (showPw ? wifi.password : "••••••••") : ""} mono />
              <EquipmentRow label="Remark" value={wifi.remark} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LocationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [location, setLocation] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [modal, setModal] = useState({ images: [], index: null });

  const [phones, setPhones] = useState([]);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [savingPhones, setSavingPhones] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const canManage = ["company", "superadmin"].includes(user?.role);
  const canSeeCreds = ["company", "admin"].includes(user?.role);
  const canAddPhotos = ["company", "admin"].includes(user?.role);

  // ── Query state ──
  const [queries,       setQueries]       = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [queryPdfBusy,  setQueryPdfBusy]  = useState(false);
  const canSeeQueries = ["company", "superadmin", "queryAdmin"].includes(user?.role);
  const canRaiseQuery = user?.role === "superadmin";

  // ── Remarks state (company only) ──
  const [remarks,        setRemarks]        = useState([]);
  const [remarkText,     setRemarkText]     = useState("");
  const [remarkColor,    setRemarkColor]    = useState("green");
  const [remarkSaving,   setRemarkSaving]   = useState(false);
  const [remarkDeleting, setRemarkDeleting] = useState(null);
  const canManageRemarks = user?.role === "company";

  // ── Control Room state ──
  const [controlRoom, setControlRoom]           = useState(null);
  const [crTrail, setCrTrail]                   = useState([]);
  const [crTrailOpen, setCrTrailOpen]           = useState(false);
  const [crRequestBusy, setCrRequestBusy]       = useState(false);
  const [crReviewBusy, setCrReviewBusy]         = useState(false);
  const [crRejectReason, setCrRejectReason]     = useState("");
  const [crShowReject, setCrShowReject]         = useState(false);

  const canRequestCR   = user?.role === "admin";
  const canReviewCR    = user?.role === "superadmin";
  const canSeeCRTrail  = ["company", "superadmin", "admin"].includes(user?.role);

  const openModal = (images, index) => setModal({ images, index });
  const closeModal = () => setModal({ images: [], index: null });
  const prevImg = () => setModal((m) => ({ ...m, index: Math.max(0, m.index - 1) }));
  const nextImg = () => setModal((m) => ({ ...m, index: Math.min(m.images.length - 1, m.index + 1) }));


  const navigate = useNavigate();

  const reloadTimeline = async () => {
    try {
      const { data } = await api.get(`/updates/timeline/${id}`);
      setUpdates(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    Promise.all([api.get(`/locations/${id}`), api.get(`/updates/timeline/${id}`)])
      .then(([l, u]) => {
        setLocation(l.data);
        setUpdates(u.data);
        setPhones(l.data.alertPhones || []);
        setRemarks(l.data.remarks || []);
        setControlRoom(l.data.controlRoom || { status: "not_connected", trail: [] });
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  const savePhones = async (next) => {
    setSavingPhones(true);
    try {
      await api.put(`/locations/${id}`, { alertPhones: next });
      setPhones(next);
      toast.success("Location alert numbers updated");
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed");
    } finally {
      setSavingPhones(false);
    }
  };

  const addPhone = () => {
    const clean = phoneDraft.replace(/[^\d]/g, "");
    if (clean.length < 8) { toast.error("Enter number with country code"); return; }
    if (phones.includes(clean)) { setPhoneDraft(""); return; }
    savePhones([...phones, clean]);
    setPhoneDraft("");
  };

  const downloadQr = async () => {
    if (qrBusy) return;
    setQrBusy(true);
    try {
      const { data } = await api.get(`/alerts/qr/${id}`);
      await downloadSvgAsPng(data.svg, data.fileName);
      toast.success("QR downloaded");
    } catch (e) {
      toast.error(e.response?.data?.message || "QR download failed");
    } finally {
      setQrBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    const toastId = toast.loading("Generating PDF report…");
    try {
      await generateLocationPDF(location, updates);
      toast.success("PDF downloaded!", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("PDF generation failed", { id: toastId });
    } finally {
      setPdfBusy(false);
    }
  };

  // ── Load queries for this location ──
  const loadQueries = useCallback(async () => {
    if (!canSeeQueries) return;
    setQueriesLoading(true);
    try {
      const { data } = await api.get(`/queries/location/${id}`);
      setQueries(data.queries ?? data ?? []);
    } catch {
      /* silent — queries optional */
    } finally {
      setQueriesLoading(false);
    }
  }, [id, canSeeQueries]);

  useEffect(() => { loadQueries(); }, [loadQueries]);

  // ── Control Room handlers ──
  const requestControlRoom = async () => {
    if (crRequestBusy) return;
    setCrRequestBusy(true);
    try {
      const { data } = await api.post(`/locations/${id}/control-room/request`);
      setControlRoom(data.controlRoom);
      toast.success("Control room connection request bhej di gayi");
    } catch (e) {
      toast.error(e.response?.data?.message || "Request failed");
    } finally {
      setCrRequestBusy(false);
    }
  };

  const reviewControlRoom = async (action) => {
    if (crReviewBusy) return;
    if (action === "reject" && !crRejectReason.trim()) {
      toast.error("Rejection ka reason likhna zaroori hai");
      return;
    }
    setCrReviewBusy(true);
    try {
      const { data } = await api.post(`/locations/${id}/control-room/review`, {
        action,
        reason: crRejectReason.trim(),
      });
      setControlRoom(data.controlRoom);
      setCrShowReject(false);
      setCrRejectReason("");
      toast.success(action === "accept" ? "Control room connected!" : "Request reject kar di gayi");
    } catch (e) {
      toast.error(e.response?.data?.message || "Action failed");
    } finally {
      setCrReviewBusy(false);
    }
  };

  const loadCRTrail = async () => {
    try {
      const { data } = await api.get(`/locations/${id}/control-room/trail`);
      setCrTrail(data.controlRoom?.trail || []);
      setCrTrailOpen(true);
    } catch (e) {
      toast.error("Trail load nahi hua");
    }
  };

  const downloadQueryPdf = async () => {
    if (queryPdfBusy || !location) return;
    setQueryPdfBusy(true);
    const tid = toast.loading("Generating query PDF…");
    try {
      await generateQueryPDF(
        { name: location.name, thana: location.thana, district: location.district },
        queries
      );
      toast.success("Query PDF downloaded!", { id: tid });
    } catch {
      toast.error("Query PDF failed", { id: tid });
    } finally {
      setQueryPdfBusy(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") prevImg();
      if (e.key === "ArrowRight") nextImg();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading)
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!location)
    return <div className="text-center text-slate-500 mt-20">Location not found</div>;

  const s = location.stats;
  const filtered = tab === "all" ? updates : updates.filter((u) => u.type === tab);

  const allFull = s?.camera?.full && s?.wifi?.full && s?.power?.full;
  const isAdmin = user?.role === "admin";

  const typeIcons = {
    camera: "M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    wifi: "M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0",
    power: "M13 10V3L4 14h7v7l9-11h-7z",
  };

  return (
    <div className="space-y-5">
      <ImageModal images={modal.images} index={modal.index} onClose={closeModal} onPrev={prevImg} onNext={nextImg} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <Link to="/dashboard/locations" className="btn-secondary self-start flex-shrink-0">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">{location.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{location.thana} · {location.district}</p>
          {location.superadmin && (
            <p className="text-xs text-purple-400 mt-0.5">↳ {location.superadmin.name}</p>
          )}
        </div>
        {user?.role === "company" && (
          <button onClick={downloadQr} disabled={qrBusy} className="btn-secondary self-start flex-shrink-0">
            {qrBusy ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <QrCode className="w-4 h-4" />
            )}
            QR Code
          </button>
        )}
        {/* PDF Report — visible to company + admin */}
        {["company", "admin"].includes(user?.role) && (
          <button
            onClick={downloadPdf}
            disabled={pdfBusy}
            className="btn-secondary self-start flex-shrink-0 gap-1.5"
            title="Download full location report as PDF"
          >
            {pdfBusy ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {pdfBusy ? "Generating…" : "PDF Report"}
          </button>
        )}
        {isAdmin && (
          allFull ? (
            <div className="self-start text-right">
              <button disabled className="btn-primary opacity-40 cursor-not-allowed">Limit Reached</button>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 justify-end">
                <CheckCircle className="w-3 h-3" /> All equipment verified
              </p>
            </div>
          ) : (
            <Link to={`/dashboard/updates/submit?locationId=${id}`} className="btn-primary self-start flex-shrink-0">
              <Plus className="w-4 h-4" />
              Submit Update
            </Link>
          )
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: "Cam Planned", value: s?.planned?.camera ?? 0, color: "cyan" },
          { label: "WiFi Planned", value: s?.planned?.wifi ?? 0, color: "violet" },
          { label: "Power Planned", value: s?.planned?.power ?? 0, color: "orange" },
          { label: "Cam Verified", value: s?.camera?.verified ?? 0, color: "emerald" },
          { label: "WiFi Verified", value: s?.wifi?.verified ?? 0, color: "emerald" },
          { label: "Power Verified", value: s?.power?.verified ?? 0, color: "emerald" },
        ].map((c) => (
          <div key={c.label} className="card-sm p-3 text-center">
            <p className={`text-xl font-bold font-mono text-${c.color}-400`}>{c.value}</p>
            <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      {s && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Camera", data: s.camera, planned: s.planned?.camera, color: "cyan", bg: "bg-cyan-500" },
            { label: "WiFi", data: s.wifi, planned: s.planned?.wifi, color: "violet", bg: "bg-violet-500" },
            { label: "Power", data: s.power, planned: s.planned?.power, color: "orange", bg: "bg-orange-500" },
          ].map((row) => (
            <div key={row.label} className="card-sm p-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                  {row.label}
                  {row.data?.full && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 rounded flex items-center gap-0.5">
                      <CheckCircle className="w-2.5 h-2.5" /> Done
                    </span>
                  )}
                </span>
                <span className={`font-bold text-${row.color}-400 text-sm`}>{row.data?.progress ?? 0}%</span>
              </div>
              <div className="progress-track-md mb-2">
                <div className={`progress-fill ${row.data?.full ? "bg-emerald-500" : row.bg}`} style={{ width: `${row.data?.progress ?? 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span className="text-emerald-400">{row.data?.verified ?? 0} ok</span>
                <span className="text-amber-400">{row.data?.pending ?? 0} wait</span>
                <span className="text-red-400">{row.data?.rejected ?? 0} rej</span>
                <span>/{row.planned ?? 0} plan</span>
              </div>
            </div>
          ))}

          {/* Control Room progress bar card */}
          {(() => {
            const crStatus = controlRoom?.status || "not_connected";
            const isConnected = crStatus === "connected";
            const isPending   = crStatus === "pending";
            const isRejected  = crStatus === "rejected";
            const barColor   = isConnected ? "bg-emerald-500" : "bg-red-500";
            const barWidth   = isConnected ? "100%" : "0%";
            const labelColor = isConnected ? "text-emerald-400" : isRejected ? "text-red-400" : isPending ? "text-amber-400" : "text-red-400";
            const statusLabel = isConnected ? "Connected" : isRejected ? "Rejected" : isPending ? "Pending" : "Not Connected";
            return (
              <div className="card-sm p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-slate-400" />
                    Control Room
                    {isConnected && (
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 rounded flex items-center gap-0.5">
                        <CheckCircle className="w-2.5 h-2.5" /> Done
                      </span>
                    )}
                  </span>
                  <span className={`font-bold text-sm ${labelColor}`}>{isConnected ? "Yes" : "No"}</span>
                </div>
                <div className="progress-track-md mb-2">
                  <div className={`progress-fill ${barColor} transition-all duration-500`} style={{ width: barWidth }} />
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className={labelColor}>{statusLabel}</span>
                  {canSeeCRTrail && (
                    <button onClick={loadCRTrail} className="text-brand-400 hover:text-brand-300 flex items-center gap-0.5">
                      <History className="w-3 h-3" /> Trail
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Control Room Action Panel ── */}
      {controlRoom && (
        <div className="card-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Control Room Connection</h3>
            {controlRoom.status === "connected" && (
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">● Connected</span>
            )}
            {controlRoom.status === "pending" && (
              <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">● Pending Review</span>
            )}
            {controlRoom.status === "rejected" && (
              <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">● Rejected</span>
            )}
            {controlRoom.status === "not_connected" && (
              <span className="text-[10px] bg-slate-500/15 text-slate-400 px-2 py-0.5 rounded-full">● Not Connected</span>
            )}
          </div>

          {/* Rejection reason display */}
          {controlRoom.status === "rejected" && controlRoom.rejectReason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
              <p className="text-[11px] text-red-300">
                <span className="font-semibold">Rejection Reason:</span> {controlRoom.rejectReason}
              </p>
            </div>
          )}

          {/* Admin (ground) — request / re-request button */}
          {canRequestCR && (controlRoom.status === "not_connected" || controlRoom.status === "rejected") && (
            <button
              onClick={requestControlRoom}
              disabled={crRequestBusy}
              className="btn-primary text-xs py-1.5 flex items-center gap-1.5"
            >
              {crRequestBusy
                ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Radio className="w-3.5 h-3.5" />
              }
              {controlRoom.status === "rejected" ? "Re-Request Control Room" : "Request Control Room Connection"}
            </button>
          )}

          {controlRoom.status === "pending" && canRequestCR && (
            <p className="text-xs text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Aapki request superadmin ke review mein hai…
            </p>
          )}

          {/* Superadmin — accept / reject panel */}
          {canReviewCR && controlRoom.status === "pending" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">Admin ne control room connection ki request ki hai. Accept ya reject karein:</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => reviewControlRoom("accept")}
                  disabled={crReviewBusy}
                  className="btn-primary text-xs py-1.5 flex items-center gap-1.5"
                >
                  {crReviewBusy
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <CheckCircle className="w-3.5 h-3.5" />
                  }
                  Accept
                </button>
                <button
                  onClick={() => setCrShowReject(v => !v)}
                  className="btn-secondary text-xs py-1.5 flex items-center gap-1.5 text-red-400 border-red-500/30 hover:border-red-400"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
              {crShowReject && (
                <div className="space-y-2">
                  <textarea
                    className="input text-xs py-1.5 w-full resize-none"
                    rows={2}
                    placeholder="Rejection reason likhein (zaroori hai)…"
                    value={crRejectReason}
                    onChange={e => setCrRejectReason(e.target.value)}
                  />
                  <button
                    onClick={() => reviewControlRoom("reject")}
                    disabled={crReviewBusy || !crRejectReason.trim()}
                    className="btn-secondary text-xs py-1.5 text-red-400 border-red-500/30 hover:border-red-400 flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {crReviewBusy
                      ? <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      : <XCircle className="w-3.5 h-3.5" />
                    }
                    Confirm Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Control Room Trail Modal ── */}
      {crTrailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setCrTrailOpen(false)}>
          <div className="card w-full max-w-md max-h-[80vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-brand-400" /> Control Room Trail
              </h3>
              <button onClick={() => setCrTrailOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            {crTrail.length === 0 ? (
              <p className="text-sm text-slate-500">Koi trail nahi mili abhi tak.</p>
            ) : (
              <div className="space-y-2">
                {[...crTrail].reverse().map((entry, i) => {
                  const actionColors = {
                    requested:    "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    "re-requested": "text-amber-400 bg-amber-500/10 border-amber-500/20",
                    accepted:     "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    rejected:     "text-red-400 bg-red-500/10 border-red-500/20",
                  };
                  const cls = actionColors[entry.action] || "text-slate-400 bg-slate-500/10 border-slate-500/20";
                  return (
                    <div key={i} className={`border rounded-lg p-3 space-y-1 ${cls}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold capitalize">{entry.action}</span>
                        <span className="text-[10px] text-slate-500">{entry.at ? format(new Date(entry.at), "dd/MM/yy HH:mm") : ""}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">By: {entry.byName || entry.by?.name || "--"} ({entry.byRole || entry.by?.role || "--"})</p>
                      {entry.reason && (
                        <p className="text-[11px] text-red-300">Reason: {entry.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coordinates */}
      {location.latitude && location.longitude && (
        <div className="card-sm p-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span className="text-sm text-slate-400 font-mono">
            {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
          </span>
          <a href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:text-brand-300 sm:ml-auto">
            Open Maps →
          </a>
        </div>
      )}

      {/* Visual progress (boxes) */}
      {s && (
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Installation Progress
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <ProgressBoxes label="Camera" icon={Camera} verified={s.camera?.verified ?? 0} planned={s.planned?.camera ?? 0} accent="text-cyan-400" />
            <ProgressBoxes label="WiFi" icon={Wifi} verified={s.wifi?.verified ?? 0} planned={s.planned?.wifi ?? 0} accent="text-violet-400" />
            <ProgressBoxes label="Power Supply" icon={Zap} verified={s.power?.verified ?? 0} planned={s.planned?.power ?? 0} accent="text-amber-400" />
            {/* Control Room binary box */}
            {(() => {
              const crStatus = controlRoom?.status || "not_connected";
              const isConnected = crStatus === "connected";
              return (
                <div className="card-sm p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Radio className={`w-3.5 h-3.5 ${isConnected ? "text-emerald-400" : "text-red-400"}`} />
                    <span className="text-xs font-medium text-slate-300">Control Room</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className={`text-xs font-bold ${isConnected ? "text-emerald-400" : "text-red-400"}`}>
                      {isConnected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* NVR / WIFI credential tables (company + admin only) */}
      {canSeeCreds && <EquipmentTables locationId={id} />}

      {/* Recce images */}
      {(() => {
        const imgs = location.defaultImages?.length
          ? location.defaultImages
          : location.defaultImage ? [location.defaultImage] : [];
        if (!imgs.length) return null;
        return (
          <div className="card-sm p-3 space-y-2">
            <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-emerald-400" />
              Recce Images
              <span className="text-emerald-400/70 ml-1">({imgs.length})</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {imgs.map((url, i) => (
                <button key={i} onClick={() => openModal(imgs, i)} className="flex-shrink-0 focus:outline-none">
                  <img src={url} alt={`Recce ${i + 1}`}
                    className={`object-cover rounded-xl border border-surface-400 hover:border-brand-500 transition-colors cursor-pointer ${imgs.length === 1 ? "w-full max-h-72" : "w-24 h-20"}`} />
                </button>
              ))}
            </div>
          </div>
        );
      })()}



      {/* ── Company Remarks Section ── */}
      {canManageRemarks && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-slate-200">Location Remarks</h3>
            <span className="text-[11px] text-slate-500">(visible on PDF report)</span>
          </div>

          {/* Existing remarks */}
          {remarks.length > 0 && (
            <div className="space-y-2">
              {remarks.map((r) => {
                const colorMap = {
                  green:  { dot: "bg-emerald-500", text: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/30" },
                  yellow: { dot: "bg-amber-500",   text: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/30"   },
                  red:    { dot: "bg-red-500",      text: "text-red-300",     bg: "bg-red-500/10 border-red-500/30"       },
                };
                const cm = colorMap[r.color] || colorMap.green;
                return (
                  <div key={r._id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${cm.bg}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${cm.dot}`} />
                    <p className={`flex-1 text-sm leading-relaxed ${cm.text}`}>{r.text}</p>
                    <button
                      onClick={async () => {
                        if (!window.confirm("Delete this remark?")) return;
                        setRemarkDeleting(r._id);
                        try {
                          const { data } = await api.delete(`/locations/${id}/remarks/${r._id}`);
                          setRemarks(data.remarks);
                          toast.success("Remark deleted");
                        } catch (e) {
                          toast.error(e.response?.data?.message || "Failed to delete");
                        } finally {
                          setRemarkDeleting(null);
                        }
                      }}
                      disabled={remarkDeleting === r._id}
                      className="flex-shrink-0 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      {remarkDeleting === r._id
                        ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new remark */}
          <div className="space-y-2">
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              rows={2}
              placeholder="e.g. Camera connected but WiFi isn't — control room can access feed"
              className="input-field w-full resize-none text-sm"
            />
            <div className="flex items-center gap-3">
              {/* Color selector */}
              <div className="flex items-center gap-2">
                {[
                  { value: "green",  label: "Green",  dot: "bg-emerald-500", ring: "ring-emerald-500" },
                  { value: "yellow", label: "Yellow", dot: "bg-amber-500",   ring: "ring-amber-500"   },
                  { value: "red",    label: "Red",    dot: "bg-red-500",     ring: "ring-red-500"     },
                ].map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setRemarkColor(c.value)}
                    title={c.label}
                    className={`w-5 h-5 rounded-full ${c.dot} transition-all ${remarkColor === c.value ? `ring-2 ring-offset-2 ring-offset-surface-200 ${c.ring} scale-125` : "opacity-60 hover:opacity-100"}`}
                  />
                ))}
                <span className="text-[11px] text-slate-500 capitalize">{remarkColor}</span>
              </div>
              <button
                onClick={async () => {
                  if (!remarkText.trim()) return toast.error("Enter remark text");
                  setRemarkSaving(true);
                  try {
                    const { data } = await api.post(`/locations/${id}/remarks`, {
                      text: remarkText.trim(),
                      color: remarkColor,
                    });
                    setRemarks(data.remarks);
                    setRemarkText("");
                    toast.success("Remark added");
                  } catch (e) {
                    toast.error(e.response?.data?.message || "Failed to add remark");
                  } finally {
                    setRemarkSaving(false);
                  }
                }}
                disabled={remarkSaving || !remarkText.trim()}
                className="btn-primary text-xs py-1.5 px-4 ml-auto"
              >
                {remarkSaving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Remark
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Service Queries Section ── */}
      {canSeeQueries && (
        <div className="card">
          <div className="card-header flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-rose-400" />
              <h3 className="font-semibold text-slate-200 text-sm">
                Service Queries
                {queries.length > 0 && (
                  <span className="ml-2 text-[11px] bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    {queries.length}
                  </span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {queries.length > 0 && (
                <button
                  onClick={downloadQueryPdf}
                  disabled={queryPdfBusy}
                  className="btn-secondary text-xs py-1.5 px-3 gap-1.5"
                  title="Download query report PDF"
                >
                  {queryPdfBusy
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <FileDown className="w-3.5 h-3.5" />}
                  {queryPdfBusy ? "Generating…" : "Query PDF"}
                </button>
              )}
              {canRaiseQuery && (
                <button
                  onClick={() => navigate(`/dashboard/queries/raise?locationId=${id}`)}
                  className="btn-primary text-xs py-1.5 px-3 gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Raise Query
                </button>
              )}
            </div>
          </div>

          {queriesLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-[3px] border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : queries.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              {canRaiseQuery
                ? "No queries raised yet. Use 'Raise Query' to report an issue."
                : "No service queries for this location."}
            </div>
          ) : (
            <div className="divide-y divide-surface-300">
              {queries.map(q => {
                const CAT_COLOR = { camera: "cyan", wifi: "violet", power_supply: "orange", other: "slate" };
                const CAT_LABEL = { camera: "Camera", wifi: "WiFi", power_supply: "Power", other: "Other" };
                const ST_TEXT   = { open: "text-amber-400", in_progress: "text-blue-400", resolved: "text-emerald-400", rejected: "text-red-400" };
                const ST_LABEL  = { open: "Open", in_progress: "In Progress", resolved: "Resolved", rejected: "Rejected" };
                const PR_TEXT   = { low: "text-emerald-400", medium: "text-amber-400", high: "text-orange-400", critical: "text-red-400" };
                const cat = q.category || "other";
                return (
                  <Link
                    key={q._id}
                    to={`/dashboard/queries/${q._id}`}
                    className="flex items-start gap-3 p-4 hover:bg-surface-200/50 transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-lg bg-${CAT_COLOR[cat] || "slate"}-500/10 flex items-center justify-center text-${CAT_COLOR[cat] || "slate"}-400 flex-shrink-0 mt-0.5 text-[11px] font-bold`}>
                      {(CAT_LABEL[cat] || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{q.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className={`text-[11px] font-semibold ${ST_TEXT[q.status] || "text-slate-400"}`}>
                          {ST_LABEL[q.status] || q.status}
                        </span>
                        <span className="text-[11px] text-slate-500">·</span>
                        <span className={`text-[11px] font-medium ${PR_TEXT[q.priority] || "text-slate-400"} uppercase`}>
                          {q.priority}
                        </span>
                        <span className="text-[11px] text-slate-600 ml-auto">
                          {q.createdAt ? format(new Date(q.createdAt), "dd MMM") : ""}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 self-center transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alert phone numbers */}
      {canManage && (
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Alert Numbers (this location)</h3>
              <p className="text-[11px] text-slate-500">WhatsApp numbers that receive alerts raised here</p>
            </div>
          </div>

          <div className="flex gap-2">
            <input className="input flex-1" inputMode="tel" placeholder="e.g. 919812345678"
              value={phoneDraft} onChange={(e) => setPhoneDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhone(); } }} />
            <button type="button" onClick={addPhone} disabled={savingPhones} className="btn-secondary px-3">Add</button>
          </div>
          <p className="text-[11px] text-slate-600 mt-1">Include country code, no '+'. Saved instantly.</p>

          {phones.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {phones.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 bg-surface-200 border border-surface-400 rounded-lg px-2 py-1 text-[11px] text-slate-300">
                  <Phone className="w-3 h-3 text-slate-500" />
                  +{p}
                  <button type="button" onClick={() => savePhones(phones.filter((x) => x !== p))} className="text-slate-500 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="card">
        <div className="card-header flex flex-col sm:flex-row sm:items-center gap-3">
          <h3 className="font-semibold text-slate-200 text-sm">Updates Timeline</h3>
          <div className="flex gap-1.5 sm:ml-auto">
            {["all", "camera", "wifi", "power"].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tab === t ? "bg-brand-500 text-white" : "bg-surface-300 text-slate-500 hover:text-slate-200"}`}>
                {t === "power" ? "Power" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-600 text-sm">No updates yet</div>
        ) : (
          <div className="p-5">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-surface-400" />
              <div className="space-y-4">
                {filtered.map((update) => (
                  <div key={update._id} className="relative pl-11">
                    <div className={`absolute left-0 w-8 h-8 rounded-full border-2 flex items-center justify-center
                      ${update.status === "verified" ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                        : update.status === "rejected" ? "bg-red-500/15 border-red-500 text-red-400"
                        : "bg-amber-500/15 border-amber-500 text-amber-400"}`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeIcons[update.type] || typeIcons.camera} />
                      </svg>
                    </div>
                    <div className="card-sm p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-2 justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-200 text-sm">{update.title}</h4>
                            <StatusBadge status={update.status} />
                            <span className={`badge-${update.type}`}>{update.type === "power" ? "power" : update.type}</span>
                            {update.type !== "power" && update.installedCount > 1 && (
                              <span className="text-[10px] bg-surface-300 text-slate-300 px-1.5 py-0.5 rounded">×{update.installedCount}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{update.description}</p>
                        </div>
                        <div className="text-xs text-slate-600 flex-shrink-0 sm:text-right">
                          {update.installationDate && (
                            <div>{format(new Date(update.installationDate), "dd MMM yyyy")}</div>
                          )}
                          <div className="mt-0.5">by {update.submittedBy?.name}</div>
                        </div>
                      </div>

                      {update.photos?.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {update.photos.map((p, i) => (
                            <button key={i} onClick={() => openModal(update.photos.map((x) => x.url), i)} className="flex-shrink-0">
                              <img src={p.url} alt="" className="w-16 h-12 object-cover rounded-lg border border-surface-400 hover:border-brand-500 transition-colors cursor-pointer" />
                            </button>
                          ))}
                        </div>
                      )}

                      {update.status === "rejected" && update.rejectionReason && (
                        <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                          <p className="text-xs font-semibold text-red-400 mb-1 flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Rejection Reason
                          </p>
                          <p className="text-xs text-red-300">{update.rejectionReason}</p>
                        </div>
                      )}

                      {update.status === "rejected" && update.submittedBy?._id === user?._id && (
                        <Link to={`/dashboard/updates/submit/${update._id}`} className="btn-primary text-xs py-1.5 mt-3 inline-flex">Resubmit →</Link>
                      )}

                      {/* Add photos to this update (admin + company) */}
                      {canAddPhotos && (
                        <InlineUpload updateId={update._id} onDone={reloadTimeline} />
                      )}

                      {update.resubmissionCount > 0 && (
                        <p className="text-[10px] text-slate-600 mt-2">Resubmitted {update.resubmissionCount}×</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}