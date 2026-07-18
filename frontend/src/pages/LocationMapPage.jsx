import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L, { LatLngBounds } from "leaflet";
import api from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix default leaflet icon
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Auto fit bounds
function FitBounds({ locations }) {
  const map = useMap();

  useEffect(() => {
    if (!locations.length) return;

    const bounds = new LatLngBounds(
      locations.map((loc) => [loc.latitude, loc.longitude])
    );

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 14,
    });
  }, [locations, map]);

  return null;
}

const SA_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#ea580c",
  "#059669",
  "#db2777",
  "#ca8a04",
  "#4f46e5",
];

// Custom responsive marker
// Replace ONLY createCustomIcon function with this

const createCustomIcon = (name, color = "#2563eb") =>
  L.divIcon({
    className: "custom-map-marker",
    html: `
      <div class="marker-container">

        <!-- Pulse Ring -->
        <div 
          class="marker-pulse"
          style="background:${color}22;"
        ></div>

        <!-- Main Pin -->
        <div 
          class="marker-pin"
          style="
            background:linear-gradient(135deg, ${color}, ${color}dd);
            box-shadow:
              0 10px 24px ${color}55,
              0 4px 10px rgba(0,0,0,0.22);
          "
        >
          <div class="marker-inner-dot"></div>
        </div>

        <!-- Label -->
        <div class="marker-label">
          ${name}
        </div>

      </div>
    `,
    iconSize: [190, 70],
    iconAnchor: [95, 30],
    popupAnchor: [0, -28],
  });

export default function LocationsMapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [locations, setLocations] = useState([]);
  const [superadmins, setSuperadmins] = useState([]);
  const [selectedSA, setSelectedSA] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);

        const params = selectedSA
          ? `?superadminId=${selectedSA}`
          : "";

        const { data: locs } = await api.get(`/locations${params}`);

        setLocations(locs);

        if (user?.role === "company" && superadmins.length === 0) {
          const { data: sas } = await api.get("/users/superadmins");
          setSuperadmins(sas);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [selectedSA]);

  const validLocs = locations.filter(
    (l) => l.latitude && l.longitude
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* Responsive Marker CSS */}
      <style>
        {`
          /* REPLACE old marker css with this */

.custom-map-marker .marker-container{
  position:relative;
  display:flex;
  flex-direction:column;
  align-items:center;
  pointer-events:none;
}

/* Animated pulse */
.custom-map-marker .marker-pulse{
  position:absolute;
  top:2px;
  width:28px;
  height:28px;
  border-radius:999px;
  animation:markerPulse 2s infinite;
  backdrop-filter:blur(1px);
}

/* Main pin */
.custom-map-marker .marker-pin{
  position:relative;
  width:24px;
  height:24px;
  border-radius:999px;
  border:3px solid rgba(255,255,255,0.95);

  display:flex;
  align-items:center;
  justify-content:center;

  transform:translateY(2px);
}

/* White center */
.custom-map-marker .marker-inner-dot{
  width:7px;
  height:7px;
  background:white;
  border-radius:999px;
}

/* Label */
.custom-map-marker .marker-label{
  margin-top:10px;

  background:rgba(255,255,255,0.97);
  backdrop-filter:blur(10px);

  color:#0f172a;
  font-weight:700;

  font-size:clamp(12px,0.9vw,15px);

  font-family:DM Sans,system-ui,sans-serif;

  padding:6px 12px;

  border-radius:999px;

  white-space:nowrap;
  max-width:180px;
  overflow:hidden;
  text-overflow:ellipsis;

  border:1px solid rgba(255,255,255,0.6);

  box-shadow:
    0 6px 18px rgba(0,0,0,0.12),
    inset 0 1px 0 rgba(255,255,255,0.7);

  line-height:1.3;

  transition:all 0.25s ease;
}

/* Hover effect */
.custom-map-marker:hover .marker-label{
  transform:translateY(-2px) scale(1.03);
  box-shadow:
    0 10px 24px rgba(0,0,0,0.16),
    inset 0 1px 0 rgba(255,255,255,0.8);
}

/* Pulse animation */
@keyframes markerPulse{
  0%{
    transform:scale(0.7);
    opacity:0.8;
  }

  70%{
    transform:scale(1.8);
    opacity:0;
  }

  100%{
    transform:scale(1.8);
    opacity:0;
  }
}

/* Mobile */
@media (max-width:640px){

  .custom-map-marker .marker-pin{
    width:20px;
    height:20px;
  }

  .custom-map-marker .marker-inner-dot{
    width:6px;
    height:6px;
  }

  .custom-map-marker .marker-label{
    font-size:12px;
    padding:5px 10px;
    max-width:120px;
  }

  .custom-map-marker .marker-pulse{
    width:24px;
    height:24px;
  }
}
        `}
      </style>

      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-surface-50 border-b border-surface-300 flex-shrink-0">

        <div>
          <h1 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
            Locations Map
          </h1>

          <p className="text-slate-500 text-xs mt-0.5">
            {validLocs.length} location
            {validLocs.length !== 1 ? "s" : ""} on map

            {selectedSA && superadmins.length > 0 && (
              <span className="text-purple-400 ml-1">
                ·{" "}
                {
                  superadmins.find(
                    (s) => s._id === selectedSA
                  )?.name
                }
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap w-full lg:w-auto">

          {user?.role === "company" &&
            superadmins.length > 0 && (
              <select
                className="select text-sm py-2 w-full sm:w-56"
                value={selectedSA}
                onChange={(e) =>
                  setSelectedSA(e.target.value)
                }
              >
                <option value="">
                  All SuperAdmins
                </option>

                {superadmins.map((sa) => (
                  <option
                    key={sa._id}
                    value={sa._id}
                  >
                    {sa.name}
                  </option>
                ))}
              </select>
            )}

          {user?.role === "company" &&
            !selectedSA &&
            superadmins.length > 1 && (
              <div className="flex flex-wrap gap-2">

                {superadmins.map((sa, i) => (
                  <button
                    key={sa._id}
                    onClick={() =>
                      setSelectedSA(sa._id)
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-400 hover:border-surface-500 transition-all text-[11px] text-slate-300"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{
                        background:
                          SA_COLORS[
                            i % SA_COLORS.length
                          ],
                      }}
                    />

                    {sa.name}
                  </button>
                ))}
              </div>
            )}

          {selectedSA && (
            <button
              onClick={() => setSelectedSA("")}
              className="btn-ghost text-xs py-1.5"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Map Section */}
      <div className="flex-1 relative min-h-0">

        {/* Loader */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-0/80 z-[1000]">
            <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <MapContainer
          center={[25.45, 81.85]}
          zoom={6}
          className="h-full w-full"
        >

          {/* Auto fit bounds */}
          <FitBounds locations={validLocs} />

          {/* Tile */}
          <TileLayer
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Markers */}
          {validLocs.map((loc) => {

            const saIndex = superadmins.findIndex(
              (sa) =>
                sa._id ===
                (loc.superadmin?._id ||
                  loc.superadmin)
            );

            const markerColor =
              user?.role === "company" &&
              !selectedSA &&
              saIndex >= 0
                ? SA_COLORS[
                    saIndex % SA_COLORS.length
                  ]
                : "#2563eb";

            return (
              <Marker
                key={loc._id}
                position={[
                  loc.latitude,
                  loc.longitude,
                ]}
                icon={createCustomIcon(
                  loc.name,
                  markerColor
                )}
                eventHandlers={{
                  click: () =>
                    navigate(
                      `/dashboard/locations/${loc._id}`
                    ),
                }}
              >
                <Popup className="custom-popup">

                  <div
                    style={{
                      background: "#ffffff",
                      border:
                        "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "14px",
                      minWidth: "220px",
                      fontFamily:
                        "DM Sans, system-ui, sans-serif",
                      boxShadow:
                        "0 6px 20px rgba(0,0,0,0.12)",
                    }}
                  >

                    <p
                      style={{
                        color: "#0f172a",
                        fontWeight: 700,
                        fontSize: "14px",
                        marginBottom: "4px",
                      }}
                    >
                      {loc.name}
                    </p>

                    <p
                      style={{
                        color: "#64748b",
                        fontSize: "11px",
                        marginBottom: "3px",
                      }}
                    >
                      {loc.thana}
                      {loc.district
                        ? ` · ${loc.district}`
                        : ""}
                    </p>

                    {loc.superadmin && (
                      <p
                        style={{
                          color: "#7c3aed",
                          fontSize: "11px",
                          marginBottom: "10px",
                        }}
                      >
                        ↳ {loc.superadmin.name}
                      </p>
                    )}

                    {/* Stats */}
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          color: "#0891b2",
                          fontSize: "11px",
                        }}
                      >
                        📷{" "}
                        {loc.cameraConfig
                          ?.noOfCameras ?? 0}
                      </span>

                      <span
                        style={{
                          color: "#7c3aed",
                          fontSize: "11px",
                        }}
                      >
                        📡{" "}
                        {loc.wifiConfig
                          ?.noOfWifi ?? 0}
                      </span>

                      <span
                        style={{
                          color: "#ea580c",
                          fontSize: "11px",
                        }}
                      >
                        ⚡{" "}
                        {loc.powerConfig
                          ?.noOfPower ?? 0}
                      </span>
                    </div>

                    {/* Progress */}
                    {loc.stats && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                          marginBottom: "12px",
                        }}
                      >
                        {[
                          {
                            label: "Cam",
                            pct:
                              loc.stats.camera
                                ?.progress ?? 0,
                            color: "#0891b2",
                          },
                          {
                            label: "WiFi",
                            pct:
                              loc.stats.wifi
                                ?.progress ?? 0,
                            color: "#7c3aed",
                          },
                          {
                            label: "Power",
                            pct:
                              loc.stats.power
                                ?.progress ?? 0,
                            color: "#ea580c",
                          },
                        ].map((bar) => (
                          <div
                            key={bar.label}
                            style={{
                              display: "flex",
                              alignItems:
                                "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                color: "#94a3b8",
                                fontSize: "10px",
                                width: "28px",
                              }}
                            >
                              {bar.label}
                            </span>

                            <div
                              style={{
                                flex: 1,
                                height: "5px",
                                background:
                                  "#e2e8f0",
                                borderRadius:
                                  "999px",
                                overflow:
                                  "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${bar.pct}%`,
                                  background:
                                    bar.color,
                                  borderRadius:
                                    "999px",
                                  transition:
                                    "width 0.6s ease",
                                }}
                              />
                            </div>

                            <span
                              style={{
                                color: "#94a3b8",
                                fontSize: "10px",
                                width: "30px",
                                textAlign:
                                  "right",
                              }}
                            >
                              {bar.pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Button */}
                    <button
                      onClick={() =>
                        navigate(
                          `/dashboard/locations/${loc._id}`
                        )
                      }
                      style={{
                        background: "#2563eb",
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      View Details →
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Empty State */}
        {!loading &&
          validLocs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">

              <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl px-6 py-4 text-center shadow-lg">

                <p className="text-slate-500 text-sm">
                  No locations with coordinates
                  found
                </p>

                <p className="text-slate-400 text-xs mt-1">
                  Add lat/long when creating
                  locations
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}