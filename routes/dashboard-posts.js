/**
 * My Posts Dashboard Route
 * User profile section for viewing and managing posts
 */

const { MODEL_CONFIGS } = require('../models/admin-image-test-utils');

async function routes(fastify, options) {
  const db = fastify.mongo.db;

  /**
   * GET /dashboard/posts
   * Main posts dashboard
   */
  fastify.get('/dashboard/posts', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user || user.isTemporary) {
        return reply.redirect('/login');
      }

      const lang = request.lang || 'en';
      const translations = request.translations;

      return reply.view('dashboard/posts', {
        user,
        translations,
        lang,
        title: translations.dashboard?.myPosts || translations.myPosts || 'My Posts',
        pageType: 'dashboard',
        canonical: `${request.protocol}://${request.hostname}/dashboard/posts`
      });
    } catch (error) {
      console.error('[Dashboard Posts] Error loading page:', error);
      return reply.code(500).send('Internal Server Error');
    }
  });

  /**
   * GET /dashboard/schedules
   * Schedules management dashboard
   */
  fastify.get('/dashboard/schedules', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user || user.isTemporary) {
        return reply.redirect('/login');
      }

      const lang = request.lang || 'en';
      const translations = request.translations;

      // Prepare models list from MODEL_CONFIGS for scheduling
      const scheduleModels = Object.entries(MODEL_CONFIGS)
        .filter(([id, config]) => config.category === 'txt2img' && !config.requiresModel)
        .map(([id, config]) => ({
          id,
          name: config.name,
          description: config.description,
          async: config.async,
          category: config.category
        }));

      // Get active SD models from database for additional options
      const activeSDModels = await db.collection('myModels').find({}).toArray();

      return reply.view('dashboard/schedules', {
        user,
        translations,
        lang,
        title: translations.dashboard?.mySchedules || translations.mySchedules || 'My Schedules',
        pageType: 'dashboard',
        canonical: `${request.protocol}://${request.hostname}/dashboard/schedules`,
        scheduleModels,
        activeSDModels
      });
    } catch (error) {
      console.error('[Dashboard Schedules] Error loading page:', error);
      return reply.code(500).send('Internal Server Error');
    }
  });

  /**
   * GET /dashboard/templates
   * Prompt templates dashboard
   */
  fastify.get('/dashboard/templates', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user || user.isTemporary) {
        return reply.redirect('/login');
      }

      const lang = request.lang || 'en';
      const translations = request.translations;

      return reply.view('dashboard/templates', {
        user,
        translations,
        lang,
        title: translations.dashboard?.promptTemplates || translations.promptTemplates || 'Prompt Templates',
        pageType: 'dashboard',
        canonical: `${request.protocol}://${request.hostname}/dashboard/templates`
      });
    } catch (error) {
      console.error('[Dashboard Templates] Error loading page:', error);
      return reply.code(500).send('Internal Server Error');
    }
  });

  /**
   * GET /dashboard/analytics
   * Analytics dashboard - Phase 5
   */
  fastify.get('/dashboard/analytics', async (request, reply) => {
    try {
      const user = request.user;
      
      if (!user || user.isTemporary) {
        return reply.redirect('/login');
      }

      const lang = request.lang || 'en';
      const translations = request.translations;

      return reply.view('dashboard/analytics', {
        user,
        translations,
        lang,
        title: translations.analytics?.title || 'Analytics Dashboard',
        pageType: 'dashboard',
        canonical: `${request.protocol}://${request.hostname}/dashboard/analytics`
      });
    } catch (error) {
      console.error('[Dashboard Analytics] Error loading page:', error);
      return reply.code(500).send('Internal Server Error');
    }
  });
}

module.exports = routes;
