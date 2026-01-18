# Quick Start Guide - Advanced Dashboard Features

Welcome to the advanced features of Chat Lamix! This guide will help you get started with the new scheduling, automation, and social publishing capabilities.

---

## 🎯 What's New?

- **My Posts Dashboard** - Manage all your generated content in one place
- **Scheduling System** - Schedule content for single or recurring publishing
- **Prompt Mutation** - Generate variations of prompts automatically
- **Social Publishing** - Auto-publish to Instagram and Twitter/X
- **Access Control** - Tier-based features with usage limits

---

## 🚀 Getting Started

### 1. Access Your Posts Dashboard

Visit: **`/dashboard/posts`**

Here you can:
- View all your generated images and videos
- Filter by type, status, and source
- Schedule content for publishing
- Delete unwanted content
- Track social media posts

### 2. Connect Social Media (Optional)

Before auto-publishing, connect your social accounts:

1. Navigate to social settings
2. Click "Connect Instagram" or "Connect Twitter"
3. Complete OAuth flow
4. Your account will be connected

**Limits**:
- Free tier: 1 connection
- Premium tier: 5 connections

---

## 📝 Using Prompt Mutations

### Generate Variations

```javascript
// Via API
POST /api/prompt-mutation/variations
{
  "prompt": "a beautiful sunset",
  "count": 5,
  "options": {
    "styleCategory": "photorealistic",
    "addQuality": true,
    "addStyleModifier": true,
    "addAdjectives": true
  }
}
```

### Create Templates

```javascript
// Via API
POST /api/prompt-templates
{
  "name": "My Anime Template",
  "basePrompt": "anime girl with",
  "category": "image",
  "styleCategory": "anime",
  "nsfw": false,
  "tags": ["anime", "character"]
}
```

### Apply Templates

```javascript
// Via API
POST /api/prompt-templates/:templateId/apply
{
  "saveToHistory": true
}
```

---

## ⏰ Scheduling Content

### Single Schedule (One-Time)

Schedule a one-time image generation:

```javascript
POST /api/schedules
{
  "type": "single",
  "actionType": "generate_image",
  "scheduledFor": "2026-01-20T10:00:00Z",
  "actionData": {
    "prompt": "a beautiful landscape",
    "model": "flux-2-flex",
    "parameters": {
      "width": 1024,
      "height": 1024
    },
    "autoPublish": false,
    "socialPlatforms": []
  }
}
```

### Recurring Schedule (Cron Job)

Schedule recurring generation with auto-publish:

```javascript
POST /api/schedules
{
  "type": "recurring",
  "actionType": "generate_image",
  "cronExpression": "0 9 * * *",  // Every day at 9 AM
  "actionData": {
    "prompt": "daily inspiration quote",
    "model": "flux-2-flex",
    "parameters": {
      "width": 1024,
      "height": 1024
    },
    "templateId": "template_id_here",
    "mutationEnabled": true,
    "autoPublish": true,
    "socialPlatforms": ["instagram", "twitter"]
  },
  "description": "Daily inspiration posts",
  "maxExecutions": 30,
  "mutationEnabled": true
}
```

**Cron Expression Examples**:
- `0 9 * * *` - Every day at 9 AM
- `0 */4 * * *` - Every 4 hours
- `0 9 * * MON` - Every Monday at 9 AM
- `0 9,15 * * *` - Every day at 9 AM and 3 PM
- `*/30 * * * *` - Every 30 minutes

---

## 📱 Social Publishing

### Auto-Publish from Schedule

Set `autoPublish: true` and specify platforms:

```javascript
{
  "autoPublish": true,
  "socialPlatforms": ["instagram", "twitter"]
}
```

### Manual Publishing

Publish an existing post:

```javascript
POST /api/schedules
{
  "type": "single",
  "actionType": "publish_post",
  "scheduledFor": "2026-01-20T15:00:00Z",
  "actionData": {
    "postId": "post_id_here"
  }
}
```

### NSFW Content Filtering

The system automatically filters NSFW content:
- Instagram: NSFW content blocked
- Twitter/X: NSFW content allowed (with warning)

---

## 🎨 Managing Your Content

### View All Posts

```javascript
GET /api/posts?type=image&status=published&page=1&limit=20
```

Filters:
- `type`: image, video
- `status`: draft, scheduled, published, failed
- `source`: image_dashboard, video_dashboard, cron_job
- `sortBy`: createdAt, updatedAt, scheduledFor
- `sortOrder`: asc, desc

### Schedule a Post

```javascript
POST /api/posts/:postId/schedule
{
  "scheduledFor": "2026-01-20T10:00:00Z"
}
```

### Cancel Schedule

```javascript
POST /api/posts/:postId/cancel-schedule
```

### Delete Post

```javascript
DELETE /api/posts/:postId
```

---

## 🔐 Feature Access & Limits

### Check Your Limits

```javascript
GET /api/features/limits
```

Response:
```json
{
  "success": true,
  "tier": "free",
  "limits": {
    "imageGeneration": 10,
    "videoGeneration": 5,
    "singleSchedules": 3,
    "recurringSchedules": 0,
    "customTemplates": 0,
    "socialConnections": 1,
    "maxPosts": 100
  }
}
```

### Check Feature Access

```javascript
GET /api/features/access/RECURRING_SCHEDULE
```

Response (if locked):
```json
{
  "success": true,
  "featureId": "RECURRING_SCHEDULE",
  "hasAccess": false,
  "reason": "tier_required",
  "message": "This feature requires premium tier",
  "requiredTier": "premium",
  "currentTier": "free",
  "upgradeRequired": true
}
```

---

## 📊 Monitoring Schedules

### View All Schedules

```javascript
GET /api/schedules?status=active&page=1
```

### Get Schedule Statistics

```javascript
GET /api/schedules/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "total": 15,
    "pending": 3,
    "active": 5,
    "completed": 4,
    "failed": 2,
    "cancelled": 1,
    "paused": 0
  }
}
```

### Pause/Resume Recurring Schedule

```javascript
POST /api/schedules/:scheduleId/pause
POST /api/schedules/:scheduleId/resume
```

---

## 🔄 Workflow Examples

### Example 1: Daily Automated Posts

1. Create a prompt template
2. Create a recurring schedule with mutation enabled
3. Set auto-publish to social media
4. Monitor in My Posts dashboard

```javascript
// 1. Create template
POST /api/prompt-templates
{
  "name": "Daily Quote",
  "basePrompt": "inspirational quote on minimalist background",
  "styleCategory": "artistic"
}

// 2. Create recurring schedule
POST /api/schedules
{
  "type": "recurring",
  "actionType": "generate_image",
  "cronExpression": "0 9 * * *",
  "actionData": {
    "templateId": "template_id",
    "model": "flux-2-flex",
    "mutationEnabled": true,
    "autoPublish": true,
    "socialPlatforms": ["instagram"]
  }
}
```

### Example 2: Batch Content Creation

1. Generate multiple images with variations
2. Review in My Posts dashboard
3. Schedule best ones for publishing

```javascript
// 1. Generate variations
POST /api/prompt-mutation/variations
{
  "prompt": "cyberpunk city at night",
  "count": 5
}

// 2. For each variation, generate image
// 3. View in /dashboard/posts
// 4. Schedule selected posts
POST /api/posts/:postId/schedule
{
  "scheduledFor": "2026-01-20T15:00:00Z"
}
```

### Example 3: Multi-Platform Campaign

1. Generate content
2. Schedule for different times per platform
3. Monitor engagement

---

## 🛠️ Troubleshooting

### Issue: Schedule not executing

**Check**:
1. Is scheduled time in the future?
2. Is cron expression valid?
3. Are you within your tier limits?
4. Check schedule status (not paused/cancelled)

### Issue: Social publishing failed

**Check**:
1. Is social account still connected?
2. Is content NSFW on Instagram?
3. Is Late.dev API key configured?
4. Check social account status

### Issue: Daily limit reached

**Solution**:
- Free tier: Upgrade to Premium
- Premium tier: Wait for daily reset (midnight UTC)
- Check limits: `GET /api/features/limits`

### Issue: Feature locked

**Solution**:
- Check your tier: `GET /api/features/limits`
- Upgrade to Premium for locked features
- Some features require age verification

---

## 📞 Support

For issues or questions:
1. Check server logs for errors
2. Verify environment variables (LATE_API_KEY)
3. Review documentation in `DASHBOARD_IMPLEMENTATION.md`
4. Test API endpoints with provided examples

---

## 🎉 Tips for Best Results

1. **Use Templates**: Create reusable templates for consistent content
2. **Enable Mutations**: Get variety in recurring posts
3. **Schedule Strategically**: Post at optimal times for engagement
4. **Monitor Limits**: Check your tier limits regularly
5. **Review Before Publishing**: Use draft status to review content
6. **Connect Social Early**: Set up social accounts before scheduling
7. **Use Filters**: Organize posts with filtering in dashboard
8. **Check Schedules**: Monitor active schedules weekly

---

## 🚀 Next Steps

1. Visit `/dashboard/posts` to see your content
2. Connect your social media accounts
3. Create your first prompt template
4. Schedule your first automated post
5. Monitor and optimize based on results

Happy creating! 🎨✨
