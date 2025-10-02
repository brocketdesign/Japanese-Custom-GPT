/**
 * Custom Prompts Management
 * Handles all client-side operations for the custom image prompts tool.
 */
class PromptManager {
    constructor() {
        this.activeGenerations = new Map();
        this.autoGenerations = new Map(); 
        this.pollInterval = null;
        this.bindEvents();
        this.startPolling();
    }

    // Helper function to check if we're in development mode
    isDevelopmentMode() {
        return window.MODE === 'development' || window.location.hostname === 'localhost';
    }

    bindEvents() {
        // Click handler for the main show/hide prompts button
        $(document).off('click', '#showPrompts').on('click', '#showPrompts', () => {
            const $promptContainer = $('#promptContainer');
            if ($promptContainer.hasClass('visible')) {
                this.hide();
            } else {
                this.show();
            }
        });

        // Click handler for the close button inside the prompt container
        $('#close-promptContainer').on('click', () => {
            this.hide();
        });

        // Click handler for individual prompt cards
        $(document).off('click', '.prompt-card').on('click', '.prompt-card', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const $card = $(e.currentTarget);

            if ($card.hasClass('inactive')) {
                const cost = $card.data('cost');
                showNotification(`${window.userPointsTranslations?.need_coins?.replace('{coins}', cost) || `Need: : ${cost}`}`, 'warning');
                return;
            }

            if ($card.hasClass('active')) {
                $('.prompt-card').removeClass('selected');
                $card.addClass('selected');

                const promptId = $card.data('id');
                const imageNsfw = $card.data('nsfw') ? 'nsfw' : 'sfw';
                const imagePreview = new URL($card.find('img').attr('data-src') || $card.find('img').attr('src'), window.location.origin).href;

                this.sendPromptImageDirectly(promptId, imageNsfw, imagePreview);
                this.hide();
            }
        });
    }

    // Show the main prompt container
    show() {
        $('#promptContainer').hide().addClass('visible').slideDown('fast');
        $('#suggestions').removeClass('d-flex').hide();
    }

    // Hide the main prompt container
    hide() {
        $('#promptContainer').removeClass('visible').slideUp('fast');
        $('#suggestions').addClass('d-flex').show();
        this.removePromptFromMessage();
    }

    // Update prompts based on user's points
    async update(userId) {
        try {
            const res = await fetch(`/api/custom-prompts/${userId}`);
            if (!res.ok) {
                console.error('Failed to fetch custom prompts data.');
                $('.prompt-card').addClass('inactive').removeClass('active');
                return;
            }
            
            const promptData = await res.json();
            const userPoints = promptData.userPoints;

            $('.prompt-card').each(function() {
                const $card = $(this);
                const promptId = $card.data('id');
                const promptInfo = promptData.prompts.find(p => p.promptId === promptId);

                if (!promptInfo) {
                    $card.addClass('inactive').removeClass('active');
                    return;
                }
                
                if (promptInfo.canAfford) {
                    $card.addClass('active').removeClass('inactive').removeAttr('title');
                } else {
                    $card.addClass('inactive').removeClass('active');
                    $card.attr('title', 
                        `${window.userPointsTranslations?.need_coins?.replace('{coins}', promptInfo.cost) || `Need: ${promptInfo.cost}`}, ${window.userPointsTranslations?.have_coins?.replace('{coins}', userPoints) || `Have: ${userPoints}`}`
                    );
                }
            });

        } catch (e) {
            console.error('Error updating custom prompts:', e);
            $('.prompt-card').addClass('inactive').removeClass('active');
        }
        
        if (window.updatePromptActivatedCounter) {
            window.updatePromptActivatedCounter();
        }
    }

    // Send the selected prompt to generate an image
    sendPromptImageDirectly(promptId, imageNsfw, imagePreview) {
        const placeholderId = `${new Date().getTime()}_${Math.random().toString(36).substring(2, 8)}_${promptId}`;
        
        // Check if this prompt is already being generated
        if (this.activeGenerations.has(promptId)) {
            if (this.isDevelopmentMode()) {
                console.warn(`Prompt ${promptId} is already being generated`);
            }
            showNotification('Image generation for this prompt is already in progress', 'warning');
            return;
        }
        
        // Store generation metadata
        this.activeGenerations.set(promptId, {
            placeholderId,
            startTime: Date.now(),
            userChatId: sessionStorage.getItem('userChatId') || window.userChatId,
            imagePreview
        });
        
        displayOrRemoveImageLoader(placeholderId, 'show', imagePreview);
        
        const chatId = sessionStorage.getItem('chatId') || window.chatId;
        const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;
        
        novitaImageGeneration(window.user._id, chatId, userChatId, { 
            placeholderId, 
            imageNsfw, 
            promptId, 
            customPrompt: true 
        })
        .then(() => {
            if (this.isDevelopmentMode()) {
                console.log(`[PromptManager] Image generation started for prompt ${promptId}`);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            displayOrRemoveImageLoader(placeholderId, 'remove');
            this.activeGenerations.delete(promptId);
        });
    }

    // Start polling for completed tasks
    startPolling() {
        // Poll every 30 seconds if there are active generations
        this.pollInterval = setInterval(() => {
            if (this.activeGenerations.size > 0) {
                if (this.isDevelopmentMode()) {
                    console.log(`[PromptManager] Polling for ${this.activeGenerations.size} active generations`);
                }
                this.checkActiveGenerations();
            }
        }, 30000); // 30 seconds
    }
    
    bindAutoGenerationEvents() {
        // Listen for auto-generation registration from WebSocket
        if (window.addEventListener) {
            window.addEventListener('registerAutoGeneration', (event) => {
                const { taskId, placeholderId, userChatId, startTime } = event.detail;
                this.autoGenerations.set(taskId, {
                    placeholderId,
                    startTime,
                    userChatId,
                    isAutoGeneration: true
                });
                
                if (this.isDevelopmentMode()) {
                    console.log(`[PromptManager] Registered auto-generation: ${taskId}`);
                }
            });
        }
    }

    // Update checkActiveGenerations to include auto-generations
   async checkActiveGenerations() {
        const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;
        
        if (!userChatId) {
            if (this.isDevelopmentMode()) {
                console.warn('[PromptManager] No userChatId found for polling');
            }
            return;
        }

        try {
            const response = await fetch(`/api/background-tasks/${userChatId}`);
            if (!response.ok) {
                console.error('[PromptManager] Failed to fetch background tasks');
                return;
            }

            const data = await response.json();
            const completedTasks = data.tasks || [];

            // Check both prompt generations and auto-generations
            const allGenerations = new Map([...this.activeGenerations, ...this.autoGenerations]);

            for (const [generationId, metadata] of allGenerations.entries()) {
                // Check if task has been running for more than 5 minutes (timeout)
                if (Date.now() - metadata.startTime > 5 * 60 * 1000) {
                    if (this.isDevelopmentMode()) {
                        console.warn(`[PromptManager] Task ${generationId} timed out, cleaning up`);
                    }
                    displayOrRemoveImageLoader(metadata.placeholderId, 'remove');
                    this.activeGenerations.delete(generationId);
                    this.autoGenerations.delete(generationId);
                    continue;
                }

                // Check if this generation is completed
                const completedTask = completedTasks.find(task => 
                    task.placeholderId === metadata.placeholderId || 
                    task.customPromptId === generationId ||
                    task.taskId === generationId // Add taskId matching for auto-generations
                );

                if (completedTask && completedTask.status === 'completed') {
                    console.log(`[PromptManager] ✅ Found completed task for ${generationId}:`, completedTask);
                    
                    // Remove the loader
                    displayOrRemoveImageLoader(metadata.placeholderId, 'remove');
                    
                    // Process completed images - NEW BATCHED LOGIC
                    if (completedTask.result?.images && Array.isArray(completedTask.result.images)) {
                        
                        // Check if multiple images - send as batch
                        if (completedTask.result.images.length > 1) {
                            console.log(`[PromptManager] 🎨 Sending batched payload: ${completedTask.result.images.length} images`);
                            
                            generateImage({
                                images: completedTask.result.images.map(img => ({
                                    imageId: img._id?.toString() || img.imageId,
                                    id: img._id?.toString() || img.imageId,
                                    imageUrl: img.imageUrl,
                                    url: img.imageUrl,
                                    prompt: img.prompt || completedTask.prompt,
                                    title: img.title || completedTask.title,
                                    nsfw: img.nsfw || false,
                                    isMergeFace: img.isMerged || false,
                                    isUpscaled: img.isUpscaled || false
                                })),
                                userChatId: metadata.userChatId,
                                title: completedTask.title,
                                prompt: completedTask.prompt,
                                totalImages: completedTask.result.images.length
                            });
                        } else {
                            // Single image - existing behavior
                            const image = completedTask.result.images[0];
                            console.log('[PromptManager] 🖼️ Processing single completed image:', image);
                            
                            generateImage({
                                imageId: image._id?.toString() || image.imageId,
                                id: image._id?.toString() || image.imageId,
                                imageUrl: image.imageUrl,
                                url: image.imageUrl,
                                userChatId: metadata.userChatId,
                                prompt: image.prompt || completedTask.prompt,
                                title: image.title || completedTask.title,
                                nsfw: image.nsfw || false,
                                isMergeFace: image.isMerged || false,
                                isUpscaled: image.isUpscaled || false
                            });
                        }
                    }
                    
                    // Clean up from both maps
                    this.activeGenerations.delete(generationId);
                    this.autoGenerations.delete(generationId);
                }
            }
        } catch (error) {
            console.error('[PromptManager] Error checking active generations:', error);
        }
    }
    
    // Clean up method for when WebSocket reconnects
    handleWebSocketReconnect() {
        if (this.isDevelopmentMode()) {
            console.log('[PromptManager] WebSocket reconnected, checking for missed completions');
        }
        if (this.activeGenerations.size > 0) {
            this.checkActiveGenerations();
        }
    }

    // Remove prompt image from the message input area
    removePromptFromMessage() {
        const userMessage = $('#userMessage');
        userMessage.css('background-image', 'none');
        userMessage.removeClass('prompt-image');
        userMessage.removeAttr('data-prompt-id');
        userMessage.removeAttr('data-nsfw');
        userMessage.attr('placeholder', window.translations?.sendMessage || 'Send a message...'); 
    }

    // Cleanup method
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
}

$(document).ready(() => {
    window.promptManager = new PromptManager();
});