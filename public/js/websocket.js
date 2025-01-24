let reconnectAttempts = 0;
const maxReconnectAttempts = 3;
const reconnectInterval = 10000; // 10 seconds

function initializeWebSocket() {

  let socket;
  if (MODE === 'local') {
    socket = new WebSocket(`ws://localhost:3000/ws?userId=${user._id}`);
  } else {
    socket = new WebSocket(`wss://app.chatlamix.com/ws?userId=${user._id}`);
  }

  socket.onopen = () => {
    console.log('WebSocket connection established');
    reconnectAttempts = 0; // Reset reconnect attempts

    if($('#chatContainer').is(':visible')) {
      fetchChatData(chatId,user._id)
    }
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.notification) {
      // log message
      if (data.notification.type == 'log') {
        console.log(data.notification.message);
      }
      // handle showNotification (message, icon)
      if (data.notification.type == 'showNotification') {
        const { message, icon } = data.notification;
        showNotification( message, icon );
      }
      // Add a new notification
      if(data.notification.type == 'updateNotificationCountOnLoad') {
        const { userId } = data.notification;
        updateNotificationCountOnLoad(userId);

        if($('#chatContainer').is(':visible')) {
          fetchChatData(chatId,user._id)
        }
      }
      // Display image icon in last user message
      if (data.notification.type == 'addIconToLastUserMessage') {
        addIconToLastUserMessage();
      }
      // Display or remove loader
      if(data.notification.type == 'handleLoader') {
        const {imageId, action } = data.notification;
        displayOrRemoveImageLoader(imageId, action);
      }
      // Display or remove spinner
      if(data.notification.type == 'handleRegenSpin') {
        const {imageId, spin} = data.notification;
        handleRegenSpin(imageId, spin);
      }
      // Display generated image
      if(data.notification.type == 'imageGenerated') {
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
      }
      // Display character image
      if(data.notification.type == 'characterImageGenerated' && $('#imageContainer').length > 0) {
        const { imageUrl, nsfw } = data.notification;
        generateCharacterImage(imageUrl,nsfw);
      }
      // Reset character form
      if(data.notification.type == 'resetCharacterForm' && $('#imageContainer').length > 0) {
        resetCharacterForm();
      }
      // Updade image title dynamically
      if(data.notification.type == 'updateImageTitle') {
        const { imageId, title } = data.notification;
        updateImageTitle(imageId, title);
      }
      // Update character generation message
      if(data.notification.type == 'updateCharacterGenerationMessage' &&  $('.genexp').length) {
        const { mess } = data.notification;
        updateCharacterGenerationMess(mess);
      }
      // Display completion message
      if(data.notification.type == 'displayCompletionMessage') {
        const { message, uniqueId } = data.notification;
        displayCompletionMessage(message, uniqueId);
      }
      // Hide completion message
      if(data.notification.type == 'hideCompletionMessage') {
        const { uniqueId } = data.notification;
        hideCompletionMessage(uniqueId);
      }
    } else {
      //console.log('Message from server:', event.data);
    }
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed');
    showNotification(translations.websocket.connection_lost, 'warning');
    if (reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${reconnectAttempts + 1}`);
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
