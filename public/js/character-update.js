$(document).ready(function() {
    let originalDetails = null;
    const chatId = $.cookie('character-update-id');
    // Load character data
    loadCharacterData(chatId);

    // Load character data
    function loadCharacterData(chatId) {
        $.ajax({
            url: `/api/character-details/${chatId}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    originalDetails = response.chat.details_description || {};
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
        
        // Basic info
        $('#characterName').text(chatData.name || 'Unnamed Character');
        $('#characterGender').text(chatData.gender || 'Not specified');
        
        if (chatData.chatImageUrl) {
            $('#characterImage').attr('src', chatData.chatImageUrl).show();
        }

        // Populate all form fields
        populateFormSection(details.appearance, 'appearance');
        populateFormSection(details.face, 'face');
        populateFormSection(details.hair, 'hair');
        populateFormSection(details.body, 'body');
        populateFormSection(details.style, 'style');
        populateFormSection(details.personality, 'personality');

        // Show/hide gender-specific fields
        toggleGenderSpecificFields(chatData.gender);
    }

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

    // Collect form data
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
                    value = value ? value.split(',').map(item => item.trim()).filter(item => item) : [];
                }
                
                // Convert empty strings to null
                sectionData[key] = value === '' ? null : value;
            }
        });
        
        return sectionData;
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

        $.ajax({
            url: `/api/character-details/${chatId}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ details_description: details }),
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
        if (originalDetails) {
            populateFormSection(originalDetails.appearance, 'appearance');
            populateFormSection(originalDetails.face, 'face');
            populateFormSection(originalDetails.hair, 'hair');
            populateFormSection(originalDetails.body, 'body');
            populateFormSection(originalDetails.style, 'style');
            populateFormSection(originalDetails.personality, 'personality');
            
            showNotification('Form reset to original values', 'info');
        }
    });

    // Clear form
    $(document).on('click', '#clearCharacterForm', function() {
        $('#characterUpdateModal form')[0].reset();
        showNotification('Form cleared', 'info');
    });
});
