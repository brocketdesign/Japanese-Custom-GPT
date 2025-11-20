// ui-helpers.js
// Shared UI utilities used by discovery views

window.emptyAllGalleriesExcept = (exceptId) => {
    const galleryIds = [
        'chat-gallery',
        'all-chats-container',
        'latest-chats-gallery',
        'latest-video-chats-gallery',
        'all-chats-images-gallery',
        'all-chats-images-pagination-controls',
        'latest-video-chats-pagination-controls',
        'popular-chats-pagination-controls',
    ];
    galleryIds.forEach((id) => {
        if (id !== exceptId) {
            $(`#${id}`).hide();
        }
    });
    $(`#${exceptId}`).show();
};

// Clean date display
$('.date-time').each(function () {
    const text = $(this).text().trim();
    const dateOnly = text.split(' ')[0];
    $(this).text(dateOnly);
});

// Re-expose renderCircleGrid previously inline
window.renderCircleGrid = function (cardInfos, container) {
    cardInfos.forEach(function (item) {
        const card = $(`
            <div class="card custom-card bg-transparent shadow-0 border-0 px-1 col-3 col-sm-4 col-lg-2" style="cursor:pointer;" data-id="${item._id}">
                <div style="background-image:url(${item.chatImageUrl})" class="card-img-top rounded-avatar position-relative m-auto" alt="${item.name}"></div>
            </div>
        `);
        card.on('click', function () {
            if (typeof window.redirectToChat === 'function') {
                window.redirectToChat($(this).attr('data-id'));
            }
        });
        container.append(card);
    });
};
