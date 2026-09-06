import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, UserCircle2, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../config/appConfig';

/**
 * NewConversationModal — CREATE → Message.
 * Search people, pick one, hand off to the existing DM thread.
 */
function NewConversationModal({ onSelect, onClose }) {
  const { fetchWithAuth } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setError(''); setSearching(false); return; }
    setSearching(true);
    try {
      const res = await fetchWithAuth(`/users/search?q=${encodeURIComponent(q)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setError('');
      } else {
        setError('Search failed. Try again.');
      }
    } catch {
      setError('Search failed. Check your connection.');
    } finally { setSearching(false); }
  }, [fetchWithAuth]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim()) setSearching(true); // no "No users found" flash during debounce
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-[#050816]/95 backdrop-blur-xl" style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-transform active:scale-95" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
          <X size={18} />
        </button>
        <h2 className="text-base font-bold text-white">New Message</h2>
      </div>
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2.5 border border-white/10 focus-within:border-pink-400/50 transition-colors">
          <Search size={15} className="flex-shrink-0 text-white/40" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people…" className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none" />
          {searching && <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-400 border-t-transparent flex-shrink-0" />}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {error && <p className="px-4 py-3 text-center text-xs text-red-400">{error}</p>}
        {results.length === 0 && query.trim() && !searching && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/40"><UserCircle2 size={40} /><p className="text-sm">No users found</p></div>
        )}
        {results.length === 0 && !query.trim() && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/40"><Search size={36} /><p className="text-sm">Search for a person to message</p></div>
        )}
        {results.map(u => (
          <button key={u.id} type="button" onClick={() => { onSelect(u); onClose(); }} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/8 transition-colors border-b border-white/4 text-left">
            <div className="avatar flex-shrink-0" style={{ width: 44, height: 44, fontSize: 16 }}>
              {u.avatar ? <img src={resolveMediaUrl(u.avatar)} alt="" className="w-full h-full object-cover rounded-full" /> : u.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">{u.displayName || u.username}</p>
              <p className="text-xs text-white/40 truncate">@{u.username}</p>
            </div>
            <Send size={16} className="text-pink-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default NewConversationModal;
