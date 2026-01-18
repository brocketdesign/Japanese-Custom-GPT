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
    
    this.init();
  }

  init() {
    this.setupModals();
    this.setupEventListeners();
    this.loadSchedules();
    this.loadStats();
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
    document.getElementById('actionType').value = 'generate_image';
    document.getElementById('actionPrompt').value = '';
    document.getElementById('actionModel').value = 'flux-schnell';
    document.getElementById('publishInstagram').checked = false;
    document.getElementById('publishTwitter').checked = false;
    
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
      document.getElementById('actionType').value = schedule.actionType;
      document.getElementById('actionPrompt').value = schedule.actionData?.prompt || '';
      document.getElementById('actionModel').value = schedule.actionData?.model || 'flux-schnell';
      
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
    const prompt = document.getElementById('actionPrompt').value;
    const model = document.getElementById('actionModel').value;
    
    // Collect social platforms
    const socialPlatforms = [];
    if (document.getElementById('publishInstagram').checked) socialPlatforms.push('instagram');
    if (document.getElementById('publishTwitter').checked) socialPlatforms.push('twitter');
    
    const scheduleData = {
      type,
      actionType,
      description,
      actionData: {
        prompt,
        model,
        socialPlatforms,
        autoPublish: socialPlatforms.length > 0
      }
    };

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
