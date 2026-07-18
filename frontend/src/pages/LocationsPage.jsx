import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { downloadSvgAsPng, downloadManyAsPng } from '../utils/qrDownload';

// Reusable phone-number tag input (digits + country code, no '+')
function PhoneListInput({ phones, onChange, hint }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const clean = draft.replace(/[^\d]/g, '');
    if (clean.length < 8) { toast.error('Enter number with country code'); return; }
    if (phones.includes(clean)) { setDraft(''); return; }
    onChange([...phones, clean]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          inputMode="tel"
          placeholder="e.g. 919812345678"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="btn-secondary px-3">Add</button>
      </div>
      {hint && <p className="text-[11px] text-slate-600 mt-1">{hint}</p>}
      {phones.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {phones.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 bg-surface-200 border border-surface-400 rounded-lg px-2 py-1 text-[11px] text-slate-300">
              +{p}
              <button type="button" onClick={() => onChange(phones.filter(x => x !== p))}
                className="text-slate-500 hover:text-red-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LocationsPage() {
  const { user } = useAuth();

  const [locations, setLocations] = useState([]);
  const [superadmins, setSuperadmins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterSA, setFilterSA] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [selectedThana, setSelectedThana] = useState('');

  const [saving, setSaving] = useState(false);

  // BULK UPLOAD STATES
  const [uploading, setUploading] = useState(false);

  // QR DOWNLOAD STATES (company only)
  const [qrBusyId, setQrBusyId] = useState(null);     // single-location download in progress
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [allProgress, setAllProgress] = useState({ done: 0, total: 0 });

  // SELF-SERVICE ALERT NUMBERS (company / superadmin catch-all numbers)
  const [myPhones, setMyPhones] = useState([]);
  const [showMyPhones, setShowMyPhones] = useState(false);
  const [savingMyPhones, setSavingMyPhones] = useState(false);

  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    thana: '',
    district: '',
    latitude: '',
    longitude: '',
    noOfCameras: '',
    noOfWifi: '',
    noOfPower: '',
    superadminId: '',
    alertPhones: [],
  });

  useEffect(() => {
    load();
  }, [filterSA]);

  const load = async () => {
    try {
      const params = filterSA ? `?superadminId=${filterSA}` : '';

      const [lRes] = await Promise.all([
        api.get(`/locations${params}`)
      ]);

      setLocations(lRes.data);

      if (user?.role === 'company') {
        const sRes = await api.get('/users/superadmins');
        setSuperadmins(sRes.data);
      }

      // Load my own catch-all alert numbers (company / superadmin)
      if (['company', 'superadmin'].includes(user?.role)) {
        try {
          const me = await api.get('/auth/me');
          setMyPhones(me.data.alertPhones || []);
        } catch {}
      }

    } catch {
      toast.error('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (user?.role === 'company' && !form.superadminId) {
      return toast.error('Select a SuperAdmin');
    }

    setSaving(true);

    try {

      await api.post('/locations', form);

      toast.success('Location added!');

      setShowModal(false);

      setForm({
        name: '',
        thana: '',
        district: '',
        latitude: '',
        longitude: '',
        noOfCameras: '',
        noOfWifi: '',
        noOfPower: '',
        superadminId: '',
        alertPhones: [],
      });

      load();

    } catch (err) {

      toast.error(err.response?.data?.message || 'Failed');

    } finally {

      setSaving(false);

    }
  };

  // BULK EXCEL UPLOAD
  const handleExcelUpload = async (e) => {

    const file = e.target.files[0];

    if (!file) return;


    try {

      setUploading(true);

      const formData = new FormData();

      formData.append('excel', file);

      const res = await api.post(
        '/locations/bulk-upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      toast.success(res.data.message || 'Excel uploaded');

      load();

    } catch (err) {

      toast.error(
        err.response?.data?.message || 'Upload failed'
      );

    } finally {

      setUploading(false);

      e.target.value = '';

    }
  };

  // ── QR DOWNLOAD (company only) ──
  const downloadOneQr = async (loc, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (qrBusyId) return;
    setQrBusyId(loc._id);
    try {
      const { data } = await api.get(`/alerts/qr/${loc._id}`);
      await downloadSvgAsPng(data.svg, data.fileName);
      toast.success('QR downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'QR download failed');
    } finally {
      setQrBusyId(null);
    }
  };

  const downloadAllQr = async () => {
    if (downloadingAll) return;
    setDownloadingAll(true);
    setAllProgress({ done: 0, total: 0 });
    try {
      const params = filterSA ? `?superadminId=${filterSA}` : '';
      const { data } = await api.get(`/alerts/qr/all${params}`);
      if (!data.items?.length) { toast.error('No locations to export'); return; }
      setAllProgress({ done: 0, total: data.count });
      await downloadManyAsPng(data.items, (done, total) => setAllProgress({ done, total }));
      toast.success(`${data.count} QR codes downloaded`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk QR download failed');
    } finally {
      setDownloadingAll(false);
      setAllProgress({ done: 0, total: 0 });
    }
  };

  const saveMyPhones = async (next) => {
    setSavingMyPhones(true);
    try {
      const { data } = await api.put('/users/me/alert-phones', { alertPhones: next });
      setMyPhones(data.alertPhones);
      toast.success('Alert numbers updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSavingMyPhones(false);
    }
  };

  // Unique thanas from all locations
  const allThanas = [
    ...new Set(
      locations.map(l => l.thana).filter(Boolean)
    ),
  ].sort();

  const filtered = locations.filter(l => {

    const matchSearch =
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.thana.toLowerCase().includes(search.toLowerCase()) ||
      (l.district || '')
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchThana =
      selectedThana ? l.thana === selectedThana : true;

    return matchSearch && matchThana;
  });

  if (loading) {
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Locations
          </h1>

          <p className="text-slate-500 text-sm mt-0.5">
            {locations.length} sites total
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          {/* COMPANY ONLY: DOWNLOAD ALL QR */}
          {user?.role === 'company' && (
            <button
              type="button"
              disabled={downloadingAll}
              onClick={downloadAllQr}
              className="btn-secondary self-start sm:self-auto"
            >
              {downloadingAll ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {allProgress.total ? `${allProgress.done}/${allProgress.total}` : 'Preparing…'}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Download All QR
                </>
              )}
            </button>
          )}

          {/* COMPANY ONLY BULK UPLOAD */}
          {user?.role === 'company' && (
            <>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={handleExcelUpload}
              />

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="btn-secondary self-start sm:self-auto"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>

                    Upload Excel
                  </>
                )}
              </button>
            </>
          )}

          {/* ADD LOCATION */}
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary self-start sm:self-auto"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>

            Add Location
          </button>

        </div>
      </div>

      {/* COMPANY ONLY EXCEL INSTRUCTIONS */}
{user?.role === 'company' && (
  <div className="card p-4 border border-brand-500/20 bg-brand-500/5">

    <div className="flex items-start gap-3">

      <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 shrink-0">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      <div className="flex-1">

        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Excel Upload Instructions
        </h3>

        <div className="space-y-2 text-xs text-slate-400 leading-relaxed">

          <p>
            Upload only{" "}
            <span className="text-white font-medium">
              .xlsx
            </span>{" "}
            or{" "}
            <span className="text-white font-medium">
              .xls
            </span>{" "}
            files.
          </p>

          <p className="text-slate-300 font-medium">
            Required Excel Columns:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

            {[
              'name',
              'thana',
              'district',
              'latitude',
              'longitude',
              'noOfCameras',
              'noOfWifi',
              'noOfPower',
              'superadminEmail',
            ].map((col) => (

              <div
                key={col}
                className="bg-surface-200 border border-surface-300 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-300"
              >
                {col}
              </div>

            ))}
          </div>

          <div className="pt-2 space-y-1">

            <p>
              •{" "}
              <span className="text-white">
                name
              </span>{" "}
              and{" "}
              <span className="text-white">
                thana
              </span>{" "}
              are compulsory.
            </p>

            <p>
              •{" "}
              <span className="text-white">
                superadminEmail
              </span>{" "}
              must match an existing SuperAdmin email.
            </p>

            <p>
              • Images are NOT uploaded using Excel.
            </p>

            <p>
              • Images will be uploaded manually to Cloudinary later.
            </p>

          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Search + SuperAdmin filter row */}
      <div className="flex flex-col sm:flex-row gap-2">

        <div className="relative sm:w-1/2">

          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>

          <input
            className="input pl-9"
            placeholder="Search locations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {user?.role === 'company' && superadmins.length > 0 && (
          <select
            className="select sm:w-52"
            value={filterSA}
            onChange={e => setFilterSA(e.target.value)}
          >
            <option value="">
              All SuperAdmins
            </option>

            {superadmins.map(s => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* SELF-SERVICE: my catch-all alert numbers (company / superadmin) */}
      {['company', 'superadmin'].includes(user?.role) && (
        <div className="card p-4">
          <button
            type="button"
            onClick={() => setShowMyPhones(v => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {user?.role === 'company' ? 'Company Alert Numbers' : 'My Alert Numbers'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {user?.role === 'company'
                    ? 'Receive WhatsApp alerts from ALL locations'
                    : 'Receive WhatsApp alerts from ALL your locations'}
                  {' · '}{myPhones.length} number{myPhones.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <svg className={`w-4 h-4 text-slate-500 transition-transform ${showMyPhones ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showMyPhones && (
            <div className="mt-4 pt-4 border-t border-surface-300">
              <PhoneListInput
                phones={myPhones}
                onChange={saveMyPhones}
                hint="Include country code, no '+'. Saved instantly. These get alerts from every location."
              />
              {savingMyPhones && <p className="text-[11px] text-brand-400 mt-2">Saving…</p>}
            </div>
          )}
        </div>
      )}

      {/* Thana filter chips */}
      {allThanas.length > 0 && (
        <div className="flex flex-wrap gap-2">

          <button
            onClick={() => setSelectedThana('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
              ${selectedThana === ''
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-surface-200 text-slate-400 border-surface-400 hover:text-slate-200 hover:border-surface-500'
              }`}
          >
            All Thanas
          </button>

          {allThanas.map(thana => (
            <button
              key={thana}
              onClick={() =>
                setSelectedThana(prev =>
                  prev === thana ? '' : thana
                )
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
                ${selectedThana === thana
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-surface-200 text-slate-400 border-surface-400 hover:text-slate-200 hover:border-surface-500'
                }`}
            >
              {thana}

              <span
                className={`ml-1.5 text-[10px] font-mono ${
                  selectedThana === thana
                    ? 'text-white/70'
                    : 'text-slate-600'
                }`}
              >
                {
                  locations.filter(
                    l => l.thana === thana
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">

        {filtered.map((loc, idx) => {

          const s = loc.stats;

          return (
            <Link
              key={loc._id}
              to={`/dashboard/locations/${loc._id}`}
              className="card p-5 hover:border-surface-500 hover:bg-surface-200/30 transition-all duration-200 group slide-up"
              style={{ animationDelay: `${idx * 20}ms` }}
            >

              <div className="flex items-start justify-between mb-3">

                <div className="w-9 h-9 bg-brand-500/10 rounded-xl flex items-center justify-center text-brand-400 group-hover:bg-brand-500/20 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                  </svg>
                </div>

                <div className="flex items-center gap-2">
                  {user?.role === 'company' && (
                    <button
                      type="button"
                      onClick={(e) => downloadOneQr(loc, e)}
                      disabled={qrBusyId === loc._id}
                      title="Download QR code"
                      className="w-7 h-7 rounded-lg bg-surface-300 hover:bg-brand-500/20 text-slate-400 hover:text-brand-300 flex items-center justify-center transition-colors"
                    >
                      {qrBusyId === loc._id ? (
                        <div className="w-3.5 h-3.5 border-2 border-brand-400/40 border-t-brand-400 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m-3 3h6m0-6v.01M17 14h.01" />
                        </svg>
                      )}
                    </button>
                  )}
                  <span className="text-[11px] text-slate-600">
                    #{idx + 1}
                  </span>
                </div>
              </div>

              <h3 className="font-semibold text-slate-100 text-sm mb-0.5 group-hover:text-brand-300 transition-colors leading-snug">
                {loc.name}
              </h3>

              <p className="text-xs text-slate-500 mb-1">
                {loc.thana} · {loc.district}
              </p>

              {loc.superadmin && (
                <p className="text-[11px] text-purple-400 mb-3">
                  ↳ {loc.superadmin.name}
                </p>
              )}

              {/* Planned row */}
              <div className="flex flex-wrap gap-2 text-[11px] mb-3">
                <span className="text-cyan-400">
                  📷 {loc.cameraConfig?.noOfCameras ?? 0}
                </span>

                <span className="text-violet-400">
                  📡 {loc.wifiConfig?.noOfWifi ?? 0}
                </span>

                <span className="text-amber-400">
                  ⚡ {loc.powerConfig?.noOfPower ?? 0}
                </span>
              </div>

              {/* Progress bars */}
              {s && (
                <div className="space-y-1.5 pt-3 border-t border-surface-300">

                  {[
                    {
                      label: 'Cam',
                      v: s.camera?.verified ?? 0,
                      p: s.planned?.camera ?? 0,
                      pct: s.camera?.progress ?? 0,
                      c: 'bg-cyan-500',
                      full: s.camera?.full,
                    },
                    {
                      label: 'WiFi',
                      v: s.wifi?.verified ?? 0,
                      p: s.planned?.wifi ?? 0,
                      pct: s.wifi?.progress ?? 0,
                      c: 'bg-violet-500',
                      full: s.wifi?.full,
                    },
                    {
                      label: 'Power',
                      v: s.power?.verified ?? 0,
                      p: s.planned?.power ?? 0,
                      pct: s.power?.progress ?? 0,
                      c: 'bg-amber-500',
                      full: s.power?.full,
                    },
                  ].map(row => (
                    <div key={row.label}>

                      <div className="flex justify-between text-[10px] mb-0.5">

                        <span className="text-slate-600 flex items-center gap-1">
                          {row.label}

                          {row.full && (
                            <span className="text-emerald-400">
                              ✓
                            </span>
                          )}
                        </span>

                        <span className="text-slate-500 font-mono">
                          {row.v}/{row.p}
                        </span>
                      </div>

                      <div className="progress-track">
                        <div
                          className={`progress-fill ${
                            row.full
                              ? 'bg-emerald-500'
                              : row.c
                          }`}
                          style={{
                            width: `${row.pct}%`,
                          }}
                        />
                      </div>

                    </div>
                  ))}

                  {/* Control Room row */}
                  {(() => {
                    const crStatus = loc.controlRoom?.status || 'not_connected';
                    const isConnected = crStatus === 'connected';
                    const isPending   = crStatus === 'pending';
                    const barColor = isConnected ? 'bg-emerald-500' : 'bg-red-500';
                    const labelColor = isConnected ? 'text-emerald-400' : isPending ? 'text-amber-400' : 'text-red-400';
                    const label = isConnected ? 'Connected ✓' : isPending ? 'Pending…' : 'Not Connected';
                    return (
                      <div>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className={`flex items-center gap-1 ${labelColor}`}>
                            📡 Ctrl Room
                          </span>
                          <span className={`font-semibold ${labelColor}`}>{label}</span>
                        </div>
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${barColor} transition-all duration-300`}
                            style={{ width: isConnected ? '100%' : isPending ? '15%' : '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center text-slate-600">
          No locations found
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">

          <div className="card w-full sm:max-w-lg rounded-b-none sm:rounded-2xl max-h-[90vh] overflow-y-auto">

            <div className="card-header flex items-center justify-between sticky top-0 bg-surface-100 z-10">

              <h3 className="font-semibold text-slate-100">
                Add Location
              </h3>

              <button
                onClick={() => setShowModal(false)}
                className="btn-ghost p-1 rounded-lg"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-5 space-y-4"
            >

              {user?.role === 'company' && (
                <div>

                  <label className="label">
                    SuperAdmin *
                  </label>

                  <select
                    className="select"
                    required
                    value={form.superadminId}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        superadminId: e.target.value
                      }))
                    }
                  >
                    <option value="">
                      Select SuperAdmin
                    </option>

                    {superadmins.map(s => (
                      <option
                        key={s._id}
                        value={s._id}
                      >
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div className="sm:col-span-2">
                  <label className="label">
                    Location Name *
                  </label>

                  <input
                    className="input"
                    placeholder="Main Market Gate"
                    required
                    value={form.name}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        name: e.target.value
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label">
                    Thana *
                  </label>

                  <input
                    className="input"
                    placeholder="Kotwali"
                    required
                    value={form.thana}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        thana: e.target.value
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label">
                    District
                  </label>

                  <input
                    className="input"
                    placeholder="Noida"
                    value={form.district}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        district: e.target.value
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label">
                    Latitude
                  </label>

                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="28.6139"
                    value={form.latitude}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        latitude: e.target.value
                      }))
                    }
                  />
                </div>

                <div>
                  <label className="label">
                    Longitude
                  </label>

                  <input
                    type="number"
                    step="any"
                    className="input"
                    placeholder="77.2090"
                    value={form.longitude}
                    onChange={e =>
                      setForm(f => ({
                        ...f,
                        longitude: e.target.value
                      }))
                    }
                  />
                </div>

                {(['company','superadmin'].includes(user?.role)) && (
                  <div className="sm:col-span-2">
                    <label className="label">Alert Phone Numbers (WhatsApp)</label>
                    <PhoneListInput
                      phones={form.alertPhones}
                      onChange={(arr) => setForm(f => ({ ...f, alertPhones: arr }))}
                      hint="These numbers get WhatsApp alerts for THIS location only. Include country code, no '+'."
                    />
                  </div>
                )}

                {(['company','superadmin','admin'].includes(user?.role)) && (
                  <div>
                    <label className="label">
                      No. of Cameras
                    </label>

                    <input
                      type="number"
                      min="0"
                      className="input"
                      placeholder="0"
                      value={form.noOfCameras}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          noOfCameras: e.target.value
                        }))
                      }
                    />
                  </div>
                )}

                {(['company','superadmin','admin'].includes(user?.role)) && (
                  <div>
                    <label className="label">
                      No. of WiFi
                    </label>

                    <input
                      type="number"
                      min="0"
                      className="input"
                      placeholder="0"
                      value={form.noOfWifi}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          noOfWifi: e.target.value
                        }))
                      }
                    />
                  </div>
                )}

                {(['company','superadmin','admin'].includes(user?.role)) && (
                  <div>
                    <label className="label">
                      No. of Power Supply
                    </label>

                    <input
                      type="number"
                      min="0"
                      className="input"
                      placeholder="0"
                      value={form.noOfPower}
                      onChange={e =>
                        setForm(f => ({
                          ...f,
                          noOfPower: e.target.value
                        }))
                      }
                    />
                  </div>
                )}

              </div>

              <div className="flex gap-3 pt-2">

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 justify-center"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Add Location'
                  )}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}