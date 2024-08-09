// fetch the completion for the image prompt
// Save the image _id in the chat 
// Find a way to display the image when loading the chat
// Save the image to AWS S3 and save the URL to the database

var isLoading = false;
$(document).ready(function(){
  $('#stability-gen-button').click(generateDiffusedImage)
})
function generateDiffusedImage(option = {}) {
  if($('#stability-gen-button').hasClass('isLoading')){
    return;
  }
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
    img2img : '/stability/img2img' ,
    txt2img : '/stability/txt2img' 
  };

  $('.loader').show();
  $('.isgenerating').addClass('rotate');
  $('#stability-gen-button').addClass('isLoading');

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
      baseFace
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
      $('#stability-gen-button').show()
      $('#stability-gen-button').removeClass('isLoading')
    });
}

function generateImage(data){

  const base64Image = data.image;
  const imageId = data.image_id
  // Create an <img> element
  const img = document.createElement('img');
  img.setAttribute('src', `data:image/png;base64, ${base64Image}`);
  img.setAttribute('class', 'm-auto');
  img.setAttribute('data-id',imageId)

  displayMessage('bot-image',img)
  
}
