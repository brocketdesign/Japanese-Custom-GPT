/**
 * Unified Generation Dashboard
 * Mobile-first state management for image and video generation
 */

class GenerationDashboard {
  constructor(config = {}) {
    // Core state
    this.state = {
      mode: 'image', // 'image' or 'video'
      selectedModel: null,
      isGenerating: false,
      results: [],
      // Tool configuration
      tools: {
        baseImage: null, // Data URL for img2img or i2v
        faceImage: null, // Data URL for face merge
        targetImage: null, // Data URL for face merge target
        baseVideo: null, // Data URL for video face merge
        aspectRatio: '1:1',
        duration: '5',
        style: '',
        negativePrompt: '',
        imageCount: 1 // Number of images to generate
      },
      // User data
      userPoints: config.userPoints || 0,
      imageCostPerUnit: config.imageCostPerUnit || 10,
      videoCostPerUnit: config.videoCostPerUnit || 100,
      faceMergeCost: config.faceMergeCost || 20
    };
    
    // Model configurations passed from server
    this.imageModels = config.imageModels || [];
    this.videoModels = config.videoModels || [];
    
    // UI elements cache
    this.elements = {};
    
    // Polling intervals for async tasks
    this.pollIntervals = new Map();
    
    // Current preview ID for actions
    this._currentPreviewId = null;
    
    // Initialize
    this.init();
  }
  
  init() {
    this.cacheElements();
    this.bindEvents();
    this.setInitialState();
    this.loadStoredResults();
    this.updateUI();
    
    console.log('[GenerationDashboard] Initialized with mode:', this.state.mode);
  }
  
  cacheElements() {
    // Top bar
    this.elements.modeButtons = document.querySelectorAll('.gen-mode-btn');
    this.elements.modelSelector = document.querySelector('.gen-model-selector');
    this.elements.modelNameDisplay = document.querySelector('.gen-model-selector .model-name');
    
    // Main content
    this.elements.mainContent = document.querySelector('.gen-main-content');
    this.elements.contentInner = document.querySelector('.gen-content-inner');
    this.elements.emptyState = document.querySelector('.gen-empty-state');
    
    // Bottom bar
    this.elements.promptInput = document.querySelector('.gen-prompt-input');
    this.elements.submitBtn = document.querySelector('.gen-submit-btn');
    this.elements.toolsRow = document.querySelector('.gen-tools-row');
    this.elements.toolButtons = document.querySelectorAll('.gen-tool-btn');
    this.elements.costDisplay = document.querySelector('.gen-cost-display');
    
    // Overlays
    this.elements.overlayBackdrop = document.querySelector('.gen-overlay-backdrop');
    this.elements.modelSheet = document.querySelector('#modelSheet');
    this.elements.settingsSheet = document.querySelector('#settingsSheet');
    this.elements.uploadSheet = document.querySelector('#uploadSheet');
    this.elements.previewOverlay = document.querySelector('.gen-preview-overlay');
    
    // File inputs
    this.elements.baseImageInput = document.querySelector('#baseImageInput');
    this.elements.faceImageInput = document.querySelector('#faceImageInput');
    this.elements.targetImageInput = document.querySelector('#targetImageInput');
    this.elements.baseVideoInput = document.querySelector('#baseVideoInput');
  }
  
  bindEvents() {
    // Mode switching
    this.elements.modeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleModeSwitch(e));
    });
    
    // Model selector
    if (this.elements.modelSelector) {
      this.elements.modelSelector.addEventListener('click', () => this.openModelSheet());
    }
    
    // Prompt input
    if (this.elements.promptInput) {
      this.elements.promptInput.addEventListener('input', () => this.handlePromptInput());
      this.elements.promptInput.addEventListener('keydown', (e) => this.handlePromptKeydown(e));
    }
    
    // Submit button
    if (this.elements.submitBtn) {
      this.elements.submitBtn.addEventListener('click', () => this.handleGenerate());
    }
    
    // Tool buttons
    this.elements.toolButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleToolClick(e));
    });
    
    // Overlay backdrop
    if (this.elements.overlayBackdrop) {
      this.elements.overlayBackdrop.addEventListener('click', () => this.closeAllOverlays());
    }
    
    // File inputs
    this.bindFileInputs();
    
    // Window resize for textarea
    window.addEventListener('resize', () => this.resizePromptInput());
  }
  
  bindFileInputs() {
    if (this.elements.baseImageInput) {
      this.elements.baseImageInput.addEventListener('change', (e) => {
        this.handleFileUpload(e.target.files[0], 'baseImage');
      });
    }
    
    if (this.elements.faceImageInput) {
      this.elements.faceImageInput.addEventListener('change', (e) => {
        this.handleFileUpload(e.target.files[0], 'faceImage');
      });
    }
    
    if (this.elements.targetImageInput) {
      this.elements.targetImageInput.addEventListener('change', (e) => {
        this.handleFileUpload(e.target.files[0], 'targetImage');
      });
    }
    
    if (this.elements.baseVideoInput) {
      this.elements.baseVideoInput.addEventListener('change', (e) => {
        this.handleFileUpload(e.target.files[0], 'baseVideo');
      });
    }
  }
  
  setInitialState() {
    // Set default model based on mode
    this.selectDefaultModel();
    
    // Auto-resize prompt input
    this.resizePromptInput();
    
    // Update aspect ratio button to show current value
    this.updateAspectRatioButton();
  }
  
  selectDefaultModel() {
    const models = this.state.mode === 'image' ? this.imageModels : this.videoModels;
    if (models.length > 0) {
      this.state.selectedModel = models[0];
      this.updateModelDisplay();
      this.updateToolButtonsForModel(); // Update tool buttons for the default model
    }
  }
  
  // ============================================================================
  // MODE MANAGEMENT
  // ============================================================================
  
  handleModeSwitch(e) {
    const btn = e.currentTarget;
    const newMode = btn.dataset.mode;
    
    if (newMode === this.state.mode) return;
    
    this.state.mode = newMode;
    
    // Update UI
    this.elements.modeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Switch to appropriate default model
    this.selectDefaultModel();
    
    // Update tools visibility
    this.updateToolsForMode();
    
    // Update cost display
    this.updateCostDisplay();
    
    // Update empty state text
    this.updateEmptyState();
    
    console.log('[GenerationDashboard] Mode switched to:', newMode);
  }
  
  updateToolsForMode() {
    // Define which tools are available in each mode
    const imageTools = ['upload-base', 'upload-face', 'aspect-ratio', 'image-count', 'settings'];
    const videoTools = ['upload-base', 'upload-face', 'duration', 'upload-video', 'settings'];
    
    this.elements.toolButtons.forEach(btn => {
      const toolType = btn.dataset.tool;
      const isImageTool = imageTools.includes(toolType);
      const isVideoTool = videoTools.includes(toolType);
      
      if (this.state.mode === 'image') {
        btn.classList.toggle('gen-hidden', !isImageTool);
      } else {
        btn.classList.toggle('gen-hidden', !isVideoTool);
      }
    });
    
    // Also update tool buttons based on selected model
    this.updateToolButtonsForModel();
  }
  
  /**
   * Update aspect ratio button to show current selection
   */
  updateAspectRatioButton() {
    const btn = document.querySelector('[data-tool="aspect-ratio"]');
    if (btn) {
      const span = btn.querySelector('span');
      if (span) {
        span.textContent = this.state.tools.aspectRatio;
      }
    }
  }
  
  /**
   * Update image count button to show current selection
   */
  updateImageCountButton() {
    const btn = document.querySelector('[data-tool="image-count"]');
    if (btn) {
      const span = btn.querySelector('span');
      if (span) {
        span.textContent = `${this.state.tools.imageCount}x`;
      }
    }
  }
  
  // ============================================================================
  // MODEL SELECTION
  // ============================================================================
  
  openModelSheet() {
    this.showOverlay('modelSheet');
    this.renderModelList();
  }
  
  renderModelList() {
    const container = document.querySelector('#modelSheet .gen-bottom-sheet-body');
    if (!container) return;
    
    const models = this.state.mode === 'image' ? this.imageModels : this.videoModels;
    
    // Group models by category
    const categories = {};
    models.forEach(model => {
      const cat = model.category || 'other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(model);
    });
    
    let html = '';
    
    Object.entries(categories).forEach(([category, categoryModels]) => {
      const categoryLabels = {
        'txt2img': 'Text to Image',
        'img2img': 'Image to Image',
        'face': 'Face Tools',
        'i2v': 'Image to Video',
        't2v': 'Text to Video',
        'other': 'Other Models'
      };
      
      html += `
        <div class="gen-model-category">
          <div class="gen-model-category-title">
            <i class="bi bi-collection"></i>
            ${categoryLabels[category] || category}
          </div>
          <div class="gen-model-list">
            ${categoryModels.map(model => this.renderModelItem(model)).join('')}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    // Bind click events
    container.querySelectorAll('.gen-model-item').forEach(item => {
      item.addEventListener('click', () => {
        const modelId = item.dataset.modelId;
        this.selectModel(modelId);
      });
    });
  }
  
  renderModelItem(model) {
    const isSelected = this.state.selectedModel?.id === model.id;
    
    const badges = [];
    if (model.async) badges.push('<span class="gen-model-badge async">Async</span>');
    if (model.category === 'i2v' || model.supportsImg2Img) {
      badges.push('<span class="gen-model-badge i2v">I2V</span>');
    }
    if (model.category === 't2v' || model.category === 'txt2img') {
      badges.push('<span class="gen-model-badge t2v">T2V</span>');
    }
    if (model.category === 'face') {
      badges.push('<span class="gen-model-badge face">Face</span>');
    }
    
    return `
      <div class="gen-model-item ${isSelected ? 'selected' : ''}" data-model-id="${model.id}">
        <div class="model-icon">
          <i class="bi bi-${this.state.mode === 'image' ? 'image' : 'film'}"></i>
        </div>
        <div class="model-info">
          <div class="model-name">${model.name}</div>
          <div class="model-desc">${model.description || ''}</div>
          <div class="model-badges">${badges.join('')}</div>
        </div>
        <div class="check-icon">
          <i class="bi bi-check"></i>
        </div>
      </div>
    `;
  }
  
  selectModel(modelId) {
    const models = this.state.mode === 'image' ? this.imageModels : this.videoModels;
    const model = models.find(m => m.id === modelId);
    
    if (model) {
      this.state.selectedModel = model;
      this.updateModelDisplay();
      this.updateToolButtonsForModel(); // Update tool buttons based on model requirements
      this.updateCostDisplay(); // Update cost as different models may have different costs
      this.updateSubmitButtonState(); // Update submit button state for face merge models
      this.closeAllOverlays();
      console.log('[GenerationDashboard] Model selected:', model.name, model);
    }
  }
  
  updateModelDisplay() {
    if (this.elements.modelNameDisplay && this.state.selectedModel) {
      this.elements.modelNameDisplay.textContent = this.state.selectedModel.name;
    }
  }
  
  /**
   * Update tool buttons based on selected model requirements
   * Disable/enable base image and face image buttons based on what the model supports
   */
  updateToolButtonsForModel() {
    const model = this.state.selectedModel;
    if (!model) return;
    
    const baseImageBtn = document.querySelector('[data-tool="upload-base"]');
    const faceImageBtn = document.querySelector('[data-tool="upload-face"]');
    
    if (this.state.mode === 'image') {
      // For image mode, check if model requires or supports images
      const requiresImage = model.requiresImage || false;
      const supportsImg2Img = model.supportsImg2Img || false;
      const requiresTwoImages = model.requiresTwoImages || false;
      const category = model.category || 'txt2img';
      
      // Base image button: Enable if model supports img2img or requires image
      if (baseImageBtn) {
        const shouldEnableBase = supportsImg2Img || requiresImage || category === 'img2img';
        baseImageBtn.disabled = !shouldEnableBase;
        baseImageBtn.classList.toggle('gen-disabled', !shouldEnableBase);
        baseImageBtn.title = shouldEnableBase ? 'Upload base image' : 'Not supported by this model';
      }
      
      // Face image button: Enable only for face category models
      if (faceImageBtn) {
        const shouldEnableFace = category === 'face' || requiresTwoImages;
        faceImageBtn.disabled = !shouldEnableFace;
        faceImageBtn.classList.toggle('gen-disabled', !shouldEnableFace);
        faceImageBtn.title = shouldEnableFace ? 'Upload face image' : 'Not supported by this model';
      }
    } else {
      // For video mode
      const category = model.category || 'i2v';
      const requiresImage = model.requiresImage || category === 'i2v';
      const requiresFaceImage = model.requiresFaceImage || category === 'face';
      
      // Base image button: Enable for i2v models
      if (baseImageBtn) {
        baseImageBtn.disabled = !requiresImage;
        baseImageBtn.classList.toggle('gen-disabled', !requiresImage);
        baseImageBtn.title = requiresImage ? 'Upload base image' : 'Not supported by this model';
      }
      
      // Face image button: Enable for face category models
      if (faceImageBtn) {
        faceImageBtn.disabled = !requiresFaceImage;
        faceImageBtn.classList.toggle('gen-disabled', !requiresFaceImage);
        faceImageBtn.title = requiresFaceImage ? 'Upload face image' : 'Not supported by this model';
      }
    }
  }
  
  // ============================================================================
  // PROMPT INPUT
  // ============================================================================
  
  handlePromptInput() {
    this.resizePromptInput();
    this.updateSubmitButtonState();
  }
  
  handlePromptKeydown(e) {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.handleGenerate();
    }
  }
  
  resizePromptInput() {
    const input = this.elements.promptInput;
    if (!input) return;
    
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  
  updateSubmitButtonState() {
    const hasPrompt = this.elements.promptInput?.value.trim().length > 0;
    const isFaceMerge = this.state.selectedModel?.category === 'face';
    const canGenerate = (hasPrompt || isFaceMerge) && !this.state.isGenerating && this.hasEnoughPoints();
    
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = !canGenerate;
    }
  }
  
  // ============================================================================
  // GENERATION
  // ============================================================================
  
  async handleGenerate() {
    const prompt = this.elements.promptInput?.value.trim();
    const model = this.state.selectedModel;
    
    // For face merge models, prompt is optional; for others, it's required
    const isFaceMerge = model?.category === 'face';
    if ((!prompt && !isFaceMerge) || this.state.isGenerating) return;
    
    if (!this.hasEnoughPoints()) {
      this.showNotification('Insufficient points for generation', 'error');
      return;
    }
    if (!model) {
      this.showNotification('Please select a model', 'error');
      return;
    }
    
    this.state.isGenerating = true;
    this.updateGeneratingState(true);
    
    try {
      // Create pending result card
      const pendingResult = this.createPendingResult(prompt);
      this.addResultToFeed(pendingResult);
      
      // Call appropriate API based on mode
      const endpoint = this.state.mode === 'image' 
        ? '/dashboard/image/generate'
        : '/dashboard/video/generate';
      
      const payload = this.buildGenerationPayload(prompt);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!data.success && !data.tasks) {
        throw new Error(data.error || 'Generation failed');
      }
      
      // Handle async tasks
      if (data.tasks && data.tasks.length > 0) {
        const task = data.tasks[0];
        pendingResult.taskId = task.taskId || task.task_id;
        this.startPollingTask(pendingResult);
      } else if (data.result) {
        // Immediate result
        this.updateResultWithData(pendingResult.id, data.result);
      }
      
      // Clear input and reset
      this.elements.promptInput.value = '';
      this.resizePromptInput();
      
      // Update points
      if (data.newPoints !== undefined) {
        this.state.userPoints = data.newPoints;
        this.updateCostDisplay();
      }
      
    } catch (error) {
      console.error('[GenerationDashboard] Generation error:', error);
      this.showNotification(error.message || 'Generation failed', 'error');
    } finally {
      this.state.isGenerating = false;
      this.updateGeneratingState(false);
    }
  }
  
  buildGenerationPayload(prompt) {
    const model = this.state.selectedModel;
    const payload = {
      models: [model.id]
    };
    
    // Prompt is optional for face merge models
    if (prompt || model.category !== 'face') {
      payload.prompt = prompt || '';
    }
    
    if (this.state.mode === 'image') {
      // Get size format based on model (some models use 'x' instead of '*')
      const sizeFormat = model.sizeFormat || '*';
      payload.size = this.aspectRatioToSize(this.state.tools.aspectRatio, sizeFormat);
      
      // Add image count for multiple image generation
      payload.imagesPerModel = this.state.tools.imageCount;
      
      // Determine generation mode based on model and uploaded images
      if (model.category === 'face' || model.requiresTwoImages) {
        payload.generationMode = 'face';
      } else if (model.requiresImage || (model.supportsImg2Img && this.state.tools.baseImage)) {
        payload.generationMode = 'img2img';
      } else {
        payload.generationMode = 'txt2img';
      }
      
      if (this.state.tools.style) payload.style = this.state.tools.style;
      if (this.state.tools.negativePrompt) payload.negativePrompt = this.state.tools.negativePrompt;
      
      // Handle image uploads based on model requirements
      // Note: Both image_base64 and image_file are provided for compatibility with different models
      // Some models use image_base64, others use image_file - the backend handles this
      if (this.state.tools.baseImage) {
        payload.image_base64 = this.state.tools.baseImage;
        payload.image_file = this.state.tools.baseImage;
      }
      if (this.state.tools.faceImage) {
        payload.face_image_file = this.state.tools.faceImage;
      }
      if (this.state.tools.targetImage) {
        payload.image_file = this.state.tools.targetImage;
      }
    } else {
      // Video mode payload
      payload.modelId = model.id;
      payload.duration = this.state.tools.duration;
      payload.videoMode = model.category || 'i2v';
      
      if (this.state.tools.baseImage) {
        payload.baseImageUrl = this.state.tools.baseImage;
      }
      if (this.state.tools.faceImage) {
        payload.faceImageFile = this.state.tools.faceImage;
      }
      if (this.state.tools.baseVideo) {
        payload.videoFile = this.state.tools.baseVideo;
      }
    }
    
    console.log('[GenerationDashboard] Built payload:', payload);
    return payload;
  }
  
  /**
   * Convert aspect ratio to size string
   * @param {string} ratio - Aspect ratio like '1:1', '16:9', etc.
   * @param {string} separator - Size separator ('*' or 'x')
   * @returns {string} Size string like '1024*1024' or '1024x1024'
   */
  aspectRatioToSize(ratio, separator = '*') {
    const sizeMap = {
      '1:1': [1024, 1024],
      '16:9': [1280, 720],
      '9:16': [720, 1280],
      '4:3': [1024, 768],
      '3:4': [768, 1024]
    };
    const [width, height] = sizeMap[ratio] || [1024, 1024];
    return `${width}${separator}${height}`;
  }
  
  createPendingResult(prompt) {
    const result = {
      id: Date.now().toString(),
      taskId: null,
      prompt,
      status: 'pending',
      mode: this.state.mode,
      model: this.state.selectedModel?.name || 'Unknown',
      createdAt: new Date().toISOString(),
      mediaUrl: null
    };
    
    this.state.results.unshift(result);
    return result;
  }
  
  addResultToFeed(result) {
    // Hide empty state
    if (this.elements.emptyState) {
      this.elements.emptyState.style.display = 'none';
    }
    
    const card = this.createResultCard(result);
    
    if (this.elements.contentInner) {
      // Insert at the beginning
      if (this.elements.contentInner.firstChild && this.elements.contentInner.firstChild !== this.elements.emptyState) {
        this.elements.contentInner.insertBefore(card, this.elements.contentInner.firstChild);
      } else {
        this.elements.contentInner.appendChild(card);
      }
    }
    
    // Scroll to top to show new result
    if (this.elements.mainContent) {
      this.elements.mainContent.scrollTop = 0;
    }
  }
  
  createResultCard(result) {
    const card = document.createElement('div');
    card.className = `gen-result-card ${result.status === 'pending' ? 'generating' : ''}`;
    card.id = `result-${result.id}`;
    
    const isImage = result.mode === 'image';
    
    card.innerHTML = `
      <div class="gen-result-media ${result.status === 'pending' ? 'loading' : ''}" data-result-id="${result.id}">
        ${result.status === 'pending' ? `
          <div class="loading-indicator">
            <div class="spinner"></div>
            <span>Generating...</span>
          </div>
        ` : result.mediaUrl ? (isImage ? `
          <img src="${result.mediaUrl}" alt="Generated image" loading="lazy">
        ` : `
          <video src="${result.mediaUrl}" preload="metadata" muted loop></video>
        `) : `
          <div class="loading-indicator">
            <i class="bi bi-exclamation-triangle" style="font-size: 32px; color: #f87171;"></i>
            <span>Generation failed</span>
          </div>
        `}
      </div>
      <div class="gen-result-footer">
        <div class="gen-result-info">
          <div class="prompt-text">${this.escapeHtml(result.prompt)}</div>
          <div class="meta">
            <span class="gen-status-badge ${result.status}">${this.getStatusLabel(result.status)}</span>
            <span>${result.model}</span>
            <span>${this.formatTimeAgo(result.createdAt)}</span>
          </div>
        </div>
        <div class="gen-result-actions">
          ${result.status === 'completed' ? `
            <button class="gen-action-btn" onclick="genDashboard.openPreview('${result.id}')" title="View">
              <i class="bi bi-eye"></i>
            </button>
            <button class="gen-action-btn" onclick="genDashboard.downloadResult('${result.id}')" title="Download">
              <i class="bi bi-download"></i>
            </button>
            <button class="gen-action-btn" onclick="genDashboard.reusePrompt('${result.id}')" title="Reuse">
              <i class="bi bi-arrow-repeat"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
    
    // Add click handler for media preview
    const media = card.querySelector('.gen-result-media');
    if (media && result.status === 'completed') {
      media.addEventListener('click', () => this.openPreview(result.id));
    }
    
    return card;
  }
  
  updateResultWithData(resultId, data) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result) return;
    
    result.status = data.status || 'completed';
    result.mediaUrl = data.imageUrl || data.videoUrl || data.url;
    
    console.log('[GenerationDashboard] updateResultWithData:', {
      resultId,
      status: result.status,
      mediaUrl: result.mediaUrl,
      dataReceived: data
    });
    
    // Update card in DOM
    const card = document.getElementById(`result-${resultId}`);
    if (card) {
      const newCard = this.createResultCard(result);
      card.replaceWith(newCard);
    }
    
    // Save to localStorage
    this.saveResults();
  }
  
  // ============================================================================
  // TASK POLLING
  // ============================================================================
  
  startPollingTask(result) {
    const taskId = result.taskId;
    if (!taskId) return;
    
    const pollEndpoint = this.state.mode === 'image'
      ? '/dashboard/image/status'
      : '/dashboard/video/status';
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${pollEndpoint}/${taskId}`);
        const data = await response.json();
        
        if (data.status === 'completed' || data.status === 'TASK_STATUS_SUCCEED') {
          clearInterval(interval);
          this.pollIntervals.delete(taskId);
          
          // Extract image URL - backend returns images array with imageUrl property
          const imageUrl = data.imageUrl || data.images?.[0]?.imageUrl || data.images?.[0]?.image_url || data.images?.[0]?.url;
          const videoUrl = data.videoUrl || data.videos?.[0]?.videoUrl || data.videos?.[0]?.url;
          
          console.log('[GenerationDashboard] Task completed, imageUrl:', imageUrl);
          console.log('[GenerationDashboard] Raw images data:', data.images);
          
          this.updateResultWithData(result.id, {
            status: 'completed',
            imageUrl: imageUrl,
            videoUrl: videoUrl
          });
        } else if (data.status === 'failed' || data.status === 'TASK_STATUS_FAILED') {
          clearInterval(interval);
          this.pollIntervals.delete(taskId);
          this.updateResultWithData(result.id, { status: 'failed' });
        }
      } catch (error) {
        console.error('[GenerationDashboard] Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds
    
    this.pollIntervals.set(taskId, interval);
  }
  
  // ============================================================================
  // FILE UPLOADS
  // ============================================================================
  
  /**
   * Get the tool button selector from a state type
   * @param {string} type - State type like 'baseImage', 'faceImage', 'baseVideo'
   * @returns {string} - Tool button data-tool value
   */
  getToolButtonSelector(type) {
    const typeToToolMap = {
      'baseImage': 'upload-base',
      'faceImage': 'upload-face',
      'targetImage': 'upload-target',
      'baseVideo': 'upload-video'
    };
    return typeToToolMap[type] || null;
  }
  
  handleToolClick(e) {
    const btn = e.currentTarget;
    const tool = btn.dataset.tool;
    
    // Check if button is disabled
    if (btn.disabled || btn.classList.contains('gen-disabled')) {
      this.showNotification('This option is not available for the selected model', 'info');
      return;
    }
    
    switch (tool) {
      case 'upload-base':
        this.elements.baseImageInput?.click();
        break;
      case 'upload-face':
        this.elements.faceImageInput?.click();
        break;
      case 'upload-target':
        this.elements.targetImageInput?.click();
        break;
      case 'upload-video':
        this.elements.baseVideoInput?.click();
        break;
      case 'aspect-ratio':
      case 'duration':
      case 'image-count':
      case 'settings':
        this.openSettingsSheet(tool);
        break;
    }
  }
  
  async handleFileUpload(file, type) {
    if (!file) return;
    
    const maxSize = type === 'baseVideo' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showNotification(`File too large. Max size: ${maxSize / (1024 * 1024)}MB`, 'error');
      return;
    }
    
    try {
      const dataUrl = await this.fileToDataUrl(file);
      this.state.tools[type] = dataUrl;
      
      // Update tool button to show it has content
      const toolSelector = this.getToolButtonSelector(type);
      if (toolSelector) {
        const toolBtn = document.querySelector(`[data-tool="${toolSelector}"]`);
        if (toolBtn) {
          toolBtn.classList.add('has-content');
        }
      }
      
      this.showNotification(`${type} uploaded successfully`, 'success');
    } catch (error) {
      console.error('[GenerationDashboard] File upload error:', error);
      this.showNotification('Failed to upload file', 'error');
    }
  }
  
  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  clearUpload(type) {
    this.state.tools[type] = null;
    
    const toolSelector = this.getToolButtonSelector(type);
    if (toolSelector) {
      const toolBtn = document.querySelector(`[data-tool="${toolSelector}"]`);
      if (toolBtn) {
        toolBtn.classList.remove('has-content');
      }
    }
  }
  
  // ============================================================================
  // SETTINGS
  // ============================================================================
  
  openSettingsSheet(settingType) {
    this.showOverlay('settingsSheet');
    this.renderSettingsContent(settingType);
  }
  
  renderSettingsContent(settingType) {
    const container = document.querySelector('#settingsSheet .gen-bottom-sheet-body');
    if (!container) return;
    
    let html = '';
    
    // Aspect Ratio setting
    if (settingType === 'aspect-ratio' || settingType === 'settings') {
      const aspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
      html += `
        <div class="gen-settings-group">
          <label>Aspect Ratio</label>
          <div class="gen-segmented-control">
            ${aspectRatios.map(ratio => `
              <button class="gen-segmented-btn ${this.state.tools.aspectRatio === ratio ? 'active' : ''}"
                      data-value="${ratio}" data-setting="aspectRatio">
                ${ratio}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Image Count setting (only for image mode)
    if ((settingType === 'image-count' || settingType === 'settings') && this.state.mode === 'image') {
      const counts = [1, 2, 3, 4];
      html += `
        <div class="gen-settings-group">
          <label>Number of Images</label>
          <div class="gen-segmented-control">
            ${counts.map(count => `
              <button class="gen-segmented-btn ${this.state.tools.imageCount === count ? 'active' : ''}"
                      data-value="${count}" data-setting="imageCount">
                ${count}x
              </button>
            `).join('')}
          </div>
          <div class="form-text">Cost: ${this.state.imageCostPerUnit} points per image</div>
        </div>
      `;
    }
    
    // Duration setting (only for video mode)
    if ((settingType === 'duration' || settingType === 'settings') && this.state.mode === 'video') {
      const durations = ['3', '5', '10'];
      html += `
        <div class="gen-settings-group">
          <label>Duration (seconds)</label>
          <div class="gen-segmented-control">
            ${durations.map(d => `
              <button class="gen-segmented-btn ${this.state.tools.duration === d ? 'active' : ''}"
                      data-value="${d}" data-setting="duration">
                ${d}s
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Negative Prompt setting
    if (settingType === 'settings') {
      html += `
        <div class="gen-settings-group">
          <label>Negative Prompt</label>
          <textarea class="gen-settings-input" id="negativePromptInput" 
                    placeholder="Enter things to avoid..."
                    rows="3">${this.state.tools.negativePrompt || ''}</textarea>
          <div class="form-text">Describe what you don't want in the result</div>
        </div>
      `;
    }
    
    container.innerHTML = html;
    
    // Bind events for segmented buttons
    container.querySelectorAll('.gen-segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const setting = btn.dataset.setting;
        let value = btn.dataset.value;
        
        // Parse numeric values
        if (setting === 'imageCount') {
          value = parseInt(value, 10);
        }
        
        this.state.tools[setting] = value;
        
        // Update UI
        btn.parentElement.querySelectorAll('.gen-segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update cost display live when image count changes
        if (setting === 'imageCount') {
          this.updateCostDisplay();
          this.updateImageCountButton();
        }
        
        // Update aspect ratio button when changed
        if (setting === 'aspectRatio') {
          this.updateAspectRatioButton();
        }
      });
    });
    
    const negativeInput = container.querySelector('#negativePromptInput');
    if (negativeInput) {
      negativeInput.addEventListener('change', (e) => {
        this.state.tools.negativePrompt = e.target.value;
      });
    }
  }
  
  // ============================================================================
  // PREVIEW
  // ============================================================================
  
  openPreview(resultId) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result || !result.mediaUrl) return;
    
    const overlay = this.elements.previewOverlay;
    if (!overlay) return;
    
    const content = overlay.querySelector('.gen-preview-content');
    if (!content) return;
    
    // Store current preview ID for action buttons in template
    this._currentPreviewId = resultId;
    this._currentPreviewResult = result;
    
    const isImage = result.mode === 'image';
    content.innerHTML = isImage
      ? `<img src="${result.mediaUrl}" alt="Preview">`
      : `<video src="${result.mediaUrl}" controls autoplay></video>`;
    
    // Update footer with appropriate action buttons
    this.updatePreviewFooter(result);
    
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Store current scroll position
    this._scrollPosition = this.elements.mainContent?.scrollTop;
    
    // Bind close button
    const closeBtn = overlay.querySelector('.gen-preview-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.closePreview();
    }
  }
  
  /**
   * Update preview footer with action buttons based on result type
   */
  updatePreviewFooter(result) {
    const footer = this.elements.previewOverlay?.querySelector('.gen-preview-footer');
    if (!footer) return;
    
    const isImage = result.mode === 'image';
    
    footer.innerHTML = `
      <button class="gen-preview-action" onclick="genDashboard.downloadResult('${result.id}')">
        <i class="bi bi-download"></i>
        <span>Download</span>
      </button>
      <button class="gen-preview-action" onclick="genDashboard.reusePrompt('${result.id}'); genDashboard.closePreview();">
        <i class="bi bi-arrow-repeat"></i>
        <span>Reuse</span>
      </button>
      ${isImage ? `
        <button class="gen-preview-action" onclick="genDashboard.openCreateCharacterModal('${result.id}')">
          <i class="bi bi-person-plus"></i>
          <span>Character</span>
        </button>
        <button class="gen-preview-action" onclick="genDashboard.createPost('${result.id}')">
          <i class="bi bi-share"></i>
          <span>Post</span>
        </button>
      ` : ''}
    `;
  }
  
  closePreview() {
    const overlay = this.elements.previewOverlay;
    if (!overlay) return;
    
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    
    // Stop video if playing
    const video = overlay.querySelector('video');
    if (video) video.pause();
    
    // Restore scroll position
    if (this.elements.mainContent && this._scrollPosition !== undefined) {
      this.elements.mainContent.scrollTop = this._scrollPosition;
    }
  }
  
  // ============================================================================
  // RESULT ACTIONS
  // ============================================================================
  
  downloadResult(resultId) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result || !result.mediaUrl) return;
    
    const link = document.createElement('a');
    link.href = result.mediaUrl;
    link.download = `generation-${result.id}.${result.mode === 'image' ? 'png' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  reusePrompt(resultId) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result) return;
    
    if (this.elements.promptInput) {
      this.elements.promptInput.value = result.prompt;
      this.resizePromptInput();
      this.elements.promptInput.focus();
    }
  }
  
  // ============================================================================
  // OVERLAYS
  // ============================================================================
  
  showOverlay(sheetId) {
    if (this.elements.overlayBackdrop) {
      this.elements.overlayBackdrop.classList.add('active');
    }
    
    const sheet = document.getElementById(sheetId);
    if (sheet) {
      sheet.classList.add('active');
    }
  }
  
  closeAllOverlays() {
    if (this.elements.overlayBackdrop) {
      this.elements.overlayBackdrop.classList.remove('active');
    }
    
    document.querySelectorAll('.gen-bottom-sheet').forEach(sheet => {
      sheet.classList.remove('active');
    });
    
    this.closePreview();
  }
  
  // ============================================================================
  // UI UPDATES
  // ============================================================================
  
  updateUI() {
    this.updateModelDisplay();
    this.updateToolsForMode();
    this.updateCostDisplay();
    this.updateSubmitButtonState();
    this.updateEmptyState();
  }
  
  updateGeneratingState(isGenerating) {
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = isGenerating;
      this.elements.submitBtn.innerHTML = isGenerating
        ? '<div class="spinner-border spinner-border-sm" role="status"></div>'
        : '<i class="bi bi-arrow-up"></i>';
    }
    
    if (this.elements.promptInput) {
      this.elements.promptInput.disabled = isGenerating;
    }
  }
  
  /**
   * Calculate total cost based on mode and image count
   */
  calculateTotalCost() {
    if (this.state.mode === 'image') {
      const imageCount = this.state.tools.imageCount || 1;
      return this.state.imageCostPerUnit * imageCount;
    }
    return this.state.videoCostPerUnit;
  }
  
  updateCostDisplay() {
    if (!this.elements.costDisplay) return;
    
    const totalCost = this.calculateTotalCost();
    const hasEnough = this.state.userPoints >= totalCost;
    
    this.elements.costDisplay.classList.toggle('insufficient', !hasEnough);
    
    const costValue = this.elements.costDisplay.querySelector('.cost-value');
    const costAmount = document.getElementById('costAmount');
    
    if (costValue) {
      // Show image count if more than 1
      const imageCount = this.state.tools.imageCount || 1;
      if (this.state.mode === 'image' && imageCount > 1) {
        costValue.innerHTML = `<i class="bi bi-coin"></i> <span id="costAmount">${totalCost}</span> points (${imageCount} images)`;
      } else {
        costValue.innerHTML = `<i class="bi bi-coin"></i> <span id="costAmount">${totalCost}</span> points`;
      }
    } else if (costAmount) {
      costAmount.textContent = totalCost;
    }
  }
  
  updateEmptyState() {
    if (!this.elements.emptyState) return;
    
    const icon = this.elements.emptyState.querySelector('.empty-icon i');
    const title = this.elements.emptyState.querySelector('h3');
    const desc = this.elements.emptyState.querySelector('p');
    
    if (this.state.mode === 'image') {
      if (icon) icon.className = 'bi bi-images';
      if (title) title.textContent = 'Ready to create images';
      if (desc) desc.textContent = 'Enter a prompt below to generate your first image';
    } else {
      if (icon) icon.className = 'bi bi-film';
      if (title) title.textContent = 'Ready to create videos';
      if (desc) desc.textContent = 'Enter a prompt or upload an image to generate your first video';
    }
    
    // Show/hide based on results
    const hasResults = this.state.results.length > 0;
    this.elements.emptyState.style.display = hasResults ? 'none' : 'flex';
  }
  
  hasEnoughPoints() {
    const cost = this.calculateTotalCost();
    return this.state.userPoints >= cost;
  }
  
  // ============================================================================
  // PERSISTENCE
  // ============================================================================
  
  loadStoredResults() {
    try {
      const stored = localStorage.getItem('gen_dashboard_results');
      if (stored) {
        const results = JSON.parse(stored);
        // Only load completed results
        this.state.results = results.filter(r => r.status === 'completed').slice(0, 20);
        
        // Render stored results
        this.state.results.forEach(result => {
          const card = this.createResultCard(result);
          if (this.elements.contentInner) {
            this.elements.contentInner.appendChild(card);
          }
        });
        
        this.updateEmptyState();
      }
    } catch (error) {
      console.error('[GenerationDashboard] Failed to load stored results:', error);
    }
  }
  
  saveResults() {
    try {
      // Only save completed results, limit to 20
      const toSave = this.state.results
        .filter(r => r.status === 'completed')
        .slice(0, 20);
      localStorage.setItem('gen_dashboard_results', JSON.stringify(toSave));
    } catch (error) {
      console.error('[GenerationDashboard] Failed to save results:', error);
    }
  }
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
  
  getStatusLabel(status) {
    const labels = {
      pending: 'Generating...',
      completed: 'Complete',
      failed: 'Failed'
    };
    return labels[status] || status;
  }
  
  showNotification(message, type = 'info') {
    // Use existing notification system if available
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    
    // Fallback: create toast
    const bgClass = type === 'error' ? 'bg-danger' : type === 'success' ? 'bg-success' : 'bg-info';
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white ${bgClass} border-0 position-fixed`;
    toast.style.cssText = 'bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 1100;';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
  }
  
  // ============================================================================
  // CHARACTER CREATION & POSTING
  // ============================================================================
  
  /**
   * Open create character modal for a result
   */
  openCreateCharacterModal(resultId) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result || !result.mediaUrl) {
      this.showNotification('No image available', 'error');
      return;
    }
    
    // Check if the create character modal exists on the page
    const modal = document.getElementById('createCharacterModal');
    if (modal) {
      // Use the existing modal system from admin-image-test.js
      // Set up the modal data
      const previewImg = document.getElementById('characterPreviewImage');
      const promptPreview = document.getElementById('characterPromptPreview');
      const nameInput = document.getElementById('characterNameInput');
      const personalityInput = document.getElementById('characterPersonalityInput');
      
      if (previewImg) previewImg.src = result.mediaUrl;
      if (promptPreview) {
        const promptText = result.prompt.length > 200 
          ? result.prompt.substring(0, 200) + '...' 
          : result.prompt;
        promptPreview.textContent = promptText;
      }
      if (nameInput) nameInput.value = '';
      if (personalityInput) personalityInput.value = '';
      
      // Store result data for character creation as instance property
      this._currentCharacterImageData = {
        imageUrl: result.mediaUrl,
        prompt: result.prompt,
        modelId: result.modelId || this.state.selectedModel?.id,
        modelName: result.model
      };
      
      // Show the modal
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      this.closePreview();
    } else {
      // Redirect to character creation page with image URL
      const params = new URLSearchParams({
        imageUrl: result.mediaUrl,
        prompt: result.prompt
      });
      window.location.href = `/character-creation?${params.toString()}`;
    }
  }
  
  /**
   * Create a post from a result
   */
  async createPost(resultId) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result || !result.mediaUrl) {
      this.showNotification('No image available', 'error');
      return;
    }
    
    // Check if post modal exists
    const modal = document.getElementById('createPostModal');
    if (modal) {
      // Set up the modal
      const mediaPreview = modal.querySelector('.post-media-preview');
      if (mediaPreview) {
        mediaPreview.innerHTML = result.mode === 'image'
          ? `<img src="${result.mediaUrl}" alt="Post image">`
          : `<video src="${result.mediaUrl}" controls></video>`;
      }
      
      const captionInput = modal.querySelector('#postCaption');
      if (captionInput) captionInput.value = result.prompt;
      
      // Store result data for posting
      // Store result data for posting as instance property
      this._currentPostData = {
        mediaUrl: result.mediaUrl,
        mediaType: result.mode,
        prompt: result.prompt
      };
      
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      this.closePreview();
    } else {
      // Redirect to posts dashboard with the image
      const params = new URLSearchParams({
        imageUrl: result.mediaUrl,
        caption: result.prompt
      });
      window.location.href = `/dashboard/posts?${params.toString()}`;
    }
  }
  
  /**
   * Add result to character gallery
   */
  async addToGallery(resultId, characterId) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result || !result.mediaUrl) {
      this.showNotification('No media available', 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/dashboard/add-image-to-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          mediaUrl: result.mediaUrl,
          mediaType: result.mode,
          prompt: result.prompt
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showNotification('Added to gallery!', 'success');
      } else {
        throw new Error(data.error || 'Failed to add to gallery');
      }
    } catch (error) {
      console.error('[GenerationDashboard] Add to gallery error:', error);
      this.showNotification(error.message || 'Failed to add to gallery', 'error');
    }
  }
  
  /**
   * Confirm and create character from the modal
   */
  async confirmCreateCharacter() {
    const imageData = this._currentCharacterImageData;
    if (!imageData || !imageData.imageUrl) {
      this.showNotification('No image data available', 'error');
      return;
    }
    
    const btn = document.getElementById('confirmCreateCharacterBtn');
    const name = document.getElementById('characterNameInput')?.value.trim();
    const personalityInput = document.getElementById('characterPersonalityInput')?.value.trim();
    const language = document.getElementById('characterLanguageSelect')?.value || 'english';
    const nsfw = document.getElementById('characterNsfwCheck')?.checked || false;
    const useImageAsBaseFace = document.getElementById('useImageAsBaseFaceCheck')?.checked || false;
    
    // Show loading state
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Creating Character...';
    }
    
    try {
      const response = await fetch('/api/dashboard/create-character-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageData.imageUrl,
          imagePrompt: imageData.prompt,
          personalityInput: personalityInput,
          name: name || undefined,
          language: language,
          nsfw: nsfw,
          useImageAsBaseFace: useImageAsBaseFace,
          modelId: imageData.modelId,
          modelName: imageData.modelName
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showNotification('Character created successfully!', 'success');
        
        // Store the chat URL for the start chat button
        const chatUrl = `/chat/${data.chatId}`;
        
        // Transform the button to "Start Chat" button
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('btn-success');
          btn.classList.add('btn-primary');
          btn.innerHTML = '<i class="bi bi-chat-heart me-1"></i>Start Chat';
          btn.onclick = function() {
            window.location.href = chatUrl;
          };
        }
        
        // Update cancel button text
        const cancelBtn = btn?.previousElementSibling;
        if (cancelBtn && cancelBtn.classList.contains('btn-secondary')) {
          cancelBtn.textContent = 'Close';
        }
      } else {
        throw new Error(data.error || 'Failed to create character');
      }
    } catch (error) {
      console.error('[GenerationDashboard] Create character error:', error);
      this.showNotification(error.message || 'Failed to create character', 'error');
      
      // Reset button state
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-person-plus me-1"></i>Create Character';
      }
    }
  }
}

// Global instance
let genDashboard;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Get configuration from page
  const config = window.GEN_DASHBOARD_CONFIG || {};
  genDashboard = new GenerationDashboard(config);
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenerationDashboard;
}
