const fastifyPlugin = require('fastify-plugin');
const connections = new Map();

module.exports = fastifyPlugin(async function (fastify) {
  fastify.decorate('connections', connections);

  fastify.get('/ws', { websocket: true }, (connection, request) => {
    try {
      const userId = request.query.userId;
      if (!userId) {
        console.error('Connection rejected: User ID is missing');
        connection.close(4001, 'User ID is required');
        return;
      }

      if (!fastify.connections.has(userId)) {
        fastify.connections.set(userId, new Set());
        console.log(`New user registered: ${userId}`);
      }

      fastify.connections.get(userId).add(connection);
      console.log(`Connection added for user ${userId}. Total connections: ${fastify.connections.get(userId).size}`);

      connection.on('message', (message) => {
        console.log(`Message received from user ${userId}:`, message.toString());
        try {
          connection.send(message); // Echo back the message
        } catch (err) {
          console.error(`Error sending message to user ${userId}:`, err);
        }
      });

      connection.on('close', () => {
        console.log(`Connection closed for user: ${userId}`);
        const userConnections = fastify.connections.get(userId);
        if (userConnections) {
          userConnections.delete(connection);
          console.log(`Remaining connections for user ${userId}: ${userConnections.size}`);
          if (userConnections.size === 0) {
            fastify.connections.delete(userId);
            console.log(`All connections closed for user ${userId}. User removed.`);
          }
        }
      });
    } catch (err) {
      console.error('Unexpected error in WebSocket connection:', err);
    }
  });

  fastify.decorate('sendNotificationToUser', (userId, message, type, additionalData) => {
    try {
      const userConnections = fastify.connections.get(userId);
      if (userConnections) {
        const notification = {
          message,
          type,
          ...additionalData
        };
        for (const conn of userConnections) {
          conn.send(JSON.stringify({ notification }));
        }
        console.log(`Notification sent to user ${userId}`);
      } else {
        console.log(`No active connections for user ${userId}`);
      }
    } catch (err) {
      console.error(`Error sending notification to user ${userId}:`, err);
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

});
