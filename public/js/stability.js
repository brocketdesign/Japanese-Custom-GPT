// =========================
// Enhanced Image Generation with Novita
// =========================

// Check Image Description and Implement Limits for Premium Users
window.checkImageDescription = function(chatId = null, callback) {
  console.log('checkImageDescription called with chatId:', chatId);
  
  if (!chatId) {
      console.error('checkImageDescription Error: chatId is required.');
      callback({ error: 'Abort' });
      return;
  }

  const imageDescription = $('#image_description').val();
  console.log('Retrieved imageDescription from DOM:', imageDescription);
  
  if (imageDescription) {
      console.log('Existing image description found.');
      callback({ description: imageDescription });
      return;
  }

  $.ajax({
      url: '/api/check-image-description',
      method: 'GET',
      data: { chatId: chatId },
      success: function(response) {
          console.log('checkImageDescription Success:', response);
          if (callback) {
              callback(response);
          }
      },
      error: function(xhr, status, error) {
          console.error('checkImageDescription Error:', status, error, xhr);
          if (callback) {
              callback({ error: 'Failed to check image description.' });
          }
      }
  });
}

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
window.generateImageNovita = async function(API_URL, userId, chatId, userChatId, item_id, thumbnail, option = {}) {
    console.log('generateImageNovita called with parameters:', {
        API_URL,
        userId,
        chatId,
        userChatId,
        item_id,
        thumbnail,
        option
    });

    // Initialize the image loading container with two placeholders
    const imageResponseContainer = $(`
        <div id="load-image-container" class="d-flex flex-column justify-content-start">
            <!-- SFW Image Loader -->
            <div class="d-flex flex-row justify-content-start mb-4 message-container" style="border-radius: 15px;">
                <img src="${thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="width: 45px; height: 45px; object-fit: cover; object-position: top;">
                <div class="d-flex justify-content-center align-items-center px-3">
                    <img src="/img/image-placeholder.gif" width="50px" alt="loading">
                </div>
            </div>
            <!-- NSFW Image Loader -->
            <div class="d-flex flex-row justify-content-start mb-4 message-container" style="border-radius: 15px;">
                <img src="${thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="width: 45px; height: 45px; object-fit: cover; object-position: top;">
                <div class="d-flex justify-content-center align-items-center px-3">
                    <img src="/img/image-placeholder.gif" width="50px" alt="loading">
                </div>
            </div>
        </div>
    `);
    console.log('Appending imageResponseContainer to chatContainer.');
    $('#chatContainer').append(imageResponseContainer);
    $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);

    if (!item_id) {
        console.error('generateImageNovita Error: item_id is required.');
        $('#load-image-container').remove();
        showNotification('無効なアイテムIDです。', 'error');
        return;
    }

    try {
        console.log('Fetching proposal with item_id:', item_id);
        const proposal = await getProposalById(item_id);
        console.log('Proposal fetched:', proposal);

        const {
            negativePrompt = $('#negativePrompt-input').val(),
            prompt = proposal.description || $('#prompt-input').val(),
            aspectRatio = '9:16',
            baseFace = null
        } = option;

        console.log('Parameters after destructuring:', { negativePrompt, prompt, aspectRatio, baseFace });

        if (!prompt) {
            console.error('generateImageNovita Error: Prompt is required.');
            showNotification('画像生成に必要なプロンプトがありません。', 'error');
            $('#load-image-container').remove();
            return;
        }

        const API_ENDPOINT = `${API_URL}/novita/txt2img`;
        console.log('API_ENDPOINT for image generation:', API_ENDPOINT);

        console.log('Sending POST request to Novita API with payload:', {
            prompt: prompt,
            aspectRatio: aspectRatio,
            userId: userId,
            chatId: chatId,
            userChatId: userChatId
        });

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                prompt: prompt, 
                aspectRatio: aspectRatio, 
                userId: userId, 
                chatId: chatId, 
                userChatId: userChatId 
            })
        });

        console.log('Fetch response received. Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Fetch response not ok. Status:', response.status, response.statusText, 'Response text:', errorText);
            throw new Error(`ネットワークエラー (${response.status} ${response.statusText}): ${errorText}`);
        }

        const data = await response.json();
        console.log('generateImageNovita Success: Received data from Novita:', data);

        const { tasks } = data;
        if (!tasks || !Array.isArray(tasks)) {
            throw new Error('サーバーからタスクが返されませんでした。');
        }

        // Start polling for each task
        tasks.forEach(task => {
            pollTaskStatus(API_URL, task.taskId, task.type, prompt);
        });

        console.log('Posting imageDone event.');

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
    const POLLING_INTERVAL = 5000; // 3 seconds
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
            console.log(`Polling task status for ${type}:`, statusData);

            if (statusData.status === 'completed') {
                clearInterval(intervalId);
                const { imageId, imageUrl } = statusData.result;

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
  console.log('getProposalById called with id:', id);
  return new Promise((resolve, reject) => {
      $.ajax({
          url: `/api/proposal/${id}`,
          method: 'GET',
          success: function(data) {
              console.log('getProposalById Success:', data);
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

    if (imageNsfw && !subscriptionStatus) {
      window.postMessage({ event: 'imageNsfw' }, '*');
      displayMessage('bot-image-nsfw', img);
      showNotification('この画像はNSFWコンテンツです。サブスクリプションが必要です。', 'warning');
    } else {
      displayMessage('bot-image', img);
    }

    if (messCt == 1) {
      window.postMessage({ event: 'imageDone' }, '*');
      messCt++;
    }
  } catch (error) {
    showNotification('ユーザー情報の取得に失敗しました。', 'error');
  }
};
