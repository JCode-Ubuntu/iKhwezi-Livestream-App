import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Key, Radio, Upload, Users, BarChart3, FileText, LogOut,
  RefreshCw, Play, Square, Eye, EyeOff, Copy, Check, Trash2,
  Ban, UserCheck, Star, Video, TrendingUp, Clock, Shield, Megaphone
} from 'lucide-react';

import { resolveMediaUrl, getApiBase } from '../config/appConfig';
import UltimaField from '../ultima/UltimaField';
import '../ultima/admin.css';

function AdminCard({ eyebrow, title, subtitle, children, action }) {
  return (
    <section className="admin-card">
      {(eyebrow || title) && (
        <div className="admin-section-head">
          <div>
            {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
            {title && <h3 className="admin-card-title">{title}</h3>}
            {subtitle && <p className="admin-card-sub">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function AdminRefresh({ onClick, label = 'Refresh' }) {
  return (
    <button type="button" onClick={onClick} className="admin-icon-btn" aria-label={label}>
      <RefreshCw size={16} />
    </button>
  );
}

function AdminTabBar({ tabs, activeTab, onChange }) {
  return (
    <div className="admin-tab-rail" role="tablist" aria-label="Admin sections">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`admin-tab ${active ? 'admin-tab--active' : ''}`}
          >
            <Icon size={15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'streaming');
  const fileInputRef = useRef(null);
  const adFileInputRef = useRef(null);

  const [streamKey, setStreamKey] = useState('');
  const [rtmpServer, setRtmpServer] = useState('');
  const [rtmpPublishUrl, setRtmpPublishUrl] = useState('');
  const [hlsPlaybackUrl, setHlsPlaybackUrl] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [showStreamKey, setShowStreamKey] = useState(false);
  const [copied, setCopied] = useState('');
  const [liveTitle, setLiveTitle] = useState('');

  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [auditLog, setAuditLog] = useState([]);

  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    isSponsored: false,
    isTrending: false,
  });
  const [uploading, setUploading] = useState(false);

  const [ads, setAds] = useState([]);
  const [adUploadForm, setAdUploadForm] = useState({
    title: '',
    caption: '',
    clickUrl: '',
    ctaLabel: 'Learn more',
    placement: 'feed',
    priority: 0,
    isActive: true,
  });
  const [adUploading, setAdUploading] = useState(false);

  const fetchAdmin = async (endpoint, options = {}) => {
    return fetch(`${getApiBase()}${endpoint}`, {
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
      const res = await fetch(`${getApiBase()}/admin/verify`, {
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
    try {
      const res = await fetchAdmin('/admin/stream-key');
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      setStreamKey(data.streamKey || '');
      setRtmpServer(data.rtmpServer || '');
      setRtmpPublishUrl(data.rtmpPublishUrl || '');
      setHlsPlaybackUrl(data.hlsPlaybackUrl || '');
      setIsLive(!!data.isLive);
    } catch (err) {
      console.error('Failed to load stream key:', err);
    }
  };

  const copyText = (label, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const rotateStreamKey = async () => {
    if (isLive) return;
    try {
      const res = await fetchAdmin('/admin/stream-key/rotate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return;
      setStreamKey(data.streamKey || '');
      setRtmpServer(data.rtmpServer || rtmpServer);
      setRtmpPublishUrl(data.rtmpPublishUrl || '');
      setHlsPlaybackUrl(data.hlsPlaybackUrl || '');
      setCopied('');
    } catch (err) {
      console.error('Failed to rotate stream key:', err);
    }
  };

  const startLive = async () => {
    try {
      const res = await fetchAdmin('/admin/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: liveTitle || 'Live Stream' }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsLive(!!data.isLive);
        if (data.rtmpServer) setRtmpServer(data.rtmpServer);
        if (data.streamKey) setStreamKey(data.streamKey);
        if (data.rtmpPublishUrl) setRtmpPublishUrl(data.rtmpPublishUrl);
        if (data.hlsPlaybackUrl) setHlsPlaybackUrl(data.hlsPlaybackUrl);
      } else {
        alert(data.error || 'Failed to start live');
      }
    } catch (err) {
      console.error('Failed to start live:', err);
      alert('Failed to start live');
    }
  };

  const stopLive = async () => {
    try {
      const res = await fetchAdmin('/admin/live/stop', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setIsLive(!!data.isLive);
      } else {
        alert(data.error || 'Failed to stop live');
      }
    } catch (err) {
      console.error('Failed to stop live:', err);
      alert('Failed to stop live');
    }
  };

  const loadVideos = async () => {
    try {
      const res = await fetchAdmin('/admin/videos');
      const data = await res.json();
      // fetchAdmin() never checked res.ok, so an expired/invalid admin key
      // (401 { error: ... }) or any other error response got passed straight
      // into setVideos() as-is — a non-array — and the videos.map() below
      // threw a render-crashing TypeError instead of showing a login/error
      // state. Same root cause repeated in loadUsers/loadAnalytics/loadAuditLog.
      if (!res.ok || !Array.isArray(data)) {
        console.error('Failed to load videos:', data);
        setVideos([]);
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      setVideos(data);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setVideos([]);
    }
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
      const res = await fetch(`${getApiBase()}/admin/videos`, {
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
    try {
      const res = await fetchAdmin('/admin/users');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        console.error('Failed to load users:', data);
        setUsers([]);
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsers([]);
    }
  };

  const toggleBan = async (u) => {
    const blocking = !u.isBanned;
    const msg = blocking
      ? `Block @${u.username}? They will lose access to the app.`
      : `Unblock @${u.username} and restore their access?`;
    if (!confirm(msg)) return;
    await fetchAdmin(`/admin/users/${u.id}/ban`, { method: 'PATCH' });
    loadUsers();
  };

  const toggleAdmin = async (id) => {
    await fetchAdmin(`/admin/users/${id}/admin`, { method: 'PATCH' });
    loadUsers();
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(false);
    try {
      const res = await fetchAdmin('/admin/analytics');
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to load analytics:', data);
        setAnalytics(null);
        setAnalyticsError(true);
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setAnalytics(null);
      setAnalyticsError(true);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadAuditLog = async () => {
    try {
      const res = await fetchAdmin('/admin/audit-log');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        console.error('Failed to load audit log:', data);
        setAuditLog([]);
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      setAuditLog(data);
    } catch (err) {
      console.error('Failed to load audit log:', err);
      setAuditLog([]);
    }
  };

  const loadAds = async () => {
    try {
      const res = await fetchAdmin('/admin/ads');
      const data = await res.json();
      if (!res.ok) {
        setAds([]);
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      setAds(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load ads:', err);
      setAds([]);
    }
  };

  const handleAdUpload = async (e) => {
    e.preventDefault();
    const file = adFileInputRef.current?.files[0];
    if (!file) return alert('Select an image or video for the ad');

    setAdUploading(true);
    const formData = new FormData();
    formData.append('media', file);
    formData.append('title', adUploadForm.title);
    formData.append('caption', adUploadForm.caption);
    formData.append('clickUrl', adUploadForm.clickUrl);
    formData.append('ctaLabel', adUploadForm.ctaLabel);
    formData.append('placement', adUploadForm.placement);
    formData.append('priority', String(adUploadForm.priority));
    formData.append('isActive', adUploadForm.isActive ? 'true' : 'false');

    try {
      const res = await fetch(`${getApiBase()}/admin/ads`, {
        method: 'POST',
        headers: { 'X-Admin-Key': adminKey },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      setAdUploadForm({
        title: '',
        caption: '',
        clickUrl: '',
        ctaLabel: 'Learn more',
        placement: 'feed',
        priority: 0,
        isActive: true,
      });
      if (adFileInputRef.current) adFileInputRef.current.value = '';
      loadAds();
    } catch {
      alert('Ad upload failed');
    } finally {
      setAdUploading(false);
    }
  };

  const updateAd = async (id, updates) => {
    await fetchAdmin(`/admin/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    loadAds();
  };

  const deleteAd = async (id) => {
    if (!confirm('Delete this ad?')) return;
    await fetchAdmin(`/admin/ads/${id}`, { method: 'DELETE' });
    loadAds();
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadVideos();
      loadAds();
      loadUsers();
      loadAnalytics();
      loadAuditLog();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <UltimaField intensity={0.9} fixed />
        <div className="admin-login-card">
          <div className="admin-login-mark">
            <Shield size={36} className="text-white" />
          </div>
          <p className="admin-eyebrow text-center">Control center</p>
          <h1 className="mb-2 text-center font-display text-2xl font-black text-white">Admin Access</h1>
          <p className="mb-6 text-center text-sm text-white/45">Enter your admin key to continue</p>

          <form onSubmit={handleLogin}>
            <div className="admin-field mb-4">
              <Key size={18} className="shrink-0 text-gold-400/75" />
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Admin key"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="admin-btn-primary">
              {loading ? 'Verifying…' : 'Access admin panel'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-5 w-full text-center text-sm font-semibold text-white/45 transition hover:text-white/70"
          >
            Back to app
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'streaming', icon: Radio, label: 'Streaming' },
    { id: 'videos', icon: Video, label: 'Videos' },
    { id: 'ads', icon: Megaphone, label: 'Tailored Ads' },
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'audit', icon: FileText, label: 'Audit Log' },
  ];

  return (
    <div className="admin-shell">
      <UltimaField intensity={0.55} fixed />

      <header className="admin-header">
        <div className="flex items-center gap-3">
          <div className="admin-header-mark">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <p className="admin-eyebrow">iKhwezi</p>
            <h1 className="text-[17px] font-bold text-white">Admin Panel</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setIsAuthenticated(false); setAdminKey(''); }}
          className="admin-icon-btn"
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      </header>

      <AdminTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="admin-body">
        {activeTab === 'streaming' && (
          <div className="admin-panel">
            <AdminCard eyebrow="Broadcast" title="Stream Status">
              <div className={`admin-live-pill ${isLive ? 'admin-live-pill--on' : 'admin-live-pill--off'}`}>
                <span className={`admin-live-dot ${isLive ? 'admin-live-dot--on' : ''}`} />
                <span className={`text-sm font-bold ${isLive ? 'text-red-300' : 'text-white/45'}`}>
                  {isLive ? 'LIVE NOW' : 'OFFLINE'}
                </span>
              </div>

              <div className="admin-field mb-3">
                <input
                  type="text"
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="Stream title"
                />
              </div>

              {isLive ? (
                <button type="button" onClick={stopLive} className="admin-btn-primary admin-btn-danger">
                  <Square size={18} />
                  Stop Live
                </button>
              ) : (
                <button type="button" onClick={startLive} className="admin-btn-primary admin-btn-live">
                  <Play size={18} />
                  Go Live
                </button>
              )}
            </AdminCard>

            <AdminCard eyebrow="Security" title="Stream Key">
              <p className="mb-3 text-xs leading-relaxed text-white/45">
                In OBS: set <strong className="text-white/70">Server</strong> to the RTMP URL below and{' '}
                <strong className="text-white/70">Stream Key</strong> to your key. Both must match exactly.
              </p>
              <div className="mb-3 flex items-center gap-2">
                <div className="admin-mono-box flex-1 truncate">
                  {showStreamKey ? streamKey : '••••••••••••••••••••'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowStreamKey(!showStreamKey)}
                  className="admin-icon-btn"
                  aria-label={showStreamKey ? 'Hide stream key' : 'Show stream key'}
                >
                  {showStreamKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => copyText('key', streamKey)}
                  className="admin-icon-btn"
                  aria-label="Copy stream key"
                >
                  {copied === 'key' ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                </button>
              </div>
              <button
                type="button"
                onClick={rotateStreamKey}
                disabled={isLive}
                className="admin-btn-ghost disabled:opacity-40"
              >
                <RefreshCw size={18} />
                Rotate Key
              </button>
              {isLive && (
                <p className="mt-2 text-[11px] text-amber-300/80">Stop the stream before rotating the key.</p>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="admin-mono-box flex-1 truncate text-[11px]">
                    {rtmpServer || rtmpPublishUrl || 'Loading RTMP URL…'}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText('rtmp', rtmpServer || rtmpPublishUrl)}
                    className="admin-icon-btn shrink-0"
                    aria-label="Copy RTMP server URL"
                  >
                    {copied === 'rtmp' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-white/35">RTMP Server (OBS → Settings → Stream → Server)</p>

                {hlsPlaybackUrl && (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="admin-mono-box flex-1 truncate text-[11px]">{hlsPlaybackUrl}</div>
                      <button
                        type="button"
                        onClick={() => copyText('hls', hlsPlaybackUrl)}
                        className="admin-icon-btn shrink-0"
                        aria-label="Copy HLS playback URL"
                      >
                        {copied === 'hls' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-white/35">HLS playback (viewers — auto-used by the Live page)</p>
                  </>
                )}
              </div>
            </AdminCard>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="admin-panel">
            <AdminCard eyebrow="Library" title="Upload Video">
              <form onSubmit={handleUpload} className="flex flex-col gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/*"
                  required
                  className="admin-file"
                />
                <div className="admin-field">
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="Title"
                  />
                </div>
                <div className="admin-field">
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Description"
                  />
                </div>
                <div className="flex gap-5">
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={uploadForm.isSponsored}
                      onChange={(e) => setUploadForm({ ...uploadForm, isSponsored: e.target.checked })}
                    />
                    Sponsored
                  </label>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={uploadForm.isTrending}
                      onChange={(e) => setUploadForm({ ...uploadForm, isTrending: e.target.checked })}
                    />
                    Trending
                  </label>
                </div>
                <button type="submit" disabled={uploading} className="admin-btn-primary">
                  <Upload size={18} />
                  {uploading ? 'Uploading…' : 'Upload video'}
                </button>
              </form>
            </AdminCard>

            <AdminCard
              eyebrow="Catalog"
              title={`All Videos (${videos.length})`}
              action={<AdminRefresh onClick={loadVideos} />}
            >
              <div className="flex flex-col gap-3">
                {videos.map((video) => (
                  <div key={video.id} className="admin-row">
                    <video
                      src={resolveMediaUrl(video.filename)}
                      className="admin-row-media"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 truncate text-sm font-semibold text-white">{video.title || 'Untitled'}</p>
                      <p className="mb-2 text-xs text-white/45">
                        @{video.creator?.username} • {video.views} views
                      </p>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          onClick={() => updateVideo(video.id, { isPublished: !video.isPublished })}
                          className="admin-chip-btn"
                          aria-label={video.isPublished ? 'Unpublish' : 'Publish'}
                        >
                          {video.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateVideo(video.id, { isTrending: !video.isTrending })}
                          className={`admin-chip-btn ${video.isTrending ? 'admin-chip-btn--gold' : ''}`}
                          aria-label="Toggle trending"
                        >
                          <TrendingUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteVideo(video.id)}
                          className="admin-chip-btn admin-chip-btn--danger"
                          aria-label="Delete video"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="admin-panel">
            <AdminCard
              eyebrow="Monetization"
              title="Upload tailored ad"
              subtitle="Ads appear inline on the home feed and fullscreen viewer — same screen as videos and posts."
            >
              <form onSubmit={handleAdUpload} className="flex flex-col gap-3">
                <input
                  type="file"
                  ref={adFileInputRef}
                  accept="image/*,video/*"
                  required
                  className="admin-file"
                />
                <div className="admin-field">
                  <input
                    type="text"
                    value={adUploadForm.title}
                    onChange={(e) => setAdUploadForm({ ...adUploadForm, title: e.target.value })}
                    placeholder="Ad title"
                  />
                </div>
                <div className="admin-field">
                  <textarea
                    value={adUploadForm.caption}
                    onChange={(e) => setAdUploadForm({ ...adUploadForm, caption: e.target.value })}
                    placeholder="Caption shown on the feed card"
                  />
                </div>
                <div className="admin-field">
                  <input
                    type="url"
                    value={adUploadForm.clickUrl}
                    onChange={(e) => setAdUploadForm({ ...adUploadForm, clickUrl: e.target.value })}
                    placeholder="Link URL (optional)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="admin-field">
                    <input
                      type="text"
                      value={adUploadForm.ctaLabel}
                      onChange={(e) => setAdUploadForm({ ...adUploadForm, ctaLabel: e.target.value })}
                      placeholder="Button label"
                    />
                  </div>
                  <div className="admin-field">
                    <select
                      value={adUploadForm.placement}
                      onChange={(e) => setAdUploadForm({ ...adUploadForm, placement: e.target.value })}
                    >
                      <option value="feed" className="bg-void-900">Feed + fullscreen</option>
                      <option value="spotlight" className="bg-void-900">Spotlight only</option>
                      <option value="all" className="bg-void-900">Everywhere</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={adUploadForm.isActive}
                      onChange={(e) => setAdUploadForm({ ...adUploadForm, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <label className="admin-check">
                    Priority
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={adUploadForm.priority}
                      onChange={(e) => setAdUploadForm({ ...adUploadForm, priority: Number(e.target.value) })}
                      className="w-16 rounded-lg bg-white/10 px-2 py-1 text-white"
                    />
                  </label>
                </div>
                <button type="submit" disabled={adUploading} className="admin-btn-primary">
                  <Megaphone size={18} />
                  {adUploading ? 'Uploading…' : 'Publish ad'}
                </button>
              </form>
            </AdminCard>

            <AdminCard
              eyebrow="Campaigns"
              title={`All ads (${ads.length})`}
              action={<AdminRefresh onClick={loadAds} />}
            >
              <div className="flex flex-col gap-3">
                {ads.map((ad) => (
                  <div key={ad.id} className="admin-row">
                    {ad.mediaType === 'video' ? (
                      <video
                        src={resolveMediaUrl(ad.filename)}
                        className="admin-row-media"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={resolveMediaUrl(ad.filename)}
                        alt={ad.title || 'Ad'}
                        className="admin-row-media"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 truncate text-sm font-semibold text-white">
                        {ad.title || 'Untitled ad'}
                      </p>
                      <p className="mb-1 text-xs text-white/45">
                        {ad.placement} · priority {ad.priority} · {ad.views || 0} views · {ad.clicks || 0} clicks
                      </p>
                      {ad.clickUrl && (
                        <p className="mb-2 truncate text-[10px] text-gold-300/80">{ad.clickUrl}</p>
                      )}
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          onClick={() => updateAd(ad.id, { isActive: !ad.isActive })}
                          className="admin-chip-btn"
                          title={ad.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {ad.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteAd(ad.id)}
                          className="admin-chip-btn admin-chip-btn--danger"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!ads.length && (
                  <p className="admin-empty">No ads yet — upload your first tailored ad above.</p>
                )}
              </div>
            </AdminCard>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="admin-panel">
            <AdminCard
              eyebrow="Community"
              title={`Users (${users.length})`}
              subtitle="Grant Admin for broadcast rights. Use Block to ban a user from logging in (owner + admin panel)."
              action={<AdminRefresh onClick={loadUsers} />}
            >
              <div className="flex flex-col gap-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`admin-row items-center ${u.isBanned ? 'opacity-50' : ''}`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-gold-500 text-sm font-bold text-white">
                      {u.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        @{u.username}
                        {u.isAdmin && <span className="admin-badge">Admin</span>}
                      </p>
                      <p className="text-xs text-white/45">
                        {u.email || u.phone} • {u.points?.totalPoints || 0} pts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleAdmin(u.id)}
                      title={u.isAdmin ? 'Revoke broadcast rights' : 'Grant broadcast rights'}
                      className={`admin-chip-btn ${u.isAdmin ? 'admin-chip-btn--gold' : ''}`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBan(u)}
                      title={u.isBanned ? 'Unblock user' : 'Block user'}
                      className={`admin-chip-btn ${u.isBanned ? 'admin-chip-btn--ok' : 'admin-chip-btn--danger'}`}
                    >
                      {u.isBanned ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="admin-panel">
            {analyticsLoading && (
              <p className="admin-empty">Loading analytics…</p>
            )}
            {analyticsError && !analyticsLoading && (
              <AdminCard eyebrow="Insights" title="Analytics unavailable">
                <p className="admin-empty">Could not load analytics. Check your connection and admin key.</p>
                <button type="button" onClick={loadAnalytics} className="admin-btn-ghost mt-3">
                  <RefreshCw size={16} />
                  Retry
                </button>
              </AdminCard>
            )}
            {analytics && !analyticsLoading && (
              <>
            <div className="admin-stat-grid">
              {[
                { label: 'Total Users', value: analytics.totalUsers, icon: Users, color: 'text-pink-400' },
                { label: 'New Today', value: analytics.newUsersToday, icon: UserCheck, color: 'text-emerald-400' },
                { label: 'Active (24h)', value: analytics.activeUsers, icon: Clock, color: 'text-gold-400' },
                { label: 'Total Videos', value: analytics.totalVideos, icon: Video, color: 'text-red-400' },
                { label: 'Total Views', value: analytics.totalViews, icon: Eye, color: 'text-pink-400' },
                { label: 'Total Stars', value: analytics.totalStars, icon: Star, color: 'text-gold-400' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="admin-stat">
                    <div className={`admin-stat-icon ${stat.color}`}>
                      <Icon size={20} />
                    </div>
                    <p className="admin-stat-value">{stat.value}</p>
                    <p className="admin-stat-label">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            <AdminCard eyebrow="Leaderboard" title="Top Creators">
              <div className="flex flex-col gap-2">
                {analytics.topCreators?.map((creator, i) => (
                  <div key={creator.id} className="admin-row items-center">
                    <span className={`w-6 shrink-0 font-bold ${i < 3 ? 'text-gold-400' : 'text-white/40'}`}>
                      #{i + 1}
                    </span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-gold-500 text-sm font-bold text-white">
                      {creator.User?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">@{creator.User?.username}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Star size={14} className="text-gold-400" fill="currentColor" />
                      <span className="text-sm font-bold text-gold-400">{creator.totalPoints}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AdminCard>
              </>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="admin-panel">
            <AdminCard
              eyebrow="Activity"
              title="Audit Log (Last 20)"
              action={<AdminRefresh onClick={loadAuditLog} />}
            >
              <div className="flex flex-col gap-2">
                {auditLog.map((log) => (
                  <div key={log.id} className="admin-row flex-col gap-1">
                    <div className="flex w-full justify-between gap-3">
                      <span className="admin-audit-action">{log.action}</span>
                      <span className="admin-audit-time">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    {log.details && (
                      <p className="admin-mono-box text-xs">{log.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </AdminCard>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
