# Visual Reference - Like Button Implementation

## Gallery Card with Like Button

### Desktop View - Unhovered State
```
┌────────────────────────────────────┐
│                                    │
│         Character Image            │
│                                    │
│                                    │
│                                    │
│                               ◯    │  ← Like button (purple gradient)
│                              ♡     │     44px × 44px
│                                    │     opacity: 0.9
└────────────────────────────────────┘
```

### Desktop View - Hovered State
```
┌────────────────────────────────────┐
│                                    │
│         Character Image            │
│         (darkened overlay)         │
│                                    │
│      Character Name                │
│                                    │
│                                ◯   │  ← Like button (purple gradient)
│                               ♡    │     Scaled 110%
│                                    │     opacity: 1.0
└────────────────────────────────────┘     shadow: enhanced
```

### Desktop View - Liked State
```
┌────────────────────────────────────┐
│                                    │
│         Character Image            │
│                                    │
│                                    │
│                                    │
│                               ◯    │  ← Like button (pink gradient)
│                              ♥     │     Filled heart
│                                    │     Heart beat animation
└────────────────────────────────────┘
```

### Mobile View - Double Tap Feedback
```
┌────────────────────────┐
│                        │
│   Character Image      │
│                        │
│         ♥              │  ← Large heart (60px)
│     (pulsing)          │     Scales: 0 → 1.2 → 0.8
│                        │     Fades: 0 → 1 → 0
│                        │     Duration: 0.6s
│                   ◯    │
│                  ♥     │  ← Like button updates
└────────────────────────┘
```

## Character Profile - Favorite Button

### Profile Header Layout
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ╭─╮        123 Images    45 Videos   678 Messages │
│   │ │         (Stats Row)                           │
│   ╰─╯                                                │
│  Avatar                                              │
│                                                      │
│  Character Name                                      │
│  Short bio text goes here...                        │
│                                                      │
│  ┌──────────────────┐  ┌────┐  ┌────┐             │
│  │ Start Chat       │  │ ☆  │  │ ↗  │             │
│  │ (with chat icon) │  │    │  │    │             │
│  └──────────────────┘  └────┘  └────┘             │
│   Primary CTA         Favorite  Share               │
│                       Button    Button               │
└──────────────────────────────────────────────────────┘
```

### Favorite Button States

#### Not Favorited
```
┌────┐
│ ☆  │  ← Empty star
└────┘     Transparent background
           Gray border (1px)
           Size: 44px × 44px
```

#### Favorited
```
┌────┐
│ ★  │  ← Filled star (golden #FFD700)
└────┘     Golden gradient background
           Golden border
           Pulsing animation (0.5s)
```

## Color Palette

### Like Button
- **Unhovered**: Linear gradient
  - From: rgba(130, 64, 255, 0.95) `#8240FF`
  - To: rgba(210, 184, 255, 0.95) `#D2B8FF`
  - Shadow: rgba(130, 64, 255, 0.4)

- **Liked**: Linear gradient
  - From: #ff006e
  - To: #ff4d9d
  - Shadow: rgba(255, 0, 110, 0.4)

### Favorite Button
- **Not Favorited**:
  - Background: Transparent
  - Border: var(--ig-border) `#262626`
  - Icon: var(--ig-text) `#fafafa`

- **Favorited**:
  - Background: Linear gradient
    - From: rgba(255, 215, 0, 0.15)
    - To: rgba(255, 193, 7, 0.15)
  - Border: #FFD700
  - Icon: #FFD700

## Animations

### Heart Beat (Like Action)
```
Timeline (0.3s):
0%   → scale(1)
25%  → scale(1.3)  ← Peak
50%  → scale(1.1)
75%  → scale(1.25)
100% → scale(1)
```

### Star Pulse (Favorite Action)
```
Timeline (0.5s):
0%   → scale(1)
50%  → scale(1.2)  ← Peak
100% → scale(1)
```

### Double Tap Heart
```
Timeline (0.6s):
0%   → scale(0), opacity(0)
50%  → scale(1.2), opacity(1)  ← Peak
100% → scale(0.8), opacity(0)
```

### Hover Scale
```
Timeline (0.3s):
Default → scale(1), shadow(4px 12px)
Hover   → scale(1.1), shadow(6px 16px)
```

## Responsive Breakpoints

```
Mobile Small     Mobile Medium    Tablet          Desktop
(<480px)        (481-768px)      (769-1024px)    (>1024px)
┌─────┐         ┌─────┐          ┌─────┐         ┌─────┐
│  ◯  │         │  ◯  │          │  ◯  │         │  ◯  │
│ ♡   │         │ ♡   │          │ ♡   │         │ ♡   │
└─────┘         └─────┘          └─────┘         └─────┘
40px            40px             44px            44px
Always          Always           Hover           Enhanced
visible         visible          effects         hover
```

## User Flow

### Desktop - Like from Gallery
```
1. User sees gallery
   ↓
2. Hovers over character card
   ↓
3. Like button highlights (purple, scaled)
   ↓
4. Clicks like button
   ↓
5. Button turns pink, heart fills
   ↓
6. Heart beat animation plays
   ↓
7. Success notification shows
   ↓
8. State persists
```

### Mobile - Double Tap Like
```
1. User sees gallery
   ↓
2. Taps character card
   (< 300ms later)
   ↓
3. Taps character card again
   ↓
4. Large heart appears in center
   ↓
5. Heart animates (scale & fade)
   ↓
6. Like button turns pink
   ↓
7. Character is liked
   ↓
8. Navigation is prevented
```

### Profile - Add to Favorites
```
1. User opens character profile
   ↓
2. Sees star button (empty)
   ↓
3. Clicks star button
   ↓
4. Button turns golden
   ↓
5. Star fills with pulse animation
   ↓
6. Success notification
   ↓
7. Gallery like button syncs
```

## Technical Details

### Z-Index Layering
```
Base Image:      z-index: 1
Hover Overlay:   z-index: 10
Top Badges:      z-index: 10
Like Button:     z-index: 15
Loading Spinner: z-index: 20
Double-tap Heart: z-index: 100
```

### Event Flow
```
User Action
    ↓
Button Click Handler
    ↓
Stop Propagation (prevent card navigation)
    ↓
Check Login Status
    ↓
Optimistic UI Update
    ↓
API Call (Favorites.toggleFavorite)
    ↓
Server Response
    ↓
Update UI (confirm/rollback)
    ↓
Show Notification
```

### Cache Strategy
```
Page Load
    ↓
Get visible character IDs
    ↓
Check Favorites.favoriteCache
    ↓
Missing IDs → API Call (checkMultipleFavorites)
    ↓
Update cache
    ↓
Update all button states
```

## Accessibility

### Keyboard Navigation
```
Tab Order:
1. Character card (if focusable)
2. Like button
3. Next character card
4. Next like button
...

Focus State:
┌────┐
│ ♡  │  ← 2px purple outline
└────┘     2px offset
           Visible on :focus
```

### Screen Reader Announcements
```
Not Liked:
"Button, Add to favorites"

Liked:
"Button, Remove from favorites, pressed"

After Click:
"Character added to favorites" (success)
or
"Character removed from favorites" (success)
```

### Touch Targets (WCAG 2.1 AA)
```
Minimum: 44px × 44px (desktop)
         40px × 40px (mobile)
         
Spacing: 8px gap between buttons
         
Result: Easy to tap without errors
```
