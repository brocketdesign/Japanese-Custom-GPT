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
      if (data.notification.message == 'imageStart') {
        const { userId, chatId, userChatId, command, prompt, title } = data.notification;
        const randomId = displayAndUpdateImageLoader();
        addIconToLastUserMessage();

        let imageNsfw = command.nsfw ? 'nsfw' : 'sfw';
        txt2ImageNovita(userId, chatId, userChatId, randomId, imageNsfw, { prompt, title });
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
