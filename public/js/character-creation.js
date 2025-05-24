$(document).ready(function() {
    fetchAndAppendModels();

    if (typeof chatCreationId === 'undefined') {
            window.chatCreationId = '';
    }         
    if  (typeof isTemporaryChat === 'undefined') {  
        window.isTemporaryChat = true;
    }

    // Mobile column switching functionality
    function isMobileScreen() {
        return window.innerWidth <= 768;
    }

    function showLeftColumn() {
        if (isMobileScreen()) {
            $('.modal-sidebar-fixed').show();
            $('.modal-main-content').hide();
        }
    }

    function showRightColumn() {
        if (isMobileScreen()) {
            $('.modal-sidebar-fixed').hide();
            $('.modal-main-content').show();
        }
    }

    // Initialize mobile view
    if (isMobileScreen()) {
        showLeftColumn();
    }

    // Handle window resize
    $(window).on('resize', function() {
        if (!isMobileScreen()) {
            $('.modal-sidebar-fixed').show();
            $('.modal-main-content').show();
        }
    });

    // Show/hide spinner overlay
    function showImageSpinner() {
        $('#imageGenerationSpinner').show();
        $('#generatedImage').css('opacity', '0.5');
    }

    function hideImageSpinner() {
        $('#imageGenerationSpinner').hide();
        $('#generatedImage').css('opacity', '1');
    }

    // Add these functions to window for global access
    window.showImageSpinner = showImageSpinner;
    window.hideImageSpinner = hideImageSpinner;
    window.showRightColumn = showRightColumn;
    window.showLeftColumn = showLeftColumn;

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
        const name = $('#chatName').val().trim();
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

        const $button = $(this);
        $button.prop('disabled', true);

        // Switch to right column on mobile when generation starts
        showRightColumn();

        // Update button text for comprehensive generation
        $button.html(`<div class="me-2 spinner-border spinner-border-sm" role="status">
        <span class="visually-hidden">Loading...</span>
        </div>${translations.newCharacter.comprehensive_generation_started}`);

        $('#characterPrompt').prop('disabled', true);
        $('#chatName').prop('disabled', true);
        $('#chatPurpose').prop('disabled', true);
        
        let moderationResult = {flagged: false};
        try {
            // Call moderation function on prompt content
            moderationResult = await moderateContent(chatCreationId, prompt);
            
            // Check if the content is NSFW
            if (moderationResult.flagged) {
                if (false && !subscriptionStatus) { // Allow user to generate NSFW prompt
                    showUpgradePopup('nsfw-prompt');
                    resetCharacterForm();
                    return
                }
            }

            // Use new comprehensive generation route
            const comprehensiveData = {
                prompt,
                gender,
                name,
                chatId: chatCreationId,
                language: lang
            };

            const comprehensiveResponse = await $.ajax({
                url: '/api/generate-character-comprehensive',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(comprehensiveData)
            });

            if (comprehensiveResponse && comprehensiveResponse.success) {
                // Update form fields with generated data
                const chatData = comprehensiveResponse.chatData;
                const enhancedPrompt = comprehensiveResponse.enhancedPrompt;
                
                $('#chatName').val(chatData.name);
                $('#chatPurpose').val(chatData.short_intro);
                $('#enhancedPrompt').val(enhancedPrompt);
                
                resizeTextarea($('#chatPurpose')[0]);
                
                console.log('Comprehensive character generation completed:', comprehensiveResponse);
                
                // Start image generation with enhanced prompt
                $button.html(`<div class="me-2 spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
                </div>${translations.imageForm.generatingImages}`);
                $('.genexp').fadeIn();
                showImageSpinner(); // Show spinner overlay

                const imageType = moderationResult.flagged ? 'nsfw' : 'sfw';
                const file = $('#imageUpload')[0].files[0];
                    
                novitaImageGeneration(userId, chatCreationId, null, { 
                    prompt: enhancedPrompt, 
                    imageType, 
                    file, 
                    chatCreation: true
                })
                .then(() => {
                    $('.chatRedirection').show();
                    hideImageSpinner(); // Hide spinner overlay
                    resetCharacterForm();
                })
                .catch((error) => {
                    console.error('Error generating image:', error);
                    hideImageSpinner(); // Hide spinner overlay
                    resetCharacterForm();
                });
                
            } else {
                resetCharacterForm();
                showNotification(translations.newCharacter.character_generation_error, 'error');
            }

        } catch (error) {
            console.error('Comprehensive generation error:', error);
            resetCharacterForm();
            showNotification(translations.newCharacter.character_generation_error, 'error');
        }
    });
});

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
        showNotification(translations.imageForm.image_invalid_format, 'error');
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
    const colDiv = $('<div>').addClass('col-12 mb-3');
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

// Add character update functionality
window.loadCharacterUpdatePage = function(chatId) {
    if (!chatId) {
        showNotification('Character ID is required', 'error');
        return;
    }
    
    // Load the character update form
    $.ajax({
        url: `/character-update/${chatId}`,
        method: 'GET',
        success: function(html) {
            $('#character-update-container').html(html);
            $('#characterUpdateModal').modal('show');
        },
        error: function(xhr, status, error) {
            console.error('Error loading character update page:', error);
            showNotification('Failed to load character update form', 'error');
        }
    });
};