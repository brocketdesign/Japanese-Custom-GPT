/**
 * Character Profile Loader
 * Handles loading and initialization of character profile data
 */

/**
 * Load all character data (images, stats, similar characters, etc.)
 */
function loadCharacterData(chatId) {
    // Show loading state for counts immediately
    showCountLoadingState();
    
    // Fetch total counts immediately (before lazy loading content)
    fetchCharacterImageCount(chatId);
    fetchCharacterVideoCount(chatId);
    
    loadCharacterImages(chatId);
    loadCharacterStats(chatId);
    loadSimilarCharacters(chatId);
    loadCharacterPersonality();
    
    if (typeof loadChatUsers === 'function') {
        loadChatUsers(chatId);
    }
}

/**
 * Load character images with load more button (pagination)
 * Does NOT use infinite scroll - only loads first page initially
 */
function loadCharacterImages(chatId) {
    console.log(`[loadCharacterImages] Starting load for chatId: ${chatId}`);
    
    if (window.characterProfile.imagesLoading) {
        console.warn(`[loadCharacterImages] Already loading, skipping`);
        return;
    }
    
    // Initialize pagination state for character profile
    if (!window.characterProfile.imagesCurrentPage) {
        window.characterProfile.imagesCurrentPage = 1;
        window.characterProfile.imagesTotalPages = 0;
    }
    
    if (typeof loadChatImages === 'function') {
        window.characterProfile.imagesLoading = true;
        window.loadedImages = [];
        console.log(`[loadCharacterImages] Initialized: currentPage=1, totalPages=0, loadedImages cleared`);
        
        loadChatImages(chatId, 1, true)
            .then(() => {
                console.log(`[loadCharacterImages] loadChatImages completed`);
                console.log(`[loadCharacterImages] window.loadedImages count: ${(window.loadedImages || []).length}`);
                
                setTimeout(() => {
                    console.log(`[loadCharacterImages] Calling displayImagesInGrid()`);
                    displayImagesInGrid();
                    // Fetch total count separately
                    console.log(`[loadCharacterImages] Fetching total image count`);
                    fetchCharacterImageCount(chatId);
                    window.characterProfile.imagesLoading = false;
                    // After loading first page, show load more button if needed
                    console.log(`[loadCharacterImages] Updating load more button`);
                    updateLoadMoreButton(chatId);
                }, 500);
            })
            .catch((error) => {
                console.error('[loadCharacterImages] Error loading character images:', error);
                window.characterProfile.imagesLoading = false;
                displayImagesInGrid();
            });
    } else {
        console.error(`[loadCharacterImages] loadChatImages function not available`);
    }
}

/**
 * Load next page of character images
 */
function loadMoreCharacterImages(chatId) {
    console.log(`[loadMoreCharacterImages] Starting load for chatId: ${chatId}`);
    console.log(`[loadMoreCharacterImages] Current state - isLoading: ${window.characterProfile.imagesLoading}, currentPage: ${window.characterProfile.imagesCurrentPage}, totalPages: ${window.characterProfile.imagesTotalPages}`);
    
    if (window.characterProfile.imagesLoading) {
        console.warn('[loadMoreCharacterImages] Already loading images, please wait...');
        return;
    }
    
    const nextPage = (window.characterProfile.imagesCurrentPage || 1) + 1;
    console.log(`[loadMoreCharacterImages] Requesting nextPage: ${nextPage}`);
    
    // Check if there are more pages
    if (nextPage > window.characterProfile.imagesTotalPages) {
        console.log(`[loadMoreCharacterImages] No more pages to load (nextPage ${nextPage} > totalPages ${window.characterProfile.imagesTotalPages})`);
        return;
    }
    
    if (typeof loadChatImages === 'function') {
        window.characterProfile.imagesLoading = true;
        console.log(`[loadMoreCharacterImages] Set imagesLoading = true`);
        
        // Show loading spinner on button
        if (typeof showLoadMoreButtonSpinner === 'function') {
            console.log(`[loadMoreCharacterImages] Showing loading spinner`);
            showLoadMoreButtonSpinner('images');
        }
        
        // Load next page WITHOUT reload flag - this will render images and append to grid
        console.log(`[loadMoreCharacterImages] Calling loadChatImages(${chatId}, ${nextPage}, false)`);
        loadChatImages(chatId, nextPage, false)
            .then(() => {
                console.log(`[loadMoreCharacterImages] loadChatImages completed`);
                console.log(`[loadMoreCharacterImages] window.loadedImages count after load: ${(window.loadedImages || []).length}`);
                
                setTimeout(() => {
                    console.log(`[loadMoreCharacterImages] Calling displayImagesInGrid() to refresh display`);
                    // Display the newly loaded images in the grid
                    displayImagesInGrid();
                    // Update current page AFTER successful load
                    window.characterProfile.imagesCurrentPage = nextPage;
                    console.log(`[loadMoreCharacterImages] Updated imagesCurrentPage to: ${nextPage}`);
                    // Update button visibility
                    console.log(`[loadMoreCharacterImages] Updating load more button`);
                    updateLoadMoreButton(chatId);
                    // Hide loading spinner
                    if (typeof hideLoadMoreButtonSpinner === 'function') {
                        console.log(`[loadMoreCharacterImages] Hiding loading spinner`);
                        hideLoadMoreButtonSpinner('images');
                    }
                    window.characterProfile.imagesLoading = false;
                    console.log(`[loadMoreCharacterImages] Set imagesLoading = false`);
                }, 300);
            })
            .catch((error) => {
                console.error('[loadMoreCharacterImages] Error loading next page of images:', error);
                // Hide loading spinner on error
                if (typeof hideLoadMoreButtonSpinner === 'function') {
                    hideLoadMoreButtonSpinner('images');
                }
                window.characterProfile.imagesLoading = false;
            });
    } else {
        console.error(`[loadMoreCharacterImages] loadChatImages function not available`);
    }
}

/**
 * Load videos with lazy loading support (pagination, no infinite scroll)
 */
function loadVideos() {
    console.log(`[loadVideos] Starting video load`);
    
    if (window.characterProfile.videosLoading || window.characterProfile.videosLoaded) {
        console.warn(`[loadVideos] Already loading or loaded (videosLoading: ${window.characterProfile.videosLoading}, videosLoaded: ${window.characterProfile.videosLoaded})`);
        return;
    }
    
    const chatId = window.characterProfile.currentChatId;
    console.log(`[loadVideos] Current chatId: ${chatId}`);
    
    // Initialize pagination state for videos
    if (!window.characterProfile.videosCurrentPage) {
        window.characterProfile.videosCurrentPage = 1;
        window.characterProfile.videosTotalPages = 0;
    }
    
    if (chatId && typeof loadChatVideos === 'function') {
        window.characterProfile.videosLoading = true;
        window.loadedVideos = [];
        console.log(`[loadVideos] Initialized: currentPage=1, totalPages=0, loadedVideos cleared`);
        
        loadChatVideos(chatId, 1, true)
            .then(() => {
                console.log(`[loadVideos] loadChatVideos completed`);
                console.log(`[loadVideos] window.loadedVideos count: ${(window.loadedVideos || []).length}`);
                
                setTimeout(() => {
                    console.log(`[loadVideos] Calling displayVideosInGrid()`);
                    displayVideosInGrid();
                    console.log(`[loadVideos] Fetching total video count`);
                    fetchCharacterVideoCount(chatId);
                    window.characterProfile.videosLoading = false;
                    window.characterProfile.videosLoaded = true;
                    // Show load more button if needed
                    console.log(`[loadVideos] Updating load more button`);
                    updateLoadMoreVideoButton(chatId);
                }, 500);
            })
            .catch((error) => {
                console.error('[loadVideos] Error loading character videos:', error);
                window.characterProfile.videosLoading = false;
                displayVideosInGrid();
            });
    } else {
        console.error(`[loadVideos] Missing chatId or loadChatVideos function (chatId: ${chatId}, loadChatVideos available: ${typeof loadChatVideos === 'function'})`);
    }
}

/**
 * Fetch total image count from server
 */
async function fetchCharacterImageCount(chatId) {
    try {
        console.log(`Starting fetchCharacterImageCount for chat ${chatId}`);
        const response = await fetch(`/chat/${chatId}/images?page=1`);
        if (response.ok) {
            const data = await response.json();
            // Use totalImages from the API response
            const totalCount = data.totalImages || 0;
            const totalPages = data.totalPages || 1;
            console.log(`API response received - totalImages field: ${data.totalImages}, totalPages: ${totalPages}`);
            window.characterProfile.totalImages = totalCount;
            window.characterProfile.imagesTotalPages = totalPages;
            console.log(`Updated window.characterProfile.totalImages to: ${totalCount}, imagesTotalPages: ${totalPages}`);
            updateCharacterImageCount(totalCount);
            console.log(`Called updateCharacterImageCount with: ${totalCount}`);
            console.log(`Fetched total images for chat ${chatId}: ${totalCount}`);
        } else {
            console.error(`Failed to fetch image count: ${response.status} ${response.statusText}`);
            // Set default values on error
            window.characterProfile.totalImages = 0;
            window.characterProfile.imagesTotalPages = 0;
            updateCharacterImageCount(0);
        }
    } catch (error) {
        console.error('Error fetching image count:', error);
        // Set default values on error
        window.characterProfile.totalImages = 0;
        window.characterProfile.imagesTotalPages = 0;
        updateCharacterImageCount(0);
    }
}

/**
 * Fetch total video count from server
 */
async function fetchCharacterVideoCount(chatId) {
    try {
        const response = await fetch(`/chat/${chatId}/videos?page=1`);
        if (response.ok) {
            const data = await response.json();
            // Use totalVideos from the API response
            const totalCount = data.totalVideos || 0;
            const totalPages = data.totalPages || 1;
            window.characterProfile.totalVideos = totalCount;
            window.characterProfile.videosTotalPages = totalPages;
            updateCharacterVideoCount(totalCount);
            console.log(`Fetched total videos for chat ${chatId}: ${totalCount}, totalPages: ${totalPages}`);
        } else {
            console.error(`Failed to fetch video count: ${response.status} ${response.statusText}`);
            // Set default values on error
            window.characterProfile.totalVideos = 0;
            window.characterProfile.videosTotalPages = 0;
            updateCharacterVideoCount(0);
        }
    } catch (error) {
        console.error('Error fetching video count:', error);
        // Set default values on error
        window.characterProfile.totalVideos = 0;
        window.characterProfile.videosTotalPages = 0;
        updateCharacterVideoCount(0);
    }
}

/**
 * Load character stats
 */
function loadCharacterStats(chatId) {
    const messagesCount = Math.floor(Math.random() * 1000) + 100;
    const element = document.getElementById('messagesCount');
    if (element) {
        element.textContent = messagesCount.toLocaleString();
    }
}

/**
 * Load similar characters
 */
function loadSimilarCharacters(chatId) {
    if (typeof fetchSimilarChats === 'function') {
        fetchSimilarChats(chatId).then(characters => {
            displaySimilarCharacters(characters);
        });
    }
}

/**
 * Load character personality traits
 */
function loadCharacterPersonality() {
    const personalityContainer = document.getElementById('characterPersonality');
    if (!personalityContainer) return;
    
    try {
        // This will be populated by the template with chat data
        const chatElement = document.querySelector('[data-chat-personality]');
        if (chatElement && chatElement.dataset.chatPersonality) {
            const personality = JSON.parse(chatElement.dataset.chatPersonality || '{}');
            if (personality && personality.base_personality) {
                const html = generatePersonalityHTML(personality.base_personality);
                personalityContainer.innerHTML = html;
            }
        }
    } catch (error) {
        console.error('[loadCharacterPersonality] Error parsing personality data:', error);
    }
}

/**
 * Show loading state for count displays
 */
function showCountLoadingState() {
    const imagesCount = document.getElementById('imagesCount');
    const videosCount = document.getElementById('videosCount');
    
    if (imagesCount) {
        imagesCount.classList.add('count-loading');
        imagesCount.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    }
    
    if (videosCount) {
        videosCount.classList.add('count-loading');
        videosCount.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    }
}

/**
 * Hide loading state from count displays
 */
function hideCountLoadingState() {
    const imagesCount = document.getElementById('imagesCount');
    const videosCount = document.getElementById('videosCount');
    
    if (imagesCount) {
        imagesCount.classList.remove('count-loading');
    }
    
    if (videosCount) {
        videosCount.classList.remove('count-loading');
    }
}

/**
 * Fetch similar chats
 */
async function fetchSimilarChats(chatId) {
    try {
        const response = await fetch(`/api/similar-chats/${chatId}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Failed to fetch similar chats:', error);
    }
    return [];
}

/**
 * Update and show load more button for images
 */
function updateLoadMoreButton(chatId) {
    const currentPage = window.characterProfile.imagesCurrentPage || 1;
    const totalPages = window.characterProfile.imagesTotalPages || 1;
    
    // Show button only if there are more pages
    if (currentPage < totalPages) {
        showLoadMoreButton('images');
    } else {
        hideLoadMoreButton('images');
    }
}

/**
 * Show the load more button
 */
function showLoadMoreButton(type) {
    const buttonId = type === 'images' ? 'loadMoreImagesBtn' : 'loadMoreVideosBtn';
    const button = document.getElementById(buttonId);
    if (button) {
        button.style.display = 'block';
    }
}

/**
 * Hide the load more button
 */
function hideLoadMoreButton(type) {
    const buttonId = type === 'images' ? 'loadMoreImagesBtn' : 'loadMoreVideosBtn';
    const button = document.getElementById(buttonId);
    if (button) {
        button.style.display = 'none';
    }
}

/**
 * Fetch similar chats
 */
async function fetchSimilarChats(chatId) {
    try {
        const response = await fetch(`/api/similar-chats/${chatId}`);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Failed to fetch similar chats:', error);
    }
    return [];
}
