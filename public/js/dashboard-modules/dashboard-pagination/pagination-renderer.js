/**
 * Pagination Renderer - Generate pagination UI
 * Replaces all generate*Pagination functions in dashboard.js
 * Creates pagination controls for galleries
 * 
 * @module PaginationRenderer
 * @requires PaginationManager
 * 
 * Phase: 3 (Pagination & Content Filtering)
 * Status: Production Ready
 */

const PaginationRenderer = (() => {

    /**
     * Generate pagination HTML with numbered buttons
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {object} options - Rendering options
     * @param {string} options.className - CSS class for container (default: 'pagination')
     * @param {number} options.maxButtons - Max visible page buttons (default: 5)
     * @param {boolean} options.showFirst - Show first/last buttons (default: true)
     * @param {string} options.prevText - Previous button text (default: '←')
     * @param {string} options.nextText - Next button text (default: '→')
     * @returns {string} HTML string
     */
    function generateHTML(currentPage, totalPages, options = {}) {
        const {
            className = 'pagination',
            maxButtons = 5,
            showFirst = true,
            prevText = '←',
            nextText = '→'
        } = options;

        if (totalPages <= 1) return '';

        let html = `<nav class="${className}" aria-label="Pagination">`;
        html += '<ul class="pagination-list">';

        // Previous button
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        html += `<li><button class="pagination-btn pagination-prev ${prevDisabled}" data-page="prev" aria-label="Previous page">${prevText}</button></li>`;

        // First page button
        if (showFirst && currentPage > Math.ceil(maxButtons / 2)) {
            html += `<li><button class="pagination-btn" data-page="1">1</button></li>`;
            if (currentPage > Math.ceil(maxButtons / 2) + 1) {
                html += `<li><span class="pagination-dots">...</span></li>`;
            }
        }

        // Page number buttons
        const startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        const endPage = Math.min(totalPages, startPage + maxButtons - 1);
        const adjustedStart = Math.max(1, endPage - maxButtons + 1);

        for (let i = adjustedStart; i <= endPage; i++) {
            const isActive = i === currentPage ? 'active' : '';
            html += `<li><button class="pagination-btn ${isActive}" data-page="${i}">${i}</button></li>`;
        }

        // Last page button
        if (showFirst && currentPage < totalPages - Math.ceil(maxButtons / 2)) {
            if (currentPage < totalPages - Math.ceil(maxButtons / 2) - 1) {
                html += `<li><span class="pagination-dots">...</span></li>`;
            }
            html += `<li><button class="pagination-btn" data-page="${totalPages}">${totalPages}</button></li>`;
        }

        // Next button
        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        html += `<li><button class="pagination-btn pagination-next ${nextDisabled}" data-page="next" aria-label="Next page">${nextText}</button></li>`;

        html += '</ul></nav>';
        return html;
    }

    /**
     * Render pagination to a specific container
     * @param {string} containerId - DOM element ID
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     * @param {object} options - Rendering options
     * @returns {boolean} Success status
     */
    function renderTo(containerId, currentPage, totalPages, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`[PaginationRenderer] Container not found: ${containerId}`);
            return false;
        }

        const html = generateHTML(currentPage, totalPages, options);
        container.innerHTML = html;

        // Attach click handlers
        attachEventListeners(container);

        return true;
    }

    /**
     * Update pagination UI without re-rendering everything
     * @param {string} containerId - DOM element ID
     * @param {number} currentPage - Current page number
     * @param {number} totalPages - Total number of pages
     */
    function update(containerId, currentPage, totalPages) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Update active button
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.page) === currentPage) {
                btn.classList.add('active');
            }
        });

        // Update disabled states
        const prevBtn = container.querySelector('.pagination-prev');
        const nextBtn = container.querySelector('.pagination-next');
        
        if (prevBtn) {
            prevBtn.classList.toggle('disabled', currentPage === 1);
        }
        if (nextBtn) {
            nextBtn.classList.toggle('disabled', currentPage === totalPages);
        }
    }

    /**
     * Attach click event listeners to pagination buttons
     * @param {HTMLElement} container - Pagination container element
     * @private
     */
    function attachEventListeners(container) {
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const pageValue = btn.dataset.page;

                // Trigger custom event that gallery modules can listen to
                const event = new CustomEvent('pagination-click', {
                    detail: { page: pageValue, container: container },
                    bubbles: true
                });
                container.dispatchEvent(event);
            });
        });
    }

    /**
     * Generate compact pagination (for mobile)
     * Shows only prev/next and page indicator
     * @param {number} currentPage - Current page
     * @param {number} totalPages - Total pages
     * @param {object} options - Options
     * @returns {string} HTML string
     */
    function generateCompact(currentPage, totalPages, options = {}) {
        const { className = 'pagination pagination-compact' } = options;

        if (totalPages <= 1) return '';

        let html = `<div class="${className}">`;
        html += `<button class="pagination-btn pagination-prev" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;
        html += `<span class="pagination-info">${currentPage} / ${totalPages}</span>`;
        html += `<button class="pagination-btn pagination-next" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>→</button>`;
        html += '</div>';

        return html;
    }

    /**
     * Generate infinite scroll trigger element
     * @param {object} options - Options
     * @returns {string} HTML string
     */
    function generateInfiniteScrollTrigger(options = {}) {
        const { id = 'pagination-infinite-scroll', className = 'pagination-infinite-trigger' } = options;
        return `<div id="${id}" class="${className}" aria-label="Loading more items"></div>`;
    }

    /**
     * Get pagination info from button click
     * @param {object} event - Click event from pagination button
     * @returns {object} Pagination action info
     */
    function getActionFromEvent(event) {
        const btn = event.target.closest('.pagination-btn');
        if (!btn) return null;

        const pageValue = btn.dataset.page;
        return {
            action: pageValue === 'next' || pageValue === 'prev' ? pageValue : 'goto',
            page: parseInt(pageValue) || null
        };
    }

    // Public API
    return {
        generateHTML,
        renderTo,
        update,
        generateCompact,
        generateInfiniteScrollTrigger,
        getActionFromEvent
    };
})();
