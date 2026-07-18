import { useState, useEffect, useRef } from "react";
import api from "../utils/api";
import toast from "react-hot-toast";

function StatusBadge({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full
      ${ok ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
           : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
      {ok ? (
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
      )}
      {label}
    </span>
  );
}

function ImageSourcePicker({ onCamera, onGallery, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl overflow-hidden">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4" />
        <p className="text-center text-sm font-semibold text-slate-500 mb-4 px-5">Image kahan se lein?</p>
        <div className="grid grid-cols-2 gap-3 px-5 pb-8">
          <button onClick={onCamera}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 active:scale-95 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-sm">Camera</p>
              <p className="text-xs text-slate-500">Live photo lo</p>
            </div>
          </button>

          <button onClick={onGallery}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 active:scale-95 transition-all">
            <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-200">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-sm">Gallery</p>
              <p className="text-xs text-slate-500">Phone se chunein</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function RecceModal({ loc, onClose, onSaved }) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  // ── multi-image state ──────────────────────────────────────────────────────
  // Each entry: { file: File|null, preview: string, existing: bool }
  // "existing" = already on server (from loc.defaultImages), file=null
  const [images, setImages] = useState(() =>
    (loc.defaultImages || []).map((url) => ({ file: null, preview: url, existing: true }))
  );

  const [lat, setLat] = useState(loc.latitude?.toString() || "");
  const [lng, setLng] = useState(loc.longitude?.toString() || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [desc, setDesc] = useState("");

  // Add new files (from camera or gallery)
  const handleImagePick = (files) => {
    if (!files || files.length === 0) return;
    const newEntries = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      existing: false,
    }));
    setImages((prev) => [...prev, ...newEntries]);
    setShowSourcePicker(false);
  };

  // Remove one image by index
  const handleRemoveImage = (idx) => {
    setImages((prev) => {
      const copy = [...prev];
      // revoke blob URL to avoid memory leak
      if (!copy[idx].existing) URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const handleFetchGps = () => {
    if (!navigator.geolocation) { toast.error("Browser geolocation support nahi karta"); return; }
    setFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setFetchingGps(false);
        toast.success("GPS mil gaya!");
      },
      (err) => { setFetchingGps(false); toast.error("GPS nahi mila: " + err.message); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const isValid =
    images.length > 0 &&
    lat.trim() !== "" &&
    lng.trim() !== "" &&
    name.trim() !== "" &&
    phone.trim() !== "";

  const handleSubmit = async () => {
    if (!isValid) { toast.error("Sabhi mandatory fields bharo"); return; }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("latitude", lat);
      formData.append("longitude", lng);
      formData.append("updatedByName", name.trim());
      formData.append("updatedByPhone", phone.trim());
      formData.append("updatedByDescription", desc.trim());

      // Send new (non-existing) files only
      images.forEach(({ file }) => {
        if (file) formData.append("defaultImages", file);
      });

      // Tell backend which existing URLs to keep
      const existingUrls = images.filter((i) => i.existing).map((i) => i.preview);
      existingUrls.forEach((url) => formData.append("keepImages", url));

      const res = await api.patch(`/locations/${loc._id}/recce`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Recce save ho gaya!");
      onSaved(res.data);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save nahi hua");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />

          {/* header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-base leading-snug">{loc.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {loc.thana}{loc.district ? ` · ${loc.district}` : ""}
              </p>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* body */}
          <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

            {/* ── Images Section ───────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                Images <span className="text-rose-500">*</span>
                <span className="ml-auto text-xs font-normal text-slate-400">
                  {images.length} selected
                </span>
              </label>

              {/* Thumbnail strip */}
              {images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 group">
                      <img src={img.preview} alt="" className="w-full h-full object-cover" />
                      {/* Remove button */}
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity shadow"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {/* Existing badge */}
                      {img.existing && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center py-0.5 font-medium">
                          Saved
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add more tile */}
                  <button
                    onClick={() => setShowSourcePicker(true)}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-400 bg-slate-50 hover:bg-orange-50 flex flex-col items-center justify-center gap-1 transition-all flex-shrink-0"
                  >
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[10px] text-slate-400 font-medium">Add</span>
                  </button>
                </div>
              )}

              {/* Empty state — big tap target */}
              {images.length === 0 && (
                <div
                  onClick={() => setShowSourcePicker(true)}
                  className="relative w-full h-44 rounded-2xl border-2 border-dashed border-slate-300 hover:border-orange-400 bg-slate-50 hover:bg-orange-50 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-600">Tap karke images lo</p>
                    <p className="text-xs text-slate-400">Camera ya Gallery se · Multiple allowed</p>
                  </div>
                </div>
              )}

              {/* hidden inputs */}
              {/* Camera: single capture at a time (mobile limitation) */}
              <input type="file" accept="image/*" capture="environment" hidden ref={cameraRef}
                onChange={(e) => handleImagePick(e.target.files)} />
              {/* Gallery: multiple select */}
              <input type="file" accept="image/*" multiple hidden ref={galleryRef}
                onChange={(e) => handleImagePick(e.target.files)} />
            </div>

            {/* GPS */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                GPS Coordinates <span className="text-rose-500">*</span>
              </label>
              <button type="button" onClick={handleFetchGps} disabled={fetchingGps}
                className={`w-full flex items-center justify-center gap-3 py-4 px-5 rounded-2xl font-bold text-base transition-all active:scale-95 shadow-lg
                  ${fetchingGps ? "bg-orange-300 text-white cursor-not-allowed shadow-orange-100"
                               : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200 hover:shadow-orange-300"}`}>
                {fetchingGps ? (
                  <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>GPS dhundh raha hai…</span></>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>GPS se Location Fetch Karo</span>
                  </>
                )}
              </button>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Latitude</p>
                  <input className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                    placeholder="28.123456" value={lat} onChange={(e) => setLat(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Longitude</p>
                  <input className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                    placeholder="77.123456" value={lng} onChange={(e) => setLng(e.target.value)} />
                </div>
              </div>
              {lat && lng && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-mono text-emerald-700">{lat}, {lng}</span>
                </div>
              )}
            </div>

            {/* Person details */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-700 pt-1">Aapki Details</p>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                  Naam <span className="text-rose-500">*</span>
                </label>
                <input className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  placeholder="Aapka poora naam" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                  Phone <span className="text-rose-500">*</span>
                </label>
                <input className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors"
                  placeholder="91XXXXXXXXXX" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1.5">
                  Description <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </label>
                <textarea className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors resize-none"
                  rows={2} placeholder="Kuch note karna ho to likhein…" value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 flex items-center gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving || !isValid}
              className="flex-1 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-lg shadow-orange-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving
                ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : "Save Karo"}
            </button>
          </div>
        </div>
      </div>

      {showSourcePicker && (
        <ImageSourcePicker
          onCamera={() => { setShowSourcePicker(false); cameraRef.current?.click(); }}
          onGallery={() => { setShowSourcePicker(false); galleryRef.current?.click(); }}
          onClose={() => setShowSourcePicker(false)}
        />
      )}
    </>
  );
}

// ── Main Page (unchanged except defaultImages check) ──────────────────────────
export default function ReccePage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedThana, setSelectedThana] = useState("");
  const [modalLoc, setModalLoc] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/locations/yamuna-nagar");
      setLocations(res.data);
    } catch {
      toast.error("Locations load nahi hui");
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (updated) => {
    setLocations((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
  };

  const filtered = locations.filter((l) => {
    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.thana.toLowerCase().includes(search.toLowerCase()) ||
      (l.district || "").toLowerCase().includes(search.toLowerCase());
    const matchThana = selectedThana ? l.thana === selectedThana : true;
    return matchSearch && matchThana;
  });

  const allThanas = [...new Set(locations.map((l) => l.thana).filter(Boolean))].sort();
  // ← updated: complete when has coords + at least 1 image
  const doneCount = locations.filter(
    (l) => l.latitude && l.longitude && l.defaultImages?.length > 0
  ).length;

  if (loading) {
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="w-7 h-7 border-[3px] border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <div className="space-y-5 mx-4 sm:mx-5 py-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">📍 Recce — Locations</h1>
              <p className="text-slate-500 text-sm mt-1">
                {locations.length} sites total ·{" "}
                <span className="text-emerald-600 font-semibold">{doneCount} complete</span>
                {" · "}
                <span className="text-slate-400">{locations.length - doneCount} pending</span>
              </p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
              <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: locations.length ? `${(doneCount / locations.length) * 100}%` : "0%" }} />
            </div>
          </div>

          <div className="relative sm:w-1/2">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input className="w-full border border-slate-200 bg-white rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 shadow-sm transition-colors"
              placeholder="Location search karo…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {allThanas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedThana("")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all
                  ${selectedThana === "" ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600"}`}>
                All Thanas
              </button>
              {allThanas.map((thana) => (
                <button key={thana} onClick={() => setSelectedThana((p) => (p === thana ? "" : thana))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all
                    ${selectedThana === thana ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                             : "bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:text-orange-600"}`}>
                  {thana}
                  <span className={`ml-1.5 text-[10px] ${selectedThana === thana ? "text-orange-100" : "text-slate-400"}`}>
                    {locations.filter((l) => l.thana === thana).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((loc) => {
              const hasCoords = !!(loc.latitude && loc.longitude);
              // ← updated check
              const hasImage = !!(loc.defaultImages?.length > 0);
              const isComplete = hasCoords && hasImage;

              return (
                <div key={loc._id}
                  className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col space-y-3 transition-all hover:shadow-md
                    ${isComplete ? "border-emerald-200 hover:border-emerald-300"
                                 : "border-slate-200 hover:border-orange-200"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${isComplete ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-500"}`}>
                      {isComplete ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{loc.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {loc.thana}{loc.district ? ` · ${loc.district}` : ""}
                      </p>
                      {loc.superadmin && (
                        <p className="text-[11px] text-purple-600 mt-0.5 font-medium">↳ {loc.superadmin.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge ok={hasImage} label={`Images${hasImage ? ` (${loc.defaultImages.length})` : ""}`} />
                    <StatusBadge ok={hasCoords} label="Coordinates" />
                  </div>

                  {isComplete && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 space-y-1">
                      <div className="font-mono text-[10px] text-emerald-700 flex justify-between">
                        <span>Lat: {loc.latitude?.toFixed(6)}</span>
                        <span>Lng: {loc.longitude?.toFixed(6)}</span>
                      </div>
                      {loc.updatedByName && (
                        <p className="text-[10px] text-slate-500 truncate">
                          By: {loc.updatedByName}{loc.updatedByPhone ? ` · ${loc.updatedByPhone}` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex-1" />

                  <button onClick={() => setModalLoc(loc)}
                    className={`w-full justify-center text-sm py-3 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95
                      ${isComplete ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                                   : "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-100"}`}>
                    {isComplete ? (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>Update Karo</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>Recce Karo</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <p className="text-slate-400 font-medium">Koi location nahi mili</p>
            </div>
          )}
        </div>
      </div>

      {modalLoc && (
        <RecceModal loc={modalLoc} onClose={() => setModalLoc(null)} onSaved={handleSaved} />
      )}
    </>
  );
}