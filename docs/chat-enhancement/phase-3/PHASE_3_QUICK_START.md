# Phase 3 - Quick Start Guide

**Date:** November 12, 2025  
**Status:** Ready for Development & Testing

---

## 🚀 Quick Start - 5 Minutes

### 1. Verify Phase 3 Files Exist

```bash
# Check media modules
ls -la public/js/chat-modules/media/
# Expected: chat-image-handler.js, chat-video-handler.js, 
#           chat-image-upscale.js, chat-merge-face.js

# Check UI modules  
ls -la public/js/chat-modules/ui/
# Expected: chat-input-handler.js, chat-dropdown.js,
#           chat-sharing.js, chat-navigation.js
```

### 2. Verify Script Imports in chat.hbs

```bash
grep -n "chat-modules/media" views/chat.hbs
grep -n "chat-modules/ui" views/chat.hbs
# Should show 4 media + 4 ui imports
```

### 3. Open Browser Console

Open your chat page and check:

```javascript
// These should all exist and be objects
console.log(window.ChatImageHandler)     // ✓
console.log(window.ChatVideoHandler)     // ✓
console.log(window.ChatImageUpscale)     // ✓
console.log(window.ChatMergeFace)        // ✓
console.log(window.ChatInputHandler)     // ✓
console.log(window.ChatDropdown)         // ✓
console.log(window.ChatSharing)          // ✓
console.log(window.ChatNavigation)       // ✓

// Module registry should include all Phase 3
console.log(ChatCore.modules)            // Should list all 8
```

### 4. Test Each System

#### Test Media System:
```javascript
// Test image handling
ChatImageHandler.getImageStats()

// Test video handling
ChatVideoHandler.getVideoStats()

// Test upscaling
ChatImageUpscale.getUpscaleStats()

// Test merge face
ChatMergeFace.getMergeFaceStats()
```

#### Test UI System:
```javascript
// Test input
ChatInputHandler.getInputValue()
ChatInputHandler.getInputStats()

// Test dropdown
ChatDropdown.logDropdownState()

// Test sharing
ChatSharing.getShareStats()

// Test navigation
ChatNavigation.getNavigationState()
```

---

## 📖 Common Usage Patterns

### Image Display

```javascript
// Display an image
ChatImageHandler.displayImageAsync('image-123', document.getElementById('imageContainer'))
  .then(() => console.log('Image loaded'))
  .catch(err => console.error('Image failed:', err))

// Apply NSFW blur
const img = document.querySelector('img')
ChatImageHandler.handleNsfwImage(img, true)

// Check if loaded
if (ChatImageHandler.isImageLoaded('image-123')) {
  console.log('Image is loaded')
}
```

### Video Playback

```javascript
// Display video
ChatVideoHandler.displayVideoAsync('video-456', document.getElementById('videoContainer'))

// Check if playing
if (ChatVideoHandler.isVideoPlaying('video-456')) {
  ChatVideoHandler.stopAllVideos()
}

// Get stats
console.log(ChatVideoHandler.getVideoStats())
// Output: { loaded: 1, playing: 0, failed: 0, total: 1 }
```

### Image Upscaling

```javascript
// Start upscaling
ChatImageUpscale.upscaleImage('image-789', imageUrl, chatId, userChatId)
  .then(result => {
    console.log('Upscaled:', result.upscaledUrl)
  })
  .catch(error => {
    console.error('Upscale failed:', error)
  })

// Check progress
const progress = ChatImageUpscale.getUpscaleProgress('image-789')
console.log(`Progress: ${progress}%`)
```

### Message Input

```javascript
// Get current input
const message = ChatInputHandler.getInputValue()

// Clear and focus
ChatInputHandler.clearInput()
ChatInputHandler.focusInput()

// Set value
ChatInputHandler.setInputValue('Hello!')

// Get stats
console.log(ChatInputHandler.getInputStats())
// Output: { currentLength: 6, maxLength: 4000, historySize: 5, isSending: false }
```

### Dropdowns

```javascript
// Create dropdown
const dropdown = ChatDropdown.createMessageActionMenu('msg-123', {
  like: {
    id: 'like',
    label: 'Like',
    icon: '👍',
    handler: (action) => console.log('Liked!')
  }
})

// Add to DOM
document.body.appendChild(dropdown)

// Open it
ChatDropdown.openDropdown(`message-menu-msg-123`, triggerButton)

// Close all
ChatDropdown.closeAllDropdowns()
```

### Sharing

```javascript
// Share a message
ChatSharing.shareMessage('msg-123', 'Check this out!', {
  title: 'Cool Message'
})

// Share a chat
ChatSharing.shareChat('chat-456', {
  includeMessages: true
}).then(shareUrl => {
  console.log('Share URL:', shareUrl)
})

// Copy to clipboard
ChatSharing.copyToClipboard('Some text')
```

### Navigation

```javascript
// Show/hide chat
await ChatNavigation.showChat()
await ChatNavigation.hideChat()

// Navigate to chat
ChatNavigation.navigateToChat('chat-789')

// Go back
ChatNavigation.goBack()

// Get state
console.log(ChatNavigation.getNavigationState())
// Output: { isChatVisible: true, previousChat: 'chat-456', historyLength: 2 }
```

---

## 🔧 Configuration

### Input Handler Config

```javascript
ChatInputHandler.init({
  maxInputLength: 4000,      // Max chars
  minInputLength: 1,         // Min chars
  historySize: 50            // Max history items
})
```

### Navigation Config

```javascript
ChatNavigation.init({
  chatContainerId: 'chatContainer',     // Container ID
  showAnimationDuration: 300,            // Milliseconds
  hideAnimationDuration: 300             // Milliseconds
})
```

### Image Upscale API Endpoint

Required server endpoint:
```
POST /api/upscale-image
Content-Type: application/json

{
  "imageId": "string",
  "imageUrl": "string",
  "chatId": "string",
  "userChatId": "string"
}

Response:
{
  "success": true,
  "upscaledUrl": "https://...",
  "error": null
}
```

### Merge Face API Endpoint

Required server endpoint:
```
GET /api/merge-face-result/{mergeId}

Response:
{
  "url": "https://...",
  "image": "https://...",
  "error": null
}
```

---

## 🐛 Debugging

### Enable Debug Logging

```javascript
// Each module has a debug method
ChatImageHandler.logImageState()
ChatVideoHandler.logVideoState()
ChatImageUpscale.logUpscaleState()
ChatMergeFace.logMergeFaceState()
ChatInputHandler.logInputState()
ChatDropdown.logDropdownState()
ChatSharing.logShareState()
ChatNavigation.logNavigationState()

// Also available from ChatCore
ChatCore.modules
```

### Common Issues

**Issue:** Modules not found
```javascript
// Check if they're loaded
if (!window.ChatImageHandler) {
  console.error('ChatImageHandler not loaded!')
}
```

**Issue:** Images not displaying
```javascript
// Check image state
ChatImageHandler.logImageState()
// Check for failed images
if (ChatImageHandler.isImageFailed('image-id')) {
  console.log('Image failed to load')
}
```

**Issue:** Videos won't play
```javascript
// Check video stats
console.log(ChatVideoHandler.getVideoStats())
// Check element
console.log(ChatVideoHandler.getVideoElement('video-id'))
```

**Issue:** Input not working
```javascript
// Check input handler is initialized
ChatInputHandler.logInputState()
// Verify input element exists
console.log(ChatInputHandler.getInputElement())
```

---

## 📋 Testing Checklist

### Media System Tests

- [ ] Load image successfully
- [ ] Handle image errors gracefully
- [ ] Apply NSFW blur
- [ ] Remove NSFW blur on click
- [ ] Generate image tools
- [ ] Play video
- [ ] Pause other videos when one plays
- [ ] Load multiple videos
- [ ] Start image upscaling
- [ ] Show upscale progress
- [ ] Display upscaled image
- [ ] Load merge face
- [ ] Cache merge face result
- [ ] Update merge face display

### UI System Tests

- [ ] Type in input
- [ ] Enforce max length
- [ ] Submit message with Ctrl+Enter
- [ ] Navigate input history with Ctrl+↑/↓
- [ ] Handle IME input (Chinese/Japanese)
- [ ] Create dropdown menu
- [ ] Open/close dropdown
- [ ] Select dropdown action
- [ ] Position dropdown correctly
- [ ] Share to social media
- [ ] Copy share link
- [ ] Show chat window
- [ ] Hide chat window
- [ ] Navigate to different chat
- [ ] Go back in navigation
- [ ] Back button disabled when no history

---

## 🔄 Integration Points

### With Chat.js
- No conflicts - runs alongside
- All original functions preserved
- Can call new modules from chat.js
- State accessible via ChatState

### With Phase 1 & 2
- Uses ChatState for app state
- Leverages ChatMessageDisplay
- Respects ChatRouter URL handling
- Follows ChatCore module pattern

### With Server APIs
- Image upscaling: POST /api/upscale-image
- Merge face: GET /api/merge-face-result/{id}
- Short links: POST /api/create-short-link
- All async with error handling

---

## 📚 Documentation Files

**Quick Reference:**
- `PHASE_3_QUICK_START.md` (this file)
- `PHASE_3_IMPLEMENTATION.md` (detailed guide)
- `PHASE_3_COMPLETION_SUMMARY.md` (deliverables)

**Module Documentation:**
- Each module has JSDoc comments
- Check source code for detailed comments
- Use `module.logXState()` for debugging

---

## 🎯 Next Steps

1. **Load Phase 3:**
   - Verify files exist ✓
   - Check script imports ✓
   - Test in browser ✓

2. **Integrate with UI:**
   - Add image rendering code
   - Add video player code
   - Connect input handler
   - Setup sharing buttons
   - Add navigation controls

3. **Connect to API:**
   - Setup upscale endpoint
   - Setup merge face endpoint
   - Add error handling

4. **Test & Deploy:**
   - Run test suite
   - Mobile testing
   - Performance check
   - Production deploy

---

**Status:** ✅ Ready to Use  
**Support:** Check `PHASE_3_IMPLEMENTATION.md` for details  
**Issues:** Use module debug methods for troubleshooting
