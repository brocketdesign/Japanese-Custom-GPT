/**
 * NSFW Content Manager Module - Phase 4
 * 
 * Centralizes NSFW content handling and visibility management across all dashboard galleries.
 * Consolidates NSFW toggle functions and content filtering logic.
 * 
 * Public API:
 * - toggleImageNSFW(element) - Toggle NSFW flag on image
 * - toggleChatNSFW(element) - Toggle NSFW flag on chat
 * - togglePostNSFW(element) - Toggle NSFW flag on post
 * - toggleVideoNSFW(element) - Toggle NSFW flag on video
 * - updateNSFWContentUI() - Update UI based on NSFW settings
 * - toggleNSFWContent() - Toggle global NSFW visibility
 */

if (typeof DashboardNSFWManager === 'undefined') {
    window.DashboardNSFWManager = {
        // Configuration
        config: {
            storageKey: 'showNSFW',
            defaultShowNSFW: false,
            endpoints: {
                image: '/images/{id}/nsfw',
                chat: '/chat/{id}/nsfw',
                post: '/user/posts/{id}/nsfw',
                video: '/chat/{id}/videos/{videoId}/nsfw'
            }
        },

        // State
        state: {
            showNSFW: false
        },

        /**
         * Initialize NSFW manager
         */
        init: function() {
            // Load NSFW preference from storage
            if (typeof window.user !== 'undefined' && window.user.showNSFW !== undefined) {
                this.state.showNSFW = window.user.showNSFW === true;
                sessionStorage.setItem(this.config.storageKey, this.state.showNSFW.toString());
            } else {
                const stored = sessionStorage.getItem(this.config.storageKey);
                this.state.showNSFW = stored ? stored === 'true' : this.config.defaultShowNSFW;
            }

            console.log(`[NSFWManager] Initialized - showNSFW: ${this.state.showNSFW}`);
        },

        /**
         * Toggle image NSFW status
         * @param {HTMLElement} el - The button element clicked
         */
        toggleImageNSFW: function(el) {
            this._toggleNSFWStatus(el, {
                endpoint: this.config.endpoints.image,
                type: 'image',
                successMessages: {
                    set: window.translations?.setNsfw || 'Marked as NSFW',
                    unset: window.translations?.unsetNsfw || 'Unmarked from NSFW'
                }
            });
        },

        /**
         * Toggle chat NSFW status
         * @param {HTMLElement} el - The button element clicked
         */
        toggleChatNSFW: function(el) {
            this._toggleNSFWStatus(el, {
                endpoint: this.config.endpoints.chat,
                type: 'chat',
                successMessages: {
                    set: window.translations?.setNsfw || 'Chat marked as NSFW',
                    unset: window.translations?.unsetNsfw || 'Chat unmarked from NSFW'
                }
            });
        },

        /**
         * Toggle post NSFW status
         * @param {HTMLElement} el - The button element clicked
         */
        togglePostNSFW: function(el) {
            this._toggleNSFWStatus(el, {
                endpoint: this.config.endpoints.post,
                type: 'post',
                idAttribute: 'data-id',
                successMessages: {
                    set: window.translations?.setNsfw || 'Post marked as NSFW',
                    unset: window.translations?.unsetNsfw || 'Post unmarked from NSFW'
                }
            });
        },

        /**
         * Toggle video NSFW status
         * @param {HTMLElement} el - The button element clicked
         */
        toggleVideoNSFW: function(el) {
            const $btn = $(el);
            const chatId = $btn.data('chat-id');
            const videoId = $btn.data('video-id');

            if (!chatId || !videoId) {
                console.error('[NSFWManager] Missing chatId or videoId');
                return;
            }

            this._toggleNSFWStatus(el, {
                endpoint: `/chat/${chatId}/videos/${videoId}/nsfw`,
                type: 'video',
                idAttribute: 'data-video-id',
                successMessages: {
                    set: window.translations?.setNsfw || 'Video marked as NSFW',
                    unset: window.translations?.unsetNsfw || 'Video unmarked from NSFW'
                }
            });
        },

        /**
         * Generic NSFW toggle function
         * @private
         */
        _toggleNSFWStatus: function(el, options) {
            const isTemporary = !!window.user?.isTemporary;
            if (isTemporary) {
                console.warn('[NSFWManager] Temporary users cannot toggle NSFW');
                if (typeof window.openLoginForm === 'function') {
                    window.openLoginForm();
                }
                return;
            }

            const $btn = $(el);
            const idAttribute = options.idAttribute || 'data-id';
            const id = $btn.data('id');
            const isCurrentlyNSFW = $btn.hasClass('nsfw');
            const newNSFWStatus = !isCurrentlyNSFW;

            // Optimistic UI update
            $btn.toggleClass('nsfw');
            const icon = newNSFWStatus 
                ? '<i class="bi bi-eye-slash-fill"></i>'
                : '<i class="bi bi-eye-fill"></i>';
            $btn.html(icon);

            // Also toggle the container if applicable
            if ($btn.closest('.image-card, .chat-card').length) {
                $btn.closest('.image-card, .chat-card').toggleClass('nsfw-content', newNSFWStatus);
            }

            // Send to server
            const endpoint = options.endpoint.replace('{id}', id);

            $.ajax({
                url: endpoint,
                method: 'PUT',
                xhrFields: {
                    withCredentials: true
                },
                contentType: 'application/json',
                data: JSON.stringify({ nsfw: newNSFWStatus }),
                success: (response) => {
                    // Show success message
                    const message = newNSFWStatus 
                        ? options.successMessages.set
                        : options.successMessages.unset;
                    
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(message, 'success');
                    }

                    // Refresh UI if needed
                    if (typeof window.updateNSFWContentUI === 'function') {
                        window.updateNSFWContentUI();
                    }

                    console.log(`[NSFWManager] Successfully updated ${options.type} NSFW status`);
                },
                error: (xhr, status, error) => {
                    // Revert UI changes
                    $btn.toggleClass('nsfw');
                    const revertedIcon = !newNSFWStatus 
                        ? '<i class="bi bi-eye-slash-fill"></i>'
                        : '<i class="bi bi-eye-fill"></i>';
                    $btn.html(revertedIcon);

                    if ($btn.closest('.image-card, .chat-card').length) {
                        $btn.closest('.image-card, .chat-card').toggleClass('nsfw-content', isCurrentlyNSFW);
                    }

                    // Show error message
                    if (typeof window.showNotification === 'function') {
                        window.showNotification(
                            window.translations?.errorOccurred || 'Error occurred',
                            'error'
                        );
                    }

                    console.error(`[NSFWManager] Failed to toggle NSFW:`, error);
                }
            });
        },

        /**
         * Toggle global NSFW visibility setting
         */
        toggleNSFWContent: function() {
            this.state.showNSFW = !this.state.showNSFW;
            sessionStorage.setItem(this.config.storageKey, this.state.showNSFW.toString());
            
            this.updateContentUI();
            console.log(`[NSFWManager] NSFW visibility toggled to: ${this.state.showNSFW}`);
        },

        /**
         * Update NSFW content visibility in UI
         */
        updateContentUI: function() {
            if (this.state.showNSFW) {
                document.querySelectorAll('.nsfw-content').forEach((el) => {
                    el.classList.add('nsfw-visible');
                    el.classList.remove('nsfw-hidden');
                });
                document.body.classList.add('nsfw-mode');
            } else {
                document.querySelectorAll('.nsfw-content').forEach((el) => {
                    el.classList.remove('nsfw-visible');
                    el.classList.add('nsfw-hidden');
                });
                document.body.classList.remove('nsfw-mode');
            }

            console.log('[NSFWManager] Updated UI for showNSFW:', this.state.showNSFW);
        },

        /**
         * Get current NSFW visibility state
         */
        isNSFWVisible: function() {
            return this.state.showNSFW;
        },

        /**
         * Set NSFW visibility state
         */
        setNSFWVisible: function(visible) {
            this.state.showNSFW = !!visible;
            sessionStorage.setItem(this.config.storageKey, this.state.showNSFW.toString());
            this.updateContentUI();
        }
    };

    // Global wrapper functions for backward compatibility
    window.toggleImageNSFW = function(el) {
        if (!window.DashboardNSFWManager.state.showNSFW) {
            window.DashboardNSFWManager.toggleImageNSFW(el);
        }
    };

    window.toggleChatNSFW = function(el) {
        window.DashboardNSFWManager.toggleChatNSFW(el);
    };

    window.togglePostNSFW = function(el) {
        window.DashboardNSFWManager.togglePostNSFW(el);
    };

    window.toggleVideoNSFW = function(el) {
        window.DashboardNSFWManager.toggleVideoNSFW(el);
    };

    window.toggleNSFWContent = function() {
        window.DashboardNSFWManager.toggleNSFWContent();
    };

    window.updateNSFWContentUI = function() {
        window.DashboardNSFWManager.updateContentUI();
    };
}
