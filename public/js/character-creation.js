$(document).ready(function() {
    fetchAndAppendModels();

    if (typeof chatCreationId === 'undefined') {
            window.chatCreationId = '';
    }         
    if  (typeof isTemporaryChat === 'undefined') {  
        window.isTemporaryChat = true;
    }
    console.log('isTemporaryChat', isTemporaryChat);
    console.log('chatCreationId', chatCreationId);
    
    // Add a small delay before accessing DOM elements
    setTimeout(function() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('imageUpload');

        const subscriptionStatus = user.subscriptionStatus == 'active';
        if(subscriptionStatus && fileInput){
            $('#imageUpload').prop('disabled', false);
        }
        
        // Only access uploadArea if it exists in the DOM
        if (uploadArea) {
            if (!uploadArea.hasEventListener) {
                uploadArea.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    uploadArea.classList.add('dragover');
                });

                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.classList.remove('dragover');
                });

                uploadArea.addEventListener('drop', (event) => {
                    event.preventDefault();
                    uploadArea.classList.remove('dragover');
                    fileInput.files = event.dataTransfer.files;
                    previewImage(event);
                });

                uploadArea.hasEventListener = true;
            }
        } else {
            console.log('Upload area element not found in DOM yet');
        }
    }, 500); // 500ms delay to ensure DOM is fully rendered
});
$(document).off().on('click', '.add-tag', function() {
    const tag = $(this).text();
    const $characterPrompt = $('#characterPrompt');
    const prompt = $characterPrompt.val();
    $characterPrompt.val(prompt + ',' + tag);
});

$(document).ready(function() {
    $('#language').val(lang)

    $('#characterPrompt').on('input change', function() {
        $('#enhancedPrompt').val('');
    });
    
    $(document).on('click', '.style-option', function () {
        if($(this).hasClass('is-premium')){
            showUpgradePopup('image-generation')
            return
        }
        $('.style-option').removeClass('selected');
        $(this).addClass('selected');
        updateFields($(this));
    });

    updateFields($(document).find('.style-option.selected'));
    
    function updateFields(element) {
        const fields = ['id', 'style', 'model', 'version'];
        fields.forEach(field => {
            $(`#${field === 'id' ? 'modelId' : 'image' + field.charAt(0).toUpperCase() + field.slice(1)}`).val(element.data(field));
        });
    }

});

$(document).ready(function() {
    console.log('chatCreationId', chatCreationId);
    if (chatCreationId && chatCreationId.trim() !== '') {
        $(".chatRedirection").show();
        $(document).on('click','#redirectToChat', function() {
            if(!$('#chatContainer').length){
                window.location.href = `/chat/${chatCreationId}`;
                return
            }
            closeAllModals();
            callFetchChatData(chatCreationId,userId);
        });
    }
    
    $('.dropdown-toggle').each(function(e) {
        new mdb.Dropdown($(this)[0]);
    });
    
    var count = 0
    const subscriptionStatus = user.subscriptionStatus == 'active'
    let isAutoGen = false

    if(subscriptionStatus){
        $('.is-premium').each(function(){$(this).toggleClass('d-none')})
    }
    $('input, textarea').val('');

    const urlParams = new URLSearchParams(window.location.search);
    const chatImageUrl = urlParams.get('chatImage');
    if (chatImageUrl) {
        setTimeout(function(){
            $('#chatImageUrl').val(chatImageUrl).change();
        },500)
        $('#chatImage').attr('src', chatImageUrl).show().addClass('on');
    }

    if (isTemporaryChat == 'false' || isTemporaryChat == false) {
        fetchchatCreationData(chatCreationId);
    }

    $('textarea').each(function() {
        resizeTextarea(this);
        $(this).on('input change', function() {
            resizeTextarea(this);
        });
    });

    function resizeTextarea(element){
        if($(element).val().trim()!=''){
            element.style.height = 'auto';
            element.style.height = (element.scrollHeight) + 'px';  
        }else{
            element.style.height = 'auto'; 
        }
    }

     function fetchchatCreationData(chatCreationId, callback) {
            $.ajax({
                url: `/api/chat-data/${chatCreationId}`,
                type: 'GET',
                dataType: 'json',
                success: function(chatData) {

                    if (chatData.modelId) {
                        $('#modelId').val(chatData.modelId);
                        $(document).find(`.style-option[data-id="${chatData.modelId}"]`).click();
                    }

                    if (chatData.imageStyle) {
                        $('#imageStyle').val(chatData.imageStyle);
                    }
                    if (chatData.imageModel) {
                        $('#imageModel').val(chatData.imageModel);
                        $(document).find(`.style-option[data-model="${chatData.imageModel}"]`).click();
                    }
                    if (chatData.imageVersion) {
                        $('#imageVersion').val(chatData.imageVersion);
                    }

                    if (chatData.characterPrompt) {
                        $('#characterPrompt').val(chatData.characterPrompt);
                        resizeTextarea($('#characterPrompt')[0]);
                    }

                    if (chatData.enhancedPrompt && chatData.enhancedPrompt !== '') {
                        $('#enhancedPrompt').val(chatData.enhancedPrompt);
                    }

                    if (chatData.imageDescription) {
                      $('#enhancedPrompt').val(chatData.imageDescription);
                    }

                    if (chatData.chatImageUrl) {
                        $('#generatedImage').attr('src', chatData.chatImageUrl).show().addClass('on');
                    }

                    if (chatData.language) {
                        $('#language').val(chatData.language);
                    }

                    if (chatData.gender) {
                        $('#gender').val(chatData.gender);
                    }

                    if (chatData.name) {
                        $('#chatName').val(chatData.name).show();
                        $('#sendForm span').text(`${chatData.name}とチャットする`);
                    }

                    if (chatData.description) {
                        $('#chatDescription').val(chatData.description).show();
                        resizeTextarea($('#chatDescription')[0]);
                    }

                    // Callback if provided
                    if (typeof callback === 'function') {
                        callback();
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching chat data:', error);
                    showNotification('チャットデータの取得に失敗しました。再試行してください。', 'error');
                }
            });
        }
      


        function saveModeration(moderationResult, chatCreationId, callback){

            $.ajax({
            url: '/novita/save-moderation',
            method: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
            moderation: moderationResult,
            chatId:chatCreationId
            }),
            success: function(response) {
            if (typeof callback === 'function') {
            callback(null, response);
            }
            },
            error: function(error) {
            if (typeof callback === 'function') {
            callback(error);
            }
            }
            });
        }
        function resetInfiniteScroll(){
            const imageStyle = $('.style-option.selected').data('style')
            const imageModel = $('.style-option.selected').data('model')
            const searchId = `peopleChatCache_${imageStyle}-${imageModel}--false`
            localStorage.removeItem(searchId)
        }; 

        // Save selected image model
        function saveSelectedImageModel(chatCreationId, callback) {
            
            const modelId = $('.style-option.selected').data('id')
            const imageStyle = $('.style-option.selected').data('style')
            const imageModel = $('.style-option.selected').data('model')
            const imageVersion = $('.style-option.selected').data('version')

            $.ajax({
            url: '/novita/save-image-model',
            method: 'POST',
            dataType: 'json',
            data: {
                chatId:chatCreationId,
                modelId,
                imageStyle,
                imageModel,
                imageVersion
            },
            success: function(response) {
                if (typeof callback === 'function') {
                callback(null, response);
                }
            },
            error: function(error) {
                if (typeof callback === 'function') {
                callback(error);
                }
            }
            });
        }

        async function checkChat(chatCreationId) {
            try {
                const response = await $.post('/api/check-chat', { chatId:chatCreationId });
                if (response.message === 'Chat exists') {
                    return false;
                } else {
                    return response.chatId;
                }
            } catch (error) {
                console.error('Request failed:', error);
                throw error;
            }
        }
    window.moderateContent = async function(chatCreationId, content) {
        try {
            const response = await $.ajax({
                url: '/novita/moderate',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ chatId:chatCreationId, content })
            });
            return response.results[0];
        } catch (error) {
            console.error('Moderation request failed:', error);
            throw error;
        }
    }

    $('#generateButton').on('click', async function() {
        resetInfiniteScroll();
        let newchatId = await checkChat(chatCreationId)

        if(newchatId){
            chatCreationId = newchatId
            $(document).on('click','#redirectToChat', function() {
                if(!$('#chatContainer').length){
                    window.location.href = `/chat/${newchatId}`;
                    return
                }
                closeAllModals();
                callFetchChatData(newchatId,userId);
            });
        }

        const prompt = characterPrompt = $('#characterPrompt').val().trim();
        const gender = $('#gender').val();
        let modelId = $('#modelId').val();

        if(!modelId){
            const initial_modelId = `{{modelId}}`
            if(initial_modelId){
                modelId = initial_modelId
                $(document).find(`.style-option[data-id="${initial_modelId}"]`).click();
            }
        }

        await saveSelectedImageModel(chatCreationId, function(error, response) {
            if (error) {
                console.error('Error saving image model:', error);
            }
        });

        if (!modelId || !prompt || !gender || !chatCreationId) {
            showNotification(translations.newCharacter.allFieldsRequired, 'error');
            return;
        }

        const isEnhanceEnabled = $('#enableEnhancedPrompt').is(':checked');

        const $button = $(this);
        $button.prop('disabled', true);

        // ボタンテキストを更新
        if(isEnhanceEnabled){
            $button.html(`<div class="me-2 spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Loading...</span>
            </div>${translations.newCharacter.enhancing_prompt}`);
        } else {
            $button.html(`<div class="me-2 spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Loading...</span>
            </div>${translations.imageForm.generatingImages}`);
        }

        $('#characterPrompt').prop('disabled', true);
        $('#chatName').prop('disabled', true);
        $('#chatPurpose').prop('disabled', true);
        let moderationResult = {flagged: false};
        try {

            // Call moderation function on enhancedPrompt content
            moderationResult = await moderateContent(chatCreationId,prompt);
            // Check if the content is NSFW
            if (moderationResult.flagged) {
                if (false && !subscriptionStatus) { // Allow user to generate NSFW prompt
                    showUpgradePopup('nsfw-prompt');
                    // Enable buttons and reset text
                    $button.prop('disabled', false);
                    $button.html('<i class="bi bi-magic me-2"></i>' + translations.newCharacter.generate_with_AI);
                    $('#characterPrompt').prop('disabled', false);
                    $('#chatName').prop('disabled', false);
                    $('#chatPurpose').prop('disabled', false);
                    return
                }
            }

            let enhanceResponse = {enhancedPrompt:''}

            if(isEnhanceEnabled){
                if($('#enhancedPrompt').val().trim() != ''){
                    enhanceResponse.enhancedPrompt = $('#enhancedPrompt').val()
                }else{
                    let customData = {
                        prompt,
                        gender,
                        chatId:chatCreationId,
                    };

                    customData = JSON.stringify(customData);

                    // プロンプトを強化するリクエスト
                    enhanceResponse = await $.ajax({
                        url: '/api/enhance-prompt',
                        method: 'POST',
                        contentType: 'application/json',
                        data: customData
                    });
                }

                if (enhanceResponse && enhanceResponse.enhancedPrompt) {
                    $('#enhancedPrompt').val(enhanceResponse.enhancedPrompt);
                } else {
                    $button.prop('disabled', false);
                    $button.html(`<i class="bi bi-magic me-2"></i>${translations.newCharacter.generate_with_AI}`);
                    $('#characterPrompt').prop('disabled', false);
                    $('#chatName').prop('disabled', false);
                    $('#chatPurpose').prop('disabled', false);
                    return;
                }
            } else {
                // プロンプトをそのまま使用
                enhanceResponse.enhancedPrompt = prompt;
            }

            // ボタンテキストを「画像を生成中...」に更新
            $button.html(`<div class="me-2 spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Loading...</span>
            </div>${translations.imageForm.generatingImages}`);
            $('.genexp').fadeIn()

            const imageType = moderationResult.flagged ? 'nsfw' : 'sfw';
            // Check if #imageUpload has a file
            const file = $('#imageUpload')[0].files[0];
                
            novitaImageGeneration(userId, chatCreationId, null, { prompt:enhanceResponse.enhancedPrompt, imageType, file, chatCreation: true})
            .catch((error) => {
                console.error('Error generating image:', error);
            })
            
			generateCharacterPersonnality(function(response){
                $('.chatRedirection').show();
            });

        } catch (error) {
            console.error('Error:', error);
            $button.prop('disabled', false);
            $button.html('<i class="bi bi-magic me-2"></i>'+translations.newCharacter.generate_with_AI);
            $('#characterPrompt').prop('disabled', false);
            $('#chatName').prop('disabled', false);
            $('#chatPurpose').prop('disabled', false);
        }
    });


        async function generateCharacterPersonnality(callback) {
            let name = $('#chatName').val();
            let purpose = $('#chatPurpose').val().trim() !== '' ? $('#chatPurpose').val().trim() : $('#characterPrompt').val().trim();   
            let prompt = $('#characterPrompt').val().trim();
            let gender = $('#gender').val();
            
            if(purpose.length == 0){
                return
            } 
            let customData = {
                prompt,
                purpose,
                name,
                gender,
                chatId:chatCreationId,
            };

            customData = JSON.stringify(customData);

            $.ajax({
                url: '/api/openai-chat-creation',
                method: 'POST',
                contentType: 'application/json',
                data: customData,
                success: function(response) {
                    $('#chatName').val(response.name);
                    $('#chatPurpose').val(response?.short_intro);
                    resizeTextarea($('#chatPurpose')[0]);
                    if (typeof callback === 'function') {
                        callback(response);
                    }
                },
                error: function(error) {
                    console.error('Error:', error);
                }
            });
        }
       
});


function previewImage(event) {
    const reader = new FileReader();
    const imagePreview = document.getElementById('imagePreview');
    reader.onload = function() {
        imagePreview.src = reader.result;
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(event.target.files[0]);
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showNotification(translations.imageForm.image_size_limit, 'error');
            return;
        }
        const reader = new FileReader();
        const imagePreview = document.getElementById('imagePreview');
        reader.onload = function() {
            imagePreview.src = reader.result;
            imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        showNotification(translations.imageForm.image_invalid, 'error');
    }
}

function resetChatList(){
    const imageModel = $('.style-option.selected').data('model')
    $(document).find(`#imageStyleTabs button[data-model="${imageModel}"]`).click()
}

window.saveSelectedImage = function(imageUrl, callback) {
    $.ajax({
    url: '/novita/save-image',
    method: 'POST',
    dataType: 'json',
    data: {
        imageUrl,
        chatId:chatCreationId
    },
    success: function(response) {
        if (typeof callback === 'function') {
        callback(null, response);
        }
    },
    error: function(error) {
        if (typeof callback === 'function') {
        callback(error);
        }
    }
    });
}
window.generateCharacterImage = function( url, nsfw) {
    // Clear the container
    $('#generatedImage').remove();

    // For each image URL, create an image element and append to the container
    const colDiv = $('<div>').addClass('col-12 col-md-6 mb-3');
    const imgElement = $('<img>')
        .attr('src', url)
        .addClass('img-fluid img-thumbnail')
        .css('cursor', 'pointer');

    // Add click handler to each image
    imgElement.on('click', function() {
        $('.img-thumbnail').each(function(){
        $(this).removeClass('select')
        });
        $(this).addClass('select');
        
        // Save the selected image
        saveSelectedImage(url,function(error, response){
        if (error) {
            showNotification(translations.imageForm.image_save_failed, 'error');
        } else {
            showNotification(translations.imageForm.image_saved, 'success');
            resetChatList();
        }
        });
    });

    colDiv.append(imgElement);
    $('#imageContainer').append(colDiv);

    //getTimer(chatCreationId)
}

// After the image is generated, save the image and redirect to the chat
window.resetCharacterForm = function(){
    // Enable buttons and reset text
    $('.chatRedirection').show();
    $('#characterPrompt').prop('disabled', false);
    $('#chatName').prop('disabled', false);
    $('#chatPurpose').prop('disabled', false);
    $('#generateButton').prop('disabled', false);
    $('#generateButton').html('<i class="bi bi-magic me-2"></i>'+translations.newCharacter.generate_with_AI);
}

window.updateCharacterGenerationMessage = function(message){
    $('.genexp').text(message)
}