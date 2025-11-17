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
 * Display image in swiper modal with full navigation and like functionality
 * Similar to chat-tool-swiper.js but adapted for character profile
 */
function displayImageModal(imageData) {
    if (!imageData) {
        return;
    }
    
    // Call the new swiper preview function
    showCharacterImagePreview(imageData);
}

/**
 * Show character image preview in fullscreen swiper modal
 * Supports navigation, zooming, double-click to like, and image info
 */
window.showCharacterImagePreview = function(clickedImageData) {
    
    // Get all UNLOCKED images from the current grid
    const gridImages = [];
    const imagesGrid = document.getElementById('imagesGrid');
    
    
    if (imagesGrid) {
        const mediaItems = imagesGrid.querySelectorAll('.media-item');
        
        mediaItems.forEach((item, index) => {
            // Check if this item has a blur overlay (indicating it's locked)
            const hasBlurOverlay = item.querySelector('.character-nsfw-overlay');
            
            // Only include if it has image data AND no blur overlay
            if (item.dataset.image && !hasBlurOverlay) {
                try {
                    const imageData = JSON.parse(item.dataset.image);
                    
                    // Get the CURRENT like state from the grid button, not from the data
                    // This ensures we always have the latest like status
                    const gridLikeBtn = item.querySelector('.image-fav');
                    const isLikedInGrid = gridLikeBtn && gridLikeBtn.querySelector('i.bi-heart-fill') !== null;
                    
                    gridImages.push({
                        url: imageData.imageUrl,
                        id: imageData._id,
                        title: extractImageTitle(imageData),
                        prompt: imageData.prompt || '',
                        isLiked: isLikedInGrid, // Use the CURRENT state from grid button
                        data: imageData
                    });
                } catch (err) {
                    console.error('[showCharacterImagePreview] Error parsing image data:', err);
                }
            }
        });
    }
    
    // Fallback to single image if grid is empty
    if (gridImages.length === 0) {
        gridImages.push({
            url: clickedImageData.imageUrl,
            id: clickedImageData._id,
            title: extractImageTitle(clickedImageData),
            prompt: clickedImageData.prompt || '',
            isLiked: clickedImageData.isLiked || false,
            data: clickedImageData
        });
    }
    
    const clickedImageUrl = clickedImageData.imageUrl;
    const clickedIndex = gridImages.findIndex(img => img.url === clickedImageUrl);
    
    // Always remove and recreate the modal for a fresh state
    const existingModal = document.getElementById('characterImagePreviewModal');
    if (existingModal) {
        // Hide existing modal instance
        const bsModal = bootstrap.Modal.getInstance(existingModal);
        if (bsModal) {
            bsModal.hide();
        }
        
        // Wait a bit for modal to hide, then remove it
        setTimeout(() => {
            if (window.characterImageSwiper) {
                window.characterImageSwiper.destroy();
                window.characterImageSwiper = null;
            }
            $(document).off('click', '.character-image-like-btn');
            const elem = document.getElementById('characterImagePreviewModal');
            if (elem) {
                $(elem).remove();
            }
            
            // Recursively call to create fresh modal
            showCharacterImagePreview(clickedImageData);
        }, 200);
        
        return;
    }
    
    // Create modal if it doesn't exist yet
    if ($('#characterImagePreviewModal').length === 0) {
        const modalHTML = `
            <div class="modal fade" id="characterImagePreviewModal" tabindex="-1" aria-labelledby="characterImagePreviewModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content mx-auto w-100" style="background:rgba(24, 24, 24, 0.95);">
                        <div class="modal-header border-0 position-absolute" style="top: 0; right: 0; z-index: 10000; background: transparent;">
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-0" style="height: 100vh; overflow: hidden;">
                            <!-- Enhanced Swiper Container -->
                            <div class="swiper-container character-image-preview-swiper" style="height: 100%; width: 100%;">
                                <div class="swiper-wrapper"></div>
                                
                                <!-- Navigation arrows with better styling -->
                                <div class="swiper-button-next" style="color: white; opacity: 0.8; right: 20px;"></div>
                                <div class="swiper-button-prev" style="color: white; opacity: 0.8; left: 20px;"></div>
                                
                                <!-- Pagination dots -->
                                <div class="swiper-pagination d-none" style="bottom: 140px;"></div>
                                
                                <!-- Like button overlay - TOP LEFT -->
                                <div class="image-like-overlay position-absolute" style="top: 60px; left: 20px; z-index: 1000;">
                                    <button class="btn btn-light rounded-circle image-like-btn character-image-like-btn d-flex justify-content-center align-items-center" style="width: 50px; height: 50px; opacity: 0.9; backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.2);">
                                        <i class="bi bi-heart fs-4"></i>
                                    </button>
                                </div>
                                
                                <!-- Image info overlay - BOTTOM CENTER -->
                                <div class="image-info-overlay position-absolute w-100" style="bottom: 20px; left: 0; right: 0; z-index: 1000;">
                                    <div class="container text-center">
                                        <div class="image-info-container mx-auto" style="max-width: 600px; padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                                            <div class="image-title text-white fw-bold mb-2" style="font-size: 18px;"></div>
                                            <div class="image-prompt-container d-none" style="max-height: 60px; overflow-y: auto; scrollbar-width: thin;">
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
        
        // Store clickedIndex in the modal element for later use
        $('#characterImagePreviewModal').data('clickedIndex', clickedIndex);
        
        // Clean up when modal is hidden to allow fresh initialization on next open
        $('#characterImagePreviewModal').on('hidden.bs.modal', function() {
            // Destroy swiper instance
            if (window.characterImageSwiper) {
                window.characterImageSwiper.destroy();
                window.characterImageSwiper = null;
            }
            // Clear image data
            window.characterPreviewImages = [];
            // Remove event listeners
            $(document).off('click', '.character-image-like-btn');
        });
        
        // Initialize Swiper with enhanced configuration
        $('#characterImagePreviewModal').on('shown.bs.modal', function() {
            const storedClickedIndex = $(this).data('clickedIndex') || 0;
            
            if (window.characterImageSwiper) {
                window.characterImageSwiper.destroy();
            }
                        
            window.characterImageSwiper = new Swiper('.character-image-preview-swiper', {
                initialSlide: Math.max(0, storedClickedIndex),
                loop: false,
                zoom: {
                    maxRatio: 5,
                    minRatio: 1,
                    toggle: false,
                    containerClass: 'swiper-zoom-container',
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                    dynamicBullets: true,
                },
                touchRatio: 1,
                touchAngle: 45,
                grabCursor: true,
                keyboard: {
                    enabled: true,
                    onlyInViewport: false,
                },
                mousewheel: {
                    invert: false,
                },
                lazy: {
                    loadPrevNext: true,
                    loadPrevNextAmount: 2,
                },
                watchSlidesProgress: true,
                watchSlidesVisibility: true,
                on: {
                    slideChange: function() {
                        updateCharacterImageInfo(this.realIndex || this.activeIndex);
                        updateCharacterLikeButton(this.realIndex || this.activeIndex);
                    },
                    touchEnd: function(swiper, event) {
                        // Double tap handling
                    },
                    slideChangeTransitionStart: function() {
                        // Reset zoom level on slide change
                        if (window.characterImageSwiper && window.characterImageSwiper.zoom && typeof window.characterImageSwiper.zoom.out === 'function') {
                            window.characterImageSwiper.zoom.out();
                        }
                    },
                    init: function() {
                        // Use the actual activeIndex from the swiper instead of hardcoded 0
                        const activeIndex = this.realIndex || this.activeIndex || 0;
                        updateCharacterImageInfo(activeIndex);
                        updateCharacterLikeButton(activeIndex);
                        
                        // Attach double-tap listener after init
                        attachCharacterDoubleTapListener();
                    }
                }
            });
            
            // Show all slides immediately
            $('.swiper-slide').show();
        });
        
        // Update the like button click handler
        // Always detach old handler if it exists and attach a new one
        $(document).off('click', '.character-image-like-btn');
        
        $(document).on('click', '.character-image-like-btn', function(e) {
            e.stopPropagation();
                        
            const activeIndex = window.characterImageSwiper?.realIndex || window.characterImageSwiper?.activeIndex || 0;
            const imageId = window.characterPreviewImages && window.characterPreviewImages.length > 0 
                ? window.characterPreviewImages[activeIndex].id 
                : null;
                
            if (imageId) {
                if (typeof toggleImageFavorite === 'function') {
                    // Add data-id and data-chat-id directly to the like button
                    const profilePage = document.querySelector('#characterProfilePage');
                    const chatId = profilePage?.dataset?.chatId;
                    const $likeBtn = $(this);
                    
                    // Set the data attributes on the button
                    $likeBtn.attr('data-id', imageId);
                    if (chatId) {
                        $likeBtn.attr('data-chat-id', chatId);
                    }
                    
                    toggleImageFavorite(this);
                                        
                    // Update the button appearance and state after toggle
                    setTimeout(() => {
                        
                        // Get the CURRENT state from the grid button (most reliable source)
                        const gridBtn = document.querySelector(`.image-fav[data-id="${imageId}"]`);
                        let newState = false;
                        
                        if (gridBtn) {
                            const icon = gridBtn.querySelector('i');
                            newState = icon && icon.classList.contains('bi-heart-fill');
                        } else {
                            
                            // Debug: Log all image-fav buttons
                            const allButtons = document.querySelectorAll('.image-fav');
                            allButtons.forEach((btn, idx) => {
                                console.log(`  [${idx}] data-id="${btn.getAttribute('data-id')}", icon:`, btn.querySelector('i')?.className);
                            });
                        }

                        // Update the in-memory state
                        if (window.characterPreviewImages[activeIndex]) {
                            window.characterPreviewImages[activeIndex].isLiked = newState;
                        }
                        
                        // Update the swiper button UI to match the grid
                        updateCharacterLikeButton(activeIndex);
                    }, 500);
                } else {
                    console.error(' toggleImageFavorite function NOT available');
                }
            }
        });
    }
    
    // Store images data globally for reference
    window.characterPreviewImages = gridImages;
    
    // Store the initial slide index globally
    window.characterInitialSlideIndex = Math.max(0, clickedIndex);
    
    // Add slides to swiper wrapper
    const swiperWrapper = $('#characterImagePreviewModal .swiper-wrapper');
    swiperWrapper.empty();
    
    gridImages.forEach((image) => {
        swiperWrapper.append(`
            <div class="swiper-slide d-flex align-items-center justify-content-center">
                <div class="swiper-zoom-container">
                    <img src="${image.url}" 
                         class="img-fluid" 
                         style="max-height: 100vh; max-width: 100vw; object-fit: contain;"
                         data-image-id="${image.id}"
                         data-image-title="${escapeHtml(image.title || '')}"
                         data-image-prompt="${escapeHtml(image.prompt || '')}">
                </div>
            </div>
        `);
    });
    
    // Initialize the modal
    const characterImageModal = new bootstrap.Modal(document.getElementById('characterImagePreviewModal'));
    characterImageModal.show();
    
    // Wait for modal to be fully visible, then update swiper
    setTimeout(() => {
        if (window.characterImageSwiper) {
            window.characterImageSwiper.update();
        }
    }, 300);
}

/**
 * Attach double-tap listener to character image swiper
 */
function attachCharacterDoubleTapListener() {
    if (!window.characterImageSwiper) {
        return;
    }
    
    // Remove any existing tap listeners to avoid duplicates
    window.characterImageSwiper.off('tap');
    
    let lastTapTime = 0;
    let tapTimeout;
    
    function handleCharacterDoubleTap(swiper, event) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime;
        
        console.log('[handleCharacterDoubleTap] tapLength:', tapLength, 'ms');
        
        if (tapLength < 400 && tapLength > 0) {
            // Double tap detected - LIKE the image
            console.log('[handleCharacterDoubleTap] DOUBLE TAP DETECTED');
            clearTimeout(tapTimeout);
            
            const activeIndex = swiper.realIndex || swiper.activeIndex;
            const currentImage = window.characterPreviewImages[activeIndex];
            
            console.log('[handleCharacterDoubleTap] activeIndex:', activeIndex);
            console.log('[handleCharacterDoubleTap] currentImage:', currentImage);
            
            if (currentImage && currentImage.id) {
                if (typeof toggleImageFavorite === 'function') {
                    // Include data-chat-id so cache clearing works properly
                    const profilePage = document.querySelector('#characterProfilePage');
                    const chatId = profilePage?.dataset?.chatId;
                    const tempBtn = $('<button></button>').attr('data-id', currentImage.id);
                    if (chatId) {
                        tempBtn.attr('data-chat-id', chatId);
                    }
                    
                    console.log('[handleCharacterDoubleTap] Before toggle - state:', currentImage.isLiked);
                    console.log('[handleCharacterDoubleTap] Calling toggleImageFavorite');
                    toggleImageFavorite(tempBtn[0]);
                    
                    setTimeout(() => {
                        // Get the CURRENT state from the grid button (most reliable source)
                        const gridBtn = document.querySelector(`.image-fav[data-id="${currentImage.id}"]`);
                        let newState = false;
                        
                        if (gridBtn) {
                            const icon = gridBtn.querySelector('i');
                            newState = icon && icon.classList.contains('bi-heart-fill');
                            console.log('[handleCharacterDoubleTap] Grid button found, new state:', newState);
                        } else {
                            console.log('[handleCharacterDoubleTap] Grid button NOT found');
                        }
                        
                        // Update the in-memory state
                        if (window.characterPreviewImages[activeIndex]) {
                            window.characterPreviewImages[activeIndex].isLiked = newState;
                            console.log('[handleCharacterDoubleTap] Updated in-memory state to:', newState);
                        }
                        
                        console.log('[handleCharacterDoubleTap] Calling updateCharacterLikeButton');
                        updateCharacterLikeButton(activeIndex);
                        showCharacterLikeAnimation();
                    }, 200);
                } else {
                    console.error('[handleCharacterDoubleTap] toggleImageFavorite NOT available');
                }
            } else {
                console.error('[handleCharacterDoubleTap] currentImage or currentImage.id missing');
            }
        } else {
            console.log('[handleCharacterDoubleTap] Single tap or invalid timing');
            // Single tap - set timeout to handle if no second tap comes
            tapTimeout = setTimeout(() => {
                // Handle single tap if needed
            }, 400);
        }
        
        lastTapTime = currentTime;
    }
    
    // Add double-tap listener to swiper
    window.characterImageSwiper.on('tap', function(swiper, event) {
        handleCharacterDoubleTap(this, event);
    });
}

function updateCharacterImageInfo(activeIndex) {
    const currentImage = window.characterPreviewImages[activeIndex];
    if (currentImage) {
        currentImage.title && currentImage.title.trim() !== '' ?
            $('.image-title').text(currentImage.title) :
            $('.image-info-container').hide();
        $('.image-prompt').text(currentImage.prompt || 'No description available');
        
        // Reset scroll position when switching images
        $('.image-prompt-container').scrollTop(0);
        
        // Update the like button's data-id attribute
        const $likeBtn = $('.image-like-btn');
        if ($likeBtn.length && currentImage.id) {
            $likeBtn.attr('data-id', currentImage.id);
        }
    }
}

function updateCharacterLikeButton(activeIndex) {
    const currentImage = window.characterPreviewImages[activeIndex];

    if (currentImage && currentImage.id) {
        // First check the grid for the CURRENT like state (most authoritative)
        const gridLikeBtn = document.querySelector(`.image-fav[data-id="${currentImage.id}"]`);
        let isLiked = false;
        
        if (gridLikeBtn) {
            // Check if the grid button shows it as liked
            const heartIcon = gridLikeBtn.querySelector('i');
            isLiked = heartIcon && heartIcon.classList.contains('bi-heart-fill');
        } else {
            // Fallback to the in-memory state
            isLiked = !!currentImage.isLiked;
        }
        
        // Update the swiper like button to match
        const $likeBtn = $('.image-like-btn');
        const $likeIcon = $likeBtn.find('i');
                            
        if (isLiked) {
            $likeIcon.removeClass('bi-heart').addClass('bi-heart-fill text-danger');
            // Also update the in-memory state
            currentImage.isLiked = true;
        } else {
            $likeIcon.removeClass('bi-heart-fill text-danger').addClass('bi-heart');
            // Also update the in-memory state
            currentImage.isLiked = false;
        }
        
    }
}

function checkIfImageIsLiked(imageId) {
    // Check if the image is already liked by looking at existing elements in the grid
    const existingLikeBtn = $(`.image-fav[data-id="${imageId}"] i`);
    return existingLikeBtn.hasClass('bi-heart-fill');
}

function showCharacterLikeAnimation() {
    // Create floating heart animation
    const $heart = $('<div class="floating-heart position-absolute d-flex align-items-center justify-content-center" style="width: 80px; height: 80px; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10001; pointer-events: none;"><i class="bi bi-heart-fill text-danger" style="font-size: 2.5rem; opacity: 0; filter: drop-shadow(0 0 10px rgba(220, 53, 69, 0.8));"></i></div>');
    
    $('#characterImagePreviewModal .modal-body').append($heart);
    
    // Animate the heart with enhanced effects
    $heart.find('i').animate({
        opacity: 1,
        fontSize: '4rem'
    }, 300, function() {
        // Fade out and float up
        setTimeout(() => {
            $heart.find('i').animate({
                opacity: 0,
                marginTop: '-100px'
            }, 400, function() {
                $heart.remove();
            });
        }, 600);
    });
    
    // Update the like button immediately with animation
    const $likeBtn = $('.image-like-btn i');
    $likeBtn.removeClass('bi-heart').addClass('bi-heart-fill text-danger');
    
    // Add enhanced bounce effect to the like button
    $('.image-like-btn').addClass('animate__animated animate__heartBeat');
    setTimeout(() => {
        $('.image-like-btn').removeClass('animate__animated animate__heartBeat');
    }, 1000);
    
    // Add ripple effect to like button
    const $ripple = $('<div class="like-ripple"></div>');
    $('.image-like-btn').append($ripple);
    
    setTimeout(() => {
        $ripple.remove();
    }, 600);
}

/**
 * Extract image title based on current language
 */
function extractImageTitle(imageData) {
    let imageTitle = 'Untitled Image';
    const currentLang = translations?.lang || 'en';
    
    if (imageData.title) {
        if (typeof imageData.title === 'string') {
            imageTitle = imageData.title;
        } else if (typeof imageData.title === 'object' && imageData.title[currentLang]) {
            imageTitle = imageData.title[currentLang];
        } else if (typeof imageData.title === 'object') {
            const availableLang = Object.keys(imageData.title)[0];
            imageTitle = imageData.title[availableLang];
        }
    }
    return imageTitle;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
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
                }).catch(err => {/* ignore sharing errors */});
            } else {
                // Fallback: copy to clipboard
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                    alert('Profile link copied to clipboard!');
                }).catch(err => {/* ignore copy errors */});
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
