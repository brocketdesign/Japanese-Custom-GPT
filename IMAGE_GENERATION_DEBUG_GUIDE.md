# Image Generation Debug Guide

This document explains the complete image generation flow in the application, including where images are saved, what data is stored, and how to debug common issues.

## Table of Contents
1. [Overview](#overview)
2. [Key Files](#key-files)
3. [Database Collections](#database-collections)
4. [Generation Flow](#generation-flow)
5. [Sequential vs Batch Generation](#sequential-vs-batch-generation)
6. [Batch Metadata & Carousel Display](#batch-metadata--carousel-display)
7. [Webhook vs Polling](#webhook-vs-polling)
8. [Content Moderation (OpenAI)](#content-moderation-openai)
9. [Face Merge Flow](#face-merge-flow)
10. [WebSocket Notifications](#websocket-notifications)
11. [Common Debug Scenarios](#common-debug-scenarios)
12. [Logging Prefixes](#logging-prefixes)

---

## Overview

The image generation system uses **Novita AI** as the external API provider. The flow is:

```
User Request → generateImg() → Novita API → Webhook/Polling → checkTaskStatus() → OpenAI Moderation → saveImageToDB() → WebSocket Notification
```

**Content Moderation:** After images are uploaded to storage (Supabase/S3), the **OpenAI Content Moderation API** (`omni-moderation-latest`) is used to detect NSFW content. This provides detailed category flags (sexual, violence, etc.) for accurate content filtering.

## Key Files

| File | Purpose |
|------|---------|
| `models/imagen.js` | Core image generation logic, task processing, database saving |
| `models/openai.js` | OpenAI API utilities including `moderateImage()` for content moderation |
| `routes/novita-webhook.js` | Webhook handler for Novita AI task completion |
| `models/merge-face-utils.js` | Face merge utilities for swapping faces |
| `public/js/chat.js` | Frontend chat display, batch image carousel reconstruction |
| `models/admin-image-test-utils.js` | Model configurations (MODEL_CONFIGS) |

---

## Database Collections

### `tasks` Collection
Stores pending/completed image generation tasks.

```javascript
{
  taskId: "novita_task_id",          // Novita's task identifier
  type: "sfw" | "nsfw",              // Image type
  task_type: "txt2img" | "img2img",
  status: "pending" | "completed" | "failed",
  prompt: "user prompt...",
  title: { en: "", ja: "", fr: "" }, // Multi-language title
  slug: "unique-image-slug",
  negative_prompt: "...",
  aspectRatio: "3:4",
  userId: ObjectId,
  chatId: ObjectId,
  userChatId: ObjectId,              // Links to userChat document
  placeholderId: "uuid",             // Used for batch grouping (becomes batchId)
  chatCreation: true/false,          // Is this for character creation?
  shouldAutoMerge: true/false,
  enableMergeFace: true/false,
  
  // Sequential generation fields (for models without batch support)
  requiresSequentialGeneration: true/false,
  sequentialTaskIds: ["id1", "id2"], // All task IDs (parent only)
  sequentialExpectedCount: 3,        // Total images expected (parent only)
  sequentialParentTaskId: "id",      // Links child to parent task
  sequentialImageIndex: 2,           // Child's position (1-based: 2, 3, 4...)
  
  // Built-in model info
  isBuiltInModel: true/false,
  imageModelId: "z-image-turbo",
  
  // Result storage
  result: {
    images: [{
      imageUrl: "s3://...",
      seed: 12345
    }]
  },
  webhookProcessed: true/false,      // Flag to skip polling
  
  createdAt: Date,
  updatedAt: Date
}
```

### `gallery` Collection
Stores all generated images in a user's gallery.

```javascript
{
  userId: ObjectId,
  chatId: ObjectId,
  images: [{
    _id: ObjectId,                   // Unique image ID
    taskId: "novita_task_id",
    prompt: "...",
    title: { en: "", ja: "", fr: "" },
    slug: "image-slug-abc123",
    imageUrl: "https://s3.../image.jpg",  // Final S3 URL
    thumbnailUrl: "https://s3.../thumb.jpg",
    originalImageUrl: "...",         // For merged images: the pre-merge URL
    blurredImageUrl: "...",          // NSFW blur
    aspectRatio: "3:4",
    seed: 12345,
    nsfw: true/false,
    imageModelId: "model-name",
    
    // Merge-specific
    isMerged: true/false,
    mergeId: ObjectId,               // Links to merge operation
    
    createdAt: Date
  }]
}
```

### `userChat` Collection
Stores chat history with image messages.

```javascript
{
  _id: ObjectId,                     // This is the userChatId
  userId: ObjectId,
  chatId: ObjectId,
  messages: [{
    role: "assistant",
    content: "Image title",
    type: "image" | "mergeFace" | "bot-image-slider",
    imageUrl: "https://s3.../image.jpg",
    imageId: "string",               // Reference to gallery image
    prompt: "...",
    title: "...",
    nsfw: true/false,
    hidden: true,
    
    // CRITICAL: Batch metadata for carousel grouping
    batchId: "placeholder-uuid",     // Groups images together
    batchIndex: 0,                   // Position in carousel (0-based)
    batchSize: 3,                    // Total images in batch
    
    // Merge-specific
    isMerged: true/false,
    mergeId: "...",
    originalImageUrl: "...",
    
    createdAt: Date,
    timestamp: "locale string"
  }]
}
```

### `mergedResults` Collection
Idempotent cache for merge operations (prevents duplicate API calls).

```javascript
{
  originalImageUrl: "https://...",   // Original image before merge
  mergedImageUrl: "https://...",     // Result after merge
  mergeId: "...",
  createdAt: Date,
  updatedAt: Date
}
```

### `mergedFaces` Collection
Tracks merge relationships.

```javascript
{
  originalImageId: ObjectId,
  userId: ObjectId,
  chatId: ObjectId,
  userChatId: ObjectId,
  mergedImageUrl: "https://...",
  createdAt: Date
}
```

### `mergeLocks` Collection
Temporary locks to prevent concurrent merge operations on the same image.

```javascript
{
  key: "merge_lock_<hash>",
  createdAt: Date
}
```

---

## Generation Flow

### Step 1: `generateImg()` (imagen.js)

Entry point for all image generation requests.

```
generateImg() called with:
  - prompt, negativePrompt, modelId, image_num
  - userId, chatId, userChatId
  - placeholderId (UUID for batch grouping)
```

**Key actions:**
1. Validates user and parameters
2. Determines model type (built-in vs custom)
3. Checks if model requires sequential generation
4. Calls `fetchNovitaMagic()` to submit task to Novita
5. Stores task in `tasks` collection
6. Starts fallback polling via `pollSequentialTasksWithFallback()`

### Step 2: `fetchNovitaMagic()` (imagen.js)

Sends request to Novita API.

**Endpoints used:**
- `https://api.novita.ai/v3/async/txt2img` - Standard text-to-image
- `https://api.novita.ai/v3/async/img2img` - Image-to-image
- `https://api.novita.ai/v3/async/hunyuan-image-3` - Hunyuan model
- Model-specific endpoints from `MODEL_CONFIGS`

**Returns:** Novita task ID

### Step 3: Webhook OR Polling

**Webhook (preferred):** `POST /novita/webhook`
- Novita calls back when task completes
- Handler in `routes/novita-webhook.js`
- Processes images and calls `checkTaskStatus()`

**Polling (fallback):** `pollSequentialTasksWithFallback()`
- Waits 10 seconds, then polls if webhook hasn't arrived
- Uses `fetchNovitaResult()` to check task status
- Processes images and calls `checkTaskStatus()`

### Step 4: `checkTaskStatus()` (imagen.js)

Processes completed task images.

**Key actions:**
1. Gets task from database
2. Downloads images from Novita (if not already done by webhook)
3. Uploads to S3 via `uploadImage()`
4. Performs auto-merge if `shouldAutoMerge` is enabled
5. **Runs OpenAI content moderation** via `moderateImage()` to detect NSFW content
6. Calculates batch metadata (batchId, batchIndex, batchSize)
7. Calls `saveImageToDB()` for each image

### Step 5: `saveImageToDB()` (imagen.js)

Saves image to database and chat.

**What it saves:**
1. **Gallery:** Adds image document to `gallery.images[]`
2. **Chat message:** Calls `addImageMessageToChatHelper()` to add to `userChat.messages[]`

**Critical batch metadata passed:**
```javascript
{
  batchId: placeholderId,   // Groups images together
  batchIndex: 0/1/2/...,    // Position in batch
  batchSize: total_count    // Total images expected
}
```

### Step 6: `handleTaskCompletion()` (imagen.js)

Sends WebSocket notifications to frontend.

**Notifications sent:**
- `handleLoader` - Removes loading spinner
- `handleRegenSpin` - Stops regeneration animation
- `updateImageCount` - Updates image counter
- `imageGenerated` - New image data (for non-character creation)
- `characterImageGenerated` - New character image

---

## Sequential vs Batch Generation

### Models with Batch Support
- Set `image_num: N` in API request
- Novita generates N images in one task
- Single webhook callback with all images

### Models WITHOUT Batch Support (Sequential)
Examples: Hunyuan, some built-in models

**How it works:**
1. `generateImg()` detects `modelRequiresSequentialGeneration(modelId)`
2. Makes N separate API calls (one per image)
3. Creates N task documents:
   - **Parent task** (first): Has `sequentialExpectedCount` and `sequentialTaskIds`
   - **Child tasks**: Have `sequentialParentTaskId` and `sequentialImageIndex`

**Critical for batch grouping:**
- All tasks must use the **parent's `placeholderId`** as their `batchId`
- Child tasks look up parent to get correct batch info
- This ensures all images group into same carousel

**Fixed in:**
- `checkTaskStatus()`: Calculates proper batch metadata for child tasks
- `novita-webhook.js`: Uses `effectivePlaceholderId` from parent task
- `pollSequentialTasksWithFallback()`: Same parent lookup logic

---

## Batch Metadata & Carousel Display

### How Batch Data Flows

```
generateImg()
  └── placeholderId (UUID generated)
        │
        ▼
Task Document
  └── placeholderId stored
        │
        ▼
checkTaskStatus() / saveImageToDB()
  └── batchId = placeholderId
  └── batchIndex = 0, 1, 2...
  └── batchSize = total images
        │
        ▼
userChat.messages[]
  └── Each message has batchId, batchIndex, batchSize
        │
        ▼
chat.js displayChat()
  └── Groups by batchId → Creates "bot-image-slider"
```

### Frontend Carousel Reconstruction (chat.js)

In `displayChat()`:

1. **First pass:** Groups messages by `batchId`
   - Creates `batchedGroups` Map
   - Tracks `seenImageIds` and `seenBatchIndices` to prevent duplicates

2. **Second pass:** Rebuilds message array
   - Batched messages → Single `bot-image-slider` message
   - Non-batched messages → Pass through as-is

```javascript
// Slider message structure
{
  role: "assistant",
  type: "bot-image-slider",
  sliderImages: [msg1, msg2, msg3],  // Sorted by batchIndex
  batchId: "...",
  batchSize: 3
}
```

---

## Webhook vs Polling

### Webhook Flow (novita-webhook.js)

```
Novita POST /novita/webhook
  │
  ├── Validate event_type === 'ASYNC_TASK_RESULT'
  ├── Find task in database
  ├── Download images from Novita
  ├── Upload to S3
  ├── Store in task.result.images
  ├── Set webhookProcessed = true
  │
  └── checkTaskStatus()
        └── handleTaskCompletion() → WebSocket notifications
```

### Polling Flow (imagen.js)

```
generateImg() starts pollSequentialTasksWithFallback()
  │
  ├── Wait 10 seconds (give webhook a chance)
  ├── Check if all tasks completed via webhook
  │
  └── If not, poll loop:
        ├── fetchNovitaResult(taskId)
        ├── If complete: download, upload, store
        ├── checkTaskStatus()
        └── handleTaskCompletion()
```

---

## Content Moderation (OpenAI)

NSFW detection uses the **OpenAI Content Moderation API** (`omni-moderation-latest` model) for accurate content filtering.

### How It Works

```
checkTaskStatus()
  │
  ├── Image uploaded to Supabase/S3
  │
  └── For each image:
        ├── Call moderateImage(imageUrl)
        ├── Check result.flagged
        ├── Log flagged categories (sexual, violence, etc.)
        └── Set nsfw = true if flagged
```

### Moderation Response Structure

```javascript
{
  "id": "modr-xxx",
  "model": "omni-moderation-latest",
  "results": [{
    "flagged": true/false,           // Overall NSFW flag
    "categories": {
      "sexual": true/false,
      "sexual/minors": true/false,
      "harassment": true/false,
      "hate": true/false,
      "self-harm": true/false,
      "violence": true/false,
      // ... more categories
    },
    "category_scores": {
      "sexual": 0.99,                // Confidence scores (0-1)
      // ... more scores
    }
  }]
}
```

### Logging Prefix

| Prefix | Purpose |
|--------|---------|
| `[NSFW-CHECK]` | Content moderation logging in `checkTaskStatus()` |

### Debug Examples

```javascript
// In server logs, look for:
[NSFW-CHECK] Task abc123 - Image 1:
[NSFW-CHECK]   - Task type: sfw
[NSFW-CHECK]   - Initial NSFW flag (from task.type): false
[NSFW-CHECK]   - OpenAI moderation result: {...}
[NSFW-CHECK]   - ⚠️ FLAGGED by OpenAI moderation
[NSFW-CHECK]   - Flagged categories: sexual
[NSFW-CHECK]   - High scores: sexual: 95.2%
[NSFW-CHECK]   - Final NSFW flag: true
```

---

## Face Merge Flow

### Auto-Merge (during image generation)

```
checkTaskStatus()
  │
  ├── shouldAutoMerge && chatImageUrl exists?
  │     │
  │     └── performAutoMergeFace() / performAutoMergeFaceWithBase64()
  │           │
  │           ├── Check mergedResults cache
  │           ├── Acquire mergeLock
  │           ├── Check gallery for existing merge
  │           ├── Call mergeFaceWithNovita()
  │           ├── saveMergedImageToS3()
  │           ├── Update mergedResults cache
  │           └── Release lock
  │
  └── saveImageToDB() with isMerged=true, mergeId
```

### Manual Merge (user triggered)

```
POST /merge-face/merge
  │
  └── mergeFaceWithNovita()
        └── saveMergedFaceToDB()
```

---

## WebSocket Notifications

### imageGenerated Event

Sent for each image in a batch (non-character creation):

```javascript
{
  id: "imageId",
  imageId: "imageId",
  imageUrl: "https://...",
  thumbnailUrl: "https://...",
  userChatId: "...",
  title: "...",
  prompt: "...",
  nsfw: false,
  isMergeFace: false,
  isAutoMerge: false,
  url: "https://...",
  
  // Batch info for frontend grouping
  batchId: "placeholderId",
  batchIndex: 0,
  batchSize: 3
}
```

### characterImageGenerated Event

Sent for character creation images:

```javascript
{
  imageUrl: "https://...",
  thumbnailUrl: "https://...",
  nsfw: false,
  chatId: "..."
}
```

---

## Common Debug Scenarios

### 1. Same Image URL for All Batch Items

**Symptom:** All images in carousel show same picture

**Check:**
- `tasks` collection: Do child tasks have `sequentialParentTaskId`?
- `userChat.messages`: Are `batchIndex` values unique (0, 1, 2...)?
- `gallery.images`: Are there multiple distinct `imageUrl` values?

**Root cause:** Sequential tasks not calculating batch metadata from parent

### 2. Carousel Not Displaying

**Symptom:** Images appear separately instead of in carousel

**Check:**
- `userChat.messages`: Do all images have same `batchId`?
- `userChat.messages`: Is `batchSize > 1`?
- Browser console: Look for `[displayChat] Found batch` logs

**Root cause:** `batchId` mismatch or `batchSize: 1`

### 3. Missing Images After Refresh

**Symptom:** Fewer images than expected after page refresh

**Check:**
- `gallery.images`: Count images with matching `taskId`
- `userChat.messages`: Count messages with matching `batchId`
- Look for duplicate detection logs

**Root cause:** Messages not saved to `userChat` collection

### 4. Duplicate Images

**Symptom:** Same image appears multiple times in carousel or chat

**Check:**
- `userChat.messages`: Are there duplicate `batchIndex` values for the same `batchId`?
- Browser console: Look for `[displayChat] Skipping duplicate` logs
- Run the debug script: `node debug-images.js`

**Root cause (FIXED Jan 2026):** MongoDB duplicate check queries were incorrect.

The original queries used:
```javascript
// WRONG - checks ANY message has batchId AND ANY message has batchIndex
{
  'messages.batchId': batchId,
  'messages.batchIndex': batchIndex
}
```

The fix uses `$elemMatch` to ensure both conditions match the SAME array element:
```javascript
// CORRECT - checks SAME message has both batchId AND batchIndex
{
  messages: { $elemMatch: { batchId: batchId, batchIndex: batchIndex } }
}
```

**Cleanup:** If duplicates exist, run: `node cleanup-duplicate-messages.js`
- Use `--dry-run` flag to preview changes without modifying data
- The script removes duplicate messages while preserving the first occurrence

### 5. Merge Not Working

**Symptom:** Face merge doesn't apply

**Check:**
- `tasks` collection: Is `shouldAutoMerge: true`?
- `mergedResults` collection: Is there a cached result?
- `mergeLocks` collection: Is there a stuck lock?

**Root cause:** Lock not released, or `chatImageUrl` missing

---

## Logging Prefixes

| Prefix | Location | Purpose |
|--------|----------|---------|
| `🖼️ [saveImageToDB]` | imagen.js | Image save operations |
| `📝 [addImageMessageToChatHelper]` | imagen.js | Chat message creation |
| `📦 [checkTaskStatus]` | imagen.js | Batch metadata calculation |
| `[NSFW-CHECK]` | imagen.js | OpenAI content moderation results |
| `🔍 [checkTaskStatus] FINAL VERIFICATION` | imagen.js | Post-save verification |
| `🔍 [handleTaskCompletion]` | imagen.js | End of task processing |
| `[NovitaWebhook]` | novita-webhook.js | Webhook processing |
| `[pollSequentialTasks]` | imagen.js | Fallback polling |
| `[displayChat]` | chat.js | Frontend message grouping |
| `🧬 [addMergeFaceMessageToChat]` | merge-face-utils.js | Merge message creation |
| `🔒 [MergeLock]` | imagen.js | Lock acquisition/release |
| `🔁 [MergeReuse]` | imagen.js | Cache hit for merge |
| `🗂️ [MergeCache]` | imagen.js | Cache save for merge |

---

## Debug MongoDB Queries

### Find task by ID
```javascript
db.tasks.findOne({ taskId: "your_task_id" })
```

### Find all tasks for a batch (sequential)
```javascript
db.tasks.find({ 
  $or: [
    { taskId: "parent_task_id" },
    { sequentialParentTaskId: "parent_task_id" }
  ]
})
```

### Find gallery images for a chat
```javascript
db.gallery.findOne({ 
  userId: ObjectId("user_id"),
  chatId: ObjectId("chat_id")
}).images
```

### Find chat messages with batch info
```javascript
db.userChat.aggregate([
  { $match: { _id: ObjectId("userChatId") } },
  { $unwind: "$messages" },
  { $match: { "messages.batchId": "your_batch_id" } },
  { $project: { 
    "messages.imageId": 1,
    "messages.batchIndex": 1,
    "messages.batchSize": 1,
    "messages.imageUrl": 1
  }}
])
```

### Check for stuck merge locks
```javascript
db.mergeLocks.find({ 
  createdAt: { $lt: new Date(Date.now() - 5*60*1000) } // Older than 5 min
})
```

### Delete stuck locks
```javascript
db.mergeLocks.deleteMany({ 
  createdAt: { $lt: new Date(Date.now() - 5*60*1000) }
})
```

---

## Quick Reference: Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `generateImg()` | imagen.js | Entry point for image generation |
| `fetchNovitaMagic()` | imagen.js | Submit task to Novita API |
| `fetchNovitaResult()` | imagen.js | Poll Novita for task result |
| `checkTaskStatus()` | imagen.js | Process completed task + content moderation |
| `moderateImage()` | openai.js | OpenAI Content Moderation API call |
| `saveImageToDB()` | imagen.js | Save to gallery + chat |
| `addImageMessageToChatHelper()` | imagen.js | Add message to userChat |
| `handleTaskCompletion()` | imagen.js | Send WebSocket notifications |
| `pollSequentialTasksWithFallback()` | imagen.js | Fallback polling |
| `handleImageWebhook()` | novita-webhook.js | Process Novita webhook |
| `performAutoMergeFace()` | imagen.js | Auto face merge |
| `displayChat()` | chat.js | Frontend render + batch grouping |

---

## Debug Scripts

### debug-images.js
Analyzes database state for a specific user/chat. Shows:
- All image messages in userChat
- Gallery images
- Recent tasks
- Merged results and faces
- Identifies messages with missing or undefined imageUrl

**Usage:**
```bash
node debug-images.js
```

Edit the `DEBUG_IDS` object in the script to specify:
- `chatId`: The chat to analyze
- `userChatId`: The userChat document ID
- `userId`: The user ID

### cleanup-duplicate-messages.js
Removes duplicate image messages from the userChat collection.

**Usage:**
```bash
# Preview changes without modifying data
node cleanup-duplicate-messages.js --dry-run

# Apply changes
node cleanup-duplicate-messages.js
```

**Deduplication logic:**
- Batch messages: unique by `batchId` + `batchIndex`
- Merge messages: unique by `mergeId`
- Regular images: unique by `imageId`
- Falls back to `imageUrl` if no other identifier

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NOVITA_API_KEY` | Novita API authentication |
| `OPENAI_API_KEY` | OpenAI API key (required for content moderation) |
| `LOCAL_WEBHOOK_URL` | Override webhook URL (for dev with ngrok) |
| `BASE_URL` | Production webhook URL base |
