import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const typeStyle = {
  update_submitted:      { icon: '📤', ring: 'border-brand-500/30  bg-brand-500/5'   },
  update_verified:       { icon: '✅', ring: 'border-emerald-500/30 bg-emerald-500/5' },
  update_rejected:       { icon: '❌', ring: 'border-red-500/30     bg-red-500/5'     },
  update_resubmitted:    { icon: '🔄', ring: 'border-amber-500/30  bg-amber-500/5'   },
  control_room_request:  { icon: '📡', ring: 'border-violet-500/30 bg-violet-500/5'  },
  control_room_accepted: { icon: '🟢', ring: 'border-emerald-500/30 bg-emerald-500/5' },
  control_room_rejected: { icon: '🔴', ring: 'border-red-500/30    bg-red-500/5'     },
};

export default function NotificationsPage() {
  const { notifications, setNotifications, setUnreadCount, markOneRead } = useSocket();
  const [loading, setLoading] = useState(notifications.length === 0);

  useEffect(() => {
    api.get('/notifications').then(({ data }) => {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); markOneRead(id); setUnreadCount(p => Math.max(0, p - 1)); } catch {}
  };

  const markAll = async () => {
    try {
      await api.put('/notifications/mark-all-read');
      setNotifications(p => p.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const unread = notifications.filter(n => !n.isRead).length;

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Notifications</h1>
          <p className="text-slate-500 text-sm mt-0.5">{unread > 0 ? <span className="text-brand-400">{unread} unread</span> : 'All read'}</p>
        </div>
        {unread > 0 && <button onClick={markAll} className="btn-ghost text-sm">Mark all read</button>}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">🔔</div>
          <p className="text-slate-600 text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const s = typeStyle[n.type] || typeStyle.update_submitted;
            return (
              <div key={n._id}
                className={`card-sm p-4 border transition-all cursor-pointer hover:border-surface-500
                  ${!n.isRead ? s.ring : 'border-surface-300'}`}
                onClick={() => !n.isRead && markRead(n._id)}>
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-sm ${!n.isRead ? 'text-slate-100' : 'text-slate-400'}`}>{n.title}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!n.isRead && <div className="w-1.5 h-1.5 bg-brand-400 rounded-full" />}
                        <span className="text-[11px] text-slate-600 whitespace-nowrap">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                    {n.location && (
                      <Link to={`/dashboard/locations/${n.location._id || n.location}`}
                        className="text-[11px] text-brand-400 hover:text-brand-300 mt-1 inline-block"
                        onClick={e => e.stopPropagation()}>
                        View location →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}