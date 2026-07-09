import React from 'react';
import { X, Film, Sparkles, PenLine } from 'lucide-react';

function UltimaCreateSheet({ onClose, onVideo, onStory, onText }) {
  const options = [
    {
      id: 'video',
      icon: Film,
      label: 'Cinema',
      sub: 'Upload a clip',
      gradient: 'from-pink-500 via-pink-600 to-rose-800',
      onClick: onVideo,
    },
    {
      id: 'story',
      icon: Sparkles,
      label: 'Nova',
      sub: '24h moment',
      gradient: 'from-gold-400 via-amber-500 to-orange-600',
      onClick: onStory,
    },
    {
      id: 'text',
      icon: PenLine,
      label: 'Transmit',
      sub: 'Share thoughts',
      gradient: 'from-plasma-400 via-cyan-500 to-teal-600',
      onClick: onText,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Create content"
    >
      <div
        className="ultima-glass w-full max-w-lg rounded-t-[32px] px-5 pb-8 pt-4"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-gold-400/80">
              Manifest
            </p>
            <h2 className="font-display text-xl font-bold text-white">Create signal</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition active:scale-95"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => { onClose(); opt.onClick(); }}
                className={`flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br ${opt.gradient} p-5 text-white shadow-xl transition-transform active:scale-95`}
              >
                <Icon size={28} strokeWidth={1.75} />
                <div className="text-center">
                  <p className="font-display text-sm font-bold">{opt.label}</p>
                  <p className="text-[10px] text-white/75">{opt.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default UltimaCreateSheet;
