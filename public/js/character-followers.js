/**
 * Character Followers Management Module
 * Handles following/unfollowing characters and receiving notifications
 */

const CharacterFollowers = {
  /**
   * Cache for follow statuses
   */
  followCache: new Map(),

  /**
   * Toggle follow status for a character
   * @param {string} chatId - The character/chat ID to toggle
   * @param {Function} callback - Optional callback after toggle
   */
  toggleFollow: function(chatId, callback) {
    $.ajax({
      type: 'POST',
      url: '/character-followers/toggle',
      contentType: 'application/json',
      data: JSON.stringify({ chatId }),
      success: function(response) {
        if (response.success) {
          CharacterFollowers.followCache.set(chatId, response.isFollowing);
          
          // Show notification
          const message = response.isFollowing 
            ? (window.translations?.follow?.nowFollowing || 'You are now following this character')
            : (window.translations?.follow?.unfollowed || 'Unfollowed character');
          showNotification(message, 'success');
          
          // Update UI
          CharacterFollowers.updateFollowButton(chatId, response.isFollowing);
          
          if (callback) {
            callback(response);
          }
        } else {
          showNotification(response.message || 'Request failed', 'error');
        }
      },
      error: function(xhr, status, error) {
        console.error('Error toggling follow:', error);
        showNotification('Failed to update follow status', 'error');
      }
    });
  },

  /**
   * Follow a character
   * @param {string} chatId - The character/chat ID to follow
   * @param {Function} callback - Optional callback
   */
  followCharacter: function(chatId, callback) {
    $.ajax({
      type: 'POST',
      url: '/character-followers/follow',
      contentType: 'application/json',
      data: JSON.stringify({ chatId }),
      success: function(response) {
        if (response.success) {
          CharacterFollowers.followCache.set(chatId, true);
          showNotification(window.translations?.follow?.followed || 'Following character', 'success');
          CharacterFollowers.updateFollowButton(chatId, true);
          
          if (callback) {
            callback(response);
          }
        } else if (response.alreadyExists) {
          showNotification(window.translations?.follow?.alreadyFollowing || 'Already following', 'info');
        } else {
          showNotification(response.message || 'Request failed', 'error');
        }
      },
      error: function(xhr, status, error) {
        console.error('Error following character:', error);
        showNotification('Failed to follow character', 'error');
      }
    });
  },

  /**
   * Unfollow a character
   * @param {string} chatId - The character/chat ID to unfollow
   * @param {Function} callback - Optional callback
   */
  unfollowCharacter: function(chatId, callback) {
    $.ajax({
      type: 'POST',
      url: '/character-followers/unfollow',
      contentType: 'application/json',
      data: JSON.stringify({ chatId }),
      success: function(response) {
        if (response.success) {
          CharacterFollowers.followCache.set(chatId, false);
          showNotification(window.translations?.follow?.unfollowed || 'Unfollowed character', 'success');
          CharacterFollowers.updateFollowButton(chatId, false);
          
          if (callback) {
            callback(response);
          }
        } else {
          showNotification(response.message || 'Request failed', 'error');
        }
      },
      error: function(xhr, status, error) {
        console.error('Error unfollowing character:', error);
        showNotification('Failed to unfollow character', 'error');
      }
    });
  },

  /**
   * Check if user is following a character
   * @param {string} chatId - The character/chat ID to check
   * @param {Function} callback - Callback with isFollowing boolean
   */
  checkFollow: function(chatId, callback) {
    // Check cache first
    if (CharacterFollowers.followCache.has(chatId)) {
      const isFollowing = CharacterFollowers.followCache.get(chatId);
      if (callback) callback(isFollowing);
      return;
    }

    $.ajax({
      type: 'GET',
      url: `/character-followers/check/${chatId}`,
      success: function(response) {
        CharacterFollowers.followCache.set(chatId, response.isFollowing);
        if (callback) {
          callback(response.isFollowing);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error checking follow status:', error);
        if (callback) callback(false);
      }
    });
  },

  /**
   * Get follower count for a character
   * @param {string} chatId - The character/chat ID
   * @param {Function} callback - Callback with follower count
   */
  getFollowerCount: function(chatId, callback) {
    $.ajax({
      type: 'GET',
      url: `/character-followers/count/${chatId}`,
      success: function(response) {
        if (callback) {
          callback(response.count);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching follower count:', error);
        if (callback) {
          callback(0);
        }
      }
    });
  },

  /**
   * Get user's followed characters with pagination
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 12)
   * @param {Function} callback - Callback with followed characters data
   */
  getMyFollowedCharacters: function(page = 1, limit = 12, callback) {
    $.ajax({
      type: 'GET',
      url: '/character-followers/my-follows',
      data: { page, limit },
      success: function(response) {
        if (callback) {
          callback(response);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching followed characters:', error);
        if (callback) {
          callback({
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 }
          });
        }
      }
    });
  },

  /**
   * Update follow button UI state
   * @param {string} chatId - The character/chat ID
   * @param {boolean} isFollowing - Whether user is following the character
   */
  updateFollowButton: function(chatId, isFollowing) {
    const button = $(`.character-follow-btn[data-chat-id="${chatId}"]`);
    
    if (button.length === 0) return;

    const icon = button.find('i');
    const FOLLOW_TEXT = window.translations?.follow?.follow || 'Follow';
    const FOLLOWING_TEXT = window.translations?.follow?.following || 'Following';
    const UNFOLLOW_TEXT = window.translations?.follow?.unfollow || 'Unfollow';

    if (isFollowing) {
      button
        .addClass('following')
        .removeClass('not-following')
        .attr('title', UNFOLLOW_TEXT);
      
      if (icon.length) {
        icon.removeClass('bi-bell-slash').addClass('bi-bell-fill');
      }
      
      // Update button text if it has a span
      const span = button.find('span');
      if (span.length) {
        span.text(FOLLOWING_TEXT);
      }
    } else {
      button
        .removeClass('following')
        .addClass('not-following')
        .attr('title', FOLLOW_TEXT);
      
      if (icon.length) {
        icon.removeClass('bi-bell-fill').addClass('bi-bell-slash');
      }
      
      // Update button text if it has a span
      const span = button.find('span');
      if (span.length) {
        span.text(FOLLOW_TEXT);
      }
    }
  },

  /**
   * Initialize follow buttons on page
   * Attach event listeners and set initial states
   */
  initializeFollowButtons: function() {
    $(document).on('click', '.character-follow-btn', function(e) {
      e.preventDefault();
      e.stopPropagation();

      const chatId = $(this).data('chat-id');
      CharacterFollowers.toggleFollow(chatId);
    });
  },

  /**
   * Clear the follow cache
   */
  clearCache: function() {
    CharacterFollowers.followCache.clear();
  }
};

// Make globally available
window.CharacterFollowers = CharacterFollowers;

// Initialize on document ready
$(document).ready(function() {
  CharacterFollowers.initializeFollowButtons();
});
