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
            const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            
            const getUniqueUsers = async () => {
                try {
                    // Get the unique userId's from the chats collection
                    const userIds = await chatsCollection.distinct('userId');
            
                    // Get today's and yesterday's dates
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Set to start of today
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1); // Set to start of yesterday
            
                    // Query the users collection to get the user details for the unique userIds
                    const users = await usersCollection.find({
                        _id: { $in: userIds },
                        createdAt: { $gte: yesterday, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
                    }).toArray();
            
                    return users;
                } catch (error) {
                    console.error('Error fetching unique users:', error);
                    throw error;
                }
            };
            
            
            const users = await getUniqueUsers()
            console.log(users[0])
            return reply.view('/admin/users',{users,title:'Latest users'})
        } catch (error) {
            return reply.status(500).send({ error: error.message });
        }
    });
    fastify.delete('/admin/users/:id', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        try {
          const isAdmin = await checkUserAdmin(request.user._id);
          if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
          }
          const userId = request.params.id;
          const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');

          const userDataStoryCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');

          const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
          if (result.deletedCount === 0) {
            return reply.status(404).send({ error: 'User not found' });
          }
          return reply.status(200).send({ message: 'User deleted successfully' });
        } catch (error) {
          return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
    fastify.get('/admin/users/registered', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }

            const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');        
            
            const users =  await usersCollection.find({
                email: { $exists: true }
            }).sort({createdAt:-1}).toArray();;

            return reply.view('/admin/users',{users, title:'Registered users'})
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
