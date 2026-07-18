import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const roleColor = { superadmin: 'purple', admin: 'teal', company: 'brand', recce: 'emerald', queryAdmin: 'sky' };

export default function UsersPage() {
  const [users,       setUsers]       = useState([]);
  const [superadmins, setSuperadmins] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [filterRole,  setFilterRole]  = useState('');
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'superadmin', superadminId:'' });

  useEffect(() => { load(); }, [filterRole]);

  const load = async () => {
    try {
      const p = filterRole ? `?role=${filterRole}` : '';
      const [uRes, sRes] = await Promise.all([api.get(`/users${p}`), api.get('/users/superadmins')]);
      setUsers(uRes.data);
      setSuperadmins(sRes.data);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (['admin','recce'].includes(form.role) && !form.superadminId) return toast.error('Select a SuperAdmin for this user');
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('User created!');
      setShowModal(false);
      setForm({ name:'', email:'', password:'', role:'superadmin', superadminId:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u._id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? 'Deactivated' : 'Activated');
      load();
    } catch { toast.error('Failed'); }
  };

  const needsSuperadmin = ['admin','recce'].includes(form.role);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">{users.length} accounts</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add User
        </button>
      </div>

      {/* Role filter */}
      <div className="flex gap-1.5 flex-wrap">
        {['','superadmin','admin','recce','queryAdmin'].map(r => (
          <button key={r} onClick={() => setFilterRole(r)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all
              ${filterRole === r ? 'bg-brand-500 text-white' : 'bg-surface-300 text-slate-500 hover:text-slate-200'}`}>
            {r || 'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center h-48 items-center"><div className="w-7 h-7 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {users.map(u => {
            const rc = roleColor[u.role] || 'slate';
            return (
              <div key={u._id} className={`card p-4 transition-all ${!u.isActive ? 'opacity-50' : 'hover:border-surface-500'}`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl bg-${rc}-500/10 text-${rc}-400 flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 text-sm truncate">{u.name}</p>
                    <p className="text-xs text-slate-600 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`badge-${u.role}`}>{u.role}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>
                {u.superadminId && (
                  <p className="text-[11px] text-purple-400 mb-2">↳ {u.superadminId.name}</p>
                )}
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>{format(new Date(u.createdAt), 'dd MMM yyyy')}</span>
                  <button onClick={() => toggleActive(u)} className="text-brand-400 hover:text-brand-300 transition-colors">
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="card-header flex items-center justify-between sticky top-0 bg-surface-100 z-10">
              <h3 className="font-semibold text-slate-100">Create User</h3>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" placeholder="John Doe" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" className="input" placeholder="user@example.com" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Password *</label>
                <input type="password" className="input" placeholder="Min 6 chars" required minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="label">Role *</label>
                <select className="select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, superadminId: '' }))}>
                  <option value="superadmin">SuperAdmin</option>
                  <option value="admin">Admin (Camera / WiFi / Power)</option>
                  <option value="recce">Recce</option>
                  <option value="queryAdmin">Query Admin (On-site Resolver)</option>
                </select>
              </div>
              {needsSuperadmin && (
                <div>
                  <label className="label">Assign to SuperAdmin *</label>
                  <select className="select" required value={form.superadminId} onChange={e => setForm(f => ({ ...f, superadminId: e.target.value }))}>
                    <option value="">Select SuperAdmin</option>
                    {superadmins.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                  <p className="text-[11px] text-slate-600 mt-1">Operator will only see locations under this SuperAdmin</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}