import React, { useState, useRef } from 'react';
import { X, ArrowLeft, ArrowRight, Camera, Check, Users } from 'lucide-react';
import { useGroupsApi } from '../../hooks/useGroupsApi';
import { resolveMediaUrl } from '../../config/appConfig';
import GroupAvatar from './GroupAvatar';
import MemberPicker from './MemberPicker';

/**
 * CreateGroupWizard — full-screen 3-step flow (CREATE → Group).
 * Step 1: select members (MemberPicker)
 * Step 2: group details (photo, name, description, privacy)
 * Step 3: review & create
 *
 * Validation mirrors the backend: name 3–100 chars, no profanity, no
 * duplicate name per owner (server rejects with 409). Members are optional —
 * a group can be created empty and filled from Group Info later.
 */
function CreateGroupWizard({ onCreated, onClose }) {
  const api = useGroupsApi();
  const [step, setStep] = useState(1);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isPrivate, setIsPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const toggleMember = (u) => {
    setMembers((prev) => {
      const exists = prev.find((m) => m.id === u.id);
      return exists ? prev.filter((m) => m.id !== u.id) : [...prev, u];
    });
  };

  const onPickAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const nameValid = name.trim().length >= 3 && name.trim().length <= 100;

  const create = async () => {
    if (!nameValid) { setError('Group name must be 3–100 characters'); return; }
    setCreating(true);
    setError('');
    try {
      const group = await api.createGroup({
        name: name.trim(),
        description: description.trim(),
        avatarFile,
        isPrivate,
        memberIds: members.map((m) => m.id),
      });
      onCreated(group);
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const previewGroup = { avatar: avatarPreview, name };
  const previewMembers = members.map((m) => ({ user: m }));

  return (
    <div
      className="z-[400] flex flex-col"
      style={{ position: 'fixed', inset: 0, background: '#050816', flexDirection: 'column' }}
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="flex-1 text-base font-bold text-white">
          {step === 1 ? 'New Group · Members' : step === 2 ? 'Group Details' : 'Review & Create'}
        </h2>
        <span className="text-xs font-semibold text-white/40">{step}/3</span>
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <X size={18} />
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
        {step === 1 && (
          <MemberPicker selected={members} onToggle={toggleMember} />
        )}

        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Avatar */}
            <div className="mb-6 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative active:scale-95"
                aria-label="Choose group photo"
              >
                <GroupAvatar group={previewGroup} members={previewMembers} size={96} />
                <span
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#050816] bg-gradient-to-br from-pink-500 to-gold-500 text-white"
                >
                  <Camera size={15} />
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} className="hidden" />
              <p className="text-xs text-white/40">Tap to add a group photo</p>
            </div>

            {/* Name */}
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/40">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Inner Circle"
              className="mb-4 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-pink-400/50"
            />

            {/* Description */}
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/40">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="What's this group about?"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-pink-400/50"
            />

            {/* Privacy */}
            <button
              type="button"
              onClick={() => setIsPrivate((v) => !v)}
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-left active:scale-[0.99]"
            >
              <div>
                <p className="text-sm font-semibold text-white">Private group</p>
                <p className="text-xs text-white/40">Only invited members can join</p>
              </div>
              <span className={`relative h-6 w-11 rounded-full transition-colors ${isPrivate ? 'bg-pink-500' : 'bg-white/15'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <div className="flex flex-col items-center gap-3">
              <GroupAvatar group={previewGroup} members={previewMembers} size={88} />
              <h3 className="text-lg font-bold text-white">{name.trim() || 'Untitled group'}</h3>
              {description.trim() && <p className="text-center text-sm text-white/50">{description.trim()}</p>}
            </div>

            <div className="mt-6 rounded-2xl border border-white/8 bg-white/4 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                <Users size={13} /> {members.length} member{members.length === 1 ? '' : 's'}
              </p>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => (
                  <span key={m.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3">
                    <span className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                      {m.avatar ? <img src={resolveMediaUrl(m.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : m.username?.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-white/80">{m.displayName || m.username}</span>
                  </span>
                ))}
              </div>
            </div>

            {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>

      {/* Footer action */}
      <div
        className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-white/8 px-4 py-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        {step < 3 ? (
          <button
            type="button"
            disabled={step === 2 && !nameValid}
            onClick={() => setStep(step + 1)}
            className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-2 px-5 py-2.5 text-sm font-bold disabled:opacity-40"
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={creating}
            onClick={create}
            className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-2 px-6 py-2.5 text-sm font-bold"
          >
            {creating ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Check size={16} />}
            Create Group
          </button>
        )}
      </div>
    </div>
  );
}

export default CreateGroupWizard;
