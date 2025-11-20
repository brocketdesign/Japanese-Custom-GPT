// layout-adjustments.js
// Adjusts chat container height dynamically based on viewport

const adjustChatContainerHeight = () => {
    const newHeight = $(window).height() * 0.97;
    $('.chat-contain .card-body').height(newHeight);
};

$(document).ready(adjustChatContainerHeight);
$(window).on('resize', adjustChatContainerHeight);
