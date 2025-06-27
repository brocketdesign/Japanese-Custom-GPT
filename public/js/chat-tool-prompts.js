/**
 * Custom Prompts Management
 * Handles all client-side operations for the custom image prompts tool.
 */
class PromptManager {
    constructor() {
        this.bindEvents();
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
        const placeholderId = new Date().getTime() + "_" + promptId;
        displayOrRemoveImageLoader(placeholderId, 'show', imagePreview);
        const chatId = sessionStorage.getItem('chatId') || window.chatId;
        const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;
        novitaImageGeneration(window.user._id, chatId, userChatId, { placeholderId, imageNsfw, promptId, customPrompt: true })
            .catch(error => {
                console.error('Error:', error);
                displayOrRemoveImageLoader(placeholderId, 'remove');
            });
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
}

$(document).ready(() => {
    window.promptManager = new PromptManager();
});