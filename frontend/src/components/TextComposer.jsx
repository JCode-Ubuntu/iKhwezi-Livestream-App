import React, { useState } from 'react';
import { X, Send, PenLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BG_OPTIONS = [
  { bg: '#0f0c29', gradient: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', label: 'Midnight' },
  { bg: '#1a1a2e', gradient: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', label: 'Ocean' },
  { bg: '#0d1117', gradient: 'linear-gradient(135deg,#4f46e5,#7c3aed)', label: 'Indigo' },
  { bg: '#1f0a00', gradient: 'linear-gradient(135deg,#dc2626,#b91c1c)', label: 'Fire' },
  { bg: '#001f0f', gradient: 'linear-gradient(135deg,#059669,#047857)', label: 'Forest' },
  { bg: '#1a0533', gradient: 'linear-gradient(135deg,#a855f7,#7c3aed)', label: 'Purple' },
];

const FONT_STYLES = [
  { id: 'normal', label: 'Aa', style: { fontWeight: 400 } },
  { id: 'bold', label: 'Ab', style: { fontWeight: 800 } },
  { id: 'italic', label: 'Ai', style: { fontStyle: 'italic' } },
];

const MAX = 500;

export default function TextComposer({ onClose, onPosted }) {
  const { fetchWithAuth, showToast } = useAuth();
  const [content, setContent] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [fontStyle, setFontStyle] = useState('normal');
  const [submitting, setSubmitting] = useState(false);

  const selected = BG_OPTIONS[bgIndex];

  const handlePost = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetchWithAuth('/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          backgroundColor: selected.bg,
          textColor: '#ffffff',
          fontStyle,
        }),
      });
      if (res.ok) {
        const post = await res.json();
        showToast('Post shared!', 'success');
        onPosted?.(post);
        onClose();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to post', 'error');
      }
    } catch {
      showToast('Failed to post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const fontClass = fontStyle === 'bold' ? 'font-black' : fontStyle === 'italic' ? 'italic' : 'font-normal';

  return (
    <div className="pointer-events-auto fixed inset-0 z-[300] flex flex-col bg-black/80 backdrop-blur-md" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#050816]/95 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition active:scale-95">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2">
          <PenLine size={16} className="text-neon-indigo" />
          <span className="text-sm font-bold text-white">New Post</span>
        </div>
        <button
          type="button"
          onClick={handlePost}
          disabled={!content.trim() || submitting}
          className="flex items-center gap-1.5 rounded-full bg-neon-indigo px-4 py-1.5 text-sm font-bold text-white transition disabled:opacity-40 active:scale-95"
        >
          <Send size={14} />
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>

      {/* Preview card */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div
          className="relative flex w-full max-w-sm flex-col items-center justify-center rounded-3xl px-6 py-10 shadow-2xl"
          style={{ background: selected.gradient, minHeight: 260 }}
        >
          <textarea
            autoFocus
            value={content}
            onChange={e => setContent(e.target.value.slice(0, MAX))}
            placeholder="What's on your mind?"
            className={`w-full resize-none bg-transparent text-center text-xl leading-relaxed text-white outline-none placeholder-white/40 ${fontClass}`}
            rows={5}
          />
          <p className="absolute bottom-3 right-4 text-[11px] text-white/40">{content.length}/{MAX}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-t border-white/10 bg-[#050816]/95 px-4 pb-6 pt-3 backdrop-blur-xl">
        {/* Background picker */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Background</p>
          <div className="flex gap-2">
            {BG_OPTIONS.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setBgIndex(i)}
                className="transition active:scale-95"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: opt.gradient,
                  border: i === bgIndex ? '2px solid #818cf8' : '2px solid transparent',
                  outline: i === bgIndex ? '1px solid rgba(129,140,248,0.4)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Font style */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">Style</p>
          <div className="flex gap-2">
            {FONT_STYLES.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFontStyle(f.id)}
                className={`h-9 w-12 rounded-lg text-sm transition active:scale-95 ${fontStyle === f.id ? 'bg-neon-indigo/20 border border-neon-indigo/60 text-white' : 'bg-white/5 border border-white/10 text-white/50'}`}
                style={f.style}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
