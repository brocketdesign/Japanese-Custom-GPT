// Persona module - handles all persona-related functionality
const PersonaModule = {
    currentUserChatId: sessionStorage.getItem('userChatId') || null,
    isFloatingContainerVisible: false,
    personaWasSelected: false,
    isCustomPersonaModalVisible: false,
    CACHE_KEY: 'userPersonasCache',
    CACHE_TIMESTAMP_KEY: 'userPersonasCacheTimestamp',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
    
    init() {
        this.bindEvents();
        this.initializePersonaStats(user?.personas || []);
    },

    bindEvents() {
        // Bind persona click events
        $(document).on('click', '.persona', this.handlePersonaClick.bind(this));
        
        // Bind floating container events
        $(document).on('click', '#show-personas-btn', this.toggleFloatingContainer.bind(this));
        $(document).on('click', '#personas-overlay', this.hideFloatingContainer.bind(this));
        $(document).on('click', '.persona-card', this.handleFloatingPersonaClick.bind(this));
        $(document).on('click', '#close-personas-container', this.hideFloatingContainer.bind(this));

        // Bind remove persona button (prevent propagation)
        $(document).on('click', '.remove-persona', this.handleRemovePersona.bind(this));
        
        // Save character as persona button
        $(document).on('click', '.save-as-persona', this.handleSaveAsPersona.bind(this));
        
        // Custom persona modal events
        $(document).on('click', '#create-custom-persona-btn', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[PersonaModule] Create custom persona button clicked'); // Debug log
            
            // Check if user is logged in
            const isTemporary = !!user?.isTemporary;
            if (isTemporary) { 
                openLoginForm(); 
                return; 
            }
            
            this.showCustomPersonaModal();
        });
        
        // Handle modal hidden event
        $('#custom-persona-modal').on('hidden.bs.modal', () => {
            this.isCustomPersonaModalVisible = false;
            this.resetCustomPersonaForm();
        });
        
        // Handle modal shown event
        $('#custom-persona-modal').on('shown.bs.modal', () => {
            this.isCustomPersonaModalVisible = true;
            // Focus on name field
            $('#custom-persona-name').focus();
        });
        
        $(document).on('submit', '#custom-persona-form', this.handleCustomPersonaSubmit.bind(this));
        $(document).on('input', '#custom-persona-description', this.updateCharacterCount.bind(this));
        
        // Close container on escape key
        $(document).on('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isFloatingContainerVisible) {
                    this.hideFloatingContainer();
                }
            }
        });
    },

    handlePersonaClick(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const isTemporary = !!user?.isTemporary;
        if (isTemporary) { 
            openLoginForm(); 
            return; 
        }

        const $this = $(e.currentTarget);
        const isAdding = !$this.hasClass('on');
        $this.toggleClass('on');
        
        const $icon = $this.find('i');
        
        const personaId = $this.attr('data-id');
        const isEvent = $this.attr('data-event') == 'true';
        
        if (isEvent) {
            window.parent.postMessage({ 
                event: 'updatePersona', 
                personaId, 
                isAdding 
            }, '*');
        } else {
            this.updatePersona(personaId, isAdding, null, () => {
                // Handle error - revert UI changes
                $this.toggleClass('on');
            });
        }
    },

    handleRemovePersona(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const personaId = $(e.currentTarget).data('id');
        if (!personaId) {
            console.error('No persona ID found for removal');
            return;
        }
        
        this.removePersonaFromCollection(personaId);
    },

    removePersonaFromCollection(personaId) {
        this.updatePersona(personaId, false, () => {
            // Success callback - persona was removed
            console.log(`Persona ${personaId} removed successfully`);
        }, () => {
            // Error callback - handle removal failure
            console.error(`Failed to remove persona ${personaId}`);
        });
    },

    checkPersonaCount() {
        return new Promise((resolve, reject) => {
            $.get('/api/user/personas', (response) => {
                if (response.success) {
                    resolve(response.personas.length);
                } else {
                    reject(new Error(response.error || 'Failed to fetch personas'));
                }
            }).fail((xhr) => {
                reject(new Error(xhr.responseJSON?.error || 'Network error while fetching personas'));
            });
        });
    },
    updatePersona(personaId, isAdding, callback, callbackError) {
        $.post('/api/user/personas', { 
            personaId: personaId, 
            action: isAdding ? 'add' : 'remove' 
        }, (response) => {
            if (response.success) {
                const message = isAdding 
                    ? (window.translations?.personas?.personaAdded || 'Persona added successfully')
                    : (window.translations?.personas?.personaRemoved || 'Persona removed successfully');
                showNotification(message, 'success');
                
                // Update user.personas in memory
                if (user && Array.isArray(user.personas)) {
                    if (isAdding && !user.personas.includes(personaId)) {
                        user.personas.push(personaId);
                    } else if (!isAdding) {
                        user.personas = user.personas.filter(id => id !== personaId);
                    }
                }
                
                // Update UI based on action
                if (isAdding) {
                    // Update any existing persona element with this ID
                    $(`.persona[data-id="${personaId}"]`).addClass('on')
                        .find('i').removeClass('far').addClass('fas');
                } else {
                    // If removing from floating container
                    const $personaCard = $(`.persona-card[data-id="${personaId}"]`);
                    if ($personaCard.length) {
                        $personaCard.fadeOut(300, function() {
                            $(this).remove();
                            
                            // Show "no personas" message if this was the last one
                            const $list = $('#personas-list');
                            if ($list.find('.persona-card').length === 0) {
                                $list.append(`
                                    <div class="no-personas text-center w-100 mt-4">
                                        <i class="bi bi-person-plus" style="font-size: 2rem;"></i>
                                        <p>${window.translations.personas.noPersonas || 'No personas available'}</p>
                                    </div>
                                `);
                            }
                            
                            // Update counter
                            PersonaModule.updatePersonaActivatedCounter();
                        });
                    }
                    
                    // Also update any persona buttons elsewhere on the page
                    $(`.persona[data-id="${personaId}"]`).removeClass('on')
                        .find('i').removeClass('fas').addClass('far');
                }
                
                // Clear cache to ensure fresh data next time
                this.clearPersonasCache();
                
                // Execute callback if provided
                if (typeof callback === 'function') {
                    callback();
                }
                
                // Refresh user profile if it exists
                $('#user-profile-page').attr('src', function(i, val) { return val; });
            } else {
                throw new Error(response.error || 'Unknown error');
            }
        }).fail((jqXHR) => {
            const message = jqXHR.responseJSON && jqXHR.responseJSON.error 
                ? jqXHR.responseJSON.error 
                : (isAdding
                    ? (window.translations?.personas?.failedToAddPersona || 'ペルソナの追加に失敗しました') 
                    : (window.translations?.personas?.failedToRemovePersona || 'ペルソナの削除に失敗しました'));
            
            showNotification(message, 'error');
            
            if (typeof callbackError === 'function') {
                callbackError();
            }
        });
    },
    initializePersonaStats(personas = []) {
        if (!personas || !personas.length) {
            personas = user?.personas || [];
        }
        
        if (personas && personas.length) {
            $('.persona').each(function() {
                const personaId = $(this).data('id');
                if (personas.includes(personaId)) {
                    $(this).addClass('on');
                    $(this).find('i').removeClass('far').addClass('fas');
                }
            });
        }
        
    },

    // Save a chat as a persona
    handleSaveAsPersona(e) {
        e.preventDefault();
        e.stopPropagation();
        if(!subscriptionStatus){
            handleClickRegisterOrPay(e);
            return;
        }
        
        const chatId = $(e.currentTarget).data('id');
        if (!chatId) {
            showNotification(window.translations?.personas?.characterIdNotFound || 'キャラクターIDが見つかりませんでした', 'error');
            return;
        }
        
        // First add to personas collection in the database
        this.updatePersona(chatId, true, () => {
            this.clearPersonasCache();
            // Update the UI to reflect the new persona state
            $(`.persona[data-id="${chatId}"]`).addClass('on').find('i').removeClass('far').addClass('fas');
        });
    },

    // Floating personas container functionality
    showFloatingContainer() {
        if (this.isFloatingContainerVisible) return;
        
        this.loadUserPersonas();
        
        $('#personas-overlay').fadeIn(300);
        $('#personas-container').hide().addClass('visible').slideDown('fast');
        this.isFloatingContainerVisible = true;
    },

    hideFloatingContainer() {
        if (!this.isFloatingContainerVisible) return;
        
        $('#personas-container').removeClass('visible').slideUp('fast');
        $('#personas-overlay').fadeOut(300);
        this.isFloatingContainerVisible = false;
        
        // Only trigger onPersonaModuleClose if no persona was selected
        if (!this.personaWasSelected && typeof window.onPersonaModuleClose === 'function') {
            window.onPersonaModuleClose();
        }
        
        // Reset the flag for next time
        this.personaWasSelected = false;
    },

    toggleFloatingContainer() {
        if(!subscriptionStatus && userId){
            handleClickRegisterOrPay(null);
            return;
        }
        if (this.isFloatingContainerVisible) {
            this.hideFloatingContainer();
        } else {
            this.showFloatingContainer();
        }
    },

    // Cache management methods
    getCachedPersonas() {
        const cachedData = sessionStorage.getItem(this.CACHE_KEY);
        const cacheTimestamp = sessionStorage.getItem(this.CACHE_TIMESTAMP_KEY);
        
        if (!cachedData || !cacheTimestamp) {
            return null;
        }
        
        const now = Date.now();
        const cacheAge = now - parseInt(cacheTimestamp);
        
        if (cacheAge > this.CACHE_DURATION) {
            this.clearPersonasCache();
            return null;
        }
        
        try {
            return JSON.parse(cachedData);
        } catch (error) {
            console.error('Error parsing cached personas:', error);
            this.clearPersonasCache();
            return null;
        }
    },

    setCachedPersonas(personas) {
        try {
            sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(personas));
            sessionStorage.setItem(this.CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch (error) {
            console.error('Error caching personas:', error);
        }
    },

    clearPersonasCache() {
        sessionStorage.removeItem(this.CACHE_KEY);
        sessionStorage.removeItem(this.CACHE_TIMESTAMP_KEY);
    },

    async loadUserPersonas() {
        // First check if we have cached data
        const cachedPersonas = this.getCachedPersonas();
        if (cachedPersonas) {
            this.renderPersonas(cachedPersonas);
            return;
        }

        try {
            const response = await fetch('/api/user/personas');
            const data = await response.json();
            
            if (data.success) {
                // Cache the personas data
                this.setCachedPersonas(data.personas);
                this.renderPersonas(data.personas);
            } else {
                this.showError(window.translations?.personas?.failedToLoadPersonas || 'ペルソナの読み込みに失敗しました');
            }
        } catch (error) {
            console.error('Error loading personas:', error);
            this.showError(window.translations?.personas?.errorLoadingPersonas || 'ペルソナの読み込み中にエラーが発生しました');
        }
    },

  
    renderPersonas(personas) {
        const $list = $('#personas-list');
        $list.find('.loading-spinner').remove();
        
        // Clear existing persona cards to avoid duplicates
        $list.find('.persona-card').remove();
        $list.find('.no-personas').remove();
        
        if (!personas || personas.length === 0) {
            $list.append(`
                <div class="no-personas text-center w-100 mt-4">
                    <div class="empty-state-icon">
                        <i class="bi bi-person-plus"></i>
                    </div>
                    <h5 class="empty-state-title">${window.translations?.personas.noPersonas || 'ペルソナがありません'}</h5>
                    <p class="empty-state-description">${window.translations?.personas.noPersonasDescription || 'お気に入りのキャラクターをペルソナとして保存しましょう'}</p>
                </div>
            `);
            return;
        }
        
        personas.forEach(persona => {
            const personaHtml = `
                <div class="persona-card col-6 col-sm-4 col-md-3 border-0 shadow-0 mb-3 position-relative d-flex justify-content-center align-items-center"
                    data-id="${persona._id}" 
                    data-name="${persona.name}" 
                    style="cursor:pointer;">
                    <div class="modern-persona-container position-relative overflow-hidden">
                        <div class="persona-image-wrapper">
                            <img 
                                src="${persona.chatImageUrl || '/img/default-avatar.png'}" 
                                class="lazy-image persona-image"
                                alt="${persona.name}" 
                                loading="lazy">
                            <div class="persona-overlay">
                                <div class="persona-shine"></div>
                            </div>
                        </div>
                        
                        <div class="persona-info">
                            <h6 class="persona-title">${persona.name}</h6>
                            <div class="persona-status-badge">
                                <i class="bi bi-person-check-fill"></i>
                                <span class="status-label">Active</span>
                            </div>
                        </div>
                        
                        <div class="persona-selection-indicator">
                            <i class="bi bi-check-circle-fill"></i>
                        </div>
                        
                        <button type="button" class="modern-remove-btn remove-persona" 
                            data-id="${persona._id}" 
                            aria-label="Remove" 
                            title="${window.translations?.personas?.removePersona || 'ペルソナを削除する'}">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                </div>
            `;
            $list.append(personaHtml);
        });
        
        this.updatePersonaActivatedCounter();
    },

    updatePersonaActivatedCounter() {
        const $personas = $('.persona-card');
        const total = $personas.length;
        const activated = $personas.filter('.active').length;
        
        $('#persona-activated-counter').html(`<span class="badge custom-gradient-bg">${total}</span>`);
    },
    handleFloatingPersonaClick(e) {
        // Prevent click if it's on the remove button
        if ($(e.target).hasClass('remove-persona') || $(e.target).closest('.remove-persona').length) {
            return;
        }
        
        // Set flag to indicate a persona was selected
        this.personaWasSelected = true;
        
        const $persona = $(e.currentTarget);
        const personaId = $persona.data('id');
        const personaName = $persona.data('name');
        const personaImageUrl = $persona.find('img').attr('src');

        if (this.currentUserChatId) {
            this.addPersonaToUserChat(personaId, personaName, personaImageUrl);
        } else {
            console.error('[PersonaModule] No current user chat ID found');
            showNotification('現在のチャットIDが見つかりません', 'error');
        }
        
        this.hideFloatingContainer();
    },

    async addPersonaToUserChat(personaId, personaName, personaImageUrl) {
        try {
            const response = await fetch('/api/user-chat/add-persona', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userChatId: this.currentUserChatId,
                    personaId: personaId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear cache when adding a new persona to ensure fresh data next time
                this.clearPersonasCache();
                
                const message = (window.translations?.personas?.personaAddedToChat || '{personaName}がチャットに追加されました')
                    .replace('{personaName}', personaName);
                showNotification(message, 'success');
                // Trigger any necessary UI updates
                if (typeof window.onPersonaAdded === 'function') {
                    window.onPersonaAdded({
                        name: personaName,
                        id: personaId,
                        chatImageUrl: personaImageUrl
                    });
                }
                
            } else {
                showNotification(window.translations?.personas?.failedToAddPersona || 'ペルソナの追加に失敗しました', 'error');
            }
        } catch (error) {
            console.error('Error adding persona to chat:', error);
            showNotification(window.translations?.personas?.errorOccurred || 'エラーが発生しました', 'error');
        }
    },

    // Custom Persona Modal Methods
    showCustomPersonaModal() {
        console.log('[PersonaModule] Showing custom persona modal'); // Debug log
        
        // Use Bootstrap 5 modal
        const modal = new bootstrap.Modal(document.getElementById('custom-persona-modal'), {
            backdrop: 'static',
            keyboard: true
        });
        
        this.resetCustomPersonaForm();
        modal.show();
        
        console.log('[PersonaModule] Bootstrap modal.show() called'); // Debug log
    },

    hideCustomPersonaModal() {
        console.log('[PersonaModule] Hiding custom persona modal'); // Debug log
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('custom-persona-modal'));
        if (modal) {
            modal.hide();
        }
    },

    resetCustomPersonaForm() {
        $('#custom-persona-form')[0].reset();
        $('#description-char-count').text('0');
        $('#custom-persona-save-btn').prop('disabled', false).html(`
            <i class="bi bi-check-circle me-2"></i>
            ${window.translations?.personas?.customPersona?.createPersona || 'Create Persona'}
        `);
    },

    updateCharacterCount() {
        const text = $('#custom-persona-description').val();
        const count = text.length;
        $('#description-char-count').text(count);
        
        // Change color as approaching limit
        const $counter = $('#description-char-count').parent();
        if (count > 450) {
            $counter.removeClass('text-muted text-warning').addClass('text-danger');
        } else if (count > 350) {
            $counter.removeClass('text-muted text-danger').addClass('text-warning');
        } else {
            $counter.removeClass('text-warning text-danger').addClass('text-muted');
        }
    },

    async handleCustomPersonaSubmit(e) {
        e.preventDefault();
        
        const name = $('#custom-persona-name').val().trim();
        const ageRange = $('#custom-persona-age').val();
        const description = $('#custom-persona-description').val().trim();
        
        if (!name || !ageRange || !description) {
            showNotification(
                window.translations?.personas?.customPersona?.allFieldsRequired || 
                'All fields are required', 
                'error'
            );
            return;
        }
        
        // Disable submit button and show loading
        const $submitBtn = $('#custom-persona-save-btn');
        $submitBtn.prop('disabled', true).html(`
            <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            ${window.translations?.creating || 'Creating...'}
        `);
        
        try {
            const response = await fetch('/api/user/custom-persona', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    ageRange,
                    description
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification(
                    window.translations?.personas?.customPersona?.personaCreated || 
                    'Custom persona created successfully!', 
                    'success'
                );
                
                // Clear cache and refresh personas
                this.clearPersonasCache();
                this.hideCustomPersonaModal();
                
                // Reload personas in the container
                if (this.isFloatingContainerVisible) {
                    this.loadUserPersonas();
                }
                
                // Add to user.personas array if it exists
                if (user && Array.isArray(user.personas)) {
                    user.personas.push(data.personaId);
                }
                
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error creating custom persona:', error);
            showNotification(
                window.translations?.personas?.customPersona?.errorCreating || 
                'Error creating persona. Please try again.', 
                'error'
            );
        } finally {
            // Re-enable submit button
            $submitBtn.prop('disabled', false).html(`
                <i class="bi bi-check-circle me-2"></i>
                ${window.translations?.personas?.customPersona?.createPersona || 'Create Persona'}
            `);
        }
    },
    showError(message) {
        $('#personas-grid').html(`
            <div class="error-message">
                <i class="bi bi-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `);
    }
};

// Initialize the module when document is ready
$(document).ready(() => {
    PersonaModule.init();
});

// Export for global access
window.PersonaModule = PersonaModule;
