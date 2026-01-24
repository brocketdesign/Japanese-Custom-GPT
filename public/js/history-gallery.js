/**
 * History Gallery - Client-side functionality
 */

(function() {
    'use strict';

    let currentPage = 1;
    let currentFilter = 'all';
    let currentCharacter = '';
    let allContent = [];
    let groupedByCharacter = {};
    let isLoading = false;
    let hasMore = true;

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', function() {
        initializeFilters();
        loadHistory();
        
        // Check if we should open a modal from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const openModal = urlParams.get('openModal');
        if (openModal) {
            const [contentType, contentId] = openModal.split('/');
            if (contentId) {
                // Wait a bit for the page to load, then open modal
                setTimeout(() => {
                    openContentModal({
                        _id: contentId,
                        contentType: contentType
                    });
                    // Clean up URL
                    window.history.replaceState({}, document.title, '/history');
                }, 500);
            }
        }
    });

    /**
     * Initialize filter buttons
     */
    function initializeFilters() {
        // Filter buttons
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', function() {
                const filter = this.getAttribute('data-filter');
                setActiveFilter(filter);
                currentFilter = filter;
                currentPage = 1;
                loadHistory();
            });
        });

        // Character filter dropdown
        const characterFilter = document.getElementById('characterFilter');
        if (characterFilter) {
            characterFilter.addEventListener('change', function() {
                currentCharacter = this.value;
                currentPage = 1;
                loadHistory();
            });
        }

        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function() {
                currentPage++;
                loadHistory(true); // append mode
            });
        }
    }

    /**
     * Set active filter button
     */
    function setActiveFilter(filter) {
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.filter-btn[data-filter="${filter}"]`)?.classList.add('active');
    }

    /**
     * Load history content from API
     */
    function loadHistory(append = false) {
        if (isLoading) return;
        
        isLoading = true;
        const contentGrid = document.getElementById('contentGrid');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        const emptyState = document.getElementById('emptyState');

        if (!append) {
            contentGrid.innerHTML = '<div class="loading-spinner"><i class="bi bi-hourglass-split"></i><p>Loading your content...</p></div>';
        }

        // Build query params
        const params = new URLSearchParams({
            page: currentPage,
            limit: 24
        });

        if (currentCharacter) {
            params.append('character', currentCharacter);
        }

        // Fetch from API
        fetch(`/api/user/history?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                isLoading = false;

                if (!append) {
                    allContent = data.content || [];
                    groupedByCharacter = data.groupedByCharacter || {};
                } else {
                    allContent = allContent.concat(data.content || []);
                }

                hasMore = data.page < data.totalPages;

                // Update character filter dropdown
                updateCharacterDropdown(groupedByCharacter);

                // Apply client-side filtering
                let filteredContent = filterContent(allContent);

                // Render content
                if (filteredContent.length === 0 && !append) {
                    contentGrid.innerHTML = '';
                    emptyState.style.display = 'block';
                    loadMoreContainer.style.display = 'none';
                } else {
                    emptyState.style.display = 'none';
                    if (!append) {
                        contentGrid.innerHTML = '';
                    } else {
                        // Remove loading spinner if it exists
                        const spinner = contentGrid.querySelector('.loading-spinner');
                        if (spinner) spinner.remove();
                    }
                    renderContent(filteredContent, append);
                    
                    // Show/hide load more button
                    if (hasMore) {
                        loadMoreContainer.style.display = 'block';
                    } else {
                        loadMoreContainer.style.display = 'none';
                    }
                }
            })
            .catch(error => {
                console.error('Error loading history:', error);
                isLoading = false;
                contentGrid.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><h3>Error loading content</h3><p>Please try again later</p></div>';
            });
    }

    /**
     * Filter content based on current filter
     */
    function filterContent(content) {
        let filtered = content;

        // Filter by type
        if (currentFilter === 'images') {
            filtered = filtered.filter(item => item.contentType === 'image');
        } else if (currentFilter === 'videos') {
            filtered = filtered.filter(item => item.contentType === 'video');
        } else if (currentFilter === 'recent') {
            // Show content from last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            filtered = filtered.filter(item => {
                const createdAt = new Date(item.createdAt);
                return createdAt >= sevenDaysAgo;
            });
        }

        return filtered;
    }

    /**
     * Render content items
     */
    function renderContent(content, append = false) {
        const contentGrid = document.getElementById('contentGrid');
        
        content.forEach(item => {
            const contentItem = createContentItem(item);
            contentGrid.appendChild(contentItem);
        });
    }

    /**
     * Create a content item element
     */
    function createContentItem(item) {
        const div = document.createElement('div');
        div.className = 'content-item';
        div.setAttribute('data-content-id', item._id);
        div.setAttribute('data-content-type', item.contentType);

        // Check if recent (last 24 hours)
        const isRecent = isContentRecent(item.createdAt);
        
        // Image or video thumbnail
        const imageUrl = item.contentType === 'video' ? item.imageUrl : item.imageUrl || item.url;
        
        div.innerHTML = `
            <img src="${imageUrl}" alt="${item.prompt || 'Generated content'}" loading="lazy">
            ${item.contentType === 'video' ? '<div class="video-overlay"><i class="bi bi-play-fill"></i></div>' : ''}
            ${isRecent ? '<span class="content-badge badge-recent"><i class="bi bi-star-fill"></i> New</span>' : ''}
        `;

        div.addEventListener('click', () => {
            openContentModal(item);
        });

        return div;
    }

    /**
     * Check if content is recent (within 24 hours)
     */
    function isContentRecent(createdAt) {
        const now = new Date();
        const created = new Date(createdAt);
        const hoursDiff = (now - created) / (1000 * 60 * 60);
        return hoursDiff <= 24;
    }

    /**
     * Update character filter dropdown
     */
    function updateCharacterDropdown(grouped) {
        const dropdown = document.getElementById('characterFilter');
        if (!dropdown) return;

        // Keep the "All Characters" option
        dropdown.innerHTML = '<option value="">All Characters</option>';

        // Add character options
        Object.values(grouped).forEach(group => {
            if (group.characterName && group.characterName !== 'Unknown') {
                const option = document.createElement('option');
                option.value = group.chatId;
                option.textContent = `${group.characterName} (${group.count})`;
                dropdown.appendChild(option);
            }
        });
    }

    /**
     * Open content detail modal
     */
    function openContentModal(item) {
        const modal = new bootstrap.Modal(document.getElementById('contentModal'));
        const modalContentArea = document.getElementById('modalContentArea');

        // Show loading state
        modalContentArea.innerHTML = '<div class="text-center p-4"><i class="bi bi-hourglass-split"></i> Loading details...</div>';
        modal.show();

        // Fetch detailed info
        const contentType = item.contentType || 'image';
        fetch(`/gallery/content/${item._id}/info?type=${contentType}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    renderModalContent(data.data, data.contentType);
                } else {
                    modalContentArea.innerHTML = '<div class="alert alert-danger">Failed to load content details</div>';
                }
            })
            .catch(error => {
                console.error('Error loading content details:', error);
                modalContentArea.innerHTML = '<div class="alert alert-danger">Error loading content details</div>';
            });
    }

    /**
     * Render content details in modal
     */
    function renderModalContent(data, contentType) {
        const modalContentArea = document.getElementById('modalContentArea');
        const content = data.content || data.image || data.video;
        const chat = data.chat;
        const request = data.request;

        let html = '';

        // Media display
        if (contentType === 'video') {
            html += `
                <div class="mb-4">
                    <video controls class="w-100" style="border-radius: 12px; max-height: 500px;">
                        <source src="${content.videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else {
            html += `
                <div class="mb-4 text-center">
                    <img src="${content.imageUrl}" alt="Generated image" class="img-fluid" style="border-radius: 12px; max-height: 500px;">
                </div>
            `;
        }

        // Character info
        if (chat) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Character</div>
                    <div class="detail-value">
                        <a href="/chat/${chat.slug}" class="text-decoration-none" style="color: #b58afe;">
                            ${chat.name}
                        </a>
                    </div>
                </div>
            `;
        }

        // Prompt
        if (content.prompt) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Prompt</div>
                    <div class="detail-value">${content.prompt}</div>
                </div>
            `;
        }

        // Creation date
        if (content.createdAt) {
            const createdDate = new Date(content.createdAt);
            html += `
                <div class="detail-item">
                    <div class="detail-label">Created</div>
                    <div class="detail-value">${createdDate.toLocaleString()}</div>
                </div>
            `;
        }

        // Image-specific details
        if (contentType === 'image') {
            if (content.seed !== null && content.seed !== undefined) {
                html += `
                    <div class="detail-item">
                        <div class="detail-label">Seed</div>
                        <div class="detail-value">${content.seed}</div>
                    </div>
                `;
            }

            if (content.aspectRatio) {
                html += `
                    <div class="detail-item">
                        <div class="detail-label">Aspect Ratio</div>
                        <div class="detail-value">${content.aspectRatio}</div>
                    </div>
                `;
            }

            if (request) {
                if (request.model_name) {
                    html += `
                        <div class="detail-item">
                            <div class="detail-label">Model</div>
                            <div class="detail-value">${request.model_name}</div>
                        </div>
                    `;
                }

                if (request.steps) {
                    html += `
                        <div class="detail-item">
                            <div class="detail-label">Steps</div>
                            <div class="detail-value">${request.steps}</div>
                        </div>
                    `;
                }

                if (request.guidance_scale) {
                    html += `
                        <div class="detail-item">
                            <div class="detail-label">Guidance Scale</div>
                            <div class="detail-value">${request.guidance_scale}</div>
                        </div>
                    `;
                }
            }
        }

        // Video-specific details
        if (contentType === 'video' && content.duration) {
            html += `
                <div class="detail-item">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${content.duration}s</div>
                </div>
            `;
        }

        modalContentArea.innerHTML = html;
    }

    // Make functions globally accessible if needed
    window.historyGallery = {
        loadHistory,
        openContentModal
    };

})();
