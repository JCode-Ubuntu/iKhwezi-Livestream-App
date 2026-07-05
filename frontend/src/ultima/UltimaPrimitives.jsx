import React from 'react';

export function UltimaCrown({ label }) {
  return (
    <div className="ultima-crown px-1">
      <span className="ultima-crown-gem" aria-hidden />
      {label && (
        <span className="ultima-eyebrow whitespace-nowrap px-2">{label}</span>
      )}
      <span className="ultima-crown-gem" aria-hidden />
    </div>
  );
}

export function UltimaInput({ icon: Icon, type = 'text', value, onChange, placeholder, error, children }) {
  return (
    <label className="flex flex-col gap-2">
      <div className="ultima-input flex items-center gap-3 rounded-2xl px-4 py-3.5">
        {Icon && <Icon size={18} className="shrink-0 text-gold-400/75" strokeWidth={1.75} />}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
        />
        {children}
      </div>
      {error && <span className="text-xs text-red-400/90">{error}</span>}
    </label>
  );
}

export function UltimaButton({ children, type = 'button', disabled, onClick, variant = 'supreme', className = '' }) {
  const base = variant === 'supreme'
    ? 'ultima-btn-supreme rounded-2xl px-6 py-4 text-sm'
    : 'ultima-glass ultima-icon-btn rounded-2xl px-6 py-3 text-sm font-semibold text-white/80';
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${className}`}>
      {children}
    </button>
  );
}

export function UltimaIconButton({ children, onClick, className = '', label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`ultima-icon-btn flex h-11 w-11 items-center justify-center rounded-full text-white/75 ${className}`}
    >
      {children}
    </button>
  );
}

export function UltimaBadge({ children, variant = 'gold' }) {
  const styles = variant === 'live'
    ? 'border-red-400/40 bg-red-600/90 text-white shadow-[0_0_24px_rgba(239,68,68,0.4)] animate-live-ring'
    : 'border-gold-400/30 bg-gold-500/12 text-gold-200';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${styles}`}>
      {children}
    </span>
  );
}
