import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key, Radio, Upload, Users, BarChart3, FileText, LogOut,
  RefreshCw, Play, Square, Eye, EyeOff, Copy, Check, Trash2,
  Ban, UserCheck, Star, Video, TrendingUp, Clock, Shield, Megaphone
} from 'lucide-react';

import { resolveMediaUrl } from '../config/appConfig';

const API_BASE = '/api';

function Admin() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('streaming');
  const fileInputRef = useRef(null);
  const adFileInputRef = useRef(null);

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
    try {
      const res = await fetchAdmin('/admin/analytics');
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to load analytics:', data);
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
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
    const res = await fetchAdmin('/admin/ads');
    const data = await res.json();
    setAds(Array.isArray(data) ? data : []);
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
      const res = await fetch(`${API_BASE}/admin/ads`, {
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
      <div className="flex flex-1 flex-col items-center justify-center bg-void-950 px-6">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 to-gold-500 shadow-[0_10px_40px_rgba(225,48,108,0.4)]">
          <Shield size={40} className="text-white" />
        </div>

        <h1 className="mb-2 font-display text-3xl font-black text-white">Admin Access</h1>
        <p className="mb-8 text-sm text-white/45">Enter admin key to continue</p>

        <form onSubmit={handleLogin} className="w-full max-w-[320px]">
          <div className="ultima-glass mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5">
            <Key size={18} className="shrink-0 text-gold-400/75" />
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Admin key"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-gold-400 via-amber-500 to-gold-600 py-4 font-display text-sm font-bold uppercase tracking-widest text-void-950 shadow-lg shadow-gold-500/25 transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Verifying…' : 'Access admin panel'}
          </button>
        </form>

        <button onClick={() => navigate('/')} className="mt-6 text-sm font-semibold text-white/45">
          Back to app
        </button>
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
    <div className="flex flex-1 flex-col overflow-hidden bg-void-950">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-void-900 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-gold-500">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-white">Admin Panel</h1>
            <p className="text-xs text-white/45">iKHWEZI control center</p>
          </div>
        </div>
        <button
          onClick={() => { setIsAuthenticated(false); setAdminKey(''); }}
          className="ultima-glass flex h-10 w-10 items-center justify-center rounded-xl text-white/60"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto bg-void-900 px-4 py-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
                active
                  ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md shadow-pink-500/25'
                  : 'bg-white/5 text-white/50'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'streaming' && (
          <div className="flex flex-col gap-4">
            <div className="ultima-glass rounded-2xl p-4">
              <h3 className="mb-4 text-[15px] font-bold text-white">Stream Status</h3>
              <div
                className={`mb-4 flex items-center gap-3 rounded-xl px-4 py-4 ${
                  isLive ? 'bg-red-500/10' : 'bg-white/5'
                }`}
              >
                <div className={`h-3 w-3 rounded-full ${isLive ? 'animate-pulse bg-red-500' : 'bg-white/30'}`} />
                <span className={`text-sm font-bold ${isLive ? 'text-red-400' : 'text-white/45'}`}>
                  {isLive ? 'LIVE NOW' : 'OFFLINE'}
                </span>
              </div>

              <div className="ultima-glass mb-3 flex items-center gap-3 rounded-2xl px-4 py-3">
                <input
                  type="text"
                  value={liveTitle}
                  onChange={(e) => setLiveTitle(e.target.value)}
                  placeholder="Stream title"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                />
              </div>

              {isLive ? (
                <button
                  onClick={stopLive}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 text-sm font-bold text-white transition active:scale-[0.98]"
                >
                  <Square size={18} />
                  Stop Live
                </button>
              ) : (
                <button
                  onClick={startLive}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-gold-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition active:scale-[0.98]"
                >
                  <Play size={18} />
                  Go Live
                </button>
              )}
            </div>

            <div className="ultima-glass rounded-2xl p-4">
              <h3 className="mb-4 text-[15px] font-bold text-white">Stream Key</h3>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex-1 rounded-xl bg-white/5 px-4 py-3 font-mono text-sm text-white/85">
                  {showStreamKey ? streamKey : '••••••••••••••••••••'}
                </div>
                <button
                  onClick={() => setShowStreamKey(!showStreamKey)}
                  className="ultima-glass flex h-11 w-11 items-center justify-center rounded-xl text-white/60"
                >
                  {showStreamKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  onClick={copyStreamKey}
                  className="ultima-glass flex h-11 w-11 items-center justify-center rounded-xl text-white/60"
                >
                  {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                </button>
              </div>
              <button
                onClick={rotateStreamKey}
                className="ultima-glass flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white/80"
              >
                <RefreshCw size={18} />
                Rotate Key
              </button>
              <p className="mt-3 text-xs text-white/35">RTMP URL: rtmp://localhost:1935/live</p>
            </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="flex flex-col gap-4">
            <div className="ultima-glass rounded-2xl p-4">
              <h3 className="mb-4 text-[15px] font-bold text-white">Upload Video</h3>
              <form onSubmit={handleUpload} className="flex flex-col gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/*"
                  required
                  className="text-sm text-white/70"
                />
                <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    placeholder="Title"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                  />
                </div>
                <div className="ultima-glass rounded-2xl px-4 py-3">
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="Description"
                    className="min-h-[80px] w-full resize-y bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                  />
                </div>
                <div className="flex gap-5">
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={uploadForm.isSponsored}
                      onChange={(e) => setUploadForm({ ...uploadForm, isSponsored: e.target.checked })}
                      className="accent-pink-500"
                    />
                    Sponsored
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={uploadForm.isTrending}
                      onChange={(e) => setUploadForm({ ...uploadForm, isTrending: e.target.checked })}
                      className="accent-pink-500"
                    />
                    Trending
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-gold-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition active:scale-[0.98] disabled:opacity-60"
                >
                  <Upload size={18} />
                  {uploading ? 'Uploading…' : 'Upload video'}
                </button>
              </form>
            </div>

            <div className="ultima-glass rounded-2xl p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-white">All Videos ({videos.length})</h3>
                <button onClick={loadVideos} className="text-white/50">
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {videos.map((video) => (
                  <div key={video.id} className="flex gap-3 rounded-2xl bg-white/5 p-3">
                    <video
                      src={resolveMediaUrl(video.filename)}
                      className="h-[120px] w-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="mb-1 text-sm font-semibold text-white">{video.title || 'Untitled'}</p>
                      <p className="mb-2 text-xs text-white/45">
                        @{video.creator?.username} • {video.views} views
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateVideo(video.id, { isPublished: !video.isPublished })}
                          className="rounded-lg bg-white/5 px-2.5 py-1.5 text-white/70"
                        >
                          {video.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => updateVideo(video.id, { isTrending: !video.isTrending })}
                          className={`rounded-lg bg-white/5 px-2.5 py-1.5 ${video.isTrending ? 'text-gold-400' : 'text-white/70'}`}
                        >
                          <TrendingUp size={14} />
                        </button>
                        <button
                          onClick={() => deleteVideo(video.id)}
                          className="rounded-lg bg-white/5 px-2.5 py-1.5 text-red-400"
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

        {activeTab === 'ads' && (
          <div className="flex flex-col gap-4">
            <div className="ultima-glass rounded-2xl p-4">
              <h3 className="mb-1 text-[15px] font-bold text-white">Upload tailored ad</h3>
              <p className="mb-4 text-xs text-white/40">
                Ads appear inline on the home feed and fullscreen viewer — same screen as videos and posts.
              </p>
              <form onSubmit={handleAdUpload} className="flex flex-col gap-3">
                <input
                  type="file"
                  ref={adFileInputRef}
                  accept="image/*,video/*"
                  required
                  className="text-sm text-white/70"
                />
                <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
                  <input
                    type="text"
                    value={adUploadForm.title}
                    onChange={(e) => setAdUploadForm({ ...adUploadForm, title: e.target.value })}
                    placeholder="Ad title"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                  />
                </div>
                <div className="ultima-glass rounded-2xl px-4 py-3">
                  <textarea
                    value={adUploadForm.caption}
                    onChange={(e) => setAdUploadForm({ ...adUploadForm, caption: e.target.value })}
                    placeholder="Caption shown on the feed card"
                    className="min-h-[72px] w-full resize-y bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                  />
                </div>
                <div className="ultima-glass flex items-center gap-3 rounded-2xl px-4 py-3">
                  <input
                    type="url"
                    value={adUploadForm.clickUrl}
                    onChange={(e) => setAdUploadForm({ ...adUploadForm, clickUrl: e.target.value })}
                    placeholder="Link URL (optional)"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="ultima-glass rounded-2xl px-4 py-3">
                    <input
                      type="text"
                      value={adUploadForm.ctaLabel}
                      onChange={(e) => setAdUploadForm({ ...adUploadForm, ctaLabel: e.target.value })}
                      placeholder="Button label"
                      className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/25"
                    />
                  </div>
                  <div className="ultima-glass rounded-2xl px-4 py-3">
                    <select
                      value={adUploadForm.placement}
                      onChange={(e) => setAdUploadForm({ ...adUploadForm, placement: e.target.value })}
                      className="w-full bg-transparent text-[15px] text-white outline-none"
                    >
                      <option value="feed" className="bg-void-900">Feed + fullscreen</option>
                      <option value="spotlight" className="bg-void-900">Spotlight only</option>
                      <option value="all" className="bg-void-900">Everywhere</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={adUploadForm.isActive}
                      onChange={(e) => setAdUploadForm({ ...adUploadForm, isActive: e.target.checked })}
                      className="accent-gold-500"
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/70">
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
                <button
                  type="submit"
                  disabled={adUploading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 to-amber-500 py-3.5 text-sm font-bold text-void-950 shadow-lg shadow-gold-500/25 transition active:scale-[0.98] disabled:opacity-60"
                >
                  <Megaphone size={18} />
                  {adUploading ? 'Uploading…' : 'Publish ad'}
                </button>
              </form>
            </div>

            <div className="ultima-glass rounded-2xl p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-white">All ads ({ads.length})</h3>
                <button onClick={loadAds} className="text-white/50">
                  <RefreshCw size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {ads.map((ad) => (
                  <div key={ad.id} className="flex gap-3 rounded-2xl bg-white/5 p-3">
                    {ad.mediaType === 'video' ? (
                      <video
                        src={resolveMediaUrl(ad.filename)}
                        className="h-[120px] w-20 rounded-lg object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={resolveMediaUrl(ad.filename)}
                        alt={ad.title || 'Ad'}
                        className="h-[120px] w-20 rounded-lg object-cover"
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateAd(ad.id, { isActive: !ad.isActive })}
                          className="rounded-lg bg-white/5 px-2.5 py-1.5 text-white/70"
                          title={ad.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {ad.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          onClick={() => deleteAd(ad.id)}
                          className="rounded-lg bg-white/5 px-2.5 py-1.5 text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!ads.length && (
                  <p className="py-6 text-center text-sm text-white/35">No ads yet — upload your first tailored ad above.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="ultima-glass rounded-2xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-white">Users ({users.length})</h3>
              <button onClick={loadUsers} className="text-white/50">
                <RefreshCw size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs text-white/35">
              Grant Admin for broadcast rights. Use Block to ban a user from logging in (owner + admin panel).
            </p>
            <div className="flex flex-col gap-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 rounded-2xl bg-white/5 p-3 ${u.isBanned ? 'opacity-50' : ''}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-gold-500 text-sm font-bold text-white">
                    {u.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      @{u.username}
                      {u.isAdmin && (
                        <span className="rounded-full border border-gold-400/30 bg-gold-500/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-300">
                          Admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/45">
                      {u.email || u.phone} • {u.points?.totalPoints || 0} pts
                    </p>
                  </div>
                  <button
                    onClick={() => toggleAdmin(u.id)}
                    title={u.isAdmin ? 'Revoke broadcast rights' : 'Grant broadcast rights'}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                      u.isAdmin ? 'bg-gold-500/15 text-gold-300' : 'bg-white/5 text-white/40'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => toggleBan(u)}
                    title={u.isBanned ? 'Unblock user' : 'Block user'}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                      u.isBanned ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                    }`}
                  >
                    {u.isBanned ? 'Unblock' : 'Block'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
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
                  <div key={i} className="ultima-glass rounded-2xl p-4 text-center">
                    <Icon size={24} className={`mx-auto mb-2 ${stat.color}`} />
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-white/45">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="ultima-glass rounded-2xl p-4">
              <h3 className="mb-4 text-[15px] font-bold text-white">Top Creators</h3>
              <div className="flex flex-col gap-2">
                {analytics.topCreators?.map((creator, i) => (
                  <div key={creator.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                    <span className={`w-6 font-bold ${i < 3 ? 'text-gold-400' : 'text-white/40'}`}>#{i + 1}</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-gold-500 text-sm font-bold text-white">
                      {creator.User?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">@{creator.User?.username}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-gold-400" fill="currentColor" />
                      <span className="text-sm font-bold text-gold-400">{creator.totalPoints}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="ultima-glass rounded-2xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-white">Audit Log (Last 20)</h3>
              <button onClick={loadAuditLog} className="text-white/50">
                <RefreshCw size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {auditLog.map((log) => (
                <div key={log.id} className="rounded-2xl bg-white/5 p-3">
                  <div className="mb-1 flex justify-between">
                    <span className="text-sm font-semibold text-pink-300">{log.action}</span>
                    <span className="text-xs text-white/35">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  {log.details && <p className="font-mono text-xs text-white/45">{log.details}</p>}
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
