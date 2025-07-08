/**
 * User Points Frontend Management
 * Handles all client-side points operations and UI updates
 */

class UserPointsManager {
  constructor() {
    this.baseUrl = window.API_URL || '';
    this.translations = window.userPointsTranslations || {};
    this.currentUser = window.user || {};
    // Audio management similar to txt2speech.js
    this.audioCache = new Map();
    this.audioPool = [];
    this.audioPermissionGranted = true; // Default to true like txt2speech.js
    this.init();
  }

  init() {
    this.bindEvents();
    this.updatePointsDisplay();
    this.checkDailyBonus();
    this.checkFirstLoginBonus();
    this.initializeAudioPool();
    this.checkAndShowDailyRewardsCalendar();
  }

  /**
   * Initialize audio context with user interaction
   */
  async initAudioContext() {
    try {
      if (!window.AudioContext && !window.webkitAudioContext) {
        return null;
      }
      
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      return this.audioContext;
    } catch (error) {
      console.log('Could not initialize audio context:', error);
      return null;
    }
  }

  bindEvents() {
    // Daily bonus button
    $(document).on('click', '.bonus-btn', (e) => {
      this.claimDailyBonus();
    });

    // First login bonus button
    $(document).on('click', '.first-login-bonus-btn', (e) => {
      this.claimFirstLoginBonus();
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

    // Initialize audio context on any user interaction
    $(document).one('click', async () => {
      await this.initAudioContext();
    });

    // Daily rewards calendar modal events
    $(document).on('click', '.reward-day.today', (e) => {
      const $day = $(e.currentTarget);
      if ($day.hasClass('today') && !$day.hasClass('claimed')) {
        $('#claimTodaysReward').trigger('click');
      }
    });
    
    // Change to bind the event only once per modal instance
    $('#dailyRewardsModal').one('show.bs.modal', () => {
      this.loadDailyRewardsCalendar();
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

        // Update prompts
        if (window.promptManager) {
            window.promptManager.update(this.currentUser._id);
        }

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
    
    $bonusBtn.prop('disabled', true).text(this.translations.claiming || 'Claiming...');

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
          this.translations.daily_bonus_claimed?.replace('{points}', data.pointsAwarded) || 
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
              this.translations.streak_bonus?.replace('{streak}', data.currentStreak) || 
              `Streak bonus! Day ${data.currentStreak}`,
              'info'
            );
          }, 1000);
        }
      } else {
        $bonusBtn.prop('disabled', false).text(originalText);
        showNotification(data.message || this.translations.failed_claim_bonus || 'Failed to claim bonus', 'error');
      }
    } catch (error) {
      console.error('Error claiming daily bonus:', error);
      $bonusBtn.prop('disabled', false).text(originalText);
      showNotification(this.translations.error_claiming_bonus || 'Error claiming bonus', 'error');
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
          <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
        </div>
        <div class="mt-2 text-muted">${this.translations.loading_history || 'Loading history...'}</div>
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
            <div class="mt-2">${this.translations.no_history || 'No transaction history found'}</div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading points history:', error);
      $historyContainer.html(`
        <div class="text-center p-4 text-danger">
          <i class="bi bi-exclamation-circle fs-1"></i>
          <div class="mt-2">${this.translations.error_loading_history || 'Error loading history'}</div>
          <button class="btn btn-sm btn-outline-primary mt-2 refresh-points">
            <i class="bi bi-arrow-clockwise me-1"></i>${this.translations.try_again || 'Try Again'}
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
      <a class="page-link" href="#" data-page="${pagination.currentPage - 1}">${this.translations.previous || 'Previous'}</a>
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
      <a class="page-link" href="#" data-page="${pagination.currentPage + 1}">${this.translations.next || 'Next'}</a>
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
          <span class="visually-hidden">${this.translations.loading || 'Loading...'}</span>
        </div>
        <div class="mt-2 text-muted">${this.translations.loading_leaderboard || 'Loading leaderboard...'}</div>
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
            <div class="mt-2">${this.translations.no_leaderboard || 'No leaderboard data available'}</div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      $leaderboardContainer.html(`
        <div class="text-center p-4 text-danger">
          <i class="bi bi-exclamation-circle fs-1"></i>
          <div class="mt-2">${this.translations.error_loading_leaderboard || 'Error loading leaderboard'}</div>
          <button class="btn btn-sm btn-outline-primary mt-2" onclick="window.userPointsManager.loadLeaderboard()">
            <i class="bi bi-arrow-clockwise me-1"></i>${this.translations.try_again || 'Try Again'}
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
        
        html += `
          <div class="d-flex align-items-center p-3 border-bottom ${isCurrentUser ? 'bg-light' : ''}">
            <div class="flex-shrink-0 me-3">
              ${rankBadge}
            </div>
            <div class="flex-shrink-0 me-3">
              <img src="${avatar}" alt="${user.nickname}" class="rounded-circle" width="40" height="40">
            </div>
            <div class="flex-grow-1">
              <div class="fw-semibold ${isCurrentUser ? 'text-primary' : ''}">${user.nickname || this.translations.anonymous || 'Anonymous'}</div>
              ${user.loginStreak ? `<small class="text-muted"><i class="bi bi-fire"></i> ${user.loginStreak} ${this.translations.day_streak || 'day streak'}</small>` : ''}
            </div>
            <div class="flex-shrink-0">
              <span class="fw-bold text-warning">${user.points || 0}</span>
              <small class="text-muted d-block">${this.translations.points.title || 'points'}</small>
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
    const reason = $('#adminPointsReason').val() || this.translations.admin_adjustment || 'Admin adjustment';

    if (!amount || amount <= 0) {
      showNotification(this.translations.enter_valid_amount || 'Please enter a valid amount', 'error');
      return;
    }

    const $btn = $('.admin-add-points');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html(`<i class="bi bi-hourglass"></i> ${this.translations.adding || 'Adding...'}`);

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
        showNotification(this.translations.successfully_added_points?.replace('{amount}', amount) || `Successfully added ${amount} points`, 'success');
        await this.updatePointsDisplay();
        $('#adminPointsAmount').val('');
        $('#adminPointsReason').val('');
      } else {
        showNotification(data.error || this.translations.failed_add_points || 'Failed to add points', 'error');
      }
    } catch (error) {
      console.error('Error adding points:', error);
      showNotification(this.translations.error_adding_points || 'Error adding points', 'error');
    } finally {
      $btn.prop('disabled', false).html(originalText);
    }
  }

  /**
   * Admin: Remove points from user
   */
  async removeAdminPoints() {
    const amount = parseInt($('#adminPointsAmount').val());
    const reason = $('#adminPointsReason').val() || this.translations.admin_adjustment || 'Admin adjustment';

    if (!amount || amount <= 0) {
      showNotification(this.translations.enter_valid_amount || 'Please enter a valid amount', 'error');
      return;
    }

    const $btn = $('.admin-remove-points');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html(`<i class="bi bi-hourglass"></i> ${this.translations.removing || 'Removing...'}`);

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
        showNotification(this.translations.successfully_removed_points?.replace('{amount}', amount) || `Successfully removed ${amount} points`, 'success');
        await this.updatePointsDisplay();
        $('#adminPointsAmount').val('');
        $('#adminPointsReason').val('');
      } else {
        showNotification(data.error || this.translations.failed_remove_points || 'Failed to remove points', 'error');
      }
    } catch (error) {
      console.error('Error removing points:', error);
      showNotification(this.translations.error_removing_points || 'Error removing points', 'error');
    } finally {
      $btn.prop('disabled', false).html(originalText);
    }
  }

  /**
   * Admin: Set user points to specific amount
   */
  async setAdminPoints() {
    const amount = parseInt($('#adminPointsAmount').val());
    const reason = $('#adminPointsReason').val() || this.translations.admin_set_points || 'Admin set points';

    if (amount === undefined || amount < 0 || isNaN(amount)) {
      showNotification(this.translations.enter_valid_amount_zero || 'Please enter a valid amount (0 or greater)', 'error');
      return;
    }

    const $btn = $('.admin-set-points');
    const originalText = $btn.html();
    $btn.prop('disabled', true).html(`<i class="bi bi-hourglass"></i> ${this.translations.setting || 'Setting...'}`);

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
        showNotification(this.translations.successfully_set_points?.replace('{amount}', amount) || `Successfully set points to ${amount}`, 'success');
        await this.updatePointsDisplay();
        $('#adminPointsAmount').val('');
        $('#adminPointsReason').val('');
      } else {
        showNotification(data.error || this.translations.failed_set_points || 'Failed to set points', 'error');
      }
    } catch (error) {
      console.error('Error setting points:', error);
      showNotification(this.translations.error_setting_points || 'Error setting points', 'error');
    } finally {
      $btn.prop('disabled', false).html(originalText);
    }
  }

  /**
   * Refresh user points
   */
  async refreshPoints() {
    await this.updatePointsDisplay();
    showNotification(this.translations.points_refreshed || 'Points refreshed', 'success');
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
   * Initialize audio pool for sound effects
   */
  initializeAudioPool() {
    // Create initial audio elements in the pool
    for (let i = 0; i < 3; i++) {
      const audio = new Audio();
      this.audioPool.push(audio);
    }
  }

  /**
   * Get an available audio element from the pool
   */
  getAvailableAudio() {
    const idleAudio = this.audioPool.find(a => a.paused && a.currentTime === 0);
    if (idleAudio) {
      return idleAudio;
    } else {
      const newAudio = new Audio();
      this.audioPool.push(newAudio);
      return newAudio;
    }
  }

  /**
   * Request audio permission from user (simplified like txt2speech.js)
   */
  async requestAudioPermission() {
    // Always return true for points system - simpler approach
    return Promise.resolve(true);
  }

  /**
   * Stop all currently playing point sound effects
   */
  stopAllPointsSounds() {
    this.audioPool.forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }

  /**
   * Auto-play reward sound effect (simplified)
   */
  async autoPlayRewardSound(soundType, isMilestone = false, hasStreak = false) {
    try {
      // Stop any currently playing sounds
      this.stopAllPointsSounds();

      // Generate a cache key for this sound
      const cacheKey = `${soundType}_${isMilestone}_${hasStreak}`;
      
      // Check if we have this sound cached
      let audioBlob = this.audioCache.get(cacheKey);
      
      if (!audioBlob) {
        // Generate the sound and cache it
        audioBlob = await this.generatePointsSound(soundType, isMilestone, hasStreak);
        if (audioBlob) {
          this.audioCache.set(cacheKey, audioBlob);
        }
      }

      if (audioBlob) {
        const audio = this.getAvailableAudio();
        audio.src = audioBlob;
        
        // Try to play - if it fails, that's okay
        try {
          await audio.play();
          return true;
        } catch (error) {
          return false;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate sound effects as audio blobs for caching
   */
  async generatePointsSound(soundType, isMilestone = false, hasStreak = false) {
    try {
      const audioContext = await this.initAudioContext();
      if (!audioContext || audioContext.state !== 'running') {
        return null;
      }

      // Create an offline audio context to generate the sound
      const sampleRate = audioContext.sampleRate;
      let duration, frequencies;

      if (soundType === 'reward') {
        if (isMilestone) {
          duration = 0.5;
          frequencies = [
            { freq: 523.25, start: 0, duration: 0.1, volume: 0.3 },      // C5
            { freq: 659.25, start: 0.15, duration: 0.1, volume: 0.3 },   // E5
            { freq: 783.99, start: 0.3, duration: 0.2, volume: 0.4 }     // G5
          ];
        } else {
          duration = 0.1;
          frequencies = [
            { freq: 800, start: 0, duration: 0.1, volume: 0.2 }
          ];
        }
      } else if (soundType === 'daily_bonus') {
        if (hasStreak) {
          duration = 0.55;
          frequencies = [
            { freq: 440, start: 0, duration: 0.1, volume: 0.2 },         // A4
            { freq: 554.37, start: 0.1, duration: 0.1, volume: 0.2 },   // C#5
            { freq: 659.25, start: 0.2, duration: 0.15, volume: 0.3 },  // E5
            { freq: 880, start: 0.35, duration: 0.2, volume: 0.3 }      // A5
          ];
        } else {
          duration = 0.35;
          frequencies = [
            { freq: 523.25, start: 0, duration: 0.2, volume: 0.3 },     // C5
            { freq: 659.25, start: 0.2, duration: 0.15, volume: 0.2 }   // E5
          ];
        }
      }

      const offlineContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        1, sampleRate * duration, sampleRate
      );

      // Generate the sound with multiple tones
      frequencies.forEach(({ freq, start, duration: toneDuration, volume }) => {
        const oscillator = offlineContext.createOscillator();
        const gainNode = offlineContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, start);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, start);
        gainNode.gain.linearRampToValueAtTime(volume, start + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + toneDuration);
        
        oscillator.start(start);
        oscillator.stop(start + toneDuration);
      });

      const renderedBuffer = await offlineContext.startRendering();
      
      // Convert audio buffer to blob
      const audioBlob = this.audioBufferToBlob(renderedBuffer);
      return audioBlob;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert AudioBuffer to Blob URL
   */
  audioBufferToBlob(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let sample;
    let offset = 0;
    let pos = 0;

    // Write WAV header
    const setUint16 = (data) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    const setUint32 = (data) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numberOfChannels);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numberOfChannels); // avg. bytes/sec
    setUint16(numberOfChannels * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Write interleaved data
    for (let i = 0; i < numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numberOfChannels; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
        view.setInt16(pos, sample, true); // write 16-bit sample
        pos += 2;
      }
      offset++; // next source sample
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }

  /**
   * Show special point reward notification with animations
   * @param {Object} rewardData - Reward information
   */
  async showSpecialRewardNotification(rewardData) {
    const {
      points,
      reason,
      source,
      isMilestone = false,
      milestoneMessage = '',
      totalLikes = 0,
      totalImages = 0
    } = rewardData;

    // Remove any existing reward notifications
    $('.special-reward-notification').remove();

    // Try to auto-play sound first
    const soundPlayed = await this.autoPlayRewardSound('reward', isMilestone);

    // Determine icon and title based on source
    let mainIcon = '<i class="bi bi-heart-fill"></i>';
    let titleText = this.translations.like_reward.title || '❤️ Like Reward!'; 
    
    if (source === 'image_milestone' || source === 'image_generation') {
      mainIcon = '<i class="bi bi-image-fill"></i>';
      titleText = isMilestone ? 
        '🎨 ' + (this.translations.image_milestone_title || 'Image Generation Milestone!') :
        '🖼️ ' + (this.translations.image_generation_reward?.replace('{points}', points) || 'Image Generated!');
    }

    // Create the notification HTML with conditional play button
    const notificationHtml = `
      <div class="special-reward-notification">
        <div class="reward-backdrop"></div>
        <div class="reward-container">
          <div class="reward-content">
            <div class="reward-icon-container">
              <i class="bi bi-star-fill reward-star star-1"></i>
              <i class="bi bi-star-fill reward-star star-2"></i>
              <i class="bi bi-star-fill reward-star-3"></i>
              <div class="reward-main-icon">
                ${isMilestone ? '<i class="bi bi-trophy-fill"></i>' : mainIcon}
              </div>
            </div>
            <div class="reward-text">
              <h3 class="reward-title">
                ${isMilestone ? '🎉 ' + (this.translations.milestone_achieved || 'Milestone Achieved!') : titleText}
              </h3>
              <p class="reward-message">
                ${milestoneMessage || reason}
              </p>
              <div class="reward-points">
                <span class="points-earned">+${points}</span>
                <span class="points-label">${this.translations.points.title || 'points'}</span>
              </div>
              ${totalLikes > 0 ? `<div class="reward-meta">${this.translations.total_likes || 'Total likes'}: ${totalLikes}</div>` : ''}
              ${totalImages > 0 ? `<div class="reward-meta">${this.translations.total_images || 'Total images'}: ${totalImages}</div>` : ''}
              ${!soundPlayed ? `
                <div class="reward-actions mt-3">
                  <button class="btn btn-sm btn-outline-light play-reward-sound" data-milestone="${isMilestone}">
                    <i class="bi bi-volume-up"></i> ${this.translations.play_sound || 'Play Sound'}
                  </button>
                </div>
              ` : ''}
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

    // Bind sound play event only if button exists
    $('.play-reward-sound').on('click', (e) => {
      const isMilestone = $(e.target).data('milestone') === 'true' || $(e.target).data('milestone') === true;
      this.playRewardSound(isMilestone);
    });

    // Add styles if not already present
    if (!$('#reward-notification-styles').length) {
      this.addRewardNotificationStyles();
    }

    // Trigger entrance animation
    setTimeout(() => {
      $('.special-reward-notification').addClass('show');
    }, 100);

    // Auto-close after 5 seconds (reduced since sound plays automatically)
    setTimeout(() => {
      this.closeRewardNotification();
    }, 5000);

    // Update points display
    this.updatePointsDisplay();
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
    // Styles are now in the CSS file - no longer needed here
    return;
  }

  /**
   * Show special daily bonus notification with animations
   * @param {Object} bonusData - Daily bonus information
   */
  async showDailyBonusNotification(bonusData) {
    const {
      pointsAwarded,
      currentStreak,
      newBalance
    } = bonusData;

    // Remove any existing daily bonus notifications
    $('.daily-bonus-notification').remove();

    // Try to auto-play sound first
    const soundPlayed = await this.autoPlayRewardSound('daily_bonus', false, currentStreak > 1);

    // Create the notification HTML with conditional play button
    const notificationHtml = `
      <div class="daily-bonus-notification">
        <div class="reward-backdrop"></div>
        <div class="reward-container daily-bonus-container">
          <div class="reward-content">
            <div class="reward-icon-container">
              <i class="bi bi-star-fill reward-star star-1"></i>
              <i class="bi bi-star-fill reward-star star-2"></i>
              <i class="bi bi-star-fill reward-star star-3"></i>
              <div class="reward-main-icon daily-bonus-calendar">
                <i class="bi bi-calendar-check-fill"></i>
                <div class="calendar-day">${new Date().getDate()}</div>
              </div>
              <div class="streak-fire ${currentStreak > 1 ? 'active' : ''}">
                <i class="bi bi-fire"></i>
                ${currentStreak > 1 ? `<span class="streak-number">${currentStreak}</span>` : ''}
              </div>
            </div>
            <div class="reward-text">
              <h3 class="reward-title">
                🌅 ${this.translations.daily_bonus_title || 'Daily Bonus!'}
              </h3>
              <p class="reward-message">
                ${currentStreak > 1 ? 
                  (this.translations.streak_bonus_message?.replace('{streak}', currentStreak) || `${currentStreak} day streak bonus!`) :
                  (this.translations.daily_login_reward || 'Thanks for logging in today!')
                }
              </p>
              <div class="reward-points">
                <span class="points-earned">+${pointsAwarded}</span>
                <span class="points-label">${this.translations.points.title || 'points'}</span>
              </div>
              <div class="reward-meta">
                ${this.translations.new_balance || 'New balance'}: ${newBalance} ${this.translations.points.title || 'points'}
              </div>
              ${currentStreak > 1 ? `
                <div class="streak-info">
                  <i class="bi bi-fire text-warning"></i>
                  ${this.translations.streak_days?.replace('{days}', currentStreak) || `${currentStreak} days streak!`}
                </div>
              ` : ''}
              ${!soundPlayed ? `
                <div class="reward-actions mt-3">
                  <button class="btn btn-sm btn-outline-light play-bonus-sound" data-streak="${currentStreak > 1}">
                    <i class="bi bi-volume-up"></i> ${this.translations.play_sound || 'Play Sound'}
                  </button>
                </div>
              ` : ''}
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
          <button class="reward-close-btn" onclick="window.userPointsManager.closeDailyBonusNotification()">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </div>
    `;

    // Add to body
    $('body').append(notificationHtml);

    // Bind sound play event only if button exists
    $('.play-bonus-sound').on('click', (e) => {
      const hasStreak = $(e.target).data('streak') === 'true' || $(e.target).data('streak') === true;
      this.playDailyBonusSound(hasStreak);
    });

    // Trigger entrance animation
    setTimeout(() => {
      $('.daily-bonus-notification').addClass('show');
    }, 100);

    // Auto-close after 4 seconds (reduced since sound plays automatically)
    setTimeout(() => {
      this.closeDailyBonusNotification();
    }, 4000);

    // Update points display
    this.updatePointsDisplay();
  }

  /**
   * Close the daily bonus notification
   */
  closeDailyBonusNotification() {
    const $notification = $('.daily-bonus-notification');
    if ($notification.length) {
      $notification.addClass('hiding');
      setTimeout(() => {
        $notification.remove();
      }, 300);
    }
  }

  /**
   * Add CSS styles for daily bonus notifications
   */
  addDailyBonusNotificationStyles() {
    // Styles are now in the CSS file - no longer needed here
    return;
  }

  /**
   * Play reward sound effect
   */
  async playRewardSound(isMilestone = false) {
    try {
      const audioContext = await this.initAudioContext();
      if (!audioContext || audioContext.state !== 'running') {
        return;
      }
      
      if (isMilestone) {
        // Play celebration sound for milestones
        this.playTone(audioContext, 523.25, 0.1, 0.3); // C5
        setTimeout(() => this.playTone(audioContext, 659.25, 0.1, 0.3), 150); // E5
        setTimeout(() => this.playTone(audioContext, 783.99, 0.2, 0.4), 300); // G5
      } else {
        // Play simple notification sound for regular likes
        this.playTone(audioContext, 800, 0.1, 0.2);
      }
    } catch (error) {
      // Silently fail if audio context is not available
      console.log('Audio not available:', error);
    }
  }

  /**
   * Play daily bonus sound effect
   */
  async playDailyBonusSound(hasStreak = false) {
    try {
      const audioContext = await this.initAudioContext();
      if (!audioContext || audioContext.state !== 'running') {
        return;
      }
      
      if (hasStreak) {
        // Play enhanced sound for streak bonus
        this.playTone(audioContext, 440, 0.1, 0.2); // A4
        setTimeout(() => this.playTone(audioContext, 554.37, 0.1, 0.2), 100); // C#5
        setTimeout(() => this.playTone(audioContext, 659.25, 0.15, 0.3), 200); // E5
        setTimeout(() => this.playTone(audioContext, 880, 0.2, 0.3), 350); // A5
      } else {
        // Simple daily bonus sound
        this.playTone(audioContext, 523.25, 0.2, 0.3); // C5
        setTimeout(() => this.playTone(audioContext, 659.25, 0.15, 0.2), 200); // E5
      }
    } catch (error) {
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

  /**
   * Show daily bonus notification for debugging purposes (no points awarded)
   */
  debugShowDailyBonusNotification() {
    const mockBonusData = {
      pointsAwarded: 50,
      currentStreak: 5,
      newBalance: 1250
    };
    
    this.showDailyBonusNotification(mockBonusData);
  }

  /**
   * Show special reward notification for debugging purposes (no points awarded)
   */
  debugShowSpecialRewardNotification() {
    const mockRewardData = {
      points: 25,
      reason: 'Post received a like!',
      source: 'like',
      isMilestone: false,
      milestoneMessage: '',
      totalLikes: 15
    };
    
    this.showSpecialRewardNotification(mockRewardData);
  }

  /**
   * Show milestone reward notification for debugging purposes (no points awarded)
   */
  debugShowMilestoneRewardNotification() {
    const mockMilestoneData = {
      points: 100,
      reason: 'Milestone achieved!',
      source: 'image_milestone',
      isMilestone: true,
      milestoneMessage: 'Congratulations! You reached 50 images generated!',
      totalImages: 50
    };
    
    this.showSpecialRewardNotification(mockMilestoneData);
  }
  /**
   * Load and display daily rewards calendar
   */
  async loadDailyRewardsCalendar(showModal = true) {
    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/daily-rewards-calendar`);
      const data = await response.json();
      
      if (data.success) {
        this.renderDailyRewardsStreak(data.streak, data.user);
        
        // Show the modal only if requested
        if (showModal) {
          const modal = new bootstrap.Modal(document.getElementById('dailyRewardsModal'));
          modal.show();
        }
      } else {
        console.error('Failed to load daily rewards streak:', data.error);
      }
    } catch (error) {
      console.error('Error loading daily rewards streak:', error);
    }
  }

  /**
   * Render the daily rewards streak visualization
   */
  renderDailyRewardsStreak(streak, user) {
    const $grid = $('#rewardsCalendarGrid');
    const $streakCount = $('.streak-count');
    const $nextRewardAmount = $('.reward-amount');
    const $todaysRewardSection = $('#todaysRewardSection');
    const $todaysRewardAmount = $('#todaysRewardAmount');
    const $todaysRewardBonus = $('#todaysRewardBonus');
    
    // Update streak display
    $streakCount.text(user.currentStreak || 0);
    
    // Find current claimable reward
    const currentReward = streak.days.find(r => r.canClaim);
    const nextReward = streak.days.find(r => r.status === 'future') || streak.days[streak.days.length - 1];
    
    let nextRewardPoints = nextReward ? nextReward.points : 15;
    $nextRewardAmount.text(nextRewardPoints);
    
    if (currentReward) {
      // Show today's reward section
      $todaysRewardAmount.text(currentReward.points);
      
      // Build bonus text
      let bonusText = '';
      if (currentReward.isWeeklyMilestone) {
        bonusText += '🏆 Weekly Milestone! ';
      }
      if (currentReward.isFinalMilestone) {
        bonusText += '👑 30-Day Champion! ';
      }
      if (user.currentStreak > 0) {
        bonusText += `🔥 Day ${currentReward.day} streak!`;
      }
      
      $todaysRewardBonus.text(bonusText);
      $todaysRewardSection.show();
    } else {
      $todaysRewardSection.hide();
    }
    
    // Render streak grid
    let gridHtml = '';
    
    streak.days.forEach(day => {
      let cardClass = 'streak-day';
      let iconClass = 'bi bi-gift';
      let iconColor = '#6c757d';
      
      if (day.status === 'completed') {
        cardClass += ' completed';
        iconClass = 'bi bi-check-circle-fill';
        iconColor = '#28a745';
      } else if (day.status === 'current' && day.canClaim) {
        cardClass += ' current';
        iconClass = 'bi bi-star-fill';
        iconColor = '#ffd700';
      } else if (day.status === 'future') {
        cardClass += ' future';
        iconClass = 'bi bi-gift';
        iconColor = '#6c757d';
      }
      
      // Add special indicators
      let bonusIndicator = '';
      if (day.isFinalMilestone) {
        bonusIndicator = '<div class="streak-bonus-indicator final">👑</div>';
      } else if (day.isWeeklyMilestone) {
        bonusIndicator = '<div class="streak-bonus-indicator weekly">🏆</div>';
      }
      
      gridHtml += `
        <div class="${cardClass}" data-day="${day.day}" data-points="${day.points}">
          ${bonusIndicator}
          <div class="streak-day-number">${day.day}</div>
          <i class="${iconClass} streak-icon" style="color: ${iconColor};"></i>
          <div class="streak-points">+${day.points}<br><small>points</small></div>
        </div>
      `;
    });
    
    $grid.html(gridHtml);
    
    // Bind claim event
    this.bindDailyRewardClaimEvent();
  }

  /**
   * Debug function to show daily rewards streak data
   */
  debugShowRewardsCalendar() {
    if (!this.currentUser || this.currentUser.isTemporary) {
      console.log('❌ No valid user found');
      return;
    }
    
    console.log('🔍 Debug: Loading daily rewards streak...');
    
    fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/daily-rewards-calendar`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log('✅ Streak data loaded successfully');
          console.log('🔥 Streak Info:', {
            currentStreak: data.streak.currentStreak,
            maxStreak: data.streak.maxStreak,
            totalDays: data.streak.days.length
          });
          
          console.log('👤 User Info:', {
            currentStreak: data.user.currentStreak,
            canClaimToday: data.user.canClaimToday,
            lastBonus: data.user.lastBonus,
            totalPoints: data.user.totalPoints
          });
          
          console.log('📊 Streak Days (first 10):');
          console.table(data.streak.days.slice(0, 10).map(day => ({
            day: day.day,
            points: day.points,
            status: day.status,
            canClaim: day.canClaim,
            isMilestone: day.isMilestone,
            isWeeklyMilestone: day.isWeeklyMilestone,
            isFinalMilestone: day.isFinalMilestone
          })));
          
          // Show current claimable reward
          const currentReward = data.streak.days.find(r => r.canClaim);
          if (currentReward) {
            console.log('🌟 Current Claimable Reward:', currentReward);
          } else {
            console.log('⚠️ No current claimable reward found');
          }
          
          // Force show the modal for testing
          this.renderDailyRewardsStreak(data.streak, data.user);
          const modal = new bootstrap.Modal(document.getElementById('dailyRewardsModal'));
          modal.show();
          
        } else {
          console.error('❌ Failed to load streak:', data.error);
        }
      })
      .catch(error => {
        console.error('❌ Error loading streak:', error);
      });
  }

  /**
   * Bind the claim today's reward event
   */
  bindDailyRewardClaimEvent() {
    $('#claimTodaysReward').off('click').on('click', async (e) => {
      const $btn = $(e.target);
      const originalText = $btn.html();
      
      $btn.prop('disabled', true).html(`
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        ${this.translations.claiming || 'Claiming...'}
      `);
      
      try {
        const today = new Date();
        const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/claim-daily-reward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day: today.getDate(),
            month: today.getMonth(),
            year: today.getFullYear()
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showNotification(`Daily reward claimed! +${data.pointsAwarded} points`, 'success');
          await this.updatePointsDisplay();
          $('#todaysRewardSection').hide();
          await this.showDailyBonusNotification({
            pointsAwarded: data.pointsAwarded,
            currentStreak: data.currentStreak,
            newBalance: data.newBalance
          });
        } else {
          showNotification(data.message || 'Failed to claim reward', 'error');
          $btn.prop('disabled', false).html(originalText);
        }
      } catch (error) {
        console.error('Error claiming daily reward:', error);
        showNotification('Error claiming reward', 'error');
        $btn.prop('disabled', false).html(originalText);
      }
    });
  }

  /**
   * Check and show daily rewards calendar once per day
   */
  async checkAndShowDailyRewardsCalendar() {
    if (!this.currentUser || this.currentUser.isTemporary) return;
    
    const lastCalendarShown = localStorage.getItem(`lastDailyRewardsShown_${this.currentUser._id}`);
    const today = new Date().toISOString().split('T')[0];

    // Only show once per day per user
    if (lastCalendarShown !== today) {
      try {
        // Check if user can claim today's reward
        const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/daily-bonus-status`);
        const data = await response.json();

        if (data.success && data.canClaim) {
          // Show the calendar modal
          setTimeout(() => {
            this.loadDailyRewardsCalendar();
          }, 2000); // Delay 2 seconds after page load
          
          // Mark as shown for today
          localStorage.setItem(`lastDailyRewardsShown_${this.currentUser._id}`, today);
        }
      } catch (error) {
        console.error('Error checking daily rewards calendar:', error);
      }
    }
  }

  /**
   * Check if first login bonus is available
   */
  async checkFirstLoginBonus() {
    if (!$('.first-login-bonus').length) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/first-login-bonus-status`);
      const data = await response.json();
      
      const $firstLoginBonusBtn = $('.first-login-bonus-btn');
      const $firstLoginBonusSection = $('.first-login-bonus');
      
      if (data.isSubscribed && data.canClaim) {
        $firstLoginBonusSection.show();
        $firstLoginBonusBtn.prop('disabled', false)
          .removeClass('bonus-claimed')
          .text(this.translations.claim_first_login_bonus || 'Claim +100 Subscriber Bonus');
      } else {
        $firstLoginBonusSection.hide();
      }
    } catch (error) {
      console.error('Error checking first login bonus:', error);
    }
  }

  /**
   * Claim first login bonus
   */
  async claimFirstLoginBonus() {
    const $firstLoginBonusBtn = $('.first-login-bonus-btn');
    const originalText = $firstLoginBonusBtn.text();
    
    $firstLoginBonusBtn.prop('disabled', true).text(this.translations.claiming || 'Claiming...');

    try {
      const response = await fetch(`${this.baseUrl}/api/user-points/${this.currentUser._id}/first-login-bonus`, {
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
          this.translations.first_login_bonus_claimed?.replace('{points}', data.pointsAwarded) || 
          `Subscriber bonus claimed! +${data.pointsAwarded} points`,
          'success'
        );
        
        // Update points display
        await this.updatePointsDisplay();
        
        // Hide the first login bonus section
        $('.first-login-bonus').hide();
        
        // Show special subscriber bonus notification
        await this.showFirstLoginBonusNotification({
          pointsAwarded: data.pointsAwarded,
          newBalance: data.newBalance
        });
      } else {
        $firstLoginBonusBtn.prop('disabled', false).text(originalText);
        if (data.reason !== 'already_claimed' && data.reason !== 'not_subscribed') {
          showNotification(data.message || this.translations.failed_claim_first_login_bonus || 'Failed to claim subscriber bonus', 'error');
        }
      }
    } catch (error) {
      console.error('Error claiming first login bonus:', error);
      $firstLoginBonusBtn.prop('disabled', false).text(originalText);
      showNotification(this.translations.error_claiming_first_login_bonus || 'Error claiming subscriber bonus', 'error');
    }
  }

  /**
   * Show special first login bonus notification with animations
   * @param {Object} bonusData - First login bonus information
   */
  async showFirstLoginBonusNotification(bonusData) {
    const {
      pointsAwarded,
      newBalance
    } = bonusData;

    // Remove any existing first login bonus notifications
    $('.first-login-bonus-notification').remove();

    // Try to auto-play sound first
    const soundPlayed = await this.autoPlayRewardSound('daily_bonus', false, false);

    // Create the notification HTML with conditional play button
    const notificationHtml = `
      <div class="first-login-bonus-notification">
        <div class="reward-backdrop"></div>
        <div class="reward-container first-login-bonus-container">
          <div class="reward-content">
            <div class="reward-icon-container">
              <i class="bi bi-star-fill reward-star star-1"></i>
              <i class="bi bi-star-fill reward-star star-2"></i>
              <i class="bi bi-star-fill reward-star star-3"></i>
              <div class="reward-main-icon subscriber-crown">
                <i class="bi bi-crown-fill"></i>
              </div>
            </div>
            <div class="reward-text">
              <h3 class="reward-title">
                👑 ${this.translations.subscriber_bonus_title || 'Subscriber Bonus!'}
              </h3>
              <p class="reward-message">
                ${this.translations.subscriber_welcome_message || 'Welcome back, premium member! Here\'s your daily subscriber bonus.'}
              </p>
              <div class="reward-points">
                <span class="points-earned">+${pointsAwarded}</span>
                <span class="points-label">${this.translations.points.title || 'points'}</span>
              </div>
              <div class="reward-meta">
                ${this.translations.new_balance || 'New balance'}: ${newBalance} ${this.translations.points.title || 'points'}
              </div>
              <div class="subscriber-info">
                <i class="bi bi-crown text-warning"></i>
                ${this.translations.subscriber_perks || 'Enjoy exclusive subscriber benefits!'}
              </div>
              ${!soundPlayed ? `
                <div class="reward-actions mt-3">
                  <button class="btn btn-sm btn-outline-light play-bonus-sound">
                    <i class="bi bi-volume-up"></i> ${this.translations.play_sound || 'Play Sound'}
                  </button>
                </div>
              ` : ''}
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
          <button class="reward-close-btn" onclick="window.userPointsManager.closeFirstLoginBonusNotification()">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </div>
    `;

    // Add to body
    $('body').append(notificationHtml);

    // Bind sound play event only if button exists
    $('.play-bonus-sound').on('click', () => {
      this.playDailyBonusSound(false);
    });

    // Trigger entrance animation
    setTimeout(() => {
      $('.first-login-bonus-notification').addClass('show');
    }, 100);

    // Auto-close after 5 seconds
    setTimeout(() => {
      this.closeFirstLoginBonusNotification();
    }, 5000);

    // Update points display
    this.updatePointsDisplay();
  }

  /**
   * Close the first login bonus notification
   */
  closeFirstLoginBonusNotification() {
    const $notification = $('.first-login-bonus-notification');
    if ($notification.length) {
      $notification.addClass('hiding');
      setTimeout(() => {
        $notification.remove();
      }, 300);
    }
  }
}

// Function to check and claim first login bonus for subscribers
async function checkAndClaimFirstLoginBonus() {
    // Only proceed if user is subscribed and not temporary
    if (!subscriptionStatus || window.user.isTemporary) {
        return;
    }

    // Check localStorage to see if we already attempted today
    const today = new Date().toDateString();
    const lastAttemptDate = localStorage.getItem('firstLoginBonusAttempt');
    
    // If we already attempted today, don't try again
    if (lastAttemptDate === today) {
        return;
    }

    // Use the existing UserPointsManager if available
    if (userPointsManager) {
        try {
            await userPointsManager.claimFirstLoginBonus();
            console.log('First login bonus claimed successfully via UserPointsManager.');
            // Save attempt date regardless of success
            localStorage.setItem('firstLoginBonusAttempt', today);
        } catch (error) {
            console.error('Error claiming first login bonus via UserPointsManager:', error);
            localStorage.setItem('firstLoginBonusAttempt', today);
        }
    }
}

// Open the modal to get claim daily bonus, once the user is logged in and only once a day
$(document).ready(() => {

  if (window.user && !window.user.isTemporary) {
    window.userPointsManager = new UserPointsManager();
  }

  if (window.user && !window.user.isTemporary) {
    const lastBonusClaimed = localStorage.getItem('lastBonusClaimed');
    const today = new Date().toISOString().split('T')[0];

    if (!lastBonusClaimed || lastBonusClaimed !== today) {
      $('.bonus-btn').trigger('click');
      localStorage.setItem('lastBonusClaimed', today);
    }
  }

  // Check for first login bonus after UserPointsManager is initialized
  setTimeout(() => {
      checkAndClaimFirstLoginBonus();
  }, 2000); 
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

//[DEBUG] Global debug helper functions
window.debugDailyBonus = () => {
  if (window.userPointsManager) {
    window.userPointsManager.debugShowDailyBonusNotification();
  }
};

window.debugSpecialReward = () => {
  if (window.userPointsManager) {
    window.userPointsManager.debugShowSpecialRewardNotification();
  }
};

window.debugMilestoneReward = () => {
  if (window.userPointsManager) {
    window.userPointsManager.debugShowMilestoneRewardNotification();
  }
};

window.debugRewardsCalendar = () => {
  if (window.userPointsManager) {
    window.userPointsManager.debugShowRewardsCalendar();
  }
};
//[DEBUG] End of global debug helpers