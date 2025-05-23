// Persona module - handles all persona-related functionality
const PersonaModule = {
    currentUserChatId: sessionStorage.getItem('userChatId') || null,
    isFloatingContainerVisible: false,
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
        
        // Save character as persona button
        $(document).on('click', '.save-as-persona', this.handleSaveAsPersona.bind(this));
        
        // Close container on escape key
        $(document).on('keydown', (e) => {
            if (e.key === 'Escape' && this.isFloatingContainerVisible) {
                this.hideFloatingContainer();
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

    updatePersona(personaId, isAdding, callback, callbackError) {
        $.post('/api/user/personas', { 
            personaId: personaId, 
            action: isAdding ? 'add' : 'remove' 
        }, (response) => {
            if (response.success) {
                const message = isAdding 
                    ? (window.translations?.personas?.personaAdded || 'ペルソナが追加されました')
                    : (window.translations?.personas?.personaRemoved || 'ペルソナが削除されました');
                showNotification(message, 'success');
                
                // Update user.personas in memory
                if (user && Array.isArray(user.personas)) {
                    if (isAdding && !user.personas.includes(personaId)) {
                        user.personas.push(personaId);
                    } else if (!isAdding) {
                        user.personas = user.personas.filter(id => id !== personaId);
                    }
                }
                
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
        
        this.updatePromptActivatedCounter();
    },

    updatePromptActivatedCounter() {
        const $prompts = $('.persona');
        const total = $prompts.length;
        
        $('#prompt-activated-counter').html(`<span class="badge custom-gradient-bg">$${total}</span>`);
    },

    // Save a chat as a persona
    handleSaveAsPersona(e) {
        e.preventDefault();
        e.stopPropagation();

        if(!subscriptionStatus && userId){
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
            // Then show confirmation and update UI
            showNotification(window.translations?.personas?.characterSavedAsPersona || 'キャラクターがペルソナとして保存されました', 'success');
            
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
            console.log('Loading personas from cache');
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
                    <i class="bi bi-person-plus" style="font-size: 2rem;"></i>
                    <p>${window.translations?.noPersonas || 'ペルソナがありません'}</p>
                </div>
            `);
            return;
        }
        
        personas.forEach(persona => {
            const personaHtml = `
                <div class="persona-card col-6 col-sm-3 border-0 shadow-0 mb-1 position-relative inactive d-flex justify-content-center align-items-center"
                    data-id="${persona._id}" 
                    data-name="${persona.name}" 
                    style="cursor:pointer; min-height: 200px;">
                    <div class="image-container d-inline-flex align-items-center justify-content-center p-0 m-0 rounded border" style="background:transparent; padding:0; margin:0;">
                        <img 
                            src="${persona.chatImageUrl || '/img/default-avatar.png'}" 
                            class="lazy-image rounded"
                            alt="${persona.name}" 
                            style="display:block; max-width:100%; max-height:200px; object-fit:contain;">
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
        const $persona = $(e.currentTarget);
        const personaId = $persona.data('id');
        const personaName = $persona.data('name');
        const personaImageUrl = $persona.find('img').attr('src');

        if (this.currentUserChatId) {
            console.log(`[PersonaModule] Adding persona ${personaName} to chat ID ${this.currentUserChatId}`);
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
