const { 
  getSystemPrompt, 
  saveSystemPrompt, 
  deleteSystemPrompt, 
  setActiveSystemPrompt,
  getActiveSystemPrompt
} = require('../models/system-prompt-utils');
const { checkUserAdmin } = require('../models/tool');

/**
 * System prompt management API routes
 */
async function routes(fastify, options) {
  // Middleware to check admin access
  const adminGuard = async (request, reply) => {
    const userId = request.user?._id;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    
    const isAdmin = await checkUserAdmin(fastify, userId);
    if (!isAdmin) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };

  // Get all system prompts or specific prompt by ID
  fastify.get('/api/admin/system-prompts/:id?', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const { id } = request.params;
      const db = fastify.mongo.db;
      const prompts = await getSystemPrompt(db, id);
      
      return reply.send({ success: true, data: prompts });
    } catch (error) {
      console.error('Error fetching system prompts:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // Create a new system prompt
  fastify.post('/api/admin/system-prompts', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const promptData = request.body;
      const db = fastify.mongo.db;
      
      const savedPrompt = await saveSystemPrompt(db, promptData);
      
      return reply.status(201).send({ success: true, data: savedPrompt });
    } catch (error) {
      console.error('Error creating system prompt:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // Update an existing system prompt
  fastify.put('/api/admin/system-prompts/:id', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const { id } = request.params;
      const promptData = request.body;
      const db = fastify.mongo.db;
      
      const updatedPrompt = await saveSystemPrompt(db, promptData, id);
      
      if (!updatedPrompt) {
        return reply.status(404).send({ success: false, error: 'System prompt not found' });
      }
      
      return reply.send({ success: true, data: updatedPrompt });
    } catch (error) {
      console.error('Error updating system prompt:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // Delete a system prompt
  fastify.delete('/api/admin/system-prompts/:id', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const { id } = request.params;
      const db = fastify.mongo.db;
      
      const deleted = await deleteSystemPrompt(db, id);
      
      if (!deleted) {
        return reply.status(404).send({ success: false, error: 'System prompt not found' });
      }
      
      return reply.send({ success: true, message: 'System prompt deleted successfully' });
    } catch (error) {
      console.error('Error deleting system prompt:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // Set a system prompt as active
  fastify.put('/api/admin/system-prompts/:id/activate', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const { id } = request.params;
      const db = fastify.mongo.db;
      
      const activatedPrompt = await setActiveSystemPrompt(db, id);
      
      if (!activatedPrompt) {
        return reply.status(404).send({ success: false, error: 'System prompt not found' });
      }
      
      return reply.send({ success: true, data: activatedPrompt });
    } catch (error) {
      console.error('Error activating system prompt:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // Get the active system prompt (publicly accessible)
  fastify.get('/api/system-prompt', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const activePrompt = await getActiveSystemPrompt(db);
      
      return reply.send({ success: true, data: activePrompt });
    } catch (error) {
      console.error('Error fetching active system prompt:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}

module.exports = routes;