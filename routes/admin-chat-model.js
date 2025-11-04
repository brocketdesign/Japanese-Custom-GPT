const { ObjectId } = require('mongodb');
const { checkUserAdmin } = require('../models/tool');
const {
  getAvailableNovitaModels,
  testMultipleModels,
  sanitizeResults,
  saveTestResults,
  getTestResults,
  deleteTestResults
} = require('../models/admin-chat-model-utils');

async function routes(fastify, options) {

  // GET: Display the chat model testing dashboard
  fastify.get('/admin/chat-model-test', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const translations = request.chatModelTestTranslations;
      const availableModels = getAvailableNovitaModels();

      try {
        const stringifiedModels = JSON.stringify(availableModels);
        return reply.view('/admin/chat-model-test', {
          user: request.user,
          translations,
          availableModels: stringifiedModels,
          title: translations.page_title
        });
      } catch (stringifyError) {
        console.error('Error stringifying availableModels:', stringifyError);
        console.error('availableModels object:', availableModels);
        console.error('availableModels type:', typeof availableModels);
        console.error('availableModels keys:', Object.keys(availableModels));
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
        models,
        questions,
        languages,
        maxTokens,
        systemPromptLength: systemPrompt?.length
      });

      if (!models || models.length === 0) {
        return reply.status(400).send({ error: 'At least one model must be selected' });
      }

      if (!questions || questions.length === 0) {
        return reply.status(400).send({ error: 'At least one question is required' });
      }

      if (!languages || languages.length === 0) {
        return reply.status(400).send({ error: 'At least one language must be selected' });
      }

      // Run tests
      const results = await testMultipleModels({
        models,
        questions,
        systemPrompt,
        languages,
        maxTokens
      });

      console.log('[Chat Model Test] Test completed successfully');

      // Sanitize results for safe serialization
      let sanitizedResults;
      try {
        sanitizedResults = sanitizeResults(results);
        console.log('[Chat Model Test] Results sanitized successfully');
      } catch (sanitizeError) {
        console.error('[Chat Model Test] Error sanitizing results:', sanitizeError);
        console.error('[Chat Model Test] Raw results structure:', Object.keys(results));
        sanitizedResults = results; // Fallback to raw results
      }

      // Save results to database
      const db = fastify.mongo.db;
      const testResultsCollection = db.collection('chatModelTestResults');

      const testId = new ObjectId();
      const testDocument = {
        _id: testId,
        userId: new ObjectId(request.user._id),
        models,
        questions,
        systemPrompt,
        languages,
        maxTokens,
        results: sanitizedResults,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      try {
        await testResultsCollection.insertOne(testDocument);
        console.log('[Chat Model Test] Results saved to database with ID:', testId.toString());
      } catch (dbError) {
        console.error('[Chat Model Test] Error saving to database:', dbError);
        console.error('[Chat Model Test] Test document keys:', Object.keys(testDocument));
        throw dbError;
      }

      // Return sanitized response
      try {
        const responseData = {
          testId: testId.toString(),
          results: sanitizedResults
        };
        // Verify it can be stringified
        JSON.stringify(responseData);
        console.log('[Chat Model Test] Response serialization successful');
        return reply.status(200).send(responseData);
      } catch (stringifyError) {
        console.error('[Chat Model Test] Error stringifying response:', stringifyError);
        console.error('[Chat Model Test] Results object keys:', Object.keys(sanitizedResults));
        console.error('[Chat Model Test] Results object sample:', JSON.stringify(sanitizedResults, null, 2).substring(0, 500));
        throw stringifyError;
      }
    } catch (error) {
      console.error('[Chat Model Test] Error running model test:', error);
      console.error('[Chat Model Test] Full error stack:', error.stack);
      console.error('[Chat Model Test] Error message:', error.message);
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

      const db = fastify.mongo.db;
      const testResultsCollection = db.collection('chatModelTestResults');

      const results = await testResultsCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return reply.status(200).send({ results });
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

      const db = fastify.mongo.db;
      const testResultsCollection = db.collection('chatModelTestResults');
      const testId = request.params.testId;

      const result = await testResultsCollection.findOne({
        _id: new ObjectId(testId)
      });

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

      const db = fastify.mongo.db;
      const testResultsCollection = db.collection('chatModelTestResults');
      const testId = request.params.testId;

      const result = await testResultsCollection.deleteOne({
        _id: new ObjectId(testId)
      });

      if (result.deletedCount === 0) {
        return reply.status(404).send({ error: 'Test result not found' });
      }

      return reply.status(200).send({ message: 'Test result deleted successfully' });
    } catch (error) {
      console.error('Error deleting test result:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // GET: Get available Novita models
  fastify.get('/api/admin/chat-model-test/available-models', async (request, reply) => {
    try {
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      if (!isAdmin) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const availableModels = getAvailableNovitaModels();
      return reply.status(200).send({ availableModels });
    } catch (error) {
      console.error('Error fetching available models:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

}

module.exports = routes;
