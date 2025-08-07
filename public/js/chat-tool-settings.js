class ChatToolSettings {
    constructor() {
        this.settings = {
            minImages: 3,
            videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
            relationshipType: 'companion',
            selectedVoice: 'nova',
            voiceProvider: 'openai',
            evenLabVoice: 'Thandiwe',
            autoMergeFace: true
        };
        
        this.isLoading = false;
        this.userId = window.userId || window.user?.id;
        this.evenLabVoices = [];
        this.translations = window.chatToolSettingsTranslations || {};
        
        this.init();
        this.loadSettings();
    }

    // Add translation method
    t(key, fallback = key) {
        return this.translations[key] || fallback;
    }

    init() {
        this.bindEvents();
        this.setupRangeSliders();
    }

    bindEvents() {
        // Settings toggle button
        const settingsToggle = document.getElementById('settings-toggle');
        if (settingsToggle) {
            settingsToggle.addEventListener('click', () => this.openModal());
        }

        // Close modal events
        const closeBtn = document.getElementById('settings-close-btn');
        const overlay = document.getElementById('settings-modal-overlay');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
        
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal();
                }
            });
        }

        // Save settings button
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Reset settings button
        const resetBtn = document.getElementById('settings-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // Voice selection
        document.querySelectorAll('.settings-voice-option').forEach(option => {
            option.addEventListener('click', () => this.selectVoice(option));
        });

        // EvenLab voice selection - Use event delegation to handle dynamic content
        document.addEventListener('click', (e) => {
            if (e.target.closest('.settings-evenlab-voice-option')) {
                this.selectEvenLabVoice(e.target.closest('.settings-evenlab-voice-option'));
            }
        });

        // Relationship tone selection - Use event delegation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.settings-tone-option')) {
                this.selectRelationshipTone(e.target.closest('.settings-tone-option'));
            }
        });

        // Voice provider switch
        const voiceProviderSwitch = document.getElementById('voice-provider-switch');
        if (voiceProviderSwitch) {
            voiceProviderSwitch.addEventListener('change', (e) => {
                this.settings.voiceProvider = e.target.checked ? 'evenlab' : 'openai';
                this.toggleVoiceProviderUI();
                this.updateSwitchLabels();
            });
        }

        // Relationship select
        const relationshipSelect = document.getElementById('relationship-select');
        if (relationshipSelect) {
            relationshipSelect.addEventListener('change', (e) => {
                this.settings.relationshipType = e.target.value;
            });
        }

        // Video prompt textarea
        const videoPrompt = document.getElementById('video-prompt');
        if (videoPrompt) {
            videoPrompt.addEventListener('input', (e) => {
                this.settings.videoPrompt = e.target.value;
            });
        }

        // Auto merge face switch
        const autoMergeFaceSwitch = document.getElementById('auto-merge-face-switch');
        if (autoMergeFaceSwitch) {
            autoMergeFaceSwitch.addEventListener('change', (e) => {
                const user = window.user || {};
                const subscriptionStatus = user.subscriptionStatus === 'active';
                
                // Check if user is trying to enable auto merge face without subscription
                if (!subscriptionStatus && e.target.checked) {
                    // Reset to false and show upgrade popup
                    e.target.checked = false;
                    this.settings.autoMergeFace = false;
                    
                    // Show plan page for upgrade
                    if (typeof loadPlanPage === 'function') {
                        loadPlanPage();
                    } else {
                        window.location.href = '/plan';
                    }
                    return;
                }
                
                this.settings.autoMergeFace = e.target.checked;
            });
        }
    }

    setupRangeSliders() {
        const minImagesRange = document.getElementById('min-images-range');
        const minImagesValue = document.getElementById('min-images-value');
        const autoMergeFaceSwitch = document.getElementById('auto-merge-face-switch');
        const user = window.user || {};
        const subscriptionStatus = user.subscriptionStatus === 'active';

        if (minImagesRange && minImagesValue) {
            // Set initial value based on subscription status
            if (!subscriptionStatus) {
                // Auto-correct non-premium users who have minImages > 1
                if (this.settings.minImages > 1) {
                    this.settings.minImages = 1;
                }

                // Non-premium users are limited to 1 image
                this.settings.minImages = 1;
                minImagesRange.value = 1;
                minImagesValue.textContent = 1;
                minImagesRange.disabled = true;
                minImagesRange.style.opacity = '0.6';
                
                // Add premium indicator
                const rangeContainer = document.querySelector('.settings-field');
                if (!rangeContainer.querySelector('.premium-feature-indicator')) {
                    const premiumIndicator = document.createElement('small');
                    premiumIndicator.className = 'premium-feature-indicator text-muted d-block mt-1';
                    premiumIndicator.innerHTML = '<i class="bi bi-star-fill text-warning"></i> ' + (this.t('minImagesPremiumFeature') || 'Premium feature required for more images');
                    rangeContainer.appendChild(premiumIndicator);
                }

                // Save corrected settings after UI is set up
                this.autoSaveCorrection();
            } else {
                // Premium users can use any value
                minImagesRange.disabled = false;
                minImagesRange.style.opacity = '1';
            }

            minImagesRange.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                
                // Check if user is trying to set value > 1 without subscription
                if (!subscriptionStatus && value > 1) {
                    // Reset to 1 and show upgrade popup
                    e.target.value = 1;
                    minImagesValue.textContent = 1;
                    this.settings.minImages = 1;
                    
                    // Show plan page for upgrade
                    if (typeof loadPlanPage === 'function') {
                        loadPlanPage();
                    } else {
                        window.location.href = '/plan';
                    }
                    return;
                }
                
                // Update value for premium users or when value is 1
                minImagesValue.textContent = value;
                this.settings.minImages = value;
            });
        }

        // Handle Auto Merge Face premium restriction
        if (autoMergeFaceSwitch) {
            if (!subscriptionStatus) {
                // Auto-correct non-premium users who have autoMergeFace enabled
                if (this.settings.autoMergeFace) {
                    this.settings.autoMergeFace = false;
                }

                // Non-premium users cannot use auto merge face
                this.settings.autoMergeFace = false;
                autoMergeFaceSwitch.checked = false;
                autoMergeFaceSwitch.disabled = true;
                autoMergeFaceSwitch.style.opacity = '0.6';
                
                // Add premium indicator - converted to plain JS
                const labelDescription = document.querySelector('.settings-switch-description');
                if (labelDescription && !labelDescription.querySelector('.premium-feature-indicator')) {
                    const premiumIndicator = document.createElement('small');
                    premiumIndicator.className = 'premium-feature-indicator text-muted d-block mt-1';
                    premiumIndicator.innerHTML = '<i class="bi bi-star-fill text-warning"></i> ' + (this.t('autoMergeFacePremiumFeature') || 'Premium feature required for auto merge face');
                    labelDescription.appendChild(premiumIndicator);
                }

                // Save corrected settings after UI is set up
                this.autoSaveCorrection();
            } else {
                // Premium users can use auto merge face
                autoMergeFaceSwitch.disabled = false;
                autoMergeFaceSwitch.style.opacity = '1';
            }
        }
    }

    // Add new method to automatically save corrected settings
    autoSaveCorrection() {
        if (!this.userId) return;

        // Save the corrected settings silently in the background
        const requestBody = { 
            settings: this.settings,
            autoCorrection: true // Flag to indicate this is an automatic correction
        };

        // Include chatId if available
        const chatId = sessionStorage.getItem('lastChatId') || sessionStorage.getItem('chatId');
        if (chatId && chatId !== 'null' && chatId !== 'undefined') {
            requestBody.chatId = chatId;
        }

        fetch(`/api/chat-tool-settings/${this.userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                ///console.log('Non-premium user settings auto-corrected and saved');
            }
        })
        .catch(error => {
            console.error('Error auto-correcting settings:', error);
        });
    }

    openModal() {
        const overlay = document.getElementById('settings-modal-overlay');
        if (overlay) {
            overlay.classList.add('show');
            $('.navbar').css('z-index', '100'); // Lower navbar z-index
            document.body.style.overflow = 'hidden';
            
            // Focus trap for accessibility
            const firstFocusable = overlay.querySelector('button, input, select, textarea');
            if (firstFocusable) {
                setTimeout(() => firstFocusable.focus(), 100);
            }
        }
    }

    closeModal() {
        const overlay = document.getElementById('settings-modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            $('.navbar').css('z-index', '1000'); // Restore navbar z-index
            document.body.style.overflow = '';
        }
    }

    selectVoice(selectedOption) {
        // Remove selected class from all voice options
        document.querySelectorAll('.settings-voice-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        selectedOption.classList.add('selected');
        
        // Update settings
        this.settings.selectedVoice = selectedOption.dataset.voice;
    }

    selectEvenLabVoice(selectedOption) {
        // Remove selected class from all EvenLab voice options
        document.querySelectorAll('.settings-evenlab-voice-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        selectedOption.classList.add('selected');
        
        // Update settings
        this.settings.evenLabVoice = selectedOption.dataset.voice;
        
        console.log('EvenLab voice selected:', this.settings.evenLabVoice);
    }

    selectRelationshipTone(selectedOption) {
        // Check if this is a premium relationship and user is not premium
        const isPremiumRelationship = selectedOption.classList.contains('premium-relationship');
        const isNSFW = selectedOption.dataset.nsfw === 'true';
        
        if (isPremiumRelationship || isNSFW) {
            // Check user subscription status
            const user = window.user || {};
            const subscriptionStatus = user.subscriptionStatus === 'active';
            
            if (!subscriptionStatus) {
                // Launch plan page for non-premium users
                if (typeof loadPlanPage === 'function') {
                    loadPlanPage();
                } else {
                    // Fallback redirect
                    window.location.href = '/plan';
                }
                return;
            }
        }
        
        // Remove selected class from all relationship tone options
        document.querySelectorAll('.settings-tone-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        selectedOption.classList.add('selected');
        
        // Update settings
        this.settings.relationshipType = selectedOption.dataset.relationship;
        
        console.log('Relationship tone selected:', this.settings.relationshipType);
    }

    async loadEvenLabVoices() {
        try {
            const response = await fetch('/api/evenlab-voices');
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.evenLabVoices = data.voices;
                this.renderEvenLabVoices();
            } else {
                console.error('Failed to load EvenLab voices:', data.error);
                this.showEvenLabVoicesError();
            }
        } catch (error) {
            console.error('Error loading EvenLab voices:', error);
            this.showEvenLabVoicesError();
        }
    }

    renderEvenLabVoices() {
        const grid = document.getElementById('evenlab-voices-grid');
        if (!grid || !this.evenLabVoices.length) return;

        grid.innerHTML = '';
        
        this.evenLabVoices.forEach(voice => {
            const voiceOption = document.createElement('div');
            voiceOption.className = 'settings-evenlab-voice-option';
            voiceOption.setAttribute('data-voice', voice.key);
            
            if (voice.key === this.settings.evenLabVoice) {
                voiceOption.classList.add('selected');
            }
            
            voiceOption.innerHTML = `
                <div class="settings-voice-name">${voice.name}</div>
                <div class="settings-voice-description">${voice.description}</div>
            `;
            
            grid.appendChild(voiceOption);
        });
    }

    showEvenLabVoicesError() {
        const grid = document.getElementById('evenlab-voices-grid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="voice-error text-center text-muted">
                <i class="bi bi-exclamation-triangle"></i>
                <div>${this.t('failedToLoadEvenLabVoices')}</div>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="window.chatToolSettings.loadEvenLabVoices()">
                    ${this.t('retry')}
                </button>
            </div>
        `;
    }

    toggleVoiceProviderUI() {
        const openaiVoices = document.getElementById('openai-voices');
        const evenlabVoices = document.getElementById('evenlab-voices');
        
        if (this.settings.voiceProvider === 'evenlab') {
            openaiVoices.style.display = 'none';
            evenlabVoices.style.display = 'block';
            
            // Load EvenLab voices if not already loaded
            if (this.evenLabVoices.length === 0) {
                this.loadEvenLabVoices();
            }
        } else {
            openaiVoices.style.display = 'block';
            evenlabVoices.style.display = 'none';
        }
    }

    updateSwitchLabels() {
        const openaiLabel = document.querySelector('.openai-label');
        const evenlabLabel = document.querySelector('.evenlab-label');
        
        if (this.settings.voiceProvider === 'evenlab') {
            if (openaiLabel) openaiLabel.style.color = '#666';
            if (evenlabLabel) evenlabLabel.style.color = '#28a745';
        } else {
            if (openaiLabel) openaiLabel.style.color = '#6E20F4';
            if (evenlabLabel) evenlabLabel.style.color = '#666';
        }
    }

    async saveSettings() {
        if (this.isLoading || !this.userId) {
            return;
        }

        try {
            this.isLoading = true;
            this.showSavingState();

            // Get chatId from session storage
            const chatId = sessionStorage.getItem('lastChatId') || sessionStorage.getItem('chatId');
            const userChatId = sessionStorage.getItem('userChatId');

            console.log('Saving settings with chatId:', chatId, 'userChatId:', userChatId);

            const requestBody = { 
                settings: this.settings 
            };

            // Include chatId if available for chat-specific settings
            if (chatId && chatId !== 'null' && chatId !== 'undefined') {
                requestBody.chatId = chatId;
            }

            const response = await fetch(`/api/chat-tool-settings/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save settings');
            }

            // Update local settings with validated server response
            this.settings = { ...this.settings, ...data.settings };
            
            // Show success feedback with chat-specific info
            const successMessage = data.isChatSpecific ? 
                this.t('chatSpecificSettingsSaved') : 
                this.t('globalSettingsSaved');
            this.showSaveSuccess(successMessage);
            
            // Apply settings to the application
            this.applySettings();
            
            // Close modal after short delay
            setTimeout(() => {
                this.closeModal();
            }, 1000);
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showSaveError(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    async loadSettings() {
        if (!this.userId) {
            console.warn('No user ID available, using default settings');
            return;
        }

        try {
            // Try to load chat-specific settings first if we have a chatId
            const chatId = sessionStorage.getItem('lastChatId') || sessionStorage.getItem('chatId');
            
            let response;
            if (chatId && chatId !== 'null' && chatId !== 'undefined') {
                // Try to get chat-specific settings
                response = await fetch(`/api/chat-tool-settings/${this.userId}/${chatId}`);
            } else {
                // Get global user settings
                response = await fetch(`/api/chat-tool-settings/${this.userId}`);
            }

            const data = await response.json();

            if (response.ok && data.success) {
                this.settings = { ...this.settings, ...data.settings };
                this.applySettingsToUI();
            } else {
                console.warn('Failed to load settings, using defaults');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // Fall back to localStorage if API fails
            this.loadFromLocalStorage();
        }
    }

    async resetSettings() {
        if (this.isLoading || !this.userId) {
            return;
        }

        try {
            const chatId = sessionStorage.getItem('lastChatId') || sessionStorage.getItem('chatId');
            const isCurrentlyInChat = chatId && chatId !== 'null' && chatId !== 'undefined';
            
            const result = await Swal.fire({
                title: this.t('resetSettingsTitle'),
                text: isCurrentlyInChat ? 
                    this.t('resetChatSettingsText') :
                    this.t('resetGlobalSettingsText'),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: this.t('reset'),
                cancelButtonText: this.t('cancel'),
                confirmButtonColor: '#dc3545'
            });

            if (!result.isConfirmed) {
                return;
            }

            this.isLoading = true;
            this.showSavingState();

            let url = `/api/chat-tool-settings/${this.userId}`;
            if (isCurrentlyInChat) {
                url += `?chatId=${chatId}`;
            }

            const response = await fetch(url, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset settings');
            }

            // Update local settings with default values
            this.settings = { ...data.settings };
            this.applySettingsToUI();
            this.showResetSuccess();

        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showSaveError(this.t('errorResettingSettings'));
        } finally {
            this.isLoading = false;
        }
    }

    loadFromLocalStorage() {
        try {
            const savedSettings = localStorage.getItem('chatToolSettings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
                this.applySettingsToUI();
            }
        } catch (error) {
            console.error('Error loading settings from localStorage:', error);
        }
    }

    applySettingsToUI() {
        const user = window.user || {};
        const subscriptionStatus = user.subscriptionStatus === 'active';
        
        // Auto-correct minImages for non-premium users before applying to UI
        if (!subscriptionStatus && this.settings.minImages > 1) {
            this.settings.minImages = 1;
            this.autoSaveCorrection();
        }

        // Auto-correct autoMergeFace for non-premium users before applying to UI
        if (!subscriptionStatus && this.settings.autoMergeFace) {
            this.settings.autoMergeFace = false;
            this.autoSaveCorrection();
        }

        // Update range slider
        const minImagesRange = document.getElementById('min-images-range');
        const minImagesValue = document.getElementById('min-images-value');
        if (minImagesRange && minImagesValue) {
            minImagesRange.value = this.settings.minImages;
            minImagesValue.textContent = this.settings.minImages;
            
            // Ensure non-premium users can't have values > 1
            if (!subscriptionStatus) {
                minImagesRange.disabled = true;
                minImagesRange.style.opacity = '0.6';
            }
        }

        // Update video prompt
        const videoPrompt = document.getElementById('video-prompt');
        if (videoPrompt) {
            videoPrompt.value = this.settings.videoPrompt;
        }

        // Update voice selection
        document.querySelectorAll('.settings-voice-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.voice === this.settings.selectedVoice);
        });

        // Update EvenLab voice selection
        document.querySelectorAll('.settings-evenlab-voice-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.voice === this.settings.evenLabVoice);
        });

        // Update relationship tone selection with premium check
        document.querySelectorAll('.settings-tone-option').forEach(option => {
            const isSelected = option.dataset.relationship === this.settings.relationshipType;
            const isPremiumRelationship = option.classList.contains('premium-relationship');
            
            // Apply selection state
            option.classList.toggle('selected', isSelected);
            
            // Disable premium relationships for non-premium users
            if (isPremiumRelationship && !subscriptionStatus) {
                option.classList.add('disabled');
                option.style.opacity = '0.5';
                option.style.cursor = 'pointer'; // Keep cursor pointer to trigger upgrade
            } else {
                option.classList.remove('disabled');
                option.style.opacity = '1';
                option.style.cursor = 'pointer';
            }
        });

        // Update voice provider switch
        const voiceProviderSwitch = document.getElementById('voice-provider-switch');
        if (voiceProviderSwitch) {
            voiceProviderSwitch.checked = this.settings.voiceProvider === 'evenlab';
            this.toggleVoiceProviderUI();
            this.updateSwitchLabels();
        }

        // Update relationship select
        const relationshipSelect = document.getElementById('relationship-select');
        if (relationshipSelect) {
            relationshipSelect.value = this.settings.relationshipType;
        }

        // Update auto merge face switch
        const autoMergeFaceSwitch = document.getElementById('auto-merge-face-switch');
        if (autoMergeFaceSwitch) {
            autoMergeFaceSwitch.checked = this.settings.autoMergeFace !== undefined ? this.settings.autoMergeFace : true;
            
            // Ensure non-premium users can't enable auto merge face
            if (!subscriptionStatus) {
                autoMergeFaceSwitch.checked = false;
                autoMergeFaceSwitch.disabled = true;
                autoMergeFaceSwitch.style.opacity = '0.6';
            } else {
                autoMergeFaceSwitch.disabled = false;
                autoMergeFaceSwitch.style.opacity = '1';
            }
        }
    }

    applySettings() {
        // Save to localStorage as backup
        try {
            localStorage.setItem('chatToolSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }

        // Dispatch custom event with settings for other components to listen
        const settingsEvent = new CustomEvent('chatSettingsUpdated', {
            detail: { ...this.settings }
        });
        document.dispatchEvent(settingsEvent);
        
        console.log('Settings applied:', this.settings);
    }

    showSavingState() {
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            saveBtn.innerHTML = `<i class="bi bi-arrow-clockwise spin"></i> ${this.t('saving')}`;
            saveBtn.disabled = true;
        }
    }

    showSaveSuccess(message = null) {
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            const successMessage = message || this.t('settingsSaved');
            saveBtn.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${successMessage}`;
            saveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            saveBtn.disabled = false;
            
            setTimeout(() => {
                saveBtn.innerHTML = `<i class="bi bi-gear-fill"></i> ${this.t('saveSettings')}`;
                saveBtn.style.background = 'linear-gradient(135deg, #6E20F4 0%, #8B4CF8 100%)';
            }, 2000);
        }
    }

    showResetSuccess() {
        const resetBtn = document.getElementById('settings-reset-btn');
        if (resetBtn) {
            const originalText = resetBtn.innerHTML;
            resetBtn.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${this.t('resetComplete')}`;
            resetBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            
            setTimeout(() => {
                resetBtn.innerHTML = originalText;
                resetBtn.style.background = '';
            }, 2000);
        }
    }

    showSaveError(message = null) {
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            const errorMessage = message || this.t('errorSavingSettings');
            saveBtn.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${this.t('errorSaving')}`;
            saveBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)';
            saveBtn.disabled = false;
            
            setTimeout(() => {
                saveBtn.innerHTML = `<i class="bi bi-gear-fill"></i> ${this.t('saveSettings')}`;
                saveBtn.style.background = 'linear-gradient(135deg, #6E20F4 0%, #8B4CF8 100%)';
            }, 3000);
        }

        // Show error notification if available
        if (window.showNotification) {
            window.showNotification(errorMessage, 'error');
        } else {
            console.error('Settings error:', errorMessage);
        }
    }

    // Public methods to get current settings
    getMinImages() {
        return this.settings.minImages;
    }

    getVideoPrompt() {
        return this.settings.videoPrompt;
    }

    getRelationshipType() {
        return this.settings.relationshipType;
    }

    getSelectedVoice() {
        return this.settings.selectedVoice;
    }

    getVoiceProvider() {
        return this.settings.voiceProvider;
    }

    getEvenLabVoice() {
        return this.settings.evenLabVoice;
    }

    // Public method to get auto merge face setting
    getAutoMergeFace() {
        return this.settings.autoMergeFace;
    }

    // Method to get chat-specific settings
    async loadChatSettings(chatId) {
        if (!this.userId || !chatId) {
            return this.settings;
        }

        try {
            const response = await fetch(`/api/chat-tool-settings/${this.userId}/${chatId}`);
            const data = await response.json();

            if (response.ok && data.success) {
                return data.settings;
            }
        } catch (error) {
            console.error('Error loading chat-specific settings:', error);
        }

        return this.settings;
    }

    // Add method to check and correct all non-premium users (can be called from admin panel)
    async correctAllNonPremiumUsers() {
        if (!this.userId) return;

        try {
            const response = await fetch('/api/chat-tool-settings/correct-non-premium', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (data.success) {
                console.log(`Corrected ${data.correctedCount} non-premium users`);
                showNotification(`Corrected ${data.correctedCount} non-premium users' settings`, 'success');
            }
        } catch (error) {
            console.error('Error correcting non-premium users:', error);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatToolSettings = new ChatToolSettings();
});