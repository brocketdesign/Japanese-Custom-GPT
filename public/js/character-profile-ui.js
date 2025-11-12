/**
 * Character Profile UI
 * Handles rendering and display of character profile UI elements
 */

/**
 * Display images in the grid
 */
function displayImagesInGrid() {
    console.log('%c[displayImagesInGrid] FUNCTION CALLED', 'background: #2196F3; color: white; padding: 5px;');
    console.log(`[displayImagesInGrid] Starting display`);
    
    let images = window.loadedImages || [];
    console.log(`[displayImagesInGrid] Initial window.loadedImages count: ${images.length}`);
    
    if (images.length > 0) {
        console.log('[displayImagesInGrid] First image:', images[0]);
    }
    
    const grid = document.getElementById('imagesGrid');
    
    if (!grid) {
        console.error(`[displayImagesInGrid] ❌ ERROR: imagesGrid element NOT found!`);
        console.log('[displayImagesInGrid] Searching for grid by other selectors:');
        console.log('- .media-grid:', document.querySelectorAll('.media-grid').length);
        console.log('- [id*="grid"]:', document.querySelectorAll('[id*="grid"]').length);
        console.log('All IDs in page:', Array.from(document.querySelectorAll('[id]')).map(el => el.id).join(', '));
        return;
    }
    
    console.log('[displayImagesInGrid] ✓ Grid element found:', grid.id);
    
    // Fallback: try to get from hidden gallery element
    if (images.length === 0) {
        console.log(`[displayImagesInGrid] No loadedImages, checking hidden gallery...`);
        const existingGallery = document.getElementById('chat-images-gallery');
        if (existingGallery) {
            const galleryItems = existingGallery.querySelectorAll('.image-card');
            console.log(`[displayImagesInGrid] Found ${galleryItems.length} image cards in hidden gallery`);
            images = Array.from(galleryItems).map((el, idx) => ({
                _id: el.getAttribute('data-image-id'),
                imageUrl: el.querySelector('img').src,
                isLiked: el.getAttribute('data-liked') === 'true',
                index: idx
            }));
        }
    }
    
    if (images.length === 0) {
        console.log(`[displayImagesInGrid] No images to display`);
        grid.innerHTML = `<div style="padding: 60px 20px; text-align: center; color: #999; grid-column: 1/-1; font-size: 0.95rem;">
            <i class="bi bi-image" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i>
            No images available
        </div>`;
        return;
    }
    
    console.log(`[displayImagesInGrid] Clearing grid and rendering ${images.length} images`);
    grid.innerHTML = '';
    
    // Get user info for NSFW filtering
    const currentUser = window.user || {};
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    
    console.log(`[displayImagesInGrid] User: subscriptionStatus=${subscriptionStatus}, isTemporary=${isTemporary}`);
    
    let nsfwCount = 0;
    let blurredCount = 0;
    let displayedCount = 0;
    
    images.forEach((image, index) => {
        console.log(`[displayImagesInGrid] Processing image ${index + 1}:`, {
            _id: image._id,
            title: image.title,
            imageUrl: image.imageUrl,
            createdAt: image.createdAt,
            nsfw: image.nsfw
        });
        
        let imgSrc = image.imageUrl;
        let isLiked = image.isLiked || false;
        let isNSFW = image.nsfw || false;
        
        if (isNSFW) {
            nsfwCount++;
        }
        
        // Determine if this image should be blurred
        const shouldBlur = isNSFW && (isTemporary || !subscriptionStatus);
        
        if (shouldBlur) {
            blurredCount++;
            console.log(`[displayImagesInGrid] Image ${image._id}: NSFW and will be blurred (isTemporary=${isTemporary}, subscriptionStatus=${subscriptionStatus})`);
        } else {
            displayedCount++;
        }
        
        if (!imgSrc) {
            const existingGallery = document.getElementById('chat-images-gallery');
            if (existingGallery) {
                const imgElement = existingGallery.querySelector(`[data-image-id="${image._id}"] img`);
                if (imgElement) {
                    imgSrc = imgElement.src;
                }
            }
        }
        
        if (!imgSrc) {
            console.warn(`[displayImagesInGrid] Image ${index} has no source URL, skipping`);
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
            console.log(`[displayImagesInGrid] Stored image data on media-item ${index + 1}`);
            
            // Make the entire media-item clickable with cursor pointer
            item.style.cursor = 'pointer';
            item.setAttribute('data-toggle', 'modal');
            item.setAttribute('role', 'button');
        }
        
        grid.appendChild(item);
    });
    
    console.log(`[displayImagesInGrid] Rendered summary - Total: ${images.length}, NSFW: ${nsfwCount}, Blurred: ${blurredCount}, Displayed: ${displayedCount}`);
    
    // VERIFY grid was populated
    const imagesInGrid = grid.querySelectorAll('.media-item');
    console.log(`[displayImagesInGrid] ✓ Grid now contains ${imagesInGrid.length} media-item elements`);
    console.log('[displayImagesInGrid] Grid HTML:', grid.innerHTML.substring(0, 200) + '...');
    
    // Count img elements
    const imgElements = grid.querySelectorAll('img');
    console.log(`[displayImagesInGrid] ✓ Found ${imgElements.length} <img> elements in grid`);
    
    if (imgElements.length > 0) {
        imgElements.forEach((img, idx) => {
            console.log(`  [${idx}] img has click listener:`, typeof img.onclick === 'function' || img._hasClickListener);
        });
    }
    
    // 🔴 CRITICAL: Add event delegation for media-item clicks
    // This catches ALL clicks on media items, even NSFW overlays
    console.log('[displayImagesInGrid] Setting up event delegation on grid for media-item clicks');
    
    // Remove any previous listeners to avoid duplicates
    const clonedGrid = grid.cloneNode(true);
    grid.parentNode.replaceChild(clonedGrid, grid);
    const newGrid = clonedGrid;
    
    // Add delegated click handler
    newGrid.addEventListener('click', function(e) {
        console.log('%c[EVENT DELEGATION] Click detected on grid', 'background: #FF6B6B; color: white; padding: 5px;');
        console.log('Clicked element:', e.target);
        console.log('Event target tag:', e.target.tagName);
        console.log('Event target classes:', e.target.className);
        
        // Find the closest media-item container
        const mediaItem = e.target.closest('.media-item');
        console.log('Closest media-item:', mediaItem);
        
        if (mediaItem) {
            // Check if click was on a button (like button or subscribe button) - if so, don't open modal
            const clickedButton = e.target.closest('button');
            if (clickedButton) {
                console.log('[EVENT DELEGATION] Click was on a button, ignoring modal open');
                return;
            }
            
            // Check if it's an NSFW item (if so, it might have a subscribe button)
            const nsfw_overlay = mediaItem.querySelector('[style*="rgba(0,0,0,0.6)"]');
            if (nsfw_overlay && e.target.closest('button')) {
                console.log('[EVENT DELEGATION] Click was on NSFW button, ignoring');
                return;
            }
            
            console.log('[EVENT DELEGATION] Opening modal for media item');
            console.log('mediaItem dataset:', mediaItem.dataset);
            
            // Get the stored image data from the media-item element
            if (mediaItem.dataset.image) {
                try {
                    const imageData = JSON.parse(mediaItem.dataset.image);
                    console.log('[EVENT DELEGATION] Parsed image data:', imageData);
                    
                    if (typeof displayImageModal === 'function') {
                        console.log('[EVENT DELEGATION] Calling displayImageModal with data');
                        displayImageModal(imageData);
                    } else {
                        console.error('[EVENT DELEGATION] displayImageModal function not found!');
                    }
                } catch (err) {
                    console.error('[EVENT DELEGATION] Failed to parse image data:', err);
                }
            } else {
                console.warn('[EVENT DELEGATION] No image data stored on media-item');
            }
        }
    });
    
    console.log('[displayImagesInGrid] Event delegation setup complete');
    
    // Add load more button if on character profile page and more content available
    const onCharacterPage = !!document.querySelector('#characterProfilePage');
    if (onCharacterPage) {
        const currentPage = window.characterProfile.imagesCurrentPage || 1;
        const totalPages = window.characterProfile.imagesTotalPages || 1;
        
        console.log(`[displayImagesInGrid] On character page - currentPage: ${currentPage}, totalPages: ${totalPages}`);
        
        // Always add button back (grid was cleared), show only if there are more pages
        addLoadMoreButton('images');
        
        // Hide or show based on whether there are more pages
        if (currentPage >= totalPages) {
            console.log(`[displayImagesInGrid] Hiding load more button (no more pages)`);
            hideLoadMoreButton('images');
        } else {
            console.log(`[displayImagesInGrid] Showing load more button`);
        }
    }
    
    console.log('%c[displayImagesInGrid] FUNCTION COMPLETE', 'background: #4CAF50; color: white; padding: 5px;');
}

/**
 * Display videos in the grid
 */
function displayVideosInGrid() {
    console.log(`[displayVideosInGrid] Starting display`);
    
    let videos = window.loadedVideos || [];
    console.log(`[displayVideosInGrid] Initial window.loadedVideos count: ${videos.length}`);
    
    const grid = document.getElementById('videosGrid');
    
    if (!grid) {
        console.error(`[displayVideosInGrid] videosGrid not found!`);
        return;
    }
    
    // Fallback: try to get from hidden gallery element
    if (videos.length === 0) {
        console.log(`[displayVideosInGrid] No loadedVideos, checking hidden gallery...`);
        const existingGallery = document.getElementById('chat-videos-gallery');
        if (existingGallery) {
            const galleryItems = existingGallery.querySelectorAll('.video-card');
            console.log(`[displayVideosInGrid] Found ${galleryItems.length} video cards in hidden gallery`);
            videos = Array.from(galleryItems).map((el, idx) => ({
                _id: el.getAttribute('data-video-id'),
                videoUrl: el.querySelector('video')?.src || el.getAttribute('data-src'),
                index: idx
            }));
        }
    }
    
    if (videos.length === 0) {
        console.log(`[displayVideosInGrid] No videos to display`);
        grid.innerHTML = `<div style="padding: 60px 20px; text-align: center; color: #999; grid-column: 1/-1; font-size: 0.95rem;">
            <i class="bi bi-play-circle" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5; display: block;"></i>
            No videos available
        </div>`;
        return;
    }
    
    console.log(`[displayVideosInGrid] Clearing grid and rendering ${videos.length} videos`);
    grid.innerHTML = '';
    
    // Get user info for NSFW filtering
    const currentUser = window.user || {};
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporary = !!currentUser.isTemporary;
    
    console.log(`[displayVideosInGrid] User: subscriptionStatus=${subscriptionStatus}, isTemporary=${isTemporary}`);
    
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
            console.log(`[displayVideosInGrid] Video ${video._id}: NSFW and will be blurred`);
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
            console.warn(`[displayVideosInGrid] Video ${index} has no source URL, skipping`);
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
    
    console.log(`[displayVideosInGrid] Rendered summary - Total: ${videos.length}, NSFW: ${nsfwCount}, Blurred: ${blurredCount}, Displayed: ${displayedCount}`);
    
    // Add load more button if on character profile page and more content available
    const onCharacterPage = !!document.querySelector('#characterProfilePage');
    if (onCharacterPage) {
        const currentPage = window.characterProfile.videosCurrentPage || 1;
        const totalPages = window.characterProfile.videosTotalPages || 1;
        
        console.log(`[displayVideosInGrid] On character page - currentPage: ${currentPage}, totalPages: ${totalPages}`);
        
        // Always add button back (grid was cleared), show only if there are more pages
        addLoadMoreButton('videos');
        
        // Hide or show based on whether there are more pages
        if (currentPage >= totalPages) {
            console.log(`[displayVideosInGrid] Hiding load more button (no more pages)`);
            hideLoadMoreButton('videos');
        } else {
            console.log(`[displayVideosInGrid] Showing load more button`);
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
        console.log(`Updated UI - imagesCount element text set to: ${count.toLocaleString()}`);
        console.log('Element:', element);
        console.log('Element text content:', element.textContent);
    } else {
        console.error('Element with ID imagesCount not found');
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
    btn.innerHTML = translations.loadMore;
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
    grid.appendChild(buttonContainer);
}

/**
 * Load more videos for character profile
 */
function loadMoreCharacterVideos(chatId) {
    if (window.characterProfile.videosLoading) {
        console.warn('Already loading videos, please wait...');
        return;
    }
    
    const nextPage = (window.characterProfile.videosCurrentPage || 1) + 1;
    
    // Check if there are more pages
    if (nextPage > window.characterProfile.videosTotalPages) {
        console.log('No more pages to load');
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
                    window.characterProfile.videosLoading = false;
                }, 300);
            })
            .catch((error) => {
                console.error('Error loading next page of videos:', error);
                // Hide loading spinner on error
                if (typeof hideLoadMoreButtonSpinner === 'function') {
                    hideLoadMoreButtonSpinner('videos');
                }
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
        btn.innerHTML = `Load More ${type === 'images' ? 'Images' : 'Videos'}`;
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
    }
}
