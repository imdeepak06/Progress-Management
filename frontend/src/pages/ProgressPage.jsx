import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function ProgressPage() {
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

  const totalPlanned  = (stats?.totalPlanned?.camera ?? 0) + (stats?.totalPlanned?.wifi ?? 0) + (stats?.totalPlanned?.power ?? 0);
  const totalVerified = (stats?.camera?.verified ?? 0) + (stats?.wifi?.verified ?? 0) + (stats?.power?.verified ?? 0);
  const overallPct    = totalPlanned > 0 ? Math.min(100, Math.round((totalVerified / totalPlanned) * 100)) : 0;

  const types = [
    { key: 'camera',    label: 'Camera',    color: 'cyan',   bg: 'bg-cyan-500',   icon: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',    planned: stats?.totalPlanned?.camera    ?? 0, data: stats?.camera    },
    { key: 'wifi',      label: 'WiFi',      color: 'violet', bg: 'bg-violet-500', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', planned: stats?.totalPlanned?.wifi      ?? 0, data: stats?.wifi      },
    { key: 'power', label: 'Power Supply', color: 'amber', bg: 'bg-amber-500', icon: 'M13 10V3L4 14h7v7l9-11h-7z',                                                                                                               planned: stats?.totalPlanned?.power ?? 0, data: stats?.power },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Project Progress</h1>
        <p className="text-slate-500 text-sm mt-0.5">Overall installation completion</p>
      </div>

      {/* Overall */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200">Overall Completion</h3>
          <span className="font-display text-3xl font-bold text-brand-400">{overallPct}%</span>
        </div>
        <div className="progress-track-md mb-4">
          <div className="progress-fill bg-gradient-to-r from-brand-600 via-cyan-500 to-emerald-500"
            style={{ width: `${overallPct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400">{totalVerified}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">Verified</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-amber-400">
              {(stats?.camera?.pending ?? 0) + (stats?.wifi?.pending ?? 0) + (stats?.power?.pending ?? 0)}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">Pending</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-red-400">
              {(stats?.camera?.rejected ?? 0) + (stats?.wifi?.rejected ?? 0) + (stats?.power?.rejected ?? 0)}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">Rejected</p>
          </div>
        </div>
      </div>

      {/* Per-type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {types.map(t => (
          <div key={t.key} className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 bg-${t.color}-500/10 rounded-xl flex items-center justify-center text-${t.color}-400 flex-shrink-0`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-200 text-sm">{t.label}</h3>
                <p className="text-[11px] text-slate-600">{t.data?.verified ?? 0} / {t.planned} planned</p>
              </div>
              <span className={`font-bold text-${t.color}-400 text-lg`}>{t.data?.progress ?? 0}%</span>
            </div>
            <div className="progress-track-md mb-3">
              <div className={`progress-fill ${t.bg}`} style={{ width: `${t.data?.progress ?? 0}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
              <div className="bg-surface-200 rounded-lg py-1.5">
                <p className="text-emerald-400 font-bold">{t.data?.verified ?? 0}</p>
                <p className="text-slate-600">Verified</p>
              </div>
              <div className="bg-surface-200 rounded-lg py-1.5">
                <p className="text-amber-400 font-bold">{t.data?.pending ?? 0}</p>
                <p className="text-slate-600">Pending</p>
              </div>
              <div className="bg-surface-200 rounded-lg py-1.5">
                <p className="text-red-400 font-bold">{t.data?.rejected ?? 0}</p>
                <p className="text-slate-600">Rejected</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Location table */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-slate-200 text-sm">Location-wise Progress</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-surface-300">
                {['#','Location','Thana','SuperAdmin','Cam','WiFi','Gen','Cam %','WiFi %','Gen %'].map(h => (
                  <th key={h} className="text-left px-3 sm:px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => {
                const cp = loc.stats?.camera?.progress    ?? 0;
                const wp = loc.stats?.wifi?.progress      ?? 0;
                const gp = loc.stats?.power?.progress ?? 0;
                const cf = loc.stats?.camera?.full;
                const wf = loc.stats?.wifi?.full;
                const gf = loc.stats?.power?.full;
                return (
                  <tr key={loc._id} className="border-b border-surface-300/40 hover:bg-surface-200/40 transition-colors">
                    <td className="px-3 sm:px-4 py-2.5 text-xs text-slate-600">{i + 1}</td>
                    <td className="px-3 sm:px-4 py-2.5">
                      <Link to={`/dashboard/locations/${loc._id}`} className="text-sm text-slate-200 hover:text-brand-300 transition-colors max-w-[140px] truncate block">
                        {loc.name}
                      </Link>
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-xs text-slate-500">{loc.thana}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-xs text-purple-400">{loc.superadmin?.name || '—'}</td>
                    <td className="px-3 sm:px-4 py-2.5 text-xs text-cyan-400 font-mono font-medium">
                      {loc.stats?.camera?.verified ?? 0}/{loc.cameraConfig?.noOfCameras ?? 0}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-xs text-violet-400 font-mono font-medium">
                      {loc.stats?.wifi?.verified ?? 0}/{loc.wifiConfig?.noOfWifi ?? 0}
                    </td>
                    <td className="px-3 sm:px-4 py-2.5 text-xs text-amber-400 font-mono font-medium">
                      {loc.stats?.power?.verified ?? 0}/{loc.powerConfig?.noOfPower ?? 0}
                    </td>
                    {[{ pct: cp, full: cf, c: 'bg-cyan-500' }, { pct: wp, full: wf, c: 'bg-violet-500' }, { pct: gp, full: gf, c: 'bg-amber-500' }].map((bar, bi) => (
                      <td key={bi} className="px-3 sm:px-4 py-2.5 w-24">
                        <div className="flex items-center gap-1.5">
                          <div className="progress-track flex-1">
                            <div className={`progress-fill ${bar.full ? 'bg-emerald-500' : bar.c}`} style={{ width: `${bar.pct}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-600 w-6 text-right font-mono">{bar.pct}%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}