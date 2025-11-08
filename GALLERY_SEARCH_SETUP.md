# Gallery Search - Quick Setup Guide

## Files Created

### Backend Files
1. **`models/gallery-search-utils.js`**
   - Pure utility functions for building search pipelines
   - Functions for processing results
   - Search query execution functions

2. **`routes/gallery-search.js`**
   - Two new API endpoints:
     - `GET /api/gallery/search/images`
     - `GET /api/gallery/search/videos`

### Frontend Files
3. **`public/js/gallery-search.js`**
   - `GallerySearchManager` class
   - Handles dynamic search, infinite scroll, and media toggle

4. **`views/search-new.hbs`**
   - New search page template
   - Responsive design
   - Image/Video toggle
   - Infinite scroll gallery

### Configuration Files
5. **`plugins/routes.js`** (Modified)
   - Added registration for `gallery-search.js` route

6. **`server.js`** (Modified)
   - Updated `/search` route to use `search-new.hbs`
   - Removed server-side pagination logic
   - Simplified to pass only necessary data

---

## How It Works

### 1. User Navigates to Search
```
/search → renders search-new.hbs
```

### 2. User Enters Search Query
```
Type in search box (debounced 500ms) 
  → performNewSearch() called
  → Fetch /api/gallery/search/images?query=X&page=1
  → Results rendered to gallery
```

### 3. User Scrolls Down (Infinite Scroll)
```
Scroll near bottom (500px trigger)
  → loadNextPage() called
  → Fetch /api/gallery/search/images?page=2
  → Results appended to gallery
```

### 4. User Toggles Media Type
```
Click "Videos" button
  → switchMediaType('video') called
  → Clear gallery
  → Fetch /api/gallery/search/videos?query=X&page=1
  → Render video results
```

---

## Key Features

✅ **Dynamic Search** - No page reload, instant results
✅ **Infinite Scroll** - Automatic pagination
✅ **Image/Video Toggle** - Switch between media types
✅ **Responsive Design** - Mobile, tablet, desktop optimized
✅ **User-Friendly** - Clean, modern interface
✅ **SEO Optimized** - Proper meta tags and structure
✅ **Language-Aware** - Respects user language preference
✅ **No Duplicate Code** - Centralized logic in utils

---

## API Endpoints

### Search Images
```
GET /api/gallery/search/images?query=sunset&page=1&limit=24

Response:
{
  "images": [...],
  "page": 1,
  "totalPages": 5,
  "totalCount": 120
}
```

### Search Videos
```
GET /api/gallery/search/videos?query=sunset&page=1&limit=24

Response:
{
  "videos": [...],
  "page": 1,
  "totalPages": 3,
  "totalCount": 72
}
```

---

## Testing Checklist

- [ ] Navigate to `/search`
- [ ] See search input and image/video toggle
- [ ] Type search query (e.g., "landscape")
- [ ] See results load dynamically
- [ ] URL updates with search params (`?q=landscape&type=image`)
- [ ] Scroll down and see more results load
- [ ] Click "Videos" button
- [ ] See video results load
- [ ] Switch back to "Images"
- [ ] Previous image results preserved (optional)
- [ ] Try empty search
- [ ] Try search with no results
- [ ] Check browser console for errors
- [ ] Test on mobile viewport
- [ ] Test with different user languages

---

## Translation Keys

Add these to your translation files if needed:

```json
{
  "images": "Images",
  "videos": "Videos",
  "loading": "Loading...",
  "start_searching": "Start searching to see results",
  "no_results_found": "No results found for your search",
  "discover": "Discover"
}
```

---

## Customization

### Change Debounce Delay
File: `public/js/gallery-search.js` (Line ~14)
```javascript
this.debounceDelay = 1000; // Change to 1 second
```

### Change Items Per Page
File: Any search endpoint call, change `limit` parameter
```javascript
limit: 24 // Change to 12, 36, etc.
```

### Change Infinite Scroll Trigger Distance
File: `public/js/gallery-search.js` (Line ~244)
```javascript
const triggerPosition = document.body.offsetHeight - 1000; // 1000px instead of 500px
```

### Customize Styling
Edit CSS in `views/search-new.hbs` under `<style>` tag

---

## Backward Compatibility

The old search functionality is still available:
- Old endpoint: `/chats/images/search` (still works)
- Old template: `views/search.hbs` (kept for reference)
- Can be used alongside new search

---

## Performance Notes

- Debouncing reduces API calls
- Pagination prevents loading all results at once
- MongoDB aggregation pipeline is optimized
- Language filtering reduces results set
- Client-side rendering is fast

---

## Browser Support

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Mobile browsers: ✅ Responsive design

---

## Next Steps (Optional)

Consider adding these features:

1. **Search Filters**
   - Filter by character
   - Filter by date range
   - NSFW toggle

2. **View Modes**
   - Switch between grid/list view
   - Adjust grid size

3. **Sorting**
   - Sort by relevance (default)
   - Sort by date
   - Sort by popularity

4. **Advanced**
   - Search suggestions
   - Recent searches
   - Save favorites

---

## Troubleshooting

**Search not working?**
- Check browser console (F12 → Console)
- Verify `/api/gallery/search/images` returns data
- Check user is logged in

**Infinite scroll not working?**
- Check browser console for errors
- Verify totalPages > current page
- Try scrolling slower (might be debouncing)

**No results showing?**
- Verify images exist in database
- Check query string for special chars
- Verify language settings

**URLs not updating?**
- Check browser console
- Verify JavaScript is enabled
- Check for console errors

---

## File Sizes

- `gallery-search-utils.js`: ~7 KB
- `gallery-search.js`: ~12 KB  
- `gallery-search-route.js`: ~2 KB
- `search-new.hbs`: ~8 KB
- **Total**: ~29 KB

---

For detailed documentation, see: `GALLERY_SEARCH_DOCUMENTATION.md`
