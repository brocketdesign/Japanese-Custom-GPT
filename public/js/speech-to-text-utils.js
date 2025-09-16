/**
 * Speech to Text Utility Class
 * Handles audio recording, streaming, and OpenAI Whisper API integration
 */

class SpeechToTextUtils {
    constructor(options = {}) {
        this.apiEndpoint = '/api/speech-to-text';
        this.isRecording = false;
        this.isProcessing = false;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.language = options.language || 'auto';
        
        // Check if we're in local/dev mode
        this.isLocalMode = (typeof window !== 'undefined' && window.MODE === 'local') || 
                          (typeof process !== 'undefined' && process.env.MODE === 'local');
        
        if (this.isLocalMode) {
            console.log('[Speech-to-Text Utils] Initialized in local mode');
        }
        
        // Supported languages for speech recognition
        this.supportedLanguages = {
            'auto': { name: 'Auto Detect', code: 'auto' },
            'en': { name: 'English', code: 'en' },
            'ja': { name: '日本語', code: 'ja' },
            'ko': { name: '한국어', code: 'ko' },
            'zh': { name: '中文', code: 'zh' },
            'fr': { name: 'Français', code: 'fr' },
            'de': { name: 'Deutsch', code: 'de' },
            'es': { name: 'Español', code: 'es' },
            'it': { name: 'Italiano', code: 'it' },
            'pt': { name: 'Português', code: 'pt' },
            'ru': { name: 'Русский', code: 'ru' },
            'ar': { name: 'العربية', code: 'ar' }
        };
        
        // Event callbacks
        this.onStart = options.onStart || (() => {});
        this.onStop = options.onStop || (() => {});
        this.onResult = options.onResult || (() => {});
        this.onError = options.onError || (() => {});
        this.onProgress = options.onProgress || (() => {});
        
        // Audio constraints
        this.audioConstraints = {
            audio: {
                sampleRate: 44100,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
    }
    
    /**
     * Check if speech recognition is supported
     */
    isSupported() {
        return navigator.mediaDevices && 
               navigator.mediaDevices.getUserMedia && 
               window.MediaRecorder;
    }
    
    /**
     * Request microphone permission
     */
    async requestPermission() {
        try {
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] Requesting microphone permission...');
            }
            
            const stream = await navigator.mediaDevices.getUserMedia(this.audioConstraints);
            stream.getTracks().forEach(track => track.stop());
            
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] Microphone permission granted');
            }
            
            return true;
        } catch (error) {
            if (this.isLocalMode) {
                console.error('[Speech-to-Text Utils] Microphone permission denied:', error);
            }
            return false;
        }
    }
    
    /**
     * Start recording audio
     */
    async startRecording() {
        if (this.isRecording) {
            throw new Error('Already recording');
        }
        
        if (this.isLocalMode) {
            console.log('[Speech-to-Text Utils] Starting recording...');
        }
        
        try {
            // Request microphone access
            this.audioStream = await navigator.mediaDevices.getUserMedia(this.audioConstraints);
            
            const mimeType = this.getSupportedMimeType();
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] Using MIME type:', mimeType);
            }
            
            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: mimeType
            });
            
            this.audioChunks = [];
            
            // Handle data available
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    if (this.isLocalMode) {
                        console.log('[Speech-to-Text Utils] Audio chunk received:', {
                            size: event.data.size,
                            totalChunks: this.audioChunks.length
                        });
                    }
                }
            };
            
            // Handle recording stop
            this.mediaRecorder.onstop = () => {
                if (this.isLocalMode) {
                    console.log('[Speech-to-Text Utils] Recording stopped, processing audio...');
                }
                this.processAudio();
            };
            
            // Handle errors
            this.mediaRecorder.onerror = (event) => {
                if (this.isLocalMode) {
                    console.error('[Speech-to-Text Utils] Recording error:', event.error);
                }
                this.onError(new Error(`Recording error: ${event.error}`));
            };
            
            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] Recording started successfully');
            }
            
            this.onStart();
            
        } catch (error) {
            if (this.isLocalMode) {
                console.error('[Speech-to-Text Utils] Failed to start recording:', error);
            }
            this.onError(error);
            throw error;
        }
    }
    
    /**
     * Stop recording audio
     */
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            return;
        }
        
        this.isRecording = false;
        this.mediaRecorder.stop();
        
        // Stop all audio tracks
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
        }
        
        this.onStop();
    }
    
    /**
     * Process recorded audio
     */
    async processAudio() {
        if (this.audioChunks.length === 0) {
            if (this.isLocalMode) {
                console.error('[Speech-to-Text Utils] No audio chunks to process');
            }
            this.onError(new Error('No audio data recorded'));
            return;
        }
        
        this.isProcessing = true;
        this.onProgress('processing');
        
        try {
            // Create audio blob
            const mimeType = this.getSupportedMimeType();
            const audioBlob = new Blob(this.audioChunks, { 
                type: mimeType 
            });
            
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] Audio blob created:', {
                    size: audioBlob.size,
                    type: audioBlob.type,
                    chunks: this.audioChunks.length,
                    language: this.language
                });
            }
            
            // Create FormData for API request
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] Sending to API:', {
                    endpoint: this.apiEndpoint,
                    blobSize: audioBlob.size
                });
            }
            
            // Send to backend API
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                body: formData
            });
            
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] API response received:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                });
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                if (this.isLocalMode) {
                    console.error('[Speech-to-Text Utils] API error response:', {
                        status: response.status,
                        statusText: response.statusText,
                        errorText: errorText
                    });
                }
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            
            if (this.isLocalMode) {
                console.log('[Speech-to-Text Utils] API result:', {
                    success: result.success,
                    textLength: result.text?.length,
                    language: result.language,
                    hasError: !!result.error
                });
            }
            
            if (result.success) {
                if (this.isLocalMode) {
                    console.log('[Speech-to-Text Utils] Transcription successful:', {
                        text: result.text,
                        language: result.language
                    });
                }
                this.onResult(result.text, result.language || this.language);
            } else {
                throw new Error(result.error || 'Speech recognition failed');
            }
            
        } catch (error) {
            if (this.isLocalMode) {
                console.error('[Speech-to-Text Utils] Processing error:', {
                    message: error.message,
                    stack: error.stack
                });
            }
            this.onError(error);
        } finally {
            this.isProcessing = false;
            this.cleanup();
        }
    }
    
    /**
     * Get supported MIME type for recording
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/mp3'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                if (this.isLocalMode) {
                    console.log('[Speech-to-Text Utils] Selected MIME type:', type);
                }
                return type;
            }
        }
        
        if (this.isLocalMode) {
            console.warn('[Speech-to-Text Utils] Using fallback MIME type: audio/webm');
        }
        return 'audio/webm'; // fallback
    }
    
    /**
     * Set language for speech recognition
     */
    setLanguage(languageCode) {
        if (this.supportedLanguages[languageCode]) {
            this.language = languageCode;
        }
    }
    
    /**
     * Get current language
     */
    getLanguage() {
        return this.language;
    }
    
    /**
     * Get supported languages
     */
    getSupportedLanguages() {
        return this.supportedLanguages;
    }
    
    /**
     * Cancel current recording
     */
    cancel() {
        if (this.isRecording) {
            this.isRecording = false;
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
        }
        
        this.cleanup();
    }
    
    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isProcessing = false;
    }
    
    /**
     * Get recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            isProcessing: this.isProcessing,
            language: this.language
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechToTextUtils;
} else {
    window.SpeechToTextUtils = SpeechToTextUtils;
}
