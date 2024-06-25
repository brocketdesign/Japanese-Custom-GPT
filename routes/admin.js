const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function routes(fastify, options) {
    fastify.get('/admin/users', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }
            const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
            const users = await usersCollection.find({}).toArray()
            return reply.view('/admin/users',{users})
        } catch (error) {
            return reply.status(500).send({ error: error.message });
        }
    });
    fastify.get('/admin/chat/:userId', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }
            const userId = new fastify.mongo.ObjectId(request.params.userId)
            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const chats = await collectionChat.find({userId}).toArray();
            return reply.view('/admin/chats',{chats})
        } catch (error) {
            return reply.status(500).send({ error: error.message });
        }
    });
    const adminEmails = ['e2@gmail.com']; // Add your admin emails here

    async function checkUserAdmin(userId) {
        const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
        const user = await usersCollection.findOne({_id: new ObjectId(userId)});
        if (!user) {
            throw new Error('User not found');
        }
        return adminEmails.includes(user.email);
    }
}


module.exports = routes;
