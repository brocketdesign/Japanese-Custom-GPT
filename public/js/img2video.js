/**
 * Image to Video Frontend Functions
 * Handles UI interactions for converting images to videos
 */

// Store for tracking video generation requests
const videoGenerationRequests = new Set();

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

    // Prevent duplicate requests
    const requestKey = `${imageId}_${chatId}`;
    if (videoGenerationRequests.has(requestKey)) {
        showNotification(window.translations.video_generation_in_progress || 'Video generation in progress', 'warning');
        return;
    }

    try {
        videoGenerationRequests.add(requestKey);

        // Show loader
        const placeholderId = `video_${Date.now()}_${imageId}`;
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
                prompt
            })
        });

        const data = await response.json();

        if (!response.ok) {
            removeVideoLoader(placeholderId);
            throw new Error(data.error || 'Failed to start video generation');
        }

        if (data.success) {
            showNotification(window.translations.video_generation_started || 'Video generation started', 'success');
        } else {
            throw new Error(data.message || 'Video generation failed');
        }

    } catch (error) {
        console.error('Error generating video:', error);
        showNotification(error.message || window.translations.video_generation_failed || 'Video generation failed', 'error');
        
        // Remove loader on error
        removeVideoLoader(placeholderId);
    } finally {
        videoGenerationRequests.delete(requestKey);
    }
};

/**
 * Remove video generation loader
 * @param {string} placeholderId - Placeholder ID
 */
function removeVideoLoader(placeholderId) {
    console.log('[removeVideoLoader] Attempting to remove loader for:', placeholderId);
    const loader = $(document).find(`#video-loader-${placeholderId}`);
    console.log('[removeVideoLoader] Found loader elements:', loader.length);
    
    if (loader.length > 0) {
        console.log('[removeVideoLoader] Removing loader element');
        loader.fadeOut(300, function() {
            $(this).remove();
            console.log('[removeVideoLoader] Loader removed successfully');
        });
    } else {
        console.warn('[removeVideoLoader] No loader found with ID:', `video-loader-${placeholderId}`);
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
    console.log('[displayVideoLoader] Creating loader for:', placeholderId, 'imageId:', imageId);
    
    const loaderHtml = `
        <div id="video-loader-${placeholderId}" class="video-generation-loader bg-dark d-flex align-items-center justify-content-center p-3 mx-auto shadow-sm" style="max-width: 500px;">
            <div class="text-center">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="mt-2">
                    <small class="text-muted">${window.translations.generating_video || 'Generating video...'}</small>
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
        <small class="text-muted">${Math.round(progress)}% ${window.translations.complete || 'complete'}</small>
    `;
    
    const loader = $(document).find(`#video-loader-${placeholderId}`);
    if (loader.length > 0) {
        loader.find('.text-center').html(`
            <div class="spinner-border text-secondary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">
                <small class="text-muted">${window.translations.generating_video || 'Generating video...'}</small>
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
    const { videoUrl, duration, userChatId, placeholderId, videoId } = videoData;

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
                            ${window.translations?.video_not_supported || 'Your browser does not support the video tag.'}
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
            showNotification(window.translations.regeneration_failed || 'Cannot regenerate this video', 'error');
        }
    } catch (error) {
        console.error('Error regenerating video:', error);
        showNotification(window.translations.regeneration_failed || 'Failed to regenerate video', 'error');
    }
};

/**
 * Share video functionality
 * @param {string} videoUrl - Video URL to share
 */
window.shareVideo = function(videoUrl) {
    if (navigator.share) {
        navigator.share({
            title: window.translations.generated_video || 'Generated Video',
            url: videoUrl
        }).catch(console.error);
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(videoUrl).then(() => {
            showNotification(window.translations.video_link_copied || 'Video link copied to clipboard', 'success');
        }).catch(() => {
            showNotification(window.translations.share_failed || 'Failed to share video', 'error');
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
