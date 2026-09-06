import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Phone, Video } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useCall } from '../../context/CallContext';
import { resolveMediaUrl } from '../../config/appConfig';

/** DmThread — 1:1 direct message conversation (extracted from Messages.jsx). */
function DmThread({ otherUser, onBack }) {
  const { fetchWithAuth, user, showToast } = useAuth();
  const { socket, joinUserRoom } = useSocket();
  const { startCall, phase } = useCall();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/messages/${otherUser.id}`);
      if (res.ok) setMessages(await res.json());
    } catch { /* ignore */ }
  }, [fetchWithAuth, otherUser.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket || !user?.id) return;
    const rejoin = () => joinUserRoom(user.id);
    rejoin();
    socket.on('connect', rejoin);
    return () => socket.off('connect', rejoin);
  }, [socket, user?.id, joinUserRoom]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => { if (msg.senderId === otherUser.id) setMessages(prev => [...prev, msg]); };
    socket.on('new-dm', handler);
    return () => socket.off('new-dm', handler);
  }, [socket, otherUser.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const content = input.trim();
    setSending(true);
    const optimistic = { id: `tmp-${Date.now()}`, senderId: user?.id, receiverId: otherUser.id, content, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      const res = await fetchWithAuth(`/messages/${otherUser.id}`, { method: 'POST', body: JSON.stringify({ content }) });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => prev.map(m => m.id === optimistic.id ? msg : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        showToast('Failed to send', 'error');
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      showToast('Failed to send', 'error');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  useEffect(() => { const t = setTimeout(() => inputRef.current?.focus(), 200); return () => clearTimeout(t); }, []);

  return (
    <div className="z-[250]" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#050816' }}>
      <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#050816]/95">
        <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-transform active:scale-95" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
          {otherUser.avatar ? <img src={resolveMediaUrl(otherUser.avatar)} alt="" /> : otherUser.username?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-white truncate">{otherUser.displayName || otherUser.username}</p>
          <p className="text-xs text-white/40 truncate">@{otherUser.username}</p>
        </div>
        <button type="button" onClick={() => startCall(otherUser, 'audio')} disabled={phase !== 'idle'} aria-label="Voice call" className="ik-btn ik-btn-ghost flex h-9 w-9 items-center justify-center !p-0 text-pink-300">
          <Phone size={18} />
        </button>
        <button type="button" onClick={() => startCall(otherUser, 'video')} disabled={phase !== 'idle'} aria-label="Video call" className="ik-btn ik-btn-ghost flex h-9 w-9 items-center justify-center !p-0 text-pink-300">
          <Video size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ minHeight: 0 }}>
        {messages.map(msg => {
          const mine = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${mine ? 'rounded-br-sm bg-gradient-to-br from-pink-500 to-[#C13584] text-white' : 'rounded-bl-sm bg-white/8 text-white/90 border border-white/8'}`}>
                <p>{msg.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-white/35'} text-right`}>
                  {formatTime(msg.createdAt)}{mine && msg.readAt && ' ✓✓'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex flex-shrink-0 items-end gap-2 border-t border-white/8 bg-[#050816]" style={{ padding: '8px 12px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
          placeholder="Message…"
          autoComplete="off"
          maxLength={1000}
          style={{ flex: 1, minWidth: 0, resize: 'none', overflow: 'hidden', background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 22, padding: '10px 16px', color: 'white', fontSize: 14, lineHeight: '1.4', outline: 'none', transition: 'border-color 0.15s' }}
          onFocus={e => (e.target.style.borderColor = '#E1306C')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
        />
        <button type="submit" disabled={!input.trim() || sending} aria-label="Send message" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: input.trim() ? 44 : 0, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#E1306C,#C13584)', border: 'none', cursor: 'pointer', overflow: 'hidden', opacity: input.trim() ? 1 : 0, transform: input.trim() ? 'scale(1)' : 'scale(0.6)', transition: 'width 0.2s ease, opacity 0.2s ease, transform 0.2s ease', pointerEvents: input.trim() ? 'auto' : 'none' }}>
          {sending ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} /> : <Send size={16} color="white" />}
        </button>
      </form>
    </div>
  );
}

export default DmThread;
