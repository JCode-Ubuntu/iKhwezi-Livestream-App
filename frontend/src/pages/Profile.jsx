import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Video, UserPlus, UserCheck, LogOut, Play, Trophy, Globe, Pencil, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import VideoEditModal from '../components/VideoEditModal';

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
    loadProfile();
    loadVideos();
  }, [id]);

  const loadProfile = async () => {
    try {
      const res = await fetchWithAuth(`/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async () => {
    try {
      const res = await fetchWithAuth(`/users/${id}/videos`);
      const data = await res.json();
      setVideos(data);
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

  const handleLogout = () => {
    logout();
    navigate('/');
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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: 70,
      overflow: 'auto',
    }}>
      <div
        className="relative h-40 bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-950"
        style={{
          boxShadow: 'inset 0 -1px 0 rgba(99, 102, 241, 0.25)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: 10,
          }}
        >
          <ArrowLeft size={20} />
        </button>

        {isOwnProfile && (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#EF4444',
              zIndex: 10,
            }}
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>

      <div style={{ padding: '0 20px', marginTop: -50 }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 16,
          marginBottom: 16,
        }}>
          <div className="relative" style={{ width: 100, height: 100 }}>
            <div
              className="absolute -inset-1 rounded-full opacity-90 blur-md"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7, #22d3ee)',
              }}
            />
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6F4FFF, #FFB800)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 700,
              color: 'white',
              border: '4px solid var(--bg-primary)',
              boxShadow: '0 0 32px rgba(99, 102, 241, 0.45)',
              position: 'relative',
            }}>
              {profile.avatar ? (
                <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                profile.username?.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div style={{ flex: 1, paddingBottom: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>
              {profile.displayName || profile.username}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              @{profile.username}
            </p>
          </div>
        </div>

        {profile.bio && (
          <p style={{
            color: 'var(--text-primary)',
            fontSize: 14,
            lineHeight: 1.5,
            marginBottom: 16,
          }}>
            {profile.bio}
          </p>
        )}

        <div style={{
          display: 'flex',
          gap: 24,
          marginBottom: 20,
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{profile.videoCount || 0}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Videos</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{profile.followerCount || 0}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Followers</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{profile.followingCount || 0}</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Following</p>
          </div>
          {profile.isCreator && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
                {profile.totalPoints || 0}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Points</p>
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
              <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-indigo-600/90 to-purple-700/90 shadow-neon-ring">
                <Globe className="h-8 w-8 text-white" strokeWidth={1.75} />
                <span className="absolute -bottom-1 rounded-full border border-white/10 bg-black/80 px-2 py-0.5 text-[11px] font-black text-neon-cyan">
                  #{globalRank}
                </span>
              </div>
              <span className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white/50">
                <Trophy className="h-3 w-3 text-amber-400" />
                Global rank
              </span>
            </div>
          </div>
        </GlassCard>

        {!isOwnProfile && (
          <button
            onClick={handleFollow}
            className={profile.isFollowing ? 'btn btn-ghost' : 'btn btn-primary'}
            style={{ width: '100%', marginBottom: 20 }}
          >
            {profile.isFollowing ? (
              <>
                <UserCheck size={18} />
                Following
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Follow
              </>
            )}
          </button>
        )}

        <div style={{
          display: 'flex',
          borderBottom: '2px solid var(--bg-elevated)',
          marginBottom: 16,
        }}>
          <button
            onClick={() => setActiveTab('videos')}
            style={{
              flex: 1,
              padding: '12px 0',
              color: activeTab === 'videos' ? 'var(--violet-light)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 14,
              borderBottom: activeTab === 'videos' ? '2px solid var(--violet-glow)' : 'none',
              marginBottom: -2,
            }}
          >
            <Video size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Videos
          </button>
          <button
            onClick={() => setActiveTab('stars')}
            style={{
              flex: 1,
              padding: '12px 0',
              color: activeTab === 'stars' ? 'var(--gold)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 14,
              borderBottom: activeTab === 'stars' ? '2px solid var(--gold)' : 'none',
              marginBottom: -2,
            }}
          >
            <Star size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Stars
          </button>
        </div>

        {activeTab === 'videos' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 4,
          }}>
            {videos.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: 40,
                color: 'var(--text-secondary)',
              }}>
                No videos yet
              </div>
            ) : (
              videos.map((video) => (
                <div
                  key={video.id}
                  style={{
                    aspectRatio: '9/16',
                    background: 'var(--bg-card)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <video
                    src={`/storage/uploads/${video.filename}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    muted
                    onClick={() => navigate('/')}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 8,
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                      <Play size={12} fill="white" />
                      {video.views || 0}
                    </div>
                    {isOwnProfile && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setEditVideo(video); }}
                        style={{
                          width: 26, height: 26, borderRadius: 6,
                          background: 'rgba(99,102,241,0.85)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.2)',
                        }}
                      >
                        <Pencil size={12} color="white" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'stars' && (
          <div style={{
            textAlign: 'center',
            padding: 40,
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFB80020, #FFB80010)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Star size={36} color="var(--gold)" fill="var(--gold)" />
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
              {profile.totalPoints || 0} Points
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Earned from fan stars
            </p>
          </div>
        )}
      </div>

      {/* ── Account / Logout section (own profile only) ── */}
      {isOwnProfile && (
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            paddingTop: 20,
            marginTop: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Settings size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                Account
              </span>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '14px 20px',
                borderRadius: 14,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#EF4444',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </div>
      )}

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 320,
              background: '#0f1124', borderRadius: 20,
              padding: 28, border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <LogOut size={32} style={{ margin: '0 auto 12px', color: '#EF4444' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>Log out?</h3>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>You'll need to sign in again to post and interact.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: '#EF4444', border: 'none',
                  color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >Log out</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

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
    </div>
  );
}

export default Profile;
