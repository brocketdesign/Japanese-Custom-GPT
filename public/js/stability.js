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

const sentImageIds = new Set();


window.generateImage = async function(data) {
    console.log('[generateImage] Called with data:', data);
    
    // Validate essential data
    if (!data || !data.userChatId) {
        console.error('[generateImage] ❌ Missing userChatId:', data);
        return;
    }

    // Check if this is a batched multi-image payload
    if (Array.isArray(data.images) && data.images.length > 0) {
        console.log(`[generateImage] 🎨 Processing batched payload: ${data.images.length} images`);
        
        // Check for duplicates
        const newImages = data.images.filter(img => {
            const id = img.imageId || img.id;
            return id && !sentImageIds.has(id);
        });
        
        if (newImages.length === 0) {
            console.log('[generateImage] ⚠️ All images already displayed, skipping');
            return;
        }
        
        console.log(`[generateImage] ✅ ${newImages.length} new images to display`);
        
        // Mark as sent
        newImages.forEach(img => {
            const id = img.imageId || img.id;
            if (id) {
                sentImageIds.add(id);
                console.log(`[generateImage] 📌 Marked image as sent: ${id}`);
            }
        });
        
        // Create unique swiper ID
        const uniqueSwiperId = `chat-swiper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[generateImage] 🔧 Creating swiper with ID: ${uniqueSwiperId}`);
        
        // Build swiper container
        const wrapper = document.createElement('div');
        wrapper.className = 'chat-image-swiper-wrapper';
        wrapper.setAttribute('data-user-chat-id', data.userChatId);
        wrapper.setAttribute('data-swiper-id', uniqueSwiperId);
        
        const swiperContainer = document.createElement('div');
        swiperContainer.id = uniqueSwiperId;
        swiperContainer.className = 'swiper';
        swiperContainer.style.maxWidth = '420px';
        swiperContainer.style.margin = '0 auto';
        
        const swiperWrapper = document.createElement('div');
        swiperWrapper.className = 'swiper-wrapper';
        
        // Add slides
        newImages.forEach((imgObj, idx) => {
            console.log(`[generateImage] 🖼️ Adding slide ${idx + 1}/${newImages.length}:`, imgObj.imageUrl);
            
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            
            const imgEl = document.createElement('img');
            imgEl.src = imgObj.imageUrl || imgObj.url;
            imgEl.alt = imgObj.title || 'Generated Image';
            imgEl.className = 'm-auto generated-multi-image';
            imgEl.setAttribute('data-id', imgObj.imageId || imgObj.id);
            imgEl.setAttribute('data-prompt', imgObj.prompt || '');
            imgEl.setAttribute('data-nsfw', imgObj.nsfw || false);
            imgEl.setAttribute('data-isMergeFace', imgObj.isMergeFace || false);
            imgEl.style.maxWidth = '100%';
            imgEl.style.height = 'auto';
            
            slide.appendChild(imgEl);
            swiperWrapper.appendChild(slide);
        });
        
        swiperContainer.appendChild(swiperWrapper);
        
        // Navigation buttons
        const prevButton = document.createElement('div');
        prevButton.className = 'swiper-button-prev';
        const nextButton = document.createElement('div');
        nextButton.className = 'swiper-button-next';
        swiperContainer.appendChild(prevButton);
        swiperContainer.appendChild(nextButton);
        
        // Pagination
        const pagination = document.createElement('div');
        pagination.className = 'swiper-pagination';
        swiperContainer.appendChild(pagination);
        
        wrapper.appendChild(swiperContainer);
        
        console.log('[generateImage] 📤 Passing wrapper to displayMessage');
        
        // Pass to displayMessage
        displayMessage('bot-image', wrapper, data.userChatId);
        
        // Add first image thumbnail
        if (newImages[0]) {
            const firstImgUrl = newImages[0].imageUrl || newImages[0].url;
            if (firstImgUrl) {
                console.log('[generateImage] 🖼️ Adding thumbnail for first image');
                displayImageThumb(firstImgUrl);
            }
        }
        
        console.log('[generateImage] ✅ Multi-image processing complete');
        return;
    }
    
    // Single image handling (legacy)
    console.log('[generateImage] 🖼️ Processing single image');
    
    const imageUrl = data.imageUrl || data.url;
    const imageId = data.imageId || data.id;
    
    if (!imageUrl || !imageId) {
        console.error('[generateImage] ❌ Missing imageUrl or imageId for single image');
        return;
    }
    
    if (sentImageIds.has(imageId)) {
        console.log('[generateImage] ⚠️ Image already displayed:', imageId);
        return;
    }
    
    sentImageIds.add(imageId);
    console.log(`[generateImage] 📌 Marked single image as sent: ${imageId}`);
    
    const { 
        nsfw: imageNsfw = data.nsfw, 
        prompt: imagePrompt = data.prompt, 
        isUpscaled = data.isUpscaled, 
        isMergeFace = data.isMergeFace || data.isMerged 
    } = data;
    
    const clientLang = window.lang || (window.user && window.user.lang) || 'en';
    const titleObj = data.title;
    const titleText =
      (titleObj && (titleObj[clientLang] || titleObj.en || titleObj.ja || titleObj.fr)) ||
      (typeof titleObj === 'string' ? titleObj : '') ||
      (data.prompt || '') ||
      'Generated Image';
    
    const img = document.createElement('img');
    img.setAttribute('src', imageUrl);
    img.setAttribute('alt', titleText);
    img.setAttribute('data-prompt', imagePrompt || '');
    img.setAttribute('class', 'm-auto');
    img.setAttribute('data-id', imageId);
    img.setAttribute('data-nsfw', imageNsfw || false);
    img.setAttribute('data-isUpscaled', !!isUpscaled);
    img.setAttribute('data-isMergeFace', !!isMergeFace);

    console.log('[generateImage] 📤 Passing single image to displayMessage');
    displayMessage('bot-image', img, data.userChatId);
    
    if (imageUrl) {
        console.log('[generateImage] 🖼️ Adding thumbnail for single image');
        displayImageThumb(imageUrl);
    }
    
    console.log('[generateImage] ✅ Single image processing complete');
};