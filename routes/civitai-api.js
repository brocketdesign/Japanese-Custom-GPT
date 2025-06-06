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

      // Handle navigation
      if (direction === 'next') {
        newPromptIndex++;
      } else if (direction === 'prev' && newPromptIndex > 0) {
        newPromptIndex--;
      }

      console.log(`[/api/preview-prompt] Fetching prompt with newPage=${newPage}, newPromptIndex=${newPromptIndex}`);

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
        const model = await modelsCollection.findOne({ modelId });
        
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

  
}

module.exports = routes;