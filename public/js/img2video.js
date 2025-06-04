/**
 * Image to Video Frontend Functions
 * Handles UI interactions for converting images to videos
 */

// Store for tracking video generation requests
const videoGenerationRequests = new Set();
const sentVideoIds = new Set();
const activePlaceholderIds = new Set(); // Add this to track active placeholders

/**
 * Generate video from image
 * @param {string} imageId - ID of the image to convert
 * @param {string} chatId - Chat ID
 * @param {string} userChatId - User chat ID
 * @param {string} prompt - Optional prompt for video generation
 */
window.generateVideoFromImage = async function(imageId, chatId, userChatId, prompt = '') {
    const isTemporary = !!user?.isTemporary;
    if (isTemporary) {
        openLoginForm();
        return;
    }

    if (!subscriptionStatus) {
        loadPlanPage();
        return;
    }

    // Use consistent request key format
    const requestKey = `${imageId}_${userChatId}`;
    if (videoGenerationRequests.has(requestKey)) {
        showNotification(window.translations.img2video.video_generation_in_progress || 'Video generation in progress', 'warning');
        return;
    }

    // Show prompt modal
    const userPrompt = await showVideoPromptModal();
    
    // If user cancelled, return
    if (userPrompt === null) {
        return;
    }

    // Generate consistent placeholder ID once
    const placeholderId = `video_${Date.now()}_${imageId}_${userChatId}`;
    
    // Check if this placeholder is already active
    if (activePlaceholderIds.has(placeholderId)) {
        console.warn('[generateVideoFromImage] Placeholder already active:', placeholderId);
        return;
    }

    // Replace icon to fill
    const iconElement = $(`.img2video-btn[data-id="${imageId}"]`).find('i');
    iconElement.removeClass('bi-play-circle').addClass('bi-play-circle-fill');
    try {
        videoGenerationRequests.add(requestKey);
        activePlaceholderIds.add(placeholderId);

        // Show loader with consistent ID
        displayVideoLoader(placeholderId, imageId);

        // Call API to start video generation
        const response = await fetch('/api/img2video/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                imageId,
                chatId,
                userChatId,
                prompt: userPrompt || prompt,
                placeholderId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            removeVideoLoader(placeholderId);
            throw new Error(data.error || 'Failed to start video generation');
        }

        if (data.success) {
            showNotification(window.translations.img2video.video_generation_started || 'Video generation started', 'success');
        } else {
            throw new Error(data.message || 'Video generation failed');
        }

    } catch (error) {
        console.error('Error generating video:', error);
        showNotification(error.message || window.translations.img2video.video_generation_failed || 'Video generation failed', 'error');
        
        // Remove loader on error
        removeVideoLoader(placeholderId);
    } finally {
        videoGenerationRequests.delete(requestKey);
        activePlaceholderIds.delete(placeholderId);
    }
};

/**
 * Show modal for video prompt input
 * @returns {Promise<string|null>} User prompt or null if cancelled
 */
function showVideoPromptModal() {
    return new Promise((resolve) => {
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="videoPromptModal" tabindex="-1" aria-labelledby="videoPromptModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content mx-auto" style="height: auto;">
                        <div class="modal-header">
                            <h5 class="modal-title" id="videoPromptModalLabel">
                                <i class="bi bi-camera-video me-2"></i>
                                ${window.translations.img2video.video_prompt_title || 'Video Generation Prompt'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="videoPromptTextarea" class="form-label">
                                    ${window.translations.img2video.video_prompt_description || 'Describe the video motion or style (optional)'}
                                </label>
                                <textarea 
                                    class="form-control" 
                                    style="min-height: 90px;"
                                    id="videoPromptTextarea" 
                                    rows="4" 
                                    maxlength="200" 
                                    placeholder="${window.translations.img2video.video_prompt_placeholder || 'e.g., slow zoom in, dramatic lighting, smooth camera movement...'}"
                                ></textarea>
                                <div class="form-text">
                                    <span id="charCount">0</span>/200 ${window.translations.img2video.characters || 'characters'}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                ${window.translations.img2video.cancel || 'Cancel'}
                            </button>
                            <button type="button" class="btn btn-primary" id="generateVideoBtn">
                                <i class="bi bi-play-circle me-2"></i>
                                ${window.translations.img2video.generate_video || 'Generate Video'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        $('#videoPromptModal').remove();
        
        // Add modal to body
        $('body').append(modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById('videoPromptModal'));
        const textarea = $('#videoPromptTextarea');
        const charCount = $('#charCount');
        const generateBtn = $('#generateVideoBtn');

        // Character counter
        textarea.on('input', function() {
            const length = $(this).val().length;
            charCount.text(length);
            
            if (length > 200) {
                charCount.addClass('text-danger');
            } else {
                charCount.removeClass('text-danger');
            }
        });

        // Generate button click
        generateBtn.on('click', function() {
            const prompt = textarea.val().trim();
            modal.hide();
            resolve(prompt);
        });

        // Modal close events
        $('#videoPromptModal').on('hidden.bs.modal', function() {
            $(this).remove();
            resolve(null);
        });

        // Show modal
        modal.show();
        
        // Focus textarea
        $('#videoPromptModal').on('shown.bs.modal', function() {
            textarea.focus();
        });
    });
}

/**
 * Remove video generation loader
 * @param {string} placeholderId - Placeholder ID
 */
function removeVideoLoader(placeholderId) {
    const loader = $(document).find(`#video-loader-${placeholderId}`);
    
    if (loader.length > 0) {
        loader.fadeOut(300, function() {
            $(this).remove();
            // Clean up tracking
            activePlaceholderIds.delete(placeholderId);
        });
    } else {
        console.warn('[removeVideoLoader] No loader found with ID:', `video-loader-${placeholderId}`);
        // Clean up tracking anyway
        activePlaceholderIds.delete(placeholderId);
        // Try to find any video loaders
        const allLoaders = $('.video-generation-loader');
        console.log('[removeVideoLoader] Total video loaders found:', allLoaders.length);
        allLoaders.each(function() {
            console.log('[removeVideoLoader] Existing loader ID:', $(this).attr('id'));
        });
    }
}

/**
 * Display video generation loader
 * @param {string} placeholderId - Placeholder ID for tracking
 * @param {string} imageId - Related image ID
 */
function displayVideoLoader(placeholderId, imageId) {
    
    const loaderHtml = `
        <div id="video-loader-${placeholderId}" class="video-generation-loader bg-dark d-flex align-items-center justify-content-center p-3 mx-auto shadow-sm" style="max-width: 500px;">
            <div class="text-center">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="mt-2">
                    <small class="text-muted">${window.translations.img2video.generating_video || 'Generating video...'}</small>
                </div>
            </div>
        </div>
    `;

    // Insert loader after the image container
    const imageContainer = $(`[data-id="${imageId}"]`).closest('.assistant-image-box');
    
    if (imageContainer.length > 0) {
        imageContainer.append(loaderHtml);
    } else {
        // Fallback: append to chat container
        const chatContainer = $('#chatContainer');
        chatContainer.append(loaderHtml);
        // Scroll to show the loader
        $('#chatContainer').animate({ scrollTop: $('#chatContainer')[0].scrollHeight }, 500);
    }

}

/**
 * Update video generation progress (for WebSocket notifications)
 * @param {string} placeholderId - Placeholder ID
 * @param {number} progress - Progress percentage
 */
function updateVideoProgress(placeholderId, progress) {
    const progressHtml = `
        <div class="progress mt-2" style="height: 4px;">
            <div class="progress-bar" role="progressbar" style="width: ${progress}%"></div>
        </div>
        <small class="text-muted">${Math.round(progress)}% ${window.translations.img2video.complete || 'complete'}</small>
    `;
    
    const loader = $(document).find(`#video-loader-${placeholderId}`);
    if (loader.length > 0) {
        loader.find('.text-center').html(`
            <div class="spinner-border text-secondary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">
                <small class="text-muted">${window.translations.img2video.generating_video || 'Generating video...'}</small>
            </div>
            ${progressHtml}
        `);
    }
}
/**
 * Display generated video in chat
 * @param {Object} videoData - Video information
 */
function displayGeneratedVideo(videoData) {
    console.log('[displayGeneratedVideo] Video data received:', videoData);
    const { videoUrl, duration, userChatId, placeholderId, videoId } = videoData;
    console.log(sentVideoIds)
    
    // Use videoId for duplicate prevention, not placeholderId
    if (!videoData || !videoId || sentVideoIds.has(videoId.toString())) {
        console.log('[displayGeneratedVideo] Video already displayed or invalid data:', videoId);
        return;
    }
    
    // Add videoId to the set to prevent future duplicates
    sentVideoIds.add(videoId.toString());
    
    // Clean up placeholder tracking
    if (placeholderId) {
        activePlaceholderIds.delete(placeholderId);
    }

    // Check if we have the required variables
    if (typeof thumbnail === 'undefined') {
        console.warn('[displayGeneratedVideo] thumbnail variable not defined, using default');
    }
    if (typeof chatId === 'undefined') {
        console.warn('[displayGeneratedVideo] chatId variable not defined');
    }
    
    // Generate a design step similar to getVideoUrlById
    const designStep = `generated-${Date.now()}`;
    
    const videoHtml = `
        <div id="container-${designStep}">
            <div class="d-flex flex-row justify-content-start mb-4 message-container">
                <img src="${thumbnail || '/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId || ''}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;">
                <div class="ms-3 position-relative" style="max-width: 200px;">
                    <div class="ps-0 text-start assistant-video-box">
                        <video 
                            controls 
                            class="generated-video" 
                            style="max-width: 100%; border-radius: 15px;"
                            data-video-id="${videoId}"
                            data-placeholder-id="${placeholderId}"
                        >
                            <source src="${videoUrl}" type="video/mp4">
                            ${window.translations.img2video?.video_not_supported || 'Your browser does not support the video tag.'}
                        </video>
                    </div>
                    ${getVideoTools(videoUrl, duration, videoId)}
                </div>
            </div>
        </div>
    `;

    
    const chatContainer = $('#chatContainer');
    
    if (chatContainer.length > 0) {
        chatContainer.append($(videoHtml).hide().fadeIn());
        
        // Scroll to bottom
        chatContainer.animate({ scrollTop: chatContainer[0].scrollHeight }, 500);
    } else {
        console.error('[displayGeneratedVideo] Chat container not found!');
    }
}
/**
 * Get video tools (download, share, etc.)
 * @param {string} videoUrl - Video URL
 * @param {number} duration - Video duration
 * @param {string} videoId - Video ID
 * @returns {string} HTML for video tools
 */
window.getVideoTools = function(videoUrl, duration, videoId) {
        return `
        <div class="bg-white py-2 d-flex justify-content-around video-tools">
            <div class="d-flex justify-content-around w-100">
                <span class="badge bg-white text-secondary download-video" style="cursor: pointer;">
                    <a href="${videoUrl}" download="generated_video_${videoId}.mp4" style="color:inherit; text-decoration: none;">
                        <i class="bi bi-download"></i>
                    </a>
                </span>
                <span class="badge bg-white text-secondary share-video" 
                      onclick="shareVideo('${videoUrl}')" 
                      style="cursor: pointer;">
                    <i class="bi bi-share"></i>
                </span>
                ${duration && !Math.round(duration).isNan() ? `<span class="badge bg-white text-secondary">
                    <i class="bi bi-clock"></i> ${Math.round(duration)}s
                </span>` : ''}
            </div>
        </div>
    `;
    }
/**
 * Regenerate video from existing video data
 * @param {string} videoId - Video ID to regenerate
 */
window.regenerateVideo = async function(videoId) {
    if (!subscriptionStatus) {
        loadPlanPage();
        return;
    }

    try {
        // Fetch original video data
        const response = await fetch(`/api/video/${videoId}`);
        const videoData = await response.json();
        
        if (videoData.imageId) {
            // Regenerate using the original image
            generateVideoFromImage(videoData.imageId, chatId, userChatId, videoData.prompt);
        } else {
            showNotification(window.translations.img2video.regeneration_failed || 'Cannot regenerate this video', 'error');
        }
    } catch (error) {
        console.error('Error regenerating video:', error);
        showNotification(window.translations.img2video.regeneration_failed || 'Failed to regenerate video', 'error');
    }
};

/**
 * Share video functionality
 * @param {string} videoUrl - Video URL to share
 */
window.shareVideo = function(videoUrl) {
    if (navigator.share) {
        navigator.share({
            title: window.translations.img2video.generated_video || 'Generated Video',
            url: videoUrl
        }).catch(console.error);
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(videoUrl).then(() => {
            showNotification(window.translations.img2video.video_link_copied || 'Video link copied to clipboard', 'success');
        }).catch(() => {
            showNotification(window.translations.img2video.share_failed || 'Failed to share video', 'error');
        });
    }
};

/**
 * Check for background video tasks
 * @param {string} chatId - Chat ID
 * @param {string} userChatId - User chat ID
 */
async function checkBackgroundVideoTasks(chatId, userChatId) {
    try {
        const response = await fetch(`/api/background-video-tasks/${userChatId}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.tasks && data.tasks.length > 0) {
            data.tasks.forEach(task => {
                if (task.status === 'pending' || task.status === 'processing' || task.status === 'background') {
                    // Display placeholder for background task
                    displayVideoLoader(task.placeholderId, task.imageId);
                    
                    // No need to start frontend polling - backend handles everything
                    console.log(`Found background video task: ${task.taskId} with status: ${task.status}`);
                }
            });
        }
    } catch (error) {
        console.error('Error checking background video tasks:', error);
    }
}

// Initialize background video tasks check when page loads
$(document).ready(function() {
    if (typeof chatId !== 'undefined' && typeof userChatId !== 'undefined') {
        checkBackgroundVideoTasks(chatId, userChatId);
    }
});
