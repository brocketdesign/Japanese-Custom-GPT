/**
 * Character Profile UI
 * Handles rendering and display of character profile UI elements
 */

/**
 * Display images in the grid
 */
function displayImagesInGrid(images = []) {    
    const grid = document.getElementById('imagesGrid');
    
    if (!grid) {
        console.log('[displayImagesInGrid] No grid element found');
        return;
    }
    
    // LOG: Check initial state
    console.log(`[displayImagesInGrid] START - images length: ${images.length}`);
    
    if (images.length === 0) {
        console.log(`[displayImagesInGrid] No images to display`);
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
    
    let nsfwCount = 0;
    let blurredCount = 0;
    let displayedCount = 0;
    
    images.forEach((image, index) => {
        let imgSrc = image.imageUrl;
        let isLiked = image.isLiked || false;
        let isNSFW = image.nsfw || false;
        
        if (isNSFW) {
            nsfwCount++;
            console.log(`[displayImagesInGrid] NSFW image found - ID: ${image._id}, subscription: ${subscriptionStatus}`);
        }
        
        // Determine if this image should be blurred
        const shouldBlur = isNSFW && (isTemporary || !subscriptionStatus);
        
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
        
        if (shouldBlur) {
            // Show blurred image with overlay for NSFW content
            item.innerHTML = `
                <div style="position: relative; cursor: pointer; overflow: hidden; border-radius: 8px;">
                    <img src="${imgSrc}" alt="Image ${index + 1}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; filter: blur(8px);" onerror="this.style.display='none'">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                        <i class="bi bi-exclamation-triangle" style="font-size: 2rem; color: #dc2626; margin-bottom: 8px;"></i>
                        <span style="color: white; font-weight: 600; font-size: 0.9rem;">NSFW Content</span>
                        <button onclick="event.stopPropagation(); ${isTemporary ? 'openLoginForm()' : 'loadPlanPage()'}" style="margin-top: 8px; padding: 6px 12px; background: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">
                            ${isTemporary ? 'Login to View' : 'Subscribe to View'}
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Show normal image with like button
            item.innerHTML = `
                <img src="${imgSrc}" alt="Image ${index + 1}" loading="lazy" onerror="this.style.display='none'">
                <div class="media-item-actions">
                    <button class="media-action-btn image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${image._id}" 
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
        
        // LOG: Summary
        console.log(`[displayImagesInGrid] SUMMARY - NSFW: ${nsfwCount}, Blurred: ${blurredCount}, Displayed: ${displayedCount}, Total: ${images.length}`);
    }
}


/**
 * Display additional images in the grid (append mode, not replace)
 */
function displayMoreImagesInGrid(images = []) {
    const grid = document.getElementById('imagesGrid');
    
    if (!grid || images.length === 0) {
        console.log('[displayMoreImagesInGrid] No grid or images provided');
        return;
    }
    
    console.log(`[displayMoreImagesInGrid] Appending ${images.length} images to grid`);
    
    const currentUser = window.user || {};
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    
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
        
        let imgSrc = image.imageUrl;
        let isLiked = image.isLiked || false;
        let isNSFW = image.nsfw || false;
        
        // Determine if this image should be blurred
        const shouldBlur = isNSFW && (isTemporary || !subscriptionStatus);
        
        if (!imgSrc) {
            return;
        }
        
        const item = document.createElement('div');
        item.className = 'media-item';  // ◄─── Use SAME class as displayImagesInGrid
        item.dataset.imageId = image._id;
        
        if (shouldBlur) {
            // Show blurred image with overlay for NSFW content
            item.innerHTML = `
                <div style="position: relative; cursor: pointer; overflow: hidden; border-radius: 8px;">
                    <img src="${imgSrc}" alt="Image" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; filter: blur(8px);" onerror="this.style.display='none'">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                        <i class="bi bi-exclamation-triangle" style="font-size: 2rem; color: #dc2626; margin-bottom: 8px;"></i>
                        <span style="color: white; font-weight: 600; font-size: 0.9rem;">NSFW Content</span>
                        <button onclick="event.stopPropagation(); ${isTemporary ? 'openLoginForm()' : 'loadPlanPage()'}" style="margin-top: 8px; padding: 6px 12px; background: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">
                            ${isTemporary ? 'Login to View' : 'Subscribe to View'}
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Show normal image with like button (SAME as displayImagesInGrid)
            item.innerHTML = `
                <img src="${imgSrc}" alt="Image" loading="lazy" onerror="this.style.display='none'">
                <div class="media-item-actions">
                    <button class="media-action-btn image-fav ${isLiked ? 'liked' : ''}" 
                            data-id="${image._id}" 
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
            <i class="bi bi-play-circle" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i>
            No videos available
        </div>`;
        return;
    }
    
    grid.innerHTML = '';
    
    // Get user info for NSFW filtering
    const currentUser = window.user || {};
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    
    let nsfwCount = 0;
    let blurredCount = 0;
    let displayedCount = 0;
    
    videos.forEach((video, index) => {
        let videoSrc = video.videoUrl;
        let isNSFW = video.nsfw || false;
        
        if (isNSFW) {
            nsfwCount++;
        }
        
        // Determine if this video should be blurred
        const shouldBlur = isNSFW && (isTemporary || !subscriptionStatus);
        
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
        
        if (shouldBlur) {
            // Show blurred video with overlay for NSFW content
            item.innerHTML = `
                <div style="position: relative; cursor: pointer; overflow: hidden; border-radius: 8px; background: #000;">
                    <video preload="metadata" muted style="width: 100%; height: 100%; object-fit: cover; filter: blur(8px);">
                        <source src="${videoSrc}" type="video/mp4">
                    </video>
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
                        <i class="bi bi-exclamation-triangle" style="font-size: 2rem; color: #dc2626; margin-bottom: 8px;"></i>
                        <span style="color: white; font-weight: 600; font-size: 0.9rem;">NSFW Content</span>
                        <button onclick="event.stopPropagation(); ${isTemporary ? 'openLoginForm()' : 'loadPlanPage()'}" style="margin-top: 8px; padding: 6px 12px; background: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">
                            ${isTemporary ? 'Login to View' : 'Subscribe to View'}
                        </button>
                    </div>
                </div>
            `;
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
                        <i class="bi bi-play-circle" style="margin-right: 4px;"></i>
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
            
            // Add click handler for video playback
            item.addEventListener('click', function(e) {
                playVideoModal(videoSrc);
            });
        }
        
        grid.appendChild(item);
    });
    
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
 * Display similar characters
 */
function displaySimilarCharacters(characters) {
    const grid = document.getElementById('similarCharactersGrid');
    
    if (!characters || characters.length === 0) {
        if (grid) {
            grid.innerHTML = '';
        }
        return;
    }
    
    if (!grid) return;
    
    grid.innerHTML = '';
    characters.slice(0, 6).forEach(char => {
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
