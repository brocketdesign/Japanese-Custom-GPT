# Pricing Configuration

This document explains how the centralized pricing configuration works in the Japanese Custom GPT application.

## Overview

All pricing for features in the application is now centralized in `/config/pricing.js`. This ensures consistency across the application and makes it easy to update pricing without searching through multiple files.

## Configuration File

The main configuration is in `/config/pricing.js` and includes:

### Current Pricing Structure

- **Image Generation**: 10 points per image
- **Image Upscaling**: 20 points per upscale
- **Face Merging**: 30 points per merge operation
- **Video Generation**: 100 points per video
- **Text-to-Speech**: 3 points per generation
- **Custom Prompts**: Variable (based on prompt data)
- **Gifts**: Variable (based on gift data)

## How to Update Pricing

1. **Edit the configuration file**:
   ```javascript
   // In /config/pricing.js
   const PRICING_CONFIG = {
     IMAGE_GENERATION: {
       BASE_COST_PER_IMAGE: 15, // Changed from 10 to 15
       DESCRIPTION: 'Cost per image generated'
     },
     // ... other configurations
   };
   ```

2. **Restart the server** to apply changes

3. **All pricing will automatically update** across:
   - Image generation (direct API and chat completion)
   - Video generation
   - Image upscaling
   - Face merging
   - Text-to-speech
   - System prompts (AI character behavior)

## Files Updated to Use Centralized Pricing

The following files now import and use the centralized pricing:

### Routes (API Endpoints)
- `/routes/stability.js` - Image generation and upscaling
- `/routes/txt2speech-api.js` - Text-to-speech generation
- `/routes/img2video-api.js` - Video generation
- `/routes/merge-face-api.js` - Face merging
- `/routes/admin-pricing.js` - Admin pricing management (NEW)

### Models (Business Logic)
- `/models/chat-completion-utils.js` - Chat-based image generation
- `/models/upscale-utils.js` - Image upscaling utilities

## Available Helper Functions

The pricing configuration provides helper functions for easy usage:

```javascript
const {
  getImageGenerationCost,     // (imageCount) => cost
  getImageUpscaleCost,        // () => cost
  getFaceMergeCost,           // () => cost
  getVideoGenerationCost,     // () => cost
  getTextToSpeechCost,        // () => cost
  getCustomPromptCost,        // (promptData) => cost
  getGiftCost,                // (giftData) => cost
  getAllPricing               // () => complete config
} = require('../config/pricing');
```

## Admin API Endpoints

### Get Current Pricing
```
GET /api/admin/pricing
```
Returns complete pricing configuration (admin only).

### Get Pricing Management Info
```
POST /api/admin/pricing/info
```
Returns instructions for updating pricing configuration (admin only).

## Benefits

1. **Consistency**: All pricing is defined in one place
2. **Easy Updates**: Change pricing in one file, affects entire application
3. **Maintainability**: No need to search through multiple files
4. **Type Safety**: Helper functions ensure correct usage
5. **Documentation**: Each price has a description
6. **Flexibility**: Easy to add new pricing types

## Example Usage

```javascript
// Before (hardcoded)
const cost = 10 * image_num;

// After (centralized)
const { getImageGenerationCost } = require('../config/pricing');
const cost = getImageGenerationCost(image_num);
```

## Important Notes

- **Server Restart Required**: Changes to the pricing configuration require a server restart to take effect
- **Backward Compatibility**: All existing functionality remains the same, just the pricing source has changed
- **Custom Pricing**: Prompts and gifts can still have individual pricing that overrides the defaults
- **Consistent Logging**: All cost calculations now use the same source, ensuring consistent logging

## Future Enhancements

Consider implementing:
- Database-based pricing configuration for dynamic updates without restart
- Pricing history and audit trail
- A/B testing for different pricing strategies
- User-specific pricing tiers