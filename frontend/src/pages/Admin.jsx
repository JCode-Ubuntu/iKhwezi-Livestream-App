import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key, Radio, Upload, Users, BarChart3, FileText, LogOut,
  RefreshCw, Play, Square, Eye, EyeOff, Copy, Check, Trash2,
  Ban, UserCheck, Star, Video, TrendingUp, Clock, Shield
} from 'lucide-react';

const API_BASE = '/api';

function Admin() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('streaming');
  const fileInputRef = useRef(null);

  const [streamKey, setStreamKey] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');

  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditLog, setAuditLog] = useState([]);

  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    isSponsored: false,
    isTrending: false,
  });
  const [uploading, setUploading] = useState(false);

  const fetchAdmin = async (endpoint, options = {}) => {
    return fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'X-Admin-Key': adminKey,
      },
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/admin/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
      });

      if (res.ok) {
        setIsAuthenticated(true);
        loadStreamKey();
      } else {
        alert('Invalid admin key');
      }
    } catch (err) {
      alert('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const loadStreamKey = async () => {
    const res = await fetchAdmin('/admin/stream-key');
    const data = await res.json();
    setStreamKey(data.streamKey);
    setIsLive(data.isLive);
  };

  const rotateStreamKey = async () => {
    const res = await fetchAdmin('/admin/stream-key/rotate', { method: 'POST' });
    const data = await res.json();
    setStreamKey(data.streamKey);
    setCopied(false);
  };

  const startLive = async () => {
    const res = await fetchAdmin('/admin/live/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: liveTitle || 'Live Stream' }),
    });
    const data = await res.json();
    setIsLive(data.isLive);
  };

  const stopLive = async () => {
    const res = await fetchAdmin('/admin/live/stop', { method: 'POST' });
    const data = await res.json();
    setIsLive(data.isLive);
  };

  const copyStreamKey = () => {
    navigator.clipboard.writeText(streamKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadVideos = async () => {
    const res = await fetchAdmin('/admin/videos');
    const data = await res.json();
    setVideos(data);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', uploadForm.title);
    formData.append('description', uploadForm.description);
    formData.append('isSponsored', uploadForm.isSponsored);
    formData.append('isTrending', uploadForm.isTrending);

    try {
      const res = await fetch(`${API_BASE}/admin/videos`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
        body: formData,
      });

      if (res.ok) {
        setUploadForm({ title: '', description: '', isSponsored: false, isTrending: false });
        fileInputRef.current.value = '';
        loadVideos();
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const updateVideo = async (id, updates) => {
    await fetchAdmin(`/admin/videos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    loadVideos();
  };

  const deleteVideo = async (id) => {
    if (!confirm('Delete this video?')) return;
    await fetchAdmin(`/admin/videos/${id}`, { method: 'DELETE' });
    loadVideos();
  };

  const loadUsers = async () => {
    const res = await fetchAdmin('/admin/users');
    const data = await res.json();
    setUsers(data);
  };

  const toggleBan = async (id) => {
    await fetchAdmin(`/admin/users/${id}/ban`, { method: 'PATCH' });
    loadUsers();
  };

  const loadAnalytics = async () => {
    const res = await fetchAdmin('/admin/analytics');
    const data = await res.json();
    setAnalytics(data);
  };

  const loadAuditLog = async () => {
    const res = await fetchAdmin('/admin/audit-log');
    const data = await res.json();
    setAuditLog(data);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadVideos();
      loadUsers();
      loadAnalytics();
      loadAuditLog();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg-primary)',
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #6F4FFF, #4A2FCC)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 10px 40px rgba(111, 79, 255, 0.4)',
        }}>
          <Shield size={40} color="white" />
        </div>
        
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Admin Access</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Enter admin key to continue</p>

        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 320 }}>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Key size={20} color="var(--text-muted)" style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
            }} />
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin Key"
              className="input"
              style={{ paddingLeft: 48 }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', height: 52 }}
          >
            {loading ? 'Verifying...' : 'Access Admin Panel'}
          </button>
        </form>

        <button
          onClick={() => navigate('/')}
          className="btn btn-ghost"
          style={{ marginTop: 24 }}
        >
          Back to App
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'streaming', icon: Radio, label: 'Streaming' },
    { id: 'videos', icon: Video, label: 'Videos' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'audit', icon: FileText, label: 'Audit Log' },
  ];

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #6F4FFF, #4A2FCC)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Shield size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Admin Panel</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>iKHWEZI Control Center</p>
          </div>
        </div>
        <button
          onClick={() => { setIsAuthenticated(false); setAdminKey(''); }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <LogOut size={20} />
        </button>
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        padding: '12px 16px',
        overflowX: 'auto',
        background: 'var(--bg-secondary)',
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                background: activeTab === tab.id ? 'var(--violet-glow)' : 'var(--bg-elevated)',
                color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'streaming' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Stream Status</h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 16,
                background: isLive ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-elevated)',
                borderRadius: 12,
                marginBottom: 16,
              }}>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: isLive ? '#EF4444' : '#6B7280',
                  animation: isLive ? 'live-pulse 1.5s ease-in-out infinite' : 'none',
                }} />
                <span style={{ fontWeight: 600, color: isLive ? '#EF4444' : 'var(--text-secondary)' }}>
                  {isLive ? 'LIVE NOW' : 'OFFLINE'}
                </span>
              </div>

              <input
                type="text"
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="Stream title"
                className="input"
                style={{ marginBottom: 12 }}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                {isLive ? (
                  <button onClick={stopLive} className="btn" style={{
                    flex: 1,
                    background: '#EF4444',
                    color: 'white',
                  }}>
                    <Square size={18} />
                    Stop Live
                  </button>
                ) : (
                  <button onClick={startLive} className="btn btn-primary" style={{ flex: 1 }}>
                    <Play size={18} />
                    Go Live
                  </button>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Stream Key</h3>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}>
                <div style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 8,
                  fontFamily: 'monospace',
                  fontSize: 14,
                }}>
                  {showStreamKey ? streamKey : '••••••••••••••••••••'}
                </div>
                <button
                  onClick={() => setShowStreamKey(!showStreamKey)}
                  className="btn btn-ghost"
                  style={{ padding: 12 }}
                >
                  {showStreamKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  onClick={copyStreamKey}
                  className="btn btn-ghost"
                  style={{ padding: 12 }}
                >
                  {copied ? <Check size={18} color="var(--success)" /> : <Copy size={18} />}
                </button>
              </div>
              <button onClick={rotateStreamKey} className="btn btn-outline" style={{ width: '100%' }}>
                <RefreshCw size={18} />
                Rotate Key
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                RTMP URL: rtmp://localhost:1935/live
              </p>
            </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Upload Video</h3>
              <form onSubmit={handleUpload}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/*"
                  style={{ marginBottom: 12 }}
                  required
                />
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="Title"
                  className="input"
                  style={{ marginBottom: 12 }}
                />
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  placeholder="Description"
                  className="input"
                  style={{ marginBottom: 12, minHeight: 80, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={uploadForm.isSponsored}
                      onChange={(e) => setUploadForm({ ...uploadForm, isSponsored: e.target.checked })}
                    />
                    Sponsored
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={uploadForm.isTrending}
                      onChange={(e) => setUploadForm({ ...uploadForm, isTrending: e.target.checked })}
                    />
                    Trending
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  <Upload size={18} />
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </button>
              </form>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>All Videos ({videos.length})</h3>
                <button onClick={loadVideos} className="btn btn-ghost" style={{ padding: 8 }}>
                  <RefreshCw size={16} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {videos.map((video) => (
                  <div
                    key={video.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: 12,
                      background: 'var(--bg-elevated)',
                      borderRadius: 12,
                    }}
                  >
                    <video
                      src={`/storage/uploads/${video.filename}`}
                      style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>{video.title || 'Untitled'}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        @{video.creator?.username} • {video.views} views
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => updateVideo(video.id, { isPublished: !video.isPublished })}
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          {video.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => updateVideo(video.id, { isTrending: !video.isTrending })}
                          className="btn btn-ghost"
                          style={{
                            padding: '6px 10px',
                            fontSize: 12,
                            color: video.isTrending ? 'var(--gold)' : 'inherit',
                          }}
                        >
                          <TrendingUp size={14} />
                        </button>
                        <button
                          onClick={() => deleteVideo(video.id)}
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', fontSize: 12, color: 'var(--error)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Users ({users.length})</h3>
              <button onClick={loadUsers} className="btn btn-ghost" style={{ padding: 8 }}>
                <RefreshCw size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map((user) => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    background: 'var(--bg-elevated)',
                    borderRadius: 12,
                    opacity: user.isBanned ? 0.5 : 1,
                  }}
                >
                  <div className="avatar">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600 }}>@{user.username}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {user.email || user.phone} • {user.points?.totalPoints || 0} pts
                    </p>
                  </div>
                  <button
                    onClick={() => toggleBan(user.id)}
                    className="btn btn-ghost"
                    style={{
                      padding: 8,
                      color: user.isBanned ? 'var(--success)' : 'var(--error)',
                    }}
                  >
                    {user.isBanned ? <UserCheck size={18} /> : <Ban size={18} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { label: 'Total Users', value: analytics.totalUsers, icon: Users, color: '#6F4FFF' },
                { label: 'New Today', value: analytics.newUsersToday, icon: UserCheck, color: '#10B981' },
                { label: 'Active (24h)', value: analytics.activeUsers, icon: Clock, color: '#FFB800' },
                { label: 'Total Videos', value: analytics.totalVideos, icon: Video, color: '#EF4444' },
                { label: 'Total Views', value: analytics.totalViews, icon: Eye, color: '#6F4FFF' },
                { label: 'Total Stars', value: analytics.totalStars, icon: Star, color: '#FFB800' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="card" style={{ textAlign: 'center' }}>
                    <Icon size={24} color={stat.color} style={{ marginBottom: 8 }} />
                    <p style={{ fontSize: 24, fontWeight: 700 }}>{stat.value}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stat.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Top Creators</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analytics.topCreators?.map((creator, i) => (
                  <div
                    key={creator.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      background: 'var(--bg-elevated)',
                      borderRadius: 12,
                    }}
                  >
                    <span style={{
                      width: 24,
                      fontWeight: 700,
                      color: i < 3 ? 'var(--gold)' : 'var(--text-secondary)',
                    }}>
                      #{i + 1}
                    </span>
                    <div className="avatar">
                      {creator.User?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600 }}>@{creator.User?.username}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={14} color="var(--gold)" fill="var(--gold)" />
                      <span style={{ fontWeight: 600, color: 'var(--gold)' }}>
                        {creator.totalPoints}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Audit Log (Last 20)</h3>
              <button onClick={loadAuditLog} className="btn btn-ghost" style={{ padding: 8 }}>
                <RefreshCw size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {auditLog.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: 12,
                    background: 'var(--bg-elevated)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--violet-light)' }}>{log.action}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {log.details && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {log.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
