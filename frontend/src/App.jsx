import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LandingPage from "./pages/Home/LandingPage.jsx";
function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </div>
    </Router>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/Home/LandingPage';
import AuthPage from './pages/Auth/AuthPage';
import Dashboard from './pages/Home/Dashboard';

// Hàm kiểm tra xem user đã đăng nhập chưa (dựa vào localStorage)
const isAuthenticated = () => {
  return localStorage.getItem('userToken') !== null;
};

// Component bảo vệ các trang chỉ dành cho user chưa đăng nhập (Landing, Auth)
const PublicOnlyRoute = ({ children }) => {
  return isAuthenticated() ? <Navigate to="/dashboard" /> : children;
};

// Component bảo vệ các trang nội bộ (Dashboard, Setup, Simulation)
const ProtectedRoute = ({ children }) => {
  return isAuthenticated() ? children : <Navigate to="/auth" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES: Chỉ cho khách xem */}
        <Route 
          path="/" 
          element={
            <PublicOnlyRoute>
              <LandingPage />
            </PublicOnlyRoute>
          } 
        />
        <Route 
          path="/auth" 
          element={
            <PublicOnlyRoute>
              <AuthPage />
            </PublicOnlyRoute>
          } 
        />

        {/* PROTECTED ROUTES: Bắt buộc đăng nhập */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Trang Setup (Sẽ làm sau) */}
        <Route 
          path="/setup" 
          element={
            <ProtectedRoute>
              <div className="text-white p-10 text-center">Trang Setup Môi trường sẽ nằm ở đây</div>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

