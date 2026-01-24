/**
 * Unified Generation Dashboard
 * Mobile-first state management for image and video generation
 */

// Model categories that cannot be used for text-to-image generation
const INCOMPATIBLE_TEXT_TO_IMAGE_CATEGORIES = ['face', 'img2img'];

// Custom model ID prefix
const CUSTOM_MODEL_PREFIX = 'custom-';

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
    
    // User's custom models
    this.userModels = [];
    
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
    this.loadUserModels(); // Load user's custom models
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
    
    // Add custom models section for image mode only
    if (this.state.mode === 'image' && this.userModels.length > 0) {
      html += `
        <div class="gen-model-category">
          <div class="gen-model-category-title">
            <i class="bi bi-person-badge"></i>
            Custom Models
            <span class="badge bg-primary ms-2">${this.userModels.length}</span>
          </div>
          <div class="gen-model-list">
            ${this.userModels.map(model => this.renderCustomModelItem(model)).join('')}
          </div>
        </div>
      `;
    }
    
    // Add "Add Custom Model" button for premium users in image mode
    if (this.state.mode === 'image') {
      const isPremium = window.user?.subscriptionStatus === 'active';
      html += `
        <div class="gen-model-category">
          <div class="gen-model-list">
            <div class="gen-model-item add-custom-model-item" id="addCustomModelBtn" style="cursor: pointer; border: 2px dashed rgba(255,255,255,0.2);">
              <div class="model-icon">
                <i class="bi bi-plus-circle"></i>
              </div>
              <div class="model-info">
                <div class="model-name">${isPremium ? 'Add Custom Model' : 'Add Custom Model (Premium)'}</div>
                <div class="model-desc">${isPremium ? 'Search and add Stable Diffusion models' : 'Upgrade to add custom models'}</div>
              </div>
              <div class="check-icon">
                ${isPremium ? '<i class="bi bi-search"></i>' : '<i class="bi bi-gem"></i>'}
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
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
    
    // Bind click events for system models
    container.querySelectorAll('.gen-model-item:not(.add-custom-model-item)').forEach(item => {
      item.addEventListener('click', () => {
        const modelId = item.dataset.modelId;
        this.selectModel(modelId);
      });
    });
    
    // Bind click event for add custom model button
    const addBtn = container.querySelector('#addCustomModelBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openCivitaiSearch());
    }
  }
  
  renderCustomModelItem(model) {
    // For custom models, the model.modelId already includes the prefix
    const isSelected = this.state.selectedModel?.id === model.modelId;
    
    return `
      <div class="gen-model-item ${isSelected ? 'selected' : ''}" data-model-id="${model.modelId}" data-is-custom="true">
        <div class="model-icon">
          ${model.image ? `<img src="${model.image}" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover;" alt="${model.name}">` : '<i class="bi bi-image"></i>'}
        </div>
        <div class="model-info">
          <div class="model-name">${model.name}</div>
          <div class="model-desc">${model.style || ''} - ${model.baseModel || 'SD'}</div>
          <div class="model-badges">
            <span class="gen-model-badge custom">Custom</span>
            <span class="gen-model-badge async">Async</span>
          </div>
        </div>
        <div class="check-icon">
          <i class="bi bi-check"></i>
        </div>
      </div>
    `;
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
    // Check if it's a custom model using the prefix constant
    let model = null;
    
    if (modelId.startsWith(CUSTOM_MODEL_PREFIX)) {
      // Search in user models
      model = this.userModels.find(m => m.modelId === modelId);
    } else {
      // Search in system models
      const models = this.state.mode === 'image' ? this.imageModels : this.videoModels;
      model = models.find(m => m.id === modelId);
    }
    
    if (model) {
      // Store model with proper id field for consistency
      this.state.selectedModel = {
        ...model,
        id: model.modelId || model.id
      };
      this.updateModelDisplay();
      this.updateToolButtonsForModel(); // Update tool buttons based on model requirements
      this.updateCostDisplay(); // Update cost as different models may have different costs
      this.updateSubmitButtonState(); // Update submit button state for face merge models
      this.closeAllOverlays();
      console.log('[GenerationDashboard] Model selected:', this.state.selectedModel.name, this.state.selectedModel);
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
  
  /**
   * Get the model name for SD models, handling multiple possible field names
   * @param {Object} model - Model object
   * @returns {string} Model name
   */
  getSDModelName(model) {
    return model.sdName || model.modelName || model.model || 'Unknown Model';
  }
  
  /**
   * Load user's custom models from the API
   */
  async loadUserModels() {
    try {
      const response = await fetch('/api/user/models');
      const data = await response.json();
      
      if (data.success && data.models) {
        // Convert user models to the format expected by the dashboard
        this.userModels = data.models.map(model => ({
          modelId: `${CUSTOM_MODEL_PREFIX}${model.modelId}`,
          name: model.name,
          sdName: model.model,
          model: model.model,
          image: model.image,
          style: model.style,
          baseModel: model.baseModel,
          category: 'txt2img',
          async: true,
          isCustom: true,
          isSDModel: true,
          requiresModel: true,
          modelName: model.model,
          description: `Custom ${model.style || ''} model`,
          supportedParams: ['model_name', 'prompt', 'negative_prompt', 'width', 'height', 'image_num', 'steps', 'guidance_scale', 'sampler_name', 'seed', 'loras', 'sd_vae'],
          defaultParams: {
            width: 1024,
            height: 1024,
            image_num: 1,
            steps: 30,
            guidance_scale: 7.5,
            sampler_name: 'Euler a',
            seed: -1
          }
        }));
        
        console.log('[GenerationDashboard] Loaded custom models:', this.userModels.length);
      }
    } catch (error) {
      console.error('[GenerationDashboard] Error loading user models:', error);
    }
  }
  
  /**
   * Open Civitai model search modal
   */
  openCivitaiSearch() {
    const isPremium = window.user?.subscriptionStatus === 'active';
    
    if (!isPremium) {
      this.showNotification('Custom models are a premium feature. Please upgrade your plan.', 'warning');
      // Redirect to plan page
      window.location.href = '/plan';
      return;
    }
    
    // Open the Civitai search modal
    const modal = new bootstrap.Modal(document.getElementById('civitaiSearchModal'));
    modal.show();
    
    // Close model sheet
    this.closeAllOverlays();
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
      // Create pending result card with expected image count
      const imageCount = this.state.mode === 'image' ? this.state.tools.imageCount : 1;
      const pendingResult = this.createPendingResult(prompt, imageCount);
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
      
      console.log('[GenerationDashboard] API Response:', JSON.stringify(data, null, 2));
      
      if (!data.success && !data.tasks) {
        throw new Error(data.error || 'Generation failed');
      }
      
      // Handle tasks - group all tasks into the single pending result (carousel mode)
      if (data.tasks && data.tasks.length > 0) {
        console.log(`[GenerationDashboard] Processing ${data.tasks.length} task(s) for carousel display`);
        
        // Process all tasks and group them into the single result
        for (let i = 0; i < data.tasks.length; i++) {
          const task = data.tasks[i];
          console.log(`[GenerationDashboard] Task ${i + 1}:`, {
            taskId: task.taskId || task.task_id,
            status: task.status,
            async: task.async,
            imagesCount: task.images?.length || 0
          });
          
          // Process task and add to the single pending result (as part of carousel)
          this.processTaskForCarousel(task, pendingResult, i);
        }
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
  
  /**
   * Process a single task from the generation response
   * @param {Object} task - Task object from backend
   * @param {Object} result - Result object to update
   */
  processTask(task, result) {
    // Check if task is already completed (sync models like merge-face-segmind)
    if (task.status === 'completed' && task.images && task.images.length > 0) {
      console.log('[GenerationDashboard] Sync task already completed with images:', task.images);
      const imageUrl = task.images[0]?.imageUrl || task.images[0]?.image_url || task.images[0]?.url || task.images[0];
      console.log('[GenerationDashboard] Extracted imageUrl:', imageUrl);
      if (imageUrl) {
        this.updateResultWithData(result.id, {
          status: 'completed',
          imageUrl: imageUrl
        });
      } else {
        console.error('[GenerationDashboard] Sync task completed but no imageUrl found in:', task.images[0]);
        this.updateResultWithData(result.id, { status: 'failed' });
      }
    } else if (task.status === 'completed') {
      // Task completed but no images - might be an error
      console.log('[GenerationDashboard] Task completed but no images:', task);
      this.updateResultWithData(result.id, { status: 'failed' });
    } else if (task.status === 'failed') {
      // Task failed on backend
      console.log('[GenerationDashboard] Task failed:', task.error || 'Unknown error');
      this.updateResultWithData(result.id, { status: 'failed' });
    } else {
      // Async task - need to poll for result
      result.taskId = task.taskId || task.task_id;
      this.startPollingTask(result);
    }
  }
  
  /**
   * Process a single task for carousel display (multiple images)
   * @param {Object} task - Task object from backend
   * @param {Object} result - Result object to update
   * @param {number} imageIndex - Index of this image in the carousel
   */
  processTaskForCarousel(task, result, imageIndex) {
    const taskId = task.taskId || task.task_id;
    
    // Track task IDs for this result
    result.taskIds.push(taskId);
    
    // Check if task is already completed (sync models like merge-face-segmind)
    if (task.status === 'completed' && task.images && task.images.length > 0) {
      console.log(`[GenerationDashboard] Sync task ${imageIndex + 1} already completed with images:`, task.images);
      const imageUrl = task.images[0]?.imageUrl || task.images[0]?.image_url || task.images[0]?.url || task.images[0];
      console.log('[GenerationDashboard] Extracted imageUrl:', imageUrl);
      if (imageUrl) {
        this.addImageToCarousel(result.id, imageUrl, imageIndex);
      } else {
        console.error('[GenerationDashboard] Sync task completed but no imageUrl found in:', task.images[0]);
      }
    } else if (task.status === 'failed') {
      // Task failed on backend
      console.log('[GenerationDashboard] Task failed:', task.error || 'Unknown error');
      // Don't add this image to carousel
    } else {
      // Async task - need to poll for result
      this.startPollingTaskForCarousel(result, taskId, imageIndex);
    }
  }
  
  /**
   * Add an image to the carousel for a multi-image result
   * @param {string} resultId - Result ID
   * @param {string} imageUrl - Image URL
   * @param {number} imageIndex - Index of this image in the carousel
   */
  addImageToCarousel(resultId, imageUrl, imageIndex) {
    const result = this.state.results.find(r => r.id === resultId);
    if (!result) return;
    
    console.log('[GenerationDashboard] Adding image to carousel:', {
      resultId,
      imageIndex,
      imageUrl: imageUrl?.substring(0, 80) + '...'
    });
    
    // Initialize images array and completion tracker if needed
    if (!result.images) {
      result.images = [];
    }
    if (!result.completedTaskCount) {
      result.completedTaskCount = 0;
    }
    
    // Add image at the correct index
    result.images[imageIndex] = imageUrl;
    result.completedTaskCount++;
    
    // Check if all tasks are complete (either succeeded or failed)
    const allTasksProcessed = result.completedTaskCount >= result.imageCount;
    if (allTasksProcessed) {
      result.status = 'completed';
      const successCount = result.images.filter(Boolean).length;
      console.log(`[GenerationDashboard] All carousel tasks processed: ${successCount}/${result.imageCount} succeeded`);
    }
    
    // Update card in DOM
    const card = document.getElementById(`result-${resultId}`);
    if (card) {
      const newCard = this.createResultCard(result);
      card.replaceWith(newCard);
    }
    
    // Save to localStorage
    this.saveResults();
  }
  
  buildGenerationPayload(prompt) {
    const model = this.state.selectedModel;
    const payload = {};
    
    // Check if this is a custom SD model
    if (model.isCustom || model.isSDModel) {
      // For SD models, use selectedSDModels array
      const modelName = this.getSDModelName(model);
      payload.selectedSDModels = [{
        model: modelName,
        model_name: modelName,
        name: model.name
      }];
      payload.models = []; // Empty array for standard models
    } else {
      // For standard models
      payload.models = [model.id];
      payload.selectedSDModels = []; // Empty array for SD models
    }
    
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
  
  createPendingResult(prompt, imageCount = 1) {
    const result = {
      id: Date.now().toString(),
      taskId: null,
      prompt,
      status: 'pending',
      mode: this.state.mode,
      model: this.state.selectedModel?.name || 'Unknown',
      createdAt: new Date().toISOString(),
      mediaUrl: null,
      // Support for multiple images
      images: imageCount > 1 ? [] : null, // Array for multiple images, null for single
      imageCount: imageCount,
      activeImageIndex: 0, // Track which image is currently being viewed
      taskIds: [], // Track all task IDs for this generation
      completedTaskCount: 0 // Track how many tasks have finished (success or fail)
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
    const hasMultipleImages = result.images && result.images.length > 1;
    const completedImages = result.images ? result.images.filter(Boolean) : [];
    const isCarouselComplete = hasMultipleImages && completedImages.length === result.imageCount;
    
    // Determine media content based on whether this is a carousel or single image
    let mediaContent = '';
    
    if (result.status === 'pending' && !hasMultipleImages) {
      // Single image pending
      mediaContent = `
        <div class="loading-indicator">
          <div class="spinner"></div>
          <span>Generating...</span>
        </div>
      `;
    } else if (hasMultipleImages) {
      // Multiple images - carousel mode
      if (completedImages.length === 0) {
        // No images loaded yet
        mediaContent = `
          <div class="loading-indicator">
            <div class="spinner"></div>
            <span>Generating ${result.imageCount} images...</span>
          </div>
        `;
      } else {
        // At least one image loaded - show carousel
        const carouselId = `carousel-${result.id}`;
        // Map completed images with their indices for proper carousel navigation
        const completedImageIndices = result.images
          .map((img, idx) => img ? idx : null)
          .filter(idx => idx !== null);
        
        mediaContent = `
          <div id="${carouselId}" class="carousel slide" data-bs-ride="false" data-bs-interval="false">
            <div class="carousel-inner">
              ${result.images.map((imageUrl, index) => {
                if (!imageUrl) return ''; // Skip empty slots
                // Check if this is the first completed image (should be active if activeImageIndex isn't set yet)
                const isActive = index === result.activeImageIndex || 
                                (result.activeImageIndex === 0 && index === completedImageIndices[0]);
                return `
                  <div class="carousel-item ${isActive ? 'active' : ''}" data-image-index="${index}">
                    <img src="${imageUrl}" alt="Generated image ${index + 1}" loading="lazy" class="d-block w-100">
                  </div>
                `;
              }).join('')}
            </div>
            ${completedImages.length > 1 ? `
              <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Previous</span>
              </button>
              <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="visually-hidden">Next</span>
              </button>
            ` : ''}
            <div class="carousel-indicators">
              ${result.images.map((imageUrl, index) => {
                if (!imageUrl) {
                  // Show loading dot without navigation
                  return `<button type="button" class="loading-dot" disabled></button>`;
                }
                // Find the slide index for this image (only count completed images)
                const slideIndex = completedImageIndices.indexOf(index);
                const isActive = index === result.activeImageIndex || 
                                (result.activeImageIndex === 0 && index === completedImageIndices[0]);
                return `
                  <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${slideIndex}" 
                    class="${isActive ? 'active' : ''}" 
                    aria-current="${isActive ? 'true' : 'false'}" 
                    aria-label="Image ${index + 1}"></button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    } else if (result.mediaUrl) {
      // Single image/video completed
      mediaContent = isImage 
        ? `<img src="${result.mediaUrl}" alt="Generated image" loading="lazy">`
        : `<video src="${result.mediaUrl}" preload="metadata" muted loop></video>`;
    } else {
      // Failed or no media
      mediaContent = `
        <div class="loading-indicator">
          <i class="bi bi-exclamation-triangle" style="font-size: 32px; color: #f87171;"></i>
          <span>Generation failed</span>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="gen-result-media ${result.status === 'pending' && !hasMultipleImages ? 'loading' : ''}" data-result-id="${result.id}">
        ${mediaContent}
      </div>
      <div class="gen-result-footer">
        <div class="gen-result-info">
          <div class="prompt-text">${this.escapeHtml(result.prompt)}</div>
          <div class="meta">
            <span class="gen-status-badge ${result.status}">${this.getStatusLabel(result.status)}</span>
            <span>${result.model}</span>
            <span>${this.formatTimeAgo(result.createdAt)}</span>
            ${hasMultipleImages ? `<span>${completedImages.length}/${result.imageCount} images</span>` : ''}
          </div>
        </div>
        <div class="gen-result-actions">
          ${(result.status === 'completed' || isCarouselComplete) ? `
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
    
    // Add click handler for media preview (for non-carousel)
    const media = card.querySelector('.gen-result-media');
    if (media && (result.status === 'completed' || isCarouselComplete) && !hasMultipleImages) {
      media.addEventListener('click', () => this.openPreview(result.id));
    }
    
    // Add carousel slide event listener to update active image index
    if (hasMultipleImages && completedImages.length > 1) {
      const carousel = card.querySelector('.carousel');
      if (carousel) {
        carousel.addEventListener('slid.bs.carousel', (e) => {
          const activeItem = e.relatedTarget;
          if (activeItem && activeItem.dataset && activeItem.dataset.imageIndex !== undefined) {
            const imageIndex = parseInt(activeItem.dataset.imageIndex, 10);
            if (!isNaN(imageIndex) && imageIndex >= 0 && imageIndex < result.images.length) {
              result.activeImageIndex = imageIndex;
              console.log('[GenerationDashboard] Carousel slid to image:', imageIndex);
            }
          }
        });
      }
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
    if (!taskId) {
      console.log('[GenerationDashboard] startPollingTask: No taskId provided');
      return;
    }
    
    // Skip polling for sync tasks (they already have results)
    if (taskId.startsWith('sync-')) {
      console.log('[GenerationDashboard] Skipping poll for sync task:', taskId);
      return;
    }
    
    console.log('[GenerationDashboard] Starting poll for task:', taskId);
    
    const pollEndpoint = this.state.mode === 'image'
      ? '/dashboard/image/status'
      : '/dashboard/video/status';
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${pollEndpoint}/${taskId}`);
        const data = await response.json();
        
        console.log('[GenerationDashboard] Poll response for', taskId, ':', data);
        
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
  
  /**
   * Start polling for a task that's part of a carousel (multiple images)
   * @param {Object} result - The result object containing the carousel
   * @param {string} taskId - Task ID to poll
   * @param {number} imageIndex - Index of this image in the carousel
   */
  startPollingTaskForCarousel(result, taskId, imageIndex) {
    if (!taskId) {
      console.log('[GenerationDashboard] startPollingTaskForCarousel: No taskId provided');
      return;
    }
    
    // Skip polling for sync tasks (they already have results)
    if (taskId.startsWith('sync-')) {
      console.log('[GenerationDashboard] Skipping poll for sync task:', taskId);
      return;
    }
    
    console.log('[GenerationDashboard] Starting carousel poll for task:', taskId, 'imageIndex:', imageIndex);
    
    const pollEndpoint = this.state.mode === 'image'
      ? '/dashboard/image/status'
      : '/dashboard/video/status';
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${pollEndpoint}/${taskId}`);
        const data = await response.json();
        
        console.log('[GenerationDashboard] Carousel poll response for', taskId, 'imageIndex', imageIndex, ':', data);
        
        if (data.status === 'completed' || data.status === 'TASK_STATUS_SUCCEED') {
          clearInterval(interval);
          this.pollIntervals.delete(taskId);
          
          // Extract image URL
          const imageUrl = data.imageUrl || data.images?.[0]?.imageUrl || data.images?.[0]?.image_url || data.images?.[0]?.url;
          
          console.log('[GenerationDashboard] Carousel task completed, imageUrl:', imageUrl);
          
          if (imageUrl) {
            this.addImageToCarousel(result.id, imageUrl, imageIndex);
          }
        } else if (data.status === 'failed' || data.status === 'TASK_STATUS_FAILED') {
          clearInterval(interval);
          this.pollIntervals.delete(taskId);
          console.log('[GenerationDashboard] Carousel task failed for imageIndex:', imageIndex);
          
          // Increment completion counter even for failed tasks
          const foundResult = this.state.results.find(r => r.id === result.id);
          if (foundResult) {
            if (!foundResult.completedTaskCount) {
              foundResult.completedTaskCount = 0;
            }
            foundResult.completedTaskCount++;
            
            // Check if all tasks are done
            if (foundResult.completedTaskCount >= foundResult.imageCount) {
              foundResult.status = 'completed';
            }
            
            // Update the UI
            const card = document.getElementById(`result-${result.id}`);
            if (card) {
              const newCard = this.createResultCard(foundResult);
              card.replaceWith(newCard);
            }
          }
        }
      } catch (error) {
        console.error('[GenerationDashboard] Carousel polling error:', error);
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
    if (!result) return;
    
    // Check if we have media to preview
    const hasMedia = result.mediaUrl || (result.images && result.images.length > 0);
    if (!hasMedia) return;
    
    const overlay = this.elements.previewOverlay;
    if (!overlay) return;
    
    const content = overlay.querySelector('.gen-preview-content');
    if (!content) return;
    
    // Store current preview ID for action buttons in template
    this._currentPreviewId = resultId;
    this._currentPreviewResult = result;
    
    const isImage = result.mode === 'image';
    
    // Handle carousel images in preview
    if (result.images && result.images.length > 0) {
      const carouselId = `preview-carousel-${result.id}`;
      const completedImages = result.images.filter(Boolean);
      // Map completed images with their indices for proper carousel navigation
      const completedImageIndices = result.images
        .map((img, idx) => img ? idx : null)
        .filter(idx => idx !== null);
      
      content.innerHTML = `
        <div id="${carouselId}" class="carousel slide preview-carousel" data-bs-ride="false" data-bs-interval="false">
          <div class="carousel-inner">
            ${result.images.map((imageUrl, index) => {
              if (!imageUrl) return ''; // Skip empty slots
              const isActive = index === result.activeImageIndex || 
                              (result.activeImageIndex === 0 && index === completedImageIndices[0]);
              return `
                <div class="carousel-item ${isActive ? 'active' : ''}" data-image-index="${index}">
                  <img src="${imageUrl}" alt="Preview image ${index + 1}" class="d-block w-100">
                </div>
              `;
            }).join('')}
          </div>
          ${completedImages.length > 1 ? `
            <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            </button>
          ` : ''}
          <div class="carousel-indicators">
            ${result.images.map((imageUrl, index) => {
              if (!imageUrl) return '';
              // Find the slide index for this image (only count completed images)
              const slideIndex = completedImageIndices.indexOf(index);
              const isActive = index === result.activeImageIndex || 
                              (result.activeImageIndex === 0 && index === completedImageIndices[0]);
              return `
                <button type="button" data-bs-target="#${carouselId}" data-bs-slide-to="${slideIndex}" 
                  class="${isActive ? 'active' : ''}" 
                  aria-current="${isActive ? 'true' : 'false'}" 
                  aria-label="Image ${index + 1}"></button>
              `;
            }).join('')}
          </div>
        </div>
      `;
      
      // Add carousel slide event listener to update active image and action buttons
      setTimeout(() => {
        const carousel = content.querySelector('.carousel');
        if (carousel) {
          carousel.addEventListener('slid.bs.carousel', (e) => {
            const activeItem = e.relatedTarget;
            if (activeItem && activeItem.dataset && activeItem.dataset.imageIndex !== undefined) {
              const imageIndex = parseInt(activeItem.dataset.imageIndex, 10);
              if (!isNaN(imageIndex) && imageIndex >= 0 && imageIndex < result.images.length) {
                result.activeImageIndex = imageIndex;
                console.log('[GenerationDashboard] Preview carousel slid to image:', imageIndex);
                // Update footer buttons to reference the new active image
                this.updatePreviewFooter(result);
              }
            }
          });
        }
      }, 100);
    } else {
      // Single image/video
      content.innerHTML = isImage
        ? `<img src="${result.mediaUrl}" alt="Preview">`
        : `<video src="${result.mediaUrl}" controls autoplay></video>`;
    }
    
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
    if (!result) return;
    
    // Handle carousel images - download the active image
    let downloadUrl, filename;
    if (result.images && result.images.length > 0) {
      downloadUrl = result.images[result.activeImageIndex || 0];
      filename = `generation-${result.id}-${(result.activeImageIndex || 0) + 1}.png`;
    } else if (result.mediaUrl) {
      downloadUrl = result.mediaUrl;
      filename = `generation-${result.id}.${result.mode === 'image' ? 'png' : 'mp4'}`;
    } else {
      return; // No media to download
    }
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
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
    if (!result) {
      this.showNotification('Result not found', 'error');
      return;
    }
    
    // Get the active image URL (supports both single and carousel)
    let imageUrl;
    if (result.images && result.images.length > 0) {
      imageUrl = result.images[result.activeImageIndex || 0];
    } else {
      imageUrl = result.mediaUrl;
    }
    
    if (!imageUrl) {
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
      
      if (previewImg) previewImg.src = imageUrl;
      if (promptPreview) {
        const promptText = result.prompt.length > 200 
          ? result.prompt.substring(0, 200) + '...' 
          : result.prompt;
        promptPreview.textContent = promptText;
      }
      if (nameInput) nameInput.value = '';
      if (personalityInput) personalityInput.value = '';
      
      // Get the current model info
      const currentModel = this.state.selectedModel;
      const currentModelCategory = currentModel?.category;
      
      // Determine if we need to show the model selector
      // Show it if the current model is not suitable for text-to-image (e.g., face tools, img2img)
      const needsModelSelection = currentModelCategory && INCOMPATIBLE_TEXT_TO_IMAGE_CATEGORIES.includes(currentModelCategory);
      
      // Populate the text-to-image model selector if needed
      const modelSection = document.getElementById('characterImageModelSection');
      const modelSelect = document.getElementById('characterImageModelSelect');
      
      if (needsModelSelection && modelSection && modelSelect) {
        // Show the model selection section
        modelSection.style.display = 'block';
        
        // Get all text-to-image models from instance property
        const txt2imgModels = this.imageModels.filter(m => m.category === 'txt2img');
        
        // Clear existing options and populate safely using DOM methods
        modelSelect.innerHTML = '';
        txt2imgModels.forEach(model => {
          const option = document.createElement('option');
          option.value = model.id;
          option.textContent = model.name;
          modelSelect.appendChild(option);
        });
        
        // Select the first model by default
        if (txt2imgModels.length > 0) {
          modelSelect.value = txt2imgModels[0].id;
        }
      } else if (modelSection) {
        // Hide the section if not needed
        modelSection.style.display = 'none';
      }
      
      // Store result data for character creation as instance property
      this._currentCharacterImageData = {
        imageUrl: imageUrl, // Use the resolved imageUrl (supports carousel)
        prompt: result.prompt,
        modelId: result.modelId || currentModel?.id,
        // result.model contains the model name string when available
        modelName: result.model || currentModel?.name,
        needsModelSelection: needsModelSelection
      };
      
      // Show the modal
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      this.closePreview();
    } else {
      // Redirect to character creation page with image URL
      const params = new URLSearchParams({
        imageUrl: imageUrl, // Use the resolved imageUrl (supports carousel)
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
    if (!result) {
      this.showNotification('Result not found', 'error');
      return;
    }
    
    // Get the active media URL (supports both single and carousel)
    let mediaUrl;
    if (result.images && result.images.length > 0) {
      mediaUrl = result.images[result.activeImageIndex || 0];
    } else {
      mediaUrl = result.mediaUrl;
    }
    
    if (!mediaUrl) {
      this.showNotification('No image available', 'error');
      return;
    }
    
    // Check if post modal exists
    const modal = document.getElementById('createPostModal');
    if (modal) {
      // Set up the modal
      const mediaPreview = modal.querySelector('.post-media-preview');
      if (mediaPreview) {
        if (result.mode === 'image') {
          mediaPreview.innerHTML = `<img src="${mediaUrl}" alt="Post image" 
                                        style="max-height: 250px; max-width: 100%; border-radius: 8px; object-fit: contain;">`;
        } else {
          mediaPreview.innerHTML = `<video src="${mediaUrl}" controls 
                                          style="max-height: 250px; max-width: 100%; border-radius: 8px; object-fit: contain;"></video>`;
        }
      }
      
      const captionInput = modal.querySelector('#postCaption');
      if (captionInput) captionInput.value = result.prompt;
      
      // Store result data for posting
      // Store result data for posting as instance property
      this._currentPostData = {
        mediaUrl: mediaUrl,
        mediaType: result.mode,
        prompt: result.prompt
      };
      
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      this.closePreview();
    } else {
      // Redirect to posts dashboard with the image
      const params = new URLSearchParams({
        imageUrl: mediaUrl,
        caption: result.prompt
      });
      window.location.href = `/dashboard/posts?${params.toString()}`;
    }
  }

  /**
   * Generate caption for draft post using AI
   */
  async generateDraftCaption() {
    const captionInput = document.getElementById('postCaption');
    const btn = document.getElementById('generatePostCaptionBtn');
    
    if (!this._currentPostData?.prompt) {
      this.showNotification('No prompt available for caption generation', 'warning');
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
          prompt: this._currentPostData.prompt,
          platform: 'general',
          style: 'engaging',
          mediaType: this._currentPostData.mediaType
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.caption) {
        captionInput.value = data.caption;
        this.showNotification('Caption generated!', 'success');
      } else {
        throw new Error(data.error || 'Failed to generate caption');
      }
    } catch (error) {
      console.error('[GenerationDashboard] Error generating caption:', error);
      this.showNotification('Failed to generate caption', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-magic me-1"></i>Generate Caption with AI';
      captionInput.disabled = false;
    }
  }

  /**
   * Confirm and save draft post
   */
  async confirmCreatePost() {
    if (!this._currentPostData) {
      this.showNotification('No post data available', 'error');
      return;
    }
    
    const caption = document.getElementById('postCaption').value;
    const btn = document.getElementById('confirmCreatePostBtn');
    
    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving...';
    
    try {
      const response = await fetch('/api/posts/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: this._currentPostData.mediaUrl,
          videoUrl: this._currentPostData.mediaType === 'video' ? this._currentPostData.mediaUrl : undefined,
          prompt: this._currentPostData.prompt,
          model: 'generation-dashboard',
          generateCaption: !caption, // Generate caption if not provided
          caption: caption || undefined,
          mediaType: this._currentPostData.mediaType
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showNotification('Draft post saved!', 'success');
        
        // Update button to "Go to My Posts"
        btn.textContent = '';
        btn.innerHTML = '<i class="bi bi-file-earmark-check me-1"></i>Go to My Posts';
        btn.disabled = false;
        btn.onclick = () => this.goToMyPosts();
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
        
        // Disable caption input and generate button
        document.getElementById('postCaption').disabled = true;
        document.getElementById('generatePostCaptionBtn').disabled = true;
      } else {
        throw new Error(data.error || 'Failed to save draft');
      }
    } catch (error) {
      console.error('[GenerationDashboard] Error saving draft:', error);
      this.showNotification('Failed to save draft: ' + error.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check me-1"></i>Save as Draft';
    }
  }

  /**
   * Navigate to My Posts page
   */
  goToMyPosts() {
    window.location.href = '/dashboard/posts';
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
    
    // Get the selected text-to-image model if the section is visible
    let finalModelId = imageData.modelId;
    let finalModelName = imageData.modelName;
    
    if (imageData.needsModelSelection) {
      const modelSelect = document.getElementById('characterImageModelSelect');
      if (modelSelect && modelSelect.value) {
        const selectedModelId = modelSelect.value;
        const selectedModel = this.imageModels.find(m => m.id === selectedModelId);
        if (selectedModel) {
          finalModelId = selectedModel.id;
          finalModelName = selectedModel.name;
        }
      }
    }
    
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
          modelId: finalModelId,
          modelName: finalModelName
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
  
  // Expose to window for other scripts (e.g., civitai-model-search.js)
  window.genDashboard = genDashboard;
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenerationDashboard;
}
