import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function AlertsPage() {
  const { user } = useAuth();
  const isSuper = user?.role === 'superadmin';

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  // filters
  const [status, setStatus] = useState('');   // '', 'unread', 'read'
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // mark-read modal
  const [active, setActive] = useState(null);  // alert being marked read
  const [adminRemark, setAdminRemark] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const { data } = await api.get(`/alerts?${params.toString()}`);
      setAlerts(data.alerts);
      setUnread(data.unreadCount);
    } catch {
      toast.error('Failed to load alerts');
    } finally { setLoading(false); }
  }, [status, from, to]);

  useEffect(() => { load(); }, [load]);

  const openMark = (a) => { setActive(a); setAdminRemark(a.adminRemark || ''); };

  const confirmMark = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/alerts/${active._id}/read`, { adminRemark });
      setAlerts(prev => prev.map(x => x._id === data._id ? { ...x, ...data } : x));
      setUnread(u => Math.max(0, u - 1));
      toast.success('Marked as read');
      setActive(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const clearFilters = () => { setStatus(''); setFrom(''); setTo(''); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Alerts</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {unread > 0 ? <span className="text-red-400">{unread} unread</span> : 'All read'}
            {' · '}{alerts.length} shown
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <div>
          <label className="label">Status</label>
          <div className="flex gap-1.5">
            {[['', 'All'], ['unread', 'Unread'], ['read', 'Read']].map(([v, l]) => (
              <button key={v} onClick={() => setStatus(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
                  ${status === v
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-surface-200 text-slate-400 border-surface-400 hover:text-slate-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        {(status || from || to) && (
          <button onClick={clearFilters} className="btn-ghost text-sm">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">🔕</div>
          <p className="text-slate-600 text-sm">No alerts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => {
            const created = new Date(a.createdAt);
            return (
              <div key={a._id}
                className={`card-sm p-4 border transition-all
                  ${!a.isRead ? 'border-red-500/40 bg-red-500/5' : 'border-surface-300'}`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">{a.isRead ? '🔔' : '🚨'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold text-sm ${!a.isRead ? 'text-slate-100' : 'text-slate-300'}`}>
                        {a.location?.name || a.locationName}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!a.isRead && <span className="badge-pending">Unread</span>}
                        {a.isRead && <span className="badge-verified">Read</span>}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5">
                      {(a.location?.thana || a.thana) || '—'} · {(a.location?.district || a.district) || '—'}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                      <span>📅 {format(created, 'dd MMM yyyy')}</span>
                      <span>🕑 {format(created, 'hh:mm a')}</span>
                      <span>📞 +{a.senderPhone}</span>
                      {(a.latitude != null && a.longitude != null) && (
                        <a className="text-brand-400 hover:text-brand-300"
                          href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`}
                          target="_blank" rel="noreferrer">
                          {Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)} →
                        </a>
                      )}
                    </div>

                    {a.remark && (
                      <p className="text-xs text-slate-300 mt-2 bg-surface-200 rounded-lg px-3 py-2">
                        <span className="text-slate-500">Sender remark: </span>{a.remark}
                      </p>
                    )}

                    {a.isRead && (a.adminRemark || a.readBy) && (
                      <div className="text-[11px] text-emerald-300/90 mt-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                        <span className="text-emerald-500/70">
                          ✓ Read{a.readBy?.name ? ` by ${a.readBy.name}` : ''}{a.readAt ? ` · ${format(new Date(a.readAt), 'dd MMM, hh:mm a')}` : ''}
                        </span>
                        {a.adminRemark && <div className="text-slate-300 mt-1">“{a.adminRemark}”</div>}
                      </div>
                    )}

                    {/* Superadmin-only action */}
                    {isSuper && !a.isRead && (
                      <button onClick={() => openMark(a)} className="btn-secondary text-xs mt-3">
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mark-read modal (superadmin) */}
      {active && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-2xl">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-slate-100">Mark alert as read</h3>
              <button onClick={() => setActive(null)} className="btn-ghost p-1 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-slate-400">
                {active.location?.name || active.locationName} · +{active.senderPhone}
              </div>
              <div>
                <label className="label">Remark (optional)</label>
                <textarea
                  className="input min-h-[90px]"
                  placeholder="Add a note about how this alert was handled…"
                  value={adminRemark}
                  onChange={e => setAdminRemark(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setActive(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={confirmMark} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Mark read'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
