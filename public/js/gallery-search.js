/**
 * Gallery Search Manager
 * Handles dynamic search, infinite scroll, and media type toggling
 */

class GallerySearchManager {
  constructor() {
    this.currentQuery = '';
    this.currentMediaType = 'image'; // 'image' or 'video'
    this.currentPage = 1;
    this.totalPages = 1;
    this.isLoading = false;
    this.hasMoreResults = true;
    this.scrollHandler = null;
    this.searchDebounceTimer = null;
    this.debounceDelay = 500; // ms
    
    // Get user subscription status from window object (set by server)
    this.isSubscribed = window.user?.subscriptionStatus === 'active';
    this.isTemporary = window.user?.isTemporary || false;
    this.shouldBlurNSFW = this.isTemporary || !this.isSubscribed || !window?.showNSFW;
    
    // Track loaded images for preview functionality
    this.loadedSearchImages = [];

    this.init();
  }

  init() {
    this.attachEventListeners();
    this.setupInfiniteScroll();
  }

  attachEventListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('search-query-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(this.searchDebounceTimer);
        
        this.searchDebounceTimer = setTimeout(() => {
          this.performNewSearch(query);
        }, this.debounceDelay);
      });

      // Clear results on focus (optional UX improvement)
      searchInput.addEventListener('focus', () => {
        // Could add suggestions here
      });

      // Allow pressing Enter to search
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value.trim();
          clearTimeout(this.searchDebounceTimer);
          this.performNewSearch(query);
        }
      });
    }

    // Search button click listener
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
      searchButton.addEventListener('click', () => {
        const query = document.getElementById('search-query-input')?.value?.trim() || '';
        clearTimeout(this.searchDebounceTimer);
        this.performNewSearch(query);
      });
    }

    // Media type toggle buttons
    const mediaToggleButtons = document.querySelectorAll('.media-type-toggle');
    mediaToggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const mediaType = button.getAttribute('data-media-type');
        this.switchMediaType(mediaType);
      });
    });
  }

  /**
   * Perform a new search with fresh results
   */
  async performNewSearch(query) {
    this.currentQuery = query;
    this.currentPage = 1;
    this.hasMoreResults = true;

    // Clear existing results
    this.clearGallery();
    this.showLoadingState();

    // Perform initial search
    await this.loadNextPage();

    // Update URL without reloading
    this.updateURL();
  }

  /**
   * Switch between image and video results
   */
  async switchMediaType(mediaType) {
    if (mediaType === this.currentMediaType) return;

    this.currentMediaType = mediaType;
    this.currentPage = 1;
    this.hasMoreResults = true;

    // Update button states
    this.updateMediaToggleButtons();

    // Clear gallery and load new media type
    this.clearGallery();
    this.showLoadingState();

    await this.loadNextPage();
    this.updateURL();
  }

  /**
   * Load next page of results
   */
  async loadNextPage() {
    if (this.isLoading || !this.hasMoreResults) return;

    this.isLoading = true;
    this.showLoadingState();

    try {
      const endpoint = this.currentMediaType === 'image'
        ? '/api/gallery/search/images'
        : '/api/gallery/search/videos';

      const params = new URLSearchParams({
        query: this.currentQuery,
        page: this.currentPage,
        limit: 36
      });

      const response = await fetch(`${endpoint}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Render results
      const itemKey = this.currentMediaType === 'image' ? 'images' : 'videos';
      const items = data[itemKey] || [];

      if (items.length > 0) {
        this.renderItems(items);
        this.currentPage++;
        this.totalPages = data.totalPages || 1;
        this.hasMoreResults = this.currentPage <= this.totalPages;
      } else {
        this.showEmptyState();
      }

      // Hide loading indicator
      this.hideLoadingState();

    } catch (error) {
      console.error('[GallerySearchManager] Error loading results:', error);
      this.showErrorState();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render items to gallery
   */
  renderItems(items) {
    const gallery = document.getElementById('search-results-gallery');
    if (!gallery) return;

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const card = this.createMediaCard(item);
      fragment.appendChild(card);
    });

    gallery.appendChild(fragment);

    // Add click handlers to tag badges
    this.setupTagClickHandlers();
  }

  /**
   * Setup tag badge click handlers
   */
  setupTagClickHandlers() {
    document.querySelectorAll('.tag-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tag = badge.getAttribute('data-tag');
        if (tag) {
          // Update the search input field
          const searchInput = document.getElementById('search-query-input');
          if (searchInput) {
            searchInput.value = tag;
          }
          // Perform the search
          this.performNewSearch(tag);
        }
      });
    });
  }
  // Create character image overlay for NSFW images
  // Reuses logic from createOverlay in dashboard.js
  createCharacterImageOverlay(item) {
    const linkUrl = item.chatSlug
      ? `/character/slug/${item.chatSlug}${item.slug ? `?imageSlug=${item.slug}` : ''}`
      : `/character/${item.chatId}`;

    // Do not leak real URL in DOM; no src or data-src here.
    return `
      <div class="gallery-media-wrapper position-relative" style="overflow: hidden; max-height: 400px; background-color: #f0f0f0;">
        <a href="${linkUrl}" class="text-decoration-none">
          <img alt="${item.chatName} - ${item.prompt || ''}" class="gallery-media" style="width: 100%; height: 100%; object-fit: cover;" />
        </a>
      </div>
    `;
  }
  /**
   * Create media card HTML
   */
  createMediaCard(item) {
    const isImage = this.currentMediaType === 'image';
    const linkUrl = item.chatSlug 
      ? `/character/slug/${item.chatSlug}${isImage ? `?imageSlug=${item.slug}` : ''}` 
      : `/character/${item.chatId}`;

    // Determine if content should be blurred
    const isNSFW = item.nsfw;
    const shouldBlur = isNSFW && this.shouldBlurNSFW;
    const showNSFW = sessionStorage.getItem('showNSFW') === 'true';

    const container = document.createElement('div');
    container.className = 'gallery-grid-item animate__animated';
    container.setAttribute('data-animate', 'animate__fadeInUp');

    // For locked videos, use image thumbnail instead of video
    const mediaUrl = isImage ? item.imageUrl : item.videoUrl;
    
    // Track image index for preview
    const imageIndex = isImage && !shouldBlur ? this.loadedSearchImages.length : -1;
    if (isImage && !shouldBlur) {
      this.loadedSearchImages.push({
        _id: item._id,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        chatId: item.chatId,
        chatName: item.chatName,
        chatSlug: item.chatSlug,
        thumbnail: item.chatImageUrl,
        prompt: item.prompt,
        isLiked: item.isLiked || false
      });
    }
    
    // Character footer overlay for non-blurred images
    const characterFooterOverlay = isImage && !shouldBlur ? `
      <div class="search-character-footer position-absolute bottom-0 start-0 end-0" 
           style="background: linear-gradient(transparent, rgba(0,0,0,0.85)); padding: 8px; z-index: 4;">
        <div class="d-flex align-items-center gap-2 search-character-link" 
             onclick="event.preventDefault(); event.stopPropagation(); openCharacterIntroModal('${item.chatId}')" 
             style="cursor: pointer;">
          <img src="${item.chatImageUrl || '/img/default-thumbnail.png'}" 
               alt="${item.chatName}" 
               class="rounded-circle" 
               style="width: 28px; height: 28px; object-fit: cover; border: 2px solid rgba(255,255,255,0.3);"
               onerror="this.src='/img/default-thumbnail.png'">
          <span class="text-white text-truncate" style="font-size: 12px; font-weight: 500; max-width: 120px;">
            ${item.chatName || 'Unknown'}
          </span>
        </div>
      </div>` : '';

    let mediaContent;

    if (isImage && shouldBlur) {
      // Build a safe wrapper without leaking real URL; overlay will be attached by createOverlay
      mediaContent = this.createCharacterImageOverlay(item);
    } else if (isImage) {
      // Regular image - not NSFW or showNSFW is enabled - clickable for preview
      mediaContent = `
        <div class="gallery-media-wrapper position-relative search-image-preview" 
             style="overflow: hidden; max-height: 400px; background-color: #f0f0f0; cursor: pointer;"
             data-image-index="${imageIndex}"
             data-image-id="${item._id}"
             data-chat-id="${item.chatId}"
             onclick="openSearchImagePreview(this, ${imageIndex})">
          <img src="${mediaUrl}" alt="${item.chatName} - ${item.prompt || ''}" class="gallery-media" style="width: 100%; height: 100%; object-fit: cover;">
          ${characterFooterOverlay}
        </div>
      `;
    } else {
      // Video content
      mediaContent = `
        <div class="gallery-media-wrapper position-relative video-wrapper" style="overflow: hidden; max-height: 400px; background-color: #000; display: block;">
          <video style="width: 100%; height: 100%; object-fit: cover; display: block;" controls controlsList="nodownload">
            <source src="${mediaUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>
      `;
    }

    const cardHTML = `
      <div class="card shadow-sm border-0 rounded-3 h-100 gallery-card overflow-hidden">
        ${mediaContent}
        <div class="card-body p-3 d-flex flex-column d-none">
          <div class="d-flex align-items-center mb-2">
            <img src="${item.chatImageUrl}" alt="${item.chatName}" class="rounded-circle me-2" width="32" height="32" style="object-fit: cover;">
            <h6 class="mb-0 text-truncate">
              <a href="/character/slug/${item.chatSlug}" class="text-dark text-decoration-none stretched-link">
                ${item.chatName}
              </a>
            </h6>
          </div>
          <p class="card-text text-muted small text-truncate" title="${item.prompt || ''}">
            <i class="bi ${isImage ? 'bi-card-image' : 'bi-film'} me-1 text-primary"></i>
            ${item.title ? (typeof item.title === 'object' ? Object.values(item.title)[0] : item.title) : (item.prompt ? item.prompt.substring(0, 50) : 'No description')}
          </p>
          <div class="mt-auto pt-2">
            <div class="text-truncate tag-container">
              ${item.chatTags && item.chatTags.length > 0 
                ? item.chatTags.slice(0, 3).map(tag => `
                    <a href="/search?q=${encodeURIComponent(tag)}" class="badge bg-light text-dark text-decoration-none me-1 mb-1 tag-badge" data-tag="${tag}" style="cursor: pointer; pointer-events: auto; transition: all 0.2s ease;">
                      ${tag}
                    </a>
                  `).join('')
                : '<span class="text-muted small">No tags</span>'
              }
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = cardHTML;
    // Initialize blurred rendering and overlay after DOM subtree is created
    if (isImage && shouldBlur) {
      const imgEl = container.querySelector('.gallery-media');
      if (imgEl && item.imageUrl) {
        try {
          // Use fetchBlurredImageAndCreateOverlay from dashboard.js which handles
          // both blurring the image and creating the appropriate unlock overlay
          if (typeof window.fetchBlurredImageAndCreateOverlay === 'function') {
            window.fetchBlurredImageAndCreateOverlay(imgEl, item.imageUrl);
          } else {
            // Fallback: fetch blurred image via API and create overlay manually
            $.ajax({
              url: '/blur-image?url=' + encodeURIComponent(item.imageUrl),
              method: 'GET',
              xhrFields: { responseType: 'blob' },
              success: function(blob) {
                const objectUrl = URL.createObjectURL(blob);
                $(imgEl).attr('src', objectUrl).data('processed', 'true');
                // Create overlay using dashboard.js createOverlay function
                if (typeof window.createOverlay === 'function') {
                  window.createOverlay(imgEl, item.imageUrl);
                }
              },
              error: function() {
                console.error('[GallerySearchManager] Failed to load blurred image.');
              }
            });
          }
        } catch (e) {
          console.error('[GallerySearchManager] Failed to blur image', e);
        }
      }
    }
    return container;
  }

  /**
   * Setup infinite scroll
   */
  setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
      if (this.shouldLoadMore()) {
        this.loadNextPage();
      }
    });
  }

  /**
   * Check if should load more results
   */
  shouldLoadMore() {
    if (this.isLoading || !this.hasMoreResults) return false;

    const scrollPosition = window.innerHeight + window.scrollY;
    const triggerPosition = document.body.offsetHeight - 500; // Trigger 500px before bottom

    return scrollPosition >= triggerPosition;
  }

  /**
   * Clear gallery
   */
  clearGallery() {
    const gallery = document.getElementById('search-results-gallery');
    if (gallery) {
      gallery.innerHTML = '';
    }
    // Clear loaded images for preview
    this.loadedSearchImages = [];
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    const loadingIndicator = document.getElementById('search-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'block';
    }
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    const loadingIndicator = document.getElementById('search-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const gallery = document.getElementById('search-results-gallery');
    if (!gallery) return;

    const emptyHTML = `
      <div class="col-12 text-center my-5 py-5">
        <i class="bi bi-search fs-1 text-muted mb-3"></i>
        <p class="text-muted">No ${this.currentMediaType}s found for "${this.currentQuery}"</p>
        <p class="text-muted small">Try adjusting your search terms</p>
      </div>
    `;

    gallery.innerHTML = emptyHTML;
  }

  /**
   * Show error state
   */
  showErrorState() {
    const gallery = document.getElementById('search-results-gallery');
    if (!gallery) return;

    const errorHTML = `
      <div class="col-12 text-center my-5 py-5">
        <i class="bi bi-exclamation-triangle fs-1 text-danger mb-3"></i>
        <p class="text-danger">An error occurred while searching</p>
        <p class="text-muted small">Please try again later</p>
      </div>
    `;

    gallery.innerHTML = errorHTML;
  }

  /**
   * Update media toggle buttons
   */
  updateMediaToggleButtons() {
    const buttons = document.querySelectorAll('.media-type-toggle');
    buttons.forEach(button => {
      const mediaType = button.getAttribute('data-media-type');
      if (mediaType === this.currentMediaType) {
        button.classList.add('active');
        button.classList.remove('btn-outline-secondary');
        button.classList.add('btn-primary');
      } else {
        button.classList.remove('active');
        button.classList.remove('btn-primary');
        button.classList.add('btn-outline-secondary');
      }
    });
  }

  /**
   * Update URL without reloading
   */
  updateURL() {
    const url = new URL(window.location);
    url.searchParams.set('q', this.currentQuery);
    url.searchParams.set('type', this.currentMediaType);
    url.searchParams.set('page', '1');
    window.history.replaceState({}, '', url);
  }

  /**
   * Load initial search from URL parameters
   */
  loadFromURL() {
    const url = new URL(window.location);
    const query = url.searchParams.get('q') || '';
    const mediaType = url.searchParams.get('type') || 'image';

    this.currentMediaType = mediaType;
    this.updateMediaToggleButtons();

    const searchInput = document.getElementById('search-query-input');
    if (searchInput) {
      searchInput.value = query;
    }

    if (query) {
      this.performNewSearch(query);
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.gallerySearchManager = new GallerySearchManager();
  window.gallerySearchManager.loadFromURL();
});

// Global handler for subscribed users to reveal NSFW content
window.showNSFWContent = function(button, imageUrl) {
  try {
    if (button && typeof button.preventDefault === 'function') {
      button.preventDefault();
      button.stopPropagation();
    }

    // Find the wrapper and image
    const wrapper = button.closest('.gallery-media-wrapper');
    if (!wrapper) return;

    // Get the image element
    const img = wrapper.querySelector('.gallery-media');
    if (!img) return;

    // Update the image src to the real unblurred image
    img.src = imageUrl;
    img.removeAttribute('filter');
    img.style.filter = 'none';

    // Remove the overlay
    const overlay = wrapper.querySelector('.gallery-nsfw-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('d-flex');
    }

    // Update data attribute
    img.removeAttribute('data-original-url');
  } catch (err) {
    console.error('showNSFWContent error', err);
  }
};

// Global handler to remove the blur overlay and reveal the image
window.handleUnlockOverlay = function(event) {
  try {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
      event.stopPropagation();
    }

    const btn = event && (event.currentTarget || event.target);
    const wrapper = btn ? btn.closest('.gallery-media-wrapper') : null;
    if (!wrapper) return;

    // Remove overlay element
    const overlay = wrapper.querySelector('.img-blur-overlay');
    if (overlay) overlay.remove();

    // Reveal image by removing blur filter
    const img = wrapper.querySelector('.gallery-media');
    if (img) {
      img.style.filter = '';
      img.style.opacity = '1';
    }

    // If image was wrapped in a link that had pointer-events disabled, ensure it's clickable
    const link = wrapper.querySelector('a');
    if (link) {
      link.style.pointerEvents = '';
    }
  } catch (err) {
    // Fail silently but keep dev console informed
    console.error('handleUnlockOverlay error', err);
  }
};

/**
 * Open image preview modal for search gallery images
 * @param {HTMLElement} el - The clicked element
 * @param {number} clickedIndex - The index of the clicked image
 */
window.openSearchImagePreview = function(el, clickedIndex) {
  // Get loaded images from the gallery search manager
  const images = window.gallerySearchManager?.loadedSearchImages || [];
  
  if (images.length === 0) {
    console.warn('[openSearchImagePreview] No images loaded');
    return;
  }
  
  // Create preview modal if it doesn't exist
  if (typeof createPreviewModalIfNeeded === 'function') {
    createPreviewModalIfNeeded();
  } else if (!$('#imagePreviewModal').length) {
    // Fallback modal creation
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
    chatSlug: img.chatSlug,
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
  
  // Show the modal
  const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
  modal.show();
  
  // Initialize swiper after modal is shown
  $('#imagePreviewModal').off('shown.bs.modal.searchGallery').on('shown.bs.modal.searchGallery', function() {
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
          updateSearchPreviewInfo(realIndex);
        },
        init: function() {
          setTimeout(() => {
            const startIndex = window.initialSlideIndex || 0;
            this.slideTo(startIndex, 0);
            updateSearchPreviewInfo(startIndex);
          }, 100);
        }
      }
    });
    
    $('.swiper-slide').show();
  });
};

/**
 * Update the like button and info for search image preview
 */
function updateSearchPreviewInfo(activeIndex) {
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
