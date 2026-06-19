import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/Home/LandingPage';
import Dashboard from './pages/Home/Dashboard';
import AdminDashboard from './pages/Home/AdminDashboard';

import LoginPage from './pages/Auth/LoginPage'; 
import RegisterPage from './pages/Auth/RegisterPage';

// Hàm kiểm tra xem user đã đăng nhập chưa
const isAuthenticated = () => {
  return localStorage.getItem('userToken') !== null;
};

const getUserRole = () => {
  return localStorage.getItem('userRole') || 'user';
};

const getDefaultRoute = () => {
  return getUserRole() === 'admin' ? '/admin' : '/dashboard';
};

// Component bảo vệ các trang chỉ dành cho user chưa đăng nhập
const PublicOnlyRoute = ({ children }) => {
  return isAuthenticated() ? <Navigate to={getDefaultRoute()} /> : children;
};

const AdminRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  return getUserRole() === 'admin' ? children : <Navigate to="/dashboard" />;
};

// Component bảo vệ các trang nội bộ
const ProtectedRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={ <PublicOnlyRoute><LandingPage /></PublicOnlyRoute> } />
        
        {/* Định tuyến mới cho Login và Register */}
        <Route path="/login" element={ <PublicOnlyRoute><LoginPage /></PublicOnlyRoute> } />
        <Route path="/register" element={ <PublicOnlyRoute><RegisterPage /></PublicOnlyRoute> } />
        <Route path="/auth" element={<Navigate to="/login" />} />

        {/* PROTECTED ROUTES */}
        <Route path="/dashboard" element={ <ProtectedRoute>{getUserRole() === 'admin' ? <Navigate to="/admin" /> : <Dashboard />}</ProtectedRoute> } />
        <Route path="/admin" element={ <AdminRoute><AdminDashboard /></AdminRoute> } />
        <Route path="/setup" element={ <ProtectedRoute><div className="text-white p-10 text-center">Trang Setup Môi trường</div></ProtectedRoute> } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;