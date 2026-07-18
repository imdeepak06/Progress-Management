import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { format } from 'date-fns';

const StatCard = ({ label, value, sub, color = 'brand', icon }) => (
  <div className="card-sm p-4 hover:border-surface-400 transition-all">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-display font-bold text-${color}-400`}>{value}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-9 h-9 bg-${color}-500/10 rounded-xl flex items-center justify-center text-${color}-400`}>
        {icon}
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [stats,     setStats]     = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([api.get('/locations/stats'), api.get('/locations')])
      .then(([s, l]) => { setStats(s.data); setLocations(l.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center h-64 items-center">
      <div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const camPct  = stats?.camera?.progress ?? 0;
  const wifiPct = stats?.wifi?.progress   ?? 0;
  const powPct  = stats?.power?.progress  ?? 0;
  const totalPlanned  = (stats?.totalPlanned?.camera ?? 0) + (stats?.totalPlanned?.wifi ?? 0) + (stats?.totalPlanned?.power ?? 0);
  const totalVerified = (stats?.camera?.verified ?? 0) + (stats?.wifi?.verified ?? 0) + (stats?.power?.verified ?? 0);
  const overallPct    = totalPlanned > 0 ? Math.min(100, Math.round((totalVerified / totalPlanned) * 100)) : 0;

  const quickActions = [
    ...((user?.role === 'admin') ? [{ label: 'Submit Update', to: '/updates/submit', color: 'brand',   icon: 'M12 4v16m8-8H4' }] : []),
    { label: 'Locations',     to: '/locations',  color: 'cyan',    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' },
    ...(user?.role === 'company' ? [{ label: 'Reviews', to: '/reviews', color: 'amber', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }] : []),
    ...(user?.role === 'company' ? [{ label: 'Users',   to: '/users',   color: 'purple', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }] : []),
    { label: 'Progress',      to: '/progress',   color: 'emerald', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10' },
    { label: 'Timeline',      to: '/timeline',   color: 'violet',  icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-white">
          Welcome, {user?.name} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')} · <span className="capitalize">{user?.role}</span>
        </p>
      </div>

      {/* Overall bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-300">Overall Completion</span>
          <span className="font-display text-2xl font-bold text-brand-400">{overallPct}%</span>
        </div>
        <div className="progress-track-md mb-3">
          <div className="progress-fill bg-gradient-to-r from-brand-600 via-cyan-500 to-emerald-500" style={{ width: `${overallPct}%` }} />
        </div>
        <div className="grid grid-cols-3 text-center gap-2">
          <div>
            <p className="text-lg font-bold text-emerald-400">{totalVerified}</p>
            <p className="text-[11px] text-slate-600">Verified</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-400">{(stats?.camera?.pending ?? 0) + (stats?.wifi?.pending ?? 0) + (stats?.power?.pending ?? 0)}</p>
            <p className="text-[11px] text-slate-600">Pending</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-400">{(stats?.camera?.rejected ?? 0) + (stats?.wifi?.rejected ?? 0) + (stats?.power?.rejected ?? 0)}</p>
            <p className="text-[11px] text-slate-600">Rejected</p>
          </div>
        </div>
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Camera',       pct: camPct,  color: 'cyan',   v: stats?.camera, icon: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', planned: stats?.totalPlanned?.camera ?? 0 },
          { label: 'WiFi',         pct: wifiPct, color: 'violet', v: stats?.wifi,   icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', planned: stats?.totalPlanned?.wifi ?? 0 },
          { label: 'Power Supply', pct: powPct,  color: 'amber',  v: stats?.power,  icon: 'M13 10V3L4 14h7v7l9-11h-7z', planned: stats?.totalPlanned?.power ?? 0 },
        ].map(t => (
          <div key={t.label} className="card-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 bg-${t.color}-500/10 rounded-lg flex items-center justify-center text-${t.color}-400`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-300">{t.label}</span>
              </div>
              <span className={`font-bold text-sm text-${t.color}-400`}>{t.pct}%</span>
            </div>
            <div className="progress-track mb-2">
              <div className={`progress-fill bg-${t.color}-500`} style={{ width: `${t.pct}%` }} />
            </div>
            <p className="text-[11px] text-slate-600">
              {t.v?.verified ?? 0} verified · {t.planned} planned
            </p>
          </div>
        ))}

        {/* Control Room card — binary connected/total */}
        {(() => {
          const connected = locations.filter(l => l.controlRoom?.status === 'connected').length;
          const total     = locations.length;
          const pct       = total > 0 ? Math.round((connected / total) * 100) : 0;
          const isAll     = total > 0 && connected === total;
          return (
            <div className="card-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 ${isAll ? 'bg-emerald-500/10' : 'bg-red-500/10'} rounded-lg flex items-center justify-center`}>
                    <svg className={`w-3.5 h-3.5 ${isAll ? 'text-emerald-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-4.243-4.243a8 8 0 0110.607-10.607M1.394 9.393a12 12 0 0121.213 0" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-300">Ctrl Room</span>
                </div>
                <span className={`font-bold text-sm ${isAll ? 'text-emerald-400' : pct > 0 ? 'text-amber-400' : 'text-red-400'}`}>{pct}%</span>
              </div>
              <div className="progress-track mb-2">
                <div
                  className={`progress-fill ${isAll ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600">{connected} connected · {total} total</p>
            </div>
          );
        })()}
      </div>


      {/* Location table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-slate-200 text-sm">Location-wise Progress</h3>
          <Link to="/dashboard/locations" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-surface-300">
                {['#','Location','Thana','Cam','WiFi','Power','CR'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => (
                <tr key={loc._id} onClick={() => navigate(`/dashboard/locations/${loc._id}`)}
                  className="border-b border-surface-300/50 cursor-pointer hover:bg-surface-200/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-600">{i + 1}</td>
                  <td className="px-4 py-3 text-sm text-slate-200 max-w-[160px] truncate">{loc.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{loc.thana}</td>
                  <td className="px-4 py-3 text-xs text-cyan-400 font-mono font-medium">
                    {loc.stats?.camera?.verified ?? 0}/{loc.cameraConfig?.noOfCameras ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-violet-400 font-mono font-medium">
                    {loc.stats?.wifi?.verified ?? 0}/{loc.wifiConfig?.noOfWifi ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-amber-400 font-mono font-medium">
                    {loc.stats?.power?.verified ?? 0}/{loc.powerConfig?.noOfPower ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {loc.controlRoom?.status === 'connected'
                      ? <span className="text-[10px] font-semibold text-emerald-400">● Yes</span>
                      : loc.controlRoom?.status === 'pending'
                      ? <span className="text-[10px] font-semibold text-amber-400">● Pending</span>
                      : <span className="text-[10px] font-semibold text-red-400">● No</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}