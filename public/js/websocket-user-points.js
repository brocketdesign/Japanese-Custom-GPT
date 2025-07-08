/**
 * WebSocket handlers for user points system
 * Handles point-related notifications and rewards
 */

class WebSocketUserPointsHandler {
  constructor() {
    this.translations = window.userPointsTranslations || {};
  }

  /**
   * Handle user points related websocket messages
   * @param {Object} data - WebSocket message data
   */
  handlePointsMessage(data) {
    if (!data.notification) return false;

    switch (data.notification.type) {
      case 'likeRewardNotification':
        this.handleLikeRewardNotification(data.notification);
        return true;
      
      case 'dailyBonusClaimed':
        this.handleDailyBonusClaimed(data.notification);
        return true;
      
      case 'firstLoginBonusClaimed':
        this.handleFirstLoginBonusClaimed(data.notification);
        return true;
      
      case 'imageGenerationReward':
        this.handleImageGenerationReward(data.notification);
        return true;
      
      case 'imageGenerationMilestone':
        this.handleImageGenerationMilestone(data.notification);
        return true;
      
      case 'pointsUpdated':
        this.handlePointsUpdated(data.notification);
        return true;
      
      case 'refreshUserPoints':
        this.handleRefreshUserPoints(data.notification);
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Handle like reward notifications
   */
  handleLikeRewardNotification(notification) {
    const { 
      userId, 
      points, 
      reason, 
      source, 
      isMilestone, 
      milestoneMessage, 
      totalLikes 
    } = notification;
    
    // Only show notification for the current user
    if (userId === window.user._id && window.userPointsManager) {
      window.userPointsManager.showSpecialRewardNotification({
        points,
        reason,
        source,
        isMilestone,
        milestoneMessage,
        totalLikes
      });
      
      // Refresh points display
      if (window.refreshUserPoints) {
        window.refreshUserPoints();
      }
    }
  }

  /**
   * Handle daily bonus claimed notifications
   */
  handleDailyBonusClaimed(notification) {
    const { 
      userId, 
      pointsAwarded, 
      currentStreak, 
      newBalance 
    } = notification;
    
    // Only show notification for the current user
    if (userId === window.user._id && window.userPointsManager) {
      window.userPointsManager.showDailyBonusNotification({
        pointsAwarded,
        currentStreak,
        newBalance
      });
      
      // Refresh points display
      if (window.refreshUserPoints) {
        window.refreshUserPoints();
      }
    }
  }

  /**
   * Handle image generation reward notifications
   */
  handleImageGenerationReward(notification) {
    const { 
      userId, 
      points, 
      reason, 
      source,
      imageCount,
      chatId
    } = notification;
    
    // Only show notification for the current user
    if (userId === window.user._id && window.userPointsManager) {
      const rewardMessage = this.translations.image_generation_reward.replace('{points}',points) || 
        `Image generated! +${points} points`;
      
      // Show a simple notification for regular image generation
      if (window.showNotification) {
        window.showNotification(rewardMessage, 'success');
      }
      
      // Update points display
      window.userPointsManager.updatePointsDisplay();
      
      // Refresh points display
      if (window.refreshUserPoints) {
        window.refreshUserPoints();
      }
    }
  }

  /**
   * Handle image generation milestone notifications
   */
  handleImageGenerationMilestone(notification) {
    const { 
      userId, 
      points, 
      reason, 
      source,
      milestone,
      totalImages,
      isMilestone = true
    } = notification;
    
    // Only show notification for the current user
    if (userId === window.user._id && window.userPointsManager) {
      const milestoneMessage = this.translations.image_milestone_message
        ?.replace('{milestone}', milestone)
        ?.replace('{totalImages}', totalImages) ||
        `Milestone achieved! You've generated ${totalImages} images!`;
      
      window.userPointsManager.showSpecialRewardNotification({
        points,
        reason: reason || this.translations.image_milestone_title || 'Image Generation Milestone!',
        source,
        isMilestone: true,
        milestoneMessage,
        totalImages
      });
      
      // Refresh points display
      if (window.refreshUserPoints) {
        window.refreshUserPoints();
      }
    }
  }

  /**
   * Handle general points updated notifications
   */
  handlePointsUpdated(notification) {
    const { userId, newBalance, pointsChange, reason } = notification;
    
    // Only update for the current user
    if (userId === window.user._id && window.userPointsManager) {
      // Update the points display
      window.userPointsManager.updatePointsDisplay();
      
      // Refresh points display
      if (window.refreshUserPoints) {
        window.refreshUserPoints();
      }
      
      // Show notification if there was a change
      if (pointsChange && pointsChange !== 0) {
        const sign = pointsChange > 0 ? '+' : '';
        const message = reason || 
          (pointsChange > 0 ? 
            (this.translations.points_earned || 'Points earned!') : 
            (this.translations.points_spent || 'Points spent!')
          );
        
        if (window.showNotification) {
          window.showNotification(
            `${message} ${sign}${pointsChange} ${this.translations.points || 'points'}`,
            pointsChange > 0 ? 'success' : 'info'
          );
        }
      }
    }
  }

  /**
   * Handle refresh user points notifications
   */
  handleRefreshUserPoints(notification) {
    const { userId } = notification;
    // Only refresh for the current user
    if (userId === window.user._id || !userId) { // Allow refresh for all users if no userId specified
      // Refresh points display
      if (window.refreshUserPoints) {
        window.refreshUserPoints();
      }
      
      // Also update via manager if available
      if (window.userPointsManager) {
        window.userPointsManager.updatePointsDisplay();
      }
    }
  }

  /**
   * Handle first login bonus claimed notifications
   */
  handleFirstLoginBonusClaimed(notification) {
    const { 
      userId, 
      pointsAwarded, 
      newBalance,
      message
    } = notification;
    
    // Only show notification for the current user
    if (userId === window.user._id && window.userPointsManager) {
      window.userPointsManager.showFirstLoginBonusNotification({
        pointsAwarded,
        newBalance,
        message
      });
      
      // Refresh points display
      if (window.refreshUserPoints) {
        window.refreshUserPoints();
      }
    }
  }
}

// Initialize and export the handler
window.WebSocketUserPointsHandler = WebSocketUserPointsHandler;
window.webSocketUserPointsHandler = new WebSocketUserPointsHandler();
