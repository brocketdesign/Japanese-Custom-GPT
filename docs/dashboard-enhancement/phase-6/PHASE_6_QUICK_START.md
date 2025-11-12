# Phase 6 Quick Start Guide

**Project:** Dashboard Modular Refactoring - Phase 6  
**Document:** Quick Reference for Implementation  
**Version:** 1.0.0  
**Date:** November 12, 2025

---

## 🚀 5-Minute Setup

### 1. Add Script Imports (✅ Already Done)

The following imports have been added to `views/partials/dashboard-footer.hbs`:

```html
<!-- Phase 6: Advanced Analytics & User Engagement System -->
<script src="/js/dashboard-modules/dashboard-analytics/analytics-tracker.js"></script>
<script src="/js/dashboard-modules/dashboard-analytics/engagement-analyzer.js"></script>
<script src="/js/dashboard-modules/dashboard-analytics/personalization-engine.js"></script>
<script src="/js/dashboard-modules/dashboard-analytics/analytics-dashboard.js"></script>
<script src="/js/dashboard-modules/dashboard-ui/engagement-ui.js"></script>
```

**Status:** ✅ Complete

---

## 📋 Implementation Checklist

### Phase 6.1: Create Core Modules

- [ ] Create `/public/js/dashboard-modules/dashboard-analytics/` directory
- [ ] Create `analytics-tracker.js` (~600 lines)
  - [ ] Implement `AnalyticsTracker.init()`
  - [ ] Implement `AnalyticsTracker.trackEvent()`
  - [ ] Implement event batching
  - [ ] Implement localStorage persistence

- [ ] Create `engagement-analyzer.js` (~500 lines)
  - [ ] Implement engagement score calculation
  - [ ] Implement pattern analysis
  - [ ] Implement user segmentation
  - [ ] Implement trend analysis

- [ ] Create `personalization-engine.js` (~700 lines)
  - [ ] Implement recommendation algorithm
  - [ ] Implement preference management
  - [ ] Implement content scoring
  - [ ] Implement model training

- [ ] Create `analytics-dashboard.js` (~550 lines)
  - [ ] Implement chart rendering
  - [ ] Implement report generation
  - [ ] Implement data export

- [ ] Create `engagement-ui.js` (~400 lines)
  - [ ] Implement UI components
  - [ ] Implement badge rendering
  - [ ] Implement carousel components

### Phase 6.2: Initialize Analytics

- [ ] Add tracker initialization to `dashboard-init.js`
  ```javascript
  DashboardInit.onReady(() => {
    AnalyticsTracker.init({
      userId: window.user._id,
      apiEndpoint: '/api/analytics/events'
    });
  });
  ```

- [ ] Add event tracking to gallery modules
- [ ] Add engagement analyzer initialization
- [ ] Add personalization engine initialization

### Phase 6.3: Integrate Events

- [ ] Add gallery view tracking
- [ ] Add chat open tracking
- [ ] Add image interaction tracking
- [ ] Add search query tracking
- [ ] Add user navigation tracking

### Phase 6.4: Backend Integration

- [ ] Create `/api/analytics/events` endpoint
- [ ] Create `/api/analytics/engagement/:userId` endpoint
- [ ] Create `/api/analytics/recommendations` endpoint
- [ ] Add database models for analytics
- [ ] Implement event processing pipeline

### Phase 6.5: Testing

- [ ] Unit tests for each module
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance tests
- [ ] Memory leak tests

---

## 🎯 Key Files to Create/Update

### New Files to Create

```
public/js/dashboard-modules/
├── dashboard-analytics/
│   ├── analytics-tracker.js
│   ├── engagement-analyzer.js
│   ├── personalization-engine.js
│   └── analytics-dashboard.js
└── dashboard-ui/
    └── engagement-ui.js

models/
├── analytics-event.js
├── user-profile.js
└── recommendation.js

routes/
├── api/
│   ├── analytics.js
│   ├── engagement.js
│   └── personalization.js

docs/dashboard-enhancement/phase-6/
├── PHASE_6_README.md ✅
├── PHASE_6_IMPLEMENTATION.md ✅
├── PHASE_6_QUICK_START.md ✅
├── PHASE_6_API_CONTRACTS.md
├── PHASE_6_MIGRATION_GUIDE.md
└── PHASE_6_TROUBLESHOOTING.md
```

### Files to Update

```
views/partials/dashboard-footer.hbs ✅
public/js/dashboard-modules/dashboard-init.js
public/js/dashboard-modules/dashboard-events.js
models/user-analytics-utils.js
package.json (dependencies)
```

---

## 💻 Quick Code Examples

### Initialize Analytics Tracker

```javascript
// In dashboard-init.js
AnalyticsTracker.init({
  userId: window.user._id,
  sessionId: generateSessionId(),
  batchSize: 10,
  batchInterval: 5000,
  apiEndpoint: '/api/analytics/events',
  debug: false
});

AnalyticsTracker.startSession(window.user._id);
```

### Track an Event

```javascript
// In gallery rendering
AnalyticsTracker.trackEvent('gallery.view', {
  galleryType: 'chat-gallery',
  itemCount: 20,
  filters: { category: 'popular' }
}, {
  source: 'discovery'
});

// In chat open
AnalyticsTracker.trackEvent('content.chat.open', {
  chatId: chatId,
  source: 'gallery'
}, {
  source: 'content'
});
```

### Get Engagement Score

```javascript
const engagementScore = EngagementAnalyzer.calculateEngagementScore(
  userId,
  '30d'
);

console.log('Engagement Score:', engagementScore.total); // 0-100
console.log('Components:', engagementScore.components);
```

### Get Recommendations

```javascript
const recommendations = await PersonalizationEngine.getRecommendations(
  userId,
  {
    context: 'discovery',
    limit: 10,
    excludeIds: [alreadyViewedId]
  }
);

// recommendations = [
//   { id, title, score: 0-100, reason: 'string' },
//   ...
// ]
```

### Initialize Analytics Dashboard

```javascript
// In admin panel
AnalyticsDashboard.init('analytics-container', {
  userId: adminUserId,
  refreshInterval: 30000,
  enableExport: true
});

// Render engagement chart
AnalyticsDashboard.renderEngagementChart(
  'engagement-chart',
  engagementData
);
```

---

## 🔗 Integration Points

### With Dashboard Core

```javascript
// Access global state
const state = DashboardState.getState();
const analyticsState = state.analytics || {};

// Subscribe to events
DashboardEvents.on('dashboard:userReady', () => {
  AnalyticsTracker.startSession(user._id);
});

DashboardEvents.on('dashboard:destroy', () => {
  AnalyticsTracker.endSession();
});
```

### With Gallery Modules

```javascript
// In gallery-renderer-base.js
class GalleryRenderer {
  static render(items, type) {
    // Track gallery view
    AnalyticsTracker.trackEvent('gallery.view', {
      type: type,
      itemCount: items.length
    });

    // Get recommendations
    const recommendations = PersonalizationEngine.getRecommendations(
      userId,
      { context: 'gallery', limit: 5 }
    );

    // Render with recommendations
    return this.renderWithRecommendations(items, recommendations);
  }
}
```

---

## 📊 Event Examples

### Gallery View Event

```javascript
{
  eventName: 'gallery.view',
  data: {
    galleryType: 'chat-gallery',
    itemCount: 20,
    filteredCount: 15,
    filters: ['active', 'new'],
    sortBy: 'popular'
  },
  context: {
    source: 'discovery',
    referrer: 'home'
  }
}
```

### Chat Open Event

```javascript
{
  eventName: 'content.chat.open',
  data: {
    chatId: 'chat-123',
    chatName: 'Character Name',
    source: 'gallery',
    recommendedBy: 'personalization',
    position: 3
  },
  context: {
    source: 'content',
    referrer: 'discovery'
  }
}
```

### Image Like Event

```javascript
{
  eventName: 'content.image.like',
  data: {
    imageId: 'img-456',
    chatId: 'chat-123',
    imageType: 'chat-generated',
    wasLiked: true
  },
  context: {
    source: 'gallery',
    referrer: 'chat'
  }
}
```

---

## 🧪 Testing Phase 6

### Manual Testing Checklist

- [ ] Events are captured correctly
- [ ] Events are batched and sent
- [ ] Engagement scores calculated accurately
- [ ] Recommendations appear relevant
- [ ] No console errors
- [ ] No memory leaks
- [ ] Performance is acceptable (< 100ms delay)

### Browser Console Commands

```javascript
// Check tracker status
AnalyticsTracker.getQueueSize()

// Get session metrics
AnalyticsTracker.getSessionMetrics()

// Get engagement score
EngagementAnalyzer.calculateEngagementScore(userId)

// Get recommendations
PersonalizationEngine.getRecommendations(userId)

// Force batch send
AnalyticsTracker.batchEvents()

// Check cache stats
AnalyticsDashboard.getCacheStats()
```

---

## 🚨 Troubleshooting

### Events Not Being Tracked

```javascript
// Check if tracker is initialized
console.log(typeof AnalyticsTracker); // Should be 'object'
console.log(AnalyticsTracker.getQueueSize()); // Should be > 0
```

### Recommendations Not Loading

```javascript
// Check if engine is initialized
console.log(typeof PersonalizationEngine); // Should be 'object'

// Check user profile
PersonalizationEngine.getUserPreferences(userId);

// Check cache
AnalyticsDashboard.getCacheStats();
```

### Performance Issues

```javascript
// Check event queue size
console.log('Queue size:', AnalyticsTracker.getQueueSize());

// Check cache usage
console.log('Cache stats:', AnalyticsDashboard.getCacheStats());

// Check batch settings
console.log('Batch interval:', config.batchInterval);
console.log('Batch size:', config.batchSize);
```

---

## 📞 Next Steps

1. **Review Documentation**
   - Read PHASE_6_README.md for architecture
   - Read PHASE_6_IMPLEMENTATION.md for specs
   - Read this guide for quick reference

2. **Create Modules**
   - Start with analytics-tracker.js
   - Add engagement-analyzer.js
   - Create personalization-engine.js
   - Add dashboard and UI modules

3. **Initialize Analytics**
   - Add tracker to dashboard-init.js
   - Add event tracking to modules
   - Test event capture

4. **Backend Integration**
   - Create analytics API endpoints
   - Add database models
   - Implement event processing

5. **Testing & Optimization**
   - Unit tests
   - Integration tests
   - Performance optimization

---

## 📎 Related Documentation

- [PHASE_6_README.md](./PHASE_6_README.md) - Architecture overview
- [PHASE_6_IMPLEMENTATION.md](./PHASE_6_IMPLEMENTATION.md) - Technical specs
- [Phase 5 Documentation](../phase-5/PHASE_5_README.md) - Previous phase
- [Dashboard Enhancement Roadmap](../../CHAT_TEMPLATE_UX_ENHANCEMENT_ROADMAP.md)

---

**Last Updated:** November 12, 2025  
**Version:** 1.0.0 - Initial Release  
**Status:** 🚀 Ready for Implementation
