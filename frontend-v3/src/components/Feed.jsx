import React, { useState, useEffect } from 'react'
import { Heart, MessageCircle, Share, Search, Home, Plus, Compass } from 'lucide-react'
import axios from 'axios'

// Use server IP when in production, localhost for development
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api/v3'
  : `http://${window.location.hostname}:3001/api/v3`

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [liked, setLiked] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchFeed()
  }, [page])

  const fetchFeed = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get(`${API_BASE}/feed`, {
        params: { page }
      })
      setPosts(response.data.posts || [])
    } catch (err) {
      console.error('Feed fetch error:', err)
      // Fallback to mock data if API fails
      setPosts([
        {
          id: 1,
          creator: { username: "Sarah Creator", avatar: "https://via.placeholder.com/40" },
          filename: "https://via.placeholder.com/500x500",
          description: "Beautiful sunset at the beach 🌅",
          likeCount: 234,
          createdAt: new Date(Date.now() - 2*60*60*1000).toISOString()
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (date) => {
    const now = new Date()
    const posted = new Date(date)
    const diff = now - posted
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const handleLike = (postId) => {
    const newLiked = new Set(liked)
    if (newLiked.has(postId)) {
      newLiked.delete(postId)
    } else {
      newLiked.add(postId)
    }
    setLiked(newLiked)
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black border-b border-gray-700 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">iKHWEZI</h1>
          <div className="flex gap-4">
            <Home size={24} className="text-white cursor-pointer hover:opacity-60" />
            <Plus size={24} className="text-white cursor-pointer hover:opacity-60" />
            <Compass size={24} className="text-white cursor-pointer hover:opacity-60" />
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="pt-20 max-w-2xl mx-auto">
        {/* Stories */}
        <div className="bg-black border-b border-gray-700 px-4 py-4 overflow-x-auto">
          <div className="flex gap-4">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full border-2 border-gray-700 hover:border-white transition"></div>
                <span className="text-xs text-gray-400">User {i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="text-gray-400">Loading feed...</div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900 text-red-200 p-4 mx-4 my-4 rounded">
            Failed to load feed. Showing offline content.
          </div>
        )}

        {/* Posts */}
        {!loading && posts.length > 0 ? posts.map((post) => (
          <div key={post.id} className="border-b border-gray-700 bg-black">
            {/* Post Header */}
            <div className="px-4 py-3 flex items-center gap-3">
              <img src={post.creator?.avatar || 'https://via.placeholder.com/40'} alt={post.creator?.displayName} className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{post.creator?.displayName || 'Creator'}</p>
                <p className="text-gray-400 text-xs">{formatTimestamp(post.createdAt)}</p>
              </div>
              <button className="text-gray-400 hover:text-white">•••</button>
            </div>

            {/* Post Image */}
            <img src={`http://${window.location.hostname}:3001/storage/videos/${post.filename}`} alt="Post" className="w-full aspect-square object-cover bg-gray-900" />

            {/* Post Actions */}
            <div className="px-4 py-3">
              <div className="flex justify-between mb-4">
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleLike(post.id)}
                    className="text-white hover:opacity-60 transition"
                  >
                    <Heart 
                      size={24} 
                      fill={liked.has(post.id) ? "#ff1744" : "none"}
                      color={liked.has(post.id) ? "#ff1744" : "white"}
                    />
                  </button>
                  <button className="text-white hover:opacity-60 transition">
                    <MessageCircle size={24} />
                  </button>
                  <button className="text-white hover:opacity-60 transition">
                    <Share size={24} />
                  </button>
                </div>
              </div>

              {/* Likes */}
              <p className="text-white font-semibold text-sm mb-2">
                {(post.likeCount || 0) + (liked.has(post.id) ? 1 : 0)} likes
              </p>

              {/* Caption */}
              <p className="text-white text-sm mb-3">
                <span className="font-semibold">{post.creator?.displayName || 'Creator'}</span> {post.description}
              </p>

              {/* Comments Placeholder */}
              <p className="text-gray-400 text-xs cursor-pointer hover:opacity-60">View all comments</p>
            </div>
          </div>
        )) : !loading && (
          <div className="text-center py-20 text-gray-400">
            No posts yet. Start creating!
          </div>
        )}
      </div>
    </div>
  )
}
