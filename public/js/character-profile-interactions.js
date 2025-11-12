/**
 * Character Profile Interactions
 * Handles user interactions (likes, sharing, video playback, etc.)
 */

/**
 * Toggle image like/favorite
 * Wrapper to pass the button element to the existing toggleImageFavorite function
 */
function toggleImageLike(event) {
    event.stopPropagation();
    
    // Call the existing toggleImageFavorite function from dashboard.js
    // It handles login checks, API calls, and UI updates
    if (typeof toggleImageFavorite === 'function') {
        toggleImageFavorite(event.currentTarget);
    } else {
        console.error('toggleImageFavorite function not available');
    }
}

/**
 * Display image in modal with details (title, date)
 */
function displayImageModal(imageData) {
    console.log('[displayImageModal] Function called with imageData:', imageData);
    
    if (!imageData) {
        console.error('[displayImageModal] ERROR: imageData is null or undefined!');
        return;
    }
    
    console.log('[displayImageModal] ImageData properties:', {
        _id: imageData._id,
        title: imageData.title,
        imageUrl: imageData.imageUrl,
        createdAt: imageData.createdAt
    });
    
    // Close any existing modals first
    console.log('[displayImageModal] Checking for existing modals...');
    const existingModal = document.getElementById('imageModal');
    if (existingModal) {
        console.log('[displayImageModal] Found existing modal, closing it...');
        const bsModal = bootstrap.Modal.getInstance(existingModal);
        if (bsModal) {
            console.log('[displayImageModal] Bootstrap Modal instance found, hiding...');
            bsModal.hide();
        }
        setTimeout(() => {
            console.log('[displayImageModal] Removing existing modal from DOM');
            existingModal.remove();
        }, 300);
    } else {
        console.log('[displayImageModal] No existing modal found');
    }
    
    // Format the date
    const imageDate = imageData.createdAt ? new Date(imageData.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Unknown date';
    
    console.log('[displayImageModal] Formatted date:', imageDate);
    
    // Extract title based on current language
    let imageTitle = 'Untitled Image';
    const currentLang = translations?.lang || 'en';
    console.log('[displayImageModal] Current language:', currentLang);
    
    if (imageData.title) {
        if (typeof imageData.title === 'string') {
            // Simple string title
            imageTitle = imageData.title;
            console.log('[displayImageModal] Title is string:', imageTitle);
        } else if (typeof imageData.title === 'object' && imageData.title[currentLang]) {
            // Localized title object - get current language
            imageTitle = imageData.title[currentLang];
            console.log('[displayImageModal] Title is localized object, using', currentLang, ':', imageTitle);
        } else if (typeof imageData.title === 'object') {
            // Localized title object but current lang not available - use first available
            const availableLang = Object.keys(imageData.title)[0];
            imageTitle = imageData.title[availableLang];
            console.log('[displayImageModal] Current language not in title, using fallback', availableLang, ':', imageTitle);
        }
    }
    
    const imageUrl = imageData.imageUrl || '/img/avatar.png';
    
    console.log('[displayImageModal] Using title:', imageTitle);
    console.log('[displayImageModal] Using imageUrl:', imageUrl);
    
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'imageModal';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'imageModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="modal-dialog image-modal-dialog modal-dialog-centered">
            <div class="modal-content image-modal-content">
                <div class="image-modal-header">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="image-modal-body">
                    <img src="${imageUrl}" alt="${imageTitle}" class="image-modal-img" onerror="this.src='/img/avatar.png'">
                </div>
                <div class="image-modal-footer">
                    <div class="image-modal-info">
                        <div class="image-modal-actions">
                            <button type="button" class="image-modal-action-btn image-modal-like-btn" data-id="${imageData._id}" title="Like">
                                <i class="bi bi-heart"></i>
                            </button>
                            <button type="button" class="image-modal-action-btn" onclick="navigator.clipboard.writeText(window.location.href); alert('Image URL copied!');" title="Copy">
                                <i class="bi bi-link-45deg"></i>
                            </button>
                        </div>
                        <div class="image-modal-title-section">
                            <h5 class="modal-title image-modal-title" id="imageModalLabel" style="cursor: pointer;">
                                <span class="title-text">${imageTitle}</span>
                                <span class="title-toggle">...</span>
                            </h5>
                            <p class="image-modal-date">${imageDate}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    console.log('[displayImageModal] Modal HTML created');
    console.log('[displayImageModal] Appending modal to DOM...');
    
    document.body.appendChild(modal);
    console.log('[displayImageModal] Modal appended to body');
    console.log('[displayImageModal] Modal element:', modal);
    
    console.log('[displayImageModal] Creating Bootstrap Modal instance...');
    const bootstrapModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: true
    });
    
    console.log('[displayImageModal] Bootstrap Modal instance created:', bootstrapModal);
    console.log('[displayImageModal] Calling .show() to display modal...');
    
    bootstrapModal.show();
    console.log('[displayImageModal] Modal .show() called');
    
    // Add like button listener
    const likeBtn = modal.querySelector('.image-modal-like-btn');
    console.log('[displayImageModal] Like button element:', likeBtn);
    
    if (likeBtn) {
        console.log('[displayImageModal] Adding click listener to like button');
        likeBtn.addEventListener('click', function(e) {
            console.log('[displayImageModal] Like button clicked');
            e.stopPropagation();
            if (typeof toggleImageFavorite === 'function') {
                console.log('[displayImageModal] Calling toggleImageFavorite');
                toggleImageFavorite(likeBtn);
            } else {
                console.error('[displayImageModal] toggleImageFavorite function not available');
            }
        });
    } else {
        console.warn('[displayImageModal] Like button not found in modal!');
    }
    
    // Add title expand/collapse functionality
    const titleElement = modal.querySelector('.image-modal-title');
    if (titleElement) {
        const titleText = titleElement.querySelector('.title-text');
        const originalText = titleText.textContent;
        
        titleElement.addEventListener('click', function() {
            const isExpanded = titleElement.classList.contains('expanded');
            const toggleSpan = titleElement.querySelector('.title-toggle');
            
            if (isExpanded) {
                // Collapse
                titleText.textContent = originalText.substring(0, 50) + '...';
                titleElement.classList.remove('expanded');
                toggleSpan.textContent = '▼ More';
            } else {
                // Expand
                titleText.textContent = originalText;
                titleElement.classList.add('expanded');
                toggleSpan.textContent = '▲ Less';
            }
        });
        
        // Truncate title on load
        if (originalText.length > 50) {
            titleText.textContent = originalText.substring(0, 50) + '...';
        }
    }
    
    // Clean up modal when hidden
    console.log('[displayImageModal] Adding hidden.bs.modal listener');
    modal.addEventListener('hidden.bs.modal', function() {
        console.log('[displayImageModal] Modal being hidden, removing from DOM');
        modal.remove();
    });
    
    console.log('[displayImageModal] Function execution complete');
}

/**
 * Play video in modal
 */
function playVideoModal(videoUrl) {
    // Close any existing modals first
    const existingModal = document.getElementById('videoModal');
    if (existingModal) {
        const bsModal = bootstrap.Modal.getInstance(existingModal);
        if (bsModal) {
            bsModal.hide();
        }
        setTimeout(() => existingModal.remove(), 300);
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'videoModal';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', 'videoModalLabel');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content" style="background-color: #000;">
                <div class="modal-header" style="border-bottom: 1px solid #333;">
                    <h5 class="modal-title" id="videoModalLabel" style="color: white;">Video Player</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-0" style="background-color: #000; min-height: 400px; display: flex; align-items: center; justify-content: center;">
                    <video width="100%" height="auto" controls autoplay style="border-radius: 4px; max-height: 70vh;">
                        <source src="${videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal, {
        backdrop: 'static',
        keyboard: true
    });
    bootstrapModal.show();
    
    // Clean up modal when hidden
    modal.addEventListener('hidden.bs.modal', function() {
        const videoElement = modal.querySelector('video');
        if (videoElement) {
            videoElement.pause();
            videoElement.currentTime = 0;
        }
        modal.remove();
    });
}

/**
 * Initialize sharing functionality
 */
function initializeSharing() {
    const shareBtn = document.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            const profilePage = document.querySelector('#characterProfilePage');
            const chatId = profilePage?.dataset?.chatId;
            const chatName = document.querySelector('.profile-name')?.textContent;
            
            if (navigator.share) {
                navigator.share({
                    title: chatName,
                    text: `Check out ${chatName} on ChatLamix!`,
                    url: window.location.href
                }).catch(err => console.log('Error sharing:', err));
            } else {
                // Fallback: copy to clipboard
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                    alert('Profile link copied to clipboard!');
                }).catch(err => console.error('Failed to copy:', err));
            }
        });
    }
}

/**
 * Initialize tab switching functionality
 */
function initializeTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Update active states
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.style.display = 'none');
            
            this.classList.add('active');
            document.getElementById(tabId + '-tab').style.display = 'block';
            
            // Load content if needed
            if (tabId === 'videos' && !window.characterProfile.videosLoaded) {
                loadVideos();
            }
        });
    });
}

/**
 * Load character gallery for non-specific character pages
 */
function loadCharacterGallery() {
    if (typeof window.displayLatestChats === 'function') {
        window.displayLatestChats();
    }
}

/**
 * Back to top functionality
 */
function initializeBackToTop() {
    const backToTopButton = document.getElementById("back-to-top");
    if (backToTopButton) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                backToTopButton.style.display = 'flex';
            } else {
                backToTopButton.style.display = 'none';
            }
        });

        backToTopButton.addEventListener("click", function(e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}
