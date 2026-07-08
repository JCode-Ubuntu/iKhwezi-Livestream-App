import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PremiumPostCard, PremiumStoriesCarousel, PremiumBottomNav } from './index'

const API_BASE = '/api/v3'

export default function Feed({ user, token, onLogout }) {
  const navigate = useNavigate()
  const [activeRoute, setActiveRoute] = useState('home')
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    fetch(`${API_BASE}/feed`, { headers })
      .then(r => r.json())
      .then(data => { setPosts(data.posts || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); })
  }, [token])

  const mockStories = [
    { id: 1, creator: 'User One', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', viewed: false },
    { id: 2, creator: 'User Two', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', viewed: true },
    { id: 3, creator: 'User Three', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3', viewed: false },
    { id: 4, creator: 'User Four', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user4', viewed: true },
  ]

  const handleNavigation = (route) => {
    setActiveRoute(route)
    if (route === 'profile') {
      user ? navigate('/profile') : navigate('/login')
    }
  }

  const handleCreateClick = () => {
    user ? navigate('/create') : navigate('/login')
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/95 border-b border-gray-800 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">iKHWEZI</h1>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                alt={user.displayName}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'linear-gradient(135deg, #9366f0, #ff6b9d)',
                border: 'none',
                borderRadius: '20px',
                color: '#fff',
                padding: '6px 16px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Stories */}
      <div className="fixed top-14 left-0 right-0 border-b border-gray-800 bg-black/95 z-30">
        <div className="max-w-2xl mx-auto">
          <PremiumStoriesCarousel 
            stories={mockStories}
            onStoryClick={() => {}}
            onAddStory={() => {}}
          />
        </div>
      </div>

      {/* Feed Content */}
      <div className="pt-40 max-w-2xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <p>Loading posts...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">
            <p>Error loading posts: {error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No posts yet. Be the first to create one!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PremiumPostCard
              key={post.id}
              post={{
                ...post,
                creator: {
                  displayName: post.creator?.displayName || post.creator?.username || 'Creator',
                  username: post.creator?.username || 'unknown',
                  avatar: post.creator?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.creator?.username}`,
                  verified: post.creator?.isCreator || false
                }
              }}
              onLike={() => {}}
            />
          ))
        )}
      </div>

      {/* Bottom Navigation */}
      <PremiumBottomNav 
        activeRoute={activeRoute}
        onNavigate={handleNavigation}
        onCreateClick={handleCreateClick}
      />
    </div>
  )
}
