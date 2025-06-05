$(document).ready(function() {
    // Toggle gifts overlay
    $('#gifts-toggle').on('click', function() {
        const $giftsOverlay = $('#giftsOverlay');
        if ($giftsOverlay.is(':visible')) {
            $giftsOverlay.slideUp('fast');
        } else {
            // Hide other overlays first
            $('#personas-overlay #personas-container').slideUp('fast');
            $('#promptContainer').slideUp('fast');
            
            // Show gifts overlay
            $giftsOverlay.slideDown('fast');
            
            // Initialize lazy loading for gift images if not already done
            initializeGiftLazyLoading();
        }
    });

    // Close gifts overlay
    $('#close-giftsOverlay').on('click', function() {
        $('#giftsOverlay').slideUp('fast');
    });

    // Handle gift card clicks
    $(document).on('click', '.gift-card', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Check if user has permission (similar to prompt cards)
        if ($(this).hasClass('inactive')) {
            if (isTemporary || !subscriptionStatus) {
                loadPlanPage();
            }
            return;
        }

        // Remove previous selections and select this gift
        $('.gift-card').removeClass('selected');
        $(this).addClass('selected');

        const giftId = $(this).data('id');
        const giftNsfw = $(this).data('nsfw') ? 'nsfw' : 'sfw';
        const giftImagePreview = new URL(
            $(this).find('img').attr('data-src') || $(this).find('img').attr('src'), 
            window.location.origin
        ).href;

        // Generate image with gift prompt directly
        sendGiftImageDirectly(giftId, giftNsfw, giftImagePreview);
        
        // Hide the gifts overlay
        $('#giftsOverlay').slideUp('fast');
    });

    // Initialize gift permissions (similar to custom prompts)
    async function initializeGiftPermissions(userChatId) {
        try {
            // If user is not temporary and has subscription, activate all gifts
            if (!isTemporary && subscriptionStatus) {
                const $allGifts = $('.gift-card');
                if ($allGifts.length > 0) {
                    $allGifts.addClass('active').removeClass('inactive');
                }
                return;
            }

            // Fetch the array of gift IDs for this userChat
            const res = await fetch(`/api/gifts/${userChatId}`);
            if (!res.ok) {
                // Fallback: activate the first gift card if any
                const $allGifts = $('.gift-card');
                if ($allGifts.length > 0) {
                    $allGifts.removeClass('active').addClass('inactive');
                    $allGifts.first().addClass('active').removeClass('inactive');
                }
                return;
            }
            const giftIds = await res.json();

            const $giftCards = $('.gift-card');
            if ($giftCards.length === 0) {
                return;
            }

            // Deactivate all gifts initially
            $giftCards.removeClass('active').addClass('inactive');

            if (!giftIds || giftIds.length === 0) {
                // Activate only the first card
                $giftCards.first().addClass('active').removeClass('inactive');
            } else {
                // Activate gifts from giftIds array
                let maxIndexFromGiftIds = -1;

                $giftCards.each(function(index) {
                    const giftId = $(this).data('id');
                    if (giftIds.includes(giftId)) {
                        $(this).addClass('active').removeClass('inactive');
                        if (index > maxIndexFromGiftIds) {
                            maxIndexFromGiftIds = index;
                        }
                    }
                });

                // Activate the next card after the last one found in giftIds
                if (maxIndexFromGiftIds !== -1 && maxIndexFromGiftIds + 1 < $giftCards.length) {
                    $($giftCards[maxIndexFromGiftIds + 1]).addClass('active').removeClass('inactive');
                }
            }
        } catch (e) {
            // Fallback: activate the first gift card
            const $allGiftsOnError = $('.gift-card');
            if ($allGiftsOnError.length > 0) {
                $allGiftsOnError.removeClass('active').addClass('inactive');
                $allGiftsOnError.first().addClass('active').removeClass('inactive');
            }
        }
    }

    // Initialize lazy loading for gift images
    function initializeGiftLazyLoading() {
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

    // Send gift image directly (similar to sendPromptImageDirectly)
    function sendGiftImageDirectly(giftId, giftNsfw, giftImagePreview) {
        const placeholderId = new Date().getTime() + "_gift_" + giftId;
        displayOrRemoveImageLoader(placeholderId, 'show', giftImagePreview);
        
        // Use the same image generation function but with gift parameters
        novitaImageGeneration(userId, chatId, userChatId, { 
            placeholderId, 
            imageNsfw: giftNsfw, 
            giftId: giftId, // Use giftId instead of promptId
        })
        .then(data => {
            if (data.error) {
                displayOrRemoveImageLoader(placeholderId, 'remove');
            }
        })
        .catch(error => {
            console.error('Error generating gift image:', error);
            displayOrRemoveImageLoader(placeholderId, 'remove');
        });
    }

    // Make initializeGiftPermissions available globally
    window.initializeGiftPermissions = initializeGiftPermissions;
});