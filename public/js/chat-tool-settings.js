class ChatToolSettings {
    constructor() {
        this.settings = {
            minImages: 3,
            videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
            relationshipType: 'companion',
            selectedVoice: 'nova',
            voiceProvider: 'standard',
            premiumVoice: 'Thandiwe',
            minimaxVoice: 'Wise_Woman',
            autoMergeFace: true,
            suggestionsEnabled: true,
            selectedModel: 'openai',
            autoImageGeneration: true,
            speechRecognitionEnabled: true,
            speechAutoSend: true
        };
        
        this.isLoading = false;
        this.userId = window.userId || window.user?.id;
    this.minimaxVoices = [];
        this.premiumVoices = [];
        this.availableModels = {};
        this.isPremium = false;
        this.translations = window.chatToolSettingsTranslations || {};
        this.onFirstTimeClose = null;
        this.speechToTextTranslations = window.speechToTextTranslations || {};
        
        this.init();
        this.loadSettings();
    }

    // Add speech-to-text translation method
    speechT(key, fallback = key) {
        if (key.includes('.')) {
            const keys = key.split('.');
            let value = this.speechToTextTranslations;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    return fallback;
                }
            }
            
            return value || fallback;
        }
        
        return this.speechToTextTranslations[key] || fallback;
    }   
    // Translation method
    t(key, fallback = key) {
        if (key.includes('.')) {
            const keys = key.split('.');
            let value = this.translations;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    return fallback;
                }
            }
            
            return value || fallback;
        }
        
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

        // Quick navigation buttons
        document.addEventListener('click', (e) => {
            const navBtn = e.target.closest('.settings-quick-nav-btn');
            if (!navBtn) {
                return;
            }

            e.preventDefault();

            const targetSelector = navBtn.dataset.target;
            const modalBody = document.querySelector('.settings-modal-body');
            if (!modalBody || !targetSelector) {
                return;
            }

            const targetSection = modalBody.querySelector(targetSelector);
            if (!targetSection) {
                return;
            }

            document.querySelectorAll('.settings-quick-nav-btn').forEach(btn => btn.classList.remove('active'));
            navBtn.classList.add('active');

            modalBody.scrollTo({
                top: targetSection.offsetTop - 12,
                behavior: 'smooth'
            });
        });

        // Voice selection
        document.querySelectorAll('.settings-voice-option').forEach(option => {
            option.addEventListener('click', () => this.selectVoice(option));
        });

        // Dynamic model selection - Use event delegation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.settings-model-option')) {
                this.selectModel(e.target.closest('.settings-model-option'));
            }
        });

        // Premium voice selection - Use event delegation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.settings-premium-voice-option')) {
                this.selectPremiumVoice(e.target.closest('.settings-premium-voice-option'));
            }
        });

        // Relationship tone selection - Use event delegation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.settings-tone-option')) {
                this.selectRelationshipTone(e.target.closest('.settings-tone-option'));
            }
        });

        // Voice provider switch - Allow switching for all users
        const voiceProviderSwitch = document.getElementById('voice-provider-switch');
        if (voiceProviderSwitch) {
            voiceProviderSwitch.addEventListener('change', (e) => {
                this.settings.voiceProvider = e.target.checked ? 'premium' : 'standard';
                this.toggleVoiceProviderUI();
                this.updateSwitchLabels();
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

        // Auto image generation switch
        const autoImageGenerationSwitch = document.getElementById('auto-image-generation-switch');
        if (autoImageGenerationSwitch) {
            autoImageGenerationSwitch.addEventListener('change', (e) => {
                const user = window.user || {};
                const subscriptionStatus = user.subscriptionStatus === 'active';
                
                // Check if user is trying to enable auto image generation without subscription
                if (!subscriptionStatus && e.target.checked) {
                    // Reset to false and show upgrade popup
                    e.target.checked = false;
                    this.settings.autoImageGeneration = false;
                    
                    // Show plan page for upgrade
                    if (typeof loadPlanPage === 'function') {
                        loadPlanPage();
                    } else {
                        window.location.href = '/plan';
                    }
                    return;
                }
                
                this.settings.autoImageGeneration = e.target.checked;
            });
        }

        // Video prompt textarea - disable for non-premium users
        const videoPrompt = document.getElementById('video-prompt');
        if (videoPrompt) {
            const user = window.user || {};
            const subscriptionStatus = user.subscriptionStatus === 'active';
            
            if (!subscriptionStatus) {
                videoPrompt.disabled = true;
                videoPrompt.addEventListener('click', () => {
                    if (typeof loadPlanPage === 'function') {
                        loadPlanPage();
                    } else {
                        window.location.href = '/plan';
                    }
                });
            } else {
                videoPrompt.addEventListener('input', (e) => {
                    this.settings.videoPrompt = e.target.value;
                });
            }
        }

        // Suggestions enable switch
        const suggestionsEnableSwitch = document.getElementById('suggestions-enable-switch');
        if (suggestionsEnableSwitch) {
            suggestionsEnableSwitch.addEventListener('change', (e) => {
                this.settings.suggestionsEnabled = e.target.checked;
            });
        }
        
        // Speech recognition enable switch
        const speechRecognitionEnableSwitch = document.getElementById('speech-recognition-enable-switch');
        if (speechRecognitionEnableSwitch) {
            speechRecognitionEnableSwitch.addEventListener('change', (e) => {
                this.settings.speechRecognitionEnabled = e.target.checked;
                this.toggleSpeechButton();
            });
        }

        // Speech auto-send switch
        const speechAutoSendSwitch = document.getElementById('speech-auto-send-switch');
        if (speechAutoSendSwitch) {
            speechAutoSendSwitch.addEventListener('change', (e) => {
                this.settings.speechAutoSend = e.target.checked;
                this.updateAutoSendFeedback();
            });
        }
    }

    toggleSpeechButton() {
        const speechBtn = document.getElementById('speech-to-text-btn');
        if (speechBtn) {
            if (this.settings.speechRecognitionEnabled) {
                speechBtn.style.display = 'inline-block';
                speechBtn.disabled = false;
            } else {
                speechBtn.style.display = 'none';
                speechBtn.disabled = true;
            }
        }
    }

    updateAutoSendFeedback() {
        // Show a brief notification about auto-send status
        const message = this.settings.speechAutoSend ? 
            this.speechT('autoSendEnabled') : 
            this.speechT('autoSendDisabled');
        
        if (typeof showNotification === 'function') {
            showNotification(message, 'info');
        }
    }

    // Getter methods for speech settings
    getSpeechRecognitionEnabled() {
        return this.settings.speechRecognitionEnabled !== undefined ? 
            this.settings.speechRecognitionEnabled : true;
    }

    getSpeechAutoSend() {
        return this.settings.speechAutoSend !== undefined ? 
            this.settings.speechAutoSend : true;
    }
    
    // Model selection method
    selectModel(selectedOption) {
        // Check if this is a premium model and user is not premium
        const isPremiumModel = selectedOption.classList.contains('premium-model');
        
        if (isPremiumModel && !this.isPremium) {
            // Launch plan page for non-premium users
            if (typeof loadPlanPage === 'function') {
                loadPlanPage();
            }
            return;
        }
        
        // Remove selected class from all model options
        document.querySelectorAll('.settings-model-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        selectedOption.classList.add('selected');
        
        // Update settings
        const modelKey = selectedOption.dataset.model;
        this.settings.selectedModel = modelKey;
        
        // Show selection feedback
        this.showModelSelectionFeedback(selectedOption, modelKey);
        
        console.log('Model selected:', modelKey, this.availableModels[modelKey]);
    }

    showModelSelectionFeedback(selectedOption, modelKey) {
        // Add a brief animation to show selection
        selectedOption.style.transform = 'scale(1.02)';
        setTimeout(() => {
            selectedOption.style.transform = '';
        }, 200);

        // Optional: Show a brief notification
        const modelName = this.availableModels[modelKey]?.displayName || modelKey;
        console.log(`Selected AI model: ${modelName}`);
    }

    // First time settings check
    checkFirstTimeSettings(callback) {
        if (!this.userId) {
            if (callback) callback();
            return;
        }
        
        const storageKey = `chat_settings_opened_${this.userId}`;
        const hasOpenedSettings = localStorage.getItem(storageKey);
        
        // If user has never opened settings before, show them automatically
        if (!hasOpenedSettings) {
            // Show settings with callback to continue chat generation
            this.openModalForFirstTime(callback);
        } else if (callback) {
            // User has seen settings before, continue normally
            callback();
        }
    }

    // Special method for first-time opening with welcome message and callback
    openModalForFirstTime(callback) {
        // Mark that user has now seen the settings
        this.markSettingsAsOpened();
        
        // Open the modal
        this.openModal();
        
        // Add a welcome message
        this.showFirstTimeWelcome();
        
        // Set up callback for when modal is closed
        if (callback) {
            this.onFirstTimeClose = callback;
        }
    }

    // Mark settings as opened in localStorage
    markSettingsAsOpened() {
        if (!this.userId) return;
        
        const storageKey = `chat_settings_opened_${this.userId}`;
        localStorage.setItem(storageKey, 'true');
    }

    // Show a welcome message for first-time users
    showFirstTimeWelcome() {
        // Add a welcome message at the top of the modal
        setTimeout(() => {
            const modalContent = document.querySelector('#settings-modal-overlay .settings-modal-container');
            if (modalContent && !modalContent.querySelector('.first-time-welcome')) {
                const welcomeMessage = document.createElement('div');
                welcomeMessage.className = 'first-time-welcome alert alert-info mb-3 animate__animated animate__fadeIn';
                welcomeMessage.innerHTML = `
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>${this.t('welcomeToSettings', 'Welcome to Chat Settings!')}</strong><br>
                    <small>${this.t('settingsWelcomeMessage', 'Customize your chat experience before we start. You can change these settings anytime later.')}</small>
                    <hr class="my-2">
                    <small class="text-muted">${this.t('settingsCloseToStart', 'Close this dialog to start chatting with your character.')}</small>
                `;
                
                // Insert at the beginning of the modal content
                const firstChild = modalContent.firstChild;
                modalContent.insertBefore(welcomeMessage, firstChild);
                
                // Auto-remove the welcome message after 12 seconds
                setTimeout(() => {
                    if (welcomeMessage.parentNode) {
                        welcomeMessage.classList.add('animate__fadeOut');
                        setTimeout(() => {
                            welcomeMessage.remove();
                        }, 500);
                    }
                }, 12000);
            }
        }, 300);
    }

    setupRangeSliders() {
        const minImagesRange = document.getElementById('min-images-range');
        const minImagesValue = document.getElementById('min-images-value');
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
                if (rangeContainer && !rangeContainer.querySelector('.premium-feature-indicator')) {
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

        // Setup premium indicators based on subscription status
        this.setupPremiumIndicators(subscriptionStatus);
    }

    setupPremiumIndicators(subscriptionStatus) {
        // Auto Merge Face premium indicator
        const autoMergeIcon = document.getElementById('auto-merge-premium-icon');
        const autoMergeIndicator = document.getElementById('auto-merge-premium-indicator');
        const autoMergeFaceSwitch = document.getElementById('auto-merge-face-switch');

        if (!subscriptionStatus) {
            if (autoMergeIcon) autoMergeIcon.style.display = 'inline';
            if (autoMergeIndicator) autoMergeIndicator.style.display = 'block';
            
            if (autoMergeFaceSwitch) {
                this.settings.autoMergeFace = false;
                autoMergeFaceSwitch.checked = false;
                autoMergeFaceSwitch.disabled = true;
                autoMergeFaceSwitch.style.opacity = '0.6';
            }
            
            this.autoSaveCorrection();
        } else {
            if (autoMergeIcon) autoMergeIcon.style.display = 'none';
            if (autoMergeIndicator) autoMergeIndicator.style.display = 'none';
            
            if (autoMergeFaceSwitch) {
                autoMergeFaceSwitch.disabled = false;
                autoMergeFaceSwitch.style.opacity = '1';
            }
        }

        // Auto Image Generation premium indicator
        const autoImageIcon = document.getElementById('auto-image-premium-icon');
        const autoImageIndicator = document.getElementById('auto-image-premium-indicator');
        const autoImageGenerationSwitch = document.getElementById('auto-image-generation-switch');

        if (!subscriptionStatus) {
            if (autoImageIcon) autoImageIcon.style.display = 'inline';
            if (autoImageIndicator) autoImageIndicator.style.display = 'block';
            
            if (autoImageGenerationSwitch) {
                this.settings.autoImageGeneration = false;
                autoImageGenerationSwitch.checked = false;
                autoImageGenerationSwitch.disabled = true;
                autoImageGenerationSwitch.style.opacity = '0.6';
            }
            
            this.autoSaveCorrection();
        } else {
            if (autoImageIcon) autoImageIcon.style.display = 'none';
            if (autoImageIndicator) autoImageIndicator.style.display = 'none';
            
            if (autoImageGenerationSwitch) {
                autoImageGenerationSwitch.disabled = false;
                autoImageGenerationSwitch.style.opacity = '1';
            }
        }

        // Video settings premium indicator
        const videoIndicator = document.getElementById('video-premium-indicator');
        const videoPrompt = document.getElementById('video-prompt');
        
        if (!subscriptionStatus) {
            if (videoIndicator) videoIndicator.style.display = 'block';
            if (videoPrompt) {
                videoPrompt.disabled = true;
                videoPrompt.style.opacity = '0.6';
                videoPrompt.style.cursor = 'pointer';
            }
        } else {
            if (videoIndicator) videoIndicator.style.display = 'none';
            if (videoPrompt) {
                videoPrompt.disabled = false;
                videoPrompt.style.opacity = '1';
                videoPrompt.style.cursor = 'text';
            }
        }

        // Premium relationships indicator
        const premiumRelIndicator = document.getElementById('premium-relationships-indicator');
        if (!subscriptionStatus) {
            if (premiumRelIndicator) premiumRelIndicator.style.display = 'block';
        } else {
            if (premiumRelIndicator) premiumRelIndicator.style.display = 'none';
        }

        // Premium voices indicator
        const premiumVoicesIndicator = document.getElementById('premium-voices-indicator');
        if (!subscriptionStatus) {
            if (premiumVoicesIndicator) premiumVoicesIndicator.style.display = 'block';
        } else {
            if (premiumVoicesIndicator) premiumVoicesIndicator.style.display = 'none';
        }

        // Premium models indicator
        const premiumModelsIndicator = document.getElementById('premium-models-indicator');
        if (!subscriptionStatus) {
            if (premiumModelsIndicator) premiumModelsIndicator.style.display = 'block';
        } else {
            if (premiumModelsIndicator) premiumModelsIndicator.style.display = 'none';
        }
    }

    // Auto save correction for non-premium users
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
                // Silent success
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
            
            // Load models when modal opens if not already loaded
            if (Object.keys(this.availableModels).length === 0) {
                this.loadAvailableModels();
            }
            
            // Focus trap for accessibility
            const firstFocusable = overlay.querySelector('button, input, select, textarea');
            if (firstFocusable) {
                setTimeout(() => firstFocusable.focus(), 100);
            }
            
            // Mark settings as opened when manually opened
            this.markSettingsAsOpened();
        }
    }

    closeModal() {
        const overlay = document.getElementById('settings-modal-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            $('.navbar').css('z-index', '1000'); // Restore navbar z-index
            document.body.style.overflow = '';
            
            // Remove welcome message if it exists
            const welcomeMessage = overlay.querySelector('.first-time-welcome');
            if (welcomeMessage) {
                welcomeMessage.remove();
            }
            
            // Execute callback if this was a first-time opening
            if (this.onFirstTimeClose) {
                const callback = this.onFirstTimeClose;
                this.onFirstTimeClose = null; // Clear the callback
                setTimeout(() => {
                    callback();
                }, 300); // Small delay to ensure modal is fully closed
            }
        }
    }

    // Utility methods
    resetFirstTimeFlag() {
        if (!this.userId) return;
        
        const storageKey = `chat_settings_opened_${this.userId}`;
        localStorage.removeItem(storageKey);
        console.log('First-time settings flag reset for user:', this.userId);
    }

    isFirstTimeUser() {
        if (!this.userId) return false;
        
        const storageKey = `chat_settings_opened_${this.userId}`;
        return !localStorage.getItem(storageKey);
    }

    // Selection methods
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

    selectPremiumVoice(selectedOption) {
        const user = window.user || {};
        const subscriptionStatus = user.subscriptionStatus === 'active';
        
        if (!subscriptionStatus) {
            // Show upgrade popup for non-premium users
            if (typeof loadPlanPage === 'function') {
                loadPlanPage();
            } else {
                window.location.href = '/plan';
            }
            return;
        }
        
        // Remove selected class from all premium voice options
        document.querySelectorAll('.settings-premium-voice-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to clicked option
        selectedOption.classList.add('selected');
        
    // Update settings
    this.settings.minimaxVoice = selectedOption.dataset.voice;
    this.settings.premiumVoice = selectedOption.dataset.voice;
        
    console.log('Premium voice selected:', this.settings.minimaxVoice);
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

    async loadPremiumVoices() {
        try {
            const response = await fetch('/api/minimax-voices');
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.premiumVoices = data.voices;
                this.renderPremiumVoices();
            } else {
                console.error('Failed to load Premium voices:', data.error);
                this.showPremiumVoicesError();
            }
        } catch (error) {
            console.error('Error loading Premium voices:', error);
            this.showPremiumVoicesError();
        }
    }

    renderPremiumVoices() {
        const grid = document.getElementById('premium-voices-grid');
        if (!grid || !this.premiumVoices.length) return;

        const user = window.user || {};
        const subscriptionStatus = user.subscriptionStatus === 'active';

        grid.innerHTML = '';
        
        this.premiumVoices.forEach(voice => {
            const voiceOption = document.createElement('div');
            voiceOption.className = 'settings-premium-voice-option settings-voice-option';
            voiceOption.setAttribute('data-voice', voice.key);
            
            if (voice.key === this.settings.minimaxVoice) {
                voiceOption.classList.add('selected');
            }

            // Disable for non-premium users
            if (!subscriptionStatus) {
                voiceOption.classList.add('disabled');
                voiceOption.style.opacity = '0.5';
                voiceOption.style.cursor = 'pointer';
            }

            voiceOption.innerHTML = `
                <div class="settings-voice-name">${this.t(`voices.${voice.key}.name`, voice.name)}</div>
                <div class="settings-voice-description">${this.t(`voices.${voice.key}.description`, voice.description)}</div>
                ${!subscriptionStatus ? '<i class="bi bi-crown-fill premium-icon"></i>' : ''}
            `;
            
            grid.appendChild(voiceOption);
        });
    }

    showPremiumVoicesError() {
        const grid = document.getElementById('premium-voices-grid');
        if (!grid) return;
        
        grid.innerHTML = `
            <div class="voice-error text-center text-muted">
                <i class="bi bi-exclamation-triangle"></i>
                <div>${this.t('failedToLoadPremiumVoices')}</div>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" onclick="window.chatToolSettings.loadPremiumVoices()">
                    ${this.t('retry')}
                </button>
            </div>
        `;
    }

    toggleVoiceProviderUI() {
        const standardVoices = document.getElementById('standard-voices');
        const premiumVoices = document.getElementById('premium-voices');
        
        if (this.settings.voiceProvider === 'premium') {
            if (standardVoices) standardVoices.style.display = 'none';
            if (premiumVoices) premiumVoices.style.display = 'block';
            
            // Load Premium voices if not already loaded
            if (!this.premiumVoices || this.premiumVoices.length === 0) {
                this.loadPremiumVoices();
            }
        } else {
            if (standardVoices) standardVoices.style.display = 'block';
            if (premiumVoices) premiumVoices.style.display = 'none';
        }
    }

    updateSwitchLabels() {
        const standardLabel = document.querySelector('.standard-label');
        const premiumLabel = document.querySelector('.premium-label');
        
        if (this.settings.voiceProvider === 'premium') {
            if (standardLabel) standardLabel.style.color = '#666';
            if (premiumLabel) premiumLabel.style.color = '#28a745';
        } else {
            if (standardLabel) standardLabel.style.color = '#6E20F4';
            if (premiumLabel) premiumLabel.style.color = '#666';
        }
    }

    // Settings persistence methods
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
        
        if (!this.settings.minimaxVoice && this.settings.premiumVoice) {
            this.settings.minimaxVoice = this.settings.premiumVoice;
        }

        if (!this.settings.voiceProvider) {
            this.settings.voiceProvider = 'standard';
        } else {
            const provider = String(this.settings.voiceProvider).toLowerCase();
            if (provider === 'openai') {
                this.settings.voiceProvider = 'standard';
            } else if (provider === 'evenlab') {
                this.settings.voiceProvider = 'premium';
            }
        }

        // Auto-correct settings for non-premium users before applying to UI
        if (!subscriptionStatus) {
            if (this.settings.minImages > 1) {
                this.settings.minImages = 1;
                this.autoSaveCorrection();
            }
            if (this.settings.autoMergeFace) {
                this.settings.autoMergeFace = false;
                this.autoSaveCorrection();
            }
            if (this.settings.autoImageGeneration) {
                this.settings.autoImageGeneration = false;
                this.autoSaveCorrection();
            }
            // Auto-correct premium models
            const premiumModels = ['llama', 'gemma', 'deepseek'];
            if (premiumModels.includes(this.settings.selectedModel)) {
                this.settings.selectedModel = 'openai'; // Default to free model
                this.autoSaveCorrection();
            }
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
            
            // Disable for non-premium users
            if (!subscriptionStatus) {
                videoPrompt.disabled = true;
                videoPrompt.style.opacity = '0.6';
                videoPrompt.style.cursor = 'pointer';
            } else {
                videoPrompt.disabled = false;
                videoPrompt.style.opacity = '1';
                videoPrompt.style.cursor = 'text';
            }
        }

        // Update voice selection
        document.querySelectorAll('.settings-voice-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.voice === this.settings.selectedVoice);
        });

        // Update premium voice selection
        const activePremiumVoice = this.settings.minimaxVoice || this.settings.premiumVoice;
        document.querySelectorAll('.settings-premium-voice-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.voice === activePremiumVoice);
            
            // Disable for non-premium users
            if (!subscriptionStatus) {
                option.classList.add('disabled');
                option.style.opacity = '0.5';
                option.style.cursor = 'pointer';
            } else {
                option.classList.remove('disabled');
                option.style.opacity = '1';
                option.style.cursor = 'pointer';
            }
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

        // Update model selection with premium check
        document.querySelectorAll('.settings-model-option').forEach(option => {
            const isSelected = option.dataset.model === this.settings.selectedModel;
            const isPremiumModel = option.classList.contains('premium-model');
            
            // Apply selection state
            option.classList.toggle('selected', isSelected);
            
            // Disable premium models for non-premium users
            if (isPremiumModel && !subscriptionStatus) {
                option.classList.add('disabled');
            } else {
                option.classList.remove('disabled');
            }
        });

        // Update voice provider switch - Allow both users to switch
        const voiceProviderSwitch = document.getElementById('voice-provider-switch');
        if (voiceProviderSwitch) {
            voiceProviderSwitch.checked = this.settings.voiceProvider === 'premium';
            this.toggleVoiceProviderUI();
            this.updateSwitchLabels();
        }

        // Update auto merge face switch
        const autoMergeFaceSwitch = document.getElementById('auto-merge-face-switch');
        if (autoMergeFaceSwitch) {
            autoMergeFaceSwitch.checked = this.settings.autoMergeFace !== undefined ? this.settings.autoMergeFace : true;
            
            // Disable for non-premium users
            if (!subscriptionStatus) {
                autoMergeFaceSwitch.disabled = true;
                autoMergeFaceSwitch.style.opacity = '0.6';
            } else {
                autoMergeFaceSwitch.disabled = false;
                autoMergeFaceSwitch.style.opacity = '1';
            }
        }

        // Update auto image generation switch
        const autoImageGenerationSwitch = document.getElementById('auto-image-generation-switch');
        if (autoImageGenerationSwitch) {
            autoImageGenerationSwitch.checked = this.settings.autoImageGeneration !== undefined ? this.settings.autoImageGeneration : !subscriptionStatus;
            
            // Disable for non-premium users
            if (!subscriptionStatus) {
                autoImageGenerationSwitch.disabled = true;
                autoImageGenerationSwitch.style.opacity = '0.6';
            } else {
                autoImageGenerationSwitch.disabled = false;
                autoImageGenerationSwitch.style.opacity = '1';
            }
        }

        // Update suggestions enable switch
        const suggestionsEnableSwitch = document.getElementById('suggestions-enable-switch');
        if (suggestionsEnableSwitch) {
            suggestionsEnableSwitch.checked = this.settings.suggestionsEnabled !== undefined ? this.settings.suggestionsEnabled : true;
        }

        // Update speech recognition enable switch
        const speechRecognitionEnableSwitch = document.getElementById('speech-recognition-enable-switch');
        if (speechRecognitionEnableSwitch) {
            speechRecognitionEnableSwitch.checked = this.settings.speechRecognitionEnabled !== undefined ? 
                this.settings.speechRecognitionEnabled : true;
        }

        // Update speech auto-send switch
        const speechAutoSendSwitch = document.getElementById('speech-auto-send-switch');
        if (speechAutoSendSwitch) {
            speechAutoSendSwitch.checked = this.settings.speechAutoSend !== undefined ? 
                this.settings.speechAutoSend : true;
        }

        // Apply initial speech button state
        this.toggleSpeechButton();

        // Update premium indicators
        this.setupPremiumIndicators(subscriptionStatus);
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

    // UI feedback methods
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

    // Public getter methods
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

    getMinimaxVoice() {
        if (!this.settings.minimaxVoice && this.settings.premiumVoice) {
            this.settings.minimaxVoice = this.settings.premiumVoice;
        }
        return this.settings.minimaxVoice || 'Wise_Woman';
    }

    getAutoMergeFace() {
        return this.settings.autoMergeFace;
    }

    getSelectedModel() {
        return this.settings.selectedModel;
    }

    getAutoImageGeneration() {
        return this.settings.autoImageGeneration;
    }

    // Chat-specific methods
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

    // Admin utility method
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
                if (window.showNotification) {
                    showNotification(`Corrected ${data.correctedCount} non-premium users' settings`, 'success');
                }
            }
        } catch (error) {
            console.error('Error correcting non-premium users:', error);
        }
    }

    // Enhanced Model loading and selection methods
    async loadAvailableModels() {
        if (!this.userId) {
            console.warn('No user ID available for loading models');
            this.showModelError('User ID not available');
            return;
        }

        try {
            const response = await fetch(`/api/chat-tool-settings/models/${this.userId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load models');
            }

            this.availableModels = data.models;
            this.isPremium = data.isPremium;
            this.renderModels();

        } catch (error) {
            console.error('Error loading available models:', error);
            this.showModelError(error.message);
        }
    }

    renderModels() {
        const container = document.getElementById('models-container');
        if (!container) return;

        if (Object.keys(this.availableModels).length === 0) {
            this.showModelError('No models available');
            return;
        }

        // Separate free and premium models
        const freeModels = {};
        const premiumModels = {};

        Object.entries(this.availableModels).forEach(([key, model]) => {
            if (model.provider === 'openai') {
                freeModels[key] = model;
            } else {
                premiumModels[key] = model;
            }
        });

        let html = '<div class="settings-model-sections">';

        // Render free models section
        if (Object.keys(freeModels).length > 0) {
            html += `
                <div class="settings-subsection">
                    <h6 class="settings-subsection-title fw-semibold mb-3">
                        <i class="bi bi-cpu me-2"></i>
                        ${this.t('freeModels')}
                    </h6>
                    <div class="settings-description text-muted mb-3">
                        ${this.t('freeModelsDescription')}
                    </div>
                    <div class="settings-model-grid">
                        ${this.renderModelOptions(freeModels, false)}
                    </div>
                </div>
            `;
        }

        // Render premium models section
        if (Object.keys(premiumModels).length > 0) {
            html += `
                <div class="settings-subsection">
                    <h6 class="settings-subsection-title fw-semibold mb-3">
                        <i class="bi bi-crown-fill premium-icon me-2 text-warning"></i>
                        ${this.t('premiumModels')}
                    </h6>
                    <div class="settings-description text-muted mb-3">
                        ${this.t('premiumModelsDescription')}
                    </div>
                    <div class="settings-model-grid">
                        ${this.renderModelOptions(premiumModels, true)}
                    </div>
                    ${!this.isPremium ? `
                        <div class="premium-feature-indicator mt-3">
                            <small class="text-warning d-block">
                                <i class="bi bi-star-fill me-1"></i> 
                                ${this.t('premiumModelsPremiumFeature')}
                            </small>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    renderModelOptions(models, isPremium) {
        return Object.entries(models).map(([key, model]) => {
            const isSelected = key === this.settings.selectedModel;
            // Remove the isDisabled logic - premium models should be clickable for all users
            
            const modelTranslations = this.t(`models.${key}`, {});
            const modelName = modelTranslations.name || model.displayName || model.modelName;
            const modelDescription = modelTranslations.description || model.description;
            const provider = modelTranslations.provider || this.getProviderName(model.provider);
            const speed = modelTranslations.speed || this.getSpeedLabel(key);
            const quality = modelTranslations.quality || this.getQualityLabel(key);

            return `
                <div class="settings-model-option ${isSelected ? 'selected' : ''} ${isPremium ? 'premium-model' : ''}" 
                     data-model="${key}">
                    ${isPremium ? '<div class="premium-model-badge"><i class="bi bi-crown-fill"></i> Premium</div>' : ''}
                    
                    <div class="settings-model-header">
                        <div class="settings-model-info">
                            <div class="settings-model-name">${modelName}</div>
                            <div class="settings-model-description">${modelDescription}</div>
                            <div class="settings-model-provider">via ${provider}</div>
                        </div>
                    </div>
                    
                    <div class="settings-model-stats">
                        <div class="settings-model-stat">
                            <div class="settings-model-stat-label">Speed</div>
                            <div class="settings-model-stat-value">
                                <span class="speed-indicator speed-${speed.toLowerCase().replace(' ', '-')}">
                                    <span class="speed-dot"></span>
                                    <span class="speed-dot"></span>
                                    <span class="speed-dot"></span>
                                    <span class="speed-dot"></span>
                                </span>
                                ${speed}
                            </div>
                        </div>
                        <div class="settings-model-stat">
                            <div class="settings-model-stat-label">Quality</div>
                            <div class="settings-model-stat-value">${quality}</div>
                        </div>
                        ${isPremium ? `
                            <div class="settings-model-stat">
                                <div class="settings-model-stat-label">Type</div>
                                <div class="settings-model-stat-value">
                                    <i class="bi bi-crown-fill text-warning"></i> Premium
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    getProviderName(provider) {
        const providerNames = {
            'openai': 'OpenAI',
            'novita': 'Novita AI'
        };
        return providerNames[provider] || provider;
    }

    getSpeedLabel(modelKey) {
        const speedMap = {
            'deepseek': 'Very Fast',
            'mistral': 'Fast',
            'gemma': 'Fast',
            'openai': 'Medium',
            'llama': 'Medium'
        };
        return speedMap[modelKey] || 'Medium';
    }

    getQualityLabel(modelKey) {
        const qualityMap = {
            'openai': 'Excellent',
            'llama': 'Excellent',
            'deepseek': 'Excellent',
            'gemma': 'Very Good',
            'mistral': 'Good'
        };
        return qualityMap[modelKey] || 'Good';
    }

    showModelError(message) {
        const container = document.getElementById('models-container');
        if (!container) return;

        container.innerHTML = `
            <div class="model-error-container">
                <i class="bi bi-exclamation-triangle fs-3 text-muted mb-3"></i>
                <div class="fw-semibold mb-2">Failed to Load AI Models</div>
                <div class="text-muted mb-3">${message}</div>
                <button type="button" class="model-retry-btn" onclick="window.chatToolSettings.loadAvailableModels()">
                    <i class="bi bi-arrow-clockwise me-1"></i>
                    Retry
                </button>
            </div>
        `;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatToolSettings = new ChatToolSettings();
});