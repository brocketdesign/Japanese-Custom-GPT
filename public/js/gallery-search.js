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
    this.shouldBlurNSFW = this.isTemporary || !this.isSubscribed;

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
        limit: 24
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

    const container = document.createElement('div');
    container.className = 'gallery-grid-item animate__animated';
    container.setAttribute('data-animate', 'animate__fadeInUp');

    // For locked videos, use image thumbnail instead of video
    const mediaUrl = isImage ? item.imageUrl : item.videoUrl;
    const blurredMediaUrl = shouldBlur && !isImage && item.imageUrl ? item.imageUrl : mediaUrl;

    const mediaContent = shouldBlur
      ? `
        <div class="gallery-media-wrapper position-relative" style="overflow: hidden; max-height: 400px; background-color: #f0f0f0;">
          <img src="${blurredMediaUrl}" alt="${item.chatName} - ${item.prompt || ''}" class="gallery-media" style="width: 100%; height: 100%; object-fit: cover; filter: blur(15px);">
          <div class="img-blur-overlay position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
            <button onclick="handleClickRegisterOrPay(event, ${this.isTemporary})">
              <i class="bi bi-lock-fill me-2"></i>Unlock
            </button>
          </div>
        </div>
      `
      : isImage
      ? `
        <a href="${linkUrl}" class="text-decoration-none">
          <div class="gallery-media-wrapper position-relative" style="overflow: hidden; max-height: 400px; background-color: #f0f0f0;">
            <img src="${mediaUrl}" alt="${item.chatName} - ${item.prompt || ''}" class="gallery-media" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        </a>
      `
      : `
        <div class="gallery-media-wrapper position-relative video-wrapper" style="overflow: hidden; max-height: 400px; background-color: #000; display: block;">
          <video style="width: 100%; height: 100%; object-fit: cover; display: block;" controls controlsList="nodownload">
            <source src="${mediaUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </div>
      `;

    const cardHTML = `
      <div class="card shadow-sm border-0 rounded-3 h-100 gallery-card overflow-hidden">
        ${mediaContent}
        <div class="card-body p-3 d-flex flex-column">
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
