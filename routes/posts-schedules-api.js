/**
 * Unified Posts API Routes
 */

const {
  POST_TYPES,
  POST_SOURCES,
  POST_STATUSES,
  createPostFromImage,
  createPostFromVideo,
  linkTestToPost,
  getUserPosts,
  getCombinedUserPosts,
  createDraftPostFromImage,
  updatePostStatus,
  schedulePost,
  cancelScheduledPost,
  deletePost,
  getPostById,
  updatePost
} = require('../models/unified-post-utils');

const { generateCompletion } = require('../models/openai');

const {
  createSingleSchedule,
  createRecurringSchedule,
  getUserSchedules,
  pauseSchedule,
  resumeSchedule,
  cancelSchedule,
  deleteSchedule,
  getScheduleById,
  updateSchedule,
  getUserScheduleStats,
  ACTION_TYPES,
  SCHEDULE_STATUSES
} = require('../models/scheduling-utils');

async function routes(fastify, options) {
  const db = fastify.mongo.db;

  /**
   * POST /api/posts
   * Create a unified post from dashboard generation
   */
  fastify.post('/api/posts', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { type, ...postData } = request.body;

      if (!type) {
        return reply.code(400).send({ error: 'Post type is required' });
      }

      let post;
      if (type === POST_TYPES.IMAGE) {
        post = await createPostFromImage({ ...postData, userId: user._id }, db);
      } else if (type === POST_TYPES.VIDEO) {
        post = await createPostFromVideo({ ...postData, userId: user._id }, db);
      } else {
        return reply.code(400).send({ error: 'Invalid post type' });
      }

      return reply.code(201).send({
        success: true,
        post
      });
    } catch (error) {
      console.error('[Posts API] Create error:', error);
      return reply.code(500).send({ error: 'Failed to create post' });
    }
  });

  /**
   * POST /api/posts/link
   * Link existing test result to unified post
   */
  fastify.post('/api/posts/link', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { testId, testType } = request.body;

      if (!testId || !testType) {
        return reply.code(400).send({ error: 'testId and testType are required' });
      }

      const post = await linkTestToPost(testId, testType, db);

      return reply.send({
        success: true,
        post
      });
    } catch (error) {
      console.error('[Posts API] Link error:', error);
      return reply.code(500).send({ error: error.message || 'Failed to link test to post' });
    }
  });

  /**
   * GET /api/posts
   * Get user's posts with filters (includes both unified posts and chat posts)
   */
  fastify.get('/api/posts', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const filters = {
        type: request.query.type,
        source: request.query.source,
        status: request.query.status,
        nsfw: request.query.nsfw === 'true' ? true : request.query.nsfw === 'false' ? false : undefined,
        scheduledOnly: request.query.scheduledOnly === 'true',
        page: parseInt(request.query.page) || 1,
        limit: parseInt(request.query.limit) || 20,
        sortBy: request.query.sortBy || 'createdAt',
        sortOrder: request.query.sortOrder === 'asc' ? 1 : -1
      };

      // Use combined posts function to include both unified posts and chat posts
      const result = await getCombinedUserPosts(db, user._id, filters);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Posts API] Get posts error:', error);
      return reply.code(500).send({ error: 'Failed to get posts' });
    }
  });

  /**
   * POST /api/posts/draft
   * Create a draft post from image dashboard with AI-generated caption
   */
  fastify.post('/api/posts/draft', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { imageUrl, prompt, negativePrompt, model, parameters, testId, generateCaption = true, language } = request.body;

      if (!imageUrl) {
        return reply.code(400).send({ error: 'Image URL is required' });
      }

      let caption = '';
      
      // Generate caption using GPT-4o mini if requested
      if (generateCaption && prompt) {
        try {
          const lang = language || request.lang || 'en';
          const systemPrompt = `You are a social media expert creating engaging captions for AI-generated art.
Create a captivating caption in ${lang === 'ja' ? 'Japanese' : lang === 'fr' ? 'French' : 'English'}.

Guidelines:
- Keep it concise (2-3 sentences max)
- Make it engaging and shareable
- Include 3-5 relevant hashtags at the end
- Reference the artistic/creative nature subtly
- Match the mood and style of the image

Image description: ${prompt}

Return ONLY the caption text with hashtags, nothing else.`;

          const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate a social media caption for this AI-generated image.' }
          ];

          caption = await generateCompletion(messages, 200, 'gpt-4o-mini', lang);
          caption = caption?.trim() || '';
          
          console.log(`[Posts API] Generated caption for draft post: ${caption.substring(0, 50)}...`);
        } catch (captionError) {
          console.error('[Posts API] Error generating caption:', captionError);
          // Continue without caption
        }
      }

      // Create draft post
      const post = await createDraftPostFromImage({
        userId: user._id,
        testId,
        imageUrl,
        prompt,
        negativePrompt,
        caption,
        model,
        parameters,
        nsfw: false
      }, db);

      return reply.code(201).send({
        success: true,
        post,
        caption
      });
    } catch (error) {
      console.error('[Posts API] Create draft error:', error);
      return reply.code(500).send({ error: 'Failed to create draft post' });
    }
  });

  /**
   * POST /api/posts/generate-caption
   * Generate caption for an existing post
   */
  fastify.post('/api/posts/generate-caption', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { prompt, platform = 'general', style = 'engaging', language } = request.body;

      if (!prompt) {
        return reply.code(400).send({ error: 'Prompt/image description is required' });
      }

      const lang = language || request.lang || 'en';
      
      const systemPrompt = `You are a social media expert creating captions for ${platform === 'instagram' ? 'Instagram' : platform === 'twitter' ? 'X/Twitter' : 'social media'}.
Create a ${style} caption in ${lang === 'ja' ? 'Japanese' : lang === 'fr' ? 'French' : 'English'}.

Guidelines:
- Keep it concise and engaging
- Include 3-5 relevant hashtags at the end
- Match the tone to the platform${platform === 'instagram' ? ' (visual, aesthetic, longer captions OK)' : platform === 'twitter' ? ' (witty, conversational, under 280 chars)' : ''}
- Reference AI-generated art subtly
- Make it shareable

Image context: ${prompt}

Return ONLY the caption text with hashtags, nothing else.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate a social media caption for this image.' }
      ];

      const caption = await generateCompletion(messages, 200, 'gpt-4o-mini', lang);

      return reply.send({
        success: true,
        caption: caption?.trim() || '',
        platform,
        language: lang
      });
    } catch (error) {
      console.error('[Posts API] Caption generation error:', error);
      return reply.code(500).send({ error: 'Failed to generate caption' });
    }
  });

  /**
   * GET /api/posts/:postId
   * Get a single post by ID
   */
  fastify.get('/api/posts/:postId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { postId } = request.params;
      const post = await getPostById(postId, db);

      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }

      // Verify ownership
      if (post.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      return reply.send({
        success: true,
        post
      });
    } catch (error) {
      console.error('[Posts API] Get post error:', error);
      return reply.code(500).send({ error: 'Failed to get post' });
    }
  });

  /**
   * PUT /api/posts/:postId
   * Update a post
   */
  fastify.put('/api/posts/:postId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { postId } = request.params;
      
      // Verify ownership
      const post = await getPostById(postId, db);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }
      if (post.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      await updatePost(postId, request.body, db);

      return reply.send({
        success: true,
        message: 'Post updated'
      });
    } catch (error) {
      console.error('[Posts API] Update error:', error);
      return reply.code(500).send({ error: 'Failed to update post' });
    }
  });

  /**
   * DELETE /api/posts/:postId
   * Delete a post
   */
  fastify.delete('/api/posts/:postId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { postId } = request.params;
      const deleted = await deletePost(postId, user._id, db);

      if (!deleted) {
        return reply.code(404).send({ error: 'Post not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Post deleted'
      });
    } catch (error) {
      console.error('[Posts API] Delete error:', error);
      return reply.code(500).send({ error: 'Failed to delete post' });
    }
  });

  /**
   * POST /api/posts/:postId/schedule
   * Schedule a post for publishing
   */
  fastify.post('/api/posts/:postId/schedule', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { postId } = request.params;
      const { scheduledFor } = request.body;

      if (!scheduledFor) {
        return reply.code(400).send({ error: 'scheduledFor is required' });
      }

      // Verify ownership
      const post = await getPostById(postId, db);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }
      if (post.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      await schedulePost(postId, scheduledFor, db);

      return reply.send({
        success: true,
        message: 'Post scheduled'
      });
    } catch (error) {
      console.error('[Posts API] Schedule error:', error);
      return reply.code(500).send({ error: 'Failed to schedule post' });
    }
  });

  /**
   * POST /api/posts/:postId/cancel-schedule
   * Cancel scheduled post
   */
  fastify.post('/api/posts/:postId/cancel-schedule', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { postId } = request.params;

      // Verify ownership
      const post = await getPostById(postId, db);
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }
      if (post.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      await cancelScheduledPost(postId, db);

      return reply.send({
        success: true,
        message: 'Schedule cancelled'
      });
    } catch (error) {
      console.error('[Posts API] Cancel schedule error:', error);
      return reply.code(500).send({ error: 'Failed to cancel schedule' });
    }
  });

  /**
   * POST /api/schedules
   * Create a new schedule (single or recurring)
   */
  fastify.post('/api/schedules', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { type, ...scheduleData } = request.body;

      if (!type) {
        return reply.code(400).send({ error: 'Schedule type is required' });
      }

      let schedule;
      if (type === 'single') {
        schedule = await createSingleSchedule({ ...scheduleData, userId: user._id }, db);
      } else if (type === 'recurring') {
        schedule = await createRecurringSchedule({ ...scheduleData, userId: user._id }, db);
      } else {
        return reply.code(400).send({ error: 'Invalid schedule type' });
      }

      return reply.code(201).send({
        success: true,
        schedule
      });
    } catch (error) {
      console.error('[Schedules API] Create error:', error);
      return reply.code(500).send({ error: error.message || 'Failed to create schedule' });
    }
  });

  /**
   * GET /api/schedules
   * Get user's schedules
   */
  fastify.get('/api/schedules', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const filters = {
        type: request.query.type,
        status: request.query.status,
        actionType: request.query.actionType,
        page: parseInt(request.query.page) || 1,
        limit: parseInt(request.query.limit) || 20
      };

      const result = await getUserSchedules(db, user._id, filters);

      return reply.send({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[Schedules API] Get schedules error:', error);
      return reply.code(500).send({ error: 'Failed to get schedules' });
    }
  });

  /**
   * GET /api/schedules/stats
   * Get schedule statistics
   */
  fastify.get('/api/schedules/stats', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const stats = await getUserScheduleStats(user._id, db);

      return reply.send({
        success: true,
        stats
      });
    } catch (error) {
      console.error('[Schedules API] Get stats error:', error);
      return reply.code(500).send({ error: 'Failed to get statistics' });
    }
  });

  /**
   * GET /api/schedules/:scheduleId
   * Get a single schedule
   */
  fastify.get('/api/schedules/:scheduleId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { scheduleId } = request.params;
      const schedule = await getScheduleById(scheduleId, db);

      if (!schedule) {
        return reply.code(404).send({ error: 'Schedule not found' });
      }

      // Verify ownership
      if (schedule.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      return reply.send({
        success: true,
        schedule
      });
    } catch (error) {
      console.error('[Schedules API] Get schedule error:', error);
      return reply.code(500).send({ error: 'Failed to get schedule' });
    }
  });

  /**
   * PUT /api/schedules/:scheduleId
   * Update a schedule
   */
  fastify.put('/api/schedules/:scheduleId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { scheduleId } = request.params;

      // Verify ownership
      const schedule = await getScheduleById(scheduleId, db);
      if (!schedule) {
        return reply.code(404).send({ error: 'Schedule not found' });
      }
      if (schedule.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      await updateSchedule(scheduleId, request.body, db);

      return reply.send({
        success: true,
        message: 'Schedule updated'
      });
    } catch (error) {
      console.error('[Schedules API] Update error:', error);
      return reply.code(500).send({ error: error.message || 'Failed to update schedule' });
    }
  });

  /**
   * POST /api/schedules/:scheduleId/pause
   * Pause a recurring schedule
   */
  fastify.post('/api/schedules/:scheduleId/pause', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { scheduleId } = request.params;

      // Verify ownership
      const schedule = await getScheduleById(scheduleId, db);
      if (!schedule) {
        return reply.code(404).send({ error: 'Schedule not found' });
      }
      if (schedule.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      await pauseSchedule(scheduleId, db);

      return reply.send({
        success: true,
        message: 'Schedule paused'
      });
    } catch (error) {
      console.error('[Schedules API] Pause error:', error);
      return reply.code(500).send({ error: 'Failed to pause schedule' });
    }
  });

  /**
   * POST /api/schedules/:scheduleId/resume
   * Resume a paused schedule
   */
  fastify.post('/api/schedules/:scheduleId/resume', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { scheduleId } = request.params;

      // Verify ownership
      const schedule = await getScheduleById(scheduleId, db);
      if (!schedule) {
        return reply.code(404).send({ error: 'Schedule not found' });
      }
      if (schedule.userId.toString() !== user._id.toString()) {
        return reply.code(403).send({ error: 'Not authorized' });
      }

      await resumeSchedule(scheduleId, db);

      return reply.send({
        success: true,
        message: 'Schedule resumed'
      });
    } catch (error) {
      console.error('[Schedules API] Resume error:', error);
      return reply.code(500).send({ error: error.message || 'Failed to resume schedule' });
    }
  });

  /**
   * POST /api/schedules/:scheduleId/cancel
   * Cancel a schedule
   */
  fastify.post('/api/schedules/:scheduleId/cancel', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { scheduleId } = request.params;
      const cancelled = await cancelSchedule(scheduleId, user._id, db);

      if (!cancelled) {
        return reply.code(404).send({ error: 'Schedule not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Schedule cancelled'
      });
    } catch (error) {
      console.error('[Schedules API] Cancel error:', error);
      return reply.code(500).send({ error: 'Failed to cancel schedule' });
    }
  });

  /**
   * DELETE /api/schedules/:scheduleId
   * Delete a schedule
   */
  fastify.delete('/api/schedules/:scheduleId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { scheduleId } = request.params;
      const deleted = await deleteSchedule(scheduleId, user._id, db);

      if (!deleted) {
        return reply.code(404).send({ error: 'Schedule not found or not authorized' });
      }

      return reply.send({
        success: true,
        message: 'Schedule deleted'
      });
    } catch (error) {
      console.error('[Schedules API] Delete error:', error);
      return reply.code(500).send({ error: 'Failed to delete schedule' });
    }
  });
}

module.exports = routes;
