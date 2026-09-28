import React, { useEffect, useState } from 'react';
import api from './services/api';
import { getCurrentUser, setCurrentUser, clearAuth, safeReturnPath } from './services/auth';
import VerifyEmail, { ForgotPassword } from './pages/Auth/VerifyEmail';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// -- CÁC TRANG PUBLIC & AUTH --
import LandingPage from './pages/Home/LandingPage';
import LoginPage from './pages/Auth/LoginPage'; 
import RegisterPage from './pages/Auth/RegisterPage';

// -- CÁC TRANG CỦA USER DASHBOARD --
import DashboardLayout from './pages/Home/User/DashboardLayout';
import Dashboard from './pages/Home/User/Dashboard';
import Sessions from './pages/Home/User/Sessions';
import History from './pages/Home/User/History';
import Analytics from './pages/Home/User/Analytics';
import SimulationSetup from './pages/Home/User/SimulationSetup';
import SimulationRoom from './pages/Home/User/SimulationRoom';
import SimulationResult from './pages/Home/User/SimulationResult';
import GuidePage from './pages/Guide/GuidePage';
// -- TRANG ADMIN --
import AdminFeedback from './pages/Home/Admin/AdminFeedback';
import AdminDashboard from './pages/Home/Admin/AdminDashboard';

// ==========================================
// CÁC HÀM KIỂM TRA QUYỀN TRUY CẬP (AUTH)
// ==========================================
const isAuthenticated = () => {
  return Boolean(getCurrentUser()?.id);
};

const getUserRole = () => {
  return localStorage.getItem('userRole') || 'user';
};

const getDefaultRoute = () => {
  return getUserRole() === 'admin' ? '/admin' : '/dashboard';
};

// ==========================================
// COMPONENT BẢO VỆ ROUTE
// ==========================================

// 1. Chỉ dành cho người chưa đăng nhập (VD: Landing, Login, Register)
const PublicOnlyRoute = ({ children }) => {
  const location = useLocation();
  const googleError = new URLSearchParams(location.search).get('googleError');
  return isAuthenticated() ? <Navigate to={getDefaultRoute() + (googleError ? '?googleError=failed' : '')} replace /> : children;
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
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
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
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={ <PublicOnlyRoute><LandingPage /></PublicOnlyRoute> } />
        <Route path="/login" element={ <PublicOnlyRoute><LoginPage /></PublicOnlyRoute> } />
        <Route path="/register" element={ <PublicOnlyRoute><RegisterPage /></PublicOnlyRoute> } />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/verify-email" element={<PublicOnlyRoute><VerifyEmail /></PublicOnlyRoute>} />
        <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
        <Route path="/reset-password" element={<PublicOnlyRoute><VerifyEmail reset /></PublicOnlyRoute>} />
        <Route path="/auth/callback" element={<Navigate to={isAuthenticated() ? safeReturnPath(new URLSearchParams(window.location.search).get('returnTo')) : '/login?googleError=failed'} replace />} />
        <Route path="/guide" element={<GuidePage />} />

        {/* ADMIN ROUTES */}
        <Route path="/admin/feedback" element={<AdminRoute><AdminFeedback /></AdminRoute>} />
        <Route path="/admin" element={ <AdminRoute><AdminDashboard /></AdminRoute> } />
        
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
    </BrowserRouter>
  );
}

export default App;
