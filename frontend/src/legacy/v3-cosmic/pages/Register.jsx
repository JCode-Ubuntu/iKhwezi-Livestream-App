import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Phone, Lock, User, Eye, EyeOff, ArrowLeft, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [mode, setMode] = useState('email');
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username || formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (mode === 'email' && !formData.email) {
      newErrors.email = 'Email is required';
    }
    if (mode === 'phone' && !formData.phone) {
      newErrors.phone = 'Phone is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);

    const userData = {
      username: formData.username,
      displayName: formData.displayName || formData.username,
      password: formData.password,
      ...(mode === 'email' ? { email: formData.email } : { phone: formData.phone }),
    };

    const result = await register(userData);
    setLoading(false);

    if (result.success) {
      navigate('/');
    }
  };

  const requirements = [
    { met: formData.username.length >= 3, text: 'Username at least 3 characters' },
    { met: formData.password.length >= 6, text: 'Password at least 6 characters' },
    { met: formData.password === formData.confirmPassword && formData.password.length > 0, text: 'Passwords match' },
  ];

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
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.7)',
          marginBottom: 24,
          cursor: 'pointer',
        }}
      >
        <ArrowLeft size={20} />
      </button>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Join iKHWEZI</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Create your creator account</p>
      </div>

      <div style={{
        display: 'flex',
        background: 'var(--bg-elevated)',
        borderRadius: 12,
        padding: 4,
        marginBottom: 20,
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'email' ? (
          <div>
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
            {errors.email && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.email}</p>}
          </div>
        ) : (
          <div>
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
            {errors.phone && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.phone}</p>}
          </div>
        )}

        <div>
          <div style={{ position: 'relative' }}>
            <User size={20} color="var(--text-muted)" style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
            }} />
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              className="input"
              style={{ paddingLeft: 48 }}
              required
            />
          </div>
          {errors.username && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.username}</p>}
        </div>

        <div style={{ position: 'relative' }}>
          <User size={20} color="var(--text-muted)" style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
          }} />
          <input
            type="text"
            placeholder="Display name (optional)"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            className="input"
            style={{ paddingLeft: 48 }}
          />
        </div>

        <div>
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
          {errors.password && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.password}</p>}
        </div>

        <div>
          <div style={{ position: 'relative' }}>
            <Lock size={20} color="var(--text-muted)" style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
            }} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="input"
              style={{ paddingLeft: 48 }}
              required
            />
          </div>
          {errors.confirmPassword && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{errors.confirmPassword}</p>}
        </div>

        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          padding: 14,
          marginTop: 4,
        }}>
          {requirements.map((req, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: index < requirements.length - 1 ? 8 : 0,
            }}>
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: req.met ? 'var(--success)' : 'var(--bg-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
              }}>
                {req.met && <Check size={12} color="white" />}
              </div>
              <span style={{
                fontSize: 13,
                color: req.met ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {req.text}
              </span>
            </div>
          ))}
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
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div style={{
        marginTop: 24,
        textAlign: 'center',
      }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--violet-light)', fontWeight: 600 }}>
            Sign in
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

export default Register;
