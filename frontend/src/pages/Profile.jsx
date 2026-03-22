import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Star, Video, Users, UserPlus, UserCheck, LogOut, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, fetchWithAuth, logout, isAuthenticated, showToast } = useAuth();
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('videos');

  const isOwnProfile = user?.id === id;

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
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 70,
      }}>
        <div style={{
          width: 50,
          height: 50,
          border: '3px solid var(--bg-elevated)',
          borderTopColor: 'var(--violet-glow)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
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
      <div style={{
        position: 'relative',
        height: 160,
        background: 'linear-gradient(135deg, #6F4FFF, #FFB800)',
      }}>
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
            onClick={handleLogout}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
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
            <LogOut size={20} />
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
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          }}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              profile.username?.charAt(0).toUpperCase()
            )}
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
                  onClick={() => navigate('/')}
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
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    muted
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 8,
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                    }}>
                      <Play size={12} fill="white" />
                      {video.views || 0}
                    </div>
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

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Profile;
