import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import CosmicBackground from '../components/CosmicBackground';

/* ── Conversation list ── */
function ConversationList({ conversations, onSelect, loading }) {
  const [search, setSearch] = useState('');
  const filtered = conversations.filter(c =>
    (c.user?.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.user?.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/8">
          <Search size={15} className="text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neon-indigo border-t-transparent" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
            <MessageCircle size={40} />
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs text-center px-8">Follow a creator and tap their profile to start a conversation</p>
          </div>
        )}
        {filtered.map(conv => (
          <button
            key={conv.user?.id}
            type="button"
            onClick={() => onSelect(conv.user)}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/8 transition-colors border-b border-white/4 text-left"
          >
            <div className="avatar flex-shrink-0" style={{ width: 44, height: 44, fontSize: 16 }}>
              {conv.user?.avatar
                ? <img src={conv.user.avatar} alt="" />
                : conv.user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-white truncate">
                  {conv.user?.displayName || conv.user?.username}
                </p>
                {conv.unread > 0 && (
                  <span className="flex-shrink-0 ml-2 h-5 w-5 flex items-center justify-center rounded-full bg-neon-indigo text-[10px] font-bold text-white">
                    {conv.unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/45 truncate mt-0.5">
                {conv.lastMessage?.content}
              </p>
            </div>
          </button>
        ))}
      </div>
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

  const load = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`/messages/${otherUser.id}`);
      if (res.ok) setMessages(await res.json());
    } catch {}
  }, [fetchWithAuth, otherUser.id]);

  useEffect(() => { load(); }, [load]);

  // Join our own room so we receive real-time DMs
  useEffect(() => {
    if (user?.id) joinUserRoom(user.id);
  }, [user?.id, joinUserRoom]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
        <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-transform active:scale-95">
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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
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

      {/* Input */}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-white/8 bg-[#050816]/95 px-4 py-3 pb-safe">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message…"
          className="flex-1 rounded-full bg-white/6 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-white/35 outline-none focus:border-neon-indigo/50"
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-neon-indigo text-white transition-all disabled:opacity-40 active:scale-95"
        >
          <Send size={16} />
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

  // Join personal socket room for real-time DMs
  useEffect(() => {
    if (user?.id) joinUserRoom(user.id);
  }, [user?.id]);

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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-transform active:scale-95"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-black tracking-tight text-white">Messages</h1>
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-hidden">
        {activeUser ? (
          <ChatThread otherUser={activeUser} onBack={() => setActiveUser(null)} />
        ) : (
          <ConversationList conversations={conversations} onSelect={setActiveUser} loading={loading} />
        )}
      </div>
    </div>
  );
}

export default Messages;
