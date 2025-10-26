// Audio management
const audioCache = new Map();
const audioPool = [];
let audioPermissionGranted = true;
let sharedAudioContext = null;

function promiseWithTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                reject(new Error(timeoutMessage));
            }
        }, timeoutMs);

        promise
            .then(value => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    resolve(value);
                }
            })
            .catch(error => {
                if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(error);
                }
            });
    });
}

/**
 * Initialize audio functionality
 */
function initializeAudio() {
    let autoPlay = localStorage.getItem('audioAutoPlay') === 'true';
    $('#audio-icon').addClass(autoPlay ? 'bi-volume-up' : 'bi-volume-mute');
    $('#audio-play').click(function() {
        if(!subscriptionStatus){
            loadPlanPage();
            return;
        }
        autoPlay = !autoPlay;
        localStorage.setItem('audioAutoPlay', autoPlay);
        $('#audio-icon').toggleClass('bi-volume-up bi-volume-mute');
    });
}

/**
 * Request audio permission from user
 */
function requestAudioPermission() {
    if (audioPermissionGranted) {
        return Promise.resolve(true);
    }

    return Swal.fire({
        title: 'オーディオ再生の許可',
        text: '次回から自動再生されます。',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showCancelButton: true,
        confirmButtonText: 'はい',
        cancelButtonText: 'いいえ',
        customClass: {
            popup: 'animate__animated animate__fadeIn animate__faster',
            backdrop: 'swal2-backdrop-show animate__animated animate__fadeIn animate__faster',
            container: 'swal2-container swal2-top-end',
            title: 'swal2-title',
            content: 'swal2-content',
            actions: 'swal2-actions',
            confirmButton: 'swal2-confirm swal2-styled',
            cancelButton: 'swal2-cancel swal2-styled',
        },
        didClose: () => {
            Swal.getPopup().classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');
        }
    }).then((result) => {
        if (result.isConfirmed) {
            audioPermissionGranted = true;
        }
        return result.isConfirmed;
    });
}

/**
 * Stop all currently playing audios
 */
function stopAllAudios() {
    audioPool.forEach(audio => {
        if (!audio.paused) {
            audio.pause();
        }

        audio.currentTime = 0;

        if (typeof audio.cleanup === 'function') {
            try {
                audio.cleanup();
            } catch (cleanupError) {
                console.warn('Error cleaning up audio resource:', cleanupError);
            }
            audio.cleanup = null;
        }

        if (audio.controlElement) {
            const storedDuration = Number(audio.controlElement.attr('data-audio-duration'));
            const displayDuration = formatDurationForDisplay(storedDuration);
            audio.controlElement.html(displayDuration ? `► ${displayDuration}"` : '►');
        }
    });
}

/**
 * Get an available audio element from the pool
 */
function getAvailableAudio() {
    const idleAudio = audioPool.find(a => a.paused && a.currentTime === 0);
    if (idleAudio) {
        return idleAudio;
    } else {
        const newAudio = new Audio();
        newAudio.preload = 'auto';
        audioPool.push(newAudio);
        return newAudio;
    }
}

function getSharedAudioContext() {
    if (sharedAudioContext) {
        return sharedAudioContext;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
        console.warn('[txt2speech] Web Audio API is unavailable; duration decoding skipped.');
        return null;
    }

    sharedAudioContext = new AudioContextCtor();
    return sharedAudioContext;
}

function decodeAudioBuffer(audioContext, arrayBuffer) {
    if (!audioContext) {
        return Promise.reject(new Error('AudioContext is not available'));
    }

    if (audioContext.decodeAudioData.length === 1) {
        return audioContext.decodeAudioData(arrayBuffer);
    }

    return new Promise((resolve, reject) => {
        audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
}

async function computeAudioDuration(blob) {
    try {
        const audioContext = getSharedAudioContext();
        if (!audioContext) {
            return null;
        }

        const decodeTask = (async () => {
            if (audioContext.state === 'suspended') {
                try {
                    await audioContext.resume();
                } catch (resumeError) {
                    console.warn('[txt2speech] Unable to resume AudioContext before decoding:', resumeError);
                }
            }

            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await decodeAudioBuffer(audioContext, arrayBuffer);
            return audioBuffer.duration;
        })();

        return await promiseWithTimeout(decodeTask, 2000, 'Audio decode timed out');
    } catch (error) {
        console.warn('[txt2speech] Failed to decode audio duration:', error);
        return null;
    }
}

function formatDurationForDisplay(duration) {
    if (!Number.isFinite(duration) || duration <= 0) {
        return null;
    }

    return Math.max(1, Math.round(duration));
}

function createPlaybackSource(entry) {
    if (!entry) {
        return null;
    }

    if (typeof entry === 'string') {
        return {
            url: entry,
            duration: null,
            cleanup: null
        };
    }

    if (entry.type === 'blob' && entry.blob instanceof Blob) {
        if (!entry.objectUrl) {
            entry.objectUrl = URL.createObjectURL(entry.blob);
        }

        return {
            url: entry.objectUrl,
            duration: entry.duration ?? null,
            durationPromise: entry.durationPromise ?? null,
            cleanup: null
        };
    }

    if (entry.type === 'url' && entry.url) {
        return {
            url: entry.url,
            duration: entry.duration ?? null,
            durationPromise: entry.durationPromise ?? null,
            cleanup: null
        };
    }

    if (entry.url) {
        return {
            url: entry.url,
            duration: entry.duration ?? null,
            durationPromise: entry.durationPromise ?? null,
            cleanup: null
        };
    }

    console.warn('[txt2speech] Invalid audio cache entry:', entry);
    return null;
}

/**
 * Initialize audio for a specific message
 */
function initAudio($el, message) {
    if(!subscriptionStatus){
        loadPlanPage();
        return;
    }

    requestAudioPermission().then(async isAllowed => {
        if (!isAllowed) {
            return $el.html('►');
        }
        
        // Check if audio is already cached
        const cachedEntry = audioCache.get(message);

        if (cachedEntry) {
            const playbackSource = createPlaybackSource(cachedEntry);
            if (!playbackSource) {
                console.warn('[initAudio] Cached audio entry invalid, removing from cache.');
                audioCache.delete(message);
                return $el.html('►');
            }

            const audio = getAvailableAudio();
            playAudio($el, audio, playbackSource, message);
            return;
        }

        // Audio not cached, show loading state and fetch
        $el.html('<div class="spinner-grow spinner-grow-sm" role="status"><span class="visually-hidden">Loading...</span></div>');
        try {
            const cacheEntry = await generateTextToSpeech(message);
            if (!cacheEntry) {
                throw new Error('No audio data returned from text-to-speech provider.');
            }
            audioCache.set(message, cacheEntry);

            const playbackSource = createPlaybackSource(cacheEntry);
            if (!playbackSource) {
                throw new Error('Unable to prepare audio playback source.');
            }

            const audio = getAvailableAudio();
            playAudio($el, audio, playbackSource, message);
        } catch (error) {
            console.error('Error generating audio:', error);
            // Reset UI to original state to allow retry
            $el.html('►');
            // Fallback to original voice URL method if Minimax fails
            try {
                const fallbackUrl = await getVoiceUrl(message);
                const response = await fetch(fallbackUrl, {
                    method: 'POST',
                    credentials: 'omit'
                });
                const result = await response.json();
                if (result.errno === 0 && result.data && result.data.audio_url) {
                    const fallbackDurationRaw = Number(result.data.duration);
                    const fallbackDuration = Number.isFinite(fallbackDurationRaw) && fallbackDurationRaw > 0 ? fallbackDurationRaw : null;
                    const fallbackEntry = {
                        type: 'url',
                        url: result.data.audio_url,
                        duration: fallbackDuration,
                        durationPromise: fallbackDuration ? Promise.resolve(fallbackDuration) : null
                    };
                    audioCache.set(message, fallbackEntry);

                    const playbackSource = createPlaybackSource(fallbackEntry);
                    if (playbackSource) {
                        const audio = getAvailableAudio();
                        playAudio($el, audio, playbackSource, message);
                        return;
                    }
                }

                $el.html('►');
            } catch (fallbackError) {
                console.error('Fallback audio generation failed:', fallbackError);
                $el.html('►');
            }
        }
    }).catch(error => {
        // Catch any unhandled promise rejections from requestAudioPermission
        console.error('Error in requestAudioPermission or audio initialization:', error);
        $el.html('►');
    });
}

/**
 * Generate text-to-speech using the appropriate API based on user settings
 */
async function generateTextToSpeech(message) {
    try {
        // Get voice provider settings
        const voiceProvider = window.chatToolSettings?.getVoiceProvider() || 'standard';
        
        console.log('[generateTextToSpeech] Using provider:', voiceProvider);
        
        if (voiceProvider === 'minimax' || voiceProvider === 'premium') {
            // Use Minimax API
            const minimaxVoice = window.chatToolSettings?.getMinimaxVoice?.() || 'Wise_Woman';
            console.log('[generateTextToSpeech] Using Minimax voice:', minimaxVoice);

            const response = await fetch('/api/minimax/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: message,
                    userId: typeof userId !== 'undefined' ? userId : null,
                    chatId: typeof chatId !== 'undefined' ? chatId : null,
                    voiceName: minimaxVoice,
                    language: typeof language !== 'undefined' ? language : 'ja'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[generateTextToSpeech] Minimax API error:', errorData);
                throw new Error(`Minimax API error! status: ${response.status}`);
            }

            const audioBlob = await response.blob();

            const cacheEntry = {
                type: 'blob',
                blob: audioBlob,
                duration: null,
                durationPromise: null
            };

            cacheEntry.durationPromise = computeAudioDuration(audioBlob)
                .then(duration => {
                    if (Number.isFinite(duration) && duration > 0) {
                        cacheEntry.duration = duration;
                        return duration;
                    }
                    return null;
                })
                .catch(error => {
                    console.warn('[generateTextToSpeech] Unable to compute Minimax audio duration:', error);
                    return null;
                });

            return cacheEntry;
        } else {
            // Use OpenAI API
            const openAIVoice = window.chatToolSettings?.getSelectedVoice() || 'nova';
            console.log('[generateTextToSpeech] Using OpenAI voice:', openAIVoice);
            
            const response = await fetch('/api/txt2speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    voice: openAIVoice,
                    userId: typeof userId !== 'undefined' ? userId : null,
                    chatId: typeof chatId !== 'undefined' ? chatId : null,
                    language: typeof language !== 'undefined' ? language : 'ja'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[generateTextToSpeech] OpenAI API error:', errorData);
                throw new Error(`OpenAI API error! status: ${response.status}`);
            }


            // OpenAI API returns JSON with audio_url field pointing to a file
            const result = await response.json();
            if (result.errno === 0 && result.data && result.data.audio_url) {
                const reportedDuration = Number(result.data.duration);
                const normalizedDuration = Number.isFinite(reportedDuration) && reportedDuration > 0 ? reportedDuration : null;

                return {
                    type: 'url',
                    url: result.data.audio_url,
                    duration: normalizedDuration,
                    durationPromise: normalizedDuration ? Promise.resolve(normalizedDuration) : null
                };
            } else {
                throw new Error('Invalid response from OpenAI API: ' + JSON.stringify(result));
            }
        }
        
    } catch (error) {
        console.error('Error generating speech:', error);
        throw error;
    }
}

/**
 * Fallback voice URL generation (existing method)
 */
async function getVoiceUrl(message) {
    
    if (typeof message === 'undefined' || message.trim() === '') {
        return Promise.reject(new Error('Message is required for text-to-speech'));
    }
    // OpenAI API
    if (typeof language !== 'undefined' && language !== 'japanese' && language !== 'ja') {
        return `/api/txt2speech?message=${encodeURIComponent(message)}&language=${language}&chatId=${typeof chatId !== 'undefined' ? chatId : ''}&userId=${typeof userId !== 'undefined' ? userId : ''}`;
    }

    const baseUrl = 'https://api.synclubaichat.com/aichat/h5/tts/msg2Audio';
    const genre = $('#chat-container').attr('data-genre');
    
    const robot_id = genre === 'male' ? '1533008538' : '1533008511';
    const t_secret = genre === 'male' ? '661712' : '58573';

    const ts = Math.floor(Date.now() / 1000);

    const sign = generateMD5(robot_id + ts + t_secret);

    const params = new URLSearchParams({
        device: 'web_desktop',
        product: 'aichat',
        sys_lang: 'en-US',
        country: '',
        referrer: '',
        zone: '9',
        languageV2: 'ja',
        uuid: '',
        app_version: '1.6.4',
        message: message,
        voice_actor: 'default_voice',
        robot_id,
        ts,
        t_secret,
        sign
    });

    return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate MD5 hash (for fallback method)
 */
function generateMD5(text) {
    return md5(text); // blueimp-md5 provides the md5() function globally
}

/**
 * Play audio with UI controls
 */
function playAudio($el, audio, source, message) {
    const playbackSource = source && source.url ? source : createPlaybackSource(source);

    if (!playbackSource || !playbackSource.url) {
        console.error('[playAudio] No audio source provided for playback.');
        $el.html('►');
        return;
    }

    const { url, duration, cleanup, durationPromise } = playbackSource;
    const currentlyPlaying = audio.src === url && !audio.paused && audio.readyState > 0;

    let cleaned = false;
    let isSourceActive = true;
    const safeCleanup = () => {
        if (!cleaned && typeof cleanup === 'function') {
            cleanup();
            cleaned = true;
        }
        isSourceActive = false;
    };

    if (currentlyPlaying) {
        audio.pause();
        audio.currentTime = 0;
        const storedDuration = Number($el.attr('data-audio-duration'));
        const displayDuration = formatDurationForDisplay(storedDuration);
        $el.html(displayDuration ? `► ${displayDuration}"` : '►');
        safeCleanup();
        audio.cleanup = null;
        return;
    }

    if (typeof audio.cleanup === 'function') {
        try {
            audio.cleanup();
        } catch (cleanupError) {
            console.warn('[playAudio] Previous audio cleanup failed:', cleanupError);
        }
    }
    audio.cleanup = safeCleanup;

    audioPool.forEach(a => {
        if (a !== audio) {
            if (!a.paused) {
                a.pause();
            }
            a.muted = true;
            a.currentTime = 0;
            if (typeof a.cleanup === 'function') {
                try {
                    a.cleanup();
                } catch (cleanupError) {
                    console.warn('[playAudio] Cleanup failed for other audio:', cleanupError);
                }
                a.cleanup = null;
            }
            if (a.controlElement) {
                const previousDuration = Number(a.controlElement.attr('data-audio-duration'));
                const displayDuration = formatDurationForDisplay(previousDuration);
                a.controlElement.html(displayDuration ? `► ${displayDuration}"` : '►');
            }
        }
    });

    const updateControlState = (rawDuration, isPlaying) => {
        const displayDuration = formatDurationForDisplay(rawDuration);
        if (displayDuration) {
            $el.attr('data-audio-duration', rawDuration);
            $el.html(isPlaying ? `❚❚ ${displayDuration}"` : `► ${displayDuration}"`);
        } else {
            $el.removeAttr('data-audio-duration');
            $el.html(isPlaying ? '❚❚' : '►');
        }
    };

    const targetDuration = Number.isFinite(duration) && duration > 0 ? duration : null;
    if (targetDuration) {
        updateControlState(targetDuration, true);
    } else {
        $el.html('❚❚');
    }

    if (!targetDuration && durationPromise && typeof durationPromise.then === 'function') {
        durationPromise
            .then(resolvedDuration => {
                if (!Number.isFinite(resolvedDuration) || resolvedDuration <= 0) {
                    return;
                }
                if (!isSourceActive) {
                    return;
                }
                const isPlayingSameSource = audio.controlElement === $el && audio.src === url;
                updateControlState(resolvedDuration, isPlayingSameSource && !audio.paused);
            })
            .catch(error => {
                console.warn('[playAudio] Deferred duration resolution failed:', error);
            });
    }

    if (audio.src !== url) {
        console.log('[playAudio] Setting audio source:', url);
        audio.src = url;
        try {
            audio.load();
        } catch (loadError) {
            console.warn('[playAudio] audio.load() failed:', loadError);
        }
    } else {
        try {
            audio.currentTime = 0;
        } catch (timeError) {
            console.warn('[playAudio] Unable to reset currentTime:', timeError);
        }
    }

    audio.muted = false;
    audio.controlElement = $el;

    audio.addEventListener('canplaythrough', () => {
        console.log('[playAudio] Audio ready to play');
    }, { once: true });

    audio.onloadedmetadata = () => {
        const metaDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : targetDuration;
        if (metaDuration) {
            console.log('[playAudio] Audio metadata loaded, duration:', metaDuration);
            updateControlState(metaDuration, true);
        } else {
            console.log('[playAudio] Audio metadata loaded but duration unavailable.');
        }
    };

    audio.onerror = (event) => {
        console.error('Audio error occurred:', event);
        console.error('Audio error details:', audio.error);
        console.error('Audio source at error:', audio.src);
        updateControlState(null, false);
        safeCleanup();
        audio.cleanup = null;
    };

    audio.onended = () => {
        const storedDuration = Number($el.attr('data-audio-duration'));
        const finalDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (targetDuration ?? storedDuration);
        updateControlState(finalDuration, false);
        audio.currentTime = 0;
        safeCleanup();
        audio.cleanup = null;
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(error => {
            console.error('Error playing audio:', error);
            console.error('Audio source:', audio.src);
            console.error('Audio readyState:', audio.readyState);
            console.error('Audio networkState:', audio.networkState);
            updateControlState(null, false);
            safeCleanup();
            audio.cleanup = null;
        });
    }

    // Set up message container click handling
    setupMessageContainerClickHandling($el, audio, message);
}

/**
 * Setup click handling for message containers
 */
function setupMessageContainerClickHandling($el, audio, message) {
    // Handle clicks on the audio control button
    $el.off('click').on('click', function(event) {
        event.stopPropagation();
        
        const audioDuration = Number($el.attr('data-audio-duration'));
        const displayDuration = formatDurationForDisplay(audioDuration);
        
        if (audio.paused) {
            // Resume playback
            audio.muted = false;
            const playPromise = audio.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(error => {
                    console.error('Error resuming audio:', error);
                    const fallbackDuration = formatDurationForDisplay(Number($el.attr('data-audio-duration')));
                    $el.html(fallbackDuration ? `► ${fallbackDuration}"` : '►');
                });
            }
            $el.html(displayDuration ? `❚❚ ${displayDuration}"` : '❚❚');
        } else {
            // Pause playback
            audio.pause();
            audio.currentTime = 0;
            $el.html(displayDuration ? `► ${displayDuration}"` : '►');
        }
    });
    
    // Also set up the parent message container to control this audio
    const messageContainer = $el.closest('.message-container');
    messageContainer.off('click.audio').on('click.audio', function(event) {
        // Only handle if not clicking directly on the audio control
        if (!$(event.target).closest('.audio-controller').length) {
            if (!audio.paused) {
                // If playing, stop it
                audio.pause();
                audio.currentTime = 0;
                const storedDuration = Number($el.attr('data-audio-duration'));
                const displayDuration = formatDurationForDisplay(storedDuration);
                $el.html(displayDuration ? `► ${displayDuration}"` : '►');
            }
        }
    });
}

/**
 * Auto-play audio for new messages if enabled
 */
function autoPlayMessageAudio(uniqueId, message) {
    if (!message) return;
    
    const autoPlay = localStorage.getItem('audioAutoPlay') === 'true';
    if (!autoPlay) return;
    
    // Find the audio button element for this message
    const $el = $(`#play-${uniqueId}`);
    if ($el.length === 0) return;
    
    // Set the audio content attribute if not already set
    if (!$el.attr('data-content')) {
        $el.attr('data-content', message);
    }
    
    // Add a small delay to ensure the DOM is fully rendered
    setTimeout(() => {
        stopAllAudios();
        
        // Initialize and play the audio
        initAudio($el, message);
    }, 800);
}

// Event handlers
$(document).ready(function() {
    // Initialize audio on page load
    initializeAudio();
    
    // Create audio pool on user interaction
    $(document).on('click', function() {
        getAvailableAudio();
    });
    
    // Handle audio control button clicks
    $(document).on('click', '.audio-controller .audio-content', function(event) {
        event.stopPropagation();
        const $el = $(this);
        const message = $el.attr('data-content');
        
        // Check if audio is already playing
        const audioId = $el.attr('id');
        const audio = audioPool.find(a => a.controlElement && a.controlElement.attr('id') === audioId);
        
        if (audio && !audio.paused) {
            // If audio is playing, stop it
            audio.pause();
            audio.currentTime = 0;
            const storedDuration = Number($el.attr('data-audio-duration'));
            const displayDuration = formatDurationForDisplay(storedDuration);
            $el.html(displayDuration ? `► ${displayDuration}"` : '►');
            return;
        }
        
        // If no audio is playing, start a new one
        stopAllAudios();

        // Update duration display if available
        (function() {
            const duration = Number($el.attr('data-audio-duration'));
            const displayDuration = formatDurationForDisplay(duration);
            if (displayDuration) $el.html(`► ${displayDuration}"`);
        })();

        initAudio($el, message);
    });
});

// Export functions for use in other modules
window.initializeAudio = initializeAudio;
window.stopAllAudios = stopAllAudios;
window.initAudio = initAudio;
window.autoPlayMessageAudio = autoPlayMessageAudio;
window.requestAudioPermission = requestAudioPermission;
window.getAvailableAudio = getAvailableAudio;
window.generateTextToSpeech = generateTextToSpeech;
window.getVoiceUrl = getVoiceUrl;
window.generateMD5 = generateMD5;
window.playAudio = playAudio;
window.setupMessageContainerClickHandling = setupMessageContainerClickHandling;
