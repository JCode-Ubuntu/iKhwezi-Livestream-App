import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Star, Video, UserPlus, UserCheck, LogOut, Play, Trophy, Globe, Pencil, Settings,
  Coins, Gift, Crown, MessageCircle, Plus, Ban, Shield, Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import VideoEditModal from '../components/VideoEditModal';
import ProfileEditSheet from '../components/ProfileEditSheet';
import { resolveMediaUrl } from '../config/appConfig';

const GIFT_FALLBACK = { rose: { coins: 10, char: '🌹', label: 'Rose' }, gem: { coins: 50, char: '💎', label: 'Gem' }, crown: { coins: 200, char: '👑', label: 'Crown' }, star: { coins: 500, char: '🌟', label: 'Supernova' } };

function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, fetchWithAuth, logout, isAuthenticated, showToast } = useAuth();
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');

  const isOwnProfile = user?.id === id;
  const [editVideo, setEditVideo] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [giftCatalog, setGiftCatalog] = useState(null);
  const [showGiftSheet, setShowGiftSheet] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  const isAppAdmin = !!user?.isAdmin;
  // Profile is reused (not remounted) when navigating between users' profiles
  // via links/back-nav, so an in-flight fetch for the previous `id` can
  // resolve after a newer one starts. Without checking this ref at resolve
  // time, an out-of-order response would overwrite the correct profile with
  // stale data for the wrong user.
  const activeIdRef = useRef(id);

  const engagementScore = useMemo(() => {
    if (!profile) return 0;
    const viewSum = videos.reduce((s, v) => s + (v.views || 0), 0);
    return (
      viewSum +
      (profile.totalPoints || 0) * 10 +
      (profile.followerCount || 0) * 2 +
      (profile.videoCount || 0) * 5
    );
  }, [profile, videos]);

  const globalRank = useMemo(() => {
    const seed = engagementScore % 1009;
    return Math.max(1, Math.min(99, 100 - (seed % 99)));
  }, [engagementScore]);

  useEffect(() => {
    activeIdRef.current = id;
    setLoading(true);
    setProfile(null);
    setVideos([]);
    loadProfile(id);
    loadVideos(id);
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchWithAuth('/wallet/me').then((r) => r.json()).then((data) => {
      setWallet(data.coins ?? 0);
      setGiftCatalog(data.giftCatalog || null);
    }).catch(() => {});
  }, [isAuthenticated, fetchWithAuth]);

  const loadProfile = async (requestedId) => {
    try {
      const res = await fetchWithAuth(`/users/${requestedId}`);
      if (activeIdRef.current !== requestedId) return;
      if (res.ok) {
        const data = await res.json();
        if (activeIdRef.current !== requestedId) return;
        setProfile(data);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      if (activeIdRef.current === requestedId) navigate('/');
    } finally {
      if (activeIdRef.current === requestedId) setLoading(false);
    }
  };

  const loadVideos = async (requestedId) => {
    try {
      const res = await fetchWithAuth(`/users/${requestedId}/videos`);
      const data = await res.json();
      if (activeIdRef.current !== requestedId) return;
      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetchWithAuth(`/users/${id}/follow`, { method: 'POST' });
      const data = await res.json();
      setProfile(prev => ({
        ...prev,
        isFollowing: data.following,
        followerCount: data.followerCount,
      }));
      showToast(data.following ? 'Following!' : 'Unfollowed', 'success');
    } catch (err) {
      showToast('Failed to follow', 'error');
    }
  };

  const handleBlockUser = async () => {
    if (!isAppAdmin || isOwnProfile) return;
    const blocking = !profile?.isBanned;
    const msg = blocking
      ? `Block @${profile.username}? They will not be able to log in or use the app.`
      : `Unblock @${profile.username} and restore their access?`;
    if (!confirm(msg)) return;

    setBlockBusy(true);
    try {
      const res = await fetchWithAuth(`/admin/users/${id}/ban`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to update block status', 'error');
        return;
      }
      setProfile((prev) => ({ ...prev, isBanned: data.isBanned }));
      showToast(data.isBanned ? 'User blocked' : 'User unblocked', 'success');
    } catch {
      showToast('Failed to update block status', 'error');
    } finally {
      setBlockBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSendGift = async (giftId, gift) => {
    if (wallet !== null && wallet < gift.coins) {
      showToast(`Not enough coins — need ${gift.coins}, you have ${wallet}`, 'error');
      return;
    }
    try {
      const res = await fetchWithAuth('/wallet/gift', {
        method: 'POST',
        body: JSON.stringify({ toUserId: id, giftId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to send gift', 'error');
        return;
      }
      setWallet(data.coinsRemaining);
      setProfile((prev) => ({ ...prev, totalPoints: (prev.totalPoints || 0) + gift.coins }));
      showToast(`${gift.char} Sent ${gift.label}!`, 'success');
      setShowGiftSheet(false);
    } catch {
      showToast('Failed to send gift', 'error');
    }
  };

  const handleSubscribe = async () => {
    const cost = 500;
    if (wallet !== null && wallet < cost) {
      showToast(`Not enough coins — subscribing costs ${cost}/month`, 'error');
      return;
    }
    setSubBusy(true);
    try {
      const res = await fetchWithAuth(`/users/${id}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({ months: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to subscribe', 'error');
        return;
      }
      setWallet(data.coinsRemaining);
      setProfile((prev) => ({ ...prev, isSubscribed: true, subscriberCount: (prev.subscriberCount || 0) + 1 }));
      showToast('Subscribed! Badge unlocked.', 'success');
    } catch {
      showToast('Failed to subscribe', 'error');
    } finally {
      setSubBusy(false);
    }
  };

  const handleTopUp = async (coins) => {
    try {
      const res = await fetchWithAuth('/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ coins }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Top-up failed', 'error');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setWallet(data.coins);
      showToast(`+${coins} coins added (dev mode — no payment processor configured)`, 'success');
      setShowTopUp(false);
    } catch {
      showToast('Top-up failed', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 pb-[70px]">
        <div className="h-40 w-full max-w-xs rounded-3xl border border-white/10 bg-slate-900/50 p-4 shadow-glass backdrop-blur-xl">
          <div className="mb-4 h-24 w-24 animate-shimmer-slide rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
          <div className="h-4 w-3/4 animate-shimmer-slide rounded-md bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="ultima-page ultima-scroll relative flex min-h-0 flex-1 flex-col">
      <div
        className="relative h-40 bg-gradient-to-br from-void-950 via-[#1a0d16] to-void-950 bg-cover bg-center shadow-[inset_0_-1px_0_rgba(225,48,108,0.25)]"
        style={profile.coverImage ? { backgroundImage: `url(${profile.coverImage})` } : undefined}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-void-950/70 via-transparent to-black/20" />
        <button
          onClick={() => navigate(-1)}
          className="ultima-glass absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white/75"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          {isOwnProfile && (
            <>
              <button
                onClick={() => setShowTopUp(true)}
                className="ultima-glass-gold flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-gold-200"
              >
                <Coins size={14} />
                {wallet ?? '–'}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                title="Log out"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/15 text-red-400"
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* -mt-[30px] (was -50px): less upward pull keeps the full avatar circle
          visible — the old 50px overlap clipped the top half behind the cover. */}
      <div className="relative z-10 -mt-[30px] px-5">
        <div className="mb-4 flex items-end gap-4">
          <button
            type="button"
            onClick={() => isOwnProfile && setShowEditProfile(true)}
            className="relative h-[88px] w-[88px] shrink-0"
          >
            <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-pink-500 via-gold-400 to-plasma-500 opacity-90 blur-md" />
            <div className="relative flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full border-4 border-void-950 bg-gradient-to-br from-pink-500 to-gold-500 text-3xl font-bold text-white shadow-[0_0_32px_rgba(225,48,108,0.45)]">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                profile.username?.charAt(0).toUpperCase()
              )}
            </div>
            {isOwnProfile && (
              <div className="absolute bottom-0 right-0 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 border-void-950 bg-gold-400 text-void-950 shadow-sm">
                <Pencil size={11} />
              </div>
            )}
          </button>

          <div className="flex-1 pb-2">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-xl font-bold text-white">
                {profile.displayName || profile.username}
              </h1>
              {profile.isAdmin && <Crown size={15} className="fill-gold-400 text-gold-400" />}
              {profile.isSubscribed && (
                <span className="rounded-full border border-gold-400/30 bg-gold-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-300">
                  Subscribed
                </span>
              )}
              {profile.isBanned && isAppAdmin && (
                <span className="rounded-full border border-red-400/35 bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-300">
                  Blocked
                </span>
              )}
            </div>
            <p className="text-sm text-white/45">@{profile.username}</p>
          </div>

          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setShowEditProfile(true)}
              className="ik-btn ik-btn-secondary ik-btn-sm ik-btn-pill mb-2 flex items-center gap-1.5"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        {profile.bio && <p className="mb-4 text-sm leading-relaxed text-white/85">{profile.bio}</p>}

        <div className="mb-5 flex gap-6">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{profile.videoCount || 0}</p>
            <p className="text-xs text-white/45">Videos</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{profile.followerCount || 0}</p>
            <p className="text-xs text-white/45">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{profile.followingCount || 0}</p>
            <p className="text-xs text-white/45">Following</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-gold-400">{profile.totalPoints || 0}</p>
            <p className="text-xs text-white/45">Points</p>
          </div>
          {(profile.subscriberCount || 0) > 0 && (
            <div className="text-center">
              <p className="text-xl font-bold text-gold-400">{profile.subscriberCount}</p>
              <p className="text-xs text-white/45">Subs</p>
            </div>
          )}
        </div>

        <GlassCard className="mb-5 px-4 py-4" neon="high">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                Engagement leaderboard
              </p>
              <p className="mt-1 text-3xl font-black tracking-tighter text-glow-neon">
                {engagementScore.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-white/45">Reactions + reach + stars (composite)</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-pink-600/90 to-plasma-500/90 shadow-neon-ring">
                <Globe className="h-8 w-8 text-white" strokeWidth={1.75} />
                <span className="absolute -bottom-1 rounded-full border border-white/10 bg-black/80 px-2 py-0.5 text-[11px] font-black text-neon-cyan">
                  #{globalRank}
                </span>
              </div>
              <span className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/50">
                <Trophy className="h-3 w-3 text-gold-400" />
                Global rank
              </span>
            </div>
          </div>
        </GlassCard>

        {!isOwnProfile && (
          <div className="mb-5 flex gap-2">
            <button
              onClick={handleFollow}
              className={`ik-btn flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold ${
                profile.isFollowing ? 'ik-btn-secondary' : 'ik-btn-primary'
              }`}
            >
              {profile.isFollowing ? <UserCheck size={18} /> : <UserPlus size={18} />}
              {profile.isFollowing ? 'Following' : 'Follow'}
            </button>
            <button
              onClick={() => navigate('/messages', { state: { openUser: profile } })}
              aria-label="Message"
              className="ik-btn ik-btn-secondary flex h-[52px] w-[52px] items-center justify-center !p-0 rounded-2xl"
            >
              <MessageCircle size={18} />
            </button>
            <button
              onClick={() => setShowGiftSheet(true)}
              aria-label="Send gift"
              className="ik-btn flex h-[52px] w-[52px] items-center justify-center !p-0 rounded-2xl border border-gold-400/30 bg-gold-500/12 text-gold-200"
            >
              <Gift size={18} />
            </button>
            {isAppAdmin && (
              <button
                type="button"
                onClick={handleBlockUser}
                disabled={blockBusy}
                title={profile.isBanned ? 'Unblock user' : 'Block user'}
                className={`ik-btn flex h-[52px] min-w-[52px] items-center justify-center gap-1.5 !px-3 rounded-2xl text-sm font-bold ${
                  profile.isBanned
                    ? 'border border-emerald-400/30 bg-emerald-500/12 text-emerald-200'
                    : 'border border-red-400/35 bg-red-500/12 text-red-300'
                }`}
              >
                {profile.isBanned ? <UserCheck size={18} /> : <Ban size={18} />}
              </button>
            )}
          </div>
        )}

        {isAppAdmin && !isOwnProfile && (
          <p className="mb-4 flex items-center gap-1.5 text-[11px] text-white/40">
            <Shield size={12} className="text-gold-400/80" />
            Owner controls — block removes login and app access for this account.
          </p>
        )}

        {!isOwnProfile && (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={subBusy || profile.isSubscribed}
            className={`ik-btn ik-btn-block mb-5 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold ${
              profile.isSubscribed ? 'ik-btn-secondary' : ''
            }`}
            style={!profile.isSubscribed ? { background: 'linear-gradient(135deg,#F5C542,#B8860B)', color: '#0A0A0A' } : undefined}
          >
            <Crown size={16} />
            {profile.isSubscribed ? 'Subscribed' : 'Subscribe · 500 coins/mo'}
          </button>
        )}

        <div className="mb-4 flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('videos')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'videos' ? 'border-pink-500 text-pink-300' : 'border-transparent text-white/45'
            }`}
          >
            <Video size={18} />
            Videos
          </button>
          <button
            onClick={() => setActiveTab('stars')}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
              activeTab === 'stars' ? 'border-gold-400 text-gold-300' : 'border-transparent text-white/45'
            }`}
          >
            <Star size={18} />
            Stars
          </button>
        </div>

        {activeTab === 'videos' && (
          <div className="grid grid-cols-3 gap-1">
            {videos.length === 0 ? (
              <div className="col-span-full py-10 text-center text-sm text-white/40">No videos yet</div>
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  className="relative aspect-[9/16] cursor-pointer overflow-hidden rounded-lg bg-white/5"
                >
                  <video
                    src={resolveMediaUrl(video.filename)}
                    className="h-full w-full object-cover"
                    muted
                    onClick={() => navigate('/')}
                  />
                  <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 to-transparent p-2">
                    <div className="flex items-center gap-1 text-xs text-white">
                      <Play size={12} fill="white" />
                      {video.views || 0}
                    </div>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditVideo(video); }}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-white/20 bg-pink-600/85"
                      >
                        <Pencil size={12} className="text-white" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'stars' && (
          <div className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gold-500/20 to-gold-500/5">
              <Star size={36} className="text-gold-400" fill="currentColor" />
            </div>
            <h3 className="mb-2 text-2xl font-bold text-gold-400">{profile.totalPoints || 0} Points</h3>
            <p className="text-sm text-white/45">Earned from fan stars</p>
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div className="px-5 pb-6">
          <div className="mt-1 border-t border-white/10 pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Settings size={14} className="text-white/40" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/35">Account</span>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/[0.08] py-3.5 text-[15px] font-semibold text-red-400 transition active:scale-[0.98]"
            >
              <LogOut size={18} />
              Log Out
            </button>
            <a
              href="https://ikhwezi.site/account-deletion.html"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 text-[15px] font-semibold text-white/55 transition active:scale-[0.98]"
            >
              <Trash2 size={18} />
              Delete Account &amp; Data
            </a>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="ultima-glass w-full max-w-[320px] rounded-3xl p-7 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <LogOut size={32} className="mx-auto mb-3 text-red-400" />
            <h3 className="mb-2 text-lg font-bold text-white">Log out?</h3>
            <p className="mb-6 text-sm text-white/50">You'll need to sign in again to post and interact.</p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="ultima-glass flex-1 rounded-xl py-2.5 text-sm font-semibold text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {editVideo && (
        <VideoEditModal
          video={editVideo}
          onClose={() => setEditVideo(null)}
          onUpdated={(updated) => {
            setVideos(prev => prev.map(v => v.id === updated.id ? { ...v, ...updated } : v));
            setEditVideo(null);
          }}
          onDeleted={(deletedId) => {
            setVideos(prev => prev.filter(v => v.id !== deletedId));
            setEditVideo(null);
          }}
        />
      )}

      {showEditProfile && (
        <ProfileEditSheet
          profile={profile}
          onClose={() => setShowEditProfile(false)}
          onSaved={(updated) => setProfile((prev) => ({ ...prev, ...updated }))}
        />
      )}

      {showGiftSheet && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={() => setShowGiftSheet(false)}>
          <div
            className="ultima-glass-supreme w-full max-w-md rounded-t-[28px] p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-sm font-bold uppercase tracking-widest text-gold-200">
                Gift @{profile.username}
              </p>
              <span className="ultima-glass-gold flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-gold-200">
                <Coins size={13} />
                {wallet ?? '–'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(giftCatalog || GIFT_FALLBACK).map(([giftId, gift]) => {
                const canAfford = wallet === null || wallet >= gift.coins;
                return (
                  <button
                    key={giftId}
                    type="button"
                    onClick={() => handleSendGift(giftId, gift)}
                    disabled={!canAfford}
                    className={`ik-btn ik-btn-bouncy ultima-glass flex flex-col items-center gap-1.5 rounded-[20px] py-4 text-white ${!canAfford ? 'opacity-40' : ''}`}
                  >
                    <span className="text-3xl">{gift.char}</span>
                    <span className="text-[10px] font-semibold text-white/70">{gift.label}</span>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-gold-300">
                      <Coins size={9} />
                      {gift.coins}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showTopUp && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={() => setShowTopUp(false)}>
          <div
            className="ultima-glass-supreme w-full max-w-md rounded-t-[28px] p-5"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-center font-display text-sm font-bold uppercase tracking-widest text-gold-200">
              Top Up Coins
            </p>
            <p className="mb-4 text-center text-xs text-white/40">
              100 coins ≈ $1 · dev mode grants instantly until a payment processor is connected
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[100, 500, 1000, 2500].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleTopUp(amount)}
                  className="ik-btn ik-btn-secondary flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold"
                >
                  <Plus size={14} />
                  <Coins size={14} className="text-gold-300" />
                  {amount}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
