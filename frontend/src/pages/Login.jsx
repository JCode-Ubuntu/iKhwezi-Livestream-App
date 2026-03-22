import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState('email');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const credentials = {
      password: formData.password,
      ...(mode === 'email' ? { email: formData.email } : { phone: formData.phone }),
    };

    const result = await login(credentials);
    setLoading(false);

    if (result.success) {
      navigate('/');
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      paddingBottom: 100,
      overflow: 'auto',
    }}>
      <button
        onClick={() => navigate('/')}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          marginBottom: 24,
        }}
      >
        <ArrowLeft size={20} />
      </button>

      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #6F4FFF, #FFB800)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 10px 40px rgba(111, 79, 255, 0.4)',
        }}>
          <Sparkles size={36} color="white" />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Welcome Back</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Sign in to continue to iKHWEZI</p>
      </div>

      <div style={{
        display: 'flex',
        background: 'var(--bg-elevated)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 24,
      }}>
        <button
          onClick={() => setMode('email')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 8,
            background: mode === 'email' ? 'linear-gradient(135deg, #6F4FFF, #4A2FCC)' : 'transparent',
            color: mode === 'email' ? 'white' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 14,
            transition: 'all 0.3s ease',
          }}
        >
          <Mail size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Email
        </button>
        <button
          onClick={() => setMode('phone')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 8,
            background: mode === 'phone' ? 'linear-gradient(135deg, #6F4FFF, #4A2FCC)' : 'transparent',
            color: mode === 'phone' ? 'white' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 14,
            transition: 'all 0.3s ease',
          }}
        >
          <Phone size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
          Phone
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mode === 'email' ? (
          <div style={{ position: 'relative' }}>
            <Mail size={20} color="var(--text-muted)" style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
            }} />
            <input
              type="email"
              placeholder="Email address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              style={{ paddingLeft: 48 }}
              required
            />
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <Phone size={20} color="var(--text-muted)" style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
            }} />
            <input
              type="tel"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              style={{ paddingLeft: 48 }}
              required
            />
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <Lock size={20} color="var(--text-muted)" style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
          }} />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="input"
            style={{ paddingLeft: 48, paddingRight: 48 }}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{
            width: '100%',
            height: 52,
            fontSize: 16,
            marginTop: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div style={{
        marginTop: 32,
        textAlign: 'center',
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--violet-light)', fontWeight: 600 }}>
            Sign up
          </Link>
        </p>
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        background: 'radial-gradient(ellipse at bottom, rgba(111, 79, 255, 0.15), transparent)',
        pointerEvents: 'none',
        zIndex: -1,
      }} />
    </div>
  );
}

export default Login;
