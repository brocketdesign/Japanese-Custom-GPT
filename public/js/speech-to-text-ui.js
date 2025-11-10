/**
 * Speech to Text UI Controller
 * Manages the user interface for speech recognition feature
 */

class SpeechToTextUI {
    constructor(options = {}) {
        this.containerId = options.containerId || 'chatInput';
        this.buttonClass = options.buttonClass || 'speech-btn';
        this.modalId = options.modalId || 'speech-modal';
        
        // Initialize speech utility
        this.speechUtils = new SpeechToTextUtils({
            onStart: () => this.onRecordingStart(),
            onStop: () => this.onRecordingStop(),
            onResult: (text, language) => this.onSpeechResult(text, language),
            onError: (error) => this.onSpeechError(error),
            onProgress: (status) => this.onProgress(status)
        });
        
        // UI state
        this.isInitialized = false;
        this.currentLanguage = 'auto';
        
        // Callback for when speech is converted to text
        this.onTextResult = options.onTextResult || (() => {});
        
        // Translations
        this.translations = this.getTranslations();
        
        this.init();
    }
    
    /**
     * Initialize the UI components
     */
    init() {
        if (this.isInitialized) return;
        
        this.createSpeechButton();
        this.bindEvents();
        this.isInitialized = true;
    }
    
    /**
     * Create speech button
     */
    createSpeechButton() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            return;
        }
        
        // Find the input group or create one
        const inputGroup = container.querySelector('.input-group') || container.querySelector('#toolbar-text-input .input-group');
        if (!inputGroup) {
            return;
        }
        
        // Create speech button
        const speechBtn = document.createElement('button');
        speechBtn.id = 'speech-to-text-btn';
        speechBtn.className = `btn btn-light d-flex px-3 border-0 chat-utils me-1 ${this.buttonClass}`;
        speechBtn.type = 'button';
        speechBtn.innerHTML = '<i class="bi bi-mic"></i>';
        speechBtn.title = this.translations.startRecording;
        
        // Insert before send button
        const sendButton = inputGroup.querySelector('#sendMessage');
        if (sendButton) {
            inputGroup.insertBefore(speechBtn, sendButton);
        } else {
            inputGroup.appendChild(speechBtn);
        }
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Speech button click
        const speechBtn = document.getElementById('speech-to-text-btn');
        if (speechBtn) {
            speechBtn.addEventListener('click', () => this.toggleRecording());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to cancel recording
            if (e.key === 'Escape' && this.speechUtils.getStatus().isRecording) {
                this.cancelRecording();
            }
        });
    }
    
    /**
     * Toggle recording state
     */
    async toggleRecording() {
        const status = this.speechUtils.getStatus();
        
        if (status.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

     /**
     * Toggle speech button visibility
     */
    toggleVisibility(enabled) {
        const speechBtn = document.getElementById('speech-to-text-btn');
        if (speechBtn) {
            if (enabled) {
                speechBtn.style.display = '';
                speechBtn.disabled = false;
            } else {
                speechBtn.style.display = 'none';
                speechBtn.disabled = true;
            }
        }
    }

    /**
     * Check if speech recognition is enabled in settings
     */
    isEnabledInSettings() {
        if (window.chatToolSettings) {
            return window.chatToolSettings.getSpeechRecognitionEnabled();
        }
        return true; // Default to enabled if settings not available
    }

    /**
     * Start recording
     */
    async startRecording() {
        if (!this.isEnabledInSettings()) {
            this.showError('Speech recognition is disabled in settings');
            return;
        }
        // Check support
        if (!this.speechUtils.isSupported()) {
            this.showError(this.translations.notSupported);
            return;
        }
        
        // Request permission
        const hasPermission = await this.speechUtils.requestPermission();
        if (!hasPermission) {
            this.showError(this.translations.permissionDenied);
            return;
        }
        
        try {
            await this.speechUtils.startRecording();
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    /**
     * Stop recording
     */
    stopRecording() {
        this.speechUtils.stopRecording();
    }
    
    /**
     * Cancel recording
     */
    cancelRecording() {
        this.speechUtils.cancel();
        this.updateButtonState('idle');
    }
    
    /**
     * Update button state
     */
    updateButtonState(state) {
        const button = document.getElementById('speech-to-text-btn');
        if (!button) return;
        
        button.classList.remove('recording', 'processing');
        
        switch (state) {
            case 'recording':
                button.classList.add('recording');
                button.innerHTML = '<i class="bi bi-mic-fill"></i>';
                button.title = this.translations.stopRecording;
                button.style.backgroundColor = '#dc3545';
                button.style.color = 'white';
                break;
                
            case 'processing':
                button.classList.add('processing');
                button.innerHTML = '<i class="bi bi-hourglass-split"></i>';
                button.title = this.translations.processing;
                button.style.backgroundColor = '#ffc107';
                button.style.color = 'black';
                break;
                
            case 'idle':
            default:
                button.innerHTML = '<i class="bi bi-mic"></i>';
                button.title = this.translations.startRecording;
                button.style.backgroundColor = '';
                button.style.color = '';
                break;
        }
    }
    
    /**
     * Event handlers
     */
    onRecordingStart() {
        this.updateButtonState('recording');
    }
    
    onRecordingStop() {
        this.updateButtonState('processing');
    }
    
    onSpeechResult(text, language) {
        this.updateButtonState('idle');
        
        // Send result directly to the text input
        this.onTextResult(text, language);
    }
    
    onSpeechError(error) {
        this.updateButtonState('idle');
        this.showError(error.message);
    }
    
    onProgress(status) {
        if (status === 'processing') {
            this.updateButtonState('processing');
        }
    }
    
    /**
     * Show error message
     */
    showError(message) {
        alert(message); // Simple fallback, replace with your notification system
    }
    
    /**
     * Get translations based on current language
     */
    getTranslations() {
        // Use global speech-to-text translations if available
        if (typeof window.speechToTextTranslations !== 'undefined' && window.speechToTextTranslations.speechToText) {
            return window.speechToTextTranslations.speechToText;
        }
        
        // Fallback to global translations if available
        if (typeof window.translations !== 'undefined' && window.translations.speechToText) {
            return window.translations.speechToText;
        }
        
        // Default English translations as last resort
        return {
            startRecording: 'Start voice recording',
            stopRecording: 'Stop recording',
            listening: 'Listening...',
            speakNow: 'Speak now, I\'m listening!',
            processing: 'Processing...',
            processingAudio: 'Converting speech to text...',
            success: 'Success!',
            speechRecognized: 'Speech recognized successfully',
            recognizedText: 'Recognized Text:',
            error: 'Error',
            errorOccurred: 'An error occurred during speech recognition',
            cancel: 'Cancel',
            send: 'Send',
            notSupported: 'Speech recognition is not supported in this browser',
            permissionDenied: 'Microphone permission denied'
        };
    }
    
    /**
     * Destroy the UI component
     */
    destroy() {
        if (this.speechUtils) {
            this.speechUtils.cancel();
        }
        
        const button = document.getElementById('speech-to-text-btn');
        if (button) {
            button.remove();
        }
        
        this.isInitialized = false;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechToTextUI;
} else {
    window.SpeechToTextUI = SpeechToTextUI;
}
