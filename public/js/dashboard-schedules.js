/**
 * Schedules Dashboard
 * Frontend logic for viewing and managing schedules
 */

class SchedulesDashboard {
  constructor() {
    this.currentPage = 1;
    this.limit = 20;
    this.filters = {
      type: '',
      status: '',
      actionType: ''
    };
    this.scheduleModal = null;
    this.viewScheduleModal = null;
    this.testRunInProgress = false;
    this.lastTestRunImage = null;
    this.userCharacters = [];
    this.customPrompts = [];
    this.selectedCustomPromptIds = new Set();
    this.selectedCharacterId = '';
    
    this.init();
  }

  init() {
    this.setupModals();
    this.setupEventListeners();
    this.loadSchedules();
    this.loadStats();
    this.loadUserCharacters();
    this.loadCustomPrompts();
  }

  setupModals() {
    const scheduleModalEl = document.getElementById('scheduleModal');
    const viewScheduleModalEl = document.getElementById('viewScheduleModal');
    
    if (scheduleModalEl) {
      this.scheduleModal = new bootstrap.Modal(scheduleModalEl);
    }
    if (viewScheduleModalEl) {
      this.viewScheduleModal = new bootstrap.Modal(viewScheduleModalEl);
    }
  }

  setupEventListeners() {
    // Filter changes
    document.getElementById('filterType')?.addEventListener('change', (e) => {
      this.filters.type = e.target.value;
      this.currentPage = 1;
      this.loadSchedules();
    });

    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.currentPage = 1;
      this.loadSchedules();
    });

    document.getElementById('filterAction')?.addEventListener('change', (e) => {
      this.filters.actionType = e.target.value;
      this.currentPage = 1;
      this.loadSchedules();
    });

    // Reset filters
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
      this.resetFilters();
    });

    // Schedule type toggle
    document.querySelectorAll('input[name="scheduleTypeRadio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.toggleScheduleType(e.target.value);
      });
    });

    // Prompt type toggle
    document.querySelectorAll('input[name="promptTypeRadio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.togglePromptType(e.target.value);
      });
    });

    // Action type selector buttons
    document.querySelectorAll('.schedule-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectActionType(e.currentTarget.dataset.action);
      });
    });

    // Model selector button
    const modelSelectorBtn = document.getElementById('modelSelectorBtn');
    const modelDropdown = document.getElementById('modelDropdown');
    
    if (modelSelectorBtn && modelDropdown) {
      modelSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modelSelectorBtn.classList.toggle('open');
        modelDropdown.classList.toggle('show');
      });

      // Model dropdown items
      document.querySelectorAll('.model-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          this.selectModel(item.dataset.value, item.dataset.name);
          modelDropdown.classList.remove('show');
          modelSelectorBtn.classList.remove('open');
        });
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!modelSelectorBtn.contains(e.target) && !modelDropdown.contains(e.target)) {
          modelDropdown.classList.remove('show');
          modelSelectorBtn.classList.remove('open');
        }
      });

      // Select first model by default
      const firstModel = document.querySelector('.model-dropdown-item');
      if (firstModel) {
        this.selectModel(firstModel.dataset.value, firstModel.dataset.name);
      }
    }
  }

  selectActionType(actionType) {
    // Update hidden input
    document.getElementById('actionType').value = actionType;
    
    // Update button states
    document.querySelectorAll('.schedule-action-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.action === actionType);
    });
  }

  selectModel(modelId, modelName) {
    // Update hidden input
    document.getElementById('actionModel').value = modelId;
    
    // Update selector button text
    const modelNameEl = document.querySelector('.schedule-model-selector .model-name');
    if (modelNameEl) {
      modelNameEl.textContent = modelName;
    }
    
    // Update selected state in dropdown
    document.querySelectorAll('.model-dropdown-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.value === modelId);
    });
  }

  resetFilters() {
    this.filters = { type: '', status: '', actionType: '' };
    
    document.getElementById('filterType').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterAction').value = '';
    
    this.currentPage = 1;
    this.loadSchedules();
  }

  toggleScheduleType(type) {
    document.getElementById('scheduleType').value = type;
    
    const singleFields = document.getElementById('singleScheduleFields');
    const recurringFields = document.getElementById('recurringScheduleFields');
    
    if (type === 'single') {
      singleFields.style.display = 'block';
      recurringFields.style.display = 'none';
    } else {
      singleFields.style.display = 'none';
      recurringFields.style.display = 'block';
    }
  }

  togglePromptType(type) {
    const manualFields = document.getElementById('manualPromptFields');
    const customFields = document.getElementById('customPromptFields');
    
    if (type === 'manual') {
      manualFields.style.display = 'block';
      customFields.style.display = 'none';
    } else {
      manualFields.style.display = 'none';
      customFields.style.display = 'block';
    }
  }

  async loadUserCharacters() {
    try {
      const response = await fetch('/api/schedules/user-characters');
      const data = await response.json();
      
      if (data.success) {
        this.userCharacters = data.characters;
        this.populateCharacterDropdown();
      } else {
        // Show error state if API returns success: false
        this.showCharacterLoadError();
      }
    } catch (error) {
      console.error('Error loading characters:', error);
      this.showCharacterLoadError();
    }
  }

  showCharacterLoadError() {
    const container = document.getElementById('characterSelectionContainer');
    if (!container) return;
    container.innerHTML = `
      <div class="text-center py-2">
        <p class="text-muted mb-0 small">No characters found</p>
      </div>
    `;
  }

  populateCharacterDropdown() {
    const container = document.getElementById('characterSelectionContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Create "None" option
    const noneItem = document.createElement('div');
    noneItem.className = 'character-selection-item';
    noneItem.dataset.characterId = '';
    noneItem.innerHTML = `
      <div class="character-item-avatar">
        <i class="bi bi-x-circle"></i>
      </div>
      <div class="character-item-info">
        <div class="character-item-name">None</div>
      </div>
    `;
    noneItem.addEventListener('click', () => this.selectCharacter('', noneItem));
    container.appendChild(noneItem);
    
    // Add character items
    this.userCharacters.forEach(character => {
      const item = document.createElement('div');
      item.className = 'character-selection-item';
      item.dataset.characterId = character.id;
      
      // API returns imageUrl, also check thumbnail and chatImageUrl for backward compatibility
      // Use /img/avatar.png as fallback since default-thumbnail.png doesn't exist
      const thumbnail = character.imageUrl || character.thumbnail || character.chatImageUrl || '/img/avatar.png';
      const charName = this.escapeHtml(character.name || 'Unknown');
      const favoriteIcon = character.isFavorite ? '<i class="bi bi-star-fill character-favorite-icon"></i>' : '';
      
      item.innerHTML = `
        <div class="character-item-avatar">
          <img src="${thumbnail}" alt="${charName}" onerror="this.src='/img/avatar.png'">
        </div>
        <div class="character-item-info">
          <div class="character-item-name">${charName}${favoriteIcon}</div>
        </div>
      `;
      
      item.addEventListener('click', () => this.selectCharacter(character.id, item));
      container.appendChild(item);
    });
  }

  selectCharacter(characterId, itemElement) {
    // Remove active class from all items
    document.querySelectorAll('.character-selection-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to clicked item
    if (itemElement) {
      itemElement.classList.add('active');
    }
    
    // Store selected character
    this.selectedCharacterId = characterId;
  }

  async loadCustomPrompts() {
    try {
      const response = await fetch('/api/schedules/custom-prompts');
      const data = await response.json();
      
      if (data.success && data.prompts) {
        this.customPrompts = data.prompts;
        this.renderCustomPrompts();
      } else {
        console.error('Custom prompts API returned no data:', data);
        this.renderCustomPromptsError();
      }
    } catch (error) {
      console.error('Error loading custom prompts:', error);
      this.renderCustomPromptsError();
    }
  }

  renderCustomPrompts() {
    const container = document.getElementById('customPromptsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.customPrompts.length === 0) {
      container.innerHTML = `
        <div class="text-center py-3">
          <p class="text-muted mb-0">No custom prompts available</p>
        </div>
      `;
      return;
    }
    
    this.customPrompts.forEach(prompt => {
      const card = document.createElement('div');
      card.className = 'custom-prompt-card';
      card.dataset.promptId = prompt.id;
      
      // Create image element - use imagePreview which contains the prompt image
      const img = document.createElement('img');
      const imageUrl = prompt.imagePreview || '/img/image-placeholder-1.gif';
      img.src = imageUrl;
      img.alt = this.escapeHtml(prompt.title || '');
      img.onerror = () => { img.src = '/img/image-placeholder-1.gif'; };
      
      // Create overlay with title or description
      const overlay = document.createElement('div');
      overlay.className = 'prompt-overlay';
      const displayText = prompt.title || prompt.description || '';
      overlay.textContent = this.truncateText(displayText, 40);
      
      // Create badge
      const badge = document.createElement('div');
      badge.className = 'selected-badge';
      badge.innerHTML = '<i class="bi bi-check"></i>';
      
      card.appendChild(img);
      card.appendChild(overlay);
      card.appendChild(badge);
      
      card.addEventListener('click', () => {
        this.toggleCustomPromptSelection(prompt.id, card);
      });
      
      container.appendChild(card);
    });
  }

  renderCustomPromptsError() {
    const container = document.getElementById('customPromptsContainer');
    if (!container) return;
    
    container.innerHTML = `
      <div class="text-center py-3">
        <i class="bi bi-exclamation-triangle text-warning"></i>
        <p class="text-muted mb-0 mt-2">Failed to load custom prompts</p>
      </div>
    `;
  }

  toggleCustomPromptSelection(promptId, cardElement) {
    if (this.selectedCustomPromptIds.has(promptId)) {
      this.selectedCustomPromptIds.delete(promptId);
      cardElement.classList.remove('selected');
    } else {
      this.selectedCustomPromptIds.add(promptId);
      cardElement.classList.add('selected');
    }
    
    this.updateSelectedPromptsInfo();
  }

  updateSelectedPromptsInfo() {
    const info = document.getElementById('selectedPromptsInfo');
    const count = document.getElementById('selectedPromptsCount');
    
    if (!info || !count) return;
    
    count.textContent = this.selectedCustomPromptIds.size;
    info.style.display = this.selectedCustomPromptIds.size > 0 ? 'block' : 'none';
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  async loadSchedules() {
    const grid = document.getElementById('schedulesGrid');
    const spinner = document.getElementById('loadingSpinner');
    const noSchedules = document.getElementById('noSchedules');
    
    if (!grid) return;
    
    spinner.style.display = 'block';
    grid.innerHTML = '';
    noSchedules.style.display = 'none';

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.limit,
        ...(this.filters.type && { type: this.filters.type }),
        ...(this.filters.status && { status: this.filters.status }),
        ...(this.filters.actionType && { actionType: this.filters.actionType })
      });

      const response = await fetch(`/api/schedules?${params}`);
      const data = await response.json();

      spinner.style.display = 'none';

      if (!data.success) {
        throw new Error(data.error || 'Failed to load schedules');
      }

      if (data.schedules.length === 0) {
        noSchedules.style.display = 'block';
        return;
      }

      // Render schedules
      data.schedules.forEach(schedule => {
        grid.appendChild(this.createScheduleCard(schedule));
      });

      // Render pagination
      this.renderPagination(data.pagination);

    } catch (error) {
      console.error('Error loading schedules:', error);
      spinner.style.display = 'none';
      this.showNotification('Failed to load schedules', 'error');
    }
  }

  createScheduleCard(schedule) {
    const card = document.createElement('div');
    card.className = 'col-sm-6 col-lg-4';
    card.dataset.scheduleId = schedule._id;

    const isRecurring = schedule.type === 'recurring';
    const statusColor = this.getStatusColor(schedule.status);
    const actionIcon = this.getActionIcon(schedule.actionType);
    
    card.innerHTML = `
      <div class="card bg-dark border-secondary h-100 schedule-card">
        <div class="card-header bg-${isRecurring ? 'warning' : 'primary'} bg-opacity-25 d-flex justify-content-between align-items-center">
          <span class="badge bg-${isRecurring ? 'warning' : 'primary'}">
            <i class="bi bi-${isRecurring ? 'arrow-repeat' : 'calendar-event'} me-1"></i>
            ${isRecurring ? 'Recurring' : 'Single'}
          </span>
          <span class="badge bg-${statusColor}">
            ${this.capitalizeFirst(schedule.status)}
          </span>
        </div>
        <div class="card-body">
          <h6 class="card-title text-white mb-2">
            <i class="bi ${actionIcon} me-2"></i>
            ${schedule.description || this.formatActionType(schedule.actionType)}
          </h6>
          
          ${isRecurring ? `
            <p class="text-info small mb-2">
              <i class="bi bi-clock me-1"></i>
              Cron: <code>${schedule.cronExpression}</code>
            </p>
            <p class="text-muted small mb-2">
              <i class="bi bi-play-circle me-1"></i>
              Runs: ${schedule.executionCount || 0}${schedule.maxExecutions ? '/' + schedule.maxExecutions : ''}
            </p>
            ${schedule.nextExecutionAt ? `
              <p class="text-warning small mb-2">
                <i class="bi bi-arrow-right me-1"></i>
                Next: ${this.formatDate(schedule.nextExecutionAt)}
              </p>
            ` : ''}
          ` : `
            <p class="text-warning small mb-2">
              <i class="bi bi-calendar me-1"></i>
              Scheduled: ${this.formatDate(schedule.scheduledFor)}
            </p>
          `}
          
          ${schedule.lastExecutedAt ? `
            <p class="text-success small mb-2">
              <i class="bi bi-check me-1"></i>
              Last run: ${this.formatDate(schedule.lastExecutedAt)}
            </p>
          ` : ''}
          
          <p class="text-muted small mb-0">
            <i class="bi bi-calendar-plus me-1"></i>
            Created: ${this.formatDate(schedule.createdAt)}
          </p>
        </div>
        <div class="card-footer bg-transparent border-secondary">
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-outline-primary" onclick="schedulesDashboard.viewSchedule('${schedule._id}')" title="View">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-info" onclick="schedulesDashboard.editSchedule('${schedule._id}')" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            ${schedule.status === 'active' ? `
              <button class="btn btn-sm btn-outline-warning" onclick="schedulesDashboard.pauseSchedule('${schedule._id}')" title="Pause">
                <i class="bi bi-pause"></i>
              </button>
            ` : ''}
            ${schedule.status === 'paused' ? `
              <button class="btn btn-sm btn-outline-success" onclick="schedulesDashboard.resumeSchedule('${schedule._id}')" title="Resume">
                <i class="bi bi-play"></i>
              </button>
            ` : ''}
            ${schedule.status === 'pending' ? `
              <button class="btn btn-sm btn-outline-secondary" onclick="schedulesDashboard.cancelSchedule('${schedule._id}')" title="Cancel">
                <i class="bi bi-x-circle"></i>
              </button>
            ` : ''}
            <button class="btn btn-sm btn-outline-danger" onclick="schedulesDashboard.deleteSchedule('${schedule._id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    return card;
  }

  async loadStats() {
    try {
      const response = await fetch('/api/schedules/stats');
      const data = await response.json();

      if (!data.success) return;

      const stats = data.stats;
      document.getElementById('totalSchedules').textContent = stats.total || 0;
      document.getElementById('activeSchedules').textContent = (stats.active || 0) + (stats.pending || 0);
      document.getElementById('pausedSchedules').textContent = stats.paused || 0;
      document.getElementById('completedSchedules').textContent = stats.completed || 0;

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  openCreateModal(type = 'single') {
    // Reset form
    document.getElementById('scheduleId').value = '';
    document.getElementById('scheduleDescription').value = '';
    document.getElementById('actionPrompt').value = '';
    
    // Reset action type to generate_image
    this.selectActionType('generate_image');
    
    // Reset model to first available or flux-2-flex
    const firstModel = document.querySelector('.model-dropdown-item');
    if (firstModel) {
      this.selectModel(firstModel.dataset.value, firstModel.dataset.name);
    } else {
      document.getElementById('actionModel').value = 'flux-2-flex';
    }
    
    // Reset character selection
    this.selectedCharacterId = '';
    document.querySelectorAll('.character-selection-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Select the "None" option first
    const noneItem = document.querySelector('.character-selection-item[data-character-id=""]');
    if (noneItem) {
      noneItem.classList.add('active');
    }
    
    document.getElementById('publishInstagram').checked = false;
    document.getElementById('publishTwitter').checked = false;
    
    // Reset prompt type to manual
    document.getElementById('promptTypeManual').checked = true;
    this.togglePromptType('manual');
    
    // Clear custom prompt selections
    this.selectedCustomPromptIds.clear();
    document.querySelectorAll('.custom-prompt-card').forEach(card => {
      card.classList.remove('selected');
    });
    this.updateSelectedPromptsInfo();
    
    // Set default schedule time (tomorrow at 9 AM)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    document.getElementById('scheduledFor').value = tomorrow.toISOString().slice(0, 16);
    
    // Recurring fields
    document.getElementById('cronExpression').value = '0 9 * * *';
    document.getElementById('maxExecutions').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('mutationEnabled').checked = false;
    
    // Clear test run preview
    this.clearTestRun();
    
    // Set type
    document.getElementById(`type${type === 'single' ? 'Single' : 'Recurring'}`).checked = true;
    this.toggleScheduleType(type);
    
    // Update modal title
    document.getElementById('scheduleModalTitle').innerHTML = `
      <i class="bi bi-calendar-plus me-2"></i>Create ${type === 'single' ? 'Schedule' : 'Recurring Job'}
    `;
    
    this.scheduleModal?.show();
  }

  async editSchedule(scheduleId) {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load schedule');
      }

      const schedule = data.schedule;
      
      // Populate form
      document.getElementById('scheduleId').value = schedule._id;
      document.getElementById('scheduleDescription').value = schedule.description || '';
      document.getElementById('actionPrompt').value = schedule.actionData?.prompt || '';
      
      // Update action type selector
      this.selectActionType(schedule.actionType);
      
      // Update model selector
      const modelId = schedule.actionData?.model || 'flux-2-flex';
      const modelItem = document.querySelector(`.model-dropdown-item[data-value="${modelId}"]`);
      if (modelItem) {
        this.selectModel(modelId, modelItem.dataset.name);
      } else {
        document.getElementById('actionModel').value = modelId;
      }
      
      document.getElementById('actionCharacter').value = schedule.actionData?.characterId || '';
      
      // Set prompt type based on whether custom prompts are used
      if (schedule.actionData?.useCustomPrompts && schedule.actionData?.customPromptIds?.length > 0) {
        document.getElementById('promptTypeCustom').checked = true;
        this.togglePromptType('custom');
        
        // Restore selected custom prompts
        this.selectedCustomPromptIds.clear();
        schedule.actionData.customPromptIds.forEach(id => {
          this.selectedCustomPromptIds.add(id);
        });
        
        // Update UI
        document.querySelectorAll('.custom-prompt-card').forEach(card => {
          const promptId = card.dataset.promptId;
          if (this.selectedCustomPromptIds.has(promptId)) {
            card.classList.add('selected');
          }
        });
        this.updateSelectedPromptsInfo();
      } else {
        document.getElementById('promptTypeManual').checked = true;
        this.togglePromptType('manual');
      }
      
      // Set type
      const isRecurring = schedule.type === 'recurring';
      document.getElementById(`type${isRecurring ? 'Recurring' : 'Single'}`).checked = true;
      this.toggleScheduleType(schedule.type);
      
      if (isRecurring) {
        document.getElementById('cronExpression').value = schedule.cronExpression || '';
        document.getElementById('maxExecutions').value = schedule.maxExecutions || '';
        document.getElementById('endDate').value = schedule.endDate ? schedule.endDate.split('T')[0] : '';
        document.getElementById('mutationEnabled').checked = schedule.mutationEnabled || false;
      } else {
        document.getElementById('scheduledFor').value = schedule.scheduledFor ? 
          new Date(schedule.scheduledFor).toISOString().slice(0, 16) : '';
      }
      
      // Clear test run preview
      this.clearTestRun();
      
      // Update modal title
      document.getElementById('scheduleModalTitle').innerHTML = `
        <i class="bi bi-pencil me-2"></i>Edit Schedule
      `;
      
      this.scheduleModal?.show();

    } catch (error) {
      console.error('Error loading schedule:', error);
      this.showNotification('Failed to load schedule', 'error');
    }
  }

  async viewSchedule(scheduleId) {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load schedule');
      }

      const schedule = data.schedule;
      const isRecurring = schedule.type === 'recurring';
      
      const bodyHtml = `
        <div class="row">
          <div class="col-md-6">
            <div class="mb-3">
              <label class="form-label text-muted small">Type</label>
              <p class="mb-0">
                <span class="badge bg-${isRecurring ? 'warning' : 'primary'}">
                  ${isRecurring ? 'Recurring' : 'Single'}
                </span>
              </p>
            </div>
            <div class="mb-3">
              <label class="form-label text-muted small">Status</label>
              <p class="mb-0">
                <span class="badge bg-${this.getStatusColor(schedule.status)}">
                  ${this.capitalizeFirst(schedule.status)}
                </span>
              </p>
            </div>
            <div class="mb-3">
              <label class="form-label text-muted small">Action</label>
              <p class="mb-0">${this.formatActionType(schedule.actionType)}</p>
            </div>
            ${schedule.description ? `
              <div class="mb-3">
                <label class="form-label text-muted small">Description</label>
                <p class="mb-0">${schedule.description}</p>
              </div>
            ` : ''}
          </div>
          <div class="col-md-6">
            ${isRecurring ? `
              <div class="mb-3">
                <label class="form-label text-muted small">Cron Expression</label>
                <p class="mb-0"><code>${schedule.cronExpression}</code></p>
              </div>
              <div class="mb-3">
                <label class="form-label text-muted small">Executions</label>
                <p class="mb-0">${schedule.executionCount || 0}${schedule.maxExecutions ? ' / ' + schedule.maxExecutions : ''}</p>
              </div>
              ${schedule.nextExecutionAt ? `
                <div class="mb-3">
                  <label class="form-label text-muted small">Next Execution</label>
                  <p class="mb-0 text-warning">${this.formatDate(schedule.nextExecutionAt)}</p>
                </div>
              ` : ''}
            ` : `
              <div class="mb-3">
                <label class="form-label text-muted small">Scheduled For</label>
                <p class="mb-0 text-warning">${this.formatDate(schedule.scheduledFor)}</p>
              </div>
            `}
            ${schedule.lastExecutedAt ? `
              <div class="mb-3">
                <label class="form-label text-muted small">Last Executed</label>
                <p class="mb-0 text-success">${this.formatDate(schedule.lastExecutedAt)}</p>
              </div>
            ` : ''}
            <div class="mb-3">
              <label class="form-label text-muted small">Created</label>
              <p class="mb-0">${this.formatDate(schedule.createdAt)}</p>
            </div>
          </div>
        </div>
        
        ${schedule.actionData?.prompt ? `
          <div class="mt-3 pt-3 border-top border-secondary">
            <label class="form-label text-muted small">Prompt</label>
            <p class="mb-0 text-secondary small" style="white-space: pre-wrap;">${schedule.actionData.prompt}</p>
          </div>
        ` : ''}
        
        ${schedule.generatedPostIds && schedule.generatedPostIds.length > 0 ? `
          <div class="mt-3 pt-3 border-top border-secondary">
            <label class="form-label text-muted small">Generated Posts</label>
            <p class="mb-0">${schedule.generatedPostIds.length} posts created</p>
            <a href="/dashboard/posts" class="btn btn-sm btn-outline-primary mt-2">View Posts</a>
          </div>
        ` : ''}
        
        ${schedule.error ? `
          <div class="mt-3 pt-3 border-top border-danger">
            <label class="form-label text-danger small">Last Error</label>
            <p class="mb-0 text-danger small">${schedule.error}</p>
          </div>
        ` : ''}
      `;

      document.getElementById('viewScheduleBody').innerHTML = bodyHtml;
      
      // Update footer with actions
      const footerHtml = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-info" onclick="schedulesDashboard.editSchedule('${schedule._id}')">
          <i class="bi bi-pencil me-1"></i>Edit
        </button>
        ${schedule.status === 'active' ? `
          <button type="button" class="btn btn-warning" onclick="schedulesDashboard.pauseSchedule('${schedule._id}')">
            <i class="bi bi-pause me-1"></i>Pause
          </button>
        ` : ''}
        ${schedule.status === 'paused' ? `
          <button type="button" class="btn btn-success" onclick="schedulesDashboard.resumeSchedule('${schedule._id}')">
            <i class="bi bi-play me-1"></i>Resume
          </button>
        ` : ''}
      `;
      
      document.getElementById('viewScheduleFooter').innerHTML = footerHtml;
      
      this.viewScheduleModal?.show();

    } catch (error) {
      console.error('Error viewing schedule:', error);
      this.showNotification('Failed to load schedule details', 'error');
    }
  }

  async saveSchedule() {
    const scheduleId = document.getElementById('scheduleId').value;
    const type = document.getElementById('scheduleType').value;
    const description = document.getElementById('scheduleDescription').value;
    const actionType = document.getElementById('actionType').value;
    const model = document.getElementById('actionModel').value;
    
    // Get prompt type
    const promptType = document.querySelector('input[name="promptTypeRadio"]:checked').value;
    
    // Get character selection (from the new list-based selector)
    const characterId = this.selectedCharacterId || null;
    
    // Collect social platforms
    const socialPlatforms = [];
    if (document.getElementById('publishInstagram').checked) socialPlatforms.push('instagram');
    if (document.getElementById('publishTwitter').checked) socialPlatforms.push('twitter');
    
    const scheduleData = {
      type,
      actionType,
      description,
      actionData: {
        model,
        socialPlatforms,
        autoPublish: socialPlatforms.length > 0,
        characterId: characterId
      }
    };

    // Handle prompt based on type
    if (promptType === 'manual') {
      const prompt = document.getElementById('actionPrompt').value;
      scheduleData.actionData.prompt = prompt;
      scheduleData.actionData.useCustomPrompts = false;
    } else {
      // Custom prompts mode
      if (this.selectedCustomPromptIds.size === 0) {
        this.showNotification('Please select at least one custom prompt', 'warning');
        return;
      }
      scheduleData.actionData.useCustomPrompts = true;
      scheduleData.actionData.customPromptIds = Array.from(this.selectedCustomPromptIds);
      scheduleData.actionData.prompt = ''; // Optional: user can still provide additional context
    }

    if (type === 'single') {
      const scheduledFor = document.getElementById('scheduledFor').value;
      if (!scheduledFor) {
        this.showNotification('Please select a date and time', 'warning');
        return;
      }
      scheduleData.scheduledFor = new Date(scheduledFor).toISOString();
    } else {
      const cronExpression = document.getElementById('cronExpression').value;
      if (!cronExpression) {
        this.showNotification('Please enter a cron expression', 'warning');
        return;
      }
      scheduleData.cronExpression = cronExpression;
      
      const maxExecutions = document.getElementById('maxExecutions').value;
      const endDate = document.getElementById('endDate').value;
      const mutationEnabled = document.getElementById('mutationEnabled').checked;
      
      if (maxExecutions) scheduleData.maxExecutions = parseInt(maxExecutions);
      if (endDate) scheduleData.endDate = endDate;
      scheduleData.mutationEnabled = mutationEnabled;
    }

    try {
      let response;
      if (scheduleId) {
        // Update existing
        response = await fetch(`/api/schedules/${scheduleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData)
        });
      } else {
        // Create new
        response = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleData)
        });
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save schedule');
      }

      this.showNotification(scheduleId ? 'Schedule updated!' : 'Schedule created!', 'success');
      this.scheduleModal?.hide();
      this.loadSchedules();
      this.loadStats();

    } catch (error) {
      console.error('Error saving schedule:', error);
      this.showNotification('Failed to save schedule: ' + error.message, 'error');
    }
  }

  async pauseSchedule(scheduleId) {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/pause`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to pause schedule');
      }

      this.showNotification('Schedule paused', 'success');
      this.viewScheduleModal?.hide();
      this.loadSchedules();
      this.loadStats();

    } catch (error) {
      console.error('Error pausing schedule:', error);
      this.showNotification('Failed to pause schedule', 'error');
    }
  }

  async resumeSchedule(scheduleId) {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/resume`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to resume schedule');
      }

      this.showNotification('Schedule resumed', 'success');
      this.viewScheduleModal?.hide();
      this.loadSchedules();
      this.loadStats();

    } catch (error) {
      console.error('Error resuming schedule:', error);
      this.showNotification('Failed to resume schedule', 'error');
    }
  }

  async cancelSchedule(scheduleId) {
    if (!confirm('Cancel this schedule?')) return;

    try {
      const response = await fetch(`/api/schedules/${scheduleId}/cancel`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel schedule');
      }

      this.showNotification('Schedule cancelled', 'success');
      this.loadSchedules();
      this.loadStats();

    } catch (error) {
      console.error('Error cancelling schedule:', error);
      this.showNotification('Failed to cancel schedule', 'error');
    }
  }

  async deleteSchedule(scheduleId) {
    if (!confirm('Delete this schedule permanently?')) return;

    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete schedule');
      }

      this.showNotification('Schedule deleted', 'success');
      this.loadSchedules();
      this.loadStats();

    } catch (error) {
      console.error('Error deleting schedule:', error);
      this.showNotification('Failed to delete schedule', 'error');
    }
  }

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container) return;

    container.innerHTML = '';

    if (pagination.totalPages <= 1) return;

    if (pagination.page > 1) {
      const prev = document.createElement('button');
      prev.className = 'btn btn-outline-primary';
      prev.innerHTML = '<i class="bi bi-chevron-left"></i> Previous';
      prev.onclick = () => {
        this.currentPage--;
        this.loadSchedules();
      };
      container.appendChild(prev);
    }

    const pageInfo = document.createElement('span');
    pageInfo.className = 'mx-3 text-white align-self-center';
    pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    container.appendChild(pageInfo);

    if (pagination.page < pagination.totalPages) {
      const next = document.createElement('button');
      next.className = 'btn btn-outline-primary';
      next.innerHTML = 'Next <i class="bi bi-chevron-right"></i>';
      next.onclick = () => {
        this.currentPage++;
        this.loadSchedules();
      };
      container.appendChild(next);
    }
  }

  getStatusColor(status) {
    const colors = {
      'pending': 'secondary',
      'active': 'success',
      'paused': 'warning',
      'completed': 'info',
      'failed': 'danger',
      'cancelled': 'dark'
    };
    return colors[status] || 'secondary';
  }

  getActionIcon(actionType) {
    const icons = {
      'generate_image': 'bi-image',
      'generate_video': 'bi-film',
      'publish_post': 'bi-send'
    };
    return icons[actionType] || 'bi-gear';
  }

  formatActionType(actionType) {
    const types = {
      'generate_image': 'Generate Image',
      'generate_video': 'Generate Video',
      'publish_post': 'Publish Post'
    };
    return types[actionType] || actionType;
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  showNotification(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    
    const bgClass = type === 'error' ? 'bg-danger' : type === 'success' ? 'bg-success' : type === 'warning' ? 'bg-warning' : 'bg-info';
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white ${bgClass} border-0`;
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
      container.style.zIndex = '1100';
      document.body.appendChild(container);
    }
    
    container.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    toast.addEventListener('hidden.bs.toast', () => toast.remove());
  }

  /**
   * Run a test generation with current form settings
   */
  async runTestGeneration() {
    if (this.testRunInProgress) {
      this.showNotification('Test already in progress', 'warning');
      return;
    }

    const prompt = document.getElementById('actionPrompt').value.trim();
    const model = document.getElementById('actionModel').value;
    const actionType = document.getElementById('actionType').value;
    
    // Check if using custom prompts
    const promptType = document.querySelector('input[name="promptTypeRadio"]:checked')?.value;
    const useCustomPrompts = promptType === 'custom';
    const customPromptIds = useCustomPrompts ? Array.from(this.selectedCustomPromptIds) : [];

    // Validate: either manual prompt or custom prompts must be provided
    if (!useCustomPrompts && !prompt) {
      this.showNotification('Please enter a prompt first', 'warning');
      return;
    }
    
    if (useCustomPrompts && customPromptIds.length === 0) {
      this.showNotification('Please select at least one custom prompt', 'warning');
      return;
    }

    if (actionType !== 'generate_image') {
      this.showNotification('Test run only supports image generation', 'info');
      return;
    }

    // Show loading state
    this.testRunInProgress = true;
    const testRunBtn = document.getElementById('testRunBtn');
    const testRunPreview = document.getElementById('testRunPreview');
    const testRunLoading = document.getElementById('testRunLoading');
    const testRunResult = document.getElementById('testRunResult');
    const testRunError = document.getElementById('testRunError');

    testRunBtn.disabled = true;
    testRunBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Running...';
    testRunPreview.style.display = 'block';
    testRunLoading.style.display = 'block';
    testRunResult.style.display = 'none';
    testRunError.style.display = 'none';

    try {
      const response = await fetch('/api/schedules/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model,
          actionType,
          useCustomPrompts,
          customPromptIds
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Test run failed');
      }

      // Show result
      testRunLoading.style.display = 'none';
      testRunResult.style.display = 'block';
      
      const testRunImage = document.getElementById('testRunImage');
      testRunImage.src = data.imageUrl;
      this.lastTestRunImage = data.imageUrl;

      const testRunInfo = document.getElementById('testRunInfo');
      const seconds = (data.generationTimeMs / 1000).toFixed(1);
      testRunInfo.innerHTML = `
        <i class="bi bi-clock me-1"></i>${seconds}s · 
        <i class="bi bi-coin me-1"></i>${data.pointsUsed} pts · 
        <span class="text-success">Saved to Posts</span>
      `;

      this.showNotification('Test image generated successfully!', 'success');

    } catch (error) {
      console.error('Test run error:', error);
      testRunLoading.style.display = 'none';
      testRunError.style.display = 'block';
      document.getElementById('testRunErrorMsg').textContent = error.message;
      this.showNotification('Test run failed: ' + error.message, 'error');
    } finally {
      this.testRunInProgress = false;
      testRunBtn.disabled = false;
      testRunBtn.innerHTML = '<i class="bi bi-play-circle me-1"></i>Test Run';
    }
  }

  /**
   * Clear the test run preview
   */
  clearTestRun() {
    const testRunPreview = document.getElementById('testRunPreview');
    const testRunLoading = document.getElementById('testRunLoading');
    const testRunResult = document.getElementById('testRunResult');
    const testRunError = document.getElementById('testRunError');

    testRunPreview.style.display = 'none';
    testRunLoading.style.display = 'none';
    testRunResult.style.display = 'none';
    testRunError.style.display = 'none';
    this.lastTestRunImage = null;
  }

  /**
   * Expand test image in a larger modal
   */
  expandTestImage() {
    if (!this.lastTestRunImage) return;

    // Create a fullscreen modal for the image
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary">
          <div class="modal-header border-secondary">
            <h5 class="modal-title text-white">
              <i class="bi bi-image me-2"></i>Test Run Result
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center p-2">
            <img src="${this.lastTestRunImage}" alt="Test Result" class="img-fluid" style="max-height: 70vh;">
          </div>
          <div class="modal-footer border-secondary">
            <a href="${this.lastTestRunImage}" target="_blank" class="btn btn-outline-info">
              <i class="bi bi-box-arrow-up-right me-1"></i>Open Full Size
            </a>
            <a href="/dashboard/posts" class="btn btn-outline-primary">
              <i class="bi bi-collection me-1"></i>View in Posts
            </a>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
      modal.remove();
    });
  }
}

// Helper function for cron presets
function setCronPreset(expression) {
  document.getElementById('cronExpression').value = expression;
}

// Initialize dashboard
let schedulesDashboard;
document.addEventListener('DOMContentLoaded', () => {
  schedulesDashboard = new SchedulesDashboard();
});
