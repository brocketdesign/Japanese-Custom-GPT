/**
 * Character Profile Page - Main Entry Point
 * Initializes the character profile page and coordinates all modules
 * 
 * Modules loaded:
 * - character-profile-loader.js: Data loading functions
 * - character-profile-ui.js: UI rendering functions
 * - character-profile-interactions.js: User interaction handlers
 */

// Store total counts for the character
// Note: This is the initial structure. The inline script in character.hbs
// will re-initialize with more complete state (contentType, pagination, etc.)
// and call loadCharacterData. Do NOT call loadCharacterData here to avoid
// duplicate API calls and race conditions.
window.characterProfile = {
    totalImages: 0,
    totalVideos: 0,
    currentChatId: null,
    imagesLoading: false,
    videosLoading: false,
    videosLoaded: false
};

// Note: Character profile initialization is handled by the inline script
// in character.hbs to ensure proper sequencing with the more complete
// window.characterProfile state (including contentType and pagination).
// This file only provides the initial structure and helper functions.
