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

console.log('%c[character.js] Script loaded', 'background: #4CAF50; color: white; padding: 5px;');
console.log('[character.js] Checking for required functions:');
console.log('[character.js] - displayImageModal:', typeof displayImageModal);
console.log('[character.js] - toggleImageLike:', typeof toggleImageLike);
console.log('[character.js] - displayImagesInGrid:', typeof displayImagesInGrid);

// Add GLOBAL click listener to catch ALL clicks on images for debugging
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'IMG' && e.target.closest('.media-item, [id*="images"], [id*="gallery"]')) {
        console.log('%c⚡ GLOBAL CLICK CAPTURED', 'background: #FF9800; color: white; padding: 5px;');
        console.log('Clicked element:', e.target);
        console.log('Element classes:', e.target.className);
        console.log('Element ID:', e.target.id);
        console.log('Closest media-item:', e.target.closest('.media-item'));
    }
}, true); // useCapture = true to catch in capture phase

console.log('[character.js] Global click listener attached');

// Add diagnostic function to window for manual testing
window.debugImageModal = function() {
    console.log('%c=== IMAGE MODAL DEBUG REPORT ===', 'background: #9C27B0; color: white; padding: 8px; font-size: 14px;');
    
    console.log('\n1. CHECK FUNCTIONS:');
    console.log('   displayImageModal:', typeof displayImageModal);
    console.log('   toggleImageLike:', typeof toggleImageLike);
    console.log('   displayImagesInGrid:', typeof displayImagesInGrid);
    console.log('   displayVideosInGrid:', typeof displayVideosInGrid);
    
    console.log('\n2. CHECK WINDOW DATA:');
    console.log('   window.loadedImages:', window.loadedImages?.length || 0, 'images');
    if (window.loadedImages?.length > 0) {
        console.log('   First image:', window.loadedImages[0]);
    }
    
    console.log('\n3. CHECK DOM ELEMENTS:');
    const grid = document.getElementById('imagesGrid');
    console.log('   imagesGrid found:', !!grid);
    if (grid) {
        const items = grid.querySelectorAll('.media-item');
        console.log('   .media-item elements:', items.length);
        const imgs = grid.querySelectorAll('img');
        console.log('   <img> elements:', imgs.length);
        if (items.length > 0) {
            console.log('   First media-item HTML:', items[0].innerHTML.substring(0, 100) + '...');
        }
    }
    
    console.log('\n4. TEST MODAL MANUALLY:');
    if (window.loadedImages?.length > 0) {
        console.log('   Run: displayImageModal(window.loadedImages[0])');
    } else {
        console.log('   No images loaded - can\'t test');
    }
    
    console.log('\n5. CLICK DETECTION TEST:');
    console.log('   Click on an image - watch for "⚡ GLOBAL CLICK CAPTURED" log');
    
    console.log('%c=== END DEBUG REPORT ===', 'background: #9C27B0; color: white; padding: 8px; font-size: 14px;');
};

console.log('[character.js] ✓ window.debugImageModal() function available - call it to diagnose issues');

/**
 * Initialize the character profile page
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('[character.js] DOMContentLoaded event fired');
    
    const profilePage = document.querySelector('#characterProfilePage');
    const chatId = profilePage?.dataset?.chatId || null;
    
    console.log('[character.js] Profile page found:', !!profilePage);
    console.log('[character.js] Chat ID:', chatId);
    
    if (chatId) {
        console.log('[character.js] Initializing character profile for chat:', chatId);
        window.characterProfile.currentChatId = chatId;
        initializeTabs();
        loadCharacterData(chatId);
        initializeSharing();
        initializeBackToTop();
        showDashboardFooter();
        console.log('[character.js] Character profile initialization complete');
    } else {
        console.log('[character.js] No chatId, loading character gallery');
        loadCharacterGallery();
    }
});
