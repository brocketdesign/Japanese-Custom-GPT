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
