# Content Discovery Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
│                  (Views character in explore feed)               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
         ┌──────▼──────┐          ┌──────▼──────┐
         │  LOGGED IN  │          │  TEMPORARY  │
         │    USER     │          │    USER     │
         └──────┬──────┘          └──────┬──────┘
                │                        │
                │                        │
         ┌──────▼──────────┐    ┌────────▼─────────┐
         │   MongoDB DB    │    │   localStorage   │
         │ userInteractions│    │  discovery_state │
         └──────┬──────────┘    └────────┬─────────┘
                │                        │
                └────────────┬───────────┘
                             │
                    ┌────────▼─────────┐
                    │  User State      │
                    │  - seenChars     │
                    │  - seenImages    │
                    │  - preferredTags │
                    └────────┬─────────┘
                             │
┌────────────────────────────▼───────────────────────────────────┐
│                    SEQUENCING ALGORITHM                         │
│                                                                 │
│  1. Fetch 3x characters from database                          │
│  2. Score each character:                                      │
│     ┌─────────────────────────────────────────────────────┐   │
│     │ Base Score = 1.0                                     │   │
│     │ × Time Decay (0.1 if seen <24h, 1.0 if >30 days)   │   │
│     │ × Freshness (1.5x if <7 days old)                  │   │
│     │ × Tag Match (2.0x for matching tags)               │   │
│     │ × Popularity (1.2x if >10 images)                  │   │
│     │ × Random Factor (0.9 - 1.1)                        │   │
│     └─────────────────────────────────────────────────────┘   │
│  3. Filter out recently seen (<24h)                            │
│  4. Weighted random selection from top candidates              │
│  5. Rotate images (unseen first)                               │
└────────────────────────────┬───────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  PERSONALIZED    │
                    │  CHARACTER FEED  │
                    └──────────────────┘
```

## Example Scoring

### Character A: Recently Seen (Yesterday)
```
Base:        1.0
Decay:       × 0.1  (seen <24h ago)
Freshness:   × 1.5  (created 5 days ago)
Tag Match:   × 2.0  (matches "cyberpunk")
Popularity:  × 1.2  (15 images)
Random:      × 0.95
─────────────────
Final Score: 0.34  ❌ Low priority
```

### Character B: Moderate Match
```
Base:        1.0
Decay:       × 1.0  (never seen)
Freshness:   × 1.0  (created 20 days ago)
Tag Match:   × 1.5  (partial tag match)
Popularity:  × 1.2  (12 images)
Random:      × 1.03
─────────────────
Final Score: 1.85  ✅ Medium priority
```

### Character C: Perfect Match
```
Base:        1.0
Decay:       × 1.0  (never seen)
Freshness:   × 1.5  (created 3 days ago)
Tag Match:   × 2.0  (strong tag match)
Popularity:  × 1.2  (20 images)
Random:      × 1.08
─────────────────
Final Score: 3.89  ⭐ High priority
```

## Data Flow

### Page Load
```
User → Search Page → content-discovery-tracker.js loads
                  → Reads localStorage
                  → Prepares user state
```

### Fetching Content
```
User scrolls → explore-gallery.js calls fetchWithState()
            → Adds X-User-State header
            → /api/gallery/explore receives request
            → Parses user state
            → Applies sequencing algorithm
            → Returns personalized characters
```

### Recording Interaction
```
User views character → explore-gallery.js.trackCharacterView()
                    → Updates localStorage (temporary users)
                    → POSTs to /api/gallery/track/character-view (logged-in)
                    → Updates MongoDB userInteractions
```

## Time-based Decay Curve

```
Penalty
  │
1.0│                                    ┌────────────
  │                                 ┌──┘
0.8│                              ┌──┘
  │                           ┌──┘
0.5│              ┌───────────┘
  │              │
0.1│──────────────┘
  │
0.0└───────┬───────┬────────┬────────┬──────────► Time
         24h      7d      30d      60d
      Recently  Short   Medium   Fresh
       Seen    Term     Term     Again
```

## Tag Learning Example

```
Session 1: Views "cyberpunk" character
  → cyberpunk: 0.5

Session 2: Views "cyberpunk" + "neon" characters
  → cyberpunk: 1.0
  → neon: 0.5

Session 3: Clicks on "futuristic" tag
  → cyberpunk: 0.95 (5% decay)
  → neon: 0.47 (5% decay)
  → futuristic: 1.0 (stronger signal from click)

Session 4: Views "fantasy" character
  → cyberpunk: 0.90 (continues decay)
  → neon: 0.45
  → futuristic: 0.95
  → fantasy: 0.5

Result: preferredTags = ['futuristic', 'cyberpunk', 'neon', 'fantasy']
        Future recommendations weighted toward these tags!
```
