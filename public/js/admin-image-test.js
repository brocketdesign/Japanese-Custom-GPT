/**
 * Admin Image Model Test Dashboard - Frontend JavaScript
 * Handles multi-model testing, timing, and statistics
 */

// Global state
const state = {
    activeTasks: new Map(),
    timers: new Map(),
    pollIntervals: new Map(),
    generationStartTime: null,
    isGenerating: false,
    stylePresets: {
        anime: {
            prefix: 'anime style, illustration, ',
            suffix: ', high quality, detailed'
        },
        photorealistic: {
            prefix: 'photorealistic, ultra detailed, ',
            suffix: ', professional photography, 8k resolution'
        }
    },
    currentStyle: '',
    customizedPrompt: null, // Track if user has manually edited the final prompt
    // Pricing state
    imageCostPerUnit: window.PRICING?.imageCostPerUnit || 50,
    userPoints: window.PRICING?.userPoints || 0
};

/**
 * Calculate and update the total cost display
 */
function updateCostDisplay() {
    const selectedModels = getSelectedModels();
    const selectedSDModels = getSelectedSDModels();
    const imagesPerModel = parseInt(document.getElementById('imagesPerModel')?.value) || 1;
    
    const totalModels = selectedModels.length + selectedSDModels.length;
    const totalImages = totalModels * imagesPerModel;
    const totalCost = totalImages * state.imageCostPerUnit;
    
    // Update display elements
    const totalCostDisplay = document.getElementById('totalCostDisplay');
    const imageCountDisplay = document.getElementById('imageCountDisplay');
    const userPointsDisplay = document.getElementById('userPointsDisplay');
    const costSection = document.getElementById('costDisplaySection');
    const costStatusBadge = document.getElementById('costStatusBadge');
    
    if (totalCostDisplay) {
        totalCostDisplay.textContent = totalCost;
    }
    
    if (imageCountDisplay) {
        imageCountDisplay.textContent = totalImages;
    }
    
    // Check if user has enough points
    const hasEnoughPoints = state.userPoints >= totalCost;
    
    // Update user points display
    if (userPointsDisplay) {
        userPointsDisplay.textContent = state.userPoints;
        if (hasEnoughPoints || totalCost === 0) {
            userPointsDisplay.style.color = '#4ade80'; // Green
        } else {
            userPointsDisplay.style.color = '#f87171'; // Red
        }
    }
    
    // Update status badge
    if (costStatusBadge) {
        if (totalCost === 0) {
            costStatusBadge.innerHTML = '<i class="bi bi-hand-index me-1"></i>Select models';
            costStatusBadge.style.background = 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)';
            costStatusBadge.style.color = '#fff';
        } else if (hasEnoughPoints) {
            costStatusBadge.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Ready';
            costStatusBadge.style.background = 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)';
            costStatusBadge.style.color = '#000';
        } else {
            costStatusBadge.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>Need more points';
            costStatusBadge.style.background = 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)';
            costStatusBadge.style.color = '#fff';
        }
    }
    
    // Update cost section border based on affordability
    if (costSection && totalCost > 0) {
        if (!hasEnoughPoints) {
            costSection.style.border = '1px solid rgba(248, 113, 113, 0.5)';
            costSection.style.boxShadow = '0 0 20px rgba(248, 113, 113, 0.1)';
        } else {
            costSection.style.border = '1px solid rgba(74, 222, 128, 0.3)';
            costSection.style.boxShadow = '0 0 20px rgba(74, 222, 128, 0.1)';
        }
    } else if (costSection) {
        costSection.style.border = '1px solid rgba(255,255,255,0.1)';
        costSection.style.boxShadow = 'none';
    }
    
    return { totalCost, totalImages, hasEnoughPoints };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('[AdminImageTest] Dashboard initialized');
    
    // Initialize model checkbox click handlers
    initializeModelCheckboxes();
    
    // Initialize rating stars
    initializeRatingStars();
    
    // Initialize history preview buttons (for server-rendered items)
    initializeHistoryPreviewButtons();
    
    // Load initial stats
    refreshStats();
    
    // Add event listeners for style preset changes
    document.querySelectorAll('input[name="stylePreset"]').forEach(radio => {
        radio.addEventListener('change', handleStylePresetChange);
    });
    
    // Initialize the preview
    updateFinalPromptPreview();
    
    // Initialize cost display
    updateCostDisplay();
    
    // Add event listener for images per model change
    const imagesPerModelSelect = document.getElementById('imagesPerModel');
    if (imagesPerModelSelect) {
        imagesPerModelSelect.addEventListener('change', updateCostDisplay);
    }
    
    // Check for prompt from Templates page
    const storedPrompt = sessionStorage.getItem('promptFromTemplates');
    if (storedPrompt) {
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.value = storedPrompt;
            showNotification('Prompt loaded from Templates!', 'success');
            updateFinalPromptPreview();
        }
        sessionStorage.removeItem('promptFromTemplates');
    }
    
    // Add event delegation for copy prompt buttons (for dynamically loaded content)
    document.addEventListener('click', function(e) {
        if (e.target.closest('.copy-prompt-btn')) {
            const button = e.target.closest('.copy-prompt-btn');
            const prompt = button.getAttribute('data-prompt');
            if (prompt) {
                // Parse JSON if it's JSON string, otherwise use as-is
                let promptText;
                try {
                    promptText = JSON.parse(prompt);
                } catch (err) {
                    promptText = prompt;
                }
                copyPrompt(promptText, button);
            }
        }
    });
});

/**
 * Initialize history preview buttons for server-rendered items
 */
function initializeHistoryPreviewButtons() {
    // Handle thumbnail clicks
    document.querySelectorAll('#historyTableBody .history-thumbnail').forEach(thumbnail => {
        thumbnail.addEventListener('click', function() {
            const imageUrl = this.dataset.imageUrl;
            const modelName = this.dataset.modelName || 'Unknown Model';
            const generationTime = parseInt(this.dataset.generationTime) || 0;
            const testId = this.dataset.testId || '';
            const prompt = this.dataset.prompt || '';
            previewHistoryImage(imageUrl, modelName, generationTime, testId, prompt);
        });
    });
    
    // Handle preview button clicks
    document.querySelectorAll('#historyTableBody .preview-history-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const imageUrl = this.dataset.imageUrl;
            const modelName = this.dataset.modelName || 'Unknown Model';
            const generationTime = parseInt(this.dataset.generationTime) || 0;
            const testId = this.dataset.testId || '';
            const prompt = this.dataset.prompt || '';
            previewHistoryImage(imageUrl, modelName, generationTime, testId, prompt);
        });
    });
}

/**
 * Handle style preset radio button change
 */
function handleStylePresetChange(event) {
    const style = event.target.value;
    state.currentStyle = style;
    state.customizedPrompt = null; // Reset customization when changing style
    updateFinalPromptPreview();
}

/**
 * Update the final prompt preview based on selected style
 */
function updateFinalPromptPreview() {
    const previewContainer = document.getElementById('stylePresetPreview');
    const basePrompt = document.getElementById('promptInput').value.trim();
    const selectedStyle = document.querySelector('input[name="stylePreset"]:checked')?.value || '';
    
    state.currentStyle = selectedStyle;
    
    if (!selectedStyle) {
        // No style selected, hide preview
        previewContainer.style.display = 'none';
        return;
    }
    
    // Show preview
    previewContainer.style.display = 'block';
    
    const preset = state.stylePresets[selectedStyle];
    if (!preset) return;
    
    // Update the editable fields
    document.getElementById('stylePrefixInput').value = preset.prefix;
    document.getElementById('stylePromptDisplay').textContent = basePrompt;
    document.getElementById('styleSuffixInput').value = preset.suffix;
    
    // Update combined final prompt
    updateFinalPromptFromParts();
}

/**
 * Update final prompt from individual parts (prefix + prompt + suffix)
 */
function updateFinalPromptFromParts() {
    const prefix = document.getElementById('stylePrefixInput').value;
    const basePrompt = document.getElementById('promptInput').value.trim();
    const suffix = document.getElementById('styleSuffixInput').value;
    
    const finalPrompt = prefix + basePrompt + suffix;
    document.getElementById('finalPromptInput').value = finalPrompt;
    state.customizedPrompt = finalPrompt;
}

/**
 * Reset to default preset values
 */
function resetToPreset() {
    const selectedStyle = state.currentStyle;
    if (!selectedStyle || !state.stylePresets[selectedStyle]) return;
    
    const preset = state.stylePresets[selectedStyle];
    document.getElementById('stylePrefixInput').value = preset.prefix;
    document.getElementById('styleSuffixInput').value = preset.suffix;
    state.customizedPrompt = null;
    
    updateFinalPromptFromParts();
    showNotification('Reset to default preset', 'info');
}

/**
 * Get the final prompt to send to API
 */
function getFinalPrompt() {
    const selectedStyle = document.querySelector('input[name="stylePreset"]:checked')?.value || '';
    const basePrompt = document.getElementById('promptInput').value.trim();
    
    if (!selectedStyle) {
        // No style selected, use base prompt
        return basePrompt;
    }
    
    // Use the customized final prompt from the textarea
    const finalPromptInput = document.getElementById('finalPromptInput');
    if (finalPromptInput && finalPromptInput.value.trim()) {
        return finalPromptInput.value.trim();
    }
    
    // Fallback to combining parts
    const prefix = document.getElementById('stylePrefixInput')?.value || '';
    const suffix = document.getElementById('styleSuffixInput')?.value || '';
    return prefix + basePrompt + suffix;
}

/**
 * Initialize model checkbox click handlers
 */
function initializeModelCheckboxes() {
    // Handle all model checkboxes
    document.querySelectorAll('.model-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', function(e) {
            // Don't trigger if clicking on a link or button inside
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a') || e.target.closest('button')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.classList.toggle('selected');
            
            // Check if this is an SD model
            const sdInput = this.querySelector('.sd-model-checkbox');
            if (sdInput) {
                updateSDParamsVisibility();
            }
            
            // Update cost display whenever selection changes
            updateCostDisplay();
        });
    });
}

/**
 * Select all standard model checkboxes
 */
function selectAllModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox');
    const standardCheckboxes = Array.from(checkboxes).filter(cb => !cb.querySelector('.sd-model-checkbox'));
    const allSelected = standardCheckboxes.every(cb => cb.classList.contains('selected'));
    
    standardCheckboxes.forEach(cb => {
        if (allSelected) {
            cb.classList.remove('selected');
        } else {
            cb.classList.add('selected');
        }
    });
    
    // Update cost display
    updateCostDisplay();
}

/**
 * Select all SD model checkboxes
 */
function selectAllSDModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox');
    const sdCheckboxes = Array.from(checkboxes).filter(cb => cb.querySelector('.sd-model-checkbox'));
    const allSelected = sdCheckboxes.every(cb => cb.classList.contains('selected'));
    
    sdCheckboxes.forEach(cb => {
        if (allSelected) {
            cb.classList.remove('selected');
        } else {
            cb.classList.add('selected');
        }
    });
    
    updateSDParamsVisibility();
    
    // Update cost display
    updateCostDisplay();
}

/**
 * Get selected standard models
 */
function getSelectedModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox.selected');
    const standardSelected = Array.from(checkboxes).filter(cb => !cb.querySelector('.sd-model-checkbox'));
    
    return standardSelected.map(cb => {
        const input = cb.querySelector('input[type="checkbox"]');
        return {
            id: input.value,
            name: input.dataset.modelName
        };
    });
}

/**
 * Get selected SD models
 */
function getSelectedSDModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox.selected');
    const sdSelected = Array.from(checkboxes).filter(cb => cb.querySelector('.sd-model-checkbox'));
    
    return sdSelected.map(cb => {
        const input = cb.querySelector('.sd-model-checkbox');
        return {
            modelId: input.value,
            model: input.dataset.model,
            model_name: input.dataset.model,
            name: input.dataset.modelName
        };
    });
}

/**
 * Update SD parameters section visibility
 */
function updateSDParamsVisibility() {
    const sdSection = document.getElementById('sdParamsSection');
    const selectedSD = getSelectedSDModels();
    
    if (sdSection) {
        sdSection.style.display = selectedSD.length > 0 ? 'block' : 'none';
    }
}

// SD params visibility is now handled in initializeModelCheckboxes()

/**
 * Start generation for selected models
 */
async function startGeneration() {
    const selectedModels = getSelectedModels();
    const selectedSDModels = getSelectedSDModels();
    
    if (selectedModels.length === 0 && selectedSDModels.length === 0) {
        showNotification('Please select at least one model', 'warning');
        return;
    }

    const basePrompt = document.getElementById('promptInput').value.trim();
    if (!basePrompt) {
        showNotification('Please enter a prompt', 'warning');
        return;
    }

    // Check if user has enough points before proceeding
    const { totalCost, totalImages, hasEnoughPoints } = updateCostDisplay();
    if (!hasEnoughPoints) {
        showNotification(`Insufficient points. You need ${totalCost} points but only have ${state.userPoints} points.`, 'error');
        return;
    }

    const size = document.getElementById('sizeSelect').value;
    const style = document.querySelector('input[name="stylePreset"]:checked')?.value || '';
    const imagesPerModel = parseInt(document.getElementById('imagesPerModel').value) || 1;
    
    // Get the final prompt (with style applied and any user edits)
    const finalPrompt = getFinalPrompt();
    
    // Get SD parameters if SD models are selected
    let sdParams = {};
    if (selectedSDModels.length > 0) {
        sdParams = {
            negativePrompt: document.getElementById('sdNegativePrompt')?.value || '',
            steps: document.getElementById('sdSteps')?.value || '30',
            guidanceScale: document.getElementById('sdGuidanceScale')?.value || '7.5',
            samplerName: document.getElementById('sdSampler')?.value || 'Euler a'
        };
    }

    console.log('[AdminImageTest] Starting generation:', {
        models: selectedModels.map(m => m.id),
        sdModels: selectedSDModels.map(m => m.model),
        basePrompt: basePrompt.substring(0, 50) + '...',
        finalPrompt: finalPrompt.substring(0, 80) + '...',
        size,
        style,
        sdParams
    });

    // Clear previous results
    clearResults();
    
    // Update UI state
    state.isGenerating = true;
    state.generationStartTime = Date.now();
    updateGenerateButton(true);
    document.getElementById('totalTimeDisplay').classList.remove('d-none');
    startTotalTimer();

    try {
        const requestBody = {
            prompt: finalPrompt, // Send the final edited prompt
            basePrompt: basePrompt, // Also send base prompt for reference
            size,
            style,
            skipStyleApplication: !!style, // Tell server not to apply style again
            imagesPerModel: imagesPerModel // Number of images to generate per model
        };
        
        // Add standard models if any selected
        if (selectedModels.length > 0) {
            requestBody.models = selectedModels.map(m => m.id);
        }
        
        // Add SD models and parameters if any selected
        if (selectedSDModels.length > 0) {
            requestBody.selectedSDModels = selectedSDModels;
            requestBody.negativePrompt = sdParams.negativePrompt;
            requestBody.steps = sdParams.steps;
            requestBody.guidanceScale = sdParams.guidanceScale;
            requestBody.samplerName = sdParams.samplerName;
        }
        
        const response = await fetch('/dashboard/image/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            // Handle insufficient points error
            if (response.status === 402) {
                showNotification(data.message || `Insufficient points. Need ${data.required} but have ${data.available}.`, 'error');
                state.userPoints = data.available || 0;
                updateCostDisplay();
                state.isGenerating = false;
                updateGenerateButton(false);
                stopTotalTimer();
                return;
            }
            throw new Error(data.error || 'Generation failed');
        }

        // Update user points after successful deduction
        const totalModelsCount = selectedModels.length + selectedSDModels.length;
        const totalImagesCount = totalModelsCount * imagesPerModel;
        const deductedCost = totalImagesCount * state.imageCostPerUnit;
        state.userPoints -= deductedCost;
        updateCostDisplay();

        console.log('[AdminImageTest] Generation started:', data);

        // Process each task - create cards dynamically based on tasks returned
        data.tasks.forEach(task => {
            // Use cardId from task if provided (for multiple images per model), otherwise derive it
            let cardId = task.cardId || task.modelId;
            
            // For SD models, use the custom card ID
            if (task.modelId === 'sd-txt2img' && task.sdModelName) {
                // Find the matching SD model to get the card ID
                const matchingSD = selectedSDModels.find(sd => sd.model === task.sdModelName || sd.name === task.sdModelName);
                if (matchingSD && !task.cardId) {
                    cardId = `sd-${matchingSD.modelId}`;
                }
            }
            
            // Create card if it doesn't exist (for dynamically created tasks)
            const cardElement = document.getElementById(`result-${cardId}`);
            if (!cardElement) {
                const displayName = task.modelName || task.modelId;
                createResultCard(cardId, displayName);
            }
            
            state.activeTasks.set(cardId, task);
            updateResultCard(cardId, task);

            if (task.status === 'processing' && task.async) {
                // Start polling for async tasks
                startTaskPolling(task, cardId);
            } else if (task.status === 'completed') {
                // Handle sync completion
                handleTaskCompletion(task);
            } else if (task.status === 'failed') {
                // Handle immediate failure
                handleTaskFailure(task);
            }
        });

    } catch (error) {
        console.error('[AdminImageTest] Generation error:', error);
        showNotification(error.message, 'error');
        state.isGenerating = false;
        updateGenerateButton(false);
        stopTotalTimer();
    }
}

/**
 * Create a result card for a model
 */
function createResultCard(modelId, modelName) {
    const container = document.getElementById('resultsContainer');
    const placeholder = document.getElementById('noResultsPlaceholder');
    
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    const card = document.createElement('div');
    card.id = `result-${modelId}`;
    card.className = 'result-card mb-3 p-3 rounded position-relative';
    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="text-white mb-0">${modelName}</h6>
            <div class="d-flex align-items-center gap-2">
                <span class="timer badge bg-secondary" id="timer-${modelId}">0.0s</span>
                <span class="status badge bg-warning" id="status-${modelId}">
                    <span class="spinner-border spinner-border-sm me-1"></span>
                    Starting...
                </span>
            </div>
        </div>
        <div class="progress mb-2" style="height: 4px;">
            <div class="progress-bar" id="progress-${modelId}" role="progressbar" style="width: 0%"></div>
        </div>
        <div class="result-image-container" id="image-container-${modelId}">
            <div class="text-center text-muted py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 mb-0 small">Generating...</p>
            </div>
        </div>
    `;

    container.appendChild(card);

    // Start individual timer
    startModelTimer(modelId);
}

/**
 * Update a result card with task status
 */
function updateResultCard(modelId, task) {
    const statusEl = document.getElementById(`status-${modelId}`);
    const progressEl = document.getElementById(`progress-${modelId}`);
    const imageContainer = document.getElementById(`image-container-${modelId}`);
    const card = document.getElementById(`result-${modelId}`);

    if (!statusEl || !card) return;

    if (task.status === 'processing') {
        statusEl.className = 'status badge bg-info';
        statusEl.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1"></span>
            Processing ${task.progress || 0}%
        `;
        progressEl.style.width = `${task.progress || 0}%`;
        progressEl.className = 'progress-bar bg-info';
    } else if (task.status === 'completed') {
        stopModelTimer(modelId);
        const time = task.generationTime || (Date.now() - task.startTime);
        
        statusEl.className = 'status badge bg-success';
        statusEl.innerHTML = `<i class="bi bi-check-circle me-1"></i>Completed`;
        progressEl.style.width = '100%';
        progressEl.className = 'progress-bar bg-success';

        // Update timer with final time
        const timerEl = document.getElementById(`timer-${modelId}`);
        if (timerEl) {
            timerEl.textContent = `${(time / 1000).toFixed(1)}s`;
            timerEl.className = 'timer badge bg-success';
        }

        // Display images first (they're already available)
        if (task.images && task.images.length > 0) {
            displayImages(modelId, task.images, time);
        }
        
        // Save result to get testId - use task.modelId, not the card modelId
        // This updates task.testId which will be used if user clicks on image again
        // Only save if not already saved and not currently saving (prevent duplicate saves)
        const currentTask = state.activeTasks.get(modelId);
        if (!currentTask?.testId && !currentTask?.saving) {
            // Mark as saving immediately to prevent duplicate saves
            task.saving = true;
            state.activeTasks.set(modelId, task);
            
            saveTestResult(task.modelId || modelId, task).catch(err => {
                console.error(`[AdminImageTest] Error saving result for ${modelId}:`, err);
                // Clear saving flag on error so it can be retried
                const errorTask = state.activeTasks.get(modelId);
                if (errorTask) {
                    errorTask.saving = false;
                    state.activeTasks.set(modelId, errorTask);
                }
            });
        }
        
        card.classList.add('completed');
    } else if (task.status === 'failed') {
        stopModelTimer(modelId);
        
        statusEl.className = 'status badge bg-danger';
        statusEl.innerHTML = `<i class="bi bi-x-circle me-1"></i>Failed`;
        progressEl.style.width = '100%';
        progressEl.className = 'progress-bar bg-danger';

        imageContainer.innerHTML = `
            <div class="text-center text-danger py-3">
                <i class="bi bi-exclamation-triangle display-4"></i>
                <p class="mt-2 mb-0">${task.error || 'Generation failed'}</p>
            </div>
        `;

        card.classList.add('failed');
    }

    // Check if all tasks are complete
    checkAllTasksComplete();
}

/**
 * Display generated images
 */
function displayImages(modelId, images, time) {
    const container = document.getElementById(`image-container-${modelId}`);
    if (!container) return;

    container.innerHTML = '';

    images.forEach((img, index) => {
        const imgUrl = img.imageUrl || img.image_url || img;
        const task = state.activeTasks.get(modelId);
        // Get testId from task (will be set when saveTestResult completes)
        // For now, use empty string and it will be updated when save completes
        const testId = task?.testId || '';
        const escapedUrl = imgUrl.replace(/'/g, "\\'");
        // Use task.modelId for modal, not the card modelId (which might be like 'sd-xxx')
        const actualModelId = task?.modelId || modelId;
        const actualModelName = task?.modelName || modelId;
        
        // Create image element with onclick that will get updated testId from task
        const wrapper = document.createElement('div');
        wrapper.className = 'result-image-wrapper d-inline-block position-relative';
        const imgElement = document.createElement('img');
        imgElement.src = imgUrl;
        imgElement.alt = `Generated Image ${index + 1}`;
        imgElement.className = 'result-image img-fluid rounded cursor-pointer';
        imgElement.onerror = function() { this.src = '/img/placeholder.png'; };
        imgElement.onclick = function() {
            // Get latest testId from task (may have been updated by saveTestResult)
            const currentTask = state.activeTasks.get(modelId);
            const currentTestId = currentTask?.testId || testId;
            previewImage(escapedUrl, actualModelId, time, currentTestId);
        };
        wrapper.appendChild(imgElement);
        container.appendChild(wrapper);
    });
}

/**
 * Preview image in modal
 */
function previewImage(imageUrl, modelId, time, testId = null) {
    const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    const modalElement = document.getElementById('imagePreviewModal');
    
    document.getElementById('previewImage').src = imageUrl;
    
    const task = state.activeTasks.get(modelId);
    const modelName = task?.modelName || modelId;
    const prompt = task?.finalPrompt || task?.originalPrompt || '';
    
    document.getElementById('previewModelName').textContent = modelName;
    document.getElementById('previewTime').textContent = `Generated in ${(time / 1000).toFixed(1)} seconds`;
    
    // Show truncated prompt
    const promptEl = document.getElementById('previewPrompt');
    if (promptEl && prompt) {
        const truncatedPrompt = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
        promptEl.textContent = truncatedPrompt;
        promptEl.title = prompt;
        promptEl.style.display = 'block';
    } else if (promptEl) {
        promptEl.style.display = 'none';
    }
    
    // Store current image info for rating and draft
    modalElement.dataset.modelId = modelId;
    modalElement.dataset.modelName = modelName;
    modalElement.dataset.imageUrl = imageUrl;
    modalElement.dataset.testId = testId || '';
    modalElement.dataset.prompt = prompt;
    
    // Reset rating stars
    resetRatingStars();
    
    // Load existing rating if testId is provided
    if (testId) {
        loadImageRating(testId);
    }
    
    modal.show();
}

/**
 * Start polling for async task status
 */
function startTaskPolling(task, cardId) {
    const actualCardId = cardId || task.modelId;
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/dashboard/image/status/${task.taskId}`);
            const data = await response.json();

            console.log(`[AdminImageTest] Poll ${actualCardId}:`, data.status, data.progress || 0);

            // Get current task from state to preserve testId and saving flag
            const currentTask = state.activeTasks.get(actualCardId) || task;
            // Update task with new data, preserving existing testId and saving flag
            const updatedTask = {
                ...currentTask,
                ...data,
                generationTime: Date.now() - task.startTime
            };
            
            state.activeTasks.set(actualCardId, updatedTask);
            updateResultCard(actualCardId, updatedTask);

            // Stop polling if task is complete, failed, or errored
            if (data.status === 'completed' || data.status === 'failed' || data.status === 'error') {
                clearInterval(pollInterval);
                state.pollIntervals.delete(actualCardId);

                if (data.status === 'completed') {
                    handleTaskCompletion(updatedTask);
                } else {
                    // Handle both 'failed' and 'error' status as failures
                    handleTaskFailure(updatedTask);
                }
            }
        } catch (error) {
            console.error(`[AdminImageTest] Polling error for ${actualCardId}:`, error);
            // On fetch error, keep polling but log the error
            // The backend checkTaskResult already returns error status, so this catch is for network errors
        }
    }, 2000); // Poll every 2 seconds

    state.pollIntervals.set(actualCardId, pollInterval);
}

/**
 * Handle task completion
 */
function handleTaskCompletion(task) {
    console.log(`[AdminImageTest] Task completed: ${task.modelId} in ${task.generationTime}ms`);
    showNotification(`${task.modelName} completed in ${(task.generationTime / 1000).toFixed(1)}s`, 'success');
}

/**
 * Handle task failure
 */
function handleTaskFailure(task) {
    console.error(`[AdminImageTest] Task failed: ${task.modelId}`, task.error);
    showNotification(`${task.modelName} failed: ${task.error}`, 'error');
}

/**
 * Save test result to database
 */
async function saveTestResult(modelId, task) {
    return fetch('/dashboard/image/save-result', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            modelId,
            modelName: task.modelName,
            prompt: task.finalPrompt || task.originalPrompt,
            params: {
                size: task.size,
                style: task.style
            },
            generationTime: task.generationTime,
            status: task.status,
            images: task.images,
            error: task.error
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(`[AdminImageTest] Result saved for ${modelId}`, data);
        // Store testId in task and clear saving flag
        if (data.testId) {
            task.testId = data.testId;
        }
        task.saving = false;
        // Update the task in activeTasks to reflect the testId
        const currentTask = state.activeTasks.get(modelId);
        if (currentTask) {
            currentTask.testId = data.testId;
            currentTask.saving = false;
            state.activeTasks.set(modelId, currentTask);
        }
        return data;
    })
    .catch(error => {
        console.error(`[AdminImageTest] Error saving result:`, error);
    });
}

/**
 * Check if all tasks are complete
 */
function checkAllTasksComplete() {
    const allComplete = Array.from(state.activeTasks.values()).every(
        task => task.status === 'completed' || task.status === 'failed'
    );

    if (allComplete && state.isGenerating) {
        state.isGenerating = false;
        stopTotalTimer();
        updateGenerateButton(false);
        
        const totalTime = Date.now() - state.generationStartTime;
        document.getElementById('totalTimeDisplay').textContent = `Total: ${(totalTime / 1000).toFixed(1)}s`;
        
        showNotification('All generations complete!', 'success');
        refreshStats();
    }
}

/**
 * Start model-specific timer
 */
function startModelTimer(modelId) {
    const startTime = Date.now();
    const timerEl = document.getElementById(`timer-${modelId}`);
    
    const interval = setInterval(() => {
        if (timerEl) {
            const elapsed = (Date.now() - startTime) / 1000;
            timerEl.textContent = `${elapsed.toFixed(1)}s`;
        }
    }, 100);

    state.timers.set(modelId, interval);
}

/**
 * Stop model-specific timer
 */
function stopModelTimer(modelId) {
    const interval = state.timers.get(modelId);
    if (interval) {
        clearInterval(interval);
        state.timers.delete(modelId);
    }
}

/**
 * Start total timer
 */
function startTotalTimer() {
    const totalEl = document.getElementById('totalTimeDisplay');
    
    state.totalTimerInterval = setInterval(() => {
        if (totalEl && state.generationStartTime) {
            const elapsed = (Date.now() - state.generationStartTime) / 1000;
            totalEl.textContent = `Total: ${elapsed.toFixed(1)}s`;
        }
    }, 100);
}

/**
 * Stop total timer
 */
function stopTotalTimer() {
    if (state.totalTimerInterval) {
        clearInterval(state.totalTimerInterval);
        state.totalTimerInterval = null;
    }
}

/**
 * Clear all results
 */
function clearResults() {
    // Stop all timers
    state.timers.forEach((interval, modelId) => {
        clearInterval(interval);
    });
    state.timers.clear();

    // Stop all polling
    state.pollIntervals.forEach((interval, modelId) => {
        clearInterval(interval);
    });
    state.pollIntervals.clear();

    // Clear tasks
    state.activeTasks.clear();

    // Clear UI
    const container = document.getElementById('resultsContainer');
    container.innerHTML = `
        <div class="text-center text-muted py-5" id="noResultsPlaceholder">
            <i class="bi bi-image display-1"></i>
            <p class="mt-3">Select models and click "Start Generation" to begin testing</p>
        </div>
    `;

    document.getElementById('totalTimeDisplay').classList.add('d-none');
}

/**
 * Update generate button state
 */
function updateGenerateButton(isLoading) {
    const btn = document.getElementById('generateBtn');
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Generating...
        `;
    } else {
        btn.disabled = false;
        btn.innerHTML = `
            <i class="bi bi-play-fill me-2"></i>Start Generation
        `;
    }
}

/**
 * Refresh statistics
 */
async function refreshStats() {
    try {
        const response = await fetch('/dashboard/image/stats');
        const data = await response.json();

        if (data.stats) {
            data.stats.forEach(stat => {
                const card = document.querySelector(`.stat-card[data-model-id="${stat.modelId}"]`);
                if (card) {
                    card.querySelector('.badge').textContent = `${stat.totalTests} tests`;
                    card.querySelector('.stat-avg').textContent = stat.averageTime ? `${(stat.averageTime / 1000).toFixed(1)}s` : '--';
                    card.querySelector('.stat-min').textContent = stat.minTime ? `${(stat.minTime / 1000).toFixed(1)}s` : '--';
                    card.querySelector('.stat-max').textContent = stat.maxTime ? `${(stat.maxTime / 1000).toFixed(1)}s` : '--';
                    
                    // Update rating display
                    const ratingSection = card.querySelector('.border-top');
                    if (stat.averageRating && stat.totalRatings) {
                        if (!ratingSection) {
                            // Create rating section if it doesn't exist
                            const ratingHtml = `
                                <div class="text-center mt-2 pt-2 border-top border-secondary">
                                    <small class="text-muted d-block mb-1">Average Rating</small>
                                    <div class="d-flex justify-content-center align-items-center gap-1">
                                        <span class="text-warning fw-bold stat-rating">${stat.averageRating.toFixed(1)}</span>
                                        <i class="bi bi-star-fill text-warning"></i>
                                        <small class="text-muted">(${stat.totalRatings} ratings)</small>
                                    </div>
                                </div>
                            `;
                            card.insertAdjacentHTML('beforeend', ratingHtml);
                        } else {
                            ratingSection.querySelector('.stat-rating').textContent = stat.averageRating.toFixed(1);
                            const ratingsText = ratingSection.querySelector('.text-muted');
                            if (ratingsText) {
                                ratingsText.textContent = `(${stat.totalRatings} ratings)`;
                            }
                        }
                    } else if (ratingSection) {
                        ratingSection.remove();
                    }
                }
            });
        }

        console.log('[AdminImageTest] Stats refreshed');
    } catch (error) {
        console.error('[AdminImageTest] Error refreshing stats:', error);
    }
}

/**
 * Load test history
 */
async function loadHistory() {
    try {
        // Get selected model filter
        const modelFilter = document.getElementById('modelFilter')?.value || '';
        const url = modelFilter 
            ? `/dashboard/image/history?limit=50&modelId=${encodeURIComponent(modelFilter)}`
            : '/dashboard/image/history?limit=50';
        
        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

                if (data.history && data.history.length > 0) {
            data.history.forEach(test => {
                const row = document.createElement('tr');
                
                // Get first image URL if available
                let imageCell = '<span class="text-muted">--</span>';
                const imgUrl = test.images && test.images.length > 0 
                    ? (test.images[0].imageUrl || test.images[0].s3Url || test.images[0])
                    : null;
                
                if (imgUrl) {
                    const escapedUrl = imgUrl.replace(/'/g, "\\'");
                    imageCell = `
                        <img src="${imgUrl}" 
                             alt="Generated" 
                             class="history-thumbnail cursor-pointer"
                             data-test-id="${test._id || ''}"
                             onerror="this.src='/img/placeholder.png'">
                    `;
                }
                
                // Escape prompt for HTML and JavaScript
                const escapedPrompt = (test.prompt || '--').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
                const displayPrompt = (test.prompt || '--').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                
                // Store test data for preview
                const testData = JSON.stringify({
                    imageUrl: imgUrl,
                    modelName: test.modelName || 'Unknown Model',
                    generationTime: test.generationTime || 0,
                    testId: test._id || '',
                    prompt: test.prompt || ''
                }).replace(/'/g, '&#39;');
                
                row.innerHTML = `
                    <td>${imageCell}</td>
                    <td>${test.modelName || '--'}</td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <span class="text-truncate" style="max-width: 200px; flex: 1;" title="${test.prompt || ''}">${displayPrompt}</span>
                            <button class="btn btn-sm btn-outline-info copy-prompt-btn" 
                                    onclick="copyPrompt('${escapedPrompt}')"
                                    title="Copy prompt">
                                <i class="bi bi-clipboard"></i>
                            </button>
                        </div>
                    </td>
                    <td>${test.params?.size || '--'}</td>
                    <td>${test.generationTime ? (test.generationTime / 1000).toFixed(1) + 's' : '--'}</td>
                    <td>
                        ${test.status === 'completed' 
                            ? '<span class="badge bg-success">Completed</span>' 
                            : test.status === 'failed' 
                                ? '<span class="badge bg-danger">Failed</span>'
                                : `<span class="badge bg-warning">${test.status}</span>`}
                    </td>
                    <td>
                        <div class="d-flex align-items-center gap-1">
                            <span class="small">${new Date(test.testedAt).toLocaleString()}</span>
                            ${imgUrl ? `<button class="btn btn-sm btn-outline-primary preview-history-btn" data-test='${testData}' title="Preview & Use as Draft">
                                <i class="bi bi-eye"></i>
                            </button>` : ''}
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
                
                // Add click handler for thumbnail
                const thumbnail = row.querySelector('.history-thumbnail');
                if (thumbnail) {
                    thumbnail.addEventListener('click', () => {
                        const testDataObj = JSON.parse(testData.replace(/&#39;/g, "'"));
                        previewHistoryImage(testDataObj.imageUrl, testDataObj.modelName, testDataObj.generationTime, testDataObj.testId, testDataObj.prompt);
                    });
                }
                
                // Add click handler for preview button
                const previewBtn = row.querySelector('.preview-history-btn');
                if (previewBtn) {
                    previewBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const testDataObj = JSON.parse(previewBtn.dataset.test.replace(/&#39;/g, "'"));
                        previewHistoryImage(testDataObj.imageUrl, testDataObj.modelName, testDataObj.generationTime, testDataObj.testId, testDataObj.prompt);
                    });
                }
            });
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">No test history available</td>
                </tr>
            `;
        }

        console.log('[AdminImageTest] History loaded');
    } catch (error) {
        console.error('[AdminImageTest] Error loading history:', error);
    }
}

/**
 * Copy prompt to clipboard
 */
async function copyPrompt(prompt, button = null) {
    try {
        // Ensure prompt is a string
        const promptText = typeof prompt === 'string' ? prompt : String(prompt);
        
        await navigator.clipboard.writeText(promptText);
        
        // Show success feedback on button
        if (button) {
            showCopyFeedback(button);
        }
        
        showNotification('Prompt copied to clipboard!', 'success');
    } catch (error) {
        console.error('[AdminImageTest] Error copying prompt:', error);
        
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        const promptText = typeof prompt === 'string' ? prompt : String(prompt);
        textarea.value = promptText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            if (button) {
                showCopyFeedback(button);
            }
            showNotification('Prompt copied to clipboard!', 'success');
        } catch (err) {
            showNotification('Failed to copy prompt', 'error');
        }
        document.body.removeChild(textarea);
    }
}

/**
 * Show copy feedback on button
 */
function showCopyFeedback(button) {
    if (!button) return;
    
    const icon = button.querySelector('i');
    if (!icon) return;
    
    const originalClass = icon.className;
    
    // Change icon to checkmark
    icon.className = 'bi bi-check';
    button.classList.add('btn-success');
    button.classList.remove('btn-outline-info');
    
    // Reset after 2 seconds
    setTimeout(() => {
        icon.className = originalClass;
        button.classList.remove('btn-success');
        button.classList.add('btn-outline-info');
    }, 2000);
}

/**
 * Preview image from history
 */
function previewHistoryImage(imageUrl, modelName, generationTime, testId = null, prompt = '') {
    const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    const modalElement = document.getElementById('imagePreviewModal');
    
    document.getElementById('previewImage').src = imageUrl;
    document.getElementById('previewModelName').textContent = modelName || 'Unknown Model';
    document.getElementById('previewTime').textContent = generationTime 
        ? `Generated in ${(generationTime / 1000).toFixed(1)} seconds`
        : '';
    
    // Show truncated prompt
    const promptEl = document.getElementById('previewPrompt');
    if (promptEl && prompt) {
        const truncatedPrompt = prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
        promptEl.textContent = truncatedPrompt;
        promptEl.title = prompt;
        promptEl.style.display = 'block';
    } else if (promptEl) {
        promptEl.style.display = 'none';
    }
    
    // Store current image info for rating and draft
    modalElement.dataset.modelId = 'history-image';
    modalElement.dataset.modelName = modelName || 'Unknown Model';
    modalElement.dataset.imageUrl = imageUrl;
    modalElement.dataset.testId = testId || '';
    modalElement.dataset.prompt = prompt || '';
    modalElement.dataset.isFromHistory = 'true';
    
    // Reset rating stars
    resetRatingStars();
    
    // Load existing rating if testId is provided
    if (testId) {
        loadImageRating(testId);
    }
    
    modal.show();
}

/**
 * Reset rating stars to default state
 */
function resetRatingStars() {
    const stars = document.querySelectorAll('.rating-star');
    stars.forEach(star => {
        star.classList.remove('bi-star-fill', 'active', 'filled');
        star.classList.add('bi-star');
    });
    document.getElementById('ratingStatus').textContent = 'Click a star to rate';
}

/**
 * Initialize rating stars click handlers
 */
function initializeRatingStars() {
    const stars = document.querySelectorAll('.rating-star');
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.dataset.rating);
            setRating(rating);
            saveImageRating(rating);
        });
        
        star.addEventListener('mouseenter', function() {
            const rating = parseInt(this.dataset.rating);
            highlightStars(rating);
        });
    });
    
    const ratingContainer = document.getElementById('ratingStars');
    if (ratingContainer) {
        ratingContainer.addEventListener('mouseleave', function() {
            const currentRating = parseInt(ratingContainer.dataset.currentRating || '0');
            if (currentRating > 0) {
                highlightStars(currentRating);
            } else {
                resetRatingStars();
            }
        });
    }
}

/**
 * Set rating and highlight stars
 */
function setRating(rating) {
    const ratingContainer = document.getElementById('ratingStars');
    ratingContainer.dataset.currentRating = rating;
    highlightStars(rating);
    document.getElementById('ratingStatus').textContent = `Rated ${rating} out of 5 stars`;
}

/**
 * Highlight stars up to the given rating
 */
function highlightStars(rating) {
    const stars = document.querySelectorAll('.rating-star');
    stars.forEach((star, index) => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= rating) {
            star.classList.remove('bi-star');
            star.classList.add('bi-star-fill', 'active', 'filled');
        } else {
            star.classList.remove('bi-star-fill', 'active', 'filled');
            star.classList.add('bi-star');
        }
    });
}

/**
 * Save image rating
 */
async function saveImageRating(rating) {
    const modal = document.getElementById('imagePreviewModal');
    const modelId = modal.dataset.modelId;
    const modelName = modal.dataset.modelName;
    const imageUrl = modal.dataset.imageUrl;
    const testId = modal.dataset.testId;
    
    if (!modelId || !imageUrl) {
        console.error('[AdminImageTest] Missing modelId or imageUrl for rating');
        return;
    }
    
    try {
        const response = await fetch('/dashboard/image/rate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                modelId,
                modelName,
                imageUrl,
                rating,
                testId: testId || null
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(`Rating saved: ${rating} stars`, 'success');
            // Refresh statistics to show updated average rating
            refreshStats();
        } else {
            showNotification(data.error || 'Failed to save rating', 'error');
        }
    } catch (error) {
        console.error('[AdminImageTest] Error saving rating:', error);
        showNotification('Failed to save rating', 'error');
    }
}

/**
 * Load existing rating for an image
 */
async function loadImageRating(testId) {
    if (!testId) return;
    
    try {
        const response = await fetch(`/dashboard/image/rating/${testId}`);
        const data = await response.json();
        
        if (data.success && data.rating) {
            setRating(data.rating);
        }
    } catch (error) {
        console.error('[AdminImageTest] Error loading rating:', error);
    }
}

/**
 * Set default character creation model
 */
async function setDefaultModel(style, modelId) {
    try {
        const response = await fetch('/dashboard/image/default-model', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ style, modelId })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(data.message, 'success');
        } else {
            showNotification(data.error || 'Failed to set default model', 'error');
        }
    } catch (error) {
        console.error('[AdminImageTest] Error setting default model:', error);
        showNotification(error.message, 'error');
    }
}

/**
 * Reset all statistics
 */
async function resetAllStats() {
    if (!confirm('Are you sure you want to reset all model statistics?')) {
        return;
    }

    try {
        const response = await fetch('/dashboard/image/stats/reset', {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('All statistics reset', 'success');
            refreshStats();
            loadHistory();
        } else {
            showNotification(data.error || 'Failed to reset stats', 'error');
        }
    } catch (error) {
        console.error('[AdminImageTest] Error resetting stats:', error);
        showNotification(error.message, 'error');
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Fallback toast notification
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }
}

// Draft post state
let currentDraftData = null;
let saveDraftModal = null;

/**
 * Save current image as draft post
 */
function saveAsDraftPost() {
    const modal = document.getElementById('imagePreviewModal');
    const imageUrl = modal.dataset.imageUrl;
    const modelId = modal.dataset.modelId;
    const modelName = modal.dataset.modelName;
    const testId = modal.dataset.testId;
    const isFromHistory = modal.dataset.isFromHistory === 'true';
    
    if (!imageUrl) {
        showNotification('No image to save', 'error');
        return;
    }
    
    // Get the prompt - from modal dataset for history items, or from task for current generation
    let prompt = '';
    if (isFromHistory) {
        prompt = modal.dataset.prompt || '';
    } else {
        const task = state.activeTasks.get(modelId);
        prompt = task?.finalPrompt || task?.originalPrompt || document.getElementById('promptInput')?.value || '';
    }
    
    // Store data for the draft
    currentDraftData = {
        imageUrl,
        prompt,
        model: modelName,
        testId: testId || null,
        parameters: {
            size: document.getElementById('sizeSelect')?.value,
            style: document.querySelector('input[name="stylePreset"]:checked')?.value
        }
    };
    
    // Update draft modal preview
    document.getElementById('draftPreviewImage').src = imageUrl;
    document.getElementById('draftCaptionText').value = '';
    
    // Close preview modal and open draft modal
    bootstrap.Modal.getInstance(modal)?.hide();
    
    if (!saveDraftModal) {
        saveDraftModal = new bootstrap.Modal(document.getElementById('saveDraftModal'));
    }
    saveDraftModal.show();
}

/**
 * Generate caption for draft post using AI
 */
async function generateDraftCaption() {
    const captionInput = document.getElementById('draftCaptionText');
    const btn = document.getElementById('generateCaptionBtn');
    
    if (!currentDraftData?.prompt) {
        showNotification('No prompt available for caption generation', 'warning');
        return;
    }
    
    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generating...';
    captionInput.disabled = true;
    
    try {
        const response = await fetch('/api/posts/generate-caption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: currentDraftData.prompt,
                platform: 'general',
                style: 'engaging'
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.caption) {
            captionInput.value = data.caption;
            showNotification('Caption generated!', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate caption');
        }
    } catch (error) {
        console.error('[ImageDashboard] Error generating caption:', error);
        showNotification('Failed to generate caption', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-magic me-1"></i>Generate Caption with AI';
        captionInput.disabled = false;
    }
}

/**
 * Confirm and save draft post
 */
async function confirmSaveDraft() {
    if (!currentDraftData) {
        showNotification('No draft data available', 'error');
        return;
    }
    
    const caption = document.getElementById('draftCaptionText').value;
    const btn = document.getElementById('confirmSaveDraftBtn');
    
    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    
    try {
        const response = await fetch('/api/posts/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageUrl: currentDraftData.imageUrl,
                prompt: currentDraftData.prompt,
                model: currentDraftData.model,
                testId: currentDraftData.testId,
                parameters: currentDraftData.parameters,
                generateCaption: !caption, // Generate caption if not provided
                caption: caption || undefined
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('Draft post saved! Redirecting to My Posts...', 'success');
            
            // Close modal
            saveDraftModal?.hide();
            
            // Redirect to My Posts after short delay
            setTimeout(() => {
                window.location.href = '/dashboard/posts';
            }, 1500);
        } else {
            throw new Error(data.error || 'Failed to save draft');
        }
    } catch (error) {
        console.error('[ImageDashboard] Error saving draft:', error);
        showNotification('Failed to save draft: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-check me-1"></i>Save Draft';
    }
}

/**
 * Open share to social modal (placeholder for social sharing)
 */
function openShareModal() {
    const modal = document.getElementById('imagePreviewModal');
    const imageUrl = modal.dataset.imageUrl;
    
    if (!imageUrl) {
        showNotification('No image to share', 'error');
        return;
    }
    
    // For now, redirect to My Posts where social sharing is available
    showNotification('Saving image first...', 'info');
    saveAsDraftPost();
}
