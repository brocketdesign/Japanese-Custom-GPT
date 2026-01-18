/**
 * My Posts Dashboard
 * Frontend logic for viewing and managing posts (unified posts + chat posts)
 */

class PostsDashboard {
  constructor() {
    this.currentPage = 1;
    this.limit = 20;
    this.filters = {
      type: '',
      status: '',
      source: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    this.currentPost = null;
    this.postModal = null;
    this.scheduleModal = null;
    this.editCaptionModal = null;
    
    this.init();
  }

  init() {
    this.setupModals();
    this.setupEventListeners();
    this.loadPosts();
    this.loadStats();
  }

  setupModals() {
    // Initialize Bootstrap modals
    const postModalEl = document.getElementById('postModal');
    const scheduleModalEl = document.getElementById('scheduleModal');
    const editCaptionModalEl = document.getElementById('editCaptionModal');
    
    if (postModalEl) {
      this.postModal = new bootstrap.Modal(postModalEl);
    }
    if (scheduleModalEl) {
      this.scheduleModal = new bootstrap.Modal(scheduleModalEl);
    }
    if (editCaptionModalEl) {
      this.editCaptionModal = new bootstrap.Modal(editCaptionModalEl);
    }
    
    // Load connected accounts for schedule modal
    this.loadConnectedAccounts();
  }
  
  async loadConnectedAccounts() {
    try {
      const response = await fetch('/api/social/status');
      const data = await response.json();
      
      this.connectedAccounts = data.connections || [];
      this.renderPlatformButtons();
    } catch (error) {
      console.error('Error loading connected accounts:', error);
      this.connectedAccounts = [];
      this.renderPlatformButtons();
    }
  }
  
  renderPlatformButtons() {
    const container = document.getElementById('connectedPlatformsContainer');
    const noAccountsMsg = document.getElementById('noPlatformsMessage');
    
    if (!container) return;
    
    if (!this.connectedAccounts || this.connectedAccounts.length === 0) {
      container.innerHTML = '';
      if (noAccountsMsg) noAccountsMsg.style.display = 'block';
      return;
    }
    
    if (noAccountsMsg) noAccountsMsg.style.display = 'none';
    
    const platformIcons = {
      instagram: 'bi-instagram',
      twitter: 'bi-twitter-x'
    };
    
    const platformColors = {
      instagram: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
      twitter: '#000'
    };
    
    container.innerHTML = this.connectedAccounts.map(account => `
      <button type="button" 
              class="sns-platform-btn" 
              data-platform="${account.platform}"
              data-account-id="${account.id}">
        <i class="bi ${platformIcons[account.platform] || 'bi-share'}"></i>
        <span>@${account.username}</span>
      </button>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.sns-platform-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
      });
    });
  }
  
  getSelectedPlatforms() {
    const container = document.getElementById('connectedPlatformsContainer');
    if (!container) return [];
    
    const selectedButtons = container.querySelectorAll('.sns-platform-btn.active');
    return Array.from(selectedButtons).map(btn => btn.dataset.platform);
  }

  setupEventListeners() {
    // Filter changes
    document.getElementById('filterType')?.addEventListener('change', (e) => {
      this.filters.type = e.target.value;
      this.currentPage = 1;
      this.loadPosts();
    });

    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.currentPage = 1;
      this.loadPosts();
    });

    document.getElementById('filterSource')?.addEventListener('change', (e) => {
      this.filters.source = e.target.value;
      this.currentPage = 1;
      this.loadPosts();
    });

    document.getElementById('filterSort')?.addEventListener('change', (e) => {
      this.filters.sortBy = e.target.value;
      this.currentPage = 1;
      this.loadPosts();
    });

    // Reset filters
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
      this.resetFilters();
    });
  }

  resetFilters() {
    this.filters = {
      type: '',
      status: '',
      source: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    
    document.getElementById('filterType').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterSource').value = '';
    document.getElementById('filterSort').value = 'createdAt';
    
    this.currentPage = 1;
    this.loadPosts();
  }

  async loadPosts() {
    const grid = document.getElementById('postsGrid');
    const spinner = document.getElementById('loadingSpinner');
    const noPosts = document.getElementById('noPosts');
    
    if (!grid) return;
    
    spinner.style.display = 'block';
    grid.innerHTML = '';
    noPosts.style.display = 'none';

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.limit,
        sortBy: this.filters.sortBy,
        sortOrder: this.filters.sortOrder,
        ...(this.filters.type && { type: this.filters.type }),
        ...(this.filters.status && { status: this.filters.status }),
        ...(this.filters.source && { source: this.filters.source })
      });

      const response = await fetch(`/api/posts?${params}`);
      const data = await response.json();

      spinner.style.display = 'none';

      if (!data.success) {
        throw new Error(data.error || 'Failed to load posts');
      }

      if (data.posts.length === 0) {
        noPosts.style.display = 'block';
        return;
      }

      // Render posts
      data.posts.forEach(post => {
        grid.appendChild(this.createPostCard(post));
      });

      // Render pagination
      this.renderPagination(data.pagination);

      // Update stats
      this.updateStatsFromPosts(data.posts, data.pagination.total);

    } catch (error) {
      console.error('Error loading posts:', error);
      spinner.style.display = 'none';
      this.showNotification('Failed to load posts', 'error');
    }
  }

  createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'col-sm-6 col-md-4 col-lg-3';
    card.dataset.postId = post._id;

    const statusClass = post.status || 'draft';
    const typeIcon = post.type === 'video' ? 'bi-film' : 'bi-image';
    const sourceLabel = this.formatSource(post.source);
    const isLegacyChat = post._isLegacyChatPost;
    
    // Get media URL
    let mediaUrl = '/img/placeholder.png';
    let isVideo = false;
    if (post.type === 'image') {
      mediaUrl = post.content?.imageUrl || post.content?.thumbnailUrl || mediaUrl;
    } else if (post.type === 'video') {
      mediaUrl = post.content?.thumbnailUrl || post.content?.videoUrl || mediaUrl;
      isVideo = true;
    }

    // Get caption/comment
    const caption = post.content?.caption || post.content?.prompt?.substring(0, 80) || '';

    card.innerHTML = `
      <div class="card bg-dark border-secondary h-100 post-card-item">
        <div class="position-relative">
          ${isVideo ? '<div class="video-overlay"><i class="bi bi-play-circle-fill"></i></div>' : ''}
          <img src="${mediaUrl}" 
               class="card-img-top" 
               alt="Post" 
               style="height: 200px; object-fit: cover;"
               onerror="this.src='/img/placeholder.png'">
          ${post.metadata?.nsfw ? '<span class="badge bg-danger position-absolute top-0 end-0 m-2">NSFW</span>' : ''}
          <span class="badge bg-${this.getStatusColor(statusClass)} position-absolute bottom-0 start-0 m-2">
            ${this.capitalizeFirst(statusClass)}
          </span>
          ${isLegacyChat ? '<span class="badge bg-info position-absolute bottom-0 end-0 m-2"><i class="bi bi-chat me-1"></i>Chat</span>' : ''}
        </div>
        <div class="card-body p-2">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <small class="text-muted">
              <i class="bi ${typeIcon} me-1"></i>${this.capitalizeFirst(post.type)}
            </small>
            <small class="text-muted">
              ${this.formatDate(post.createdAt)}
            </small>
          </div>
          <p class="card-text text-white small mb-2" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${this.escapeHtml(caption) || '<span class="text-muted">No caption</span>'}
          </p>
          ${post.scheduledFor ? `
            <div class="text-warning small mb-2">
              <i class="bi bi-calendar-event me-1"></i>
              ${this.formatDate(post.scheduledFor)}
            </div>
          ` : ''}
          <div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-outline-primary" onclick="postsDashboard.viewPost('${post._id}')" title="View">
              <i class="bi bi-eye"></i>
            </button>
            ${!isLegacyChat ? `
              <button class="btn btn-sm btn-outline-info" onclick="postsDashboard.editCaption('${post._id}')" title="Edit Caption">
                <i class="bi bi-pencil"></i>
              </button>
            ` : ''}
            ${post.status === 'draft' && !isLegacyChat ? `
              <button class="btn btn-sm btn-outline-warning" onclick="postsDashboard.openScheduleModal('${post._id}')" title="Schedule">
                <i class="bi bi-calendar-plus"></i>
              </button>
            ` : ''}
            ${post.status === 'scheduled' && !isLegacyChat ? `
              <button class="btn btn-sm btn-outline-secondary" onclick="postsDashboard.cancelSchedule('${post._id}')" title="Cancel Schedule">
                <i class="bi bi-calendar-x"></i>
              </button>
            ` : ''}
            ${!isLegacyChat ? `
              <button class="btn btn-sm btn-outline-danger" onclick="postsDashboard.deletePost('${post._id}')" title="Delete">
                <i class="bi bi-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    return card;
  }

  async loadStats() {
    try {
      // Load all posts to get accurate counts
      const response = await fetch('/api/posts?limit=1000');
      const data = await response.json();

      if (!data.success) return;

      this.updateStatsFromPosts(data.posts, data.pagination.total);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  updateStatsFromPosts(posts, total) {
    const drafts = posts.filter(p => p.status === 'draft').length;
    const scheduled = posts.filter(p => p.status === 'scheduled').length;
    const published = posts.filter(p => p.status === 'published').length;

    document.getElementById('totalPosts').textContent = total || posts.length;
    document.getElementById('draftPosts').textContent = drafts;
    document.getElementById('scheduledPosts').textContent = scheduled;
    document.getElementById('publishedPosts').textContent = published;
  }

  async viewPost(postId) {
    try {
      const response = await fetch(`/api/posts/${postId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load post');
      }

      this.currentPost = data.post;
      this.showPostModal(data.post);

    } catch (error) {
      console.error('Error viewing post:', error);
      this.showNotification('Failed to load post details', 'error');
    }
  }

  showPostModal(post) {
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');
    const isVideo = post.type === 'video';
    const mediaUrl = isVideo ? post.content?.videoUrl : post.content?.imageUrl;
    const isLegacyChat = post._isLegacyChatPost;

    modalBody.innerHTML = `
      <div class="row">
        <div class="col-md-6 mb-3">
          ${isVideo ? `
            <video controls class="w-100 rounded" style="max-height: 400px;">
              <source src="${mediaUrl}" type="video/mp4">
            </video>
          ` : `
            <img src="${mediaUrl}" alt="Post" class="w-100 rounded" style="max-height: 400px; object-fit: contain;">
          `}
        </div>
        <div class="col-md-6">
          <div class="mb-3">
            <label class="form-label text-muted small">Status</label>
            <div>
              <span class="badge bg-${this.getStatusColor(post.status)}">${this.capitalizeFirst(post.status)}</span>
              ${post.metadata?.nsfw ? '<span class="badge bg-danger ms-1">NSFW</span>' : ''}
            </div>
          </div>
          
          <div class="mb-3">
            <label class="form-label text-muted small">Source</label>
            <p class="mb-0">${this.formatSource(post.source)}</p>
          </div>
          
          <div class="mb-3">
            <label class="form-label text-muted small">Created</label>
            <p class="mb-0">${this.formatDate(post.createdAt)}</p>
          </div>
          
          ${post.scheduledFor ? `
            <div class="mb-3">
              <label class="form-label text-muted small">Scheduled For</label>
              <p class="mb-0 text-warning">${this.formatDate(post.scheduledFor)}</p>
            </div>
          ` : ''}
          
          ${post.content?.caption ? `
            <div class="mb-3">
              <label class="form-label text-muted small">Caption</label>
              <p class="mb-0">${this.escapeHtml(post.content.caption)}</p>
            </div>
          ` : ''}
          
          <div class="mb-3">
            <label class="form-label text-muted small">Prompt</label>
            <p class="mb-0 small text-secondary" style="max-height: 100px; overflow-y: auto;">${this.escapeHtml(post.content?.prompt || 'N/A')}</p>
          </div>
          
          ${post.content?.model ? `
            <div class="mb-3">
              <label class="form-label text-muted small">Model</label>
              <p class="mb-0 small">${post.content.model}</p>
            </div>
          ` : ''}
          
          ${post.socialPlatforms && post.socialPlatforms.length > 0 ? `
            <div class="mb-3">
              <label class="form-label text-muted small">Social Platforms</label>
              <p class="mb-0">${post.socialPlatforms.join(', ')}</p>
            </div>
          ` : ''}
          
          <div class="mb-3">
            <label class="form-label text-muted small">Engagement</label>
            <p class="mb-0">
              <i class="bi bi-heart text-danger me-1"></i>${post.likes || 0} likes
              <i class="bi bi-chat ms-2 me-1"></i>${post.comments?.length || 0} comments
            </p>
          </div>
        </div>
      </div>
    `;

    modalFooter.innerHTML = `
      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
        <i class="bi bi-x me-1"></i>Close
      </button>
      ${!isLegacyChat ? `
        <button type="button" class="btn btn-info" onclick="postsDashboard.editCaption('${post._id}')">
          <i class="bi bi-pencil me-1"></i>Edit Caption
        </button>
        ${post.status === 'draft' ? `
          <button type="button" class="btn btn-primary" onclick="postsDashboard.openScheduleModal('${post._id}')">
            <i class="bi bi-calendar-plus me-1"></i>Schedule
          </button>
        ` : ''}
      ` : ''}
    `;

    this.postModal?.show();
  }

  editCaption(postId) {
    document.getElementById('editCaptionPostId').value = postId;
    
    // Load current caption if viewing post
    if (this.currentPost && this.currentPost._id === postId) {
      document.getElementById('editCaptionText').value = this.currentPost.content?.caption || '';
    } else {
      // Fetch post data
      fetch(`/api/posts/${postId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            this.currentPost = data.post;
            document.getElementById('editCaptionText').value = data.post.content?.caption || '';
          }
        });
    }
    
    this.postModal?.hide();
    this.editCaptionModal?.show();
  }

  async regenerateCaption() {
    const postId = document.getElementById('editCaptionPostId').value;
    const captionInput = document.getElementById('editCaptionText');
    
    if (!this.currentPost) {
      this.showNotification('Please wait for post to load', 'warning');
      return;
    }

    captionInput.disabled = true;
    captionInput.placeholder = 'Generating caption...';

    try {
      const response = await fetch('/api/posts/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: this.currentPost.content?.prompt || '',
          platform: 'general',
          style: 'engaging'
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
      console.error('Error generating caption:', error);
      this.showNotification('Failed to generate caption', 'error');
    } finally {
      captionInput.disabled = false;
      captionInput.placeholder = 'Enter your caption...';
    }
  }

  async saveCaption() {
    const postId = document.getElementById('editCaptionPostId').value;
    const caption = document.getElementById('editCaptionText').value;

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save caption');
      }

      this.showNotification('Caption saved!', 'success');
      this.editCaptionModal?.hide();
      this.loadPosts();

    } catch (error) {
      console.error('Error saving caption:', error);
      this.showNotification('Failed to save caption', 'error');
    }
  }

  openScheduleModal(postId) {
    document.getElementById('schedulePostId').value = postId;
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    document.getElementById('scheduleDateTime').value = tomorrow.toISOString().slice(0, 16);
    
    // Reset platform buttons
    const container = document.getElementById('connectedPlatformsContainer');
    if (container) {
      container.querySelectorAll('.sns-platform-btn').forEach(btn => {
        btn.classList.remove('active');
      });
    }
    
    this.postModal?.hide();
    this.scheduleModal?.show();
  }

  async confirmSchedule() {
    const postId = document.getElementById('schedulePostId').value;
    const scheduledFor = document.getElementById('scheduleDateTime').value;
    
    const platforms = this.getSelectedPlatforms();

    if (!scheduledFor) {
      this.showNotification('Please select a date and time', 'warning');
      return;
    }

    try {
      // Update post with platforms
      if (platforms.length > 0) {
        await fetch(`/api/posts/${postId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            socialPlatforms: platforms,
            autoPublish: true
          })
        });
      }

      // Schedule the post
      const response = await fetch(`/api/posts/${postId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date(scheduledFor).toISOString() })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to schedule post');
      }

      this.showNotification('Post scheduled successfully!', 'success');
      this.scheduleModal?.hide();
      this.loadPosts();
      this.loadStats();

    } catch (error) {
      console.error('Error scheduling post:', error);
      this.showNotification('Failed to schedule post', 'error');
    }
  }

  async cancelSchedule(postId) {
    if (!confirm('Cancel scheduled post? The post will be moved back to drafts.')) return;

    try {
      const response = await fetch(`/api/posts/${postId}/cancel-schedule`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel schedule');
      }

      this.showNotification('Schedule cancelled', 'success');
      this.loadPosts();
      this.loadStats();

    } catch (error) {
      console.error('Error cancelling schedule:', error);
      this.showNotification('Failed to cancel schedule', 'error');
    }
  }

  async deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete post');
      }

      this.showNotification('Post deleted', 'success');
      this.loadPosts();
      this.loadStats();

    } catch (error) {
      console.error('Error deleting post:', error);
      this.showNotification('Failed to delete post', 'error');
    }
  }

  renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container) return;

    container.innerHTML = '';

    if (pagination.totalPages <= 1) return;

    // Previous button
    if (pagination.page > 1) {
      const prev = document.createElement('button');
      prev.className = 'btn btn-outline-primary';
      prev.innerHTML = '<i class="bi bi-chevron-left"></i> Previous';
      prev.onclick = () => {
        this.currentPage--;
        this.loadPosts();
      };
      container.appendChild(prev);
    }

    // Page numbers
    const pageInfo = document.createElement('span');
    pageInfo.className = 'mx-3 text-white align-self-center';
    pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    container.appendChild(pageInfo);

    // Next button
    if (pagination.page < pagination.totalPages) {
      const next = document.createElement('button');
      next.className = 'btn btn-outline-primary';
      next.innerHTML = 'Next <i class="bi bi-chevron-right"></i>';
      next.onclick = () => {
        this.currentPage++;
        this.loadPosts();
      };
      container.appendChild(next);
    }
  }

  formatSource(source) {
    const sources = {
      'image_dashboard': 'Image Dashboard',
      'video_dashboard': 'Video Dashboard',
      'cron_job': 'Automated',
      'gallery': 'Gallery',
      'api': 'API',
      'chat': 'Chat'
    };
    return sources[source] || source || 'Unknown';
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

  getStatusColor(status) {
    const colors = {
      'draft': 'secondary',
      'scheduled': 'warning',
      'published': 'success',
      'failed': 'danger',
      'processing': 'info'
    };
    return colors[status] || 'secondary';
  }

  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    // Try to use global notification if available
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    
    // Fallback toast notification
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

// Initialize dashboard
let postsDashboard;
document.addEventListener('DOMContentLoaded', () => {
  postsDashboard = new PostsDashboard();
});
