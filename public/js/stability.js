// Save the number of image generated
// Implement a limit
// Image generation is for premium users
window.checkImageDescription = function(imageUrl = null, callback) {
  imageUrl = imageUrl ? imageUrl : $('#chatImageUrl').val();

  if (!imageUrl) {
      console.log('Image URL is required.');
      callback({error:'Abord'});
      return;
  }

  if ($('#image_description').val()){return $('#image_description').val()}
  
  $.ajax({
      url: '/api/check-image-description',
      method: 'GET',
      data: { imageUrl: imageUrl },
      success: function(response) {
          if (callback) {
              callback(response);
          }
      },
      error: function(xhr) {
          if (callback) {
              callback(false);
          }
      }
  });
}

function createSystemPayloadImage(language) {
  return [
      {
          "type": "text",
          "text": 
          `
          You generate a highly detailed character face description from the image provided, 
          Your response containe the character on age, skin color, hair, eyes, body type, gender, facial features. Respond in a single, descriptive line of plain text using keywords. \n
          Here is an example : young girl, yellow eyes, long hair, white hair, white skin, voluptuous body, cute face, smiling.`
      }
  ];
}
window.generateImageDescriptionBackend = function(imageUrl = null, chatId, callback) {
  imageUrl = imageUrl ? imageUrl : $('#chatImageUrl').val();
  const language = $('#language').val() || 'japanese';

  const system = createSystemPayloadImage(language);

  const apiUrl = '/api/openai-image-description';

  $.ajax({
      url: apiUrl,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ system, imageUrl, chatId }),
      success: function(response) {
          if (callback) {
              callback(response);
          }
      },
      error: function(xhr) {
          if (callback) {
              callback(null);
          }
      }
  });
}
window.generateImagePromt = function(API_URL, userId, chatId, userChatId, thumbnail, character, callback) {

  const apiUrl = API_URL + '/api/openai-chat-image-completion/';          
  // Initialize the narrator response container
  const imageResponseContainer = $(`
      <div id="load-image-container" class="d-flex flex-row justify-content-start">
          <div class="d-flex flex-row justify-content-start mb-4 message-container" style="border-radius: 15px;">
              <img src="${thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
              <div class="d-flex justify-content-center align-items-center px-3">
                <img src="/img/image-placeholder.gif" width="50px">
              </div>
          </div>
      </div>
  `);

  $('#chatContainer').append(imageResponseContainer);
  $('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);

  $.ajax({
      url: apiUrl,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ userId, chatId, userChatId , character}),
      success: function(response) {
        if (typeof callback === "function") {
          callback(response);
        }
      },
      error: function(xhr, status, error) {
        if (xhr.responseJSON) {
            var errorStatus = xhr.status;
            if (errorStatus === 403) {
                var limitIds = xhr.responseJSON.limitIds || [];
                if (limitIds.includes(3)) {
                    $('#load-image-container').remove();
                    showUpgradePopup('image-generation');
                    return;
                }
            }
        }
    }    
  });
}
// STABLE DIFFUSION
window.generateImageStableDiffusion = function(API_URL, userId, chatId, userChatId, character, option = {}) {

  if(!option.prompt){
    console.log(`Provide a prompt`)
    return
  }

  const {
    negativePrompt = $('#negativePrompt-input').val(),
    prompt = $('#prompt-input').val(),
    imagePath = null,
    aspectRatio = '1:1',
    isRoop = false,
    baseFace = null,
    itemId = null
  } = option;

  let API_ENDPOINT = {
    img2img : API_URL + '/stability/img2img' ,
    txt2img : API_URL + '/stability/txt2img' 
  };

  let query = imagePath ? API_ENDPOINT.img2img : API_ENDPOINT.txt2img;
  fetch(query, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      prompt: prompt, 
      negative_prompt: '', 
      aspectRatio,
      imagePath: imagePath ? imagePath : null,
      baseFace,
      userId, chatId, userChatId , character
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
      }

      return response.json(); // Use response.json() to parse the JSON response
    })
    .then(data => {
      generateImage(data,prompt)
    })
    .catch(error => {
      console.error('Error generating diffused image:', error);
    })
    .finally(() => {
      $('#load-image-container').remove()
      $('#stability-gen-button').show()
      $('#stability-gen-button').removeClass('isLoading')
    });
}
// HUGGINGFACE
window.generateImageHuggingFace = function(API_URL, userId, chatId, userChatId, character, option = {}) {

  if (!option.prompt) {
    console.log(`Provide a prompt`);
    return;
  }
  
  
  const {
    negativePrompt = $('#negativePrompt-input').val(),
    prompt = $('#prompt-input').val(),
    aspectRatio = '9:16',
    isRoop = false,
    baseFace = null,
    itemId = null
  } = option;

  const API_ENDPOINT = API_URL + '/huggingface/txt2img';

  fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      prompt: prompt, 
      negative_prompt: negativePrompt, 
      aspectRatio,
      baseFace,
      userId, chatId, userChatId, character
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
    }
    return response.json();
  })
  .then(data => {
    generateImage(data, prompt); // Directly use the data returned from your API
  })
  .catch(error => {
    console.error('Error generating diffused image:', error);
  })
  .finally(() => {
    $('#load-image-container').remove();
    $('#huggingface-gen-button').show();
    $('#huggingface-gen-button').removeClass('isLoading');
  });
}
// NOVITA
window.generateImageNovita = async function(API_URL, userId, chatId, userChatId, item_id, thumbnail, option = {}) {

  // Initialize the narrator response container
  const imageResponseContainer = $(`
    <div id="load-image-container" class="d-flex flex-row justify-content-start">
        <div class="d-flex flex-row justify-content-start mb-4 message-container" style="border-radius: 15px;">
            <img src="${thumbnail ? thumbnail : 'https://lamix.hatoltd.com/img/logo.webp'}" alt="avatar 1" class="rounded-circle chatbot-image-chat" data-id="${chatId}" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
            <div class="d-flex justify-content-center align-items-center px-3">
              <img src="/img/image-placeholder.gif" width="50px">
            </div>
        </div>
    </div>
`);

$('#chatContainer').append(imageResponseContainer);
$('#chatContainer').scrollTop($('#chatContainer')[0].scrollHeight);

  if(!item_id){return}
  const proposal = await getProposalById(item_id);
  
  const {
    negativePrompt = $('#negativePrompt-input').val(),
    prompt = proposal.description || $('#prompt-input').val(),
    aspectRatio = '9:16',
    isRoop = false,
    baseFace = null,
    itemId = null
  } = option;

  if (!prompt) {
    console.log(`Provide a prompt`);
    return;
  }
  

  const API_ENDPOINT = API_URL + '/novita/txt2img';

  fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      prompt:  prompt, 
      negative_prompt: negativePrompt, 
      aspectRatio,
      baseFace,
      userId, chatId, userChatId,
    })
  })
  .then(response => {
    if (!response.ok) {
      console.log(`Network response was not ok (${response.status} ${response.statusText})`);
    }
    return response.json();
  })
  .then(data => {
    const images = data.images;
    images.forEach((image, index) => {
      setTimeout(() => {
        generateImage(image, prompt);
      }, index * 1000);
    });    
  })
  .catch(error => {
    console.error('Error generating diffused image:', error);
  })
  .finally(() => {
    $('#load-image-container').remove();
    $('#novita-gen-button').show();
    $('#novita-gen-button').removeClass('isLoading');
  });
}
function getProposalById(id) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: `/api/proposal/${id}`,
      method: 'GET',
      success: function(data) {
        resolve(data); // Resolve the promise with the proposal data
      },
      error: function(err) {
        reject(err); // Reject the promise if there is an error
      }
    });
  });
}
window.generateImage = async function(data,prompt){

  const imageUrl = data.url;
  const imageId = data.id
  const imagePrompt = data.prompt
  const imageNsfw = data.nsfw
  console.log({imageNsfw})

  // Create an <img> element
  const img = document.createElement('img');
  img.setAttribute('src', imageUrl);
  img.setAttribute('alt', prompt);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id',imageId)

  const user = await fetchUser()
  const subscriptionStatus = user.subscriptionStatus == 'active'

  if ( imageNsfw && !subscriptionStatus) {
    displayMessage('bot-image-nsfw',img)
  }else{
    displayMessage('bot-image',img)
  }  
}
