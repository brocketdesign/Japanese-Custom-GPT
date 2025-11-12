/**
 * Chat Sharing Module
 * 
 * Handles message and chat sharing functionality
 * - Share to social media
 * - Copy share link
 * - Generate shareable content
 * - Share dialog management
 * 
 * @module ChatSharing
 * @requires ChatState
 */

window.ChatSharing = (function() {
    'use strict';

    // Private state
    const sharingState = {
        sharedItems: new Map(),
        shareLinks: new Map()
    };

    // Configuration
    const config = {
        baseShareUrl: window.location.origin,
        shortLinkService: '/api/create-short-link'
    };

    /**
     * Share message
     * @param {string} messageId - Message identifier
     * @param {string} content - Message content
     * @param {object} options - Share options
     * @returns {Promise<object>} Share result
     */
    function shareMessage(messageId, content, options = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                const state = window.ChatState ? window.ChatState.getState() : {};
                const shareData = {
                    title: options.title || 'Shared Chat Message',
                    text: content,
                    chatId: state.chatId || '',
                    messageId: messageId
                };

                // Try native share if available
                if (navigator.share) {
                    await navigator.share(shareData);
                    recordShare(messageId, 'native');
                    resolve({ success: true, method: 'native' });
                    return;
                }

                // Fallback: Show share dialog
                showShareDialog(messageId, shareData)
                    .then(() => resolve({ success: true, method: 'dialog' }))
                    .catch(reject);

            } catch (error) {
                console.error('[ChatSharing] Error sharing message:', error);
                reject(error);
            }
        });
    }

    /**
     * Share entire chat
     * @param {string} chatId - Chat identifier
     * @param {object} options - Share options
     * @returns {Promise<string>} Share URL
     */
    function shareChat(chatId, options = {}) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!chatId) {
                    reject(new Error('Chat ID is required'));
                    return;
                }

                // Generate share link
                const shareUrl = generateShareLink(chatId, options);
                
                // Try to create short link
                let finalUrl = shareUrl;
                if (config.shortLinkService) {
                    try {
                        finalUrl = await createShortLink(shareUrl);
                    } catch (error) {
                        console.warn('[ChatSharing] Could not create short link:', error);
                        // Continue with full URL
                    }
                }

                // Store share link
                shareLinks.set(chatId, finalUrl);
                recordShare(chatId, 'chat');

                resolve(finalUrl);

            } catch (error) {
                console.error('[ChatSharing] Error sharing chat:', error);
                reject(error);
            }
        });
    }

    /**
     * Generate shareable link
     * @param {string} chatId - Chat identifier
     * @param {object} options - Options
     * @returns {string} Share URL
     */
    function generateShareLink(chatId, options = {}) {
        const params = new URLSearchParams();
        params.append('chat', chatId);
        
        if (options.includeMessages) {
            params.append('messages', 'true');
        }
        
        if (options.theme) {
            params.append('theme', options.theme);
        }

        return `${config.baseShareUrl}/shared-chat?${params.toString()}`;
    }

    /**
     * Create short link via API
     * @param {string} longUrl - Long URL
     * @returns {Promise<string>} Short URL
     */
    function createShortLink(longUrl) {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(config.shortLinkService, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url: longUrl })
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.statusText}`);
                }

                const data = await response.json();
                resolve(data.shortUrl || longUrl);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Show share dialog
     * @param {string} itemId - Item identifier
     * @param {object} shareData - Share data
     * @returns {Promise<void>}
     */
    function showShareDialog(itemId, shareData) {
        return new Promise((resolve, reject) => {
            try {
                const dialog = createShareDialogElement(itemId, shareData);
                document.body.appendChild(dialog);

                // Close handler
                const closeHandler = () => {
                    dialog.remove();
                    resolve();
                };

                dialog.addEventListener('close', closeHandler);
                dialog.querySelector('.share-dialog-close').addEventListener('click', closeHandler);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Create share dialog DOM element
     * @param {string} itemId - Item identifier
     * @param {object} shareData - Share data
     * @returns {HTMLElement} Dialog element
     */
    function createShareDialogElement(itemId, shareData) {
        const dialog = document.createElement('div');
        dialog.className = 'chat-share-dialog-overlay';
        dialog.id = `share-dialog-${itemId}`;

        const dialogBox = document.createElement('div');
        dialogBox.className = 'chat-share-dialog';

        const header = document.createElement('div');
        header.className = 'share-dialog-header';
        header.innerHTML = `
            <h2>Share This Message</h2>
            <button class="share-dialog-close" aria-label="Close">✕</button>
        `;

        const content = document.createElement('div');
        content.className = 'share-dialog-content';
        content.innerHTML = `
            <div class="share-options">
                <button class="share-option copy-link" title="Copy Link">
                    <span class="icon">🔗</span>
                    <span class="label">Copy Link</span>
                </button>
                <button class="share-option share-twitter" title="Share on Twitter">
                    <span class="icon">𝕏</span>
                    <span class="label">Twitter</span>
                </button>
                <button class="share-option share-facebook" title="Share on Facebook">
                    <span class="icon">f</span>
                    <span class="label">Facebook</span>
                </button>
                <button class="share-option share-whatsapp" title="Share on WhatsApp">
                    <span class="icon">💬</span>
                    <span class="label">WhatsApp</span>
                </button>
            </div>
            <div class="share-link-section">
                <input type="text" class="share-link-input" readonly>
                <button class="copy-link-btn">Copy</button>
            </div>
        `;

        dialogBox.appendChild(header);
        dialogBox.appendChild(content);

        // Set link value
        const shareUrl = shareData.shareUrl || generateShareLink(shareData.chatId);
        const linkInput = dialogBox.querySelector('.share-link-input');
        linkInput.value = shareUrl;

        // Event handlers
        setupShareDialogHandlers(dialogBox, shareData, shareUrl);

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.dispatchEvent(new Event('close'));
            }
        });

        dialog.appendChild(dialogBox);
        return dialog;
    }

    /**
     * Setup share dialog event handlers
     * @param {HTMLElement} dialogBox - Dialog element
     * @param {object} shareData - Share data
     * @param {string} shareUrl - Share URL
     */
    function setupShareDialogHandlers(dialogBox, shareData, shareUrl) {
        // Copy link
        dialogBox.querySelector('.copy-link')?.addEventListener('click', () => {
            copyToClipboard(shareUrl);
        });

        dialogBox.querySelector('.copy-link-btn')?.addEventListener('click', () => {
            const input = dialogBox.querySelector('.share-link-input');
            input.select();
            copyToClipboard(input.value);
        });

        // Social media shares
        dialogBox.querySelector('.share-twitter')?.addEventListener('click', () => {
            shareToSocial('twitter', shareData, shareUrl);
        });

        dialogBox.querySelector('.share-facebook')?.addEventListener('click', () => {
            shareToSocial('facebook', shareData, shareUrl);
        });

        dialogBox.querySelector('.share-whatsapp')?.addEventListener('click', () => {
            shareToSocial('whatsapp', shareData, shareUrl);
        });
    }

    /**
     * Share to social media platform
     * @param {string} platform - Platform name
     * @param {object} shareData - Share data
     * @param {string} shareUrl - Share URL
     */
    function shareToSocial(platform, shareData, shareUrl) {
        let socialUrl = '';
        const text = encodeURIComponent(shareData.text || shareData.title);
        const url = encodeURIComponent(shareUrl);

        switch (platform) {
            case 'twitter':
                socialUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
                break;
            case 'facebook':
                socialUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case 'whatsapp':
                socialUrl = `https://wa.me/?text=${text}%20${url}`;
                break;
            default:
                return;
        }

        window.open(socialUrl, '_blank', 'width=600,height=400');
        recordShare(shareData.messageId || shareData.chatId, platform);
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<void>}
     */
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }

            showCopyNotification('Copied to clipboard!');
        } catch (error) {
            console.error('[ChatSharing] Copy error:', error);
            showCopyNotification('Failed to copy', 'error');
        }
    }

    /**
     * Show copy notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     */
    function showCopyNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `copy-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ff4444' : '#44ff44'};
            color: ${type === 'error' ? 'white' : 'black'};
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10001;
            animation: slideUp 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Record share event
     * @param {string} itemId - Item identifier
     * @param {string} method - Share method
     */
    function recordShare(itemId, method) {
        try {
            sharingState.sharedItems.set(itemId, {
                timestamp: Date.now(),
                method: method
            });

            // Analytics
            window.dispatchEvent(new CustomEvent('chatShare', {
                detail: { itemId, method }
            }));
        } catch (error) {
            console.error('[ChatSharing] Error recording share:', error);
        }
    }

    /**
     * Get share statistics
     * @returns {object} Share statistics
     */
    function getShareStats() {
        const stats = {
            total: sharingState.sharedItems.size,
            byMethod: {}
        };

        sharingState.sharedItems.forEach(item => {
            stats.byMethod[item.method] = (stats.byMethod[item.method] || 0) + 1;
        });

        return stats;
    }

    // Public API
    return {
        shareMessage,
        shareChat,
        generateShareLink,
        copyToClipboard,
        getShareStats,
        // Debugging
        logShareState: () => {
            console.log('[ChatSharing] State:', {
                sharedItems: sharingState.sharedItems.size,
                shareLinks: sharingState.shareLinks.size,
                stats: getShareStats()
            });
        }
    };
})();

// Module registration
if (window.ChatCore && typeof window.ChatCore.registerModule === 'function') {
    window.ChatCore.registerModule('ChatSharing', window.ChatSharing);
}
