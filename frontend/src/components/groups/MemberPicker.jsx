import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, UserCircle2, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../config/appConfig';

/**
 * MemberPicker — multi-select user search (Create Group step 1, Add Members).
 * Selected users are pinned to a horizontal strip on top. `excludeIds` hides
 * people who are already in the group.
 */
function MemberPicker({ selected = [], onToggle, excludeIds = [] }) {
  const { fetchWithAuth } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const selectedIds = new Set(selected.map((u) => u.id));
  const excluded = new Set(excludeIds);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setError(''); setSearching(false); return; }
    setSearching(true);
    try {
      const res = await fetchWithAuth(`/users/search?q=${encodeURIComponent(q)}&limit=30`);
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
    // Show the spinner during the debounce window too, so "No users found"
    // never flashes before the request has even been sent.
    if (query.trim()) setSearching(true);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  return (
    <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
      {/* Selected strip */}
      {selected.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-white/8" style={{ scrollbarWidth: 'none' }}>
          {selected.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle(u)}
              className="ik-tap-spring flex flex-shrink-0 items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 py-1 pl-1 pr-3 active:scale-95"
            >
              <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                {u.avatar ? <img src={resolveMediaUrl(u.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : (u.username?.charAt(0).toUpperCase())}
              </span>
              <span className="text-xs font-semibold text-white/85">{u.displayName || u.username}</span>
              <X size={12} className="text-white/50" />
            </button>
          ))}
        </div>
      )}

      {/* Search box */}
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2.5 border border-white/10 focus-within:border-pink-400/50 transition-colors">
          <Search size={15} className="flex-shrink-0 text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people to add…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
          {searching && <div className="h-4 w-4 animate-spin rounded-full border-2 border-pink-400 border-t-transparent flex-shrink-0" />}
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-white/30 hover:text-white/60"><X size={14} /></button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !query.trim() && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/40">
            <Search size={36} />
            <p className="text-sm">Search for people to add to the group</p>
          </div>
        )}
        {error && (
          <p className="px-4 py-3 text-center text-xs text-red-400">{error}</p>
        )}
        {results.length === 0 && query.trim() && !searching && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/40">
            <UserCircle2 size={40} />
            <p className="text-sm">No users found</p>
          </div>
        )}
        {results.filter((u) => !excluded.has(u.id)).map((u) => {
          const isSelected = selectedIds.has(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle(u)}
              className={`flex w-full items-center gap-3 px-4 py-3 transition-colors border-b border-white/4 text-left ${
                isSelected ? 'bg-pink-500/10' : 'hover:bg-white/5 active:bg-white/8'
              }`}
            >
              <div className="avatar flex-shrink-0" style={{ width: 44, height: 44, fontSize: 16 }}>
                {u.avatar ? <img src={resolveMediaUrl(u.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : u.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white truncate">{u.displayName || u.username}</p>
                <p className="text-xs text-white/40 truncate">@{u.username}</p>
              </div>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                  isSelected ? 'border-pink-400 bg-pink-500 text-white' : 'border-white/20 text-transparent'
                }`}
              >
                <Check size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MemberPicker;
