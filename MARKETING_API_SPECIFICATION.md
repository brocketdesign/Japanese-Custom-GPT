# Marketing Dashboard API Specification

## Overview

This document outlines the API routes that the AI Character Creation Platform (app.chatlamix.com) should provide to connect with the external Marketing Dashboard (Marketing Command Center). These APIs are designed to power the AI Influencer Marketing Dashboard, enabling character performance tracking, content pipeline management, analytics insights, and marketing campaign optimization.

**Base URL:** `https://app.chatlamix.com`

**Authentication:** All marketing APIs require API key authentication via header:
```
Authorization: Bearer <api_key>
```

---

## 1. Marketing Command Center APIs (Dashboard Overview)

### 1.1 GET `/api/marketing/dashboard/summary`
**Purpose:** Get comprehensive platform metrics summary for the Marketing Command Center main dashboard view.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `7d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalFollowers": {
        "value": 503400,
        "formatted": "503.4K",
        "change": 12.4,
        "changeDirection": "up"
      },
      "weeklyViews": {
        "value": 2400000,
        "formatted": "2.4M",
        "change": 23.1,
        "changeDirection": "up"
      },
      "platformSignups": {
        "value": 29800,
        "formatted": "29.8K",
        "change": 8.7,
        "changeDirection": "up"
      },
      "avgEngagement": {
        "value": 8.2,
        "formatted": "8.2%",
        "change": -1.2,
        "changeDirection": "down"
      }
    },
    "characterPerformance": {
      "characters": [
        {
          "id": "char_123",
          "name": "Luna",
          "imageUrl": "https://cdn.example.com/characters/luna.jpg",
          "followers": 45200,
          "followersFormatted": "45.2K",
          "status": "active"
        },
        {
          "id": "char_456",
          "name": "Kai",
          "imageUrl": "https://cdn.example.com/characters/kai.jpg",
          "followers": 67800,
          "followersFormatted": "67.8K",
          "status": "active"
        }
      ],
      "totalCharacters": 10
    },
    "hotTrends": [
      {
        "id": "trend_1",
        "name": "Shy Dance Challenge",
        "views": 45000000,
        "viewsFormatted": "45M views",
        "daysActive": 3,
        "status": "active"
      },
      {
        "id": "trend_2",
        "name": "Get Ready With Me 2.0",
        "views": 28000000,
        "viewsFormatted": "28M views",
        "daysActive": 7,
        "status": "active"
      }
    ],
    "lastUpdated": "2024-01-23T04:39:57.846Z"
  }
}
```

### 1.2 GET `/api/marketing/dashboard/health`
**Purpose:** Platform health check and basic stats for monitoring.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "apiLatency": 45,
    "activeConnections": 250,
    "serverUptime": "15d 4h 30m"
  }
}
```

### 1.3 POST `/api/marketing/dashboard/sync`
**Purpose:** Trigger a data sync between the platform and external marketing tools.

**Response:**
```json
{
  "success": true,
  "data": {
    "syncId": "sync_123",
    "status": "started",
    "startedAt": "2024-01-23T04:39:57.846Z"
  }
}
```

---

## 2. User Analytics APIs

### 2.1 GET `/api/marketing/users/stats`
**Purpose:** Detailed user statistics and demographics.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `365d`, `all` (default: `30d`)
- `granularity` (optional): `day`, `week`, `month` (default: `day`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 15000,
    "registeredUsers": 12000,
    "temporaryUsers": 3000,
    "premiumUsers": 1500,
    "creatorAccounts": 500,
    "demographics": {
      "byLanguage": [
        { "language": "en", "count": 5000, "percentage": 33.3 },
        { "language": "ja", "count": 4500, "percentage": 30.0 },
        { "language": "es", "count": 2000, "percentage": 13.3 }
      ],
      "byGender": [
        { "gender": "male", "count": 8000, "percentage": 53.3 },
        { "gender": "female", "count": 6000, "percentage": 40.0 },
        { "gender": "other", "count": 1000, "percentage": 6.7 }
      ]
    },
    "lastUpdated": "2024-01-23T04:39:57.846Z"
  }
}
```

### 2.2 GET `/api/marketing/users/growth`
**Purpose:** User growth over time for trend analysis and charts.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `365d` (default: `30d`)
- `granularity` (optional): `day`, `week`, `month` (default: `day`)

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5"],
    "datasets": {
      "newUsers": [120, 135, 145, 110, 160],
      "activeUsers": [2500, 2600, 2750, 2400, 2800],
      "premiumConversions": [15, 18, 22, 12, 25]
    },
    "totals": {
      "totalNewUsers": 670,
      "totalActiveUsers": 13050,
      "totalConversions": 92,
      "growthRate": 12.5
    }
  }
}
```

### 2.3 GET `/api/marketing/users/retention`
**Purpose:** User retention and churn analysis.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)
- `cohort` (optional): `daily`, `weekly`, `monthly` (default: `weekly`)

**Response:**
```json
{
  "success": true,
  "data": {
    "retentionRate": {
      "day1": 65.5,
      "day7": 45.2,
      "day14": 38.5,
      "day30": 30.1
    },
    "churnRate": {
      "thisWeek": 5.2,
      "thisMonth": 8.5
    },
    "cohortAnalysis": [
      {
        "cohort": "Week 1",
        "startUsers": 500,
        "week1": 100,
        "week2": 75,
        "week3": 60,
        "week4": 52
      }
    ]
  }
}
```

### 2.4 GET `/api/marketing/users/segments`
**Purpose:** User segmentation for targeted marketing.

**Response:**
```json
{
  "success": true,
  "data": {
    "segments": [
      {
        "name": "Power Users",
        "description": "Users with 100+ messages and active in last 7 days",
        "count": 1200,
        "percentage": 8.0,
        "averageRevenue": 25.50
      },
      {
        "name": "Regular Users",
        "description": "Users with 10-100 messages and active in last 30 days",
        "count": 5000,
        "percentage": 33.3,
        "averageRevenue": 5.00
      },
      {
        "name": "New Users",
        "description": "Users registered in last 7 days",
        "count": 850,
        "percentage": 5.7,
        "averageRevenue": 0.50
      },
      {
        "name": "Dormant Users",
        "description": "Users inactive for 30+ days",
        "count": 3000,
        "percentage": 20.0,
        "averageRevenue": 0.00
      },
      {
        "name": "Premium Users",
        "description": "Users with active subscription",
        "count": 1500,
        "percentage": 10.0,
        "averageRevenue": 15.00
      }
    ]
  }
}
```

---

## 3. AI Characters APIs (Character Management)

### 3.1 GET `/api/marketing/characters`
**Purpose:** Get list of all AI characters with their marketing metrics for the Characters page.

**Query Parameters:**
- `status` (optional): `active`, `scheduled`, `draft`, `all` (default: `all`)
- `sortBy` (optional): `followers`, `engagement`, `posts`, `platformReferrals` (default: `followers`)
- `order` (optional): `asc`, `desc` (default: `desc`)
- `page` (optional): Page number (default: `1`)
- `limit` (optional): 1-50 (default: `20`)

**Response:**
```json
{
  "success": true,
  "data": {
    "characters": [
      {
        "id": "char_123",
        "name": "Luna",
        "shortDescription": "Dreamy Artist",
        "imageUrl": "https://cdn.example.com/characters/luna.jpg",
        "status": "active",
        "metrics": {
          "followers": 45200,
          "followersFormatted": "45.2K",
          "engagement": 8.2,
          "engagementFormatted": "8.2%",
          "posts": 156,
          "platformReferrals": 2300,
          "platformReferralsFormatted": "2.3K"
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "char_456",
        "name": "Kai",
        "shortDescription": "Energetic Gamer",
        "imageUrl": "https://cdn.example.com/characters/kai.jpg",
        "status": "active",
        "metrics": {
          "followers": 67800,
          "followersFormatted": "67.8K",
          "engagement": 9.1,
          "engagementFormatted": "9.1%",
          "posts": 203,
          "platformReferrals": 4100,
          "platformReferralsFormatted": "4.1K"
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCharacters": 100,
      "hasMore": true
    }
  }
}
```

### 3.2 GET `/api/marketing/characters/:characterId`
**Purpose:** Get detailed information about a specific AI character.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "char_123",
    "name": "Luna",
    "shortDescription": "Dreamy Artist",
    "fullDescription": "A mysterious and creative artist with a passion for fantasy worlds...",
    "imageUrl": "https://cdn.example.com/characters/luna.jpg",
    "status": "active",
    "metrics": {
      "followers": 45200,
      "followersFormatted": "45.2K",
      "followersChange": 12.4,
      "engagement": 8.2,
      "engagementFormatted": "8.2%",
      "posts": 156,
      "platformReferrals": 2300,
      "platformReferralsFormatted": "2.3K",
      "totalViews": 1500000,
      "avgViewsPerPost": 9615,
      "signupsGenerated": 450
    },
    "tags": ["dreamy", "artist", "creative", "fantasy"],
    "category": "Creative",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-23T00:00:00.000Z"
  }
}
```

### 3.3 GET `/api/marketing/characters/:characterId/analytics`
**Purpose:** Get detailed analytics for a specific character for the Analytics modal/page.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "characterId": "char_123",
    "characterName": "Luna",
    "period": "30d",
    "overview": {
      "totalFollowers": 45200,
      "newFollowers": 5400,
      "followerGrowth": 13.5,
      "totalViews": 1500000,
      "engagement": 8.2,
      "platformReferrals": 2300
    },
    "timeline": {
      "labels": ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5"],
      "followers": [40000, 41200, 42500, 43800, 45200],
      "views": [280000, 295000, 310000, 305000, 320000],
      "engagement": [7.8, 8.0, 8.1, 8.3, 8.2]
    },
    "contentPerformance": {
      "topPosts": [
        {
          "postId": "post_1",
          "type": "Trending Dance",
          "trend": "Shy Dance Challenge",
          "views": 450000,
          "engagement": 12.5,
          "publishedAt": "2024-01-20T00:00:00.000Z"
        }
      ],
      "averageViews": 9615,
      "averageEngagement": 8.2
    }
  }
}
```

### 3.4 PUT `/api/marketing/characters/:characterId`
**Purpose:** Update character details or status.

**Request Body:**
```json
{
  "shortDescription": "Updated description",
  "status": "active",
  "tags": ["dreamy", "artist", "creative"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "char_123",
    "name": "Luna",
    "shortDescription": "Updated description",
    "status": "active",
    "updatedAt": "2024-01-23T04:39:57.846Z"
  }
}
```

### 3.5 GET `/api/marketing/characters/stats`
**Purpose:** Overall character statistics summary.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `all` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5000,
    "public": 3500,
    "private": 1500,
    "nsfw": 2000,
    "sfw": 3000,
    "byGender": {
      "female": 3500,
      "male": 1200,
      "other": 300
    },
    "newThisWeek": 200,
    "newThisMonth": 800,
    "growthRate": 8.2
  }
}
```

### 3.6 GET `/api/marketing/characters/top-performing`
**Purpose:** Get top performing characters for marketing insights.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)
- `sortBy` (optional): `messages`, `users`, `favorites`, `images` (default: `messages`)
- `limit` (optional): 1-100 (default: `20`)
- `nsfw` (optional): `true`, `false`, `all` (default: `all`)

**Response:**
```json
{
  "success": true,
  "data": {
    "characters": [
      {
        "id": "char_123",
        "name": "Luna",
        "slug": "luna-mysterious-witch",
        "imageUrl": "https://cdn.example.com/characters/luna.jpg",
        "creatorId": "user_456",
        "creatorName": "CreatorUsername",
        "category": "fantasy",
        "tags": ["witch", "mysterious", "magic"],
        "isNsfw": false,
        "metrics": {
          "totalMessages": 50000,
          "uniqueUsers": 1500,
          "favorites": 800,
          "imagesGenerated": 5000,
          "averageSessionLength": 25,
          "messagesThisWeek": 8000,
          "userGrowthRate": 15.5
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "totalCharacters": 5000,
    "page": 1,
    "totalPages": 250
  }
}
```

### 3.7 GET `/api/marketing/characters/categories`
**Purpose:** Character distribution by category/tags.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "name": "Fantasy", "count": 1200, "percentage": 24.0 },
      { "name": "Romance", "count": 1000, "percentage": 20.0 },
      { "name": "Anime", "count": 900, "percentage": 18.0 },
      { "name": "Sci-Fi", "count": 600, "percentage": 12.0 },
      { "name": "Horror", "count": 400, "percentage": 8.0 },
      { "name": "Other", "count": 900, "percentage": 18.0 }
    ],
    "topTags": [
      { "tag": "girlfriend", "count": 2500 },
      { "tag": "anime", "count": 2000 },
      { "tag": "fantasy", "count": 1800 },
      { "tag": "romantic", "count": 1500 },
      { "tag": "mysterious", "count": 1200 }
    ]
  }
}
```

### 3.8 GET `/api/marketing/characters/engagement`
**Purpose:** Character engagement metrics over time.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)
- `granularity` (optional): `day`, `week`, `month` (default: `day`)

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5"],
    "datasets": {
      "newCharacters": [50, 45, 60, 40, 55],
      "messagesPerCharacter": [100, 105, 110, 95, 115],
      "uniqueUsersPerCharacter": [25, 28, 30, 22, 32]
    },
    "averages": {
      "messagesPerCharacter": 100,
      "usersPerCharacter": 30,
      "sessionsPerCharacter": 150
    }
  }
}
```

---

## 4. Engagement Analytics APIs

### 4.1 GET `/api/marketing/engagement/messages`
**Purpose:** Message analytics for understanding conversation patterns.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)
- `granularity` (optional): `hour`, `day`, `week` (default: `day`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMessages": 1500000,
    "periodMessages": 150000,
    "averageMessagesPerDay": 5000,
    "averageMessagesPerUser": 10,
    "averageMessagesPerSession": 25,
    "timeline": {
      "labels": ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5"],
      "values": [4500, 5000, 5500, 4800, 5200]
    },
    "peakHours": [
      { "hour": 21, "messages": 8500, "label": "9 PM" },
      { "hour": 22, "messages": 8200, "label": "10 PM" },
      { "hour": 20, "messages": 7800, "label": "8 PM" }
    ],
    "byDayOfWeek": [
      { "day": "Sunday", "messages": 25000 },
      { "day": "Monday", "messages": 20000 },
      { "day": "Tuesday", "messages": 21000 },
      { "day": "Wednesday", "messages": 22000 },
      { "day": "Thursday", "messages": 21500 },
      { "day": "Friday", "messages": 23000 },
      { "day": "Saturday", "messages": 24500 }
    ]
  }
}
```

### 4.2 GET `/api/marketing/engagement/images`
**Purpose:** Image generation analytics.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalImagesGenerated": 500000,
    "periodImages": 50000,
    "averageImagesPerDay": 1667,
    "averageImagesPerUser": 3.3,
    "timeline": {
      "labels": ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5"],
      "values": [1500, 1700, 1800, 1600, 1750]
    },
    "topImageGeneratingCharacters": [
      { "characterId": "char_123", "name": "Luna", "imageCount": 5000 },
      { "characterId": "char_456", "name": "Sakura", "imageCount": 4500 }
    ],
    "usersWithImages": 4500,
    "totalImageLikes": 150000,
    "averageLikesPerImage": 0.3
  }
}
```

### 4.3 GET `/api/marketing/engagement/sessions`
**Purpose:** Session analytics for understanding user behavior.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSessions": 50000,
    "averageSessionDuration": 930,
    "averageSessionDurationFormatted": "15:30",
    "averageMessagesPerSession": 25,
    "bounceRate": 15.5,
    "sessionsByDevice": {
      "mobile": 60,
      "desktop": 35,
      "tablet": 5
    },
    "timeline": {
      "labels": ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5"],
      "sessions": [1500, 1600, 1700, 1400, 1800],
      "avgDuration": [900, 920, 950, 880, 970]
    }
  }
}
```

### 4.4 GET `/api/marketing/engagement/favorites`
**Purpose:** Favorite/like analytics.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFavorites": 80000,
    "newFavoritesThisWeek": 5000,
    "averageFavoritesPerUser": 5.3,
    "averageFavoritesPerCharacter": 16,
    "topFavoritedCharacters": [
      {
        "characterId": "char_123",
        "name": "Luna",
        "favoriteCount": 800,
        "imageUrl": "https://cdn.example.com/characters/luna.jpg"
      }
    ],
    "favoriteGrowthRate": 8.5
  }
}
```

---

## 5. Content Studio APIs (Content Management & Pipeline)

### 5.1 GET `/api/marketing/content/stats`
**Purpose:** Get content status counts for the Content Studio overview.

**Response:**
```json
{
  "success": true,
  "data": {
    "inQueue": {
      "count": 23,
      "label": "In Queue"
    },
    "rendering": {
      "count": 5,
      "label": "Rendering"
    },
    "scheduled": {
      "count": 18,
      "label": "Scheduled"
    },
    "publishedToday": {
      "count": 12,
      "change": 20,
      "changeDirection": "up",
      "label": "Published Today"
    }
  }
}
```

### 5.2 GET `/api/marketing/content/pipeline`
**Purpose:** Get the content pipeline list for viewing scheduled and in-progress content.

**Query Parameters:**
- `status` (optional): `all`, `draft`, `rendering`, `review`, `scheduled`, `queued`, `published` (default: `all`)
- `characterId` (optional): Filter by specific character
- `page` (optional): Page number (default: `1`)
- `limit` (optional): 1-50 (default: `20`)

**Response:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "content_1",
        "character": {
          "id": "char_123",
          "name": "Aria",
          "imageUrl": "https://cdn.example.com/characters/aria.jpg"
        },
        "contentType": "Trending Dance",
        "trend": {
          "id": "trend_1",
          "name": "Shy Dance Challenge"
        },
        "status": "rendering",
        "progress": 67,
        "scheduledAt": "2024-01-23T15:00:00.000Z",
        "scheduledFormatted": "Today 3:00 PM",
        "createdAt": "2024-01-23T10:00:00.000Z"
      },
      {
        "id": "content_2",
        "character": {
          "id": "char_456",
          "name": "Kai",
          "imageUrl": "https://cdn.example.com/characters/kai.jpg"
        },
        "contentType": "Reaction Video",
        "trend": {
          "id": "trend_2",
          "name": "Gaming Meme"
        },
        "status": "review",
        "progress": 100,
        "scheduledAt": "2024-01-23T17:00:00.000Z",
        "scheduledFormatted": "Today 5:00 PM",
        "createdAt": "2024-01-23T09:00:00.000Z"
      },
      {
        "id": "content_3",
        "character": {
          "id": "char_789",
          "name": "Luna",
          "imageUrl": "https://cdn.example.com/characters/luna.jpg"
        },
        "contentType": "Aesthetic Dance",
        "trend": {
          "id": "trend_3",
          "name": "Ethereal Vibes"
        },
        "status": "scheduled",
        "progress": 100,
        "scheduledAt": "2024-01-24T10:00:00.000Z",
        "scheduledFormatted": "Tomorrow 10:00 AM",
        "createdAt": "2024-01-23T08:00:00.000Z"
      },
      {
        "id": "content_4",
        "character": {
          "id": "char_012",
          "name": "Sofia",
          "imageUrl": "https://cdn.example.com/characters/sofia.jpg"
        },
        "contentType": "Boss Energy",
        "trend": {
          "id": "trend_4",
          "name": "Confidence Walk"
        },
        "status": "queued",
        "progress": 0,
        "scheduledAt": "2024-01-24T14:00:00.000Z",
        "scheduledFormatted": "Tomorrow 2:00 PM",
        "createdAt": "2024-01-23T11:00:00.000Z"
      },
      {
        "id": "content_5",
        "character": {
          "id": "char_345",
          "name": "Jade",
          "imageUrl": "https://cdn.example.com/characters/jade.jpg"
        },
        "contentType": "Sassy Response",
        "trend": {
          "id": "trend_5",
          "name": "Comment Clap Back"
        },
        "status": "draft",
        "progress": 30,
        "scheduledAt": null,
        "scheduledFormatted": "Unscheduled",
        "createdAt": "2024-01-23T07:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 58,
      "hasMore": true
    }
  }
}
```

### 5.3 POST `/api/marketing/content`
**Purpose:** Create new content for a character (Generate Content).

**Request Body:**
```json
{
  "characterId": "char_123",
  "contentType": "Trending Dance",
  "trendId": "trend_1",
  "scheduledAt": "2024-01-24T15:00:00.000Z",
  "options": {
    "style": "energetic",
    "duration": 30,
    "music": "trending_track_id"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "content_new",
    "characterId": "char_123",
    "contentType": "Trending Dance",
    "status": "queued",
    "progress": 0,
    "scheduledAt": "2024-01-24T15:00:00.000Z",
    "createdAt": "2024-01-23T04:39:57.846Z"
  }
}
```

### 5.4 PUT `/api/marketing/content/:contentId`
**Purpose:** Update content details or reschedule.

**Request Body:**
```json
{
  "scheduledAt": "2024-01-25T10:00:00.000Z",
  "status": "scheduled"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "content_1",
    "status": "scheduled",
    "scheduledAt": "2024-01-25T10:00:00.000Z",
    "updatedAt": "2024-01-23T04:39:57.846Z"
  }
}
```

### 5.5 DELETE `/api/marketing/content/:contentId`
**Purpose:** Delete or cancel content.

**Response:**
```json
{
  "success": true,
  "message": "Content deleted successfully"
}
```

### 5.6 GET `/api/marketing/content/types`
**Purpose:** Get available content types for content creation.

**Response:**
```json
{
  "success": true,
  "data": {
    "contentTypes": [
      {
        "id": "trending_dance",
        "name": "Trending Dance",
        "description": "Dance content following trending challenges"
      },
      {
        "id": "reaction_video",
        "name": "Reaction Video",
        "description": "Character reactions to trending content"
      },
      {
        "id": "aesthetic_dance",
        "name": "Aesthetic Dance",
        "description": "Artistic and visually pleasing dance content"
      },
      {
        "id": "boss_energy",
        "name": "Boss Energy",
        "description": "Confident and empowering content"
      },
      {
        "id": "sassy_response",
        "name": "Sassy Response",
        "description": "Witty responses to comments or trends"
      }
    ]
  }
}
```

---

## 6. Trends APIs

### 6.1 GET `/api/marketing/trends`
**Purpose:** Get current hot trends for the dashboard and content creation.

**Query Parameters:**
- `limit` (optional): 1-50 (default: `10`)
- `category` (optional): Filter by trend category

**Response:**
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "id": "trend_1",
        "name": "Shy Dance Challenge",
        "views": 45000000,
        "viewsFormatted": "45M views",
        "daysActive": 3,
        "status": "hot",
        "category": "dance",
        "recommendedFor": ["dance", "cute", "casual"]
      },
      {
        "id": "trend_2",
        "name": "Get Ready With Me 2.0",
        "views": 28000000,
        "viewsFormatted": "28M views",
        "daysActive": 7,
        "status": "active",
        "category": "lifestyle",
        "recommendedFor": ["lifestyle", "beauty", "casual"]
      },
      {
        "id": "trend_3",
        "name": "Dad Dance Remix",
        "views": 12000000,
        "viewsFormatted": "12M views",
        "daysActive": 2,
        "status": "active",
        "category": "dance",
        "recommendedFor": ["comedy", "dance", "family"]
      },
      {
        "id": "trend_4",
        "name": "Outfit Transition",
        "views": 89000000,
        "viewsFormatted": "89M views",
        "daysActive": 14,
        "status": "active",
        "category": "fashion",
        "recommendedFor": ["fashion", "lifestyle", "creative"]
      }
    ],
    "lastUpdated": "2024-01-23T04:39:57.846Z"
  }
}
```

### 6.2 GET `/api/marketing/trends/:trendId`
**Purpose:** Get detailed information about a specific trend.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "trend_1",
    "name": "Shy Dance Challenge",
    "description": "A cute dance challenge with shy gestures",
    "views": 45000000,
    "viewsFormatted": "45M views",
    "daysActive": 3,
    "startedAt": "2024-01-20T00:00:00.000Z",
    "status": "hot",
    "category": "dance",
    "hashtags": ["#shydance", "#dancechallenge", "#viral"],
    "sourceUrl": "https://example.com/trend/shy-dance",
    "exampleVideos": [
      "https://example.com/video/1",
      "https://example.com/video/2"
    ],
    "recommendedFor": ["dance", "cute", "casual"],
    "characterParticipation": {
      "total": 5,
      "characters": [
        { "id": "char_123", "name": "Luna", "status": "published" },
        { "id": "char_456", "name": "Aria", "status": "rendering" }
      ]
    }
  }
}
```

---

## 7. Analytics & Insights APIs

### 7.1 GET `/api/marketing/analytics/overview`
**Purpose:** Get analytics overview for the Analytics & Insights page.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `7d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "newFollowers": {
        "value": 47200,
        "formatted": "+47.2K",
        "change": 23.5,
        "changeDirection": "up"
      },
      "totalViews": {
        "value": 2400000,
        "formatted": "2.4M",
        "change": 18.2,
        "changeDirection": "up"
      },
      "platformSignups": {
        "value": 8234,
        "formatted": "8,234",
        "change": 31.4,
        "changeDirection": "up"
      },
      "conversionRate": {
        "value": 4.2,
        "formatted": "4.2%",
        "change": 0.8,
        "changeDirection": "up"
      }
    },
    "period": "7d",
    "lastUpdated": "2024-01-23T04:39:57.846Z"
  }
}
```

### 7.2 GET `/api/marketing/analytics/funnel`
**Purpose:** Get funnel performance data for the marketing funnel visualization.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `7d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "funnel": [
      {
        "stage": "Video Views",
        "value": 2400000,
        "formatted": "2.4M",
        "percentage": 100
      },
      {
        "stage": "Profile Visits",
        "value": 320000,
        "formatted": "320K",
        "percentage": 13.3
      },
      {
        "stage": "Link Clicks",
        "value": 45000,
        "formatted": "45K",
        "percentage": 14.1
      },
      {
        "stage": "Platform Visits",
        "value": 32000,
        "formatted": "32K",
        "percentage": 71.1
      },
      {
        "stage": "Signups",
        "value": 8200,
        "formatted": "8.2K",
        "percentage": 25.6
      },
      {
        "stage": "First Chat",
        "value": 6100,
        "formatted": "6.1K",
        "percentage": 74.4
      }
    ],
    "overallConversion": {
      "videoViewsToSignups": 0.34,
      "signupsToFirstChat": 74.4
    },
    "period": "7d"
  }
}
```

### 7.3 GET `/api/marketing/analytics/top-performers`
**Purpose:** Get top performing characters for the leaderboard.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `7d`)
- `limit` (optional): 1-20 (default: `5`)
- `sortBy` (optional): `signups`, `engagement`, `views` (default: `signups`)

**Response:**
```json
{
  "success": true,
  "data": {
    "performers": [
      {
        "rank": 1,
        "character": {
          "id": "char_123",
          "name": "Aria",
          "imageUrl": "https://cdn.example.com/characters/aria.jpg"
        },
        "engagement": 10.2,
        "engagementFormatted": "10.2% engagement",
        "signups": 5700,
        "signupsFormatted": "5.7K signups"
      },
      {
        "rank": 2,
        "character": {
          "id": "char_456",
          "name": "Kai",
          "imageUrl": "https://cdn.example.com/characters/kai.jpg"
        },
        "engagement": 9.1,
        "engagementFormatted": "9.1% engagement",
        "signups": 4100,
        "signupsFormatted": "4.1K signups"
      },
      {
        "rank": 3,
        "character": {
          "id": "char_789",
          "name": "Sofia",
          "imageUrl": "https://cdn.example.com/characters/sofia.jpg"
        },
        "engagement": 7.8,
        "engagementFormatted": "7.8% engagement",
        "signups": 3900,
        "signupsFormatted": "3.9K signups"
      },
      {
        "rank": 4,
        "character": {
          "id": "char_012",
          "name": "Luna",
          "imageUrl": "https://cdn.example.com/characters/luna.jpg"
        },
        "engagement": 8.2,
        "engagementFormatted": "8.2% engagement",
        "signups": 2300,
        "signupsFormatted": "2.3K signups"
      },
      {
        "rank": 5,
        "character": {
          "id": "char_345",
          "name": "Milo",
          "imageUrl": "https://cdn.example.com/characters/milo.jpg"
        },
        "engagement": 6.9,
        "engagementFormatted": "6.9% engagement",
        "signups": 2000,
        "signupsFormatted": "2.0K signups"
      }
    ],
    "period": "7d"
  }
}
```

### 7.4 GET `/api/marketing/analytics/export`
**Purpose:** Export analytics data for the given period.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `7d`)
- `format` (optional): `json`, `csv` (default: `json`)

**Response:**
```json
{
  "success": true,
  "data": {
    "exportUrl": "https://cdn.example.com/exports/analytics_2024_01_23.csv",
    "expiresAt": "2024-01-24T04:39:57.846Z",
    "period": "7d",
    "generatedAt": "2024-01-23T04:39:57.846Z"
  }
}
```

---

## 8. Revenue Analytics APIs

### 8.1 GET `/api/marketing/revenue/summary`
**Purpose:** Revenue summary and key financial metrics.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `365d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 50000.00,
    "periodRevenue": 12000.00,
    "revenueGrowthRate": 15.3,
    "averageRevenuePerUser": 3.33,
    "averageRevenuePerPayingUser": 33.33,
    "breakdown": {
      "subscriptions": {
        "total": 8000.00,
        "percentage": 66.7,
        "activeSubscribers": 1200
      },
      "pointPurchases": {
        "total": 3000.00,
        "percentage": 25.0,
        "totalPurchases": 500
      },
      "tips": {
        "total": 1000.00,
        "percentage": 8.3,
        "totalTips": 200
      }
    },
    "currency": "USD"
  }
}
```

### 8.2 GET `/api/marketing/revenue/timeline`
**Purpose:** Revenue over time for trend charts.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `365d` (default: `30d`)
- `granularity` (optional): `day`, `week`, `month` (default: `day`)

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5"],
    "datasets": {
      "totalRevenue": [400, 450, 500, 380, 520],
      "subscriptions": [300, 320, 350, 280, 380],
      "pointPurchases": [80, 100, 120, 75, 110],
      "tips": [20, 30, 30, 25, 30]
    },
    "totals": {
      "periodTotal": 2250,
      "subscriptionsTotal": 1630,
      "pointPurchasesTotal": 485,
      "tipsTotal": 135
    }
  }
}
```

### 8.3 GET `/api/marketing/revenue/subscriptions`
**Purpose:** Subscription-specific analytics.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "activeSubscriptions": 1500,
    "newSubscriptionsThisWeek": 120,
    "cancelledThisWeek": 30,
    "churnRate": 2.0,
    "netGrowth": 90,
    "monthlyRecurringRevenue": 8000.00,
    "averageSubscriptionValue": 5.33,
    "byTier": [
      { "tier": "Basic", "subscribers": 800, "revenue": 2400.00, "price": 3.00 },
      { "tier": "Premium", "subscribers": 500, "revenue": 3500.00, "price": 7.00 },
      { "tier": "Pro", "subscribers": 200, "revenue": 2100.00, "price": 10.50 }
    ],
    "subscriptionRetention": {
      "month1": 85.0,
      "month3": 70.0,
      "month6": 55.0,
      "month12": 40.0
    }
  }
}
```

### 8.4 GET `/api/marketing/revenue/conversions`
**Purpose:** Conversion funnel and metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "funnel": {
      "visitors": 50000,
      "registered": 15000,
      "activated": 12000,
      "engaged": 8000,
      "paying": 1500
    },
    "conversionRates": {
      "visitorToRegistered": 30.0,
      "registeredToActivated": 80.0,
      "activatedToEngaged": 66.7,
      "engagedToPaying": 18.75,
      "overallConversion": 3.0
    },
    "averageTimeToConversion": {
      "registrationToFirstPurchase": "5.2 days",
      "firstChatToSubscription": "12.5 days"
    }
  }
}
```

---

## 9. Creator Analytics APIs

### 9.1 GET `/api/marketing/creators/stats`
**Purpose:** Creator ecosystem statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCreators": 500,
    "activeCreators": 350,
    "newCreatorsThisMonth": 50,
    "totalCharactersByCreators": 3000,
    "averageCharactersPerCreator": 6,
    "topCreators": [
      {
        "creatorId": "user_123",
        "username": "TopCreator",
        "charactersCount": 25,
        "totalFollowers": 5000,
        "totalMessages": 250000,
        "earnings": 2500.00
      }
    ]
  }
}
```

### 9.2 GET `/api/marketing/creators/top`
**Purpose:** Top performing creators for partnerships/features.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d` (default: `30d`)
- `sortBy` (optional): `followers`, `characters`, `messages`, `earnings` (default: `followers`)
- `limit` (optional): 1-100 (default: `20`)

**Response:**
```json
{
  "success": true,
  "data": {
    "creators": [
      {
        "creatorId": "user_123",
        "username": "TopCreator",
        "profileUrl": "https://cdn.example.com/profiles/topcreator.jpg",
        "isVerified": true,
        "metrics": {
          "followers": 5000,
          "charactersCount": 25,
          "totalMessages": 250000,
          "totalImages": 50000,
          "earnings": 2500.00,
          "subscriberCount": 200
        },
        "topCharacter": {
          "id": "char_123",
          "name": "Luna",
          "messages": 50000
        },
        "createdAt": "2023-06-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

## 10. Content Moderation APIs

### 10.1 GET `/api/marketing/moderation/stats`
**Purpose:** Content overview for moderation and safety.

**Response:**
```json
{
  "success": true,
  "data": {
    "characters": {
      "total": 5000,
      "nsfw": 2000,
      "sfw": 3000,
      "pendingReview": 50,
      "flagged": 20
    },
    "images": {
      "totalGenerated": 500000,
      "nsfwImages": 200000,
      "sfwImages": 300000
    },
    "reports": {
      "totalReports": 100,
      "pendingReview": 15,
      "resolved": 85
    }
  }
}
```

---

## 11. Geographic & Language APIs

### 11.1 GET `/api/marketing/geo/distribution`
**Purpose:** Geographic distribution of users for localization decisions.

**Response:**
```json
{
  "success": true,
  "data": {
    "byCountry": [
      { "country": "US", "countryName": "United States", "users": 5000, "percentage": 33.3 },
      { "country": "JP", "countryName": "Japan", "users": 4500, "percentage": 30.0 },
      { "country": "GB", "countryName": "United Kingdom", "users": 1500, "percentage": 10.0 }
    ],
    "byLanguage": [
      { "language": "en", "languageName": "English", "users": 6000, "percentage": 40.0 },
      { "language": "ja", "languageName": "Japanese", "users": 4500, "percentage": 30.0 },
      { "language": "es", "languageName": "Spanish", "users": 2000, "percentage": 13.3 }
    ],
    "topRegions": [
      { "region": "North America", "users": 5500, "percentage": 36.7 },
      { "region": "Asia", "users": 5000, "percentage": 33.3 },
      { "region": "Europe", "users": 3000, "percentage": 20.0 }
    ]
  }
}
```

---

## 12. Feature Usage APIs

### 12.1 GET `/api/marketing/features/usage`
**Purpose:** Feature adoption and usage statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "features": [
      {
        "feature": "Character Creation",
        "usersUsed": 2000,
        "usagePercentage": 13.3,
        "averageUsagePerUser": 2.5
      },
      {
        "feature": "Image Generation",
        "usersUsed": 4500,
        "usagePercentage": 30.0,
        "averageUsagePerUser": 110
      },
      {
        "feature": "Video Generation",
        "usersUsed": 500,
        "usagePercentage": 3.3,
        "averageUsagePerUser": 5
      },
      {
        "feature": "Voice Messages",
        "usersUsed": 1000,
        "usagePercentage": 6.7,
        "averageUsagePerUser": 20
      },
      {
        "feature": "Character Customization",
        "usersUsed": 3000,
        "usagePercentage": 20.0,
        "averageUsagePerUser": 3
      },
      {
        "feature": "Scenarios",
        "usersUsed": 2500,
        "usagePercentage": 16.7,
        "averageUsagePerUser": 8
      }
    ]
  }
}
```

---

## 13. Export APIs

### 13.1 GET `/api/marketing/export/users`
**Purpose:** Export user data for external analysis.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `all` (default: `30d`)
- `format` (optional): `json`, `csv` (default: `json`)
- `fields` (optional): Comma-separated list of fields to include

**Response (JSON):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "user_123",
        "registeredAt": "2024-01-01T00:00:00.000Z",
        "language": "en",
        "isPremium": true,
        "totalMessages": 500,
        "totalImages": 50,
        "favoriteCharacters": 10,
        "lastActiveAt": "2024-01-23T00:00:00.000Z"
      }
    ],
    "totalRecords": 1000,
    "exportedAt": "2024-01-23T04:39:57.846Z"
  }
}
```

### 13.2 GET `/api/marketing/export/characters`
**Purpose:** Export character data for analysis.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `all` (default: `30d`)
- `format` (optional): `json`, `csv` (default: `json`)

**Response:**
```json
{
  "success": true,
  "data": {
    "characters": [
      {
        "characterId": "char_123",
        "name": "Luna",
        "creatorId": "user_456",
        "category": "fantasy",
        "tags": ["witch", "mysterious"],
        "isNsfw": false,
        "isPublic": true,
        "totalMessages": 50000,
        "uniqueUsers": 1500,
        "favorites": 800,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "totalRecords": 5000,
    "exportedAt": "2024-01-23T04:39:57.846Z"
  }
}
```

### 13.3 GET `/api/marketing/export/revenue`
**Purpose:** Export revenue data for financial analysis.

**Query Parameters:**
- `period` (optional): `7d`, `30d`, `90d`, `365d` (default: `30d`)
- `format` (optional): `json`, `csv` (default: `json`)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transactionId": "txn_123",
        "userId": "user_456",
        "type": "subscription",
        "amount": 9.99,
        "currency": "USD",
        "status": "completed",
        "createdAt": "2024-01-15T00:00:00.000Z"
      }
    ],
    "summary": {
      "totalTransactions": 500,
      "totalRevenue": 12000.00,
      "byType": {
        "subscriptions": 8000.00,
        "pointPurchases": 3000.00,
        "tips": 1000.00
      }
    },
    "exportedAt": "2024-01-23T04:39:57.846Z"
  }
}
```

---

## 14. Real-time / Webhooks

### 14.1 POST `/api/marketing/webhooks/register`
**Purpose:** Register a webhook URL to receive real-time marketing events.

**Request Body:**
```json
{
  "url": "https://your-dashboard.com/webhooks/chatlamix",
  "events": [
    "user.registered",
    "user.converted",
    "subscription.created",
    "subscription.cancelled",
    "character.created",
    "milestone.reached"
  ],
  "secret": "your_webhook_secret"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhookId": "webhook_123",
    "url": "https://your-dashboard.com/webhooks/chatlamix",
    "events": ["user.registered", "user.converted", "subscription.created"],
    "status": "active",
    "createdAt": "2024-01-23T04:39:57.846Z"
  }
}
```

---

## API Authentication

### Generating API Keys

Marketing API keys can be generated through the admin dashboard or via:

```
POST /api/marketing/keys/generate
```

**Request:**
```json
{
  "name": "Marketing Dashboard Production",
  "permissions": ["read:analytics", "read:users", "read:characters", "read:revenue"],
  "ipWhitelist": ["192.168.1.1", "10.0.0.1"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "mk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "name": "Marketing Dashboard Production",
    "permissions": ["read:analytics", "read:users", "read:characters", "read:revenue"],
    "createdAt": "2024-01-23T04:39:57.846Z"
  }
}
```

---

## Rate Limiting

All marketing APIs are rate-limited:
- **Standard endpoints:** 100 requests per minute
- **Export endpoints:** 10 requests per minute
- **Webhook registration:** 5 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706009997
```

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired API key",
    "details": null
  }
}
```

Common error codes:
- `UNAUTHORIZED` (401): Invalid API key
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

---

## Summary of API Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Dashboard** | `GET /api/marketing/dashboard/summary` | Marketing Command Center summary |
| **Dashboard** | `GET /api/marketing/dashboard/health` | Platform health check |
| **Dashboard** | `POST /api/marketing/dashboard/sync` | Trigger data sync |
| **Users** | `GET /api/marketing/users/stats` | User statistics |
| **Users** | `GET /api/marketing/users/growth` | User growth timeline |
| **Users** | `GET /api/marketing/users/retention` | Retention & churn |
| **Users** | `GET /api/marketing/users/segments` | User segments |
| **Characters** | `GET /api/marketing/characters` | List all AI characters |
| **Characters** | `GET /api/marketing/characters/:id` | Get character details |
| **Characters** | `GET /api/marketing/characters/:id/analytics` | Character analytics |
| **Characters** | `PUT /api/marketing/characters/:id` | Update character |
| **Characters** | `GET /api/marketing/characters/stats` | Character statistics |
| **Characters** | `GET /api/marketing/characters/top-performing` | Top characters |
| **Characters** | `GET /api/marketing/characters/categories` | Category distribution |
| **Characters** | `GET /api/marketing/characters/engagement` | Engagement timeline |
| **Engagement** | `GET /api/marketing/engagement/messages` | Message analytics |
| **Engagement** | `GET /api/marketing/engagement/images` | Image generation stats |
| **Engagement** | `GET /api/marketing/engagement/sessions` | Session analytics |
| **Engagement** | `GET /api/marketing/engagement/favorites` | Favorite analytics |
| **Content** | `GET /api/marketing/content/stats` | Content status counts |
| **Content** | `GET /api/marketing/content/pipeline` | Content pipeline list |
| **Content** | `POST /api/marketing/content` | Create new content |
| **Content** | `PUT /api/marketing/content/:id` | Update content |
| **Content** | `DELETE /api/marketing/content/:id` | Delete content |
| **Content** | `GET /api/marketing/content/types` | Available content types |
| **Trends** | `GET /api/marketing/trends` | Hot trends list |
| **Trends** | `GET /api/marketing/trends/:id` | Trend details |
| **Analytics** | `GET /api/marketing/analytics/overview` | Analytics overview |
| **Analytics** | `GET /api/marketing/analytics/funnel` | Funnel performance |
| **Analytics** | `GET /api/marketing/analytics/top-performers` | Top performers leaderboard |
| **Analytics** | `GET /api/marketing/analytics/export` | Export analytics data |
| **Revenue** | `GET /api/marketing/revenue/summary` | Revenue summary |
| **Revenue** | `GET /api/marketing/revenue/timeline` | Revenue timeline |
| **Revenue** | `GET /api/marketing/revenue/subscriptions` | Subscription analytics |
| **Revenue** | `GET /api/marketing/revenue/conversions` | Conversion funnel |
| **Creators** | `GET /api/marketing/creators/stats` | Creator statistics |
| **Creators** | `GET /api/marketing/creators/top` | Top creators |
| **Moderation** | `GET /api/marketing/moderation/stats` | Content moderation stats |
| **Geographic** | `GET /api/marketing/geo/distribution` | Geographic distribution |
| **Features** | `GET /api/marketing/features/usage` | Feature usage stats |
| **Export** | `GET /api/marketing/export/users` | Export user data |
| **Export** | `GET /api/marketing/export/characters` | Export character data |
| **Export** | `GET /api/marketing/export/revenue` | Export revenue data |
| **Webhooks** | `POST /api/marketing/webhooks/register` | Register webhook |

---

## Implementation Notes for Developers

1. **Caching:** Consider implementing Redis caching for frequently accessed endpoints (summary, stats) with 5-15 minute TTL.

2. **Database Indexes:** Ensure proper indexes on:
   - `users.createdAt`, `users.lang`, `users.isTemporary`
   - `chats.createdAt`, `chats.userId`, `chats.tags`
   - `userChat.createdAt`, `userChat.chatId`
   - `subscriptions.subscriptionStatus`, `subscriptions.createdAt`

3. **Aggregation Pipeline:** Use MongoDB aggregation pipelines for complex analytics queries instead of application-level processing.

4. **Background Jobs:** Consider using background jobs (cron) to pre-compute and cache analytics data for heavy endpoints.

5. **Security:** 
   - Validate API keys on every request
   - Implement IP whitelisting for production keys
   - Log all API access for audit purposes
   - Never expose PII (personal identifiable information) without proper authorization

6. **Pagination:** For list endpoints, always implement pagination to prevent memory issues with large datasets.

This specification should be used by the development team to implement the marketing API layer in the platform.
