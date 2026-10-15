import React, { lazy, Suspense, useEffect, useState } from 'react';
import api from './services/api';
import { getCurrentUser, setCurrentUser, clearAuth, safeReturnPath } from './services/auth';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import AnalyticsTracker from './components/analytics/AnalyticsTracker';
import ConsentBanner from './components/analytics/ConsentBanner';
import SeoMetadata from './components/SeoMetadata';
const PrivacySettings = lazy(() => import('./pages/Privacy/PrivacySettings'));

const AccountSettings = lazy(() => import('./pages/Account/AccountSettings'));
const AdminLayout = lazy(() => import('./pages/Home/Admin/AdminLayout'));
const AdminUsers = lazy(() => import('./pages/Home/Admin/AdminManagement').then(module => ({ default: module.AdminUsers })));
const AdminUserDetail = lazy(() => import('./pages/Home/Admin/AdminManagement').then(module => ({ default: module.AdminUserDetail })));
const AdminSessions = lazy(() => import('./pages/Home/Admin/AdminManagement').then(module => ({ default: module.AdminSessions })));
const AdminSessionDetail = lazy(() => import('./pages/Home/Admin/AdminManagement').then(module => ({ default: module.AdminSessionDetail })));
const AdminAi = lazy(() => import('./pages/Home/Admin/AdminOperations').then(module => ({ default: module.AdminAi })));
const AdminSystem = lazy(() => import('./pages/Home/Admin/AdminOperations').then(module => ({ default: module.AdminSystem })));
const AdminAudit = lazy(() => import('./pages/Home/Admin/AdminOperations').then(module => ({ default: module.AdminAudit })));
const AdminCases = lazy(() => import('./pages/Home/Admin/AdminCases'));
const AdminPayments = lazy(() => import('./pages/Home/Admin/AdminPayments'));
const VerifyEmail = lazy(() => import('./pages/Auth/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/Auth/VerifyEmail').then(module => ({ default: module.ForgotPassword })));

// -- CÁC TRANG PUBLIC & AUTH --
const LandingPage = lazy(() => import('./pages/Home/LandingPage'));
const LoginPage = lazy(() => import('./pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage'));
const CheckoutPage = lazy(() => import('./pages/Checkout/CheckoutPage'));

// -- CÁC TRANG CỦA USER DASHBOARD --
const DashboardLayout = lazy(() => import('./pages/Home/User/DashboardLayout'));
const Dashboard = lazy(() => import('./pages/Home/User/Dashboard'));
const Sessions = lazy(() => import('./pages/Home/User/Sessions'));
const History = lazy(() => import('./pages/Home/User/History'));
const Analytics = lazy(() => import('./pages/Home/User/Analytics'));
const SimulationSetup = lazy(() => import('./pages/Home/User/SimulationSetup'));
const SimulationRoom = lazy(() => import('./pages/Home/User/SimulationRoom'));
const SimulationResult = lazy(() => import('./pages/Home/User/SimulationResult'));
const GuidePage = lazy(() => import('./pages/Guide/GuidePage'));
// -- TRANG ADMIN --
const AdminFeedback = lazy(() => import('./pages/Home/Admin/AdminFeedback'));
const AdminDashboard = lazy(() => import('./pages/Home/Admin/AdminDashboard'));

// ==========================================
// CÁC HÀM KIỂM TRA QUYỀN TRUY CẬP (AUTH)
// ==========================================
const isAuthenticated = () => {
  return Boolean(getCurrentUser()?.id);
};

const getUserRole = () => {
  return getCurrentUser()?.role || 'user';
};

const getDefaultRoute = () => {
  return getUserRole() === 'admin' ? '/admin' : '/dashboard';
};

// ==========================================
// COMPONENT BẢO VỆ ROUTE
// ==========================================

// 1. Chỉ dành cho người chưa đăng nhập (Login, Register).
const PublicOnlyRoute = ({ children }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const googleError = params.get('googleError');
  const returnTo = safeReturnPath(params.get('returnTo'));
  return isAuthenticated() ? <Navigate to={(params.get('returnTo') ? returnTo : getDefaultRoute()) + (googleError ? '?googleError=failed' : '')} replace /> : children;
};

// 2. Chỉ dành cho Admin
const AdminRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return getUserRole() === 'admin' ? children : <Navigate to="/dashboard" replace />;
};

// 3. Dành cho User nội bộ (Bảo vệ nguyên cụm User Dashboard)
const ProtectedUserRoute = ({ children }) => {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return children;
};

// ==========================================
// CẤU HÌNH ROUTER CHÍNH
// ==========================================
function App() {
  const [authStatus, setAuthStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    api.get('/auth/me').then(({ data }) => {
      if (active) { setCurrentUser(data.user); setAuthStatus('ready'); }
    }).catch(error => {
      if (!active) return;
      if ([401, 403].includes(error.response?.status)) { clearAuth(); setAuthStatus('ready'); }
      else setAuthStatus('error');
    });
    return () => { active = false; };
  }, []);
  if (authStatus === 'loading') return <main className="auth-page"><p role="status">Đang mở CourtSim...</p></main>;
  if (authStatus === 'error') return <main className="auth-page"><section className="auth-card"><p role="alert">Chưa thể kết nối CourtSim. Kiểm tra kết nối và thử lại.</p><button className="auth-primary" onClick={() => window.location.reload()}>Thử lại</button></section></main>;
  return (
    <BrowserRouter>
      <SeoMetadata />
      <ConsentBanner />
      <Suspense fallback={<main className="auth-page"><p role="status">Đang mở trang…</p></main>}>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={ <PublicOnlyRoute><LoginPage /></PublicOnlyRoute> } />
        <Route path="/register" element={ <PublicOnlyRoute><RegisterPage /></PublicOnlyRoute> } />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/verify-email" element={<PublicOnlyRoute><VerifyEmail /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<PublicOnlyRoute><VerifyEmail reset /></PublicOnlyRoute>} />
        <Route path="/auth/callback" element={<Navigate to={isAuthenticated() ? safeReturnPath(new URLSearchParams(window.location.search).get('returnTo')) + (new URLSearchParams(window.location.search).get('linked') === '1' ? '?linked=1' : '') : '/login?googleError=failed'} replace />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/privacy" element={<PrivacySettings />} />
        <Route path="/account/:section?" element={<ProtectedUserRoute><AccountSettings /></ProtectedUserRoute>} />
        <Route path="/checkout/:planId" element={<ProtectedUserRoute><CheckoutPage /></ProtectedUserRoute>} />

        {/* ADMIN ROUTES */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id" element={<AdminUserDetail />} />
          <Route path="cases" element={<AdminCases />} />
          <Route path="sessions" element={<AdminSessions />} />
          <Route path="sessions/:id" element={<AdminSessionDetail />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="ai" element={<AdminAi />} />
          <Route path="system" element={<AdminSystem />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
        
        {/* USER DASHBOARD ROUTES (Sử dụng Nested Route với Layout) */}
        <Route 
          path="/dashboard" 
          element={ 
            <ProtectedUserRoute>
              <DashboardLayout /> 
            </ProtectedUserRoute> 
          }
        >
          {/* Outlet: Khi truy cập /dashboard, mặc định load <Dashboard /> */}
          <Route index element={<Dashboard />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="history" element={<History />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="setup" element={<SimulationSetup />} />
        </Route>

        <Route path="/simulation/:sessionId" element={<ProtectedUserRoute><SimulationRoom /></ProtectedUserRoute>} />
        <Route path="/simulation/:sessionId/result" element={<ProtectedUserRoute><SimulationResult /></ProtectedUserRoute>} />
        {/* Bắt lỗi 404 - Nếu nhập sai URL thì đưa về mặc định */}
        <Route path="*" element={<Navigate to="/" replace />} />
        
      </Routes>
      <AnalyticsTracker />
      </Suspense>
      <footer className="privacy-footer"><Link to="/privacy">Cài đặt quyền riêng tư</Link></footer>
    </BrowserRouter>
  );
}

export default App;
