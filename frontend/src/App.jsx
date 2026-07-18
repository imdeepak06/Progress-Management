import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import Layout from './components/common/Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import LocationsPage from './pages/LocationsPage';
import LocationDetailPage from './pages/LocationDetailPage';
import SubmitUpdatePage from './pages/SubmitUpdatePage';
import UpdatesPage from './pages/UpdatesPage';
import ReviewsPage from './pages/ReviewsPage';
import UsersPage from './pages/UsersPage';
import NotificationsPage from './pages/NotificationsPage';
import TimelinePage from './pages/TimelinePage';
import ProgressPage from './pages/ProgressPage';
import LocationsMapPage from './pages/LocationMapPage';
import NearestLocationPage from './pages/NearestLocationPage';
import ReccePage from './pages/Reccepage';
import AlertsPage from './pages/AlertPage';
import PublicLocationPage from './pages/PublicLocationPage';
import QueriesPage from './pages/Queriespage';
import RaiseQueryPage from './pages/Raisequerypage';
import QueryDetailPage from './pages/Querydetailpage';

/* ── Role guard ── */
const Guard = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <div className="w-7 h-7 border-[3px] border-t-transparent rounded-full animate-spin" style={{ borderColor: '#4f6ef7', borderTopColor: 'transparent' }} />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'recce' ? '/dashboard/recce' : '/dashboard'} replace />;
  return children;
};

/* ── Routes ── */
const AppRoutes = () => {
  return (
    <Routes>
      {/* Always public — no auth check at all */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public/location/:id" element={<PublicLocationPage />} />
      <Route
          path="/recce/yamuna-nagar"
          element={<ReccePage />}
        />

      {/* Protected: all app pages live under /dashboard layout */}
      <Route
        path="/dashboard"
        element={<Guard><Layout /></Guard>}
      >
        <Route index element={<Dashboard />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="map-view" element={<LocationsMapPage />} />
        <Route path="locations/:id" element={<LocationDetailPage />} />
        <Route path="updates" element={<UpdatesPage />} />
        <Route
          path="updates/submit"
          element={<Guard roles={['admin']}><SubmitUpdatePage /></Guard>}
        />
        <Route
          path="updates/submit/:updateId"
          element={<Guard roles={['admin']}><SubmitUpdatePage /></Guard>}
        />
        <Route
          path="reviews"
          element={<Guard roles={['company']}><ReviewsPage /></Guard>}
        />
        <Route
          path="users"
          element={<Guard roles={['company']}><UsersPage /></Guard>}
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route
          path="alerts"
          element={<Guard roles={['company', 'superadmin']}><AlertsPage /></Guard>}
        />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="nearest" element={<NearestLocationPage />} />
        <Route path="progress" element={<ProgressPage />} />

        {/* ── Query routes ── */}
        <Route
          path="queries"
          element={<Guard roles={['company', 'superadmin', 'queryAdmin']}><QueriesPage /></Guard>}
        />
        <Route
          path="queries/raise"
          element={<Guard roles={['superadmin']}><RaiseQueryPage /></Guard>}
        />
        <Route
          path="queries/:id"
          element={<Guard roles={['company', 'superadmin', 'queryAdmin']}><QueryDetailPage /></Guard>}
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--toast-bg)',
                color: 'var(--toast-fg)',
                border: '1px solid var(--toast-border)',
                borderRadius: '12px',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}