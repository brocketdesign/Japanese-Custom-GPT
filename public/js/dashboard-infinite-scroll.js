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
 * Main function to load chat images with infinite scroll
 * @param {string} chatId - The chat ID
 * @param {number} page - Page number to load
 * @param {boolean} reload - Whether to reload from cache
 * @param {boolean} isModal - Whether loading in modal context
 * @returns {Promise}
 */
window.loadChatImages = function(chatId, page = 1, reload = false, isModal = false) {
    // Check if we are on the character profile page
    const onCharacterPage = !!document.querySelector('#characterProfilePage');
    // Only skip if not on character page and chat ID does not match session
    if (!onCharacterPage && !validateChatIdWithSession(chatId)) {
        console.warn(`[loadChatImages] Chat ID ${chatId} does not match session storage`);
        return Promise.resolve();
    }
    
    return loadImages('chat', chatId, page, reload, isModal, `/chat/${chatId}/images`, onCharacterPage);
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
function loadImages(type, id, page = 1, reload = false, isModal = false, endpoint, onCharacterPage = false) {
    const manager = window.chatImageManager;
    const cacheKey = `${type}_${id}`;
    
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
            // Handle reload scenario
            if (reload) {
                const hasCache = await handleReload(id, cacheKey, type);
                
                // Always setup infinite scroll after reload
                setupInfiniteScroll(id, isModal, type);
                
                // If we have cache and we're requesting page 1, don't fetch from server
                if (hasCache && page === 1) {
                    resolve();
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
                const cachedImages = manager.cache.get(cacheKey).get(page);
                await renderImages(cachedImages, id, type);
                manager.currentPages.set(cacheKey, Math.max(manager.currentPages.get(cacheKey), page));
                setupInfiniteScroll(id, isModal, type);
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
            
            // Additional check for reload scenario
            if (reload && page === 1 && manager.cache.get(cacheKey).has(1)) {
                resolve();
                return;
            }
            
            // Fetch from server
            await fetchImagesFromServer(id, page, cacheKey, isModal, endpoint, type);
            resolve();
            
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
async function handleReload(id, cacheKey, type) {
    const manager = window.chatImageManager;
    const cache = manager.cache.get(cacheKey);
    const cachedPages = Array.from(cache.keys()).sort((a, b) => a - b);
    
    // Clear existing content
    const gallerySelector = type === 'chat' ? '#chat-images-gallery' : '#user-images-gallery';
    $(gallerySelector).empty();
    
    // Set data attribute for chat galleries to track which chat is being rendered
    if (type === 'chat') {
        $(gallerySelector).attr('data-chat-id', id);
    }
    
    window.loadedImages = [];
    
    // If we have cached pages, render them
    if (cachedPages.length > 0) {
        // Render all cached pages in order
        for (const pageNum of cachedPages) {
            const images = cache.get(pageNum);
            await renderImages(images, id, type);
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
async function fetchImagesFromServer(id, page, cacheKey, isModal, endpoint, type) {
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
        
        // Cache the response
        manager.cache.get(cacheKey).set(response.page, response.images || []);
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
        await renderImages(response.images || [], id, type);
        
        // Setup infinite scroll
        setupInfiniteScroll(id, isModal, type);
        
    } catch (error) {
        console.error(`[fetchImagesFromServer] AJAX Error for ${cacheKey}:`, error);
        throw error;
    } finally {
        manager.loadingStates.set(cacheKey, false);
        showLoadingIndicator(false, type);
    }
}

/**
 * Render images to the gallery with consistent grid layout
 */
async function renderImages(images, id, type) {
    if (!images || images.length === 0) {
        return;
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
    
    images.forEach((item, index) => {
        const isBlur = shouldBlurNSFW(item, subscriptionStatus);
        const isLiked = item?.likedBy?.some(id => id.toString() === currentUserId.toString());
        
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
        
        const loadedIndex = window.loadedImages.length - 1;
        const cardHtml = createImageCard(item, isBlur, isLiked, isAdmin, isTemporary, loadedIndex, id, type);
        
        // Create DOM element
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = cardHtml;
        const cardElement = tempDiv.firstElementChild;
        
        fragment.appendChild(cardElement);
        newImagesAdded++;
    });
    
    // Append all cards at once for better performance
    const gallerySelector = type === 'chat' ? '#chat-images-gallery' : '#user-images-gallery';
    const gallery = document.querySelector(gallerySelector);
    if (gallery && fragment.hasChildNodes()) {
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
function createImageCard(item, isBlur, isLiked, isAdmin, isTemporary, loadedIndex, id, type) {
    const chatId = type === 'chat' ? id : item.chatId;
    const linkUrl = item.chatSlug ? `/character/slug/${item.chatSlug}?imageSlug=${item.slug}` : `/character/${chatId}`;
    const addToChatLabel = window.translations?.image_tools?.add_to_chat || 'Add to Chat';
    const addToChatButton = `
        <div class="position-absolute top-0 end-0 m-1" style="z-index:3;">
            <span class="btn btn-light image-add-to-chat" 
                  data-image-id="${item._id}" 
                  data-chat-id="${chatId || ''}"
                  data-source-type="${type}"
                  title="${addToChatLabel}"
                  aria-label="${addToChatLabel}"
                  onclick="addGalleryImageToChat(this)">
                <i class="bi bi-chat-square-text"></i>
            </span>
        </div>`;
    
    return `
        <div class="image-card col-6 col-md-3 col-lg-2 mb-2" data-image-id="${item._id}">
            <div class="card shadow-0 position-relative">
                ${!isBlur ? `${addToChatButton}` : ''}
                ${isBlur ? 
                    `<div class="position-relative">
                        <div type="button" onclick="event.stopPropagation();handleClickRegisterOrPay(event,${isTemporary})">
                            <img data-src="${item.imageUrl}" data-id="${item._id}" class="card-img-top img-blur" style="object-fit: cover;" loading="lazy">
                        </div>
                    </div>` :
                    `<div href="${linkUrl}" data-index="${loadedIndex}" 
                        class="image-container image-fav-double-click"
                        data-id="${item._id}" data-chat-id="${chatId}" onclick="toggleImageFavorite(this)">
                        <img src="${item.imageUrl}" alt="${item.prompt}" class="card-img-top" style="object-fit: cover;" loading="lazy">
                    </div>
                    <div class="position-absolute top-0 start-0 m-1" style="z-index:3;">
                        <span class="btn btn-light image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${item._id}" data-chat-id="${chatId}" onclick="toggleImageFavorite(this)">
                            <i class="bi ${isLiked ? 'bi-heart-fill text-danger' : 'bi-heart'}" style="cursor: pointer;"></i>
                        </span>
                    </div>
                    ${isAdmin ? `
                        <div class="card-body p-2 row mx-0 px-0 align-items-center justify-content-between">
                            <button class="btn btn-light col-6 image-nsfw-toggle ${item?.nsfw ? 'nsfw' : 'sfw'}" 
                                data-id="${item._id}" onclick="toggleImageNSFW(this)">
                                <i class="bi ${item?.nsfw ? 'bi-eye-slash-fill' : 'bi-eye-fill'}"></i>
                            </button>
                            ${type === 'chat' ? `
                                <button class="btn btn-light col-6 update-chat-image" onclick="updateChatImage(this)" data-id="${chatId}" data-img="${item.imageUrl}" style="cursor: pointer; opacity:0.8;">
                                    <i class="bi bi-image"></i>
                                </button>
                            ` : ''}
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
function setupInfiniteScroll(id, isModal = false, type = 'chat') {
    const manager = window.chatImageManager;
    const scrollKey = `${id}_${isModal ? 'modal' : 'page'}_${type}`;
    
    // Prevent duplicate scroll handlers
    if (manager.initialized.has(scrollKey)) {
        return;
    }
    
    const scrollContainer = isModal ? $('#characterModal .modal-body') : $(window);
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
        
        const loadFunction = type === 'chat' ? loadChatImages : loadUserImages;
        loadFunction(id, nextPage, false, isModal)
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
function showLoadingIndicator(show, type = 'chat') {
    const controlsSelector = type === 'chat' ? '#chat-images-pagination-controls' : '#images-pagination-controls';
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

function refreshImageToolsState(imageData, chatId) {
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
            refreshImageToolsState(imageData, chatId);

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