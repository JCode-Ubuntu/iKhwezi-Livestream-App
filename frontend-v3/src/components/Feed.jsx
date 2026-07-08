import React, { useState } from 'react'
import { PremiumPostCard, PremiumStoriesCarousel, PremiumBottomNav } from './index'

export default function Feed() {
  const [activeRoute, setActiveRoute] = useState('home')

  const mockStories = [
    { id: 1, creator: 'User One', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1', viewed: false },
    { id: 2, creator: 'User Two', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2', viewed: true },
    { id: 3, creator: 'User Three', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3', viewed: false },
    { id: 4, creator: 'User Four', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user4', viewed: true },
  ]

  const handleNavigation = (route) => {
    setActiveRoute(route)
    console.log('Navigate to:', route)
  }

  const handleCreateClick = () => {
    console.log('Create new post clicked')
  }

  const handleStoryClick = (storyId) => {
    console.log('Story clicked:', storyId)
  }

  const handleAddStory = () => {
    console.log('Add story clicked')
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black/95 border-b border-gray-800 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold">iKHWEZI</h1>
        </div>
      </div>

      {/* Stories */}
      <div className="fixed top-14 left-0 right-0 border-b border-gray-800 bg-black/95 z-30">
        <div className="max-w-2xl mx-auto">
          <PremiumStoriesCarousel 
            stories={mockStories}
            onStoryClick={handleStoryClick}
            onAddStory={handleAddStory}
          />
        </div>
      </div>

      {/* Feed Content */}
      <div className="pt-40 max-w-2xl mx-auto px-4 pb-8">
        <PremiumPostCard
          creator={{name: "Test Creator", avatar: "https://api.dicebear.com/7.x/avataaars/svg", verified: false}}
          image="https://via.placeholder.com/500"
          description="Test post from our premium feed component"
          likeCount={42}
          commentCount={5}
          timestamp={new Date()}
          onLike={() => console.log('liked')}
          isLiked={false}
        />
        <PremiumPostCard
          creator={{name: "Another Creator", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=other", verified: true}}
          image="https://via.placeholder.com/500"
          description="This is another sample post with verified creator"
          likeCount={127}
          commentCount={18}
          timestamp={new Date(Date.now() - 3600000)}
          onLike={() => console.log('liked')}
          isLiked={false}
        />
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
