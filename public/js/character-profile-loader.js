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
    const cacheKey = `chat_${chatId}`;
    
    if (window.characterProfile.imagesLoading) {
        return;
    }
    
    // Initialize pagination state for character profile
    if (!window.characterProfile.imagesCurrentPage) {
        window.characterProfile.imagesCurrentPage = 0;
        window.characterProfile.imagesTotalPages = 0;
    }
    
    if (typeof loadChatImages === 'function') {
        window.characterProfile.imagesLoading = true;
        window.loadedImages = [];
        
        console.log(`[loadCharacterImages] START - Calling loadChatImages with reload=true, chatId=${chatId}`);
        
        loadChatImages(chatId, 1, true)
            .then((images) => {
                const manager = window.chatImageManager;
                const imagesCount = (window.loadedImages || []).length;
                
                console.log(`[loadCharacterImages] Promise resolved - window.loadedImages length: ${imagesCount}`);
                
                // Get the actual state from cache manager after fetch completes
                const actualCurrentPage = manager.currentPages.get(cacheKey) || 1;
                const actualTotalPages = manager.totalPages.get(cacheKey) || 1;
                const hasCache = manager.cache.has(cacheKey);
                
                console.log(`[loadCharacterImages] Cache state - currentPage: ${actualCurrentPage}, totalPages: ${actualTotalPages}, hasCache: ${hasCache}`);
                                
                // Display images directly - no setTimeout needed
                displayImagesInGrid(images);
                    
                // Re-read the state AGAIN after display, in case totalPages was just updated
                const finalCurrentPage = manager.currentPages.get(cacheKey) || 1;
                const finalTotalPages = manager.totalPages.get(cacheKey) || 1;
                
                // Sync characterProfile with actual cache state AFTER display
                window.characterProfile.imagesCurrentPage = finalCurrentPage;
                window.characterProfile.imagesTotalPages = finalTotalPages;
                
                // After loading first page, update button visibility USING FINAL STATE
                updateLoadMoreButton(chatId);
                window.characterProfile.imagesLoading = false;
                
            })
            .catch((error) => {
                window.characterProfile.imagesLoading = false;
                displayImagesInGrid([]);
            });
    }
}

/**
 * Load next page of character images
 */
function loadMoreCharacterImages(chatId) {
    const cacheKey = `chat_${chatId}`;
    
    // Use the actual cache manager to get real state, not characterProfile
    const manager = window.chatImageManager;
    const currentPageFromCache = manager.currentPages.get(cacheKey) || 0;
    const totalPagesFromCache = manager.totalPages.get(cacheKey) || 0;
    const isLoading = manager.loadingStates.get(cacheKey);
    
    if (isLoading) {
        return;
    }
    
    const nextPage = currentPageFromCache + 1;
    
    // Check if there are more pages
    if (nextPage > totalPagesFromCache) {
        return;
    }
    
    if (typeof loadChatImages === 'function') {
        window.characterProfile.imagesLoading = true;
        
        // Load next page WITHOUT reload flag - this will render images and append to grid
        loadChatImages(chatId, nextPage, false)
            .then((images) => {
                const imagesCount = (window.loadedImages || []).length;
                
                // Get updated cache state after fetch
                const updatedCurrentPage = manager.currentPages.get(cacheKey) || nextPage;
                const updatedTotalPages = manager.totalPages.get(cacheKey) || totalPagesFromCache;
               
                // Append new images to existing grid
                displayMoreImagesInGrid(images);
                
                // Re-read state ONE MORE TIME before updating UI (totalPages might have just updated)
                const finalCurrentPage = manager.currentPages.get(cacheKey) || nextPage;
                const finalTotalPages = manager.totalPages.get(cacheKey) || totalPagesFromCache;
                
                // Sync characterProfile state with actual cache state
                window.characterProfile.imagesCurrentPage = finalCurrentPage;
                window.characterProfile.imagesTotalPages = finalTotalPages;
                // Update button visibility USING FINAL STATE
                updateLoadMoreButton(chatId);
                // Hide loading spinner
                if (typeof hideLoadMoreButtonSpinner === 'function') {
                    hideLoadMoreButtonSpinner('images');
                }
                window.characterProfile.imagesLoading = false;
            })
            .catch((error) => {
                // Hide loading spinner on error
                if (typeof hideLoadMoreButtonSpinner === 'function') {
                    hideLoadMoreButtonSpinner('images');
                }
                window.characterProfile.imagesLoading = false;
            });
    }
}

/**
 * Load videos with lazy loading support (pagination, no infinite scroll)
 */
function loadVideos() {
    const chatId = window.characterProfile.currentChatId;
    const cacheKey = `chatVideo_${chatId}`;
    
    if (window.characterProfile.videosLoading || window.characterProfile.videosLoaded) {
        return;
    }
    
    // Initialize pagination state for videos
    if (!window.characterProfile.videosCurrentPage) {
        window.characterProfile.videosCurrentPage = 0;
        window.characterProfile.videosTotalPages = 0;
    }
    
    if (chatId && typeof loadChatVideos === 'function') {
        window.characterProfile.videosLoading = true;
        window.loadedVideos = [];
        
        loadChatVideos(chatId, 1, true)
            .then(() => {
                const videosCount = (window.loadedVideos || []).length;
                
                const manager = window.chatImageManager;
                const actualCurrentPage = manager.currentPages.get(cacheKey) || 1;
                const actualTotalPages = manager.totalPages.get(cacheKey) || 1;
                
                setTimeout(() => {
                    displayVideosInGrid();
                    
                    const finalCurrentPage = manager.currentPages.get(cacheKey) || 1;
                    const finalTotalPages = manager.totalPages.get(cacheKey) || 1;
                    
                    window.characterProfile.videosCurrentPage = finalCurrentPage;
                    window.characterProfile.videosTotalPages = finalTotalPages;
                    
                    updateLoadMoreVideoButton(chatId);
                    
                    fetchCharacterVideoCount(chatId);
                    
                    window.characterProfile.videosLoading = false;
                    window.characterProfile.videosLoaded = true;
                }, 800);
            })
            .catch((error) => {
                window.characterProfile.videosLoading = false;
                displayVideosInGrid();
            });
    }
}

/**
 * Fetch total image count from server
 */
async function fetchCharacterImageCount(chatId) {
    const cacheKey = `chat_${chatId}`;
    
    try {
        const response = await fetch(`/chat/${chatId}/images?page=1`);
        if (response.ok) {
            const data = await response.json();
            const totalCount = data.totalImages || 0;
            const totalPages = data.totalPages || 1;
            
            // Update characterProfile
            window.characterProfile.totalImages = totalCount;
            window.characterProfile.imagesTotalPages = totalPages;
            
            // Wait for cache manager to be initialized, then update it
            let attempts = 0;
            const waitForCacheManager = setInterval(() => {
                const manager = window.chatImageManager;
                
                if (manager && manager.totalPages && manager.totalPages.has(cacheKey)) {
                    manager.totalPages.set(cacheKey, totalPages);
                    clearInterval(waitForCacheManager);
                } else if (attempts > 50) {
                    clearInterval(waitForCacheManager);
                }
                attempts++;
            }, 100);
            
            // Update UI count display
            updateCharacterImageCount(totalCount);
            
            // Update button visibility
            updateLoadMoreButton(chatId);
        } else {
            window.characterProfile.totalImages = 0;
            window.characterProfile.imagesTotalPages = 0;
            updateCharacterImageCount(0);
        }
    } catch (error) {
        window.characterProfile.totalImages = 0;
        window.characterProfile.imagesTotalPages = 0;
        updateCharacterImageCount(0);
    }
}

/**
 * Fetch total video count from server
 */
async function fetchCharacterVideoCount(chatId) {
    const cacheKey = `chatVideo_${chatId}`;
    
    try {
        const response = await fetch(`/chat/${chatId}/videos?page=1`);
        if (response.ok) {
            const data = await response.json();
            const totalCount = data.totalVideos || 0;
            const totalPages = data.totalPages || 1;
            
            // Update characterProfile
            window.characterProfile.totalVideos = totalCount;
            window.characterProfile.videosTotalPages = totalPages;
            
            // Update UI count display
            updateCharacterVideoCount(totalCount);
            
            // Update button visibility
            updateLoadMoreVideoButton(chatId);
        } else {
            window.characterProfile.totalVideos = 0;
            window.characterProfile.videosTotalPages = 0;
            updateCharacterVideoCount(0);
        }
    } catch (error) {
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
    // Show loading spinner
    showSimilarCharactersLoader();
    
    if (typeof fetchSimilarChats === 'function') {
        fetchSimilarChats(chatId).then(characters => {
            displaySimilarCharacters(characters);
            // Hide loading spinner
            hideSimilarCharactersLoader();
        }).catch(error => {
            // Hide loading spinner on error
            hideSimilarCharactersLoader();
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
        // ignore parse errors
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
        // ignore fetch errors
    }
    return [];
}

/**
 * Update and show load more button for images
 */
function updateLoadMoreButton(chatId) {
    const manager = window.chatImageManager;
    const cacheKey = `chat_${chatId}`;
    
    let currentPage, totalPages, source;
    
    // Prefer using actual cache manager state
    if (manager && manager.currentPages.has(cacheKey)) {
        currentPage = manager.currentPages.get(cacheKey) || 0;
        totalPages = manager.totalPages.get(cacheKey) || 0;
        source = 'CACHE_MGR';
    } else {
        // Fallback to characterProfile state
        currentPage = window.characterProfile.imagesCurrentPage || 1;
        totalPages = window.characterProfile.imagesTotalPages || 1;
        source = 'FALLBACK';
    }
    
    const buttonId = 'loadMoreImagesBtn';
    const shouldShow = currentPage < totalPages;
    
    // Show button only if there are more pages
    if (shouldShow) {
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
        // ignore fetch errors
    }
    return [];
}