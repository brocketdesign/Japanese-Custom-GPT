var chatsPerPage = 10;
let initHorizontalChatMenu = false;

// Cache object structure
let chatCache = {
    data: [],
    currentPage: 1,
    pagination: { total: 0, totalPages: 0 },
    lastUpdated: null
};

// Reset cache on page refresh
window.addEventListener('beforeunload', function() {
    sessionStorage.removeItem('chatListCache');
});

// Initialize cache from sessionStorage or create new
function initializeCache() {
    const cachedData = sessionStorage.getItem('chatListCache');
    if (cachedData) {
        try {
            chatCache = JSON.parse(cachedData);
        } catch (e) {
            console.warn('Invalid cache data, resetting cache');
            resetCache();
        }
    } else {
        resetCache();
    }
}

initializeCache();
displayChatList(true, userId);

// Reset cache
function resetCache() {
    chatCache = {
        data: [],
        currentPage: 1,
        pagination: { total: 0, totalPages: 0 },
        lastUpdated: null
    };
    sessionStorage.removeItem('chatListCache');
}

// Save cache to sessionStorage
function saveCache() {
    chatCache.lastUpdated = Date.now();
    sessionStorage.setItem('chatListCache', JSON.stringify(chatCache));
}

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
        if (!value) {
            continue;
        }

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

function sortChatsByUpdatedAt(chats) {
    if (!Array.isArray(chats)) {
        return [];
    }
    return chats.slice().sort((a, b) => getChatTimestamp(b) - getChatTimestamp(a));
}

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
                console.warn('Failed to convert ObjectId via toHexString', error);
            }
        }
        if (typeof value.toString === 'function') {
            return value.toString();
        }
        return '';
    }
    return value;
}

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
                console.warn('Failed to normalize ObjectId via toHexString', error);
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

// Event listener for menu chat buttons
$(document).on('click','#toggle-chat-list',function(){

    showDiscovery();
    $('#chat-list').show();
    $('.onchat-off, .onchat-on').hide();

    $('.goBackButton')
    .removeClass('d-none')
    .css('opacity', 1)
    .css('pointer-events', 'auto')
    .css('visibility', 'visible')
    .show();

    displayChatList(null, userId);
});

// Close chat list when clicking #close-chat-list-btn
$(document).on('click','#close-chat-list-btn',function(){
    $('#chat-list').hide();
    $('.onchat-off').show();
    $('.onchat-on').hide();
    hideNavbarChatActions();
    if ($('#horizontal-chat-menu').length) {
        $('#horizontal-chat-menu').removeClass('d-none');
        displayHorizontalChatList(userId);
    }
});
// if the  url is like '/chat/?list=true'
if (window.location.pathname === '/chat/' && window.location.search === '?list=true') {
    setTimeout(() => {
        $('#toggle-chat-list').click()
    }, 500);
}

// Delete chat function
function deleteChatHandler(chatId) {
    const userId = user._id;
    
    $.ajax({
        url: `/api/delete-chat/${chatId}`,
        type: 'DELETE',
        data: { chatId },
        success: function(response) {
            renderChatList(userId);
            showNotification(translations.deleteSuccess, 'success');
        },
        error: function(xhr, status, error) {
            showNotification(translations.error, 'error');
        }
    });
}

// Delete chat history function
function deleteChatHistoryHandler(selectedChatId) {
    $.ajax({
        url: `/api/delete-chat-history/${selectedChatId}`,
        type: 'DELETE',
        success: function(response) {
            $(document).find(`.user-chat-history[data-chat="${selectedChatId}"]`).fadeOut().remove();
            showNotification(translations.deleteSuccess, 'success');
        },
        error: function(xhr, status, error) {
            showNotification(translations.error, 'error');
        }
    });
}

// Main function to display chat list
function displayChatList(reset, userId) {
    if ($('#chat-list').length === 0) return;
    if (reset) {
        resetCache();
        $('#chat-list').empty();
    }

    chatCache.currentPage = 1;
    fetchChatListData(chatCache.currentPage);

    function fetchChatListData(page) {
        $('#chat-list-spinner').show();
        
        $.ajax({
            type: 'GET',
            url: '/api/chat-list/' + userId,
            data: { page: page, limit: chatsPerPage },
            success: function(data) {
                const { chats, pagination } = data;
                const normalizedFetchedChats = Array.isArray(chats)
                    ? chats.map(normalizeChatRecord)
                    : [];
                const sortedChats = sortChatsByUpdatedAt(normalizedFetchedChats);
                let chatsToRender = [];

                const cacheMap = new Map();
                chatCache.data.forEach(chat => {
                    const normalizedChat = normalizeChatRecord(chat);
                    if (normalizedChat && normalizedChat._id) {
                        cacheMap.set(normalizedChat._id, normalizedChat);
                    }
                });

                if (page === 1) {
                    sortedChats.forEach(chat => {
                        if (!chat || !chat._id) {
                            return;
                        }
                        const existing = cacheMap.get(chat._id);
                        cacheMap.set(chat._id, existing ? { ...existing, ...chat } : chat);
                    });

                    // Retain any cached entries that were added client-side but not yet returned by the server
                    chatCache.data.forEach(chat => {
                        const normalizedChat = normalizeChatRecord(chat);
                        if (normalizedChat && normalizedChat._id && !cacheMap.has(normalizedChat._id)) {
                            cacheMap.set(normalizedChat._id, normalizedChat);
                        }
                    });

                    const mergedChats = Array.from(cacheMap.values());
                    chatCache.data = sortChatsByUpdatedAt(mergedChats);
                    $('#chat-list').empty();
                    chatsToRender = chatCache.data;
                } else {
                    const newChats = [];
                    sortedChats.forEach(chat => {
                        if (!chat || !chat._id) {
                            return;
                        }
                        const existing = cacheMap.get(chat._id);
                        if (existing) {
                            cacheMap.set(chat._id, { ...existing, ...chat });
                        } else {
                            cacheMap.set(chat._id, chat);
                            newChats.push(chat);
                        }
                    });

                    chatCache.data = sortChatsByUpdatedAt(Array.from(cacheMap.values()));
                    chatsToRender = newChats;
                }

                chatCache.currentPage = page;
                chatCache.pagination = pagination;
                saveCache();
                
                displayChats(chatsToRender, pagination);
            },
            error: function(xhr, status, error) {
                console.error('Error fetching chat list:', error);
            },
            complete: function() {
                $('#chat-list-spinner').hide();
            }
        });
    }

    function displayChats(chats, pagination) {
        // Reset loading button state
        const $loadMoreBtn = $('#show-more-chats');
        if ($loadMoreBtn.length) {
            $loadMoreBtn.removeClass('loading');
            $loadMoreBtn.find('.load-more-content').removeClass('d-none');
            $loadMoreBtn.find('.load-more-loading').addClass('d-none');
            $loadMoreBtn.find('.loading-progress').removeClass('active');
            $loadMoreBtn.prop('disabled', false);
        }
        
        // Don't append if these are duplicate chats
        chats.forEach(function(chat){
            // Check if this chat is already displayed
            if ($(`#chat-list .chat-list.item[data-id="${chat._id}"]`).length === 0) {
                const isActive = chatId ? chat._id === chatId : false;
                var chatHtml = constructChatItemHtml(chat, isActive);
                // Add smooth fade-in animation for new chats
                const $chatElement = $(chatHtml).hide();
                $('#chat-list').append($chatElement);
                $chatElement.fadeIn(300);
            }
        });
        
        updateCurrentChat(chatId, userId);
        updateChatCount(pagination.total);
        checkShowMoreButton(pagination);
    }

    function updateChatCount(count) {
        $('#user-chat-count').html('(' + count + ')');
    }

    function checkShowMoreButton(pagination) {
        $('#show-more-chats').remove(); 
        if (pagination.page < pagination.totalPages) {
            $('#chat-list').append(
                `<button id="show-more-chats" class="btn shadow-0 w-100 mt-2 chat-load-more-btn">
                    <span class="load-more-content">
                        <i class="bi bi-three-dots me-2"></i>
                        ${translations.loadMore}
                    </span>
                    <span class="load-more-loading d-none">
                        <div class="loading-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        ${translations.loading}
                    </span>
                    <div class="loading-progress"></div>
                </button>`
            );
            $('#show-more-chats').off().on('click', function() {
                const $btn = $(this);
                
                // Start loading state
                $btn.addClass('loading');
                $btn.find('.load-more-content').addClass('d-none');
                $btn.find('.load-more-loading').removeClass('d-none');
                $btn.prop('disabled', true);
                
                // Start progress animation
                $btn.find('.loading-progress').addClass('active');
                
                chatCache.currentPage++;
                fetchChatListData(chatCache.currentPage);
            });
        }
    }
}

// Function to update navbar chat actions dropdown
function updateNavbarChatActions(chat) {
    const dropdown = $('#chat-actions-dropdown');
    const dropdownMenu = dropdown.find('.dropdown-menu');

    if (!chat) {
        dropdown.hide();
        return;
    }
    
    const isOwner = chat.userId === userId;
    
    const dropdownItems = `
        <li>
            <a href="#" class="dropdown-item d-flex align-items-center py-2" 
               onclick="${!isOwner ? `loadCharacterCreationPage('${chat._id}')` : `loadCharacterUpdatePage('${chat._id}')`}">
                <i class="bi bi-pencil me-2 text-primary"></i>
                <span>${!isOwner ? window.translations.edit : window.translations.update}</span>
            </a>
        </li>
        <li>
            <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start" onclick="showChatHistory('${chat._id}')">
                <i class="bi bi-clock-history me-2 text-info"></i>
                <span>${window.translations.chatHistory}</span>
            </button>
        </li>
        <li>
            <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start" 
                    onclick="handleChatReset(this)"
                    data-id="${chat._id}">
                <i class="bi bi-plus-square me-2 text-success"></i>
                <span>${window.translations.newChat}</span>
            </button>
        </li>
        ${window.isAdmin ? `
        <li><hr class="dropdown-divider"></li>
        <li>
            <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start text-warning" 
                    onclick="logFullConversation('${chat._id}')">
                <i class="bi bi-terminal me-2"></i>
                <span>Log Full Conversation</span>
            </button>
        </li>
        ` : ''}
        <li><hr class="dropdown-divider"></li>
        <li class="d-none">
            <button class="dropdown-item d-flex align-items-center py-2 border-0 bg-transparent w-100 text-start text-danger" onclick="deleteChatHandler('${chat._id}')">
                <i class="bi bi-trash me-2"></i>
                <span>${window.translations.delete}</span>
            </button>
        </li>
    `;
    
    dropdownMenu.html(dropdownItems);
    dropdown.show();
}

// Function to hide navbar chat actions
function hideNavbarChatActions() {
    $('#chat-actions-dropdown').hide();
}

// Function to update current chat in the list
function updateCurrentChat(chatId, userId) {
    if(!chatId) {
        hideNavbarChatActions();
        return;
    }
    let currentChat = chatCache.data.find(chat => chat._id === chatId);

    if (currentChat) {
        fetchChatDataInfo(chatId, currentChat);
    } else {
        fetchChatDataInfo(chatId, null);
    }

    // Update horizontal chat menu when available
    if ($('#horizontal-chat-menu').length > 0) {
        updateHorizontalChatMenu(chatId);
    }
}

// Function to fetch chat data info
function fetchChatDataInfo(chatId, fallbackChat) {
    $.ajax({
        type: 'GET',
        url: `/api/chat-data/${chatId}`,
        success: function(data) {
            let chatData = data;
            if (fallbackChat && typeof fallbackChat === 'object') {
                chatData = Object.assign({}, fallbackChat, data);
            }
            updateChatListDisplay(chatData);
        },
        error: function(xhr, status, error) {
            console.log(error);
            if (fallbackChat) {
                updateChatListDisplay(fallbackChat);
            }
        }
    });
}

// Function to update chat list display
function updateChatListDisplay(currentChat) {
    if (!currentChat) {
        return;
    }

    const normalizedChat = normalizeChatRecord({ ...currentChat });
    const nowIsoString = new Date().toISOString();
    normalizedChat.userChatUpdatedAt = nowIsoString;
    normalizedChat.updatedAt = nowIsoString;

    chatCache.data = chatCache.data
        .map(normalizeChatRecord)
        .filter(chat => chat._id !== normalizedChat._id);

    chatCache.data.unshift(normalizedChat);
    chatCache.data = sortChatsByUpdatedAt(chatCache.data);
    saveCache();

    // remove all active class 
    $('#chat-list').find('.chat-list.item').removeClass('active');
    // remove all occurrence of chat from list
    const currentChatObjs = $(document)
        .find('#chat-list')
        .find(`.chat-list.item[data-id="${normalizedChat._id}"]`);
    if(currentChatObjs.length >= 1){
        currentChatObjs.each(function(){
            const chatName = $(this).find('.chat-list-title h6').text();
            $(this).remove();
        });
    }

    let chatHtml = constructChatItemHtml(normalizedChat, true);
    $('#chat-list').prepend(chatHtml);

    // Update navbar dropdown
    updateNavbarChatActions(normalizedChat);
}

// Enhanced function to construct chat item HTML with ultra-compact design for 260px sidebar
function constructChatItemHtml(chat, isActive) {
    const isOwner = chat.userId === userId;
    const lang = window.lang
    let lastMessageTime
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
            break;
    }

    return `
        <div class="list-group-item list-group-item-action border-0 p-0 ${isActive ? 'active bg-primary bg-opacity-10' : ''} chat-list item user-chat chat-item-enhanced" 
            data-id="${chat._id}" style="position: relative;">
            <div class="d-flex align-items-center w-100 px-2 py-1">
                <div class="user-chat-content d-flex align-items-center flex-grow-1"
                onclick="handleChatListItemClick(this)" style="cursor: pointer; min-width: 0;">
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
                            ${!chat.lastMessage ? `<small class="text-muted fst-italic" style="font-size: 0.7rem;">${translations.newChat}</small>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Enhanced function to display user chat history in modal with compact design
function displayUserChatHistoryInModal(userChat) {
    const chatHistoryList = $('#chat-history-list');
    chatHistoryList.empty();

    if (userChat && userChat.length > 0) {
        const userChats = userChat.filter(chat => !chat.isWidget);
        
        if (userChats.length === 0) {
            chatHistoryList.html(`
                <div class="text-center py-4">
                    <i class="bi bi-chat-square-dots display-5 text-muted mb-2"></i>
                    <p class="text-muted small">${translations.noChatHistory}</p>
                </div>
            `);
            return;
        }

        userChats.forEach(chat => {
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

            const historyItem = $(`
                <div class="list-group-item list-group-item-action border-0 p-2 user-chat-history"
                     data-id="${chat.chatId}" 
                     data-chat="${chat._id}" 
                     onclick="handleUserChatHistoryClick(this)"
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
                        <div class="chat-history-actions">
                            <div onclick="enableToggleDropdown(this); event.stopPropagation();" class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary border-0 rounded-circle" 
                                        type="button" 
                                        id="historyDropdown_${chat._id}" 
                                        data-mdb-toggle="dropdown" 
                                        aria-expanded="false"
                                        style="width: 24px; height: 24px; z-index: 1000; font-size: 0.7rem;">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end shadow border-0" 
                                    aria-labelledby="historyDropdown_${chat._id}"
                                    style="z-index: 1050; font-size: 0.75rem;">
                                    <li>
                                        <button class="dropdown-item d-flex align-items-center py-1 border-0 bg-transparent w-100 text-start text-danger" 
                                                onclick="deleteChatHistoryHandler('${chat._id}')">
                                            <i class="bi bi-trash me-2" style="width: 16px; font-size: 0.7rem;"></i>
                                            <span style="font-size: 0.75rem;">${translations.delete}</span>
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            `);

            chatHistoryList.append(historyItem);
        });
    } else {
        chatHistoryList.html(`
            <div class="text-center py-4">
                <i class="bi bi-chat-square-dots display-5 text-muted mb-2"></i>
                <p class="text-muted small">${translations.noChatHistory}</p>
            </div>
        `);
    }
}

// Enhanced function to render chat dropdown with compact design
function renderChatDropdown(chat) {
    const chatId = chat._id;
    const dropdownHtml = `
        <div class="d-inline-block align-items-center">
            <div onclick="enableToggleDropdown(this)" class="dropdown pe-2">
                <button class="btn btn-sm btn-outline-secondary border-0 rounded-circle" 
                        type="button" 
                        id="dropdownMenuButton_${chatId}" 
                        data-mdb-toggle="dropdown" 
                        aria-expanded="false"
                        style="width: 30px; height: 30px; z-index: 1000;">
                    <i class="bi bi-three-dots-vertical"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0" 
                    aria-labelledby="dropdownMenuButton_${chatId}"
                    style="z-index: 1050;">
                    <li>
                        <span onclick="deleteChatHistoryHandler('${chatId}')" 
                              class="dropdown-item d-flex align-items-center py-2 text-danger" 
                              style="cursor:pointer">
                            <i class="bi bi-trash me-3"></i>
                            <span>${translations.delete}</span>
                        </span>
                    </li>
                </ul>
            </div>
        </div>
    `;

    return dropdownHtml;
}

async function getUserChatHistory(chatId) {
    try {
        const response = await fetch(`/api/chat-history/${chatId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch chat history: ${response.status}`);
        }

        const data = await response.json();
        displayUserChatHistoryInModal(data);

        const userChats = Array.isArray(data) ? data.filter(chat => !chat.isWidget) : [];
        if (userChats.length === 0) {
            return null;
        }

        // Prefer continuing today's conversation when available to avoid unintended resets.
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        const pickTimestamp = chat => chat.updatedAt || chat.createdAt || chat.userChatUpdatedAt || chat.userChatCreatedAt;
        const isTodayChat = chat => {
            const timestamp = pickTimestamp(chat);
            if (!timestamp) {
                return false;
            }
            const chatDate = new Date(timestamp);
            return chatDate >= startOfDay && chatDate < endOfDay;
        };

        const todaysChat = userChats.find(isTodayChat);
        const selectedChat = todaysChat || userChats[0];

        if (selectedChat) {
            sessionStorage.setItem('userChatId', selectedChat._id);
            return selectedChat;
        }
    } catch (error) {
        console.error('Error fetching user chat history:', error);
    }
    return null;
}


//.user-chat-history
function handleUserChatHistoryClick(el) {
    if (userChatId == $(el).data('chat')) {
        return;
    }
    chatId = $(el).data('id');
    userChatId = $(el).data('chat');
    postChatData(chatId, userId, userChatId, false, null);
};

//.chat-list.item.user-chat .user-chat-content
function handleChatListItemClick(el) {
    const $el = $(el);
    if ($el.hasClass('loading')) return;
    
    $el.addClass('loading');
    const selectChatId = $el.closest('.user-chat').data('id');
    const chatImageUrl = $el.find('img').attr('src');
    
    // Make sure we have a valid chatId
    if (!selectChatId) {
        console.error('No chat ID found in clicked element');
        $el.removeClass('loading');
        return;
    }
    
    $el.closest('.chat-list.item').addClass('active').siblings().removeClass('active');
    //$('#chat-wrapper').css('background-image', `url(${chatImageUrl})`);
    
    // Update global chatId variable before calling fetchChatData
    window.chatId = selectChatId;
    
    fetchChatData(selectChatId, userId, null, function() {
        $el.removeClass('loading');
        // Update current chat after successful fetch
        updateCurrentChat(selectChatId, userId);
    });
};

// Show chat history modal (fixed with proper modal management)
function showChatHistory(chatId) {
    // Close all other modals first
    if (typeof window.closeAllModals === 'function') {
        window.closeAllModals();
    }
    
    // Wait a moment for other modals to close
    setTimeout(async () => {
        try {
            // Show modal with proper Bootstrap 5 API and high z-index
            const modalElement = document.getElementById('chatHistoryModal');
            if (!modalElement) {
                console.error('Chat history modal element not found');
                return;
            }
            
            // Ensure modal has high z-index
            modalElement.style.zIndex = '1060';
            
            const modal = new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
            
            modal.show();
            
            // Show loading state
            $('#chat-history-list').html(`
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">${translations.loading}</span>
                    </div>
                    <p class="text-muted mt-3">${translations.loadingHistory}</p>
                </div>
            `);
            
            // Fetch and display chat history
            const response = await fetch(`/api/chat-history/${chatId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch chat history');
            }
            
            const data = await response.json();
            displayUserChatHistoryInModal(data);
            
        } catch (error) {
            console.error('Error loading chat history:', error);
            $('#chat-history-list').html(`
                <div class="text-center py-5">
                    <i class="bi bi-exclamation-triangle display-4 text-warning mb-3"></i>
                    <p class="text-muted">${translations.historyLoadError}</p>
                    <button class="btn btn-outline-primary btn-sm" onclick="location.reload()">${translations.retry}</button>
                </div>
            `);
        }
    }, 200); // Small delay to ensure other modals are closed
}

// Initialize horizontal chat menu on index page
$(document).ready(function() {
    // Only initialize on /chat page
    if (window.location.pathname.includes('/chat')) {
        initializeHorizontalChatMenu();
    }
});

// Initialize horizontal chat menu
function initializeHorizontalChatMenu() {
    if ($('#horizontal-chat-menu').length === 0) return;
    
    // Add styles to head
    if ($('#horizontal-chat-styles').length === 0) {
        $('head').append('<div id="horizontal-chat-styles">' + horizontalChatStyles + '</div>');
    }
    
    // Show the menu
    $('#horizontal-chat-menu').removeClass('d-none');
    
    // Load latest chats for horizontal display
    displayHorizontalChatList(userId);
}

// Display chats in horizontal menu (similar to displayImageThumb)
function displayHorizontalChatList(userId, options = {}) {
    if (!userId || $('#horizontal-chat-list').length === 0) return;

    const forceReload = options.force === true;

    if (!forceReload && chatCache.data.length > 0) {
        displayChatThumbs(chatCache.data, userId);
    }

    if (initHorizontalChatMenu && !forceReload) {
        return;
    }

    initHorizontalChatMenu = true;

    // Show loading spinner
    $('#horizontal-chat-loading').show();
    $('#horizontal-chat-list').hide();

    $.ajax({
        type: 'GET',
        url: '/api/chat-list/' + userId,
        data: { page: 1, limit: 20 }, // Get latest 20 chats
        success: function(data) {
            const { chats } = data;
            displayChatThumbs(chats, userId);
        },
        error: function(xhr, status, error) {
            console.error('Error fetching horizontal chat list:', error);
            // Hide loading spinner on error
            $('#horizontal-chat-loading').hide().remove();
            $('#horizontal-chat-list').show();
        }
    });
}

function buildChatThumbElement(chat, index = 0) {
    const animationDelay = `${Math.max(index, 0) * 0.1}s`;
    const ownerId = resolveOwnerId(chat.userId);
    const updatedAt = getChatTimestamp(chat);

    return $(`
        <div class="chat-thumb-container flex-shrink-0 me-2 animate__animated ${chat.nsfw ? 'nsfw-content' : ''}" 
             data-id="${chat._id}" 
             data-user-id="${ownerId}"
             data-updated-at="${updatedAt}"
             onclick="handleChatThumbClick(this)"
             style="cursor: pointer; opacity: 0; animation-delay: ${animationDelay};">
            <div class="chat-thumb-card rounded-circle border border-2 border-light shadow-sm position-relative" 
                 style="width: 60px; height: 60px; background-image: url('${chat.chatImageUrl || '/img/logo.webp'}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
            </div>
            <div class="chat-thumb-name text-center mt-1 d-none">
                <small class="text-dark fw-medium text-truncate d-block" 
                       style="font-size: 0.7rem; max-width: 60px; line-height: 1.1;">
                    ${chat.name}
                </small>
            </div>
        </div>
    `);
}

// Display chat thumbnails in horizontal menu (similar to displayImageThumb)
function displayChatThumbs(chats, userId) {
    const horizontalChatList = $('#horizontal-chat-list');
    
    // Hide loading spinner
    $('#horizontal-chat-loading').hide().remove();
    $('#horizontal-chat-list').show();
    
    const normalizedChats = Array.isArray(chats)
        ? chats.map(normalizeChatRecord)
        : [];
    const sortedChats = sortChatsByUpdatedAt(normalizedChats);

    if (!sortedChats || sortedChats.length === 0) {
        horizontalChatList.html(`
            <div class="text-center py-2 px-3">
                <small class="text-muted">${translations.noChats || 'No chats available'}</small>
            </div>
        `);
        return;
    }
    
    horizontalChatList.empty();
    
    sortedChats.forEach(function(chat, index) {
        const chatThumb = buildChatThumbElement(chat, index);
        horizontalChatList.append(chatThumb);
    });
    
    // Trigger bouncing animation for each thumbnail with staggered timing
    horizontalChatList.find('.chat-thumb-container').each(function(index) {
        const $thumb = $(this);
        setTimeout(() => {
            $thumb.addClass('animate__bounceIn').css('opacity', '1');
            
            // Remove animation class after animation completes to allow re-animation
            setTimeout(() => {
                $thumb.removeClass('animate__bounceIn');
            }, 1000);
        }, index * 100); // 100ms delay between each thumbnail
    });

    if (chatId) {
        updateHorizontalChatMenu(chatId);
    }
}

// Handle click on chat thumbnail
function handleChatThumbClick(el) {
    const $el = $(el);
    const selectChatId = $el.data('id');
    const chatOwnerId = $el.data('user-id');
    const activeUserId = typeof userId !== 'undefined' ? userId : chatOwnerId;

    if (!selectChatId) {
        console.error('No chat ID found in clicked thumbnail');
        return;
    }

    window.chatId = selectChatId;

    // Always fetch using the signed-in user so we reopen the latest session instead of resetting.
    fetchChatData(selectChatId, activeUserId, null, function() {
        $el.prependTo($el.parent());
    });
}

// Update horizontal chat menu when current chat changes
function updateHorizontalChatMenu(currentChatId) {
    const horizontalList = $('#horizontal-chat-list');
    if (horizontalList.length === 0) return;

    horizontalList.find('.chat-thumb-indicator').remove();

    if (!currentChatId) return;

    let currentThumb = horizontalList.find(`.chat-thumb-container[data-id="${currentChatId}"]`);
    const chatData = chatCache.data.find(chat => chat._id === currentChatId);

    if (currentThumb.length === 0 && chatData) {
        currentThumb = buildChatThumbElement(chatData, 0);
        currentThumb.css('opacity', '1');
        horizontalList.append(currentThumb);
    }

    if (!currentThumb.length) {
        return;
    }

    let chatTimestamp = parseInt(currentThumb.attr('data-updated-at'), 10);
    if (Number.isNaN(chatTimestamp)) {
        chatTimestamp = 0;
    }

    if (chatData) {
        const imageUrl = chatData.chatImageUrl || '/img/logo.webp';
        currentThumb.attr('data-user-id', resolveOwnerId(chatData.userId));
        chatTimestamp = getChatTimestamp(chatData);
        currentThumb.attr('data-updated-at', chatTimestamp);
        currentThumb.find('.chat-thumb-card').css('background-image', `url('${imageUrl}')`);
        currentThumb.find('.chat-thumb-name small').text(chatData.name || '');
    }
    const siblings = horizontalList.children('.chat-thumb-container').not(currentThumb);
    let inserted = false;

    siblings.each(function() {
        const $sibling = $(this);
        const siblingTimestamp = parseInt($sibling.attr('data-updated-at'), 10) || 0;
        if (chatTimestamp >= siblingTimestamp) {
            currentThumb.insertBefore($sibling);
            inserted = true;
            return false;
        }
    });

    if (!inserted) {
        currentThumb.appendTo(horizontalList);
    }

    currentThumb.find('.chat-thumb-card').append(
        '<div class="chat-thumb-indicator position-absolute top-0 end-0 bg-primary rounded-circle" style="width: 12px; height: 12px; border: 2px solid white;"></div>'
    );
}

window.logFullConversation = function(chatId) {

    const userChatId = localStorage.getItem('userChatId') || sessionStorage.getItem('userChatId');
    if (!userChatId) {
        showNotification('No user chat ID found', 'error');
        return;
    }

    if (!window.isAdmin) {
        console.warn('Unauthorized: Admin access required');
        return;
    }

    if (!chatId) {
        showNotification('Invalid chat ID', 'error');
        return;
    }

    // Show loading notification
    showNotification('Fetching conversation...', 'info');

    $.ajax({
        url: `/api/log-conversation/${chatId}/${userChatId}`,
        method: 'POST',
        xhrFields: {
            withCredentials: true
        },
        success: function(response) {
            if (response.success) {
                showNotification('Conversation logged to server console', 'success');
                console.log('Conversation logged successfully:', response.message);
            } else {
                showNotification('Failed to log conversation', 'error');
            }
        },
        error: function(xhr, status, error) {
            console.error('Error logging conversation:', error);
            showNotification('Error logging conversation', 'error');
        }
    });
};


// Add CSS styles for horizontal chat menu
const horizontalChatStyles = `
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
}
.chat-thumb-card {
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

/* Ensure Animate.css bounce effect is visible */
.animate__bounceIn {
    animation-name: bounceIn;
    animation-duration: 0.75s;
    animation-timing-function: cubic-bezier(0.215, 0.610, 0.355, 1.000);
}

@keyframes bounceIn {
    from,
    20%,
    40%,
    60%,
    80%,
    to {
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

// Make functions available globally
window.displayChatList = displayChatList;
window.displayUserChatHistoryInModal = displayUserChatHistoryInModal;
window.updateCurrentChat = updateCurrentChat;
window.getUserChatHistory = getUserChatHistory;
window.handleUserChatHistoryClick = handleUserChatHistoryClick;
window.handleChatListItemClick = handleChatListItemClick;
window.deleteChatHandler = deleteChatHandler;
window.deleteChatHistoryHandler = deleteChatHistoryHandler;
window.showChatHistory = showChatHistory;
window.displayHorizontalChatList = displayHorizontalChatList;
window.displayChatThumbs = displayChatThumbs;
window.handleChatThumbClick = handleChatThumbClick;
window.updateHorizontalChatMenu = updateHorizontalChatMenu;
window.initializeHorizontalChatMenu = initializeHorizontalChatMenu;