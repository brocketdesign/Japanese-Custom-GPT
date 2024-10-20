// =========================
// Enhanced Image Generation with Novita
// =========================
window.checkImageDescription = async function(chatId = null) {
    if (!chatId) {
        console.error('checkImageDescription Error: chatId is required.');
        return { error: 'Abort' };
    }

    const imageDescription = $('#image_description').val();

    if (imageDescription) {
        console.log('Existing image description found.', imageDescription);
        return { description: imageDescription };
    }

    try {
        const response = await fetch(`/api/check-image-description?chatId=${chatId}`, {
            method: 'GET',
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('checkImageDescription Error:', error);
        return { error: 'Failed to check image description.' };
    }
};

  

// Create System Payload for Image Description
function createSystemPayloadImage(language) {
  console.log('createSystemPayloadImage called with language:', language);
  return [
      {
          "type": "text",
          "text": `
              You generate a highly detailed character face description from the image provided. 
              Your response contains the character's age, skin color, hair, eyes, body type, gender, facial features. 
              Respond in a single, descriptive line of plain text using keywords.\n
              Example: young girl, yellow eyes, long hair, white hair, white skin, voluptuous body, cute face, smiling.
          `
      }
  ];
}

// Generate Image Description Backend using Novita
window.generateImageDescriptionBackend = function(imageUrl = null, chatId, callback) {
  console.log('generateImageDescriptionBackend called with imageUrl:', imageUrl, 'chatId:', chatId);
  
  imageUrl = imageUrl ? imageUrl : $('#chatImageUrl').val();
  console.log('Final imageUrl after DOM retrieval:', imageUrl);
  
  const language = $('#language').val() || 'japanese';
  console.log('Language selected:', language);

  if (!imageUrl && !chatId) {
      console.error('generateImageDescriptionBackend Error: Image URL or chatId must be provided.');
      callback({ error: 'Image URL or chatId is required.' });
      return;
  }

  const system = createSystemPayloadImage(language);
  console.log('System payload for image description:', system);
  
  const apiUrl = '/api/openai-image-description'; // Verify if this is the correct Novita endpoint
  console.log('API URL for image description:', apiUrl);

  $.ajax({
      url: apiUrl,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ system, imageUrl, chatId }),
      success: function(response) {
          console.log('generateImageDescriptionBackend Success:', response);
          if (callback) {
              callback(response);
          }
      },
      error: function(xhr, status, error) {
          console.error('generateImageDescriptionBackend Error:', status, error, xhr);
          if (callback) {
              callback({ error: 'Failed to generate image description.' });
          }
      }
  });
}

// Generate Image using Novita
window.generateImageNovita = async function(API_URL, userId, chatId, userChatId, item_id, thumbnail, imageType, option = {}) {
    const imageResponseContainer = $(`
        <div id="load-image-container" class="d-flex flex-column justify-content-start">
            <div class="d-flex flex-row justify-content-start mb-4 message-container" style="border-radius: 15px;">
                <img src="${thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="width: 45px; height: 45px; object-fit: cover; object-position: top;">
                <div class="d-flex justify-content-center align-items-center px-3">
                    <img src="/img/image-placeholder.gif" width="50px" alt="loading">
                </div>
            </div>
        </div>
    `);

    $('#chatContainer').append(imageResponseContainer);
    $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);

    if (!item_id) {
        $('#load-image-container').remove();
        showNotification('無効なアイテムIDです。', 'error');
        return;
    }

    try {
        const proposal = await getProposalById(item_id);
        const {
            negativePrompt = $('#negativePrompt-input').val(),
            prompt = proposal.description || $('#prompt-input').val(),
            aspectRatio = '9:16',
            baseFace = null
        } = option;

        if (!prompt) {
            console.error('generateImageNovita Error: Prompt is required.');
            showNotification('画像生成に必要なプロンプトがありません。', 'error');
            $('#load-image-container').remove();
            return;
        }

        const API_ENDPOINT = `${API_URL}/novita/product2img`;

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: prompt, 
                aspectRatio: aspectRatio, 
                userId: userId, 
                chatId: chatId, 
                userChatId: userChatId,
                imageType: imageType
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Fetch response not ok. Status:', response.status, response.statusText, 'Response text:', errorText);
            throw new Error(`ネットワークエラー (${response.status} ${response.statusText}): ${errorText}`);
        }

        const data = await response.json();
        const { taskId } = data;

        if (!taskId) {
            throw new Error('サーバーからタスクが返されませんでした。');
        }

        pollTaskStatus(API_URL, taskId, imageType, prompt);

    } catch (error) {
        console.error('generateImageNovita Error:', error);
        console.log(`画像生成エラー: ${error.message}`);
        window.postMessage({ event: 'imageError', error: error.message }, '*');
        $('#load-image-container').remove();
        showNotification('画像の生成中にエラーが発生しました。', 'error');
    }
}

const displayedImageIds = new Set();

// Function to poll the task status
function pollTaskStatus(API_URL, taskId, type, prompt) {
    const POLLING_INTERVAL = 30000; // 3 seconds
    const MAX_ATTEMPTS = 60;
    let attempts = 0;

    const intervalId = setInterval(async () => {
        attempts++;
        try {
            const statusResponse = await fetch(`${API_URL}/novita/task-status/${taskId}`);
            
            if (!statusResponse.ok) {
                const errorText = await statusResponse.text();
                throw new Error(`ステータスチェックに失敗しました: ${errorText}`);
            }

            const statusData = await statusResponse.json();
            //console.log(`Polling task status for ${type}:`, statusData);

            if (statusData.status === 'completed') {
                clearInterval(intervalId);
                const { imageId, imageUrl } = statusData.images[0];

                if (!displayedImageIds.has(imageId)) {
                    // Use the provided generateImage function to display the image
                    generateImage({
                        url: imageUrl,
                        id: imageId,
                        prompt: prompt,
                        nsfw: type === 'nsfw'
                    }, prompt);

                    // Add imageId to the set
                    displayedImageIds.add(imageId);

                    showNotification(`${type.toUpperCase()} 画像が正常に生成されました。`, 'success');
                    if(type === 'nsfw' ){
                        $('#load-image-container').find('.message-container').last().remove();
                    } else {
                        $('#load-image-container').find('.message-container').first().remove();
                    }
                    if($('#load-image-container').find('.message-container').length == 0){
                        $('#load-image-container').remove()
                    }
                } else {
                    console.log(`Image ${imageId} has already been displayed.`);
                }
            } else if (statusData.status === 'failed') {
                clearInterval(intervalId);
            } else {
                console.log('タスクはまだ処理中です...');
                if(type === 'nsfw' ){
                    window.postMessage({ event: 'imageStart', message: '[Hidden] Image generation is still processing...' }, '*');
                }
            }

            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(intervalId);
                showNotification('画像の生成がタイムアウトしました。再試行してください。', 'error');
            }

        } catch (error) {
            console.error(`Error polling task status for ${type}:`, error);
            clearInterval(intervalId);
        }
    }, POLLING_INTERVAL);
}



// Fetch Proposal by ID
function getProposalById(id) {
  //console.log('getProposalById called with id:', id);
  return new Promise((resolve, reject) => {
      $.ajax({
          url: `/api/proposal/${id}`,
          method: 'GET',
          success: function(data) {
              //console.log('getProposalById Success:', data);
              resolve(data);
          },
          error: function(err, status, error) {
              console.error('getProposalById Error:', status, error, err);
              reject(new Error('Failed to fetch proposal.'));
          }
      });
  });
}
let messCt = 0;
const sentImageIds = new Set();

window.generateImage = async function(data, prompt) {
  if (!data || !data.url || !data.id || !data.prompt || sentImageIds.has(data.id)) return;

  const { url: imageUrl, id: imageId, nsfw: imageNsfw } = data;
  sentImageIds.add(imageId);

  const img = document.createElement('img');
  img.setAttribute('src', imageUrl);
  img.setAttribute('alt', prompt);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id', imageId);

  try {
    const user = await fetchUser();
    const subscriptionStatus = user.subscriptionStatus === 'active';
    displayMessage('bot-image', img);
    /*
    if (imageNsfw && !subscriptionStatus) {
      window.postMessage({ event: 'imageNsfw' }, '*');
      displayMessage('bot-image-nsfw', img);
      showNotification('この画像はNSFWコンテンツです。サブスクリプションが必要です。', 'warning');
    } else {
      displayMessage('bot-image', img);
    }
    */

    if (messCt == 1) {
        setTimeout(() => {
            window.postMessage({ event: 'imageDone' }, '*');
        }, 1000);
    }else{
        messCt = messCt < 1 ? messCt + 1 : messCt
    }
  } catch (error) {
    showNotification('ユーザー情報の取得に失敗しました。', 'error');
  }
};
function controlImageGen(API_URL, userId, chatId, userChatId, thumbnail, id, isNSFWChecked) {
    const t = window.translations.imageForm;
    const SFW_PRICE = 10;
    const NSFW_PRICE = 20;

    $.ajax({
        url: '/api/prompts/' + id,
        type: 'GET',
        success: async function(promptData) {
            const prompt_title = promptData.title;
            const prompt = promptData.prompt;

            const formType = isNSFWChecked ? 'nsfw' : 'sfw';
            const price = isNSFWChecked ? NSFW_PRICE : SFW_PRICE;

            let imageDescription = '';
            try {
                const descriptionResponse = await checkImageDescription(chatId);
                imageDescription = descriptionResponse.imageDescription || '';
            } catch (error) {
                showNotification(t['imageDescriptionError'], 'error');
                return;
            }

            const finalPrompt = imageDescription ? `${imageDescription}, ${prompt}` : prompt;

            //showNotification(t['imageGenerationStarted'], 'success');

            // Display the choice and cost in the user message
            const typeText = isNSFWChecked ? 'NSFW' : 'SFW';
            const userMessage = t['imagePurchaseMessage']
                .replace('{type}', typeText)
                .replace('{price}', price)
                .replace('{prompt_title}', prompt_title);

            const userPromptElement = $(`
                <div class="d-flex flex-row justify-content-end mb-4 message-container user">
                    <div class="d-flex flex-column align-items-end">
                        <div class="text-start p-2 rounded" style="border-radius: 15px; background-color: #fbfbfbdb;">
                            ${userMessage}
                        </div>
                    </div>
                </div>
            `);
            $('#chatContainer').append(userPromptElement);

            const loaderElement = $(`
                <div class="d-flex flex-row justify-content-start mb-4 message-container assistant animate__animated animate__fadeIn">
                    <img src="${thumbnail || '/img/default-avatar.png'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="width: 45px; height: 45px; object-fit: cover; object-position: top;">
                    <div class="d-flex justify-content-center align-items-center px-3">
                        <img src="/img/image-placeholder.gif" width="50px" alt="loading">
                    </div>
                </div>
            `);
            $('#chatContainer').append(loaderElement);
            $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);

            const hiddenMessage = `[Hidden] I just sent you ${price} coins for an image : ${prompt_title}. The image is currently being generated; I will tell you when it is available. Your answer must not start with [Hidden] .`;
            window.postMessage({ event: 'imageStart', message: hiddenMessage }, '*');

            try {
                const response = await $.ajax({
                    url: API_URL + '/novita/txt2img',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        prompt: finalPrompt,
                        aspectRatio: '9:16',
                        userId: userId,
                        chatId: chatId,
                        userChatId: userChatId,
                        imageType: formType,
                        price: price
                    })
                });

                if (!response.taskId) {
                    throw new Error(t['imageGenerationError']);
                }

                updateCoins();

                checkTaskStatus(response.taskId, chatId, finalPrompt, () => {
                    loaderElement.remove();
                });
            } catch (error) {
                showNotification(error.message || t['imageGenerationError'], 'error');
                loaderElement.remove();
            }
        },
        error: function(xhr) {
            showNotification('プロンプトの取得中にエラーが発生しました。', 'error');
        }
    });
}

/**
 * Displays a SweetAlert2 popup with a textarea for the user to input a custom prompt.
 * Uses Bootstrap 5 for styling, SweetAlert2 for the modal, and Animate.css for animations.
 * @param {string} API_URL - The backend API URL for image generation.
 * @param {string} userId - The ID of the user.
 * @param {string} chatId - The ID of the chat.
 * @param {string} userChatId - The user's chat ID.
 * @param {string} thumbnail - URL of the avatar thumbnail.
 */
function displayCustomPromptInput(API_URL, userId, chatId, userChatId, thumbnail) {
    const t = window.translations.imageForm;
    const SFW_PRICE = 10;
    const NSFW_PRICE = 20;

    Swal.fire({
        html: `
            <textarea id="customPromptInput" class="form-control mt-5" rows="4" placeholder="${t['promptPlaceholder']}"></textarea>
            <div class="form-check mt-3 text-start">
                <input class="form-check-input" type="checkbox" value="" id="nsfwCheck">
                <label class="form-check-label" for="nsfwCheck">
                    ${t['generateNSFW']}
                </label>
            </div>
        `,
        showCancelButton: false,
        showCloseButton: true,
        confirmButtonText: t['generateImages'],
        showClass: { popup: 'animate__animated animate__slideInUp animate__faster' },
        hideClass: { popup: 'animate__animated animate__slideOutDown animate__faster' },
        position: 'bottom', backdrop: 'rgba(43, 43, 43, 0.2)',
        customClass: { container: 'p-0', popup: 'custom-prompt-container shadow', closeButton: 'position-absolute' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const prompt = $('#customPromptInput').val().trim();
            const isNSFW = $('#nsfwCheck').is(':checked');

            if (!prompt) {
                showNotification(t['promptRequired'], 'error');
                return;
            }

            const formType = isNSFW ? 'nsfw' : 'sfw';
            const price = isNSFW ? NSFW_PRICE : SFW_PRICE;

            let imageDescription = '';
            try {
                const descriptionResponse = await checkImageDescription(chatId);
                imageDescription = descriptionResponse.imageDescription || '';
            } catch (error) {
                showNotification(t['imageDescriptionError'], 'error');
                return;
            }

            const finalPrompt = imageDescription ? `${imageDescription}, ${prompt}` : prompt;

            showNotification(t['imageGenerationStarted'], 'success');

            const userPromptElement = $(`
                <div class="d-flex flex-row justify-content-end mb-4 message-container user">
                    <div class="d-flex flex-column align-items-end">
                        <div class="text-start p-2 rounded" style="border-radius: 15px; background-color: #fbfbfbdb;">
                            ${prompt}
                        </div>
                    </div>
                </div>
            `);
            $('#chatContainer').append(userPromptElement);

            const loaderElement = $(`
                <div class="d-flex flex-row justify-content-start mb-4 message-container assistant animate__animated animate__fadeIn">
                    <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="width: 45px; height: 45px; object-fit: cover; object-position: top;">
                    <div class="d-flex justify-content-center align-items-center px-3">
                        <img src="/img/image-placeholder.gif" width="50px" alt="loading">
                    </div>
                </div>
            `);
            $('#chatContainer').append(loaderElement);
            $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);

            const hiddenMessage = `[Hidden] I just sent you ${price} coins for an image.I have specified a prompt for the images. The images are not available yet; I will tell you when they are available. Your answer must not start with [Hidden] .`;
            window.postMessage({ event: 'imageStart', message: hiddenMessage }, '*');
            //window.postMessage({ event: 'displayMessage', role:'user' message: '', completion : false }, '*');
            try {
                const response = await $.ajax({
                    url: API_URL + '/novita/txt2img',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        prompt: finalPrompt,
                        aspectRatio: '9:16',
                        userId: userId,
                        chatId: chatId,
                        userChatId: userChatId,
                        imageType: formType,
                        price: price
                    })
                });

                if (!response.taskId) {
                    throw new Error(t['imageGenerationError']);
                }

                updateCoins();

                checkTaskStatus(response.taskId, chatId, finalPrompt, () => {
                    loaderElement.remove();
                });

            } catch (error) {
                console.error('Error generating images:', error);
                showNotification(error.message || t['imageGenerationError'], 'error');
                loaderElement.remove();
            }
        }
    });
}

/**
 * Function to display the advanced image generation form with Bootstrap 5 nav tabs for SFW and NSFW.
 * @param {string} API_URL - The backend API URL for image generation.
 * @param {string} userId - The ID of the user.
 * @param {string} chatId - The ID of the chat.
 * @param {string} userChatId - The user's chat ID.
 * @param {string} thumbnail - URL of the avatar thumbnail.
 * @param {function} callback - Optional callback function after form is displayed.
 */
const t = window.translations.imageForm;

window.displayAdvancedImageGenerationForm = function(API_URL, userId, chatId, userChatId, thumbnail, callback) {
    const animationClass = 'animate__animated animate__fadeIn';
    const uniqueId = `advanced-image-generation-form-${Date.now()}`;

    // Prices for SFW and NSFW images
    const SFW_PRICE = 35;
    const NSFW_PRICE = 75;

    // Generate the initial form with Bootstrap 5 nav tabs
    const initialFormElement = $(`
        <div id="${uniqueId}-initial" class="advanced-image-generation-initial-form ${animationClass}" style="width: 100%; padding: 20px; background-color: #f9f9f9; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h4 class="mb-4">${t['imageGenerationForm']}</h4>

            <!-- Bootstrap 5 Nav Tabs -->
            <ul class="nav nav-tabs mb-3" id="${uniqueId}-tab" role="tablist">
                <li class="d-none nav-item" role="presentation">
                    <button class="nav-link " id="${uniqueId}-sfw-tab" data-bs-toggle="tab" data-bs-target="#${uniqueId}-sfw" type="button" role="tab" aria-controls="${uniqueId}-sfw" aria-selected="true">${t['sfwImage']} (${SFW_PRICE} ${t['coins']})</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="${uniqueId}-nsfw-tab" data-bs-toggle="tab" data-bs-target="#${uniqueId}-nsfw" type="button" role="tab" aria-controls="${uniqueId}-nsfw" aria-selected="false">${t['nsfwImage']} (${NSFW_PRICE} ${t['coins']})</button>
                </li>
            </ul>

            <!-- Tab Panes -->
            <div class="tab-content" id="${uniqueId}-tabContent">
                <!-- SFW Form Tab Pane -->
                <div class="d-none tab-pane fade  " id="${uniqueId}-sfw" role="tabpanel" aria-labelledby="${uniqueId}-sfw-tab">
                    ${generateSFWForm(uniqueId)}
                </div>
                <!-- NSFW Form Tab Pane -->
                <div class="tab-pane fade show active" id="${uniqueId}-nsfw" role="tabpanel" aria-labelledby="${uniqueId}-nsfw-tab">
                    ${generateNSFWForm(uniqueId,{ userId, chatId, userChatId })}
                </div>
            </div>
        </div>
    `).show();

    // Append the initial form to the chat as a single message
    const messageElement = $(`
        <div class="d-flex flex-row justify-content-start mb-4 message-container assistant ${animationClass}">
            <img src="${thumbnail || 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%; object-fit: cover; object-position: top;">
            <div class="ms-3" style="width: 100%;">
                ${initialFormElement.prop('outerHTML')}
            </div>
        </div>
    `).hide();

    $('#chatContainer').append(messageElement);
    messageElement.fadeIn();

    // Setup event listeners for both SFW and NSFW forms
    setupFormEventListeners(uniqueId, 'sfw', { userId, chatId, userChatId });
    setupFormEventListeners(uniqueId, 'nsfw', { userId, chatId, userChatId });

    if (typeof callback === 'function') {
        callback();
    }
};

/**
 * Sets up event listeners for a given form (SFW or NSFW).
 * @param {string} uniqueId - The unique identifier for the form.
 * @param {string} formType - The type of form ('sfw' or 'nsfw').
 * @param {object} config - Configuration object containing necessary parameters.
 */
async function setupFormEventListeners(uniqueId, formType, config) {
    const t = window.translations.imageForm;
    const SFW_PRICE = 35;
    const NSFW_PRICE = 75;

    // Define selectors based on formType
    const formSelector = `#${uniqueId}-${formType}-form`;

    // Event listener for selectable options
    $(`${formSelector} .selectable-option`).on('click', function() {
        const categoryClasses = $(this).attr('class').split(' ')[0]
        $(`${formSelector} .${categoryClasses}`).removeClass('selected').addClass('unselect');
        $(this).addClass('selected').removeClass('unselect');
    });


    // Event listener for generate button
    $(`${formSelector} .btn-primary`).on('click', async function() {
        // Get all selected options within the form
        const selectedOptions = $(`${formSelector} .selectable-option.selected`);

        if (selectedOptions.length < 2) {
            showNotification(t['selectAtLeastTwoOptions'] || 'Please select at least two options.', 'error');
            return;
        }

        // Generate the prompt from the data-value of the selected options
        let promptParts = [];
        selectedOptions.each(function() {
            const value = $(this).data('value');
            if (value) {
                promptParts.push(value);
            }
        });

        // Combine the prompt parts into a single prompt string
        let prompt = promptParts.join(', ');

        // Determine the price based on image type
        const price = formType === 'sfw' ? SFW_PRICE : NSFW_PRICE;

        // Fetch the character description
        const { imageDescription } = await checkImageDescription(config.chatId);

        // Include imageDescription in the prompt
        prompt = `${imageDescription}, ${prompt}`;

        // Prepare data to send to the backend
        const requestData = {
            prompt: prompt,
            aspectRatio: '9:16',
            userId: config.userId,
            chatId: config.chatId,
            userChatId: config.userChatId,
            imageType: formType,
            price: price
        };

        // Show spinner and hide the generate button
        $(`${formSelector} .btn-primary`).prop('disabled', true).hide();
        $(`${formSelector} .spinner`).show();

        // Send hidden message to the AI character
        const hiddenMessage = `[Hidden] I just sent you ${price} coins for images about: ${prompt}. 
        The images are not available yet; I will tell you when they are available.`;
        window.postMessage({ event: 'imageStart', message: hiddenMessage }, '*');

        // Send request to the backend to generate images
        try {
            const response = await $.ajax({
                url: '/novita/txt2img',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData)
            });

            if (!response.taskId) {
                throw new Error(t['imageGenerationError']);
            }

            updateCoins();

            // Image generation task started, use task ID to poll for status
            const taskId = response.taskId;
            showNotification(t['imageGenerationStarted'], 'success');

            // Use the existing checkTaskStatus function to poll for the task status
            checkTaskStatus(taskId, config.chatId, prompt, function() {
                // Hide spinner and show the generate button when done
                $(`${formSelector} .spinner`).hide();
                $(`${formSelector} .btn-primary`).prop('disabled', false).show();
            });

        } catch (error) {
            console.error('Error generating images:', error);
            showNotification(error.message || t['imageGenerationError'], 'error');
            // Hide spinner and show the generate button on error
            $(`${formSelector} .spinner`).hide();
            $(`${formSelector} .btn-primary`).prop('disabled', false).show();
        }
    });
}

/**
 * Generates the HTML for the SFW form.
 * @param {string} uniqueId - The unique identifier for the form.
 * @returns {string} - The HTML string for the SFW form.
 */
function generateSFWForm(uniqueId) {
    const t = window.translations.imageForm;
    return `
        <div id="${uniqueId}-sfw-form" class="advanced-image-generation-form">
            <!-- Character Selection (Exclusively Female) -->
            <div class="mb-4">
                <label class="form-label"><strong>${t['selectCharacter']}</strong></label>
                <div class="d-flex flex-wrap">
                    <!-- Only Female Character Options -->
                    <div class="me-3 mb-3 text-start">
                        <span class="character-option selectable-option" data-value="young girl character, age 18">${t['characterGirl']}</span>
                    </div>
                    <div class="me-3 mb-3 text-start">
                        <span class="character-option selectable-option" data-value="adult woman character, age 25-30">${t['characterWoman']}</span>
                    </div>
                    <!-- Add more female character options here if needed -->
                </div>
            </div>
            
            <!-- Body Type Selection -->
            <div class="mb-4">
                <label class="form-label"><strong>${t['selectBodyType']}</strong></label>
                <div class="d-flex flex-wrap">
                    <div class="me-3 mb-3 text-start">
                        <span class="body-option selectable-option" data-value="athletic body, toned muscles">${t['bodyAthletic']}</span>
                    </div>
                    <div class="me-3 mb-3 text-start">
                        <span class="body-option selectable-option" data-value="slim body, slender frame">${t['bodySlim']}</span>
                    </div>
                    <!-- Add more body options here -->
                </div>
            </div>
            
            <!-- Pose Selection -->
            <div class="mb-4">
                <label class="form-label"><strong>${t['selectPose']}</strong></label>
                <div class="d-flex flex-wrap">
                    <div class="me-3 mb-3 text-start">
                        <span class="pose-option selectable-option" data-value="sitting in meditation pose">${t['poseMeditating']}</span>
                    </div>
                    <div class="me-3 mb-3 text-start">
                        <span class="pose-option selectable-option" data-value="performing a cartwheel">${t['poseCartwheel']}</span>
                    </div>
                    <!-- Add more pose options here -->
                </div>
            </div>
            
            <!-- Action Selection -->
            <div class="mb-4">
                <label class="form-label"><strong>${t['selectAction']}</strong></label>
                <div class="d-flex flex-wrap">
                    <div class="me-3 mb-3 text-start">
                        <span class="action-option selectable-option" data-value="singing into a microphone">${t['actionSinging']}</span>
                    </div>
                    <div class="me-3 mb-3 text-start">
                        <span class="action-option selectable-option" data-value="painting a canvas">${t['actionPainting']}</span>
                    </div>
                    <!-- Add more action options here -->
                </div>
            </div>
            
            <!-- Clothes Selection -->
            <div class="mb-4">
                <label class="form-label"><strong>${t['selectClothes']}</strong></label>
                <div class="d-flex flex-wrap">
                    <div class="me-3 mb-3 text-start">
                        <span class="clothes-option selectable-option" data-value="wearing a dress">${t['clothesDress']}</span>
                    </div>
                    <div class="me-3 mb-3 text-start">
                        <span class="clothes-option selectable-option" data-value="wearing a suit">${t['clothesSuit']}</span>
                    </div>
                    <!-- Add more clothes options here -->
                </div>
            </div>
            
            <!-- Facial Expression Selection -->
            <div class="mb-4">
                <label class="form-label"><strong>${t['selectFacialExpression']}</strong></label>
                <div class="d-flex flex-wrap">
                    <div class="me-3 mb-3 text-start">
                        <span class="expression-option selectable-option" data-value="happy facial expression, smiling">${t['expressionHappy']}</span>
                    </div>
                    <div class="me-3 mb-3 text-start">
                        <span class="expression-option selectable-option" data-value="sad facial expression, frowning">${t['expressionSad']}</span>
                    </div>
                    <!-- Add more expression options here -->
                </div>
            </div>
            
            <!-- Generate Button -->
            <div class="text-center">
                <button id="${uniqueId}-generate-btn-sfw" class="btn btn-primary">${t['generateImages']}</button>
            </div>
            
            <!-- Spinner (Initially Hidden) -->
            <div id="${uniqueId}-spinner-sfw" class="spinner" style="display: none; text-align: center; margin-top: 20px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">${t['loading']}</span>
                </div>
                <div>${t['generatingImages']}</div>
            </div>
        </div>
    `;
}

/**
 * Generates the NSFW form by fetching categories from the API and updating the form dynamically.
 */
function generateNSFWForm(uniqueId,config) {
    const { userId, chatId, userChatId } = config
    const t = window.translations.imageForm;
    const formSelector = `#${uniqueId}-nsfw`; // Selector for the NSFW tab pane

    // Placeholder content while data is being fetched
    $(`${formSelector}`).html(`
        <div class="text-center my-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">${t['loading']}</span>
            </div>
            <div>${t['loadingCategories']}</div>
        </div>
    `);

    // Fetch categories from the API
    $.get('/api/categories', function(categories) {
        // Build the form content
        let formContent = `
            <div id="${uniqueId}-nsfw-form" class="advanced-image-generation-form">
                <!-- Dynamic Categories -->
                ${buildCategoriesContent(categories)}
                <!-- Generate Button -->
                <div class="text-center">
                    <button id="${uniqueId}-generate-btn-nsfw" class="btn btn-primary">${t['generateImages']}</button>
                </div>
                <!-- Spinner (Initially Hidden) -->
                <div id="${uniqueId}-spinner-nsfw" class="spinner" style="display: none; text-align: center; margin-top: 20px;">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">${t['loading']}</span>
                    </div>
                    <div>${t['generatingImages']}</div>
                </div>
            </div>
        `;

        // Update the NSFW tab pane with the form content
        $(`${formSelector}`).html(formContent);

        // Setup event listeners for the dynamically generated content
        setupFormEventListeners(uniqueId, 'nsfw', { userId, chatId, userChatId });
    }).fail(function(error) {
        // Handle errors
        $(`${formSelector}`).html(`
            <div class="alert alert-danger" role="alert">
                ${t['categoriesLoadError']}
            </div>
        `);
    });
}

/**
 * Builds the HTML content for categories, subcategories, and tags.
 */
function buildCategoriesContent(categories) {
    let content = '';

    categories.forEach(category => {
        content += `
            <div class="mb-4">
                <label class="form-label"><strong>${category.name_JP || category.name}</strong></label>
                <div class="d-flex flex-wrap">
        `;

        // Iterate over subcategories
        category.subcategories.forEach(subcategory => {
            content += `
                <div class="me-3 mb-3 text-start w-100">
                    <span class="subcategory-option" data-value="${subcategory.name}">${subcategory.name_JP || subcategory.name}</span>
                </div>
            `;

            // Iterate over tags within each subcategory
            subcategory.tags.forEach(tag => {
                content += `
                    <div class="me-3 mb-3 text-center">
                        <span class="tag-option-${category.name} selectable-option" data-value="${tag.name}">${tag.name_JP || tag.name}</span>
                    </div>
                `;
            });
        });

        content += `
                </div>
            </div>
        `;
    });

    return content;
}


/**
 * Sets up CSS styles for selectable options.
 */
(function setupSelectableOptionStyles() {
    const styles = `
        .selectable-option {
            display: inline-block;
            padding: 10px 15px;
            font-size: 18px;
            cursor: pointer;
            border: 1px solid #ccc;
            border-radius: 5px;
            margin-right: 10px;
            margin-bottom: 10px;
            transition: background-color 0.3s, color 0.3s;
        }
        .selectable-option.selected {
            background-color: #007bff;
            color: #fff;
            border-color: #007bff;
        }
        .selectable-option.unselect{
            background-color: #e6e6e6;
            color: #000;
            border-color: #fff;
        }
        /* Optional: Add hover effects */
        .selectable-option:hover {
            background-color: #e6e6e6;
        }
    `;
    $('<style>').text(styles).appendTo('head');
})();

/**
 * Polls the backend for the status of an image generation task.
 */
function checkTaskStatus(taskId, chatId, prompt, callback) {
    const POLLING_INTERVAL = 30000; // 10 seconds
    const MAX_ATTEMPTS = 30;
    let attempts = 0;

    const intervalId = setInterval(async () => {
        attempts++;
        try {
            const statusResponse = await $.ajax({
                url: `/novita/task-status/${taskId}`,
                method: 'GET',
                dataType: 'json'
            });

            if (statusResponse.status === 'completed') {
                clearInterval(intervalId);
                const images = statusResponse.images;

                // Display the generated images
                displayGeneratedImages(images);

                showNotification(t['imagesGeneratedSuccessfully'], 'success');

                // Send a hidden message to the AI character
                window.postMessage({ event: 'imageDone' }, '*');

                // Execute callback after completion
                if (typeof callback === 'function') {
                    callback();
                }

            } else if (statusResponse.status === 'failed') {
                clearInterval(intervalId);
                showNotification(`${t['imageGenerationFailed']}: ${statusResponse.error}`, 'error');

                // Execute callback on failure
                if (typeof callback === 'function') {
                    callback();
                }
            } else {
                console.log('Image generation is still processing...');
                window.postMessage({ event: 'imageStart', message: '[Hidden] Image generation is still processing...' }, '*');
            }

            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(intervalId);
                showNotification(t['imageGenerationTimeout'], 'error');

                // Execute callback on timeout
                if (typeof callback === 'function') {
                    callback();
                }
            }

        } catch (error) {
            console.error('Error polling task status:', error);
            clearInterval(intervalId);
            showNotification(t['imageGenerationError'], 'error');

            // Execute callback on error
            if (typeof callback === 'function') {
                callback();
            }
        }
    }, POLLING_INTERVAL);
}

/**
 * Displays the generated images in the chat.
 * @param {Array} images - Array of image objects containing imageUrl and imageId.
 */
function displayGeneratedImages(images) {
    images.forEach(function(imageData) {
        const imageUrl = imageData.imageUrl;
        const imageId = imageData.imageId;

        const imgElement = new Image();
        imgElement.src = imageUrl;
        imgElement.alt = imageData.prompt || '';
        imgElement.setAttribute('data-id', imageId);
        imgElement.setAttribute('class', 'm-auto');
        imgElement.style.borderRadius = '10px';

        // Determine message class based on NSFW flag if needed
        const messageClass = 'bot-image'; // Or 'bot-image-nsfw' if you have separate styling

        window.displayMessage(messageClass, imgElement);
    });
}
