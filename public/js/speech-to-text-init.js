/**
 * Speech-to-Text Integration
 * Initialize and integrate speech recognition with chat
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're in local/dev mode
    const isLocalMode = (typeof window !== 'undefined' && window.MODE === 'local') || 
                       (typeof process !== 'undefined' && process.env.MODE === 'local');
    
    if (isLocalMode) {
        console.log('[Speech-to-Text Init] Initializing speech-to-text feature in local mode...');
    }
    
    // Check if required dependencies are loaded
    if (typeof SpeechToTextUI === 'undefined') {
        if (isLocalMode) {
            console.error('[Speech-to-Text Init] SpeechToTextUI class not found. Make sure speech-to-text-ui.js is loaded.');
        }
        return;
    }
    
    // Initialize speech-to-text UI
    const speechUI = new SpeechToTextUI({
        containerId: 'chatInput',
        onTextResult: handleSpeechResult
    });
    
    if (isLocalMode) {
        console.log('[Speech-to-Text Init] Speech-to-text feature initialized successfully');
    }
    
    /**
     * Handle speech recognition result
     * @param {string} text - The recognized text
     * @param {string} language - The detected/selected language
     */
    function handleSpeechResult(text, language) {
        if (isLocalMode) {
            console.log('[Speech-to-Text Init] Speech result received:', { 
                text: text, 
                language: language,
                textLength: text.length 
            });
        }
        
        // Find the chat input textarea
        const messageInput = document.getElementById('userMessage');
        if (messageInput) {
            // Set the recognized text in the input
            messageInput.value = text;
            
            // Trigger input event to update any listeners
            //messageInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Focus the input
            //messageInput.focus();
            
            if (isLocalMode) {
                console.log('[Speech-to-Text Init] Text inserted into message input successfully');
            }

            // Check auto-send setting from chat tool settings
            const autoSend = window.chatToolSettings ? 
                window.chatToolSettings.getSpeechAutoSend() : 
                getSpeechToTextSetting('autoSend', false);
            console.log('Auto Send:', autoSend);
            if (autoSend) {
                if (isLocalMode) {
                    console.log('[Speech-to-Text Init] Auto-sending message...');
                }
                // Find and click the send button
                const sendButton = document.getElementById('sendMessage');
                if (sendButton) {
                    setTimeout(() => {
                        sendButton.click();
                    }, 500); // Small delay to show the text was inserted
                }
            } else {
                // Just highlight the send button to encourage sending
                highlightSendButton();
            }
        } else {
            if (isLocalMode) {
                console.error('[Speech-to-Text Init] Message input element not found (ID: userMessage)');
            }
        }
        
        // Show success notification
        //showSpeechNotification('success', `Speech recognized: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }
    
    // Listen for settings updates
    document.addEventListener('chatSettingsUpdated', function(event) {
        const settings = event.detail;
        
        // Update speech button visibility based on settings
        if (speechUI && typeof speechUI.toggleVisibility === 'function') {
            speechUI.toggleVisibility(settings.speechRecognitionEnabled);
        }
        
        if (isLocalMode) {
            console.log('[Speech-to-Text Init] Settings updated:', {
                speechEnabled: settings.speechRecognitionEnabled,
                autoSend: settings.speechAutoSend
            });
        }
    });
    
    /**
     * Highlight the send button to encourage user to send
     */
    function highlightSendButton() {
        const sendButton = document.getElementById('sendMessage');
        if (sendButton) {
            sendButton.classList.add('btn-primary');
            sendButton.classList.remove('btn-light');
            
            // Reset after a few seconds
            setTimeout(() => {
                sendButton.classList.remove('btn-primary');
                sendButton.classList.add('btn-light');
            }, 3000);
        }
    }
    
    /**
     * Show speech notification
     * @param {string} type - success, error, info
     * @param {string} message - notification message
     */
    function showSpeechNotification(type, message) {
        // Try to use existing notification system if available
        if (typeof showNotification === 'function') {
            showNotification(message, type);
            return;
        }
        
        // Fallback: create simple toast notification
        const toast = document.createElement('div');
        toast.className = `speech-toast speech-toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // Remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }
    
    /**
     * Get speech-to-text setting
     * @param {string} key - setting key
     * @param {any} defaultValue - default value if not set
     */
    function getSpeechToTextSetting(key, defaultValue) {
        try {
            const settings = JSON.parse(localStorage.getItem('speechToTextSettings') || '{}');
            return settings[key] !== undefined ? settings[key] : defaultValue;
        } catch (error) {
            if (isLocalMode) {
                console.error('[Speech-to-Text Init] Error reading speech settings:', error);
            }
            return defaultValue;
        }
    }
    
    /**
     * Set speech-to-text setting
     * @param {string} key - setting key
     * @param {any} value - setting value
     */
    function setSpeechToTextSetting(key, value) {
        try {
            const settings = JSON.parse(localStorage.getItem('speechToTextSettings') || '{}');
            settings[key] = value;
            localStorage.setItem('speechToTextSettings', JSON.stringify(settings));
        } catch (error) {
            if (isLocalMode) {
                console.error('[Speech-to-Text Init] Error saving speech settings:', error);
            }
        }
    }
    
    // Add keyboard shortcut for speech recognition
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Shift + M to start speech recognition
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
            e.preventDefault();
            
            // Find the speech button and click it
            const speechBtn = document.getElementById('speech-to-text-btn');
            if (speechBtn) {
                speechBtn.click();
            }
        }
    });
    
    // Add CSS for toast animations if not already present
    if (!document.querySelector('#speech-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'speech-toast-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Expose speech UI globally for debugging
    window.speechToTextUI = speechUI;
});

// Check for required dependencies and show warnings
window.addEventListener('load', function() {
    const isLocalMode = (typeof window !== 'undefined' && window.MODE === 'local') || 
                       (typeof process !== 'undefined' && process.env.MODE === 'local');
    
    const requiredFiles = [
        { name: 'SpeechToTextUtils', file: 'speech-to-text-utils.js' },
        { name: 'SpeechToTextUI', file: 'speech-to-text-ui.js' }
    ];
    
    const missingDeps = requiredFiles.filter(dep => typeof window[dep.name] === 'undefined');
    
    if (missingDeps.length > 0) {
        if (isLocalMode) {
            console.warn('[Speech-to-Text Init] Missing dependencies:', missingDeps.map(dep => dep.file));
        }
    } else if (isLocalMode) {
        console.log('[Speech-to-Text Init] All dependencies loaded successfully');
    }
});
