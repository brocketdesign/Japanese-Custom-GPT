# Marketing Dashboard API Specification

## Overview

This document outlines the API routes that the AI Character Creation Platform (app.chatlamix.com) should provide to connect with the Marketing Dashboard. These APIs are designed to help understand user behavior, track character performance, analyze revenue, and drive platform growth.

**Base URL:** `https://app.chatlamix.com`

**Authentication:** All marketing APIs require API key authentication via header:
```
Authorization: Bearer <api_key>
```

---

## 1. Platform Overview APIs

### 1.1 GET `/api/marketing/dashboard/summary`
**Purpose:** Get comprehensive platform metrics summary for the main dashboard view.

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 15000,
      "newUsersToday": 125,
      "newUsersThisWeek": 850,
      "newUsersThisMonth": 3500,
      "userGrowthRate": 12.5,
      "activeUsersToday": 2500,
      "activeUsersThisWeek": 8000,
      "monthlyActiveUsers": 12000
    },
    "characters": {
      "totalCharacters": 5000,
      "publicCharacters": 3500,
      "privateCharacters": 1500,
      "newCharactersThisWeek": 200,
      "characterGrowthRate": 8.2
    },
    "engagement": {
      "totalMessages": 1500000,
      "messagesToday": 25000,
      "messagesThisWeek": 150000,
      "averageMessagesPerUser": 100,
      "averageSessionDuration": "15:30",
      "totalImagesGenerated": 500000,
      "imagesGeneratedToday": 8000
    },
    "revenue": {
      "totalRevenue": 50000.00,
      "revenueToday": 500.00,
      "revenueThisWeek": 3500.00,
      "revenueThisMonth": 12000.00,
      "revenueGrowthRate": 15.3,
      "averageRevenuePerUser": 3.33,
      "premiumUsers": 1500,
      "premiumConversionRate": 10.0
    },
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

## 3. Character Analytics APIs

### 3.1 GET `/api/marketing/characters/stats`
**Purpose:** Overall character statistics.

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

### 3.2 GET `/api/marketing/characters/top-performing`
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

### 3.3 GET `/api/marketing/characters/categories`
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

### 3.4 GET `/api/marketing/characters/engagement`
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

## 5. Revenue Analytics APIs

### 5.1 GET `/api/marketing/revenue/summary`
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

### 5.2 GET `/api/marketing/revenue/timeline`
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

### 5.3 GET `/api/marketing/revenue/subscriptions`
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

### 5.4 GET `/api/marketing/revenue/conversions`
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

## 6. Creator Analytics APIs

### 6.1 GET `/api/marketing/creators/stats`
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

### 6.2 GET `/api/marketing/creators/top`
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

## 7. Content Moderation APIs

### 7.1 GET `/api/marketing/content/stats`
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

## 8. Geographic & Language APIs

### 8.1 GET `/api/marketing/geo/distribution`
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

## 9. Feature Usage APIs

### 9.1 GET `/api/marketing/features/usage`
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

## 10. Export APIs

### 10.1 GET `/api/marketing/export/users`
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

### 10.2 GET `/api/marketing/export/characters`
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

### 10.3 GET `/api/marketing/export/revenue`
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

## 11. Real-time / Webhooks

### 11.1 POST `/api/marketing/webhooks/register`
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
| **Overview** | `GET /api/marketing/dashboard/summary` | Platform summary metrics |
| **Overview** | `GET /api/marketing/dashboard/health` | Platform health check |
| **Users** | `GET /api/marketing/users/stats` | User statistics |
| **Users** | `GET /api/marketing/users/growth` | User growth timeline |
| **Users** | `GET /api/marketing/users/retention` | Retention & churn |
| **Users** | `GET /api/marketing/users/segments` | User segments |
| **Characters** | `GET /api/marketing/characters/stats` | Character statistics |
| **Characters** | `GET /api/marketing/characters/top-performing` | Top characters |
| **Characters** | `GET /api/marketing/characters/categories` | Category distribution |
| **Characters** | `GET /api/marketing/characters/engagement` | Engagement timeline |
| **Engagement** | `GET /api/marketing/engagement/messages` | Message analytics |
| **Engagement** | `GET /api/marketing/engagement/images` | Image generation stats |
| **Engagement** | `GET /api/marketing/engagement/sessions` | Session analytics |
| **Engagement** | `GET /api/marketing/engagement/favorites` | Favorite analytics |
| **Revenue** | `GET /api/marketing/revenue/summary` | Revenue summary |
| **Revenue** | `GET /api/marketing/revenue/timeline` | Revenue timeline |
| **Revenue** | `GET /api/marketing/revenue/subscriptions` | Subscription analytics |
| **Revenue** | `GET /api/marketing/revenue/conversions` | Conversion funnel |
| **Creators** | `GET /api/marketing/creators/stats` | Creator statistics |
| **Creators** | `GET /api/marketing/creators/top` | Top creators |
| **Content** | `GET /api/marketing/content/stats` | Content moderation stats |
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
