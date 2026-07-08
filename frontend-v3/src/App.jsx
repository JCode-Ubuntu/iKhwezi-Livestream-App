import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Feed from './components/Feed'
import AdminLivestream from './admin/AdminLivestream'
import './index.css'

function App() {
  const [isAdmin, setIsAdmin] = useState(false)

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/admin" element={<AdminLivestream />} />
        <Route path="/admin/livestream" element={<AdminLivestream />} />
      </Routes>
    </Router>
  )
}

export default App
