import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ModernSplash from './components/ModernSplash'
import './index.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ModernSplash />} />
        <Route path="/login" element={<div className="min-h-screen flex items-center justify-center bg-slate-900"><h1 className="text-4xl text-white">Login Page (Coming Soon)</h1></div>} />
        <Route path="/register" element={<div className="min-h-screen flex items-center justify-center bg-slate-900"><h1 className="text-4xl text-white">Register Page (Coming Soon)</h1></div>} />
      </Routes>
    </Router>
  )
}

export default App
