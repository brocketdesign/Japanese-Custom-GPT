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
        
        // Determine icon classes and labels based on actions
        const likeIcon = (isLiked || hasLikeAction) ? 'bi-heart-fill' : 'bi-heart';
        const likeLabel = (isLiked || hasLikeAction) ? 
            (window.translations?.image_tools?.liked || 'Liked') : 
            (window.translations?.image_tools?.like || 'Like');
        const likeBadgeClass = (isLiked || hasLikeAction) ? 'text-danger' : 'text-white';

        const upscaleIcon = hasUpscaleAction ? 'bi-badge-hd-fill' : 'bi-badge-hd';
        const upscaleLabel = hasUpscaleAction ? 
            (window.translations?.image_tools?.upscaled || 'Upscaled') : 
            (window.translations?.image_tools?.upscale || 'Upscale');
        const upscaleBadgeClass = hasUpscaleAction ? 'badge bg-success text-white' : 'badge bg-white text-secondary';

        const videoIcon = hasVideoAction ? 'bi-play-circle-fill' : 'bi-play-circle';
        const videoLabel = hasVideoAction ? 
            (window.translations?.image_tools?.video_generated || 'Video Generated') : 
            (window.translations?.image_tools?.video || 'Video');
        const videoBadgeClass = hasVideoAction ? 'badge bg-success text-white' : 'badge bg-white text-secondary';

        const mergeFaceIcon = hasMergeFaceAction ? 'bi-person-fill-check' : 'bi-person-plus';
        const mergeFaceLabel = hasMergeFaceAction ? 
            (window.translations?.image_tools?.face_merged || 'Face Merged') : 
            (window.translations?.image_tools?.merge_face || 'Merge Face');
        const mergeFaceBadgeClass = hasMergeFaceAction ? 'badge bg-success text-white' : 'badge bg-white text-secondary';
        
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
            <div class="bg-light py-2 image-tools" data-id="${imageId}">
                <div class="d-flex  gap-2 overflow-auto px-2" style="scrollbar-width: none; -ms-overflow-style: none;">
                    <style>
                        .image-tools .d-flex::-webkit-scrollbar { display: none; }
                        .image-tool-badge {
                            font-size: 10px;
                            padding: 4px 8px;
                            border-radius: 12px;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            white-space: nowrap;
                        }
                        .image-tool-badge:hover {
                            transform: scale(1.05);
                        }
                        .image-tool-badge i {
                            margin-right: 4px;
                        }
                    </style>

                    <span class="badge bg-white text-secondary image-tool-badge image-fav" 
                          data-id="${imageId}"
                          onclick="toggleImageFavorite(this)">
                        <i class="bi ${likeIcon} ${likeBadgeClass}"></i>${likeLabel}
                    </span>
                    
                    <span class="badge bg-white text-secondary image-tool-badge txt2img regen-img" 
                          onclick="${subscriptionStatus ? 'regenImage(this)' : 'loadPlanPage()'}" 
                          data-prompt="${prompt}" 
                          data-nsfw="${nsfw}" 
                          data-id="${imageId}">
                        <i class="bi bi-arrow-clockwise"></i>${window.translations?.image_tools?.regenerate || 'Regenerate'}
                    </span>
                    
                    <span class="${upscaleBadgeClass} image-tool-badge upscale-img" 
                          onclick="${!hasUpscaleAction && subscriptionStatus ? `upscaleImage('${imageId}', '${imageUrl}', '${chatId}', '${userChatId}')` : hasUpscaleAction ? '' : 'loadPlanPage()'}" 
                          data-id="${imageId}" 
                          data-url="${imageUrl}"
                          ${upscaleDisabled}
                          title="${upscaleTooltip}">
                        <i class="bi ${upscaleIcon}"></i>${upscaleLabel}
                    </span>
                    
                    <span class="${nsfw ? 'd-none' : ''} ${videoBadgeClass} image-tool-badge img2video-btn" 
                          onclick="${!hasVideoAction && subscriptionStatus ? `generateVideoFromImage('${imageId}', '${chatId}', '${userChatId}')` : hasVideoAction ? '' : 'loadPlanPage()'}" 
                          data-id="${imageId}" 
                          data-chat-id="${chatId}"
                          ${videoDisabled}
                          title="${videoTooltip}">
                        <i class="bi ${videoIcon}"></i>${videoLabel}
                    </span>
                    
                    <span class="${mergeFaceBadgeClass} image-tool-badge merge-face-btn" 
                          onclick="${subscriptionStatus ? `openMergeFaceModal('${imageId}', '${imageUrl}', '${chatId}', '${userChatId}')` : 'loadPlanPage()'}" 
                          data-id="${imageId}" 
                          data-url="${imageUrl}"
                          data-chat-id="${chatId}"
                          title="${mergeFaceTooltip}">
                        <i class="bi ${mergeFaceIcon}"></i>${mergeFaceLabel}
                    </span>
                    
                    ${window.isAdmin ? `
                    <span class="badge bg-white text-secondary image-tool-badge" 
                          data-bs-toggle="modal" 
                          data-bs-target="#modal-${imageId}">
                        <i class="bi bi-info-circle"></i>${window.translations?.image_tools?.info || 'Info'}
                    </span>` : ''}
                    
                    <span class="badge bg-white text-secondary image-tool-badge share d-none"
                          data-title="${title}"
                          data-url="${imageUrl}"
                          onclick="openShareModal(this)">
                        <i class="bi bi-box-arrow-up"></i>${window.translations?.image_tools?.share || 'Share'}
                    </span>
                    
                    <span class="badge bg-white text-secondary image-tool-badge download-image" 
                          data-src="${imageUrl}"
                          data-title="${title}"
                          data-id="${imageId}"
                          onclick="downloadImage(this)">
                        <i class="bi bi-download"></i>${window.translations?.image_tools?.download || 'Download'}
                    </span>
                    
                    ${window.isAdmin ? `
                    <span class="badge bg-white text-secondary image-tool-badge update-chat-image" 
                          onclick="${subscriptionStatus ? 'updateChatImage(this)' : 'loadPlanPage()'}" 
                          data-id="${chatId}" 
                          data-img="${imageUrl}">
                        <i class="bi bi-image"></i>${window.translations?.image_tools?.update_image || 'Update Image'}
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