/**
 * User Analytics Frontend Management
 * Handles all client-side analytics operations and UI updates
 */

class UserAnalyticsManager {
  constructor() {
    this.baseUrl = window.API_URL || '';
    this.translations = window.userAnalyticsTranslations || {};
    this.currentUser = window.user || {};
    this.baseUrl = window.API_URL || '';
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadInitialAnalytics();
  }

  bindEvents() {
    // Analytics refresh button
    $(document).on('click', '.refresh-analytics', (e) => {
      this.refreshAnalytics();
    });

    // Load analytics history
    $(document).on('click', '.load-analytics-history', (e) => {
      this.loadAnalyticsHistory();
    });

    // Analytics modal events
    $(document).on('show.bs.modal', '#analyticsModal', () => {
      this.loadModalAnalytics();
    });

    // Debug analytics buttons
    $(document).on('click', '.debug-image-analytics', (e) => {
      this.debugImageAnalytics();
    });

    $(document).on('click', '.debug-like-analytics', (e) => {
      this.debugLikeAnalytics();
    });

    $(document).on('click', '.debug-all-analytics', (e) => {
      this.debugAllAnalytics();
    });

    // Bind sound play event only if button exists
    $('.play-bonus-sound').on('click', () => {
      this.playDailyBonusSound(false);
    });

    // Combined leaderboard modal events
    $(document).on('show.bs.modal', '#leaderboardModal', () => {
      this.loadCombinedLeaderboards();
    });

    // Refresh leaderboards buttons
    $(document).on('click', '.refresh-leaderboards', (e) => {
      const type = $(e.target).data('type') || $(e.target).closest('.refresh-leaderboards').data('type');
      this.refreshLeaderboards(type);
    });

    // Trigger entrance animation
    $(document).on('shown.bs.modal', '#leaderboardModal', () => {
      this.animateLeaderboardEntrance();
    });
  }

  /**
   * Load initial analytics data
   */
  async loadInitialAnalytics() {
    if (!this.currentUser || this.currentUser.isTemporary) {
      return;
    }

    try {
      await this.updateAnalyticsDisplay();
    } catch (error) {
      console.error('Error loading initial analytics:', error);
    }
  }

  /**
   * Update analytics display across the page
   */
  async updateAnalyticsDisplay() {
    try {
      const analytics = await this.getComprehensiveAnalytics(this.currentUser._id);
      
      if (analytics.success) {
        // Update analytics widgets
        this.updateAnalyticsWidgets(analytics);
        
        // Update analytics charts if present
        this.updateAnalyticsCharts(analytics);
        
        // Add animation effect
        $('.analytics-widget').addClass('analytics-updated');
        setTimeout(() => {
          $('.analytics-widget').removeClass('analytics-updated');
        }, 600);
      }
    } catch (error) {
      console.error('Error updating analytics display:', error);
    }
  }

  /**
   * Update analytics widgets in the UI
   */
  updateAnalyticsWidgets(analytics) {
    const { imageGeneration, likes } = analytics;
    
    // Update image generation stats
    if (imageGeneration && imageGeneration.total) {
      $('.total-images-generated').text(imageGeneration.total.totalImages || 0);
      $('.images-this-month').text(imageGeneration.total.thisMonth || 0);
      $('.images-this-week').text(imageGeneration.total.thisWeek || 0);
      $('.favorite-chat').text(imageGeneration.total.favoriteChat || 'N/A');
    }
    
    // Update like stats
    if (likes && likes.total) {
      $('.total-likes-received').text(likes.total.totalLikes || 0);
      $('.likes-this-month').text(likes.total.thisMonth || 0);
      $('.likes-this-week').text(likes.total.thisWeek || 0);
      $('.most-liked-image').text(likes.total.mostLikedImage || 'N/A');
    }
  }

  /**
   * Update analytics charts if chart library is available
   */
  updateAnalyticsCharts(analytics) {
    // Implementation depends on your chart library (Chart.js, etc.)
    if (typeof Chart !== 'undefined') {
      this.renderAnalyticsCharts(analytics);
    }
  }

  /**
   * Get user image generation analytics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Analytics data
   */
  async getImageGenerationStats(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/analytics/images`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching image generation stats:', error);
      throw error;
    }
  }

  /**
   * Get user image like analytics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Like analytics data
   */
  async getImageLikeStats(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/analytics/likes`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching image like stats:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive user analytics (both images and likes)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Combined analytics data
   */
  async getComprehensiveAnalytics(userId) {
    try {
      const [imageStats, likeStats] = await Promise.all([
        this.getImageGenerationStats(userId),
        this.getImageLikeStats(userId)
      ]);

      return {
        success: true,
        userId,
        imageGeneration: imageStats,
        likes: likeStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching comprehensive analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load and display image generation leaderboard
   */
  async loadImageGenerationLeaderboard() {
    const $leaderboardContainer = $('.analytics-leaderboard-list');
    if (!$leaderboardContainer.length) return;

    $leaderboardContainer.html(`
      <div class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
        </div>
        <div class="mt-2 text-muted">${this.translations.loading_leaderboard || 'Loading leaderboard...'}</div>
      </div>
    `);

    try {
      const response = await fetch(`${this.baseUrl}/user/analytics/leaderboard/images`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.leaderboard) {
        this.renderImageGenerationLeaderboard(data.leaderboard);
      } else {
        $leaderboardContainer.html(`
          <div class="text-center p-4 text-muted">
            <i class="bi bi-image fs-1 opacity-50"></i>
            <div class="mt-2">${this.translations.no_leaderboard || 'No leaderboard data available'}</div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading image generation leaderboard:', error);
      $leaderboardContainer.html(`
        <div class="text-center p-4 text-danger">
          <i class="bi bi-exclamation-circle fs-1"></i>
          <div class="mt-2">${this.translations.error_loading_leaderboard || 'Error loading leaderboard'}</div>
          <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.userAnalyticsManager.loadImageGenerationLeaderboard()">
            <i class="bi bi-arrow-clockwise me-1"></i>${this.translations.try_again || 'Try Again'}
          </button>
        </div>
      `);
    }
  }

  /**
   * Render image generation leaderboard
   */
  renderImageGenerationLeaderboard(leaderboard) {
    const $container = $('.analytics-leaderboard-list');
    let html = '';
    
    if (!leaderboard || leaderboard.length === 0) {
      html = `
        <div class="text-center p-4 text-muted">
          <i class="bi bi-image fs-1 opacity-50"></i>
          <div class="mt-2">${this.translations.no_users_leaderboard || 'No users on leaderboard yet'}</div>
        </div>
      `;
    } else {
      leaderboard.forEach((user, index) => {
        const rank = index + 1;
        let rankBadge = `<span class="badge bg-secondary">#${rank}</span>`;
        
        if (rank === 1) {
          rankBadge = `<span class="badge" style="background: linear-gradient(135deg, #ffd700, #ffed4e);"><i class="bi bi-trophy-fill text-white"></i> #${rank}</span>`;
        } else if (rank === 2) {
          rankBadge = `<span class="badge" style="background: linear-gradient(135deg, #c0c0c0, #e8e8e8);"><i class="bi bi-award-fill text-white"></i> #${rank}</span>`;
        } else if (rank === 3) {
          rankBadge = `<span class="badge" style="background: linear-gradient(135deg, #cd7f32, #d4af37);"><i class="bi bi-award text-white"></i> #${rank}</span>`;
        }
        
        const avatar = user.profileUrl || '/img/avatar.png';
        const isCurrentUser = user._id === this.currentUser._id;
        const joinedDate = user.joinedDate ? new Date(user.joinedDate).toLocaleDateString() : 'Unknown';
        
        html += `
          <div class="d-flex align-items-center p-3 border-bottom ${isCurrentUser ? 'bg-light' : ''} leaderboard-row" 
               style="cursor: pointer; transition: background-color 0.2s ease;" 
               data-user-id="${user._id}"
               onclick="window.open('/user/${user._id}', '_blank')">
            <div class="flex-shrink-0 me-3">
              ${rankBadge}
            </div>
            <div class="flex-shrink-0 me-3">
              <img src="${avatar}" alt="${user.nickname}" class="rounded-circle" width="40" height="40" style="object-fit: cover;">
            </div>
            <div class="flex-grow-1">
              <div class="fw-semibold ${isCurrentUser ? 'text-primary' : ''}">${user.nickname || this.translations.anonymous || 'Anonymous'}</div>
              <small class="text-muted">
                <i class="bi bi-calendar3 me-1"></i>${this.translations.joined || 'Joined'} ${joinedDate}
                ${user.totalEntries ? ` • ${user.totalEntries} ${this.translations.unique_images || 'unique images'}` : ''}
              </small>
            </div>
            <div class="flex-shrink-0 text-end">
              <span class="fw-bold text-primary fs-5">${user.totalImages || 0}</span>
              <small class="text-muted d-block">${this.translations.images_generated || 'images generated'}</small>
            </div>
          </div>
        `;
      });
    }
    
    $container.html(html);
    
    // Add hover effects
    this.addLeaderboardHoverEffects();
  }

  /**
   * Load analytics for modal display
   */
  async loadModalAnalytics() {
    // Load the image generation leaderboard instead of overview
    await this.loadImageGenerationLeaderboard();
  }

  /**
   * Load analytics history
   */
  async loadAnalyticsHistory() {
    // Implementation for loading historical analytics data
    console.log('Loading analytics history...');
  }

  /**
   * Refresh analytics data
   */
  async refreshAnalytics() {
    await this.updateAnalyticsDisplay();
    showNotification(this.translations.analytics_refreshed || 'Analytics refreshed', 'success');
  }

  /**
   * Debug user image stats (logs server-side)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Debug response
   */
  async debugImageStats(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/debug/image-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: 'frontend-debug'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error debugging image stats:', error);
      throw error;
    }
  }

  /**
   * Debug user like stats (logs server-side)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Debug response
   */
  async debugLikeStats(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/user/${userId}/debug/like-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: 'frontend-debug'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error debugging like stats:', error);
      throw error;
    }
  }

  /**
   * Debug image analytics
   */
  async debugImageAnalytics() {
    if (!this.currentUser._id) {
      console.error('No user ID available for debugging');
      return;
    }

    console.log('🐛 Debugging image analytics for user:', this.currentUser._id);
    
    try {
      const [clientData, serverDebug] = await Promise.all([
        this.getImageGenerationStats(this.currentUser._id),
        this.debugImageStats(this.currentUser._id)
      ]);

      console.group('📊 Image Analytics Debug Results');
      console.log('Client Data:', clientData);
      console.log('Server Debug:', serverDebug);
      console.groupEnd();

      showNotification('Image analytics debug completed - check console', 'info');
    } catch (error) {
      console.error('Error debugging image analytics:', error);
      showNotification('Error debugging image analytics', 'error');
    }
  }

  /**
   * Debug like analytics
   */
  async debugLikeAnalytics() {
    if (!this.currentUser._id) {
      console.error('No user ID available for debugging');
      return;
    }

    console.log('🐛 Debugging like analytics for user:', this.currentUser._id);
    
    try {
      const [clientData, serverDebug] = await Promise.all([
        this.getImageLikeStats(this.currentUser._id),
        this.debugLikeStats(this.currentUser._id)
      ]);

      console.group('❤️ Like Analytics Debug Results');
      console.log('Client Data:', clientData);
      console.log('Server Debug:', serverDebug);
      console.groupEnd();

      showNotification('Like analytics debug completed - check console', 'info');
    } catch (error) {
      console.error('Error debugging like analytics:', error);
      showNotification('Error debugging like analytics', 'error');
    }
  }

  /**
   * Debug all analytics
   */
  async debugAllAnalytics() {
    if (!this.currentUser._id) {
      console.error('No user ID available for debugging');
      return;
    }

    console.log('🐛 Debugging all analytics for user:', this.currentUser._id);
    
    try {
      const [imageDebug, likeDebug, comprehensiveData] = await Promise.all([
        this.debugImageStats(this.currentUser._id),
        this.debugLikeStats(this.currentUser._id),
        this.getComprehensiveAnalytics(this.currentUser._id)
      ]);

      console.group('🔍 Complete Analytics Debug Results');
      console.log('Image Debug:', imageDebug);
      console.log('Like Debug:', likeDebug);
      console.log('Comprehensive Data:', comprehensiveData);
      console.groupEnd();

      showNotification('Complete analytics debug completed - check console', 'info');
    } catch (error) {
      console.error('Error debugging all analytics:', error);
      showNotification('Error debugging analytics', 'error');
    }
  }

  /**
   * Load image generation leaderboard for the combined modal
   */
  async loadImageGenerationLeaderboardForModal() {
    const $container = $('#image-leaderboard-container');
    
    if (!$container.length) {
      console.error('Image leaderboard container not found');
      return;
    }

    $container.html(`
      <div class="text-center p-3">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
        </div>
      </div>
    `);

    try {
      console.log('Loading image leaderboard...');
      const response = await fetch(`${this.baseUrl}/user/analytics/leaderboard/images?limit=10`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Image leaderboard data:', data);
      
      if (data.success && data.leaderboard && data.leaderboard.length > 0) {
        this.renderLeaderboardInContainer(data.leaderboard, $container, 'images');
      } else {
        $container.html(`
          <div class="text-center p-3 text-muted">
            <i class="bi bi-image fs-4 opacity-50"></i>
            <div class="mt-1 small">${this.translations.no_leaderboard || 'No data available'}</div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading image leaderboard:', error);
      $container.html(`
        <div class="text-center p-3 text-danger">
          <i class="bi bi-exclamation-circle fs-4"></i>
          <div class="mt-1 small">${this.translations.error_loading_leaderboard || 'Error loading data'}</div>
          <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.userAnalyticsManager.loadImageGenerationLeaderboardForModal()">
            <i class="bi bi-arrow-clockwise me-1"></i>${this.translations.try_again || 'Try Again'}
          </button>
        </div>
      `);
    }
  }

  /**
   * Load points leaderboard for the combined modal
   */
  async loadPointsLeaderboardForModal() {
    const $container = $('#points-leaderboard-container');
    
    if (!$container.length) {
      console.error('Points leaderboard container not found');
      return;
    }

    $container.html(`
      <div class="text-center p-3">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
        </div>
      </div>
    `);

    try {
      console.log('Loading points leaderboard...');
      const response = await fetch(`${this.baseUrl}/api/user-points/leaderboard?limit=10`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Points leaderboard data:', data);
      
      if (data.success && data.leaderboard && data.leaderboard.length > 0) {
        this.renderLeaderboardInContainer(data.leaderboard, $container, 'points');
      } else {
        $container.html(`
          <div class="text-center p-3 text-muted">
            <i class="bi bi-star fs-4 opacity-50"></i>
            <div class="mt-1 small">${this.translations.no_leaderboard || 'No data available'}</div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading points leaderboard:', error);
      $container.html(`
        <div class="text-center p-3 text-danger">
          <i class="bi bi-exclamation-circle fs-4"></i>
          <div class="mt-1 small">${this.translations.error_loading_leaderboard || 'Error loading data'}</div>
          <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.userAnalyticsManager.loadPointsLeaderboardForModal()">
            <i class="bi bi-arrow-clockwise me-1"></i>${this.translations.try_again || 'Try Again'}
          </button>
        </div>
      `);
    }
  }

  /**
   * Load combined leaderboards for the modal
   */
  async loadCombinedLeaderboards() {
    console.log('Loading combined leaderboards...');
    
    // Check if containers exist
    if (!$('#image-leaderboard-container').length || !$('#points-leaderboard-container').length) {
      console.error('Leaderboard containers not found in DOM');
      return;
    }

    // Load both leaderboards simultaneously
    try {
      await Promise.all([
        this.loadImageGenerationLeaderboardForModal(),
        this.loadPointsLeaderboardForModal()
      ]);
      console.log('Combined leaderboards loaded successfully');
    } catch (error) {
      console.error('Error loading combined leaderboards:', error);
    }
  }

  /**
   * Render leaderboard in a specific container
   */
  renderLeaderboardInContainer(leaderboard, $container, type) {
    let html = '';
    
    if (!leaderboard || leaderboard.length === 0) {
      html = `
        <div class="text-center p-3 text-muted">
          <i class="bi bi-${type === 'images' ? 'image' : 'star'} fs-4 opacity-50"></i>
          <div class="mt-1 small">${this.translations.no_users_leaderboard || 'No users found'}</div>
        </div>
      `;
    } else {
      leaderboard.forEach((user, index) => {
        const rank = index + 1;
        let rankBadge = `<span class="badge bg-secondary fs-7">#${rank}</span>`;
        
        if (rank === 1) {
          rankBadge = `<span class="badge" style="background: linear-gradient(135deg, #ffd700, #ffed4e);"><i class="bi bi-trophy-fill text-white"></i></span>`;
        } else if (rank === 2) {
          rankBadge = `<span class="badge" style="background: linear-gradient(135deg, #c0c0c0, #e8e8e8);"><i class="bi bi-award-fill text-white"></i></span>`;
        } else if (rank === 3) {
          rankBadge = `<span class="badge" style="background: linear-gradient(135deg, #cd7f32, #d4af37);"><i class="bi bi-award text-white"></i></span>`;
        }
        
        const avatar = user.profileUrl || '/img/avatar.png';
        const isCurrentUser = user._id === this.currentUser._id;
        
        let valueDisplay, valueLabel;
        if (type === 'images') {
          valueDisplay = user.totalImages || 0;
          valueLabel = this.translations.images_generated || 'images';
        } else {
          valueDisplay = user.points || 0;
          valueLabel = this.translations.points_title || 'points';
        }
        
        html += `
          <div class="d-flex align-items-center p-2 border-bottom ${isCurrentUser ? 'bg-light' : ''} leaderboard-row" 
               style="min-height: 60px; cursor: pointer; transition: background-color 0.2s ease;" 
               data-user-id="${user._id}"
               onclick="window.open('/user/${user._id}', '_blank')">
            <div class="flex-shrink-0 me-2">
              ${rankBadge}
            </div>
            <div class="flex-shrink-0 me-2">
              <img src="${avatar}" alt="${user.nickname}" class="rounded-circle" width="32" height="32" style="object-fit: cover;">
            </div>
            <div class="flex-grow-1 min-w-0">
              <div class="fw-semibold text-truncate ${isCurrentUser ? 'text-primary' : ''}" style="font-size: 0.9rem;">${user.nickname || this.translations.anonymous || 'Anonymous'}</div>
              ${type === 'images' && user.totalEntries ? `<small class="text-muted">${user.totalEntries} unique</small>` : ''}
              ${type === 'points' && user.loginStreak ? `<small class="text-muted"><i class="bi bi-fire"></i> ${user.loginStreak} days</small>` : ''}
            </div>
            <div class="flex-shrink-0 text-end">
              <span class="fw-bold ${type === 'images' ? 'text-primary' : 'text-warning'}" style="font-size: 0.9rem;">${valueDisplay}</span>
              <small class="text-muted d-block" style="font-size: 0.75rem;">${valueLabel}</small>
            </div>
          </div>
        `;
      });
    }
    
    $container.html(html);
    
    // Add hover effects
    this.addLeaderboardHoverEffects();
  }

  /**
   * Add hover effects to leaderboard rows
   */
  addLeaderboardHoverEffects() {
    $('.leaderboard-row').hover(
      function() {
        $(this).css('background-color', 'rgba(0, 123, 255, 0.1)');
      },
      function() {
        if (!$(this).hasClass('bg-light')) {
          $(this).css('background-color', '');
        }
      }
    );
  }

  /**
   * Refresh specific leaderboard
   */
  async refreshLeaderboards(type) {
    if (type === 'image') {
      await this.loadImageGenerationLeaderboardForModal();
    } else if (type === 'points') {
      await this.loadPointsLeaderboardForModal();
    } else {
      // Refresh both
      await this.loadCombinedLeaderboards();
    }
    
    showNotification(this.translations.leaderboard_refreshed || 'Leaderboard refreshed', 'success');
  }

  /**
   * Animate leaderboard entrance for visual appeal
   */
  animateLeaderboardEntrance() {
    $('.leaderboard-section').each((index, element) => {
      const $element = $(element);
      $element.css({
        'opacity': '0',
        'transform': 'translateY(20px)',
        'transition': 'all 0.4s ease-out'
      });
      
      setTimeout(() => {
        $element.css({
          'opacity': '1',
          'transform': 'translateY(0)'
        });
      }, index * 200);
    });
  }

  /**
   * Display analytics data in console with formatting
   * @param {Object} data - Analytics data
   * @param {string} title - Title for the log
   */
  displayAnalytics(data, title = 'User Analytics') {
    console.group(`📊 ${title}`);
    console.log('User ID:', data.userId);
    
    if (data.total) {
      console.group('📈 Total Stats');
      Object.entries(data.total).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
      console.groupEnd();
    }
    
    if (data.byChat && data.byChat.length > 0) {
      console.group('💬 By Chat');
      data.byChat.forEach((chat, index) => {
        console.log(`${index + 1}. ${chat.chatName || 'Unknown Chat'}:`, chat);
      });
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}

// Initialize analytics manager when document is ready
$(document).ready(() => {
  if (window.user && !window.user.isTemporary) {
    window.userAnalyticsManager = new UserAnalyticsManager();
  }
});

// Helper functions for easy access
window.getUserAnalytics = async (userId) => {
  if (window.userAnalyticsManager) {
    return await window.userAnalyticsManager.getComprehensiveAnalytics(userId);
  }
};

window.refreshUserAnalytics = () => {
  if (window.userAnalyticsManager) {
    window.userAnalyticsManager.updateAnalyticsDisplay();
  }
};

//[DEBUG] Global debug helper functions
window.debugImageAnalytics = () => {
  if (window.userAnalyticsManager) {
    window.userAnalyticsManager.debugImageAnalytics();
  }
};

window.debugLikeAnalytics = () => {
  if (window.userAnalyticsManager) {
    window.userAnalyticsManager.debugLikeAnalytics();
  }
};

window.debugAllAnalytics = () => {
  if (window.userAnalyticsManager) {
    window.userAnalyticsManager.debugAllAnalytics();
  }
};
//[DEBUG] End of global debug helpers

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UserAnalyticsManager;
}