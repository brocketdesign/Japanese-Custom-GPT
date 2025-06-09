let currentMergeImageId = null;
let currentMergeImageUrl = null;
let currentMergeChatId = null;
let currentMergeUserChatId = null;
let userUploadedFaces = [];

// Open merge face modal
function openMergeFaceModal(imageId, imageUrl, chatId, userChatId) {
    currentMergeImageId = imageId;
    currentMergeImageUrl = imageUrl;
    currentMergeChatId = chatId;
    currentMergeUserChatId = userChatId;
    console.log(`Opening merge face modal for imageId: ${imageId}, chatId: ${chatId}, userChatId: ${userChatId}`);
    // Create modal if it doesn't exist
    if (!document.getElementById('mergeFaceModal')) {
        createMergeFaceModal();
    }
    
    // Load user's uploaded faces and existing merge results
    loadUserFaces();
    loadExistingMergeResults(imageId);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('mergeFaceModal'));
    modal.show();
}

// Create merge face modal HTML
function createMergeFaceModal() {
    const modalHTML = `
        <div class="modal fade" id="mergeFaceModal" tabindex="-1" aria-labelledby="mergeFaceModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content mx-auto">
                    <div class="modal-header text-white mx-0">
                        <h5 class="modal-title" id="mergeFaceModalLabel">
                            <i class="bi bi-person-plus me-2"></i>
                            ${window.mergeFaceTranslations?.title || 'Merge Face'}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <!-- Left Column: Original Image and Face Selection -->
                            <div class="col-lg-8">
                                <div class="row">
                                    <!-- Original Image Preview -->
                                    <div class="col-md-6 mb-3">
                                        <h6>${window.mergeFaceTranslations?.originalImage || 'Original Image'}</h6>
                                        <div class="border rounded p-2 text-center">
                                            <img id="originalImagePreview" src="" alt="Original" class="img-fluid rounded" style="max-height: 300px;">
                                        </div>
                                    </div>
                                    
                                    <!-- Face Selection -->
                                    <div class="col-md-6 mb-3">
                                        <h6>${window.mergeFaceTranslations?.selectFace || 'Select Face'}</h6>
                                        
                                        <!-- Tab Navigation -->
                                        <ul class="nav nav-tabs mb-3" id="faceSelectionTabs" role="tablist">
                                            <li class="nav-item" role="presentation">
                                                <button class="nav-link active" id="upload-tab" data-bs-toggle="tab" data-bs-target="#upload-pane" type="button" role="tab">
                                                    <i class="bi bi-upload me-1"></i>
                                                    ${window.mergeFaceTranslations?.uploadNewFace || 'Upload New'}
                                                </button>
                                            </li>
                                            <li class="nav-item" role="presentation">
                                                <button class="nav-link" id="existing-tab" data-bs-toggle="tab" data-bs-target="#existing-pane" type="button" role="tab">
                                                    <i class="bi bi-collection me-1"></i>
                                                    ${window.mergeFaceTranslations?.selectExistingFace || 'Existing'}
                                                </button>
                                            </li>
                                        </ul>
                                        
                                        <!-- Tab Content -->
                                        <div class="tab-content" id="faceSelectionContent">
                                            <!-- Upload New Face -->
                                            <div class="tab-pane fade show active" id="upload-pane" role="tabpanel">
                                                <div class="upload-area border-2 border-dashed border-primary rounded p-4 text-center" ondrop="handleFaceDrop(event)" ondragover="handleFaceDragOver(event)" onclick="document.getElementById('faceImageInput').click()">
                                                    <i class="bi bi-cloud-upload fs-1 text-primary mb-2"></i>
                                                    <p class="mb-2">${window.mergeFaceTranslations?.dragDropHere || 'Drag & drop an image here or click to select'}</p>
                                                    <small class="text-muted">${window.mergeFaceTranslations?.supportedFormats || 'Supported formats: JPG, PNG, WebP (max 10MB)'}</small>
                                                    <input type="file" id="faceImageInput" accept="image/*" style="display: none;" onchange="handleFaceUpload(event)">
                                                </div>
                                                <div id="uploadProgress" class="mt-3" style="display: none;">
                                                    <div class="progress">
                                                        <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                                                    </div>
                                                    <small class="text-muted mt-1 d-block">Uploading and optimizing...</small>
                                                </div>
                                            </div>
                                            
                                            <!-- Existing Faces -->
                                            <div class="tab-pane fade" id="existing-pane" role="tabpanel">
                                                <div id="existingFacesContainer" class="row">
                                                    <!-- Will be populated dynamically -->
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <!-- Selected Face Preview -->
                                        <div id="selectedFacePreview" class="mt-3" style="display: none;">
                                            <h6>${window.mergeFaceTranslations?.selectedFace || 'Selected Face'}</h6>
                                            <div class="border rounded p-2 text-center">
                                                <img id="selectedFaceImage" src="" alt="Selected Face" class="img-fluid rounded" style="max-height: 150px;">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Right Column: Existing Merge Results -->
                            <div class="col-lg-4">
                                <h6 class="mb-3">
                                    <i class="bi bi-collection me-2"></i>
                                    ${window.mergeFaceTranslations?.existingResults || 'Previous Results'}
                                </h6>
                                <div id="existingMergeResults" class="existing-merge-results" style="max-height: 400px; overflow-y: auto;">
                                    <!-- Will be populated dynamically -->
                                </div>
                            </div>
                        </div>
                        
                        <!-- Description -->
                        <div class="alert alert-info mt-3">
                            <i class="bi bi-info-circle me-2"></i>
                            ${window.mergeFaceTranslations?.description || 'Replace the face in this image with another face'}
                        </div>
                        
                        <!-- Merge Progress -->
                        <div id="mergeProgress" class="mt-3" style="display: none;">
                            <div class="d-flex align-items-center">
                                <div class="spinner-border spinner-border-sm text-primary me-3" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <span>${window.mergeFaceTranslations?.processing || 'Merging faces...'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            ${window.mergeFaceTranslations?.cancel || 'Cancel'}
                        </button>
                        <button type="button" class="btn btn-primary" id="mergeFaceBtn" onclick="performFaceMerge()" disabled>
                            <i class="bi bi-person-plus me-2"></i>
                            ${window.mergeFaceTranslations?.merge || 'Merge Face'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Load user's uploaded faces
async function loadUserFaces() {
    try {
        const response = await fetch('/api/merge-face/user-faces');
        const data = await response.json();
        
        if (data.success) {
            userUploadedFaces = data.faces;
            displayExistingFaces();
        }
    } catch (error) {
        console.error('Error loading user faces:', error);
    }
}

// Display existing faces in the modal
function displayExistingFaces() {
    const container = document.getElementById('existingFacesContainer');
    
    if (userUploadedFaces.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="bi bi-person-slash fs-1 text-muted mb-2"></i>
                <p class="text-muted">${window.mergeFaceTranslations?.noFacesUploaded || 'No faces uploaded yet'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = userUploadedFaces.map(face => `
        <div class="col-6 mb-3">
            <div class="card h-100 face-selection-card" onclick="selectExistingFace('${face._id}')" data-face-id="${face._id}">
                <div class="card-body p-2 text-center">
                    <div class="face-preview-container mb-2" style="height: 80px; overflow: hidden; border-radius: 4px;">
                        <img src="${face.faceImageUrl}" alt="Face" class="img-fluid" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy">
                    </div>
                    <small class="text-muted d-block text-truncate">${face.originalFilename || 'Face'}</small>
                    <small class="text-muted">${new Date(face.createdAt).toLocaleDateString()}</small>
                </div>
            </div>
        </div>
    `).join('');
}

// Load existing merge results for the current image
async function loadExistingMergeResults(imageId) {
    try {
        const response = await fetch(`/api/merge-face/results/${imageId}`);
        const data = await response.json();
        
        if (data.success && data.results) {
            displayExistingMergeResults(data.results);
        }
    } catch (error) {
        console.error('Error loading existing merge results:', error);
    }
}

// Display existing merge results in the modal
function displayExistingMergeResults(results) {
    const container = document.getElementById('existingMergeResults');
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="bi bi-images fs-1 mb-2 d-block"></i>
                <small>${window.mergeFaceTranslations?.noResultsYet || 'No merge results yet'}</small>
            </div>
        `;
        return;
    }
    
    container.innerHTML = results.map((result, index) => `
        <div class="card mb-3 merge-result-card">
            <div class="card-body p-2">
                <div class="merge-result-preview mb-2" style="height: 250px; overflow: hidden; border-radius: 4px;">
                    <img src="${result.mergedImageUrl}" alt="Merge Result ${index + 1}" 
                         class="img-fluid w-100 h-100" 
                         style="object-fit: cover; cursor: pointer;"
                         onclick="showImagePreview(this)">
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${new Date(result.createdAt).toLocaleDateString()}</small>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-sm" 
                                onclick="downloadMergedImageFromUrl('${result._id}', '${result.mergedImageUrl}')"
                                title="Download">
                            <i class="bi bi-download"></i>
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" 
                                onclick="previewMergeResult('${result.mergedImageUrl}')"
                                title="Preview">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Preview merge result in a larger view
function previewMergeResult(imageUrl) {
    // Create a temporary image element and trigger the existing preview function
    const tempImg = document.createElement('img');
    tempImg.src = imageUrl;
    tempImg.alt = 'Merge Result Preview';
    showImagePreview(tempImg);
}

// Handle face image drag and drop
function handleFaceDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
}

function handleFaceDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        handleFaceFile(files[0]);
    }
}

// Handle face upload input change
function handleFaceUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleFaceFile(file);
    }
}

// Process uploaded face file
async function handleFaceFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showNotification(window.mergeFaceTranslations?.invalidFile || 'Please upload a valid image file', 'error');
        return;
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showNotification(window.mergeFaceTranslations?.fileTooLarge || 'File too large', 'error');
        return;
    }
    
    // Show upload progress
    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = progressContainer.querySelector('.progress-bar');
    progressContainer.style.display = 'block';
    progressBar.style.width = '30%';
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('face', file);
        
        // Upload face
        const response = await fetch('/api/merge-face/upload-face', {
            method: 'POST',
            body: formData
        });
        
        progressBar.style.width = '100%';
        
        const data = await response.json();
        
        if (data.success) {
            // Face uploaded successfully
            showNotification(`Face uploaded successfully (${data.sizeKB}KB, ${data.quality}% quality)`, 'success');
            
            // Store the face ID for merging
            window.selectedFaceId = data.faceId;
            
            // Enable merge button
            document.getElementById('mergeFaceBtn').disabled = false;
            
            // Show preview using the S3 URL
            showSelectedFacePreviewFromUrl(data.faceImageUrl);
            
            // Reload user faces list
            loadUserFaces();
        } else {
            showNotification(data.error || 'Upload failed', 'error');
        }
    } catch (error) {
        console.error('Error uploading face:', error);
        showNotification('Upload failed', 'error');
    } finally {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
    }
}

// Select existing face
function selectExistingFace(faceId) {
    // Remove previous selections
    document.querySelectorAll('.face-selection-card').forEach(card => {
        card.classList.remove('border-primary', 'bg-light');
    });
    
    // Highlight selected card
    const selectedCard = document.querySelector(`[data-face-id="${faceId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('border-primary', 'bg-light');
        
        // Show preview of selected face
        const faceImage = selectedCard.querySelector('img');
        if (faceImage) {
            showSelectedFacePreviewFromUrl(faceImage.src);
        }
    }
    
    // Store selected face ID
    window.selectedFaceId = faceId;
    
    // Enable merge button
    document.getElementById('mergeFaceBtn').disabled = false;
}

// Show selected face preview from URL
function showSelectedFacePreviewFromUrl(imageUrl) {
    const previewContainer = document.getElementById('selectedFacePreview');
    const previewImage = document.getElementById('selectedFaceImage');
    
    previewImage.src = imageUrl;
    previewContainer.style.display = 'block';
}

// Perform face merge
async function performFaceMerge() {
    if (!window.selectedFaceId) {
        showNotification('Please select a face first', 'error');
        return;
    }
    
    // Show progress
    const progressContainer = document.getElementById('mergeProgress');
    const mergeBtn = document.getElementById('mergeFaceBtn');
    
    progressContainer.style.display = 'block';
    mergeBtn.disabled = true;
    
    try {
        const response = await fetch('/api/merge-face/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageId: currentMergeImageId,
                faceId: window.selectedFaceId,
                userChatId: currentMergeUserChatId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message || 'Face merge completed successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('mergeFaceModal'));
            modal.hide();
            
            // Display merged result (this will be handled by WebSocket notification)
            // The mergeFaceCompleted WebSocket event will handle the UI update
            
        } else {
            showNotification(data.error || 'Face merge failed', 'error');
        }
    } catch (error) {
        console.error('Error merging faces:', error);
        showNotification('Face merge failed', 'error');
    } finally {
        progressContainer.style.display = 'none';
        mergeBtn.disabled = false;
    }
}

// Handle WebSocket notification for merge completion
window.addEventListener('mergeFaceCompleted', function(event) {
    const data = event.detail;
    
    // Create and display merged image result
    displayMergedResult(data);
    
    showNotification(window.mergeFaceTranslations?.mergeCompleted || 'Face merge completed', 'success');
});

// Handle WebSocket notification for image generated (merge face)
window.addEventListener('imageGenerated', function(event) {
    const data = event.detail;
    
    // Check if this is a merge face result
    if (data.isMergeFace) {
        console.log('Merge face image generated:', data);
        
        // Display in chat if we have the context
        if (data.userChatId && data.imageUrl) {
            // This will be handled by the existing image display logic
            // The imageGenerated event already handles displaying images in chat
        }
    }
});

// Display merged result
function displayMergedResult(data) {
    // Create merged image element using S3 URL instead of base64
    const mergedImageHTML = `
        <div class="merged-face-result border rounded p-3 mb-3 bg-light">
            <h6 class="mb-2">
                <i class="bi bi-person-check me-2 text-success"></i>
                ${window.mergeFaceTranslations?.mergeCompleted || 'Face Merge Result'}
            </h6>
            <img src="${data.mergedImageUrl}" alt="Merged Result" class="img-fluid rounded mb-2">
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" onclick="downloadMergedImageFromUrl('${data.mergeId}', '${data.mergedImageUrl}')">
                    <i class="bi bi-download me-1"></i>Download
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="shareMergedImage('${data.mergeId}')">
                    <i class="bi bi-share me-1"></i>Share
                </button>
            </div>
        </div>
    `;
    
    // Find the original image container and add the result
    const imageContainer = document.querySelector(`[data-image-id="${data.imageId}"]`)?.closest('.image-container');
    if (imageContainer) {
        imageContainer.insertAdjacentHTML('afterend', mergedImageHTML);
    }
}

// Download merged image from URL
function downloadMergedImageFromUrl(mergeId, imageUrl) {
    const link = document.createElement('a');
    link.download = `merged-face-${mergeId}.jpg`;
    link.href = imageUrl;
    link.target = '_blank';
    link.click();
}

// Download merged image (existing function for backward compatibility)
function downloadMergedImage(mergeId, base64Data) {
    const link = document.createElement('a');
    link.download = `merged-face-${mergeId}.jpg`;
    link.href = `data:image/jpeg;base64,${base64Data}`;
    link.click();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set original image preview when modal is shown
    document.addEventListener('show.bs.modal', function(event) {
        if (event.target.id === 'mergeFaceModal') {
            const originalPreview = document.getElementById('originalImagePreview');
            if (originalPreview && currentMergeImageUrl) {
                originalPreview.src = currentMergeImageUrl;
            }
        }
    });
    
    // Reset modal when hidden
    document.addEventListener('hidden.bs.modal', function(event) {
        if (event.target.id === 'mergeFaceModal') {
            // Reset selections
            window.selectedFaceId = null;
            document.getElementById('mergeFaceBtn').disabled = true;
            document.getElementById('selectedFacePreview').style.display = 'none';
            document.getElementById('mergeProgress').style.display = 'none';
            
            // Reset file input
            document.getElementById('faceImageInput').value = '';
            
            // Reset tab to upload
            document.getElementById('upload-tab').click();
            
            // Clear existing merge results
            document.getElementById('existingMergeResults').innerHTML = '';
        }
    });
});

// Make functions globally available
window.openMergeFaceModal = openMergeFaceModal;
window.loadExistingMergeResults = loadExistingMergeResults;
window.displayExistingMergeResults = displayExistingMergeResults;
window.previewMergeResult = previewMergeResult;
