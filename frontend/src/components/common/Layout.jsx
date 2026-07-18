import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const roleColor = {
  company:    'text-brand-400',
  superadmin: 'text-purple-400',
  admin:      'text-teal-400',
  recce:      'text-emerald-400',
  queryAdmin: 'text-rose-400',
};
const roleBg = {
  company:    'bg-brand-500/10',
  superadmin: 'bg-purple-500/10',
  admin:      'bg-teal-500/10',
  recce:      'bg-emerald-500/10',
  queryAdmin: 'bg-rose-500/10',
};

// Query icon path
const QUERY_ICON = 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

const NAV = (role) => [
  { to: '/dashboard',             label: 'Dashboard',     icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', exact: true,
    ...(role === 'queryAdmin' ? { skip: true } : {}) // queryAdmin lands on Queries
  },

  // queryAdmin sees only: Queries page
  ...(role === 'queryAdmin' ? [
    { to: '/dashboard/queries', label: 'Queries', icon: QUERY_ICON, queryBadge: true },
  ] : []),

  // recce gets its own location page
  ...(role === 'recce'
    ? [{ to: '/dashboard/locations', label: 'Locations', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' }]
    : (role !== 'queryAdmin'
        ? [{ to: '/dashboard/locations', label: 'Locations', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' }]
        : [])
  ),

  ...(role === 'company' ? [{ to: '/dashboard/reviews', label: 'Reviews', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }] : []),
  ...((role === 'company' || role === 'admin') ? [{ to: '/dashboard/updates', label: 'Updates', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }] : []),
  ...(role === 'company' ? [{ to: '/dashboard/users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }] : []),

  // Alerts: company + superadmin
  ...((role === 'company' || role === 'superadmin') ? [{ to: '/dashboard/alerts', label: 'Alerts', icon: 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z', alertBadge: true }] : []),

  // Queries: company + superadmin (queryAdmin already has it above)
  ...((role === 'company' || role === 'superadmin') ? [{ to: '/dashboard/queries', label: 'Queries', icon: QUERY_ICON, queryBadge: true }] : []),

  ...(role !== 'recce' && role !== 'queryAdmin' ? [{ to: '/dashboard/notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', badge: true }] : []),
  ...(role !== 'recce' && role !== 'queryAdmin' ? [{ to: '/dashboard/map-view', label: 'Map View', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' }] : []),

  // Nearest Location: visible to every role
  { to: '/dashboard/nearest', label: 'Nearest Location', icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
].filter(item => !item.skip);

export default function Layout() {
  const { user, logout } = useAuth();
  const { unreadCount, setUnreadCount, setNotifications } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [queryCount, setQueryCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/notifications/unread-count').then(({ data }) => setUnreadCount(data.count)).catch(() => {});
    api.get('/notifications').then(({ data }) => setNotifications(data)).catch(() => {});
    if (user && (user.role === 'company' || user.role === 'superadmin')) {
      api.get('/alerts/unread-count').then(({ data }) => setAlertCount(data.count)).catch(() => {});
    }
    // Open query count badge
    if (user && ['company', 'superadmin', 'queryAdmin'].includes(user.role)) {
      api.get('/queries/stats').then(({ data }) => {
        const open = (data.open || 0) + (data.in_progress || 0);
        setQueryCount(open);
      }).catch(() => {});
    }
  }, []);

  const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/'); };

  const navItems = NAV(user?.role);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-16 border-b border-surface-300 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>
        </div>
        {!collapsed && <span className="font-display font-bold text-white text-base tracking-tight">Supertech</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
            onClick={() => setMobileOpen(false)}>
            <span className="relative flex-shrink-0">
              <svg className="w-4.5 h-4.5 w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
              </svg>
              {item.badge && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              {item.alertBadge && alertCount > 0 && !item.queryBadge && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
              {item.queryBadge && queryCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {queryCount > 9 ? '9+' : queryCount}
                </span>
              )}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-2.5 pb-4 border-t border-surface-300 pt-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-2">
            <div className={`w-8 h-8 rounded-xl ${roleBg[user?.role] || 'bg-slate-500/10'} ${roleColor[user?.role] || 'text-slate-400'} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
              <p className={`text-xs ${roleColor[user?.role] || 'text-slate-400'} capitalize`}>
                {user?.role === 'queryAdmin' ? 'Query Admin' : user?.role}
              </p>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className={`nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 ${collapsed ? 'justify-center' : ''}`}>
          <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`${theme} flex h-screen overflow-hidden bg-surface-0 text-slate-100`}
      style={{ colorScheme: theme }}
    >
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col ${collapsed ? 'w-[60px]' : 'w-56'} flex-shrink-0 bg-surface-50 border-r border-surface-300 transition-all duration-300`}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-50 w-56 bg-surface-50 border-r border-surface-300 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex items-center px-4 gap-3 border-b border-surface-300 bg-surface-50/80 backdrop-blur flex-shrink-0">
          <button onClick={() => { setCollapsed(v => !v); setMobileOpen(v => !v); }} className="btn-icon rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="btn-icon rounded-lg"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Live
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}