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
        showNotification(window.img2videoTranslations.video_generation_in_progress || 'Video generation in progress', 'warning');
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
    iconElement.removeClass('bi-play-circle').addClass('bi-play-circle-fill text-success');
    try {
        videoGenerationRequests.add(requestKey);
        activePlaceholderIds.add(placeholderId);

        // Show loader with consistent ID
        displayVideoLoader(placeholderId, imageId);

        // Get NSFW status from data attribute
        const imageElement = $(`.img2video-btn[data-id="${imageId}"]`);
        const nsfw = !!imageElement.data('nsfw') || false;
        
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
                nsfw,
                placeholderId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            removeVideoLoader(placeholderId);
            throw new Error(data.error || 'Failed to start video generation');
        }

        if (data.success) {
            showNotification(window.img2videoTranslations.video_generation_started || 'Video generation started', 'success');
        } else {
            throw new Error(data.message || 'Video generation failed');
        }

    } catch (error) {
        console.error('Error generating video:', error);
        showNotification(error.message || window.img2videoTranslations.video_generation_failed || 'Video generation failed', 'error');
        
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
                            <div class="d-flex align-items-center flex-column w-100">
                                <h5 class="modal-title" id="videoPromptModalLabel">
                                    <i class="bi bi-camera-video me-2"></i>
                                    ${window.img2videoTranslations.video_prompt_title || 'Video Generation Prompt'}
                                </h5>
                                <span>${window.img2videoTranslations.video_prompt_subtitle.replace('{{points}}', 100) || 'Generating a video from an image will use up to {{points}} points.'}</span>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="videoPromptTextarea" class="form-label">
                                    ${window.img2videoTranslations.video_prompt_description || 'Describe the video motion or style (optional)'}
                                </label>
                                <textarea 
                                    class="form-control" 
                                    style="min-height: 90px;"
                                    id="videoPromptTextarea" 
                                    rows="4" 
                                    maxlength="200" 
                                    placeholder="${window.img2videoTranslations.video_prompt_placeholder || 'e.g., slow zoom in, dramatic lighting, smooth camera movement...'}"
                                ></textarea>
                                <div class="form-text">
                                    <span id="charCount">0</span>/200 ${window.img2videoTranslations.characters || 'characters'}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                ${window.img2videoTranslations.cancel || 'Cancel'}
                            </button>
                            <button type="button" class="btn btn-primary" id="generateVideoBtn">
                                <i class="bi bi-play-circle me-2"></i>
                                ${window.img2videoTranslations.generate_video || 'Generate Video'}
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

        // Save and restore last prompt using localStorage
        const lastPromptKey = 'img2video_last_prompt';
        const savedPrompt = localStorage.getItem(lastPromptKey);
        if (savedPrompt) {
            textarea.val(savedPrompt);
            charCount.text(savedPrompt.length);
        }

        textarea.on('input', function() {
            localStorage.setItem(lastPromptKey, $(this).val());
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

// Display or remove video loader with provided data-id
window.displayOrRemoveVideoLoader = function (placeholderId, action) {
    console.log(`[displayOrRemoveVideoLoader] Action: ${action} for placeholderId: ${placeholderId}`);
    if (action === 'remove') {
        const existingElement = $(`#chat-recommend [data-id=${placeholderId}]`);
        existingElement.remove();
        removeVideoLoader(placeholderId);
    } else {
        // Check if placeholder already exists
        const existingPlaceholder = $(`#chat-recommend [data-id=${placeholderId}]`);
        if (existingPlaceholder.length > 0) {
            return;
        }
        
        const loadingSpinerGif = "/img/video-placeholder.gif";
        
        // with a video icon in the center
        const card = $(`
            <div data-id="${placeholderId}" class="assistant-image-box card custom-card bg-transparent shadow-0 border-0 px-1 col-auto" style="cursor:pointer;">
                <div class="card-img-top rounded-avatar rounded-circle-button-size position-relative m-auto" >
                    <img src="${loadingSpinerGif}" alt="Loading..." class="position-absolute top-50 start-50 translate-middle" style="z-index:2;"/>
                </div>
            </div>
        `);
        
        $('#chat-recommend').append(card);
        $('#chat-recommend').scrollLeft($('#chat-recommend')[0].scrollWidth);
    }
};
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
                    <small class="text-muted">${window.img2videoTranslations.generating_video || 'Generating video...'}</small>
                </div>
            </div>
        </div>
    `;

    // Insert loader after the image container
    const imageContainer = $('#chat-container ').find(`[data-id="${imageId}"]`).closest('.assistant-image-box');
    
    if (imageContainer.length > 0) {
        imageContainer.append(loaderHtml);
    } else {
        // Fallback: append to chat container
        const chatContainer = $('#chatContainer');
        chatContainer.append(loaderHtml);
        // Scroll to show the loader
        $('#chatContainer').animate({ scrollTop: $('#chatContainer')[0].scrollHeight }, 500);
    }

    displayOrRemoveVideoLoader(placeholderId, 'display');

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
        <small class="text-muted">${Math.round(progress)}% ${window.img2videoTranslations.complete || 'complete'}</small>
    `;
    
    const loader = $(document).find(`#video-loader-${placeholderId}`);
    if (loader.length > 0) {
        loader.find('.text-center').html(`
            <div class="spinner-border text-secondary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <div class="mt-2">
                <small class="text-muted">${window.img2videoTranslations.generating_video || 'Generating video...'}</small>
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
                <div class="ms-3 position-relative" style="max-width: 200px;display: grid;">
                    <div class="ps-0 text-start assistant-video-box d-flex">
                        <video 
                            controls loop
                            class="generated-video" 
                            style="max-width: 100%;"
                            data-video-id="${videoId}"
                            data-placeholder-id="${placeholderId}"
                        >
                            <source src="${videoUrl}" type="video/mp4">
                            ${window.translations.img2videoTranslations?.video_not_supported || 'Your browser does not support the video tag.'}
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
 * Download video file
 * @param {string} videoUrl - Video URL
 * @param {string} videoId - Video ID
 */
window.downloadVideo = async function(videoUrl, videoId) {
    try {
        // For S3 URLs and cross-origin resources, use a simpler approach
        // Don't include credentials for cross-origin requests with wildcard CORS
        const response = await fetch(videoUrl, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error('Failed to download video');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated_video_${videoId}.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification(window.img2videoTranslations?.download_started || 'Download started', 'success');
    } catch (error) {
        console.error('Error downloading video:', error);
        showNotification(window.img2videoTranslations?.download_failed || 'Failed to download video', 'error');
    }
};

/**
 * Get video tools (download, share, etc.)
 * @param {string} videoUrl - Video URL
 * @param {number} duration - Video duration
 * @param {string} videoId - Video ID
 * @returns {string} HTML for video tools
 */
window.getVideoTools = function(videoUrl, duration, videoId, actions = []) {
        const hasLikeAction = actions?.some(a => a.type === 'like');
        const likeIcon = hasLikeAction ? 'bi-heart-fill' : 'bi-heart';
        const likeLabel = hasLikeAction ? (window.translations?.image_tools?.liked || 'Liked') : (window.translations?.image_tools?.like || 'Like');
        const likeBadgeClass = hasLikeAction ? 'text-danger' : '';

        return `
        <div class="bg-light py-2 video-tools" data-id="${videoId}">
            <div class="d-flex  gap-2 overflow-auto px-2" style="scrollbar-width: none; -ms-overflow-style: none;">
                <style>
                    .video-tools .d-flex::-webkit-scrollbar { display: none; }
                    .video-tool-badge {
                        font-size: 10px;
                        padding: 4px 8px;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        white-space: nowrap;
                    }
                    .video-tool-badge:hover {
                        transform: scale(1.05);
                    }
                    .video-tool-badge i {
                        margin-right: 4px;
                    }
                </style>

                <span class="badge bg-white text-secondary video-tool-badge video-fav" 
                      data-id="${videoId}" 
                      onclick="toggleVideoFavorite(this)">
                    <i class="bi ${likeIcon} ${likeBadgeClass}"></i>${likeLabel}
                </span>
                
                <span class="badge bg-white text-secondary video-tool-badge download-video" 
                            onclick="downloadVideo('${videoUrl}', '${videoId}')" 
                            title="${window.translations?.image_tools?.download || window.img2videoTranslations?.download || 'Download'}">
                        <i class="bi bi-download"></i>${window.translations?.image_tools?.download || window.img2videoTranslations?.download || 'Download'}
                </span>

                <span class="badge bg-white text-secondary video-tool-badge share-video" 
                            onclick="shareVideo('${videoUrl}')" 
                            title="${window.translations?.image_tools?.share || window.img2videoTranslations?.share || 'Share'}">
                        <i class="bi bi-share"></i>${window.translations?.image_tools?.share || window.img2videoTranslations?.share || 'Share'}
                </span>
                
                ${duration && !Math.round(duration).isNan() ? `<span class="badge bg-white text-secondary video-tool-badge">
                    <i class="bi bi-clock"></i> ${Math.round(duration)}s
                </span>` : ''}
            </div>
            ${actions && actions.length > 0 ? `
                <div class="actions-info text-muted px-3 py-1" style="font-size: 11px;">
                    ${actions.map(action => {
                        if (action.type === 'like') {
                            return `<div><i class="bi bi-heart-fill text-danger me-1"></i>${window.translations?.image_tools?.liked || 'Liked'} ${action.date ? `on ${new Date(action.date).toLocaleDateString()}` : ''}</div>`;
                        }
                        return '';
                    }).join('')}
                </div>` : ''}
        </div>
    `;
    }

/**
 * Find the generated video message in the chat and add/remove a like action entry
 * @param {string} videoId
 * @param {string} action - 'like' or 'unlike'
 * @param {boolean} add - whether to add (true) or remove (false) the entry
 */
// Message action updates for video likes are handled server-side.

/**
 * Toggle video favorite status
 * @param {HTMLElement} el - The clicked element
 */
window.toggleVideoFavorite = function(el) {
    const isTemporary = !!user.isTemporary;
    if (isTemporary) { 
        openLoginForm(); 
        return; 
    }

    let $this = $(el);
    const videoId = $this.data('id');
    const isLiked = $this.find('i').hasClass('bi-heart-fill'); // Check if already liked

    const action = isLiked ? 'unlike' : 'like'; // Determine action
    const likeIconClass = (action == 'like') ? 'bi-heart-fill text-danger' : 'bi-heart';
    
    // Update the clicked element immediately
    $this.find('i').removeClass('bi-heart bi-heart-fill').addClass(likeIconClass); // Toggle icon class

    // Update ALL instances of this video across the page
    $(`.video-fav[data-id="${videoId}"]`).each(function() {
        $(this).find('i').removeClass('bi-heart bi-heart-fill text-danger').addClass(likeIconClass);
    });

    if(action === 'like') {
        showNotification(window.translations?.like_grant_points.replace('{point}', '5') || 'Video liked!', 'success');
    }

    // Message action updates are handled by the server; UI icon updated optimistically above

    $.ajax({
        url: `/api/video/${videoId}/like-toggle`, // Video like-toggle endpoint
        method: 'POST',
        xhrFields: {
            withCredentials: true
        },
        data: { 
            action
        },
        success: function() {
            // Server confirmed; nothing else to do (UI already updated optimistically)
        },
        error: function(xhr, status, error) {
            console.error('Error toggling video favorite:', error);
            // Revert the icon on error
            const revertClass = isLiked ? 'bi-heart-fill text-danger' : 'bi-heart';
            $this.find('i').removeClass('bi-heart bi-heart-fill text-danger').addClass(revertClass);
            $(`.video-fav[data-id="${videoId}"]`).each(function() {
                $(this).find('i').removeClass('bi-heart bi-heart-fill text-danger').addClass(revertClass);
            });
            // Server will maintain message actions; just revert icon state locally
            showNotification('Failed to toggle like', 'error');
        }
    });
};

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
            showNotification(window.img2videoTranslations.regeneration_failed || 'Cannot regenerate this video', 'error');
        }
    } catch (error) {
        console.error('Error regenerating video:', error);
        showNotification(window.img2videoTranslations.regeneration_failed || 'Failed to regenerate video', 'error');
    }
};

/**
 * Share video functionality
 * @param {string} videoUrl - Video URL to share
 */
window.shareVideo = function(videoUrl) {
    if (navigator.share) {
        navigator.share({
            title: window.img2videoTranslations.generated_video || 'Generated Video',
            url: videoUrl
        }).catch(console.error);
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(videoUrl).then(() => {
            showNotification(window.img2videoTranslations.video_link_copied || 'Video link copied to clipboard', 'success');
        }).catch(() => {
            showNotification(window.img2videoTranslations.share_failed || 'Failed to share video', 'error');
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
