import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

export default function ProtectedRoute({ children, minRole = 'user' }) {
  const { user, loading, hasRole } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(minRole)) {
    return (
      <div className="p-10 text-center text-gray-500">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    );
  }
  return children;
}
