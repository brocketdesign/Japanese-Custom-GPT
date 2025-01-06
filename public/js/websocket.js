let reconnectAttempts = 0;
const maxReconnectAttempts = 3;
const reconnectInterval = 10000; // 10 seconds

function initializeWebSocket() {
  socket = new WebSocket(`ws://localhost:3000/ws?userId=${user._id}`);

  socket.onopen = () => {
    console.log('WebSocket connection established');
    reconnectAttempts = 0; // Reset reconnect attempts
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
      // Reset character form
      if(data.notification.type == 'resetCharacterForm') {
        resetCharacterForm();
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
      if(data.notification.type == 'characterImageGenerated') {
        const { imageUrl, nsfw } = data.notification;
        generateCharacterImage(imageUrl,nsfw);
      }
    } else {
      console.log('Message from server:', event.data);
    }
  };

  socket.onclose = () => {
    console.log('WebSocket connection closed');
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
