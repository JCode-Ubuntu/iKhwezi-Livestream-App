import React, { useState } from 'react'
import { Play, Square, Settings, Users, Eye } from 'lucide-react'

export default function AdminLivestream() {
  const [isLive, setIsLive] = useState(false)
  const [viewers, setViewers] = useState(0)
  const [title, setTitle] = useState("iKHWEZI Live Stream")
  const [streamKey, setStreamKey] = useState("rtmp://your-server.com/live/stream-key-123")

  const handleStartLive = () => {
    setIsLive(true)
    setViewers(Math.floor(Math.random() * 1000))
  }

  const handleStopLive = () => {
    setIsLive(false)
    setViewers(0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Admin Livestream Control</h1>
          <p className="text-gray-400">Manage your live broadcasts</p>
        </div>

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
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition"
                >
                  <Play size={20} />
                  Start Live
                </button>
              ) : (
                <button
                  onClick={handleStopLive}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition"
                >
                  <Square size={20} />
                  Stop Live
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
                  <label className="text-gray-400 text-sm">RTMP Stream Key</label>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="password"
                      value={streamKey}
                      readOnly
                      className="flex-1 bg-slate-700 text-white px-4 py-2 rounded focus:outline-none"
                    />
                    <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition">
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
