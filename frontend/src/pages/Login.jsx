import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UltimaField from '../ultima/UltimaField';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('email');
  const [formData, setFormData] = useState({ email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const credentials = {
      password: formData.password,
      ...(mode === 'email' ? { email: formData.email.trim() } : { phone: formData.phone.trim() }),
    };
    const result = await login(credentials);
    setLoading(false);
    if (result.success) {
      navigate('/', { replace: true });
      return;
    }
    setError(result.error || 'Login failed');
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto ultima-page--auth">
      <UltimaField intensity={1.1} fixed />
      <div className="ultima-content flex flex-col px-6 pt-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="ultima-glass mb-8 flex h-11 w-11 items-center justify-center rounded-full text-white/70"
        >
          <ArrowLeft size={20} />
        </button>

        <p className="font-display text-xs font-semibold uppercase tracking-[0.35em] text-gold-400/80">
          Re-enter orbit
        </p>
        <h1 className="ultima-text-glow mt-2 font-display text-4xl font-black text-white">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-white/45">Stream the night. Shine the signal.</p>

        <div className="ultima-glass mt-8 flex rounded-2xl p-1">
          {['email', 'phone'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize transition ${
                mode === m
                  ? 'bg-gradient-to-r from-gold-500/25 to-violet-500/20 text-gold-200'
                  : 'text-white/45'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              {mode === 'email' ? 'Email' : 'Phone'}
            </span>
            <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
              {mode === 'email' ? (
                <Mail size={18} className="text-gold-400/70" />
              ) : (
                <Phone size={18} className="text-gold-400/70" />
              )}
              <input
                type={mode === 'email' ? 'email' : 'tel'}
                required
                value={mode === 'email' ? formData.email : formData.phone}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    [mode === 'email' ? 'email' : 'phone']: e.target.value,
                  }))
                }
                className="flex-1 bg-transparent text-white outline-none placeholder:text-white/25"
                placeholder={mode === 'email' ? 'you@signal.space' : '+27...'}
              />
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">Password</span>
            <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <Lock size={18} className="text-gold-400/70" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                className="flex-1 bg-transparent text-white outline-none placeholder:text-white/25"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-white/40"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 rounded-2xl bg-gradient-to-r from-gold-400 via-amber-500 to-gold-600 py-4 font-display text-sm font-bold uppercase tracking-widest text-void-950 shadow-lg shadow-gold-500/25 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Transmitting…' : 'Enter iKHWEZI'}
          </button>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-200">
              {error}
            </p>
          )}
        </form>

        <p className="mt-8 text-center text-sm text-white/40">
          New to the constellation?{' '}
          <Link to="/register" className="font-semibold text-gold-400 hover:text-gold-300">
            Create signal
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
