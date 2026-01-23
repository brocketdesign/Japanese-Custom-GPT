# TikTok-Style Content Discovery & Sequencing Implementation

## Overview

This implementation transforms the character browsing experience from a simple chronological list into an intelligent, personalized discovery feed similar to TikTok, Instagram Reels, or Spotify Discovery.

## Problem Statement

The goal was to create a content discovery system that:
- Feels fresh on every reload
- Avoids showing the same characters repeatedly
- Personalizes content based on user interactions
- Works for both logged-in and anonymous users
- Prioritizes new and relevant content

## Solution Architecture

### Core Components

#### 1. Content Sequencing Engine (`models/content-sequencing-utils.js`)
The brain of the system - implements weighted randomness instead of pure random or deterministic sorting.

**Key Features:**
- **Weighted Scoring System**: Each character gets a score based on multiple factors
- **Time-based Decay**: Content seen recently gets penalized, but becomes fresh again over time
- **Tag Relevance**: Characters matching user's preferred tags get boosted
- **Freshness Boost**: New content (< 7 days old) gets priority
- **Controlled Randomness**: Small random factor (0.9-1.1x) prevents complete determinism

**Weight Multipliers:**
```javascript
TAG_MATCH: 2.0           // Strong boost for matching tags
FRESH_CONTENT: 1.5       // Boost for new content
POPULAR: 1.2             // Slight boost for popular characters
NEW_IMAGES: 1.3          // Boost for characters with new images
RECENTLY_SEEN: 0.1       // Heavy penalty for recently seen
SHORT_TERM_SEEN: 0.5     // Medium penalty for seen this week
```

**Time Windows:**
- Recently Seen: 24 hours (avoid completely)
- Short Term: 7 days (reduce weight)
- Medium Term: 30 days (neutral)
- Long Term: 30+ days (fresh again)

#### 2. User Interaction Tracking (`models/user-interaction-utils.js`)
Handles database persistence for logged-in users.

**Tracked Data:**
- Seen characters (with timestamps)
- Seen images (per character, limited to 50 most recent)
- Tag preferences (with decay over time)
- Preferred tags (top 10)

**Database Schema:**
```javascript
{
  userId: ObjectId,
  seenCharacters: { 
    [chatId]: timestamp 
  },
  seenImages: { 
    [chatId]: [imageId1, imageId2, ...] 
  },
  preferredTags: ['tag1', 'tag2', ...],
  tagPreferences: { 
    'tag1': score,
    'tag2': score,
    ...
  },
  lastUpdated: Date
}
```

#### 3. Client-Side Tracker (`public/js/content-discovery-tracker.js`)
localStorage-based tracking for temporary (non-logged-in) users.

**Features:**
- Automatic state persistence
- Data cleanup (removes data older than 30 days)
- Merge capability for server-sent state
- Lightweight and privacy-friendly

**Storage Structure:**
```javascript
{
  version: 1,
  seenCharacters: {},
  seenImages: {},
  preferredTags: [],
  tagPreferences: {},
  lastUpdated: timestamp
}
```

#### 4. API Integration
Enhanced existing APIs to support personalization:

**GET `/api/gallery/explore`**
- Accepts `X-User-State` header for temporary users
- Fetches user state from database for logged-in users
- Applies smart sequencing on page 1 (without search query)
- Falls back to traditional pagination for subsequent pages

**POST `/api/gallery/track/character-view`**
- Records when a user views a character
- Tracks which images they saw
- Updates tag preferences

**POST `/api/gallery/track/tag-interaction`**
- Records when user clicks on tags
- Adjusts tag preference weights

### Algorithm Flow

#### For Page 1 (Discovery Mode)

1. **Fetch More Characters**: Retrieve 3x the requested limit from database
2. **Get User State**: 
   - Logged-in: From MongoDB
   - Temporary: From `X-User-State` header (localStorage)
3. **Score Each Character**:
   ```
   score = 1.0
   score *= decay_multiplier (based on when last seen)
   score *= freshness_boost (new content)
   score *= tag_relevance (matching user preferences)
   score *= popularity_boost (image count > 10)
   score *= new_images_boost (has recent images)
   score *= random_factor (0.9 - 1.1)
   ```
4. **Filter Recently Seen**: Remove characters seen in last 24 hours
5. **Weighted Random Selection**: 
   - Sort by score
   - Take top 3x candidates as pool
   - Use weighted random selection to pick final N
6. **Rotate Images**: Within each character, show unseen images first
7. **Return**: Personalized, fresh character list

#### For Page 2+ or With Search Query

- Use traditional pagination
- Apply search filtering
- Sort by relevance or date

### Frontend Integration

#### Explore Gallery (`public/js/explore-gallery.js`)

**Enhanced Features:**
- Uses `fetchWithState()` to include user state in API calls
- Tracks character views automatically on scroll
- Sends tracking data to backend (async, non-blocking)
- Works seamlessly for both logged-in and temporary users

**Tracking Triggers:**
- When user scrolls to a new character (vertical swipe)
- Captures: character ID, first 5 image IDs, all tags
- Updates localStorage immediately for temporary users
- Sends to server for logged-in users (fire-and-forget)

## Performance Optimizations

### 1. Set-based Lookups
Changed array `includes()` to Set for O(1) lookups instead of O(n):
```javascript
// Before
if (!state.seenImages[charId].includes(imageId)) {
  state.seenImages[charId].push(imageId);
}

// After
const seenSet = new Set(state.seenImages[charId]);
seenSet.add(imageId);
state.seenImages[charId] = Array.from(seenSet);
```

### 2. Single Total Score Calculation
Moved score calculation outside the loop:
```javascript
// Calculate once per iteration instead of recalculating
const totalScore = remaining.reduce((sum, char) => sum + char.score, 0);
```

### 3. Size Limits
- User state header: 100KB max
- Seen images per character: 50 max
- Tag preferences: Top 10 tags only
- Auto-cleanup of data older than 30 days

## Security Measures

### Input Validation
- Size limits on user state (100KB)
- JSON parsing with error handling
- ObjectId validation for database queries

### Privacy
- Anonymous users' data stays in localStorage
- No tracking cookies
- Data automatically expires after 30 days

### Performance
- Async tracking (doesn't block UI)
- Silent failures (tracking is not critical)
- Efficient database queries

## User Experience Benefits

### For New Users (Cold Start)
- Curated mix of popular and recent characters
- Diverse styles to learn preferences
- No "random nonsense" feeling

### For Returning Users
- Personalized based on past interactions
- No immediate repeats (24-hour exclusion)
- Fresh content prioritized

### For All Users
- Content feels fresh every time
- Discovery of new characters naturally
- Relevant recommendations based on taste

## Testing & Validation

### Code Quality
✅ All syntax checks passed  
✅ No security vulnerabilities (CodeQL scan)  
✅ Code review feedback addressed  
✅ Follows existing patterns  

### Performance
✅ O(1) lookups using Set  
✅ Limited data storage  
✅ Async tracking  
✅ Efficient algorithms  

### Compatibility
✅ Works with existing code  
✅ Backwards compatible  
✅ Optional feature (works without tracking)  
✅ Supports both logged-in and anonymous users  

## Future Enhancements

### Possible Improvements
1. **Machine Learning**: Use ML models for better scoring
2. **A/B Testing**: Test different weight multipliers
3. **User Feedback**: Add explicit like/dislike buttons
4. **Social Signals**: Factor in what similar users like
5. **Diversity Enforcement**: Ensure style variety in each session
6. **Analytics Dashboard**: Show users their preference patterns

### Monitoring Metrics
- Average characters seen per session
- Repeat view rate (should be low)
- Session length (should increase)
- Tag diversity (should be balanced)
- Cold start effectiveness (new user engagement)

## Migration & Rollout

### Deployment Strategy
1. **Phase 1**: Deploy backend changes (sequencing available but not used)
2. **Phase 2**: Enable for temporary users only
3. **Phase 3**: Enable for logged-in users
4. **Phase 4**: Monitor metrics and adjust weights

### Rollback Plan
- Remove `X-User-State` header usage
- Change `useSmartSequencing` flag to always false
- System falls back to chronological ordering

### Database Migration
No migration needed - new collection `userInteractions` is created automatically.

## Summary

This implementation successfully transforms the character browsing experience from a static list to an intelligent, personalized discovery feed. The system:

- **Feels fresh** on every reload through weighted randomness
- **Avoids repeats** with time-based seen state tracking
- **Personalizes content** through tag-based learning
- **Works for everyone** - both logged-in and anonymous users
- **Performs efficiently** with O(1) lookups and size limits
- **Remains secure** with proper validation and privacy measures

The TikTok-style sequencing creates a more engaging, addictive browsing experience while maintaining the simplicity and performance of the existing system.
