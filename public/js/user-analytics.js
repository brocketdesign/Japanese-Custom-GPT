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
   * Load analytics for modal display
   */
  async loadModalAnalytics() {
    const $analyticsContainer = $('.analytics-modal-content');
    if (!$analyticsContainer.length) return;

    $analyticsContainer.html(`
      <div class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
        </div>
        <div class="mt-2 text-muted">${this.translations.loading_analytics || 'Loading analytics...'}</div>
      </div>
    `);

    try {
      const analytics = await this.getComprehensiveAnalytics(this.currentUser._id);
      
      if (analytics.success) {
        this.renderModalAnalytics(analytics);
      } else {
        $analyticsContainer.html(`
          <div class="text-center p-4 text-danger">
            <i class="bi bi-exclamation-circle fs-1"></i>
            <div class="mt-2">${this.translations.error_loading_analytics || 'Error loading analytics'}</div>
            <button class="btn btn-sm btn-outline-primary mt-2 refresh-analytics">
              <i class="bi bi-arrow-clockwise me-1"></i>${this.translations.try_again || 'Try Again'}
            </button>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading modal analytics:', error);
      $analyticsContainer.html(`
        <div class="text-center p-4 text-danger">
          <i class="bi bi-exclamation-circle fs-1"></i>
          <div class="mt-2">${this.translations.error_loading_analytics || 'Error loading analytics'}</div>
          <button class="btn btn-sm btn-outline-primary mt-2 refresh-analytics">
            <i class="bi bi-arrow-clockwise me-1"></i>${this.translations.try_again || 'Try Again'}
          </button>
        </div>
      `);
    }
  }

  /**
   * Render analytics in modal
   */
  renderModalAnalytics(analytics) {
    const $container = $('.analytics-modal-content');
    const { imageGeneration, likes } = analytics;
    
    let html = `
      <div class="row">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-image me-2"></i>${this.translations.image_generation || 'Image Generation'}
              </h5>
            </div>
            <div class="card-body">
    `;
    
    if (imageGeneration && imageGeneration.total) {
      html += `
        <div class="row text-center">
          <div class="col-6">
            <div class="border-end">
              <h4 class="text-primary">${imageGeneration.total.totalImages || 0}</h4>
              <small class="text-muted">${this.translations.total_images || 'Total Images'}</small>
            </div>
          </div>
          <div class="col-6">
            <h4 class="text-success">${imageGeneration.total.thisMonth || 0}</h4>
            <small class="text-muted">${this.translations.this_month || 'This Month'}</small>
          </div>
        </div>
        <hr>
        <div class="small text-muted">
          <div><strong>${this.translations.favorite_chat || 'Favorite Chat'}:</strong> ${imageGeneration.total.favoriteChat || 'N/A'}</div>
          <div><strong>${this.translations.this_week || 'This Week'}:</strong> ${imageGeneration.total.thisWeek || 0}</div>
        </div>
      `;
    } else {
      html += `<p class="text-muted">${this.translations.no_image_data || 'No image generation data available'}</p>`;
    }
    
    html += `
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h5 class="card-title mb-0">
                <i class="bi bi-heart me-2"></i>${this.translations.likes_received || 'Likes Received'}
              </h5>
            </div>
            <div class="card-body">
    `;
    
    if (likes && likes.total) {
      html += `
        <div class="row text-center">
          <div class="col-6">
            <div class="border-end">
              <h4 class="text-danger">${likes.total.totalLikes || 0}</h4>
              <small class="text-muted">${this.translations.total_likes || 'Total Likes'}</small>
            </div>
          </div>
          <div class="col-6">
            <h4 class="text-warning">${likes.total.thisMonth || 0}</h4>
            <small class="text-muted">${this.translations.this_month || 'This Month'}</small>
          </div>
        </div>
        <hr>
        <div class="small text-muted">
          <div><strong>${this.translations.most_liked || 'Most Liked'}:</strong> ${likes.total.mostLikedImage || 'N/A'}</div>
          <div><strong>${this.translations.this_week || 'This Week'}:</strong> ${likes.total.thisWeek || 0}</div>
        </div>
      `;
    } else {
      html += `<p class="text-muted">${this.translations.no_like_data || 'No like data available'}</p>`;
    }
    
    html += `
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add debug section if user is admin or in development
    if (this.currentUser.role === 'admin' || window.location.hostname === 'localhost') {
      html += `
        <div class="mt-3">
          <div class="card border-secondary">
            <div class="card-header bg-secondary text-white">
              <h6 class="card-title mb-0">
                <i class="bi bi-bug me-2"></i>Debug Analytics
              </h6>
            </div>
            <div class="card-body">
              <div class="btn-group" role="group">
                <button class="btn btn-sm btn-outline-secondary debug-image-analytics">
                  <i class="bi bi-image me-1"></i>Debug Images
                </button>
                <button class="btn btn-sm btn-outline-secondary debug-like-analytics">
                  <i class="bi bi-heart me-1"></i>Debug Likes
                </button>
                <button class="btn btn-sm btn-outline-secondary debug-all-analytics">
                  <i class="bi bi-bug me-1"></i>Debug All
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    $container.html(html);
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
