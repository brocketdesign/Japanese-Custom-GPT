$(document).ready(function() {
    // Store current chat data for the modal
    let currentChatData = null;
    let currentUserChatId = null;

    // Character customization options (same as character creation)
    const customizationOptions = {
        personalities: {
            submissive: 'Submissive',
            dominant: 'Dominant',
            shy: 'Shy',
            confident: 'Confident',
            playful: 'Playful',
            serious: 'Serious',
            romantic: 'Romantic',
            adventurous: 'Adventurous',
            caring: 'Caring',
            mysterious: 'Mysterious'
        },
        relationships: {
            stranger: 'Stranger',
            friend: 'Friend',
            girlfriend: 'Girlfriend',
            wife: 'Wife',
            crush: 'Crush',
            colleague: 'Colleague',
            neighbor: 'Neighbor',
            ex: 'Ex',
            first_date: 'First Date',
            roommate: 'Roommate'
        },
        occupations: {
            student: 'Student',
            teacher: 'Teacher',
            nurse: 'Nurse',
            model: 'Model',
            artist: 'Artist',
            athlete: 'Athlete',
            businesswoman: 'Businesswoman',
            influencer: 'Influencer',
            scientist: 'Scientist',
            musician: 'Musician'
        },
        preferences: {
            vanilla: 'Vanilla',
            daddy_dom: 'Daddy Dominance',
            roleplay: 'Roleplay',
            bdsm: 'BDSM',
            exhibitionism: 'Exhibitionism',
            feet: 'Feet',
            lingerie: 'Lingerie',
            outdoor: 'Outdoor',
            toys: 'Toys'
        }
    };

    // Get translations if available
    function getTranslations() {
        const t = window.translations?.newCharacter || {};
        return {
            personalities: t.personalities || customizationOptions.personalities,
            relationships: t.relationships || customizationOptions.relationships,
            occupations: t.occupations || customizationOptions.occupations,
            preferences: t.kinks || customizationOptions.preferences
        };
    }

    // Function to open character info modal
    window.openCharacterInfoModal = function(chatId) {
        if (!chatId) {
            showNotification('No character selected', 'error');
            return;
        }

        // Store chatId for the modal
        $.cookie('character-info-id', chatId, { path: '/' });
        
        // Show modal and load data
        $('#characterInfoModal').modal('show');
        loadCharacterInfo(chatId);
    };

    // Load character information
    function loadCharacterInfo(chatId) {
        // Show loading state
        $('#characterInfoLoading').show();
        $('#characterInfoContent').hide();

        $.ajax({
            url: `/api/character-info/${chatId}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    console.log('[CharacterInfo] Loaded data:', {
                        userCustomizations: response.chat.userCustomizations,
                        userChatId: response.chat.userChatId,
                        characterPersonality: response.chat.characterPersonality,
                        relationship: response.chat.relationship
                    });
                    currentChatData = response.chat;
                    currentUserChatId = response.chat.userChatId;
                    populateCharacterInfo(response.chat);
                } else {
                    showError('Failed to load character information');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading character info:', error);
                showError('Failed to load character information');
            },
            complete: function() {
                $('#characterInfoLoading').hide();
            }
        });
    }

    // Get the effective value (user customization or character default)
    function getEffectiveValue(chatData, field, defaultField) {
        if (chatData.userCustomizations && chatData.userCustomizations[field]) {
            return chatData.userCustomizations[field];
        }
        return chatData[defaultField] || '-';
    }

    // Get the original character value (ignoring user customizations)
    function getOriginalCharacterValue(chatData, field, defaultField) {
        return chatData[defaultField] || chatData.details_description?.personality?.[field] || '-';
    }

    // Populate character information in the modal - Native App Style
    function populateCharacterInfo(chatData) {
        // Character link
        $('#charInfoLink').attr('href', `/character/slug/${chatData.slug}`);
        
        // Character name
        $('#charInfoName').text(chatData.name || 'Unnamed Character');
        
        // Stats
        $('#charInfoMessages').text(chatData.messagesCount || 0);
        $('#charInfoImages').text(chatData.imageCount || 0);
        $('#charInfoVideos').text(chatData.videoCount || 0);

        // Character image
        if (chatData.chatImageUrl) {
            $('#charInfoImage').attr('src', chatData.chatImageUrl).show();
            $('#charInfoImagePlaceholder').removeClass('d-flex').hide();
        } else {
            $('#charInfoImage').hide();
            $('#charInfoImagePlaceholder').addClass('d-flex').show();
        }

        // Store original character values for dropdown creation
        const originalPersonality = chatData.characterPersonality || chatData.details_description?.personality?.personality || '-';
        const originalRelationship = chatData.relationship || '-';
        const originalOccupation = chatData.characterOccupation || chatData.details_description?.personality?.occupation || '-';
        const originalPreferences = chatData.characterPreferences || '-';

        // Personality - check user customization first, then character default
        const personality = getEffectiveValue(chatData, 'personality', 'characterPersonality') || 
            chatData.details_description?.personality?.personality || '-';
        $('#charInfoPersonality').text(capitalizeFirst(personality));
        $('#charInfoPersonality').attr('data-value', personality);
        $('#charInfoPersonality').attr('data-original', originalPersonality);
        
        // Relationship
        const relationship = getEffectiveValue(chatData, 'relationship', 'relationship') || '-';
        $('#charInfoRelationship').text(capitalizeFirst(relationship));
        $('#charInfoRelationship').attr('data-value', relationship);
        $('#charInfoRelationship').attr('data-original', originalRelationship);
        
        // Occupation
        const occupation = getEffectiveValue(chatData, 'occupation', 'characterOccupation') || 
            chatData.details_description?.personality?.occupation || '-';
        const occupationEmoji = getOccupationEmoji(occupation);
        $('#charInfoOccupation').text(occupationEmoji + ' ' + capitalizeFirst(occupation));
        $('#charInfoOccupation').attr('data-value', occupation);
        $('#charInfoOccupation').attr('data-original', originalOccupation);
        
        // Preferences (kinks)
        const preferences = getEffectiveValue(chatData, 'preferences', 'characterPreferences') || '-';
        $('#charInfoPreferences').text(capitalizeFirst(preferences));
        $('#charInfoPreferences').attr('data-value', preferences);
        $('#charInfoPreferences').attr('data-original', originalPreferences);
        
        // Custom Instructions
        const customInstructions = chatData.userCustomizations?.customInstructions || '';
        if (customInstructions) {
            $('#charInfoCustomInstructions').text(customInstructions);
            $('#charInfoCustomInstructionsSection').show();
            $('#charInfoAddInstructionsBtn').hide();
        } else {
            $('#charInfoCustomInstructionsSection').hide();
            $('#charInfoAddInstructionsBtn').show();
        }
        
        // Chat Purpose
        const chatPurpose = chatData.chatPurpose || chatData.purpose || null;
        if (chatPurpose && chatPurpose.trim()) {
            $('#charInfoPurpose').text(chatPurpose);
            $('#charInfoPurposeSection').show();
        } else {
            $('#charInfoPurposeSection').hide();
        }

        // Show/hide reset button if user has customizations
        if (chatData.userCustomizations && Object.keys(chatData.userCustomizations).length > 0) {
            $('#charInfoResetBtn').show();
        } else {
            $('#charInfoResetBtn').hide();
        }

        // Show content
        $('#characterInfoContent').show();
    }

    // Handle Add Custom Instructions button
    $(document).on('click', '#addCustomInstructionsBtn', function(e) {
        e.preventDefault();
        
        // Hide the add button
        $('#charInfoAddInstructionsBtn').hide();
        
        // Show the custom instructions section in edit mode
        const $section = $('#charInfoCustomInstructionsSection');
        $section.show().addClass('editing');
        
        const $textSpan = $section.find('.char-info-purpose-text');
        $textSpan.html(createCustomInstructionsInput(''));
        
        // Hide the edit button (since we're already editing)
        $section.find('.char-info-edit-btn').hide();
        
        // Add save and cancel buttons
        const $buttons = $(`
            <div class="char-info-edit-actions">
                <button type="button" class="char-info-save-btn" data-field="customInstructions">
                    <i class="bi bi-check"></i>
                </button>
                <button type="button" class="char-info-cancel-btn" data-field="customInstructions">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `);
        $section.append($buttons);
        
        // Character counter
        $('#charInfoCustomInstructionsInput').on('input', function() {
            $('#charInfoInstructionsCounter').text($(this).val().length);
        }).focus();
    });

    // Create dropdown HTML for a field
    function createDropdown(field, currentValue, originalCharacterValue = null) {
        const translations = getTranslations();
        const options = field === 'personality' ? customizationOptions.personalities :
                       field === 'relationship' ? customizationOptions.relationships :
                       field === 'occupation' ? customizationOptions.occupations :
                       customizationOptions.preferences;
        
        const translatedOptions = field === 'personality' ? translations.personalities :
                                  field === 'relationship' ? translations.relationships :
                                  field === 'occupation' ? translations.occupations :
                                  translations.preferences;

        let html = `<select class="char-info-dropdown" data-field="${field}">`;
        
        // Check if current value matches any predefined option
        const hasMatchingOption = Object.keys(options).includes(currentValue);
        
        // If the original character value doesn't match any option, add it as "Original" option
        if (originalCharacterValue && !Object.keys(options).includes(originalCharacterValue)) {
            const isSelected = currentValue === originalCharacterValue || !hasMatchingOption ? 'selected' : '';
            const displayValue = capitalizeFirst(originalCharacterValue);
            html += `<option value="${originalCharacterValue}" ${isSelected}>${displayValue} (Original)</option>`;
        }
        
        for (const [key, defaultLabel] of Object.entries(options)) {
            const label = translatedOptions[key] || defaultLabel;
            const selected = key === currentValue ? 'selected' : '';
            const emoji = field === 'occupation' ? getOccupationEmoji(key) + ' ' : '';
            html += `<option value="${key}" ${selected}>${emoji}${label}</option>`;
        }
        
        html += '</select>';
        return html;
    }

    // Create custom instructions input
    function createCustomInstructionsInput(currentValue) {
        return `
            <div class="char-info-custom-instructions-edit">
                <textarea class="char-info-textarea" id="charInfoCustomInstructionsInput" 
                    placeholder="${window.translations?.newCharacter?.custom_instructions_placeholder || 'Add special instructions for your chat...'}"
                    maxlength="1000">${currentValue || ''}</textarea>
                <div class="char-counter">
                    <span id="charInfoInstructionsCounter">${(currentValue || '').length}</span>/1000
                </div>
            </div>
        `;
    }

    // Handle edit button click - show dropdown
    $(document).on('click', '.char-info-edit-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const field = $(this).data('field');
        const $card = $(this).closest('.char-info-detail-card');
        const $valueSpan = $card.find('.char-info-value');
        const currentValue = $valueSpan.attr('data-value') || '';
        const originalValue = $valueSpan.attr('data-original') || '';
        
        // If already editing, don't do anything
        if ($card.hasClass('editing')) return;
        
        $card.addClass('editing');
        $(this).hide();
        
        // Replace text with dropdown (pass original value for custom options)
        const dropdownHtml = createDropdown(field, currentValue, originalValue);
        $valueSpan.html(dropdownHtml);
        
        // Add save and cancel buttons
        const $buttons = $(`
            <div class="char-info-edit-actions">
                <button type="button" class="char-info-save-btn" data-field="${field}">
                    <i class="bi bi-check"></i>
                </button>
                <button type="button" class="char-info-cancel-btn" data-field="${field}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `);
        $card.append($buttons);
        
        // Focus the dropdown
        $card.find('select').focus();
    });

    // Handle custom instructions edit button
    $(document).on('click', '.char-info-edit-btn[data-field="customInstructions"]', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const $section = $('#charInfoCustomInstructionsSection');
        const $textSpan = $section.find('.char-info-purpose-text');
        const currentValue = currentChatData?.userCustomizations?.customInstructions || '';
        
        if ($section.hasClass('editing')) return;
        
        $section.addClass('editing');
        $(this).hide();
        
        // Replace text with textarea
        $textSpan.html(createCustomInstructionsInput(currentValue));
        
        // Add save and cancel buttons
        const $buttons = $(`
            <div class="char-info-edit-actions">
                <button type="button" class="char-info-save-btn" data-field="customInstructions">
                    <i class="bi bi-check"></i>
                </button>
                <button type="button" class="char-info-cancel-btn" data-field="customInstructions">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `);
        $section.append($buttons);
        
        // Character counter
        $('#charInfoCustomInstructionsInput').on('input', function() {
            $('#charInfoInstructionsCounter').text($(this).val().length);
        });
    });

    // Handle save button click
    $(document).on('click', '.char-info-save-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const field = $(this).data('field');
        let newValue;
        
        if (field === 'customInstructions') {
            newValue = $('#charInfoCustomInstructionsInput').val();
        } else {
            newValue = $(`.char-info-dropdown[data-field="${field}"]`).val();
        }
        
        // Save the customization
        saveCustomization(field, newValue);
    });

    // Handle cancel button click
    $(document).on('click', '.char-info-cancel-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const field = $(this).data('field');
        
        if (field === 'customInstructions') {
            const $section = $('#charInfoCustomInstructionsSection');
            $section.removeClass('editing');
            $section.find('.char-info-edit-actions').remove();
            $section.find('.char-info-edit-btn').show();
            
            // Restore original text or hide section and show add button
            const customInstructions = currentChatData?.userCustomizations?.customInstructions || '';
            if (customInstructions) {
                $section.find('.char-info-purpose-text').text(customInstructions);
            } else {
                $section.hide();
                $('#charInfoAddInstructionsBtn').show();
            }
        } else {
            const $card = $(`.char-info-detail-card:has(.char-info-dropdown[data-field="${field}"])`);
            $card.removeClass('editing');
            $card.find('.char-info-edit-actions').remove();
            $card.find('.char-info-edit-btn').show();
            
            // Restore original value
            restoreFieldValue(field);
        }
    });

    // Save customization to server
    function saveCustomization(field, value) {
        const chatId = $.cookie('character-info-id');
        
        if (!chatId) {
            showNotification('No character selected', 'error');
            return;
        }
        
        const customizations = {};
        customizations[field] = value;
        
        $.ajax({
            url: `/api/character-info/${chatId}/customizations`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                userChatId: currentUserChatId,
                customizations: customizations
            }),
            success: function(response) {
                if (response.success) {
                    // Update local data
                    if (!currentChatData.userCustomizations) {
                        currentChatData.userCustomizations = {};
                    }
                    currentChatData.userCustomizations[field] = value;
                    currentUserChatId = response.userChatId;
                    
                    // Update UI
                    updateFieldDisplay(field, value);
                    
                    showNotification(window.translations?.customization_saved || 'Customization saved', 'success');
                } else {
                    showNotification('Failed to save customization', 'error');
                    restoreFieldValue(field);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error saving customization:', error);
                showNotification('Failed to save customization', 'error');
                restoreFieldValue(field);
            }
        });
    }

    // Update field display after save
    function updateFieldDisplay(field, value) {
        if (field === 'customInstructions') {
            const $section = $('#charInfoCustomInstructionsSection');
            $section.removeClass('editing');
            $section.find('.char-info-edit-actions').remove();
            $section.find('.char-info-edit-btn').show();
            
            if (value && value.trim()) {
                $section.find('.char-info-purpose-text').text(value);
                $section.show();
                $('#charInfoAddInstructionsBtn').hide();
            } else {
                $section.hide();
                $('#charInfoAddInstructionsBtn').show();
            }
        } else {
            const $card = $(`.char-info-detail-card:has(.char-info-value[data-field="${field}"]), .char-info-detail-card:has([data-field="${field}"])`);
            // Find by the edit button's data-field instead
            const $editBtn = $(`.char-info-edit-btn[data-field="${field}"]`);
            const $parentCard = $editBtn.closest('.char-info-detail-card');
            
            $parentCard.removeClass('editing');
            $parentCard.find('.char-info-edit-actions').remove();
            $parentCard.find('.char-info-edit-btn').show();
            
            const $valueSpan = $parentCard.find('.char-info-value');
            const displayValue = field === 'occupation' 
                ? getOccupationEmoji(value) + ' ' + capitalizeFirst(value)
                : capitalizeFirst(value);
            
            $valueSpan.text(displayValue);
            $valueSpan.attr('data-value', value);
        }
        
        // Show reset button if we have customizations
        $('#charInfoResetBtn').show();
    }

    // Restore field value after cancel
    function restoreFieldValue(field) {
        const originalValue = getEffectiveValue(currentChatData, field, 
            field === 'personality' ? 'characterPersonality' :
            field === 'occupation' ? 'characterOccupation' :
            field === 'preferences' ? 'characterPreferences' : field
        );
        
        updateFieldDisplay(field, originalValue);
    }

    // Handle reset button (button is inside #charInfoResetBtn div)
    $(document).on('click', '#charInfoResetBtn button, #charInfoResetBtn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const chatId = $.cookie('character-info-id');
        
        if (!chatId) return;
        
        if (!confirm(window.translations?.reset_customizations_confirm || 'Reset all customizations to character defaults?')) {
            return;
        }
        
        $.ajax({
            url: `/api/character-info/${chatId}/customizations?userChatId=${currentUserChatId || ''}`,
            method: 'DELETE',
            success: function(response) {
                if (response.success) {
                    // Clear local customizations
                    currentChatData.userCustomizations = null;
                    
                    // Reload the modal
                    loadCharacterInfo(chatId);
                    
                    showNotification(window.translations?.customizations_reset || 'Customizations reset', 'success');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error resetting customizations:', error);
                showNotification('Failed to reset customizations', 'error');
            }
        });
    });
    
    // Helper function to capitalize first letter
    function capitalizeFirst(str) {
        if (!str || str === '-') return str;
        return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
    }
    
    // Helper function to get occupation emoji
    function getOccupationEmoji(occupation) {
        const emojiMap = {
            'student': '🎓',
            'teacher': '👩‍🏫',
            'nurse': '👩‍⚕️',
            'model': '📸',
            'artist': '🎨',
            'athlete': '🏃‍♀️',
            'businesswoman': '💼',
            'influencer': '📱',
            'scientist': '🔬',
            'musician': '🎵',
            'doctor': '👨‍⚕️',
            'chef': '👨‍🍳',
            'writer': '✍️',
            'engineer': '👷',
            'designer': '🎨'
        };
        return emojiMap[occupation?.toLowerCase()] || '';
    }

    // Populate character details sections
    function populateCharacterDetails(details) {
        const detailsContainer = $('#charInfoDetails');
        detailsContainer.empty();

        const sections = [
            { key: 'appearance', title: 'Appearance', icon: 'bi-eye' },
            { key: 'face', title: 'Facial Features', icon: 'bi-emoji-smile' },
            { key: 'hair', title: 'Hair', icon: 'bi-scissors' },
            { key: 'body', title: 'Body', icon: 'bi-person' },
            { key: 'style', title: 'Style & Fashion', icon: 'bi-palette' },
            { key: 'personality', title: 'Personality', icon: 'bi-heart' }
        ];

        sections.forEach(section => {
            const sectionData = details[section.key];
            if (sectionData && Object.keys(sectionData).length > 0) {
                const sectionHtml = createDetailSection(section, sectionData);
                detailsContainer.append(sectionHtml);
            }
        });

        if (detailsContainer.children().length === 0) {
            detailsContainer.html('<p class="text-muted mb-0">No detailed character information available.</p>');
        }
    }

    // Create a detail section HTML
    function createDetailSection(section, data) {
        let itemsHtml = '';
        
        Object.entries(data).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const displayKey = formatFieldName(key);
                let displayValue;
                
                if (Array.isArray(value)) {
                    displayValue = value.join(', ');
                } else {
                    displayValue = value;
                }
                
                itemsHtml += `
                    <div class="col-md-6 mb-2">
                        <small class="text-muted d-block">${displayKey}</small>
                        <div class="fw-medium">${displayValue}</div>
                    </div>
                `;
            }
        });

        if (itemsHtml) {
            return `
                <div class="detail-section mb-3">
                    <h6 class="text-primary mb-2">
                        <i class="${section.icon} me-1"></i>${section.title}
                    </h6>
                    <div class="row">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }
        return '';
    }

    // Format field names for display
    function formatFieldName(fieldName) {
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/^\s+/, '');
    }

    // Show error in modal
    function showError(message) {
        $('#characterInfoContent').html(`
            <div class="text-center p-4">
                <i class="bi bi-exclamation-triangle text-warning fs-1"></i>
                <div class="mt-2 text-muted">${message}</div>
            </div>
        `).show();
    }

    // Reset modal when hidden
    $('#characterInfoModal').on('hidden.bs.modal', function() {
        // Clear all stored data to prevent stale values
        currentChatData = null;
        currentUserChatId = null;
        
        // Reset UI state
        $('#characterInfoLoading').show();
        $('#characterInfoContent').hide();
        
        // Remove any editing state
        $('.char-info-detail-card').removeClass('editing');
        $('.char-info-edit-actions').remove();
        $('.char-info-purpose-section').removeClass('editing');
        
        // Reset data attributes
        $('.char-info-value').removeAttr('data-value').removeAttr('data-original');
        
        $.removeCookie('character-info-id', { path: '/' });
    });

    // Function to open character intro modal
    window.openCharacterIntroModal = function(chatId) {
        if (!chatId) {
            showNotification('No character selected', 'error');
            return;
        }

        // Clear any existing cache for intro galleries to prevent stale data
        if (window.clearImageCache) {
            // Clear previous character's intro cache if different
            const previousChatId = $.cookie('character-intro-id');
            if (previousChatId && previousChatId !== chatId) {
                window.clearImageCache('intro', previousChatId);
            }
            // Also clear current character's cache to ensure fresh data
            window.clearImageCache('intro', chatId);
        }

        // Store chatId for the modal
        $.cookie('character-intro-id', chatId, { path: '/' });
        
        // Set data attribute on gallery for validation
        $('#character-intro-gallery').attr('data-current-chat-id', chatId).empty();
        
        // Show modal and load data
        $('#characterIntroModal').modal('show');
        loadCharacterIntro(chatId);
    };

    // Load character information for intro
    function loadCharacterIntro(chatId) {
        // Show loading state
        $('#characterIntroLoading').show();
        $('#characterIntroContent').hide();

        $.ajax({
            url: `/api/character-info/${chatId}`,
            method: 'GET',
            success: function(response) {
                if (response.success) {
                    populateCharacterIntro(response.chat);
                } else {
                    showIntroError('Failed to load character information');
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading character info:', error);
                showIntroError('Failed to load character information');
            },
            complete: function() {
                $('#characterIntroLoading').hide();
            }
        });
    }

    // Populate character information in the intro modal
    function populateCharacterIntro(chatData) {
        // Basic header information
        $('#charIntroName').text(chatData.name || 'Unnamed Character');
        $('#charIntroGender').html(chatData.gender == 'male' ? '<i class="bi bi-gender-male"></i>' : (chatData.gender == 'female' ? '<i class="bi bi-gender-female"></i>' : (chatData.gender == 'non-binary' ? '<i class="bi bi-gender-ambiguous"></i>' : '')));
        // Show as how many days ago it was updated
        const updatedAt = new Date(chatData.updatedAt);
        const now = new Date();
        const diffTime = Math.abs(now - updatedAt);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        $('#charIntroCreatedAt').text(`${diffDays}${translations.daysAgo || ' day(s) ago'}`);
        $('#charIntroImages').text(chatData.imageCount || 0);
        $('#charIntroVideos').text(chatData.videoCount || 0);

        // Character image
        if (chatData.chatImageUrl) {
            $('#charIntroImage').attr('src', chatData.chatImageUrl).show();
            $('#charIntroImagePlaceholder').removeClass('d-flex').hide();
            $.cookie('character-intro-image', chatData.chatImageUrl, { path: '/' });
        } else {
            $('#charIntroImage').hide();
            $('#charIntroImagePlaceholder').addClass('d-flex').show();
        }

        // Store NSFW status
        $.cookie('character-intro-nsfw', chatData.nsfw ? 'true' : 'false', { path: '/' });

        // Basic information
        $('#charIntroShortIntro').text(chatData.short_intro || 'No introduction provided');
        // Tags
        if (chatData.tags && Array.isArray(chatData.tags) && chatData.tags.length > 0) {
            const tagsHtml = chatData.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('');
            $('#charIntroTags').html(tagsHtml);
        } 
        $('#charIntroTags').prepend(chatData.nsfw ? '<span class="badge bg-primary bg-secondary me-1">🔞NSFW</span>' : '');

        // Show content
        $('#characterIntroContent').show();

        // Load gallery
        loadIntroImages(chatData._id, 1, true, true);
    }

    // Show error in intro modal
    function showIntroError(message) {
        $('#characterIntroContent').html(`
            <div class="text-center p-4">
                <i class="bi bi-exclamation-triangle text-warning fs-1"></i>
                <div class="mt-2 text-muted">${message}</div>
            </div>
        `).show();
    }

    // Start chatting function
    window.startChatting = function(event) {
        const chatId = $.cookie('character-intro-id');
        const imageUrl = $.cookie('character-intro-image');
        const isNsfw = $.cookie('character-intro-nsfw') === 'true';
        const subscriptionStatus = window.user?.subscriptionStatus === 'active';

        // Save the chatId and imageUrl to a cookie for post-login restoration
        if (chatId) {
            $.cookie('pending-chat-id', chatId, { path: '/' });
            if (imageUrl) {
                $.cookie('pending-chat-image', imageUrl, { path: '/' });
            }
        }

        if(!user || isTemporary) {
            console.log('User is not logged in or is temporary, aborting startChatting.');
            openLoginForm();
            return;
        }

        $('#characterIntroModal').modal('hide');
        redirectToChat(chatId, imageUrl);
        /* 
        if (isNsfw && !subscriptionStatus) {
            loadPlanPage();
        } else {
            redirectToChat(chatId, imageUrl);
        }
        */
        event.stopPropagation();
    };

    // Reset intro modal when hidden
    $('#characterIntroModal').on('hidden.bs.modal', function() {
        // Get the current chat ID before clearing
        const chatId = $.cookie('character-intro-id');
        
        // Clear image cache and scroll handlers for this character
        if (chatId && window.clearImageCache) {
            window.clearImageCache('intro', chatId);
        }
        
        $('#characterIntroLoading').show();
        $('#characterIntroContent').hide();
        $('#character-intro-gallery').empty().removeAttr('data-current-chat-id');
        $.removeCookie('character-intro-id', { path: '/' });
        $.removeCookie('character-intro-image', { path: '/' });
        $.removeCookie('character-intro-nsfw', { path: '/' });
    });
});
