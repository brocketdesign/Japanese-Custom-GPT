// Audio management
const audioCache = new Map();
const audioPool = [];
let audioPermissionGranted = true;

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
            audio.currentTime = 0;
            
            // Update the UI for the control element if it exists
            if (audio.controlElement) {
                const duration = audio.controlElement.attr('data-audio-duration') || 0;
                audio.controlElement.html(`► ${Math.round(duration)}"`);
            }
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
        audioPool.push(newAudio);
        return newAudio;
    }
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
            return $el.html('再生がキャンセルされました');
        }
        
        // Check if audio is already cached
        const cachedUrl = audioCache.get(message);
        
        if (cachedUrl) {
            // Audio already cached, play it directly
            const audio = getAvailableAudio();
            playAudio($el, audio, cachedUrl, message);
        } else {
            // Audio not cached, show loading state and fetch
            $el.html('<div class="spinner-grow spinner-grow-sm" role="status"><span class="visually-hidden">Loading...</span></div>');
            try {
                const audioUrl = await generateTextToSpeech(message);
                audioCache.set(message, audioUrl);
                const audio = getAvailableAudio();
                playAudio($el, audio, audioUrl, message);
            } catch (error) {
                console.error('Error generating audio:', error);
                // Fallback to original voice URL method if EvenLab fails
                try {
                    const fallbackUrl = await getVoiceUrl(message);
                    const response = await fetch(fallbackUrl, {
                        method: 'POST',
                        credentials: 'omit'
                    });
                    const result = await response.json();
                    if (result.errno === 0) {
                        const audioUrl = result.data.audio_url;
                        audioCache.set(message, audioUrl);
                        const audio = getAvailableAudio();
                        playAudio($el, audio, audioUrl, message);
                    } else {
                        $el.html('エラーが発生しました');
                    }
                } catch (fallbackError) {
                    console.error('Fallback audio generation failed:', fallbackError);
                    $el.html('エラーが発生しました');
                }
            }
        }
    });
}

/**
 * Generate text-to-speech using the appropriate API based on user settings
 */
async function generateTextToSpeech(message) {
    try {
        // Get voice provider settings
        const voiceProvider = window.chatToolSettings?.getVoiceProvider() || 'openai';
        
        console.log('[generateTextToSpeech] Using provider:', voiceProvider);
        
        if (voiceProvider === 'evenlab') {
            // Use EvenLab API
            const evenLabVoice = window.chatToolSettings?.getEvenLabVoice() || 'sakura';
            console.log('[generateTextToSpeech] Using EvenLab voice:', evenLabVoice);
            
            const response = await fetch('/api/eventlab/text-to-speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: message,
                    userId: typeof userId !== 'undefined' ? userId : null,
                    chatId: typeof chatId !== 'undefined' ? chatId : null,
                    voiceName: evenLabVoice,
                    language: typeof language !== 'undefined' ? language : 'ja'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[generateTextToSpeech] EvenLab API error:', errorData);
                throw new Error(`EvenLab API error! status: ${response.status}`);
            }

            const audioBlob = await response.blob();
            return URL.createObjectURL(audioBlob);
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

            const audioBlob = await response.blob();
            return URL.createObjectURL(audioBlob);
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
function playAudio($el, audio, audioUrl, message) {
    // Track the current playing audio element to support toggling
    const currentlyPlaying = audio.src === audioUrl && !audio.paused;
    
    // Mute all other audios
    audioPool.forEach(a => {
        if (a !== audio) {
            a.muted = true;
            a.pause();
        }
    });
    
    if (currentlyPlaying) {
        // If this audio is already playing, pause it
        audio.pause();
        audio.currentTime = 0;
        const duration = $el.attr('data-audio-duration') || 0;
        $el.html(`► ${Math.round(duration)}"`);
        return;
    }
    
    // Otherwise, set up and play
    if (audio.src !== audioUrl) audio.src = audioUrl;
    
    audio.muted = false;
    audio.play();
    
    audio.onloadedmetadata = () => {
        const duration = audio.duration;
        $el.attr('data-audio-duration', duration)
        .html(`❚❚ ${Math.round(duration)}"`);
        
        // Store which element is controlling this audio
        audio.controlElement = $el;
    }
    
    audio.onended = () => {
        $el.html(`► ${Math.round(audio.duration)}"`);
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
        
        const audioDuration = $el.attr('data-audio-duration');
        
        if (audio.paused) {
            // Resume playback
            audio.muted = false;
            audio.play();
            $el.html(`❚❚ ${Math.round(audioDuration)}"`);
        } else {
            // Pause playback
            audio.pause();
            audio.currentTime = 0;
            $el.html(`► ${Math.round(audioDuration)}"`);
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
                $el.html(`► ${Math.round($el.attr('data-audio-duration'))}"`);
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
            $el.html(`► ${Math.round($el.attr('data-audio-duration') || 0)}"`);
            return;
        }
        
        // If no audio is playing, start a new one
        stopAllAudios();

        // Update duration display if available
        (function() {
            const duration = $el.attr('data-audio-duration');
            if (duration) $el.html('► ' + Math.round(duration) + '"');
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
