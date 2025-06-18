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
        $('#charInfoName').text(chatData.name || 'Unnamed Character');
        $('#charInfoGender').text(chatData.gender || 'Not specified');
        $('#charInfoUpdatedAt').text(chatData.updatedAt || 'Never');
        $('#charInfoMessages').text(chatData.messagesCount || 0);
        $('#charInfoImages').text(chatData.imageCount || 0);

        // Character image
        if (chatData.chatImageUrl) {
            $('#charInfoImage').attr('src', chatData.chatImageUrl).show();
            $('#charInfoImagePlaceholder').hide();
        } else {
            $('#charInfoImage').hide();
            $('#charInfoImagePlaceholder').show();
        }

        // Basic information
        $('#charInfoShortIntro').text(chatData.short_intro || 'No introduction provided');
        $('#charInfoDescription').text(chatData.description || 'No description provided');
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

        // Model image (this would need to be fetched from available models)
        // For now, hide the image and show placeholder
        $('#charInfoModelImage').hide();
        $('#charInfoModelPlaceholder').show();

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
});
