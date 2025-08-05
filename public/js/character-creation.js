(function() {

    fetchAndAppendModels();

    if (typeof chatCreationId === 'undefined') {
        window.chatCreationId = '';
    }
    if (typeof isTemporaryChat === 'undefined') {
        window.isTemporaryChat = true;
    }

    // Show/hide spinner overlay
    function showImageSpinner() {
        $('#imageGenerationSpinner').show();
        $('#generatedImage').css('opacity', '0.5');
    }

    function hideImageSpinner() {
        $('#imageGenerationSpinner').hide();
        $('#generatedImage').css('opacity', '1');
    }

    // After the image is generated, save the image and redirect to the chat
    function resetCharacterForm() {
        // Enable buttons and reset text
        $('.chatRedirection').show();
        $('#characterPrompt').prop('disabled', false);
        $('#chatName').prop('disabled', false);
        $('#chatPurpose').prop('disabled', false);
        $('#generateButton').prop('disabled', false);
        $('#generateButton').html('<i class="bi bi-magic me-2"></i>' + translations.newCharacter.generate_with_AI);

        // Reset regenerate button if it was disabled
        resetRegenerateButton();
    }

    // Add these functions to window for global access
    window.showImageSpinner = showImageSpinner;
    window.hideImageSpinner = hideImageSpinner;
    window.resetCharacterForm = resetCharacterForm;


    // Add a small delay before accessing DOM elements
    setTimeout(function() {
        const $uploadArea = $('#uploadArea');
        const $fileInput = $('#imageUpload');
        const uploadArea = $uploadArea.length ? $uploadArea[0] : null;
        const fileInput = $fileInput.length ? $fileInput[0] : null;

        const subscriptionStatus = user.subscriptionStatus == 'active';
        if (subscriptionStatus && fileInput) {
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

    $(document).on('click', '.add-tag', function() {
        const tag = $(this).text();
        const $characterPrompt = $('#characterPrompt');
        const prompt = $characterPrompt.val();
        $characterPrompt.val(prompt + ',' + tag);
    });

    $('#language').val(lang)

    $('#characterPrompt').on('input change', function() {
        $('#enhancedPrompt').val('');
    });

    $(document).on('click', '.style-option', function() {
        if ($(this).hasClass('is-premium')) {
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


    if (chatCreationId && chatCreationId.trim() !== '') {
        $(".chatRedirection").show();
        $(document).on('click', '#redirectToChat', function() {
            if (!$('#chatContainer').length) {
                window.location.href = `/chat/${chatCreationId}`;
                return
            }
            closeAllModals();
            callFetchChatData(chatCreationId, userId);
        });
    }

    var count = 0
    const subscriptionStatus = user.subscriptionStatus == 'active'
    let isAutoGen = false

    if (subscriptionStatus) {
        $('.is-premium').each(function() {
            $(this).toggleClass('d-none')
        })
    }
    $('input, textarea').val('');

    const urlParams = new URLSearchParams(window.location.search);
    const chatImageUrl = urlParams.get('chatImage');
    if (chatImageUrl) {
        setTimeout(function() {
            $('#chatImageUrl').val(chatImageUrl).change();
        }, 500)
        $('#chatImage').attr('src', chatImageUrl).show().addClass('on');
    }

    if (isTemporaryChat == 'false' || isTemporaryChat == false) {
        fetchchatCreationData(chatCreationId, function() {
            $('.chatRedirection').show();
            $('.regenerateImages').show();
            $('#navigateToImageButton').show();
            // Initialize mobile view after data is loaded
            setTimeout(function() {
                if (window.isMobile && window.isMobile()) {
                    showMobileRightColumn();
                }
            }, 200);
        });
    }

    $('textarea').each(function() {
        resizeTextarea(this);
        $(this).on('input change', function() {
            resizeTextarea(this);
        });
    });

    function resizeTextarea(element) {
        if ($(element).val().trim() != '') {
            element.style.height = 'auto';
            element.style.height = (element.scrollHeight) + 'px';
        } else {
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
            }
        });
    }



    function saveModeration(moderationResult, chatCreationId, callback) {

        $.ajax({
            url: '/novita/save-moderation',
            method: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
                moderation: moderationResult,
                chatId: chatCreationId
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

    // Add new function for regenerating images
    function regenerateImages() {
        const $button = $('#regenerateImagesButton');
        const $generateButton = $('#generateButton');

        // Disable regenerate button during generation
        $button.prop('disabled', true);
        $button.html(`<div class="me-2 spinner-border spinner-border-sm" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>${translations.newCharacter.regenerating_images}`);

        // Also disable main generate button
        $generateButton.prop('disabled', true);

        // Show spinner overlay
        showImageSpinner();

        // Get current enhanced prompt and other settings
        const enhancedPrompt = $('#enhancedPrompt').val().trim();
        const file = $('#imageUpload')[0].files[0];
        const enableMergeFace = $('#enableMergeFace').is(':checked');

        // Check if we have the necessary data
        if (!enhancedPrompt || !chatCreationId) {
            showNotification(translations.newCharacter.regeneration_error, 'error');
            resetRegenerateButton();
            hideImageSpinner();
            return;
        }

        // Determine image type based on previous moderation (you might want to store this)
        const imageType = 'sfw'; // Default to sfw, you can enhance this later

        // Reset infinite scroll cache for new generation
        resetInfiniteScroll();

        const modelId = $('.style-option.selected').data('id')
        // Generate new images with existing prompt
        novitaImageGeneration(userId, chatCreationId, null, {
                prompt: enhancedPrompt,
                imageType,
                file,
                chatCreation: true,
                enableMergeFace: enableMergeFace,
                regenerate: true,
                modelId: modelId
            })
            .then(() => {
                resetRegenerateButton();
                $('.regenerateImages').show();
            })
            .catch((error) => {
                console.error('Error regenerating images:', error);
                hideImageSpinner();
                resetRegenerateButton();
                showNotification(translations.newCharacter.regeneration_error, 'error');
            });
    }

    function resetInfiniteScroll() {
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
                chatId: chatCreationId,
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
            const response = await $.post('/api/check-chat', {
                chatId: chatCreationId
            });
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
                data: JSON.stringify({
                    chatId: chatCreationId,
                    content
                })
            });
            return response.results[0];
        } catch (error) {
            console.error('Moderation request failed:', error);
            throw error;
        }
    }

    $('#navigateToImageButton').on('click', function() {
        showMobileRightColumn();
    });
    $('#generateButton').on('click', async function() {

        const $button = $(this);
        $button.prop('disabled', true);

        resetInfiniteScroll();
        let newchatId = await checkChat(chatCreationId)

        if (newchatId) {
            chatCreationId = newchatId
            $(document).on('click', '#redirectToChat', function() {
                if (!$('#chatContainer').length) {
                    window.location.href = `/chat/${newchatId}`;
                    return
                }
                closeAllModals();
                callFetchChatData(newchatId, userId);
            });

            // Update chatCreationId globally
            $(document).find('#imageContainer').attr('data-chat-creation-id', chatCreationId);
        }

        const prompt = characterPrompt = $('#characterPrompt').val().trim();
        const gender = 'female' || $('#gender').val();
        const name = $('#chatName').val().trim();
        const chatPurpose = $('#chatPurpose').val().trim();
        let modelId = $('#modelId').val();

        if (!modelId) {
            const initial_modelId = `{{modelId}}`
            if (initial_modelId) {
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

        $('#imageGenerationDescription').show();
        $('#characterPrompt').prop('disabled', true);
        $('#chatName').prop('disabled', true);
        $('#chatPurpose').prop('disabled', true);

        let moderationResult = {
            flagged: false
        };
        try {

            // Start image generation with enhanced prompt
            $button.html(`<div class="me-2 spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Loading...</span>
            </div>${translations.imageForm.generatingImages}`);
            $('.genexp').fadeIn();
            showImageSpinner(); // Show spinner overlay

            const imageType = moderationResult.flagged ? 'nsfw' : 'sfw';
            const file = $('#imageUpload')[0].files[0];
            const enableMergeFace = $('#enableMergeFace').is(':checked');

            let image_base64 = null;
            if (file) {
                image_base64 = await uploadAndConvertToBase64(file);
            }
            // Use new comprehensive generation route
            const comprehensiveData = {
                prompt,
                gender,
                chatPurpose,
                name,
                imageType,
                image_base64,
                enableMergeFace,
                chatId: chatCreationId,
                language: lang
            };

            const comprehensiveResponse = await $.ajax({
                url: '/api/generate-character-comprehensive',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(comprehensiveData)
            });

            // Ensure we're showing the right column on mobile after generation
            if (isMobile()) {
                showMobileRightColumn();
            }

        } catch (error) {
            console.error('Comprehensive generation error:', error);
            resetCharacterForm();
            showNotification(translations.newCharacter.character_generation_error, 'error');
        }
    });

    // Add regenerate images functionality
    $('#regenerateImagesButton').on('click', function() {
        // Stay on right column during regeneration on mobile
        regenerateImages();
    });

    // Make mobile navigation functions globally available
    window.isMobile = isMobile;
    window.showMobileLeftColumn = showMobileLeftColumn;
    window.showMobileRightColumn = showMobileRightColumn;


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

                // Show and enable merge face toggle when image is uploaded
                $('#mergeFaceContainer').show();
                $('#enableMergeFace').prop('disabled', false);
            };
            reader.readAsDataURL(file);
        } else {
            showNotification(translations.imageForm.image_invalid_format, 'error');
            // Hide merge face toggle for invalid files
            $('#mergeFaceContainer').hide();
            $('#enableMergeFace').prop('disabled', true).prop('checked', false);
        }
    }


    // Helper function to reset regenerate button state
    function resetRegenerateButton() {
        const $button = $('#regenerateImagesButton');
        const $generateButton = $('#generateButton');

        $button.prop('disabled', false);
        $button.html('<i class="bi bi-arrow-clockwise me-2"></i>' + translations.newCharacter.regenerate_images);

        $generateButton.prop('disabled', false);
    }

    function resetChatList() {
        const imageModel = $('.style-option.selected').data('model')
        $(document).find(`#imageStyleTabs button[data-model="${imageModel}"]`).click()
    }
    // Global function to update chat data in the frontend
    window.updateChatData = function(chatData) {
        if (!chatData) return;

        $('#chatName').val(chatData.name || '');
        $('#chatPurpose').val(chatData.short_intro || '');

        // Show relevant UI elements
        $('.chatRedirection').show();
        $('.regenerateImages').show();
        $('#navigateToImageButton').show();

        // Reset form state
        resetCharacterForm();

    };

    // Global function to update enhanced prompt in the frontend
    window.updateEnhancedPrompt = function(enhancedPrompt) {
        if (!enhancedPrompt) return;

        $('#enhancedPrompt').val(enhancedPrompt);

        // Resize textarea if needed
        const promptTextarea = $('#enhancedPrompt')[0];
        if (promptTextarea && typeof resizeTextarea === 'function') {
            resizeTextarea(promptTextarea);
        }
    };

    window.saveSelectedImage = function(imageUrl, callback) {
        $.ajax({
            url: '/novita/save-image',
            method: 'POST',
            dataType: 'json',
            data: {
                imageUrl,
                chatId: chatCreationId
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
    window.generateCharacterImage = function(url, nsfw, receivedChatCreationId) {
        const $imageContainer = $(document).find('#imageContainer[data-chat-creation-id="' + receivedChatCreationId + '"]');
        if (!$imageContainer.length) {
            console.error('Image container not found for chat creation ID:', receivedChatCreationId);
            return;
        }
        // Clear the container
        $imageContainer.find('#generatedImage').remove();
        $imageContainer.find('#imageGenerationDescription').hide();

        // For each image URL, create an image element and append to the container
        const colDiv = $('<div>').addClass('col-12 mb-3');
        const imgElement = $('<img>')
            .attr('src', url)
            .addClass('img-fluid img-thumbnail')
            .css('cursor', 'pointer');

        // Add click handler to each image
        imgElement.on('click', function() {
            $('.img-thumbnail').each(function() {
                $(this).removeClass('select')
            });
            $(this).addClass('select');

            // Save the selected image
            saveSelectedImage(url, function(error, response) {
                if (error) {
                    showNotification(translations.imageForm.image_save_failed, 'error');
                } else {
                    showNotification(translations.imageForm.image_saved, 'success');
                    resetChatList();
                }
            });
        });

        colDiv.append(imgElement);
        $imageContainer.append(colDiv);

        $('.regenerateImages').show();
        $('#regenerateImagesButton').show();
        $('#navigateToImageButton').show();
        //getTimer(chatCreationId)
    }

    // Add character update functionality
    window.loadCharacterUpdatePage = function(chatId) {
        if (!chatId) {
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
            }
        });
    };

    // Mobile navigation state
    let isMobileViewInitialized = false;

    // Check if we're on mobile
    function isMobile() {
        return window.innerWidth <= 768;
    }

    // Initialize mobile view based on chat data availability
    function initializeMobileView() {
        if (!isMobile() || isMobileViewInitialized) return;

        isMobileViewInitialized = true;

        // Check if chat data exists (image or other data)
        const hasExistingImage = $('#generatedImage').attr('src') !== '/img/default-character.png';
        const hasRegenerateButton = $('.regenerateImages').is(':visible');

        if (hasExistingImage || hasRegenerateButton || (isTemporaryChat === 'false' || isTemporaryChat === false)) {
            // Show right column first if chat data exists
            showMobileRightColumn();
        } else {
            // Show left column first for new character creation
            showMobileLeftColumn();
        }
    }

    // Show mobile left column (form)
    function showMobileLeftColumn() {
        if (!isMobile()) return;

        $('.modal-sidebar-fixed').removeClass('mobile-hidden');
        $('.modal-main-content').removeClass('mobile-visible mobile-visible-initial');
    }

    // Show mobile right column (image)
    function showMobileRightColumn() {
        if (!isMobile()) return;

        $('.modal-sidebar-fixed').addClass('mobile-hidden');
        $('.modal-main-content').addClass('mobile-visible');
    }

    // Back button functionality
    $(document).on('click', '#backToSidebar', function() {
        showMobileLeftColumn();
    });

    // Handle window resize
    $(window).on('resize', function() {
        if (!isMobile()) {
            // Reset mobile classes when not on mobile
            $('.modal-sidebar-fixed').removeClass('mobile-hidden');
            $('.modal-main-content').removeClass('mobile-visible mobile-visible-initial');
            isMobileViewInitialized = false;
        } else {
            initializeMobileView();
        }
    });

    // Initialize mobile view on page load
    setTimeout(function() {
        initializeMobileView();
    }, 100);

})();