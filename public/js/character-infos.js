$(document).ready(function() {
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

    // Populate character information in the modal
    function populateCharacterInfo(chatData) {
        // Basic header information
        $('#charInfoLink').attr('href', `/character/slug/${chatData.slug}`);
        $('#charInfoName').text(chatData.name || 'Unnamed Character');
        $('#charInfoGender').text(chatData.gender || 'Not specified');
        $('#charInfoUpdatedAt').text(chatData.updatedAt || 'Never');
        $('#charInfoMessages').text(chatData.messagesCount || 0);
        $('#charInfoImages').text(chatData.imageCount || 0);

        // Character image
        if (chatData.chatImageUrl) {
            $('#charInfoImage').attr('src', chatData.chatImageUrl).show();
            $('#charInfoImagePlaceholder').removeClass('d-flex').hide();
        } else {
            $('#charInfoImage').hide();
            $('#charInfoImagePlaceholder').addClass('d-flex').show();
        }

        // Basic information
        $('#charInfoShortIntro').text(chatData.short_intro || 'No introduction provided');
        const characterDescription = chatData?.enhancedPrompt || chatData?.imageDescription || chatData?.characterPrompt || null;
        $('#charInfoDescription').text(characterDescription || 'No description provided');
        $('#charInfoNsfw').text(chatData.nsfw ? 'Yes' : 'No');
        
        // Tags
        if (chatData.tags && Array.isArray(chatData.tags) && chatData.tags.length > 0) {
            const tagsHtml = chatData.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('');
            $('#charInfoTags').html(tagsHtml);
        } else {
            $('#charInfoTags').text('No tags');
        }

        // Model information
        $('#charInfoModelId').text(chatData.modelId || 'Not assigned');
        $('#charInfoModelName').text(chatData.imageModel || 'Unknown Model');
        $('#charInfoModelStyle').text(chatData.imageStyle || 'Unknown Style');

 
        $('#charInfoModelImage').attr('src', chatData.modelImage || '').show();
        $('#charInfoModelPlaceholder').removeClass('d-flex').hide();

        // Character details
        if (chatData.details_description) {
            populateCharacterDetails(chatData.details_description);
            $('#charInfoDetailsCard').show();
        } else {
            $('#charInfoDetailsCard').hide();
        }

        // Show content
        $('#characterInfoContent').show();
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
        $('#characterInfoLoading').show();
        $('#characterInfoContent').hide();
        $.removeCookie('character-info-id', { path: '/' });
    });

    // Function to open character intro modal
    window.openCharacterIntroModal = function(chatId) {
        if (!chatId) {
            showNotification('No character selected', 'error');
            return;
        }

        // Store chatId for the modal
        $.cookie('character-intro-id', chatId, { path: '/' });
        
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
        $('#charIntroGender').text(chatData.gender || 'Not specified');
        $('#charIntroCreatedAt').text(chatData.updatedAt || 'Never');
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
        $('#charIntroNsfw').text(chatData.nsfw ? 'Yes' : 'No');
        
        // Tags
        if (chatData.tags && Array.isArray(chatData.tags) && chatData.tags.length > 0) {
            const tagsHtml = chatData.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('');
            $('#charIntroTags').html(tagsHtml);
        } else {
            $('#charIntroTags').text('No tags');
        }

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
        $('#characterIntroLoading').show();
        $('#characterIntroContent').hide();
        $('#character-intro-gallery').empty();
        $.removeCookie('character-intro-id', { path: '/' });
        $.removeCookie('character-intro-image', { path: '/' });
        $.removeCookie('character-intro-nsfw', { path: '/' });
    });
});
