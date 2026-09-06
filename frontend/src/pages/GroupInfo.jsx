import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Crown, Shield, UserMinus, UserPlus, Bell, BellOff, LogOut, Trash2, Pencil, Check, X, Camera, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCreateFlow } from '../context/CreateFlowContext';
import { useGroupsApi } from '../hooks/useGroupsApi';
import { resolveMediaUrl } from '../config/appConfig';
import GroupAvatar from '../components/groups/GroupAvatar';
import AddMembersModal from '../components/messages/AddMembersModal';

/**
 * GroupInfo — full-screen group information sheet.
 *
 * Sections: avatar/name/description, members, notifications (mute), leave,
 * danger zone (admins: edit, manage members, transfer ownership, delete).
 *
 * Role gating mirrors the server: owner can do everything; admin can manage
 * members + edit; member can only chat. The server is the real authority —
 * these UI states are cosmetic.
 */
function GroupInfo({ groupId, onBack, onLeft }) {
  const { user, showToast } = useAuth();
  const { openCreate } = useCreateFlow();
  const api = useGroupsApi();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAvatar, setEditAvatar] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = React.useRef(null);

  const me = members.find((m) => m.userId === user?.id);
  const myRole = me?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meta, memRes] = await Promise.all([api.getGroup(groupId), api.listMembers(groupId)]);
      setGroup(meta.group);
      setMembers(memRes);
      setMuted(meta.muted || false);
      setEditName(meta.group?.name || '');
      setEditDesc(meta.group?.description || '');
    } catch (err) {
      showToast(err.message || 'Failed to load group', 'error');
    } finally {
      setLoading(false);
    }
  }, [api, groupId, showToast]);

  useEffect(() => { load(); }, [load]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const updated = await api.updateGroup(groupId, {
        name: editName.trim(),
        description: editDesc.trim(),
        avatarFile: editAvatar,
      });
      setGroup(updated);
      setEditAvatar(null);
      setEditAvatarPreview(null);
      setEditing(false);
      showToast('Group updated');
    } catch (err) {
      showToast(err.message || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try { await api.setMute(groupId, next); } catch { setMuted(!next); }
  };

  const leave = async () => {
    if (!confirm('Leave this group?')) return;
    try {
      await api.leaveGroup(groupId);
      onLeft();
    } catch (err) {
      showToast(err.message || 'Failed to leave', 'error');
    }
  };

  const removeMember = async (memberUserId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api.removeMember(groupId, memberUserId);
      setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
      showToast('Member removed');
    } catch (err) {
      showToast(err.message || 'Failed to remove', 'error');
    }
  };

  const setRole = async (memberUserId, role) => {
    try {
      await api.promoteMember(groupId, memberUserId, role);
      setMembers((prev) => prev.map((m) => (m.userId === memberUserId ? { ...m, role } : m)));
      showToast(role === 'admin' ? 'Promoted to admin' : 'Demoted to member');
    } catch (err) {
      showToast(err.message || 'Failed to update role', 'error');
    }
  };

  const transfer = async (memberUserId) => {
    if (!confirm('Transfer ownership? You will become an admin.')) return;
    try {
      const updated = await api.transferOwnership(groupId, memberUserId);
      setGroup(updated);
      await load();
      showToast('Ownership transferred');
    } catch (err) {
      showToast(err.message || 'Failed to transfer', 'error');
    }
  };

  const del = async () => {
    if (!confirm('Delete this group for everyone? This cannot be undone.')) return;
    try {
      await api.deleteGroup(groupId);
      onLeft();
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditAvatar(file);
    const reader = new FileReader();
    reader.onload = () => setEditAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#050816]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-pink-400 border-t-transparent" />
      </div>
    );
  }

  if (showAddMembers) {
    return (
      <AddMembersModal
        groupId={groupId}
        existingIds={members.map((m) => m.userId)}
        onClose={() => setShowAddMembers(false)}
        onAdded={() => load()}
      />
    );
  }

  return (
    <div className="z-[300] flex flex-col" style={{ position: 'fixed', inset: 0, background: '#050816' }}>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3">
        <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <ArrowLeft size={18} />
        </button>
        <h2 className="flex-1 text-base font-bold text-white">Group Info</h2>
        {canManage && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="flex h-9 w-9 items-center justify-center rounded-full text-pink-300 active:scale-95" style={{ background: 'rgba(225,48,108,0.12)' }}>
            <Pencil size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {/* Identity */}
        <div className="flex flex-col items-center gap-3 px-5 py-6">
          {editing ? (
            <button type="button" onClick={() => fileRef.current?.click()} className="relative active:scale-95">
              <GroupAvatar group={{ avatar: editAvatarPreview, name: editName }} members={members} size={88} />
              <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#050816] bg-gradient-to-br from-pink-500 to-gold-500 text-white">
                <Camera size={14} />
              </span>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
            </button>
          ) : (
            <GroupAvatar group={group} members={members} size={88} />
          )}

          {editing ? (
            <div className="w-full max-w-sm space-y-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-center text-base font-bold text-white outline-none focus:border-pink-400/50" />
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={280} rows={2} placeholder="Description" className="w-full resize-none rounded-xl border border-white/10 bg-white/6 px-4 py-2.5 text-center text-sm text-white outline-none focus:border-pink-400/50" />
              <div className="flex justify-center gap-2">
                <button type="button" onClick={saveEdit} disabled={saving} className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-1.5 px-5 py-2 text-sm font-bold">
                  <Check size={15} /> Save
                </button>
                <button type="button" onClick={() => { setEditing(false); setEditAvatar(null); setEditAvatarPreview(null); }} className="ik-btn ik-btn-secondary ik-btn-pill flex items-center gap-1.5 px-5 py-2 text-sm font-bold">
                  <X size={15} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-white">{group?.name}</h3>
              {group?.description && <p className="text-center text-sm text-white/50">{group.description}</p>}
            </>
          )}
        </div>

        {/* Members */}
        <div className="px-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Members · {members.length}</p>
            {canManage && (
              <button type="button" onClick={() => setShowAddMembers(true)} className="flex items-center gap-1 text-xs font-semibold text-pink-300">
                <UserPlus size={13} /> Add
              </button>
            )}
          </div>
          <div className="space-y-1 rounded-2xl border border-white/8 bg-white/4 p-1">
            {members.map((m) => {
              const isMe = m.userId === user?.id;
              const targetRole = m.role;
              const canActOn = isOwner && !isMe && targetRole !== 'owner';
              return (
                <div key={m.userId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/4">
                  <div className="avatar flex-shrink-0" style={{ width: 40, height: 40, fontSize: 14 }}>
                    {m.user?.avatar ? <img src={resolveMediaUrl(m.user.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : (m.user?.username?.charAt(0).toUpperCase())}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {m.user?.displayName || m.user?.username}
                      {isMe && <span className="ml-1 text-white/40">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-white/40">@{m.user?.username}</p>
                  </div>
                  {m.role === 'owner' && <Crown size={15} className="text-gold-400" />}
                  {m.role === 'admin' && m.role !== 'owner' && <Shield size={15} className="text-pink-300" />}
                  {canActOn && (
                    <div className="flex items-center gap-1">
                      {m.role === 'admin'
                        ? <button type="button" onClick={() => setRole(m.userId, 'member')} className="rounded-full px-2 py-1 text-[10px] font-bold text-white/60 hover:bg-white/10">Demote</button>
                        : <button type="button" onClick={() => setRole(m.userId, 'admin')} className="rounded-full px-2 py-1 text-[10px] font-bold text-pink-300 hover:bg-pink-500/10">Make admin</button>
                      }
                      {isOwner && m.role !== 'owner' && (
                        <button type="button" onClick={() => transfer(m.userId)} title="Transfer ownership" className="rounded-full px-2 py-1 text-[10px] font-bold text-gold-300 hover:bg-gold-500/10">Transfer</button>
                      )}
                      <button type="button" onClick={() => removeMember(m.userId)} className="flex h-7 w-7 items-center justify-center rounded-full text-red-300 hover:bg-red-500/10">
                        <UserMinus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Meeting — contextual shortcut into CREATE → Meeting for this group */}
        <div className="mt-4 px-4">
          <button type="button" onClick={() => openCreate('meeting', { groupId })} className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left active:scale-[0.99]">
            <CalendarClock size={18} className="text-gold-300" />
            <div>
              <p className="text-sm font-semibold text-white">Start or schedule a meeting</p>
              <p className="text-xs text-white/40">Members are notified in this chat</p>
            </div>
          </button>
        </div>

        {/* Notifications */}
        <div className="mt-4 px-4">
          <button type="button" onClick={toggleMute} className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left active:scale-[0.99]">
            <div className="flex items-center gap-3">
              {muted ? <BellOff size={18} className="text-white/50" /> : <Bell size={18} className="text-pink-300" />}
              <div>
                <p className="text-sm font-semibold text-white">Notifications</p>
                <p className="text-xs text-white/40">{muted ? 'Muted' : 'On'}</p>
              </div>
            </div>
            <span className={`relative h-6 w-11 rounded-full transition-colors ${muted ? 'bg-white/15' : 'bg-pink-500'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${muted ? 'translate-x-0.5' : 'translate-x-5'}`} />
            </span>
          </button>
        </div>

        {/* Leave */}
        <div className="mt-4 px-4">
          <button type="button" onClick={leave} className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left active:scale-[0.99]">
            <LogOut size={18} className="text-white/60" />
            <p className="text-sm font-semibold text-white/80">Leave group</p>
          </button>
        </div>

        {/* Danger zone */}
        {isOwner && (
          <div className="mt-4 px-4 pb-8">
            <button type="button" onClick={del} className="flex w-full items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left active:scale-[0.99]">
              <Trash2 size={18} className="text-red-400" />
              <p className="text-sm font-semibold text-red-300">Delete group</p>
            </button>
            <p className="mt-2 px-1 text-xs text-white/30">Deleting removes the group and all messages for every member.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupInfo;
