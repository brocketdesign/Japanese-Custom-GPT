const fastifyPlugin = require('fastify-plugin');

module.exports = fastifyPlugin(async function (fastify) {
  fastify.decorate('connections', new Map());

  fastify.get('/ws', { websocket: true }, (connection, request) => {
    try {
      const userId = request.query.userId;
      if (!userId) {
        console.error('Connection rejected: User ID is missing');
        connection.close(4001, 'User ID is required');
        return;
      }

      const normalizedUserId = userId.toString();

      if (!fastify.connections.has(normalizedUserId)) {
        fastify.connections.set(normalizedUserId, new Set());
      }

      fastify.connections.get(normalizedUserId).add(connection);
      console.log(`Connection added for user ${normalizedUserId}. Total connections: ${fastify.connections.get(normalizedUserId).size}`);

      connection.on('message', (message) => {
        console.log(`Message received from user ${normalizedUserId}:`, message.toString());
        try {
          connection.send(message); // Echo back the message
        } catch (err) {
          console.error(`Error sending message to user ${normalizedUserId}:`, err);
        }
      });

      connection.on('close', () => {
        console.log(`Connection closed for user: ${normalizedUserId}`);
        const userConnections = fastify.connections.get(normalizedUserId);
        if (userConnections) {
          userConnections.delete(connection);
          console.log(`Remaining connections for user ${normalizedUserId}: ${userConnections.size}`);
          if (userConnections.size === 0) {
            fastify.connections.delete(normalizedUserId);
            console.log(`All connections closed for user ${normalizedUserId}. User removed.`);
          }
        }
      });
    } catch (err) {
      console.error('Unexpected error in WebSocket connection:', err);
    }
  });

  fastify.decorate('sendNotificationToUser', (userId, type, additionalData) => {
    try {
      const normalizedUserId = userId.toString();
      const userConnections = fastify.connections.get(normalizedUserId);
      if (userConnections) {
        const notification = {
          type,
          ...additionalData
        };
        for (const conn of userConnections) {
          conn.send(JSON.stringify({ notification }));
        }
      } else {
        console.log(`No active connections for user ${normalizedUserId}`);
      }
    } catch (err) {
      console.error(`Error sending notification to user ${normalizedUserId}:`, err);
    }
  });

  // Example route that uses the decorated connections
  fastify.get('/active-connections', async (request, reply) => {
    const activeConnections = Array.from(fastify.connections.keys());
    reply.send({ activeConnections });
  });

  // Example route to send a notification to a user
  fastify.post('/notify-user', async (request, reply) => {
    const { userId, notification } = request.body;
    fastify.sendNotificationToUser(userId, notification);
    reply.send({ status: 'Notification sent' });
  });
  
  // Ping all connections every 30 seconds
  setInterval(() => {
    for (const [userId, connections] of fastify.connections.entries()) {
      for (const conn of connections) {
        if (conn.readyState === 1) {
          conn.send(JSON.stringify({ type: 'ping' }));
        }
      }
    }
  }, 30000);
  
});
