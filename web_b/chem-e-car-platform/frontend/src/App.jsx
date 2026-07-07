import { Routes, Route } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';

import Login from './pages/Login';
import Overview from './pages/Overview';
import LiveMonitoring from './pages/LiveMonitoring';
import Calibration from './pages/Calibration';
import Experiments from './pages/Experiments';
import ExperimentDetail from './pages/ExperimentDetail';
import Compare from './pages/Compare';
import Alerts from './pages/Alerts';
import Devices from './pages/Devices';
import Users from './pages/Users';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <SocketProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="live" element={<LiveMonitoring />} />
          <Route path="calibration" element={<Calibration />} />
          <Route path="experiments" element={<Experiments />} />
          <Route path="experiments/:id" element={<ExperimentDetail />} />
          <Route path="compare" element={<Compare />} />
          <Route path="alerts" element={<Alerts />} />
          <Route
            path="devices"
            element={
              <ProtectedRoute minRole="admin">
                <Devices />
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute minRole="admin">
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute minRole="super_admin">
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </SocketProvider>
  );
}
