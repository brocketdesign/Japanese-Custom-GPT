/**
 * Discovery Grid Module - Phase 5
 * Responsive grid layout with aspect ratio consistency
 * Features: Adaptive columns, CSS aspect-ratio, masonry fallback
 * 
 * @requires DashboardState
 */

const DashboardDiscoveryGrid = (() => {
    const STATE = {
        grids: new Map(), // id -> grid instance
        resizeObserver: null,
        currentBreakpoint: 'desktop'
    };

    /**
     * Initialize grid
     * @param {Object} options - Configuration options
     * @param {string} options.id - Unique grid ID
     * @param {string} options.selector - Container selector
     * @param {Object} options.itemSelector - Item selector (default: '.grid-item')
     * @param {Object} options.aspectRatio - Aspect ratio (default: '1 / 1')
     */
    function init(options = {}) {
        const { id, selector, itemSelector = '.grid-item', aspectRatio = '1 / 1' } = options;

        if (!id) {
            console.error('[DashboardDiscoveryGrid] ID is required');
            return null;
        }

        const element = document.querySelector(selector || `.discovery-grid[data-grid-id="${id}"]`);
        if (!element) {
            console.warn('[DashboardDiscoveryGrid] Grid element not found:', selector);
            return null;
        }

        const gridInstance = {
            id,
            element,
            itemSelector,
            aspectRatio,
            columns: getColumnCount(),
            items: []
        };

        STATE.grids.set(id, gridInstance);

        // Apply CSS grid
        applyGridStyles(element, aspectRatio);

        // Setup responsive listener
        setupResponsiveListener(id, element);

        // Load initial items
        const items = element.querySelectorAll(itemSelector);
        items.forEach(item => {
            gridInstance.items.push(item);
            lazyLoadGridItem(item);
        });

        console.log(`[DashboardDiscoveryGrid] Initialized grid: ${id} (${items.length} items)`);
        return gridInstance;
    }

    /**
     * Apply CSS grid styles
     * @param {Element} element - Grid container
     * @param {string} aspectRatio - Aspect ratio value
     */
    function applyGridStyles(element, aspectRatio) {
        const columns = getColumnCount();
        
        // Apply modern CSS grid
        element.style.display = 'grid';
        element.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        element.style.gap = 'var(--grid-gap, 1.5rem)';
        element.style.padding = 'var(--grid-padding, 1.5rem)';

        // Set aspect ratio on items
        const items = element.querySelectorAll('.grid-item');
        items.forEach(item => {
            item.style.aspectRatio = aspectRatio;
            item.style.overflow = 'hidden';
            item.style.borderRadius = 'var(--radius-lg, 0.75rem)';
        });
    }

    /**
     * Get column count based on viewport width
     * @returns {number}
     */
    function getColumnCount() {
        const width = window.innerWidth;

        if (width < 480) {
            STATE.currentBreakpoint = 'mobile';
            return 1;
        } else if (width < 768) {
            STATE.currentBreakpoint = 'tablet';
            return 2;
        } else if (width < 1024) {
            STATE.currentBreakpoint = 'desktop';
            return 3;
        } else {
            STATE.currentBreakpoint = 'wide';
            return 4;
        }
    }

    /**
     * Setup responsive resize listener
     * @param {string} id - Grid ID
     * @param {Element} element - Grid element
     */
    function setupResponsiveListener(id, element) {
        if (!STATE.resizeObserver) {
            STATE.resizeObserver = new ResizeObserver(throttle(() => {
                const prevBreakpoint = STATE.currentBreakpoint;
                const newColumns = getColumnCount();

                if (STATE.currentBreakpoint !== prevBreakpoint) {
                    // Breakpoint changed, recalculate grid
                    STATE.grids.forEach((grid) => {
                        applyGridStyles(grid.element, grid.aspectRatio);
                    });
                    console.log(`[DashboardDiscoveryGrid] Breakpoint changed: ${prevBreakpoint} → ${STATE.currentBreakpoint}`);
                }
            }, 300));
        }

        STATE.resizeObserver.observe(element);
    }

    /**
     * Lazy load grid item
     * @param {Element} item - Grid item element
     */
    function lazyLoadGridItem(item) {
        const img = item.querySelector('img[data-src]');
        if (!img) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const src = img.dataset.src;
                    img.src = src;
                    img.removeAttribute('data-src');
                    
                    // Add blur-up effect if available
                    if (img.dataset.blur) {
                        img.style.backgroundImage = `url(${img.dataset.blur})`;
                    }
                    
                    observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '50px' });

        observer.observe(item);
    }

    /**
     * Add items to grid
     * @param {string} id - Grid ID
     * @param {Array<Object>} itemsData - Item data
     */
    function addItems(id, itemsData) {
        const grid = STATE.grids.get(id);
        if (!grid) {
            console.warn('[DashboardDiscoveryGrid] Grid not found:', id);
            return;
        }

        itemsData.forEach(data => {
            const item = createGridItem(data, grid.aspectRatio);
            grid.element.appendChild(item);
            grid.items.push(item);
            lazyLoadGridItem(item);
        });

        console.log(`[DashboardDiscoveryGrid] Added ${itemsData.length} items to ${id}`);
    }

    /**
     * Create grid item element
     * @param {Object} data - Item data
     * @param {string} aspectRatio - Aspect ratio
     * @returns {Element}
     */
    function createGridItem(data, aspectRatio) {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.style.aspectRatio = aspectRatio;
        item.style.overflow = 'hidden';
        item.style.borderRadius = 'var(--radius-lg, 0.75rem)';
        item.style.cursor = 'pointer';
        item.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';

        item.innerHTML = `
            <div class="grid-item-image-wrapper">
                <img 
                    data-src="${data.imageUrl || '/images/placeholder.png'}"
                    ${data.blurDataUrl ? `data-blur="${data.blurDataUrl}"` : ''}
                    alt="${escapeHtml(data.title)}"
                    class="grid-item-image"
                />
            </div>
            <div class="grid-item-overlay">
                <div class="grid-item-content">
                    <h3 class="grid-item-title">${escapeHtml(data.title)}</h3>
                    ${data.category ? `<p class="grid-item-category">${escapeHtml(data.category)}</p>` : ''}
                    ${data.badge ? `<span class="grid-item-badge">${escapeHtml(data.badge)}</span>` : ''}
                </div>
                <div class="grid-item-actions">
                    <button class="grid-item-action-btn" data-action="chat" title="Start Chat">
                        <i class="bi bi-chat-left-fill"></i>
                    </button>
                    <button class="grid-item-action-btn" data-action="save" title="Save">
                        <i class="bi bi-bookmark"></i>
                    </button>
                </div>
            </div>
        `;

        // Setup interactions
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'scale(1.05)';
            item.style.boxShadow = 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.2))';
        });

        item.addEventListener('mouseleave', () => {
            item.style.transform = 'scale(1)';
            item.style.boxShadow = 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.1))';
        });

        // Action button handlers
        const actionBtns = item.querySelectorAll('.grid-item-action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (data.actions && data.actions[action]) {
                    data.actions[action](data);
                }
            });
        });

        // Item click handler
        item.addEventListener('click', () => {
            if (data.onClick) {
                data.onClick(data);
            }
        });

        return item;
    }

    /**
     * Clear grid
     * @param {string} id - Grid ID
     */
    function clearItems(id) {
        const grid = STATE.grids.get(id);
        if (!grid) return;

        grid.element.innerHTML = '';
        grid.items = [];
    }

    /**
     * Get grid instance
     * @param {string} id - Grid ID
     * @returns {Object|null}
     */
    function getGrid(id) {
        return STATE.grids.get(id) || null;
    }

    /**
     * Destroy grid
     * @param {string} id - Grid ID
     */
    function destroy(id) {
        const grid = STATE.grids.get(id);
        if (grid) {
            STATE.resizeObserver?.unobserve(grid.element);
            grid.element.innerHTML = '';
            STATE.grids.delete(id);
            console.log(`[DashboardDiscoveryGrid] Destroyed grid: ${id}`);
        }
    }

    /**
     * Destroy all grids
     */
    function destroyAll() {
        STATE.grids.forEach((grid) => {
            STATE.resizeObserver?.unobserve(grid.element);
            grid.element.innerHTML = '';
        });
        STATE.grids.clear();
        console.log('[DashboardDiscoveryGrid] Destroyed all grids');
    }

    /**
     * Get current breakpoint
     * @returns {string}
     */
    function getCurrentBreakpoint() {
        return STATE.currentBreakpoint;
    }

    // ==================== Helper Functions ====================

    function throttle(fn, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return fn(...args);
            }
        };
    }

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

    // ==================== Public API ====================

    return {
        init,
        addItems,
        clearItems,
        getGrid,
        destroy,
        destroyAll,
        getCurrentBreakpoint
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.DashboardDiscoveryGrid = DashboardDiscoveryGrid;
}
