import React, { useState, useEffect } from 'react'
import { Heart, MessageCircle, Share, Search, Home, Plus, Compass } from 'lucide-react'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [liked, setLiked] = useState(new Set())

  useEffect(() => {
    // Mock data - replace with API call
    setPosts([
      {
        id: 1,
        author: "Sarah Creator",
        avatar: "https://via.placeholder.com/40",
        image: "https://via.placeholder.com/500x500",
        caption: "Beautiful sunset at the beach 🌅",
        likes: 234,
        timestamp: "2 hours ago"
      },
      {
        id: 2,
        author: "Dev Master",
        avatar: "https://via.placeholder.com/40",
        image: "https://via.placeholder.com/500x500",
        caption: "Coding session vibes ✨",
        likes: 567,
        timestamp: "5 hours ago"
      },
      {
        id: 3,
        author: "Travel Bug",
        avatar: "https://via.placeholder.com/40",
        image: "https://via.placeholder.com/500x500",
        caption: "Exploring new places 🗺️",
        likes: 890,
        timestamp: "1 day ago"
      }
    ])
  }, [])

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

        {/* Posts */}
        {posts.map((post) => (
          <div key={post.id} className="border-b border-gray-700 bg-black">
            {/* Post Header */}
            <div className="px-4 py-3 flex items-center gap-3">
              <img src={post.avatar} alt={post.author} className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{post.author}</p>
                <p className="text-gray-400 text-xs">{post.timestamp}</p>
              </div>
              <button className="text-gray-400 hover:text-white">•••</button>
            </div>

            {/* Post Image */}
            <img src={post.image} alt="Post" className="w-full aspect-square object-cover" />

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
                {post.likes + (liked.has(post.id) ? 1 : 0)} likes
              </p>

              {/* Caption */}
              <p className="text-white text-sm mb-3">
                <span className="font-semibold">{post.author}</span> {post.caption}
              </p>

              {/* Comments Placeholder */}
              <p className="text-gray-400 text-xs cursor-pointer hover:opacity-60">View all comments</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
