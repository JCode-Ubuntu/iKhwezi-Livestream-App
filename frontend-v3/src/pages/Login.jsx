import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { colors, spacing, transitions } from '@/design-system'

export default function Login({ onAuth }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/v3/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onAuth?.(data.user, data.token)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.dark.bg.primary,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['2xl'],
    }}>
      {/* Logo */}
      <div style={{ marginBottom: spacing['3xl'], textAlign: 'center' }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          background: `linear-gradient(135deg, ${colors.primary[400]}, ${colors.accent[400]})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
          letterSpacing: '-0.02em',
        }}>
          iKHWEZI
        </h1>
        <p style={{ color: colors.dark.text.tertiary, margin: `${spacing.sm} 0 0 0`, fontSize: '0.9rem' }}>
          Sign in to your account
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: colors.dark.surface.secondary,
        borderRadius: '1.25rem',
        border: `1px solid ${colors.neutral[800]}`,
        padding: spacing['2xl'],
        boxShadow: `0 20px 60px rgba(0,0,0,0.5)`,
      }}>
        {error && (
          <div style={{
            background: `${colors.error[950]}`,
            border: `1px solid ${colors.error[800]}`,
            borderRadius: '0.75rem',
            padding: `${spacing.md} ${spacing.lg}`,
            marginBottom: spacing.lg,
            color: colors.error[400],
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <div>
            <label style={{ display: 'block', color: colors.dark.text.secondary, fontSize: '0.875rem', fontWeight: 500, marginBottom: spacing.xs }}>
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              required
              style={{
                width: '100%',
                background: colors.dark.bg.tertiary,
                border: `1px solid ${colors.neutral[700]}`,
                borderRadius: '0.75rem',
                color: colors.dark.text.primary,
                padding: `${spacing.md} ${spacing.lg}`,
                fontSize: '1rem',
                outline: 'none',
                transition: `border-color ${transitions.duration.fast} ease`,
                boxSizing: 'border-box',
              }}
              placeholder="your_username"
            />
          </div>

          <div>
            <label style={{ display: 'block', color: colors.dark.text.secondary, fontSize: '0.875rem', fontWeight: 500, marginBottom: spacing.xs }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              style={{
                width: '100%',
                background: colors.dark.bg.tertiary,
                border: `1px solid ${colors.neutral[700]}`,
                borderRadius: '0.75rem',
                color: colors.dark.text.primary,
                padding: `${spacing.md} ${spacing.lg}`,
                fontSize: '1rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: `${spacing.lg} ${spacing.xl}`,
              background: loading
                ? colors.neutral[700]
                : `linear-gradient(135deg, ${colors.primary[500]}, ${colors.accent[500]})`,
              border: 'none',
              borderRadius: '0.75rem',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: `all ${transitions.duration.normal} ease`,
              letterSpacing: '0.02em',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: spacing.xl,
          textAlign: 'center',
          color: colors.dark.text.tertiary,
          fontSize: '0.875rem',
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: colors.primary[400], textDecoration: 'none', fontWeight: 600 }}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
