# IKHWEZI Premium Components Library

Complete documentation for all premium UI components built with the IKHWEZI design system.

## Core Components

### Button

Premium button component with multiple variants and micro-interactions.

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md', heights: 40px, 48px, 56px)
- `disabled`: boolean (default: false)
- `loading`: boolean (default: false) - shows loading spinner
- `icon`: React.Component - icon to display
- `iconPosition`: 'left' | 'right' (default: 'left')
- `fullWidth`: boolean (default: false)
- `onClick`: function

**Usage:**
```jsx
import { Button } from '@/components'
import { Heart } from 'lucide-react'

<Button variant="primary" size="md" icon={Heart}>
  Like
</Button>

<Button variant="danger" loading={isLoading}>
  Delete
</Button>
```

**Variants:**
- **primary**: Purple gradient with elevation shadow, hover lifts up
- **secondary**: Solid purple background with light shadow
- **outline**: Transparent with purple border, hover fills background
- **ghost**: Transparent text, hover shows subtle background
- **danger**: Red background for destructive actions

---

### Card

Flexible card component with multiple variants and composed sub-components.

**Props:**
- `variant`: 'elevated' | 'outlined' | 'filled' | 'glass' (default: 'elevated')
- `elevation`: 'xs' | 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
- `interactive`: boolean (default: false) - enables click handling
- `hoverable`: boolean (default: true) - enables hover animations
- `gradient`: string (default: null) - custom gradient background
- `onClick`: function

**Sub-components:**
- `Card.Header` - Header section with optional icon and action
- `Card.Body` - Main content area
- `Card.Footer` - Footer section with action buttons

**Usage:**
```jsx
import { Card, Button } from '@/components'
import { Settings } from 'lucide-react'

<Card variant="elevated" interactive hoverable>
  <Card.Header icon={Settings} action={<Button size="sm">Edit</Button>}>
    Settings
  </Card.Header>
  <Card.Body>
    Card content goes here
  </Card.Body>
  <Card.Footer>
    <Button>Save</Button>
  </Card.Footer>
</Card>
```

**Variants:**
- **elevated**: Solid background with drop shadow, lifts on hover
- **outlined**: Transparent with colored border
- **filled**: Solid background without shadow
- **glass**: Blurred frosted glass effect with backdrop filter

---

### Avatar

User profile picture component with indicators and fallbacks.

**Props:**
- `src`: string - image URL
- `alt`: string - alt text for image
- `initials`: string - fallback initials if image fails
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' (default: 'md')
- `online`: boolean (default: false) - shows green online indicator
- `verified`: boolean (default: false) - shows verified checkmark badge
- `status`: 'online' | 'offline' | 'away' | 'dnd' (default: null)
- `badge`: React.Component (default: null) - custom badge element
- `onClick`: function

**Usage:**
```jsx
import { Avatar, AvatarGroup } from '@/components'

<Avatar 
  src="https://example.com/avatar.jpg"
  alt="John Doe"
  size="md"
  verified
  online
/>

// Avatar Group (overlapping multiple avatars)
<AvatarGroup 
  avatars={[
    { src: 'url1', alt: 'User 1', verified: true },
    { src: 'url2', alt: 'User 2' },
    { src: 'url3', alt: 'User 3' },
  ]}
  maxDisplay={3}
  size="md"
/>
```

**Sizes:**
- xs: 32px | sm: 40px | md: 48px | lg: 64px | xl: 80px | 2xl: 96px

---

### Badge

Small label component for statuses, tags, and indicators.

**Props:**
- `variant`: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'verified' | 'live' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `shape`: 'pill' | 'square' | 'dot' (default: 'pill')
- `icon`: React.Component - icon to display
- `animated`: boolean (default: false) - enables animation

**Usage:**
```jsx
import { Badge } from '@/components'
import { Zap } from 'lucide-react'

<Badge variant="success">Active</Badge>
<Badge variant="live" animated icon={Zap}>LIVE</Badge>
<Badge shape="dot" />
```

**Variants:**
- **primary**: Purple background
- **success**: Green for success/positive states
- **warning**: Orange for warnings and cautions
- **error**: Red for errors and destructive states
- **info**: Blue for information
- **verified**: Blue checkmark badge
- **live**: Red pulsing animation

---

### Input

Text input component with icons, validation, and helpers.

**Props:**
- `type`: string (default: 'text') - HTML input type
- `placeholder`: string
- `value`: string
- `onChange`: function
- `onFocus`: function
- `onBlur`: function
- `disabled`: boolean (default: false)
- `error`: boolean (default: false)
- `errorMessage`: string - error text to display
- `helperText`: string - helper/hint text
- `label`: string - input label
- `icon`: React.Component
- `iconPosition`: 'left' | 'right' (default: 'left')
- `maxLength`: number (default: null)
- `showCounter`: boolean (default: false) - shows character count
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `variant`: 'outlined' | 'filled' | 'flush' (default: 'outlined')

**Usage:**
```jsx
import { Input } from '@/components'
import { Search, AlertCircle } from 'lucide-react'

<Input
  label="Search posts"
  placeholder="Type to search..."
  icon={Search}
  iconPosition="left"
/>

<Input
  type="email"
  label="Email"
  placeholder="your@email.com"
  error={hasError}
  errorMessage="Invalid email address"
/>

<Input
  type="textarea"
  label="Bio"
  placeholder="Tell us about yourself"
  maxLength={160}
  showCounter
/>
```

**Variants:**
- **outlined**: Border with background, focuses to purple
- **filled**: Bottom border only, Material Design style
- **flush**: No visible border, minimal style

---

## Loading Components

### LoadingSkeletons

Set of skeleton loading components with shimmer animation for better perceived performance.

**Components:**

#### SkeletonText
Single line placeholder text
```jsx
<SkeletonText width="100%" height="1rem" />
```

#### SkeletonParagraph
Multiple lines of text
```jsx
<SkeletonParagraph lines={3} />
```

#### SkeletonAvatar
Circular avatar placeholder
```jsx
<SkeletonAvatar size="md" />
```

#### SkeletonCard
Full card skeleton with header, content, footer
```jsx
<SkeletonCard />
```

#### SkeletonImage
Image placeholder
```jsx
<SkeletonImage width="100%" height="250px" />
```

#### SkeletonPostCard
Feed post card skeleton (includes avatar, image, text)
```jsx
<SkeletonPostCard />
```

#### SkeletonFeed
Multiple post skeletons for feed loading state
```jsx
<SkeletonFeed count={3} />
```

---

## Usage Patterns

### Loading State Pattern
```jsx
import { SkeletonFeed } from '@/components/LoadingSkeletons'
import { Feed } from '@/components'

export function FeedPage() {
  const [isLoading, setIsLoading] = React.useState(true)
  const [posts, setPosts] = React.useState([])

  if (isLoading) {
    return <SkeletonFeed count={3} />
  }

  return <Feed posts={posts} />
}
```

### Composed Card Pattern
```jsx
<Card variant="glass" elevation="lg">
  <Card.Header icon={Trophy}>
    Your Achievement
  </Card.Header>
  <Card.Body>
    <p>Congratulations on your first 100 likes!</p>
  </Card.Body>
  <Card.Footer>
    <Button variant="primary">View Profile</Button>
  </Card.Footer>
</Card>
```

### Interactive Button Pattern
```jsx
const [isLoading, setIsLoading] = React.useState(false)

const handleSubmit = async () => {
  setIsLoading(true)
  try {
    await submitForm()
  } finally {
    setIsLoading(false)
  }
}

<Button 
  variant="primary" 
  loading={isLoading}
  onClick={handleSubmit}
>
  Submit
</Button>
```

---

## Design Principles

All components follow these principles:

1. **Accessibility**: WCAG AAA compliant with high contrast
2. **Performance**: 60+ FPS animations using GPU acceleration
3. **Consistency**: Unified spacing, typography, and motion
4. **Responsiveness**: Mobile-first design with responsive sizes
5. **Composability**: Components work together seamlessly
6. **Customization**: Props for all common variations
7. **Delight**: Micro-interactions that feel intentional

---

## Animation Guidelines

All components use the motion system from the design system:

- **Fast interactions**: 150ms (button clicks, hovers)
- **Normal transitions**: 200-250ms (modal appearances)
- **Slower transitions**: 300-400ms (entrance animations)
- **Easing**: iOS-style easing for natural feel

---

## Color Integration

All components automatically use the design system colors:

- Primary: Purple gradient (#9366f0 → #ff6b9d)
- Semantic: Success, Warning, Error, Info
- Neutral: 11-step grayscale
- Dark/Light modes supported

---

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

**Note:** Backdrop filter (glass variant) requires modern browser support.

---

## Contributing

When adding new components:

1. Use design system tokens (colors, spacing, typography, motion)
2. Ensure WCAG AAA accessibility compliance
3. Add prop documentation
4. Include usage examples
5. Test on mobile devices
6. Verify 60 FPS performance
7. Update this documentation

---

**Version**: 1.0.0  
**Last Updated**: 2026-07-08
