import React, { useState, useEffect } from 'react'
import { Home, Plus, Compass } from 'lucide-react'
import axios from 'axios'
import { PremiumPostCard, PremiumStoriesCarousel, PremiumBottomNav, SkeletonFeed } from './index'

// Use relative API paths that go through nginx proxy
const API_BASE = '/api/v3'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [liked, setLiked] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  // Mock stories for demo
  const mockStories = [
    { id: 1, name: 'Your Story', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=me', viewed: false },
    { id: 2, name: 'User 2', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', viewed: true },
    { id: 3, name: 'User 3', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3', viewed: false },
    { id: 4, name: 'User 4', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user4', viewed: true },
    { id: 5, name: 'User 5', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user5', viewed: false },
  ]

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
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/95 backdrop-blur border-b border-gray-800 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            iKHWEZI
          </h1>
          <div className="flex gap-4">
            <Home size={24} className="text-white cursor-pointer hover:opacity-60 transition" />
            <Plus size={24} className="text-white cursor-pointer hover:opacity-60 transition" />
            <Compass size={24} className="text-white cursor-pointer hover:opacity-60 transition" />
          </div>
        </div>
      </div>

      {/* Main Feed */}
      <div className="pt-20 max-w-2xl mx-auto px-4 space-y-2">
        {/* Stories Carousel */}
        <PremiumStoriesCarousel 
          stories={mockStories}
          onStoryClick={(story) => console.log('Story clicked:', story)}
          onAddStory={() => console.log('Add story clicked')}
        />

        {/* Loading State */}
        {loading && <SkeletonFeed />}

        {/* Posts Feed */}
        {!loading && posts.length > 0 ? (
          <div className="space-y-2">
            {posts.map((post) => (
              <PremiumPostCard
                key={post.id}
                creator={{
                  name: post.creator?.displayName || post.creator?.username || 'Creator',
                  avatar: post.creator?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg',
                  verified: post.creator?.verified || false
                }}
                image={`http://${window.location.hostname}:3001/storage/videos/${post.filename}`}
                description={post.description || 'No description'}
                likeCount={post.likeCount || 0}
                commentCount={post.Comments?.length || 0}
                timestamp={new Date(post.createdAt)}
                onLike={() => handleLike(post.id)}
                isLiked={liked.has(post.id)}
              />
            ))}
          </div>
        ) : !loading && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">No posts yet.</p>
            <p className="text-sm opacity-60">Start creating to share your moments!</p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <PremiumBottomNav 
        activeRoute="home"
        onNavigate={(route) => console.log('Navigate to:', route)}
        onCreateClick={() => console.log('Create clicked')}
      />
    </div>
  )

  function handleLike(postId) {
    const newLiked = new Set(liked)
    if (newLiked.has(postId)) {
      newLiked.delete(postId)
    } else {
      newLiked.add(postId)
    }
    setLiked(newLiked)
  }
}
