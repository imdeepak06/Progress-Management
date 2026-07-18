import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  MapPin,
  Navigation,
  LocateFixed,
  RefreshCw,
  Search,
  Wifi,
  Camera,
  Zap,
  MonitorSmartphone,
  X,
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Great-circle distance between two lat/lng
   points, in kilometres.
───────────────────────────────────────────── */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius (km)
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function crStatusMeta(status) {
  if (status === 'connected') return { label: 'Connected', color: 'text-emerald-400', dot: 'bg-emerald-400' };
  if (status === 'pending') return { label: 'Pending', color: 'text-amber-400', dot: 'bg-amber-400' };
  if (status === 'rejected') return { label: 'Rejected', color: 'text-red-400', dot: 'bg-red-400' };
  return { label: 'Not Connected', color: 'text-slate-500', dot: 'bg-slate-500' };
}

/* ─────────────────────────────────────────────
   Single stat chip (camera / wifi / power)
───────────────────────────────────────────── */
function StatChip({ icon: Icon, iconColor, label, verified, planned }) {
  const notSet = !planned;
  return (
    <div className="flex items-center gap-1.5 bg-surface-200 border border-surface-300 rounded-lg px-2.5 py-1.5">
      <Icon className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0`} />
      <div className="leading-tight">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="text-xs font-semibold text-slate-200">
          {notSet ? 'Not set' : `${verified ?? 0}/${planned}`}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Location card (with rank + distance + directions)
───────────────────────────────────────────── */
function NearestLocationCard({ loc, rank }) {
  const stats = loc.stats || {};
  const camPlanned = loc.cameraConfig?.noOfCameras ?? 0;
  const wifiPlanned = loc.wifiConfig?.noOfWifi ?? 0;
  const powerPlanned = loc.powerConfig?.noOfPower ?? 0;
  const cr = crStatusMeta(loc.controlRoom?.status);

  const openDirections = () => {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    if (loc.__originLat != null && loc.__originLng != null) {
      url.searchParams.set('origin', `${loc.__originLat},${loc.__originLng}`);
    }
    url.searchParams.set('destination', `${loc.latitude},${loc.longitude}`);
    url.searchParams.set('travelmode', 'driving');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
            #{rank}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-100 text-sm leading-snug truncate">{loc.name}</h3>
            <p className="text-xs text-slate-500 truncate">
              {loc.thana}{loc.district ? ` · ${loc.district}` : ''}
            </p>
            {loc.superadmin?.name && (
              <p className="text-[11px] text-purple-400 mt-0.5 truncate">↳ {loc.superadmin.name}</p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display font-bold text-brand-400 text-sm sm:text-base whitespace-nowrap">
            {formatDistance(loc.distanceKm)}
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">away</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatChip icon={Camera} iconColor="text-cyan-400" label="Camera" verified={stats.camera?.verified} planned={camPlanned} />
        <StatChip icon={Wifi} iconColor="text-violet-400" label="WiFi" verified={stats.wifi?.verified} planned={wifiPlanned} />
        <StatChip icon={Zap} iconColor="text-amber-400" label="Power" verified={stats.power?.verified} planned={powerPlanned} />
        <div className="flex items-center gap-1.5 bg-surface-200 border border-surface-300 rounded-lg px-2.5 py-1.5">
          <MonitorSmartphone className={`w-3.5 h-3.5 ${cr.color} flex-shrink-0`} />
          <div className="leading-tight">
            <div className="text-[10px] text-slate-500">Control Room</div>
            <div className={`text-xs font-semibold ${cr.color} flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cr.dot}`} />
              {cr.label}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={openDirections}
        className="btn-primary w-full justify-center py-2.5 text-sm mt-1"
      >
        <Navigation className="w-4 h-4" />
        Get Directions
      </button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-4 sm:p-5 flex flex-col gap-3.5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-300" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-surface-300" />
          <div className="h-2.5 w-1/3 rounded bg-surface-300" />
        </div>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-16 rounded-lg bg-surface-300" />
        ))}
      </div>
      <div className="h-9 rounded-lg bg-surface-300" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function NearestLocationPage() {
  const [locations, setLocations] = useState([]);
  const [loadStatus, setLoadStatus] = useState('loading'); // loading | success | error

  const [origin, setOrigin] = useState(null); // { lat, lng, source }
  const [geoBusy, setGeoBusy] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoadStatus('loading');
    try {
      const { data } = await api.get('/locations');
      setLocations(Array.isArray(data) ? data : []);
      setLoadStatus('success');
    } catch {
      setLoadStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this device/browser');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: 'gps',
        });
        setGeoBusy(false);
        toast.success('Current location fetched');
      },
      (err) => {
        setGeoBusy(false);
        toast.error(err?.message || 'Unable to fetch current location');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const useManualLocation = (e) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 || lat > 90 ||
      lng < -180 || lng > 180
    ) {
      toast.error('Enter a valid latitude (-90 to 90) and longitude (-180 to 180)');
      return;
    }
    setOrigin({ lat, lng, source: 'manual' });
    toast.success('Coordinates set');
  };

  const clearOrigin = () => {
    setOrigin(null);
    setManualLat('');
    setManualLng('');
  };

  const ranked = useMemo(() => {
    if (!origin) return [];
    const q = search.trim().toLowerCase();
    return locations
      .filter((loc) => typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
      .map((loc) => ({
        ...loc,
        distanceKm: haversineKm(origin.lat, origin.lng, loc.latitude, loc.longitude),
        __originLat: origin.lat,
        __originLng: origin.lng,
      }))
      .filter(
        (loc) =>
          !q ||
          loc.name?.toLowerCase().includes(q) ||
          loc.thana?.toLowerCase().includes(q) ||
          loc.district?.toLowerCase().includes(q),
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [locations, origin, search]);

  const missingCoordsCount = locations.filter(
    (l) => typeof l.latitude !== 'number' || typeof l.longitude !== 'number',
  ).length;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-100">Nearest Locations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Find your closest sites, see live infrastructure status and get turn-by-turn directions.
        </p>
      </div>

      {/* Location source card */}
      <div className="card p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-400" />
            Set Your Current Location
          </h2>
          {origin && (
            <button
              onClick={clearOrigin}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {origin ? (
          <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3.5 py-2.5">
            <LocateFixed className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-emerald-300">
              Using {origin.source === 'gps' ? 'device GPS' : 'entered coordinates'}:{' '}
              <span className="font-mono">{origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4">
            {/* Option A: GPS */}
            <div className="flex-1 flex flex-col justify-center items-center text-center gap-3 bg-surface-200 border border-surface-300 rounded-xl px-4 py-5">
              <LocateFixed className="w-6 h-6 text-brand-400" />
              <p className="text-xs text-slate-400 max-w-[220px]">
                Fetch your device's current GPS coordinates automatically.
              </p>
              <button
                onClick={useMyLocation}
                disabled={geoBusy}
                className="btn-primary text-sm px-5 py-2.5 w-full sm:w-auto justify-center"
              >
                {geoBusy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <LocateFixed className="w-4 h-4" />
                    Use My Current Location
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="flex md:flex-col items-center gap-2 text-[11px] text-slate-600 uppercase tracking-wider">
              <span className="flex-1 md:w-px md:h-auto h-px w-auto bg-surface-300" />
              or
              <span className="flex-1 md:w-px md:h-auto h-px w-auto bg-surface-300" />
            </div>

            {/* Option B: Manual entry */}
            <form onSubmit={useManualLocation} className="flex-1 flex flex-col justify-center gap-3 bg-surface-200 border border-surface-300 rounded-xl px-4 py-5">
              <p className="text-xs text-slate-400 text-center md:text-left">
                Or manually enter latitude &amp; longitude.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  className="input text-sm"
                  placeholder="Latitude e.g. 25.4358"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
                <input
                  type="text"
                  inputMode="decimal"
                  className="input text-sm"
                  placeholder="Longitude e.g. 81.8463"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-secondary justify-center py-2.5 text-sm">
                <MapPin className="w-4 h-4" />
                Use These Coordinates
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Search + missing-coords note */}
      {origin && loadStatus === 'success' && locations.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9 text-sm"
              placeholder="Search by name, thana or district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {missingCoordsCount > 0 && (
            <p className="text-[11px] text-slate-500">
              {missingCoordsCount} location{missingCoordsCount > 1 ? 's' : ''} without coordinates hidden.
            </p>
          )}
        </div>
      )}

      {/* Content states */}
      {!origin && (
        <div className="card p-10 text-center text-slate-500">
          <MapPin className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          Set your current location above to see the nearest sites.
        </div>
      )}

      {origin && loadStatus === 'loading' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {origin && loadStatus === 'error' && (
        <div className="card p-10 text-center">
          <p className="text-slate-400 mb-4">Unable to load locations. Please try again.</p>
          <button onClick={load} className="btn-secondary mx-auto">
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {origin && loadStatus === 'success' && ranked.length === 0 && (
        <div className="card p-10 text-center text-slate-500">
          No locations with coordinates found{search ? ' matching your search' : ''}.
        </div>
      )}

      {origin && loadStatus === 'success' && ranked.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ranked.map((loc, i) => (
            <NearestLocationCard key={loc._id} loc={loc} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}