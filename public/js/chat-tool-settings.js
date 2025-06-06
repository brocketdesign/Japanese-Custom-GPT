class ChatToolSettings {
    constructor() {
        this.settings = {
            minImages: 3,
            videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
            characterTone: 'casual',
            relationshipType: 'companion',
            selectedVoice: 'nova',
            voiceProvider: 'openai',
            evenLabVoice: 'sakura'
        };
        
        this.isLoading = false;
        this.userId = window.userId || window.user?.id; // Get from global variables
        
        this.init();
        this.loadSettings();
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

        // Tone selection
        document.querySelectorAll('.settings-tone-option').forEach(option => {
            option.addEventListener('click', () => this.selectTone(option));
        });

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
    }

    setupRangeSliders() {
        const minImagesRange = document.getElementById('min-images-range');
        const minImagesValue = document.getElementById('min-images-value');

        if (minImagesRange && minImagesValue) {
            minImagesRange.addEventListener('input', (e) => {
                const value = e.target.value;
                minImagesValue.textContent = value;
                this.settings.minImages = parseInt(value);
            });
        }
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

    selectTone(selectedOption) {
        // Remove selected class from all tone options
        document.querySelectorAll('.settings-tone-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        selectedOption.classList.add('selected');
        
        // Update settings
        this.settings.characterTone = selectedOption.dataset.tone;
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

    toggleVoiceProviderUI() {
        const openaiVoices = document.getElementById('openai-voices');
        const evenlabVoices = document.getElementById('evenlab-voices');
        
        if (this.settings.voiceProvider === 'evenlab') {
            openaiVoices.style.display = 'none';
            evenlabVoices.style.display = 'block';
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
                'Chat-specific settings saved!' : 
                'Global settings saved!';
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
                title: 'Reset Settings?',
                text: isCurrentlyInChat ? 
                    'This will reset your settings for this chat to default values.' :
                    'This will reset all your chat tool settings to default values.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Reset',
                cancelButtonText: 'Cancel',
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
            this.showSaveError(error.message);
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
        // Update range slider
        const minImagesRange = document.getElementById('min-images-range');
        const minImagesValue = document.getElementById('min-images-value');
        if (minImagesRange && minImagesValue) {
            minImagesRange.value = this.settings.minImages;
            minImagesValue.textContent = this.settings.minImages;
        }

        // Update video prompt
        const videoPrompt = document.getElementById('video-prompt');
        if (videoPrompt) {
            videoPrompt.value = this.settings.videoPrompt;
        }

        // Update tone selection
        document.querySelectorAll('.settings-tone-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.tone === this.settings.characterTone);
        });

        // Update voice selection
        document.querySelectorAll('.settings-voice-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.voice === this.settings.selectedVoice);
        });

        // Update EvenLab voice selection
        document.querySelectorAll('.settings-evenlab-voice-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.voice === this.settings.evenLabVoice);
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
            saveBtn.innerHTML = '<i class="bi bi-arrow-clockwise spin"></i> Saving...';
            saveBtn.disabled = true;
        }
    }

    showSaveSuccess(message = 'Settings Saved!') {
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            saveBtn.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${message}`;
            saveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            saveBtn.disabled = false;
            
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="bi bi-gear-fill"></i> Save Settings';
                saveBtn.style.background = 'linear-gradient(135deg, #6E20F4 0%, #8B4CF8 100%)';
            }, 2000);
        }
    }

    showResetSuccess() {
        const resetBtn = document.getElementById('settings-reset-btn');
        if (resetBtn) {
            const originalText = resetBtn.innerHTML;
            resetBtn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Reset Complete!';
            resetBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            
            setTimeout(() => {
                resetBtn.innerHTML = originalText;
                resetBtn.style.background = '';
            }, 2000);
        }
    }

    showSaveError(message = 'Failed to save settings') {
        const saveBtn = document.getElementById('settings-save-btn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="bi bi-exclamation-triangle"></i> Error Saving';
            saveBtn.style.background = 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)';
            saveBtn.disabled = false;
            
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="bi bi-gear-fill"></i> Save Settings';
                saveBtn.style.background = 'linear-gradient(135deg, #6E20F4 0%, #8B4CF8 100%)';
            }, 3000);
        }

        // Show error notification if available
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            console.error('Settings error:', message);
        }
    }

    // Public methods to get current settings
    getMinImages() {
        return this.settings.minImages;
    }

    getVideoPrompt() {
        return this.settings.videoPrompt;
    }

    getCharacterTone() {
        return this.settings.characterTone;
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatToolSettings = new ChatToolSettings();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatToolSettings;
}
