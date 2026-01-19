/**
 * Creators Page JavaScript
 * Part of Phase 2: Creator Profile Enhancement
 * 
 * Handles creator discovery, filtering, pagination, and search functionality.
 */

// State management
let creatorsState = {
    page: 1,
    limit: 12,
    category: 'all',
    sortBy: 'popular',
    search: '',
    loading: false,
    hasMore: true
};

/**
 * Initialize the creators page
 * @param {Object} config - Initial configuration
 */
function initCreatorsPage(config = {}) {
    if (config.pagination) {
        creatorsState.page = config.pagination.page || 1;
        creatorsState.hasMore = config.pagination.hasMore || false;
    }
    if (config.category) creatorsState.category = config.category;
    if (config.sortBy) creatorsState.sortBy = config.sortBy;

    // Set up event listeners
    setupEventListeners();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Category filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;
            handleCategoryChange(category);
        });
    });

    // Search input - debounced
    const searchInput = document.getElementById('creatorSearch');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                creatorsState.search = this.value.trim();
                creatorsState.page = 1;
                loadCreators(true);
            }, 500);
        });

        // Enter key search
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                clearTimeout(debounceTimer);
                creatorsState.search = this.value.trim();
                creatorsState.page = 1;
                loadCreators(true);
            }
        });
    }
}

/**
 * Handle category filter change
 * @param {string} category - Selected category
 */
function handleCategoryChange(category) {
    // Update active state
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });

    creatorsState.category = category;
    creatorsState.page = 1;
    loadCreators(true);
}

/**
 * Handle sort change
 */
function handleSortChange() {
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        creatorsState.sortBy = sortSelect.value;
        creatorsState.page = 1;
        loadCreators(true);
    }
}

/**
 * Search creators (called from search button)
 */
function searchCreators() {
    const searchInput = document.getElementById('creatorSearch');
    if (searchInput) {
        creatorsState.search = searchInput.value.trim();
        creatorsState.page = 1;
        loadCreators(true);
    }
}

/**
 * Load creators from API
 * @param {boolean} replace - Whether to replace existing creators or append
 */
async function loadCreators(replace = false) {
    if (creatorsState.loading) return;

    creatorsState.loading = true;
    showLoading(true);

    try {
        const params = new URLSearchParams({
            page: creatorsState.page,
            limit: creatorsState.limit,
            sortBy: creatorsState.sortBy
        });

        if (creatorsState.category && creatorsState.category !== 'all') {
            params.append('category', creatorsState.category);
        }

        if (creatorsState.search) {
            params.append('search', creatorsState.search);
        }

        const response = await fetch(`/api/creators?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
            renderCreators(data.creators, replace);
            creatorsState.hasMore = data.pagination.hasMore;
            updatePagination(data.pagination);
        } else {
            console.error('Failed to load creators:', data.error);
            showError('Failed to load creators');
        }
    } catch (error) {
        console.error('Error loading creators:', error);
        showError('Failed to load creators');
    } finally {
        creatorsState.loading = false;
        showLoading(false);
    }
}

/**
 * Load more creators (pagination)
 */
function loadMoreCreators() {
    if (creatorsState.loading || !creatorsState.hasMore) return;

    creatorsState.page++;
    loadCreators(false);
}

/**
 * Render creators to the grid
 * @param {Array} creators - Array of creator objects
 * @param {boolean} replace - Whether to replace or append
 */
function renderCreators(creators, replace = false) {
    const grid = document.getElementById('creatorsGrid');
    const emptyState = document.getElementById('emptyState');

    if (!grid) return;

    if (replace) {
        grid.innerHTML = '';
    }

    if (creators.length === 0 && replace) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    creators.forEach(creator => {
        const card = createCreatorCard(creator);
        grid.appendChild(card);
    });
}

/**
 * Create a creator card element
 * @param {Object} creator - Creator data
 * @returns {HTMLElement} Creator card element
 */
function createCreatorCard(creator) {
    const card = document.createElement('a');
    card.href = `/user/${creator._id}`;
    card.className = 'creator-card-grid';
    
    const coverStyle = creator.coverImage ? `background-image: url('${creator.coverImage}')` : '';
    const verifiedBadge = creator.verified ? `
        <div class="verified-badge-small">
            <i class="bi bi-patch-check-fill"></i>
        </div>
    ` : '';

    const bio = creator.bio ? `<p class="card-bio">${escapeHtml(creator.bio)}</p>` : '';
    
    const tags = creator.tags && creator.tags.length > 0 ? `
        <div class="card-tags">
            ${creator.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
    ` : '';

    card.innerHTML = `
        <div class="card-cover" style="${coverStyle}">
            <div class="cover-overlay"></div>
            ${verifiedBadge}
        </div>
        <div class="card-body">
            <div class="card-avatar">
                <img src="${creator.profileUrl || '/img/avatar.png'}" alt="${escapeHtml(creator.displayName)}" onerror="this.src='/img/avatar.png'">
            </div>
            <h3 class="card-name">${escapeHtml(creator.displayName)}</h3>
            <span class="card-category">${escapeHtml(creator.categoryLabel || 'Creator')}</span>
            ${bio}
            <div class="card-stats">
                <div class="stat">
                    <i class="bi bi-people-fill"></i>
                    <span>${formatNumber(creator.followerCount || 0)}</span>
                </div>
                <div class="stat">
                    <i class="bi bi-chat-dots-fill"></i>
                    <span>${formatNumber(creator.chatCount || 0)}</span>
                </div>
                <div class="stat">
                    <i class="bi bi-heart-fill"></i>
                    <span>${formatNumber(creator.imageLikeCount || 0)}</span>
                </div>
            </div>
            ${tags}
        </div>
    `;

    return card;
}

/**
 * Update pagination UI
 * @param {Object} pagination - Pagination data
 */
function updatePagination(pagination) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;

    if (pagination.hasMore) {
        container.innerHTML = `
            <button class="load-more-btn" onclick="loadMoreCreators()">
                <i class="bi bi-arrow-down-circle me-2"></i>
                Load More
            </button>
        `;
    } else if (pagination.page > 1) {
        container.innerHTML = `
            <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem;">
                You've reached the end
            </p>
        `;
    } else {
        container.innerHTML = '';
    }
}

/**
 * Show/hide loading state
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
    const loadingState = document.getElementById('loadingState');
    const loadMoreBtn = document.querySelector('.load-more-btn');

    if (loadingState) {
        loadingState.style.display = show ? 'block' : 'none';
    }

    if (loadMoreBtn) {
        loadMoreBtn.disabled = show;
        if (show) {
            loadMoreBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Loading...';
        } else {
            loadMoreBtn.innerHTML = '<i class="bi bi-arrow-down-circle me-2"></i>Load More';
        }
    }
}

/**
 * Show error message
 * @param {string} message - Error message
 */
function showError(message) {
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message,
            confirmButtonColor: '#8240FF'
        });
    } else {
        alert(message);
    }
}

/**
 * Format number with K/M suffix
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally
window.initCreatorsPage = initCreatorsPage;
window.handleCategoryChange = handleCategoryChange;
window.handleSortChange = handleSortChange;
window.searchCreators = searchCreators;
window.loadMoreCreators = loadMoreCreators;
