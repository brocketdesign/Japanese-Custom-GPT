function getImageTools({chatId, imageId, isLiked = false, title, prompt = false, nsfw = false, imageUrl = false, actions = []}) {
        prompt = sanitizeString(prompt);

        // Check if actions exist and determine icon states
        const hasVideoAction = actions?.some(action => action.type === 'video_generated');
        const hasUpscaleAction = actions?.some(action => action.type === 'upscaled');
        const hasLikeAction = actions?.some(action => action.type === 'like');
        const hasMergeFaceAction = actions?.some(action => action.type === 'merge_face');
        
        // Get specific action objects
        const videoAction = actions?.find(action => action.type === 'video_generated');
        const upscaleAction = actions?.find(action => action.type === 'upscaled');
        const likeAction = actions?.find(action => action.type === 'like');
        const mergeFaceAction = actions?.find(action => action.type === 'merge_face');
        
        // Determine icon classes based on actions
        const videoIconClass = hasVideoAction ? 'bi-play-circle-fill text-success' : 'bi-play-circle';
        const upscaleIconClass = hasUpscaleAction ? 'bi-badge-hd-fill text-success' : 'bi-badge-hd';
        const likeIconClass = (isLiked || hasLikeAction) ? 'bi-heart-fill text-danger' : 'bi-heart';
        const mergeFaceIconClass = hasMergeFaceAction ? 'bi-person-fill-check text-success' : 'bi-person-plus';
        
        // Determine if buttons should be disabled
        const videoDisabled = hasVideoAction ? 'style="opacity:0.5; pointer-events:none;"' : '';
        const upscaleDisabled = hasUpscaleAction ? 'style="opacity:0.5; pointer-events:none;"' : '';
        
        // Get additional info for tooltips
        const videoTooltip = hasVideoAction ? 
            `${window.translations?.video_already_generated || 'Video already generated'} - ID: ${videoAction?.videoId}` : 
            `${window.translations?.convert_to_video || 'Convert to Video'}`;
        
        const upscaleTooltip = hasUpscaleAction ? 
            `${window.translations?.already_upscaled || 'Already upscaled'} (${upscaleAction?.scale_factor}x) - ID: ${upscaleAction?.upscaledImageId}` : 
            `${window.translations?.upscale_image || 'Upscale Image'}`;

        const mergeFaceTooltip = hasMergeFaceAction ? 
            `${window.mergeFaceTranslations?.alreadyMerged || 'Face already merged'} (${mergeFaceAction?.mergeIds?.length || 0} merges)` : 
            `${window.mergeFaceTranslations?.title || 'Merge Face'}`;

        return `
            <div class="bg-white py-2 image-tools">
                <div class="d-flex overflow-auto" style="scrollbar-width: none; -ms-overflow-style: none;">
                    <style>
                        .image-tools .d-flex::-webkit-scrollbar { display: none; }
                    </style>
                    <span class="badge bg-white text-secondary image-fav flex-shrink-0 me-2" data-id="${imageId}"
                    onclick="toggleImageFavorite(this)" 
                    style="cursor: pointer; opacity:0.8;">
                        <i class="bi ${likeIconClass}"></i>
                    </span>
                    <span class="badge bg-white text-secondary txt2img regen-img flex-shrink-0 me-2" 
                    onclick="${subscriptionStatus ? 'regenImage(this)' : 'loadPlanPage()'}" 
                    data-prompt="${prompt}" 
                    data-nsfw="${nsfw}" 
                    data-id="${imageId}" 
                    style="cursor: pointer; opacity:0.8;">
                        <i class="bi bi-arrow-clockwise"></i>
                    </span>
                    <span class="badge bg-white text-secondary upscale-img flex-shrink-0 me-2" 
                    onclick="${!hasUpscaleAction && subscriptionStatus ? `upscaleImage('${imageId}', '${imageUrl}', '${chatId}', '${userChatId}')` : hasUpscaleAction ? '' : 'loadPlanPage()'}" 
                    data-id="${imageId}" 
                    data-url="${imageUrl}"
                    ${upscaleDisabled}
                    title="${upscaleTooltip}">
                        <i class="bi ${upscaleIconClass}"></i>
                    </span>
                    <span class="${nsfw ? 'd-none' : ''} badge bg-white text-secondary img2video-btn flex-shrink-0 me-2" 
                    onclick="${!hasVideoAction && subscriptionStatus ? `generateVideoFromImage('${imageId}', '${chatId}', '${userChatId}')` : hasVideoAction ? '' : 'loadPlanPage()'}" 
                    data-id="${imageId}" 
                    data-chat-id="${chatId}"
                    ${videoDisabled}
                    title="${videoTooltip}">
                        <i class="bi ${videoIconClass}"></i>
                    </span>
                    <span class="badge bg-white text-secondary merge-face-btn flex-shrink-0 me-2" 
                    onclick="${subscriptionStatus ? `openMergeFaceModal('${imageId}', '${imageUrl}', '${chatId}', '${userChatId}')` : 'loadPlanPage()'}" 
                    data-id="${imageId}" 
                    data-url="${imageUrl}"
                    data-chat-id="${chatId}"
                    title="${mergeFaceTooltip}">
                        <i class="bi ${mergeFaceIconClass}"></i>
                    </span>
                    ${window.isAdmin ? `
                    <span type="button" class="badge bg-white text-secondary flex-shrink-0 me-2" data-bs-toggle="modal" data-bs-target="#modal-${imageId}">
                        <i class="bi bi-info-circle"></i>
                    </span>` : ''}
                    <span class="badge bg-white text-secondary share d-none flex-shrink-0 me-2"
                            data-title="${title}"
                            data-url="${imageUrl}"
                            style="cursor: pointer; opacity:0.8;"
                            onclick="openShareModal(this)">
                        <i class="bi bi-box-arrow-up"></i>
                    </span>
                    <span class="badge bg-white text-secondary download-image flex-shrink-0 me-2" style="cursor: pointer; opacity:0.8;"
                        data-src="${imageUrl}"
                        data-title="${title}"
                        data-id="${imageId}"
                        onclick="downloadImage(this)">
                        <i class="bi bi-download"></i></a>
                    </span>
                    ${window.isAdmin ? `
                    <span class="badge bg-white text-secondary update-chat-image flex-shrink-0 me-2" onclick="${subscriptionStatus ? 'updateChatImage(this)' : 'loadPlanPage()'}" data-id="${chatId}" data-img="${imageUrl}" style="cursor: pointer; opacity:0.8;">
                        <i class="bi bi-image"></i>
                    </span>` : ''}
                </div>
                ${actions && actions.length > 0 ? `
                <div class="actions-info text-muted px-3 py-1" style="font-size: 11px;">
                    ${actions.map(action => {
                        if (action.type === 'video_generated') {
                            return `<div><i class="bi bi-play-circle-fill text-success me-1"></i>Video generated ${action.date ? `on ${new Date(action.date).toLocaleDateString()}` : ''}</div>`;
                        } else if (action.type === 'upscaled') {
                            return `<div><i class="bi bi-badge-hd-fill text-success me-1"></i>Upscaled ${action.scale_factor}x ${action.date ? `on ${new Date(action.date).toLocaleDateString()}` : ''}</div>`;
                        } else if (action.type === 'like') {
                            return `<div><i class="bi bi-heart-fill text-danger me-1"></i>Liked ${action.date ? `on ${new Date(action.date).toLocaleDateString()}` : ''}</div>`;
                        } else if (action.type === 'merge_face') {
                            return `<div><i class="bi bi-person-fill-check text-success me-1"></i>Face merged (${action.mergeIds?.length || 0} versions) ${action.date ? `on ${new Date(action.date).toLocaleDateString()}` : ''}</div>`;
                        }
                        return '';
                    }).join('')}
                </div>` : ''}
            </div>
            <div class="title assistant-chat-box py-1 px-3 ${title && title !== 'undefined' ? '': 'd-none'}" style="border-radius: 0px 0px 15px 15px;max-width: 200px;">
                <p class="text-white" style="font-size: 12px;">${title}</p>
            </div>
            ${window.isAdmin ? `
            <div style="height: 50vh;" class="modal fade" id="modal-${imageId}" tabindex="-1" aria-labelledby="modal-${imageId}-label" aria-hidden="true" data-bs-backdrop="false">
                <div class="modal-dialog" style="bottom: 20vh;position: fixed;">
                    <div class="modal-content border-0 shadow mx-auto" style="height: auto; width: 90%; max-width: 600px;">
                        <div class="modal-header">
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" style="max-height: 25vh; overflow-y: auto;">
                            <p>${prompt}</p>
                            ${actions && actions.length > 0 ? `
                            <hr>
                            <h6>Actions History:</h6>
                            ${actions.map(action => `
                                <div class="mb-2">
                                    <strong>Type:</strong> ${action.type}<br>
                                    ${action.videoId ? `<strong>Video ID:</strong> ${action.videoId}<br>` : ''}
                                    ${action.upscaledImageId ? `<strong>Upscaled Image ID:</strong> ${action.upscaledImageId}<br>` : ''}
                                    ${action.scale_factor ? `<strong>Scale Factor:</strong> ${action.scale_factor}x<br>` : ''}
                                    ${action.mergeIds ? `<strong>Merge IDs:</strong> ${action.mergeIds.join(', ')}<br>` : ''}
                                    ${action.date ? `<strong>Date:</strong> ${new Date(action.date).toLocaleString()}<br>` : ''}
                                </div>
                            `).join('')}
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>` : ''}
        `;
    }

  
    function sanitizeString(inputString) {
        if(!inputString)return ''
        inputString.replace(/\s+/g, ' ').trim();  
        if (inputString.includes(",,,")){
            return inputString.split(",,,")[1].trim();
        }
        return inputString;
    } 
    
    window.getImageTools = getImageTools;