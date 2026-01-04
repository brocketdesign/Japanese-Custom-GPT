const { ObjectId } = require('mongodb');
const  { checkUserAdmin } = require('../models/tool')
const { fetchRandomCivitaiPrompt, createModelChat, markPromptStatus } = require('../models/civitai-utils');


async function routes(fastify, options) {

  // New endpoint for managing forbidden words
  fastify.get('/civitai/forbidden-words', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const db = fastify.mongo.db;
      const settingsCollection = db.collection('systemSettings');
      const forbiddenWordsSettings = await settingsCollection.findOne({ type: 'forbiddenWords' });
      
      const words = forbiddenWordsSettings?.words || [];
      return reply.send({ success: true, words });
    } catch (error) {
      console.error('[/civitai/forbidden-words] Error fetching forbidden words:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/civitai/forbidden-words', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { words } = request.body;
      
      if (!Array.isArray(words)) {
        return reply.status(400).send({ error: 'Words must be an array' });
      }

      // Clean and validate words
      const cleanWords = words
        .filter(word => word && typeof word === 'string')
        .map(word => word.trim())
        .filter(word => word.length > 0);

      const db = fastify.mongo.db;
      const settingsCollection = db.collection('systemSettings');
      
      await settingsCollection.updateOne(
        { type: 'forbiddenWords' },
        {
          $set: {
            words: cleanWords,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      console.log(`[/civitai/forbidden-words] Updated forbidden words list: ${cleanWords.length} words`);
      return reply.send({ success: true, words: cleanWords });
    } catch (error) {
      console.error('[/civitai/forbidden-words] Error updating forbidden words:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // Enhanced preview endpoint with better retry logic
  fastify.post('/api/preview-prompt', async (request, reply) => {
    try {
      console.log('[/api/preview-prompt] Starting prompt preview request');
      
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        console.log('[/api/preview-prompt] Access denied - user is not admin');
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId, modelName, nsfw, page = 1, promptIndex = 0, direction = 'current' } = request.body;
      const db = fastify.mongo.db;
      
      console.log(`[/api/preview-prompt] Request params: modelId=${modelId}, page=${page}, promptIndex=${promptIndex}, direction=${direction}, nsfw=${nsfw}`);

      // Find the model in the database
      const modelsCollection = db.collection('myModels');
      const model = await modelsCollection.findOne({ modelId });
      
      if (!model) {
        console.log(`[/api/preview-prompt] Model not found: ${modelId}`);
        return reply.status(404).send({ error: 'Model not found' });
      }

      let newPage = parseInt(page);
      let newPromptIndex = parseInt(promptIndex);

      // DO NOT modify navigation here - let the client handle it
      // The client is already sending the correct promptIndex
      console.log(`[/api/preview-prompt] Using client-provided indices: page=${newPage}, promptIndex=${newPromptIndex}`);

      // Fetch prompt with strict exclusion of used/skipped prompts and forbidden words filtering
      const promptData = await fetchRandomCivitaiPrompt(
        model, 
        nsfw, 
        newPage, 
        newPromptIndex, 
        true, // excludeUsed = true (strict exclusion)
        db
      );

      if (!promptData) {
        console.log('[/api/preview-prompt] No suitable prompt found after exhaustive search');
        return reply.send({ error: 'No more unused prompts available for this model. All prompts have been used or contain forbidden words.' });
      }

      // Store the prompt temporarily in database for later generation
      const promptsCache = db.collection('promptsCache');
      const promptKey = `${modelId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await promptsCache.insertOne({
        key: promptKey,
        prompt: promptData,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      });

      console.log(`[/api/preview-prompt] Successfully cached prompt with key: ${promptKey}`);

      return reply.send({
        success: true,
        promptKey,
        prompt: {
          ...promptData,
          page: newPage,
          promptIndex: newPromptIndex
        }
      });
    } catch (error) {
      console.error('[/api/preview-prompt] Error in preview prompt:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // New endpoint for skipping prompts
  fastify.post('/api/skip-prompt', async (request, reply) => {
    try {
      console.log('[/api/skip-prompt] Starting skip prompt request');
      
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        console.log('[/api/skip-prompt] Access denied - user is not admin');
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { promptKey } = request.body;
      const db = fastify.mongo.db;
      
      console.log(`[/api/skip-prompt] Skipping prompt with key: ${promptKey}`);

      // Get the cached prompt
      const promptsCache = db.collection('promptsCache');
      const cachedPrompt = await promptsCache.findOne({ key: promptKey });
      
      if (!cachedPrompt) {
        console.log(`[/api/skip-prompt] Cached prompt not found: ${promptKey}`);
        return reply.status(404).send({ error: 'Prompt not found' });
      }

      // Mark prompt as skipped
      if (cachedPrompt.prompt.promptHash) {
        await markPromptStatus(db, cachedPrompt.prompt.modelId, cachedPrompt.prompt.promptHash, 'skipped');
      }

      // Delete the cached prompt
      await promptsCache.deleteOne({ key: promptKey });

      console.log(`[/api/skip-prompt] Successfully skipped prompt: ${promptKey}`);

      return reply.send({ success: true, message: 'Prompt skipped successfully' });
    } catch (error) {
      console.error('[/api/skip-prompt] Error skipping prompt:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.post('/civitai/model-chats/generate', async (request, reply) => {
    try {
      console.log('[/civitai/model-chats/generate] Starting chat generation request');
      
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        console.log('[/civitai/model-chats/generate] Access denied - user is not admin');
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId, nsfw, promptKey } = request.body;
      const db = fastify.mongo.db;
      let civitaiData = null;
      
      console.log(`[/civitai/model-chats/generate] Request params: modelId=${modelId}, nsfw=${nsfw}, promptKey=${promptKey}`);
      
      // If promptKey is provided, retrieve the cached prompt
      if (promptKey) {
        const promptsCache = db.collection('promptsCache');
        const cachedPrompt = await promptsCache.findOne({ key: promptKey });
        
        if (cachedPrompt) {
          civitaiData = cachedPrompt.prompt;
          // Delete the cached prompt after use
          await promptsCache.deleteOne({ key: promptKey });
          console.log(`[/civitai/model-chats/generate] Retrieved cached prompt: ${promptKey}`);
        } else {
          console.log(`[/civitai/model-chats/generate] Cached prompt not found: ${promptKey}`);
        }
      }
      
      // If modelId is provided, generate chat for a specific model
      if (modelId) {
        // Find the model in the database
        const modelsCollection = db.collection('myModels');
        const model = await modelsCollection.findOne({ modelId:modelId.toString() });
        
        if (!model) {
          console.log(`[/civitai/model-chats/generate] Model not found: ${modelId}`);
          return reply.status(404).send({ error: 'Model not found' });
        }
        
        // If we don't have a cached prompt, get a new one with strict filtering
        if (!civitaiData) {
          console.log('[/civitai/model-chats/generate] No cached prompt, fetching new one with strict filtering');
          civitaiData = await fetchRandomCivitaiPrompt(model, nsfw, 1, 0, true, db);
        }

        if (!civitaiData) {
          console.log('[/civitai/model-chats/generate] No suitable prompt found after exhaustive search');
          return reply.status(404).send({ error: 'No more unused prompts available for this model. All prompts have been used or contain forbidden words.' });
        }
        
        // Create a new chat - Pass the current user for image generation
        console.log(`[/civitai/model-chats/generate] Creating chat for model ${model.model}`);
        const chat = await createModelChat(db, model, civitaiData, request.lang, fastify, request.user, nsfw);

        if (!chat) {
          console.log('[/civitai/model-chats/generate] Failed to create chat');
          return reply.status(500).send({ error: 'Failed to create chat for model' });
        }
        
        // Add civitaiData to the chat
        chat.civitaiData = civitaiData;
        console.log(`[/civitai/model-chats/generate] Successfully created chat: ${chat._id}`);
        return reply.send({ success: true, chat });
      } else {
        // Generate for all models with enhanced error handling
        console.log('[/civitai/model-chats/generate] Generating for all models');
        const modelsCollection = db.collection('myModels');
        const models = await modelsCollection.find({}).toArray();
        const results = [];
        
        for (const model of models) {
          try {
            console.log(`[/civitai/model-chats/generate] Processing model: ${model.model}`);
            
            // Get prompt from Civitai with strict exclusion and forbidden words filtering
            const prompt = await fetchRandomCivitaiPrompt(model, nsfw, 1, 0, true, db);
            
            if (!prompt) {
              console.log(`[/civitai/model-chats/generate] No suitable prompt found for model: ${model.model}`);
              results.push({ model: model.model, status: 'failed', reason: 'No more unused prompts available or all contain forbidden words' });
              continue;
            }
            
            // Create a new chat - Pass current user for image generation
            const chat = await createModelChat(db, model, prompt, request.lang, fastify, request.user, nsfw);
            
            if (!chat) {
              console.log(`[/civitai/model-chats/generate] Failed to create chat for model: ${model.model}`);
              results.push({ model: model.model, status: 'failed', reason: 'Failed to create chat' });
            } else {
              console.log(`[/civitai/model-chats/generate] Successfully created chat for model: ${model.model}, chatId: ${chat._id}`);
              results.push({ model: model.model, status: 'success', chatId: chat._id });
            }
            
            // Wait longer between requests to allow for image generation
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (error) {
            console.error(`[/civitai/model-chats/generate] Error processing model ${model.model}:`, error);
            results.push({ model: model.model, status: 'error', error: error.message });
          }
        }
        
        console.log(`[/civitai/model-chats/generate] Completed generation for all models. Success: ${results.filter(r => r.status === 'success').length}, Failed: ${results.filter(r => r.status !== 'success').length}`);
        return reply.send({ success: true, results });
      }
    } catch (error) {
      console.error('[/civitai/model-chats/generate] Error generating model chat:', error);
      return reply.status(500).send({ error: 'Internal server error', details: error.message });
    }
  }); 

  // Add the new route to handle cron settings update
  fastify.post('/civitai/model-chats/cron-settings', async (request, reply) => {
    try {
      console.log('[/civitai/model-chats/cron-settings] Starting cron settings update');
      
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
        console.log('[modelChatGenerationTask] Running scheduled chat generation task...');
        const db = fastify.mongo.db;
        
        try {
          // Check if the database is accessible
          await db.command({ ping: 1 });
          
          // Get all available models
          const modelsCollection = db.collection('myModels');
          const models = await modelsCollection.find({}).toArray();
          
          console.log(`[modelChatGenerationTask] Found ${models.length} models to generate chats for`);
          
          // Find an admin user to use for image generation
          const usersCollection = db.collection('users');
          const adminUser = await usersCollection.findOne({ role: 'admin' });
          
          if (!adminUser) {
            console.log('[modelChatGenerationTask] No admin user found for automated chat generation');
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
              console.log(`[modelChatGenerationTask] Processing model: ${model.model}`);
              
              // Get prompt from Civitai with exclusion of used prompts
              const nsfwSetting = (nsfw === true || nsfw === 'true');
              const prompt = await fetchRandomCivitaiPrompt(model, nsfwSetting, 1, 0, true, db);
              
              if (!prompt) {
                console.log(`[modelChatGenerationTask] No suitable prompt found for model ${model.model}. Skipping.`);
                continue;
              }
              
              // Create a new chat - Pass admin user for image generation
              await createModelChat(db, model, prompt, 'en', fastify, adminUser, nsfwSetting);
              
              // Wait a bit between requests to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (modelError) {
              console.error(`[modelChatGenerationTask] Error processing model ${model.model}:`, modelError);
              // Continue with next model
            }
          }
          
          console.log('[modelChatGenerationTask] Scheduled chat generation completed');
        } catch (err) {
          console.error('[modelChatGenerationTask] Failed to execute scheduled chat generation:', err);
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

      console.log(`[/civitai/model-chats/cron-settings] Successfully updated cron settings. Enabled: ${isEnabled}, Next run: ${nextRun}`);

      return reply.send({ 
        success: true, 
        message: 'Cron settings updated successfully',
        nextRun,
        lastRun
      });
    } catch (error) {
      console.error('[/civitai/model-chats/cron-settings] Error updating cron settings:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ============================================
  // User Model Search & Preferences (using Novita API)
  // ============================================

  /**
   * Fetch models from Novita API
   */
  async function fetchNovitaModels(query = '', cursor = '') {
    try {
      const axios = require('axios');
      let url = 'https://api.novita.ai/v3/model?filter.visibility=public&pagination.limit=30&filter.types=checkpoint';
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
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      console.error('[fetchNovitaModels] Error fetching models:', error.message);
      return { models: [], pagination: {} };
    }
  }

  /**
   * Search models using Novita API - accessible to all users
   */
  fastify.get('/api/civitai/search', async (request, reply) => {
    try {
      const { query, cursor } = request.query;
      
      if (!query || query.trim().length < 2) {
        return reply.status(400).send({ error: 'Query must be at least 2 characters' });
      }

      console.log(`[/api/civitai/search] Searching Novita models: ${query}`);
      
      const data = await fetchNovitaModels(query, cursor);
      
      // Process and format results to match frontend expectations
      const models = (data.models || []).map(model => {
        // Determine style from tags
        const tags = model.tags || [];
        const style = tags.find(t => 
          t.toLowerCase().includes('anime') || 
          t.toLowerCase().includes('photorealistic') ||
          t.toLowerCase().includes('realistic')
        ) || tags[0] || 'general';
        
        return {
          id: model.id,
          name: model.name,
          type: 'Checkpoint',
          nsfw: false,
          description: model.description?.substring(0, 200) || '',
          tags: tags.slice(0, 5),
          creator: model.author || 'Unknown',
          stats: {
            downloadCount: model.download_count || 0,
            favoriteCount: model.favorite_count || 0,
            rating: model.rating || 0
          },
          modelVersions: [{
            id: model.id,
            name: model.base_model || 'Default',
            baseModel: model.base_model || 'SD 1.5',
            files: [{
              name: model.sd_name || model.name,
              sizeKB: 0,
              downloadUrl: null
            }]
          }],
          previewImage: model.cover_url || '/img/default-model.png',
          // Additional Novita-specific fields
          sd_name: model.sd_name,
          base_model: model.base_model,
          cover_url: model.cover_url
        };
      });

      return reply.send({
        success: true,
        models,
        metadata: {
          nextCursor: data.pagination?.next_cursor || null,
          totalCount: data.pagination?.total_count || models.length
        }
      });
    } catch (error) {
      console.error('[/api/civitai/search] Error searching models:', error.message);
      return reply.status(500).send({ error: 'Failed to search models' });
    }
  });

  /**
   * Get user's saved custom models
   */
  fastify.get('/api/user/models', async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const db = fastify.mongo.db;
      const userModelsCollection = db.collection('userModels');
      
      const userModels = await userModelsCollection.find({
        userId: new ObjectId(user._id)
      }).sort({ createdAt: -1 }).toArray();

      return reply.send({ success: true, models: userModels });
    } catch (error) {
      console.error('[/api/user/models] Error fetching user models:', error);
      return reply.status(500).send({ error: 'Failed to fetch user models' });
    }
  });

  /**
   * Add a custom Civitai model to user's collection
   */
  fastify.post('/api/user/models', async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { 
        civitaiModelId,
        civitaiVersionId,
        modelName, 
        versionName,
        fileName,
        image, 
        style,
        baseModel
      } = request.body;

      if (!civitaiModelId || !civitaiVersionId || !modelName || !fileName) {
        return reply.status(400).send({ error: 'Missing required fields: civitaiModelId, civitaiVersionId, modelName, fileName' });
      }

      const db = fastify.mongo.db;
      const userModelsCollection = db.collection('userModels');

      // Check if model already exists for this user
      const existingModel = await userModelsCollection.findOne({
        userId: new ObjectId(user._id),
        civitaiVersionId: civitaiVersionId.toString()
      });

      if (existingModel) {
        return reply.status(400).send({ error: 'Model already exists in your collection' });
      }

      // Normalize style
      const normalizedStyle = style?.toLowerCase().includes('anime') ? 'anime' : 
                             style?.toLowerCase().includes('realistic') ? 'photorealistic' : 
                             style || '';

      const newModel = {
        userId: new ObjectId(user._id),
        civitaiModelId: civitaiModelId.toString(),
        civitaiVersionId: civitaiVersionId.toString(),
        modelId: civitaiVersionId.toString(), // For compatibility with existing system
        model: fileName,
        name: modelName,
        versionName: versionName || 'Default',
        image: image || '/img/default-model.png',
        style: normalizedStyle,
        baseModel: baseModel || 'Unknown',
        version: civitaiVersionId.toString(),
        isUserModel: true,
        createdAt: new Date()
      };

      const result = await userModelsCollection.insertOne(newModel);
      
      console.log(`[/api/user/models] User ${user._id} added custom model: ${modelName}`);

      return reply.send({ 
        success: true, 
        model: { ...newModel, _id: result.insertedId },
        message: 'Model added successfully'
      });
    } catch (error) {
      console.error('[/api/user/models] Error adding user model:', error);
      return reply.status(500).send({ error: 'Failed to add model' });
    }
  });

  /**
   * Remove a custom model from user's collection
   */
  fastify.delete('/api/user/models/:modelId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { modelId } = request.params;
      const db = fastify.mongo.db;
      const userModelsCollection = db.collection('userModels');

      const result = await userModelsCollection.deleteOne({
        _id: new ObjectId(modelId),
        userId: new ObjectId(user._id)
      });

      if (result.deletedCount === 0) {
        return reply.status(404).send({ error: 'Model not found or unauthorized' });
      }

      console.log(`[/api/user/models] User ${user._id} removed model: ${modelId}`);

      return reply.send({ success: true, message: 'Model removed successfully' });
    } catch (error) {
      console.error('[/api/user/models] Error removing user model:', error);
      return reply.status(500).send({ error: 'Failed to remove model' });
    }
  });

  /**
   * Save user's preferred/favorite model
   */
  fastify.post('/api/user/model-preference', async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const { modelId, modelName, isUserModel } = request.body;
      
      if (!modelId) {
        return reply.status(400).send({ error: 'modelId is required' });
      }

      const db = fastify.mongo.db;
      const usersCollection = db.collection('users');

      await usersCollection.updateOne(
        { _id: new ObjectId(user._id) },
        { 
          $set: { 
            preferredModelId: modelId,
            preferredModelName: modelName || null,
            preferredModelIsUserModel: isUserModel || false,
            preferredModelUpdatedAt: new Date()
          }
        }
      );

      console.log(`[/api/user/model-preference] User ${user._id} set preferred model: ${modelId}`);

      return reply.send({ success: true, message: 'Model preference saved' });
    } catch (error) {
      console.error('[/api/user/model-preference] Error saving model preference:', error);
      return reply.status(500).send({ error: 'Failed to save model preference' });
    }
  });

  /**
   * Get user's model preference
   */
  fastify.get('/api/user/model-preference', async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const db = fastify.mongo.db;
      const usersCollection = db.collection('users');
      const userData = await usersCollection.findOne(
        { _id: new ObjectId(user._id) },
        { projection: { preferredModelId: 1, preferredModelName: 1, preferredModelIsUserModel: 1 } }
      );

      return reply.send({ 
        success: true, 
        preference: {
          modelId: userData?.preferredModelId || null,
          modelName: userData?.preferredModelName || null,
          isUserModel: userData?.preferredModelIsUserModel || false
        }
      });
    } catch (error) {
      console.error('[/api/user/model-preference] Error fetching model preference:', error);
      return reply.status(500).send({ error: 'Failed to fetch model preference' });
    }
  });

  
}

module.exports = routes;