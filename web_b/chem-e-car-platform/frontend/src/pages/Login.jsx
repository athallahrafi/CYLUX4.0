import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submitLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal login.');
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await authApi.register(form);
      setInfo('Registrasi berhasil. Menunggu persetujuan admin sebelum bisa login.');
      setMode('login');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mendaftar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-lg bg-brand-600 text-white flex items-center justify-center text-xl">🧪</div>
          <div className="text-left">
            <div className="font-bold leading-tight">Chem-E-Car</div>
            <div className="text-xs text-gray-400 leading-tight">Research Platform</div>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-bold text-gray-900 mb-1">
            {mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun baru'}
          </h1>
          <p className="text-sm text-gray-400 mb-5">
            {mode === 'login' ? 'Pantau dan kendalikan eksperimen mobil Chem-E-Car.' : 'Akun baru menunggu persetujuan admin.'}
          </p>

          {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          {info && <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{info}</div>}

          <form onSubmit={mode === 'login' ? submitLogin : submitRegister} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-medium text-gray-500">Nama Lengkap</label>
                <input
                  name="name" value={form.name} onChange={onChange} required
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500">Email</label>
              <input
                type="email" name="email" value={form.email} onChange={onChange} required
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Password</label>
              <input
                type="password" name="password" value={form.password} onChange={onChange} required minLength={mode === 'register' ? 8 : undefined}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit" disabled={busy}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold text-sm rounded-lg py-2.5 transition"
            >
              {busy ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
            </button>
          </form>

          <div className="text-center text-sm text-gray-500 mt-4">
            {mode === 'login' ? (
              <>Belum punya akun?{' '}
                <button className="text-brand-600 font-medium" onClick={() => { setMode('register'); setError(''); }}>
                  Daftar
                </button>
              </>
            ) : (
              <>Sudah punya akun?{' '}
                <button className="text-brand-600 font-medium" onClick={() => { setMode('login'); setError(''); }}>
                  Masuk
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
