const { ObjectId } = require('mongodb');
const { checkUserAdmin } = require('../models/tool');
const {
  initializeDefaultModels,
  getAllModels,
  getAllProviders,
  getProviderByName,
  getAvailableModelsFormatted,
  addModel,
  updateModel,
  deleteModel,
  getModelByKey,
  testMultipleModels,
  saveTestResults,
  getTestResults,
  getTestResultById,
  deleteTestResults,
  getTemplateSystemPrompts,
  getTemplateQuestions
} = require('../models/chat-model-utils');

async function routes(fastify, options) {

  // GET: Display the chat model testing dashboard
  fastify.get('/admin/chat-model-test', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Initialize default models if needed
      await initializeDefaultModels();

      const translations = request.chatModelTestTranslations;
      const availableModels = await getAvailableModelsFormatted();
      const providers = await getAllProviders();
      const templatePrompts = getTemplateSystemPrompts();
      const templateQuestions = getTemplateQuestions();

      try {
        const stringifiedModels = JSON.stringify(availableModels);
        const stringifiedProviders = JSON.stringify(providers);
        const stringifiedPrompts = JSON.stringify(templatePrompts);
        const stringifiedQuestions = JSON.stringify(templateQuestions);
        
        return reply.view('/admin/chat-model-test', {
          user: request.user,
          translations,
          availableModels: stringifiedModels,
          providers: stringifiedProviders,
          templatePrompts: stringifiedPrompts,
          templateQuestions: stringifiedQuestions,
          title: translations.page_title
        });
      } catch (stringifyError) {
        console.error('Error stringifying data:', stringifyError);
        throw stringifyError;
      }
    } catch (error) {
      console.error('Error loading chat model test dashboard:', error);
      console.error('Full error stack:', error.stack);
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST: Run test with multiple models
  fastify.post('/api/admin/chat-model-test/run', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const {
        models,
        questions,
        systemPrompt,
        languages,
        maxTokens = 1000
      } = request.body;

      console.log('[Chat Model Test] Received request:', {
        models: models?.length,
        questions: questions?.length,
        languages: languages?.length,
        maxTokens,
        systemPromptLength: systemPrompt?.length
      });

      // Validation
      if (!models || models.length === 0) {
        return reply.status(400).send({ error: 'At least one model must be selected' });
      }

      if (!questions || questions.length === 0) {
        return reply.status(400).send({ error: 'At least one question is required' });
      }

      if (!languages || languages.length === 0) {
        return reply.status(400).send({ error: 'At least one language must be selected' });
      }

      if (!systemPrompt || systemPrompt.trim() === '') {
        return reply.status(400).send({ error: 'System prompt is required' });
      }

      // Run tests using the new utility function
      const results = await testMultipleModels(
        models,
        questions,
        systemPrompt,
        languages,
        maxTokens
      );

      console.log('[Chat Model Test] Test completed successfully');

      // Save results to database
      const testData = {
        userId: new ObjectId(request.user._id),
        models,
        questions,
        systemPrompt,
        languages,
        maxTokens,
        results
      };

      const savedTest = await saveTestResults(testData);
      console.log('[Chat Model Test] Results saved to database with ID:', savedTest._id.toString());

      // Return response
      const responseData = {
        testId: savedTest._id.toString(),
        results: results,
        summary: savedTest.summary
      };

      return reply.status(200).send(responseData);
    } catch (error) {
      console.error('[Chat Model Test] Error running model test:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET: Fetch all test results
  fastify.get('/api/admin/chat-model-test/results', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const limit = parseInt(request.query.limit) || 20;
      const offset = parseInt(request.query.offset) || 0;
      
      const results = await getTestResults(limit, offset);
      return reply.status(200).send(results);
    } catch (error) {
      console.error('Error fetching test results:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET: Fetch a specific test result
  fastify.get('/api/admin/chat-model-test/results/:testId', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { testId } = request.params;
      const result = await getTestResultById(testId);

      if (!result) {
        return reply.status(404).send({ error: 'Test result not found' });
      }

      return reply.status(200).send({ result });
    } catch (error) {
      console.error('Error fetching test result:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // DELETE: Delete a test result
  fastify.delete('/api/admin/chat-model-test/results/:testId', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { testId } = request.params;
      const success = await deleteTestResults(testId);

      if (!success) {
        return reply.status(404).send({ error: 'Test result not found' });
      }

      return reply.status(200).send({ message: 'Test result deleted successfully' });
    } catch (error) {
      console.error('Error deleting test result:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET: Get available models from database
  fastify.get('/api/admin/chat-model-test/models', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const includeInactive = request.query.includeInactive === 'true';
      const models = await getAllModels(includeInactive);
      return reply.status(200).send({ models });
    } catch (error) {
      console.error('Error fetching models:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST: Add a new model
  fastify.post('/api/admin/chat-model-test/models', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const modelData = request.body;
      
      // Validate required fields
      const requiredFields = ['key', 'displayName', 'description', 'provider', 'modelId', 'apiUrl'];
      for (const field of requiredFields) {
        if (!modelData[field]) {
          return reply.status(400).send({ error: `Missing required field: ${field}` });
        }
      }

      const model = await addModel(modelData);
      return reply.status(201).send({ model, message: 'Model added successfully' });
    } catch (error) {
      console.error('Error adding model:', error);
      const statusCode = error.message.includes('already exists') ? 400 : 500;
      return reply.status(statusCode).send({ error: error.message });
    }
  });

  // PUT: Update an existing model
  fastify.put('/api/admin/chat-model-test/models/:modelId', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId } = request.params;
      const updates = request.body;
      
      const model = await updateModel(modelId, updates);
      return reply.status(200).send({ model, message: 'Model updated successfully' });
    } catch (error) {
      console.error('Error updating model:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return reply.status(statusCode).send({ error: error.message });
    }
  });

  // DELETE: Delete a model
  fastify.delete('/api/admin/chat-model-test/models/:modelId', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const { modelId } = request.params;
      const success = await deleteModel(modelId);
      
      if (!success) {
        return reply.status(404).send({ error: 'Model not found' });
      }
      
      return reply.status(200).send({ message: 'Model deleted successfully' });
    } catch (error) {
      console.error('Error deleting model:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET: Get template prompts and questions
  fastify.get('/api/admin/chat-model-test/templates', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const templatePrompts = getTemplateSystemPrompts();
      const templateQuestions = getTemplateQuestions();
      
      return reply.status(200).send({ 
        prompts: templatePrompts,
        questions: templateQuestions 
      });
    } catch (error) {
      console.error('Error fetching templates:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET: Get all providers
  fastify.get('/api/admin/chat-model-test/providers', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const includeInactive = request.query.includeInactive === 'true';
      const providers = await getAllProviders(includeInactive);
      return reply.status(200).send({ providers });
    } catch (error) {
      console.error('Error fetching providers:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // POST: Initialize default models (for setup)
  fastify.post('/api/admin/chat-model-test/initialize', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      await initializeDefaultModels();
      return reply.status(200).send({ message: 'Default models and providers initialized successfully' });
    } catch (error) {
      console.error('Error initializing models:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

}

module.exports = routes;
