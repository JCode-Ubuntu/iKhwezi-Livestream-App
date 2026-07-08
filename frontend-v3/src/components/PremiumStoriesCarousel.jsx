import React, { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { colors, spacing, transitions } from '@/design-system'

/**
 * Premium Stories Carousel Component
 * 
 * Features:
 * - Smooth swipe/scroll navigation
 * - View indicator progress bars
 * - Story viewing history
 * - Add story button (+ button)
 * - Premium animations
 */

const PremiumStoriesCarousel = ({ stories = [] }) => {
  const scrollContainerRef = useRef(null)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(stories.length > 4)

  const checkScroll = () => {
    if (!scrollContainerRef.current) return

    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
    setScrollPosition(scrollLeft)
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }

  const scroll = (direction) => {
    if (!scrollContainerRef.current) return

    const scrollAmount = 300
    const newPosition = direction === 'left' 
      ? scrollContainerRef.current.scrollLeft - scrollAmount
      : scrollContainerRef.current.scrollLeft + scrollAmount

    scrollContainerRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth',
    })
  }

  // Default stories if none provided
  const defaultStories = [
    { id: 1, name: 'Your Story', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user', image: null, isYourStory: true },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: i + 2,
      name: `Creator ${i + 1}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=creator${i}`,
      image: `https://images.unsplash.com/photo-${1600000000000 + i * 100000}?w=500&h=900&fit=crop`,
      hasViewed: i % 3 === 0,
    })),
  ]

  const storiesToDisplay = stories.length > 0 ? stories : defaultStories

  return (
    <div
      style={{
        marginBottom: spacing.xl,
        position: 'relative',
      }}
    >
      {/* Stories Container */}
      <div
        style={{
          display: 'flex',
          gap: spacing.md,
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          paddingLeft: spacing.lg,
          paddingRight: spacing.lg,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        ref={scrollContainerRef}
        onScroll={checkScroll}
        onTouchEnd={checkScroll}
      >
        {storiesToDisplay.map((story, idx) => (
          <button
            key={story.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing.sm,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {/* Story Avatar Circle */}
            <div
              style={{
                position: 'relative',
                width: '80px',
                height: '80px',
                transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {/* Gradient Ring (viewed = normal, unviewed = gradient) */}
              <div
                style={{
                  position: 'absolute',
                  inset: '-3px',
                  borderRadius: '50%',
                  background: story.hasViewed
                    ? colors.neutral[700]
                    : `conic-gradient(${colors.primary[500]}, ${colors.accent[500]}, ${colors.primary[500]})`,
                  padding: '3px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: colors.dark.surface.primary,
                    padding: '3px',
                  }}
                >
                  {/* Avatar Image */}
                  <img
                    src={story.avatar}
                    alt={story.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              </div>

              {/* Add Story Button */}
              {story.isYourStory && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: colors.primary[500],
                    border: `3px solid ${colors.dark.surface.primary}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.dark.text.primary,
                    fontWeight: 700,
                    fontSize: '1.2rem',
                  }}
                >
                  +
                </div>
              )}
            </div>

            {/* Story Name */}
            <span
              style={{
                fontSize: '0.8rem',
                color: colors.dark.text.secondary,
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {story.name}
            </span>
          </button>
        ))}
      </div>

      {/* Scroll Buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            background: `linear-gradient(90deg, ${colors.dark.surface.primary} 0%, transparent 100%)`,
            border: 'none',
            color: colors.dark.text.primary,
            cursor: 'pointer',
            padding: `${spacing.lg} ${spacing.md}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.primary[500]
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.dark.text.primary
          }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            background: `linear-gradient(270deg, ${colors.dark.surface.primary} 0%, transparent 100%)`,
            border: 'none',
            color: colors.dark.text.primary,
            cursor: 'pointer',
            padding: `${spacing.lg} ${spacing.md}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            transition: `all ${transitions.duration.fast} ${transitions.easing.out}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.primary[500]
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.dark.text.primary
          }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Hide scrollbar */}
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}

export default PremiumStoriesCarousel
