import React, { useState, useEffect } from 'react'
import { Play, Square, Settings, Users, Eye } from 'lucide-react'
import axios from 'axios'
import io from 'socket.io-client'

const API_BASE = 'http://localhost:3001/api/v3'
const ADMIN_KEY = 'your-secret-admin-key-here' // In production, use from environment

let socket = null

export default function AdminLivestream() {
  const [isLive, setIsLive] = useState(false)
  const [viewers, setViewers] = useState(0)
  const [title, setTitle] = useState("iKHWEZI Live Stream")
  const [streamKey, setStreamKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rtmpUrl, setRtmpUrl] = useState("")

  useEffect(() => {
    // Connect to Socket.io for real-time updates
    socket = io('http://localhost:3001', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    })

    socket.on('viewer-count', (data) => {
      setViewers(data.viewerCount)
    })

    socket.on('livestream-started', (data) => {
      setIsLive(true)
      setTitle(data.title)
      setStreamKey(data.streamKey)
      setRtmpUrl(data.rtmpUrl)
    })

    socket.on('livestream-stopped', () => {
      setIsLive(false)
      setViewers(0)
    })

    // Load initial status
    fetchLiveStatus()

    return () => {
      if (socket) socket.disconnect()
    }
  }, [])

  const fetchLiveStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/livestream/status`)
      setIsLive(response.data.isLive)
      setTitle(response.data.title)
      setStreamKey(response.data.streamKey)
      setRtmpUrl(`rtmp://13.62.54.198/live/${response.data.streamKey}`)
      setViewers(response.data.viewerCount)
    } catch (err) {
      console.error('Status fetch error:', err)
      setError('Failed to load livestream status')
    }
  }

  const handleStartLive = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.post(
        `${API_BASE}/livestream/start`,
        { title },
        { headers: { 'x-admin-key': ADMIN_KEY } }
      )
      setIsLive(true)
      setStreamKey(response.data.streamKey)
      setRtmpUrl(response.data.rtmpUrl)
      setViewers(0)
    } catch (err) {
      console.error('Start error:', err)
      setError('Failed to start livestream')
    } finally {
      setLoading(false)
    }
  }

  const handleStopLive = async () => {
    try {
      setLoading(true)
      setError(null)
      await axios.post(
        `${API_BASE}/livestream/stop`,
        {},
        { headers: { 'x-admin-key': ADMIN_KEY } }
      )
      setIsLive(false)
      setViewers(0)
    } catch (err) {
      console.error('Stop error:', err)
      setError('Failed to stop livestream')
    } finally {
      setLoading(false)
    }
  }

  const copyStreamKey = () => {
    navigator.clipboard.writeText(rtmpUrl || streamKey)
    alert('Stream URL copied to clipboard!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Admin Livestream Control</h1>
          <p className="text-gray-400">Manage your live broadcasts</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Live Status Card */}
        <div className={`rounded-lg p-6 mb-6 ${isLive ? 'bg-red-600/20 border-2 border-red-500' : 'bg-slate-800 border-2 border-slate-700'}`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-white">{isLive ? 'LIVE' : 'OFFLINE'}</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <Eye size={20} />
                  <span>{viewers.toLocaleString()} viewers</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {!isLive ? (
                <button
                  onClick={handleStartLive}
                  disabled={loading}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold transition"
                >
                  <Play size={20} />
                  {loading ? 'Starting...' : 'Start Live'}
                </button>
              ) : (
                <button
                  onClick={handleStopLive}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold transition"
                >
                  <Square size={20} />
                  {loading ? 'Stopping...' : 'Stop Live'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stream Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Preview */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <div className="aspect-video bg-black flex items-center justify-center">
                {isLive ? (
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-red-500 rounded-full animate-pulse flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">LIVE</span>
                    </div>
                    <p className="text-gray-400">Stream Preview</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Play size={64} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">Stream Offline</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stream Info */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                <Settings size={20} />
                Stream Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm">Stream Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded mt-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">RTMP Stream URL</label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={rtmpUrl || streamKey}
                      readOnly
                      className="flex-1 bg-slate-700 text-white px-4 py-2 rounded focus:outline-none text-xs"
                    />
                    <button 
                      onClick={copyStreamKey}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-6">
            {/* Viewers */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Users size={20} />
                Viewers
              </h3>
              <div className="text-4xl font-black text-red-500">
                {viewers.toLocaleString()}
              </div>
              <p className="text-gray-400 text-sm mt-2">Active viewers</p>
            </div>

            {/* Quick Stats */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-white font-bold mb-4">Today's Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Stream Time</span>
                  <span className="text-white font-semibold">2h 34m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Peak Viewers</span>
                  <span className="text-white font-semibold">5.2K</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Views</span>
                  <span className="text-white font-semibold">12.8K</span>
                </div>
              </div>
            </div>

            {/* Commands */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-white font-bold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition text-sm">
                  Add Moderator
                </button>
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition text-sm">
                  End Stream & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
