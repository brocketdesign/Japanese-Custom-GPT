// iframe-communication.js
// Handles cross-origin communication with embedded iframes (e.g. user profile page)

const resizeIframe = () => {
    const $iframe = $('#user-profile-page');
    if ($iframe.length === 0) return;

    const contentHeight = $iframe[0].contentWindow?.document?.body?.scrollHeight;
    if (contentHeight > 0) {
        $iframe.height(contentHeight);
    }
};

window.addEventListener('message', (event) => {
    // event.data could be a string (legacy) or an object with an `event` field
    const data = event?.data;
    if (!data) return;

    const type = typeof data === 'object' ? data.event : data;

    switch (type) {
        case 'resizeIframe':
            resizeIframe();
            break;
        case 'openChat':
            if (typeof data === 'object' && data.chatId) {
                if (typeof window.redirectToChat === 'function') {
                    window.redirectToChat(data.chatId);
                }
            }
            break;
        case 'updatePersona':
            if (typeof data === 'object' && data.personaId !== undefined) {
                if (typeof window.updatePersona === 'function') {
                    window.updatePersona(data.personaId, data.isAdding);
                }
            }
            break;
        case 'updateCoins':
            if (typeof window.updateCoins === 'function') {
                window.updateCoins();
            }
            break;
        default:
            break;
    }
});
