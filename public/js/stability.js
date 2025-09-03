// Semaphore for controlling the number of concurrent requests
let activeGenerations = 0;
const MAX_CONCURRENT_GENERATIONS = 5; // Adjust this limit as needed
const RESET_INTERVAL = 10000;
// Reset activeGenerations count every interval
setInterval(() => {
    activeGenerations = 0;
}, RESET_INTERVAL);

// Generate Image using Novita
window.novitaImageGeneration = async function(userId, chatId, userChatId, option = {}) {
    // Validate essential parameters
    if (!userId || !chatId ) {
        const errorMsg = 'Missing essential parameters for image generation:';
        console.error(errorMsg, { userId, chatId });
        throw new Error(errorMsg);
    }
    
    if (activeGenerations > MAX_CONCURRENT_GENERATIONS && user.role !== 'admin') {
        const errorMsg = translations.image_generation_soft_limit.replace('%{interval}%',parseInt(RESET_INTERVAL)/1000);
        showNotification(errorMsg, 'warning');
        throw new Error(errorMsg);
    }

    try {
        activeGenerations++;
        const getValue = (selector, defaultValue = '') => $(selector).val() || defaultValue;

        const {
            negativePrompt = getValue('#negativePrompt-input'),
            title = option.title || getValue('#title-input', null),
            prompt = (option.prompt || getValue('#prompt-input')).replace(/^\s+/gm, '').trim(),
            aspectRatio = '9:16',
            baseFace = null,
            file = null,
            imageType = option.imageType || 'sfw',
            placeholderId = option.placeholderId || null,
            customPrompt = option.customPrompt || false,
            promptId = option.promptId || null,
            giftId = option.giftId || null,
            chatCreation = option.chatCreation || false,
            regenerate = option.regenerate || false,
            modelId = option.modelId || null,
            enableMergeFace = option.enableMergeFace || false,
        } = option;

        let image_base64 = null;
        if(file){
            image_base64 = await uploadAndConvertToBase64(file);
        }

        const API_ENDPOINT = `${API_URL}/novita/generate-img`;
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
                promptId,
                giftId,
                image_base64,
                regenerate,
                modelId,
                chatCreation,
                enableMergeFace
            })
        });

        const data = await response.json();
        if(data.error) {
            console.error('Error in Novita image generation:', data.error);
            showNotification(data.error, 'error');
            throw new Error(data.error);
        }
        return data;
    } catch (error) {
        console.error('generateImageNovita Error:', error);
        throw error;
    }
};


// Upload image and convert to base64
window.uploadAndConvertToBase64 = async function(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            console.error('File upload failed:', uploadResponse.statusText);
            return null;
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.imageUrl) {
            console.error('File upload failed: No imageUrl returned');
            return null;
        }

        const convertResponse = await fetch('/api/convert-url-to-base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uploadData.imageUrl })
        });

        if (!convertResponse.ok) {
            console.error('Failed to convert URL to Base64:', convertResponse.statusText);
            return null;
        }

        const convertData = await convertResponse.json();
        if (!convertData.base64Image) {
            console.error('Failed to convert URL to Base64: No base64Image returned');
            return null;
        }

        return convertData.base64Image;
    } catch (error) {
        console.error('Error in uploadAndConvertToBase64:', error);
        return null;
    }
}


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
        $(`.txt2img[data-id=${imageId}]`).addClass('spin');
    } else {
        $(`.txt2img[data-id=${imageId}]`).removeClass('spin');
    }
};

// Display and remove image loader with provided data-id
window.displayOrRemoveImageLoader = function (imageId, action, imagePreview) {
    
    if (action === 'remove') {
        const existingElement = $(`#chat-recommend [data-id=${imageId}]`);
        existingElement.remove();
    } else {
        // Check if placeholder already exists
        const existingPlaceholder = $(`#chat-recommend [data-id=${imageId}]`);
        if (existingPlaceholder.length > 0) {
            return;
        }
        
        const loadingSpinerGif = "/img/image-placeholder.gif";
        const hasCustomPrompt = imagePreview && imagePreview.trim() !== '';
        const backgroundStyle = hasCustomPrompt 
            ? `background-image:url(${imagePreview});border:4px solid white;background-size:cover;` 
            : 'border:4px solid white;';
        
        const card = $(`
            <div data-id="${imageId}" class="assistant-image-box card custom-card bg-transparent shadow-0 border-0 px-1 mx-1 col-auto" style="cursor:pointer;">
                <div style="${backgroundStyle}" class="card-img-top rounded-avatar position-relative m-auto">
                    <img src="${loadingSpinerGif}" alt="Loading..." class="position-absolute top-50 start-50 translate-middle" style="z-index:2;${hasCustomPrompt ? 'opacity:0.8;' : ''}"/>
                </div>
            </div>
        `);
        
        $('#chat-recommend').append(card);
        $('#chat-recommend').scrollLeft($('#chat-recommend')[0].scrollWidth);
    }
};

window.updateImageCount = function(chatId, count) {
    const badge = $(`.image-count[data-chat-id="${chatId}"]`);
    if (badge.length) {
        // Parse current count, add the new count, and update
        const current = parseInt(badge.text(), 10) || 0;
        badge.text(current + count);
    } else {
        console.warn(`No badge found for chatId: ${chatId}`);
    }
};

// Example usage: debugUpdateImageCount(5); // This will update the image count badge for the last chat session
const sentImageIds = new Set();
window.generateImage = async function(data) {
    // Validate essential data
    if (!data || !data.userChatId || (!data.imageUrl && !data.url)) {
        console.error('[generateImage] Missing essential data:', {
            hasData: !!data,
            hasUserChatId: !!(data && data.userChatId),
            hasImageUrl: !!(data && data.imageUrl),
            hasUrl: !!(data && data.url)
        });
        return;
    }
    
    // Use either imageUrl or url for backward compatibility
    const imageUrl = data.imageUrl || data.url;
    const imageId = data.imageId || data.id;
    
    if (!imageId || sentImageIds.has(imageId)) {
        return;
    }
    
    const { 
        nsfw: imageNsfw = data.nsfw, 
        prompt: imagePrompt = data.prompt, 
        isUpscaled = data.isUpscaled, 
        isMergeFace = data.isMergeFace || data.isMerged 
    } = data;
    
    
    sentImageIds.add(imageId);

    const img = document.createElement('img');
    img.setAttribute('src', imageUrl);
    img.setAttribute('alt', data.title && data.title[lang] ? data.title[lang] : 'Generated Image');
    img.setAttribute('data-prompt', imagePrompt || '');
    img.setAttribute('class', 'm-auto');
    img.setAttribute('data-id', imageId);
    img.setAttribute('data-nsfw', imageNsfw || false);
    img.setAttribute('data-isUpscaled', !!isUpscaled);
    img.setAttribute('data-isMergeFace', !!isMergeFace);

    displayMessage('bot-image', img, data.userChatId);
};
