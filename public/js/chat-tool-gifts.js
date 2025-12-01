/**
 * Gifts Management
 * Handles all client-side operations for the gifts tool.
 */
class GiftManager {
    constructor() {
        this.bindEvents();
    }

    bindEvents() {
        // Toggle gifts overlay
        $('#gifts-toggle').on('click', () => {
            const $giftsOverlay = $('#giftsOverlay');
            if ($giftsOverlay.is(':visible')) {
                this.hide();
            } else {
                this.show();
            }
        });

        // Close gifts overlay
        $('#close-giftsOverlay').on('click', () => {
            this.hide();
        });

        // Handle gift card clicks
        $(document).on('click', '.gift-card', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const $card = $(e.currentTarget);

            if ($card.hasClass('inactive')) {
                const cost = $card.data('cost');
                showNotification(`${window.userPointsTranslations?.need_coins?.replace('{coins}', cost) || `Need: ${cost}`}`, 'warning');
                openBuyPointsModal();
                return;
            }

            $('.gift-card').removeClass('selected');
            $card.addClass('selected');

            const giftId = $card.data('id');
            const giftImagePreview = new URL($card.find('img').attr('data-src') || $card.find('img').attr('src'), window.location.origin).href;

            this.sendGiftImageDirectly(giftId, giftImagePreview);
            this.hide();
        });
    }

    show() {
        $('#promptContainer, #personas-overlay #personas-container').slideUp('fast');
        $('#giftsOverlay').slideDown('fast');
        this.initializeGiftLazyLoading();
    }

    hide() {
        $('#giftsOverlay').slideUp('fast');
    }

    // Update gift cards based on user's points
    async update(userId) {
        try {
            const res = await fetch(`/api/gifts/user-status/${userId}`);
            if (!res.ok) {
                console.error('Failed to fetch gifts data.');
                $('.gift-card').addClass('inactive').removeClass('active');
                return;
            }

            const data = await res.json();
            const userPoints = data.userPoints;

            $('.gift-card').each(function() {
                const $card = $(this);
                const giftId = $card.data('id');
                const giftInfo = data.gifts.find(g => g._id === giftId);

                if (!giftInfo) {
                    $card.addClass('inactive').removeClass('active');
                    return;
                }

                if (giftInfo.canAfford) {
                    $card.addClass('active').removeClass('inactive').removeAttr('title');
                    $card.find('.coin-indicator').remove();
                } else {
                    $card.addClass('inactive').removeClass('active');
                    $card.attr('title', 
                        `${window.userPointsTranslations?.need_coins?.replace('{coins}', giftInfo.cost) || `Need: ${giftInfo.cost}`}, ${window.userPointsTranslations?.have_coins?.replace('{coins}', userPoints) || `Have: ${userPoints}`}`
                    );
                }
            });
        } catch (e) {
            console.error('Error updating gifts:', e);
            $('.gift-card').addClass('inactive').removeClass('active');
        }
    }

    initializeGiftLazyLoading() {
        $('.gift-card .lazy-image').each(function() {
            if (!$(this).attr('data-loaded')) {
                const $img = $(this);
                const dataSrc = $img.attr('data-src');
                if (dataSrc) {
                    $img.attr('src', dataSrc);
                    $img.attr('data-loaded', 'true');
                }
            }
        });
    }

    sendGiftImageDirectly(giftId, giftImagePreview) {
        const placeholderId = new Date().getTime() + "_gift_" + giftId;
        displayOrRemoveImageLoader(placeholderId, 'show', giftImagePreview);
        
        const chatId = sessionStorage.getItem('chatId') || window.chatId;
        const userChatId = sessionStorage.getItem('userChatId') || window.userChatId;

        // Add a new message to the chat container for sending a gift
        addMessageToChat(chatId, userChatId, {
            role: 'user',
            message: `🎁 I sent a gift to you! Wait for it!`,
            name: 'gift',
            hidden: true
        }, function(error, res) {

            generateChatCompletion();

            if (error) {
            console.error('Error adding gift message:', error);
            }
        });

        // Generate the gift image
        novitaImageGeneration(window.user._id, chatId, userChatId, {
            placeholderId,
            giftId: giftId,
        })
        .catch(error => {
            console.error('Error generating gift image:', error);
            displayOrRemoveImageLoader(placeholderId, 'remove');
        });
    }
}

$(document).ready(() => {
    window.giftManager = new GiftManager();
});