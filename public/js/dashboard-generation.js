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
        negativePrompt: ''
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
  }
  
  selectDefaultModel() {
    const models = this.state.mode === 'image' ? this.imageModels : this.videoModels;
    if (models.length > 0) {
      this.state.selectedModel = models[0];
      this.updateModelDisplay();
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
    const imageTools = ['upload-base', 'upload-face', 'aspect-ratio', 'style'];
    const videoTools = ['upload-base', 'upload-face', 'duration', 'upload-video'];
    
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
      this.closeAllOverlays();
      console.log('[GenerationDashboard] Model selected:', model.name);
    }
  }
  
  updateModelDisplay() {
    if (this.elements.modelNameDisplay && this.state.selectedModel) {
      this.elements.modelNameDisplay.textContent = this.state.selectedModel.name;
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
    const canGenerate = hasPrompt && !this.state.isGenerating && this.hasEnoughPoints();
    
    if (this.elements.submitBtn) {
      this.elements.submitBtn.disabled = !canGenerate;
    }
  }
  
  // ============================================================================
  // GENERATION
  // ============================================================================
  
  async handleGenerate() {
    const prompt = this.elements.promptInput?.value.trim();
    
    if (!prompt || this.state.isGenerating) return;
    if (!this.hasEnoughPoints()) {
      this.showNotification('Insufficient points for generation', 'error');
      return;
    }
    if (!this.state.selectedModel) {
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
    const payload = {
      prompt,
      models: [this.state.selectedModel.id]
    };
    
    if (this.state.mode === 'image') {
      payload.size = this.aspectRatioToSize(this.state.tools.aspectRatio);
      if (this.state.tools.style) payload.style = this.state.tools.style;
      if (this.state.tools.negativePrompt) payload.negativePrompt = this.state.tools.negativePrompt;
      if (this.state.tools.baseImage) payload.baseImage = this.state.tools.baseImage;
      if (this.state.tools.faceImage) payload.faceImage = this.state.tools.faceImage;
      if (this.state.tools.targetImage) payload.targetImage = this.state.tools.targetImage;
    } else {
      payload.duration = this.state.tools.duration;
      if (this.state.tools.baseImage) payload.baseImage = this.state.tools.baseImage;
      if (this.state.tools.faceImage) payload.faceImage = this.state.tools.faceImage;
      if (this.state.tools.baseVideo) payload.baseVideo = this.state.tools.baseVideo;
    }
    
    return payload;
  }
  
  aspectRatioToSize(ratio) {
    const sizeMap = {
      '1:1': '1024x1024',
      '16:9': '1280x720',
      '9:16': '720x1280',
      '4:3': '1024x768',
      '3:4': '768x1024'
    };
    return sizeMap[ratio] || '1024x1024';
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
      ? '/dashboard/image/check'
      : '/dashboard/video/check';
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${pollEndpoint}?taskId=${taskId}`);
        const data = await response.json();
        
        if (data.status === 'completed' || data.status === 'TASK_STATUS_SUCCEED') {
          clearInterval(interval);
          this.pollIntervals.delete(taskId);
          this.updateResultWithData(result.id, {
            status: 'completed',
            imageUrl: data.imageUrl || data.images?.[0]?.url,
            videoUrl: data.videoUrl || data.videos?.[0]?.url
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
  
  handleToolClick(e) {
    const btn = e.currentTarget;
    const tool = btn.dataset.tool;
    
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
      const toolBtn = document.querySelector(`[data-tool="upload-${type.replace('Image', '').replace('Video', '')}"]`);
      if (toolBtn) {
        toolBtn.classList.add('has-content');
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
    
    const toolBtn = document.querySelector(`[data-tool="upload-${type.replace('Image', '').replace('Video', '')}"]`);
    if (toolBtn) {
      toolBtn.classList.remove('has-content');
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
    
    // Bind events
    container.querySelectorAll('.gen-segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const setting = btn.dataset.setting;
        const value = btn.dataset.value;
        this.state.tools[setting] = value;
        
        // Update UI
        btn.parentElement.querySelectorAll('.gen-segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
    
    const isImage = result.mode === 'image';
    content.innerHTML = isImage
      ? `<img src="${result.mediaUrl}" alt="Preview">`
      : `<video src="${result.mediaUrl}" controls autoplay></video>`;
    
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
  
  updateCostDisplay() {
    if (!this.elements.costDisplay) return;
    
    const cost = this.state.mode === 'image' 
      ? this.state.imageCostPerUnit 
      : this.state.videoCostPerUnit;
    
    const hasEnough = this.state.userPoints >= cost;
    
    this.elements.costDisplay.classList.toggle('insufficient', !hasEnough);
    
    const costValue = this.elements.costDisplay.querySelector('.cost-value');
    if (costValue) {
      costValue.innerHTML = `<i class="bi bi-coin"></i> ${cost} points`;
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
    const cost = this.state.mode === 'image' 
      ? this.state.imageCostPerUnit 
      : this.state.videoCostPerUnit;
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
