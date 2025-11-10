# Live Goals Widget Documentation

## Overview

The Live Goals Widget is a real-time, floating UI component that provides immediate visual feedback on user milestone progress during chat interactions in the Japanese Custom GPT application. Unlike the main Goals overlay system, this widget offers a compact, always-visible progress tracker specifically designed for in-chat milestone monitoring.

## Key Features

- **Real-time Updates**: Progress updates instantly as users send messages, generate images, or create videos
- **Compact Design**: Floating circular button that expands to show detailed progress
- **Visual Feedback**: Circular progress rings, animations, and achievement notifications
- **Mobile Responsive**: Optimized display for all screen sizes
- **Non-intrusive**: Minimal footprint that doesn't interfere with chat flow
- **Achievement Celebrations**: Animated notifications when milestones are reached

## System Architecture

### Component Structure

```
Live Goals Widget
├── Toggle Button (Collapsed State)
│   ├── Trophy Icon
│   ├── Progress Summary (x/y total)
│   └── Next Reward (+pts)
└── Expanded Panel (Detailed View)
    ├── Panel Header
    ├── Goals Grid (3 goal types)
    │   ├── Messages Goal
    │   ├── Images Goal
    │   └── Videos Goal
    └── Achievement Notification Area
```

### File Structure

1. **Frontend JavaScript** (`public/js/live-goals-widget.js`)
   - Widget initialization and state management
   - Real-time data fetching and updates
   - UI interactions and animations
   - WebSocket event handling

2. **HTML Template** (`views/partials/chat-footer.hbs`)
   - Widget HTML structure
   - Embedded CSS styling
   - SVG progress rings
   - Achievement notification elements

3. **Backend API Integration**
   - Uses existing `/api/chat-goals/:userChatId` endpoint
   - Leverages `getMilestoneGoalsData()` utility
   - Real-time updates via WebSocket notifications

## Technical Implementation

### JavaScript Class Structure

```javascript
class LiveGoalsWidget {
    constructor() {
        this.isExpanded = false;
        this.currentGoals = {
            messages: { current: 0, next: 10, milestone: 10 },
            images: { current: 0, next: 5, milestone: 5 },
            videos: { current: 0, next: 3, milestone: 3 }
        };
    }
}
```

### Core Methods

#### Data Management
- `loadInitialData()`: Fetches initial milestone progress when chat opens
- `refreshGoalData()`: Updates progress data from API
- `updateGoalDisplay()`: Processes API response and updates UI
- `resetWidget()`: Clears data when switching chats

#### UI Interactions
- `toggleExpanded()`: Shows/hides detailed progress panel
- `collapse()`: Closes the expanded panel
- `showWidget()` / `hideWidget()`: Controls widget visibility

#### Progress Updates
- `updateGoalItem()`: Updates individual goal progress with animations
- `updateToggleButtonSummary()`: Refreshes compact summary display
- `findNextMilestone()`: Calculates next milestone target

#### Real-time Features
- `handleLiveGoalsUpdate()`: Processes WebSocket milestone events
- `showMilestoneAchievement()`: Displays achievement animations
- `pulseToggleButton()`: Visual feedback for progress changes

### Data Flow

1. **Initialization**
   ```javascript
   $(document).ready(() => {
       if ($('#chat-wrapper').length > 0) {
           window.liveGoalsWidget = new LiveGoalsWidget();
       }
   });
   ```

2. **Chat Session Start**
   ```javascript
   $(document).on('chatOpened', () => {
       setTimeout(() => {
           window.liveGoalsWidget.loadInitialData();
       }, 500);
   });
   ```

3. **Progress Updates**
   ```javascript
   // Triggered by user actions (messages, image/video generation)
   this.refreshGoalData(); // Fetches latest progress
   this.updateGoalDisplay(data, true); // Updates UI with animation
   ```

4. **Real-time Events**
   ```javascript
   // WebSocket milestone achievement
   fastify.sendNotificationToUser(userId, 'milestoneAchieved', data);
   // Frontend handles the event
   this.handleMilestoneAchieved(data);
   ```

## UI Components

### Toggle Button (Collapsed State)

**Visual Design:**
- **Size**: 60px × 60px circular button (50px on mobile)
- **Position**: Fixed right side, vertically centered
- **Background**: Blue gradient with subtle shadow and border
- **Content**: Trophy icon, progress summary (x/y), next reward (+pts)

**Interactive Effects:**
- Hover: Scale up 10%, enhanced glow
- Click: Brief scale down animation
- Progress update: Pulse animation
- Shine effect on hover

### Expanded Panel

**Layout:**
- **Size**: 280px wide (250px on mobile)
- **Position**: Left of toggle button with smooth slide animation
- **Background**: Semi-transparent white with blur backdrop
- **Structure**: Header + 3 goal cards in vertical layout

**Goal Cards:**
Each goal type has a dedicated card showing:
- **Progress Ring**: SVG circular progress indicator
- **Icon**: Type-specific icon (chat, image, video)
- **Count**: Current/next milestone display
- **Label**: Goal type name
- **Reward**: Points earned for next milestone

### Progress Rings

**Technical Implementation:**
```html
<svg class="progress-ring" width="50" height="50">
    <circle class="progress-ring-circle" 
            cx="25" cy="25" r="20" 
            fill="transparent" 
            stroke="#e9ecef" 
            stroke-width="4"/>
    <circle class="progress-ring-progress" 
            cx="25" cy="25" r="20" 
            fill="transparent" 
            stroke="#007bff" 
            stroke-width="4"
            stroke-dasharray="125.6"
            stroke-dashoffset="125.6"/>
</svg>
```

**Animation Logic:**
```javascript
const circumference = 2 * Math.PI * 20; // r=20
const progressPercent = Math.min(current / next, 1);
const offset = circumference * (1 - progressPercent);
progressCircle.css('stroke-dashoffset', offset);
```

### Visual States

#### Goal Card States
1. **Default**: Light gray background, neutral colors
2. **Near Completion** (≥80%): Yellow accent, warning border
3. **Completed**: Green accent, checkmark display
4. **Updating**: Brief scale and color animation

#### Progress Colors
- **Messages**: Blue (#007bff) - Communication theme
- **Images**: Green (#28a745) - Creation theme  
- **Videos**: Red (#dc3545) - Media theme

## Animation System

### Achievement Notifications

**Trigger Conditions:**
```javascript
if (next && current >= next && prevCurrent < next) {
    this.showMilestoneAchievement(type, next, reward);
}
```

**Animation Sequence:**
1. **Appearance**: Slide up from bottom with bounce effect
2. **Content**: Trophy icon with bounce, milestone text, reward points
3. **Duration**: 4 seconds display time
4. **Dismissal**: Fade out with slide down

**CSS Implementation:**
```css
@keyframes achievementPop {
    0% { transform: translateY(100%) scale(0.8); opacity: 0; }
    20% { transform: translateY(-10px) scale(1.1); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
}
```

### Progress Updates

**Update Animation:**
```css
@keyframes goal-update-pulse {
    0% { transform: translateX(0) scale(1); }
    50% { transform: translateX(4px) scale(1.02); background: rgba(0, 123, 255, 0.1); }
    100% { transform: translateX(0) scale(1); }
}
```

**Button Pulse:**
```css
@keyframes button-pulse {
    0% { transform: translateY(-50%) scale(1); }
    50% { transform: translateY(-50%) scale(1.1); }
    100% { transform: translateY(-50%) scale(1); }
}
```

## API Integration

### Primary Endpoint

**GET** `/api/chat-goals/:userChatId`

**Response Structure:**
```json
{
    "currentGoal": {...},
    "completedGoals": [...],
    "goalStatus": null,
    "goalCreatedAt": "2024-01-01T00:00:00.000Z",
    "goalsEnabled": true,
    "milestoneGoals": {
        "images": {
            "type": "images",
            "icon": "bi-image",
            "current": 3,
            "next": 5,
            "progress": 60,
            "isCompleted": false,
            "reward": 25,
            "title": "Image Generation",
            "description": "Generate 5 images"
        },
        "videos": {
            "type": "videos",
            "icon": "bi-play-circle", 
            "current": 1,
            "next": 3,
            "progress": 33.33,
            "isCompleted": false,
            "reward": 50,
            "title": "Video Generation",
            "description": "Generate 3 videos"
        },
        "messages": {
            "type": "messages",
            "icon": "bi-chat-dots",
            "current": 7,
            "next": 10,
            "progress": 70,
            "isCompleted": false,
            "reward": 25,
            "title": "Messages Sent", 
            "description": "Send 10 messages"
        }
    },
    "completedMilestones": [...]
}
```

### Data Processing

**Frontend Data Mapping:**
```javascript
updateGoalDisplay(data, animated = false) {
    if (data.milestoneGoals) {
        const goals = data.milestoneGoals;
        
        // Update each goal type
        if (goals.messages) {
            this.updateGoalItem('messages', 
                goals.messages.current, 
                goals.messages.next, 
                goals.messages.reward, 
                animated
            );
        }
        // Similar for images and videos...
    }
}
```

## WebSocket Integration

### Event Handling

**Milestone Achievement Events:**
```javascript
// Backend notification
fastify.sendNotificationToUser(userId, 'milestoneAchieved', {
    type: 'character_image_milestone',
    points: 25,
    message: '5 images milestone!',
    milestone: 5,
    totalCount: 5
});

// Frontend handling
handleLiveGoalsUpdate(data) {
    if (data.notification && data.notification.type === 'milestoneAchieved') {
        this.refreshGoalData();
        return true;
    }
    return false;
}
```

**Points Update Events:**
```javascript
$(document).on('pointsUpdate', (e, data) => {
    this.refreshGoalData();
});
```

## Mobile Responsiveness

### Breakpoint Adjustments

**Desktop (>768px):**
- Toggle button: 60px × 60px
- Panel width: 280px
- Full icon sizes and spacing

**Mobile (≤768px):**
- Toggle button: 50px × 50px  
- Panel width: 250px
- Reduced icon sizes and padding
- Adjusted progress ring dimensions

**CSS Media Query:**
```css
@media (max-width: 768px) {
    .live-goals-floating {
        right: 10px;
    }
    
    .goals-toggle-btn {
        width: 50px;
        height: 50px;
    }
    
    .goals-expanded-panel {
        width: 250px;
        right: 60px;
        padding: 12px;
    }
}
```

## Dark Mode Support

### Automatic Theme Detection

**CSS Implementation:**
```css
@media (prefers-color-scheme: dark) {
    .goals-expanded-panel {
        background: rgba(33, 37, 41, 0.98);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .goals-panel-title {
        color: #f8f9fa;
    }
    
    .goal-item-compact {
        background: rgba(255, 255, 255, 0.05);
    }
}
```

## Performance Optimizations

### Data Fetching Strategy

1. **Lazy Loading**: Widget only loads data when chat is active
2. **Debounced Updates**: Prevents excessive API calls during rapid actions  
3. **Cached State**: Maintains current progress in memory
4. **Selective Updates**: Only refreshes when milestones change

### Animation Performance

1. **CSS Transitions**: Uses GPU-accelerated transforms
2. **RequestAnimationFrame**: Smooth progress bar updates
3. **Cleanup**: Removes event listeners on widget destruction

### Memory Management

```javascript
resetWidget() {
    // Clear current state
    this.currentGoals = {
        messages: { current: 0, next: 10, milestone: 10 },
        images: { current: 0, next: 5, milestone: 5 },
        videos: { current: 0, next: 3, milestone: 3 }
    };
    
    // Reset UI state
    this.collapse();
    this.hideWidget();
    
    // Load fresh data
    setTimeout(() => {
        this.loadInitialData();
    }, 100);
}
```

## Integration Points

### Chat System Integration

**Event Listeners:**
```javascript
$(document).on('chatOpened', () => {
    if (window.liveGoalsWidget) {
        setTimeout(() => {
            window.liveGoalsWidget.loadInitialData();
        }, 500);
    }
});

$(document).on('chatClosed', () => {
    if (window.liveGoalsWidget) {
        window.liveGoalsWidget.hideWidget();
    }
});
```

### Milestone System Integration

**Automatic Updates:**
- Message sending triggers progress refresh
- Image generation updates image milestones  
- Video creation updates video milestones
- WebSocket events provide real-time notifications

### Toolbar Integration

**Optional Programmatic Control:**
```javascript
window.toggleGoalsWidget = function() {
    if (window.liveGoalsWidget) {
        window.liveGoalsWidget.toggleExpanded();
    }
};
```

## Error Handling

### API Error Management

```javascript
async loadInitialData() {
    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[LiveGoals] API Error:', response.status, errorText);
            return;
        }
        
        const data = await response.json();
        if (data.success) {
            this.updateGoalDisplay(data);
            this.showWidget();
        }
    } catch (error) {
        console.error('[LiveGoals] Network Error:', error);
    }
}
```

### Graceful Degradation

1. **No UserChatId**: Widget hides automatically
2. **API Failure**: Maintains last known state
3. **WebSocket Disconnect**: Falls back to polling
4. **Invalid Data**: Uses default milestone values

## Development Guidelines

### Adding New Goal Types

1. **Update HTML Template**: Add new goal card structure
2. **Modify JavaScript**: Include new type in `currentGoals` object
3. **Update CSS**: Add type-specific colors and icons
4. **Backend Integration**: Ensure API returns new goal type data

### Customizing Animations

1. **Modify CSS Keyframes**: Adjust timing and effects
2. **Update JavaScript Triggers**: Change animation conditions
3. **Test Performance**: Ensure smooth 60fps animations

### Styling Modifications

1. **Color Scheme**: Update CSS custom properties
2. **Sizing**: Modify dimension variables
3. **Positioning**: Adjust fixed position values
4. **Mobile Breakpoints**: Update media query conditions

## Browser Compatibility

### Supported Features

- **CSS Grid/Flexbox**: IE11+ support
- **CSS Animations**: All modern browsers
- **Fetch API**: Polyfilled for older browsers
- **WebSockets**: IE10+ support

### Progressive Enhancement

- **Fallback Styles**: Basic layout without animations
- **Feature Detection**: Graceful degradation for unsupported features
- **Performance Modes**: Reduced animations on low-end devices

## Testing Considerations

### Manual Testing Checklist

1. **Widget Visibility**: Shows/hides with chat state
2. **Progress Updates**: Real-time milestone tracking
3. **Animations**: Smooth transitions and effects
4. **Responsiveness**: Proper display across screen sizes
5. **Achievement Notifications**: Proper milestone celebration
6. **Error States**: Graceful handling of API failures

### Automated Testing Opportunities

1. **API Integration**: Mock endpoint responses
2. **Event Handling**: Simulate WebSocket events  
3. **State Management**: Test widget state transitions
4. **Performance**: Monitor memory usage and render times

## Future Enhancements

### Planned Features

1. **Custom Themes**: User-selectable color schemes
2. **Animation Preferences**: Reduced motion options
3. **Sound Effects**: Optional audio feedback
4. **Gesture Support**: Touch interactions for mobile
5. **Accessibility**: Screen reader support and keyboard navigation

### Technical Improvements

1. **Virtual Scrolling**: For large milestone lists
2. **Service Worker**: Offline progress caching
3. **WebRTC**: Direct peer-to-peer milestone sharing
4. **Canvas Rendering**: High-performance progress visualizations

---

The Live Goals Widget represents a sophisticated real-time UI component that enhances user engagement through immediate visual feedback and milestone tracking. Its modular architecture, comprehensive animation system, and seamless integration with the existing milestone infrastructure make it a valuable addition to the Japanese Custom GPT application's gamification features.