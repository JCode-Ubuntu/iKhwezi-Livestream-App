import React, { useState, useEffect } from 'react'
import { Home, Plus, Compass } from 'lucide-react'

export default function Feed() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 bg-black/95 border-b border-gray-800 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-2xl font-bold">iKHWEZI</h1>
        </div>
      </div>
      <div className="pt-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Premium UI Ready!</h2>
        <p className="text-gray-300">Loading components...</p>
      </div>
    </div>
  )
}
