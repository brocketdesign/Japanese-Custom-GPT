// chat-history.js
// Opens chat history when clicking on a history item

$(document).on('click', '.history-chat', function () {
    const chatId = $(this).data('id');
    try {
        console.log(`[Chat History] Opening chat history for chat ID: ${chatId} for userId: ${window.userId}`);
    } catch {}

    if (chatId && window.userId && typeof window.getUserChatHistory === 'function') {
        window.getUserChatHistory(chatId, window.userId);
    }
});
