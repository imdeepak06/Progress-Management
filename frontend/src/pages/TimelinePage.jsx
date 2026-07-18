import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { format, formatDistanceToNow } from 'date-fns';

const typeIcon = { camera: '📷', wifi: '📡', power: '⚡' };
const typeColor = {
  camera:    { dot: 'border-cyan-500   bg-cyan-500/15   text-cyan-400'   },
  wifi:      { dot: 'border-violet-500 bg-violet-500/15 text-violet-400' },
  power: { dot: 'border-amber-500 bg-amber-500/15 text-amber-400' },
};

export default function TimelinePage() {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState({ type: '', status: '' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams();
        if (filter.type)   p.append('type',   filter.type);
        if (filter.status) p.append('status', filter.status);
        const { data } = await api.get(`/updates?${p}`);
        setUpdates(data);
      } catch { }
      finally { setLoading(false); }
    };
    load();
  }, [filter]);

  // Group by date
  const grouped = updates.reduce((acc, u) => {
    const key = format(new Date(u.createdAt), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});
  const days = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Activity Timeline</h1>
          <p className="text-slate-500 text-sm mt-0.5">{updates.length} activities</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['','camera','wifi','power'].map(t => (
            <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${filter.type === t ? 'bg-brand-500 text-white' : 'bg-surface-300 text-slate-500 hover:text-slate-200'}`}>
              {t || 'All'}
            </button>
          ))}
          {['','pending','verified','rejected'].map(s => (
            <button key={s} onClick={() => setFilter(f => ({ ...f, status: s }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                ${filter.status === s ? 'bg-brand-500 text-white' : 'bg-surface-300 text-slate-500 hover:text-slate-200'}`}>
              {s || 'All Status'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center"><div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : days.length === 0 ? (
        <div className="card p-12 text-center text-slate-600">No activities</div>
      ) : (
        <div className="space-y-8">
          {days.map(day => (
            <div key={day}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-surface-300 border border-surface-400 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 flex-shrink-0">
                  {format(new Date(day), 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="flex-1 h-px bg-surface-400" />
                <span className="text-[11px] text-slate-600 flex-shrink-0">{grouped[day].length} item{grouped[day].length !== 1 ? 's' : ''}</span>
              </div>

              {/* Entries */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-surface-400" />
                <div className="space-y-3">
                  {grouped[day].map(u => {
                    const tc = typeColor[u.type] || { dot: 'border-slate-500 bg-slate-500/15 text-slate-400' };
                    return (
                      <div key={u._id} className="relative pl-12">
                        <div className={`absolute left-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm z-10 ${
                          u.status === 'verified' ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400' :
                          u.status === 'rejected' ? 'bg-red-500/15 border-red-500 text-red-400' : tc.dot
                        }`}>{typeIcon[u.type]}</div>

                        <div className="card-sm p-4 hover:border-surface-500 transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2 justify-between">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className={`badge-${u.status}`}>{u.status}</span>
                                <span className={`badge-${u.type}`}>{u.type}</span>
                                {u.installedCount > 1 && <span className="text-[10px] font-semibold text-emerald-400">×{u.installedCount}</span>}
                                {u.resubmissionCount > 0 && <span className="text-[10px] text-slate-600">resub #{u.resubmissionCount}</span>}
                              </div>
                              <h4 className="font-medium text-slate-200 text-sm">{u.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{u.description}</p>
                            </div>
                            <div className="text-right text-[11px] text-slate-600 flex-shrink-0">
                              <div className="text-slate-400">{format(new Date(u.createdAt), 'HH:mm')}</div>
                              <div>{formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-300">
                            <div className="text-[11px] text-slate-600">
                              <Link to={`/dashboard/locations/${u.location?._id}`} className="text-brand-400 hover:text-brand-300">{u.location?.name}</Link>
                              <span> · {u.location?.thana} · by {u.submittedBy?.name}</span>
                            </div>
                            {u.photos?.length > 0 && <span className="text-[11px] text-slate-600">{u.photos.length} 📷</span>}
                          </div>
                          {u.status === 'rejected' && u.rejectionReason && (
                            <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                              <p className="text-[11px] text-red-400">Rejected: {u.rejectionReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}