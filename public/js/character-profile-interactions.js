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
    // Get all images from the current grid
    const gridImages = [];
    const imagesGrid = document.getElementById('imagesGrid');
    
    if (imagesGrid) {
        const mediaItems = imagesGrid.querySelectorAll('.media-item');
        mediaItems.forEach(item => {
            if (item.dataset.image) {
                try {
                    const imageData = JSON.parse(item.dataset.image);
                    gridImages.push({
                        url: imageData.imageUrl,
                        id: imageData._id,
                        title: extractImageTitle(imageData),
                        prompt: imageData.prompt || '',
                        data: imageData
                    });
                } catch (err) {
                    // ignore parse errors
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
            data: clickedImageData
        });
    }
    
    const clickedImageUrl = clickedImageData.imageUrl;
    const clickedIndex = gridImages.findIndex(img => img.url === clickedImageUrl);
    
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
                                <div class="swiper-pagination" style="bottom: 140px;"></div>
                                
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
                        if (window.characterImageSwiper && window.characterImageSwiper.zoom) {
                            window.characterImageSwiper.zoom.reset();
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
        
        // Update the like button click handler - only attach once
        if (!window.characterImageLikeHandlerAttached) {
            $(document).on('click', '.character-image-like-btn', function(e) {
                e.stopPropagation();
                
                const imageId = window.characterPreviewImages && window.characterPreviewImages.length > 0 
                    ? window.characterPreviewImages[window.characterImageSwiper?.realIndex || window.characterImageSwiper?.activeIndex || 0].id 
                    : null;
                
                if (imageId) {
                    if (typeof toggleImageFavorite === 'function') {
                        // Create a temporary button element for the toggle function
                        const tempBtn = $('<button></button>').attr('data-id', imageId);
                        toggleImageFavorite(tempBtn[0]);
                        
                        // Update the button appearance after toggle
                        setTimeout(() => {
                            updateCharacterLikeButton(window.characterImageSwiper?.realIndex || window.characterImageSwiper?.activeIndex || 0);
                        }, 300);
                    }
                }
            });
            window.characterImageLikeHandlerAttached = true;
        }
    }
    
    // Clear existing slides and add new ones
    const swiperWrapper = $('#characterImagePreviewModal .swiper-wrapper');
    swiperWrapper.empty();
    
    // Keep original order - DON'T reorder images
    const orderedImages = [...gridImages];
    
    // Add slides with zoom containers
    orderedImages.forEach((image, index) => {
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
    
    // Store images data globally for reference
    window.characterPreviewImages = orderedImages;
    
    // Store the initial slide index globally
    window.characterInitialSlideIndex = Math.max(0, clickedIndex);
    
    // Initialize the modal
    const characterImageModal = new bootstrap.Modal(document.getElementById('characterImagePreviewModal'));
    characterImageModal.show();
    
    // Wait for modal to be fully visible, then update swiper
    setTimeout(() => {
        if (window.characterImageSwiper) {
            window.characterImageSwiper.update();
        }
    }, 300);
    
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
        
        if (tapLength < 400 && tapLength > 0) {
            // Double tap detected - LIKE the image
            clearTimeout(tapTimeout);
            
            const activeIndex = swiper.realIndex || swiper.activeIndex;
            const currentImage = window.characterPreviewImages[activeIndex];
            
            if (currentImage && currentImage.id) {
                if (typeof toggleImageFavorite === 'function') {
                    const tempBtn = $('<button></button>').attr('data-id', currentImage.id);
                    toggleImageFavorite(tempBtn[0]);
                    
                    setTimeout(() => {
                        updateCharacterLikeButton(activeIndex);
                        showCharacterLikeAnimation();
                    }, 200);
                }
            }
        } else {
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
            $('.image-title').text(currentImage.title || 'Untitled');
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
            // Check if image is already liked by looking at existing like buttons in the grid
            const isLiked = checkIfImageIsLiked(currentImage.id);
            const $likeBtn = $('.image-like-btn');
            const $likeIcon = $likeBtn.find('i');
                        
            if (isLiked) {
                $likeIcon.removeClass('bi-heart').addClass('bi-heart-fill text-danger');
            } else {
                $likeIcon.removeClass('bi-heart-fill text-danger').addClass('bi-heart');
            }
            
            // Store the like status in the characterPreviewImages array for consistency
            currentImage.isLiked = isLiked;
        }
    }

    function checkIfImageIsLiked(imageId) {
        // Check if the image is already liked by looking at existing elements
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
