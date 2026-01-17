const { ObjectId } = require('mongodb');
const { checkUserAdmin } = require('../models/tool');

// Purge notifications older than 30 days
async function purgeOldNotifications(db) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const notificationsCollection = db.collection('notifications');
  const result = await notificationsCollection.deleteMany({
    createdAt: { $lt: thirtyDaysAgo.toISOString() },
    sticky: { $ne: true } // Don't delete sticky notifications
  });
  
  if (result.deletedCount > 0) {
    console.log(`[Notifications] Purged ${result.deletedCount} notifications older than 30 days`);
  }
  
  return result.deletedCount;
}

async function routes(fastify, options) {

  // Auto-purge on server start (run once)
  purgeOldNotifications(fastify.mongo.db).catch(err => {
    console.error('[Notifications] Error during auto-purge:', err);
  });

  // Manual purge endpoint for admins
  fastify.delete('/notifications/purge-old', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const deletedCount = await purgeOldNotifications(fastify.mongo.db);
      reply.send({ message: `Purged ${deletedCount} old notifications` });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  // Search users for notification targeting
  fastify.get('/notifications/search-users', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const { q, limit = 10 } = request.query;
      const db = fastify.mongo.db;
      const usersCollection = db.collection('users');

      let query = { isTemporary: { $ne: true } };
      
      if (q && q.trim()) {
        const searchTerm = q.trim();
        // Check if search term looks like an ObjectId
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(searchTerm);
        
        if (isObjectId) {
          query._id = new ObjectId(searchTerm);
        } else {
          query.$or = [
            { nickname: { $regex: searchTerm, $options: 'i' } },
            { username: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { fullName: { $regex: searchTerm, $options: 'i' } }
          ];
        }
      }

      const users = await usersCollection.find(query, {
        projection: { _id: 1, nickname: 1, username: 1, email: 1, profileUrl: 1 }
      }).limit(parseInt(limit)).toArray();

      reply.send(users);
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.post('/notifications', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const { userId, title, message, type, link, actionText, imageUrl, sticky } = request.body;

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      // Build notification data from individual fields
      const notificationData = {};
      if (link) notificationData.link = link;
      if (actionText) notificationData.actionText = actionText;
      if (imageUrl) notificationData.imageUrl = imageUrl;

      let notifications = [];
      const createdAt = new Date().toISOString();
      
      if (sticky) {
        notifications.push({
          title,
          message,
          type: type || 'info',
          data: notificationData,
          viewed: false,
          createdAt,
          sticky: true,
          dismissedBy: [],
        });
      } else {
        let targetUserIds;

        if (userId === 'all') {
          const usersCollection = db.collection('users');
          const users = await usersCollection.find({ isTemporary: { $ne: true } }, { projection: { _id: 1 } }).toArray();
          targetUserIds = users.map(u => u._id);
        } else if (Array.isArray(userId)) {
          targetUserIds = userId.map(id => new fastify.mongo.ObjectId(id));
        } else if (userId) {
          targetUserIds = [new fastify.mongo.ObjectId(userId)];
        } else {
          return reply.code(400).send({ error: 'userId is required' });
        }

        notifications = targetUserIds.map(uid => ({
          userId: uid,
          title,
          message,
          type: type || 'info',
          data: notificationData,
          viewed: false,
          createdAt,
          sticky: false,
        }));
      }

      await notificationsCollection.insertMany(notifications);

      reply.code(201).send({ message: 'Notifications created', count: notifications.length });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.get('/notifications', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const userId = new fastify.mongo.ObjectId(user._id);

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      // Get user's personal notifications
      const userNotifications = await notificationsCollection.find({
        userId: userId,
      }).toArray();

      // Get sticky notifications not dismissed by this user
      const stickyNotifications = await notificationsCollection.find({
        sticky: true,
        dismissedBy: { $ne: userId },
      }).toArray();

      const notifications = userNotifications
        .concat(stickyNotifications)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      reply.send(notifications);
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  // Get notification count for badge
  fastify.get('/notifications/count', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const userId = new fastify.mongo.ObjectId(user._id);

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      const count = await notificationsCollection.countDocuments({
        $or: [
          { userId: userId, viewed: false },
          { sticky: true, dismissedBy: { $ne: userId } }
        ]
      });

      reply.send({ count });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  
  fastify.put('/notifications/viewed/:id', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const userId = new fastify.mongo.ObjectId(user._id);
      const notificationId = new fastify.mongo.ObjectId(request.params.id);

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      const notification = await notificationsCollection.findOne({ _id: notificationId });

      if (!notification) return reply.code(404).send({ error: 'Notification not found' });

      if (notification.sticky) {
        await notificationsCollection.updateOne(
          { _id: notificationId },
          { $addToSet: { dismissedBy: userId } }
        );
      } else {
        if (!notification.userId.equals(userId)) {
          return reply.code(403).send({ error: 'Access denied' });
        }
        await notificationsCollection.updateOne(
          { _id: notificationId, userId },
          { $set: { viewed: true } }
        );
      }

      reply.send({ message: 'Notification marked as viewed' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.get('/notifications/:id', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const notificationId = new fastify.mongo.ObjectId(request.params.id);

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.findOne({ _id: notificationId });

      reply.send(result);
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.put('/notifications/:id', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const notificationId = new fastify.mongo.ObjectId(request.params.id);
      const { title, message, type, data, sticky } = request.body;

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      const update = {};
      if (title) update.title = title;
      if (message) update.message = message;
      if (type) update.type = type;
      if (data) update.data = data;
      if (typeof sticky !== 'undefined') update.sticky = sticky;

      const result = await notificationsCollection.updateOne(
        { _id: notificationId },
        { $set: update }
      );

      if (result.matchedCount === 0) return reply.code(404).send({ error: 'Notification not found' });

      reply.send({ message: 'Notification updated' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.delete('/notifications/:id', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const notificationId = new fastify.mongo.ObjectId(request.params.id);

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.deleteOne({ _id: notificationId });

      if (result.deletedCount === 0) return reply.code(404).send({ error: 'Notification not found' });

      reply.send({ message: 'Notification deleted' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
}

module.exports = routes;
