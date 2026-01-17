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
    customizedPrompt: null // Track if user has manually edited the final prompt
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('[AdminImageTest] Dashboard initialized');
    
    // Load initial stats
    refreshStats();
    
    // Add event listeners for style preset changes
    document.querySelectorAll('input[name="stylePreset"]').forEach(radio => {
        radio.addEventListener('change', handleStylePresetChange);
    });
    
    // Initialize the preview
    updateFinalPromptPreview();
});

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
 * Select all standard model checkboxes
 */
function selectAllModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox input[type="checkbox"]:not(.sd-model-checkbox)');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
}

/**
 * Select all SD model checkboxes
 */
function selectAllSDModels() {
    const checkboxes = document.querySelectorAll('.sd-model-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
    });
    
    updateSDParamsVisibility();
}

/**
 * Get selected standard models
 */
function getSelectedModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox input[type="checkbox"]:not(.sd-model-checkbox):checked');
    return Array.from(checkboxes).map(cb => ({
        id: cb.value,
        name: cb.dataset.modelName
    }));
}

/**
 * Get selected SD models
 */
function getSelectedSDModels() {
    const checkboxes = document.querySelectorAll('.sd-model-checkbox:checked');
    return Array.from(checkboxes).map(cb => ({
        modelId: cb.value,
        model: cb.dataset.model,
        model_name: cb.dataset.model,
        name: cb.dataset.modelName
    }));
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

// Add event listeners for SD model checkboxes
document.addEventListener('DOMContentLoaded', function() {
    // Delegate event listener for SD model checkboxes
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('sd-model-checkbox')) {
            updateSDParamsVisibility();
        }
    });
});

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

    const size = document.getElementById('sizeSelect').value;
    const style = document.querySelector('input[name="stylePreset"]:checked')?.value || '';
    
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

    // Create result cards for each standard model
    selectedModels.forEach(model => {
        createResultCard(model.id, model.name);
    });
    
    // Create result cards for each SD model
    selectedSDModels.forEach(sdModel => {
        const cardId = `sd-${sdModel.modelId}`;
        createResultCard(cardId, `SD - ${sdModel.name}`);
    });

    try {
        const requestBody = {
            prompt: finalPrompt, // Send the final edited prompt
            basePrompt: basePrompt, // Also send base prompt for reference
            size,
            style,
            skipStyleApplication: !!style // Tell server not to apply style again
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
        
        const response = await fetch('/admin/image-test/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Generation failed');
        }

        console.log('[AdminImageTest] Generation started:', data);

        // Process each task
        data.tasks.forEach(task => {
            // For SD models, use the custom card ID
            let cardId = task.modelId;
            if (task.modelId === 'sd-txt2img' && task.sdModelName) {
                // Find the matching SD model to get the card ID
                const matchingSD = selectedSDModels.find(sd => sd.model === task.sdModelName || sd.name === task.sdModelName);
                if (matchingSD) {
                    cardId = `sd-${matchingSD.modelId}`;
                }
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

        // Display images
        if (task.images && task.images.length > 0) {
            displayImages(modelId, task.images, time);
        }

        // Save result
        saveTestResult(modelId, task);
        
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
        const wrapper = document.createElement('div');
        wrapper.className = 'result-image-wrapper d-inline-block position-relative';
        wrapper.innerHTML = `
            <img src="${imgUrl}" 
                 alt="Generated Image ${index + 1}" 
                 class="result-image img-fluid rounded cursor-pointer"
                 onclick="previewImage('${imgUrl}', '${modelId}', ${time})"
                 onerror="this.src='/img/placeholder.png'">
        `;
        container.appendChild(wrapper);
    });
}

/**
 * Preview image in modal
 */
function previewImage(imageUrl, modelId, time) {
    const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    document.getElementById('previewImage').src = imageUrl;
    
    const task = state.activeTasks.get(modelId);
    document.getElementById('previewModelName').textContent = task?.modelName || modelId;
    document.getElementById('previewTime').textContent = `Generated in ${(time / 1000).toFixed(1)} seconds`;
    
    modal.show();
}

/**
 * Start polling for async task status
 */
function startTaskPolling(task, cardId) {
    const actualCardId = cardId || task.modelId;
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/admin/image-test/status/${task.taskId}`);
            const data = await response.json();

            console.log(`[AdminImageTest] Poll ${actualCardId}:`, data.status, data.progress || 0);

            // Update task with new data
            const updatedTask = {
                ...task,
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
    try {
        await fetch('/admin/image-test/save-result', {
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
        });

        console.log(`[AdminImageTest] Result saved for ${modelId}`);
    } catch (error) {
        console.error(`[AdminImageTest] Error saving result:`, error);
    }
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
        const response = await fetch('/admin/image-test/stats');
        const data = await response.json();

        if (data.stats) {
            data.stats.forEach(stat => {
                const card = document.querySelector(`.stat-card[data-model-id="${stat.modelId}"]`);
                if (card) {
                    card.querySelector('.badge').textContent = `${stat.totalTests} tests`;
                    card.querySelector('.stat-avg').textContent = stat.averageTime ? `${(stat.averageTime / 1000).toFixed(1)}s` : '--';
                    card.querySelector('.stat-min').textContent = stat.minTime ? `${(stat.minTime / 1000).toFixed(1)}s` : '--';
                    card.querySelector('.stat-max').textContent = stat.maxTime ? `${(stat.maxTime / 1000).toFixed(1)}s` : '--';
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
        const response = await fetch('/admin/image-test/history?limit=50');
        const data = await response.json();

        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = '';

        if (data.history && data.history.length > 0) {
            data.history.forEach(test => {
                const row = document.createElement('tr');
                
                // Get first image URL if available
                let imageCell = '<span class="text-muted">--</span>';
                if (test.images && test.images.length > 0) {
                    const imgUrl = test.images[0].imageUrl || test.images[0].s3Url || test.images[0];
                    if (imgUrl) {
                        const escapedUrl = imgUrl.replace(/'/g, "\\'");
                        const escapedModelName = (test.modelName || '').replace(/'/g, "\\'");
                        imageCell = `
                            <img src="${imgUrl}" 
                                 alt="Generated" 
                                 class="history-thumbnail cursor-pointer"
                                 onclick="previewHistoryImage('${escapedUrl}', '${escapedModelName}', ${test.generationTime || 0})"
                                 onerror="this.src='/img/placeholder.png'">
                        `;
                    }
                }
                
                row.innerHTML = `
                    <td>${imageCell}</td>
                    <td>${test.modelName || '--'}</td>
                    <td class="text-truncate" style="max-width: 200px;" title="${test.prompt || ''}">${test.prompt || '--'}</td>
                    <td>${test.params?.size || '--'}</td>
                    <td>${test.generationTime ? (test.generationTime / 1000).toFixed(1) + 's' : '--'}</td>
                    <td>
                        ${test.status === 'completed' 
                            ? '<span class="badge bg-success">Completed</span>' 
                            : test.status === 'failed' 
                                ? '<span class="badge bg-danger">Failed</span>'
                                : `<span class="badge bg-warning">${test.status}</span>`}
                    </td>
                    <td>${new Date(test.testedAt).toLocaleString()}</td>
                `;
                tbody.appendChild(row);
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
 * Preview image from history
 */
function previewHistoryImage(imageUrl, modelName, generationTime) {
    const modal = new bootstrap.Modal(document.getElementById('imagePreviewModal'));
    document.getElementById('previewImage').src = imageUrl;
    document.getElementById('previewModelName').textContent = modelName || 'Unknown Model';
    document.getElementById('previewTime').textContent = generationTime 
        ? `Generated in ${(generationTime / 1000).toFixed(1)} seconds`
        : '';
    modal.show();
}

/**
 * Set default character creation model
 */
async function setDefaultModel(style, modelId) {
    try {
        const response = await fetch('/admin/image-test/default-model', {
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
        const response = await fetch('/admin/image-test/stats/reset', {
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
