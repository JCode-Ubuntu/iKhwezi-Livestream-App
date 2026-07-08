import React from 'react'
import { PremiumPostCard } from './index'

export default function Feed() {
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="fixed top-0 left-0 right-0 bg-black/95 border-b border-gray-800 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold">iKHWEZI</h1>
        </div>
      </div>
      <div className="pt-20 max-w-2xl mx-auto px-4">
        <PremiumPostCard
          creator={{name: "Test", avatar: "https://api.dicebear.com/7.x/avataaars/svg", verified: false}}
          image="https://via.placeholder.com/500"
          description="Test post"
          likeCount={42}
          commentCount={5}
          timestamp={new Date()}
          onLike={() => console.log('liked')}
          isLiked={false}
        />
      </div>
    </div>
  )
}
