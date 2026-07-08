import React from 'react'
import { Home, Compass, Plus, Heart, User } from 'lucide-react'
import { colors, spacing, transitions } from '@/design-system'

/**
 * Premium Bottom Navigation Component
 * 
 * Features:
 * - Smooth active state transitions
 * - Icon scaling and color animations
 * - FAB (Floating Action Button) for creating content
 * - Mobile-optimized with safe area support
 */

const PremiumBottomNav = ({ activeRoute = 'home', onNavigate = () => {} }) => {
  const navItems = [
    { id: 'home', icon: Home, label: 'Home', route: '/' },
    { id: 'discover', icon: Compass, label: 'Discover', route: '/discover' },
    { id: 'create', icon: Plus, label: 'Create', route: '/create', isFab: true },
    { id: 'notifications', icon: Heart, label: 'Likes', route: '/likes' },
    { id: 'profile', icon: User, label: 'Profile', route: '/profile' },
  ]

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: colors.dark.surface.primary,
        borderTop: `1px solid ${colors.neutral[800]}`,
        backdropFilter: 'blur(20px)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: '70px',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          paddingTop: spacing.md,
        }}
      >
        {navItems.map((item) => {
          const isActive = activeRoute === item.id
          const Icon = item.icon

          if (item.isFab) {
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: colors.gradients.premium,
                  border: 'none',
                  color: colors.dark.text.primary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 24px rgba(147, 102, 240, 0.3)`,
                  transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
                  transform: 'translateY(-28px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-36px) scale(1.1)'
                  e.currentTarget.style.boxShadow = `0 12px 32px rgba(147, 102, 240, 0.4)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(-28px) scale(1)'
                  e.currentTarget.style.boxShadow = `0 8px 24px rgba(147, 102, 240, 0.3)`
                }}
              >
                <Icon size={24} strokeWidth={2.5} />
              </button>
            )
          }

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                background: 'transparent',
                border: 'none',
                color: isActive ? colors.primary[500] : colors.dark.text.secondary,
                cursor: 'pointer',
                padding: spacing.md,
                transition: `all ${transitions.duration.normal} ${transitions.easing.out}`,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = colors.primary[400]
                  e.currentTarget.style.transform = 'scale(1.05)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = colors.dark.text.secondary
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              <Icon
                size={24}
                strokeWidth={isActive ? 2.5 : 2}
                style={{
                  transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
                }}
              />
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: colors.primary[500],
                    animation: `appear ${transitions.duration.fast} ${transitions.easing.out}`,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes appear {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </nav>
  )
}

export default PremiumBottomNav
