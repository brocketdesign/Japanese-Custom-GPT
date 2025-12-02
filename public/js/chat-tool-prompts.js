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
        $(document).off('click', '#showPrompts, .showPrompts-toggle').on('click', '#showPrompts, .showPrompts-toggle', () => {
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
        $(document).off('click', '.prompt-card').on('click', '.prompt-card', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const $card = $(e.currentTarget);

            if ($card.hasClass('inactive')) {
                const cost = $card.data('cost');
                showNotification(`${window.userPointsTranslations?.need_coins?.replace('{coins}', cost) || `Need: ${cost}`}`, 'warning');
                openBuyPointsModal();
                return;
            }

            if ($card.hasClass('active')) {
                $('.prompt-card').removeClass('selected');
                $card.addClass('selected');

                const promptId = $card.data('id');
                const imageNsfw = $card.data('nsfw') ? 'nsfw' : 'sfw';
                const imagePreview = new URL($card.find('img').attr('data-src') || $card.find('img').attr('src'), window.location.origin).href;

                // Check custom prompt settings

                const defaultDescriptionEnabled = window.chatToolSettings?.getDefaultDescriptionEnabled() ?? false;
                let description = '';
                if (defaultDescriptionEnabled) {
                    description = window.chatToolSettings?.getDefaultDescription() ?? '';
                }

                const customPromptEnabled = window.chatToolSettings?.getCustomPromptEnabled() ?? true;
                if (customPromptEnabled) {
                    description = await this.showCustomPromptModal(description);
                }

                // Send the prompt image generation request if the user didn't cancel
                if (description === null) {
                    this.hide();
                    return;
                }
                
                this.sendPromptImageDirectly(promptId, imageNsfw, imagePreview, description);
                this.hide();
            }
        });

    }

    // Show modal for custom prompt description input
    showCustomPromptModal(initialDescription = '') {
        return new Promise((resolve) => {
            const translations = window.translations || {};
            const modalTitle = translations.customPromptModal?.title || "Custom Prompt Description";
            const modalSubtitle = translations.customPromptModal?.subtitle || "Enter additional description for the image generation";
            const labelText = translations.customPromptModal?.label || "Description (optional)";
            const placeholderText = translations.customPromptModal?.placeholder || "e.g., in a futuristic setting, with dramatic lighting...";
            const generateButtonText = translations.customPromptModal?.generateButton || "Generate Image";
            const cancelButtonText = translations.customPromptModal?.cancelButton || "Cancel";

            const modalHtml = `
                <div class="modal fade" id="customPromptModal" tabindex="-1" aria-labelledby="customPromptModalLabel" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content mx-auto" style="height: auto;">
                            <div class="modal-header">
                                <div class="d-flex align-items-center flex-column w-100">
                                    <h5 class="modal-title" id="customPromptModalLabel">
                                        <i class="bi bi-image me-2"></i>
                                        ${modalTitle}
                                    </h5>
                                    <span>${modalSubtitle}</span>
                                </div>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label for="customPromptTextarea" class="form-label">
                                        ${labelText}
                                    </label>
                                    <textarea 
                                        class="form-control" 
                                        style="min-height: 90px;"
                                        id="customPromptTextarea" 
                                        rows="4" 
                                        maxlength="500" 
                                        placeholder="${placeholderText}"
                                    ></textarea>
                                    <div class="form-text">
                                        <span id="customCharCount">0</span>/500 characters
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                    ${cancelButtonText}
                                </button>
                                <button type="button" class="btn btn-primary" id="generateCustomPromptBtn">
                                    <i class="bi bi-image me-2"></i>
                                    ${generateButtonText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            $('#customPromptModal').remove();
            
            // Add modal to body
            $('body').append(modalHtml);
            
            const modal = new bootstrap.Modal(document.getElementById('customPromptModal'));
            const textarea = $('#customPromptTextarea');
            const charCount = $('#customCharCount');
            const generateBtn = $('#generateCustomPromptBtn');

            // Save and restore last prompt using localStorage
            const lastPromptKey = 'custom_prompt_last_prompt';
            const savedPrompt = localStorage.getItem(lastPromptKey);
            if (savedPrompt && !initialDescription) {
                // Restore last saved prompt if no initial description is provided
                textarea.val(savedPrompt);
                charCount.text(savedPrompt.length);
            } else if (initialDescription) {
                // Set initial description if provided
                textarea.val(initialDescription);
                charCount.text(initialDescription.length);
            }

            // Character counter
            textarea.on('input', function() {
                const length = $(this).val().length;
                charCount.text(length);
                
                if (length > 500) {
                    charCount.addClass('text-danger');
                } else {
                    charCount.removeClass('text-danger');
                }

                textarea.on('input', function() {
                    localStorage.setItem(lastPromptKey, $(this).val());
                });
            });

            // Generate button click
            generateBtn.on('click', function() {
                const description = textarea.val().trim();
                modal.hide();
                resolve(description);
            });

            // Modal close events
            $('#customPromptModal').on('hidden.bs.modal', function() {
                $(this).remove();
                resolve(null);
            });

            // Show modal
            modal.show();
            
            // Focus textarea
            $('#customPromptModal').on('shown.bs.modal', function() {
                textarea.focus();
            });
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
    sendPromptImageDirectly(promptId, imageNsfw, imagePreview, description) {
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
            customPrompt: true,
            description
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
                    if (this.isDevelopmentMode()) {
                        console.log(`[PromptManager] Found completed task for ${generationId}:`, completedTask);
                    }
                    
                    // Remove the loader
                    displayOrRemoveImageLoader(metadata.placeholderId, 'remove');
                    
                    // Process completed images
                    if (completedTask.result?.images && Array.isArray(completedTask.result.images)) {
                        for (const image of completedTask.result.images) {
                            if (this.isDevelopmentMode()) {
                                console.log(`[PromptManager] Processing completed image:`, image);
                            }
                            
                            // Generate the image using the existing generateImage function
                            await generateImage({
                                imageId: image._id,
                                imageUrl: image.imageUrl,
                                userChatId: metadata.userChatId,
                                prompt: image.prompt,
                                title: image.title,
                                nsfw: image.nsfw,
                                isUpscaled: image.isUpscaled,
                                isMerged: image.isMerged
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