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
          <div class="d-flex align-items-center p-3 border-bottom ${isCurrentUser ? 'bg-light' : ''}">
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