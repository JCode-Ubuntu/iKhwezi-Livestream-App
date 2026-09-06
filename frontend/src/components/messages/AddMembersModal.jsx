import React, { useState, useCallback } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGroupsApi } from '../../hooks/useGroupsApi';
import MemberPicker from '../groups/MemberPicker';

/**
 * AddMembersModal — admin/owner adds people to a group directly.
 *
 * One request (POST /groups/:id/members with userIds[]); the server validates
 * each id (real, non-guest, non-banned) and reports who was added vs skipped.
 * People already in the group are hidden from the picker via `existingIds`.
 */
function AddMembersModal({ groupId, existingIds = [], onClose, onAdded }) {
  const { showToast } = useAuth();
  const api = useGroupsApi();
  const [selected, setSelected] = useState([]);
  const [adding, setAdding] = useState(false);

  const toggle = useCallback((u) => {
    setSelected((prev) => {
      const exists = prev.find((m) => m.id === u.id);
      return exists ? prev.filter((m) => m.id !== u.id) : [...prev, u];
    });
  }, []);

  const addAll = async () => {
    if (!selected.length || adding) return;
    setAdding(true);
    try {
      const { added = [], skipped = [] } = await api.addMembers(groupId, selected.map((u) => u.id));
      if (added.length) showToast(`Added ${added.length} member${added.length === 1 ? '' : 's'}`);
      if (skipped.length) showToast(`${skipped.length} couldn't be added (already a member or unavailable)`, 'error');
      onAdded?.(added);
      onClose();
    } catch (err) {
      showToast(err.message || "Couldn't add members. Try again.", 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="z-[300] flex flex-col" style={{ position: 'fixed', inset: 0, background: '#050816' }} role="dialog" aria-modal aria-label="Add members">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 active:scale-95" style={{ background: 'rgba(255,255,255,0.06)' }} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h2 className="flex-1 text-base font-bold text-white">Add Members</h2>
        <button
          type="button"
          onClick={addAll}
          disabled={!selected.length || adding}
          className="ik-btn ik-btn-primary ik-btn-pill flex items-center gap-1.5 px-4 py-2 text-sm font-bold disabled:opacity-40"
        >
          {adding ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <UserPlus size={14} />}
          Add{selected.length ? ` ${selected.length}` : ''}
        </button>
      </div>
      <MemberPicker selected={selected} onToggle={toggle} excludeIds={existingIds} />
    </div>
  );
}

export default AddMembersModal;
