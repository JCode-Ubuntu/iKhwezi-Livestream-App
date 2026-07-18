import React from 'react';
import {
  X, Film, Image as ImageIcon, Sparkles, PenLine, Radio, Bell, Send,
} from 'lucide-react';

function CreateMenuItem({ icon: Icon, label, sub, onClick, accent = 'from-pink-500/20 to-gold-500/10' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ik-tap-spring flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br ${accent} px-3.5 py-3 text-left transition active:scale-[0.98]`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/35 text-white shadow-inner">
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        {sub && <p className="truncate text-[11px] text-white/45">{sub}</p>}
      </div>
    </button>
  );
}

function UltimaCreateSheet({
  onClose,
  onSignal,
  onVideo,
  onImage,
  onStory,
  onGoLive,
  onNotifications,
  onMessage,
}) {
  const closeAnd = (fn) => () => {
    onClose();
    fn?.();
  };

  const createItems = [
    { id: 'signal', icon: PenLine, label: 'Create Signal', sub: 'Text · poll · thought', onClick: closeAnd(onSignal) },
    { id: 'video', icon: Film, label: 'Upload Video', sub: 'Cinema clip', onClick: closeAnd(onVideo) },
    { id: 'image', icon: ImageIcon, label: 'Upload Image', sub: 'Photo signal', onClick: closeAnd(onImage) },
    { id: 'story', icon: Sparkles, label: 'Upload Story', sub: '24-hour moment', onClick: closeAnd(onStory) },
    { id: 'live', icon: Radio, label: 'Go Live', sub: 'Broadcast now', onClick: closeAnd(onGoLive) },
  ];

  const commItems = [
    { id: 'notifications', icon: Bell, label: 'Notifications', sub: 'Alerts & activity', onClick: closeAnd(onNotifications) },
    { id: 'message', icon: Send, label: 'Send Message', sub: 'Direct chat', onClick: closeAnd(onMessage) },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/75 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Create and connect"
    >
      <div
        className="ultima-glass w-full max-w-lg rounded-t-[28px] px-4 pb-6 pt-3 shadow-[0_-24px_80px_rgba(245,197,66,0.12)]"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="font-display text-lg font-bold text-white">Create</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {createItems.map((item) => (
            <CreateMenuItem key={item.id} {...item} />
          ))}
        </div>

        <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="grid grid-cols-2 gap-2">
          {commItems.map((item) => (
            <CreateMenuItem key={item.id} {...item} accent="from-white/5 to-white/[0.02]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default UltimaCreateSheet;
