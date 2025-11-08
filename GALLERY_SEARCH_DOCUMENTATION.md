# Gallery Search System Documentation

## Overview

This new modular search system provides a dynamic, infinite-scroll gallery search experience with support for both images and videos. The system is organized into three main components:

1. **Backend Utils** (`models/gallery-search-utils.js`)
2. **Backend Routes** (`routes/gallery-search.js`)
3. **Frontend JavaScript** (`public/js/gallery-search.js`)
4. **Frontend Template** (`views/search-new.hbs`)

---

## Architecture

### Backend Architecture

#### `models/gallery-search-utils.js`
Contains all reusable search logic extracted into pure functions:

**Main Functions:**
- `buildSearchPipeline(queryStr, language, requestLang, skip, limit)` - Builds MongoDB aggregation pipeline for image search
- `buildCountPipeline(queryStr, language, requestLang)` - Builds count pipeline for total results
- `buildVideoSearchPipeline(...)` - Builds video search pipeline
- `buildVideoCountPipeline(...)` - Builds video count pipeline
- `processImageResults(docs, limit)` - Post-processes raw documents into user-friendly format
- `processVideoResults(docs, limit)` - Post-processes video documents
- `searchImages(db, user, queryStr, page, limit)` - Complete image search with pagination
- `searchVideos(db, user, queryStr, page, limit)` - Complete video search with pagination

**Key Features:**
- Language-aware filtering (matches user's language preference)
- Relevance scoring (matches query words in prompts)
- Pagination support
- Consistent data normalization

#### `routes/gallery-search.js`
Fastify route handlers exposing search functionality:

**Endpoints:**
- `GET /api/gallery/search/images?query=X&page=Y&limit=Z` - Search images
- `GET /api/gallery/search/videos?query=X&page=Y&limit=Z` - Search videos

Both endpoints require authentication and return:
```json
{
  "images": [...],
  "page": 1,
  "totalPages": 5,
  "totalCount": 100
}
```

### Frontend Architecture

#### `public/js/gallery-search.js`
Main client-side manager class `GallerySearchManager`:

**Key Properties:**
- `currentQuery` - Current search query
- `currentMediaType` - 'image' or 'video'
- `currentPage` - Current page number
- `isLoading` - Loading state flag
- `hasMoreResults` - More results available

**Key Methods:**
- `performNewSearch(query)` - Start new search, clear cache, load first page
- `switchMediaType(mediaType)` - Switch between images and videos
- `loadNextPage()` - Load next page of results (for infinite scroll)
- `renderItems(items)` - Render items to gallery
- `createMediaCard(item)` - Create individual card HTML
- `setupInfiniteScroll()` - Setup scroll listener
- `shouldLoadMore()` - Check if should trigger load
- `updateURL()` - Update browser URL without reload
- `loadFromURL()` - Load search state from URL parameters

**Debouncing:**
- Search input debounced by 500ms to reduce API calls

**Infinite Scroll:**
- Triggers when user scrolls to 500px from bottom
- Prevents multiple simultaneous requests

#### `views/search-new.hbs`
User-friendly search interface with:
- Centered search input with magnifying glass icon
- Image/Video toggle buttons
- Dynamic results grid
- Loading indicator
- Empty/error states
- Responsive design for mobile/tablet/desktop

---

## Data Flow

### Search Flow
```
User types in search input
       ↓
Debounce 500ms
       ↓
performNewSearch() triggered
       ↓
Clear gallery, show loading
       ↓
Reset pagination (page 1)
       ↓
loadNextPage() called
       ↓
Fetch from /api/gallery/search/images
       ↓
Process results, render to DOM
       ↓
Update URL with search params
```

### Infinite Scroll Flow
```
Page loaded with results
       ↓
Setup scroll event listener
       ↓
User scrolls down
       ↓
shouldLoadMore() checks conditions
       ↓
If true: loadNextPage()
       ↓
Fetch next page from API
       ↓
Append new items to gallery
       ↓
Update currentPage and hasMoreResults
```

### Media Type Switch Flow
```
User clicks image/video toggle
       ↓
switchMediaType() called
       ↓
Update currentMediaType
       ↓
Reset pagination (page 1)
       ↓
Clear gallery, show loading
       ↓
loadNextPage() fetches new media type
       ↓
Render new results
       ↓
Update URL with new media type
```

---

## Features

### 1. **Dynamic Search**
- No page reload on new search
- Results update instantly
- Browser URL synced with search state
- Respects user language preference
- NSFW content handling (handled by backend)

### 2. **Infinite Scroll**
- Loads 24 items per page
- Triggers automatically when scrolling near bottom
- Prevents duplicate requests
- Shows loading indicator during fetch

### 3. **Image/Video Toggle**
- Switch between image and video results
- Separate pagination for each type
- Active state styling
- Persisted in URL

### 4. **User-Friendly Design**
- Responsive grid layout (auto-fill columns)
- Card hover effects
- Image overlay on video thumbnails
- Smooth animations
- Mobile-optimized
- Loading states and empty states

### 5. **SEO Optimized**
- Proper meta tags
- Structured data
- Open Graph tags
- Canonical URLs

---

## API Response Format

### Image/Video Search Response
```json
{
  "images": [
    {
      "_id": "...",
      "imageUrl": "https://...",
      "videoUrl": "https://...",
      "prompt": "A beautiful landscape",
      "title": {"en": "Beautiful Sunset", "ja": "美しい夕焼け"},
      "slug": "beautiful-sunset",
      "chatId": "...",
      "chatName": "Artist Bot",
      "chatImageUrl": "https://...",
      "chatSlug": "artist-bot",
      "chatTags": ["landscape", "art", "nature"],
      "nsfw": false,
      "matchScore": 2
    }
  ],
  "page": 1,
  "totalPages": 5,
  "totalCount": 120
}
```

---

## Usage Examples

### 1. **Initial Page Load**
```javascript
// User navigates to /search?q=sunset&type=image
window.gallerySearchManager.loadFromURL();
// Loads images for "sunset" automatically
```

### 2. **New Search**
```javascript
// User types "landscape" in search box
// Debounce delay (500ms)
// performNewSearch('landscape') called
// Page clears, new results loaded
// URL updates to /search?q=landscape&type=image
```

### 3. **Infinite Scroll**
```javascript
// User scrolls down page
// shouldLoadMore() triggers at 500px from bottom
// loadNextPage() fetches page 2
// Results appended to gallery
```

### 4. **Media Type Switch**
```javascript
// User clicks "Videos" button
// switchMediaType('video') called
// Results cleared, loading shown
// Video results fetched
// URL updates to /search?q=sunset&type=video
```

---

## Configuration

### Debounce Delay
Edit in `public/js/gallery-search.js`:
```javascript
this.debounceDelay = 500; // ms
```

### Items Per Page
Edit search endpoint queries or `GallerySearchManager`:
```javascript
const limit = parseInt(request.query.limit) || 24;
```

### Infinite Scroll Trigger Distance
Edit in `public/js/gallery-search.js`:
```javascript
const triggerPosition = document.body.offsetHeight - 500; // 500px from bottom
```

### Images Per Chat Limit
Edit in `models/gallery-search-utils.js`:
```javascript
processImageResults(docs, limit = 3) // limit is 3 images per chat
```

---

## Styling

All styles are contained in `views/search-new.hbs` within the `<style>` tag:

### Key CSS Classes
- `.gallery-card` - Individual media card
- `.gallery-media-wrapper` - Media container
- `.gallery-media` - Image/video element
- `.media-type-toggle` - Toggle buttons
- `.btn-group` - Toggle button container

### Responsive Breakpoints
- Mobile: < 576px
- Tablet: 576px - 768px
- Desktop: > 768px

---

## Troubleshooting

### Search Not Working
1. Check browser console for errors
2. Verify `/api/gallery/search/images` endpoint returns data
3. Check user authentication status
4. Verify MongoDB connection

### Infinite Scroll Not Triggering
1. Check if `hasMoreResults` is true
2. Verify scroll handler is attached
3. Check browser console for errors
4. Verify viewport height calculations

### Results Not Rendering
1. Check media URLs are valid
2. Verify response structure matches expected format
3. Check browser console for rendering errors
4. Verify chat data is properly joined

### No Results Found
1. Check query string for special characters
2. Verify language settings match
3. Check if images/videos exist in database
4. Verify `imageUrl`/`videoUrl` fields exist

---

## Migration from Old Search

### Removed Files/Functions
- Old search endpoint logic moved to `gallery-search-utils.js`
- Tag suggestions removed from search page (can be re-added if needed)
- Pagination controls removed (replaced with infinite scroll)

### Updated Endpoints
- Old: `/chats/images/search` (still available, used for compatibility)
- New: `/api/gallery/search/images` (recommended)
- New: `/api/gallery/search/videos` (new)

### Updated Template
- Old: `views/search.hbs`
- New: `views/search-new.hbs`

### Files to Keep
The following files can be kept but are no longer used by the new search:
- `views/search.hbs` (old template, kept for reference)
- `/chats/images/search` endpoint in `routes/gallery.js` (still available)

---

## Future Enhancements

Possible improvements:
1. **Search Filters**
   - Filter by character/chat
   - Filter by upload date
   - Filter by aspect ratio (for images)
   - Duration filter (for videos)

2. **Search Suggestions**
   - Popular tags dropdown
   - Recent searches
   - Search history

3. **Advanced Features**
   - Search within results
   - Favorites/collections
   - Share results
   - Bulk download

4. **Performance**
   - Add search result caching
   - Optimize image lazy loading
   - Add search analytics

5. **UI Improvements**
   - Add view mode toggles (list/grid)
   - Sorting options (relevance/date/popularity)
   - Result count display
   - Search tips/help modal

---

## Support

For questions or issues:
1. Check browser console for error messages
2. Review MongoDB aggregation pipeline logic
3. Verify API responses match expected structure
4. Check user authentication and permissions
5. Review Fastify request/response handling
