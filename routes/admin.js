const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const  { checkUserAdmin } = require('../models/tool')
const cleanupNonRegisteredUsers = require('../models/cleanupNonRegisteredUsers');
const axios = require('axios');
const hbs = require('handlebars');

const fetchModels = async (query = '', cursor = '') => {
  try {
    const url = `https://api.novita.ai/v3/model?filter.visibility=public&pagination.limit=10${
      cursor ? `&pagination.cursor=${cursor}` : ''
    }${query ? `&filter.querystring=${encodeURIComponent(query)}` : ''}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching models:', error.message);
    return { models: [], pagination: {} };
  }
};

async function routes(fastify, options) {

  // Admin dashboard for mails
  fastify.get('/admin/mails', {
    
  }, async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }
      const db = fastify.mongo.db;
      const mailsCollection = db.collection('mails');
      const mails = await mailsCollection.find().sort({ createdAt: -1 }).toArray();
      return reply.view('/admin/mails', { mails });
    } catch (error) {
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.get('/admin/notifications', async (request, reply) => {
    const user = request.user;
    const isAdmin = await checkUserAdmin(fastify, user._id);
    if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });

    const db = fastify.mongo.db;
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
  
    fastify.get('/admin/users',  async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(fastify, request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }
            const usersCollection = fastify.mongo.db.collection('users');
            const chatsCollection = fastify.mongo.db.collection('userChat');
            
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
            return reply.view('/admin/users',{
              user: request.user,
              users,
              title:translations.admin_user.recent_users, 
              translations
            })
        } catch (error) {
            return reply.status(500).send({ error: error.message });
        }
    });
    fastify.put('/admin/users/:userId/subscription', async (request, reply) => {
      try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const userId = request.params.userId;
      const usersCollection = fastify.mongo.db.collection('users');

      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const subscriptionStatus = user.subscriptionStatus === 'active' ? 'inactive' : 'active';
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { subscriptionStatus } }
      );

      if (result.matchedCount === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.status(200).send({ message: 'Subscription updated successfully', subscriptionStatus });
      } catch (error) {
      return reply.status(500).send({ error: 'Internal Server Error' });
      }
    });
    fastify.delete('/admin/users/:id',  async (request, reply) => {
        try {
          const isAdmin = await checkUserAdmin(fastify, request.user._id);
          if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
          }
          const userId = request.params.id;
          const usersCollection = fastify.mongo.db.collection('users');

          const userDataStoryCollection = fastify.mongo.db.collection('userData');

          const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
          if (result.deletedCount === 0) {
            return reply.status(404).send({ error: 'User not found' });
          }
          return reply.status(200).send({ message: 'User deleted successfully' });
        } catch (error) {
          return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
    fastify.get('/admin/users/registered',  async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(fastify, request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }

            const usersCollection = fastify.mongo.db.collection('users');        
            
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
                user: request.user,
                users,
                translations,
                mode: process.env.MODE,
                apiurl: process.env.API_URL,
                femaleCount, 
                femalePercentage, 
                maleCount,
                malePercentage,
                title:translations.admin_user.registered_users})
        } catch (error) {
            return reply.status(500).send({ error: error.message });
        }
    });
    fastify.get('/admin/users/csv', async (request, reply) => {
      try {
        const isAdmin = await checkUserAdmin(fastify, request.user._id);
        if (!isAdmin) return reply.status(403).send({ error: 'Access denied' });
        
        let fields = request.query.fields ? request.query.fields.split(',') : [];
        if (!fields.length) fields = ['createdAt', 'email', 'nickname', 'gender', 'subscriptionStatus'];
        const projection = {};
        fields.forEach(field => projection[field] = 1);
        
        const users = await fastify.mongo.db.collection('users')
          .find({ email: { $exists: true } })
          .project(projection)
          .toArray();
        
        const header = fields.join(',');
        const rows = users.map(u => fields.map(f => u[f] || '').join(','));
        const csv = [header, ...rows].join('\n');
        
        reply.header('Content-Type', 'text/csv')
             .header('Content-Disposition', 'attachment; filename="users.csv"')
             .send(csv);
      } catch (error) {
        reply.status(500).send({ error: error.message });
      }
    });
    
    fastify.get('/admin/chat/:userId',  async (request, reply) => {
        try {
          // Check if the user is an admin
          const isAdmin = await checkUserAdmin(fastify, request.user._id);
          if (!isAdmin) {
            return reply.status(403).send({ error: 'Access denied' });
          }
      
          // Convert the userId from the route parameter to ObjectId
          const userId = new fastify.mongo.ObjectId(request.params.userId);
      
          // Access the userChat collection
          const collectionChat = fastify.mongo.db.collection('userChat');
      
          // Fetch userChat documents
        const userChats = await collectionChat.find({ userId }).toArray();

        // Extract unique chatIds
        const chatIds = userChats.map(chat => chat.chatId);

        // Fetch corresponding chat names
        const collectionChats = fastify.mongo.db.collection('chats');
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

        return reply.view('/admin/chats', { 
          user: request.user,
          chats: enrichedChats 
        });
        } catch (error) {
          console.error('Error fetching chats:', error);
          return reply.status(500).send({ error: error.message });
        }
      });
      

    fastify.get('/admin/users/cleanup', async (request, reply) => {
        try {
            const isAdmin = await checkUserAdmin(fastify, request.user._id);
            if (!isAdmin) {
                return reply.status(403).send({ error: 'Access denied' });
            }
    
            const db = fastify.mongo.db;
            const resultMessage = await cleanupNonRegisteredUsers(db);
    
            return reply.send({ message: resultMessage });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: error.message });
        }
    });
    fastify.get('/admin/prompts', async (request, reply) => {
    try {
      let user = request.user;
      const userId = user._id;
      const isAdmin = await checkUserAdmin(fastify, userId);
      if (!isAdmin) {
          return reply.status(403).send({ error: 'Access denied' });
      }
      const db = fastify.mongo.db;
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      const translations = request.translations

      const prompts = await db.collection('prompts').find().toArray();

      return reply.view('/admin/prompts', {
        title: 'コミュニティからの最新投稿 | LAMIX | 日本語 | 無料AI画像生成 | 無料AIチャット',
        user,
        prompts,
        translations
      });
    } catch (error) {
      console.log(error)
    }
  });

const fetchModels = async (query = '', cursor = '') => {

  try {
    const url = `https://api.novita.ai/v3/model?filter.visibility=public&filter.types=checkpoint&pagination.limit=12${
      cursor ? `&pagination.cursor=${cursor}` : ''
    }${query ? `&filter.query=${encodeURIComponent(query)}` : ''}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
      },
    });

    response.data.models = response.data.models.map(model => ({
      ...model,
      base_model: model.is_sdxl ? 'sdxl' : 'sd'
    }));

    return  response.data;
    
  } catch (error) {
    console.error('Error fetching models:', error.message);
    return { models: [], pagination: {} };
  }
};

const modelCardTemplate = hbs.compile(`
  {{#each models}}
    <div class="col-md-4 mb-3 animate__animated animate__fadeIn">
      <div class="card border-0 h-100 position-relative">
        <div class="card-img-container" style="overflow: hidden;">
          <img src="{{cover_url}}" class="card-img-top w-100" alt="{{model_name}}" style="object-fit: cover; height: 100%;" />
        </div>
        <div class="card-body d-flex justify-content-between position-absolute w-100 py-2 text-white" style="bottom: 0; background-color: rgba(0, 0, 0, 0.25);">
          <h5 class="card-title text-truncate">{{model_name}}</h5>
          <div class="form-check form-switch">
            <input class="form-check-input model-switch" type="checkbox" 
              data-model-id="{{id}}" 
              data-model="{{sd_name}}"
              data-style="{{tags.[0]}}" 
              data-version="{{base_model}}"
              data-image="{{cover_url}}">
          </div>
          <i class="bi bi-info-circle" data-bs-toggle="modal" data-bs-target="#infoModal-{{id}}" style="cursor: pointer;"></i>
        </div>
      </div>
    </div>
    <div class="modal fade" id="infoModal-{{id}}" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{name}}</h5>
          </div>
          <div class="modal-body">
            <p><strong>Hash:</strong> {{hash_sha256}}</p>
            <p><strong>Base Model:</strong> {{base_model}}</p>
            <p><strong>Model Name:</strong> {{model_name}}</p>
            <p><strong>Tags:</strong> {{tags}}</p>
          </div>
        </div>
      </div>
    </div>
  {{/each}}
`);
  
  fastify.post('/admin/models', async (request, reply) => {
    const { cursor, search } = request.query;
    const data = await fetchModels(search, cursor);
    const html = modelCardTemplate({ models:data.models });
    return reply.code(200).send({ html, pagination: data.pagination });
  });

  // Add model to the database
  fastify.post('/admin/models/add', async (req, reply) => {
    const { modelId, model, style, version, image } = req.body;
    const db = fastify.mongo.db;
    await db.collection('myModels').insertOne({ modelId, model, style, version, image });
    reply.send({ success: true, message: 'Model added successfully.' });
  });

  // Remove model from the database
  fastify.post('/admin/models/remove', async (req, reply) => {
    const { modelId } = req.body;
    const db = fastify.mongo.db;
    await db.collection('myModels').deleteOne({ modelId });
    reply.send({ success: true, message: 'Model removed successfully.' });
  });

  fastify.get('/admin/models', async (req, res) => {
    let user = req.user;
    const db = fastify.mongo.db;
    const models = await db.collection('myModels').find({}).toArray();
    return res.view('/admin/models',{user,models});
  });
  
}    


module.exports = routes;
