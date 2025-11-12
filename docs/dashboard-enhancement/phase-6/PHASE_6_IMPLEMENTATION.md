# Phase 6 Implementation Guide

**Project:** Dashboard Modular Refactoring - Phase 6  
**Document:** Technical Specifications & Implementation Details  
**Version:** 1.0.0  
**Date:** November 12, 2025

---

## 📋 Table of Contents

1. [Module Specifications](#module-specifications)
2. [Event Architecture](#event-architecture)
3. [Data Structures](#data-structures)
4. [API Contracts](#api-contracts)
5. [Integration Guide](#integration-guide)
6. [Performance Considerations](#performance-considerations)

---

## 🏗️ Module Specifications

### 1. Analytics Tracker (`analytics-tracker.js`)

**File Size:** ~600 lines  
**Priority:** Critical (Foundation)  
**Dependencies:** dashboard-core.js, cache-manager.js

**Core Responsibilities:**

```javascript
class AnalyticsTracker {
  // Configuration
  static init(config) {
    // config: {
    //   userId: string,
    //   sessionId: string,
    //   batchSize: number (default: 10),
    //   batchInterval: number (default: 5000ms),
    //   sampleRate: number (default: 1.0),
    //   apiEndpoint: string (default: '/api/analytics/events'),
    //   enableLocalStorage: boolean (default: true),
    //   debug: boolean (default: false)
    // }
  }

  // Core Methods
  static trackEvent(eventName, eventData, context = {}) {
    // Normalize and queue event
    // Apply sampling rules
    // Return event ID
  }

  static startSession(userId) {
    // Initialize session tracking
    // Set session start time
    // Generate session ID
  }

  static endSession() {
    // Flush pending events
    // Calculate session metrics
    // Send final batch
  }

  // Utilities
  static getSessionMetrics() {
    // Return current session metrics
  }

  static trackPagePerformance() {
    // Capture page load metrics
    // Track navigation timing
  }

  static batchEvents() {
    // Group pending events
    // Compress and send via API
  }

  static getQueueSize() {
    // Return pending events count
  }
}
```

**Event Structure:**

```javascript
{
  id: uuid(),                    // Unique event ID
  eventName: string,             // e.g., 'gallery.view'
  timestamp: number,             // Unix timestamp
  sessionId: string,             // Session identifier
  userId: string,                // User ID
  data: {                         // Event-specific data
    [key: string]: any
  },
  context: {                      // System context
    source: string,              // 'gallery', 'discovery', etc.
    referrer: string,            // Previous page/section
    userAgent: string,           // Browser info
    viewport: { width, height }  // Screen dimensions
  },
  metadata: {                     // Performance data
    captureTime: number,
    processingTime: number,
    batchId: string
  }
}
```

---

### 2. Engagement Analyzer (`engagement-analyzer.js`)

**File Size:** ~500 lines  
**Priority:** High  
**Dependencies:** analytics-tracker.js, cache-manager.js

**Core Responsibilities:**

```javascript
class EngagementAnalyzer {
  // Initialization
  static init(config) {
    // config: {
    //   scoreWeights: { ... },
    //   segmentThresholds: { ... },
    //   updateInterval: number,
    //   cacheEnabled: boolean
    // }
  }

  // Score Calculation
  static calculateEngagementScore(userId, timeWindow = '30d') {
    // Returns: { total: 0-100, components: {...} }
    // Components:
    //   - activityLevel (0-100)
    //   - contentInteraction (0-100)
    //   - socialEngagement (0-100)
    //   - sessionFrequency (0-100)
  }

  // Pattern Analysis
  static analyzeInteractionPatterns(userId, events) {
    // Returns: {
    //   favoriteContentTypes: [...],
    //   peakActivityHours: [...],
    //   averageSessionDuration: number,
    //   interactionFrequency: string,
    //   lastActiveTime: timestamp
    // }
  }

  // User Segmentation
  static identifyUserSegment(userId) {
    // Returns: {
    //   segment: 'power-user'|'active'|'casual'|'dormant',
    //   confidence: 0-1,
    //   characteristics: [...]
    // }
  }

  // Trend Analysis
  static getEngagementTrends(userId, timeRange = '30d') {
    // Returns: {
    //   trend: 'improving'|'stable'|'declining',
    //   changePercentage: number,
    //   prediction: string,
    //   dataPoints: [...]
    // }
  }

  // Utilities
  static getEngagementBreakdown(userId) {
    // Component-level engagement metrics
  }

  static compareToAverage(userId) {
    // Percentile ranking
  }

  static getPredictedLifetimeValue(userId) {
    // LTV estimation
  }
}
```

**Engagement Score Formula:**

```
Total Engagement = 
  (Activity Level × 0.30) +
  (Content Interaction × 0.35) +
  (Social Engagement × 0.20) +
  (Session Frequency × 0.15)

Where:
- Activity Level = sessions_per_week / avg_sessions_per_week * 100
- Content Interaction = actions_per_session / avg_actions * 100
- Social Engagement = (likes + shares + comments) / total_content * 100
- Session Frequency = return_rate_percentage
```

---

### 3. Personalization Engine (`personalization-engine.js`)

**File Size:** ~700 lines  
**Priority:** High  
**Dependencies:** engagement-analyzer.js, cache-manager.js

**Core Responsibilities:**

```javascript
class PersonalizationEngine {
  // Initialization
  static init(config) {
    // config: {
    //   modelType: 'collaborative'|'content-based'|'hybrid',
    //   cacheTTL: number,
    //   similarityThreshold: number,
    //   maxRecommendations: number
    // }
  }

  // Recommendations
  static getRecommendations(userId, options = {}) {
    // options: {
    //   context: 'discovery'|'gallery'|'search',
    //   limit: number (default: 10),
    //   excludeIds: string[],
    //   filters: {}
    // }
    // Returns: [{ id, title, score, reason }, ...]
  }

  // Preference Management
  static updateUserPreferences(userId, preferences) {
    // preferences: {
    //   favoriteGenres: string[],
    //   contentTypes: string[],
    //   interactionStyle: string,
    //   timeOfDay: string
    // }
  }

  static getUserPreferences(userId) {
    // Returns user preference profile
  }

  // Content Scoring
  static scoreContent(contentId, userProfile) {
    // Returns score 0-100
  }

  static getContentSimilarity(contentId1, contentId2) {
    // Returns similarity score 0-1
  }

  // Personalized Ordering
  static getPersonalizedOrder(contentList, userId, criteria = {}) {
    // Sort content based on user profile
    // Returns reordered list
  }

  // Utilities
  static trainModel(userId, feedbackData) {
    // Update recommendation model with feedback
  }

  static explainRecommendation(contentId, userId) {
    // Return reasoning for recommendation
  }
}
```

**Recommendation Algorithm (Hybrid Approach):**

```
Score(content, user) =
  (Collaborative Score × 0.4) +
  (Content-Based Score × 0.4) +
  (Popularity Score × 0.2)

Where:
- Collaborative = Users with similar engagement patterns liked this
- Content-Based = Matches user's content type preferences
- Popularity = Overall popularity weighted by recency
```

---

### 4. Analytics Dashboard (`analytics-dashboard.js`)

**File Size:** ~550 lines  
**Priority:** Medium  
**Dependencies:** analytics-tracker.js, engagement-analyzer.js, Chart.js

**Core Responsibilities:**

```javascript
class AnalyticsDashboard {
  // Initialization
  static init(containerId, config = {}) {
    // Initialize dashboard in specified container
  }

  // Chart Rendering
  static renderEngagementChart(containerId, data) {
    // Line chart showing engagement over time
  }

  static renderUserSegmentChart(containerId, segments) {
    // Pie chart showing user distribution
  }

  static renderTrendChart(containerId, trendData) {
    // Area chart showing trends
  }

  static renderHeatmapChart(containerId, heatmapData) {
    // Heatmap of activity by hour/day
  }

  // Report Generation
  static generateReport(reportType, filters = {}) {
    // reportType: 'daily'|'weekly'|'monthly'|'custom'
    // Returns: { title, data, charts, summary }
  }

  static exportToCSV(data, filename) {
    // Export analytics data to CSV
  }

  static exportToPDF(data, filename) {
    // Generate PDF report
  }

  // Real-time Updates
  static subscribeToUpdates(callback) {
    // Subscribe to real-time analytics updates
  }

  static unsubscribeFromUpdates(id) {
    // Unsubscribe from updates
  }
}
```

---

### 5. Engagement UI (`engagement-ui.js`)

**File Size:** ~400 lines  
**Priority:** Medium  
**Dependencies:** engagement-analyzer.js, PersonalizationEngine

**Core Responsibilities:**

```javascript
class EngagementUI {
  // Component Rendering
  static renderEngagementBadge(userId, containerId) {
    // Display engagement score badge
  }

  static renderEngagementChart(userId, containerId) {
    // Display engagement metrics chart
  }

  static renderRecommendationCard(recommendation, containerId) {
    // Display single recommendation
  }

  static renderRecommendationCarousel(recommendations, containerId) {
    // Display recommendation carousel
  }

  static renderUserSegmentBadge(userId, containerId) {
    // Display user segment badge
  }

  // Interactive Components
  static renderEngagementBreakdown(userId, containerId) {
    // Component breakdown visualization
  }

  static renderTrendIndicator(userId, containerId) {
    // Trend direction indicator
  }

  // Utilities
  static updateEngagementBadge(userId) {
    // Refresh engagement badge
  }

  static toggleDetailedView(containerId) {
    // Show/hide detailed metrics
  }
}
```

---

## 🔄 Event Architecture

### Event Categories

```javascript
const EventCategories = {
  // Discovery & Browsing
  DISCOVERY: {
    GALLERY_VIEW: 'discovery.gallery.view',
    SEARCH_QUERY: 'discovery.search.query',
    FILTER_APPLY: 'discovery.filter.apply',
    SORT_APPLY: 'discovery.sort.apply'
  },

  // Content Interaction
  CONTENT: {
    CHAT_OPEN: 'content.chat.open',
    IMAGE_VIEW: 'content.image.view',
    IMAGE_LIKE: 'content.image.like',
    IMAGE_SHARE: 'content.image.share',
    IMAGE_SAVE: 'content.image.save'
  },

  // Social Engagement
  SOCIAL: {
    FOLLOW_USER: 'social.follow.user',
    SHARE_CONTENT: 'social.share.content',
    COMMENT_CREATE: 'social.comment.create',
    RATE_CONTENT: 'social.rate.content'
  },

  // System Events
  SYSTEM: {
    SESSION_START: 'system.session.start',
    SESSION_END: 'system.session.end',
    PAGE_LOAD: 'system.page.load',
    ERROR_OCCURRED: 'system.error.occurred'
  }
};
```

### Event Flow Diagram

```
User Action → Capture Event → Normalize → Apply Sampling → Queue
    ↓              ↓              ↓           ↓              ↓
[User clicks]  [Raw event]  [Standard    [Include/       [Pending
              [Timestamp]    format]      Exclude]        events]
                            [Context]
                                          ↓
                                    Batch Events
                                          ↓
                                    Send to API
                                          ↓
                                    Analytics DB
                                          ↓
                                    Real-time Processing
                                          ↓
                                    Update Dashboards
```

---

## 📊 Data Structures

### User Profile Structure

```javascript
{
  userId: string,
  createdAt: timestamp,
  lastActiveAt: timestamp,
  
  // Engagement Metrics
  engagement: {
    currentScore: number,        // 0-100
    scoreHistory: [timestamp, score][],
    segment: string,             // 'power-user', 'active', etc.
    segmentSince: timestamp,
    lifetime: {
      estimatedLTV: number,
      churnRiskScore: number,    // 0-1
      predictedChurnDate: timestamp
    }
  },

  // Preferences
  preferences: {
    contentTypes: string[],
    genres: string[],
    interactionStyle: string,
    timePreference: string,
    notificationOptIn: boolean
  },

  // Behavior Patterns
  patterns: {
    peakActivityHours: number[],
    averageSessionDuration: number,
    sessionsPerWeek: number,
    preferredPlatform: string,
    typicalSessionType: string
  },

  // Interaction History (compressed)
  recentInteractions: {
    chats: [{ chatId, timestamp, duration }][],
    images: [{ imageId, action, timestamp }][],
    searches: [{ query, timestamp, resultCount }][]
  },

  // Recommendations State
  recommendations: {
    lastUpdateTime: timestamp,
    model: string,               // 'hybrid', 'collaborative', etc.
    confidenceScore: number      // 0-1
  }
}
```

### Event Schema

```javascript
{
  // Identifiers
  id: uuid,                     // Unique event ID
  eventName: string,            // Normalized event name
  sessionId: uuid,              // Session ID
  userId: string,               // User ID
  
  // Timing
  timestamp: number,            // Unix timestamp
  capturedAt: number,          // When event was captured
  processedAt: number,         // When event was processed
  
  // Event Data
  data: {
    // Event-specific fields
    [key: string]: any
  },
  
  // Context
  context: {
    source: string,             // 'gallery', 'discovery', 'chat'
    referrer: string,           // Previous page/component
    userAgent: string,
    viewport: { width, height },
    locale: string,
    isTemporaryUser: boolean
  },
  
  // Metadata
  metadata: {
    batchId: uuid,
    sequenceNumber: number,
    processingDuration: number,
    compressionRatio: number
  }
}
```

---

## 🔌 Integration Guide

### Step 1: Initialize Tracker in Dashboard Init

```javascript
// In dashboard-init.js (Phase 1)
DashboardInit.onReady(() => {
  AnalyticsTracker.init({
    userId: window.user._id,
    sessionId: generateSessionId(),
    apiEndpoint: '/api/analytics/events',
    batchSize: 10,
    batchInterval: 5000
  });

  AnalyticsTracker.startSession(window.user._id);
});
```

### Step 2: Add Event Tracking to Gallery Modules

```javascript
// In gallery-renderer-base.js
function renderGallery(items, type) {
  // Track gallery view
  AnalyticsTracker.trackEvent('gallery.view', {
    type: type,
    itemCount: items.length,
    filteredCount: items.length
  }, {
    source: 'gallery'
  });

  // ... rendering code ...
}
```

### Step 3: Initialize Personalization in Dashboard Events

```javascript
// In dashboard-events.js
DashboardEvents.on('dashboard:ready', () => {
  PersonalizationEngine.init({
    modelType: 'hybrid',
    cacheTTL: 3600000,
    maxRecommendations: 10
  });

  EngagementAnalyzer.init({
    scoreWeights: {
      activity: 0.30,
      interaction: 0.35,
      social: 0.20,
      frequency: 0.15
    }
  });
});
```

### Step 4: Update Footer with Phase 6 Imports

```html
<!-- In dashboard-footer.hbs -->
<!-- Phase 6: Analytics & Engagement System -->
<script src="/js/dashboard-modules/dashboard-analytics/analytics-tracker.js"></script>
<script src="/js/dashboard-modules/dashboard-analytics/engagement-analyzer.js"></script>
<script src="/js/dashboard-modules/dashboard-analytics/personalization-engine.js"></script>
<script src="/js/dashboard-modules/dashboard-analytics/analytics-dashboard.js"></script>
<script src="/js/dashboard-modules/dashboard-ui/engagement-ui.js"></script>
```

---

## ⚡ Performance Considerations

### Event Batching Strategy

```javascript
// Batch events to reduce API calls
- Batch Size: 10 events
- Batch Interval: 5 seconds
- Max Queue: 1000 events
- Compression: gzip (typical 70% reduction)
- Retry: Exponential backoff (1s, 2s, 4s, 8s)
```

### Sampling Strategy

```javascript
// Reduce data volume for high-frequency events
const samplingRules = {
  'gallery.view': 0.8,      // Track 80% of gallery views
  'image.view': 0.5,        // Track 50% of image views
  'mouse.move': 0.1,        // Track 10% of mouse movements (rarely used)
  default: 1.0              // Track 100% of other events
};
```

### Caching Strategy

```javascript
// Cache frequently accessed data
const cacheTTLs = {
  userProfile: 300000,           // 5 minutes
  engagementScore: 300000,       // 5 minutes
  recommendations: 600000,       // 10 minutes
  analyticsData: 3600000,        // 1 hour
  segmentData: 86400000          // 24 hours
};
```

### Database Indexing

```sql
-- Recommended indexes for analytics tables
CREATE INDEX idx_events_userId_timestamp ON events(userId, timestamp);
CREATE INDEX idx_events_eventName_timestamp ON events(eventName, timestamp);
CREATE INDEX idx_events_sessionId ON events(sessionId);
CREATE INDEX idx_userProfiles_segment ON userProfiles(segment);
CREATE INDEX idx_userProfiles_lastActive ON userProfiles(lastActiveAt);
CREATE INDEX idx_recommendations_userId ON recommendations(userId, createdAt);
```

---

**Document Version:** 1.0.0  
**Last Updated:** November 12, 2025  
**Next Review:** Post-implementation
