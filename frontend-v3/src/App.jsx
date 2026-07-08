import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Feed from './components/Feed'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminLivestream from './admin/AdminLivestream'
import './index.css'

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {}
    }
    setAuthChecked(true)
  }, [])

  const handleAuth = (u, t) => {
    setUser(u)
    setToken(t)
  }

  const handleLogout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  if (!authChecked) return null

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Feed user={user} token={token} onLogout={handleLogout} />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login onAuth={handleAuth} />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register onAuth={handleAuth} />} />
        <Route path="/admin" element={<AdminLivestream />} />
        <Route path="/admin/livestream" element={<AdminLivestream />} />
      </Routes>
    </Router>
  )
}

export default App
