# Milestone Goals System Documentation

## Overview

The Milestone Goals System is a comprehensive gamification feature that tracks user engagement across different activities in the Japanese Custom GPT application. It provides character-specific goals with progressive milestones, automatic reward distribution, and real-time progress tracking.

## System Architecture

### Dual Milestone Structure

The system implements a **dual milestone structure** with different tracking scopes:

- **Global Milestones**: Track total images/videos across ALL characters (higher thresholds)
- **Character-Specific Milestones**: Track activities per individual character (lower thresholds)

**Important**: Messages are ONLY tracked per character - there are NO global message milestones.

### Core Components

1. **User Points Utils** (`models/user-points-utils.js`)
   - Milestone reward functions
   - Progress tracking utilities
   - Points distribution system

2. **Chat Tool Goals Utils** (`models/chat-tool-goals-utils.js`)
   - Milestone goals data retrieval
   - Character-specific progress calculation
   - Completed milestones management

3. **API Endpoints** (`routes/chat-tool-goals-api.js`)
   - REST API for milestone data
   - Real-time goal updates
   - Settings management

4. **Frontend Manager** (`public/js/chat-tool-goals.js`)
   - UI rendering and interactions
   - Progress visualization
   - Real-time updates via WebSocket

5. **Templates & Styling** (`views/partials/chat-footer.hbs`)
   - Responsive UI components
   - Progress bars and animations
   - Mobile-optimized design

## Milestone Types

### Global Milestones (Across All Characters) 🌍

Track overall user engagement across the entire platform. **Messages are NOT tracked globally** - only images and videos have global milestones.

#### 1. Global Image Generation Milestones 🖼️
**Thresholds**: 15, 30, 50, 100, 250, 500, 1000 images  
**Point Rewards**:
- 15 images: 50 points
- 30 images: 75 points
- 50 images: 100 points
- 100 images: 200 points
- 250 images: 350 points
- 500 images: 500 points
- 1000 images: 1000 points

#### 2. Global Video Generation Milestones ▶️
**Thresholds**: 15, 30, 50, 100, 250, 500 videos  
**Point Rewards**:
- 15 videos: 100 points
- 30 videos: 150 points
- 50 videos: 250 points
- 100 videos: 400 points
- 250 videos: 750 points
- 500 videos: 1200 points

### Character-Specific Milestones (Per Chat) 👤

Track engagement with individual characters, displayed in the chat goals tab.

#### 1. Character Image Generation Milestones 🖼️
**Icon**: `bi-image`  
**Thresholds**: 5, 10, 25, 50, 100 images per character  
**Point Rewards**:
- 5 images: 25 points
- 10 images: 35 points
- 25 images: 60 points
- 50 images: 100 points
- 100 images: 200 points

#### 2. Character Video Generation Milestones ▶️
**Icon**: `bi-play-circle`  
**Thresholds**: 3, 5, 10, 20, 50 videos per character  
**Point Rewards**:
- 3 videos: 50 points
- 5 videos: 75 points
- 10 videos: 100 points
- 20 videos: 200 points
- 50 videos: 400 points

#### 3. Character Message Count Milestones 💬
**Icon**: `bi-chat-dots`  
**Thresholds**: 10, 25, 50, 100, 250 messages per character  
**Point Rewards**:
- 10 messages: 25 points
- 25 messages: 35 points
- 50 messages: 60 points
- 100 messages: 100 points
- 250 messages: 200 points

**Message Types Counted**:
- Manual messages (typed by user)
- Suggestion messages (selected from chat suggestions)
- Both message types contribute equally to milestone progress

**Note**: Messages are ONLY tracked per character - there are no global message milestones.

**Base Rewards**: No base points awarded - only milestone achievements give rewards

## Technical Implementation

### Message Tracking

**All user messages (manual and suggestions) are tracked equally for milestone purposes:**
- Manual messages: Typed by user and sent via `/api/chat/add-message`
- Suggestion messages: Selected from suggested responses via `/api/chat-suggestions/send`
- Both trigger the same `awardCharacterMessageMilestoneReward()` function
- Both count toward character-specific message milestones (10, 25, 50, 100, 250 messages)

### Milestone Tracking Flow

1. **User Action Trigger**
   - Image generation: `generateImg()` → `saveImageToDB()` → `awardImageMilestoneReward()` (global) + `awardCharacterImageMilestoneReward()` (character-specific)
   - Video generation: `generateVideoFromImage()` → `saveVideoToDB()` → `awardVideoMilestoneReward()` (global) + `awardCharacterVideoMilestoneReward()` (character-specific)
   - Message sent (manual): `/api/chat/add-message` → `awardCharacterMessageMilestoneReward()` (character-specific only - no global)
   - Message sent (suggestion): `/api/chat-suggestions/send` → `awardCharacterMessageMilestoneReward()` (character-specific only - no global)

2. **Progress Calculation**
   ```javascript
   // Image count from gallery collection
   const userGallery = await galleryCollection.findOne({ userId });
   const totalImages = userGallery?.images?.length || 0;
   
   // Video count from userChat messages
   const videoPipeline = [
     { $match: { userId: new ObjectId(userId) } },
     { $unwind: { path: '$messages' } },
     { $match: { 'messages.video_url': { $exists: true, $ne: null } } },
     { $group: { _id: null, totalVideos: { $sum: 1 } } }
   ];
   
   // Message count per character (NO GLOBAL MESSAGE TRACKING)
   const messagePipeline = [
     { $match: { userId: new ObjectId(userId), chatId: new ObjectId(chatId) } },
     { $unwind: { path: '$messages' } },
     { $match: { 'messages.role': 'user' } },
     { $group: { _id: null, totalMessages: { $sum: 1 } } }
   ];
   const result = await userChatCollection.aggregate(messagePipeline).toArray();
   const totalMessages = result[0]?.totalMessages || 0;
   ```

3. **Milestone Detection**
   ```javascript
   const milestone = milestones[currentCount];
   if (milestone && !alreadyGranted) {
     await awardPoints(userId, milestone.points, milestone.message);
     await recordMilestone(userId, type, currentCount, milestone.points);
   }
   ```

4. **Real-time Updates**
   ```javascript
   // WebSocket notifications
   fastify.sendNotificationToUser(userId, 'milestoneAchieved', {
     type: 'image_milestone',
     points: milestone.points,
     message: milestone.message,
     totalCount: currentCount
   });
   ```

### Database Collections

#### `user_milestones`
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: 'image_milestone' | 'video_milestone' | 'character_image_milestone' | 'character_video_milestone' | 'character_message_milestone',
  milestone: Number, // threshold reached (e.g., 5, 10, 25)
  points: Number,
  message: String,
  chatId: ObjectId, // for character-specific milestones only
  grantedAt: Date
}
```

#### `points_history`
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  type: 'credit' | 'debit',
  points: Number,
  reason: String,
  source: 'image_milestone' | 'video_milestone' | 'character_image_milestone' | 'character_video_milestone' | 'character_message_milestone' | 'image_generation' | 'video_generation',
  createdAt: Date
}
```

### API Endpoints

#### Get Milestone Goals
```
GET /api/chat-goals/:userChatId
```
Returns:
- Current conversation goal
- Milestone goals with progress
- Completed milestones
- Goals enabled setting

#### Get Character-Specific Milestones
```
GET /api/milestone-goals/:chatId
```
Returns:
- Character-specific milestone progress
- Completed milestones for the character
- Next milestone thresholds

#### Toggle Goals Setting
```
POST /api/chat-goals/goals-enabled
Body: { chatId, enabled }
```

## Frontend Implementation

### Goals Display Structure

```html
<!-- Milestone Goals Section (Character-specific goals) -->
<div class="milestone-goals-section">
  <h5>Character Goals</h5>
  <div class="milestone-goals-grid">
    <!-- Image Generation Goal Card -->
    <div class="milestone-goal-card">
      <div class="goal-header">
        <i class="bi bi-image"></i>
        <span class="badge">5/10</span>
      </div>
      <div class="progress-bar">
        <div class="progress" style="width: 50%"></div>
      </div>
      <div class="goal-info">
        <span>Generate 10 images</span>
        <span class="reward">+30 points</span>
      </div>
    </div>
    <!-- Similar cards for Video and Messages -->
  </div>
</div>
```

### Progress Calculation
```javascript
const getNextMilestone = (current, milestones) => {
  const next = milestones.find(m => m > current);
  const previous = milestones.filter(m => m <= current).pop() || 0;
  return {
    current,
    next: next || milestones[milestones.length - 1],
    previous,
    progress: next ? (current / next) * 100 : 100,
    isCompleted: !next
  };
};
```

### Styling Features
- **Responsive Grid Layout**: Adapts to different screen sizes
- **Progress Animations**: Smooth progress bar transitions with shimmer effects
- **Hover Effects**: Interactive cards with transform and shadow effects
- **Dark Mode Support**: Automatic color scheme adaptation
- **Achievement Animations**: Slide-in animations for completed milestones

## Real-time Updates

### WebSocket Events

1. **Milestone Achievement**
   ```javascript
   fastify.sendNotificationToUser(userId, 'milestoneAchieved', {
     type: 'image_milestone',
     points: 50,
     message: '25 images milestone!',
     milestone: 25,
     totalCount: 25
   });
   ```

2. **Points Update**
   ```javascript
   fastify.sendNotificationToUser(userId, 'pointsUpdate', {
     userId: userId,
     points: updatedUser.points,
     change: pointsAwarded
   });
   ```

3. **Goals Refresh**
   ```javascript
   // Frontend listens for these events and refreshes goals display
   socket.on('milestoneAchieved', (data) => {
     showAchievementNotification(data);
     refreshGoalsDisplay();
   });
   ```

## Configuration & Customization

### Milestone Thresholds
Easily customizable in `user-points-utils.js`:
```javascript
const milestones = {
  1: { points: 10, message: 'First image generated!' },
  5: { points: 20, message: '5 images milestone!' },
  // Add or modify thresholds as needed
};
```

### Point Rewards
Adjust reward amounts in the milestone definitions:
```javascript
const baseReward = 5; // Points per image
const milestoneMultiplier = 2; // Bonus multiplier for milestones
```

### UI Customization
Modify CSS in `chat-footer.hbs`:
```css
.milestone-goal-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 249, 250, 0.95));
  border: 2px solid rgba(13, 110, 253, 0.15) !important;
  transition: all 0.3s ease;
}
```

## Troubleshooting

### Common Issues

1. **Milestones Not Updating**
   - Check if reward functions are called in the right places
   - Verify database connections
   - Check console for error logs
   - Ensure both `/api/chat/add-message` AND `/api/chat-suggestions/send` call milestone functions

2. **Progress Not Showing**
   - Ensure API endpoints return correct data structure
   - Verify frontend WebSocket connections
   - Check user permissions and authentication

3. **Duplicate Milestones**
   - The system prevents duplicates using milestone records
   - Check `user_milestones` collection for existing entries

4. **Suggestion Messages Not Counted**
   - Verify `awardCharacterMessageMilestoneReward()` is called in `/api/chat-suggestions/send`
   - Check function parameters: `(db, userId, chatId, fastify)`
   - Ensure proper ObjectId conversion for userId and chatId

### Debug Commands

```javascript
// Check user's milestone progress
const progress = await getUserMilestoneProgress(db, userId, chatId);
console.log('Milestone progress:', progress);

// Check completed milestones
const completed = await getCompletedMilestones(db, userId, chatId, 20);
console.log('Completed milestones:', completed);

// Verify milestone data structure
const milestoneGoals = await getMilestoneGoalsData(db, userId, chatId);
console.log('Milestone goals:', milestoneGoals);
```

## Performance Considerations

### Optimization Strategies

1. **Batch Updates**: Milestone checks are performed after successful actions
2. **Duplicate Prevention**: Database queries prevent duplicate milestone awards
3. **Efficient Queries**: Aggregation pipelines for counting activities
4. **Caching**: Frontend caches milestone data to reduce API calls

### Monitoring

- Track milestone achievement rates
- Monitor API response times
- Log failed milestone awards for investigation
- Monitor WebSocket connection stability

## Future Enhancements

### Planned Features

1. **Custom Milestones**: User-defined goals and thresholds
2. **Team Challenges**: Collaborative milestone achievements
3. **Seasonal Events**: Time-limited milestone campaigns
4. **Achievement Badges**: Visual rewards beyond points
5. **Leaderboards**: Competitive milestone rankings
6. **Analytics Dashboard**: Detailed progress tracking and insights

### API Extensions

- Milestone predictions based on user activity
- Difficulty adjustment based on user engagement
- Cross-character milestone tracking
- Integration with external gamification platforms

---

This system provides a comprehensive gamification layer that encourages user engagement while maintaining a smooth, responsive user experience. The modular architecture allows for easy expansion and customization as the application grows.