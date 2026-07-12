import React, { useState, useRef } from 'react';
import { X, Check, Camera, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ImageEditor from './ImageEditor';
import { getApiBase } from '../config/appConfig';

function ProfileEditSheet({ profile, onClose, onSaved }) {
  const { token, showToast, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar || null);
  const [coverPreview, setCoverPreview] = useState(profile.coverImage || null);
  const [avatarBlob, setAvatarBlob] = useState(null);
  const [coverBlob, setCoverBlob] = useState(null);
  const [editorSrc, setEditorSrc] = useState(null); // { src, aspect, target: 'avatar'|'cover' }
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const pickFile = (target) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditorSrc({ src: reader.result, aspect: target === 'avatar' ? 1 : 2.6, target });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEditorSave = (blob) => {
    const url = URL.createObjectURL(blob);
    if (editorSrc.target === 'avatar') {
      setAvatarBlob(blob);
      setAvatarPreview(url);
    } else {
      setCoverBlob(blob);
      setCoverPreview(url);
    }
    setEditorSrc(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('displayName', displayName);
      formData.append('bio', bio);
      if (avatarBlob) formData.append('avatar', avatarBlob, 'avatar.jpg');
      if (coverBlob) formData.append('cover', coverBlob, 'cover.jpg');

      const res = await fetch(`${getApiBase()}/users/me`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to save profile', 'error');
        return;
      }
      const updated = await res.json();
      showToast('Profile updated!', 'success');
      await refreshUser?.();
      onSaved?.(updated);
      onClose();
    } catch (err) {
      showToast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (editorSrc) {
    return (
      <ImageEditor
        src={editorSrc.src}
        aspect={editorSrc.aspect}
        title={editorSrc.target === 'avatar' ? 'Edit profile photo' : 'Edit cover photo'}
        onCancel={() => setEditorSrc(null)}
        onSave={handleEditorSave}
      />
    );
  }

  return (
    // Solid background (not translucent) — this is a full-screen dialog sitting
    // above the app's bottom nav (z-90/95); any transparency here lets the nav's
    // glow bleed through visibly at the bottom edge.
    <div className="fixed inset-0 z-[300] flex flex-col bg-void-950" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/80 px-4 py-3">
        <button type="button" onClick={onClose} className="ik-btn ik-btn-ghost flex h-9 w-9 items-center justify-center !p-0">
          <X size={18} />
        </button>
        <span className="text-sm font-bold text-white">Edit Profile</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="ik-btn ik-btn-primary ik-btn-sm ik-btn-pill flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check size={14} />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="ultima-scroll flex-1 overflow-y-auto px-5 py-6">
        {/* Cover */}
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="relative mb-14 flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-void-950 via-[#1a0d16] to-void-950"
        >
          {coverPreview ? (
            <img src={coverPreview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="flex items-center gap-2 text-xs font-semibold text-white/45">
              <ImageIcon size={16} />
              Add cover photo
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:opacity-100">
            <Camera size={20} className="text-white" />
          </div>

          {/* Avatar, overlapping the cover */}
          <div
            onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click(); }}
            className="absolute -bottom-10 left-4 flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-4 border-void-950 bg-gradient-to-br from-pink-500 to-gold-500 text-3xl font-bold text-white shadow-xl"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              profile.username?.charAt(0).toUpperCase()
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Camera size={18} className="text-white" />
            </div>
          </div>
        </button>

        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={pickFile('avatar')} />
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={pickFile('cover')} />

        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Display name
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
          className="ultima-input mb-5 w-full rounded-2xl px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30"
          placeholder="Your name"
        />

        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 200))}
          rows={4}
          className="ultima-input w-full resize-none rounded-2xl px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30"
          placeholder="Tell your story…"
        />
        <p className="mt-1.5 text-right text-[11px] text-white/30">{bio.length}/200</p>
      </div>
    </div>
  );
}

export default ProfileEditSheet;
