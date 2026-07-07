import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center bg-surface">
      <div className="text-5xl mb-4">🧪</div>
      <h1 className="text-xl font-bold text-gray-900">Halaman tidak ditemukan</h1>
      <p className="text-gray-400 mt-1 mb-4">URL yang Anda tuju tidak tersedia.</p>
      <Link to="/" className="text-brand-600 font-semibold text-sm">← Kembali ke Overview</Link>
    </div>
  );
}
