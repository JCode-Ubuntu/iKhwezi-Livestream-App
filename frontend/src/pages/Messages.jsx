import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle, Search, Edit, X, UserCircle2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CosmicBackground from '../components/CosmicBackground';

/* ── New Conversation Search Modal ── */
function NewConversationModal({ onSelect, onClose, fetchWithAuth }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetchWithAuth(`/users/search?q=${encodeURIComponent(q)}&limit=20`);
      if (res.ok) setResults(await res.json());
    } catch {}
    finally { setSearching(false); }
  }, [fetchWithAuth]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  return (
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-[#050816]/95 backdrop-blur-xl"
      style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-transform active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', flexShrink: 0 }}
        >
          <X size={18} />
        </button>
        <h2 className="text-base font-bold text-white">New Message</h2>
      </div>

      {/* Search box */}
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2.5 border border-white/10 focus-within:border-neon-indigo/50 transition-colors">
          <Search size={15} className="flex-shrink-0 text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {searching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-neon-indigo border-t-transparent flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && query.trim() && !searching && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/40">
            <UserCircle2 size={40} />
            <p className="text-sm">No users found</p>
          </div>
        )}
        {results.length === 0 && !query.trim() && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/40">
            <Search size={36} />
            <p className="text-sm">Search for a person to message</p>
          </div>
        )}
        {results.map(u => (
          <button
            key={u.id}
            type="button"
            onClick={() => { onSelect(u); onClose(); }}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/8 transition-colors border-b border-white/4 text-left"
          >
            <div className="avatar flex-shrink-0" style={{ width: 44, height: 44, fontSize: 16 }}>
              {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-full" /> : u.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">{u.displayName || u.username}</p>
              <p className="text-xs text-white/40 truncate">@{u.username}</p>
            </div>
            <Send size={16} className="text-neon-indigo flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Conversation list ── */
function ConversationList({ conversations, onSelect, loading, onNewMsg }) {
  const [search, setSearch] = useState('');
  const filtered = conversations.filter(c =>
    (c.user?.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.user?.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full" style={{ position: 'relative' }}>
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/8">
          <Search size={15} className="text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-white/30 hover:text-white/60">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neon-indigo border-t-transparent" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neon-indigo/10 border border-neon-indigo/20">
              <MessageCircle size={30} className="text-neon-indigo/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/60 mb-1">No conversations yet</p>
              <p className="text-xs text-white/35">Tap the pencil icon to start a chat</p>
            </div>
          </div>
        )}
        {filtered.map(conv => (
          <button
            key={conv.user?.id}
            type="button"
            onClick={() => onSelect(conv.user)}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/8 transition-colors border-b border-white/4 text-left"
          >
            <div className="avatar flex-shrink-0" style={{ width: 48, height: 48, fontSize: 17 }}>
              {conv.user?.avatar
                ? <img src={conv.user.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                : conv.user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="font-semibold text-sm text-white truncate">
                  {conv.user?.displayName || conv.user?.username}
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {conv.lastMessage?.createdAt && (
                    <span className="text-[11px] text-white/30">
                      {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {conv.unread > 0 && (
                    <span className="h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full bg-neon-indigo text-[10px] font-bold text-white">
                      {conv.unread > 99 ? '99+' : conv.unread}
                    </span>
                  )}
                </div>
              </div>
              <p className={`text-xs truncate mt-0.5 ${conv.unread > 0 ? 'text-white/70 font-medium' : 'text-white/40'}`}>
                {conv.lastMessage?.content || 'No messages yet'}
              </p>
            </div>
          </button>
        ))}
        {/* Bottom padding so FAB doesn't cover last item */}
        <div style={{ height: 80 }} />
      </div>

      {/* Floating compose button */}
      <button
        type="button"
        onClick={onNewMsg}
        aria-label="New message"
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-[0_4px_24px_rgba(99,102,241,0.5)] active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', zIndex: 10 }}
      >
        <Edit size={16} />
        New Message
      </button>
    </div>
  );
}

/* ── Chat thread ── */
function ChatThread({ otherUser, onBack }) {
  const { fetchWithAuth, user, showToast } = useAuth();
  const { socket, joinUserRoom } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/messages/${otherUser.id}`);
      if (res.ok) setMessages(await res.json());
    } catch {}
  }, [fetchWithAuth, otherUser.id]);

  useEffect(() => { load(); }, [load]);

  // Join our own room — re-join immediately and also whenever socket reconnects
  useEffect(() => {
    if (!socket || !user?.id) return;
    const rejoin = () => joinUserRoom(user.id);
    rejoin();
    socket.on('connect', rejoin);
    return () => socket.off('connect', rejoin);
  }, [socket, user?.id, joinUserRoom]);

  // Real-time incoming DM
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      // Only append if this message is from the user we're chatting with
      if (msg.senderId === otherUser.id) {
        setMessages(prev => [...prev, msg]);
      }
    };
    socket.on('new-dm', handler);
    return () => socket.off('new-dm', handler);
  }, [socket, otherUser.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const content = input.trim();
    setSending(true);
    // Optimistic update
    const optimistic = {
      id: `tmp-${Date.now()}`,
      senderId: user?.id,
      receiverId: otherUser.id,
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setInput('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    try {
      const res = await fetchWithAuth(`/messages/${otherUser.id}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const msg = await res.json();
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => m.id === optimistic.id ? msg : m));
      } else {
        // Roll back
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

  // Focus input when thread opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    // position:absolute inset-0 is intentional — h-full inside flex-1 overflow-hidden
    // does not reliably resolve across all browsers; absolute positioning guarantees fill
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#050816' }}>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#050816]/95">
        <button type="button" onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-transform active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
          {otherUser.avatar ? <img src={otherUser.avatar} alt="" /> : otherUser.username?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-sm text-white">{otherUser.displayName || otherUser.username}</p>
          <p className="text-xs text-white/40">@{otherUser.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ minHeight: 0 }}>
        {messages.map(msg => {
          const mine = msg.senderId === user?.id;
          return (
            <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  mine
                    ? 'rounded-br-sm bg-gradient-to-br from-neon-indigo to-purple-600 text-white'
                    : 'rounded-bl-sm bg-white/8 text-white/90 border border-white/8'
                }`}
              >
                <p>{msg.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-white/60' : 'text-white/35'} text-right`}>
                  {formatTime(msg.createdAt)}
                  {mine && msg.readAt && ' ✓✓'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={send}
        className="flex flex-shrink-0 items-end gap-2 border-t border-white/8 bg-[#050816]"
        style={{ padding: '8px 12px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={e => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
          placeholder="Message…"
          autoComplete="off"
          maxLength={1000}
          style={{
            flex: 1,
            minWidth: 0,
            resize: 'none',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.07)',
            border: '1.5px solid rgba(255,255,255,0.12)',
            borderRadius: 22,
            padding: '10px 16px',
            color: 'white',
            fontSize: 14,
            lineHeight: '1.4',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderColor = '#6366f1')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
        />
        {/* Send button — slides in when user starts typing */}
        <button
          type="submit"
          disabled={!input.trim() || sending}
          aria-label="Send message"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            width: input.trim() ? 44 : 0,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#6366f1,#a855f7)',
            border: 'none',
            cursor: 'pointer',
            overflow: 'hidden',
            opacity: input.trim() ? 1 : 0,
            transform: input.trim() ? 'scale(1)' : 'scale(0.6)',
            transition: 'width 0.2s ease, opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: input.trim() ? 'auto' : 'none',
          }}
        >
          {sending
            ? <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
            : <Send size={16} color="white" />
          }
        </button>
      </form>
    </div>
  );
}

/* ── Main Messages page ── */
function Messages() {
  const navigate = useNavigate();
  const { fetchWithAuth, user } = useAuth();
  const { socket, joinUserRoom } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState(null);
  const [showNewMsg, setShowNewMsg] = useState(false);

  // Join personal socket room — re-join immediately and also whenever socket reconnects
  useEffect(() => {
    if (!socket || !user?.id) return;
    const rejoin = () => joinUserRoom(user.id);
    rejoin();
    socket.on('connect', rejoin);
    return () => socket.off('connect', rejoin);
  }, [socket, user?.id, joinUserRoom]);

  // Listen for incoming DMs — refresh conversation list to show latest message + unread
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      fetchWithAuth('/messages/conversations')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setConversations(data); })
        .catch(() => {});
    };
    socket.on('new-dm', handler);
    return () => socket.off('new-dm', handler);
  }, [socket, fetchWithAuth]);

  useEffect(() => {
    fetchWithAuth('/messages/conversations')
      .then(r => r.json())
      .then(data => { setConversations(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchWithAuth]);

  return (
    <div className="relative flex flex-col bg-[#050816]" style={{ height: 'calc(100vh - 70px)' }}>
      <CosmicBackground intensity={0.15} />

      {/* Header — only shown on conversation list */}
      {!activeUser && (
        <div className="relative z-10 flex items-center gap-3 border-b border-white/8 px-4 py-3 bg-[#050816]/90 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-transform active:scale-95"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-lg font-black tracking-tight text-white">Messages</h1>
          <button
            type="button"
            onClick={() => setShowNewMsg(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neon-indigo/40 bg-neon-indigo/15 text-neon-indigo transition-all active:scale-95 hover:bg-neon-indigo/25"
            title="New message"
          >
            <Edit size={16} />
          </button>
        </div>
      )}

      <div className="relative z-10 overflow-hidden" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {activeUser ? (
          <ChatThread otherUser={activeUser} onBack={() => setActiveUser(null)} />
        ) : (
          <ConversationList conversations={conversations} onSelect={setActiveUser} loading={loading} onNewMsg={() => setShowNewMsg(true)} />
        )}
      </div>

      {showNewMsg && (
        <NewConversationModal
          fetchWithAuth={fetchWithAuth}
          onSelect={(u) => { setActiveUser(u); }}
          onClose={() => setShowNewMsg(false)}
        />
      )}
    </div>
  );
}

export default Messages;
