# Explore Gallery Content Sequencing & Personalization

## Overview

This document describes the enhanced content sequencing system for the Explore Gallery feature. The system ensures a diverse mix of characters while personalizing content based on user behavior.

## Key Features

### 1. Diversity-Aware Content Selection

The system ensures a balanced distribution of content across multiple dimensions:

#### Gender Distribution
| Category | Target Percentage | Description |
|----------|------------------|-------------|
| Female | 45% | Female characters |
| Male | 35% | Male characters |
| Non-binary | 15% | Non-binary, genderqueer, and other identities |
| Unknown | 5% | Characters without specified gender |

#### Content Age Distribution
| Category | Target Percentage | Time Range |
|----------|------------------|------------|
| Recent | 40% | Content from the last week |
| Middle | 35% | Content between 1 week and 3 months old |
| Old | 25% | Content older than 3 months |

#### NSFW/SFW Distribution (for users with NSFW enabled)
| Category | Target Percentage |
|----------|------------------|
| SFW | 70% |
| NSFW | 30% |

### 2. User Preference Personalization

The system analyzes user behavior to personalize content recommendations:

- **Likes Analysis**: Characters and tags from liked images are weighted heavily
- **Chat History**: Characters the user has chatted with influence recommendations
- **Favorites**: Favorited characters provide strong preference signals
- **Tag Preferences**: Tags are tracked and weighted to suggest similar content

### 3. Nightly User Preferences Analysis

A cron job runs nightly at 4:00 AM to analyze user behavior and update the preferences cache:

```
Schedule: 0 4 * * * (4:00 AM daily)
Job Name: userPreferencesAnalyzer
```

#### What Gets Analyzed
1. **Image Likes**: Weight = 2x
2. **Chat Messages**: Weight = log2(messageCount + 1), capped at 5x
3. **Favorites**: Weight = 3x

#### Analyzed Metrics
- Gender preference distribution
- Top 15 preferred character types (tags)
- NSFW preference ratio
- Total interaction count

## Architecture

### Files Modified/Created

| File | Purpose |
|------|---------|
| `models/content-sequencing-utils.js` | Core sequencing engine with diversity selection |
| `models/user-preferences-analyzer.js` | Nightly analysis cron job |
| `models/gallery-search-utils.js` | Search pipeline with diversity support |
| `models/cronManager.js` | Cron job configuration |

### Database Collections

#### `userPreferencesCache`
Stores analyzed user preferences for fast retrieval:
```javascript
{
  userId: ObjectId,
  preferredGenders: {
    female: 0.45,   // Normalized 0-1
    male: 0.35,
    nonbinary: 0.15,
    unknown: 0.05
  },
  preferredCharacterTypes: ['tag1', 'tag2', ...], // Top 15 tags
  preferredTags: { 'tag1': score, ... },
  nsfwPreference: 0.3,  // 0-1 ratio
  totalInteractions: 150,
  analyzedAt: Date
}
```

#### `systemMetadata`
Stores analysis run statistics:
```javascript
{
  type: 'userPreferencesAnalysis',
  lastRun: Date,
  stats: {
    totalUsers: 1000,
    processedCount: 950,
    skippedCount: 30,
    errorCount: 20,
    cleanedUp: 5,
    durationSeconds: 45.2
  }
}
```

## Algorithm Flow

### Page 1 (Discovery Mode)

```
1. Fetch 3x requested limit from database
   └─ Includes: gender, chatCreatedAt, images, tags

2. Get user state
   ├─ Logged-in: From MongoDB userInteractions
   └─ Temporary: From X-User-State header (localStorage)

3. Get user preferences (logged-in only)
   └─ From userPreferencesCache collection

4. Score each character
   ├─ Base score = 1.0
   ├─ × time-based decay (seen recently = penalty)
   ├─ × freshness boost (new content = 1.5x)
   ├─ × tag relevance (matching user preferences)
   ├─ × popularity boost (>10 images = 1.2x)
   ├─ × user preference boost (from nightly analysis)
   └─ × random factor (0.9 - 1.1)

5. Apply diversity selection
   ├─ Phase 1: Select by gender targets
   ├─ Phase 2: Ensure age distribution
   └─ Phase 3: Fill remaining with highest scores

6. Shuffle final selection
   └─ Prevents predictable ordering

7. Rotate images per character
   └─ Unseen images first, then oldest seen
```

### Nightly Analysis Flow

```
1. Query active users (active in last 30 days)

2. For each user (batched in groups of 50):
   ├─ Analyze image likes
   │   └─ Get gender, tags from liked characters
   ├─ Analyze chat history
   │   └─ Weight by message count
   ├─ Analyze favorites
   │   └─ High weight for favorited characters
   └─ Calculate aggregates
       ├─ Normalize gender preferences to 0-1
       ├─ Extract top 15 tags
       └─ Calculate NSFW preference ratio

3. Upsert to userPreferencesCache

4. Cleanup old entries (inactive > 90 days)

5. Log statistics
```

## Configuration

### Diversity Config (in `content-sequencing-utils.js`)

```javascript
const DIVERSITY_CONFIG = {
  gender: {
    female: 0.45,
    male: 0.35,
    nonbinary: 0.15,
    unknown: 0.05,
  },
  contentAge: {
    recent: 0.40,
    middle: 0.35,
    old: 0.25,
  },
  contentRating: {
    sfw: 0.70,
    nsfw: 0.30,
  },
};
```

### Weight Multipliers

```javascript
const WEIGHTS = {
  TAG_MATCH: 2.0,             // User's preferred tags
  FRESH_CONTENT: 1.5,         // Content < 7 days old
  POPULAR: 1.2,               // Characters with >10 images
  RECENTLY_SEEN: 0.1,         // Penalty for seen < 24h ago
  SHORT_TERM_SEEN: 0.5,       // Penalty for seen < 7 days ago
  NEW_IMAGES: 1.3,            // Characters with new images
  USER_PREFERENCE_MATCH: 1.8, // Matches analyzed preferences
};
```

### Time Constants

```javascript
const TIME_CONSTANTS = {
  RECENTLY_SEEN: 24 * 60 * 60 * 1000,      // 1 day
  SHORT_TERM: 7 * 24 * 60 * 60 * 1000,     // 1 week
  MEDIUM_TERM: 30 * 24 * 60 * 60 * 1000,   // 1 month
  FRESH_CONTENT: 7 * 24 * 60 * 60 * 1000,  // 1 week
  OLD_CONTENT: 90 * 24 * 60 * 60 * 1000,   // 3 months
  MIDDLE_CONTENT: 30 * 24 * 60 * 60 * 1000, // 1 month
};
```

## API Changes

### GET /api/gallery/explore

No API changes required. The enhanced sequencing is applied automatically for page 1 requests.

**Internal changes:**
- Now fetches user preferences from cache
- Applies diversity-aware selection
- Includes character gender in response

### Response Format (unchanged)

```javascript
{
  characters: [
    {
      chatId: "...",
      chatName: "Character Name",
      chatSlug: "character-slug",
      chatImageUrl: "/path/to/image.jpg",
      chatTags: ["tag1", "tag2"],
      description: "...",
      gender: "female",          // NEW: Now included
      chatCreatedAt: "2024-...", // NEW: For age sorting
      imageCount: 25,
      images: [...],
      latestImage: "2024-..."
    }
  ],
  page: 1,
  totalCharacters: 500,
  hasMore: true
}
```

## Monitoring

### Cron Job Logs

Look for these log prefixes:
- `🔍 [CRON]` - User preferences analyzer
- `📊` - Statistics and progress

### Example Log Output

```
🔍 [CRON] ▶️  Starting user preferences analyzer...
🔍 [CRON] ▶️  Starting nightly user preferences analysis...
🔍 [CRON] 📊 Found 1500 active users to analyze
🔍 [CRON] 📈 Progress: 100/1500 users
🔍 [CRON] 📈 Progress: 200/1500 users
...
🔍 [CRON] ✅ User preferences analysis completed:
   📊 Total users: 1500
   ✅ Processed: 1423
   ⏭️  Skipped (no activity): 57
   ❌ Errors: 20
   🗑️  Cleaned up old entries: 12
   ⏱️  Duration: 45.23s
```

## Troubleshooting

### No Diversity in Results

1. Check if enough characters exist in each category
2. Verify gender field is populated in chats collection
3. Check the console for sequencing errors

### Preferences Not Applying

1. Verify the nightly cron job is running (check logs at 4 AM)
2. Query `userPreferencesCache` collection to see if data exists
3. Ensure user has been active in last 30 days

### Performance Issues

1. Check batch processing in nightly analysis
2. Consider adding indexes:
   ```javascript
   db.userPreferencesCache.createIndex({ userId: 1 })
   db.userPreferencesCache.createIndex({ analyzedAt: 1 })
   ```

## Future Enhancements

1. **A/B Testing**: Test different diversity ratios
2. **Real-time Learning**: Update preferences on-the-fly
3. **Collaborative Filtering**: "Users like you also liked..."
4. **Explicit Preferences**: Let users set their preferred genders
5. **Time-of-Day Personalization**: Different content for different times
