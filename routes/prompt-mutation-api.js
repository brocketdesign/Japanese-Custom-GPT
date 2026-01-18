/**
 * Prompt Mutation and Templates API Routes
 */

const {
  mutatePrompt,
  generateVariations,
  createPromptTemplate,
  getPromptTemplates,
  applyTemplate,
  saveMutationHistory,
  getMutationHistory
} = require('../models/prompt-mutation-utils');

async function routes(fastify, options) {
  const db = fastify.mongo.db;

  /**
   * POST /api/prompt-mutation/mutate
   * Generate a mutated prompt
   */
  fastify.post('/api/prompt-mutation/mutate', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { prompt, options = {} } = request.body;

      if (!prompt) {
        return reply.code(400).send({ error: 'Prompt is required' });
      }

      const result = mutatePrompt(prompt, options);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Prompt Mutation] Mutate error:', error);
      return reply.code(500).send({ error: 'Failed to mutate prompt' });
    }
  });

  /**
   * POST /api/prompt-mutation/variations
   * Generate multiple variations of a prompt
   */
  fastify.post('/api/prompt-mutation/variations', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { prompt, count = 5, options = {} } = request.body;

      if (!prompt) {
        return reply.code(400).send({ error: 'Prompt is required' });
      }

      const variations = generateVariations(prompt, count, options);

      return reply.send({
        success: true,
        variations
      });
    } catch (error) {
      console.error('[Prompt Mutation] Variations error:', error);
      return reply.code(500).send({ error: 'Failed to generate variations' });
    }
  });

  /**
   * POST /api/prompt-templates
   * Create a new prompt template
   */
  fastify.post('/api/prompt-templates', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const templateData = {
        ...request.body,
        userId: user._id
      };

      if (!templateData.name || !templateData.basePrompt) {
        return reply.code(400).send({ error: 'Name and basePrompt are required' });
      }

      const template = await createPromptTemplate(templateData, db);

      return reply.code(201).send({
        success: true,
        template
      });
    } catch (error) {
      console.error('[Prompt Templates] Create error:', error);
      return reply.code(500).send({ error: 'Failed to create template' });
    }
  });

  /**
   * GET /api/prompt-templates
   * Get prompt templates with filters
   */
  fastify.get('/api/prompt-templates', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const filters = {
        category: request.query.category,
        nsfw: request.query.nsfw === 'true',
        styleCategory: request.query.styleCategory,
        tags: request.query.tags ? request.query.tags.split(',') : undefined,
        userId: request.query.myTemplates === 'true' ? user._id : undefined,
        page: parseInt(request.query.page) || 1,
        limit: parseInt(request.query.limit) || 20
      };

      const result = await getPromptTemplates(db, filters);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Prompt Templates] Get error:', error);
      return reply.code(500).send({ error: 'Failed to get templates' });
    }
  });

  /**
   * POST /api/prompt-templates/:templateId/apply
   * Apply a template to generate a prompt
   */
  fastify.post('/api/prompt-templates/:templateId/apply', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { templateId } = request.params;
      const overrides = request.body || {};

      const result = await applyTemplate(templateId, db, overrides);

      // Optionally save to history
      if (request.body.saveToHistory) {
        await saveMutationHistory({
          userId: user._id,
          templateId,
          originalPrompt: result.originalPrompt,
          mutatedPrompt: result.mutatedPrompt,
          mutations: result.mutations,
          seed: result.seed,
          category: result.category
        }, db);
      }

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Prompt Templates] Apply error:', error);
      return reply.code(500).send({ error: error.message || 'Failed to apply template' });
    }
  });

  /**
   * GET /api/prompt-mutation/history
   * Get mutation history for user
   */
  fastify.get('/api/prompt-mutation/history', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const options = {
        category: request.query.category,
        templateId: request.query.templateId,
        page: parseInt(request.query.page) || 1,
        limit: parseInt(request.query.limit) || 20
      };

      const result = await getMutationHistory(db, user._id, options);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Prompt Mutation] History error:', error);
      return reply.code(500).send({ error: 'Failed to get mutation history' });
    }
  });

  /**
   * POST /api/prompt-mutation/history
   * Save mutation to history
   */
  fastify.post('/api/prompt-mutation/history', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const historyData = {
        ...request.body,
        userId: user._id
      };

      if (!historyData.originalPrompt || !historyData.mutatedPrompt) {
        return reply.code(400).send({ error: 'Original and mutated prompts are required' });
      }

      const history = await saveMutationHistory(historyData, db);

      return reply.code(201).send({
        success: true,
        history
      });
    } catch (error) {
      console.error('[Prompt Mutation] Save history error:', error);
      return reply.code(500).send({ error: 'Failed to save mutation history' });
    }
  });

  /**
   * DELETE /api/prompt-templates/:templateId
   * Delete a template (only owner can delete)
   */
  fastify.delete('/api/prompt-templates/:templateId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { templateId } = request.params;

      const result = await db.collection('promptTemplates').deleteOne({
        _id: new fastify.mongo.ObjectId(templateId),
        userId: new fastify.mongo.ObjectId(user._id)
      });

      if (result.deletedCount === 0) {
        return reply.code(404).send({ error: 'Template not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Template deleted'
      });
    } catch (error) {
      console.error('[Prompt Templates] Delete error:', error);
      return reply.code(500).send({ error: 'Failed to delete template' });
    }
  });
}

module.exports = routes;
