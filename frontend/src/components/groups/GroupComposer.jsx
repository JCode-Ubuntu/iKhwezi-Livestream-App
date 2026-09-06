import React, { useState, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, X } from 'lucide-react';

/**
 * GroupComposer — text + media input bar.
 * - Optimistic send: caller passes onSendText/onSendMedia; we clear input
 *   immediately and let the parent reconcile via the socket/REST response.
 * - Typing indicator: emits `typing` on input, stops after 1.5s of silence.
 * - Media: image/video picked via file input, sent as multipart.
 */
function GroupComposer({ onSendText, onSendMedia, onTyping, disabled }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);

  const emitTyping = useCallback((typing) => {
    if (isTypingRef.current === typing) return;
    isTypingRef.current = typing;
    onTyping?.(typing);
  }, [onTyping]);

  const handleChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  };

  const sendText = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    emitTyping(false);
    try {
      await onSendText(content);
    } finally {
      setSending(false);
    }
  };

  const sendMedia = async () => {
    if (!pendingMedia || sending) return;
    setSending(true);
    try {
      await onSendMedia(pendingMedia, input.trim());
      setPendingMedia(null);
      setMediaPreview(null);
      setInput('');
      emitTyping(false);
    } finally {
      setSending(false);
    }
  };

  const pickMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingMedia(file);
    const reader = new FileReader();
    reader.onload = () => setMediaPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const hasMedia = !!pendingMedia;

  return (
    <div
      className="flex flex-shrink-0 flex-col gap-2 border-t border-white/8 bg-[#050816]"
      style={{ padding: '8px 12px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
    >
      {mediaPreview && (
        <div className="relative inline-block w-fit">
          <img src={mediaPreview} alt="" className="h-20 rounded-xl object-cover" />
          <button
            type="button"
            onClick={() => { setPendingMedia(null); setMediaPreview(null); }}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="Send media"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-pink-300 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <ImageIcon size={18} />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pickMedia} className="hidden" />

        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); hasMedia ? sendMedia() : sendText(); } }}
          placeholder="Message…"
          autoComplete="off"
          maxLength={2000}
          disabled={disabled}
          style={{
            flex: 1, minWidth: 0, resize: 'none', overflow: 'hidden',
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(255,255,255,0.12)',
            borderRadius: 22, padding: '10px 16px',
            color: 'white', fontSize: 14, lineHeight: '1.4', outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#E1306C')}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
        />

        <button
          type="button"
          onClick={hasMedia ? sendMedia : sendText}
          disabled={disabled || sending || (!input.trim() && !hasMedia)}
          aria-label="Send"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg,#E1306C,#C13584)',
            border: 'none', cursor: 'pointer',
            opacity: (input.trim() || hasMedia) && !sending ? 1 : 0.4,
          }}
        >
          {sending
            ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
            : <Send size={16} color="white" />}
        </button>
      </div>
    </div>
  );
}

export default GroupComposer;
