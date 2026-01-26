# Character Follow Notifications Integration Guide

## Overview
This guide explains how to integrate the character follow notification system into the existing image and video generation workflows.

## Files Created
- `/models/character-followers-utils.js` - Core follower management utilities
- `/models/character-followers-notifications.js` - Notification helpers
- `/routes/character-followers-api.js` - API endpoints for following
- `/public/js/character-followers.js` - Frontend JavaScript module
- CSS and UI updates in `/views/character.hbs` and `/public/css/character.css`

## Integration Points

### 1. Image Generation Notification

When an image is successfully generated and saved to the gallery, add a notification call:

```javascript
// In routes/stability.js, models/imagen.js, or wherever images are saved to gallery
const { onImageCreated } = require('../models/character-followers-notifications');

// After image is successfully saved to gallery
await onImageCreated(db, chatId, {
  imageUrl: imageUrl,
  thumbnailUrl: thumbnailUrl || imageUrl,
  title: imageTitle || 'New image'
});
```

**Recommended locations:**
- `models/imagen.js` - After image task completion and gallery update
- `routes/dashboard-integration-api.js` - After Civitai image integration
- `routes/merge-face-api.js` - After face merge completion
- Any other route that adds images to the gallery

### 2. Video Generation Notification

When a video is successfully generated and saved, add a notification call:

```javascript
// In routes/img2video-api.js, routes/dashboard-video.js, or wherever videos are saved
const { onVideoCreated } = require('../models/character-followers-notifications');

// After video is successfully saved
await onVideoCreated(db, chatId, {
  videoUrl: videoUrl,
  thumbnailUrl: thumbnailUrl,
  title: videoTitle || 'New video'
});
```

**Recommended locations:**
- `routes/img2video-api.js` - After video generation completes (look for status === 'completed')
- `routes/dashboard-video.js` - After video upload or generation

### 3. Finding the Right Integration Points

#### For Images:
Look for code patterns like:
```javascript
await galleryCollection.updateOne(
  { userId, chatId },
  { $push: { images: newImage } }
);
// ADD NOTIFICATION HERE
```

Or after task completion:
```javascript
await tasksCollection.updateOne(
  { taskId },
  { $set: { status: 'completed' } }
);
// ADD NOTIFICATION HERE (check if it's an image task)
```

#### For Videos:
Look for code patterns like:
```javascript
await videosCollection.insertOne({
  userId,
  chatId,
  videoUrl,
  // ... other fields
});
// ADD NOTIFICATION HERE
```

Or video task completion:
```javascript
if (videoTask.status === 'completed') {
  // ADD NOTIFICATION HERE
}
```

### 4. Error Handling

The notification functions are designed to fail gracefully:
- They return the number of notifications sent (0 if error or no followers)
- Errors are logged but don't interrupt the main flow
- Safe to call without try-catch, but you can add it for logging:

```javascript
try {
  const notificationCount = await onImageCreated(db, chatId, imageData);
  console.log(`Notified ${notificationCount} followers`);
} catch (error) {
  console.error('Notification error:', error);
  // Main flow continues regardless
}
```

### 5. Testing the Integration

To verify notifications are working:

1. Follow a character (click the bell icon on character profile)
2. Generate an image or video for that character
3. Check notifications in the UI (bell icon in navigation)
4. Verify notification appears with correct content

You can also check the database directly:
```javascript
// In MongoDB shell or admin tool
db.notifications.find({ 
  type: 'info',
  'data.contentType': { $in: ['image', 'video'] }
}).sort({ createdAt: -1 }).limit(10)
```

## Database Schema

### character_followers Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,        // User who is following
  chatId: ObjectId,        // Character being followed
  createdAt: Date,         // When the follow relationship was created
  updatedAt: Date
}
```

### notifications Collection (existing, enhanced)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  title: String,
  message: String,
  type: String,           // 'info' for content notifications
  data: {
    link: String,         // Link to the content
    imageUrl: String,     // Thumbnail/preview image
    chatId: String,       // Character ID
    contentType: String   // 'image' or 'video'
  },
  viewed: Boolean,
  createdAt: String,      // ISO timestamp
  sticky: Boolean
}
```

## API Endpoints

All endpoints require authentication (non-temporary users).

### Follow/Unfollow
- `POST /character-followers/toggle` - Toggle follow status
  - Body: `{ chatId: string }`
  - Response: `{ success: boolean, isFollowing: boolean }`

- `POST /character-followers/follow` - Follow a character
  - Body: `{ chatId: string }`
  - Response: `{ success: boolean }`

- `POST /character-followers/unfollow` - Unfollow a character
  - Body: `{ chatId: string }`
  - Response: `{ success: boolean }`

### Status Checks
- `GET /character-followers/check/:chatId` - Check if following
  - Response: `{ isFollowing: boolean, chatId: string }`

- `GET /character-followers/count/:chatId` - Get follower count
  - Response: `{ count: number, chatId: string }`

### Lists
- `GET /character-followers/my-follows` - Get user's followed characters
  - Query: `{ page: number, limit: number }`
  - Response: Paginated list of characters

## Frontend Usage

```javascript
// Check if following
CharacterFollowers.checkFollow(chatId, function(isFollowing) {
  console.log('Following:', isFollowing);
});

// Toggle follow
CharacterFollowers.toggleFollow(chatId, function(response) {
  console.log('New status:', response.isFollowing);
});

// Get follower count
CharacterFollowers.getFollowerCount(chatId, function(count) {
  console.log('Followers:', count);
});
```

## Translations

Translations are available in en.json, fr.json, and ja.json under the `follow` key:

```javascript
window.translations.follow.follow           // "Follow to get notifications"
window.translations.follow.following        // "Following - Click to unfollow"
window.translations.follow.nowFollowing     // "You are now following this character"
window.translations.follow.unfollowed       // "Unfollowed character"
```

## Notes

- Notifications are only sent to non-temporary (logged in) users
- The notification system auto-purges notifications older than 30 days
- Users can dismiss notifications individually
- The follow button appears before the favorite button on character profiles
- Following a character is independent of favoriting it
