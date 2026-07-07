import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('chemcar_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('chemcar_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((profile) => setUser(profile))
      .catch(() => {
        localStorage.removeItem('chemcar_token');
        localStorage.removeItem('chemcar_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user: loggedInUser } = await authApi.login(email, password);
    localStorage.setItem('chemcar_token', token);
    localStorage.setItem('chemcar_user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chemcar_token');
    localStorage.removeItem('chemcar_user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const hasRole = useCallback(
    (minRole) => {
      const rank = { user: 1, admin: 2, super_admin: 3 };
      if (!user) return false;
      return (rank[user.role] || 0) >= (rank[minRole] || 0);
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
