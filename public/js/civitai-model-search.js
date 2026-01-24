/**
 * Image Model Search & User Model Preferences
 * Handles searching for image models, adding custom models to user collection,
 * and managing user model preferences.
 */
(function() {
    'use strict';

    // State
    let userModels = [];
    let userPreferredModelId = null;
    let searchDebounceTimer = null;
    let civitaiSearchModal = null;
    let isPremiumUser = false;

    // Initialize on DOM ready
    $(document).ready(function() {
        // Check premium status
        isPremiumUser = window.user?.subscriptionStatus === 'active';
        
        initializeCivitaiSearch();
        loadUserModels();
        loadUserModelPreference();
        updatePremiumUI();
    });

    /**
     * Update UI based on premium status
     */
    function updatePremiumUI() {
        if (!isPremiumUser) {
            // Show premium notice for non-subscribers
            $('#customModelsPremiumNotice').show();
            // Hide the add button for non-premium users
            $('#addCustomModelBtn').hide();
        } else {
            $('#customModelsPremiumNotice').hide();
            $('#addCustomModelBtn').show();
        }
    }

    /**
     * Initialize image model search functionality
     */
    function initializeCivitaiSearch() {
        // Initialize modal
        const modalElement = document.getElementById('civitaiSearchModal');
        if (modalElement) {
            civitaiSearchModal = new bootstrap.Modal(modalElement);
            
            // Handle close button
            $('#closeImageModelSearchModal').on('click', function() {
                if (civitaiSearchModal) {
                    civitaiSearchModal.hide();
                }
            });
        }

        // Add custom model button click - only for premium users
        $(document).on('click', '#addCustomModelBtn', function() {
            if (!isPremiumUser) {
                loadPlanPage();
                return;
            }
            
            $('#civitaiModalSearch').val('');
            $('#civitaiSearchResultsList').empty();
            $('#civitaiSearchPlaceholder').removeClass('d-none');
            $('#civitaiNoResults').addClass('d-none');
            if (civitaiSearchModal) {
                civitaiSearchModal.show();
            }
        });

        // Modal search input
        $('#civitaiModalSearch').on('keypress', function(e) {
            if (e.which === 13) {
                e.preventDefault();
                performCivitaiSearch($(this).val().trim());
            }
        });

        // Modal search button click
        $('#civitaiModalSearchBtn').on('click', function() {
            performCivitaiSearch($('#civitaiModalSearch').val().trim());
        });

        // Right-click on system models to set as preferred
        $(document).on('contextmenu', '.system-model-card .style-option', function(e) {
            e.preventDefault();
            const modelId = $(this).data('id');
            const modelName = $(this).data('name') || $(this).data('model');
            setPreferredModel(modelId, modelName, false);
        });
    }

    /**
     * Open search modal with pre-filled query (for premium users only)
     */
    function openSearchModalWithQuery(query) {
        if (!isPremiumUser) {
            loadPlanPage();
            return;
        }
        
        if (civitaiSearchModal) {
            $('#civitaiModalSearch').val(query);
            civitaiSearchModal.show();
            if (query.length >= 2) {
                performCivitaiSearch(query);
            }
        }
    }

    /**
     * Perform Civitai search
     */
    async function performCivitaiSearch(query) {
        if (!query || query.length < 2) {
            showNotification('Please enter at least 2 characters', 'warning');
            return;
        }

        // Show loading state
        $('#civitaiSearchPlaceholder').addClass('d-none');
        $('#civitaiNoResults').addClass('d-none');
        $('#civitaiSearchLoading').removeClass('d-none');
        $('#civitaiSearchResultsList').empty();

        try {
            const includeNsfw = window.user?.showNSFW || false;
            const response = await $.ajax({
                url: '/api/civitai/search',
                method: 'GET',
                data: {
                    query: query,
                    nsfw: includeNsfw,
                    limit: 20
                }
            });

            $('#civitaiSearchLoading').addClass('d-none');

            if (response.success && response.models && response.models.length > 0) {
                renderSearchResults(response.models);
            } else {
                $('#civitaiNoResults').removeClass('d-none');
            }
        } catch (error) {
            console.error('Error searching Civitai:', error);
            $('#civitaiSearchLoading').addClass('d-none');
            $('#civitaiNoResults').removeClass('d-none');
            showNotification('Failed to search Civitai models', 'error');
        }
    }

    /**
     * Render search results
     */
    function renderSearchResults(models) {
        const $container = $('#civitaiSearchResultsList');
        $container.empty();

        models.forEach(model => {
            const previewImage = model.previewImage || model.cover_url || '/img/default-model.png';
            const rating = model.stats?.rating ? Number(model.stats.rating).toFixed(1) : 'N/A';
            const downloads = formatNumber(model.stats?.downloadCount || 0);
            const favorites = formatNumber(model.stats?.favoriteCount || 0);
            
            // Check if model already exists in user's collection
            const isAdded = userModels.some(m => m.civitaiModelId === model.id.toString());

            // For Novita API, use sd_name as the file name
            const sdName = model.sd_name || model.name;
            const baseModel = model.base_model || model.modelVersions?.[0]?.baseModel || 'SD 1.5';

            const versionsHtml = model.modelVersions?.map((v, idx) => {
                const file = v.files?.[0];
                const fileName = file?.name || sdName;
                return `<option value="${v.id}" 
                    data-name="${escapeHtml(v.name)}" 
                    data-file="${escapeHtml(fileName)}"
                    data-base="${escapeHtml(v.baseModel || baseModel)}">
                    ${escapeHtml(v.name)} ${v.baseModel ? `(${v.baseModel})` : ''}
                </option>`;
            }).join('') || `<option value="${model.id}" data-name="Default" data-file="${escapeHtml(sdName)}" data-base="${escapeHtml(baseModel)}">Default (${baseModel})</option>`;

            const tagsHtml = model.tags?.slice(0, 3).map(tag => 
                `<span class="badge bg-light text-dark">${escapeHtml(tag)}</span>`
            ).join('') || '';

            const cardHtml = `
                <div class="civitai-model-card d-flex gap-3 ${isAdded ? 'opacity-50' : ''}" data-model-id="${model.id}" data-sd-name="${escapeHtml(sdName)}">
                    <img src="${previewImage}" class="civitai-model-image" alt="${escapeHtml(model.name)}" 
                         onerror="this.src='/img/default-model.png'">
                    <div class="civitai-model-info">
                        <div class="civitai-model-name">${escapeHtml(model.name)}</div>
                        <small class="text-muted d-block text-truncate" style="max-width: 200px;" title="${escapeHtml(sdName)}">${escapeHtml(sdName)}</small>
                        <div class="civitai-model-stats">
                            <span class="me-2"><i class="bi bi-download"></i> ${downloads}</span>
                            <span class="me-2"><i class="bi bi-heart"></i> ${favorites}</span>
                            <span><i class="bi bi-star"></i> ${rating}</span>
                        </div>
                        <div class="civitai-model-tags">${tagsHtml}</div>
                        
                        ${model.modelVersions?.length > 0 ? `
                        <div class="mt-2">
                            <select class="form-select form-select-sm version-select-dropdown" data-model-id="${model.id}">
                                ${versionsHtml}
                            </select>
                        </div>
                        ` : ''}
                        
                        <div class="mt-2">
                            ${isAdded ? 
                                `<span class="text-success small"><i class="bi bi-check-circle"></i> ${translations.newCharacter?.modelAlreadyExists || 'Already added'}</span>` :
                                `<button class="btn btn-sm btn-primary add-civitai-model-btn" 
                                    data-model-id="${model.id}"
                                    data-model-name="${escapeHtml(model.name)}"
                                    data-model-image="${previewImage}"
                                    data-model-style="${model.tags?.[0] || ''}">
                                    <i class="bi bi-plus-lg me-1"></i>${translations.newCharacter?.addModel || 'Add Model'}
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            `;

            $container.append(cardHtml);
        });

        // Handle add model button clicks
        $container.find('.add-civitai-model-btn').on('click', function(e) {
            e.stopPropagation();
            const $btn = $(this);
            const $card = $btn.closest('.civitai-model-card');
            const modelId = $btn.data('model-id');
            const modelName = $btn.data('model-name');
            const modelImage = $btn.data('model-image');
            const modelStyle = $btn.data('model-style');
            
            // Get sd_name from card data attribute (set from Novita API)
            const cardSdName = $card.data('sd-name');
            
            // Get selected version info (if version dropdown exists)
            const $select = $card.find('.version-select-dropdown');
            const versionId = $select.val() || modelId;
            const $selectedOption = $select.find('option:selected');
            const versionName = $selectedOption.data('name') || 'Default';
            const fileName = $selectedOption.data('file') || cardSdName || modelName;
            const baseModel = $selectedOption.data('base') || 'SD 1.5';

            addUserModel({
                civitaiModelId: modelId,
                civitaiVersionId: versionId,
                modelName: modelName,
                versionName: versionName,
                fileName: fileName,
                image: modelImage,
                style: modelStyle,
                baseModel: baseModel
            }, $btn);
        });
    }

    /**
     * Add model to user's collection
     */
    async function addUserModel(modelData, $btn) {
        try {
            $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span>');

            const response = await $.ajax({
                url: '/api/user/models',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(modelData)
            });

            if (response.success) {
                userModels.push(response.model);
                renderUserModels();
                updateCustomModelsCount();
                
                // Update button state
                $btn.replaceWith(`<span class="text-success small"><i class="bi bi-check-circle"></i> ${translations.newCharacter?.modelAdded || 'Added'}</span>`);
                $btn.closest('.civitai-model-card').addClass('opacity-50');
                
                showNotification(translations.newCharacter?.modelAdded || 'Model added successfully', 'success');
                
                // Notify generation dashboard if it exists
                if (window.genDashboard && typeof window.genDashboard.loadUserModels === 'function') {
                    await window.genDashboard.loadUserModels();
                }
            }
        } catch (error) {
            console.error('Error adding model:', error);
            $btn.prop('disabled', false).html(`<i class="bi bi-plus-lg me-1"></i>${translations.newCharacter?.addModel || 'Add Model'}`);
            showNotification(error.responseJSON?.error || 'Failed to add model', 'error');
        }
    }

    /**
     * Remove model from user's collection
     */
    async function removeUserModel(modelId) {
        try {
            const response = await $.ajax({
                url: `/api/user/models/${modelId}`,
                method: 'DELETE'
            });

            if (response.success) {
                userModels = userModels.filter(m => m._id !== modelId);
                renderUserModels();
                updateCustomModelsCount();
                showNotification(translations.newCharacter?.modelRemoved || 'Model removed', 'success');
            }
        } catch (error) {
            console.error('Error removing model:', error);
            showNotification('Failed to remove model', 'error');
        }
    }

    /**
     * Load user's custom models
     */
    async function loadUserModels() {
        try {
            const response = await $.ajax({
                url: '/api/user/models',
                method: 'GET'
            });

            if (response.success) {
                userModels = response.models || [];
                renderUserModels();
                updateCustomModelsCount();
            }
        } catch (error) {
            console.error('Error loading user models:', error);
        }
    }

    /**
     * Render user's custom models in the custom models pane
     */
    function renderUserModels() {
        const $container = $('#userCustomModels');
        
        // Keep the add button, remove other model cards
        $container.find('.user-model-card').remove();

        userModels.forEach(model => {
            const isPreferred = model.modelId === userPreferredModelId;
            const modelHtml = `
                <div class="user-model-card position-relative me-2" data-model-id="${model._id}">
                    <button class="remove-btn" data-model-id="${model._id}" title="${translations.newCharacter?.removeModel || 'Remove'}">
                        <i class="bi bi-x"></i>
                    </button>
                    ${isPreferred ? '<i class="bi bi-star-fill preferred-indicator"></i>' : ''}
                    <img src="${model.image || '/img/default-model.png'}" 
                        alt="${escapeHtml(model.name)}" 
                        class="style-option rounded user-custom-model-option" 
                        data-id="${model.modelId}" 
                        data-style="${model.style || 'general'}" 
                        data-model="${model.model}" 
                        data-version="${model.version}"
                        data-is-user-model="true"
                        data-name="${escapeHtml(model.name)}"
                        style="width: 80px; height: 80px; object-fit: cover; cursor: pointer;"
                        onerror="this.src='/img/default-model.png'">
                </div>
            `;
            $container.append(modelHtml);
        });

        // Attach click handlers for user model selection
        $container.find('.user-custom-model-option').off('click').on('click', function() {
            selectModel($(this), true);
        });

        // Attach remove button handlers
        $container.find('.remove-btn').off('click').on('click', function(e) {
            e.stopPropagation();
            const modelId = $(this).data('model-id');
            if (confirm('Remove this model from your collection?')) {
                removeUserModel(modelId);
            }
        });

        // Right-click to set as preferred
        $container.find('.user-custom-model-option').off('contextmenu').on('contextmenu', function(e) {
            e.preventDefault();
            const modelId = $(this).data('id');
            const modelName = $(this).data('name');
            setPreferredModel(modelId, modelName, true);
        });
    }

    /**
     * Update custom models count badge
     */
    function updateCustomModelsCount() {
        $('#customModelsCount').text(userModels.length);
    }

    /**
     * Select a model (system or user)
     */
    function selectModel($element, isUserModel = false) {
        // Remove selection from all models in both tabs
        $('#imageStyleSelectionCharacterCreation .style-option').removeClass('selected');
        $('#userCustomModels .style-option').removeClass('selected');
        
        // Add selection to clicked model
        $element.addClass('selected');
        
        // Update hidden form fields
        $('#modelId').val($element.data('id'));
        $('#imageStyle').val($element.data('style'));
        $('#imageModel').val($element.data('model'));
        $('#imageVersion').val($element.data('version'));
        $('#isUserModel').val(isUserModel ? 'true' : 'false');
        
        // Store in localStorage for persistence
        localStorage.setItem('imageModelId', $element.data('id'));
        localStorage.setItem('isUserModel', isUserModel ? 'true' : 'false');
    }

    /**
     * Load user's model preference
     */
    async function loadUserModelPreference() {
        try {
            const response = await $.ajax({
                url: '/api/user/model-preference',
                method: 'GET'
            });

            if (response.success && response.preference.modelId) {
                userPreferredModelId = response.preference.modelId;
                
                // If user has a preferred model, try to select it
                setTimeout(() => {
                    const $preferredModel = $(`.style-option[data-id="${userPreferredModelId}"]`);
                    if ($preferredModel.length) {
                        selectModel($preferredModel, response.preference.isUserModel);
                        
                        // Switch to the correct tab
                        if (response.preference.isUserModel) {
                            $('#custom-models-tab').tab('show');
                        }
                    }
                }, 500);
            }
        } catch (error) {
            console.error('Error loading model preference:', error);
        }
    }

    /**
     * Set preferred model
     */
    async function setPreferredModel(modelId, modelName, isUserModel) {
        try {
            const response = await $.ajax({
                url: '/api/user/model-preference',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    modelId: modelId,
                    modelName: modelName,
                    isUserModel: isUserModel
                })
            });

            if (response.success) {
                userPreferredModelId = modelId;
                renderUserModels();
                showNotification(translations.newCharacter?.preferredModel + ' ' + (modelName || 'set'), 'success');
            }
        } catch (error) {
            console.error('Error setting preferred model:', error);
            showNotification('Failed to set preferred model', 'error');
        }
    }

    // ============================================
    // Utility Functions
    // ============================================

    /**
     * Format number with K/M suffix
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
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show notification (uses existing window.showNotification if available)
     */
    function showNotification(message, type) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * Open search modal with empty query (exposed globally for character-creation.js)
     */
    window.openCivitaiModelSearch = function() {
        if (!isPremiumUser) {
            loadPlanPage();
            return;
        }
        
        $('#civitaiModalSearch').val('');
        $('#civitaiSearchResultsList').empty();
        $('#civitaiSearchPlaceholder').removeClass('d-none');
        $('#civitaiNoResults').addClass('d-none');
        if (civitaiSearchModal) {
            civitaiSearchModal.show();
        }
    };

    // Expose functions globally if needed
    window.civitaiModelSearch = {
        loadUserModels,
        renderUserModels,
        setPreferredModel,
        openSearchModalWithQuery
    };

})();
