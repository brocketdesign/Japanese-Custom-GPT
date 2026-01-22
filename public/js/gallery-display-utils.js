/**
 * Gallery Display Utils
 * Global function for rendering character cards in galleries
 * Used across multiple pages: character.hbs, dashboard.js, explore pages, etc.
 */

/**
 * Global displayChats function for rendering character cards in galleries
 */
window.displayChats = function (chatData, targetGalleryId = 'chat-gallery', modal = false) {
    console.log('[displayChats] ===== FUNCTION CALLED =====' );
    console.log('[displayChats] Target Gallery ID:', targetGalleryId);
    console.log('[displayChats] Chat Data Received:', chatData);
    console.log('[displayChats] Chat Data Type:', typeof chatData);
    console.log('[displayChats] Chat Data Is Array:', Array.isArray(chatData));
    if (Array.isArray(chatData)) {
        console.log('[displayChats] Data Array Length:', chatData.length);
        if (chatData.length > 0) {
            console.log('[displayChats] First Chat Object Keys:', Object.keys(chatData[0]));
            console.log('[displayChats] First Chat Object:', chatData[0]);
        }
    }
    
    const currentUser = window.user || {};
    console.log('[displayChats] Current User:', currentUser);
    const currentUserId = currentUser._id;
    const subscriptionStatus = currentUser.subscriptionStatus === 'active';
    const isTemporaryUser = !!currentUser.isTemporary;
    console.log('[displayChats] Subscription Status:', subscriptionStatus, '| Is Temporary:', isTemporaryUser);
    
    let htmlContent = '';
    
    if (!Array.isArray(chatData)) {
        console.error('[displayChats] ERROR: chatData is not an array:', chatData);
        return;
    }
    
    chatData.forEach(chat => {
        if (!chat || (!chat.name && !chat.chatName)) return;
        
        // Normalize nsfw to boolean
        const nsfw = chat?.nsfw === true || chat?.nsfw === 'true';
        const moderationFlagged = Array.isArray(chat?.moderation?.results) && 
            chat.moderation.results.length > 0 && !!chat.moderation.results[0].flagged;
        const finalNsfwResult = nsfw || moderationFlagged;
        const isOwner = chat.userId === currentUserId;
        
        // Sample image selection logic
        let sampleImages = [];
        if (Array.isArray(chat.sampleImages) && chat.sampleImages.length > 0) {
            sampleImages = chat.sampleImages.filter(img => img && img.imageUrl).map(img => img.imageUrl);
        }
        if (Array.isArray(chat.images) && chat.images.length > 0) {
            sampleImages = sampleImages.concat(chat.images.filter(img => img && img.imageUrl).map(img => img.imageUrl));
        }
        if (chat.chatImageUrl) {
            sampleImages.unshift(chat.chatImageUrl);
        }
        sampleImages = [...new Set(sampleImages.filter(Boolean))];
        if (sampleImages.length === 0) {
            sampleImages = ['/img/logo.webp'];
        }
        
        const primaryImage = sampleImages[0];
        const secondaryImage = sampleImages.find((img) => img !== primaryImage) || primaryImage;
        const chatId = chat.chatId || chat._id;
        const chatName = chat.name || chat.chatName || 'Unknown';
        const chatSlug = chat.slug || null;
        const genderClass = chat.gender ? `chat-gender-${chat.gender.toLowerCase()}` : '';
        const styleClass = chat.imageStyle ? `chat-style-${chat.imageStyle.toLowerCase()}` : '';
        
        // Determine click action
        let clickAction;
        if (chat.premium && !subscriptionStatus) {
            clickAction = `loadPlanPage()`;
        } else if (chatSlug) {
            // If slug is available, navigate to character profile page with slug
            clickAction = `window.location.href='/character/slug/${chatSlug}'`;
        } else {
            // Fallback to character page with chatId
            clickAction = `window.location.href='/character/${chatId}'`;
        }
        
        htmlContent += `
            <div class="gallery-card ${finalNsfwResult ? 'nsfw-content' : ''} ${chat.premium ? 'premium-chat' : ''} ${genderClass} ${styleClass}" data-id="${chat._id}">
                <div class="card gallery-hover"
                    onclick="${clickAction}"
                    style="cursor: pointer;">
                    <!-- Primary Image -->
                    <img 
                        src="${primaryImage}" 
                        alt="${chatName}" 
                        class="gallery-img gallery-img-primary"
                        loading="lazy"
                    >
                    <!-- Secondary Image for hover -->
                    <img 
                        src="${secondaryImage}" 
                        alt="${chatName}"
                        class="gallery-img gallery-img-secondary"
                        style="position: absolute; inset: 0; opacity: 0;"
                        loading="lazy"
                    >
                    
                    <!-- Multi-image indicator -->
                    ${sampleImages.length > 1 ? `
                        <i class="bi bi-images multi-indicator"></i>
                    ` : ''}
                    
                    <!-- Top badges -->
                    <div class="position-absolute top-0 end-0 m-1 d-flex flex-column gap-1" style="z-index: 10;">
                        ${finalNsfwResult ? `<span class="badge bg-danger">18+</span>` : ''}
                        ${chat.premium ? `<span class="badge" style="background: var(--explore-accent);"><i class="bi bi-gem"></i></span>` : ''}
                    </div>
                    
                    <!-- Hover overlay content -->
                    <div class="hover-overlay position-absolute inset-0 d-flex align-items-center justify-content-center" 
                         style="background: rgba(0,0,0,0.4); opacity: 0; transition: opacity 0.2s ease; inset: 0; position: absolute;">
                        <div class="text-white text-center px-2">
                            <div class="fw-bold text-truncate" style="font-size: 13px; max-width: 120px;">${chatName}</div>
                        </div>
                    </div>
                    
                    <!-- Loading spinner -->
                    <div id="spinner-${chatId}" class="position-absolute d-none justify-content-center align-items-center" style="background: rgba(0,0,0,0.7); z-index: 20; inset: 0;">
                        <div class="spinner-border spinner-border-sm" role="status"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Append to target gallery
    console.log('[displayChats] Looking for target gallery:', `#${targetGalleryId}`);
    const $target = $(`#${targetGalleryId}`);
    console.log('[displayChats] Target jQuery object found?', $target.length > 0);
    console.log('[displayChats] All galleries on page:', {
        chatGallery: $('#chat-gallery').length > 0,
        allChatsContainer: $('#all-chats-container').length > 0,
        imagesGrid: $('#imagesGrid').length > 0,
        videosGrid: $('#videosGrid').length > 0,
        latestChatsGallery: $('#latest-chats-gallery').length > 0
    });
    
    if ($target.length > 0) {
        console.log('[displayChats] SUCCESS: Appending to target gallery');
        $target.append(htmlContent);
    } else {
        console.warn(`[displayChats] WARNING: Target gallery not found: #${targetGalleryId}`);
        console.log('[displayChats] Attempting fallback to #chat-gallery');
        // Try fallback
        const $fallback = $('#chat-gallery');
        if ($fallback.length > 0) {
            console.log('[displayChats] Fallback successful: appending to #chat-gallery');
            $fallback.append(htmlContent);
        } else {
            console.error('[displayChats] CRITICAL ERROR: Neither target gallery nor fallback found!');
        }
    }
    
    // Apply hover effects
    $('.gallery-card .card').off('mouseenter mouseleave').on('mouseenter', function() {
        $(this).find('.gallery-img-primary').css('opacity', '0');
        $(this).find('.gallery-img-secondary').css('opacity', '1');
        $(this).find('.hover-overlay').css('opacity', '1');
    }).on('mouseleave', function() {
        $(this).find('.gallery-img-primary').css('opacity', '1');
        $(this).find('.gallery-img-secondary').css('opacity', '0');
        $(this).find('.hover-overlay').css('opacity', '0');
    });
    
    console.log(`[displayChats] Rendered ${chatData.length} chats to #${targetGalleryId}`);
};
