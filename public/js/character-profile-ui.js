/**
 * Character Profile UI
 * Handles rendering and display of character profile UI elements
 */

/**
 * Fetch blurred image from API (converts to blob for security)
 */
function fetchBlurredImageForCharacter(imgElement, imageUrl) {
    $.ajax({
        url: '/blur-image?url=' + encodeURIComponent(imageUrl),
        method: 'GET',
        xhrFields: {
            withCredentials: true
        },
        xhrFields: { responseType: 'blob' },
        success: function(blob) { 
            handleImageSuccessForCharacter(imgElement, blob, imageUrl); 
        },
        error: function() { 
            console.error("Failed to load blurred image for character profile."); 
        }
    });
}

/**
 * Handle blurred image success - creates object URL and overlay
 */
function handleImageSuccessForCharacter(imgElement, blob, imageUrl) {
    let objectUrl = URL.createObjectURL(blob);
    $(imgElement).attr('src', objectUrl)
        .data('processed', "true")
        .removeAttr('data-original-src')
        .removeAttr('data-src')
        .removeAttr('srcset');
    createCharacterImageOverlay(imgElement, imageUrl);
}

/**
 * Fetch blurred video preview from API (converts to blob for security)
 * Uses videoId to retrieve the associated image and blur it
 */
function fetchBlurredVideoPreview(imgElement, videoId) {
    $.ajax({
        url: '/blur-video-preview?videoId=' + encodeURIComponent(videoId),
        method: 'GET',
        xhrFields: {
            withCredentials: true,
            responseType: 'blob'
        },
        success: function(blob) { 
            handleVideoPreviewSuccessForCharacter(imgElement, blob, videoId); 
        },
        error: function() { 
            console.error("Failed to load blurred video preview for character profile."); 
        }
    });
}

/**
 * Handle blurred video preview success - creates object URL
 */
function handleVideoPreviewSuccessForCharacter(imgElement, blob, videoId) {
    let objectUrl = URL.createObjectURL(blob);
    $(imgElement).attr('src', objectUrl)
        .data('processed', "true")
        .removeAttr('data-original-src')
        .removeAttr('data-src')
        .removeAttr('srcset');
}

/**
 * Create overlay with unlock button for NSFW images
 * Same logic as createOverlay in dashboard.js
 */
function createCharacterImageOverlay(imgElement, imageUrl) {
    let overlay;
    const isTemporary = !!window.user?.isTemporary;
    const subscriptionStatus = window.user?.subscriptionStatus === 'active';
    const showNSFW = sessionStorage.getItem('showNSFW') === 'true';
    
    // Check if overlay already exists
    if ($(imgElement).next('.character-nsfw-overlay').length) {
        $(imgElement).next('.character-nsfw-overlay').remove();
    }
    
    // No overlay needed if NSFW content should be shown
    if (showNSFW) {
        return;
    }
    
    if (isTemporary) {
        // Temporary user - show small lock overlay
        overlay = $('<div></div>')
            .addClass('character-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center animate__animated animate__fadeIn')
            .css({
                background: 'rgba(0, 0, 0, 0.2)',
                zIndex: 10,
                cursor: 'pointer',
                borderRadius: '0'
            })
            .on('click', function() {
                openLoginForm();
            });

        const lockIcon = $('<i></i>').addClass('bi bi-lock-fill').css({ 
            'font-size': '1.25rem', 
            'color': '#fff', 
            'opacity': '0.85'
        });

        overlay.append(lockIcon);

    } else if (subscriptionStatus) {
        // Subscribed user with showNSFW disabled - show small lock overlay
        overlay = $('<div></div>')
            .addClass('character-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center animate__animated animate__fadeIn')
            .css({
                background: 'rgba(0, 0, 0, 0.2)',
                zIndex: 10,
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                cursor: 'pointer',
                borderRadius: '0'
            })
            .on('click', function() {
                // Hide the overlay to reveal the image
                $(this).fadeOut(200, function() {
                    $(this).remove();
                });
            });

        const lockIcon = $('<i></i>').addClass('bi bi-lock-fill').css({ 
            'font-size': '1.25rem', 
            'color': '#fff', 
            'opacity': '0.85'
        });

        overlay.append(lockIcon);

    } else {
        // Non-subscribed user - show small lock overlay
        overlay = $('<div></div>')
            .addClass('character-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center animate__animated animate__fadeIn')
            .css({
                background: 'rgba(0, 0, 0, 0.2)',
                zIndex: 10,
                cursor: 'pointer',
                borderRadius: '0'
            })
            .on('click', function() {
                loadPlanPage();
            });

        const lockIcon = $('<i></i>').addClass('bi bi-lock-fill').css({ 
            'font-size': '1.25rem', 
            'color': '#fff', 
            'opacity': '0.85'
        });

        overlay.append(lockIcon);
    }

    $(imgElement)
        .wrap('<div style="position: relative;"></div>')
        .after(overlay);
}

/**
 * Create overlay with unlock button for NSFW videos (premium users with NSFW OFF)
 * Similar to createCharacterImageOverlay but for video elements
 */
function createCharacterVideoOverlay(videoElement, videoSrc) {
    let overlay;
    const subscriptionStatus = window.user?.subscriptionStatus === 'active';
    const showNSFW = sessionStorage.getItem('showNSFW') === 'true';
    
    // Check if overlay already exists
    const mediaItem = videoElement.closest('.media-item');
    if (mediaItem && mediaItem.querySelector('.character-nsfw-overlay')) {
        mediaItem.querySelector('.character-nsfw-overlay').remove();
    }
    
    // No overlay needed if NSFW content should be shown
    if (showNSFW) {
        return;
    }
    
    if (subscriptionStatus) {
        // Subscribed user with showNSFW disabled - show blurry overlay on top of visible video
        overlay = $('<div></div>')
            .addClass('character-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center animate__animated animate__fadeIn')
            .css({
                background: 'rgba(0, 0, 0, 0.25)',
                zIndex: 10,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                cursor: 'pointer'
            });

        let buttonElement = $('<button></button>')
            .addClass('btn btn-sm')
            .css({
                'background': 'linear-gradient(90.9deg, #D2B8FF 2.74%, #8240FF 102.92%)',
                'color': 'white',
                'border': 'none',
                'border-radius': '8px',
                'font-weight': '600',
                'padding': '0.5rem 1rem',
                'font-size': '0.85rem',
                'cursor': 'pointer',
                'transition': 'all 0.2s ease',
                'margin-top': '0.75rem',
                'z-index': 20
            })
            .text(window.translations?.showContent || 'Show Content')
            .on('click', function (e) {
                e.stopPropagation();
                
                // Hide the overlay to reveal the video
                overlay.fadeOut(300, function() {
                    overlay.remove();
                });
            })
            .on('mouseenter', function() {
                $(this).css({ 
                    'transform': 'translateY(-2px)', 
                    'box-shadow': '0 8px 16px rgba(130, 64, 255, 0.3)' 
                });
            })
            .on('mouseleave', function() {
                $(this).css({ 
                    'transform': 'translateY(0)', 
                    'box-shadow': 'none' 
                });
            });

        overlay.append(buttonElement);
        
        // Add click handler to overlay background to also trigger video reveal
        overlay.on('click', function(e) {
            // Only trigger if clicking on overlay itself, not the button
            if (e.target === this || $(e.target).closest('button').length === 0) {
                buttonElement.click();
            }
        });
    }
    
    if (overlay && videoElement) {
        $(videoElement)
            .wrap('<div style="position: relative; display: inline-block;"></div>')
            .after(overlay);
    }
}

/**
 * Create NSFW overlay for videos (non-premium users or temporary users)
 * Shows unlock/login button and prevents video playback
 */
function createCharacterVideoNSFWOverlay(videoElement, videoSrc) {
    let overlay;
    const isTemporary = !!window.user?.isTemporary;
    const subscriptionStatus = window.user?.subscriptionStatus === 'active';
    
    // Check if overlay already exists
    const mediaItem = videoElement.closest('.media-item');
    if (mediaItem && mediaItem.querySelector('.character-nsfw-overlay')) {
        mediaItem.querySelector('.character-nsfw-overlay').remove();
    }
    
    if (isTemporary) {
        // Temporary user - show login overlay with modern design
        overlay = $('<div></div>')
            .addClass('character-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center animate__animated animate__fadeIn')
            .css({
                background: 'rgba(0, 0, 0, 0.25)',
                zIndex: 10,
                cursor: 'pointer'
            })
            .on('click', function() {
                openLoginForm();
            });

        const lockIcon = $('<i></i>').addClass('bi bi-lock-fill').css({ 
            'font-size': '2rem', 
            'color': '#fff', 
            'opacity': '0.9', 
            'margin-bottom': '0.75rem' 
        });
        
        const loginButton = $('<button></button>')
            .addClass('btn btn-sm')
            .css({
                'background': 'linear-gradient(90.9deg, #D2B8FF 2.74%, #8240FF 102.92%)',
                'color': 'white',
                'border': 'none',
                'border-radius': '8px',
                'font-weight': '600',
                'padding': '0.5rem 1rem',
                'font-size': '0.85rem',
                'cursor': 'pointer',
                'transition': 'all 0.2s ease',
                'z-index': 20
            })
            .html('<i class="bi bi-unlock-fill me-2"></i>Unlock')
            .on('click', function(e) {
                e.stopPropagation();
                openLoginForm();
            });

        overlay.append(lockIcon, loginButton);

    } else if (!subscriptionStatus) {
        // Non-subscribed user - show unlock overlay with modern design
        overlay = $('<div></div>')
            .addClass('character-nsfw-overlay position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center animate__animated animate__fadeIn')
            .css({
                background: 'rgba(0, 0, 0, 0.25)',
                zIndex: 10,
                cursor: 'pointer'
            })
            .on('click', function() {
                loadPlanPage();
            });

        let buttonElement = $('<button></button>')
            .addClass('btn btn-sm')
            .css({
                'background': 'linear-gradient(90.9deg, #D2B8FF 2.74%, #8240FF 102.92%)',
                'color': 'white',
                'border': 'none',
                'border-radius': '8px',
                'font-weight': '600',
                'padding': '0.5rem 1rem',
                'font-size': '0.85rem',
                'cursor': 'pointer',
                'transition': 'all 0.2s ease',
                'margin-top': '0.75rem',
                'z-index': 20
            })
            .html('<i class="bi bi-lock-fill me-2"></i>' + (window.translations?.blurButton || 'Unlock Content'))
            .on('click', function (e) {
                e.stopPropagation();
                loadPlanPage();
            })
            .on('mouseenter', function() {
                $(this).css({ 
                    'transform': 'translateY(-2px)', 
                    'box-shadow': '0 8px 16px rgba(130, 64, 255, 0.3)' 
                });
            })
            .on('mouseleave', function() {
                $(this).css({ 
                    'transform': 'translateY(0)', 
                    'box-shadow': 'none' 
                });
            });

        overlay.append(buttonElement);
    }
    
    if (overlay && videoElement) {
        $(videoElement)
            .wrap('<div style="position: relative; display: inline-block;"></div>')
            .after(overlay);
    }
}

/**
 * Unlock NSFW image for character profile
 */
window.unlockCharacterImage = function(button, isTemporary) {
    if (isTemporary === 'true') {
        openLoginForm();
    } else {
        loadPlanPage();
    }
};

/**
 * Display images in the grid
 */
function displayImagesInGrid(images = [], chatId = null) {    
    const grid = document.getElementById('imagesGrid');
    
    if (!grid) {
        return;
    }
    
    // Get chatId from profile page if not provided
    if (!chatId) {
        const profilePage = document.querySelector('#characterProfilePage');
        chatId = profilePage?.dataset?.chatId;
    }
    
    if (images.length === 0) {
        grid.innerHTML = `<div style="padding: 60px 20px; text-align: center; color: #999; grid-column: 1/-1; font-size: 0.95rem;">
            <i class="bi bi-image" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i>
            No images available
        </div>`;
        return;
    }
    
    grid.innerHTML = '';
    
    // Get user info for NSFW filtering
    const currentUser = window.user || {};
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    const showNSFW = sessionStorage.getItem('showNSFW') === 'true';
    
    let nsfwCount = 0;
    let blurredCount = 0;
    let displayedCount = 0;
    
    images.forEach((image, index) => {
        // Use thumbnail for grid display if available, fallback to full imageUrl
        let imgSrc = image.thumbnailUrl || image.imageUrl;
        // Keep the full URL for preview/modal
        let fullImgSrc = image.imageUrl;
        let isLiked = image.isLiked || false;
        let isNSFW = image.nsfw || false;
        
        if (isNSFW) {
            nsfwCount++;
        }
        
        // Match dashboard logic: shouldBlurNSFW
        // Logic: 
        // - If NOT NSFW, don't blur
        // - If NSFW AND subscribed: blur only if showNSFW is false
        // - If NSFW AND NOT subscribed: always blur
        let shouldBlur = false;
        if (isNSFW) {
            if (subscriptionStatus) {
                shouldBlur = !showNSFW; // Blur if showNSFW is false
            } else {
                shouldBlur = true; // Always blur if not subscribed
            }
        }
        
        if (shouldBlur) {
            blurredCount++;
        } else {
            displayedCount++;
        }
        
        if (!imgSrc) {
            const existingGallery = document.getElementById('chat-images-gallery');
            if (existingGallery) {
                const existingImage = Array.from(existingGallery.querySelectorAll('[data-image-id]'))
                    .find(el => el.getAttribute('data-image-id') === image._id);
                if (existingImage && existingImage.querySelector('img')) {
                    imgSrc = existingImage.querySelector('img').src;
                }
            }
        }
        
        if (!imgSrc) {
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'media-item';
        item.dataset.imageId = image._id;
        
        // For premium users with NSFW OFF: show normal image with blur overlay
        // For non-premium users: show placeholder and load blurred image via API
        if (shouldBlur && subscriptionStatus) {
            // Premium user with NSFW OFF - show normal image with overlay that will add blur effect
            item.innerHTML = `
                <img src="${imgSrc}" data-full-url="${fullImgSrc}" alt="Image ${index + 1}" loading="lazy" onerror="this.style.display='none'" 
                     style="width: 100%; height: 100%; object-fit: cover;">
                <div class="media-item-actions">
                    <button class="media-action-btn image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${image._id}" 
                            ${chatId ? `data-chat-id="${chatId}"` : ''}
                            title="Like">
                        <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    </button>
                </div>
                <div class="media-item-overlay">
                    <div class="media-item-info">
                        <i class="bi bi-images" style="margin-right: 4px;"></i>
                        ${index + 1}
                    </div>
                </div>
            `;
            
            // Add event listener for like button
            const likeBtn = item.querySelector('.image-fav');
            if (likeBtn) {
                likeBtn.addEventListener('click', toggleImageLike);
            }
            
            // Store image data on the media-item element for later retrieval
            item.dataset.image = JSON.stringify(image);
            
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');
            
        } else if (shouldBlur) {
            // Non-premium user or temporary - show placeholder and load blurred image via API
            item.innerHTML = `
                <div style="position: relative; cursor: pointer; overflow: hidden; background: #f0f0f0;">
                    <img alt="Image ${index + 1}" loading="lazy" 
                         class="blur-image-character" 
                         data-src="${imgSrc}"
                         data-full-url="${fullImgSrc}"
                         style="width: 100%; height: 100%; object-fit: cover;" 
                         onerror="this.style.display='none'">
                </div>
            `;
        } else {
            // Show normal image with like button
            item.innerHTML = `
                <img src="${imgSrc}" data-full-url="${fullImgSrc}" alt="Image ${index + 1}" loading="lazy" onerror="this.style.display='none'">
                <div class="media-item-actions">
                    <button class="media-action-btn image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${image._id}" 
                            ${chatId ? `data-chat-id="${chatId}"` : ''}
                            title="Like">
                        <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    </button>
                </div>
                <div class="media-item-overlay">
                    <div class="media-item-info">
                        <i class="bi bi-images" style="margin-right: 4px;"></i>
                        ${index + 1}
                    </div>
                </div>
            `;
            
            // Add event listener for like button
            const likeBtn = item.querySelector('.image-fav');
            if (likeBtn) {
                likeBtn.addEventListener('click', toggleImageLike);
            }
            
            // Store image data on the media-item element for later retrieval
            item.dataset.image = JSON.stringify(image);
            
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');
        }
        
        grid.appendChild(item);
        
        // Apply overlay or blur effect based on user status
        if (shouldBlur) {
            if (subscriptionStatus) {
                // Premium user with NSFW OFF - add overlay with blur effect on the normal image
                const imgElement = item.querySelector('img');
                if (imgElement) {
                    createCharacterImageOverlay(imgElement, imgSrc);
                }
            } else {
                // Non-premium user - fetch blurred image via API
                const imgElement = item.querySelector('.blur-image-character');
                if (imgElement && imgElement.dataset.src) {
                    fetchBlurredImageForCharacter(imgElement, imgElement.dataset.src);
                }
            }
        }
    });
    
    // VERIFY grid was populated
    const imagesInGrid = grid.querySelectorAll('.media-item');
    
    // Count img elements
    const imgElements = grid.querySelectorAll('img');
    
    // 🔴 CRITICAL: Add/update event delegation for media-item clicks
    // This catches ALL clicks on media items, even NSFW overlays
    
    // Add delegated click handler WITHOUT cloning grid (which removes the load more button)
    const newGridListener = function(e) {
        // Find the closest media-item container
        const mediaItem = e.target.closest('.media-item');
        
        if (mediaItem) {
            // Check if click was on a button (like button or subscribe button) - if so, don't open modal
            const clickedButton = e.target.closest('button');
            if (clickedButton) {
                return;
            }
            
            // Check if it's an NSFW item (if so, it might have a subscribe button)
            const nsfw_overlay = mediaItem.querySelector('[style*="rgba(0,0,0,0.6)"]');
            if (nsfw_overlay && e.target.closest('button')) {
                return;
            }
            
            // Get the stored image data from the media-item element
            if (mediaItem.dataset.image) {
                try {
                    const imageData = JSON.parse(mediaItem.dataset.image);
                    
                    if (typeof displayImageModal === 'function') {
                        displayImageModal(imageData);
                    }
                } catch (err) {
                    // ignore parse errors
                }
            }
        }
    };
    
    // Remove previous listener if exists
    if (grid._clickListener) {
        grid.removeEventListener('click', grid._clickListener);
    }
    // Store and add new listener
    grid._clickListener = newGridListener;
    grid.addEventListener('click', newGridListener);
    
    // Add load more button if on character profile page and more content available
    const onCharacterPage = !!document.querySelector('#characterProfilePage');
    if (onCharacterPage) {
        const currentPage = window.characterProfile.imagesCurrentPage || 1;
        const totalPages = window.characterProfile.imagesTotalPages || 1;
        
        // Always add button back (grid was cleared)
        addLoadMoreButton('images');
        
        // Hide button only if we have actual page info AND no more pages
        // If totalPages is still 0 (not yet fetched), keep button visible
        if (totalPages > 0 && currentPage >= totalPages) {
            hideLoadMoreButton('images');
        } else if (totalPages === 0) {
            showLoadMoreButton('images');
        } else {
            showLoadMoreButton('images');
        }
        
    }
}


/**
 * Display additional images in the grid (append mode, not replace)
 */
function displayMoreImagesInGrid(images = [], chatId = null) {
    const grid = document.getElementById('imagesGrid');
    
    if (!grid || images.length === 0) {
        console.log('[displayMoreImagesInGrid] No grid or images provided');
        return;
    }
    
    // Get chatId from profile page if not provided
    if (!chatId) {
        const profilePage = document.querySelector('#characterProfilePage');
        chatId = profilePage?.dataset?.chatId;
    }
    
    console.log(`[displayMoreImagesInGrid] Appending ${images.length} images to grid`);
    
    const currentUser = window.user || {};
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    const showNSFW = sessionStorage.getItem('showNSFW') === 'true';
    
    // Get current count of media items in grid (to continue numbering)
    const existingMediaItems = grid.querySelectorAll('.media-item').length;
    let imageIndexCounter = existingMediaItems + 1;
    
    images.forEach((image) => {
        // Skip if already displayed
        const existingCard = grid.querySelector(`[data-image-id="${image._id}"]`);
        if (existingCard) {
            console.log(`[displayMoreImagesInGrid] Skipping duplicate image ${image._id}`);
            return;
        }
        
        // Use thumbnail for grid display if available, fallback to full imageUrl
        let imgSrc = image.thumbnailUrl || image.imageUrl;
        // Keep the full URL for preview/modal
        let fullImgSrc = image.imageUrl;
        let isLiked = image.isLiked || false;
        let isNSFW = image.nsfw || false;
        
        // Determine if this image should be blurred
        // Blur if: NSFW AND (user is temporary OR user is not subscribed OR user disabled NSFW viewing)
        const shouldBlur = isNSFW && (isTemporary || !subscriptionStatus || !showNSFW);
        
        if (!imgSrc) {
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'media-item';  // ◄─── Use SAME class as displayImagesInGrid
        item.dataset.imageId = image._id;
        
        if (shouldBlur && subscriptionStatus) {
            // Premium user with NSFW OFF - show normal image with overlay that will add blur effect
            item.innerHTML = `
                <img src="${imgSrc}" data-full-url="${fullImgSrc}" alt="Image" loading="lazy" onerror="this.style.display='none'"
                     style="width: 100%; height: 100%; object-fit: cover;">
                <div class="media-item-actions">
                    <button class="media-action-btn image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${image._id}" 
                            ${chatId ? `data-chat-id="${chatId}"` : ''}
                            title="Like">
                        <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    </button>
                </div>
                <div class="media-item-overlay">
                    <div class="media-item-info">
                        <i class="bi bi-images" style="margin-right: 4px;"></i>
                        ${imageIndexCounter}
                    </div>
                </div>
            `;
            
            // Increment counter for next image
            imageIndexCounter++;
            
            // Add event listener for like button
            const likeBtn = item.querySelector('.image-fav');
            if (likeBtn) {
                likeBtn.addEventListener('click', toggleImageLike);
            }
            
            // Store image data on the media-item element for later retrieval
            item.dataset.image = JSON.stringify(image);
            
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');
            
        } else if (shouldBlur) {
            // Non-premium user or temporary - show placeholder and load blurred image via API
            item.innerHTML = `
                <div style="position: relative; cursor: pointer; overflow: hidden; background: #f0f0f0;">
                    <img alt="Image" loading="lazy" 
                         class="blur-image-character" 
                         data-src="${imgSrc}"
                         data-full-url="${fullImgSrc}"
                         style="width: 100%; height: 100%; object-fit: cover;" 
                         onerror="this.style.display='none'">
                </div>
            `;
        } else {
            // Show normal image with like button (SAME as displayImagesInGrid)
            item.innerHTML = `
                <img src="${imgSrc}" data-full-url="${fullImgSrc}" alt="Image" loading="lazy" onerror="this.style.display='none'">
                <div class="media-item-actions">
                    <button class="media-action-btn image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${image._id}" 
                            ${chatId ? `data-chat-id="${chatId}"` : ''}
                            title="Like">
                        <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}"></i>
                    </button>
                </div>
                <div class="media-item-overlay">
                    <div class="media-item-info">
                        <i class="bi bi-images" style="margin-right: 4px;"></i>
                        ${imageIndexCounter}
                    </div>
                </div>
            `;
            
            // Increment counter for next image
            imageIndexCounter++;
            
            // Add event listener for like button
            const likeBtn = item.querySelector('.image-fav');
            if (likeBtn) {
                likeBtn.addEventListener('click', toggleImageLike);
            }
            
            // Store image data on the media-item element for later retrieval
            item.dataset.image = JSON.stringify(image);
            
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');
        }
        
        grid.appendChild(item);
        
        // Apply overlay or blur effect based on user status
        if (shouldBlur) {
            if (subscriptionStatus) {
                // Premium user with NSFW OFF - add overlay with blur effect on the normal image
                const imgElement = item.querySelector('img');
                if (imgElement) {
                    createCharacterImageOverlay(imgElement, imgSrc);
                }
            } else {
                // Non-premium user - fetch blurred image via API
                const imgElement = item.querySelector('.blur-image-character');
                if (imgElement && imgElement.dataset.src) {
                    fetchBlurredImageForCharacter(imgElement, imgElement.dataset.src);
                }
            }
        }
    });
    
    // Re-attach click delegation handler (since we added new items)
    const newGridListener = function(e) {
        const mediaItem = e.target.closest('.media-item');
        
        if (mediaItem) {
            const clickedButton = e.target.closest('button');
            if (clickedButton) {
                return;
            }
            
            const nsfw_overlay = mediaItem.querySelector('[style*="rgba(0,0,0,0.6)"]');
            if (nsfw_overlay && e.target.closest('button')) {
                return;
            }
            
            if (mediaItem.dataset.image) {
                try {
                    const imageData = JSON.parse(mediaItem.dataset.image);
                    
                    if (typeof displayImageModal === 'function') {
                        displayImageModal(imageData);
                    }
                } catch (err) {
                    // ignore parse errors
                }
            }
        }
    };
    
    // Remove previous listener if exists
    if (grid._clickListener) {
        grid.removeEventListener('click', grid._clickListener);
    }
    // Store and add new listener
    grid._clickListener = newGridListener;
    grid.addEventListener('click', newGridListener);
    
    console.log(`[displayMoreImagesInGrid] Added ${images.length} images to grid, continuing from index ${existingMediaItems + 1}`);
}

/**
 * Display videos in the grid
 */
function displayVideosInGrid() {
    let videos = window.loadedVideos || [];
    
    const grid = document.getElementById('videosGrid');
    
    if (!grid) {
        return;
    }
    
    // Fallback: try to get from hidden gallery element
    if (videos.length === 0) {
        const existingGallery = document.getElementById('chat-videos-gallery');
        if (existingGallery) {
            const galleryItems = existingGallery.querySelectorAll('.video-card');
            videos = Array.from(galleryItems).map((el, idx) => ({
                _id: el.getAttribute('data-video-id'),
                videoUrl: el.querySelector('video')?.src || el.getAttribute('data-src'),
                index: idx
            }));
        }
    }
    
    if (videos.length === 0) {
        grid.innerHTML = `<div style="padding: 60px 20px; text-align: center; color: #999; grid-column: 1/-1; font-size: 0.95rem;">
            <i class="bi bi-film" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i>
            No videos available
        </div>`;
        return;
    }
    
    grid.innerHTML = '';
    
    // Get user info for NSFW filtering
    const currentUser = window.user || {};
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    const showNSFW = sessionStorage.getItem('showNSFW') === 'true';
    
    let nsfwCount = 0;
    let blurredCount = 0;
    let displayedCount = 0;
    
    videos.forEach((video, index) => {
        let videoSrc = video.videoUrl;
        let isNSFW = video.nsfw || false;
        
        if (isNSFW) {
            nsfwCount++;
        }
        
        // Match dashboard logic: shouldBlurNSFW
        // Logic: 
        // - If NOT NSFW, don't blur
        // - If NSFW AND subscribed: blur only if showNSFW is false
        // - If NSFW AND NOT subscribed: always blur
        let shouldBlur = false;
        if (isNSFW) {
            if (subscriptionStatus) {
                shouldBlur = !showNSFW; // Blur if showNSFW is false
            } else {
                shouldBlur = true; // Always blur if not subscribed
            }
        }
        
        if (shouldBlur) {
            blurredCount++;
        } else {
            displayedCount++;
        }
        
        if (!videoSrc) {
            const existingGallery = document.getElementById('chat-videos-gallery');
            if (existingGallery) {
                const videoElement = existingGallery.querySelector(`[data-video-id="${video._id}"]`);
                if (videoElement) {
                    videoSrc = videoElement.querySelector('video')?.src || videoElement.getAttribute('data-src');
                }
            }
        }
        
        if (!videoSrc) {
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'media-item';
        item.dataset.videoId = video._id;
        
        // For premium users with NSFW OFF: show normal video with blur overlay
        // For non-premium users: show video with NSFW overlay
        if (shouldBlur && subscriptionStatus) {
            // Premium user with NSFW OFF - show normal video with overlay that will add blur effect
            item.innerHTML = `
                <video preload="metadata" muted style="width: 100%; height: 100%; object-fit: cover; background: #000;">
                    <source src="${videoSrc}" type="video/mp4">
                </video>
                <div class="video-indicator" style="pointer-events: none;">
                    <i class="bi bi-play-fill" style="font-size: 1rem;"></i>
                </div>
                <div class="media-item-overlay">
                    <div class="media-item-info">
                        <i class="bi bi-film" style="margin-right: 4px;"></i>
                        ${index + 1}
                    </div>
                </div>
            `;
            
            // Extract poster frame from video for thumbnail
            const videoElement = item.querySelector('video');
            videoElement.addEventListener('loadedmetadata', function() {
                this.currentTime = 0.5;
            });
            
            videoElement.addEventListener('seeked', function() {
                const canvas = document.createElement('canvas');
                canvas.width = this.videoWidth;
                canvas.height = this.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this, 0, 0);
                const posterUrl = canvas.toDataURL('image/jpeg');
                this.poster = posterUrl;
            }, { once: true });
            
            // Store video data on the media-item element for later retrieval
            item.dataset.video = JSON.stringify(video);
            
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');
            
        } else if (shouldBlur) {
            // Non-premium user or temporary - show placeholder image and load blurred preview via API
            // DO NOT expose videoUrl in DOM for security - use videoId to fetch blurred preview
            item.innerHTML = `
                <div style="position: relative; cursor: pointer; overflow: hidden; background: #f0f0f0;">
                    <img alt="Video ${index + 1}" loading="lazy" 
                         class="blur-video-preview" 
                         data-video-id="${video._id}"
                         style="width: 100%; height: 100%; object-fit: cover;" 
                         onerror="this.style.display='none'">
                    <div class="media-item-overlay">
                        <div class="media-item-info">
                            <i class="bi bi-film" style="margin-right: 4px;"></i>
                            ${index + 1}
                        </div>
                    </div>
                </div>
            `;
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');
        } else {
            // Show normal video player
            item.innerHTML = `
                <video preload="metadata" muted style="width: 100%; height: 100%; object-fit: cover; background: #000; cursor: pointer;">
                    <source src="${videoSrc}" type="video/mp4">
                </video>
                <div class="video-indicator" style="pointer-events: none;">
                    <i class="bi bi-play-fill" style="font-size: 1rem;"></i>
                </div>
                <div class="media-item-overlay">
                    <div class="media-item-info">
                        <i class="bi bi-film" style="margin-right: 4px;"></i>
                        ${index + 1}
                    </div>
                </div>
            `;
            
            // Extract poster frame from video
            const videoElement = item.querySelector('video');
            videoElement.addEventListener('loadedmetadata', function() {
                this.currentTime = 0.5;
            });
            
            videoElement.addEventListener('seeked', function() {
                const canvas = document.createElement('canvas');
                canvas.width = this.videoWidth;
                canvas.height = this.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this, 0, 0);
                const posterUrl = canvas.toDataURL('image/jpeg');
                this.poster = posterUrl;
            }, { once: true });
            
            // Store video data on the media-item element for later retrieval
            item.dataset.video = JSON.stringify(video);
            
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');

        }
        
        grid.appendChild(item);
        
        // Apply overlay or blur effect based on user status
        if (shouldBlur) {
            if (subscriptionStatus) {
                // Premium user with NSFW OFF - add overlay with blur effect on the normal video
                const videoElement = item.querySelector('video');
                if (videoElement) {
                    createCharacterVideoOverlay(videoElement, videoSrc);
                }
            } else {
                // Non-premium user or temporary - add NSFW overlay with unlock/login button
                const videoElement = item.querySelector('.blur-video-preview');
                if (videoElement) {
                    fetchBlurredVideoPreview(videoElement, video._id);
                    createCharacterVideoNSFWOverlay(videoElement, videoSrc);
                }
            }
        }
    });
    
    // Add delegated click handler for video playback
    const newGridListener = function(e) {
        const mediaItem = e.target.closest('.media-item');
        
        if (mediaItem) {
            // Check if click was on a button - if so, don't open modal
            const clickedButton = e.target.closest('button');
            if (clickedButton) {
                return;
            }
            
            // Check if it's an NSFW overlay - if so, don't open modal
            const nsfw_overlay = mediaItem.querySelector('.character-nsfw-overlay');
            if (nsfw_overlay && e.target.closest('.character-nsfw-overlay')) {
                return;
            }
            
            // Get the video data and play it
            if (mediaItem.dataset.video) {
                try {
                    const videoData = JSON.parse(mediaItem.dataset.video);
                    if (typeof playVideoModal === 'function') {
                        playVideoModal(videoData.videoUrl);
                    }
                } catch (err) {
                    // ignore parse errors
                }
            }
        }
    };
    
    // Remove previous listener if exists
    if (grid._clickListener) {
        grid.removeEventListener('click', grid._clickListener);
    }
    // Store and add new listener
    grid._clickListener = newGridListener;
    grid.addEventListener('click', newGridListener);
    
    // Add load more button if on character profile page and more content available
    const onCharacterPage = !!document.querySelector('#characterProfilePage');
    if (onCharacterPage) {
        const currentPage = window.characterProfile.videosCurrentPage || 1;
        const totalPages = window.characterProfile.videosTotalPages || 1;
        
        // Always add button back (grid was cleared)
        addLoadMoreButton('videos');
        
        // Hide button only if we have actual page info AND no more pages
        // If totalPages is still 0 (not yet fetched), keep button visible
        if (totalPages > 0 && currentPage >= totalPages) {
            hideLoadMoreButton('videos');
        } else if (totalPages === 0) {
            showLoadMoreButton('videos');
        } else {
            showLoadMoreButton('videos');
        }
    }
}

/**
 * Display similar characters with pagination support
 * @param {Array} characters - Array of character objects
 * @param {Boolean} append - Whether to append to existing characters or replace
 */
function displaySimilarCharacters(characters, append = false) {
    const grid = document.getElementById('similarCharactersGrid');
    
    if (!characters || characters.length === 0) {
        if (grid && !append) {
            grid.innerHTML = '';
        }
        return;
    }
    
    if (!grid) return;
    
    // Clear grid if not appending
    if (!append) {
        grid.innerHTML = '';
    }
    
    // Display all characters (no limit since pagination is handled by backend)
    characters.forEach(char => {
        const card = document.createElement('a');
        card.className = 'similar-card';
        card.href = `/character/${char._id}`;
        card.innerHTML = `
            <img src="${char.chatImageUrl || '/img/avatar.png'}" alt="${char.name}" class="similar-avatar">
            <div class="similar-name">${char.name}</div>
        `;
        grid.appendChild(card);
    });
}

/**
 * Generate personality HTML
 */
function generatePersonalityHTML(personality) {
    if (!personality) return '';
    
    let html = '<div class="character-personality-details mt-3">';
    
    if (personality.traits && personality.traits.length > 0) {
        html += `
            <h6>Personality Traits</h6>
            <div class="mb-3">
                ${personality.traits.map(trait => `<span class="badge bg-light text-dark me-1 mb-1">${trait}</span>`).join('')}
            </div>
        `;
    }
    
    if (personality.preferences && personality.preferences.length > 0) {
        html += `
            <h6>Preferences</h6>
            <div class="mb-3">
                ${personality.preferences.map(pref => `<span class="badge bg-light text-dark me-1 mb-1">${pref}</span>`).join('')}
            </div>
        `;
    }
    
    if (personality.story && personality.story !== 'undefined') {
        html += `
            <h6>Story</h6>
            <p class="text-muted">${personality.story}</p>
        `;
    }
    
    html += '</div>';
    return html;
}

/**
 * Update image count display on character profile page
 */
function updateCharacterImageCount(count) {
    const element = document.getElementById('imagesCount');
    if (element) {
        element.textContent = count.toLocaleString();
        element.classList.remove('count-loading');
    }
}

/**
 * Update video count display on character profile page
 */
function updateCharacterVideoCount(count) {
    const element = document.getElementById('videosCount');
    if (element) {
        element.textContent = count.toLocaleString();
        element.classList.remove('count-loading');
    }
}

/**
 * Add load more button to grid (only on character profile page)
 */
function addLoadMoreButton(type) {
    const gridId = type === 'images' ? 'imagesGrid' : 'videosGrid';
    const buttonId = type === 'images' ? 'loadMoreImagesBtn' : 'loadMoreVideosBtn';
    const grid = document.getElementById(gridId);
    
    if (!grid) return;
    
    // Check if button already exists and remove it first (since grid was cleared)
    let existingButton = document.getElementById(buttonId);
    if (existingButton) {
        existingButton.remove();
    }
    
    // Create the button container that spans full width and is centered
    const buttonContainer = document.createElement('div');
    buttonContainer.id = buttonId;
    buttonContainer.className = 'load-more-container';
    buttonContainer.style.gridColumn = '1 / -1';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.padding = '24px 12px';
    
    const btn = document.createElement('button');
    btn.className = 'load-more-btn';
    btn.id = `${buttonId}-btn`;
    btn.innerHTML = translations.loadMore + ' ' + (type === 'images' ? translations.images : translations.videos);
    btn.style.padding = '12px 32px';
    btn.style.fontSize = '0.95rem';
    btn.style.fontWeight = '600';
    btn.style.borderRadius = '28px';
    btn.style.border = 'none';
    btn.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
    btn.style.color = 'white';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'all 0.3s ease';
    btn.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.3)';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '8px';
    
    btn.addEventListener('mouseenter', function() {
        if (!window.characterProfile.imagesLoading && !window.characterProfile.videosLoading) {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 10px 30px rgba(99, 102, 241, 0.4)';
        }
    });
    
    btn.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.3)';
    });
    
    btn.addEventListener('click', function() {
        if (type === 'images') {
            loadMoreCharacterImages(window.characterProfile.currentChatId);
        } else {
            loadMoreCharacterVideos(window.characterProfile.currentChatId);
        }
    });
    
    buttonContainer.appendChild(btn);
    grid.parentNode.insertBefore(buttonContainer, grid.nextSibling);
}

/**
 * Load more videos for character profile
 */
function loadMoreCharacterVideos(chatId) {
    if (window.characterProfile.videosLoading) {
        return;
    }
    
    const nextPage = (window.characterProfile.videosCurrentPage || 1) + 1;
    
    // Check if there are more pages
    if (nextPage > window.characterProfile.videosTotalPages) {
        return;
    }
    
    if (typeof loadChatVideos === 'function') {
        window.characterProfile.videosLoading = true;
        
        // Show loading spinner on button
        if (typeof showLoadMoreButtonSpinner === 'function') {
            showLoadMoreButtonSpinner('videos');
        }
        
        // Load next page WITHOUT reload flag - this will render videos and append to grid
        loadChatVideos(chatId, nextPage, false)
            .then(() => {
                setTimeout(() => {
                    // Display the newly loaded videos in the grid
                    displayVideosInGrid();
                    // Update current page AFTER successful load
                    window.characterProfile.videosCurrentPage = nextPage;
                    // Update button visibility
                    updateLoadMoreVideoButton(chatId);
                    // Hide loading spinner
                    if (typeof hideLoadMoreButtonSpinner === 'function') {
                        hideLoadMoreButtonSpinner('videos');
                    }
                }, 300);
                
                // IMPORTANT: Reset loading flag immediately after promise resolves
                window.characterProfile.videosLoading = false;
            })
            .catch((error) => {
                // Hide loading spinner on error
                if (typeof hideLoadMoreButtonSpinner === 'function') {
                    hideLoadMoreButtonSpinner('videos');
                }
                // IMPORTANT: Always reset loading flag on error
                window.characterProfile.videosLoading = false;
            });
    }
}

/**
 * Update load more button for videos
 */
function updateLoadMoreVideoButton(chatId) {
    const currentPage = window.characterProfile.videosCurrentPage || 1;
    const totalPages = window.characterProfile.videosTotalPages || 1;
    
    // Show button only if there are more pages
    if (currentPage < totalPages) {
        showLoadMoreButton('videos');
    } else {
        hideLoadMoreButton('videos');
    }
}

/**
 * Show loading spinner on load more button
 */
function showLoadMoreButtonSpinner(type) {
    const buttonId = type === 'images' ? 'loadMoreImagesBtn-btn' : 'loadMoreVideosBtn-btn';
    const btn = document.getElementById(buttonId);
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...`;
        btn.style.cursor = 'not-allowed';
        btn.style.opacity = '0.7';
    }
}

/**
 * Hide loading spinner on load more button
 */
function hideLoadMoreButtonSpinner(type) {
    const buttonId = type === 'images' ? 'loadMoreImagesBtn-btn' : 'loadMoreVideosBtn-btn';
    const btn = document.getElementById(buttonId);
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = translations.loadMore + ' ' + (type === 'images' ? translations.images : translations.videos);
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
    }
}

/**
 * Show loading spinner for similar characters
 */
function showSimilarCharactersLoader() {
    const grid = document.getElementById('similarCharactersGrid');
    if (grid) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; display: flex; justify-content: center; align-items: center; padding: 40px 20px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
}

/**
 * Hide loading spinner for similar characters
 */
function hideSimilarCharactersLoader() {
    // Loader will be replaced when displaySimilarCharacters is called
}
