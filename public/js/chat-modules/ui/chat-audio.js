/**
 * ChatAudio Module
 * Handles audio playback settings and autoplay functionality
 * 
 * @module ChatAudio
 * @requires jQuery
 */

window.ChatAudio = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        audioIconSelector: '#audio-icon',
        audioPlaySelector: '#audio-play',
        storageKey: 'audioAutoPlay'
    };

    // ==================== PRIVATE STATE ====================
    let autoPlay = false;

    /**
     * Initialize audio settings from localStorage
     * @private
     */
    function initializeAudioSettings() {
        autoPlay = localStorage.getItem(config.storageKey) === 'true';
        const $audioIcon = $(config.audioIconSelector);
        
        if (autoPlay) {
            $audioIcon.addClass('bi-volume-up');
            $audioIcon.removeClass('bi-volume-mute');
        } else {
            $audioIcon.removeClass('bi-volume-up');
            $audioIcon.addClass('bi-volume-mute');
        }
    }

    /**
     * Toggle audio autoplay setting
     * @private
     */
    function toggleAudioAutoPlay() {
        autoPlay = !autoPlay;
        localStorage.setItem(config.storageKey, autoPlay);
        
        const $audioIcon = $(config.audioIconSelector);
        if (autoPlay) {
            $audioIcon.removeClass('bi-volume-mute').addClass('bi-volume-up');
        } else {
            $audioIcon.removeClass('bi-volume-up').addClass('bi-volume-mute');
        }
    }

    /**
     * Attach event listeners for audio controls
     * @private
     */
    function attachAudioListeners() {
        $(config.audioPlaySelector).on('click', function() {
            // Check subscription status
            if (typeof subscriptionStatus !== 'undefined' && !subscriptionStatus) {
                if (typeof loadPlanPage === 'function') {
                    loadPlanPage();
                }
                return;
            }
            toggleAudioAutoPlay();
        });
    }

    // ==================== PUBLIC API ====================
    return {
        /**
         * Initialize the audio module
         * @function init
         */
        init: function() {
            initializeAudioSettings();
            attachAudioListeners();
        },

        /**
         * Get current autoplay status
         * @function getAutoPlayStatus
         * @returns {boolean} Current autoplay state
         */
        getAutoPlayStatus: function() {
            return autoPlay;
        },

        /**
         * Set autoplay status
         * @function setAutoPlayStatus
         * @param {boolean} status - The autoplay status to set
         */
        setAutoPlayStatus: function(status) {
            autoPlay = status;
            localStorage.setItem(config.storageKey, autoPlay);
        }
    };
})();
