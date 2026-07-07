import { useEffect, useState } from 'react';
import { usersApi } from '../api/client';
import { PageHeader, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin', user: 'Researcher' };

export default function Users() {
  const { user: me, hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');

  const load = () => usersApi.list().then(setItems).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await usersApi.create(form);
      setForm({ name: '', email: '', password: '', role: 'user' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat user.');
    }
  };

  const toggleActive = async (u) => {
    if (u.is_active) await usersApi.deactivate(u.id);
    else await usersApi.activate(u.id);
    load();
  };

  const changeRole = async (u, role) => {
    await usersApi.changeRole(u.id, role);
    load();
  };

  const remove = async (u) => {
    if (!confirm(`Hapus akun ${u.name}?`)) return;
    await usersApi.remove(u.id);
    load();
  };

  const pending = items.filter((u) => !u.is_active);

  return (
    <div>
      <PageHeader title="Users" subtitle="Kelola anggota tim & role akses">
        <button onClick={() => setShowForm((s) => !s)} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          + Tambah User
        </button>
      </PageHeader>

      <div className="p-6 space-y-6">
        {showForm && (
          <form onSubmit={submit} className="card p-5 max-w-xl space-y-3">
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Nama</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Password Awal</label>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="user">Researcher</option>
                  {hasRole('super_admin') && <option value="admin">Admin</option>}
                  {hasRole('super_admin') && <option value="super_admin">Super Admin</option>}
                </select>
              </div>
            </div>
            <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">Buat Akun</button>
          </form>
        )}

        {pending.length > 0 && (
          <div className="card p-4 border-l-4 border-amber-500">
            <div className="text-sm font-semibold text-gray-800 mb-1">{pending.length} akun menunggu persetujuan</div>
            <div className="text-xs text-gray-400">Aktifkan dari tabel di bawah agar mereka bisa login.</div>
          </div>
        )}

        {loading ? <Spinner /> : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{u.name} {u.id === me.id && <span className="text-xs text-gray-400">(Anda)</span>}</td>
                    <td className="px-5 py-3 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3">
                      {hasRole('super_admin') && u.id !== me.id ? (
                        <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
                          <option value="user">Researcher</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      ) : (
                        <span className="text-gray-600">{ROLE_LABEL[u.role]}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {u.is_active ? 'Aktif' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-3">
                      <button onClick={() => toggleActive(u)} className="text-xs text-brand-600 font-semibold">
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      {hasRole('super_admin') && u.id !== me.id && (
                        <button onClick={() => remove(u)} className="text-xs text-red-500 font-semibold">Hapus</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
