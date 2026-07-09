import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, User, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UltimaField from '../ultima/UltimaField';
import { UltimaCrown } from '../ultima/UltimaPrimitives';

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [mode, setMode] = useState('email');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username || formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (mode === 'email' && !formData.email) {
      newErrors.email = 'Email is required';
    }
    if (mode === 'phone' && !formData.phone) {
      newErrors.phone = 'Phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    const userData = {
      username: formData.username,
      displayName: formData.displayName || formData.username,
      password: formData.password,
      ...(mode === 'email' ? { email: formData.email } : { phone: formData.phone }),
    };

    const result = await register(userData);
    setLoading(false);

    if (result.success) {
      navigate('/');
    }
  };

  const requirements = [
    { met: formData.username.length >= 3, text: 'Username at least 3 characters' },
    { met: formData.password.length >= 6, text: 'Password at least 6 characters' },
    { met: formData.password === formData.confirmPassword && formData.password.length > 0, text: 'Passwords match' },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto ultima-page--auth">
      <UltimaField intensity={0.9} fixed />
      <div className="ultima-content flex flex-col px-6 pt-8 pb-10">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="ultima-glass mb-8 flex h-11 w-11 items-center justify-center rounded-full text-white/70"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="mb-2 flex justify-center">
          <UltimaCrown label="New signal" />
        </div>
        <h1 className="ultima-text-glow text-center font-display text-4xl font-black text-white">
          Join iKHWEZI
        </h1>
        <p className="mt-2 text-center text-sm text-white/45">Create your creator account</p>

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
            {errors[mode] && <span className="text-xs text-red-400/90">{errors[mode]}</span>}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">Username</span>
            <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <User size={18} className="text-gold-400/70" />
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                  }))
                }
                className="flex-1 bg-transparent text-white outline-none placeholder:text-white/25"
                placeholder="yourname"
              />
            </div>
            {errors.username && <span className="text-xs text-red-400/90">{errors.username}</span>}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              Display name <span className="text-white/25">(optional)</span>
            </span>
            <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <User size={18} className="text-gold-400/70" />
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData((f) => ({ ...f, displayName: e.target.value }))}
                className="flex-1 bg-transparent text-white outline-none placeholder:text-white/25"
                placeholder="How others see you"
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
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="text-white/40">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="text-xs text-red-400/90">{errors.password}</span>}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">Confirm password</span>
            <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <Lock size={18} className="text-gold-400/70" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.confirmPassword}
                onChange={(e) => setFormData((f) => ({ ...f, confirmPassword: e.target.value }))}
                className="flex-1 bg-transparent text-white outline-none placeholder:text-white/25"
                placeholder="••••••••"
              />
            </div>
            {errors.confirmPassword && <span className="text-xs text-red-400/90">{errors.confirmPassword}</span>}
          </label>

          <div className="ultima-glass mt-1 flex flex-col gap-2.5 rounded-2xl px-4 py-3.5">
            {requirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                    req.met ? 'bg-pink-500' : 'bg-white/10'
                  }`}
                >
                  {req.met && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className={`text-xs ${req.met ? 'text-white/85' : 'text-white/35'}`}>{req.text}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 rounded-2xl bg-gradient-to-r from-gold-400 via-amber-500 to-gold-600 py-4 font-display text-sm font-bold uppercase tracking-widest text-void-950 shadow-lg shadow-gold-500/25 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-white/40">
          Already have a signal?{' '}
          <Link to="/login" className="font-semibold text-gold-400 hover:text-gold-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
