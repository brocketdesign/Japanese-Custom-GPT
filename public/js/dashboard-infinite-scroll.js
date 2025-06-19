// Global state management for chat images
if (typeof chatImageManager === 'undefined') {
    window.chatImageManager = {
        cache: new Map(),
        loadingStates: new Map(),
        currentPages: new Map(),
        totalPages: new Map(),
        scrollHandlers: new Map(),
        initialized: new Set()
    };
}

/**
 * Load cache from localStorage for a specific chat
 */
function loadCacheFromStorage(chatId) {
    const cacheKey = `chatImages_${chatId}`;
    try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
            const data = JSON.parse(stored);
            return data;
        }
    } catch (error) {
        console.error(`[loadCacheFromStorage] Error loading cache:`, error);
        localStorage.removeItem(cacheKey);
    }
    return null;
}

/**
 * Save cache to localStorage for a specific chat
 */
function saveCacheToStorage(chatId, pages, currentPage, totalPages) {
    const cacheKey = `chatImages_${chatId}`;
    try {
        const data = {
            pages: Object.fromEntries(pages),
            currentPage,
            totalPages,
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.error(`[saveCacheToStorage] Error saving cache:`, error);
    }
}

/**
 * Main function to load chat images with infinite scroll
 * @param {string} chatId - The chat ID
 * @param {number} page - Page number to load
 * @param {boolean} reload - Whether to reload from cache
 * @param {boolean} isModal - Whether loading in modal context
 * @returns {Promise}
 */
window.loadChatImages = function(chatId, page = 1, reload = false, isModal = false) {
    const manager = window.chatImageManager;
    const cacheKey = `chat_${chatId}`;
    
    // Initialize chat state if not exists
    if (!manager.cache.has(cacheKey)) {
        manager.cache.set(cacheKey, new Map());
        manager.loadingStates.set(cacheKey, false);
        manager.currentPages.set(cacheKey, 0);
        manager.totalPages.set(cacheKey, Infinity);
        
        // Load from localStorage if available
        const storedCache = loadCacheFromStorage(chatId);
        if (storedCache && storedCache.pages) {
            const cacheMap = manager.cache.get(cacheKey);
            Object.entries(storedCache.pages).forEach(([pageNum, images]) => {
                cacheMap.set(parseInt(pageNum), images);
            });
            manager.currentPages.set(cacheKey, storedCache.currentPage || 0);
            manager.totalPages.set(cacheKey, storedCache.totalPages || Infinity);
        }
    }
    
    return new Promise(async (resolve, reject) => {
        try {
            // Handle reload scenario
            if (reload) {
                const hasCache = await handleReload(chatId, cacheKey);
                
                // If we have cache, don't fetch from server unless specifically requested
                if (hasCache && page === 1) {
                    setupInfiniteScroll(chatId, isModal);
                    resolve();
                    return;
                }
            }
            
            // Check if page is already cached and not reloading
            if (manager.cache.get(cacheKey).has(page) && !reload) {
                const cachedImages = manager.cache.get(cacheKey).get(page);
                await renderImages(cachedImages, chatId);
                manager.currentPages.set(cacheKey, Math.max(manager.currentPages.get(cacheKey), page));
                setupInfiniteScroll(chatId, isModal);
                resolve();
                return;
            }
            
            // Prevent duplicate requests
            if (manager.loadingStates.get(cacheKey)) {
                resolve();
                return;
            }
            
            // Check if we've reached the end
            if (page > manager.totalPages.get(cacheKey)) {
                resolve();
                return;
            }
            
            // Fetch from server
            await fetchImagesFromServer(chatId, page, cacheKey, isModal);
            resolve();
            
        } catch (error) {
            console.error(`[loadChatImages] ERROR:`, error);
            manager.loadingStates.set(cacheKey, false);
            reject(error);
        }
    });
};

/**
 * Handle reload scenario by rendering all cached pages
 */
async function handleReload(chatId, cacheKey) {
    const manager = window.chatImageManager;
    const cache = manager.cache.get(cacheKey);
    const cachedPages = Array.from(cache.keys()).sort((a, b) => a - b);
    
    // Clear existing content
    $('#chat-images-gallery').empty();
    window.loadedImages = [];
    
    // If we have cached pages, render them
    if (cachedPages.length > 0) {
        // Render all cached pages in order
        for (const pageNum of cachedPages) {
            const images = cache.get(pageNum);
            await renderImages(images, chatId);
        }
        
        manager.currentPages.set(cacheKey, Math.max(...cachedPages, 0));
        return true; // Indicate we have cache
    }
    
    return false; // No cache available
}

/**
 * Fetch images from server and handle caching
 */
async function fetchImagesFromServer(chatId, page, cacheKey, isModal) {
    const manager = window.chatImageManager;
    
    manager.loadingStates.set(cacheKey, true);
    
    // Show loading indicator
    showLoadingIndicator(true);
    
    try {
        const response = await $.ajax({
            url: `/chat/${chatId}/images?page=${page}`,
            method: 'GET',
            xhrFields: { withCredentials: true },
            timeout: 10000 // 10 second timeout
        });
        
        // Cache the response
        manager.cache.get(cacheKey).set(response.page, response.images || []);
        manager.totalPages.set(cacheKey, response.totalPages || 1);
        manager.currentPages.set(cacheKey, response.page);
        
        // Save to localStorage
        saveCacheToStorage(
            chatId,
            manager.cache.get(cacheKey),
            manager.currentPages.get(cacheKey),
            manager.totalPages.get(cacheKey)
        );
        
        // Render images
        await renderImages(response.images || [], chatId);
        
        // Setup infinite scroll
        setupInfiniteScroll(chatId, isModal);
        
    } finally {
        manager.loadingStates.set(cacheKey, false);
        showLoadingIndicator(false);
    }
}

/**
 * Render images to the gallery with consistent grid layout
 */
async function renderImages(images, chatId) {
    if (!images || images.length === 0) {
        return;
    }
    
    const currentUser = window.user || {};
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    const isAdmin = window.isAdmin || false;
    
    const fragment = document.createDocumentFragment();
    
    images.forEach((item, index) => {
        const isBlur = item?.nsfw && !subscriptionStatus;
        const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
        
        // Add to loadedImages if not blurred and not already present
        if (!isBlur && !window.loadedImages.some(img => img._id === item._id)) {
            window.loadedImages.push(item);
        }
        
        const loadedIndex = window.loadedImages.length - 1;
        const cardHtml = createImageCard(item, isBlur, isLiked, isAdmin, isTemporary, loadedIndex, chatId);
        
        // Create DOM element
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml;
        const cardElement = tempDiv.firstElementChild;
        
        fragment.appendChild(cardElement);
    });
    
    // Append all cards at once for better performance
    const gallery = document.getElementById('chat-images-gallery');
    if (gallery) {
        gallery.appendChild(fragment);
        
        // Apply grid layout after DOM update
        requestAnimationFrame(() => {
            applyGridLayout();
            handleBlurredImages();
        });
    }
}

/**
 * Create HTML for individual image card
 */
function createImageCard(item, isBlur, isLiked, isAdmin, isTemporary, loadedIndex, chatId) {
    return `
        <div class="col-6 col-md-3 col-lg-2 mb-2" data-image-id="${item._id}">
            <div class="card shadow-0">
                ${isBlur ? 
                    `<div class="position-relative">
                        <div type="button" onclick="event.stopPropagation();handleClickRegisterOrPay(event,${isTemporary})">
                            <img data-src="${item.imageUrl}" class="card-img-top img-blur" style="object-fit: cover;" loading="lazy">
                        </div>
                        <div class="position-absolute top-0 start-0 m-1" style="z-index:3;">
                            <span class="badge bg-danger" style="font-size: 0.7rem; padding: 0.2em 0.4em;">NSFW</span>
                        </div>
                    </div>` :
                    `<a href="/character/slug/${item.chatSlug}?imageSlug=${item.slug}" data-index="${loadedIndex}">
                        <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top" style="object-fit: cover;" loading="lazy">
                    </a>
                    ${isAdmin ? 
                        `<div class="card-body p-2 row mx-0 px-0 align-items-center justify-content-between">
                            <button class="btn btn-light col-6 image-nsfw-toggle ${item?.nsfw ? 'nsfw' : 'sfw'}" 
                                data-id="${item._id}" onclick="toggleImageNSFW(this)">
                                <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'}"></i>
                            </button>
                            <span class="btn btn-light float-end col-6 image-fav ${isLiked ? 'liked' : ''}" 
                                data-id="${item._id}" onclick="toggleImageFavorite(this)">
                                <i class="bi bi-heart" style="cursor: pointer;"></i>
                            </span>
                        </div>` : ''
                    }`
                }
            </div>
        </div>
    `;
}

/**
 * Setup infinite scroll with optimized event handling
 */
function setupInfiniteScroll(chatId, isModal = false) {
    const manager = window.chatImageManager;
    const scrollKey = `${chatId}_${isModal ? 'modal' : 'page'}`;
    
    // Prevent duplicate scroll handlers
    if (manager.initialized.has(scrollKey)) {
        return;
    }
    
    const scrollContainer = isModal ? $('#characterModal .modal-body') : $(window);
    const cacheKey = `chat_${chatId}`;
    
    // Use namespaced events to avoid conflicts with other scroll handlers
    const eventName = `scroll.chatImages_${chatId}_${isModal ? 'modal' : 'page'}`;
    
    // Remove any existing scroll handlers for this specific chat
    scrollContainer.off(eventName);
    
    // Throttled scroll handler for better performance
    let scrollTimeout;
    const scrollHandler = function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            handleScroll(chatId, isModal, cacheKey);
        }, 100); // 100ms throttle
    };
    
    scrollContainer.on(eventName, scrollHandler);
    manager.scrollHandlers.set(scrollKey, scrollHandler);
    manager.initialized.add(scrollKey);
}

/**
 * Handle scroll events and trigger loading when needed
 */
function handleScroll(chatId, isModal, cacheKey) {
    const manager = window.chatImageManager;
    
    // Skip if already loading
    if (manager.loadingStates.get(cacheKey)) {
        return;
    }
    
    const currentPage = manager.currentPages.get(cacheKey);
    const totalPages = manager.totalPages.get(cacheKey);
    
    // Check if we've reached the end
    if (currentPage >= totalPages) {
        return;
    }
    
    // Calculate scroll position
    const scrollContainer = isModal ? $('#characterModal .modal-body') : $(window);
    const scrollTop = scrollContainer.scrollTop();
    const containerHeight = scrollContainer.height();
    const contentHeight = isModal ? scrollContainer[0].scrollHeight : $(document).height();
    
    const scrollPercentage = (scrollTop + containerHeight) / contentHeight;
    
    // Trigger loading when 85% scrolled
    if (scrollPercentage >= 0.85) {
        const nextPage = currentPage + 1;
        
        loadChatImages(chatId, nextPage, false, isModal)
            .catch(error => {
                console.error(`[handleScroll] Failed to load page ${nextPage}:`, error);
            });
    }
}

/**
 * Apply consistent grid layout
 */
function applyGridLayout() {
    const gallery = $('#chat-images-gallery');
    if (gallery.length && typeof gridLayout === 'function') {
        gridLayout('#chat-images-gallery');
    }
}

/**
 * Handle blurred images processing
 */
function handleBlurredImages() {
    $('.img-blur').each(function() {
        if (!$(this).data('processed')) {
            if (typeof blurImage === 'function') {
                blurImage(this);
            }
        }
    });
}

/**
 * Show/hide loading indicator
 */
function showLoadingIndicator(show) {
    const controlsContainer = $('#chat-images-pagination-controls');
    
    if (show) {
        controlsContainer.html('<div class="text-center py-3"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>');
    } else {
        // Only clear if it contains a spinner
        if (controlsContainer.find('.spinner-border').length > 0) {
            controlsContainer.empty();
        }
    }
}

/**
 * Clear cache for a specific chat
 */
window.clearChatImageCache = function(chatId) {
    const manager = window.chatImageManager;
    const cacheKey = `chat_${chatId}`;
    
    // Clear cache
    manager.cache.delete(cacheKey);
    manager.loadingStates.delete(cacheKey);
    manager.currentPages.delete(cacheKey);
    manager.totalPages.delete(cacheKey);
    
    // Remove scroll handlers
    const scrollKeys = Array.from(manager.initialized).filter(key => key.startsWith(chatId));
    scrollKeys.forEach(key => {
        manager.initialized.delete(key);
        manager.scrollHandlers.delete(key);
    });
    
    // Clear localStorage cache as well
    const localCacheKey = `chatImages_${chatId}`;
    localStorage.removeItem(localCacheKey);
};

/**
 * Get cache statistics for debugging
 */
window.getChatImageCacheStats = function(chatId) {
    const manager = window.chatImageManager;
    const cacheKey = `chat_${chatId}`;
    
    if (!manager.cache.has(cacheKey)) {
        return { error: 'Chat not found in cache' };
    }
    
    const cache = manager.cache.get(cacheKey);
    const cachedPages = Array.from(cache.keys()).sort((a, b) => a - b);
    const totalImages = Array.from(cache.values()).reduce((sum, images) => sum + images.length, 0);
    
    return {
        chatId,
        cachedPages,
        totalImages,
        currentPage: manager.currentPages.get(cacheKey),
        totalPages: manager.totalPages.get(cacheKey),
        isLoading: manager.loadingStates.get(cacheKey)
    };
};