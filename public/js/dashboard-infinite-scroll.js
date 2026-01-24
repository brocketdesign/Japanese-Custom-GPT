// Global state management for chat images and user images
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

const VIDEO_PROMPT_MAX_LENGTH = 160;

/**
 * Load cache from localStorage for a specific key
 */
function loadCacheFromStorage(cacheId) {
    const cacheKey = `images_${cacheId}`;
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
 * Save cache to localStorage for a specific key
 */
function saveCacheToStorage(cacheId, pages, currentPage, totalPages) {
    const cacheKey = `images_${cacheId}`;
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
 * Get gallery configuration based on type
 */
function getGalleryConfig(type) {
    switch (type) {
        case 'chat':
            return { gallery: '#chat-images-gallery', controls: '#chat-images-pagination-controls', empty: null, dataAttr: 'data-chat-id' };
        case 'chatVideo':
            return { gallery: '#chat-videos-gallery', controls: '#chat-videos-pagination-controls', empty: '#chat-videos-empty', dataAttr: 'data-chat-id' };
        case 'user':
            return { gallery: '#user-images-gallery', controls: '#images-pagination-controls', empty: null };
        case 'intro':
            return { gallery: '#character-intro-gallery', empty: null, dataAttr: 'data-chat-id' };
        default:
            return {};
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
window.loadChatImages = function(chatId, page = 1, reload = false, isModal = false, contentType = null) {
    const onCharacterPage = !!document.querySelector('#characterProfilePage');
    if (!onCharacterPage && !validateChatIdWithSession(chatId)) {
        console.warn(`[loadChatImages] Chat ID ${chatId} does not match session storage`);
        return Promise.resolve([]);
    }
    
    // Build endpoint with content_type if provided
    let endpoint = `/chat/${chatId}/images`;
    if (contentType) {
        endpoint += `?content_type=${contentType}`;
    }
    
    // Update cache key to include content type if on character page
    const cacheKeySuffix = onCharacterPage && contentType ? `_${contentType}` : '';
    
    return loadImages('chat', chatId, page, reload, isModal, endpoint, onCharacterPage, 'image', cacheKeySuffix);
};

/**
 * Main function to load chat videos with infinite scroll
 * @param {string} chatId - The chat ID
 * @param {number} page - Page number to load
 * @param {boolean} reload - Whether to reload from cache
 * @param {boolean} isModal - Whether loading in modal context
 * @returns {Promise}
 */
window.loadChatVideos = function(chatId, page = 1, reload = false, isModal = false) {
    const onCharacterPage = !!document.querySelector('#characterProfilePage');
    if (!onCharacterPage && !validateChatIdWithSession(chatId)) {
        console.warn(`[loadChatVideos] Chat ID ${chatId} does not match session storage`);
        return Promise.resolve();
    }
    return loadImages('chatVideo', chatId, page, reload, isModal, `/chat/${chatId}/videos`, onCharacterPage, 'video');
};

/**
 * Main function to load intro gallery images with infinite scroll
 * @param {string} chatId - The chat ID
 * @param {number} page - Page number to load
 * @param {boolean} reload - Whether to reload from cache
 * @param {boolean} isModal - Whether loading in modal context
 * @returns {Promise}
 */
window.loadIntroImages = function(chatId, page = 1, reload = false, isModal = false) {
    return loadImages('intro', chatId, page, reload, true, `/chat/${chatId}/images`, false, 'image');
};

/**
 * Main function to load user liked images with infinite scroll
 * @param {string} userId - The user ID
 * @param {number} page - Page number to load
 * @param {boolean} reload - Whether to reload from cache
 * @param {boolean} isModal - Whether loading in modal context
 * @returns {Promise}
 */
window.loadUserImages = function(userId, page = 1, reload = false, isModal = false) {
    return loadImages('user', userId, page, reload, isModal, `/user/${userId}/liked-images`);
};

/**
 * Validate if the current chat ID matches session storage
 */
function validateChatIdWithSession(chatId) {
    const sessionChatId = sessionStorage.getItem('lastChatId') || sessionStorage.getItem('chatId');
    return !sessionChatId || sessionChatId === chatId;
}

/**
 * Generic function to load images with infinite scroll
 */
function loadImages(type, id, page = 1, reload = false, isModal = false, endpoint, onCharacterPage = false, mediaType = 'image', cacheKeySuffix = '') {

    const manager = window.chatImageManager;
    const cacheKey = `${type}_${id}${cacheKeySuffix}`;
    const config = getGalleryConfig(type);
    
    // For chat images, validate session alignment before proceeding
    if (type === 'chat' && !onCharacterPage && !validateChatIdWithSession(id)) {
        console.warn(`[loadImages] Chat ID ${id} does not match session storage, skipping load`);
        return Promise.resolve();
    }
    
    // Initialize state if not exists
    if (!manager.cache.has(cacheKey)) {
        manager.cache.set(cacheKey, new Map());
        manager.loadingStates.set(cacheKey, false);
        manager.currentPages.set(cacheKey, 0);
        manager.totalPages.set(cacheKey, Infinity);
        
        // Load from localStorage if available
        const storedCache = loadCacheFromStorage(cacheKey);
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
            let allImagesToReturn = [];
            
            // Handle reload scenario
            if (reload) {
                const hasCache = await handleReload(id, cacheKey, type, mediaType);
                
                // Setup infinite scroll ONLY if NOT on character profile page
                if (!onCharacterPage) {
                    setupInfiniteScroll(id, isModal, type);
                }
                
                // Collect all cached images to return
                const cache = manager.cache.get(cacheKey);
                if (cache) {
                    cache.forEach((pageImages) => {
                        if (Array.isArray(pageImages)) {
                            allImagesToReturn.push(...pageImages);
                        }
                    });
                }
                
                // If we have cache and we're requesting page 1, don't fetch from server
                if (hasCache && page === 1) {
                    resolve(allImagesToReturn);
                    return;
                }
                
                // If no cache but reload is true, reset state properly
                if (!hasCache) {
                    manager.currentPages.set(cacheKey, 0);
                }
            }
            
            // Validate page number
            if (isNaN(page) || page < 1) {
                resolve();
                return;
            }
            
            // Check if page is already cached and not reloading
            if (manager.cache.get(cacheKey).has(page) && !reload) {
                const cachedItems = manager.cache.get(cacheKey).get(page);
                await renderMedia(cachedItems, id, type, mediaType, page);
                manager.currentPages.set(cacheKey, Math.max(manager.currentPages.get(cacheKey), page));
                // Setup infinite scroll ONLY if NOT on character profile page
                if (!onCharacterPage) {
                    setupInfiniteScroll(id, isModal, type);
                }
                resolve(cachedItems);
                return;
            }
            
            // Prevent duplicate requests
            if (manager.loadingStates.get(cacheKey)) {
                resolve(allImagesToReturn);
                return;
            }
            
            // Check if we've reached the end
            if (page > manager.totalPages.get(cacheKey)) {
                resolve(allImagesToReturn);
                return;
            }
            
            // Additional check for reload scenario
            if (reload && page === 1 && manager.cache.get(cacheKey).has(1)) {
                resolve(allImagesToReturn);
                return;
            }
            
            // Fetch from server
            await fetchImagesFromServer(id, page, cacheKey, isModal, endpoint, type, mediaType);
            
            // Return the newly fetched page
            const fetchedPageImages = manager.cache.get(cacheKey).get(page) || [];
            resolve(fetchedPageImages);
            
        } catch (error) {
            console.error(`[loadImages] ERROR for ${cacheKey}:`, error);
            manager.loadingStates.set(cacheKey, false);
            reject(error);
        }
    });
}

/**
 * Handle reload scenario by rendering all cached pages
 */
async function handleReload(id, cacheKey, type, mediaType) {
    const manager = window.chatImageManager;
    const cache = manager.cache.get(cacheKey);
    const cachedPages = Array.from(cache.keys()).sort((a, b) => a - b);
    const config = getGalleryConfig(type);
    const gallerySelector = config.gallery || '#chat-images-gallery';
    
    // Clear existing content
    $(gallerySelector).empty();
    if (config.empty) {
        $(config.empty).addClass('d-none');
    }
    if (type === 'chat') {
        window.loadedImages = [];
    } else if (type === 'chatVideo') {
        window.loadedVideos = [];
    }
    
    // If we have cached pages, render them
    if (cachedPages.length > 0) {
        // Render all cached pages in order
        for (const pageNum of cachedPages) {
            const items = cache.get(pageNum);
            await renderMedia(items, id, type, mediaType, pageNum);
        }
        
        // Properly set the current page to the maximum cached page
        const maxCachedPage = Math.max(...cachedPages);
        manager.currentPages.set(cacheKey, maxCachedPage);
        
        return true; // Indicate we have cache
    }
    
    // If no cache, ensure current page is set to 0
    manager.currentPages.set(cacheKey, 0);
    return false; // No cache available
}

/**
 * Fetch images from server and handle caching
 */
async function fetchImagesFromServer(id, page, cacheKey, isModal, endpoint, type, mediaType) {
    const manager = window.chatImageManager;
    
    // Validate page number again
    if (isNaN(page) || page < 1) {
        return;
    }
    
    manager.loadingStates.set(cacheKey, true);
    
    // Show loading indicator
    showLoadingIndicator(true, type);
    
    try {
        const url = `${endpoint}?page=${page}`;
        
        const response = await $.ajax({
            url: url,
            method: 'GET',
            xhrFields: { withCredentials: true },
            timeout: 10000 // 10 second timeout
        });
        
        // Validate response
        if (!response.page || isNaN(response.page)) {
            return;
        }
        
        const items = mediaType === 'video' ? response.videos || [] : response.images || [];
        // Cache the response
        manager.cache.get(cacheKey).set(response.page, items);
        manager.totalPages.set(cacheKey, response.totalPages || 1);
        manager.currentPages.set(cacheKey, response.page);
        
        // Save to localStorage
        saveCacheToStorage(
            cacheKey,
            manager.cache.get(cacheKey),
            manager.currentPages.get(cacheKey),
            manager.totalPages.get(cacheKey)
        );
        
        // Render images
        await renderMedia(items, id, type, mediaType, response.page);
        
        // Setup infinite scroll ONLY if NOT on character profile page
        const onCharacterPage = !!document.querySelector('#characterProfilePage');
        if (!onCharacterPage) {
            setupInfiniteScroll(id, isModal, type);
        }
        
    } catch (error) {
        console.error(`[fetchImagesFromServer] AJAX Error for ${cacheKey}:`, error);
        throw error;
    } finally {
        manager.loadingStates.set(cacheKey, false);
        showLoadingIndicator(false, type);
    }
}

/**
 * Render media items (images or videos) to the gallery
 */
function renderMedia(items, id, type, mediaType, page) {
    if (mediaType === 'video') {
        return renderVideos(items, id, type, page);
    }
    return renderImages(items, id, type);
}

/**
 * Render images to the gallery with consistent grid layout
 */
async function renderImages(images, id, type) {
    if (!images || images.length === 0) {
        return;
    }
    
    // Ensure the global image cache is initialized before usage
    if (!Array.isArray(window.loadedImages)) {
        window.loadedImages = [];
    }

    const gallerySelector = getGalleryConfig(type)?.gallery || '#chat-images-gallery';
    
    // Validate that the gallery is still for the correct character (prevents race condition)
    if (type === 'intro') {
        const currentChatId = $(gallerySelector).attr('data-current-chat-id');
        if (currentChatId && currentChatId !== id) {
            console.warn(`[renderImages] Skipping render - gallery is for ${currentChatId}, but trying to render ${id}`);
            return;
        }
    }
    
    // Set data attribute for chat galleries to track which chat is being rendered
    if (type === 'chat') {
        const gallerySelector = '#chat-images-gallery';
        $(gallerySelector).attr('data-chat-id', id);
    }
    
    const currentUser = window.user || {};
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    const isAdmin = window.isAdmin || false;
    
    const fragment = document.createDocumentFragment();
    let newImagesAdded = 0;
    let duplicatesSkipped = 0;
    let nsfw_count = 0;
    let non_nsfw_count = 0;

    images.forEach((item, index) => {
        const isBlur = shouldBlurNSFW(item, subscriptionStatus);
        // Use the isLiked property from API response - it's already computed by the backend
        const isLiked = item?.isLiked ? item?.isLiked : (item?.likedBy?.includes(currentUserId) || false);
        
        // LOG: Track NSFW images
        if (isBlur) {
            nsfw_count++;
        } else {
            non_nsfw_count++;
        }
        
        // Check for existing image more carefully using data-image-id
        const imageAlreadyDisplayed = document.querySelector(`[data-image-id="${item._id}"]`) !== null;
        if (imageAlreadyDisplayed) {
            duplicatesSkipped++;
            return;
        }
        
        // Add to loadedImages if not blurred and not already present
        if (!isBlur && !window.loadedImages.some(img => img._id === item._id)) {
            window.loadedImages.push(item);
        }
        
        // LOG: Check if NSFW image was added to loadedImages
        if (isBlur) {
            const wasAdded = window.loadedImages.some(img => img._id === item._id);
        }
        
        const loadedIndex = window.loadedImages.length - 1;
        const onChatPage = window.location.pathname.includes('/chat') && $('#chatContainer').is(':visible') && $('#chatContainer').children().length > 0 && chatId === $(gallerySelector).attr('data-chat-id');
        const cardHtml = createImageCard(item, isBlur, isLiked, isAdmin, isTemporary, subscriptionStatus, loadedIndex, id, type, onChatPage);
        
        // Create DOM element
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml;
        const cardElement = tempDiv.firstElementChild;
        
        fragment.appendChild(cardElement);
        newImagesAdded++;
    });
        
    // Append all cards at once for better performance
    const gallery = document.querySelector(gallerySelector);
    if (gallery && fragment.hasChildNodes()) {
        gallery.appendChild(fragment);
        
        // Apply grid layout after DOM update
        requestAnimationFrame(() => {
            applyGridLayout(gallerySelector);
            handleBlurredImages();
        });
    }
}

/**
 * Create Instagram-style image card for user favorites gallery
 */
function createInstagramImageCard(item, isBlur, isLiked, isAdmin, isTemporary, subscriptionStatus, loadedIndex, id) {
    const chatId = item.chatId;
    const displayUrl = item.thumbnailUrl || item.imageUrl;
    const fullUrl = item.imageUrl;
    const characterThumbnail = item.thumbnail || '/img/default-thumbnail.png';
    const characterName = item.chatName || 'Unknown';
    
    // Use getNSFWDisplayMode for proper handling of premium users with showNSFW=false
    const displayMode = typeof getNSFWDisplayMode === 'function' 
        ? getNSFWDisplayMode(item, subscriptionStatus) 
        : (isBlur ? 'blur' : 'show');
    
    const showContent = displayMode === 'show';
    const showOverlay = displayMode === 'overlay'; // Premium user with showNSFW=false
    const showBlur = displayMode === 'blur'; // Non-subscriber
    
    // Character info footer (always visible - mobile-first design)
    const characterFooter = (showContent || showOverlay) ? `
        <div class="ig-image-footer" onclick="event.stopPropagation(); openCharacterIntroModal('${chatId}')">
            <img src="${characterThumbnail}" 
                 alt="${characterName}" 
                 class="ig-footer-avatar"
                 onerror="this.src='/img/default-thumbnail.png'">
            <span class="ig-footer-name">${characterName}</span>
        </div>` : '';
    
    // Like button (show for all modes except temporary users)
    const likeButton = !isTemporary ? `
        <button class="ig-like-btn ${isLiked ? 'liked' : ''}" 
                data-id="${item._id}" 
                data-chat-id="${chatId}" 
                onclick="event.stopPropagation(); toggleImageFavorite(this)">
            <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
        </button>` : '';
    
    // Image content based on display mode
    let imageContent;
    
    if (showBlur) {
        // Non-subscriber: blurred with lock, click to upgrade
        imageContent = `
            <div class="ig-image-blur-wrapper" onclick="event.stopPropagation();handleClickRegisterOrPay(event,${isTemporary})">
                <img data-src="${displayUrl}" 
                     data-full-url="${fullUrl}" 
                     data-id="${item._id}" 
                     src="/img/logo.webp" 
                     class="ig-image ig-image-blur lazy-image" 
                     loading="lazy">
                <div class="ig-lock-overlay">
                    <i class="bi bi-lock-fill"></i>
                </div>
            </div>`;
    } else if (showOverlay) {
        // Premium user with showNSFW=false: blurred but clickable to reveal
        // Store item data for adding to loadedImages when revealed
        const itemDataJson = JSON.stringify({
            _id: item._id,
            imageUrl: item.imageUrl,
            thumbnailUrl: item.thumbnailUrl,
            chatId: item.chatId,
            chatName: item.chatName,
            thumbnail: item.thumbnail,
            prompt: item.prompt,
            isLiked: item.isLiked
        }).replace(/"/g, '&quot;');
        
        imageContent = `
            <div class="ig-image-nsfw-wrapper" data-revealed="false" data-item="${itemDataJson}" onclick="event.stopPropagation(); revealNSFWImage(this)">
                <img data-src="${displayUrl}" 
                     data-full-url="${fullUrl}" 
                     data-id="${item._id}" 
                     src="/img/logo.webp" 
                     class="ig-image ig-image-nsfw lazy-image" 
                     loading="lazy">
                <div class="ig-nsfw-overlay">
                    <i class="bi bi-eye-slash"></i>
                    <span>${window.translations?.clickToReveal || 'Click to reveal'}</span>
                </div>
            </div>`;
    } else {
        // Normal display
        imageContent = `
            <img data-src="${displayUrl}" 
                 data-full-url="${fullUrl}" 
                 src="/img/logo.webp" 
                 alt="${item.prompt || ''}" 
                 class="ig-image lazy-image" 
                 loading="lazy"
                 onclick="event.stopPropagation(); openUserFavoriteImagePreview(this, ${loadedIndex})">`;
    }
    
    return `
        <div class="ig-image-card" data-image-id="${item._id}" data-full-url="${fullUrl}" data-index="${loadedIndex}">
            ${likeButton}
            ${imageContent}
            ${characterFooter}
        </div>
    `;
}

/**
 * Create HTML for individual image card
 */
function createImageCard(item, isBlur, isLiked, isAdmin, isTemporary, subscriptionStatus, loadedIndex, id, type, onChatPage = false) {
    // Use Instagram-style card for user favorites gallery
    if (type === 'user') {
        return createInstagramImageCard(item, isBlur, isLiked, isAdmin, isTemporary, subscriptionStatus, loadedIndex, id);
    }
    
    const chatId = type === 'chat' ? id : item.chatId;
    const linkUrl = item.chatSlug ? `/character/slug/${item.chatSlug}?imageSlug=${item.slug}` : `/character/${chatId}`;
    const addToChatLabel = window.translations?.image_tools?.add_to_chat || 'Add to Chat';
    const addToChatButton = onChatPage ? `
        <div class="position-absolute top-0 end-0 m-1" style="z-index:3;">
            <span class="btn badge-sm btn-light image-add-to-chat" 
                  data-image-id="${item._id}" 
                  data-chat-id="${chatId || ''}"
                  data-source-type="${type}"
                  title="${addToChatLabel}"
                  aria-label="${addToChatLabel}"
                  onclick="addGalleryImageToChat(this)">
                <i class="bi bi-chat-square-text"></i>
            </span>
        </div>` : '';
    
    // Use thumbnail for grid display if available, fallback to full imageUrl
    const displayUrl = item.thumbnailUrl || item.imageUrl;
    // Always keep full imageUrl for preview/modal (stored in data-full-url)
    const fullUrl = item.imageUrl;
    
    const imageContainerClass = 'image-container image-fav-double-click';
    
    return `
        <div class="image-card col-6 col-md-3 col-lg-2 mb-2 px-1" data-image-id="${item._id}" data-full-url="${fullUrl}">
            <div class="card shadow-0 position-relative" style="overflow: hidden;">
                ${!isBlur ? `${addToChatButton}` : ''}
                ${isBlur ? 
                    `<div class="position-relative">
                        <div type="button" onclick="event.stopPropagation();handleClickRegisterOrPay(event,${isTemporary})">
                            <img data-src="${displayUrl}" data-full-url="${fullUrl}" data-id="${item._id}" src="/img/logo.webp" class="card-img-top img-blur lazy-image" style="object-fit: cover;" loading="lazy">
                        </div>
                    </div>` :
                    `<div href="${linkUrl}" data-index="${loadedIndex}" 
                        class="${imageContainerClass}"
                        data-id="${item._id}" data-chat-id="${chatId}" onclick="toggleImageFavorite(this)">
                        <img data-src="${displayUrl}" data-full-url="${fullUrl}" src="/img/logo.webp" alt="${item.prompt || ''}" class="card-img-top lazy-image" style="object-fit: cover;" loading="lazy">
                    </div>`
                }
                ${isTemporary || (!subscriptionStatus && isBlur) ? '':
                    `
                    <div class="position-absolute top-0 start-0 m-1" style="z-index:5;">
                        <span class="btn badge-sm btn-light image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${item._id}" data-chat-id="${chatId}" onclick="event.stopPropagation(); toggleImageFavorite(this)">
                            <i class="bi ${isLiked ? 'bi-heart-fill text-danger' : 'bi-heart'}" style="cursor: pointer;"></i>
                        </span>
                    </div>
                `}
                ${isAdmin ? `
                    <div class="card-body p-2 row mx-0 px-0 align-items-center justify-content-between">
                        <button class="btn btn-light col-4 image-nsfw-toggle ${item?.nsfw ? 'nsfw' : 'sfw'}" 
                            data-id="${item._id}" onclick="toggleImageNSFW(this)">
                            <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'}"></i>
                        </button>
                        <button class="btn btn-sm btn-info col-4 set-sfw-thumbnail-btn" 
                            data-id="${chatId}" onclick="setSFWThumbnail(this); event.stopPropagation();" title="Set SFW Thumbnail">
                            <i class="bi bi-image"></i>
                        </button>
                        ${type === 'chat' ? `
                            <button class="btn btn-light col-4 update-chat-image" onclick="updateChatImage(this)" data-id="${chatId}" data-img="${item.imageUrl}" style="cursor: pointer; opacity:0.8;">
                                <i class="bi bi-arrow-repeat"></i>
                            </button>
                        ` : ''}
                    </div>` : ''
                    
                }
            </div>
        </div>
    `;
}

/**
 * Render videos to the gallery
 */
function renderVideos(videos, id, type, page = 1) {
    const config = getGalleryConfig(type);
    const gallerySelector = config?.gallery;
    if (!gallerySelector) {
        return;
    }

    const emptyState = config.empty ? document.querySelector(config.empty) : null;
    if (!videos || videos.length === 0) {
        if (page === 1 && emptyState) {
            emptyState.classList.remove('d-none');
        }
        return;
    }

    if (emptyState) {
        emptyState.classList.add('d-none');
    }

    if (!window.loadedVideos) {
        window.loadedVideos = [];
    }

    const fragment = document.createDocumentFragment();
    const subscriptionStatus = window.user?.subscriptionStatus === 'active';
    const isTemporary = !!window.user?.isTemporary;

    videos.forEach(video => {
        if (document.querySelector(`[data-video-id="${video._id}"]`)) {
            return;
        }
        const isBlur = shouldBlurNSFW(video, subscriptionStatus);
        
        // Store all videos so they can be unlocked if needed
        if (!window.loadedVideos.some(v => v._id === video._id)) {
            window.loadedVideos.push(video);
        }
        
        const cardHtml = createVideoCard(video, isBlur, isTemporary);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml;
        fragment.appendChild(tempDiv.firstElementChild);
    });

    const gallery = document.querySelector(gallerySelector);
    if (gallery && fragment.hasChildNodes()) {
        gallery.appendChild(fragment);
        requestAnimationFrame(() => applyGridLayout(gallerySelector));
    }
}

function truncateText(text, maxLength) {
    if (typeof text !== 'string') {
        return '';
    }
    const trimmed = text.trim();
    if (trimmed.length <= maxLength) {
        return trimmed;
    }
    const sliceLength = Math.max(0, maxLength - 3);
    return `${trimmed.slice(0, sliceLength).trimEnd()}...`;
}

/**
 * Create HTML for individual video card
 */
function createVideoCard(video, isBlur, isTemporary) {
    const promptLabel = window.translations?.prompt || 'Prompt';
    const createdLabel = window.translations?.videos?.created || 'Created';
    const durationLabel = window.translations?.videos?.duration || 'Duration';
    const unlockLabel = window.translations?.galleryTabs?.unlockVideo || 'Unlock video';
    const promptText = video.prompt ? truncateText(video.prompt, VIDEO_PROMPT_MAX_LENGTH) : '';

    const metadata = `
        <div class="small text-muted">
            ${video.duration ? `<span><i class="bi bi-stopwatch me-1"></i>${durationLabel}: ${video.duration}s</span>` : ''}
            ${video.createdAt ? `<span class="ms-2"><i class="bi bi-calendar-event me-1"></i><span class="jp-date">${video.createdAt}</span></span>` : ''}
        </div>
    `;

    const lockedMarkup = `
        <div class="card-img-top d-flex flex-column justify-content-center align-items-center position-relative overflow-hidden" style="border-radius:0.75rem 0.75rem 0 0;background-color:#000;min-height:260px;">
            <i class="bi bi-lock-fill fs-1 text-white-50 mb-3"></i>
            <button type="button" class="btn btn-primary unlock-video-btn" data-video-id="${video._id}" onclick="event.stopPropagation();handleUnlockVideo(this,${isTemporary});">
                <i class="bi bi-unlock-fill me-2"></i>${unlockLabel}
            </button>
        </div>
    `;

    const videoMarkup = `
        <video src="${video.videoUrl}#t=0.1" preload="metadata" controls class="card-img-top video-card-media" style="width:100%;height:auto;display:block;border-radius:0.75rem 0.75rem 0 0;background-color:#000;" playsinline muted controlsList="nodownload"></video>
    `;

    return `
        <div class="video-card col-12 col-sm-6 col-lg-4 col-xl-3 mb-3" data-video-id="${video._id}">
            <div class="card shadow-0 position-relative h-100">
                ${isBlur ? lockedMarkup : videoMarkup}
                <div class="card-body pt-2">
                    ${promptText ? `<p class="card-text small text-muted mb-2" style="font-size:0.85rem; max-height:4.5em; overflow:hidden;">${promptLabel}: ${promptText}</p>` : ''}
                    ${metadata}
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup infinite scroll with optimized event handling
 */
function setupInfiniteScroll(id, isModal = false, type = 'chat') {
    const manager = window.chatImageManager;
    const scrollKey = `${id}_${isModal ? 'modal' : 'page'}_${type}`;
    
    // Prevent duplicate scroll handlers
    if (manager.initialized.has(scrollKey)) {
        return;
    }
    
    const scrollContainer = isModal ? (type === 'intro' ? $('#characterIntroModal .modal-body') : $('#characterModal .modal-body')) : $(window);
    const config = getGalleryConfig(type);
    const cacheKey = `${type}_${id}`;
    
    // Use namespaced events to avoid conflicts with other scroll handlers
    const eventName = `scroll.${type}Images_${id}_${isModal ? 'modal' : 'page'}`;
    
    // Remove any existing scroll handlers for this specific context
    scrollContainer.off(eventName);
    
    // Throttled scroll handler for better performance
    let scrollTimeout;
    const scrollHandler = function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            handleScroll(id, isModal, cacheKey, type);
        }, 100); // 100ms throttle
    };
    
    scrollContainer.on(eventName, scrollHandler);
    manager.scrollHandlers.set(scrollKey, scrollHandler);
    manager.initialized.add(scrollKey);
}

/**
 * Handle scroll events and trigger loading when needed
 */
function handleScroll(id, isModal, cacheKey, type) {
    const manager = window.chatImageManager;
    const config = getGalleryConfig(type);

    // Skip if already loading
    if (manager.loadingStates.get(cacheKey)) {
        return;
    }
    
    // Check if gallery is visible
    if (config?.gallery && !isGalleryVisible(config.gallery)) {
        return;
    }
    
    // For intro type, validate that we're still loading for the correct character
    if (type === 'intro') {
        const gallerySelector = config?.gallery || '#character-intro-gallery';
        const currentChatId = $(gallerySelector).attr('data-current-chat-id');
        if (currentChatId && currentChatId !== id) {
            console.warn(`[handleScroll] Skipping scroll load - gallery is for ${currentChatId}, but scroll handler is for ${id}`);
            return;
        }
    }

    const currentPage = manager.currentPages.get(cacheKey);
    const totalPages = manager.totalPages.get(cacheKey);
    
    // Check if we've reached the end
    if (currentPage >= totalPages) {
        return;
    }
    
    // Get the gallery element
    const gallerySelector = config?.gallery || '#chat-images-gallery';
    const gallery = document.querySelector(gallerySelector);
    if (!gallery) {
        return;
    }
    
    // Get the scroll container
    const scrollContainer = isModal ? (type === 'intro' ? document.querySelector('#characterIntroModal .modal-body') : document.querySelector('#characterModal .modal-body')) : window;
    
    // Get the last element in the gallery
    const lastElement = gallery.lastElementChild;
    if (!lastElement) {
        return;
    }
    
    // Use Intersection Observer API for more reliable detection
    // Check if the last element is near the viewport
    const rect = lastElement.getBoundingClientRect();
    const containerRect = scrollContainer instanceof Window ? window : scrollContainer.getBoundingClientRect();
    
    // Calculate the bottom of the visible area (with 300px buffer for early loading)
    const visibleBottom = scrollContainer instanceof Window ? window.innerHeight : containerRect.bottom;
    const triggerOffset = 300; // Start loading when user is 300px away from last element
    
    // Trigger loading when the last element is within the trigger offset
    if (rect.top < visibleBottom + triggerOffset) {
        const nextPage = currentPage + 1;
        
        const loadFunction = type === 'chat' ? loadChatImages : type === 'intro' ? loadIntroImages : loadUserImages;
        loadFunction(id, nextPage, false, isModal)
            .catch(error => {
                console.error(`[handleScroll] Failed to load page ${nextPage}:`, error);
            });
    }
}

/**
 * Apply consistent grid layout
 */
function applyGridLayout(selector = '#chat-images-gallery') {
    // Skip grid layout for user-images-gallery - it uses CSS Grid with Instagram-style layout
    if (selector === '#user-images-gallery') {
        return;
    }
    
    const gallery = $(selector);
    if (gallery.length && typeof gridLayout === 'function') {
        gridLayout(selector);
    }
}

function isGalleryVisible(selector) {
    if (!selector) {
        return true;
    }
    const $el = $(selector);
    if (!$el.length) {
        return true;
    }
    return $el.is(':visible');
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
function showLoadingIndicator(show, type = 'chat') {
    const controlsSelector = getGalleryConfig(type)?.controls || '#chat-images-pagination-controls';
    const controlsContainer = $(controlsSelector);
    
    if (show) {
        controlsContainer.html('<div class="text-center py-3"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div></div>');
    } else {
        // Only clear if it contains a spinner
        if (controlsContainer.find('.spinner-border').length > 0) {
            controlsContainer.empty();
        }
    }
}

function resolveImageTitle(title) {
    if (!title) {
        return '';
    }

    if (typeof title === 'string') {
        return title;
    }

    if (typeof title === 'object') {
        const preferredLangs = [];
        if (typeof window.lang === 'string') {
            preferredLangs.push(window.lang.toLowerCase());
        }
        if (window.user && typeof window.user.lang === 'string') {
            preferredLangs.push(window.user.lang.toLowerCase());
        }
        preferredLangs.push('en', 'ja', 'fr');

        for (const lang of preferredLangs) {
            if (title[lang]) {
                return title[lang];
            }
        }

        const fallback = Object.values(title).find(value => !!value);
        if (fallback) {
            return fallback;
        }
    }

    return '';
}

function refreshImageToolsState(imageData, chatId, userChatId) {
    if (typeof getImageTools !== 'function') {
        return;
    }

    const imageId = imageData._id;
    const toolsContainer = $(`.image-tools[data-id="${imageId}"]`).last();

    if (!toolsContainer.length) {
        return;
    }

    toolsContainer
        .nextAll(`.title.assistant-chat-box[data-id="${imageId}"]`)
        .first()
        .remove();

    const toolsMarkup = getImageTools({
        chatId,
        userChatId,
        imageId,
        isLiked: !!imageData.isLiked,
        title: resolveImageTitle(imageData.title),
        prompt: imageData.prompt || '',
        nsfw: !!imageData.nsfw,
        imageUrl: imageData.imageUrl,
        actions: Array.isArray(imageData.actions) ? imageData.actions : []
    });

    toolsContainer.replaceWith(toolsMarkup);

    if (typeof shouldBlurNSFW === 'function') {
        const subscriptionStatus = window.user?.subscriptionStatus === 'active';
        const shouldHideTools = shouldBlurNSFW({ nsfw: !!imageData.nsfw }, subscriptionStatus);
        if (shouldHideTools) {
            $(`.image-tools[data-id="${imageId}"]`).hide();
        }
    }
}

window.addGalleryImageToChat = function(el) {
    const isTemporary = !!window.user?.isTemporary;
    if (isTemporary) {
        if (typeof openLoginForm === 'function') {
            openLoginForm();
        }
        return;
    }

    const $button = $(el);
    if ($button.data('loading')) {
        return;
    }

    const imageId = $button.data('image-id');
    let chatId = $button.data('chat-id');
    if (!chatId || chatId === 'null' || chatId === 'undefined') {
        chatId = window.chatId || sessionStorage.getItem('lastChatId') || sessionStorage.getItem('chatId');
    }
    if (chatId === 'null' || chatId === 'undefined') {
        chatId = null;
    }

    let userChatId = window.userChatId || $('#chatContainer').attr('data-id') || sessionStorage.getItem('userChatId');
    if (userChatId === 'null' || userChatId === 'undefined') {
        userChatId = null;
    }

    if (!imageId || !chatId || !userChatId) {
        if (typeof showNotification === 'function') {
            showNotification(window.translations?.image_tools?.chat_not_ready || 'Chat session is not ready.', 'error');
        }
        return;
    }

    const originalHtml = $button.html();
    $button
        .data('loading', true)
        .attr('disabled', true)
        .addClass('disabled')
        .html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="width: 17px !important; height: 17px !important; font-size: 12px;"></span>');
        
    $.ajax({
        url: `/gallery/${imageId}/add-to-chat`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ chatId, userChatId }),
        xhrFields: { withCredentials: true },
        success: function(response) {
            const imageData = response?.image;
            if (!response?.success || !imageData || !imageData.imageUrl) {
                console.error('Invalid response when adding image to chat:', response);
                if (typeof showNotification === 'function') {
                    showNotification(window.translations?.image_tools?.add_to_chat_failed || 'Unable to add image to chat.', 'error');
                }
                $button
                    .html(originalHtml)
                    .attr('disabled', false)
                    .removeClass('disabled');
                return;
            }

            const imgEl = document.createElement('img');
            imgEl.setAttribute('src', imageData.imageUrl);
            imgEl.setAttribute('alt', resolveImageTitle(imageData.title));
            imgEl.setAttribute('data-id', imageData._id);
            imgEl.setAttribute('data-prompt', imageData.prompt || '');
            imgEl.setAttribute('data-nsfw', imageData.nsfw ? 'true' : 'false');
            if (imageData.isUpscaled) {
                imgEl.setAttribute('data-isUpscaled', 'true');
            }
            if (imageData.isMergeFace || imageData.mergeId) {
                imgEl.setAttribute('data-isMergeFace', 'true');
            }

            displayMessage('bot-image', imgEl, userChatId);
            refreshImageToolsState(imageData, chatId, userChatId);

            if (Array.isArray(window.loadedImages)) {
                const alreadyStored = window.loadedImages.some(stored => stored && stored._id === imageData._id);
                if (!alreadyStored) {
                    window.loadedImages.push({
                        _id: imageData._id,
                        imageUrl: imageData.imageUrl,
                        prompt: imageData.prompt,
                        title: imageData.title,
                        nsfw: imageData.nsfw,
                        chatId,
                        chatSlug: imageData.chatSlug,
                        actions: imageData.actions || []
                    });
                }
            }

            if (typeof showNotification === 'function') {
                showNotification(window.translations?.image_tools?.added_to_chat || 'Image added to chat.', 'success');
            }

            $button
                .removeClass('btn-light')
                .addClass('btn-success')
                .html('<i class="bi bi-check-lg"></i>')
                .attr('title', window.translations?.image_tools?.added_to_chat || 'Added to chat')
                .attr('aria-label', window.translations?.image_tools?.added_to_chat || 'Added to chat');
        },
        error: function(error) {
            console.error('Failed to add image to chat:', error);
            if (typeof showNotification === 'function') {
                showNotification(window.translations?.image_tools?.add_to_chat_failed || 'Unable to add image to chat.', 'error');
            }
            $button
                .html(originalHtml)
                .attr('disabled', false)
                .removeClass('disabled');
        },
        complete: function() {
            $button.data('loading', false);
        }
    });
};

/**
 * Clear cache for a specific item
 */
window.clearImageCache = function(type, id) {
    const manager = window.chatImageManager;
    const cacheKey = `${type}_${id}`;
    
    // Clear cache
    const hadCache = manager.cache.has(cacheKey);
    manager.cache.delete(cacheKey);
    manager.loadingStates.delete(cacheKey);
    manager.currentPages.delete(cacheKey);
    manager.totalPages.delete(cacheKey);
    
    // Remove scroll handlers
    const scrollKeys = Array.from(manager.initialized).filter(key => key.includes(id));
    scrollKeys.forEach(key => {
        manager.initialized.delete(key);
        manager.scrollHandlers.delete(key);
    });

    // Clear localStorage cache as well
    const localCacheKey = `images_${cacheKey}`;
    const hadLocalCache = localStorage.getItem(localCacheKey) !== null;
    localStorage.removeItem(localCacheKey);
};

/**
 * Clear cache for a specific chat (backward compatibility)
 */
window.clearChatImageCache = function(chatId) {
    clearImageCache('chat', chatId);
};

/**
 * Clear cache for a specific user
 */
window.clearUserImageCache = function(userId) {
    clearImageCache('user', userId);
};

/**
 * Get cache statistics for debugging
 */
window.getImageCacheStats = function(type, id) {
    const manager = window.chatImageManager;
    const cacheKey = `${type}_${id}`;
    
    if (!manager.cache.has(cacheKey)) {
        return { error: `${type} not found in cache` };
    }
    
    const cache = manager.cache.get(cacheKey);
    const cachedPages = Array.from(cache.keys()).sort((a, b) => a - b);
    const totalImages = Array.from(cache.values()).reduce((sum, images) => sum + images.length, 0);
    
    return {
        type,
        id,
        cachedPages,
        totalImages,
        currentPage: manager.currentPages.get(cacheKey),
        totalPages: manager.totalPages.get(cacheKey),
        isLoading: manager.loadingStates.get(cacheKey)
    };
};

/**
 * Get cache statistics for chat (backward compatibility)
 */
window.getChatImageCacheStats = function(chatId) {
    return getImageCacheStats('chat', chatId);
};

/**
 * Get cache statistics for user
 */
window.getUserImageCacheStats = function(userId) {
    return getImageCacheStats('user', userId);
};

/**
 * Handle video unlock for premium users
 */
window.handleUnlockVideo = function(button, isTemporary) {
    if (isTemporary) {
        // Temporary users should be prompted to log in/register
        if (typeof openLoginForm === 'function') {
            openLoginForm();
        }
        return;
    }
    
    const subscribed = window.user && window.user.subscriptionStatus === 'active';
    if (!subscribed) {
        // Non-subscribed users should be directed to payment
        if (typeof loadPlanPage === 'function') {
            loadPlanPage();
        }
        return;
    }
    
    // Premium user - unlock the video by replacing the locked markup with video
    const videoCard = button.closest('.video-card');
    if (!videoCard) {
        return;
    }
    
    const videoId = videoCard.getAttribute('data-video-id');
    const cardBody = videoCard.querySelector('.card');
    
    if (!cardBody) {
        return;
    }
    
    // Find the locked markup div and replace it with video markup
    const lockedMarkup = cardBody.querySelector('.card-img-top');
    if (!lockedMarkup) {
        return;
    }
    
    // We need to find the video data from the page or re-fetch it
    // For now, we'll add a class to trigger showing the video through CSS
    // or we can rebuild the video element
    const videoMarkup = document.createElement('video');
    videoMarkup.setAttribute('preload', 'metadata');
    videoMarkup.setAttribute('controls', '');
    videoMarkup.setAttribute('class', 'card-img-top video-card-media');
    videoMarkup.setAttribute('style', 'width:100%;height:auto;display:block;border-radius:0.75rem 0.75rem 0 0;background-color:#000;');
    videoMarkup.setAttribute('playsinline', '');
    videoMarkup.setAttribute('muted', '');
    videoMarkup.setAttribute('controlsList', 'nodownload');
    
    // The video data should be available - we need to extract it from localStorage or find it
    // For now, try to get it from the page's state
    const allVideos = window.loadedVideos || [];
    const video = allVideos.find(v => v._id === videoId);
    
    if (video && video.videoUrl) {
        videoMarkup.setAttribute('src', `${video.videoUrl}#t=0.1`);
        lockedMarkup.replaceWith(videoMarkup);
        
        if (typeof showNotification === 'function') {
            showNotification(window.translations?.videos?.unlocked || 'Video unlocked!', 'success');
        }
    } else {
        // If we don't have the video URL, we need to fetch it from the server
        // This shouldn't normally happen, but handle it gracefully
        console.warn(`[handleUnlockVideo] Video data not found for ${videoId}, attempting to fetch from server`);
        if (typeof showNotification === 'function') {
            showNotification(window.translations?.videos?.unlock_error || 'Unable to unlock video at this time.', 'error');
        }
    }
};

/**
 * Reveal NSFW image for premium users (with showNSFW=false)
 * @param {HTMLElement} wrapper - The wrapper element containing the image
 */
window.revealNSFWImage = function(wrapper) {
    const $wrapper = $(wrapper);
    const isRevealed = $wrapper.attr('data-revealed') === 'true';
    
    if (isRevealed) {
        // Already revealed, open the preview using the stored index
        const loadedIndex = parseInt($wrapper.attr('data-loaded-index'), 10);
        if (!isNaN(loadedIndex)) {
            openUserFavoriteImagePreview(wrapper, loadedIndex);
        }
        return;
    }
    
    // Get the image data stored on the wrapper
    const itemDataStr = $wrapper.attr('data-item');
    if (itemDataStr) {
        try {
            const item = JSON.parse(itemDataStr.replace(/&quot;/g, '"'));
            
            // Add to loadedImages if not already present
            if (!Array.isArray(window.loadedImages)) {
                window.loadedImages = [];
            }
            
            if (!window.loadedImages.some(img => img._id === item._id)) {
                window.loadedImages.push(item);
            }
            
            // Get the index of this image in loadedImages
            const loadedIndex = window.loadedImages.findIndex(img => img._id === item._id);
            $wrapper.attr('data-loaded-index', loadedIndex);
            
            // Also update the parent card's data-index
            $wrapper.closest('.ig-image-card').attr('data-index', loadedIndex);
        } catch (e) {
            console.error('[revealNSFWImage] Failed to parse item data:', e);
        }
    }
    
    // Reveal the image
    $wrapper.attr('data-revealed', 'true');
    $wrapper.find('.ig-image').removeClass('ig-image-nsfw');
    $wrapper.find('.ig-nsfw-overlay').fadeOut(200, function() {
        $(this).remove();
    });
    
    // Update click handler to open preview on next click
    const newLoadedIndex = parseInt($wrapper.attr('data-loaded-index'), 10);
    $wrapper.off('click').on('click', function(e) {
        e.stopPropagation();
        if (!isNaN(newLoadedIndex)) {
            openUserFavoriteImagePreview(wrapper, newLoadedIndex);
        }
    });
};

/**
 * Open image preview modal for user favorite images gallery
 * @param {HTMLElement} el - The clicked element
 * @param {number} clickedIndex - The index of the clicked image in loadedImages
 */
window.openUserFavoriteImagePreview = function(el, clickedIndex) {
    // Create preview modal if it doesn't exist
    if (typeof createPreviewModalIfNeeded === 'function') {
        createPreviewModalIfNeeded();
    } else {
        // Fallback: create basic modal structure
        if (!$('#imagePreviewModal').length) {
            const modalHTML = `
                <div class="modal fade" id="imagePreviewModal" tabindex="-1" aria-labelledby="imagePreviewModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-fullscreen m-0">
                        <div class="modal-content mx-auto w-100" style="background: #000;">
                            <div class="modal-header border-0 position-fixed w-100" style="top: 0; right: 0; z-index: 10000; background: transparent; justify-content: flex-end; padding: 1rem;">
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" style="background-color: rgba(0,0,0,0.5); border-radius: 50%; padding: 12px; opacity: 0.9;"></button>
                            </div>
                            <div class="modal-body p-0" style="height: 100vh; overflow-y: auto; overflow-x: hidden; padding-top: 0 !important;">
                                <div class="swiper-container image-preview-swiper" style="min-height: 100%; width: 100%; padding-top: 0; padding-bottom: 100px;">
                                    <div class="swiper-wrapper"></div>
                                    <div class="swiper-button-next" style="color: white; opacity: 0.8; right: 20px;"></div>
                                    <div class="swiper-button-prev" style="color: white; opacity: 0.8; left: 20px;"></div>
                                    <div class="swiper-pagination" style="bottom: 80px;"></div>
                                    <div class="image-like-overlay position-absolute" style="top: 20px; left: 20px; z-index: 1000;">
                                        <button class="btn btn-light rounded-circle image-like-btn d-flex justify-content-center align-items-center" style="width: 50px; height: 50px; opacity: 0.9; backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.2);">
                                            <i class="bi bi-heart fs-4"></i>
                                        </button>
                                    </div>
                                    <div class="image-info-overlay position-absolute w-100" style="bottom: 20px; left: 0; right: 0; z-index: 1000;">
                                        <div class="container text-center">
                                            <div class="d-none image-info-container mx-auto" style="max-width: 600px; padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                                                <div class="image-title text-white fw-bold mb-2" style="font-size: 18px;"></div>
                                                <div class="image-prompt-container d-none" style="max-height: 100px; overflow-y: auto; scrollbar-width: thin;">
                                                    <div class="image-prompt text-white-50" style="font-size: 14px; line-height: 1.4;"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            $('body').append(modalHTML);
            
            // Add cleanup handler for modal hidden event
            $('#imagePreviewModal').on('hidden.bs.modal', function() {
                // Remove any stale backdrops
                $('.modal-backdrop').remove();
                // Remove modal-open class from body if no other modals are open
                if ($('.modal.show').length === 0) {
                    $('body').removeClass('modal-open').css('overflow', '');
                }
            });
        }
    }
    
    // Get all loaded images for the user favorites gallery
    const images = window.loadedImages || [];
    
    if (images.length === 0) {
        console.warn('[openUserFavoriteImagePreview] No images loaded');
        return;
    }
    
    // Build slides for the swiper
    const wrapper = $('#imagePreviewModal .swiper-wrapper');
    wrapper.empty();
    
    // Create image data for preview with character info
    const previewItems = images.map(img => ({
        type: 'image',
        url: img.imageUrl || img.thumbnailUrl,
        id: img._id,
        title: img.chatName || 'Image',
        prompt: img.prompt || '',
        chatId: img.chatId,
        chatName: img.chatName,
        thumbnail: img.thumbnail,
        isLiked: img.isLiked
    }));
    
    // Build slides with character info overlay
    previewItems.forEach(item => {
        const characterInfo = item.chatId ? `
            <div class="position-absolute bottom-0 start-0 end-0 p-3" style="background: linear-gradient(transparent, rgba(0,0,0,0.8)); z-index: 10;">
                <div class="d-flex align-items-center gap-2 character-preview-link" 
                     onclick="event.stopPropagation(); $('#imagePreviewModal').modal('hide'); setTimeout(() => openCharacterIntroModal('${item.chatId}'), 300);" 
                     style="cursor: pointer;">
                    <img src="${item.thumbnail || '/img/default-thumbnail.png'}" 
                         alt="${item.chatName || 'Character'}" 
                         class="rounded-circle" 
                         style="width: 40px; height: 40px; object-fit: cover; border: 2px solid rgba(255,255,255,0.5);"
                         onerror="this.src='/img/default-thumbnail.png'">
                    <span class="text-white" style="font-size: 14px; font-weight: 500;">
                        ${item.chatName || 'Unknown Character'}
                    </span>
                    <i class="bi bi-chevron-right text-white-50"></i>
                </div>
            </div>
        ` : '';
        
        wrapper.append(`
            <div class="swiper-slide d-flex align-items-center justify-content-center position-relative">
                <div class="swiper-zoom-container">
                    <img src="${item.url}" 
                         class="img-fluid" 
                         style="max-height: 100vh; max-width: 100vw; object-fit: contain;" 
                         data-image-id="${item.id}" 
                         data-image-title="${item.title || ''}" 
                         data-image-prompt="${item.prompt || ''}"
                         data-chat-id="${item.chatId || ''}">
                </div>
                ${characterInfo}
            </div>
        `);
    });
    
    // Store preview data for like button and other interactions
    window.previewImages = previewItems;
    window.initialSlideIndex = Math.max(0, Math.min(clickedIndex, previewItems.length - 1));
    
    // Show the modal - reuse existing instance or create new one
    const modalEl = document.getElementById('imagePreviewModal');
    let modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) {
        modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
    }
    modal.show();
    
    // Initialize swiper after modal is shown
    $('#imagePreviewModal').off('shown.bs.modal.userFavorites').on('shown.bs.modal.userFavorites', function() {
        if (window.imageSwiper) {
            window.imageSwiper.destroy(true, true);
        }
        
        window.imageSwiper = new Swiper('.image-preview-swiper', {
            loop: false,
            initialSlide: window.initialSlideIndex || 0,
            zoom: { maxRatio: 5, minRatio: 1, toggle: false, containerClass: 'swiper-zoom-container' },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            pagination: { el: '.swiper-pagination', clickable: true, dynamicBullets: true },
            touchRatio: 1,
            touchAngle: 45,
            grabCursor: true,
            keyboard: { enabled: true, onlyInViewport: false },
            mousewheel: { invert: false },
            lazy: { loadPrevNext: true, loadPrevNextAmount: 2 },
            watchSlidesProgress: true,
            watchSlidesVisibility: true,
            on: {
                slideChange: function() {
                    const realIndex = this.realIndex || this.activeIndex;
                    updateUserFavoritePreviewInfo(realIndex);
                },
                init: function() {
                    setTimeout(() => {
                        const startIndex = window.initialSlideIndex || 0;
                        this.slideTo(startIndex, 0);
                        updateUserFavoritePreviewInfo(startIndex);
                    }, 100);
                }
            }
        });
        
        $('.swiper-slide').show();
    });
};

/**
 * Update the like button and info for user favorite image preview
 */
function updateUserFavoritePreviewInfo(activeIndex) {
    const cur = window.previewImages && window.previewImages[activeIndex];
    if (!cur) return;
    
    // Update like button
    const $likeBtn = $('.image-like-btn');
    const $likeIcon = $likeBtn.find('i');
    
    if (cur.id) {
        $likeBtn.attr('data-id', cur.id);
        
        // Check if image is liked from the DOM
        const isLiked = $(`.image-fav[data-id="${cur.id}"] i`).hasClass('bi-heart-fill');
        
        if (isLiked) {
            $likeIcon.removeClass('bi-heart').addClass('bi-heart-fill text-danger');
        } else {
            $likeIcon.removeClass('bi-heart-fill text-danger').addClass('bi-heart');
        }
    }
    
    // Update title if info container exists
    $('.image-title').text(cur.title || cur.chatName || 'Image');
    if (cur.prompt) {
        $('.image-prompt').text(cur.prompt);
        $('.image-prompt-container').removeClass('d-none');
    } else {
        $('.image-prompt-container').addClass('d-none');
    }
}