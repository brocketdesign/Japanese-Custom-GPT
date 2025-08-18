$(document).ready(function() {
    let originalDetails = null;
    let originalChatData = null;
    let availableModels = [];
    const chatId = $.cookie('character-update-id');
    
    // Load character data and available models
    Promise.all([
        loadCharacterData(chatId),
        loadAvailableModels()
    ]);

    // Load available models
    function loadAvailableModels() {
        return $.ajax({
            url: '/api/models',
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    availableModels = response.models;
                    populateModelSelect();
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading models:', error);
            }
        });
    }

    // Populate model select dropdown
    function populateModelSelect() {
        const $select = $('#model_newModel');
        $select.empty().append('<option value="">{{translations.characterUpdate.selectNewModel}}</option>');
        
        availableModels.forEach(model => {
            $select.append(`
                <option value="${model.modelId}" 
                        data-style="${model.style}" 
                        data-image="${model.image}"
                        data-model="${model.model}">
                    ${model.style} (${model.model})
                </option>
            `);
        });
    }

    // Handle model selection change
    $('#model_newModel').on('change', function() {
        const selectedOption = $(this).find('option:selected');
        const modelId = selectedOption.val();
        
        if (modelId) {
            const style = selectedOption.data('style');
            const image = selectedOption.data('image');
            const model = selectedOption.data('model');
            
            $('#newModelImage').attr('src', image);
            $('#newModelName').text(model);
            $('#newModelStyle').text(style);
            $('#newModelPreview').show();
        } else {
            $('#newModelPreview').hide();
        }
    });

    // Load character data
    function loadCharacterData(chatId) {
        return $.ajax({
            url: `/api/character-details/${chatId}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    originalDetails = response.chat.details_description || {};
                    originalChatData = response.chat;
                    populateForm(response.chat);
                } else {
                    showNotification('Failed to load character data', 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading character data:', error);
                showNotification('Failed to load character data', 'error');
            }
        });
    }

    // Populate form with character data
    function populateForm(chatData) {
        const details = chatData.details_description || {};
        
        // Basic character info in header
        $('#characterName').text(chatData.name || 'Unnamed Character');
        $('#characterGender').text(chatData.gender || 'Not specified');
        $('#characterUpdatedAt').text(chatData.updatedAt || '-');
        $('#characterMessagesCount').text(chatData.messagesCount || 0);
        $('#characterImageCount').text(chatData.imageCount || 0);
        
        if (chatData.chatImageUrl) {
            $('#characterImage').attr('src', chatData.chatImageUrl).show();
        }

    
        // Check subscription status for NSFW toggle
        const subscriptionStatus = typeof user !== 'undefined' && user.subscriptionStatus === 'active';
        const currentNsfw = chatData.nsfw || false;
        
        // Populate NSFW field with subscription check
        if (subscriptionStatus) {
            $('#basic_nsfw').prop('disabled', false).val(currentNsfw ? 'true' : 'false');
            $('#nsfwPremiumPrompt').hide();
        } else {
            $('#basic_nsfw').prop('disabled', true).val('false');
            if (currentNsfw) {
                // Show warning that NSFW is disabled due to subscription
                $('#nsfwPremiumPrompt').show();
            }
        }
        // Populate basic information fields from chat document
        $('#basic_name').val(chatData.name || '');
        $('#basic_slug').val(chatData.slug || '');
        $('#basic_short_intro').val(chatData.short_intro || '');
        $('#basic_description').val(chatData.description || '');
        $('#basic_gender').val(chatData.gender || '');
        $('#basic_nsfw').val(chatData.nsfw ? 'true' : 'false');

        // Populate character prompts
        $('#prompts_characterPrompt').val(chatData.characterPrompt || '');
        $('#prompts_enhancedPrompt').val(chatData.enhancedPrompt || '');
        $('#prompts_systemPrompt').val(chatData.system_prompt || '');
        $('#prompts_firstMessage').val(chatData.first_message || '');
        if (chatData.tags && Array.isArray(chatData.tags)) {
            $('#prompts_tags').val(chatData.tags.join(', '));
        }
        
        // Display current model information
        $('#currentModelId').text(chatData.modelId || '-');
        if (chatData.modelId) {
            const currentModel = availableModels.find(m => m.modelId === chatData.modelId);
            if (currentModel) {
                $('#currentModelImage').attr('src', currentModel.image).show();
                $('#currentModelName').text(currentModel.model);
                $('#currentModelStyle').text(currentModel.style);
            } else {
                $('#currentModelName').text(chatData.imageModel || 'Unknown Model');
                $('#currentModelStyle').text(chatData.imageStyle || '-');
            }
        } else {
            $('#currentModelName').text('No model assigned');
            $('#currentModelStyle').text('-');
        }

        // Populate all detailed form sections (NOT as JSON)
        populateFormSection(details.appearance, 'appearance');
        populateFormSection(details.face, 'face');
        populateFormSection(details.hair, 'hair');
        populateFormSection(details.body, 'body');
        populateFormSection(details.style, 'style');
        populateFormSection(details.personality, 'personality');

        // Show/hide gender-specific fields based on current gender
        const currentGender = chatData.gender;
        toggleGenderSpecificFields(currentGender);

        // Handle gender change events
        $('#basic_gender').on('change', function() {
            toggleGenderSpecificFields($(this).val());
        });
    }

    // Auto-generate slug from name
    $('#basic_name').on('input', function() {
        const name = $(this).val();
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        $('#basic_slug').val(slug);
    });

    // Populate a specific form section
    function populateFormSection(sectionData, sectionName) {
        if (!sectionData) return;

        Object.keys(sectionData).forEach(key => {
            const value = sectionData[key];
            const fieldId = `${sectionName}_${key}`;
            const $field = $(`#${fieldId}`);
            
            if ($field.length) {
                // Handle undefined/null values
                const displayValue = (value === undefined || value === null) ? '' : value;
                
                if ($field.is('select')) {
                    $field.val(displayValue);
                } else if ($field.attr('type') === 'text' || $field.is('textarea')) {
                    $field.val(displayValue);
                } else if (Array.isArray(value)) {
                    $field.val(value.join(', '));
                } else if ($field.hasClass('array-field') && displayValue) {
                    // Handle array fields that might be stored as strings
                    const arrayValue = Array.isArray(displayValue) ? displayValue.join(', ') : displayValue;
                    $field.val(arrayValue);
                }
            }
        });
    }

    // Toggle gender-specific fields
    function toggleGenderSpecificFields(gender) {
        const $femaleFields = $('.female-specific');
        const $maleFields = $('.male-specific');
        
        if (gender === 'female') {
            $femaleFields.show();
            $maleFields.hide();
        } else if (gender === 'male') {
            $femaleFields.hide();
            $maleFields.show();
        } else {
            $femaleFields.show();
            $maleFields.show();
        }
    }

    // Collect data from a specific section
    function collectSectionData(sectionName) {
        const sectionData = {};
        const $section = $(`.${sectionName}-section`);
        
        $section.find('input, select, textarea').each(function() {
            const $field = $(this);
            const fieldName = $field.attr('name');
            
            if (fieldName && fieldName.startsWith(`${sectionName}_`)) {
                const key = fieldName.replace(`${sectionName}_`, '');
                let value = $field.val();
                
                // Handle array fields
                if ($field.hasClass('array-field')) {
                    value = value ? value.split(',').map(item => item.trim()).filter(item => item) : null;
                }
                
                // Convert empty strings to null
                sectionData[key] = value === '' ? null : value;
            }
        });
        
        return sectionData;
    }

    // Collect form data (structured, not JSON)
    function collectFormData() {
        const details = {
            appearance: collectSectionData('appearance'),
            face: collectSectionData('face'),
            hair: collectSectionData('hair'),
            body: collectSectionData('body'),
            style: collectSectionData('style'),
            personality: collectSectionData('personality')
        };

        return details;
    }

    // Collect basic data (from chat-level fields)
    function collectBasicData() {
        const subscriptionStatus = typeof user !== 'undefined' && user.subscriptionStatus === 'active';

        return {
            name: $('#basic_name').val() || null,
            slug: $('#basic_slug').val() || null,
            short_intro: $('#basic_short_intro').val() || null,
            description: $('#basic_description').val() || null,
            gender: $('#basic_gender').val() || null,
            nsfw: subscriptionStatus && $('#basic_nsfw').val() === 'true'
        };
    }

    // Collect prompt data
    function collectPromptData() {
        const tags = $('#prompts_tags').val();
        return {
            characterPrompt: $('#prompts_characterPrompt').val() || null,
            enhancedPrompt: $('#prompts_enhancedPrompt').val() || null,
            system_prompt: $('#prompts_systemPrompt').val() || null,
            first_message: $('#prompts_firstMessage').val() || null,
            tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : null
        };
    }

    // Collect model update data
    function collectModelUpdate() {
        const selectedOption = $('#model_newModel').find('option:selected');
        const modelId = selectedOption.val();
        
        if (modelId) {
            return {
                modelId: modelId,
                imageModel: selectedOption.data('model'),
                imageStyle: selectedOption.data('style')
            };
        }
        return null;
    }

    // Save character updates
    $(document).on('click', '#saveCharacterUpdate', function() {
        if (!chatId) {
            showNotification('No character selected', 'error');
            return;
        }

        const $button = $(this);
        $button.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2"></span>Saving...');

        const details = collectFormData();
        const basicData = collectBasicData();
        const prompts = collectPromptData();
        const modelUpdate = collectModelUpdate();

        const requestData = { 
            details_description: details,
            basicData: basicData,
            prompts: prompts
        };
        if (modelUpdate) {
            requestData.modelUpdate = modelUpdate;
        }

        $.ajax({
            url: `/api/character-details/${chatId}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(requestData),
            success: function(response) {
                if (response.success) {
                    showNotification('Character details updated successfully', 'success');
                    $('#characterUpdateModal').modal('hide');
                    
                    // Refresh character data if on chat page
                    if (typeof callFetchChatData === 'function') {
                        callFetchChatData(chatId, userId);
                    }
                } else {
                    showNotification('Failed to update character details', 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error updating character:', error);
                showNotification('Failed to update character details', 'error');
            },
            complete: function() {
                $button.prop('disabled', false).html('<i class="bi bi-check-lg me-2"></i>Save Changes');
            }
        });
    });

    // Reset form to original values
    $(document).on('click', '#resetCharacterForm', function() {
        if (originalChatData) {
            populateForm(originalChatData);
            showNotification('Form reset to original values', 'info');
        }
    });

    // Clear form
    $(document).on('click', '#clearCharacterForm', function() {
        $('.character-update-form')[0].reset();
        showNotification('Form cleared', 'info');
    });
});
