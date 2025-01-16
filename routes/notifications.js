const { ObjectId } = require('mongodb');
const { checkUserAdmin } = require('../models/tool');

async function routes(fastify, options) {

  fastify.post('/notifications', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const { userId, title, message, type, data, sticky } = request.body;

      const db = fastify.mongo.db;
      const notificationsCollection = db.collection('notifications');

      let notifications = [];
      const asianDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
      if (sticky) {
        notifications.push({
          title,
          message,
          type: type || 'info',
          data: data || {},
          viewed: false,
          createdAt: asianDate,
          sticky: true,
          dismissedBy: [],
        });
      } else {
        let targetUserIds;

        if (userId === 'all') {
          const usersCollection = db.collection('users');
          const users = await usersCollection.find({}, { projection: { _id: 1 } }).toArray();
          targetUserIds = users.map(u => u._id);
        } else if (Array.isArray(userId)) {
          targetUserIds = userId.map(id => new fastify.mongo.ObjectId(id));
        } else if (userId) {
          targetUserIds = [new fastify.mongo.ObjectId(userId)];
        } else {
          return reply.code(400).send({ error: 'userId is required' });
        }

        const asianDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
        notifications = targetUserIds.map(uid => ({
          userId: uid,
          title,
          message,
          type: type || 'info',
          data: data || {},
          viewed: false,
          createdAt: asianDate,
          sticky: false,
        }));
      }

      await notificationsCollection.insertMany(notifications);

      reply.code(201).send({ message: 'Notifications created' });
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

      const stickyNotifications = await notificationsCollection.find({
        sticky: true,
        dismissedBy: { $ne: userId },
      }).toArray();

      const notifications = userNotifications
        .concat(stickyNotifications)
        .sort((a, b) => b.createdAt - a.createdAt);

      reply.send(notifications);
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
