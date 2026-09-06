import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, X, MessageCircle, Users, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCreateFlow } from '../context/CreateFlowContext';
import UltimaField from '../ultima/UltimaField';
import GuestPrompt from '../components/GuestPrompt';
import { resolveMediaUrl } from '../config/appConfig';
import { useGroupsApi } from '../hooks/useGroupsApi';
import GroupAvatar from '../components/groups/GroupAvatar';
import DmThread from '../components/messages/DmThread';
import GroupChat from './GroupChat';
import GroupInfo from './GroupInfo';

/**
 * Messages
 * ├── Direct   — 1:1 conversations (DmThread)
 * └── Groups   — group conversations (GroupChat / GroupInfo)
 *
 * Starting something new (a DM, a group, a meeting) is NOT done here — that is
 * the CREATE hub's job. This page receives hand-offs via router state:
 *   { openUser }                    → open a DM thread
 *   { openGroupId, openMeetingId? } → open a group chat (optionally a meeting)
 * and consumes the state so back/forward navigation does not replay it.
 */

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'direct', label: 'Direct' },
  { id: 'groups', label: 'Groups' },
  { id: 'unread', label: 'Unread' },
];

function FilterBar({ active, onChange, unreadCount }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2 overflow-x-auto px-4 py-2 border-b border-white/8" style={{ scrollbarWidth: 'none' }}>
      {FILTERS.map((f) => {
        const isActive = active === f.id;
        const badge = f.id === 'unread' && unreadCount > 0 ? unreadCount : null;
        return (
          <button key={f.id} type="button" onClick={() => onChange(f.id)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              isActive ? 'bg-gradient-to-br from-pink-500 to-[#C13584] text-white' : 'bg-white/6 text-white/55 border border-white/10'
            }`}>
            {f.label}
            {badge != null && <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/20 px-1 text-[10px]">{badge > 99 ? '99+' : badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ThreadList({ threads, onSelect, loading, error, onRetry, onCreate, search, setSearch }) {
  const filtered = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    if (t.type === 'group') return (t.group?.name || '').toLowerCase().includes(q);
    return (t.user?.username || '').toLowerCase().includes(q) || (t.user?.displayName || '').toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full" style={{ position: 'relative' }}>
      <div className="px-4 py-2 border-b border-white/8">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/8">
          <Search size={15} className="text-white/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
          {search && <button type="button" onClick={() => setSearch('')} className="text-white/30 hover:text-white/60"><X size={14} /></button>}
        </div>
      </div>

      <div className="ultima-nav-scroll flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(var(--ultima-nav-offset, 4rem) + 4.5rem)' }}>
        {loading && (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>
        )}
        {!loading && error && (
          <div className="mx-4 mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {error}
            <button type="button" onClick={onRetry} className="ml-3 font-semibold underline">Retry</button>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/15 to-gold-500/15 border border-pink-400/20">
              <MessageCircle size={30} className="text-pink-300/70" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/60 mb-1">{search.trim() ? 'No matches' : 'No conversations yet'}</p>
              <p className="text-xs text-white/35">
                {search.trim() ? 'Try a different name' : 'Use Create to start a chat or a group'}
              </p>
            </div>
            {!search.trim() && (
              <button type="button" onClick={onCreate} className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold">
                <Plus size={16} /> Create
              </button>
            )}
          </div>
        )}
        {filtered.map((t) => (
          <button key={t.type === 'group' ? `g-${t.group.id}` : `d-${t.user.id}`} type="button" onClick={() => onSelect(t)}
            className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/8 transition-colors border-b border-white/4 text-left">
            {t.type === 'group' ? (
              <GroupAvatar group={t.group} members={t.members || []} size={48} />
            ) : (
              <div className="avatar flex-shrink-0" style={{ width: 48, height: 48, fontSize: 17 }}>
                {t.user?.avatar ? <img src={resolveMediaUrl(t.user.avatar)} alt="" className="w-full h-full object-cover rounded-full" /> : t.user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="font-semibold text-sm text-white truncate flex items-center gap-1.5">
                  {t.type === 'group' && <Users size={12} className="text-gold-300/70 flex-shrink-0" />}
                  {t.type === 'group' ? t.group.name : (t.user?.displayName || t.user?.username)}
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {t.lastMessage?.createdAt && (
                    <span className="text-[11px] text-white/30">{new Date(t.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                  {t.unread > 0 && (
                    <span className="h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-gold-500 text-[10px] font-bold text-white">{t.unread > 99 ? '99+' : t.unread}</span>
                  )}
                </div>
              </div>
              <p className={`text-xs truncate mt-0.5 ${t.unread > 0 ? 'text-white/70 font-medium' : 'text-white/40'}`}>
                {t.preview || 'No messages yet'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function previewFor(t) {
  const m = t.lastMessage;
  if (!m) return '';
  const who = t.type === 'group'
    ? (m.senderId === t.meId ? 'You' : (m.sender?.displayName || m.sender?.username || '')) + ': '
    : '';
  const body = m.content || (m.messageType === 'image' ? '📷 Photo' : m.messageType === 'video' ? '🎬 Video' : '');
  return who + body;
}

function Messages() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchWithAuth, user, isGuest } = useAuth();
  const { socket, joinUserRoom } = useSocket();
  const { openCreateSheet } = useCreateFlow();
  const groupsApi = useGroupsApi();

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dmThreads, setDmThreads] = useState([]);
  const [groupThreads, setGroupThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeDm, setActiveDm] = useState(null);
  // Group hand-off carries only an id (the thread list may not be loaded yet).
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeMeetingId, setActiveMeetingId] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Apply the router hand-off on EVERY navigation into this page — including
  // when we are already on /messages (CREATE → Message/Meeting while browsing
  // the list re-navigates to the same route without remounting). The state is
  // then cleared so back/forward does not replay it. `location.key` changes on
  // each navigate() call, which is what makes the same-route case observable.
  useEffect(() => {
    if (isGuest) return; // the guest branch below reads the state directly
    const s = location.state;
    if (!s || (!s.openUser && !s.openGroupId)) return;
    if (s.openUser) {
      setActiveGroup(null);
      setActiveMeetingId(null);
      setActiveDm(s.openUser);
    } else if (s.openGroupId) {
      setActiveDm(null);
      setActiveGroup({ id: s.openGroupId });
      setActiveMeetingId(s.openMeetingId || null);
    }
    setShowGroupInfo(false);
    navigate(location.pathname, { replace: true, state: null });
  }, [isGuest, location.key, location.state, location.pathname, navigate]);

  // In-flight guard: socket bursts (several messages arriving together) must
  // not fan out into overlapping list reloads.
  const inFlight = useRef(false);
  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (isGuest) { setLoading(false); return; }
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const [dmRes, groups] = await Promise.all([
        fetchWithAuth('/messages/conversations'),
        groupsApi.listThreads(),
      ]);
      const dms = dmRes.ok ? await dmRes.json() : [];
      setDmThreads(Array.isArray(dms) ? dms : []);
      setGroupThreads(Array.isArray(groups) ? groups : []);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message || "Couldn't load your conversations.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [isGuest, fetchWithAuth, groupsApi]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Personal socket room (the server also auto-joins on connect; this covers
  // older backends and reconnects).
  useEffect(() => {
    if (isGuest || !socket || !user?.id) return undefined;
    const rejoin = () => joinUserRoom(user.id);
    rejoin();
    socket.on('connect', rejoin);
    return () => socket.off('connect', rejoin);
  }, [isGuest, socket, user?.id, joinUserRoom]);

  // Refresh the list (silently) on any incoming DM or group event.
  useEffect(() => {
    if (isGuest || !socket) return undefined;
    const refresh = () => loadAll({ silent: true });
    const events = ['new-dm', 'group-message', 'group-member-added', 'group-member-removed', 'group-updated', 'group-deleted'];
    events.forEach((e) => socket.on(e, refresh));
    return () => events.forEach((e) => socket.off(e, refresh));
  }, [isGuest, socket, loadAll]);

  // If the group we were handed no longer exists for us, fall back to the list.
  useEffect(() => {
    if (!socket || !activeGroup?.id) return undefined;
    const gone = (p) => {
      if (p?.groupId !== activeGroup.id) return;
      if (p.userId && p.userId !== user?.id) return;
      setActiveGroup(null);
      setShowGroupInfo(false);
    };
    socket.on('group-deleted', gone);
    socket.on('group-member-removed', gone);
    return () => {
      socket.off('group-deleted', gone);
      socket.off('group-member-removed', gone);
    };
  }, [socket, activeGroup?.id, user?.id]);

  // Merge DM + group threads into one list with a preview + type tag.
  const merged = [
    ...dmThreads.map((c) => ({ type: 'direct', user: c.user, lastMessage: c.lastMessage, unread: c.unread || 0, preview: c.lastMessage?.content || 'No messages yet', meId: user?.id })),
    ...groupThreads.map((g) => ({
      type: 'group', group: g.group, members: g.members || g.group?.members || [],
      lastMessage: g.lastMessage, unread: g.unread || 0,
      preview: previewFor({ ...g, meId: user?.id }),
      meId: user?.id,
    })),
  ];

  const filtered = merged.filter((t) => {
    if (filter === 'direct') return t.type === 'direct';
    if (filter === 'groups') return t.type === 'group';
    if (filter === 'unread') return t.unread > 0;
    return true;
  });
  const totalUnread = merged.reduce((n, t) => n + (t.unread || 0), 0);

  const onSelectThread = (t) => {
    if (t.type === 'group') { setActiveGroup(t.group); setActiveMeetingId(null); }
    else setActiveDm(t.user);
  };

  const closeGroup = () => {
    setActiveGroup(null);
    setActiveMeetingId(null);
    setShowGroupInfo(false);
    loadAll({ silent: true }); // pick up read state / new threads
  };

  if (isGuest) {
    const openTarget = location.state?.openUser;
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-void-950">
        <div className="ultima-page ultima-content flex min-h-0 flex-1 flex-col">
          {showGuestPrompt ? (
            <GuestPrompt onClose={() => navigate('/')} context="interaction" />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
              <p className="text-sm text-white/50">
                {openTarget ? `Sign in to message @${openTarget.username || 'this creator'}.` : 'Sign in to send and receive messages.'}
              </p>
              <button type="button" onClick={() => navigate('/login', { state: { from: '/messages', openUser: openTarget } })} className="ik-btn ik-btn-primary ik-btn-pill px-6 py-2.5 text-sm font-bold">Sign in</button>
              <button type="button" onClick={() => setShowGuestPrompt(true)} className="text-sm font-semibold text-gold-400">Create free account</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-void-950">
      <UltimaField intensity={0.15} fixed />

      {!activeDm && !activeGroup && (
        <div className="relative flex items-center gap-3 border-b border-white/8 px-4 py-3 bg-[#050816]/90 backdrop-blur-xl">
          <button type="button" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-transform active:scale-95" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-lg font-black tracking-tight text-white">Messages</h1>
        </div>
      )}

      <div className="ultima-content relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {!activeDm && !activeGroup && (
          <FilterBar active={filter} onChange={setFilter} unreadCount={totalUnread} />
        )}

        {activeGroup ? (
          <GroupChat
            key={activeGroup.id}
            groupId={activeGroup.id}
            initialMeetingId={activeMeetingId}
            onBack={closeGroup}
            onOpenInfo={() => setShowGroupInfo(true)}
          />
        ) : activeDm ? (
          <DmThread key={activeDm.id} otherUser={activeDm} onBack={() => { setActiveDm(null); loadAll({ silent: true }); }} />
        ) : (
          <ThreadList
            threads={filtered}
            onSelect={onSelectThread}
            loading={loading}
            error={loadError}
            onRetry={() => loadAll()}
            onCreate={openCreateSheet}
            search={search}
            setSearch={setSearch}
          />
        )}
      </div>

      {activeGroup && showGroupInfo && (
        <GroupInfo
          groupId={activeGroup.id}
          onBack={() => setShowGroupInfo(false)}
          onLeft={closeGroup}
        />
      )}
    </div>
  );
}

export default Messages;
