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

  // Initialize the image loading container
  const imageResponseContainer = $(`
      <div id="load-image-container" class="d-flex flex-row justify-content-start">
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
      showNotification('Invalid item ID.', 'error');
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
          showNotification('Prompt is required for image generation.', 'error');
          return;
      }

      const API_ENDPOINT = `${API_URL}/novita/txt2img`;
      console.log('API_ENDPOINT for image generation:', API_ENDPOINT);

      console.log('Sending POST request to Novita API with payload:', {
          prompt,
          negative_prompt: negativePrompt,
          aspectRatio,
          baseFace,
          userId,
          chatId,
          userChatId
      });

      const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
              prompt: prompt, 
              negative_prompt: negativePrompt, 
              aspectRatio,
              baseFace,
              userId, 
              chatId, 
              userChatId
          })
      });

      console.log('Fetch response received. Status:', response.status, response.statusText);

      if (!response.ok) {
          const errorText = await response.text();
          console.error('Fetch response not ok. Status:', response.status, response.statusText, 'Response text:', errorText);
          throw new Error(`Network response was not ok (${response.status} ${response.statusText}): ${errorText}`);
      }

      const data = await response.json();
      console.log('generateImageNovita Success: Received data from Novita:', data);

      const images = data.images;
      if (Array.isArray(images)) {
          console.log('Images array received:', images);
          images.forEach((image, index) => {
              console.log(`Generating image ${index + 1}:`, image);
              generateImage(image, prompt);
          });
      } else {
          console.warn('generateImageNovita Warning: No images returned.');
      }

      console.log('Posting imageDone event.');

  } catch (error) {
      console.error('generateImageNovita Error:', error);
      alert(`Error generating image: ${error.message}`);
      window.postMessage({ event: 'imageError', error: error.message }, '*');
  } finally {
      console.log('Finalizing generateImageNovita: Removing loader and updating UI.');
      $('#load-image-container').remove();
      $('#novita-gen-button').show().removeClass('isLoading');
  }
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
let messCt = 0
// Display Generated Image
window.generateImage = async function(data, prompt) {
  console.log('generateImage called with data:', data, 'prompt:', prompt);
  
  if (!data || !data.url || !data.id || !data.prompt) {
      console.error('generateImage Error: Invalid image data.', data);
      return;
  }

  const { url: imageUrl, id: imageId, prompt: imagePrompt, nsfw: imageNsfw } = data;
  console.log('Parsed image data:', { imageUrl, imageId, imagePrompt, imageNsfw });

  // Create an <img> element
  const img = document.createElement('img');
  img.setAttribute('src', imageUrl);
  img.setAttribute('alt', prompt);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id', imageId);

  try {
      console.log('Fetching user information.');
      const user = await fetchUser();
      console.log('User information fetched:', user);

      const subscriptionStatus = user.subscriptionStatus === 'active';
      console.log('User subscription status:', subscriptionStatus);

      if (imageNsfw && !subscriptionStatus) {
          console.warn('NSFW content detected and user is not subscribed.');
          window.postMessage({ event: 'imageNsfw' }, '*');
          displayMessage('bot-image-nsfw', img);
          showNotification('この画像はNSFWコンテンツです。サブスクリプションが必要です。', 'warning');
      } else {
          console.log('Displaying image to user.');
          displayMessage('bot-image', img);
          console.log('Image displayed successfully.');
          // Optionally, uncomment the line below to notify success
          // showNotification('画像が表示されました。', 'success');
      }
      if(subscriptionStatus && messCt == 0){
        window.postMessage({ event: 'imageDone' }, '*');
        messCt ++
      }else{
        messCt = 0
      }

  } catch (error) {
      console.error('generateImage Error fetching user:', error);
      showNotification('ユーザー情報の取得に失敗しました。', 'error');
  }
}