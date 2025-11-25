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
        const likeBadgeClass = (isLiked || hasLikeAction) ? 'text-danger' : '';

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
                    
                    <span class="${nsfw ? 'd-none-test' : ''} ${videoBadgeClass} image-tool-badge img2video-btn" 
                          onclick="${!hasVideoAction && subscriptionStatus ? `generateVideoFromImage('${imageId}', '${chatId}', '${userChatId}')` : hasVideoAction ? '' : 'loadPlanPage()'}" 
                          data-id="${imageId}" 
                          data-chat-id="${chatId}"
                          ${nsfw ? 'data-nsfw="true"' : ''}
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
                    
                    <span class="badge bg-white text-secondary image-tool-badge" 
                          onclick="fetchAndShowImageInfo('${imageId}')" 
                          data-bs-toggle="modal" 
                          data-bs-target="#modal-${imageId}">
                        <i class="bi bi-info-circle"></i>${window.translations?.image_tools?.info || 'Info'}
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
            <div class="title assistant-chat-box py-1 px-3 ${title && title !== 'undefined' ? '': 'd-none'}" data-id="${imageId}" style="border-radius: 0px 0px 15px 15px;">
                <p class="text-white" style="font-size: 12px;">${title}</p>
            </div>
            <div style="height: 50vh;" class="modal fade" id="modal-${imageId}" tabindex="-1" aria-labelledby="modal-${imageId}-label" aria-hidden="true" data-bs-backdrop="false">
                <div class="modal-dialog" style="bottom: 20vh;position: fixed;">
                    <div class="modal-content border-0 shadow mx-auto" style="height: auto; width: 90%; max-width: 600px;">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modal-${imageId}-label">${window.translations?.image_tools?.info || 'Image Info'}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" style="max-height: 40vh; overflow-y: auto;">
                            <!-- Content will be populated by fetchAndShowImageInfo -->
                            <div class="text-center">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p>Loading image details...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Add a video icon on top (bottom right) of the .assistant-image-box 
    function generateVideoIcon(imageId, chatId, userChatId) {
        const assistantImageBox = $(`.assistant-image-box img[data-id="${imageId}"]`);
        if (assistantImageBox.length) {
            let $parent = assistantImageBox.parent();
            if ($parent.find('.video-icon-overlay').length === 0) {
            const $icon = $('<i>')
                .addClass('bi bi-play-circle-fill video-icon-overlay')
                .css({
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                fontSize: '24px',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer'
                })
                .attr('data-id', imageId)
                .on('click', function(e) {
                e.stopPropagation();
                if (subscriptionStatus) {
                    generateVideoFromImage(imageId, chatId, userChatId);
                } else {
                    loadPlanPage();
                }
                });
            $parent.css('position', 'relative').append($icon);
            }
        }
    }
  
    function sanitizeString(inputString) {
        if(!inputString)return ''
        inputString.replace(/\s+/g, ' ').trim();  
        if (inputString.includes(",,,")){
            return inputString.split(",,,")[1].trim();
        }
        return inputString;
    } 
window.fetchAndShowImageInfo = async function(imageId) {
    const modalEl = document.getElementById(`modal-${imageId}`);
    if (!modalEl) return;

    const modal = new bootstrap.Modal(modalEl);
    const modalBody = modalEl.querySelector('.modal-body');

    // Loading
    modalBody.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" style="width: 2.5rem; height: 2.5rem;"></div>
            <p class="mt-3 text-muted small">Loading details...</p>
        </div>`;

    modal.show();

    try {
        const res = await fetch(`http://localhost:3000/gallery/${imageId}/info`);
        if (!res.ok) throw new Error('Network error');
        const { success, data } = await res.json();
        if (!success || !data) throw new Error('No data received');

        const { image, request, chat } = data;

        modalBody.innerHTML = `
<div class="p-3">

  <!-- Title + Chat Info -->
  <div class="text-center mb-4">
    <h6 class="fw-bold text-primary mb-2">
      ${image.title?.en || image.title?.ja || image.title?.fr || 'Untitled'}
    </h6>
    <div class="small text-muted">
      <i class="bi bi-chat-dots-fill me-1"></i><strong>${chat.name}</strong>
      <span class="mx-1">•</span>
      ${new Date(image.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
    </div>
  </div>

  <hr class="border-secondary opacity-25">

  <!-- Prompt -->
  <div class="mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold text-success mb-0">Prompt</h6>
      <button class="btn btn-sm btn-outline-success rounded-pill copy-btn" data-clipboard="${(image.prompt || '').replace(/"/g, '&quot;')}">
        <i class="bi bi-clipboard"></i>
      </button>
    </div>
    <p class="small text-body mb-0 lh-lg text-break bg-light rounded-3 p-3">
      ${image.prompt || '<em class="text-muted">No prompt recorded</em>'}
    </p>
  </div>

  <!-- Negative Prompt -->
  -->
  ${request.negative_prompt ? `
  <div class="mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold text-danger mb-0">Negative Prompt</h6>
      <button class="btn btn-sm btn-outline-danger rounded-pill copy-btn" data-clipboard="${request.negative_prompt.replace(/"/g, '&quot;')}">
        <i class="bi bi-clipboard-x"></i>
      </button>
    </div>
    <p class="small text-body mb-0 lh-lg text-break bg-light rounded-3 p-3">
      ${request.negative_prompt}
    </p>
  </div>` : ''}

  <!-- Quick Metadata Grid -->
  <div class="row g-2 text-center mb-4">
    <div class="col-6">
      <div class="bg-primary text-white rounded-3 py-2 small fw-bold">
        Ratio<br><strong>${image.aspectRatio}</strong>
      </div>
    </div>
    <div class="col-6">
      <div class="bg-info text-dark rounded-3 py-2 small fw-bold">
        Seed<br><strong>${image.seed}</strong>
      </div>
    </div>
    <div class="col-6">
      <div class="bg-${image.nsfw ? 'danger' : 'success'} text-white rounded-3 py-2 small fw-bold">
        ${image.nsfw ? 'NSFW' : 'SFW'}
      </div>
    </div>
    <div class="col-6">
      <div class="bg-secondary text-white rounded-3 py-2 small fw-bold">
        ${chat.language.toUpperCase()}
      </div>
    </div>
  </div>

  <!-- Extra Flags -->
  <div class="d-flex flex-wrap gap-2 justify-content-center mb-3">
    ${image.isMerged ? '<span class="badge bg-warning text-dark">Merged</span>' : ''}
    ${request.blur ? '<span class="badge bg-secondary">Blur</span>' : ''}
    ${request.chatCreation ? '<span class="badge bg-teal text-white">Chat Created</span>' : ''}
  </div>

  <!-- Technical Info -->
  <div class="small text-muted">
    <div><strong>ID:</strong> <code class="text-primary">${image._id}</code></div>
    <div><strong>Slug:</strong> ${image.slug}</div>
    <div><strong>Chat:</strong> ${chat.slug}</div>
  </div>

</div>`;

        // Copy to clipboard with visual feedback
        modalBody.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(btn.dataset.clipboard || '');
                    const icon = btn.querySelector('i');
                    const origClass = icon.classList.value;
                    icon.className = 'bi bi-check2-all';
                    btn.classList.remove('btn-outline-success', 'btn-outline-danger');
                    btn.classList.add('btn-success');
                    setTimeout(() => {
                        icon.className = origClass;
                        btn.classList.remove('btn-success');
                        btn.classList.add(btn.dataset.clipboard.includes('Negative') ? 'btn-outline-danger' : 'btn-outline-success');
                    }, 2000);
                } catch (e) {
                    btn.innerHTML = '<i class="bi bi-x"></i>';
                }
            });
        });

    } catch (err) {
        modalBody.innerHTML = `
            <div class="text-center py-5 text-danger">
                <i class="bi bi-exclamation-triangle-fill fs-3"></i>
                <p class="mt-2">Failed to load info</p>
                <small>${err.message}</small>
            </div>`;
        console.error('Image info error:', err);
    }
};
    window.getImageTools = getImageTools;
