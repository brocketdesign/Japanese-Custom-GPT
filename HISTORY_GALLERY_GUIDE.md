# History Gallery Feature - User Guide

## Overview

The History Gallery is a new feature that allows users to view and organize all their generated images and videos in one centralized location. Content is automatically sorted and grouped by character for easy navigation and discovery.

## Accessing the History Gallery

1. Click on your avatar in the top navigation
2. Select **"History"** from the dropdown menu
3. You will be redirected to `/history`

## Features

### 1. **Content Display**
- All your generated images and videos are displayed in a responsive grid
- Thumbnails are optimized for quick loading
- Videos show a play icon overlay
- Recent content (< 24 hours) displays a "New" badge

### 2. **Filtering Options**

#### By Content Type
- **All Content**: Shows both images and videos (default)
- **Recent**: Shows only content from the last 24 hours
- **Images Only**: Filters to show only generated images
- **Videos Only**: Filters to show only generated videos

#### By Character
- Use the character dropdown to filter content by specific characters
- The dropdown shows character names with item counts
- Example: "Sakura (15)" means 15 items generated with the Sakura character

### 3. **Content Details Modal**

Click on any image or video to open a detailed view modal that shows:

#### For Images:
- Full-size image preview
- Character information (with link to character profile)
- Generation prompt
- Creation timestamp
- Seed value
- Aspect ratio
- Model name
- Generation steps
- Guidance scale
- Like count (if applicable)

#### For Videos:
- Video player with controls
- Character information
- Generation prompt
- Creation timestamp
- Duration
- Aspect ratio

### 4. **Notification Integration**

When you receive a notification about newly generated content:
1. Click on the notification
2. You'll be redirected to the History page
3. A modal will automatically open showing the content details

**Technical Note**: Notifications with modal links use the format `#modal:type/id` (e.g., `#modal:image/507f1f77bcf86cd799439011`)

### 5. **Pagination**

- Content loads 24 items at a time
- Click "Load More" at the bottom to load the next page
- The system tracks total pages and remaining content

## Character Organization

Content is organized by character in the backend:
- Each piece of content is associated with the character that generated it
- You can easily filter to see all content from a specific character
- Character thumbnails and names are displayed for quick identification

## Mobile Responsive Design

The History Gallery is fully responsive:
- **Mobile**: 2 columns grid
- **Tablet**: 3 columns grid
- **Desktop**: 4 columns grid
- **Large Desktop**: 5 columns grid

## API Endpoints

For developers integrating with the History Gallery:

### Get User History
```
GET /api/user/history?page=1&limit=24&character=<chatId>
```

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 24)
- `character` (optional): Filter by character ID

**Response**:
```json
{
  "content": [/* array of content items */],
  "groupedByCharacter": {/* character groups */},
  "page": 1,
  "totalPages": 5,
  "totalCount": 120
}
```

### Get Content Details
```
GET /gallery/content/:contentId/info?type=<image|video>
```

**Query Parameters**:
- `type`: Either "image" or "video"

**Response**:
```json
{
  "success": true,
  "contentType": "image",
  "data": {
    "content": {/* content details */},
    "chat": {/* character info */},
    "request": {/* generation parameters */}
  }
}
```

## Performance Considerations

- Images use lazy loading for optimal performance
- Content is paginated to prevent loading all items at once
- Database queries use proper indexing for fast retrieval
- Character information is cached in a map to reduce lookups

## Privacy & Access

- Users can only see their own generated content
- Content is filtered by user ID on the backend
- All API endpoints require authentication

## Future Enhancements

Potential improvements for future releases:
- Bulk operations (delete multiple items)
- Advanced search and filtering
- Download options
- Share to social media
- Favorites/Collections organization
- Export history as archive
