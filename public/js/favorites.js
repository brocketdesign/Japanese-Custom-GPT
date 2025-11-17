/**
 * Favorites Management Module
 * Handles favorite character operations
 */

const Favorites = {
  /**
   * Cache for favorite statuses
   */
  favoriteCache: new Map(),

  /**
   * Toggle favorite status for a chat
   * @param {string} chatId - The chat ID to toggle
   * @param {Function} callback - Optional callback after toggle
   */
  toggleFavorite: function(chatId, callback) {
    $.ajax({
      type: 'POST',
      url: '/favorites/toggle',
      contentType: 'application/json',
      data: JSON.stringify({ chatId }),
      success: function(response) {
        if (response.success) {
          Favorites.favoriteCache.set(chatId, response.isFavorited);
          
          // Show notification
          const message = response.isFavorited 
            ? window.translations.favorite.addedToFavorites 
            : window.translations.favorite.removedFromFavorites;
          showNotification(message, 'success');
          
          // Update UI
          Favorites.updateFavoriteButton(chatId, response.isFavorited);
          
          // Update chat list UI if visible
          if (typeof updateFavoriteCountBadge !== 'undefined') {
            updateFavoriteCountBadge();
          }
          
          if (callback) {
            callback(response);
          }
        } else {
          showNotification(response.message || window.translations.favorite.requestFailed, 'error');
        }
      },
      error: function(xhr, status, error) {
        console.error('Error toggling favorite:', error);
        showNotification(window.translations.favorite.requestFailed, 'error');
      }
    });
  },

  /**
   * Add a chat to favorites
   * @param {string} chatId - The chat ID to favorite
   * @param {Function} callback - Optional callback
   */
  addFavorite: function(chatId, callback) {
    $.ajax({
      type: 'POST',
      url: '/favorites/add',
      contentType: 'application/json',
      data: JSON.stringify({ chatId }),
      success: function(response) {
        if (response.success) {
          Favorites.favoriteCache.set(chatId, true);
          showNotification(window.translations.favorite.favorited, 'success');
          Favorites.updateFavoriteButton(chatId, true);
          
          if (callback) {
            callback(response);
          }
        } else if (response.alreadyExists) {
          showNotification(window.translations.favorite.addedToFavorites, 'info');
        } else {
          showNotification(response.message || window.translations.favorite.requestFailed, 'error');
        }
      },
      error: function(xhr, status, error) {
        console.error('Error adding favorite:', error);
        showNotification(window.translations.favorite.requestFailed, 'error');
      }
    });
  },

  /**
   * Remove a chat from favorites
   * @param {string} chatId - The chat ID to remove from favorites
   * @param {Function} callback - Optional callback
   */
  removeFavorite: function(chatId, callback) {
    $.ajax({
      type: 'POST',
      url: '/favorites/remove',
      contentType: 'application/json',
      data: JSON.stringify({ chatId }),
      success: function(response) {
        if (response.success) {
          Favorites.favoriteCache.set(chatId, false);
          showNotification(window.translations.favorite.unfavorited, 'success');
          Favorites.updateFavoriteButton(chatId, false);
          
          if (callback) {
            callback(response);
          }
        } else {
          showNotification(response.message || window.translations.favorite.requestFailed, 'error');
        }
      },
      error: function(xhr, status, error) {
        console.error('Error removing favorite:', error);
        showNotification(window.translations.favorite.requestFailed, 'error');
      }
    });
  },

  /**
   * Check if a chat is favorited
   * @param {string} chatId - The chat ID to check
   * @param {Function} callback - Callback with isFavorited boolean
   */
  checkFavorite: function(chatId, callback) {
    // Check cache first
    if (Favorites.favoriteCache.has(chatId)) {
      const isFav = Favorites.favoriteCache.get(chatId);
      if (callback) callback(isFav);
      return;
    }

    $.ajax({
      type: 'GET',
      url: `/favorites/check/${chatId}`,
      success: function(response) {
        Favorites.favoriteCache.set(chatId, response.isFavorited);
        if (callback) {
          callback(response.isFavorited);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error checking favorite:', error);
        if (callback) callback(false);
      }
    });
  },

  /**
   * Check favorite status for multiple chats
   * @param {Array<string>} chatIds - Array of chat IDs to check
   * @param {Function} callback - Callback with status map
   */
  checkMultipleFavorites: function(chatIds, callback) {
    const uncachedIds = chatIds.filter(id => !Favorites.favoriteCache.has(id));
    
    if (uncachedIds.length === 0) {
      // All cached, return immediately
      const statusMap = {};
      chatIds.forEach(id => {
        statusMap[id] = Favorites.favoriteCache.get(id);
      });
      if (callback) callback(statusMap);
      return;
    }

    $.ajax({
      type: 'GET',
      url: '/favorites/check-multiple',
      data: { chatIds: uncachedIds.join(',') },
      success: function(response) {
        // Update cache
        Object.entries(response.favorites).forEach(([chatId, isFav]) => {
          Favorites.favoriteCache.set(chatId, isFav);
        });

        // Build complete status map
        const statusMap = {};
        chatIds.forEach(id => {
          statusMap[id] = Favorites.favoriteCache.get(id);
        });

        if (callback) {
          callback(statusMap);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error checking multiple favorites:', error);
        if (callback) {
          const statusMap = {};
          chatIds.forEach(id => {
            statusMap[id] = false;
          });
          callback(statusMap);
        }
      }
    });
  },

  /**
   * Get user's favorite chats with pagination
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 12)
   * @param {Function} callback - Callback with favorites data
   */
  getUserFavorites: function(page = 1, limit = 12, callback) {
    $.ajax({
      type: 'GET',
      url: '/favorites',
      data: { page, limit },
      success: function(response) {
        if (callback) {
          callback(response);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching user favorites:', error);
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
   * Get total favorite count
   * @param {Function} callback - Callback with count
   */
  getFavoriteCount: function(callback) {
    $.ajax({
      type: 'GET',
      url: '/favorites/count',
      success: function(response) {
        if (callback) {
          callback(response.count);
        }
      },
      error: function(xhr, status, error) {
        console.error('Error fetching favorite count:', error);
        if (callback) {
          callback(0);
        }
      }
    });
  },

  /**
   * Update favorite button UI state
   * @param {string} chatId - The chat ID
   * @param {boolean} isFavorited - Whether the chat is favorited
   */
  updateFavoriteButton: function(chatId, isFavorited) {
    const button = $(`[data-favorite-btn="${chatId}"]`);
    
    if (button.length === 0) return;

    if (isFavorited) {
      button
        .addClass('active favorite-active')
        .removeClass('favorite-inactive')
        .attr('title', window.translations.favorite.removeFavorite)
        .find('i').removeClass('bi-star').addClass('bi-star-fill');
    } else {
      button
        .removeClass('active favorite-active')
        .addClass('favorite-inactive')
        .attr('title', window.translations.favorite.addFavorite)
        .find('i').removeClass('bi-star-fill').addClass('bi-star');
    }
  },

  /**
   * Initialize favorite buttons on page
   * Attach event listeners and set initial states
   */
  initializeFavoriteButtons: function() {
    $(document).on('click', '[data-favorite-btn]', function(e) {
      e.preventDefault();
      e.stopPropagation();

      const chatId = $(this).data('favorite-btn');
      Favorites.toggleFavorite(chatId);
    });
  },

  /**
   * Display user's favorite chats in a modal or page
   * @param {Object} options - Display options
   */
  displayUserFavorites: function(options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 12;

    Favorites.getUserFavorites(page, limit, function(response) {
      if (response.data.length === 0) {
        showNotification(window.translations.favorite.noFavorites, 'info');
        return;
      }

      // Display favorites in appropriate UI
      if (options.container) {
        Favorites.renderFavoritesInContainer(response.data, options.container);
      } else {
        console.log('Favorites loaded:', response);
      }
    });
  },

  /**
   * Render favorites in a container
   * @param {Array} favorites - Array of favorite chat objects
   * @param {string|jQuery} container - Container selector or jQuery element
   */
  renderFavoritesInContainer: function(favorites, container) {
    const $container = typeof container === 'string' ? $(container) : container;

    if (!$container.length) {
      console.warn('Container not found for favorites rendering');
      return;
    }

    $container.empty();

    if (favorites.length === 0) {
      $container.html(`<p class="text-center text-muted mt-3">${window.translations.favorite.noFavorites}</p>`);
      return;
    }

    const html = favorites.map(chat => `
      <div class="favorite-chat-item" data-chat-id="${chat._id}">
        <img src="${chat.chatImageUrl}" alt="${chat.chatName}" class="favorite-chat-avatar">
        <div class="favorite-chat-info">
          <h6 class="favorite-chat-name">${chat.chatName}</h6>
          <small class="text-muted">${chat.description || ''}</small>
        </div>
        <button class="btn btn-sm btn-outline-secondary" onclick="loadChatFromFavorite('${chat._id}')">
          <i class="bi bi-chat"></i> Chat
        </button>
      </div>
    `).join('');

    $container.html(html);
  },

  /**
   * Clear the favorite cache
   */
  clearCache: function() {
    Favorites.favoriteCache.clear();
  }
};

// Make globally available
window.Favorites = Favorites;

// Initialize on document ready
$(document).ready(function() {
  Favorites.initializeFavoriteButtons();
});
