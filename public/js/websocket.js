const socket = new WebSocket(`ws://localhost:3000/ws?userId=${user._id}`);

socket.onopen = () => {
  console.log('WebSocket connection established');
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.notification) {
    console.log('Notification:', data.notification);
    // Display notification to the user
  } else {
    console.log('Message from server:', event.data);
  }
};

socket.onclose = () => {
  console.log('WebSocket connection closed');
};

socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};
