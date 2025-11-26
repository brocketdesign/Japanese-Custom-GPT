// Shared preview modal and swiper logic for images and videos
function createPreviewModalIfNeeded() {
    if ($('#imagePreviewModal').length) return;

    const modalHTML = `
        <div class="modal fade" id="imagePreviewModal" tabindex="-1" aria-labelledby="imagePreviewModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-fullscreen m-0">
                <div class="modal-content mx-auto w-100">
                    <div class="modal-header border-0 position-absolute" style="top: 0; right: 0; z-index: 10000; background: transparent;">
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0" style="height: 100vh; overflow: hidden;">
                        <div class="swiper-container image-preview-swiper" style="height: 100%; width: 100%;">
                            <div class="swiper-wrapper"></div>
                            <div class="swiper-button-next" style="color: white; opacity: 0.8; right: 20px;"></div>
                            <div class="swiper-button-prev" style="color: white; opacity: 0.8; left: 20px;"></div>
                            <div class="swiper-pagination" style="bottom: 140px;"></div>
                            <div class="image-like-overlay position-absolute" style="top: 60px; left: 20px; z-index: 1000;">
                                <button class="btn btn-light rounded-circle image-like-btn d-flex justify-content-center align-items-center" style="width: 50px; height: 50px; opacity: 0.9; backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.2);">
                                    <i class="bi bi-heart fs-4"></i>
                                </button>
                            </div>
                            <div class="image-info-overlay position-absolute w-100" style="bottom: 20px; left: 0; right: 0; z-index: 1000;">
                                <div class="container text-center">
                                    <div class="image-info-container mx-auto" style="max-width: 600px; padding: 15px; border-radius: 12px; backdrop-filter: blur(10px);">
                                        <div class="image-title text-white fw-bold mb-2" style="font-size: 18px;"></div>
                                        <div class="image-prompt-container d-none" style="max-height: 60px; overflow-y: auto; scrollbar-width: thin;">
                                            <div class="image-prompt text-white-50" style="font-size: 14px; line-height: 1.4;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    $('body').append(modalHTML);

    // Like button handler (keeps consistent behavior for both image & video previews)
    $(document).on('click', '.image-like-btn', function(e) {
        e.stopPropagation();
        const imageId = $(this).attr('data-id');
        if (imageId) {
            const mockElement = $(`<div data-id="${imageId}"><i class="bi bi-heart"></i></div>`);
            window.toggleImageFavorite(mockElement[0]);
            showLikeAnimation();

            const activeIndex = window.imageSwiper ? (window.imageSwiper.realIndex || window.imageSwiper.activeIndex) : 0;
            const current = window.previewImages && window.previewImages[activeIndex];
            if (current && current.id === imageId) current.isLiked = !current.isLiked;
        } else {
            console.error('[DEBUG] No image ID found on like button');
        }
    });

    // Initialize swiper when modal shown
    $('#imagePreviewModal').on('shown.bs.modal', function() {
        if (window.imageSwiper) {
            window.imageSwiper.destroy(true, true);
        }
        window.imageSwiper = new Swiper('.image-preview-swiper', {
            loop: false,
            zoom: { maxRatio: 5, minRatio: 1, toggle: false, containerClass: 'swiper-zoom-container' },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            pagination: { el: '.swiper-pagination', clickable: true, dynamicBullets: true },
            touchRatio: 1,
            touchAngle: 45,
            grabCursor: true,
            keyboard: { enabled: true, onlyInViewport: false },
            mousewheel: { invert: false },
            lazy: { loadPrevNext: true, loadPrevNextAmount: 2 },
            watchSlidesProgress: true,
            watchSlidesVisibility: true,
            on: {
                slideChange: function() { const realIndex = this.realIndex || this.activeIndex; updatePreviewInfo(realIndex); updateLikeButton(realIndex); },
                touchEnd: function(swiper, event) { handleDoubleTap(swiper, event); },
                slideChangeTransitionStart: function() { if (this.zoom) this.zoom.out(); },
                init: function() { setTimeout(() => { const startIndex = window.initialSlideIndex || 0; this.slideTo(startIndex, 0); updatePreviewInfo(startIndex); updateLikeButton(startIndex); }, 100); }
            }
        });
        $('.swiper-slide').show();
    });
}

// Generic preview helper used by both images and videos (now supports mixed)
function showPreview(type, el) {
    // If blurred and no subscription - force upgrade
    if ($(el).hasClass('isBlurred') && !subscriptionStatus) { loadPlanPage(); return; }
    if ($(el).hasClass('isBlurred') && subscriptionStatus) { return; }

    // Collect items depending on type. Support 'image', 'video' and 'mixed'
    let items = [];
    if (type === 'image' || type === 'mixed') {
        const imageItems = $('.assistant-image-box img')
            .map((_, img) => ({ type: 'image', url: $(img).attr('src') || $(img).attr('data-src'), id: $(img).attr('data-id'), title: $(img).attr('alt') || $(img).attr('data-title'), prompt: $(img).attr('data-prompt') }))
            .get()
            .filter(i => i.url && !i.url.includes('placeholder'));
        items = items.concat(imageItems);
    }
    if (type === 'video' || type === 'mixed') {
        const videoItems = $('.assistant-image-box')
            .map((_, box) => {
                const $b = $(box);
                const videoUrl = $b.attr('data-video-src') || $b.data('video-src') || ($b.find('video').attr('src') || $b.find('video source').attr('src'));
                const poster = $b.attr('data-src') || $b.data('src') || ($b.find('img').attr('src') || $b.find('img').attr('data-src'));
                const id = $b.find('video').attr('data-id') || $b.attr('data-id') || null;
                const title = $b.find('img').attr('alt') || $b.find('img').attr('data-title') || '';
                return { type: 'video', url: videoUrl, poster, id, title };
            })
            .get()
            .filter(i => i.url && !i.url.includes('placeholder'));
        items = items.concat(videoItems);
    }

    const clickedUrl = $(el).find('img').attr('src') || $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-video-src') || $(el).data('video-src') || ($(el).find('video').attr('src') || $(el).find('video source').attr('src'));
    const clickedIndex = Math.max(0, items.findIndex(it => it.url === clickedUrl || it.poster === clickedUrl));

    createPreviewModalIfNeeded();
    // For mixed mode, we'll toggle the info overlay per-slide (updatePreviewInfo will manage it)
    if (type === 'video') {
        $('#imagePreviewModal .image-info-overlay').hide();
    } else {
        $('#imagePreviewModal .image-info-overlay').show();
    }
    
    const wrapper = $('#imagePreviewModal .swiper-wrapper'); wrapper.empty();

    // Build slides (handle image and video slides together)
    items.forEach(item => {
        if (item.type === 'image') {
            wrapper.append(`<div class="swiper-slide d-flex align-items-center justify-content-center"><div class="swiper-zoom-container"><img src="${item.url}" class="img-fluid" style="max-height: 100vh; max-width: 100vw; object-fit: contain;" data-image-id="${item.id}" data-image-title="${item.title || ''}" data-image-prompt="${item.prompt || ''}"></div></div>`);
        } else {
            wrapper.append(`<div class="swiper-slide d-flex align-items-center justify-content-center"><div class="swiper-zoom-container"><video controls preload="metadata" poster="${item.poster || ''}" style="max-height: 100vh; max-width: 100vw; object-fit: contain;" data-video-id="${item.id}"><source src="${item.url}" type="video/mp4">${window.translations?.video_not_supported || 'Your browser does not support the video tag.'}</video></div></div>`);
        }
    });

    window.previewImages = items; // shared storage for info/update
    window.initialSlideIndex = clickedIndex;

    const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    modal.show();

    // Double tap handling state (kept simple per-modal)
    window._lastPreviewTap = 0; window._previewTapTimeout = null; window._doubleTapDetected = false;

    // Helper functions used by swiper callbacks
    function handleDoubleTap(swiper, event) {
        const currentTime = new Date().getTime(); const tapLength = currentTime - (window._lastPreviewTap || 0);
        if (tapLength < 400 && tapLength > 0) {
            clearTimeout(window._previewTapTimeout); window._doubleTapDetected = true;
            const activeIndex = swiper.realIndex || swiper.activeIndex; const current = window.previewImages[activeIndex];
            if (current && current.id) { const mock = $(`<div data-id="${current.id}"><i class="bi bi-heart"></i></div>`); window.toggleImageFavorite(mock[0]); showLikeAnimation(); event.stopPropagation(); event.preventDefault(); }
        } else {
            window._doubleTapDetected = false;
            window._previewTapTimeout = setTimeout(() => { if (!window._doubleTapDetected) { /* single tap - no-op */ } }, 400);
        }
        window._lastPreviewTap = currentTime;
    }

    function updatePreviewInfo(activeIndex) {
        const cur = window.previewImages[activeIndex];
        if (!cur) return;
        $('.image-title').text(cur.title || (cur.type === 'video' ? 'Video' : 'Untitled'));
        $('.image-prompt').text(cur.prompt || '');
        $('.image-prompt-container').scrollTop(0);
        const $likeBtn = $('.image-like-btn'); if ($likeBtn.length && cur.id) $likeBtn.attr('data-id', cur.id);
        // Toggle overlays for videos (no prompt visible)
        if (cur.type === 'video') {
            $('#imagePreviewModal .image-info-overlay').hide();
        } else {
            $('#imagePreviewModal .image-info-overlay').show();
        }
        // Pause any playing videos on slide change
        $('#imagePreviewModal video').each(function(_, v) { try { v.pause(); } catch(e) {} });
    }

    function updateLikeButton(activeIndex) {
        const cur = window.previewImages[activeIndex]; if (!cur || !cur.id) return;
        const isLiked = $(`.image-fav[data-id="${cur.id}"] i, .video-fav[data-id="${cur.id}"] i`).hasClass('bi-heart-fill');
        const $likeBtn = $('.image-like-btn'); const $likeIcon = $likeBtn.find('i');
        if (isLiked) { $likeIcon.removeClass('bi-heart').addClass('bi-heart-fill text-danger'); } else { $likeIcon.removeClass('bi-heart-fill text-danger').addClass('bi-heart'); }
        cur.isLiked = isLiked;
    }

    // showLikeAnimation kept identical behavior
    function showLikeAnimation() {
        const $heart = $('<div class="floating-heart position-absolute d-flex align-items-center justify-content-center" style="width: 80px; height: 80px; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10001; pointer-events: none;"><i class="bi bi-heart-fill text-danger" style="font-size: 2.5rem; opacity: 0; filter: drop-shadow(0 0 10px rgba(220, 53, 69, 0.8));"></i></div>');
        $('#imagePreviewModal .modal-body').append($heart);
        $heart.find('i').animate({ opacity: 1, fontSize: '4rem' }, 300, function() { $(this).animate({ opacity: 0, fontSize: '2rem' }, 600, function() { $heart.remove(); }); $heart.animate({ top: '30%' }, 600); });
        const $likeBtn = $('.image-like-btn i'); $likeBtn.removeClass('bi-heart').addClass('bi-heart-fill text-danger'); const activeIndex = window.imageSwiper ? (window.imageSwiper.realIndex || window.imageSwiper.activeIndex) : 0; const currentImage = window.previewImages[activeIndex]; if (currentImage && currentImage.id) setTimeout(() => { updateLikeButton(activeIndex); }, 100);
        $('.image-like-btn').addClass('animate__animated animate__heartBeat'); setTimeout(() => { $('.image-like-btn').removeClass('animate__animated animate__heartBeat'); }, 1000); const $ripple = $('<div class="like-ripple"></div>'); $('.image-like-btn').append($ripple); setTimeout(() => { $ripple.remove(); }, 600);
    }

    // expose helpers to outer scope so the Swiper init callback can call them
    window.handleDoubleTap = handleDoubleTap; window.updatePreviewInfo = updatePreviewInfo; window.updateLikeButton = updateLikeButton; window.showLikeAnimation = showLikeAnimation;
}

// Public functions
// Open the mixed image+video preview so both media types appear in the same slider
window.showImagePreview = function(el) { showPreview('mixed', el); };
window.showVideoPreview = function(el) { showPreview('mixed', el); };