# Favorites Feature Documentation

## Overview
A complete favorites/bookmarks system for users to save their favorite AI characters and access them later. The feature includes backend CRUD operations, database models, API routes, and frontend JavaScript client.

## Files Created

### 1. Backend Model: `/models/favorites-utils.js`
Database utility functions for managing favorites.

**Key Functions:**
- `addFavorite(db, userId, chatId)` - Add a chat to user's favorites
- `removeFavorite(db, userId, chatId)` - Remove a chat from favorites
- `isFavorited(db, userId, chatId)` - Check if a chat is favorited
- `toggleFavorite(db, userId, chatId)` - Toggle favorite status
- `getUserFavorites(db, userId, options)` - Get user's favorites with pagination
- `checkFavoritesStatus(db, userId, chatIds)` - Check status for multiple chats
- `getFavoriteCount(db, userId)` - Get total favorite count
- `deleteUserFavorites(db, userId)` - Delete all favorites (for account deletion)

**Database Collection:** `user_favorites`
- Fields: `userId`, `chatId`, `createdAt`, `updatedAt`

### 2. Backend API: `/routes/favorites-api.js`
REST API endpoints for favorites management.

**Endpoints:**

#### POST `/favorites/toggle`
Toggle favorite status for a chat
- Body: `{ chatId }`
- Returns: `{ success, isFavorited, message }`

#### POST `/favorites/add`
Add a chat to favorites
- Body: `{ chatId }`
- Returns: `{ success, message, id }`

#### POST `/favorites/remove`
Remove a chat from favorites
- Body: `{ chatId }`
- Returns: `{ success, message, deletedCount }`

#### GET `/favorites/check/:chatId`
Check if a chat is favorited by current user
- Returns: `{ isFavorited, chatId }`

#### GET `/favorites/check-multiple?chatIds=id1,id2,id3`
Check favorite status for multiple chats
- Returns: `{ favorites: { id1: true/false, id2: true/false, ... } }`

#### GET `/favorites`
Get user's favorite chats with pagination
- Query: `page=1&limit=12`
- Returns: `{ data: [...], pagination: { page, limit, total, totalPages } }`

#### GET `/favorites/count`
Get total number of user's favorite chats
- Returns: `{ count, success }`

### 3. Frontend JavaScript: `/public/js/favorites.js`
Client-side module for favorites management with caching.

**Main Object:** `Favorites`

**Key Methods:**

```javascript
// Toggle favorite status
Favorites.toggleFavorite(chatId, callback)

// Add to favorites
Favorites.addFavorite(chatId, callback)

// Remove from favorites
Favorites.removeFavorite(chatId, callback)

// Check if favorited
Favorites.checkFavorite(chatId, callback)

// Check multiple chats
Favorites.checkMultipleFavorites(chatIds, callback)

// Get user's favorites with pagination
Favorites.getUserFavorites(page, limit, callback)

// Get total favorite count
Favorites.getFavoriteCount(callback)

// Update button UI state
Favorites.updateFavoriteButton(chatId, isFavorited)

// Display user's favorites
Favorites.displayUserFavorites(options)

// Render favorites in container
Favorites.renderFavoritesInContainer(favorites, container)

// Clear client-side cache
Favorites.clearCache()
```

**Features:**
- Client-side caching to minimize API calls
- Automatic notification display (success/error)
- Event listener initialization on document ready
- Responsive error handling

### 4. Updated Files

#### `/plugins/routes.js`
Added route registration:
```javascript
fastify.register(require('../routes/favorites-api'));
```

#### `/public/js/chat-list.js`
Updated `updateNavbarChatActions()` function to:
- Check favorite status for current chat
- Display star icon (filled or outline) based on favorite status
- Add favorite toggle button to dropdown menu
- Show "Add to Favorites" or "Remove from Favorites" text dynamically

#### `/views/chat.hbs`
Added script include:
```html
<script src="/js/favorites.js"></script>
```

#### Locale Files (`/locales/en.json`, `/locales/fr.json`, `/locales/ja.json`)
Added translation strings under `favorite` object:
- `addFavorite` - Button text to add favorite
- `removeFavorite` - Button text to remove favorite
- `favorited` - Success notification when added
- `unfavorited` - Success notification when removed
- `favorites` - Menu/page title
- `myFavorites` - My favorites page title
- `noFavorites` - Empty state message
- `addedToFavorites` - Success message
- `removedFromFavorites` - Success message
- `requestFailed` - Error message

## Database Schema

### Collection: `user_favorites`
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // Reference to users collection
  chatId: ObjectId,           // Reference to chats collection
  createdAt: Date,            // When favorited
  updatedAt: Date             // Last updated
}
```

**Indexes (recommended):**
```javascript
// For fast lookups
db.user_favorites.createIndex({ userId: 1, chatId: 1 }, { unique: true })
db.user_favorites.createIndex({ userId: 1, createdAt: -1 })
```

## Usage Examples

### JavaScript Frontend

```javascript
// Toggle favorite status
Favorites.toggleFavorite(chatId, function(response) {
  console.log('Favorite toggled:', response.isFavorited);
});

// Check if a chat is favorited
Favorites.checkFavorite(chatId, function(isFavorited) {
  if (isFavorited) {
    console.log('This chat is favorited');
  }
});

// Get all favorites
Favorites.getUserFavorites(1, 12, function(response) {
  console.log('Favorites:', response.data);
  console.log('Pages:', response.pagination.totalPages);
});

// Display favorites in a container
Favorites.displayUserFavorites({
  page: 1,
  limit: 12,
  container: '#favorites-container'
});

// Initialize favorite buttons
Favorites.initializeFavoriteButtons();
```

### HTML Button Usage

```html
<!-- Favorite button with data attribute -->
<button class="btn" data-favorite-btn="chatId">
  <i class="bi bi-star"></i> Favorite
</button>
```

### Integration with Chat Actions

The favorite button is automatically integrated into the chat actions dropdown menu in `updateNavbarChatActions()`:

```
- Edit/Update
- Chat History
- **Add to Favorites** ← New
- New Chat
- Admin Tools (if admin)
- Delete
```

## API Response Examples

### Toggle Favorite
```json
{
  "success": true,
  "isFavorited": true,
  "message": "Chat added to favorites"
}
```

### Get Favorites
```json
{
  "data": [
    {
      "_id": "...",
      "favoriteId": "...",
      "chatName": "Character Name",
      "chatImageUrl": "...",
      "description": "...",
      "favoritedAt": "2024-11-17T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 25,
    "totalPages": 3
  }
}
```

## Error Handling

All API endpoints include proper error handling:
- Returns HTTP 401 if user is not authenticated
- Returns HTTP 400 if required parameters are missing
- Returns HTTP 500 for server errors
- Frontend shows user-friendly notification messages

## Caching Strategy

The frontend JavaScript implements a Map-based cache to minimize API calls:
- Favorite status is cached after first check
- Cache can be cleared with `Favorites.clearCache()`
- Cache entries are individual per chat ID

## Security Considerations

- All endpoints require user authentication via `request.user`
- Users can only view/manage their own favorites
- MongoDB ObjectId validation ensures data integrity
- Duplicate favorites prevented via unique constraint

## Performance Optimization

- **Database indexes**: Add indexes on `userId` and `(userId, chatId)` for fast queries
- **Client-side caching**: Reduces API calls for repeated favorite checks
- **Pagination**: Supports efficient loading of large favorites lists
- **Batch checking**: `checkMultipleFavorites()` checks multiple chats in single request

## Future Enhancements

Potential features to add:
1. Favorites collections/folders
2. Favorite ordering/sorting options
3. Favorite count leaderboard
4. Shared favorites with other users
5. Favorite chat templates
6. Export favorites list
7. Favorite sync across devices

## Troubleshooting

### Favorite button not showing
- Ensure `favorites.js` is loaded in the view
- Check browser console for JavaScript errors
- Verify translations are loaded

### API returns 401
- User must be authenticated
- Check JWT token validity

### Favorite status not updating
- Check network tab for API response
- Verify user ID is correct
- Clear browser cache and try again

### Database collection not found
- Create `user_favorites` collection manually if needed
- Migrations will create it automatically on first use

## Testing

### Unit Tests
```javascript
// Test toggle favorite
Favorites.toggleFavorite('chatId123', function(response) {
  console.assert(response.success === true);
  console.assert(response.isFavorited === true);
});
```

### Integration Tests
- Test with actual MongoDB instance
- Verify favorite status persists across sessions
- Test pagination with large datasets

## Deployment Notes

1. Add database index on `user_favorites` collection
2. Ensure `favorites.js` is minified in production
3. Set proper CORS headers for API endpoints
4. Monitor API usage for performance metrics
5. Archive old favorites periodically (optional)

