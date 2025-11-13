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
window.characterProfile = {
    totalImages: 0,
    totalVideos: 0,
    currentChatId: null,
    imagesLoading: false,
    videosLoading: false,
    videosLoaded: false
};

/**
 * Initialize the character profile page
 */
document.addEventListener('DOMContentLoaded', function() {
    const profilePage = document.querySelector('#characterProfilePage');
    const chatId = profilePage?.dataset?.chatId || null;
    
    if (chatId) {
        window.characterProfile.currentChatId = chatId;
        initializeTabs();
        loadCharacterData(chatId);
        initializeSharing();
        initializeBackToTop();
        showDashboardFooter();
    } else {
        loadCharacterGallery();
    }
});
