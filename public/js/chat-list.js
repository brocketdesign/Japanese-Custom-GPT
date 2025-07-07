var chatsPerPage = 10;
let initChatList = false;

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

initChatList = true;
initializeCache();
displayChatList(null, userId);

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

// Check if cache is valid (less than 5 minutes old)
function isCacheValid() {
    if (!chatCache.lastUpdated) return false;
    const fiveMinutes = 5 * 60 * 1000;
    return (Date.now() - chatCache.lastUpdated) < fiveMinutes;
}

// if the  url is like '/chat/?list=true'
if (window.location.pathname === '/chat/' && window.location.search === '?list=true') {

    showDiscovery();
    $('#chat-list').show();
    $('.onchat-off, .onchat-on').hide();

    displayChatList(null, userId);
}

// Event listener for menu chat buttons
$(document).on('click','#toggle-chat-list',function(){

    showDiscovery();
    $('#chat-list').show();
    $('.onchat-off, .onchat-on').hide();

    displayChatList(null, userId);
});

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

    fetchChatListData(chatCache.currentPage);

    function fetchChatListData(page) {
        // Use cached data if valid and we're on page 1
        if (initChatList && chatCache.data.length > 0 && page === 1 && isCacheValid()) {
            displayChats(chatCache.data, chatCache.pagination);
            return;
        }
        
        $('#chat-list-spinner').show();
        
        $.ajax({
            type: 'GET',
            url: '/api/chat-list/' + userId,
            data: { page: page, limit: chatsPerPage },
            success: function(data) {
                const { chats, pagination } = data;
                
                // For page 1, replace the entire list
                // For subsequent pages, append new chats
                if (page === 1) {
                    chatCache.data = chats;
                    $('#chat-list').empty();
                } else {
                    // Filter out any duplicates before adding new chats
                    const newChats = chats.filter(newChat => 
                        !chatCache.data.some(existingChat => existingChat._id === newChat._id)
                    );
                    chatCache.data = chatCache.data.concat(newChats);
                }
                
                chatCache.currentPage = page;
                chatCache.pagination = pagination;
                saveCache();
                
                // Only display the newly fetched chats
                displayChats(chats, pagination);
            },
            error: function(xhr, status, error) {
                console.error('Error fetching chat list:', error);
                $('#chat-list-spinner').hide();
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
                var chatHtml = constructChatItemHtml(chat, chat._id === chatId);
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
        console.log('No chatId provided');
        hideNavbarChatActions();
        return;
    }
    let currentChat = chatCache.data.find(chat => chat._id === chatId);

    if (currentChat) {
        updateChatListDisplay(currentChat);
        updateNavbarChatActions(currentChat);
    } else {
        fetchChatDataInfo(chatId);
    }
}

// Function to fetch chat data info
function fetchChatDataInfo(chatId) {
    $.ajax({
        type: 'GET',
        url: `/api/chat-data/${chatId}`,
        success: function(data) {
            updateChatListDisplay(data);
        },
        error: function(xhr, status, error) {
            console.log(error);
        }
    });
}

// Function to update chat list display
function updateChatListDisplay(currentChat) {
    chatCache.data = chatCache.data.filter(chat => chat._id !== currentChat._id);
    chatCache.data.unshift(currentChat);
    chatCache.data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    saveCache();

    // remove all active class 
    $('#chat-list').find('.chat-list.item').removeClass('active');
    // remove all occurrence of chat from list
    const currentChatObjs = $(document).find('#chat-list').find(`.chat-list.item[data-id="${currentChat._id}"]`);
    if(currentChatObjs.length >= 1){
        currentChatObjs.each(function(){
            const chatName = $(this).find('.chat-list-title h6').text();
            $(this).remove();
        });
    }

    let chatHtml = constructChatItemHtml(currentChat, true);
    $('#chat-list').prepend(chatHtml);

    // Update navbar dropdown
    updateNavbarChatActions(currentChat);
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
        const data = await response.json();
        displayUserChatHistoryInModal(data);
        const lastChat = data.find(chat => !chat.isWidget);
        if (lastChat) {
            const userChatId = lastChat._id;
            sessionStorage.setItem('userChatId', userChatId);
            return lastChat;
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