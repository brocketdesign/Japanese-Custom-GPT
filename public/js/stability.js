// Generate Image using Novita
window.txt2ImageNovita = async function(userId, chatId, userChatId, option = {}) {
    try {
        const getValue = (selector, defaultValue = '') => $(selector).val() || defaultValue;

        const {
            negativePrompt = getValue('#negativePrompt-input'),
            title = option.title || getValue('#title-input', null),
            prompt = (option.prompt || getValue('#prompt-input')).replace(/^\s+/gm, '').trim(),
            aspectRatio = '9:16',
            baseFace = null,
            imageType = option.imageType || 'sfw',
            placeholderId = option.placeholderId || null,
            customPrompt = option.customPrompt || false,
            chatCreation = option.chatCreation || false
        } = option;

        const API_ENDPOINT = `${API_URL}/novita/txt2img`;

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title,
                prompt, 
                aspectRatio, 
                userId, 
                chatId, 
                userChatId,
                imageType,
                placeholderId,
                customPrompt,
                chatCreation
            })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('generateImageNovita Error:', error);
    } finally {
    }
};


// Display image icon in last user message
window.addIconToLastUserMessage = function(itemId = false) {
    if(!itemId){
        const lastUserMessage = $('.message-container.user-message:last'); // Select the last user message
        if (lastUserMessage.length) {
            // Add the icon if not already added
            if (!lastUserMessage.find('.message-icon').length) {
                lastUserMessage.css('position', 'relative'); // Ensure the container has relative positioning
                lastUserMessage.append(`
                    <i class="bi bi-image message-icon" style="position: absolute; top: 0px; right: 25px;opacity: 0.7;"></i>
                `);
            }
        }
    }
}
// Display or remove spinner with provided id
window.handleRegenSpin = function (imageId, spin) {
    if (spin) {
        if ($(`.img2img[data-id=${imageId}]`).length) {
            $(`.img2img[data-id=${imageId}]`).addClass('spin');
        } else if ($(`.txt2img[data-id=${imageId}]`).length) {
            $(`.txt2img[data-id=${imageId}]`).addClass('spin');
        }
    } else {
        if ($(`.img2img[data-id=${imageId}]`).length) {
            $(`.img2img[data-id=${imageId}]`).removeClass('spin');
        } else if ($(`.txt2img[data-id=${imageId}]`).length) {
            $(`.txt2img[data-id=${imageId}]`).removeClass('spin');
        }
    }
}
// Display and remove image loader with provided data-id
window.displayOrRemoveImageLoader = function (imageId, action) {
    if (action === 'remove') {
        $(`#chat-recommend [data-id=${imageId}]`).remove();
    } else {
        const placeholder = "/img/image-placeholder.gif";
        const card = $(`
            <div data-id="${imageId}" class="assistant-image-box card custom-card bg-transparent shadow-0 border-0 px-1 mx-1 col-auto" style="cursor:pointer;">
                <div style="background-image:url(${placeholder});border:4px solid white;background-size:cover;" class="card-img-top rounded-avatar position-relative m-auto">
                </div>
            </div>
        `);
        $('#chat-recommend').append(card);
        $('#chat-recommend').scrollLeft($('#chat-recommend')[0].scrollWidth);
    }
}

const sentImageIds = new Set();
window.generateImage = async function(data) {
  if (!data || !data.userChatId || !data.url || !data.id || !data.prompt || sentImageIds.has(data.id)) return;

  const { url: imageUrl, id: imageId, nsfw: imageNsfw, prompt: imagePrompt } = data;
  sentImageIds.add(imageId);

  const img = document.createElement('img');
  img.setAttribute('src', imageUrl);
  img.setAttribute('alt', data.title[lang]);
  img.setAttribute('data-prompt', imagePrompt);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id', imageId);
  img.setAttribute('data-nsfw', imageNsfw);

  displayMessage('bot-image', img, data.userChatId);
};
