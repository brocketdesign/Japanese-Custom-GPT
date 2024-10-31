const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const  { checkUserAdmin } = require('../models/tool')
const cleanupNonRegisteredUsers = require('../models/cleanupNonRegisteredUsers');
async function routes(fastify, options) {

  fastify.get('/admin/notifications', async (request, reply) => {
    const user = await fastify.getUser(request, reply);
    const isAdmin = await checkUserAdmin(fastify, user._id);
    if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

    const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
    const notificationsCollection = db.collection('notifications');

    const notifications = await notificationsCollection.aggregate([
      {
        $group: {
          _id: {_id:"$_id", title: "$title", message: "$message", type: "$type", sticky: "$sticky", createdAt: "$createdAt" },
          viewedCount: { $sum: { $cond: ["$viewed", 1, 0] } },
          total: { $sum: 1 }
        }
      },
      { $sort: { "_id.createdAt": -1 } }
    ]).toArray();

    const formattedNotifications = notifications.map(n => ({
      _id: n._id._id,
      title : n._id.title,
      message: n._id.message,
      type: n._id.type,
      sticky : n._id.sticky,
      createdAt: n._id.createdAt,
      viewedCount: n.viewedCount
    }));

    return reply.view('/admin/notifications', { notifications: formattedNotifications });
  });


    fastify.get('/admin/users', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(fastify, request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }
            const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
            const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            
            const getUniqueUsers = async () => {
                try {
                    // Get the unique userId's from the chats collection
                    const userIds = await usersCollection.distinct('_id');
            
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    
                    today.toLocaleDateString('ja-JP');
                    yesterday.toLocaleDateString('ja-JP');                    
            
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
            const translations = request.translations
            return reply.view('/admin/users',{users,title:'Latest users', translations})
        } catch (error) {
            return reply.status(500).send({ error: error.message });
        }
    });
    fastify.delete('/admin/users/:id', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        try {
          const isAdmin = await checkUserAdmin(fastify, request.user._id);
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
            const isAdmin = await checkUserAdmin(fastify, request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }

            const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');        
            
            const users =  await usersCollection.find({
                email: { $exists: true }
            }).sort({createdAt:-1}).toArray();;
            const totalUsers = users.length;
            const femaleCount = users.filter(user => user.gender === 'female').length;
            const maleCount = users.filter(user => user.gender === 'male').length;
            
            const femalePercentage = parseInt((femaleCount / totalUsers) * 100);
            const malePercentage = parseInt((maleCount / totalUsers) * 100);
            const translations = request.translations

            return reply.view('/admin/users',{
                users,
                translations,
                femaleCount, 
                femalePercentage, 
                maleCount,
                malePercentage,
                title:'Registered users'})
        } catch (error) {
            return reply.status(500).send({ error: error.message });
        }
    });
    
    fastify.get('/admin/chat/:userId', {
        preHandler: [fastify.authenticate]
      }, async (request, reply) => {
        try {
          // Check if the user is an admin
          const isAdmin = await checkUserAdmin(fastify, request.user._id);
          if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
          }
      
          // Convert the userId from the route parameter to ObjectId
          const userId = new fastify.mongo.ObjectId(request.params.userId);
      
          // Access the userChat collection
          const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
      
          // Fetch userChat documents
        const userChats = await collectionChat.find({ userId }).toArray();

        // Extract unique chatIds
        const chatIds = userChats.map(chat => chat.chatId);

        // Fetch corresponding chat names
        const collectionChats = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const chatsDetails = await collectionChats.find({ _id: { $in: chatIds } }).toArray();

        // Create a map of chatId to chatName
        const chatMap = {};
        chatsDetails.forEach(chat => {
        chatMap[chat._id.toString()] = chat.name;
        });

        // Attach chatName to each userChat
        const enrichedChats = userChats.map(chat => ({
        ...chat,
        name: chatMap[chat.chatId.toString()] || 'Unknown Chat'
        }));

        return reply.view('/admin/chats', { chats: enrichedChats });
        } catch (error) {
          console.error('Error fetching chats:', error);
          return reply.status(500).send({ error: error.message });
        }
      });
      

    fastify.get('/admin/users/cleanup', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(fastify, request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }
    
            const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
            const resultMessage = await cleanupNonRegisteredUsers(db);
    
            return reply.send({ message: resultMessage });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: error.message });
        }
    });

    fastify.get('/admin/new-prompts',{
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      try {
        let user = request.user;
        const userId = user._id;
        const isAdmin = await checkUserAdmin(fastify, userId);
        if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
        }
        const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
        user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
        const translations = request.translations

        return reply.view('new-prompts', {
          title: 'コミュニティからの最新投稿 | LAMIX | 日本語 | 無料AI画像生成 | 無料AIチャット',
          user,
          translations
        });
      } catch (error) {
        console.log(error)
      }
    });
    fastify.get('/admin/prompts',{
      preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      let user = request.user;
      const userId = user._id;
      const isAdmin = await checkUserAdmin(fastify, userId);
      if (!isAdmin) {
          return reply.status(403).send({ error: 'Access denied' });
      }
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      const translations = request.translations

      const prompts = await db.collection('prompts').find().toArray();

      return reply.view('prompts', {
        title: 'コミュニティからの最新投稿 | LAMIX | 日本語 | 無料AI画像生成 | 無料AIチャット',
        user,
        prompts,
        translations
      });
    } catch (error) {
      console.log(error)
    }
  });
}    


module.exports = routes;
