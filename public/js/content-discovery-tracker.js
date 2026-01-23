/**
 * Content Discovery Client-Side Tracking
 * 
 * Handles localStorage-based tracking for non-logged-in users
 * Syncs with backend for logged-in users
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'lamix_user_discovery_state';
  const STATE_VERSION = 1;

  /**
   * Content Discovery State Manager
   */
  class ContentDiscoveryTracker {
    constructor() {
      this.state = this.loadState();
    }

    /**
     * Load state from localStorage
     */
    loadState() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return this.getDefaultState();
        }

        const parsed = JSON.parse(stored);
        
        // Check version compatibility
        if (parsed.version !== STATE_VERSION) {
          console.log('[ContentDiscovery] State version mismatch, resetting');
          return this.getDefaultState();
        }

        return parsed;
      } catch (error) {
        console.error('[ContentDiscovery] Error loading state:', error);
        return this.getDefaultState();
      }
    }

    /**
     * Save state to localStorage
     */
    saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (error) {
        console.error('[ContentDiscovery] Error saving state:', error);
      }
    }

    /**
     * Get default state structure
     */
    getDefaultState() {
      return {
        version: STATE_VERSION,
        seenCharacters: {},
        seenImages: {},
        preferredTags: [],
        tagPreferences: {},
        lastUpdated: Date.now()
      };
    }

    /**
     * Get current state for API requests
     */
    getState() {
      return {
        seenCharacters: this.state.seenCharacters || {},
        seenImages: this.state.seenImages || {},
        preferredTags: this.state.preferredTags || [],
        tagPreferences: this.state.tagPreferences || {}
      };
    }

    /**
     * Get state as header value (JSON string)
     */
    getStateHeader() {
      try {
        return JSON.stringify(this.getState());
      } catch (error) {
        console.error('[ContentDiscovery] Error serializing state:', error);
        return '{}';
      }
    }

    /**
     * Record character view
     */
    recordCharacterView(characterId, imageIds = [], tags = []) {
      const now = Date.now();
      const charIdStr = String(characterId);

      // Update seen characters
      if (!this.state.seenCharacters) this.state.seenCharacters = {};
      this.state.seenCharacters[charIdStr] = now;

      // Update seen images
      if (imageIds.length > 0) {
        if (!this.state.seenImages) this.state.seenImages = {};
        if (!this.state.seenImages[charIdStr]) this.state.seenImages[charIdStr] = [];

        imageIds.forEach(imageId => {
          const imgIdStr = String(imageId);
          if (!this.state.seenImages[charIdStr].includes(imgIdStr)) {
            this.state.seenImages[charIdStr].push(imgIdStr);
          }
        });

        // Limit to last 50 images per character
        if (this.state.seenImages[charIdStr].length > 50) {
          this.state.seenImages[charIdStr] = this.state.seenImages[charIdStr].slice(-50);
        }
      }

      // Update tag preferences
      if (tags.length > 0) {
        this.updateTagPreferences(tags, 0.5); // Viewing adds small weight
      }

      this.state.lastUpdated = now;
      this.cleanup();
      this.saveState();
    }

    /**
     * Update tag preferences
     */
    updateTagPreferences(tags, strength = 1.0) {
      if (!this.state.tagPreferences) this.state.tagPreferences = {};
      if (!this.state.preferredTags) this.state.preferredTags = [];

      tags.forEach(tag => {
        const tagLower = String(tag).toLowerCase();
        if (!this.state.tagPreferences[tagLower]) {
          this.state.tagPreferences[tagLower] = 0;
        }
        this.state.tagPreferences[tagLower] += strength;
      });

      // Update preferred tags list (top 10)
      const sortedTags = Object.entries(this.state.tagPreferences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);

      this.state.preferredTags = sortedTags;

      // Decay old preferences
      Object.keys(this.state.tagPreferences).forEach(tag => {
        this.state.tagPreferences[tag] *= 0.95;
        if (this.state.tagPreferences[tag] < 0.1) {
          delete this.state.tagPreferences[tag];
        }
      });

      this.state.lastUpdated = Date.now();
      this.saveState();
    }

    /**
     * Cleanup old data
     */
    cleanup() {
      const now = Date.now();
      const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
      const threshold = now - MONTH_MS;

      // Clean up old seen characters
      if (this.state.seenCharacters) {
        Object.keys(this.state.seenCharacters).forEach(charId => {
          if (this.state.seenCharacters[charId] < threshold) {
            delete this.state.seenCharacters[charId];
            if (this.state.seenImages && this.state.seenImages[charId]) {
              delete this.state.seenImages[charId];
            }
          }
        });
      }
    }

    /**
     * Clear all state
     */
    clear() {
      this.state = this.getDefaultState();
      this.saveState();
    }

    /**
     * Merge state from server response (for temporary users)
     */
    mergeServerState(serverState) {
      if (!serverState) return;

      try {
        // Merge seen characters
        if (serverState.seenCharacters) {
          this.state.seenCharacters = {
            ...this.state.seenCharacters,
            ...serverState.seenCharacters
          };
        }

        // Merge seen images
        if (serverState.seenImages) {
          if (!this.state.seenImages) this.state.seenImages = {};
          Object.keys(serverState.seenImages).forEach(charId => {
            if (!this.state.seenImages[charId]) {
              this.state.seenImages[charId] = [];
            }
            serverState.seenImages[charId].forEach(imgId => {
              if (!this.state.seenImages[charId].includes(imgId)) {
                this.state.seenImages[charId].push(imgId);
              }
            });
          });
        }

        // Merge tag preferences
        if (serverState.tagPreferences) {
          this.state.tagPreferences = {
            ...this.state.tagPreferences,
            ...serverState.tagPreferences
          };
          this.state.preferredTags = serverState.preferredTags || [];
        }

        this.state.lastUpdated = Date.now();
        this.saveState();
      } catch (error) {
        console.error('[ContentDiscovery] Error merging server state:', error);
      }
    }
  }

  // Create global instance
  const tracker = new ContentDiscoveryTracker();

  // Expose to window
  window.ContentDiscovery = {
    tracker,
    
    /**
     * Track character view
     */
    trackCharacterView: function(characterId, imageIds = [], tags = []) {
      tracker.recordCharacterView(characterId, imageIds, tags);
    },

    /**
     * Track tag interaction
     */
    trackTagInteraction: function(tags, strength = 1.0) {
      tracker.updateTagPreferences(tags, strength);
    },

    /**
     * Get state for API requests
     */
    getState: function() {
      return tracker.getState();
    },

    /**
     * Get state as header string
     */
    getStateHeader: function() {
      return tracker.getStateHeader();
    },

    /**
     * Clear all tracking data
     */
    clearState: function() {
      tracker.clear();
    },

    /**
     * Merge state from server
     */
    mergeServerState: function(serverState) {
      tracker.mergeServerState(serverState);
    }
  };

  /**
   * Enhanced fetch wrapper that includes user state
   */
  const originalFetch = window.fetch;
  window.fetchWithState = function(url, options = {}) {
    // Add user state header for API calls
    if (url.includes('/api/gallery/')) {
      if (!options.headers) options.headers = {};
      if (!options.headers['x-user-state']) {
        options.headers['x-user-state'] = tracker.getStateHeader();
      }
    }

    return originalFetch(url, options);
  };

  console.log('[ContentDiscovery] Tracker initialized');

})(window);
