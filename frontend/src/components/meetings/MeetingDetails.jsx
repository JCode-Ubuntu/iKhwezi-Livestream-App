import React, { useCallback, useEffect, useState } from 'react';
import { X, Play, Square, LogIn, LogOut, Ban, Users, CalendarClock, Radio, Info, Crown, PhoneCall } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useMeetingsApi } from '../../hooks/useMeetingsApi';
import { resolveMediaUrl } from '../../config/appConfig';

// LiveKit drags the whole WebRTC stack (~400 kB) into the bundle. It is only
// needed once a member actually opens a call, so it is code-split: the chunk
// downloads on first "Join call" instead of bloating every Messages-page load.
const MeetingRoom = React.lazy(() => import('./MeetingRoom'));

/**
 * MeetingDetails — bottom sheet for one meeting.
 *
 * Renders exactly what the server says is possible (`meeting.capabilities` +
 * `meeting.viewer`): presence (join/leave), lifecycle (start/end/cancel for
 * host or group admins), participant list. When the server reports A/V
 * available (LiveKit configured), "Join call" opens the MeetingRoom surface;
 * otherwise the sheet stays presence-only and says so honestly.
 *
 * Realtime: refetches on meeting-updated / meeting-participant for this id.
 */
const STATUS_LABEL = { live: 'Live now', scheduled: 'Scheduled', ended: 'Ended', cancelled: 'Cancelled' };
const STATUS_CLASS = {
  live: 'bg-red-500/20 text-red-300 border-red-400/40',
  scheduled: 'bg-gold-500/15 text-gold-300 border-gold-400/30',
  ended: 'bg-white/8 text-white/50 border-white/10',
  cancelled: 'bg-white/8 text-white/40 border-white/10',
};

function formatWhen(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; }
}

function Avatar({ user, size = 32 }) {
  return (
    <span className="avatar flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {user?.avatar
        ? <img src={resolveMediaUrl(user.avatar)} alt="" className="h-full w-full rounded-full object-cover" />
        : (user?.username || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function MeetingDetails({ meetingId, onClose, onChanged }) {
  const { showToast } = useAuth();
  const { socket } = useSocket();
  const api = useMeetingsApi();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [inCall, setInCall] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await api.get(meetingId);
      setMeeting(m);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [api, meetingId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = (p) => { if (p?.meetingId === meetingId) load(); };
    socket.on('meeting-updated', refresh);
    socket.on('meeting-participant', refresh);
    return () => {
      socket.off('meeting-updated', refresh);
      socket.off('meeting-participant', refresh);
    };
  }, [socket, meetingId, load]);

  const run = async (action, fn, successMsg) => {
    if (busy) return;
    setBusy(action);
    try {
      const m = await fn(meetingId);
      setMeeting(m);
      onChanged?.(m);
      if (successMsg) showToast(successMsg);
    } catch (err) {
      showToast(err.message || `Couldn't ${action} the meeting`, 'error');
    } finally {
      setBusy('');
    }
  };

  // If the meeting stops being live while a member is in the call (host
  // ended / cancelled), close the call surface. The SFU force-close also
  // disconnects the room, but the UI must follow the authoritative DB state.
  useEffect(() => {
    if (inCall && meeting && meeting.status !== 'live') setInCall(false);
  }, [inCall, meeting]);

  // A full-screen call replaces the sheet while in the call.
  if (inCall && meeting && meeting.status === 'live') {
    return (
      <React.Suspense
        fallback={(
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#0b0d12]">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
          </div>
        )}
      >
        <MeetingRoom
          meeting={meeting}
          onLeave={() => {
            setInCall(false);
            // Leaving the call surface also leaves presence if we had joined,
            // then refresh either way.
            if (meeting.viewer?.isJoined) api.leave(meeting.id).catch(() => {});
            load();
          }}
        />
      </React.Suspense>
    );
  }

  const viewer = meeting?.viewer || {};
  const caps = meeting?.capabilities || {};
  const participants = meeting?.participants || [];

  return (
    <div className="fixed inset-0 z-[420] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal aria-label="Meeting details">
      <div
        className="ultima-glass w-full max-w-lg rounded-t-[28px] px-5 pt-3"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))', maxHeight: '88dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Meeting</p>
            <h2 className="truncate text-lg font-bold text-white">{meeting?.title || (loading ? 'Loading…' : 'Meeting')}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
            <button type="button" onClick={load} className="ml-3 underline">Retry</button>
          </div>
        )}

        {!loading && meeting && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_CLASS[meeting.status] || STATUS_CLASS.ended}`}>
                {meeting.status === 'live' ? <Radio size={11} className="animate-pulse" /> : <CalendarClock size={11} />}
                {STATUS_LABEL[meeting.status] || meeting.status}
              </span>
              {meeting.group?.name && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/60">
                  <Users size={11} /> {meeting.group.name}
                </span>
              )}
            </div>

            <div className="mb-4 space-y-1.5 text-sm text-white/70">
              {meeting.host && (
                <p className="flex items-center gap-2"><Crown size={13} className="text-gold-400" /> Host · {meeting.host.displayName || meeting.host.username}</p>
              )}
              {meeting.status === 'scheduled' && (
                <p>{meeting.scheduledAt ? `Starts ${formatWhen(meeting.scheduledAt)}` : 'No set time — the host can start it any time'}</p>
              )}
              {meeting.status === 'live' && meeting.startedAt && <p>Started {formatWhen(meeting.startedAt)}</p>}
              {meeting.status === 'ended' && meeting.endedAt && <p>Ended {formatWhen(meeting.endedAt)}</p>}
              {meeting.description && <p className="whitespace-pre-wrap text-white/55">{meeting.description}</p>}
            </div>

            {/* Participants */}
            <div className="mb-4 rounded-2xl border border-white/8 bg-white/4 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                In the room · {meeting.participantCount ?? participants.length}
              </p>
              {participants.length === 0 ? (
                <p className="text-xs text-white/40">{meeting.status === 'live' ? 'Nobody has joined yet.' : 'Participants appear here once the meeting is live.'}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {participants.map((p) => (
                    <span key={p.userId} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3">
                      <Avatar user={p.user} size={22} />
                      <span className="text-xs font-semibold text-white/80">{p.user?.displayName || p.user?.username}</span>
                      {p.role === 'host' && <Crown size={11} className="text-gold-400" />}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Honest capability notice — only when A/V is NOT available */}
            {(caps.audio === false || caps.video === false) && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-white/8 bg-white/4 p-3 text-xs text-white/50">
                <Info size={14} className="mt-0.5 shrink-0 text-gold-300" />
                <p>
                  Audio and video are not enabled on this server. Joining marks you present
                  and the conversation continues in the group chat.
                </p>
              </div>
            )}

            {/* Actions — driven by viewer + status + capabilities */}
            <div className="flex flex-wrap gap-2">
              {caps.audio && caps.video && meeting.status === 'live' && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    // Opening the call also marks presence, so the roster
                    // matches who is actually in the room.
                    if (!viewer.isJoined) {
                      api.join(meeting.id)
                        .then((m) => { setMeeting(m); onChanged?.(m); })
                        .catch(() => { /* presence is best-effort */ });
                    }
                    setInCall(true);
                  }}
                  className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-40"
                  data-testid="join-call"
                >
                  <PhoneCall size={15} /> {viewer.isJoined ? 'Return to call' : 'Join call'}
                </button>
              )}
              {meeting.status === 'live' && caps.presence && !viewer.isJoined && !(caps.audio && caps.video) && (
                <button type="button" disabled={!!busy} onClick={() => run('join', api.join, 'You joined the meeting')} className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-40">
                  <LogIn size={15} /> Join
                </button>
              )}
              {meeting.status === 'live' && viewer.isJoined && (
                <button type="button" disabled={!!busy} onClick={() => run('leave', api.leave, 'You left the meeting')} className="ik-btn ik-btn-secondary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-40">
                  <LogOut size={15} /> Leave
                </button>
              )}
              {meeting.status === 'scheduled' && viewer.canManage && (
                <button type="button" disabled={!!busy} onClick={() => run('start', api.start, 'Meeting started')} className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-40">
                  <Play size={15} /> Start now
                </button>
              )}
              {meeting.status === 'live' && viewer.canManage && (
                <button type="button" disabled={!!busy} onClick={() => run('end', api.end, 'Meeting ended')} className="ik-btn ik-btn-secondary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-red-300 disabled:opacity-40">
                  <Square size={15} /> End meeting
                </button>
              )}
              {meeting.status === 'scheduled' && viewer.canManage && (
                <button type="button" disabled={!!busy} onClick={() => run('cancel', api.cancel, 'Meeting cancelled')} className="ik-btn ik-btn-secondary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white/60 disabled:opacity-40">
                  <Ban size={15} /> Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MeetingDetails;
