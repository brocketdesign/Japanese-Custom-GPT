let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectInterval = 3000;
let currentSocket = null;
let isConnected = false;
let reconnectModal = null; // Track modal instance
let isReconnectModalShown = false; // Track modal state

function initializeWebSocket(onConnectionResult = null) {

  let socket;
  if (MODE === 'local') {
    const ip = location.hostname;
    socket = new WebSocket(`ws://${ip}:3000/ws?userId=${user._id}`);
  } else {
    socket = new WebSocket(`wss://app.chatlamix.com/ws?userId=${user._id}`);
  }

  currentSocket = socket;

  socket.onopen = () => {
    reconnectAttempts = 0; 
   if($('#chatContainer').is(':visible')) {
      // Call fetchChatData function to load chat data onyl once per reconnectInterval
      // This is to avoid multiple calls to fetchChatData when the user is on the chat page
      setTimeout(() => {
        if (!isConnected) {
          fetchChatData(chatId,user._id)
        }
      }, reconnectInterval);
    }
    isConnected = true;
    // Notify reconnection attempt of success
    if (onConnectionResult) {
      onConnectionResult(true);
    }
  };

  socket.onerror = (error) => {
    console.error('[Websocket] Connection error:', error);
    isConnected = false;
    // Notify reconnection attempt of failure
    if (onConnectionResult) {
      onConnectionResult(false);
    }
  };

  socket.onmessage = (event) => {
    // Removed console.log('[WebSocket] Raw message received:', event.data);
    
    try {
      const data = JSON.parse(event.data);
      // Removed console.log('[WebSocket] Parsed message data:', data);
      
      if (data.notification) {
        // Try to handle with user points handler first
        if (window.webSocketUserPointsHandler && 
            window.webSocketUserPointsHandler.handlePointsMessage(data)) {
          return; // Message was handled by points handler
        }
        
        switch (data.notification.type) {
          case 'log':
            // Removed console.log(data.notification.message);
            break;
          case 'showNotification': {
            const { message, icon } = data.notification;
            showNotification(message, icon);
            break;
          }
          case 'imageModerationFlagged': {
            const { flagged, currentUserId } = data.notification;
            if(flagged){
              $(`[data-user-id="${currentUserId}"] #imageModerationFlagged`).show();
              $(`[data-user-id="${currentUserId}"] #profileImage`).addClass('flagged');
              $(`[data-user-id="${currentUserId}"] #profileImage`).attr('src', '/img/avatar.png');
            }else{
              $(`[data-user-id="${currentUserId}"] #imageModerationFlagged`).hide();
            }
            break;
          }
          case 'updateNotificationCountOnLoad': {
            const { userId } = data.notification;
            updateNotificationCountOnLoad(userId);

            if($('#chatContainer').is(':visible')) {
              fetchChatData(chatId,user._id)
            }
            break;
          }
          case 'addIconToLastUserMessage':
            addIconToLastUserMessage();
            break;
          case 'handleLoader': {
            const {imageId, action } = data.notification;
            displayOrRemoveImageLoader(imageId, action);
            break;
          }
          case 'handleVideoLoader': {
            const { placeholderId, action } = data.notification; // Use placeholderId consistently
            displayOrRemoveImageLoader(placeholderId, action);
            break;
          }
          case 'videoGenerated': {
            const { videoId, videoUrl, duration, userChatId, placeholderId, taskId } = data.notification;

            if( userChatId == sessionStorage.getItem('userChatId')) {
              
              // Remove any existing loader for this placeholder
              removeVideoLoader(placeholderId);
              
              // Display the generated video
              displayGeneratedVideo({
                videoId,
                videoUrl,
                duration,
                userChatId,
                placeholderId,
                taskId
              });
              
              showNotification(window.translations.video_generation_completed || 'Video generated successfully!', 'success');
            } else {
              console.warn(`[WebSocket] UserChatId does not match. Ignoring video generation for videoId: ${videoId}`);
            }
            break;
          }
          case 'handleRegenSpin': {
            const {imageId, spin} = data.notification;
            handleRegenSpin(imageId, spin);
            break;
          }
          case 'imageGenerated': {
            const { userChatId, imageId, imageUrl, title, prompt, nsfw, isUpscaled, isMergeFace } = data.notification;
            generateImage({
              userChatId,
              url: imageUrl,
              id:imageId,
              title,
              prompt,
              imageId, 
              nsfw, 
              isUpscaled,
              isMergeFace
            });
            break;
          }
          case 'updateChatData': {
            const { chatData } = data.notification;
            if (window.updateChatData) {
              window.updateChatData(chatData);
            }
            break;
          }
          case 'updateEnhancedPrompt': {
            const { enhancedPrompt } = data.notification;
            if (window.updateEnhancedPrompt) {
              window.updateEnhancedPrompt(enhancedPrompt);
            }
            break;
          }
          case 'characterImageGenerated':
            if ($('#imageContainer').length > 0) {
              const { imageUrl, nsfw } = data.notification;
              if (window.hideImageSpinner) {
                window.hideImageSpinner();
              }
              generateCharacterImage(imageUrl,nsfw);
            }
            break;
          case 'resetCharacterForm':
            if ($('#imageContainer').length > 0) {
              if (window.hideImageSpinner) {
                window.hideImageSpinner();
              }
              resetCharacterForm();
            }
            break;
          case 'updateImageTitle': {
            const { imageId, title } = data.notification;
            updateImageTitle(imageId, title);
            break;
          }
          case 'updateCharacterGenerationMessage':
            if ($('.genexp').length) {
              const { mess } = data.notification;
              updateCharacterGenerationMess(mess);
            }
            break;
          case 'displayCompletionMessage': {
            const { message, uniqueId } = data.notification;
            displayCompletionMessage(message, uniqueId);
            break;
          }
          case 'hideCompletionMessage': {
            const { uniqueId } = data.notification;
            hideCompletionMessage(uniqueId);
            break;
          }
          case 'loadPlanPage':
            loadPlanPage();
            break;
          case 'updateCustomPrompt': {
            const { promptId } = data.notification;
            if (window.updateCustomPrompt) {
              window.updateCustomPrompt(promptId);
            }
            break;
          }
          case 'displaySimilarChats': {
            const { chatId, similarChats } = data.notification;
            console.log('[WebSocket] Displaying similar chats for chatId:', chatId, 'with data:', similarChats);
            if (window.displaySimilarChats) {
              window.displaySimilarChats(similarChats);
            }
            break;
          }
          default:
            // Removed console.log('[WebSocket] Unhandled notification type:', data.notification.type);
            break;
        }
      } else {
        // Removed console.log('[WebSocket] Message without notification property:', data);
      }
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
      // Removed console.log('[WebSocket] Raw message that failed to parse:', event.data);
    }
  };

  socket.onclose = () => {
    isConnected = false;
    if (reconnectAttempts < maxReconnectAttempts) {
      console.warn(`[Websocket] Connection closed. Attempting to reconnect... ${reconnectAttempts + 1}/${maxReconnectAttempts}`);
      setTimeout(() => {
        reconnectAttempts++;
        initializeWebSocket();
      }, reconnectInterval);
    } else {
      console.error('Max reconnect attempts reached. Could not reconnect to WebSocket.');
      // Call a module to ask the user to retry or refresh the page
      if (window.showReconnectPrompt && window.MODE === 'local') {
        window.showReconnectPrompt();
      } else {
        console.error('No reconnect prompt function available.');
      }
    }
  };

  socket.onerror = (error) => {
    isConnected = false;
  }
}

// Initialize WebSocket
initializeWebSocket();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (!currentSocket || currentSocket.readyState === WebSocket.CLOSED) {
      // Removed console.log("Tab resumed. Attempting to reconnect WebSocket...");
      initializeWebSocket();
    }
  }
});

// Handle reconnect attempts after a failed connection
window.showReconnectPrompt = function() {
    // Prevent multiple modals from being created
    if (isReconnectModalShown) {
        return;
    }
    
    // Dispose of any existing modal instance
    if (reconnectModal) {
        reconnectModal.dispose();
        reconnectModal = null;
    }
    
    // Remove any existing backdrop manually
    const existingBackdrops = document.querySelectorAll('.modal-backdrop');
    existingBackdrops.forEach(backdrop => backdrop.remove());
    
    isReconnectModalShown = true;
    
    reconnectModal = new bootstrap.Modal(document.getElementById('reconnectModal'), {
        backdrop: 'static',
        keyboard: false
    });
    
    const retryBtn = document.getElementById('retryConnectionBtn');
    const refreshBtn = document.getElementById('refreshPageBtn');
    const statusDiv = document.getElementById('reconnectStatus');
    const statusText = document.getElementById('reconnectStatusText');
    
    let retryAttempts = 0;
    const maxRetryAttempts = 5;
    
    // Reset button states
    retryBtn.disabled = false;
    refreshBtn.disabled = false;
    statusDiv.style.display = 'none';
    
    // Retry connection handler
    retryBtn.onclick = function() {
        retryBtn.disabled = true;
        refreshBtn.disabled = true;
        statusDiv.style.display = 'block';
        retryAttempts = 0;
        
        attemptReconnection();
    };
    
    // Refresh page handler
    refreshBtn.onclick = function() {
        window.location.reload();
    };
    
    function attemptReconnection() {
        if (retryAttempts >= maxRetryAttempts) {
            statusText.textContent = window.translations.reconnect.failed;
            statusDiv.querySelector('.spinner-border').style.display = 'none';
            retryBtn.disabled = false;
            refreshBtn.disabled = false;
            return;
        }
        
        retryAttempts++;
        statusText.textContent = `${window.translations.reconnect.attempting} (${retryAttempts}/${maxRetryAttempts})`;
        
        // Reset reconnect attempts counter for websocket
        reconnectAttempts = 0;
        
        // Try to initialize websocket with callback
        try {
            initializeWebSocket((success) => {
                if (success) {
                    // Successfully reconnected, close modal
                    reconnectModal.hide();
                    window.showNotification(window.translations.reconnect.success, 'success');
                } else {
                    // Connection failed, try again after delay
                    setTimeout(attemptReconnection, 2000);
                }
            });
            
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
            setTimeout(attemptReconnection, 2000);
        }
    }
    
    // Handle modal cleanup when hidden
    reconnectModal._element.addEventListener('hidden.bs.modal', function() {
        isReconnectModalShown = false;
        if (reconnectModal) {
            reconnectModal.dispose();
            reconnectModal = null;
        }
        // Ensure backdrop is removed
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
    });
    
    reconnectModal.show();
};