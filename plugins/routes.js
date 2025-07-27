async function registerRoutes(fastify) {
  // Register all route modules
  fastify.register(require('../routes/api'));
  fastify.register(require('../routes/character-creation-api'));
  fastify.register(require('../routes/character-update-api'));
  fastify.register(require('../routes/personas-api'));
  fastify.register(require('../routes/stability'));
  fastify.register(require('../routes/img2video-api'));
  fastify.register(require('../routes/plan'));
  fastify.register(require('../routes/user'));
  fastify.register(require('../routes/admin'));
  fastify.register(require('../routes/civitai-api'));
  fastify.register(require('../routes/post'));
  fastify.register(require('../routes/notifications'));
  fastify.register(require('../routes/gallery'));
  fastify.register(require('../routes/zohomail'));
  fastify.register(require('../routes/chat-tool-gifts-api'));
  fastify.register(require('../routes/chat-tool-settings-api'));
  fastify.register(require('../routes/eventlab-api'));
  fastify.register(require('../routes/merge-face-api'));
  fastify.register(require('../routes/chat-tool-message-api'));
  fastify.register(require('../routes/system-prompt-api'));
  fastify.register(require('../routes/user-points-api'));
  fastify.register(require('../routes/character-infos-api'));
  fastify.register(require('../routes/sitemap-api'));
  fastify.register(require('../routes/affiliation-api'));
  fastify.register(require('../routes/user-analytics-api'));
  fastify.register(require('../routes/chat-tool-goals-api'));
  fastify.register(require('../routes/chat-completion-api'));
  fastify.register(require('../routes/admin-models'));
}

module.exports = registerRoutes;