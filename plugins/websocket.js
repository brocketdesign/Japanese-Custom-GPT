const fastifyPlugin = require('fastify-plugin');

module.exports = fastifyPlugin(async function (fastify) {
  fastify.decorate('connections', new Map());
  fastify.decorate('pendingNotifications', new Map()); // Store pending notifications

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

      // Send any pending notifications when user connects
      const pendingNotifications = fastify.pendingNotifications.get(normalizedUserId);
      if (pendingNotifications && pendingNotifications.length > 0) {
        
        pendingNotifications.forEach(notification => {
          try {
            connection.send(JSON.stringify({ notification }));
          } catch (err) {
            console.error(`[WebSocket] Error sending pending notification to user ${normalizedUserId}:`, err);
          }
        });
        
        // Clear pending notifications after sending
        fastify.pendingNotifications.delete(normalizedUserId);
      }

      connection.on('message', (message) => {
        try {
          connection.send(message); // Echo back the message
        } catch (err) {
          console.error(`[WebSocket] Error sending message to user ${normalizedUserId}:`, err);
        }
      });

      connection.on('close', () => {
        const userConnections = fastify.connections.get(normalizedUserId);
        if (userConnections) {
          userConnections.delete(connection);
          if (userConnections.size === 0) {
            fastify.connections.delete(normalizedUserId);
            console.log(`[WebSocket] User ${normalizedUserId} disconnected - no active connections`);
          }
        }
      });
    } catch (err) {
      console.error('Unexpected error in WebSocket connection:', err);
    }
  });

  fastify.decorate('sendNotificationToUser', (userId, type, additionalData, options = {}) => {
    try {
      const normalizedUserId = userId.toString();
      const userConnections = fastify.connections.get(normalizedUserId);
      
      const notification = {
        type,
        ...additionalData,
        timestamp: new Date().toISOString() // Add timestamp for debugging
      };

      if (userConnections && userConnections.size > 0) {
        // User is connected - send immediately        
        for (const conn of userConnections) {
          try {
            if (conn.readyState === 1) { // WebSocket.OPEN
              conn.send(JSON.stringify({ notification }));
            }
          } catch (connErr) {
            console.error(`[WebSocket] Error sending to specific connection for user ${normalizedUserId}:`, connErr);
          }
        }
        
        return { status: 'sent', method: 'immediate' };
      } else {
        // User not connected - queue notification
        const { 
          queue = true, 
          maxAge = 5 * 60 * 1000, // 5 minutes default
          maxQueueSize = 10 
        } = options;
        
        if (queue) {
          
          if (!fastify.pendingNotifications.has(normalizedUserId)) {
            fastify.pendingNotifications.set(normalizedUserId, []);
          }
          
          const pendingQueue = fastify.pendingNotifications.get(normalizedUserId);
          
          // Add expiry time
          notification.expiresAt = Date.now() + maxAge;
          
          // Prevent queue from growing too large
          if (pendingQueue.length >= maxQueueSize) {
            pendingQueue.shift(); // Remove oldest notification
          }
          
          pendingQueue.push(notification);
          
          return { status: 'queued', queueSize: pendingQueue.length };
        } else {
          console.log(`[WebSocket] User ${normalizedUserId} not connected and queueing disabled - notification '${type}' dropped`);
          return { status: 'dropped', reason: 'user_not_connected' };
        }
      }
    } catch (err) {
      console.error(`[WebSocket] Error in sendNotificationToUser for user ${normalizedUserId}:`, err);
      return { status: 'error', error: err.message };
    }
  });

  // Clean up expired notifications every minute
  setInterval(() => {
    const now = Date.now();
    let totalCleaned = 0;
    
    for (const [userId, notifications] of fastify.pendingNotifications.entries()) {
      const beforeCount = notifications.length;
      
      // Filter out expired notifications
      const validNotifications = notifications.filter(notification => {
        return !notification.expiresAt || notification.expiresAt > now;
      });
      
      if (validNotifications.length !== beforeCount) {
        const cleanedCount = beforeCount - validNotifications.length;
        totalCleaned += cleanedCount;
        
        if (validNotifications.length === 0) {
          fastify.pendingNotifications.delete(userId);
        } else {
          fastify.pendingNotifications.set(userId, validNotifications);
        }
        
        console.log(`[WebSocket] Cleaned ${cleanedCount} expired notifications for user ${userId}`);
      }
    }
    
    if (totalCleaned > 0) {
      console.log(`[WebSocket] Cleanup: Removed ${totalCleaned} expired notifications total`);
    }
  }, 60000); // Every minute

  // Enhanced ping with queue size info
  setInterval(() => {
    for (const [userId, connections] of fastify.connections.entries()) {
      const queueSize = fastify.pendingNotifications.get(userId)?.length || 0;
      
      for (const conn of connections) {
        if (conn.readyState === 1) {
          conn.send(JSON.stringify({ 
            type: 'ping',
            queueSize // Let client know if there are pending notifications
          }));
        }
      }
    }
  }, 30000);

  // Debug routes
  fastify.get('/active-connections', async (request, reply) => {
    const activeConnections = Array.from(fastify.connections.keys());
    const pendingCounts = {};
    
    for (const [userId, notifications] of fastify.pendingNotifications.entries()) {
      pendingCounts[userId] = notifications.length;
    }
    
    reply.send({ 
      activeConnections,
      pendingNotifications: pendingCounts,
      totalPending: Array.from(fastify.pendingNotifications.values()).reduce((sum, arr) => sum + arr.length, 0)
    });
  });

  fastify.post('/notify-user', async (request, reply) => {
    const { userId, type, data, options } = request.body;
    const result = fastify.sendNotificationToUser(userId, type, data, options);
    reply.send({ result });
  });
});