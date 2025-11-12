/**
 * Chat List Manager Module
 * 
 * Handles chat list display, caching, and management
 * - Chat list fetching and pagination
 * - Chat cache management
 * - Chat list rendering
 * - Chat selection and actions
 * - Chat deletion and history
 * 
 * PHASE 5: Modularization of chat-list.js
 * Migrated from: /public/js/chat-list.js
 * 
 * @module ChatListManager
 * @requires ChatState, ChatAPI, ChatEventManager
 */

window.ChatListManager = (function() {
    'use strict';

    // ==================== CONFIGURATION ====================
    const config = {
        chatsPerPage: 10,
        chatListSelector: '#chat-list',
        chatListSpinnerId: 'chat-list-spinner',
        showMoreButtonId: 'show-more-chats',
        chatCountId: 'user-chat-count',
        horizontalMenuSelector: '#horizontal-chat-menu',
        horizontalListSelector: '#horizontal-chat-list',
        horizontalLoadingSelector: '#horizontal-chat-loading',
        chatActionsDropdownId: 'chat-actions-dropdown',
        historyModalId: 'chatHistoryModal',
        historyListId: 'chat-history-list',
        sessionStorageKey: 'chatListCache'
    };

    // ==================== PRIVATE STATE ====================
    const state = {
        cache: {
            data: [],
            currentPage: 1,
            pagination: { total: 0, totalPages: 0 },
            lastUpdated: null
        },
        horizontalMenuInitialized: false
    };

    // ==================== PRIVATE UTILITIES ====================

    /**
     * Get timestamp from chat record
     * @param {object} chat - Chat object
     * @returns {number} Timestamp in milliseconds
     */
    function getChatTimestamp(chat) {
        if (!chat) return 0;

        const candidates = [
            chat.userChatUpdatedAt,
            chat.updatedAt,
            chat.userChatCreatedAt,
            chat.createdAt,
            chat?.lastMessage?.createdAt,
            chat?.lastMessage?.timestamp
        ];

        for (const value of candidates) {
            if (!value) continue;

            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                return value.getTime();
            }

            const time = Date.parse(value);
            if (!Number.isNaN(time)) {
                return time;
            }
        }
        return 0;
    }

    /**
     * Sort chats by updated timestamp
     * @param {array} chats - Array of chat objects
     * @returns {array} Sorted chats
     */
    function sortChatsByUpdatedAt(chats) {
        if (!Array.isArray(chats)) {
            return [];
        }
        return chats.slice().sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
    }

    /**
     * Resolve owner ID from various object ID formats
     * @param {*} value - Object ID value
     * @returns {string} Resolved owner ID
     */
    function resolveOwnerId(value) {
        if (value === undefined || value === null) {
            return '';
        }
        if (typeof value === 'object' && value !== null) {
            if (typeof value.$oid === 'string') {
                return value.$oid;
            }
            if (typeof value.toHexString === 'function') {
                try {
                    return value.toHexString();
                } catch (error) {
                    console.warn('[ChatListManager] Failed to convert ObjectId:', error);
                }
            }
            if (typeof value.toString === 'function') {
                return value.toString();
            }
            return '';
        }
        return value;
    }

    /**
     * Normalize ObjectId from various formats
     * @param {*} value - Object ID value
     * @returns {string} Normalized ID string
     */
    function normalizeObjectId(value) {
        if (value === undefined || value === null) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'object') {
            if (typeof value.$oid === 'string') {
                return value.$oid;
            }
            if (typeof value.toHexString === 'function') {
                try {
                    return value.toHexString();
                } catch (error) {
                    console.warn('[ChatListManager] Failed to normalize ObjectId:', error);
                }
            }
            if (value._bsontype === 'ObjectID' && typeof value.toString === 'function') {
                return value.toString();
            }
            if (typeof value.toString === 'function') {
                return value.toString();
            }
        }
        return String(value);
    }

    /**
     * Normalize chat record
     * @param {object} chat - Chat object
     * @returns {object} Normalized chat
     */
    function normalizeChatRecord(chat) {
        if (!chat || typeof chat !== 'object') {
            return chat;
        }

        const normalized = { ...chat };
        normalized._id = normalizeObjectId(normalized._id);

        if ('chatId' in normalized) {
            normalized.chatId = normalizeObjectId(normalized.chatId);
        }
        if ('userChatId' in normalized) {
            normalized.userChatId = normalizeObjectId(normalized.userChatId);
        }
        if ('userId' in normalized) {
            normalized.userId = resolveOwnerId(normalized.userId);
        }

        if (normalized.lastMessage && typeof normalized.lastMessage === 'object') {
            normalized.lastMessage = { ...normalized.lastMessage };
            if ('createdAt' in normalized.lastMessage && normalized.lastMessage.createdAt) {
                const parsedCreatedAt = Date.parse(normalized.lastMessage.createdAt);
                if (!Number.isNaN(parsedCreatedAt)) {
                    normalized.lastMessage.createdAt = new Date(parsedCreatedAt).toISOString();
                }
            }
            if ('timestamp' in normalized.lastMessage && normalized.lastMessage.timestamp) {
                const parsedTimestamp = Date.parse(normalized.lastMessage.timestamp);
                if (!Number.isNaN(parsedTimestamp)) {
                    normalized.lastMessage.timestamp = new Date(parsedTimestamp).toISOString();
                }
            }
        }

        return normalized;
    }

    // ==================== CACHE MANAGEMENT ====================

    /**
     * Initialize cache from sessionStorage
     */
    function initializeCache() {
        try {
            const cachedData = sessionStorage.getItem(config.sessionStorageKey);
            if (cachedData) {
                state.cache = JSON.parse(cachedData);
                console.log('[ChatListManager] Cache restored from sessionStorage');
            } else {
                resetCache();
            }
        } catch (error) {
            console.warn('[ChatListManager] Cache restore error, resetting:', error);
            resetCache();
        }
    }

    /**
     * Reset cache to empty state
     */
    function resetCache() {
        state.cache = {
            data: [],
            currentPage: 1,
            pagination: { total: 0, totalPages: 0 },
            lastUpdated: null
        };
        sessionStorage.removeItem(config.sessionStorageKey);
        console.log('[ChatListManager] Cache reset');
    }

    /**
     * Save cache to sessionStorage
     */
    function saveCache() {
        try {
            state.cache.lastUpdated = Date.now();
            sessionStorage.setItem(config.sessionStorageKey, JSON.stringify(state.cache));
        } catch (error) {
            console.warn('[ChatListManager] Cache save error:', error);
        }
    }

    /**
     * Clear cache completely
     */
    function clearCache() {
        resetCache();
        console.log('[ChatListManager] Cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {object} Cache stats
     */
    function getCacheStats() {
        return {
            itemCount: state.cache.data.length,
            currentPage: state.cache.currentPage,
            totalPages: state.cache.pagination.totalPages,
            lastUpdated: state.cache.lastUpdated,
            size: new Blob([JSON.stringify(state.cache)]).size
        };
    }

    // ==================== CHAT LIST DISPLAY ====================

    /**
     * Display chat list
     * @param {boolean} reset - Reset cache and list
     * @param {string} userId - User ID
     */
    function displayChatList(reset, userId) {
        const $chatList = $(config.chatListSelector);
        if ($chatList.length === 0) return;

        if (reset) {
            resetCache();
            $chatList.empty();
        }

        state.cache.currentPage = 1;
        fetchChatListData(userId, state.cache.currentPage);
    }

    /**
     * Fetch chat list data from API
     * @param {string} userId - User ID
     * @param {number} page - Page number
     */
    function fetchChatListData(userId, page) {
        const $spinner = $(`#${config.chatListSpinnerId}`);
        $spinner.show();

        // Use ChatAPI if available, otherwise use AJAX
        if (window.ChatAPI && window.ChatAPI.makeRequest) {
            ChatAPI.makeRequest('GET', `/api/chat-list/${userId}`, null, {
                timeout: 30000,
                useCache: page === 1,
                headers: { 'page': page, 'limit': config.chatsPerPage }
            })
                .then(data => handleFetchSuccess(data, page, userId))
                .catch(error => handleFetchError(error))
                .finally(() => $spinner.hide());
        } else {
            // Fallback to direct AJAX
            $.ajax({
                type: 'GET',
                url: `/api/chat-list/${userId}`,
                data: { page: page, limit: config.chatsPerPage },
                success: (data) => {
                    handleFetchSuccess(data, page, userId);
                    $spinner.hide();
                },
                error: (error) => {
                    handleFetchError(error);
                    $spinner.hide();
                }
            });
        }
    }

    /**
     * Handle successful fetch
     * @param {object} data - Response data
     * @param {number} page - Page number
     * @param {string} userId - User ID
     */
    function handleFetchSuccess(data, page, userId) {
        const { chats, pagination } = data;
        const normalizedFetchedChats = Array.isArray(chats)
            ? chats.map(normalizeChatRecord)
            : [];
        const sortedChats = sortChatsByUpdatedAt(normalizedFetchedChats);

        const cacheMap = new Map();
        state.cache.data.forEach(chat => {
            const normalizedChat = normalizeChatRecord(chat);
            if (normalizedChat && normalizedChat._id) {
                cacheMap.set(normalizedChat._id, normalizedChat);
            }
        });

        if (page === 1) {
            sortedChats.forEach(chat => {
                if (!chat || !chat._id) return;
                const existing = cacheMap.get(chat._id);
                cacheMap.set(chat._id, existing ? { ...existing, ...chat } : chat);
            });

            state.cache.data.forEach(chat => {
                const normalizedChat = normalizeChatRecord(chat);
                if (normalizedChat && normalizedChat._id && !cacheMap.has(normalizedChat._id)) {
                    cacheMap.set(normalizedChat._id, normalizedChat);
                }
            });

            const mergedChats = Array.from(cacheMap.values());
            state.cache.data = sortChatsByUpdatedAt(mergedChats);
            $(config.chatListSelector).empty();
        } else {
            sortedChats.forEach(chat => {
                if (!chat || !chat._id) return;
                const existing = cacheMap.get(chat._id);
                if (!existing) {
                    cacheMap.set(chat._id, chat);
                }
            });
            state.cache.data = sortChatsByUpdatedAt(Array.from(cacheMap.values()));
        }

        state.cache.currentPage = page;
        state.cache.pagination = pagination;
        saveCache();

        displayChats(sortedChats, pagination, userId);
    }

    /**
     * Handle fetch error
     * @param {object} error - Error object
     */
    function handleFetchError(error) {
        console.error('[ChatListManager] Error fetching chat list:', error);
        ChatEventManager?.triggerChatEvent?.('chatList:error', { error });
    }

    /**
     * Display chats in the list
     * @param {array} chats - Array of chats to display
     * @param {object} pagination - Pagination info
     * @param {string} userId - User ID
     */
    function displayChats(chats, pagination, userId) {
        const $chatList = $(config.chatListSelector);
        const $loadMoreBtn = $(`#${config.showMoreButtonId}`);

        // Reset loading button state
        if ($loadMoreBtn.length) {
            $loadMoreBtn.removeClass('loading');
            $loadMoreBtn.find('.load-more-content').removeClass('d-none');
            $loadMoreBtn.find('.load-more-loading').addClass('d-none');
            $loadMoreBtn.find('.loading-progress').removeClass('active');
            $loadMoreBtn.prop('disabled', false);
        }

        // Render chats
        chats.forEach((chat) => {
            if ($chatList.find(`[data-id="${chat._id}"]`).length === 0) {
                const isActive = window.chatId ? chat._id === window.chatId : false;
                const chatHtml = constructChatItemHtml(chat, isActive, userId);
                const $chatElement = $(chatHtml).hide();
                $chatList.append($chatElement);
                $chatElement.fadeIn(300);
            }
        });

        updateChatCount(pagination.total);
        checkShowMoreButton(pagination, userId);
        ChatEventManager?.triggerChatEvent?.('chatList:updated', { count: pagination.total });
    }

    /**
     * Update chat count display
     * @param {number} count - Total chat count
     */
    function updateChatCount(count) {
        $(`#${config.chatCountId}`).html(`(${count})`);
    }

    /**
     * Check and render "show more" button
     * @param {object} pagination - Pagination info
     * @param {string} userId - User ID
     */
    function checkShowMoreButton(pagination, userId) {
        $(`#${config.showMoreButtonId}`).remove();

        if (pagination.page < pagination.totalPages) {
            const buttonHtml = `
                <button id="${config.showMoreButtonId}" class="btn shadow-0 w-100 mt-2 chat-load-more-btn">
                    <span class="load-more-content">
                        <i class="bi bi-three-dots me-2"></i>
                        ${window.translations?.loadMore || 'Load More'}
                    </span>
                    <span class="load-more-loading d-none">
                        <div class="loading-dots">
                            <span></span><span></span><span></span>
                        </div>
                        ${window.translations?.loading || 'Loading'}
                    </span>
                    <div class="loading-progress"></div>
                </button>
            `;
            $(config.chatListSelector).append(buttonHtml);

            $(`#${config.showMoreButtonId}`).on('click', function() {
                const $btn = $(this);
                $btn.addClass('loading');
                $btn.find('.load-more-content').addClass('d-none');
                $btn.find('.load-more-loading').removeClass('d-none');
                $btn.prop('disabled', true);
                $btn.find('.loading-progress').addClass('active');

                state.cache.currentPage++;
                fetchChatListData(userId, state.cache.currentPage);
            });
        }
    }

    /**
     * Construct chat item HTML
     * @param {object} chat - Chat object
     * @param {boolean} isActive - Is active chat
     * @param {string} userId - User ID
     * @returns {string} HTML string
     */
    function constructChatItemHtml(chat, isActive, userId) {
        const isOwner = chat.userId === userId;
        const lang = window.lang || 'en';
        let lastMessageTime = '';

        switch (lang) {
            case 'ja':
                lastMessageTime = chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '';
                break;
            case 'en':
                lastMessageTime = chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                break;
            case 'fr':
                lastMessageTime = chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }) : '';
                break;
            default:
                lastMessageTime = chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        }

        return `
            <div class="list-group-item list-group-item-action border-0 p-0 ${isActive ? 'active bg-primary bg-opacity-10' : ''} chat-list item user-chat chat-item-enhanced" 
                data-id="${chat._id}" style="position: relative;">
                <div class="d-flex align-items-center w-100 px-2 py-1">
                    <div class="user-chat-content d-flex align-items-center flex-grow-1"
                    onclick="ChatListManager.handleChatListItemClick(this)" style="cursor: pointer; min-width: 0;">
                        <div class="chat-avatar-container position-relative me-2">
                            <img class="chat-avatar rounded-circle border" 
                                 src="${chat.chatImageUrl || '/img/logo.webp'}" 
                                 alt="${chat.name}"
                                 style="width: 32px; height: 32px; object-fit: cover;">
                            ${isActive ? '<div class="position-absolute top-0 end-0 bg-primary rounded-circle" style="width: 8px; height: 8px; border: 1px solid white;"></div>' : ''}
                        </div>
                        <div class="chat-content flex-grow-1 min-w-0">
                            <div class="d-flex justify-content-between align-items-start">
                                <h6 class="chat-name mb-0 fw-semibold text-truncate" style="max-width: 120px; font-size: 0.8rem; line-height: 1.1;">${chat.name}</h6>
                                <small class="chat-time text-muted flex-shrink-0 ms-1" style="font-size: 0.65rem;">${lastMessageTime}</small>
                            </div>
                            <div class="mt-1">
                                <p class="chat-preview mb-0 text-muted small text-truncate ${chat.lastMessage ? '' : 'd-none'}" 
                                   style="max-width: 130px; font-size: 0.7rem; line-height: 1.2;">
                                    ${chat.lastMessage ? chat.lastMessage.content : ''}
                                </p>
                                ${!chat.lastMessage ? `<small class="text-muted fst-italic" style="font-size: 0.7rem;">${window.translations?.newChat || 'New chat'}</small>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==================== CHAT DELETION ====================

    /**
     * Delete a chat
     * @param {string} chatId - Chat ID to delete
     */
    function deleteChat(chatId) {
        if (!chatId) {
            console.error('[ChatListManager] Invalid chat ID');
            return;
        }

        if (window.ChatAPI && window.ChatAPI.makeRequest) {
            ChatAPI.makeRequest('DELETE', `/api/delete-chat/${chatId}`, { chatId })
                .then(() => {
                    state.cache.data = state.cache.data.filter(c => c._id !== chatId);
                    saveCache();
                    $(config.chatListSelector).find(`[data-id="${chatId}"]`).fadeOut().remove();
                    showNotification?.(window.translations?.deleteSuccess || 'Chat deleted', 'success');
                    ChatEventManager?.triggerChatEvent?.('chat:deleted', { chatId });
                })
                .catch(error => {
                    console.error('[ChatListManager] Delete error:', error);
                    showNotification?.(window.translations?.error || 'Error deleting chat', 'error');
                });
        } else {
            $.ajax({
                url: `/api/delete-chat/${chatId}`,
                type: 'DELETE',
                data: { chatId },
                success: () => {
                    state.cache.data = state.cache.data.filter(c => c._id !== chatId);
                    saveCache();
                    $(config.chatListSelector).find(`[data-id="${chatId}"]`).fadeOut().remove();
                    showNotification?.(window.translations?.deleteSuccess || 'Chat deleted', 'success');
                },
                error: () => {
                    showNotification?.(window.translations?.error || 'Error deleting chat', 'error');
                }
            });
        }
    }

    /**
     * Delete chat history
     * @param {string} userChatId - User chat ID
     */
    function deleteChatHistory(userChatId) {
        if (!userChatId) return;

        $.ajax({
            url: `/api/delete-chat-history/${userChatId}`,
            type: 'DELETE',
            success: () => {
                $(document).find(`.user-chat-history[data-chat="${userChatId}"]`).fadeOut().remove();
                showNotification?.(window.translations?.deleteSuccess || 'History deleted', 'success');
                ChatEventManager?.triggerChatEvent?.('chatHistory:deleted', { userChatId });
            },
            error: () => {
                showNotification?.(window.translations?.error || 'Error deleting history', 'error');
            }
        });
    }

    // ==================== CHAT SELECTION & UPDATES ====================

    /**
     * Handle chat list item click
     * @param {HTMLElement} el - Clicked element
     */
    function handleChatListItemClick(el) {
        const $el = $(el);
        if ($el.hasClass('loading')) return;

        $el.addClass('loading');
        const selectChatId = $el.closest('.user-chat').data('id');

        if (!selectChatId) {
            console.error('[ChatListManager] No chat ID found');
            $el.removeClass('loading');
            return;
        }

        $el.closest('.chat-list.item').addClass('active').siblings().removeClass('active');
        window.chatId = selectChatId;

        // Use ChatAPIFetch if available, otherwise use direct fetch
        if (window.ChatAPIFetch && window.ChatAPIFetch.fetchChatData) {
            ChatAPIFetch.fetchChatData(selectChatId, window.userId, null, () => {
                $el.removeClass('loading');
                updateCurrentChat(selectChatId);
            });
        } else if (typeof fetchChatData === 'function') {
            fetchChatData(selectChatId, window.userId, null, () => {
                $el.removeClass('loading');
                updateCurrentChat(selectChatId);
            });
        }
    }

    /**
     * Update current chat in the list
     * @param {string} chatId - Chat ID
     */
    function updateCurrentChat(chatId) {
        if (!chatId) return;

        let currentChat = state.cache.data.find(c => c._id === chatId);

        if (currentChat) {
            updateChatListDisplay(currentChat);
        } else {
            // Fetch from API
            $.ajax({
                type: 'GET',
                url: `/api/chat-data/${chatId}`,
                success: (data) => {
                    updateChatListDisplay(data);
                },
                error: (error) => {
                    console.error('[ChatListManager] Error fetching chat data:', error);
                }
            });
        }

        // Update horizontal menu
        if ($(config.horizontalMenuSelector).length > 0) {
            updateHorizontalChatMenu(chatId);
        }
    }

    /**
     * Update chat list display for current chat
     * @param {object} currentChat - Current chat object
     */
    function updateChatListDisplay(currentChat) {
        if (!currentChat) return;

        const normalizedChat = normalizeChatRecord({ ...currentChat });
        const nowIsoString = new Date().toISOString();
        normalizedChat.userChatUpdatedAt = nowIsoString;
        normalizedChat.updatedAt = nowIsoString;

        state.cache.data = state.cache.data
            .map(normalizeChatRecord)
            .filter(c => c._id !== normalizedChat._id);

        state.cache.data.unshift(normalizedChat);
        state.cache.data = sortChatsByUpdatedAt(state.cache.data);
        saveCache();

        $(config.chatListSelector).find('.chat-list.item').removeClass('active');
        const currentChatElems = $(config.chatListSelector).find(`[data-id="${normalizedChat._id}"]`);
        if (currentChatElems.length >= 1) {
            currentChatElems.each(function() {
                $(this).remove();
            });
        }

        const chatHtml = constructChatItemHtml(normalizedChat, true, window.userId);
        $(config.chatListSelector).prepend(chatHtml);

        updateNavbarChatActions(normalizedChat);
        ChatEventManager?.triggerChatEvent?.('chat:updated', { chatId: normalizedChat._id });
    }

    /**
     * Update navbar chat actions dropdown
     * @param {object} chat - Chat object
     */
    function updateNavbarChatActions(chat) {
        const $dropdown = $(`#${config.chatActionsDropdownId}`);
        const $menu = $dropdown.find('.dropdown-menu');

        if (!chat) {
            $dropdown.hide();
            return;
        }

        const isOwner = chat.userId === window.userId;
        const dropdownItems = `
            <li>
                <a href="#" class="dropdown-item d-flex align-items-center py-2" 
                   onclick="${!isOwner ? `loadCharacterCreationPage('${chat._id}')` : `loadCharacterUpdatePage('${chat._id}')`}">
                    <i class="bi bi-pencil me-2 text-primary"></i>
                    <span>${!isOwner ? window.translations?.edit : window.translations?.update}</span>
                </a>
            </li>
            <li>
                <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start" onclick="ChatListManager.showChatHistory('${chat._id}')">
                    <i class="bi bi-clock-history me-2 text-info"></i>
                    <span>${window.translations?.chatHistory}</span>
                </button>
            </li>
            <li>
                <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start" 
                        onclick="handleChatReset(this)"
                        data-id="${chat._id}">
                    <i class="bi bi-plus-square me-2 text-success"></i>
                    <span>${window.translations?.newChat}</span>
                </button>
            </li>
            ${window.isAdmin ? `
            <li><hr class="dropdown-divider"></li>
            <li>
                <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start text-warning" 
                        onclick="window.logFullConversation?.('${chat._id}')">
                    <i class="bi bi-terminal me-2"></i>
                    <span>Log Full Conversation</span>
                </button>
            </li>
            ` : ''}
            <li><hr class="dropdown-divider"></li>
            <li class="d-none">
                <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start text-danger" onclick="ChatListManager.deleteChat('${chat._id}')">
                    <i class="bi bi-trash me-2"></i>
                    <span>${window.translations?.delete}</span>
                </button>
            </li>
        `;

        $menu.html(dropdownItems);
        $dropdown.show();
    }

    // ==================== CHAT HISTORY MODAL ====================

    /**
     * Show chat history modal
     * @param {string} chatId - Chat ID
     */
    async function showChatHistory(chatId) {
        if (typeof window.closeAllModals === 'function') {
            window.closeAllModals();
        }

        setTimeout(async () => {
            try {
                const modalElement = document.getElementById(config.historyModalId);
                if (!modalElement) {
                    console.error('[ChatListManager] Modal element not found');
                    return;
                }

                modalElement.style.zIndex = '1060';
                const modal = new bootstrap.Modal(modalElement, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });

                modal.show();

                $(`#${config.historyListId}`).html(`
                    <div class="text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">${window.translations?.loading || 'Loading'}</span>
                        </div>
                        <p class="text-muted mt-3">${window.translations?.loadingHistory || 'Loading history'}</p>
                    </div>
                `);

                const response = await fetch(`/api/chat-history/${chatId}`);
                if (!response.ok) throw new Error('Failed to fetch history');

                const data = await response.json();
                displayChatHistoryInModal(data);
            } catch (error) {
                console.error('[ChatListManager] Error loading history:', error);
                $(`#${config.historyListId}`).html(`
                    <div class="text-center py-5">
                        <i class="bi bi-exclamation-triangle display-4 text-warning mb-3"></i>
                        <p class="text-muted">${window.translations?.historyLoadError || 'Error loading history'}</p>
                    </div>
                `);
            }
        }, 200);
    }

    /**
     * Display chat history in modal
     * @param {array} userChat - Array of user chat records
     */
    function displayChatHistoryInModal(userChat) {
        const $list = $(`#${config.historyListId}`);
        $list.empty();

        if (!userChat || userChat.length === 0) {
            $list.html(`
                <div class="text-center py-4">
                    <i class="bi bi-chat-square-dots display-5 text-muted mb-2"></i>
                    <p class="text-muted small">${window.translations?.noChatHistory || 'No history'}</p>
                </div>
            `);
            return;
        }

        const filteredChats = userChat.filter(c => !c.isWidget);
        if (filteredChats.length === 0) {
            $list.html(`
                <div class="text-center py-4">
                    <i class="bi bi-chat-square-dots display-5 text-muted mb-2"></i>
                    <p class="text-muted small">${window.translations?.noChatHistory || 'No history'}</p>
                </div>
            `);
            return;
        }

        filteredChats.forEach(chat => {
            const chatDate = new Date(chat.updatedAt);
            const formattedDate = chatDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short'
            });
            const formattedTime = chatDate.toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const historyItem = `
                <div class="list-group-item list-group-item-action border-0 p-2 user-chat-history"
                     data-id="${chat.chatId}" 
                     data-chat="${chat._id}" 
                     onclick="ChatListManager.handleUserChatHistoryClick(this)"
                     style="cursor: pointer; border-radius: 8px; margin-bottom: 0.25rem;">
                    <div class="d-flex align-items-center justify-content-between w-100">
                        <div class="d-flex align-items-center flex-grow-1 min-w-0">
                            <div class="chat-history-icon me-2">
                                <i class="bi bi-chat-dots-fill text-primary" style="font-size: 1.2rem;"></i>
                            </div>
                            <div class="chat-history-content min-w-0">
                                <div class="chat-history-date fw-semibold text-dark mb-0" style="font-size: 0.8rem;">${formattedDate}</div>
                                <small class="text-muted" style="font-size: 0.7rem;">${formattedTime}</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            $list.append(historyItem);
        });
    }

    /**
     * Handle user chat history click
     * @param {HTMLElement} el - Clicked element
     */
    function handleUserChatHistoryClick(el) {
        const userChatId = $(el).data('chat');
        const chatId = $(el).data('id');

        if (window.userChatId === userChatId) return;

        window.userChatId = userChatId;
        window.chatId = chatId;

        if (window.postChatData && typeof window.postChatData === 'function') {
            postChatData(chatId, window.userId, userChatId, false, null);
        }
    }

    // ==================== HORIZONTAL CHAT MENU ====================

    /**
     * Initialize horizontal chat menu
     */
    function initializeHorizontalChatMenu() {
        if ($(config.horizontalMenuSelector).length === 0) return;

        if ($('#horizontal-chat-styles').length === 0) {
            $('head').append(`<div id="horizontal-chat-styles">${getHorizontalChatStyles()}</div>`);
        }

        $(config.horizontalMenuSelector).removeClass('d-none');
        displayHorizontalChatList(window.userId);
        state.horizontalMenuInitialized = true;
    }

    /**
     * Display horizontal chat list
     * @param {string} userId - User ID
     * @param {object} options - Options
     */
    function displayHorizontalChatList(userId, options = {}) {
        if (!userId || $(config.horizontalListSelector).length === 0) return;

        const forceReload = options.force === true;

        if (!forceReload && state.cache.data.length > 0) {
            displayChatThumbs(state.cache.data, userId);
            return;
        }

        if (state.horizontalMenuInitialized && !forceReload) return;

        $(config.horizontalLoadingSelector).show();
        $(config.horizontalListSelector).hide();

        $.ajax({
            type: 'GET',
            url: `/api/chat-list/${userId}`,
            data: { page: 1, limit: 20 },
            success: (data) => {
                displayChatThumbs(data.chats, userId);
            },
            error: (error) => {
                console.error('[ChatListManager] Error fetching horizontal list:', error);
                $(config.horizontalLoadingSelector).hide().remove();
                $(config.horizontalListSelector).show();
            }
        });
    }

    /**
     * Display chat thumbnails
     * @param {array} chats - Array of chats
     * @param {string} userId - User ID
     */
    function displayChatThumbs(chats, userId) {
        const $list = $(config.horizontalListSelector);
        $(config.horizontalLoadingSelector).hide().remove();
        $list.show();

        const normalizedChats = Array.isArray(chats)
            ? chats.map(normalizeChatRecord)
            : [];
        const sortedChats = sortChatsByUpdatedAt(normalizedChats);

        if (!sortedChats || sortedChats.length === 0) {
            $list.html(`<div class="text-center py-2 px-3"><small class="text-muted">${window.translations?.noChats || 'No chats'}</small></div>`);
            return;
        }

        $list.empty();

        sortedChats.forEach((chat, index) => {
            const thumbElement = buildChatThumbElement(chat, index);
            $list.append(thumbElement);
        });

        $list.find('.chat-thumb-container').each(function(index) {
            const $thumb = $(this);
            setTimeout(() => {
                $thumb.addClass('animate__bounceIn').css('opacity', '1');
                setTimeout(() => {
                    $thumb.removeClass('animate__bounceIn');
                }, 1000);
            }, index * 100);
        });

        if (window.chatId) {
            updateHorizontalChatMenu(window.chatId);
        }
    }

    /**
     * Build chat thumbnail element
     * @param {object} chat - Chat object
     * @param {number} index - Index
     * @returns {jQuery} jQuery element
     */
    function buildChatThumbElement(chat, index = 0) {
        const animationDelay = `${Math.max(index, 0) * 0.1}s`;
        const ownerId = resolveOwnerId(chat.userId);
        const updatedAt = getChatTimestamp(chat);

        return $(`
            <div class="chat-thumb-container flex-shrink-0 me-2 animate__animated ${chat.nsfw ? 'nsfw-content' : ''}" 
                 data-id="${chat._id}" 
                 data-user-id="${ownerId}"
                 data-updated-at="${updatedAt}"
                 onclick="ChatListManager.handleChatThumbClick(this)"
                 style="cursor: pointer; opacity: 0; animation-delay: ${animationDelay};">
                <div class="chat-thumb-card rounded-circle border border-2 border-light shadow-sm position-relative" 
                     style="width: 60px; height: 60px; background-image: url('${chat.chatImageUrl || '/img/logo.webp'}'); background-size: cover; background-position: center;">
                </div>
                <div class="chat-thumb-name text-center mt-1 d-none">
                    <small class="text-dark fw-medium text-truncate d-block" style="font-size: 0.7rem; max-width: 60px; line-height: 1.1;">${chat.name}</small>
                </div>
            </div>
        `);
    }

    /**
     * Handle chat thumbnail click
     * @param {HTMLElement} el - Clicked element
     */
    function handleChatThumbClick(el) {
        const $el = $(el);
        const selectChatId = $el.data('id');
        const chatOwnerId = $el.data('user-id');
        const activeUserId = window.userId || chatOwnerId;

        if (!selectChatId) {
            console.error('[ChatListManager] No chat ID in thumbnail');
            return;
        }

        window.chatId = selectChatId;

        if (window.fetchChatData && typeof window.fetchChatData === 'function') {
            fetchChatData(selectChatId, activeUserId, null, () => {
                $el.prependTo($el.parent());
            });
        }
    }

    /**
     * Update horizontal chat menu
     * @param {string} currentChatId - Current chat ID
     */
    function updateHorizontalChatMenu(currentChatId) {
        const $list = $(config.horizontalListSelector);
        if ($list.length === 0) return;

        $list.find('.chat-thumb-indicator').remove();
        if (!currentChatId) return;

        let $currentThumb = $list.find(`.chat-thumb-container[data-id="${currentChatId}"]`);
        const chatData = state.cache.data.find(c => c._id === currentChatId);

        if ($currentThumb.length === 0 && chatData) {
            $currentThumb = buildChatThumbElement(chatData, 0);
            $currentThumb.css('opacity', '1');
            $list.append($currentThumb);
        }

        if (!$currentThumb.length) return;

        let chatTimestamp = parseInt($currentThumb.attr('data-updated-at'), 10) || 0;

        if (chatData) {
            $currentThumb.attr('data-user-id', resolveOwnerId(chatData.userId));
            chatTimestamp = getChatTimestamp(chatData);
            $currentThumb.attr('data-updated-at', chatTimestamp);
            $currentThumb.find('.chat-thumb-card').css('background-image', `url('${chatData.chatImageUrl || '/img/logo.webp'}')`);
        }

        const $siblings = $list.children('.chat-thumb-container').not($currentThumb);
        let inserted = false;

        $siblings.each(function() {
            const $sibling = $(this);
            const siblingTimestamp = parseInt($sibling.attr('data-updated-at'), 10) || 0;
            if (chatTimestamp >= siblingTimestamp) {
                $currentThumb.insertBefore($sibling);
                inserted = true;
                return false;
            }
        });

        if (!inserted) {
            $currentThumb.appendTo($list);
        }

        $currentThumb.find('.chat-thumb-card').append(
            '<div class="chat-thumb-indicator position-absolute top-0 end-0 bg-primary rounded-circle" style="width: 12px; height: 12px; border: 2px solid white;"></div>'
        );
    }

    // ==================== STYLES ====================

    /**
     * Get horizontal chat styles
     * @returns {string} CSS styles
     */
    function getHorizontalChatStyles() {
        return `
<style>
#horizontal-chat-menu {
    border-bottom: 1px solid #e9ecef;
}

#horizontal-chat-list {
    scrollbar-width: none;
    -ms-overflow-style: none;
    scroll-behavior: smooth;
    gap: 0.5rem;
}

#horizontal-chat-list::-webkit-scrollbar {
    display: none;
}

#horizontal-chat-loading {
    min-height: 80px;
    width: 100%;
}

.chat-thumb-container {
    flex: 0 0 auto;
    min-width: 60px;
    animation-duration: 0.6s;
    animation-fill-mode: both;
}

.chat-thumb-container:hover .chat-thumb-card {
    transform: translateY(-2px) scale(1.05);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
}

.chat-thumb-card {
    transition: all 0.2s ease;
    cursor: pointer;
    width: 70px !important;
    height: 70px !important;
}

.chat-thumb-name small {
    color: #495057;
}

.chat-thumb-container:hover .chat-thumb-name small {
    color: #007bff;
    transition: color 0.2s ease;
}

.animate__bounceIn {
    animation-name: bounceIn;
    animation-duration: 0.75s;
    animation-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
}

@keyframes bounceIn {
    0%, 20%, 40%, 60%, 80%, to {
        animation-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
    }
    0% {
        opacity: 0;
        transform: scale3d(0.3, 0.3, 0.3);
    }
    20% {
        transform: scale3d(1.1, 1.1, 1.1);
    }
    40% {
        transform: scale3d(0.9, 0.9, 0.9);
    }
    60% {
        opacity: 1;
        transform: scale3d(1.03, 1.03, 1.03);
    }
    80% {
        transform: scale3d(0.97, 0.97, 0.97);
    }
    to {
        opacity: 1;
        transform: scale3d(1, 1, 1);
    }
}

@media (max-width: 768px) {
    #horizontal-chat-menu .container-fluid {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
    }
    .chat-thumb-container {
        min-width: 50px;
    }
    .chat-thumb-name small {
        font-size: 0.6rem !important;
        max-width: 50px !important;
    }
}
</style>
        `;
    }

    // ==================== PUBLIC API ====================

    return {
        // Initialization
        init(options) {
            initializeCache();
            setupEventListeners();
            console.log('[ChatListManager] Initialized');
        },

        // Cache management
        resetCache,
        clearCache,
        getCacheStats,

        // Chat list display
        displayChatList,
        updateCurrentChat,
        updateChatListDisplay,

        // Chat operations
        deleteChat,
        deleteChatHistory,
        handleChatListItemClick,
        handleUserChatHistoryClick,
        handleChatThumbClick,

        // Chat history
        showChatHistory,
        displayChatHistoryInModal,

        // Horizontal menu
        initializeHorizontalChatMenu,
        displayHorizontalChatList,
        displayChatThumbs,
        updateHorizontalChatMenu,

        // Navigation
        updateNavbarChatActions,

        // Statistics
        getStats() {
            return {
                ...getCacheStats(),
                horizontalMenuInitialized: state.horizontalMenuInitialized
            };
        }
    };

    // Setup event listeners
    function setupEventListeners() {
        // Toggle chat list
        $(document).on('click', '#toggle-chat-list', function() {
            if (typeof showDiscovery === 'function') showDiscovery();
            $(config.chatListSelector).show();
            $('.onchat-off, .onchat-on').hide();
            $('.goBackButton')
                .removeClass('d-none')
                .css('opacity', 1)
                .css('pointer-events', 'auto')
                .css('visibility', 'visible')
                .show();
            displayChatList(null, window.userId);
        });

        // Close chat list
        $(document).on('click', '#close-chat-list-btn', function() {
            $(config.chatListSelector).hide();
            $('.onchat-off').show();
            $('.onchat-on').hide();
            if ($(config.horizontalMenuSelector).length) {
                $(config.horizontalMenuSelector).removeClass('d-none');
                displayHorizontalChatList(window.userId);
            }
        });

        // URL check for list=true
        if (window.location.pathname === '/chat/' && window.location.search === '?list=true') {
            setTimeout(() => {
                $('#toggle-chat-list').click();
            }, 500);
        }

        // Initialize on document ready
        $(document).ready(() => {
            if (window.location.pathname.includes('/chat')) {
                initializeHorizontalChatMenu();
            }
        });

        // Clear cache on page unload
        window.addEventListener('beforeunload', () => {
            sessionStorage.removeItem(config.sessionStorageKey);
        });

        console.log('[ChatListManager] Event listeners registered');
    }

})();

// Make globally available for backward compatibility
window.displayChatList = (reset, userId) => ChatListManager.displayChatList(reset, userId);
window.showChatHistory = (chatId) => ChatListManager.showChatHistory(chatId);
window.deleteChatHandler = (chatId) => ChatListManager.deleteChat(chatId);
window.deleteChatHistoryHandler = (userChatId) => ChatListManager.deleteChatHistory(userChatId);
window.handleChatListItemClick = (el) => ChatListManager.handleChatListItemClick(el);
window.updateCurrentChat = (chatId, userId) => ChatListManager.updateCurrentChat(chatId);
window.handleUserChatHistoryClick = (el) => ChatListManager.handleUserChatHistoryClick(el);
window.displayHorizontalChatList = (userId, options) => ChatListManager.displayHorizontalChatList(userId, options);
window.displayChatThumbs = (chats, userId) => ChatListManager.displayChatThumbs(chats, userId);
window.handleChatThumbClick = (el) => ChatListManager.handleChatThumbClick(el);
window.updateHorizontalChatMenu = (chatId) => ChatListManager.updateHorizontalChatMenu(chatId);
window.initializeHorizontalChatMenu = () => ChatListManager.initializeHorizontalChatMenu();
