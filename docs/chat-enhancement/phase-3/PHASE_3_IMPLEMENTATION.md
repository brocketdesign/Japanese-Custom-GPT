# Phase 3 - Implementation Guide

**Date:** November 12, 2025  
**Status:** Complete  
**Document Type:** Technical Implementation Reference

---

## 📋 Overview

Phase 3 extends the modular chat system with Media System and UI System modules, providing specialized functionality for handling images, videos, user interactions, and navigation.

### Phase 3 Scope
- **8 new modules** created
- **2 system layers** implemented (Media + UI)
- **2,690+ lines** of specialized code
- **0 breaking changes** to existing systems

---

## 🎯 Module Implementations

### **Phase 3A: Media System Layer** (4 modules)

#### 1. `chat-image-handler.js` (335 lines)

**Purpose:** Handle all image rendering and display functionality

**Key Methods:**

```javascript
// Get image by ID
ChatImageHandler.getImageUrlById(imageId, designStep, thumbnail, actions)

// Display image asynchronously
ChatImageHandler.displayImageAsync(imageId, targetElement)

// Handle NSFW content
ChatImageHandler.handleNsfwImage(imageElement, shouldBlur)
ChatImageHandler.applyBlurEffect(imageElement)
ChatImageHandler.removeBlurEffect(imageElement)

// Generate tools
ChatImageHandler.generateImageTools(imageData)

// State management
ChatImageHandler.isImageLoaded(imageId)
ChatImageHandler.isImageFailed(imageId)
ChatImageHandler.setNsfwStatus(imageId, isNsfw)
ChatImageHandler.getImageStats()
```

**Features:**
- Lazy loading support
- NSFW blur with click-to-reveal
- Image tools generation (download, upscale, share)
- Timeout handling for slow connections
- Error tracking and reporting

**State Tracking:**
```javascript
imageState = {
  loadedImages: new Set(),      // Loaded image IDs
  nsfwImages: new Map(),        // NSFW status per image
  failedImages: new Set()       // Failed image IDs
}
```

---

#### 2. `chat-video-handler.js` (310 lines)

**Purpose:** Handle all video rendering and playback

**Key Methods:**

```javascript
// Get video by ID
ChatVideoHandler.getVideoUrlById(videoId, designStep, thumbnail)

// Display and play video
ChatVideoHandler.displayVideoAsync(videoId, targetElement)

// Create video player
ChatVideoHandler.createVideoPlayer(videoUrl, videoId)

// Tools and controls
ChatVideoHandler.generateVideoTools(videoData)
ChatVideoHandler.pauseOtherVideos(videoIdToKeepPlaying)

// State management
ChatVideoHandler.isVideoLoaded(videoId)
ChatVideoHandler.isVideoPlaying(videoId)
ChatVideoHandler.stopAllVideos()
ChatVideoHandler.getVideoStats()
```

**Features:**
- HTML5 video element creation
- Automatic format detection (MP4, WebM, MOV)
- Single-play mode (pauses others when playing)
- Video tools (download, fullscreen, share)
- Play/pause/ended event tracking
- Error handling and timeouts

**State Tracking:**
```javascript
videoState = {
  loadedVideos: new Set(),      // Loaded video IDs
  playingVideos: new Set(),     // Currently playing videos
  failedVideos: new Set()       // Failed video IDs
}
```

---

#### 3. `chat-image-upscale.js` (330 lines)

**Purpose:** Handle image upscaling with progress tracking

**Key Methods:**

```javascript
// Start upscaling process
ChatImageUpscale.upscaleImage(imageId, imageUrl, chatId, userChatId)

// Handle success/error
ChatImageUpscale.handleUpscaleSuccess(imageId, newUrl)
ChatImageUpscale.handleUpscaleError(imageId, errorMessage)

// Progress tracking
ChatImageUpscale.setUpscaleProgress(imageId, progress)
ChatImageUpscale.getUpscaleProgress(imageId)

// State checking
ChatImageUpscale.isUpscaling(imageId)
ChatImageUpscale.isImageUpscaled(imageId)
ChatImageUpscale.getUpscaledUrl(imageId)

// Stats and cleanup
ChatImageUpscale.getUpscaleStats()
ChatImageUpscale.cancelUpscaling(imageId)
ChatImageUpscale.clearUpscaleState()
```

**Features:**
- Async API calls with fetch
- Progress bar UI management
- Success/error notifications
- Loading state display
- Upscaled URL caching
- Event emission for UI updates

**API Integration:**
```javascript
POST /api/upscale-image
{
  imageId: string,
  imageUrl: string,
  chatId: string,
  userChatId: string
}

Response: {
  success: boolean,
  upscaledUrl: string,
  error?: string
}
```

---

#### 4. `chat-merge-face.js` (305 lines)

**Purpose:** Handle merge face feature display and caching

**Key Methods:**

```javascript
// Get merge face by ID
ChatMergeFace.getMergeFaceUrlById(mergeId, designStep, thumbnail)

// Display and fetch
ChatMergeFace.displayMergeFaceAsync(mergeId, targetElement)
ChatMergeFace.fetchMergeFaceResult(mergeId)

// Display helpers
ChatMergeFace.displayMergeFaceResult(imageUrl, mergeId, targetElement)
ChatMergeFace.generateMergeFaceTools(mergeData)

// Caching and state
ChatMergeFace.isMergeFaceLoaded(mergeId)
ChatMergeFace.getCachedMergeFaceData(mergeId)
ChatMergeFace.clearMergeFaceCache(mergeId)
ChatMergeFace.getMergeFaceStats()
```

**Features:**
- Async result fetching from API
- Loading state management
- Result caching with timestamps
- Merge face tools (download, preview, share)
- Error handling with user feedback
- Show/hide loading indicators

**API Integration:**
```javascript
GET /api/merge-face-result/{mergeId}

Response: {
  url: string,
  image?: string,
  error?: string
}
```

---

### **Phase 3B: UI System Layer** (4 modules)

#### 5. `chat-input-handler.js` (360 lines)

**Purpose:** Manage message input, validation, and submission

**Key Methods:**

```javascript
// Initialization
ChatInputHandler.init(options)

// Input management
ChatInputHandler.getInputValue()
ChatInputHandler.setInputValue(value)
ChatInputHandler.clearInput()
ChatInputHandler.focusInput()

// Submission
ChatInputHandler.submitMessage()

// History
ChatInputHandler.navigateHistory(direction)
ChatInputHandler.addToHistory(message)
ChatInputHandler.clearHistory()

// State
ChatInputHandler.getInputStats()
ChatInputHandler.getInputElement()
ChatInputHandler.getSendButton()
```

**Features:**
- Max length enforcement (default: 4000 chars)
- Character counter with warnings
- Input history navigation (Ctrl+↑/↓)
- Submit on Ctrl/Cmd+Enter
- IME input support (Chinese, Japanese, Korean, etc.)
- Paste content validation
- Send button state management
- Composition event handling

**Configuration:**
```javascript
config = {
  maxInputLength: 4000,
  minInputLength: 1,
  historySize: 50
}
```

**State Management:**
```javascript
inputState = {
  isComposing: false,           // IME input flag
  lastInputValue: '',           // Current value
  inputHistory: [],             // Previous messages
  historyIndex: -1,             // Navigation index
  isSending: false              // Submission flag
}
```

---

#### 6. `chat-dropdown.js` (330 lines)

**Purpose:** Reusable dropdown menu system

**Key Methods:**

```javascript
// Creation and management
ChatDropdown.createDropdown(dropdownId, actions, options)
ChatDropdown.createMessageActionMenu(messageId, actions)

// Display control
ChatDropdown.openDropdown(dropdownId, triggerElement)
ChatDropdown.closeDropdown(dropdownId)
ChatDropdown.closeAllDropdowns()

// Positioning
ChatDropdown.positionDropdown(container, trigger, menu)

// Updates
ChatDropdown.updateDropdownActions(dropdownId, newActions)
ChatDropdown.removeDropdown(dropdownId)

// State checking
ChatDropdown.isDropdownOpen(dropdownId)
ChatDropdown.getActiveDropdown()
```

**Features:**
- Reusable dropdown component
- Auto-positioning with viewport awareness
- Click-outside close functionality
- Multiple dropdowns support
- Custom action handlers
- Event-based communication
- Predefined message action menu

**Action Structure:**
```javascript
{
  id: 'like',
  label: 'Like',
  icon: '👍',
  handler: function(action, event) { ... }
}
```

**Positioning Logic:**
- Bottom-right default
- Adjusts if goes off-screen
- Repositions vertically if needed
- Prevents window overflow

---

#### 7. `chat-sharing.js` (380 lines)

**Purpose:** Message and chat sharing functionality

**Key Methods:**

```javascript
// Sharing
ChatSharing.shareMessage(messageId, content, options)
ChatSharing.shareChat(chatId, options)

// Link generation
ChatSharing.generateShareLink(chatId, options)
ChatSharing.createShortLink(longUrl)

// Dialogs
ChatSharing.showShareDialog(itemId, shareData)
ChatSharing.shareToSocial(platform, shareData, shareUrl)

// Clipboard
ChatSharing.copyToClipboard(text)

// Utilities
ChatSharing.recordShare(itemId, method)
ChatSharing.getShareStats()
```

**Features:**
- Native share API with fallback
- Social media integration (Twitter, Facebook, WhatsApp)
- Share dialog with multiple options
- Copy-to-clipboard functionality
- Short link generation via API
- Share event tracking and analytics
- User-friendly notifications

**Share Dialog:**
```javascript
// Share options provided:
- Copy link (via clipboard)
- Twitter share
- Facebook share
- WhatsApp share
- Direct link input
```

**Share Tracking:**
```javascript
sharingState = {
  sharedItems: new Map(),       // Timestamp + method
  shareLinks: new Map()         // Generated URLs
}
```

---

#### 8. `chat-navigation.js` (340 lines)

**Purpose:** Chat display and navigation management

**Key Methods:**

```javascript
// Initialization
ChatNavigation.init(options)

// Display control
ChatNavigation.showChat(options)
ChatNavigation.hideChat(options)
ChatNavigation.toggleChatVisibility()

// Navigation
ChatNavigation.navigateToChat(chatId, options)
ChatNavigation.goBack()
ChatNavigation.goHome()

// State management
ChatNavigation.getNavigationState()
ChatNavigation.getNavigationHistory()
ChatNavigation.clearNavigationHistory()

// UI updates
ChatNavigation.updateNavigationButtonsState()
ChatNavigation.setBackButtonEnabled(enabled)
ChatNavigation.getChatContainer()
```

**Features:**
- Smooth show/hide animations
- Navigation history tracking
- Browser history integration (popstate)
- Back button functionality
- Home navigation
- Animation duration customization
- State-aware button management

**Animation:**
```javascript
config = {
  chatContainerId: 'chatContainer',
  showAnimationDuration: 300,   // ms
  hideAnimationDuration: 300    // ms
}
```

**Navigation State:**
```javascript
navigationState = {
  isChatVisible: true,
  previousChat: null,
  navigationHistory: []
}
```

---

## 🔄 Integration with Phase 1 & 2

### Dependency Chain:
```
Phase 3 (Media & UI)
  ↓ depends on
Phase 2 (Message System)
  ↓ depends on
Phase 1 (Core Foundation)
  ↓ depends on
Core APIs (State, Router, Initializer)
```

### Module Access Pattern:
```javascript
// All Phase 3 modules can access:
window.ChatState              ← State management (Phase 1)
window.ChatRouter             ← URL routing (Phase 1)
window.ChatInitializer        ← Initialization (Phase 1)

// Media modules can use:
window.ChatMessageDisplay     ← Message rendering (Phase 2)
window.ChatMessageFormatter   ← Text formatting (Phase 2)
window.ChatMessageStream      ← Streaming (Phase 2)

// UI modules support:
Custom events for parent modules
History API for navigation
Clipboard API for sharing
```

---

## 🚀 Script Load Order

**In `chat.hbs` (Correct Order):**

```html
<!-- Phase 1: Core (independent) -->
<script src="/js/chat-modules/core/chat-state.js"></script>
<script src="/js/chat-modules/core/chat-routing.js"></script>
<script src="/js/chat-modules/core/chat-init.js"></script>

<!-- Phase 2: Message System (depends on Phase 1) -->
<script src="/js/chat-modules/message/chat-message-formatter.js"></script>
<script src="/js/chat-modules/message/chat-message-display.js"></script>
<script src="/js/chat-modules/message/chat-message-stream.js"></script>
<script src="/js/chat-modules/message/chat-message-history.js"></script>

<!-- Phase 3: Media (depends on Phase 1 & 2) -->
<script src="/js/chat-modules/media/chat-image-handler.js"></script>
<script src="/js/chat-modules/media/chat-video-handler.js"></script>
<script src="/js/chat-modules/media/chat-image-upscale.js"></script>
<script src="/js/chat-modules/media/chat-merge-face.js"></script>

<!-- Phase 3: UI (depends on Phase 1 & 2) -->
<script src="/js/chat-modules/ui/chat-input-handler.js"></script>
<script src="/js/chat-modules/ui/chat-dropdown.js"></script>
<script src="/js/chat-modules/ui/chat-sharing.js"></script>
<script src="/js/chat-modules/ui/chat-navigation.js"></script>

<!-- Orchestrator (depends on all phases) -->
<script src="/js/chat-modules/chat-core.js"></script>

<!-- Fallback (legacy) -->
<script src="/js/chat.js"></script>
```

---

## ⚠️ Error Handling

All Phase 3 modules implement:

1. **Try-Catch Blocks** - Wraps all public methods
2. **Validation** - Input parameter checking
3. **Fallbacks** - Graceful degradation when APIs unavailable
4. **Logging** - Debug logs for development
5. **User Feedback** - Notifications for failures

Example:
```javascript
function displayImageAsync(imageId, targetElement) {
  return new Promise((resolve, reject) => {
    try {
      if (!targetElement) {
        reject(new Error('Target element is required'));
        return;
      }
      // ... implementation
    } catch (error) {
      imageState.failedImages.add(imageId);
      reject(error);
    }
  });
}
```

---

## 📊 Module Registry

All Phase 3 modules register with ChatCore:

```javascript
// In each module file:
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
  window.ChatCore.registerModule('ModuleName', window.ModuleName);
}

// Then accessible via:
ChatCore.getModule('moduleKey')
ChatCore.hasModule('moduleKey')
```

**Phase 3 Registry Entries:**
- `imageHandler` → ChatImageHandler
- `videoHandler` → ChatVideoHandler
- `imageUpscale` → ChatImageUpscale
- `mergeFace` → ChatMergeFace
- `inputHandler` → ChatInputHandler
- `navigation` → ChatNavigation
- `sharing` → ChatSharing
- `dropdown` → ChatDropdown

---

## ✅ Testing Checklist

- [ ] All 8 modules load without errors
- [ ] Global window objects created correctly
- [ ] Chat-core orchestration works
- [ ] Module registry populated
- [ ] No conflicts with chat.js functions
- [ ] Image loading works with async
- [ ] Video playback functional
- [ ] Upscaling API calls succeed
- [ ] Input validation working
- [ ] Dropdowns position correctly
- [ ] Sharing dialogs display
- [ ] Navigation animations smooth
- [ ] Error handling catches issues
- [ ] No memory leaks from state
- [ ] Browser console clean

---

**Status:** ✅ Implementation Complete  
**Ready for:** Testing & Validation  
**Next Phase:** Phase 4 (API Integration System)
