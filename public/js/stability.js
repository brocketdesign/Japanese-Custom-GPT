
var isLoading = false;

function generateDiffusedImage(option = {}) {
  if($('#generate-button').hasClass('isLoading')){
    return;
  }
  const {
    tags = $('#tag-input').val(),
    negativePrompt = $('#negativePrompt-input').val(),
    prompt = $('#prompt-input').val(),
    imagePath = null,
    aspectRatio = '1:1',
    isRoop = false,
    baseFace = null,
    itemId = null
  } = option;

  let API_ENDPOINT = {
    img2img : '/api/img2img' ,
    txt2img : '/api/txt2img' 
  };

  $('.loader').show();
  $('.isgenerating').addClass('rotate');
  $('#generate-button').hide().addClass('isLoading');

  console.log({tags,negativePrompt,prompt,imagePath,aspectRatio});

  let query = imagePath ? API_ENDPOINT.img2img : API_ENDPOINT.txt2img;
  fetch(query, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      prompt: prompt + ',(' + tags + ')', 
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
      $(`.handle-roop[data-id=${itemId}]`).removeClass('loading')
      $('.loader').hide();
      $('.isgenerating').removeClass('rotate isgenerating');
      $('#generate-button').show()
      $('#generate-button').removeClass('isLoading')
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
  // Create a div element
  const div = document.createElement('div');
  div.setAttribute('class', 'gallery-item');
  
  // Wrap the img in the div
  div.appendChild(img);

  addImageToChat($(div).clone())
  
}


function addImageToChat(imageElement){
    console.log(`Add Image`)
}