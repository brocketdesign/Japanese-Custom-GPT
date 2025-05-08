const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const  { checkUserAdmin } = require('../models/tool')
const cleanupNonRegisteredUsers = require('../models/cleanupNonRegisteredUsers');
const axios = require('axios');
const hbs = require('handlebars');
const { fetchRandomCivitaiPrompt, createModelChat } = require('../models/civitai');

const fetchModels = async (query = false, cursor = false) => {
  try {
    let url = 'https://api.novita.ai/v3/model?filter.visibility=public&filter.source=civitai&pagination.limit=30&filter.types=checkpoint&filter.is_sdxl=true';
    if (cursor) {
      url += `&pagination.cursor=${cursor}`;
    }
    if (query) {
      url += `&filter.query=${encodeURIComponent(query)}`;
    }

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
      },
    });

    return response.data;
  } catch (error) {
    console.log('Error fetching models:', error.message);
    return { models: [], pagination: {} };
  }
};

async function routes(fastify, options) {

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
  
  fastify.get('/admin/users', async (request, reply) => {
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
            
      const users = await getUniqueUsers();
      const translations = request.translations;
      return reply.view('/admin/users',{
        user: request.user,
        users,
        title: translations.admin_user.recent_users, 
        translations
      });
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
      console.log(`Updating subscription status for user ${userId} to ${subscriptionStatus}`);
      if (result.matchedCount === 0) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.status(200).send({ message: 'Subscription updated successfully', subscriptionStatus });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.delete('/admin/users/:id', async (request, reply) => {
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

  fastify.get('/admin/users/registered', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const usersCollection = fastify.mongo.db.collection('users');        
      
      const users = await usersCollection.find({
        email: { $exists: true }
      }).sort({createdAt:-1}).toArray();
      
      const totalUsers = users.length;
      const femaleCount = users.filter(user => user.gender === 'female').length;
      const maleCount = users.filter(user => user.gender === 'male').length;
      
      const femalePercentage = parseInt((femaleCount / totalUsers) * 100);
      const malePercentage = parseInt((maleCount / totalUsers) * 100);
      const translations = request.translations;

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
        title: translations.admin_user.registered_users
      });
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
    
  fastify.get('/admin/chat/:userId', async (request, reply) => {
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

  const modelCardTemplate = hbs.compile(`
    {{#each models}}
    <div class="col-sm-6 col-md-4 col-lg-3 p-2 animate__animated animate__fadeIn">
      <div class="card model-gallery-card bg-dark text-white shadow-lg position-relative overflow-hidden" style="height: 400px;">
        <img src="{{cover_url}}" class="card-img-top h-100 w-100" alt="{{name}}" style="object-fit: cover;">
        <div class="card-img-overlay d-flex flex-column justify-content-end p-2" style="background-image: linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0)); z-index: 1;">
          <h5 class="card-title fs-6 fw-semibold text-truncate mb-1" title="{{name}}">{{name}}</h5>
          <p class="card-text fs-6 text-truncate mb-1 text-light" title="{{sd_name}}">{{sd_name}}</p>
          <div class="d-flex justify-content-between align-items-center">
            <div class="form-check form-switch">
              <input class="form-check-input model-switch" type="checkbox"
                data-model-id="{{id}}"
                data-model="{{sd_name}}"
                data-style="{{#if tags}}{{tags.[0]}}{{/if}}"
                data-version="{{base_model}}"
                data-image="{{cover_url}}"
                data-name="{{name}}">
            </div>
            <button class="btn btn-sm btn-outline-light model-gallery-info-btn p-1" type="button" title="View Details">
              <i class="bi bi-info-circle"></i>
            </button>
          </div>
        </div>
        <div class="model-details-panel position-absolute top-0 start-0 w-100 h-100 bg-dark bg-opacity-90 p-3 d-none animate__animated overflow-auto" style="z-index: 2;">
          <button type="button" class="btn-close btn-close-white position-absolute top-0 end-0 m-2 model-gallery-details-close-btn" aria-label="Close"></button>
          <h6 class="h5 fw-bold mb-2">{{name}}</h6>
          <p class="small mb-1"><strong>Model:</strong> {{sd_name}}</p>
          <p class="small mb-1"><strong>Base:</strong> {{base_model}}</p>
          <p class="small mb-1"><strong>Style:</strong> {{#if tags}}{{tags.[0]}}{{else}}N/A{{/if}}</p>
          <p class="small mb-1"><strong>ID:</strong> <span class="text-break">{{id}}</span></p>
          {{#if hash_sha256}}<p class="small mb-1"><strong>Hash:</strong> <span class="text-break">{{hash_sha256}}</span></p>{{/if}}
          <p class="small mb-0"><strong>Tags:</strong></p>
          <div class="mt-1">
            {{#if tags}}
              {{#each tags}}
                <span class="badge bg-primary me-1 mb-1">{{this}}</span>
              {{/each}}
            {{else}}
              <span class="small">N/A</span>
            {{/if}}
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
    const isAdmin = await checkUserAdmin(fastify, user._id);
    return res.view('/admin/models',{user,models});
  });

  fastify.get('/admin/model-chats', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const db = fastify.mongo.db;
      const chatsCollection = db.collection('chats');
      const modelsCollection = db.collection('myModels');
      const settingsCollection = db.collection('systemSettings');
      const translations = request.translations;

      // Get cron settings
      const cronSettings = await settingsCollection.findOne({ type: 'modelChatCron' }) || {
        schedule: '0 */2 * * *',
        enabled: false,
        nsfw: false
      };
      
      // If the cronManager module is available and job exists, get next run time
      if (fastify.cronJobs && cronSettings.enabled && cronSettings.schedule) {
        const { getNextRunTime } = require('../models/cronManager');
        cronSettings.nextRun = getNextRunTime('modelChatGenerator');
      }

      // Get all models
      const models = await modelsCollection.find({}).toArray();
      
      // Get system generated chats from the past week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentChats = await chatsCollection.find({
        systemGenerated: true,
        chatImageUrl: { $exists: true },
        createdAt: { $gte: oneWeekAgo }
      }).sort({ createdAt: -1 }).limit(20).toArray();
      
      // Group chats by model
      const chatsByModel = {};
      for (const chat of recentChats) {
        if (!chatsByModel[chat.imageModel]) {
          chatsByModel[chat.imageModel] = [];
        }
        chatsByModel[chat.imageModel].push(chat);
      }

      // Add model data
      const modelsWithChats = models.map(model => {
        return {
          ...model,
          chats: chatsByModel[model.model] || [],
          hasRecentChat: (chatsByModel[model.model] || []).some(chat => {
            const chatDate = new Date(chat.createdAt);
            const today = new Date();
            return chatDate.toDateString() === today.toDateString();
          })
        };
      });

      return reply.view('/admin/model-chats', {
        title: translations.admin_model_chats?.title || 'Model Chats',
        user: request.user,
        models: modelsWithChats,
        recentChats,
        cronSettings,
        translations
      });
    } catch (error) {
      console.error('Error loading model chats:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  // Add the new route to handle cron settings update
  fastify.post('/admin/model-chats/cron-settings', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { schedule, enabled, nsfw } = request.body;
      const db = fastify.mongo.db;
      const settingsCollection = db.collection('systemSettings');

      // Validate schedule format (basic validation)
      if (!schedule || typeof schedule !== 'string' || !schedule.trim()) {
        return reply.status(400).send({ error: 'Invalid cron schedule format' });
      }

      // Update settings in the database
      await settingsCollection.updateOne(
        { type: 'modelChatCron' },
        {
          $set: {
            schedule,
            enabled: enabled === true || enabled === 'true',
            nsfw: nsfw === true || nsfw === 'true',
            updatedAt: new Date()
          }
        },
        { upsert: true }
      );

      // Create the model chat generation task
      const modelChatGenerationTask = async () => {
        console.log('Running scheduled chat generation task...');
        const db = fastify.mongo.db;
        
        try {
          // Check if the database is accessible
          await db.command({ ping: 1 });
          
          // Get all available models
          const modelsCollection = db.collection('myModels');
          const models = await modelsCollection.find({}).toArray();
          
          console.log(`Found ${models.length} models to generate chats for`);
          
          // Find an admin user to use for image generation
          const usersCollection = db.collection('users');
          const adminUser = await usersCollection.findOne({ role: 'admin' });
          
          if (!adminUser) {
            console.log('No admin user found for automated chat generation');
            return;
          }
          
          // Update last run time
          await settingsCollection.updateOne(
            { type: 'modelChatCron' },
            { $set: { lastRun: new Date() } }
          );
          
          // Create chat for each model
          for (const model of models) {
            try {
              // Get prompt from Civitai
              const nsfwSetting = (nsfw === true || nsfw === 'true');
              const prompt = await fetchRandomCivitaiPrompt(model, nsfwSetting);
              
              if (!prompt) {
                console.log(`No suitable prompt found for model ${model.model}. Skipping.`);
                continue;
              }
              
              // Create a new chat - Pass admin user for image generation
              await createModelChat(db, model, prompt, 'en', fastify, adminUser, nsfwSetting);
              
              // Wait a bit between requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (modelError) {
              console.error(`Error processing model ${model.model}:`, modelError);
              // Continue with next model
            }
          }
          
          console.log('Scheduled chat generation completed');
        } catch (err) {
          console.error('Failed to execute scheduled chat generation:', err);
        }
      };

      // Configure the cron job
      const isEnabled = enabled === true || enabled === 'true';
      const success = fastify.configureCronJob(
        'modelChatGenerator', 
        schedule, 
        isEnabled,
        modelChatGenerationTask
      );

      // Get next run time if job was successfully set up
      let nextRun = null;
      if (success && isEnabled) {
        const { getNextRunTime } = require('../models/cronManager');
        nextRun = getNextRunTime('modelChatGenerator');
      }

      // Get the last run from the database
      const settings = await settingsCollection.findOne({ type: 'modelChatCron' });
      const lastRun = settings?.lastRun ? settings.lastRun.toLocaleString() : null;

      return reply.send({ 
        success: true, 
        message: 'Cron settings updated successfully',
        nextRun,
        lastRun
      });
    } catch (error) {
      console.error('Error updating cron settings:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Route to get a prompt preview from Civitai for a model
  fastify.post('/api/preview-prompt', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId, modelName, nsfw } = request.body;
      let modelNameToSearch = modelName;
      
      // If modelId is provided, look up the actual model name from the database
      if (modelId) {
        const db = fastify.mongo.db;
        const modelsCollection = db.collection('myModels');
        const model = await modelsCollection.findOne({ modelId });
        if (model) {
          modelNameToSearch = model;
        }
      }
      
      if (!modelNameToSearch) {
        return reply.status(400).send({ error: 'Model name is required' });
      }
      
      // Fetch a random prompt from Civitai with NSFW parameter
      const prompt = await fetchRandomCivitaiPrompt(modelNameToSearch, nsfw);
      
      if (!prompt) {
        return reply.status(404).send({ error: 'No suitable prompt found for this model' });
      }
      
      // Store the prompt in the database for later use
      const db = fastify.mongo.db;
      const promptsCache = db.collection('promptsCache');
      
      // Create a unique key for this prompt
      const promptKey = `${modelId || modelName}_${Date.now()}`;
      
      await promptsCache.insertOne({
        key: promptKey,
        prompt: prompt,
        modelId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // Expires in 30 minutes
      });
      
      // Return the prompt with its image URL and the key
      return reply.send({ prompt, promptKey });
    } catch (error) {
      console.error('Error fetching preview prompt:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/admin/model-chats/generate', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId, nsfw, promptKey } = request.body;
      const db = fastify.mongo.db;
      let civitaiData = null;
      
      // If promptKey is provided, retrieve the cached prompt
      if (promptKey) {
        const promptsCache = db.collection('promptsCache');
        const cachedPrompt = await promptsCache.findOne({ key: promptKey });
        
        if (cachedPrompt) {
          civitaiData = cachedPrompt.prompt;
          // Delete the cached prompt after use
          await promptsCache.deleteOne({ key: promptKey });
        }
      }
      
      // If modelId is provided, generate chat for a specific model
      if (modelId) {
        // Find the model in the database
        const modelsCollection = db.collection('myModels');
        const model = await modelsCollection.findOne({ modelId });
        
        if (!model) {
          return reply.status(404).send({ error: 'Model not found' });
        }
        
        // If we don't have a cached prompt, get a new one
        if (!civitaiData) {
          civitaiData = await fetchRandomCivitaiPrompt(model, nsfw);
        }

        if (!civitaiData) {
          return reply.status(404).send({ error: 'No suitable prompt found for this model' });
        }
        
        // Create a new chat - Pass the current user for image generation
        const chat = await createModelChat(db, model, civitaiData, request.lang, fastify, request.user, nsfw);

        if (!chat) {
          return reply.status(500).send({ error: 'Failed to create chat for model' });
        }
        
        // Add civitaiData to the chat
        chat.civitaiData = civitaiData;
        return reply.send({ success: true, chat });
      } else {
        // Generate for all models
        const modelsCollection = db.collection('myModels');
        const models = await modelsCollection.find({}).toArray();
        const results = [];
        
        for (const model of models) {
          try {
            // Get prompt from Civitai
            const prompt = await fetchRandomCivitaiPrompt(model, nsfw);
            
            if (!prompt) {
              results.push({ model: model.model, status: 'failed', reason: 'No suitable prompt found' });
              continue;
            }
            
            // Create a new chat - Pass current user for image generation
            const chat = await createModelChat(db, model, prompt, request.lang, fastify, request.user);
            
            if (!chat) {
              results.push({ model: model.model, status: 'failed', reason: 'Failed to create chat' });
            } else {
              results.push({ model: model.model, status: 'success', chatId: chat._id });
            }
            
            // Wait longer between requests to allow for image generation
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (error) {
            results.push({ model: model.model, status: 'error', error: error.message });
          }
        }
        
        return reply.send({ success: true, results });
      }
    } catch (error) {
      console.error('Error generating model chat:', error);
      return reply.status(500).send({ error: 'Internal server error', details: error.message });
    }
  }); 

  // Add new route to check if a user exists in Clerk
  fastify.get('/admin/clerk/check-user', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }
      
      const { email } = request.query;
      if (!email) {
        return reply.status(400).send({ error: 'Email is required' });
      }
      
      // Fetch user data from Clerk API
      const clerkApiUrl = 'https://api.clerk.com/v1/users';
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      
      if (!clerkSecretKey) {
        return reply.status(500).send({ error: 'Clerk secret key not configured' });
      }
      
      const response = await axios.get(`${clerkApiUrl}?email_address=${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data && response.data.data && response.data.data.length > 0) {
        // User exists in Clerk
        return reply.send({ 
          exists: true, 
          clerkId: response.data.data[0].id 
        });
      } else {
        // User does not exist in Clerk
        return reply.send({ exists: false });
      }
    } catch (error) {
      console.error('Error checking Clerk user:', error);
      return reply.status(500).send({ error: 'Failed to check user in Clerk' });
    }
  });
  
  // Add new route to add a user to Clerk
  fastify.post('/admin/clerk/add-user', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }
      
      const { userId, sendEmailInvite, skipPasswordCreation } = request.body;
      if (!userId) {
        return reply.status(400).send({ error: 'User ID is required' });
      }
      
      // Get user details from database
      const usersCollection = fastify.mongo.db.collection('users');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
      
      if (!user.email) {
        return reply.status(400).send({ error: 'User does not have an email address' });
      }
      
      // Create user in Clerk API
      const clerkApiUrl = 'https://api.clerk.com/v1/users';
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      
      if (!clerkSecretKey) {
        return reply.status(500).send({ error: 'Clerk secret key not configured' });
      }
      
      console.log('User data being sent to Clerk:', user);
      
      // Create the payload for Clerk API
      const payload = {
        email_addresses: [{ 
          email_address: user.email 
        }],
        first_name: user.firstName || user.nickname || '',
        last_name: user.lastName || '',
        username: user.username || user.nickname
      };
      
      // Add password if available, or handle password requirement based on skipPasswordCreation
      if (user.password) {
        // Use a temporary password if user has a hashed password in our database
        // Note: Since we can't unhash the password, we'll need to use a temporary one
        const tempPassword = Math.random().toString(36).slice(-8);
        payload.password = tempPassword;
      } else if (!skipPasswordCreation) {
        // If not skipping password creation and no password exists, use a random one
        const tempPassword = Math.random().toString(36).slice(-8);
        payload.password = tempPassword;
      } else {
        // If skipping password creation
        payload.password_enabled = false;
        payload.skip_password_requirement = true;
        payload.skip_password_checks = true;
      }
      
      // Add email invitation option
      if (sendEmailInvite) {
        payload.send_email_invitation = true;
      }
      
      console.log('Sending payload to Clerk:', JSON.stringify(payload));
      const response = await axios.post(clerkApiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data && response.data.id) {
        // Update user record with Clerk ID
        await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { clerkId: response.data.id } }
        );
        
        return reply.send({ 
          success: true, 
          clerkId: response.data.id 
        });
      } else {
        return reply.status(500).send({ error: 'Failed to create user in Clerk' });
      }
    } catch (error) {
      console.error('Error adding user to Clerk:', error);
      let errorMessage = 'Failed to add user to Clerk';
       
      // Extract detailed error message from Clerk API response
      if (error.response && error.response.data) {
        console.log('Clerk API error response:', JSON.stringify(error.response.data));
        
        if (error.response.data.errors && error.response.data.errors.length > 0) {
          errorMessage = error.response.data.errors.map(e => e.message || e.long_message || JSON.stringify(e)).join(', ');
        }
      }
      
      return reply.status(500).send({ error: errorMessage });
    }
  });

  // Add new route for bulk adding users to Clerk
  fastify.post('/admin/clerk/bulk-add-users', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }
      
      const { users, sendEmailInvite, skipPasswordCreation } = request.body;
      if (!users || !Array.isArray(users) || users.length === 0) {
        return reply.status(400).send({ error: 'No users provided' });
      }
      
      // Set progress tracking in a global variable
      fastify.bulkClerkProgress = {
        total: users.length,
        processed: 0,
        added: 0,
        existing: 0,
        failed: 0,
        results: []
      };
      
      // Process users in batches to avoid overwhelming the Clerk API
      const batchSize = 5;
      const results = [];
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        // Process each user in the batch concurrently
        const promises = batch.map(async (user) => {
          try {
            if (!user.email) {
              fastify.bulkClerkProgress.processed++;
              fastify.bulkClerkProgress.failed++;
              return { userId: user.userId, error: 'No email address', added: false };
            }
            
            // Check if user already has a clerkId in our database
            const dbUser = await fastify.mongo.db.collection('users').findOne({ _id: new ObjectId(user.userId) });
            if (!dbUser) {
              fastify.bulkClerkProgress.processed++;
              fastify.bulkClerkProgress.failed++;
              return { userId: user.userId, error: 'User not found in database', added: false };
            }
            
            if (dbUser.clerkId) {
              fastify.bulkClerkProgress.processed++;
              fastify.bulkClerkProgress.existing++;
              return { userId: user.userId, clerkId: dbUser.clerkId, added: false, existing: true };
            }
            
            // Check if user already exists in Clerk by email
            const checkResponse = await axios.get(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(user.email)}`, {
              headers: {
                'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (checkResponse.data && checkResponse.data.data && checkResponse.data.data.length > 0) {
              // User already exists in Clerk
              const clerkId = checkResponse.data.data[0].id;
              
              // Update user record with Clerk ID if needed
              await fastify.mongo.db.collection('users').updateOne(
                { _id: new ObjectId(user.userId) },
                { $set: { clerkId } }
              );
              
              fastify.bulkClerkProgress.processed++;
              fastify.bulkClerkProgress.existing++;
              return { userId: user.userId, clerkId, added: false, existing: true };
            }
            
            // Create user in Clerk API
            const payload = {
              email_addresses: [{ email_address: dbUser.email }],
              first_name: dbUser.firstName || dbUser.nickname || '',
              last_name: dbUser.lastName || '',
              username: dbUser.username || dbUser.nickname,
              password_enabled: !skipPasswordCreation,
              skip_password_requirement: skipPasswordCreation,
              skip_password_checks: skipPasswordCreation,
              send_email_invitation: sendEmailInvite
            };
            
            const response = await axios.post('https://api.clerk.com/v1/users', payload, {
              headers: {
                'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (response.data && response.data.id) {
              // Update user record with Clerk ID
              await fastify.mongo.db.collection('users').updateOne(
                { _id: new ObjectId(user.userId) },
                { $set: { clerkId: response.data.id } }
              );
              
              fastify.bulkClerkProgress.processed++;
              fastify.bulkClerkProgress.added++;
              return { userId: user.userId, clerkId: response.data.id, added: true };
            } else {
              fastify.bulkClerkProgress.processed++;
              fastify.bulkClerkProgress.failed++;
              return { userId: user.userId, error: 'Failed to create user in Clerk', added: false };
            }
          } catch (error) {
            console.error(`Error processing user ${user.userId}:`, error);
            let errorMessage = 'Failed to add user to Clerk';
            if (error.response && error.response.data && error.response.data.errors) {
              errorMessage = error.response.data.errors.map(e => e.message).join(', ');
            }
            
            fastify.bulkClerkProgress.processed++;
            fastify.bulkClerkProgress.failed++;
            return { userId: user.userId, error: errorMessage, added: false };
          }
        });
        
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        fastify.bulkClerkProgress.results = results;
        
        // Add a small delay between batches to avoid rate limiting
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      return reply.send({ 
        success: true, 
        total: users.length,
        added: fastify.bulkClerkProgress.added,
        existing: fastify.bulkClerkProgress.existing,
        failed: fastify.bulkClerkProgress.failed,
        results
      });
    } catch (error) {
      console.error('Error in bulk add to Clerk:', error);
      return reply.status(500).send({ error: 'Failed to process bulk add to Clerk' });
    }
  });

  // Get bulk progress
  fastify.get('/admin/clerk/bulk-progress', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }
      
      const progress = fastify.bulkClerkProgress || {
        total: 0,
        processed: 0,
        progress: 0
      };
      
      const progressPercent = progress.total > 0 
        ? Math.floor((progress.processed / progress.total) * 100) 
        : 0;
      
      return reply.send({
        total: progress.total,
        processed: progress.processed,
        progress: progressPercent
      });
    } catch (error) {
      console.error('Error getting bulk progress:', error);
      return reply.status(500).send({ error: 'Failed to get bulk progress' });
    }
  });
}

module.exports = routes;
