
    $(document).ready(function() {
        fetchAndAppendModels();
    });
    
    $(document).ready(function () {
        $('#characterDescriptionAccordion, #personalityAccordion').on('show.bs.collapse hide.bs.collapse', function (e) {
            const checkId = $(this).attr('id').replace('Accordion','Check')
            $('#' + checkId).prop('checked', e.type === 'show');
        });
        $('#enableEnhancedPrompt').on('click',function(){
            $('#enhancedPrompt').toggle()
        })
    });
    $(document).on('click', '.add-tag', function() {
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

    });

    function updateFields(element) {
        const fields = ['id', 'style', 'model', 'version'];
        fields.forEach(field => {
            $(`#${field === 'id' ? 'modelId' : 'image' + field.charAt(0).toUpperCase() + field.slice(1)}`).val(element.data(field));
        });
    }

$(document).ready(function() {
    if (!isTemporaryChat && chatId) {
        $(document).on('click','#redirectToChat', function() {
            if(!$('#chatContainer').length){
                window.location.href = `/chat/${chatId}`;
                return
            }
            closeAllModals();
            fetchchatData(chatId,userId);
        });
    }
});

$(document).ready(function() {
        
    $('.dropdown-toggle').each(function(e) {
        new mdb.Dropdown($(this)[0]);
    });

    var count = 0
    const subscriptionStatus = user.subscriptionStatus == 'active'
    let isAutoGen = false

    if(subscriptionStatus){
        $('.is-premium').each(function(){$(this).toggleClass('d-none')})
    }else{
        function disableInputs(containerId) {
            $(containerId).find('input, select, textarea').each(function () {
                $(this).prop('disabled', true);
            });
        }
        disableInputs('#characterDescriptionAccordion');
        disableInputs('#personalityAccordion');
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
        fetchchatData(chatId);
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

     function fetchchatData(chatId, callback) {
            $.ajax({
                url: `/api/chat-data/${chatId}`,
                type: 'GET',
                dataType: 'json',
                success: function(chatData) {
                    console.log('Fetched chat data:', chatData);

                    // Populate Step 1: キャラクターの外見
                    if (chatData.modelId) {
                        $('#modelId').val(chatData.modelId);
                    }

                    if (chatData.imageStyle) {
                        $('#imageStyle').val(chatData.imageStyle);
                    }
                    if (chatData.imageModel) {
                        $('#imageModel').val(chatData.imageModel);
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

                    if (chatData?.base_personality && chatData?.base_personality?.story) {
                        $('#chatPurpose').val(chatData?.base_personality?.story);
                        resizeTextarea($('#chatPurpose')[0]);
                    }

                    if (chatData.name) {
                        $('#chatName').val(chatData.name).show();
                        $('#sendForm span').text(`${chatData.name}とチャットする`);
                    }

                    if (chatData.description) {
                        $('#chatDescription').val(chatData.description).show();
                        resizeTextarea($('#chatDescription')[0]);
                    }

                    if (chatData.base_personality.story && $('#chatStory').length) {
                        $('#chatStory').val(chatData.base_personality.story).show();
                        resizeTextarea($('#chatStory')[0]);
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
      


        function saveModeration(moderationResult, chatId, callback){

            $.ajax({
            url: '/novita/save-moderation',
            method: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
            moderation: moderationResult,
            chatId
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
        // Save selected image model
        function saveSelectedImageModel(chatId, callback) {
            
            const modelId = $('.style-option.selected').data('id')
            const imageStyle = $('.style-option.selected').data('style')
            const imageModel = $('.style-option.selected').data('model')
            const imageVersion = $('.style-option.selected').data('version')

            $.ajax({
            url: '/novita/save-image-model',
            method: 'POST',
            dataType: 'json',
            data: {
                chatId,
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
   
        function returnDetails(containerId) {
            const details = {};
            $(containerId).find('input, select, textarea').each(function () {
                const element = $(this), name = element.attr('name');
                if (name) {
                    let value = element.is(':checkbox') ? element.is(':checked')
                            : element.is(':radio') ? (element.is(':checked') ? element.val() : null)
                            : element.val()?.trim();
                    if (value !== null && value !== '') details[name] = value;
                }
            });
            return details;
        }

        function returnCharacterDetails() {
            return returnDetails('#characterDescriptionAccordion');
        }

        function returnCharacterPersonalityDetails() {
            return returnDetails('#personalityAccordion');
        }

        async function checkChat(chatId) {
            try {
                const response = await $.post('/api/check-chat', { chatId });
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
    window.moderateContent = async function(chatId, content) {
        try {
            const response = await $.ajax({
                url: '/novita/moderate',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ chatId, content })
            });
            return response.results[0];
        } catch (error) {
            console.error('Moderation request failed:', error);
            throw error;
        }
    }
    $('#generateButton').on('click', async function() {
        let newchatId = await checkChat(chatId)

        if(newchatId){
            window.chatId = newchatId
            chatId = newchatId
            $(document).on('click','#redirectToChat', function() {
                if(!$('#chatContainer').length){
                    window.location.href = `/chat/${newchatId}`;
                    return
                }
                closeAllModals();
                fetchchatData(newchatId,userId);
            });
        }
        const prompt = characterPrompt = $('#characterPrompt').val().trim();
        const gender = $('#gender').val();
        let modelId = $('#modelId').val();

        if(!modelId){
            const initial_modelId = `{{modelId}}`
            if(initial_modelId){
                modelId = initial_modelId
                $(document).find(`.style-option[data-id=${initial_modelId}]`).click();
            }
        }

        await saveSelectedImageModel(chatId, function(error, response) {
            if (error) {
                console.error('Error saving image model:', error);
            }
        });

        if (!modelId || !prompt || !gender || !chatId) {
            showNotification(translations.newCharacter.allFieldsRequired, 'error');
            return;
        }

        const characterDetails = returnCharacterDetails();
        const isEnhanceEnabled = $('#enableEnhancedPrompt').is(':checked');

        const $button = $(this);
        $button.prop('disabled', true);

        // ボタンテキストを更新
        if(isEnhanceEnabled){
            $button.html(`<i class="fas fa-spinner fa-spin me-2"></i>${translations.newCharacter.enhancing_prompt}`);
        } else {
            $button.html(`<i class="fas fa-spinner fa-spin me-2"></i>${translations.imageForm.generatingImages}`);
        }

        $('#characterPrompt').prop('disabled', true);
        $('#chatName').prop('disabled', true);
        $('#chatPurpose').prop('disabled', true);
        let moderationResult = {flagged: false};
        try {

            // Call moderation function on enhancedPrompt content
            moderationResult = await moderateContent(chatId,prompt);
            // Check if the content is NSFW
            if (moderationResult.flagged) {
                if (false && !subscriptionStatus) { // Allow user to generate NSFW prompt
                    showUpgradePopup('nsfw-prompt');
                    // Enable buttons and reset text
                    $button.prop('disabled', false);
                    $button.html('<i class="fas fa-magic me-2"></i>' + translations.newCharacter.generate_with_AI);
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
                        chatId,
                    };

                    if (subscriptionStatus && $('#characterDescriptionCheck').is(':checked')) {
                        customData.details_description = characterDetails;
                    }

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
                    $button.html(`<i class="fas fa-magic me-2"></i>${translations.newCharacter.generate_with_AI}`);
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
            $button.html(`<i class="fas fa-spinner fa-spin me-2"></i>${translations.imageForm.generatingImages}`);
            $('.genexp').fadeIn()

            const imageType = moderationResult.flagged ? 'nsfw' : 'sfw';

            txt2ImageNovita(userId, chatId, null, { prompt:enhanceResponse.enhancedPrompt, imageType, chatCreation: true})
            .catch((error) => {
                console.error('Error generating image:', error);
            })
						
			generateCharacterPersonnality(function(response){
                showNotification(translations.newCharacter.personalityDetailsDone , 'success');
                $('.chatRedirection').show();
                //Scroll to .chatRedirection
                $('html, body').animate({
                    scrollTop: $(".chatRedirection").offset().top
                }, 1000);
            });

        } catch (error) {
            console.error('Error:', error);
            $button.prop('disabled', false);
            $button.html('<i class="fas fa-magic me-2"></i>'+translations.newCharacter.generate_with_AI);
            $('#characterPrompt').prop('disabled', false);
            $('#chatName').prop('disabled', false);
            $('#chatPurpose').prop('disabled', false);
        }
    });


        async function generateCharacterPersonnality(callback) {
            const personalityDetails = returnCharacterPersonalityDetails();        
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
                chatId,
            };

            if (subscriptionStatus && $('#personalityCheck').is(':checked')) {
                customData.details_personality = personalityDetails;
            }

            customData = JSON.stringify(customData);

            $.ajax({
                url: '/api/openai-chat-creation',
                method: 'POST',
                contentType: 'application/json',
                data: customData,
                success: function(response) {

                    $('#chatName').val(response.name);
                    $('#chatPurpose').val(response?.base_personality?.story);
                    $('#chatStory').val(response.base_personality.story);

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
window.saveSelectedImage = function(imageUrl, callback) {
    $.ajax({
    url: '/novita/save-image',
    method: 'POST',
    dataType: 'json',
    data: {
        imageUrl,
        chatId
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
window.generateCharacterImage = function(url, nsfw) {
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
        }
        });
    });

    colDiv.append(imgElement);
    $('#imageContainer').append(colDiv);
}

// After the image is generated, save the image and redirect to the chat
window.resetCharacterForm = function(){
    // Enable buttons and reset text
    $('.chatRedirection').show();
    $('#characterPrompt').prop('disabled', false);
    $('#chatName').prop('disabled', false);
    $('#chatPurpose').prop('disabled', false);
    $('#generateButton').prop('disabled', false);
    $('#generateButton').html('<i class="fas fa-magic me-2"></i>'+translations.newCharacter.generate_with_AI);
}

window.updateCharacterGenerationMessage = function(message){
    $('.genexp').text(message)
}