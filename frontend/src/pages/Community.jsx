import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, Plus, Crown, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveMediaUrl } from '../config/appConfig';

function ChallengeCard({ challenge }) {
  return (
    <div className="ultima-glass-supreme flex flex-col gap-3 rounded-[22px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-pink-400/25 bg-pink-500/10 px-2.5 py-1 text-[11px] font-bold text-pink-300">
            <Hash size={11} />
            {challenge.hashtag}
          </span>
          <h3 className="truncate font-display text-base font-bold text-white">{challenge.title}</h3>
        </div>
      </div>
      {challenge.description && (
        <p className="line-clamp-2 text-sm leading-relaxed text-white/60">{challenge.description}</p>
      )}
      <div className="flex items-center gap-2 border-t border-white/8 pt-3">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white"
          style={{ background: challenge.creator?.avatar ? undefined : 'linear-gradient(135deg,#E1306C,#F5C542)' }}
        >
          {challenge.creator?.avatar ? (
            <img src={resolveMediaUrl(challenge.creator.avatar)} alt="" className="h-full w-full object-cover" />
          ) : (
            (challenge.creator?.username || '?').charAt(0).toUpperCase()
          )}
        </div>
        <p className="truncate text-xs text-white/45">
          Started by <span className="text-white/70">@{challenge.creator?.username || 'unknown'}</span>
        </p>
      </div>
    </div>
  );
}

function Community() {
  const navigate = useNavigate();
  const { fetchWithAuth, isAuthenticated, isGuest, showToast } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [cTitle, setCTitle] = useState('');
  const [cHashtag, setCHashtag] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated || isGuest) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetchWithAuth('/challenges');
      setChallenges(res.ok ? await res.json() : []);
      if (!res.ok) setLoadError(true);
    } catch (err) {
      console.error('Failed to load community data:', err);
      // Previously silent — a failed fetch left the list empty and fell
      // through to "No active challenges yet", wrongly implying the
      // community section is just quiet instead of unreachable.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isGuest, fetchWithAuth]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      if (!cTitle.trim() || !cHashtag.trim()) {
        showToast('Title and hashtag are required', 'error');
        return;
      }
      const res = await fetchWithAuth('/challenges', {
        method: 'POST',
        body: JSON.stringify({
          title: cTitle.trim(),
          description: cDesc.trim(),
          hashtag: cHashtag.trim().replace(/^#/, ''),
        }),
      });
      if (!res.ok) throw new Error('failed');
      showToast('Challenge launched!', 'success');
      setShowCreate(false);
      setCTitle(''); setCHashtag(''); setCDesc('');
      load();
    } catch {
      showToast('Failed to create — try again', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="ultima-page ultima-scroll relative flex min-h-0 flex-1 flex-col">
      <header className="px-5 pb-3 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="ultima-glass mb-4 flex h-11 w-11 items-center justify-center rounded-full text-white/75"
        >
          <ArrowLeft size={20} />
        </button>
        <p className="ultima-eyebrow">Community</p>
        <h1 className="ultima-text-supreme mt-1 font-display text-3xl font-black tracking-tight">
          Challenges
        </h1>
        <p className="mt-1 text-sm text-white/45">Start a trend, inspire creators.</p>
      </header>

      <div className="flex flex-col gap-3 px-5 pb-28">
        {isGuest ? (
          <div className="py-16 text-center">
            <Crown size={32} className="mx-auto mb-3 text-gold-400/60" />
            <p className="mb-4 text-sm text-white/45">Sign in to see and join the community</p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="ik-btn ik-btn-primary ik-btn-pill px-6 py-2.5 text-sm font-bold"
            >
              Sign in
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-shimmer-slide rounded-[22px] bg-gradient-to-r from-white/[0.03] via-white/[0.07] to-white/[0.03] bg-[length:200%_100%]" />
            ))}
          </div>
        ) : loadError ? (
          <div className="py-16 text-center">
            <p className="mb-3 text-sm text-white/45">Couldn't load community content. Check your connection.</p>
            <button
              type="button"
              onClick={load}
              className="ik-btn ik-btn-secondary ik-btn-sm ik-btn-pill px-5"
            >
              Retry
            </button>
          </div>
        ) : challenges.length === 0 ? (
          <div className="py-16 text-center">
            <Hash size={32} className="mx-auto mb-3 text-pink-400/50" />
            <p className="text-sm text-white/45">No active challenges yet — be the first to start one</p>
          </div>
        ) : (
          challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)
        )}
      </div>

      {isAuthenticated && !isGuest && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="ik-fab fixed z-[95] flex items-center justify-center"
          style={{ right: '16px', bottom: 'calc(var(--ultima-nav-offset, 6.5rem) + 12px)' }}
          aria-label="New challenge"
        >
          <Plus size={24} />
        </button>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/55" onClick={() => setShowCreate(false)}>
          <div
            className="ultima-glass-supreme w-full max-w-md rounded-t-[28px] p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-gold-200">
                Launch a Challenge
              </p>
              <button type="button" onClick={() => setShowCreate(false)} className="ik-btn ik-btn-ghost flex h-8 w-8 items-center justify-center !p-0">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <input
                value={cTitle}
                onChange={(e) => setCTitle(e.target.value.slice(0, 80))}
                placeholder="Challenge title"
                className="ultima-input rounded-2xl px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30"
              />
              <input
                value={cHashtag}
                onChange={(e) => setCHashtag(e.target.value.replace(/\s/g, '').slice(0, 40))}
                placeholder="hashtag (no spaces)"
                className="ultima-input rounded-2xl px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30"
              />
              <textarea
                value={cDesc}
                onChange={(e) => setCDesc(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="What's the challenge?"
                className="ultima-input resize-none rounded-2xl px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/30"
              />
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="ik-btn ik-btn-primary mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold disabled:opacity-60"
            >
              <Check size={16} />
              {creating ? 'Creating…' : 'Launch challenge'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Community;
