import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Info, Radio, CalendarClock, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useGroupsApi } from '../hooks/useGroupsApi';
import { useMeetingsApi } from '../hooks/useMeetingsApi';
import GroupAvatar from '../components/groups/GroupAvatar';
import GroupMessageList from '../components/groups/GroupMessageList';
import GroupComposer from '../components/groups/GroupComposer';
import MeetingDetails from '../components/meetings/MeetingDetails';

/** The one meeting worth surfacing in the chat header: live first, else next scheduled. */
function pickHeadlineMeeting(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list.find((m) => m.status === 'live') || list.find((m) => m.status === 'scheduled') || null;
}

function MeetingBanner({ meeting, onOpen }) {
  if (!meeting) return null;
  const live = meeting.status === 'live';
  const when = meeting.scheduledAt ? new Date(meeting.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mx-3 mt-2 flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left active:scale-[0.99] ${
        live ? 'border-red-400/40 bg-red-500/10' : 'border-gold-400/25 bg-gold-500/8'
      }`}
      data-testid="meeting-banner"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${live ? 'bg-red-500/20 text-red-300' : 'bg-gold-500/15 text-gold-300'}`}>
        {live ? <Radio size={16} className="animate-pulse" /> : <CalendarClock size={16} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">{meeting.title}</span>
        <span className="block truncate text-[11px] text-white/50">
          {live
            ? `Live now · ${meeting.participantCount || 0} in the room`
            : (when ? `Scheduled · ${when}` : 'Scheduled · host can start any time')}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-white/40" />
    </button>
  );
}

/**
 * GroupChat — full-screen group conversation.
 *
 * Realtime wiring:
 *  - joins the socket room on mount, leaves on unmount
 *  - listens for group-message, group-typing, group-read, group-reaction,
 *    group-member-added/removed, group-updated, group-deleted
 *  - emits typing on input, read receipts on view
 *
 * Sending is REST-first with optimistic insert; the server broadcasts the
 * canonical message back via group-message, and we replace the optimistic
 * temp id with the real one.
 */
function GroupChat({ groupId, onBack, onOpenInfo, initialMeetingId = null }) {
  const { user, showToast } = useAuth();
  const api = useGroupsApi();
  const meetingsApi = useMeetingsApi();
  const { socket, groupJoin, groupLeave, groupTyping, groupRead } = useSocket();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState([]); // [{userId, username}]
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [openMeetingId, setOpenMeetingId] = useState(initialMeetingId);
  const typingTimeouts = useRef(new Map());

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [meta, memRes, msgs] = await Promise.all([
        api.getGroup(groupId),
        api.listMembers(groupId),
        api.listMessages(groupId, { page: 1, limit: 30 }),
      ]);
      setGroup(meta.group);
      setMembers(memRes);
      setMessages(msgs.messages);
      setHasMore(msgs.hasMore);
      setPage(1);
    } catch (err) {
      setLoadError(err.message || 'Failed to load group');
    } finally {
      setLoading(false);
    }
  }, [api, groupId]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Meetings for this group (banner). Refreshed on meeting socket events.
  const loadMeetings = useCallback(() => {
    meetingsApi.list({ groupId }).then(setMeetings).catch(() => {});
  }, [meetingsApi, groupId]);
  useEffect(() => { loadMeetings(); }, [loadMeetings]);
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = (p) => { if (p?.groupId === groupId) loadMeetings(); };
    socket.on('meeting-created', refresh);
    socket.on('meeting-updated', refresh);
    socket.on('meeting-participant', refresh);
    return () => {
      socket.off('meeting-created', refresh);
      socket.off('meeting-updated', refresh);
      socket.off('meeting-participant', refresh);
    };
  }, [socket, groupId, loadMeetings]);
  const headlineMeeting = useMemo(() => pickHeadlineMeeting(meetings), [meetings]);

  // Clear typing timers on unmount.
  useEffect(() => () => {
    typingTimeouts.current.forEach((t) => clearTimeout(t));
    typingTimeouts.current.clear();
  }, []);

  // Socket room join/leave.
  useEffect(() => {
    if (!socket || !groupId) return undefined;
    const rejoin = () => groupJoin(groupId);
    rejoin();
    socket.on('connect', rejoin);
    return () => {
      socket.off('connect', rejoin);
      groupLeave(groupId);
    };
  }, [socket, groupId, groupJoin, groupLeave]);

  // Incoming message + sender ack.
  useEffect(() => {
    if (!socket) return undefined;
    const handler = (msg) => {
      if (!msg || msg.groupId !== groupId) return;
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id || (msg.clientMessageId && m.clientMessageId === msg.clientMessageId))) return prev;
        return [...prev, msg];
      });
      // Mark read if it's from someone else and we're viewing.
      if (msg.senderId !== user?.id) {
        groupRead(groupId, msg.id);
      }
    };
    const ackHandler = (ack) => {
      if (!ack || ack.groupId !== groupId) return;
      setMessages((prev) => prev.map((m) => (m.id === ack.clientMessageId || m.clientMessageId === ack.clientMessageId) ? { ...m, id: ack.messageId } : m));
    };
    socket.on('group-message', handler);
    socket.on('group-message-ack', ackHandler);
    return () => {
      socket.off('group-message', handler);
      socket.off('group-message-ack', ackHandler);
    };
  }, [socket, groupId, user?.id, groupRead]);

  // Typing.
  useEffect(() => {
    if (!socket) return undefined;
    const handler = (payload) => {
      if (!payload || payload.groupId !== groupId || payload.userId === user?.id) return;
      if (payload.isTyping) {
        setTyping((prev) => prev.find((t) => t.userId === payload.userId) ? prev : [...prev, { userId: payload.userId, username: payload.username }]);
        const t = setTimeout(() => {
          setTyping((prev) => prev.filter((x) => x.userId !== payload.userId));
          typingTimeouts.current.delete(payload.userId);
        }, 2500);
        clearTimeout(typingTimeouts.current.get(payload.userId));
        typingTimeouts.current.set(payload.userId, t);
      } else {
        setTyping((prev) => prev.filter((t) => t.userId !== payload.userId));
      }
    };
    socket.on('group-typing', handler);
    return () => socket.off('group-typing', handler);
  }, [socket, groupId, user?.id]);

  // Reactions.
  useEffect(() => {
    if (!socket) return undefined;
    const handler = (payload) => {
      if (!payload || payload.groupId !== groupId) return;
      setMessages((prev) => prev.map((m) => {
        if (m.id !== payload.messageId) return m;
        let reactions = (m.reactions || []).filter((r) => !(r.userId === payload.userId));
        if (!payload.removed) {
          reactions = [...reactions, { userId: payload.userId, emoji: payload.emoji, user: payload.user }];
        }
        return { ...m, reactions };
      }));
    };
    socket.on('group-reaction', handler);
    return () => socket.off('group-reaction', handler);
  }, [socket, groupId]);

  // Member / group lifecycle.
  useEffect(() => {
    if (!socket) return undefined;
    // Refresh only the member list — a full reload would blank the thread.
    const memberAdded = (p) => {
      if (p?.groupId !== groupId) return;
      api.listMembers(groupId).then(setMembers).catch(() => {});
    };
    const memberRemoved = (p) => {
      if (p?.groupId !== groupId) return;
      if (p.userId === user?.id) { showToast('You were removed from the group'); onBack(); return; }
      setMembers((prev) => prev.filter((m) => m.userId !== p.userId));
    };
    const updated = (p) => { if (p?.group?.id === groupId) setGroup(p.group); else if (p?.groupId === groupId && p.group) setGroup(p.group); };
    const deleted = (p) => { if (p?.groupId === groupId) { showToast('Group was deleted'); onBack(); } };
    socket.on('group-member-added', memberAdded);
    socket.on('group-member-removed', memberRemoved);
    socket.on('group-updated', updated);
    socket.on('group-deleted', deleted);
    return () => {
      socket.off('group-member-added', memberAdded);
      socket.off('group-member-removed', memberRemoved);
      socket.off('group-updated', updated);
      socket.off('group-deleted', deleted);
    };
  }, [socket, groupId, api, onBack, showToast]);

  // Send text (optimistic).
  const sendText = useCallback(async (content) => {
    const clientMessageId = crypto.randomUUID();
    const optimistic = {
      id: clientMessageId,
      clientMessageId,
      groupId,
      senderId: user.id,
      content,
      messageType: 'text',
      createdAt: new Date().toISOString(),
      sender: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar },
      reactions: [],
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await api.sendText(groupId, content, clientMessageId);
      // Dedup: remove the optimistic temp AND any socket-broadcast copy that
      // may have arrived with the real id, then append the canonical one.
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimistic.id && m.clientMessageId !== clientMessageId && m.id !== msg.id);
        return [...without, msg];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id && m.clientMessageId !== clientMessageId));
      showToast(err.message || 'Failed to send', 'error');
    }
  }, [api, groupId, user, showToast]);

  // Send media (optimistic).
  const sendMedia = useCallback(async (file, caption) => {
    const clientMessageId = crypto.randomUUID();
    const optimistic = {
      id: clientMessageId,
      clientMessageId,
      groupId,
      senderId: user.id,
      content: caption || null,
      messageType: file.type.startsWith('video') ? 'video' : 'image',
      mediaUrl: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
      sender: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar },
      reactions: [],
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await api.sendMedia(groupId, file, caption, clientMessageId);
      URL.revokeObjectURL(optimistic.mediaUrl);
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== optimistic.id && m.clientMessageId !== clientMessageId && m.id !== msg.id);
        return [...without, msg];
      });
    } catch (err) {
      URL.revokeObjectURL(optimistic.mediaUrl);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id && m.clientMessageId !== clientMessageId));
      showToast(err.message || 'Failed to upload', 'error');
    }
  }, [api, groupId, user, showToast]);

  // React.
  const onReact = useCallback(async (messageId, emoji) => {
    // Optimistic toggle.
    setMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m;
      const existing = (m.reactions || []).find((r) => r.userId === user.id);
      let reactions;
      if (existing && existing.emoji === emoji) {
        reactions = (m.reactions || []).filter((r) => r.userId !== user.id);
      } else if (existing) {
        reactions = (m.reactions || []).map((r) => (r.userId === user.id ? { ...r, emoji } : r));
      } else {
        reactions = [...(m.reactions || []), { userId: user.id, emoji, user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar } }];
      }
      return { ...m, reactions };
    }));
    try {
      await api.react(messageId, emoji);
    } catch (err) {
      // Revert by reloading that message's reactions is overkill; surface toast.
      showToast(err.message || 'Failed to react', 'error');
    }
  }, [api, user, showToast]);

  // Load older messages (top paging).
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const msgs = await api.listMessages(groupId, { page: next, limit: 30 });
      setMessages((prev) => [...msgs.messages, ...prev]);
      setHasMore(msgs.hasMore);
      setPage(next);
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  }, [api, groupId, hasMore, loadingMore, page]);

  const typingLabel = (() => {
    if (typing.length === 0) return null;
    if (typing.length === 1) return `${typing[0].username} is typing…`;
    if (typing.length === 2) return `${typing[0].username} and ${typing[1].username} are typing…`;
    return `${typing[0].username} and ${typing.length - 1} others are typing…`;
  })();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#050816]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#050816] px-8 text-center">
        <p className="text-sm text-white/50">{loadError || "This group isn't available."}</p>
        <div className="flex gap-2">
          <button type="button" onClick={loadInitial} className="ik-btn ik-btn-primary ik-btn-pill px-5 py-2 text-sm">Retry</button>
          <button type="button" onClick={onBack} className="ik-btn ik-btn-secondary ik-btn-pill px-5 py-2 text-sm">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="z-[250] flex flex-col" style={{ position: 'fixed', inset: 0, background: '#050816', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/8 bg-[#050816]/95 px-3 py-3">
        <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <ArrowLeft size={18} />
        </button>
        <button type="button" onClick={onOpenInfo} className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]">
          <GroupAvatar group={group} members={members} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{group.name}</p>
            <p className="truncate text-xs text-white/40">
              {typingLabel || `${members.length} member${members.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </button>
        <button type="button" onClick={onOpenInfo} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95" style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Group info">
          <Info size={18} />
        </button>
      </div>

      {/* Live / upcoming meeting */}
      <MeetingBanner meeting={headlineMeeting} onOpen={() => setOpenMeetingId(headlineMeeting.id)} />

      {/* Messages */}
      <GroupMessageList
        messages={messages}
        currentUserId={user.id}
        onReact={onReact}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loadingMore={loadingMore}
      />

      {/* Composer */}
      <GroupComposer
        onSendText={sendText}
        onSendMedia={sendMedia}
        onTyping={(isTyping) => groupTyping(groupId, isTyping)}
      />

      {openMeetingId && (
        <MeetingDetails
          meetingId={openMeetingId}
          onClose={() => setOpenMeetingId(null)}
          onChanged={loadMeetings}
        />
      )}
    </div>
  );
}

export default GroupChat;
