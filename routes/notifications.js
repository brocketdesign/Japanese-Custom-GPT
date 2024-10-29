const { ObjectId } = require('mongodb');
const  { checkUserAdmin } = require('../models/tool')

async function routes(fastify, options) {
  fastify.post('/notifications', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const isAdmin = await checkUserAdmin(fastify, user._id);
      if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

      const { userId, message, type, data } = request.body;

      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const notificationsCollection = db.collection('notifications');

      let targetUserIds;

      if (userId === 'all') {
        const usersCollection = db.collection('users');
        const users = await usersCollection.find({}, { projection: { _id: 1 } }).toArray();
        targetUserIds = users.map(u => u._id);
      } else if (Array.isArray(userId)) {
        targetUserIds = userId.map(id => new ObjectId(id));
      } else if (userId) {
        targetUserIds = [new ObjectId(userId)];
      } else {
        return reply.code(400).send({ error: 'userId is required' });
      }

      const notifications = targetUserIds.map(uid => ({
        userId: uid,
        message,
        type: type || 'info',
        data: data || {},
        viewed: false,
        createdAt: new Date(),
      }));

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
      const userId = new ObjectId(user._id);

      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const notificationsCollection = db.collection('notifications');

      const notifications = await notificationsCollection.find({ userId }).sort({ createdAt: -1 }).toArray();

      reply.send(notifications);
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.put('/notifications/:id/viewed', async (request, reply) => {
    try {
      const user = await fastify.getUser(request, reply);
      const userId = new ObjectId(user._id);
      const notificationId = new ObjectId(request.params.id);

      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.updateOne(
        { _id: notificationId, userId },
        { $set: { viewed: true } }
      );

      if (result.matchedCount === 0) return reply.code(404).send({ error: 'Notification not found' });

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

      const notificationId = new ObjectId(request.params.id);

      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.findOne(
        { _id: notificationId }
      );

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

      const notificationId = new ObjectId(request.params.id);
      const { message, type, data } = request.body;

      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const notificationsCollection = db.collection('notifications');

      const update = {};
      if (message) update.message = message;
      if (type) update.type = type;
      if (data) update.data = data;

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

      const notificationId = new ObjectId(request.params.id);

      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const notificationsCollection = db.collection('notifications');

      const result = await notificationsCollection.deleteOne({ _id: notificationId });

      if (result.deletedCount === 0) return reply.code(404).send({ error: 'Notification not found' });

      reply.send({ message: 'Notification deleted' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.decorate('createNotification', async (userId, message, type, data) => {
    const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
    const notificationsCollection = db.collection('notifications');

    const notification = {
      userId: new ObjectId(userId),
      message,
      type: type || 'info',
      data: data || {},
      viewed: false,
      createdAt: new Date(),
    };

    await notificationsCollection.insertOne(notification);
  });
}

module.exports = routes;
