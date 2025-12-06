

    window.openEditModal = async function(imageId, chatId, userChatId) {
        const img = $('img[data-id="' + imageId + '"]');
        const imageUrl = img.attr('src');
        const imagePrompt = img.attr('data-prompt') || '';
        if(!imageUrl) {
            showNotification('Image not found.', 'error');
            return;
        }
        const originalPrompt = img.attr('data-prompt') || '';
        const title = img.attr('data-title') || '';
        const nsfw = img.attr('data-nsfw') === 'true';

        const modalId = `editModal-${imageId}`;
        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="${modalId}Label" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content mx-auto" style="height: auto;">
                        <div class="modal-header">
                            <div class="d-flex align-items-center flex-column w-100">
                                <h5 class="modal-title" id="${modalId}Label">
                                    <i class="bi bi-pencil me-2"></i>
                                    Edit Image
                                </h5>
                                <span>Enter what you want to edit in the image</span>
                            </div>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-3">
                                <img src="${imageUrl}" style="max-width: 200px; max-height: 200px;" alt="Image to edit" />
                            </div>
                            <div class="mb-3">
                                <label for="editPromptTextarea-${imageId}" class="form-label">
                                    Edit Instructions
                                </label>
                                <textarea 
                                    class="form-control" 
                                    style="min-height: 90px;"
                                    id="editPromptTextarea-${imageId}" 
                                    rows="4" 
                                    maxlength="500" 
                                    placeholder="e.g., change the background to a beach, make the character smile..."
                                ></textarea>
                                <div class="form-text">
                                    <span id="editCharCount-${imageId}">0</span>/500 characters
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="submitEdit-${imageId}">
                                <i class="bi bi-image me-2"></i>
                                Generate Edited Image
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        $(`#${modalId}`).remove();
        
        // Add modal to body
        $('body').append(modalHtml);
        
        const modal = new bootstrap.Modal(document.getElementById(modalId));
        const textarea = $(`#editPromptTextarea-${imageId}`);
        const charCount = $(`#editCharCount-${imageId}`);
        const generateBtn = $(`#submitEdit-${imageId}`);

        // Save and restore last prompt using localStorage
        const lastPromptKey = 'edit_prompt_last_prompt';
        const savedPrompt = localStorage.getItem(lastPromptKey);
        if (savedPrompt) {
            textarea.val(savedPrompt);
            charCount.text(savedPrompt.length);
        }

        // Character counter
        textarea.on('input', function() {
            const length = $(this).val().length;
            charCount.text(length);
            
            if (length > 500) {
                charCount.addClass('text-danger');
            } else {
                charCount.removeClass('text-danger');
            }

            // Save to localStorage
            localStorage.setItem(lastPromptKey, $(this).val());
        });

        // Generate button click
        generateBtn.off('click').on('click', async () => {
            const editPrompt = textarea.val().trim();
            if (!editPrompt) {
                showNotification('Please enter edit instructions.', 'warning');
                return;
            }
            modal.hide();

            try {
                // Convert image URL to base64
                const response = await fetch('/api/convert-url-to-base64', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: imageUrl })
                });
                const data = await response.json();
                const image_base64 = data.base64Image;

                if (!image_base64) {
                    throw new Error('Failed to convert image to base64');
                }

                // Create placeholder
                const placeholderId = `${new Date().getTime()}_${Math.random().toString(36).substring(2, 8)}_${imageId}`;
                displayOrRemoveImageLoader(placeholderId, 'show');

                // Add message to chat
                addMessageToChat(chatId, userChatId, {
                    role: 'user',
                    message: `Edit image: ${editPrompt}`,
                    name: 'image_edit',
                    hidden: true
                });

                generateChatCompletion(null, false, true);
                
                // Call image generation
                await novitaImageGeneration(window.user._id, chatId, userChatId, {
                    placeholderId,
                    prompt: editPrompt,
                    editPrompt: editPrompt,
                    imagePrompt: imagePrompt || originalPrompt,
                    image_base64,
                    imageType: nsfw ? 'nsfw' : 'sfw',
                    regenerate: true,
                    title: title || 'Edited Image'
                });
            } catch (error) {
                console.error('Error in edit image:', error);
                showNotification('Failed to edit image. Please try again.', 'error');
            }
        });

        // Modal close events
        $(`#${modalId}`).on('hidden.bs.modal', function() {
            $(this).remove();
        });

        // Show modal
        modal.show();
        
        // Focus textarea
        $(`#${modalId}`).on('shown.bs.modal', function() {
            textarea.focus();
        });
    };