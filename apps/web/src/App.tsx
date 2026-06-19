import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import SsoCallbackPage from './pages/auth/SsoCallbackPage';
import DeviceListPage from './pages/devices/DeviceListPage';
import DeviceDetailPage from './pages/devices/DeviceDetailPage';
import ProtectedRoute from './components/layout/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sso/callback" element={<SsoCallbackPage />} />
        <Route
          path="/devices"
          element={
            <ProtectedRoute>
              <DeviceListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/devices/:id"
          element={
            <ProtectedRoute>
              <DeviceDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/devices" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
