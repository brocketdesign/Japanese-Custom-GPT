/**
 * User Points Frontend Management
 * Handles all client-side points operations and UI updates
 */

class UserPointsManager {
  constructor() {
    this.baseUrl = window.API_URL || '';
    this.translations = window.userPointsTranslations || {};
    this.currentUser = window.user || {};
    this.init();
  }

  init() {
    this.bindEvents();
    this.updatePointsDisplay();
    this.checkDailyBonus();
  }

  bindEvents() {
    // Daily bonus button
    $(document).on('click', '.bonus-btn', (e) => {
      this.claimDailyBonus();
    });

    // Points history pagination
    $(document).on('click', '.points-history-pagination .page-link', (e) => {
      e.preventDefault();
      const page = $(e.target).data('page');
      this.loadPointsHistory(page);
    });

    // Refresh points button
    $(document).on('click', '.refresh-points', (e) => {
      this.refreshPoints();
    });

    // Admin points management
    $(document).on('click', '.admin-add-points', (e) => {
      this.addAdminPoints();
    });

    $(document).on('click', '.admin-remove-points', (e) => {
      this.removeAdminPoints();
    });

    $(document).on('click', '.admin-set-points', (e) => {
      this.setAdminPoints();
    });
  }

  /**
   * Update points display across the page
   */
  async updatePointsDisplay() {
    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/balance`);
      const data = await response.json();
      
      if (data.success) {
        // Update main points display
        $('.user-points-balance').text(data.points);
        $('.points-widget .points-amount').text(data.points);
        
        // Add animation effect
        $('.user-points-balance').addClass('points-updated');
        setTimeout(() => {
          $('.user-points-balance').removeClass('points-updated');
        }, 600);

        // Update user object
        if (window.user) {
          window.user.points = data.points;
        }
      }
    } catch (error) {
      console.error('Error updating points display:', error);
    }
  }

  /**
   * Check if daily bonus is available
   */
  async checkDailyBonus() {
    if (!$('.daily-bonus').length) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/daily-bonus-status`);
      const data = await response.json();
      
      const $bonusBtn = $('.bonus-btn');
      const $streakCounter = $('.streak-counter');
      
      if (data.canClaim) {
        $bonusBtn.prop('disabled', false)
          .removeClass('bonus-claimed')
          .text(this.translations.claim_bonus || 'Claim Daily Bonus');
      } else {
        $bonusBtn.prop('disabled', true)
          .addClass('bonus-claimed')
          .text(this.translations.bonus_already_claimed || 'Already Claimed');
      }
      
      if (data.currentStreak) {
        $streakCounter.text(`${data.currentStreak} ${this.translations.days || 'days'}`);
      }
    } catch (error) {
      console.error('Error checking daily bonus:', error);
    }
  }

  /**
   * Claim daily bonus
   */
  async claimDailyBonus() {
    const $bonusBtn = $('.bonus-btn');
    const originalText = $bonusBtn.text();
    
    $bonusBtn.prop('disabled', true).text('Claiming...');

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/daily-bonus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show success notification
        showNotification(
          this.translations.messages?.daily_bonus_claimed?.replace('{points}', data.pointsAwarded) || 
          `Daily bonus claimed! +${data.pointsAwarded} points`,
          'success'
        );
        
        // Update streak display
        $('.streak-counter').text(`${data.currentStreak} ${this.translations.days || 'days'}`);
        
        // Update points display
        await this.updatePointsDisplay();
        
        // Update button state
        $bonusBtn.addClass('bonus-claimed')
          .text(this.translations.bonus_claimed || 'Bonus Claimed!');
        
        // Show streak bonus if applicable
        if (data.currentStreak > 1) {
          setTimeout(() => {
            showNotification(
              this.translations.messages?.streak_bonus?.replace('{streak}', data.currentStreak) || 
              `Streak bonus! Day ${data.currentStreak}`,
              'info'
            );
          }, 1000);
        }
      } else {
        $bonusBtn.prop('disabled', false).text(originalText);
        showNotification(data.message || 'Failed to claim bonus', 'error');
      }
    } catch (error) {
      console.error('Error claiming daily bonus:', error);
      $bonusBtn.prop('disabled', false).text(originalText);
      showNotification('Error claiming bonus', 'error');
    }
  }

  /**
   * Load points history
   */
  async loadPointsHistory(page = 1, limit = 20) {
    const $historyContainer = $('.points-history-list');
    if (!$historyContainer.length) return;

    $historyContainer.html(`
      <div class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2 text-muted">Loading history...</div>
      </div>
    `);

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/history?userId=${this.currentUser._id}&page=${page}&limit=${limit}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.history) {
        this.renderPointsHistory(data.history, data.pagination || {});
      } else {
        $historyContainer.html(`
          <div class="text-center p-4 text-muted">
            <i class="bi bi-clock-history fs-1 opacity-50"></i>
            <div class="mt-2">No transaction history found</div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading points history:', error);
      $historyContainer.html(`
        <div class="text-center p-4 text-danger">
          <i class="bi bi-exclamation-circle fs-1"></i>
          <div class="mt-2">Error loading history</div>
          <button class="btn btn-sm btn-outline-primary mt-2 refresh-points">
            <i class="bi bi-arrow-clockwise me-1"></i>Try Again
          </button>
        </div>
      `);
    }
  }

  /**
   * Render points history list
   */
  renderPointsHistory(history, pagination) {
    const $container = $('.points-history-list');
    let html = '';
    
    if (!history || history.length === 0) {
      html = `
        <div class="text-center p-4 text-muted">
          <i class="bi bi-clock-history fs-1 opacity-50"></i>
          <div class="mt-2">No transaction history found</div>
        </div>
      `;
    } else {
      history.forEach(item => {
        const typeClass = item.type === 'credit' ? 'text-success' : 'text-danger';
        const typeIcon = item.type === 'credit' ? 'bi-plus-circle-fill' : 'bi-dash-circle-fill';
        const sign = item.type === 'credit' ? '+' : '-';
        const date = new Date(item.createdAt).toLocaleDateString();
        const time = new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        html += `
          <div class="d-flex align-items-center p-3 border-bottom">
            <div class="flex-shrink-0 me-3">
              <i class="bi ${typeIcon} ${typeClass} fs-4"></i>
            </div>
            <div class="flex-grow-1">
              <div class="fw-semibold">${item.reason || 'Points transaction'}</div>
              <small class="text-muted">${item.source || 'system'} • ${date} ${time}</small>
            </div>
            <div class="flex-shrink-0">
              <span class="fw-bold ${typeClass}">${sign}${item.points}</span>
            </div>
          </div>
        `;
      });
      
      // Add pagination if needed
      if (pagination && pagination.totalPages > 1) {
        html += this.renderPagination(pagination);
      }
    }
    
    $container.html(html);
  }

  /**
   * Render pagination controls
   */
  renderPagination(pagination) {
    let html = '<nav class="points-history-pagination mt-3"><ul class="pagination justify-content-center">';
    
    // Previous button
    html += `<li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${pagination.currentPage - 1}">Previous</a>
    </li>`;
    
    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
      if (i === pagination.currentPage || 
          Math.abs(i - pagination.currentPage) <= 2 || 
          i === 1 || 
          i === pagination.totalPages) {
        html += `<li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>`;
      } else if (Math.abs(i - pagination.currentPage) === 3) {
        html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      }
    }
    
    // Next button
    html += `<li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${pagination.currentPage + 1}">Next</a>
    </li>`;
    
    html += '</ul></nav>';
    return html;
  }

  /**
   * Load and display leaderboard
   */
  async loadLeaderboard() {
    const $leaderboardContainer = $('.leaderboard-list');
    if (!$leaderboardContainer.length) return;

    $leaderboardContainer.html(`
      <div class="text-center p-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2 text-muted">Loading leaderboard...</div>
      </div>
    `);

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/leaderboard`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.leaderboard) {
        this.renderLeaderboard(data.leaderboard);
      } else {
        $leaderboardContainer.html(`
          <div class="text-center p-4 text-muted">
            <i class="bi bi-trophy fs-1 opacity-50"></i>
            <div class="mt-2">No leaderboard data available</div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      $leaderboardContainer.html(`
        <div class="text-center p-4 text-danger">
          <i class="bi bi-exclamation-circle fs-1"></i>
          <div class="mt-2">Error loading leaderboard</div>
          <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.userPointsManager.loadLeaderboard()">
            <i class="bi bi-arrow-clockwise me-1"></i>Try Again
          </button>
        </div>
      `);
    }
  }

  /**
   * Render leaderboard
   */
  renderLeaderboard(leaderboard) {
    const $container = $('.leaderboard-list');
    let html = '';
    
    if (!leaderboard || leaderboard.length === 0) {
      html = `
        <div class="text-center p-4 text-muted">
          <i class="bi bi-trophy fs-1 opacity-50"></i>
          <div class="mt-2">No users on leaderboard yet</div>
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
        
        html += `
          <div class="d-flex align-items-center p-3 border-bottom ${isCurrentUser ? 'bg-light' : ''}">
            <div class="flex-shrink-0 me-3">
              ${rankBadge}
            </div>
            <div class="flex-shrink-0 me-3">
              <img src="${avatar}" alt="${user.nickname}" class="rounded-circle" width="40" height="40">
            </div>
            <div class="flex-grow-1">
              <div class="fw-semibold ${isCurrentUser ? 'text-primary' : ''}">${user.nickname || 'Anonymous'}</div>
              ${user.loginStreak ? `<small class="text-muted"><i class="bi bi-fire"></i> ${user.loginStreak} day streak</small>` : ''}
            </div>
            <div class="flex-shrink-0">
              <span class="fw-bold text-warning">${user.points || 0}</span>
              <small class="text-muted d-block">points</small>
            </div>
          </div>
        `;
      });
    }
    
    $container.html(html);
  }

  /**
   * Admin: Add points to user
   */
  async addAdminPoints() {
    const amount = parseInt($('#adminPointsAmount').val());
    const reason = $('#adminPointsReason').val() || 'Admin adjustment';

    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    const $btn = $('.admin-add-points');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html('<i class="bi bi-hourglass"></i> Adding...');

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          points: amount,
          reason: reason,
          source: 'admin'
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification(`Successfully added ${amount} points`, 'success');
        await this.updatePointsDisplay();
        $('#adminPointsAmount').val('');
        $('#adminPointsReason').val('');
      } else {
        showNotification(data.error || 'Failed to add points', 'error');
      }
    } catch (error) {
      console.error('Error adding points:', error);
      showNotification('Error adding points', 'error');
    } finally {
      $btn.prop('disabled', false).html(originalText);
    }
  }

  /**
   * Admin: Remove points from user
   */
  async removeAdminPoints() {
    const amount = parseInt($('#adminPointsAmount').val());
    const reason = $('#adminPointsReason').val() || 'Admin adjustment';

    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount', 'error');
      return;
    }

    const $btn = $('.admin-remove-points');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html('<i class="bi bi-hourglass"></i> Removing...');

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          points: amount,
          reason: reason,
          source: 'admin'
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification(`Successfully removed ${amount} points`, 'success');
        await this.updatePointsDisplay();
        $('#adminPointsAmount').val('');
        $('#adminPointsReason').val('');
      } else {
        showNotification(data.error || 'Failed to remove points', 'error');
      }
    } catch (error) {
      console.error('Error removing points:', error);
      showNotification('Error removing points', 'error');
    } finally {
      $btn.prop('disabled', false).html(originalText);
    }
  }

  /**
   * Admin: Set user points to specific amount
   */
  async setAdminPoints() {
    const amount = parseInt($('#adminPointsAmount').val());
    const reason = $('#adminPointsReason').val() || 'Admin set points';

    if (amount === undefined || amount < 0 || isNaN(amount)) {
      showNotification('Please enter a valid amount (0 or greater)', 'error');
      return;
    }

    const $btn = $('.admin-set-points');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html('<i class="bi bi-hourglass"></i> Setting...');

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          points: amount,
          reason: reason
        })
      });

      const data = await response.json();

      if (data.success) {
        showNotification(`Successfully set points to ${amount}`, 'success');
        await this.updatePointsDisplay();
        $('#adminPointsAmount').val('');
        $('#adminPointsReason').val('');
      } else {
        showNotification(data.error || 'Failed to set points', 'error');
      }
    } catch (error) {
      console.error('Error setting points:', error);
      showNotification('Error setting points', 'error');
    } finally {
      $btn.prop('disabled', false).html(originalText);
    }
  }

  /**
   * Refresh user points
   */
  async refreshPoints() {
    await this.updatePointsDisplay();
    showNotification('Points refreshed', 'success');
  }

  /**
   * Admin: Show add points modal (deprecated - keeping for compatibility)
   */
  showAddPointsModal() {
    console.log('Use the admin controls in the points modal instead');
  }

  /**
   * Admin: Show set points modal (deprecated - keeping for compatibility)
   */
  showSetPointsModal() {
    console.log('Use the admin controls in the points modal instead');
  }

  /**
   * Show special point reward notification with animations
   * @param {Object} rewardData - Reward information
   */
  showSpecialRewardNotification(rewardData) {
    const {
      points,
      reason,
      source,
      isMilestone = false,
      milestoneMessage = '',
      totalLikes = 0
    } = rewardData;

    // Remove any existing reward notifications
    $('.special-reward-notification').remove();

    // Create the notification HTML
    const notificationHtml = `
      <div class="special-reward-notification">
        <div class="reward-backdrop"></div>
        <div class="reward-container">
          <div class="reward-content">
            <div class="reward-icon-container">
              <i class="bi bi-star-fill reward-star star-1"></i>
              <i class="bi bi-star-fill reward-star star-2"></i>
              <i class="bi bi-star-fill reward-star star-3"></i>
              <div class="reward-main-icon">
                ${isMilestone ? '<i class="bi bi-trophy-fill"></i>' : '<i class="bi bi-heart-fill"></i>'}
              </div>
            </div>
            <div class="reward-text">
              <h3 class="reward-title">
                ${isMilestone ? '🎉 Milestone Achieved!' : '❤️ Like Reward!'}
              </h3>
              <p class="reward-message">
                ${milestoneMessage || reason}
              </p>
              <div class="reward-points">
                <span class="points-earned">+${points}</span>
                <span class="points-label">points</span>
              </div>
              ${totalLikes > 0 ? `<div class="reward-meta">Total likes: ${totalLikes}</div>` : ''}
            </div>
            <div class="reward-particles">
              <div class="particle particle-1"></div>
              <div class="particle particle-2"></div>
              <div class="particle particle-3"></div>
              <div class="particle particle-4"></div>
              <div class="particle particle-5"></div>
              <div class="particle particle-6"></div>
            </div>
          </div>
          <button class="reward-close-btn" onclick="window.userPointsManager.closeRewardNotification()">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </div>
    `;

    // Add to body
    $('body').append(notificationHtml);

    // Add styles if not already present
    if (!$('#reward-notification-styles').length) {
      this.addRewardNotificationStyles();
    }

    // Trigger entrance animation
    setTimeout(() => {
      $('.special-reward-notification').addClass('show');
    }, 100);

    // Auto-close after 5 seconds
    setTimeout(() => {
      this.closeRewardNotification();
    }, 5000);

    // Update points display
    this.updatePointsDisplay();

    // Play sound effect if available
    this.playRewardSound(isMilestone);
  }

  /**
   * Close the special reward notification
   */
  closeRewardNotification() {
    const $notification = $('.special-reward-notification');
    if ($notification.length) {
      $notification.addClass('hiding');
      setTimeout(() => {
        $notification.remove();
      }, 300);
    }
  }

  /**
   * Add CSS styles for reward notifications
   */
  addRewardNotificationStyles() {
    const styles = `
      <style id="reward-notification-styles">
        .special-reward-notification {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 9999;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }

        .special-reward-notification.show {
          opacity: 1;
          visibility: visible;
        }

        .special-reward-notification.hiding {
          opacity: 0;
          transform: scale(0.8);
        }

        .reward-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
        }

        .reward-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(0.8);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 20px;
          padding: 40px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
          overflow: hidden;
          position: relative;
        }

        .special-reward-notification.show .reward-container {
          transform: translate(-50%, -50%) scale(1);
        }

        .reward-content {
          text-align: center;
          color: white;
          position: relative;
          z-index: 2;
        }

        .reward-icon-container {
          position: relative;
          margin-bottom: 20px;
          height: 80px;
        }

        .reward-main-icon {
          font-size: 3rem;
          color: #ffd700;
          animation: bounceIn 0.8s ease-out;
        }

        .reward-star {
          position: absolute;
          color: #ffd700;
          font-size: 1.2rem;
          animation: twinkle 2s infinite;
        }

        .star-1 {
          top: 10px;
          left: 20px;
          animation-delay: 0.2s;
        }

        .star-2 {
          top: 5px;
          right: 30px;
          animation-delay: 0.5s;
        }

        .star-3 {
          bottom: 10px;
          left: 30px;
          animation-delay: 0.8s;
        }

        .reward-title {
          font-size: 1.8rem;
          font-weight: bold;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .reward-message {
          font-size: 1.1rem;
          margin-bottom: 20px;
          opacity: 0.9;
        }

        .reward-points {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 15px;
          padding: 15px;
          margin-bottom: 15px;
          backdrop-filter: blur(10px);
        }

        .points-earned {
          font-size: 2.5rem;
          font-weight: bold;
          color: #ffd700;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          animation: pointsGlow 2s infinite alternate;
        }

        .points-label {
          display: block;
          font-size: 1rem;
          opacity: 0.8;
          margin-top: 5px;
        }

        .reward-meta {
          font-size: 0.9rem;
          opacity: 0.7;
        }

        .reward-close-btn {
          position: absolute;
          top: 15px;
          right: 15px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 35px;
          height: 35px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }

        .reward-close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }

        .reward-particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .particle {
          position: absolute;
          width: 8px;
          height: 8px;
          background: #ffd700;
          border-radius: 50%;
          opacity: 0;
          animation: particleFloat 3s infinite;
        }

        .particle-1 { left: 10%; animation-delay: 0.2s; }
        .particle-2 { left: 25%; animation-delay: 0.8s; }
        .particle-3 { left: 50%; animation-delay: 0.4s; }
        .particle-4 { left: 75%; animation-delay: 1.2s; }
        .particle-5 { left: 85%; animation-delay: 0.6s; }
        .particle-6 { left: 40%; animation-delay: 1.0s; }

        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        @keyframes pointsGlow {
          0% { text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3); }
          100% { text-shadow: 0 2px 20px rgba(255, 215, 0, 0.8); }
        }

        @keyframes particleFloat {
          0% { transform: translateY(100%); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0; }
        }

        @media (max-width: 480px) {
          .reward-container {
            padding: 30px 20px;
            max-width: 350px;
          }

          .reward-title {
            font-size: 1.5rem;
          }

          .points-earned {
            font-size: 2rem;
          }

          .reward-main-icon {
            font-size: 2.5rem;
          }
        }
      </style>
    `;
    
    $('head').append(styles);
  }

  /**
   * Play reward sound effect
   */
  playRewardSound(isMilestone = false) {
    try {
      // Create audio context for sound effects
      if (window.AudioContext || window.webkitAudioContext) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        if (isMilestone) {
          // Play celebration sound for milestones
          this.playTone(audioContext, 523.25, 0.1, 0.3); // C5
          setTimeout(() => this.playTone(audioContext, 659.25, 0.1, 0.3), 150); // E5
          setTimeout(() => this.playTone(audioContext, 783.99, 0.2, 0.4), 300); // G5
        } else {
          // Play simple notification sound for regular likes
          this.playTone(audioContext, 800, 0.1, 0.2);
        }
      }
    } catch (error) {
      // Silently fail if audio context is not available
      console.log('Audio not available:', error);
    }
  }

  /**
   * Play a tone
   */
  playTone(audioContext, frequency, duration, volume = 0.3) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }
}

// Initialize points manager when DOM is ready
$(document).ready(() => {
  if (window.user && !window.user.isTemporary) {
    window.userPointsManager = new UserPointsManager();
  }
});

// Helper functions for easy access
window.addUserPoints = async (points, reason, source) => {
  if (window.userPointsManager) {
    return await window.userPointsManager.addPoints(points, reason, source);
  }
};

window.checkUserPoints = async (requiredPoints) => {
  if (window.userPointsManager) {
    return await window.userPointsManager.checkPoints(requiredPoints);
  }
  return false;
};

window.refreshUserPoints = () => {
  if (window.userPointsManager) {
    window.userPointsManager.updatePointsDisplay();
  }
};
