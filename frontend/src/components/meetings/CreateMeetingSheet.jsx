import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, X, Check, CalendarClock, Play, Users, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGroupsApi } from '../../hooks/useGroupsApi';
import { useMeetingsApi } from '../../hooks/useMeetingsApi';
import GroupAvatar from '../groups/GroupAvatar';

/**
 * CreateMeetingSheet — CREATE → Meeting.
 *
 * A meeting always belongs to one of the user's groups (that is where the
 * conversation and the participant list live). Flow:
 *   pick group → title (+ description) → Start now | Schedule → create
 *
 * Honest capability state: this release supports scheduling + presence. It
 * does not pretend to offer audio/video — see MeetingDetails for the notice.
 */
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function CreateMeetingSheet({ onClose, onCreated, onNeedGroup, preselectedGroupId = null }) {
  const { showToast } = useAuth();
  const groupsApi = useGroupsApi();
  const meetingsApi = useMeetingsApi();

  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState('');
  const [groupId, setGroupId] = useState(preselectedGroupId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('now'); // 'now' | 'schedule'
  const [scheduledAt, setScheduledAt] = useState(() => toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingGroups(true);
    setGroupsError('');
    groupsApi.listThreads()
      .then((threads) => {
        if (cancelled) return;
        const list = threads.map((t) => ({ group: t.group, members: t.members || [] }));
        setGroups(list);
        if (!preselectedGroupId && list.length === 1) setGroupId(list[0].group.id);
      })
      .catch((err) => { if (!cancelled) setGroupsError(err.message || 'Failed to load your groups'); })
      .finally(() => { if (!cancelled) setLoadingGroups(false); });
    return () => { cancelled = true; };
  }, [groupsApi, preselectedGroupId]);

  // Mirrors backend/meetings/validation.js (TITLE_MIN 2, TITLE_MAX 120).
  const titleValid = title.trim().length >= 2 && title.trim().length <= 120;
  const scheduleValid = mode === 'now' || (scheduledAt && new Date(scheduledAt).getTime() > Date.now());
  const canSubmit = !!groupId && titleValid && scheduleValid && !creating;

  const selected = useMemo(() => groups.find((g) => g.group.id === groupId), [groups, groupId]);

  const submit = async () => {
    if (!canSubmit) return;
    setCreating(true);
    setError('');
    try {
      const meeting = await meetingsApi.create({
        groupId,
        title: title.trim(),
        description: description.trim(),
        startNow: mode === 'now',
        scheduledAt: mode === 'schedule' ? new Date(scheduledAt).toISOString() : null,
      });
      showToast(mode === 'now' ? 'Meeting started' : 'Meeting scheduled');
      onCreated?.(meeting);
    } catch (err) {
      setError(err.message || "Couldn't create the meeting. Try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="z-[400] flex flex-col" style={{ position: 'fixed', inset: 0, background: '#050816' }} role="dialog" aria-modal aria-label="New meeting">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h2 className="flex-1 text-base font-bold text-white">New Meeting</h2>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95" style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5" style={{ minHeight: 0 }}>
        {/* Group */}
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">Group</label>
        {loadingGroups && (
          <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" /></div>
        )}
        {!loadingGroups && groupsError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {groupsError}
          </div>
        )}
        {!loadingGroups && !groupsError && groups.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <div className="mb-2 flex items-center gap-2 text-white">
              <Users size={16} className="text-gold-300" />
              <p className="text-sm font-semibold">Meetings live inside groups</p>
            </div>
            <p className="mb-3 text-xs text-white/50">You are not in any group yet. Create one first, then start or schedule a meeting for its members.</p>
            <button type="button" onClick={onNeedGroup} className="ik-btn ik-btn-primary ik-btn-pill px-5 py-2 text-sm font-bold">Create a group</button>
          </div>
        )}
        {!loadingGroups && groups.length > 0 && (
          <div className="mb-5 space-y-1 rounded-2xl border border-white/8 bg-white/4 p-1" role="radiogroup" aria-label="Choose a group">
            {groups.map(({ group, members }) => {
              const active = group.id === groupId;
              return (
                <button
                  key={group.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setGroupId(group.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-pink-500/15' : 'hover:bg-white/4'}`}
                >
                  <GroupAvatar group={group} members={members} size={36} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{group.name}</p>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? 'border-pink-400 bg-pink-500 text-white' : 'border-white/20 text-transparent'}`}>
                    <Check size={12} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {groups.length > 0 && (
          <>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/40">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Weekly planning"
              className="mb-4 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-pink-400/50"
            />

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/40">Agenda (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What is this meeting about?"
              className="mb-5 w-full resize-none rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-pink-400/50"
            />

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">When</label>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('now')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${mode === 'now' ? 'border-pink-400/50 bg-pink-500/15 text-white' : 'border-white/10 bg-white/4 text-white/60'}`}>
                <Play size={15} /> Start now
              </button>
              <button type="button" onClick={() => setMode('schedule')} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold ${mode === 'schedule' ? 'border-pink-400/50 bg-pink-500/15 text-white' : 'border-white/10 bg-white/4 text-white/60'}`}>
                <CalendarClock size={15} /> Schedule
              </button>
            </div>
            {mode === 'schedule' && (
              <input
                type="datetime-local"
                value={scheduledAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mb-4 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/50 [color-scheme:dark]"
              />
            )}
            {mode === 'schedule' && !scheduleValid && (
              <p className="mb-3 text-xs text-red-400">Pick a time in the future.</p>
            )}

            <div className="mt-2 flex items-start gap-2 rounded-2xl border border-white/8 bg-white/4 p-3 text-xs text-white/50">
              <Info size={14} className="mt-0.5 shrink-0 text-gold-300" />
              <p>
                Meetings in this release track who is in the room and post updates to the group chat.
                Audio and video conferencing are not available yet
                {selected ? ` — members of ${selected.group.name} will be notified.` : '.'}
              </p>
            </div>

            {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
          </>
        )}
      </div>

      {groups.length > 0 && (
        <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-white/8 px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button type="button" disabled={!canSubmit} onClick={submit} className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-2 px-6 py-2.5 text-sm font-bold disabled:opacity-40">
            {creating
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              : (mode === 'now' ? <Play size={16} /> : <CalendarClock size={16} />)}
            {mode === 'now' ? 'Start meeting' : 'Schedule meeting'}
          </button>
        </div>
      )}
    </div>
  );
}

export default CreateMeetingSheet;
