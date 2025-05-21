let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const reconnectInterval = 3000; // 10 seconds

function initializeWebSocket() {

  let socket;
  if (MODE === 'local') {
    const ip = location.hostname;
    socket = new WebSocket(`ws://${ip}:3000/ws?userId=${user._id}`);
  } else {
    socket = new WebSocket(`wss://app.chatlamix.com/ws?userId=${user._id}`);
  }

  socket.onopen = () => {
    reconnectAttempts = 0; // Reset reconnect attempts

    if($('#chatContainer').is(':visible')) {
      fetchChatData(chatId,user._id)
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.notification) {
      switch (data.notification.type) {
        case 'log':
          console.log(data.notification.message);
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
        case 'handleRegenSpin': {
          const {imageId, spin} = data.notification;
          handleRegenSpin(imageId, spin);
          break;
        }
        case 'imageGenerated': {
          const { userChatId, imageId, imageUrl, title, prompt, nsfw } = data.notification;
          generateImage({
            userChatId,
            url: imageUrl,
            id:imageId,
            title,
            prompt,
            imageId, 
            nsfw
          });
          break;
        }
        case 'characterImageGenerated':
          if ($('#imageContainer').length > 0) {
            const { imageUrl, nsfw } = data.notification;
            generateCharacterImage(imageUrl,nsfw);
          }
          break;
        case 'resetCharacterForm':
          if ($('#imageContainer').length > 0) {
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
        case 'displaySuggestions': {
          const { suggestions, uniqueId } = data.notification;
          displaySuggestions(suggestions, uniqueId);
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
        default:
          //console.log('Message from server:', event.data);
          break;
      }
    } else {
      //console.log('Message from server:', event.data);
    }
  };

  socket.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        reconnectAttempts++;
        initializeWebSocket();
      }, reconnectInterval);
    } else {
      console.error('Max reconnect attempts reached. Could not reconnect to WebSocket.');
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Initialize WebSocket
initializeWebSocket();
