# Similar Characters Infinite Scroll - Test Plan

## Overview
This document outlines the test plan for the horizontal infinite scroll feature implemented for similar characters on the character page.

## Feature Description
The similar characters section now supports infinite horizontal scrolling:
- Initially loads 10 similar characters
- Automatically loads more characters when user scrolls near the end
- Supports up to 50 similar characters total (5 pages of 10 characters each)
- Smooth, seamless appending of new characters

## Test Cases

### 1. Initial Load Test
**Objective:** Verify that the first page of similar characters loads correctly

**Steps:**
1. Navigate to any character page (e.g., `/character/{character-slug}`)
2. Scroll down to the "Similar Characters" section
3. Observe the initial characters displayed

**Expected Results:**
- Up to 10 similar characters should be displayed
- Characters should be in a horizontal scrollable grid
- Loading spinner should appear briefly then disappear
- No JavaScript errors in console

### 2. Horizontal Scroll Test
**Objective:** Verify that the horizontal scroll works properly

**Steps:**
1. Navigate to a character page with similar characters
2. Locate the similar characters grid
3. Use mouse or touch to scroll horizontally

**Expected Results:**
- Grid should scroll smoothly left and right
- No vertical scrolling within the grid
- Characters should remain visible and properly aligned

### 3. Infinite Scroll Trigger Test
**Objective:** Verify that scrolling near the end triggers loading of more characters

**Steps:**
1. Navigate to a character page with more than 10 similar characters
2. Scroll the similar characters grid to the right
3. Continue scrolling until near the end (within 200px)
4. Observe the loading behavior

**Expected Results:**
- When scrolling within 200px of the right edge, new characters should load
- A brief loading indicator may appear (check console logs)
- New characters should appear seamlessly appended to the right
- No duplicate characters should appear
- Grid should remain scrollable with new content

### 4. Multiple Page Load Test
**Objective:** Verify that multiple pages can be loaded sequentially

**Steps:**
1. Navigate to a character page with many similar characters (>30)
2. Scroll to trigger first additional page load
3. Continue scrolling to trigger second additional page load
4. Repeat until no more characters are available

**Expected Results:**
- Each scroll near the end should load the next page
- Up to 5 pages total (50 characters) should be loadable
- No duplicate characters across pages
- Loading should stop when all pages are loaded

### 5. End of Results Test
**Objective:** Verify behavior when all similar characters are loaded

**Steps:**
1. Navigate to a character page
2. Scroll through all available similar characters
3. Continue scrolling past the last character

**Expected Results:**
- No additional API calls should be made once all characters are loaded
- No errors in console
- Grid should remain at the end with no loading indicators

### 6. API Pagination Test
**Objective:** Verify that the backend API correctly handles pagination

**Steps:**
1. Open browser developer tools (Network tab)
2. Navigate to a character page
3. Observe the API calls to `/api/similar-chats/{chatId}`
4. Scroll to trigger additional pages

**Expected Results:**
- Initial call: `/api/similar-chats/{chatId}?page=1&limit=10`
- Second call: `/api/similar-chats/{chatId}?page=2&limit=10`
- Each response should include:
  - `similarChats`: Array of character objects
  - `pagination.currentPage`: Current page number
  - `pagination.totalPages`: Total number of pages
  - `pagination.totalResults`: Total number of similar characters
  - `pagination.hasMore`: Boolean indicating if more pages exist

### 7. Error Handling Test
**Objective:** Verify graceful error handling

**Steps:**
1. Navigate to a character page
2. Use browser dev tools to simulate network errors (throttle or block API)
3. Scroll to trigger loading of more characters

**Expected Results:**
- Application should not crash
- Error should be logged to console
- User should not see broken UI
- Scroll should still work for already-loaded characters

### 8. Performance Test
**Objective:** Verify that the feature performs well

**Steps:**
1. Navigate to a character page
2. Monitor browser performance (memory, CPU)
3. Scroll through multiple pages of similar characters
4. Navigate away and return multiple times

**Expected Results:**
- No memory leaks (check with browser profiler)
- Smooth scrolling without lag
- Event listeners should be properly cleaned up
- No significant CPU spikes

### 9. Mobile Responsiveness Test
**Objective:** Verify that the feature works on mobile devices

**Steps:**
1. Use browser dev tools to simulate mobile viewport
2. Navigate to a character page
3. Test horizontal scrolling with touch simulation
4. Test infinite scroll loading

**Expected Results:**
- Horizontal scroll should work with touch gestures
- Characters should be appropriately sized for mobile
- Loading should trigger at appropriate scroll position
- No horizontal overflow issues

### 10. Cache Test
**Objective:** Verify that caching works correctly

**Steps:**
1. Navigate to a character page (first visit)
2. Note the API response time
3. Navigate away and return to the same character page
4. Observe if results are cached

**Expected Results:**
- Backend should cache similar characters for 24 hours
- Subsequent requests should be faster
- Pagination should work with cached data

## API Contract

### Request
```
GET /api/similar-chats/{chatId}?page={page}&limit={limit}
```

**Parameters:**
- `chatId` (path): Character ID
- `page` (query, optional): Page number (1-100, default: 1)
- `limit` (query, optional): Results per page (1-50, default: 10)

### Response
```json
{
  "similarChats": [
    {
      "_id": "...",
      "name": "Character Name",
      "chatImageUrl": "...",
      "slug": "...",
      "gender": "...",
      "imageStyle": "...",
      "language": "...",
      "nsfw": false
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalResults": 50,
    "limit": 10,
    "hasMore": true
  }
}
```

## Console Debugging

Monitor the browser console for these debug messages:
- `[SimilarCharacters] Near end of scroll, loading more...` - Indicates scroll trigger
- `[API/SimilarChats] Using cached results for {chatId}` - Indicates cache hit
- Any error messages related to similar characters

## Known Limitations

1. Maximum 50 similar characters (5 pages of 10) - configurable in backend
2. 200px scroll threshold is fixed - defined in `SIMILAR_CHARACTERS_SCROLL_THRESHOLD`
3. Cache expires after 24 hours
4. Similarity calculation requires character prompts

## Troubleshooting

### Issue: No similar characters displayed
**Possible Causes:**
- Character has no prompt/description
- No similar characters found in database
- API error

**Debug:**
- Check console for errors
- Verify API response in Network tab
- Check if character has valid prompt data

### Issue: Infinite scroll not triggering
**Possible Causes:**
- Not enough characters to scroll
- Event listener not attached
- Already at end of results

**Debug:**
- Check if `window.characterProfile.similarCharacters` state exists
- Verify scroll listener is attached in console
- Check `hasMore` flag in state

### Issue: Duplicate characters
**Possible Causes:**
- Multiple scroll triggers
- State not updating correctly

**Debug:**
- Check console logs for multiple load calls
- Verify state updates after each page load
- Check loading flag is set correctly

## Success Criteria

The implementation is successful if:
- ✅ Initial 10 characters load correctly
- ✅ Horizontal scrolling works smoothly
- ✅ Additional characters load when scrolling near end
- ✅ No duplicate characters appear
- ✅ Loading stops when all characters are loaded
- ✅ No JavaScript errors or console warnings
- ✅ No memory leaks or performance issues
- ✅ Works on both desktop and mobile
- ✅ API pagination works as documented
- ✅ Caching reduces server load

## Security Verification

CodeQL analysis completed with 0 alerts - no security vulnerabilities found.
