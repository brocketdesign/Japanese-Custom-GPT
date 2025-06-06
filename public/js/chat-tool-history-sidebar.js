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

// Event listener for menu chat buttons
$(document).on('click','#menu-chat, .menu-chat-sm',function(){
    if(!initChatList){
        initChatList = true;
        initializeCache();
        displayChatList(null, userId);
    }
});

$(document).on('click', '.delete-chat', function(e) {
    e.preventDefault()
    e.stopPropagation();
    const chatId = $(this).data('id');
    const userId = user._id
    Swal.fire({
        title: '本当に削除しますか？',
        text: "この操作は元に戻せません！",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'はい、削除します！',
        cancelButtonText: 'キャンセル'
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/api/delete-chat/${chatId}`,
                type: 'DELETE',
                data: { chatId },
                success: function(response) {
                    renderChatList(userId)
                },
                error: function(xhr, status, error) {
                    Swal.fire(
                        'エラー',
                        'チャットの削除に失敗しました。',
                        'error'
                    );
                }
            });
        }
    });
});
$(document).on('click', '.delete-chat-history', function(e) {
    e.preventDefault()
    e.stopPropagation();
    const selectedChatId = $(this).data('id');
    Swal.fire({
        title: '本当に削除しますか？',
        text: "この操作は元に戻せません！",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'はい、削除します！',
        cancelButtonText: 'キャンセル'
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `/api/delete-chat-history/${selectedChatId}`,
                type: 'DELETE',
                success: function(response) {
                    $(document).find(`.user-chat-history[data-chat="${selectedChatId}"]`).fadeOut().remove()
                },
                error: function(xhr, status, error) {
                    Swal.fire(
                        'エラー',
                        'チャットの削除に失敗しました。',
                        'error'
                    );
                }
            });
        }
    });
});

// Main function to display chat list
function displayChatList(reset, userId) {
    if ($('#chat-list').length === 0) return;
    
    if (reset) {
        resetCache();
        $('#chat-list').empty();
        $('#chat-list').append(`
            <div id="chat-list-spinner" class="spinner-border text-secondary" role="status" style="position: absolute; top: 45%; left: 45%; display: none;">
                <span class="visually-hidden">Loading...</span>
            </div>`);
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
                    $('#chat-list').empty().append(`
                        <div id="chat-list-spinner" class="spinner-border text-secondary" role="status" style="position: absolute; top: 45%; left: 45%; display: none;">
                            <span class="visually-hidden">Loading...</span>
                        </div>`);
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

// Function to update current chat in the list
function updateCurrentChat(chatId, userId) {
    if(!chatId) {
        console.log('No chatId provided');
        return;
    }
    let currentChat = chatCache.data.find(chat => chat._id === chatId);

    if (currentChat) {
        updateChatListDisplay(currentChat);
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
}

// Enhanced function to construct chat item HTML with compact design
function constructChatItemHtml(chat, isActive) {
    const isOwner = chat.userId === userId;
    const lastMessageTime = chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '';
    
    return `
        <div class="${isActive ? 'active' : ''} chat-list item user-chat chat-item-enhanced d-flex align-items-center justify-content-between mx-1 mb-2 rounded-2 shadow-sm" 
            data-id="${chat._id}">
            <div class="d-flex align-items-center w-100">
                <div class="user-chat-content d-flex align-items-center flex-1"
                onclick="handleChatListItemClick(this)">
                    <div class="chat-avatar-container position-relative me-2">
                        <img class="chat-avatar rounded-circle border" 
                             src="${chat.chatImageUrl || '/img/logo.webp'}" 
                             alt="${chat.name}"
                             style="width: 40px; height: 40px; object-fit: cover;">
                        <div class="chat-status-indicator ${isActive ? 'active' : ''}"></div>
                    </div>
                    <div class="chat-content flex-grow-1 min-w-0">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <h6 class="chat-name mb-0 fw-semibold text-truncate pe-1" style="max-width: 100px; font-size: 0.85rem;">${chat.name}</h6>
                            <small class="chat-time text-muted flex-shrink-0" style="font-size: 0.7rem;">${lastMessageTime}</small>
                        </div>
                        <p class="chat-preview mb-0 text-muted small text-truncate ${chat.lastMessage ? '' : 'd-none'}" 
                           style="max-width: 140px; font-size: 0.75rem;">
                            ${chat.lastMessage ? chat.lastMessage.content : ''}
                        </p>
                        ${!chat.lastMessage ? `<small class="text-muted fst-italic" style="font-size: 0.7rem;">${translations.newChat}</small>` : ''}
                    </div>
                </div>
                <div class="chat-actions d-flex align-items-center">
                    <div onclick="enableToggleDropdown(this)" class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary border-0 rounded-circle chat-menu-btn" 
                                type="button" 
                                id="dropdownMenuButton_${chat._id}" 
                                data-mdb-toggle="dropdown" 
                                aria-expanded="false"
                                style="width: 26px; height: 26px; font-size: 0.7rem;">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end chat-dropdown-menu shadow" 
                            aria-labelledby="dropdownMenuButton_${chat._id}">
                            <li>
                                <a href="#" class="dropdown-item" 
                                   onclick="${ !isOwner ? `loadCharacterCreationPage('${chat._id}')` : `loadCharacterUpdatePage('${chat._id}')`}">
                                    <i class="bi bi-pencil me-2 text-primary"></i>
                                    ${!isOwner ? window.translations.edit : window.translations.update}
                                </a>
                            </li>
                            <li>
                                <button class="dropdown-item history-chat" data-id="${chat._id}">
                                    <i class="bi bi-clock-history me-2 text-info"></i>
                                    ${window.translations.chatHistory}
                                </button>
                            </li>
                            <li>
                                <button class="dropdown-item reset-chat" 
                                        data-id="${chat._id}"
                                        onclick="handleChatReset(this)">
                                    <i class="bi bi-plus-square me-2 text-success"></i>
                                    ${window.translations.newChat}
                                </button>
                            </li>
                            <li><hr class="dropdown-divider"></li>
                            <li class="d-none">
                                <button class="dropdown-item text-danger delete-chat" data-id="${chat._id}">
                                    <i class="bi bi-trash me-2"></i>
                                    ${window.translations.delete}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Enhanced function to display user chat history in modal (renamed to avoid conflict)
function displayUserChatHistoryInModal(userChat) {
    const chatHistoryList = $('#chat-history-list');
    chatHistoryList.empty();

    if (userChat && userChat.length > 0) {
        const userChats = userChat.filter(chat => !chat.isWidget);
        
        if (userChats.length === 0) {
            chatHistoryList.html(`
                <div class="text-center py-5">
                    <i class="bi bi-chat-square-dots display-4 text-muted mb-3"></i>
                    <p class="text-muted">${translations.noChatHistory}</p>
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
                <div class="chat-history-item d-flex align-items-center justify-content-between p-3 border rounded-3 mb-2 user-chat-history"
                     data-id="${chat.chatId}" 
                     data-chat="${chat._id}" 
                     onclick="handleUserChatHistoryClick(this)">
                    <div class="d-flex align-items-center flex-grow-1">
                        <div class="chat-history-icon me-3">
                            <i class="bi bi-chat-dots-fill text-primary fs-4"></i>
                        </div>
                        <div class="chat-history-content">
                            <div class="chat-history-date fw-semibold text-dark mb-1">${formattedDate}</div>
                            <small class="text-muted">${formattedTime}</small>
                        </div>
                    </div>
                    <div class="chat-history-actions">
                        <div onclick="enableToggleDropdown(this); event.stopPropagation();" class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary border-0 rounded-circle" 
                                    type="button" 
                                    id="historyDropdown_${chat._id}" 
                                    data-mdb-toggle="dropdown" 
                                    aria-expanded="false">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end shadow" 
                                aria-labelledby="historyDropdown_${chat._id}">
                                <li>
                                    <button class="dropdown-item text-danger delete-chat-history" 
                                            data-id="${chat._id}">
                                        <i class="bi bi-trash me-2"></i>
                                        ${translations.delete}
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            `);

            chatHistoryList.append(historyItem);
        });
    } else {
        chatHistoryList.html(`
            <div class="text-center py-5">
                <i class="bi bi-chat-square-dots display-4 text-muted mb-3"></i>
                <p class="text-muted">${translations.noChatHistory}</p>
            </div>
        `);
    }
}

// Function to display user chat history (keep this for sidebar)
function displayUserChatHistory(userChat) {
    const chatHistoryContainer = $('#chat-history');
    chatHistoryContainer.empty();

    if (userChat && userChat.length > 0) {
        // Create two separate cards for user and widget chat history
        const userChatCard = $('<div class="card rounded-0 shadow-0 bg-transparent"></div>');
        const widgetChatCard = $('<div class="card rounded-0 shadow-0 bg-transparent"></div>');

        // User chat history
        const userChatHeader = $('<div class="card-header"></div>');
        userChatHeader.text(translations.chatHistory);
        //userChatCard.append(userChatHeader);

        const userChatListGroup = $('<ul class="list-group list-group-flush"></ul>');
        const userChats = userChat.filter(chat => !chat.isWidget);
        userChats.forEach(chat => {
            const listItem = $(`<li 
                class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" 
                data-id="${chat.chatId}" 
                data-chat="${chat._id}" 
                onclick="handleUserChatHistoryClick(this)"></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-secondary"></small>');
            small.append($('<i class="bi bi-clock me-1"></i>'));
            var chatUpdatedAt = new Date(chat.updatedAt);
            // Convert to Japanese localized date string
            var japaneseDateString = chatUpdatedAt.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
            small.append(japaneseDateString);

            const dropdown = renderChatDropdown(chat);
            
            listItem.append(small);
            listItem.append(dropdown);
            userChatListGroup.append(listItem);
        });

        userChatCard.append(userChatListGroup);
        chatHistoryContainer.append(userChatCard);
        
        // Widget chat history
        const widgetChatHeader = $('<div class="card-header"></div>');
        widgetChatHeader.text(translations.widgetChatHistory);
        widgetChatCard.append(widgetChatHeader);

        const widgetChatListGroup = $('<ul class="list-group list-group-flush"></ul>');
        const widgetChats = userChat.filter(chat => chat.isWidget);
        widgetChats.forEach(chat => {
            const listItem = $(`<li 
                class="list-group-item user-chat-history bg-transparent d-flex align-items-center justify-content-between" 
                data-id="${chat.chatId}" 
                data-chat="${chat._id}" 
                onclick="handleUserChatHistoryClick(this)"></li>`);
            listItem.css('cursor', 'pointer');

            const small = $('<small class="text-secondary"></small>');
            small.append($('<i class="bi bi-clock me-1"></i>'));
            small.append(chat.updatedAt);

            const dropdown = renderChatDropdown(chat);
            
            listItem.append(small);
            listItem.append(dropdown);
            widgetChatListGroup.append(listItem);
        });

        //widgetChatCard.append(widgetChatListGroup);
        //chatHistoryContainer.append(widgetChatCard);
    }
}

// Function to render chat dropdown
function renderChatDropdown(chat) {
    const chatId = chat._id;
    const dropdownHtml = `
        <div class="d-inline-block align-items-center">
            <!-- Dropdown -->
            <div 
                onclick="enableToggleDropdown(this)"
                class="dropdown pe-2">
                <button
                class="btn border-0 shadow-0 dropdown-toggle ms-2" type="button" id="dropdownMenuButton_${chatId}" data-mdb-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-three-dots text-secondary"></i>
                </button>
                <ul class="chat-option-menu dropdown-menu dropdown-menu-end" aria-labelledby="dropdownMenuButton_${chatId}">
                    <li>
                        <span data-id="${chatId}" class="dropdown-item text-danger delete-chat-history" style="cursor:pointer">
                            <i class="bi bi-trash me-2"></i>
                            <span class="text-muted" style="font-size:12px"></span>${translations.delete}</span>
                        </span>
                    </li>
                </ul>
            </div>
            <!-- End of Dropdown -->
        </div>
    `;

    return dropdownHtml;
}

async function getUserChatHistory(chatId) {
    try {
        const response = await fetch(`/api/chat-history/${chatId}`);
        const data = await response.json();
        displayUserChatHistory(data);
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
    $('#chat-container').css('background-image', `url(${chatImageUrl})`);
    
    // Update global chatId variable before calling fetchChatData
    window.chatId = selectChatId;
    
    fetchChatData(selectChatId, userId, null, function() {
        $el.removeClass('loading');
        // Update current chat after successful fetch
        updateCurrentChat(selectChatId, userId);
    });
};

// Show chat history modal (fixed with proper modal management)
$(document).on('click', '.history-chat', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    const chatId = $(this).data('id');
    
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
                        <span class="visually-hidden">Loading...</span>
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
});

// Make functions available globally
window.displayChatList = displayChatList;
window.displayUserChatHistory = displayUserChatHistory;
window.displayUserChatHistoryInModal = displayUserChatHistoryInModal;
window.updateCurrentChat = updateCurrentChat;
window.getUserChatHistory = getUserChatHistory;
window.handleUserChatHistoryClick = handleUserChatHistoryClick;
window.handleChatListItemClick = handleChatListItemClick;