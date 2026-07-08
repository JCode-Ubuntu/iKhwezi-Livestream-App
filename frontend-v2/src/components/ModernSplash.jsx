import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function ModernSplash() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl opacity-10 animate-pulse"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-lg mx-auto px-6">
        {/* Logo/Icon */}
        <div className="mb-8 inline-block">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
            <span className="text-5xl font-black text-white">iK</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
          iKHWEZI
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-slate-300 mb-8 leading-relaxed">
          Stream. Create. Connect. Earn rewards on the ultimate creator platform.
        </p>

        {/* Features */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="text-center">
            <div className="text-2xl mb-2">🎥</div>
            <p className="text-sm text-slate-400">Live Stream</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">✨</div>
            <p className="text-sm text-slate-400">Create</p>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-sm text-slate-400">Earn</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/register')}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 text-lg"
          >
            Create Account
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 px-6 bg-slate-800 border-2 border-slate-700 text-white font-bold rounded-xl hover:border-slate-600 hover:bg-slate-700 transition-all duration-300 text-lg"
          >
            Sign In
          </button>
        </div>

        {/* Footer */}
        <p className="text-sm text-slate-500 mt-8">
          Join thousands of creators. V2.0 - Upgraded Experience
        </p>
      </div>
    </div>
  )
}
