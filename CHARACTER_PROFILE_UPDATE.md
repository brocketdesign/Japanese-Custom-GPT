# Instagram-Style Character Profile Update

## Overview
Updated the character profile page to display an Instagram-style design when viewing a specific character, and keep the gallery layout when no character is selected.

## Changes Made

### 1. Template Updates (`/views/character.hbs`)

#### Head Section
- Added CSS stylesheet: `/css/character.css`
- Added Swiper CSS for carousel functionality
- Added Animate.css for animations

#### HTML Structure
- **If Chat Available**: Displays Instagram-style profile with:
  - Profile header with avatar and stats (images, videos, messages)
  - Bio section with character name and description
  - Action buttons (Chat and Share)
  - Tab navigation (Images, Videos, About)
  - Content areas for each tab
  - Similar characters section

- **If No Chat Available**: Displays gallery layout with:
  - Stories-style horizontal chat menu
  - Filter bar with gender and NSFW filters
  - Multiple gallery grids (latest, popular, video chats)

#### JavaScript Initialization
```javascript
document.addEventListener('DOMContentLoaded', function() {
    const profilePage = document.querySelector('#characterProfilePage');
    const chatId = profilePage?.dataset?.chatId || null;
    
    if (chatId) {
        // Initialize Instagram-style profile
        window.characterProfile = {...};
        
        // Call initialization functions
        initializeTabs();
        loadCharacterData(chatId);
        initializeSharing();
        showDashboardFooter();
    }
});
```

### 2. Script Includes
Added the following scripts to support the Instagram profile:
- `/js/character-profile-loader.js` - Loads profile data (images, videos, stats)
- `/js/character-profile-ui.js` - Renders profile UI elements
- `/js/character-profile-interactions.js` - Handles user interactions
- `/js/character-infos.js` - Character information utilities
- `/js/character.js` - Main character page coordination

### 3. Backend Integration

#### API Endpoints Used (All Existing)
1. **GET `/api/character-stats/:chatId`** - Returns:
   - `messagesCount` - Total messages for the character
   - `imageCount` - Total images in gallery
   - `videoCount` - Total videos

2. **GET `/chat/:chatId/images`** - Returns paginated images with:
   - `images[]` - Array of image objects
   - `page` - Current page
   - `totalPages` - Total pages available
   - `totalImages` - Total image count

3. **GET `/chat/:chatId/videos`** - Returns paginated videos with:
   - `videos[]` - Array of video objects
   - `page` - Current page
   - `totalPages` - Total pages available
   - `totalVideos` - Total video count

4. **GET `/api/similar-chats/:chatId`** - Returns similar character recommendations

#### Route Handler
The `/character/slug/:slug` route in `server.js` (lines 726-940) passes:
- `chat` - The character object with all properties
- `image` - Optional: specific image if imageSlug param provided
- `user` - Current user object
- `isBlur` - Whether NSFW content should be blurred
- `isAdmin` - Whether user is admin
- SEO metadata, OpenGraph tags, and JSON-LD structured data

### 4. Data Display Features

#### Stat Counters
- Images count fetched from `/api/character-stats/:chatId`
- Videos count fetched from `/api/character-stats/:chatId`
- Messages count fetched from `/api/character-stats/:chatId`
- Displays loading spinner initially, then updates with actual counts

#### Image Gallery
- Loads images from `/chat/:chatId/images`
- Supports pagination with "Load More" button
- Shows NSFW content blurred for non-subscribers
- Each image can be clicked to open in fullscreen preview
- Like/favorite functionality available

#### Video Gallery
- Loads videos from `/chat/:chatId/videos`
- Supports pagination with "Load More" button
- Shows NSFW content blurred for non-subscribers
- Video preview with duration information

#### About Tab
- Displays character attributes (style, gender, content rating)
- Shows character rules if available
- Displays personality traits
- Shows character tags with links to search

#### Similar Characters
- Fetches similar characters from `/api/similar-chats/:chatId`
- Displays as a carousel grid
- Shows loading indicator while fetching

### 5. Styling

All styling is handled by existing CSS:
- `/css/character.css` - Main character page styles including:
  - `.ig-profile-header` - Profile header styling
  - `.ig-profile-info` - Profile info section
  - `.ig-avatar` - Avatar styling
  - `.ig-stats-row` - Stats display
  - `.ig-tab-nav` - Tab navigation
  - `.media-grid` - Image/video grid layout
  - `.media-item` - Individual gallery item
  - `.ig-about-container` - About section layout
  - Instagram-like dark theme styling
  - Responsive design for mobile/tablet/desktop

## Function Dependencies

### From character-profile-loader.js
- `loadCharacterData(chatId)` - Main data loading function
- `fetchCharacterImageCount(chatId)` - Fetch image count
- `fetchCharacterVideoCount(chatId)` - Fetch video count
- `loadCharacterStats(chatId)` - Load all stats
- `loadSimilarCharacters(chatId)` - Load similar characters
- `loadCharacterPersonality()` - Load personality traits

### From character-profile-ui.js
- `displayImagesInGrid(images, chatId)` - Display images in grid
- `displayMoreImagesInGrid(images, chatId)` - Append more images
- `displayVideosInGrid()` - Display videos in grid
- `displaySimilarCharacters(characters)` - Display similar characters
- `updateCharacterImageCount(count)` - Update image count display
- `updateCharacterVideoCount(count)` - Update video count display

### From character-profile-interactions.js
- `initializeTabs()` - Setup tab switching
- `initializeSharing()` - Setup sharing functionality
- `toggleImageLike(event)` - Like/unlike image

## How It Works

1. **Page Load**: User navigates to `/character/slug/{slug}`
2. **Backend**: Route handler fetches character data and renders `character.hbs`
3. **Template Render**: 
   - If `chat` object exists, shows Instagram profile
   - If no `chat`, shows gallery
4. **JavaScript Init**: DOMContentLoaded event fires
   - Detects chatId from data attribute
   - Initializes `window.characterProfile`
   - Calls `loadCharacterData(chatId)`
5. **Data Loading**:
   - Fetches stats from `/api/character-stats/:chatId`
   - Loads first page of images from `/chat/:chatId/images`
   - Loads first page of videos from `/chat/:chatId/videos`
   - Fetches similar characters from `/api/similar-chats/:chatId`
6. **UI Rendering**: Functions display data in respective tabs/sections

## Testing

To test the Instagram profile:
1. Navigate to `/character/slug/{any-character-slug}`
2. Verify profile header displays with avatar and stats
3. Check that image count, video count, and message count are fetched and displayed
4. Click tabs to switch between Images, Videos, and About
5. Scroll to load more images/videos if available
6. Verify "Similar Characters" section loads below

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with viewport support

## Performance Considerations

- Stats are fetched immediately (non-blocking)
- Images and videos use lazy loading
- Similar characters fetched after other data loads
- Pagination prevents loading all data at once
- CSS uses modern Grid and Flexbox for responsive design
