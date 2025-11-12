# Phase 2 - Developer Quick Start Guide

**Created:** November 12, 2025  
**For:** Development Team  
**Purpose:** Quick reference for using Phase 2 message system modules

---

## 🚀 5-Minute Setup Verification

### 1. Verify Phase 2 Modules Load (2 min)
```bash
# Open browser DevTools (F12) on /chat page
# Copy-paste in Console:
[ChatMessageFormatter, ChatMessageDisplay, ChatMessageStream, ChatMessageHistory].every(m => typeof m === 'object')
# Should show: true ✅
```

### 2. Check Module Registration (1 min)
```javascript
ChatCore.hasModule('messageFormatter')  // true
ChatCore.hasModule('messageDisplay')    // true
ChatCore.hasModule('messageStream')     // true
ChatCore.hasModule('messageHistory')    // true
```

### 3. Test Message Formatting (1 min)
```javascript
// Format markdown text
const formatted = ChatMessageFormatter.formatMessage(
  'This is **bold** text',
  { format: 'markdown' }
);
console.log(formatted); // Should contain <strong>bold</strong>
```

### 4. Test Message Display (1 min)
```javascript
// Display a test message
ChatMessageDisplay.displayMessage(
  'user',
  'Hello from Phase 2!',
  sessionStorage.getItem('userChatId'),
  () => console.log('Message displayed!')
);
// Should see message appear in chat container
```

---

## 💡 Common Tasks

### Task 1: Format a Message
```javascript
// Format with markdown
const text = 'This is **bold** and a [link](url)';
const formatted = ChatMessageFormatter.formatMessage(text, {
  format: 'markdown',
  highlightMentions: true
});
console.log(formatted);
```

### Task 2: Display a User Message
```javascript
// Display user message
ChatMessageDisplay.displayMessage(
  'user',
  'What is machine learning?',
  userChatId,
  () => {
    console.log('User message displayed');
  }
);
```

### Task 3: Display an Assistant Message
```javascript
// Display assistant message
ChatMessageDisplay.displayMessage(
  'assistant',
  'Machine learning is a branch of AI that...',
  userChatId,
  () => {
    console.log('Assistant message displayed');
  }
);
```

### Task 4: Stream a Message Character-by-Character
```javascript
// Create stream container first
const uniqueId = `stream-${Date.now()}`;
ChatMessageStream.createBotResponseContainer(uniqueId);

// Then stream the message
ChatMessageStream.displayCompletionMessage(
  'This message will appear one character at a time...',
  uniqueId
);
```

### Task 5: Load Chat History
```javascript
// Load message history for a chat
ChatMessageHistory.loadChatHistory(chatId)
  .then(messages => {
    console.log(`Loaded ${messages.length} messages`);
    // Display the history
    ChatMessageDisplay.displayExistingChat(messages, persona);
  })
  .catch(error => console.error('Error loading history:', error));
```

### Task 6: Sanitize User Input
```javascript
// Remove dangerous content from user input
const userInput = '<script>alert("xss")</script>Hello';
const safe = ChatMessageFormatter.sanitizeInput(userInput);
console.log(safe); // Script tags removed
```

### Task 7: Check if Message is Streaming
```javascript
// Check if a specific stream is active
const isStreaming = ChatMessageStream.isRenderingActive('stream-123');
console.log('Is streaming:', isStreaming);

// Get count of active streams
const activeCount = ChatMessageStream.getActiveStreamCount();
console.log('Active streams:', activeCount);
```

### Task 8: Get Chat History from Cache
```javascript
// Get cached history without making API call
const cachedMessages = ChatMessageHistory.getCachedHistory(chatId);

if (cachedMessages) {
  console.log('Using cached messages:', cachedMessages.length);
} else {
  console.log('Not in cache, loading from API...');
  ChatMessageHistory.loadChatHistory(chatId);
}
```

### Task 9: Clear Message Display
```javascript
// Remove all messages from chat container
ChatMessageDisplay.clearChatDisplay();

// Can then load new chat
ChatMessageDisplay.displayChat(newChatData, persona);
```

### Task 10: Get History Statistics
```javascript
// Get stats for a specific chat
const stats = ChatMessageHistory.getHistoryStats(chatId);
console.log('Total messages:', stats.messageCount);
console.log('User messages:', stats.userMessages);
console.log('Bot messages:', stats.botMessages);
```

---

## 🔧 Advanced Usage

### Custom Message Formatting
```javascript
const options = {
  format: 'markdown',           // 'markdown' or 'plain'
  highlightMentions: true,      // Highlight @mentions
  codeHighlight: true           // Syntax highlight code
};

const formatted = ChatMessageFormatter.formatMessage(text, options);
```

### Access Message Display State
```javascript
// Get message container
const container = ChatMessageDisplay.getMessageContainer();
console.log('Chat container:', container);

// Scroll to latest
ChatMessageDisplay.scrollToLatestMessage();
```

### Stream Management
```javascript
// Stop all active streams
ChatMessageStream.stopActiveRenderers();

// Clear active render processes
ChatMessageStream.clearActiveRenderers();

// Get list of active stream IDs
const activeIds = ChatMessageStream.getActiveStreamIds();
console.log('Active streams:', activeIds);
```

### History Cache Management
```javascript
// Get cache statistics
const stats = ChatMessageHistory.getCacheStats();
console.log('Cached chats:', stats.cachedChats);
console.log('Total cached messages:', stats.totalCachedMessages);

// Refresh history (clear and reload)
ChatMessageHistory.refreshHistory(chatId);

// Clear all caches
ChatMessageHistory.clearHistoryCache(); // Clear all
// OR
ChatMessageHistory.clearHistoryCache(chatId); // Clear specific chat
```

### Preload History for Performance
```javascript
// Preload history in background for faster display
ChatMessageHistory.preloadHistory(chatId)
  .then(() => {
    console.log('History preloaded');
    // Now displaying will be instant
    const cached = ChatMessageHistory.getCachedHistory(chatId);
    ChatMessageDisplay.displayExistingChat(cached, persona);
  });
```

---

## 🔗 Integration with Phase 1

Phase 2 modules seamlessly integrate with Phase 1 core modules:

```javascript
// Get current state (Phase 1)
const state = ChatState.getState();
console.log('Current chat:', state.chatId);
console.log('User chat:', state.userChatId);

// Get current route (Phase 1)
const chatId = ChatRouter.getCurrentChatId();

// Access other modules through ChatCore (Phase 1)
const formatter = ChatCore.getModule('messageFormatter');
const display = ChatCore.getModule('messageDisplay');
```

---

## 📊 Module Comparison

| Function | Module | Input | Output |
|----------|--------|-------|--------|
| Format text | Formatter | string | HTML string |
| Display message | Display | sender, text | DOM element |
| Stream message | Stream | text, id | Animated text |
| Load history | History | chatId | Array of messages |

---

## ⚡ Performance Tips

1. **Pre-load History** - Use `preloadHistory()` for better UX
2. **Use Cache** - Always check cache before API call
3. **Batch Updates** - Display multiple messages efficiently
4. **Clear Cache** - When switching chats, clear old cache
5. **Monitor Streams** - Use `getActiveStreamCount()` to prevent overlaps

---

## 🐛 Debugging

### Enable Debug Logging
```javascript
// Modules log to console by default
// Search console for '[ChatMessage' prefix:

// [ChatMessageFormatter] Format message...
// [ChatMessageDisplay] Displaying message...
// [ChatMessageStream] Stream started...
// [ChatMessageHistory] Cache updated...
```

### Check Stream Status
```javascript
// Get detailed stream information
ChatMessageStream.logStreamState();

// In console, shows:
// [ChatMessageStream] Active streams: ["stream-123", "stream-456"]
```

### Get Cache Details
```javascript
// Get detailed cache statistics
const stats = ChatMessageHistory.getCacheStats();
console.table(stats.chats);
```

---

## ✅ Verification Checklist

Before committing code that uses Phase 2:

- [ ] All 4 message modules are loaded (check ChatCore)
- [ ] No console errors on page load
- [ ] Message formatting works correctly
- [ ] Messages display in correct order
- [ ] Streaming animation is smooth
- [ ] History loads from cache or API
- [ ] Old chat.js functions still work
- [ ] No memory leaks (check DevTools)
- [ ] Performance acceptable (< 2s for 100 messages)

---

## 📞 Quick Reference

### Module Names
```javascript
ChatMessageFormatter   // Text formatting & sanitization
ChatMessageDisplay     // Message rendering & display
ChatMessageStream      // Character-by-character streaming
ChatMessageHistory     // History loading & caching
```

### Core Functions
```javascript
ChatMessageFormatter.formatMessage(text, options)
ChatMessageDisplay.displayMessage(sender, message, userChatId, callback)
ChatMessageStream.displayCompletionMessage(message, uniqueId)
ChatMessageHistory.loadChatHistory(chatId, options)
```

### State Access
```javascript
ChatState.getState()           // Get current state
ChatRouter.getCurrentChatId()  // Get current chat ID
ChatCore.getModule(name)       // Get module by name
```

---

## 🎯 Next Steps

1. **Test Phase 2 locally** - Verify all modules load
2. **Review quick start examples** - Try each task
3. **Check console** - Look for debug messages
4. **Load a chat** - Test message display
5. **Monitor performance** - Use DevTools
6. **Report issues** - If anything doesn't work

---

## 📚 Additional Resources

- `PHASE_2_IMPLEMENTATION.md` - Detailed technical specs
- `PHASE_2_VALIDATION_CHECKLIST.md` - Complete test suite
- `PHASE_2_COMPLETION_SUMMARY.md` - Implementation overview

