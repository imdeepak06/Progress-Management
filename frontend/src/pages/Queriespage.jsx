import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Camera, Wifi, Zap, HelpCircle, Clock, CheckCircle, XCircle,
  Loader2, Plus, Filter, RefreshCw, ChevronRight, AlertTriangle,
  Activity, FileDown,
} from 'lucide-react';
import { generateQueriesReportPDF } from '../utils/generateQueriesReportPDF';

/* ── helpers ── */
const CAT_META = {
  camera:       { label: 'Camera',       Icon: Camera,      color: 'cyan'   },
  wifi:         { label: 'WiFi',         Icon: Wifi,        color: 'violet' },
  power_supply: { label: 'Power Supply', Icon: Zap,         color: 'orange' },
  other:        { label: 'Other',        Icon: HelpCircle,  color: 'slate'  },
};

const STATUS_META = {
  open:        { label: 'Open',        Icon: Clock,         color: 'amber',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30'   },
  in_progress: { label: 'In Progress', Icon: Loader2,       color: 'blue',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30'    },
  resolved:    { label: 'Resolved',    Icon: CheckCircle,   color: 'emerald', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rejected:    { label: 'Rejected',    Icon: XCircle,       color: 'red',     bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30'     },
};

const PRIORITY_COLOR = {
  low:      'text-emerald-400',
  medium:   'text-amber-400',
  high:     'text-orange-400',
  critical: 'text-red-400',
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.open;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${m.bg} ${m.text} ${m.border}`}>
      <m.Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

function StatCard({ label, value, color = 'slate', icon: Icon }) {
  return (
    <div className="card-sm p-4 flex items-center gap-3">
      {Icon && (
        <div className={`w-9 h-9 rounded-xl bg-${color}-500/10 flex items-center justify-center text-${color}-400 flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div>
        <p className={`text-2xl font-display font-bold text-${color}-400`}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function QueriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isCompany    = user?.role === 'company';
  const isSuperadmin = user?.role === 'superadmin';
  const isQueryAdmin = user?.role === 'queryAdmin';

  const [queries,  setQueries]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);
  const [pdfBusy,  setPdfBusy]  = useState(false);
  const LIMIT = 20;

  // Filters
  const [fStatus,   setFStatus]   = useState('');
  const [fCat,      setFCat]      = useState('');
  const [fPriority, setFPriority] = useState('');
  const [fFrom,     setFFrom]     = useState('');
  const [fTo,       setFTo]       = useState('');

  const buildParams = useCallback((pg = 1) => {
    const p = new URLSearchParams();
    p.set('page', pg); p.set('limit', LIMIT);
    if (fStatus)   p.set('status',   fStatus);
    if (fCat)      p.set('category', fCat);
    if (fPriority) p.set('priority', fPriority);
    if (fFrom)     p.set('from',     fFrom);
    if (fTo)       p.set('to',       fTo);
    return p.toString();
  }, [fStatus, fCat, fPriority, fFrom, fTo]);

  const load = useCallback(async (pg = 1, append = false) => {
    setLoading(true);
    try {
      const [{ data: qData }, { data: sData }] = await Promise.all([
        api.get(`/queries?${buildParams(pg)}`),
        api.get('/queries/stats'),
      ]);
      const list = qData.queries ?? qData;
      setQueries(prev => append ? [...prev, ...list] : list);
      setHasMore(list.length === LIMIT);
      setStats(sData);
      setPage(pg);
    } catch {
      toast.error('Failed to load queries');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(1); }, [load]);

  const applyFilters = () => { setPage(1); load(1); };
  const clearFilters = () => {
    setFStatus(''); setFCat(''); setFPriority(''); setFFrom(''); setFTo('');
  };
  useEffect(() => { load(1); }, [fStatus, fCat, fPriority, fFrom, fTo]);

  const loadMore = () => load(page + 1, true);

  const downloadPdf = async () => {
    if (pdfBusy || queries.length === 0) return;
    setPdfBusy(true);
    const toastId = toast.loading('Generating PDF report\u2026');
    try {
      await generateQueriesReportPDF(
        queries,
        stats,
        { status: fStatus, category: fCat, priority: fPriority, from: fFrom, to: fTo }
      );
      toast.success('PDF downloaded!', { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error('PDF generation failed', { id: toastId });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-white">Service Queries</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isCompany    && 'All queries raised by your superadmins'}
            {isSuperadmin && 'Queries you have raised for your locations'}
            {isQueryAdmin && 'All active and resolved queries assigned for resolution'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(1)} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={downloadPdf}
            disabled={pdfBusy || queries.length === 0}
            title="Download all displayed queries as PDF"
            className="btn-secondary flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pdfBusy
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <FileDown className="w-4 h-4" />}
            <span className="hidden sm:inline text-sm">Print PDF</span>
          </button>
          {isSuperadmin && (
            <button onClick={() => navigate('/dashboard/queries/raise')} className="btn-primary">
              <Plus className="w-4 h-4" /> Raise Query
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Open"        value={stats.open        ?? 0} color="amber"   icon={Clock}       />
          <StatCard label="In Progress" value={stats.in_progress ?? 0} color="blue"    icon={Activity}    />
          <StatCard label="Resolved"    value={stats.resolved    ?? 0} color="emerald" icon={CheckCircle} />
          <StatCard label="Rejected"    value={stats.rejected    ?? 0} color="red"     icon={XCircle}     />
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filters</span>
          {(fStatus || fCat || fPriority || fFrom || fTo) && (
            <button onClick={clearFilters} className="text-xs text-brand-400 hover:text-brand-300 ml-auto">
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="input-field text-sm">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
          <select value={fCat} onChange={e => setFCat(e.target.value)} className="input-field text-sm">
            <option value="">All Categories</option>
            {Object.entries(CAT_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
          <select value={fPriority} onChange={e => setFPriority(e.target.value)} className="input-field text-sm">
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className="input-field text-sm" placeholder="From" />
          <input type="date" value={fTo}   onChange={e => setFTo(e.target.value)}   className="input-field text-sm" placeholder="To"   />
        </div>
      </div>

      {/* List */}
      {loading && queries.length === 0 ? (
        <div className="flex justify-center h-40 items-center">
          <div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : queries.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No queries found</p>
          <p className="text-slate-500 text-sm mt-1">
            {isSuperadmin ? 'You have not raised any queries yet.' : 'No queries match the current filters.'}
          </p>
          {isSuperadmin && (
            <button onClick={() => navigate('/dashboard/queries/raise')} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Raise First Query
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {queries.map(q => {
            const cat = CAT_META[q.category] || CAT_META.other;
            return (
              <Link
                key={q._id}
                to={`/dashboard/queries/${q._id}`}
                className="card p-4 flex items-start gap-4 hover:border-surface-400 transition-all group block"
              >
                {/* Category icon */}
                <div className={`w-10 h-10 rounded-xl bg-${cat.color}-500/10 flex items-center justify-center text-${cat.color}-400 flex-shrink-0 mt-0.5`}>
                  <cat.Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate leading-tight">{q.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {q.locationName} · {q.thana}
                        {q.district ? ` · ${q.district}` : ''}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <StatusBadge status={q.status} />
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className={`text-[11px] font-semibold uppercase ${PRIORITY_COLOR[q.priority] || 'text-slate-400'}`}>
                      {q.priority}
                    </span>
                    <span className="text-[11px] text-slate-500">{cat.label}</span>
                    {(isCompany || isQueryAdmin) && q.superadmin?.name && (
                      <span className="text-[11px] text-purple-400">by {q.superadmin.name}</span>
                    )}
                    <span className="text-[11px] text-slate-600 ml-auto">
                      {format(new Date(q.createdAt), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}

          {hasMore && (
            <div className="text-center pt-2">
              <button onClick={loadMore} disabled={loading} className="btn-secondary">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}