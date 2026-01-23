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
            editPrompt = option.editPrompt || null,
            imagePrompt = option.imagePrompt || null,
            promptId = option.promptId || null,
            giftId = option.giftId || null,
            chatCreation = option.chatCreation || false,
            regenerate = option.regenerate || false,
            modelId = option.modelId || null,
            enableMergeFace = option.enableMergeFace || false,
            description = option.description || null,
            editStrength = option.editStrength || 'medium',
        } = option;

        let image_base64 = option.image_base64 || null
        if(file){
            image_base64 = await uploadAndConvertToBase64(file);
        }

        let newEditPrompt = editPrompt;

        
        // If both editPrompt and imagePrompt are provided, generate a new prompt
        if(editPrompt && imagePrompt){
            newEditPrompt = editPrompt + ', ' + imagePrompt;

            // [TEMPORARY DISABLE]
            if(false){
            // Fetch the new prompt from the editPrompt API
            const editResponse = await fetch('/api/edit-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imagePrompt, editPrompt })
            });
            const editData = await editResponse.json();
            if(editData.error){
                console.error('Error in fetching edited prompt:', editData.error);
                showNotification(editData.error, 'error');
                throw new Error(editData.error);
            }
            if(editData.newPrompt){
                console.log('Edited prompt received:', editData.newPrompt);
                newEditPrompt = editData.newPrompt;
            }}
        }

 
        const API_ENDPOINT = `${API_URL}/novita/generate-img`;
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title,
                prompt: newEditPrompt || prompt, 
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
                enableMergeFace,
                description,
                editStrength
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
        const existingElement = $(`#chat-thumbnail-gallery [data-id=${imageId}]`);
        existingElement.remove();
    } else {
        // Check if placeholder already exists
        const existingPlaceholder = $(`#chat-thumbnail-gallery [data-id=${imageId}]`);
        if (existingPlaceholder.length > 0) {
            return;
        }
        
        const loadingSpinerGif = "/img/image-placeholder.gif";
        const hasCustomPrompt = imagePreview && imagePreview.trim() !== '';
        const backgroundStyle = hasCustomPrompt 
            ? `background-image:url(${imagePreview});background-size:cover;` 
            : '';
        
        const card = $(`
            <div data-id="${imageId}" class="assistant-image-box card custom-card bg-transparent shadow-0 border-0 px-1 col-auto" style="cursor:pointer;">
                <div style="${backgroundStyle}" class="card-img-top rounded-avatar rounded-circle-button-size position-relative m-auto">
                    <img src="${loadingSpinerGif}" alt="Loading..." class="position-absolute top-50 start-50 translate-middle" style="z-index:2;${hasCustomPrompt ? 'opacity:0.8;' : ''}"/>
                </div>
            </div>
        `);
        
        $('#chat-thumbnail-gallery').append(card);
        $('#chat-thumbnail-gallery').scrollLeft($('#chat-thumbnail-gallery')[0].scrollWidth);
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
const trasckedImageTitles = new Set();

// Batch tracking for multi-image slider display
const imageBatches = new Map();
const BATCH_TIMEOUT = 30000; // 30 seconds timeout to wait for batch images

window.generateImage = async function(data, disableCompletion = false) {
    console.log('[generateImage] Called with data:', JSON.stringify({
        imageId: data?.imageId || data?.id,
        userChatId: data?.userChatId,
        isMergeFace: data?.isMergeFace,
        hasImageUrl: !!(data?.imageUrl || data?.url),
        batchId: data?.batchId,
        batchIndex: data?.batchIndex,
        batchSize: data?.batchSize
    }, null, 2));
    
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
    const checkImageExist = $(`.assistant-image-box[data-id='${imageId}']`);
    console.log(`[generateImage] Processing image with ID ${imageId} for chat ${data.userChatId}, isMergeFace: ${data.isMergeFace}`);
    if(!imageId || imageId === '' || imageId === null || imageId === undefined) {
        console.warn(`[generateImage] Invalid image ID for chat ${data.userChatId}`);
        return;
    }
    if ((!imageId || sentImageIds.has(imageId)) && checkImageExist.length) {
        console.warn(`[generateImage] Image with ID ${imageId} has already been sent to chat ${data.userChatId}`);
        return;
    }
    
    const { 
        nsfw: imageNsfw = data.nsfw, 
        prompt: imagePrompt = data.prompt, 
        isUpscaled = data.isUpscaled, 
        isMergeFace = data.isMergeFace || data.isMerged,
        batchId = null,
        batchIndex = 0,
        batchSize = 1
    } = data;
    
    const clientLang = window.lang || (window.user && window.user.lang) || 'en';
    const titleObj = data.title;
    const titleText =
      (titleObj && (titleObj[clientLang] || titleObj.en || titleObj.ja || titleObj.fr)) ||
      (typeof titleObj === 'string' ? titleObj : '') ||
      (data.prompt || '') ||
      'Generated Image';
    
    sentImageIds.add(imageId);

    // Create image data object
    const imageData = {
        imageId,
        imageUrl,
        titleText,
        imagePrompt,
        imageNsfw,
        isUpscaled,
        isMergeFace,
        userChatId: data.userChatId,
        batchIndex
    };

    // Handle batched images for slider display
    if (batchId && batchSize > 1) {
        console.log(`[generateImage] Batched image ${batchIndex + 1}/${batchSize} for batch ${batchId}`);
        
        if (!imageBatches.has(batchId)) {
            // Initialize batch tracker
            imageBatches.set(batchId, {
                images: [],
                expectedSize: batchSize,
                userChatId: data.userChatId,
                timeout: setTimeout(() => {
                    // Timeout handler: display whatever we have
                    const batch = imageBatches.get(batchId);
                    if (batch && batch.images.length > 0) {
                        console.log(`[generateImage] Batch ${batchId} timeout - displaying ${batch.images.length}/${batch.expectedSize} images`);
                        displayBatchedImages(batch);
                        imageBatches.delete(batchId);
                    }
                }, BATCH_TIMEOUT)
            });
        }
        
        const batch = imageBatches.get(batchId);
        batch.images.push(imageData);
        
        // Check if batch is complete
        if (batch.images.length >= batch.expectedSize) {
            console.log(`[generateImage] Batch ${batchId} complete - displaying ${batch.images.length} images in slider`);
            clearTimeout(batch.timeout);
            displayBatchedImages(batch);
            imageBatches.delete(batchId);
        }
    } else {
        // Single image - display immediately using existing logic
        displaySingleImage(imageData, disableCompletion);
    }
};

// Display a single image (original behavior)
function displaySingleImage(imageData, disableCompletion = false) {
    const { imageId, imageUrl, titleText, imagePrompt, imageNsfw, isUpscaled, isMergeFace, userChatId } = imageData;
    
    const img = document.createElement('img');
    img.setAttribute('src', imageUrl);
    img.setAttribute('alt', titleText);
    img.setAttribute('data-prompt', imagePrompt || '');
    img.setAttribute('class', 'm-auto');
    img.setAttribute('data-id', imageId);
    img.setAttribute('data-nsfw', imageNsfw || false);
    img.setAttribute('data-isUpscaled', !!isUpscaled);
    img.setAttribute('data-isMergeFace', !!isMergeFace);

    displayMessage('bot-image', img, userChatId);

    // Check if the image has been added successfully
    setTimeout(() => {
        const addedImage = $(`img[data-id='${imageId}']`);
        if (!addedImage.length) {
            console.warn(`[generateImage] Failed to add image with ID ${imageId} to chat ${userChatId}`);
        }
    }, 1000);

    if(!trasckedImageTitles.has(titleText)){
        trasckedImageTitles.add(titleText);
        if(!disableCompletion){
            generateChatCompletion(null, false, true);
        }
    }
}

// Display batched images in a slider
function displayBatchedImages(batch) {
    const { images, userChatId } = batch;
    
    if (images.length === 0) return;
    
    // Sort images by their batch index
    images.sort((a, b) => a.batchIndex - b.batchIndex);
    
    // Use first image for the main message context
    const firstImage = images[0];
    
    // Create the slider container
    displayMessage('bot-image-slider', images, userChatId);
    
    // Trigger chat completion only once for the batch
    if (!trasckedImageTitles.has(firstImage.titleText)) {
        trasckedImageTitles.add(firstImage.titleText);
        generateChatCompletion(null, false, true);
    }
}
