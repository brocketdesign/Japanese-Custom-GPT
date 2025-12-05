(function() {

    fetchAndAppendModels();

    if (typeof chatCreationId === 'undefined') {
        window.chatCreationId = '';
    }
    if (typeof isTemporaryChat === 'undefined') {
        window.isTemporaryChat = true;
    }
    
    // Initialize data-chat-creation-id attribute at page load
    setTimeout(function() {
        const $imageContainer = $(document).find('#imageContainer');
        if ($imageContainer.length) {
            const currentDataId = $imageContainer.attr('data-chat-creation-id');
            if (!currentDataId || currentDataId === '') {
                $imageContainer.attr('data-chat-creation-id', window.chatCreationId);
                console.log(`[Init] Set initial data-chat-creation-id to: ${window.chatCreationId}`);
            }
            
            // Process any pending character images that arrived before the container was ready
            console.log(`[Init] Checking for pending character images...`);
            if (window.pendingCharacterImages && window.pendingCharacterImages.length > 0) {
                console.log(`[Init] Found ${window.pendingCharacterImages.length} pending images, processing...`);
                while (window.pendingCharacterImages.length > 0) {
                    const { imageUrl, nsfw, chatId } = window.pendingCharacterImages.shift();
                    console.log(`[Init] Processing pending image - chatId: ${chatId}`);
                    
                    // Sync if needed
                    if (chatId && chatId !== window.chatCreationId) {
                        if (window.syncChatCreationId) {
                            window.syncChatCreationId(chatId);
                        }
                    }
                    
                    generateCharacterImage(imageUrl, nsfw, chatId);
                }
            }
        }
    }, 100);

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
        $('#userCustomChatPurpose').prop('disabled', false);
        $('#generateButton').prop('disabled', false);
        $('#generateButton').html('<i class="bi bi-magic me-2"></i>' + translations.newCharacter.generate_with_AI);

        // Reset regenerate button if it was disabled
        resetRegenerateButton();
    }

    // Add these functions to window for global access
    window.showImageSpinner = showImageSpinner;
    window.hideImageSpinner = hideImageSpinner;
    window.resetCharacterForm = resetCharacterForm;

    // Helper function to sync chatCreationId with data-chat-creation-id attribute
    function syncChatCreationId(newId) {
        const oldId = window.chatCreationId;
        window.chatCreationId = newId;
        $(document).find('#imageContainer').attr('data-chat-creation-id', newId);
        
        if (oldId !== newId) {
            console.log(`[chatCreationId] Synced: ${oldId} → ${newId}`);
        }
        
        return newId;
    }
    
    // Helper function to verify and fix sync between chatCreationId and data-chat-creation-id
    function verifyChatIdSync() {
        const windowId = window.chatCreationId;
        const $imageContainer = $(document).find('#imageContainer');
        const attributeId = $imageContainer.attr('data-chat-creation-id');
        
        const isSynced = windowId === attributeId;
        const status = isSynced ? '✓ SYNCED' : '✗ OUT OF SYNC';
        
        console.log(`[verifyChatIdSync] ${status}`);
        console.log(`  window.chatCreationId: ${windowId}`);
        console.log(`  data-chat-creation-id: ${attributeId}`);
        
        if (!isSynced) {
            console.log(`[verifyChatIdSync] Fixing sync...`);
            syncChatCreationId(windowId);
            console.log(`[verifyChatIdSync] Sync fixed`);
        }
        
        return isSynced;
    }
    
    window.syncChatCreationId = syncChatCreationId;
    window.verifyChatIdSync = verifyChatIdSync;
    
    // Monitor for dynamic container creation (handles post-refresh scenarios)
    const containerObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Check if #imageContainer was added
                let containerAdded = false;
                mutation.addedNodes.forEach(function(node) {
                    if (node.id === 'imageContainer' || (node.querySelectorAll && node.querySelectorAll('#imageContainer').length > 0)) {
                        containerAdded = true;
                    }
                });
                
                if (containerAdded && window.pendingCharacterImages && window.pendingCharacterImages.length > 0) {
                    console.log(`[MutationObserver] #imageContainer detected in DOM, processing ${window.pendingCharacterImages.length} pending images`);
                    
                    // Small delay to ensure container is fully rendered
                    setTimeout(function() {
                        while (window.pendingCharacterImages && window.pendingCharacterImages.length > 0) {
                            const { imageUrl, nsfw, chatId } = window.pendingCharacterImages.shift();
                            console.log(`[MutationObserver] Processing queued image - chatId: ${chatId}`);
                            
                            if (chatId && chatId !== window.chatCreationId) {
                                if (window.syncChatCreationId) {
                                    window.syncChatCreationId(chatId);
                                }
                            }
                            
                            if (window.generateCharacterImage) {
                                generateCharacterImage(imageUrl, nsfw, chatId);
                            }
                        }
                    }, 100);
                }
            }
        });
    });
    
    // Start observing the document for container additions
    containerObserver.observe(document.body, {
        childList: true,
        subtree: true
    });


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

        // Save the selected model immediately
        saveSelectedImageModel(chatCreationId, function(error, response) {
            if (error) {
                console.error('Error saving selected image model:', error);
            }
        });
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
        $('#characterCreationModal .is-premium').each(function() {
            $(this).toggleClass('d-none')
        })
    }

    // Enable NSFW toggle for premium users only
    if (subscriptionStatus) {
        $('#basic_nsfw').prop('disabled', false);
        $('#nsfwPremiumPrompt').hide();
        updateNsfwToggleState(false); 
    } else {
        $('#basic_nsfw').prop('disabled', true).prop('checked', false);
        $('#nsfwPremiumPrompt').show();
        updateNsfwToggleState(false); 
    }
    
    // Handle NSFW toggle click - both checkbox and slider
    $('#basic_nsfw, .nsfw-switch-slider').on('click', function(e) {
        // If clicked on slider, toggle the checkbox
        if ($(this).hasClass('nsfw-switch-slider')) {
            const $checkbox = $('#basic_nsfw');
            if (!$checkbox.prop('disabled')) {
                $checkbox.prop('checked', !$checkbox.prop('checked')).trigger('change');
            }
            return;
        }
        
        // Handle checkbox click for non-premium users
        if (!subscriptionStatus && $(this).is(':checked')) {
            $(this).prop('checked', false);
            showUpgradePopup('nsfw-content');
            return false;
        }
    });

    // Handle NSFW toggle state change
    $('#basic_nsfw').on('change', function() {
        const isChecked = $(this).is(':checked');
        updateNsfwToggleState(isChecked);
    });

    // Function to update NSFW toggle visual state
    function updateNsfwToggleState(isEnabled) {
        const $container = $('#nsfwToggleContainer');
        const $statusIndicator = $('#nsfwStatusIndicator');
        
        if (isEnabled) {
            $container.removeClass('nsfw-disabled').addClass('enabled');
            $statusIndicator.removeClass('disabled').addClass('enabled');
            $statusIndicator.text(translations.newCharacter.nsfw || 'NSFW');
        } else {
            $container.removeClass('enabled').addClass('nsfw-disabled');
            $statusIndicator.removeClass('enabled').addClass('disabled');
            $statusIndicator.text(translations.newCharacter.sfw || 'SFW');
        }
    }

    // Prevent default behavior on slider to avoid double-triggering
    $('.nsfw-switch').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });


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



    // Initialize keyword cloud after DOM is ready
    $(document).ready(function() {
        // Add delay to ensure translations are loaded
        setTimeout(function() {
            initializeKeywordCloud();
        }, 500);
    });

    // Initialize the keyword cloud
    function initializeKeywordCloud() {
        // Check if translations are available
        if (typeof translations === 'undefined' || !translations.newCharacter?.keywordSections) {
            console.log('Translations not yet loaded, retrying...');
            setTimeout(initializeKeywordCloud, 1000);
            return;
        }

        const keywordSections = ['personality', 'occupation', 'hobbies', 'style', 'traits'];
        
        keywordSections.forEach(section => {
            const sectionContainer = $(`.keyword-tags[data-section="${section}"]`);
            const keywords = translations.newCharacter?.keywords?.[section];
            
            if (keywords && sectionContainer.length) {
                // Clear existing content
                sectionContainer.empty();
                
                // Add keywords as clickable tags
                Object.keys(keywords).forEach(key => {
                    const keyword = keywords[key];
                    const keywordTag = $(`
                        <span class="keyword-tag" 
                            data-section="${section}" 
                            data-keyword="${key}"
                            data-value="${keyword}">
                            ${keyword}
                        </span>
                    `);
                    
                    sectionContainer.append(keywordTag);
                });

                // Add section counter display
                const sectionTitle = sectionContainer.closest('.keyword-section').find('.keyword-section-title');
                if (sectionTitle.length && !sectionTitle.find('.keyword-counter').length) {
                    sectionTitle.append(`<span class="keyword-counter ms-2 text-muted">(0/3)</span>`);
                }
            }
        });

        // Update section titles with translations
        $('.keyword-section-title [data-translate]').each(function() {
            const key = $(this).data('translate');
            const translation = getTranslationByKey(key);
            if (translation) {
                $(this).text(translation);
            }
        });

        // Update "Selected Keywords" text
        $('.selected-keywords-container h6').html(
            `<i class="bi bi-check-circle me-2"></i>${translations.newCharacter?.selectedKeywords || 'Selected Keywords:'}`
        );

        // Update placeholder text
        $('#selectedKeywords .text-muted').text(
            translations.newCharacter?.clickKeywordsPlaceholder || 'Click keywords above to add them...'
        );
    }

    // Helper function to get nested translation
    function getTranslationByKey(key) {
        const keys = key.split('.');
        let value = translations;
        
        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                return null;
            }
        }
        
        return value;
    }

    // Handle keyword tag clicks
    $(document).on('click', '.keyword-tag', function() {
        const $tag = $(this);
        const keyword = $tag.data('value');
        const section = $tag.data('section');
        const isSelected = $tag.hasClass('selected');
        const isDisabled = $tag.hasClass('disabled');
        
        // Don't allow clicking on disabled tags
        if (isDisabled && !isSelected) {
            // Show a brief message about the limit
            showLimitMessage($tag, section);
            return;
        }
        
        if (isSelected) {
            // Remove keyword
            $tag.removeClass('selected');
            removeKeywordFromPurpose(keyword);
        } else {
            // Check if we can add more keywords to this section
            const selectedCount = getSelectedKeywordsCountInSection(section);
            if (selectedCount >= 3) {
                showLimitMessage($tag, section);
                return;
            }
            
            // Add keyword
            $tag.addClass('selected');
            addKeywordToPurpose(keyword);
        }
        
        // Update counters and availability for this section
        updateSectionCounter(section);
        updateSectionAvailability(section);
        
        updateSelectedKeywordsDisplay();
        updateChatPurposeTextarea();
    });

    // Add keyword to the purpose
    function addKeywordToPurpose(keyword) {
        const currentPurpose = $('#chatPurpose').val();
        const keywords = currentPurpose ? currentPurpose.split(', ').filter(k => k.trim()) : [];
        
        if (!keywords.includes(keyword)) {
            keywords.push(keyword);
            $('#chatPurpose').val(keywords.join(', '));
        }
    }

    // Remove keyword from the purpose  
    function removeKeywordFromPurpose(keyword) {
        const currentPurpose = $('#chatPurpose').val();
        const keywords = currentPurpose ? currentPurpose.split(', ').filter(k => k.trim()) : [];
        const filteredKeywords = keywords.filter(k => k !== keyword);
        
        $('#chatPurpose').val(filteredKeywords.join(', '));
    }

    // Update the visual display of selected keywords
    function updateSelectedKeywordsDisplay() {
        const selectedKeywordsBySection = {};
        const keywordSections = ['personality', 'occupation', 'hobbies', 'style', 'traits'];
        
        // Group selected keywords by section
        $('.keyword-tag.selected').each(function() {
            const section = $(this).data('section');
            const keyword = $(this).data('value');
            
            if (!selectedKeywordsBySection[section]) {
                selectedKeywordsBySection[section] = [];
            }
            selectedKeywordsBySection[section].push(keyword);
        });
        
        const $display = $('#selectedKeywords');
        
        if (Object.keys(selectedKeywordsBySection).length === 0) {
            const placeholderText = translations.newCharacter?.clickKeywordsPlaceholder || 'Click keywords above to add them...';
            $display.html(`<span class="text-muted">${placeholderText}</span>`);
        } else {
            let html = '';
            
            keywordSections.forEach(section => {
                if (selectedKeywordsBySection[section] && selectedKeywordsBySection[section].length > 0) {
                    const sectionName = getTranslationByKey(`newCharacter.keywordSections.${section}`) || section;
                    const sectionKeywords = selectedKeywordsBySection[section];
                    
                    html += `<div class="selected-section mb-2">
                        <small class="section-label text-muted fw-bold">${sectionName}:</small><br>
                        ${sectionKeywords.map(keyword => 
                            `<span class="selected-keyword">${keyword}</span>`
                        ).join(' ')}
                    </div>`;
                }
            });
            
            $display.html(html);
        }
    }

    // Update the hidden textarea
    function updateChatPurposeTextarea() {
        const selectedKeywords = [];
        $('.keyword-tag.selected').each(function() {
            selectedKeywords.push($(this).data('value'));
        });
        
        $('#chatPurpose').val(selectedKeywords.join(', '));
    }

    // Helper function to count selected keywords in a section
    function getSelectedKeywordsCountInSection(section) {
        return $(`.keyword-tag[data-section="${section}"].selected`).length;
    }

    // Helper function to update section counter
    function updateSectionCounter(section) {
        const count = getSelectedKeywordsCountInSection(section);
        const counter = $(`.keyword-tags[data-section="${section}"]`).closest('.keyword-section').find('.keyword-counter');
        if (counter.length) {
            counter.text(`(${count}/3)`);
            // Change color based on limit
            if (count >= 3) {
                counter.removeClass('text-muted').addClass('text-warning fw-bold');
            } else {
                counter.removeClass('text-warning fw-bold').addClass('text-muted');
            }
        }
    }

    // Helper function to update section availability
    function updateSectionAvailability(section) {
        const selectedCount = getSelectedKeywordsCountInSection(section);
        const sectionContainer = $(`.keyword-tags[data-section="${section}"]`);
        
        // If 3 keywords are selected, disable non-selected keywords in this section
        if (selectedCount >= 3) {
            sectionContainer.find('.keyword-tag:not(.selected)').addClass('disabled');
        } else {
            sectionContainer.find('.keyword-tag').removeClass('disabled');
        }
    }

    // Function to show limit message
    function showLimitMessage($tag, section) {
        // Get section name from translations
        const sectionName = getTranslationByKey(`newCharacter.keywordSections.${section}`) || section;
        const message = `Maximum 3 keywords per section (${sectionName})`;
        
        // Create temporary tooltip
        const tooltip = $(`<div class="keyword-limit-tooltip">${message}</div>`);
        tooltip.css({
            position: 'absolute',
            background: '#dc3545',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        });
        
        // Position tooltip near the clicked tag
        const tagOffset = $tag.offset();
        tooltip.css({
            top: tagOffset.top - 40,
            left: tagOffset.left + ($tag.width() / 2) - (tooltip.width() / 2)
        });
        
        $('body').append(tooltip);
        
        // Add visual feedback to the tag
        $tag.addClass('limit-reached');
        
        // Remove tooltip and visual feedback after 2 seconds
        setTimeout(() => {
            tooltip.fadeOut(200, () => tooltip.remove());
            $tag.removeClass('limit-reached');
        }, 2000);
    }
    // Load existing keywords when editing a character
    function loadExistingKeywords(chatPurpose) {
        if (!chatPurpose) return;
        
        const keywords = chatPurpose.split(', ').map(k => k.trim()).filter(k => k);
        
        // Clear all selections first
        $('.keyword-tag').removeClass('selected disabled');
        
        // Reset all counters
        $('.keyword-counter').text('(0/3)').removeClass('text-warning fw-bold').addClass('text-muted');
        
        // Select matching keywords
        keywords.forEach(keyword => {
            const $tag = $(`.keyword-tag[data-value="${keyword}"]`);
            if ($tag.length) {
                $tag.addClass('selected');
                const section = $tag.data('section');
                updateSectionCounter(section);
                updateSectionAvailability(section);
            }
        });
        
        updateSelectedKeywordsDisplay();
    }

    // Update the existing fetchchatCreationData function to load keywords
    const originalFetchchatCreationData = window.fetchchatCreationData || fetchchatCreationData;

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
        $button.html(`<i class="bi bi-arrow-clockwise spin"></i>${translations.newCharacter.regenerating_images}`);

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
        // Professional logging of the model, with separator and colors and emojis
        console.log('%c🚀 Regenerating images with model:', 'color: #4CAF50; font-weight: bold; font-size: 16px;', modelId);
        // NEW: Save the selected model before regenerating to ensure it's persisted
        saveSelectedImageModel(chatCreationId, function(error, response) {
            if (error) {
                console.error('Error saving selected image model during regeneration:', error);
                // Optionally show a notification or abort regeneration
                resetRegenerateButton();
                hideImageSpinner();
                return;
            }
            
            // Proceed with generation after saving
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
            syncChatCreationId(newchatId);
            
            $(document).on('click', '#redirectToChat', function() {
                if (!$('#chatContainer').length) {
                    window.location.href = `/chat/${newchatId}`;
                    return
                }
                closeAllModals();
                callFetchChatData(newchatId, userId);
            });
        }

        const prompt = characterPrompt = $('#characterPrompt').val().trim();
        const gender = $('#gender').val();
        const name = $('#chatName').val().trim();
        const userCustomChatPurpose = $('#userCustomChatPurpose').val().trim();
        const chatPurpose = userCustomChatPurpose + ', ' + $('#chatPurpose').val().trim();
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
        $('#userCustomChatPurpose').prop('disabled', true);

        let moderationResult = {
            flagged: false
        };
        try {

            // Start image generation with enhanced prompt
            $button.html(`${translations.imageForm.generatingImages}`);
            $('.genexp').fadeIn();
            showImageSpinner(); // Show spinner overlay

            const imageType = moderationResult.flagged ? 'nsfw' : 'sfw';
            const file = $('#imageUpload')[0].files[0];
            const enableMergeFace = $('#enableMergeFace').is(':checked');

            let image_base64 = null;
            if (file) {
                image_base64 = await uploadAndConvertToBase64(file);
            }
            const nsfw = subscriptionStatus && $('#basic_nsfw').is(':checked');
            // Use new comprehensive generation route
            const comprehensiveData = {
                prompt,
                gender,
                chatPurpose,
                name,
                nsfw,
                imageType: nsfw ? 'nsfw' : 'sfw',
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


    window.previewImage = function(event) {
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
        console.log(`[generateCharacterImage] CALLED with url, nsfw: ${nsfw}, receivedChatCreationId: ${receivedChatCreationId}`);
        console.log(`[generateCharacterImage] Current state - window.chatCreationId: ${window.chatCreationId}`);
        
        // Ensure data-chat-creation-id is in sync with the current chatCreationId
        const currentId = window.chatCreationId || '';
        
        if (receivedChatCreationId !== currentId && currentId) {
            console.warn(`[generateCharacterImage] Chat ID mismatch. Received: ${receivedChatCreationId}, Current: ${currentId}. Syncing received ID.`);
            syncChatCreationId(receivedChatCreationId);
        }
        
        // Try to find container by received ID first
        let $imageContainer = $(document).find('#imageContainer[data-chat-creation-id="' + receivedChatCreationId + '"]');
        
        if (!$imageContainer.length) {
            console.warn(`[generateCharacterImage] Container not found for received ID: ${receivedChatCreationId}`);
            
            // Fallback 1: Try finding by current window ID
            if (currentId && currentId !== receivedChatCreationId) {
                console.log(`[generateCharacterImage] Attempting fallback with current ID: ${currentId}`);
                $imageContainer = $(document).find('#imageContainer[data-chat-creation-id="' + currentId + '"]');
                
                if ($imageContainer.length) {
                    console.log(`[generateCharacterImage] Found container using current ID, syncing both`);
                    syncChatCreationId(receivedChatCreationId);
                    // Re-query to ensure attribute is updated
                    $imageContainer = $(document).find('#imageContainer[data-chat-creation-id="' + receivedChatCreationId + '"]');
                }
            }
            
            // Fallback 2: Try finding any #imageContainer (last resort)
            if (!$imageContainer.length) {
                console.log(`[generateCharacterImage] Using fallback - finding any #imageContainer`);
                const $anyContainer = $(document).find('#imageContainer');
                
                if ($anyContainer.length) {
                    console.log(`[generateCharacterImage] Found generic container, syncing ID`);
                    syncChatCreationId(receivedChatCreationId);
                    // Re-query with synced ID
                    $imageContainer = $(document).find('#imageContainer[data-chat-creation-id="' + receivedChatCreationId + '"]');
                    
                    if (!$imageContainer.length) {
                        $imageContainer = $anyContainer;
                    }
                }
            }
        }
        
        if (!$imageContainer.length) {
            console.error(`[generateCharacterImage] CRITICAL: Image container not found for chat ID: ${receivedChatCreationId}, current: ${currentId}`);
            console.error(`[generateCharacterImage] Available containers:`, $(document).find('#imageContainer').length);
            return;
        }
        
        console.log(`[generateCharacterImage] Successfully found container for ID: ${receivedChatCreationId}`);
        generateImageInContainer($imageContainer, url);
    };
    
    // Helper function to generate image in a container
    function generateImageInContainer($imageContainer, url) {
        console.log(`[generateImageInContainer] Called with container data-chat-creation-id: ${$imageContainer.attr('data-chat-creation-id')}`);
        
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
                    console.error(`[generateImageInContainer] Error saving image:`, error);
                    showNotification(translations.imageForm.image_save_failed, 'error');
                } else {
                    console.log(`[generateImageInContainer] Image saved successfully`);
                    showNotification(translations.imageForm.image_saved, 'success');
                    resetChatList();
                }
            });

            // Save the selected image model
            const containerChatId = $imageContainer.attr('data-chat-creation-id');
            saveSelectedImageModel(containerChatId, function(error, response) {
                if (error) {
                    console.error('Error saving selected image model:', error);
                }
            });
        });

        colDiv.append(imgElement);
        $imageContainer.append(colDiv);
        
        console.log(`[generateImageInContainer] Image element appended to container`);

        $('.regenerateImages').show();
        $('#regenerateImagesButton').show();
        $('#navigateToImageButton').show();
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