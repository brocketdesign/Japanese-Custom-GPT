# Speech-to-Text Feature Integration Guide

## Overview
This guide explains how to integrate the speech-to-text feature into your Japanese Custom GPT application.

## Files Created

### Frontend Files
1. **`/public/css/speech-to-text.css`** - Styles for speech-to-text UI components
2. **`/public/js/speech-to-text-utils.js`** - Core speech recognition utility class
3. **`/public/js/speech-to-text-ui.js`** - UI controller for speech recognition
4. **`/public/js/speech-to-text-init.js`** - Integration and initialization script

### Backend Files
5. **`/routes/speech-to-text-api.js`** - Fastify routes for speech processing

### Translation Files
6. **`/locales/speech-to-text-en.json`** - English translations
7. **`/locales/speech-to-text-ja.json`** - Japanese translations
8. **`/locales/speech-to-text-fr.json`** - French translations

### Dependency Reference
9. **`speech-to-text-dependencies.json`** - Required npm packages

## Installation Steps

### 1. Install Required Dependencies

```bash
npm install form-data@^4.0.0 node-fetch@^2.6.7
```

Note: Fastify has built-in multipart support, so we don't need multer.

### 2. Register Fastify Multipart Plugin

Make sure your Fastify instance has the multipart plugin registered:

```javascript
// In your main server file
await fastify.register(require('@fastify/multipart'), {
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
    }
});
```

### 3. Environment Variables

Ensure your `.env` file has the OpenAI API key:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Backend Integration

#### Register the speech-to-text routes in your main server file or routes index:

```javascript
// In your main routes registration file
const speechToTextRoutes = require('./speech-to-text-api');

// Register the routes
fastify.register(speechToTextRoutes);
```

#### Or add to your existing API routes file:

```javascript
// In routes/api.js or similar, add the speech-to-text routes
const speechToTextApi = require('./speech-to-text-api');

// Inside your routes function
async function routes(fastify, options) {
    // Your existing routes...
    
    // Register speech-to-text routes
    await speechToTextApi(fastify, options);
    
    // More existing routes...
}
```

### 5. Frontend Integration

#### Update your main layout file or chat template to include the new assets:

**Add to `<head>` section:**
```html
<link rel="stylesheet" href="/css/speech-to-text.css">
```

**Add before closing `</body>` tag (in order):**
```html
<script src="/js/speech-to-text-utils.js"></script>
<script src="/js/speech-to-text-ui.js"></script>
<script src="/js/speech-to-text-init.js"></script>
```

### 6. Translation Integration

#### If using a translation loading system, update it to include:

```javascript
// Example for your translation loader
const speechTranslations = {
  en: require('./locales/speech-to-text-en.json'),
  ja: require('./locales/speech-to-text-ja.json'),
  fr: require('./locales/speech-to-text-fr.json')
};

// Merge with existing translations
translations = {
  ...existingTranslations,
  ...speechTranslations[currentLanguage]
};
```

#### Or manually merge the translation files into your existing locale files.

## Usage

### For Users
1. **Click the microphone button** next to the chat input
2. **Allow microphone permission** when prompted
3. **Select desired language** (optional - auto-detect is default)
4. **Speak clearly** into the microphone
5. **Click stop** or the system will auto-stop after silence
6. **Text appears** in the chat input automatically
7. **Send the message** manually or enable auto-send

### Keyboard Shortcut
- **Ctrl+Shift+M** (Windows/Linux) or **Cmd+Shift+M** (Mac) to start speech recognition

## API Endpoints

### POST `/api/speech-to-text`
Convert audio to text using OpenAI Whisper API.

**Parameters:**
- `audio` (file): Audio file (webm, mp4, mp3, wav, ogg)
- `language` (string, optional): Language code (auto, en, ja, ko, zh, fr, de, es, it, pt, ru, ar)

**Response:**
```json
{
  "success": true,
  "text": "Recognized speech text",
  "language": "en",
  "duration": 3.2
}
```

### GET `/api/speech-to-text/languages`
Get supported languages.

### GET `/api/speech-to-text/status`
Check service availability.

## Configuration Options

### JavaScript Configuration
```javascript
// Initialize with custom options
const speechUI = new SpeechToTextUI({
  containerId: 'chatInput',
  language: 'ja', // Default language
  autoSend: false, // Auto-send messages after recognition
  onTextResult: (text, language) => {
    // Custom handler for speech results
    console.log('Speech result:', text);
  }
});
```

### LocalStorage Settings
The feature uses localStorage to save user preferences:
- `speechToTextSettings.autoSend` - Auto-send preference
- `speechToTextSettings.language` - Preferred language
- `speechToTextSettings.enabled` - Feature enabled/disabled

## Browser Compatibility

### Supported Browsers
- Chrome 66+
- Firefox 55+
- Safari 11+
- Edge 79+

### Required Features
- `navigator.mediaDevices.getUserMedia()`
- `MediaRecorder API`
- `Blob` and `FormData` support

## Troubleshooting

### Common Issues

1. **Microphone permission denied**
   - Ensure HTTPS (required for microphone access)
   - Check browser security settings
   - Clear site permissions and retry

2. **No audio detected**
   - Check microphone is not muted
   - Verify microphone is working in other applications
   - Try speaking louder or closer to microphone

3. **API errors**
   - Verify OpenAI API key is set correctly
   - Check network connection
   - Ensure audio file is under 25MB limit

4. **File format issues**
   - Browser may not support certain audio formats
   - System will auto-convert to supported format

### Debug Mode
Enable debug logging:
```javascript
localStorage.setItem('speechToTextDebug', 'true');
```

## Security Considerations

1. **Audio data** is sent to OpenAI's servers for processing
2. **No audio files** are permanently stored on your server
3. **Memory-only processing** - audio data is handled in memory
4. **HTTPS required** for microphone access
5. **API key protection** - ensure OpenAI API key is in environment variables

## Performance Notes

1. **File size limit**: 25MB (OpenAI's limit)
2. **Audio quality**: Automatically optimized for speech recognition
3. **Network usage**: Audio is streamed directly to OpenAI
4. **Response time**: Typically 1-3 seconds for short audio clips

## Customization

### Styling
Modify `/public/css/speech-to-text.css` to customize appearance.

### Languages
Add more languages by updating the `supportedLanguages` object in `speech-to-text-utils.js`.

### UI Behavior
Modify `speech-to-text-ui.js` to change user interaction patterns.

## Testing

### Test the Feature
1. Load your application
2. Open browser developer tools
3. Navigate to the chat interface
4. Look for the microphone button
5. Test speech recognition with different languages
6. Verify API endpoints respond correctly

### API Testing
```bash
# Test status endpoint
curl http://localhost:3000/api/speech-to-text/status

# Test languages endpoint  
curl http://localhost:3000/api/speech-to-text/languages
```

## Future Enhancements

Potential improvements you could add:
1. **Voice activity detection** for automatic stop
2. **Real-time streaming** recognition
3. **Custom wake words**
4. **Voice commands** for chat actions
5. **Speaker identification** for multi-user chats
6. **Audio visualization** during recording
7. **Offline speech recognition** fallback

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all files are loaded correctly
3. Test API endpoints independently
4. Check OpenAI API status and quotas
5. Review network requests in browser dev tools
