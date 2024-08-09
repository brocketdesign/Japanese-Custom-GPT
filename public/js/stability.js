// Save the number of image generated
// Implement a limit
// Image generation is for premium users

var isLoading = false;
$(document).ready(function(){
  $('#stability-gen-button').click(function() {
    const API_URL = localStorage.getItem('API_URL');
    const userId = $(this).data('user-id');
    const chatId = $(this).data('chat-id');
    const userChatId = $(this).data('user-chat-id');

    generateImagePromt(API_URL, userId, chatId, userChatId, function(prompt){
      generateDiffusedImage(API_URL,userId, chatId, userChatId,{prompt});
    });
  });
});

function generateImagePromt(API_URL, userId, chatId, userChatId, callback) {

  const apiUrl = API_URL + '/api/openai-chat-image-completion/';
  console.log({API_URL,userId,chatId,userChatId,apiUrl})
          
  // Initialize the narrator response container
  const imageResponseContainer = $(`
      <div id="load-image-container" class="d-flex flex-row justify-content-start">
          <div class="d-flex flex-row justify-content-start mb-4 message-container" style="border-radius: 15px;">
              <img src="https://lamix.hatoltd.com/img/logo.webp" alt="avatar 1" class="rounded-circle chatbot-image-chat" style="min-width: 45px; width: 45px; height: 45px; border-radius: 15%;object-fit: cover;object-position:top;">
              <div class="d-flex justify-content-center align-items-center p-3">
                <i class="fa fa-spinner fa-spin fa-fw fa-hidden"></i>
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
      data: JSON.stringify({ userId, chatId, userChatId }),
      success: function(response) {
        console.log(response)
        if (typeof callback === "function") {
          callback(response);
        }
      },
      error: function(error) {
          console.error('Error:', error);
      }
  });
}
function generateDiffusedImage(API_URL,userId, chatId, userChatId,option = {}) {
  if($('#stability-gen-button').hasClass('isLoading')){
    return;
  }
  
  $('#stability-gen-button').addClass('isLoading');
  const {
    negativePrompt = $('#negativePrompt-input').val(),
    prompt = 'Little cute cracked wood alien void creature, charred, long wooden petals and mud, sitting on top of a log, lush garden, roses, lurking behind tree, ultra large black dot eyes, night scene, backlit' || $('#prompt-input').val(),
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

  
  console.log({negativePrompt,prompt,imagePath,aspectRatio});

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
      userId, chatId, userChatId
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status} ${response.statusText})`);
      }

      return response.json(); // Use response.json() to parse the JSON response
    })
    .then(data => {
      generateImage(data)
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

function generateImage(data){

  const imageUrl = data.image;
  const imageId = data.image_id
  // Create an <img> element
  const img = document.createElement('img');
  img.setAttribute('src', `${imageUrl}`);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id',imageId)

  displayMessage('bot-image',img)
  
}
