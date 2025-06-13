// Function to get message tools HTML
function getMessageTools(messageIndex, actions = [], isLastMessage = false, isAssistantMessage = false) {
    if (!isAssistantMessage) return ''; // Only show tools for assistant messages
    
    const hasLike = actions.some(action => action.type === 'like');
    const hasDislike = actions.some(action => action.type === 'dislike');
    
    // Get specific action objects
    const likeAction = actions?.find(action => action.type === 'like');
    const dislikeAction = actions?.find(action => action.type === 'dislike');
    
    // Determine icon classes based on actions
    const likeIconClass = hasLike ? 'bi-hand-thumbs-up-fill text-light' : 'bi-hand-thumbs-up';
    const dislikeIconClass = hasDislike ? 'bi-hand-thumbs-down-fill text-light' : 'bi-hand-thumbs-down';
    
    // Get tooltips
    const likeTooltip = hasLike ? 
        `${window.translations?.already_liked || 'Already liked'} ${likeAction?.date ? `on ${new Date(likeAction.date).toLocaleDateString()}` : ''}` : 
        `${window.translations?.like || 'Like'}`;
    
    const dislikeTooltip = hasDislike ? 
        `${window.translations?.already_disliked || 'Already disliked'} ${dislikeAction?.date ? `on ${new Date(dislikeAction.date).toLocaleDateString()}` : ''}` : 
        `${window.translations?.dislike || 'Dislike'}`;
    
    let toolsHtml = `
        <div class="message-tools-controller position-absolute shadow-sm" 
             data-message-index="${messageIndex}"
             style="bottom: -15px; right: 0px; z-index: 10;">
            <div class="d-flex bg-dark rounded-pill px-2 py-1" style="gap: 5px;">
                <button class="btn btn-sm text-light message-action-btn border-0 p-1" 
                        data-action="like" 
                        data-message-index="${messageIndex}"
                        title="${likeTooltip}"
                        style="background: none; font-size: 12px; line-height: 1;">
                    <i class="bi ${likeIconClass}"></i>
                </button>
                <button class="btn btn-sm text-light message-action-btn border-0 p-1" 
                        data-action="dislike" 
                        data-message-index="${messageIndex}"
                        title="${dislikeTooltip}"
                        style="background: none; font-size: 12px; line-height: 1;">
                    <i class="bi ${dislikeIconClass}"></i>
                </button>`;
    
    // Add regenerate button only for the last assistant message
    if (isLastMessage) {
        toolsHtml += `
                <button class="btn btn-sm text-light message-regenerate-btn border-0 p-1" 
                        data-message-index="${messageIndex}"
                        title="${window.translations?.regenerate || 'Regenerate'}"
                        style="background: none; font-size: 12px; line-height: 1;">
                    <i class="bi bi-arrow-clockwise"></i>
                </button>`;
    }
    
    toolsHtml += `
            </div>
        </div>`;
    
    return toolsHtml;
}

// Function to handle message action (like/dislike)
window.handleMessageAction = function(button, action) {
    const messageIndex = $(button).data('message-index');
    const $button = $(button);
    const $messageTools = $button.closest('.message-tools');
    const $likeBtn = $messageTools.find('[data-action="like"]');
    const $dislikeBtn = $messageTools.find('[data-action="dislike"]');
    
    // Determine if we're removing the action (if it's already active)
    const isCurrentlyActive = $button.find('i').hasClass(action === 'like' ? 'text-light' : 'text-light');
    const actionToSend = isCurrentlyActive ? 'remove' : action;
    
    // Disable buttons during request
    $likeBtn.prop('disabled', true);
    $dislikeBtn.prop('disabled', true);
    
    $.ajax({
        url: `/api/message/${messageIndex}/action`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            action: actionToSend,
            userChatId: userChatId
        }),
        success: function(response) {
            if (response.success) {
                updateMessageToolsUI($messageTools, response.actions);
                
                const message = actionToSend === 'remove' ? 
                    (window.translations?.action_removed || 'Action removed') :
                    (window.translations?.[`message_${action}d`] || `Message ${action}d`);
                    
                showNotification(message, 'success');
            }
        },
        error: function(xhr) {
            console.error('Error updating message action:', xhr);
            showNotification(window.translations?.error_updating_action || 'Error updating action', 'error');
        },
        complete: function() {
            // Re-enable buttons
            $likeBtn.prop('disabled', false);
            $dislikeBtn.prop('disabled', false);
        }
    });
};

// Function to update message tools UI based on actions
function updateMessageToolsUI($messageTools, actions) {
    const $likeBtn = $messageTools.find('[data-action="like"] i');
    const $dislikeBtn = $messageTools.find('[data-action="dislike"] i');
    
    // Reset to outline icons
    $likeBtn.removeClass('bi-hand-thumbs-up-fill text-light').addClass('bi-hand-thumbs-up text-light');
    $dislikeBtn.removeClass('bi-hand-thumbs-down-fill text-light').addClass('bi-hand-thumbs-down text-light');
    
    // Apply active states based on actions
    actions.forEach(action => {
        if (action.type === 'like') {
            $likeBtn.removeClass('bi-hand-thumbs-up text-light').addClass('bi-hand-thumbs-up-fill text-light');
        } else if (action.type === 'dislike') {
            $dislikeBtn.removeClass('bi-hand-thumbs-down text-light').addClass('bi-hand-thumbs-down-fill text-light');
        }
    });
}

// Function to handle message regeneration
window.handleMessageRegenerate = function(button) {
    const messageIndex = $(button).data('message-index');
    const $button = $(button);
    
    // Disable button and show loading
    $button.prop('disabled', true);
    $button.find('i').removeClass('bi-arrow-clockwise').addClass('bi-arrow-clockwise spinner-border spinner-border-sm');
    
    $.ajax({
        url: '/api/message/regenerate',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            userChatId: userChatId,
            chatId: chatId
        }),
        success: function(response) {
            if (response.success) {
                // Remove the last message from UI
                $('#chatContainer .message-container').last().fadeOut(300, function() {
                    $(this).remove();
                });
                
                // Trigger new completion
                setTimeout(() => {
                    generateChatCompletion();
                }, 500);
                
                showNotification(window.translations?.message_regenerating || 'Regenerating message...', 'info');
            }
        },
        error: function(xhr) {
            console.error('Error regenerating message:', xhr);
            showNotification(window.translations?.error_regenerating || 'Error regenerating message', 'error');
            
            // Restore button
            $button.prop('disabled', false);
            $button.find('i').removeClass('spinner-border spinner-border-sm').addClass('bi-arrow-clockwise');
        }
    });
};

// Function to update all message tools to ensure only the last assistant message has regenerate button
function updateAllMessageTools() {
    $('.message-tools-controller').each(function() {
        const $toolsController = $(this);
        const messageIndex = $toolsController.data('message-index');
        const $messageContainer = $toolsController.closest('.message-container');
        const isAssistantMessage = $messageContainer.hasClass('assistant-message') || $messageContainer.find('.assistant-message').length > 0;
        
        if (isAssistantMessage) {
            const $regenerateBtn = $toolsController.find('.message-regenerate-btn');
            const isLastAssistantMessage = $messageContainer.is($('.message-container').filter(function() {
                return $(this).hasClass('assistant-message') || $(this).find('.assistant-message').length > 0;
            }).last());
            
            if (isLastAssistantMessage) {
                // Show regenerate button for last assistant message
                if ($regenerateBtn.length === 0) {
                    const regenerateHtml = `
                        <button class="btn btn-sm text-light message-regenerate-btn border-0 p-1" 
                                data-message-index="${messageIndex}"
                                title="${window.translations?.regenerate || 'Regenerate'}"
                                style="background: none; font-size: 12px; line-height: 1;">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>`;
                    $toolsController.find('.d-flex').append(regenerateHtml);
                }
            } else {
                // Hide regenerate button for previous assistant messages
                $regenerateBtn.remove();
            }
        }
    });
}

// Event listeners
$(document).ready(function() {
    // Handle like/dislike button clicks
    $(document).on('click', '.message-action-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const action = $(this).data('action');
        handleMessageAction(this, action);
    });
    
    // Handle regenerate button clicks
    $(document).on('click', '.message-regenerate-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        handleMessageRegenerate(this);
    });
});

// Make the function globally available
window.getMessageTools = getMessageTools;
window.updateAllMessageTools = updateAllMessageTools;