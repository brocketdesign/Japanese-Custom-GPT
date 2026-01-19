/**
 * Creator Routes
 * 
 * Routes for creator discovery, profile management, and creator applications.
 * Part of Phase 2: Creator Profile Enhancement
 */

const { ObjectId } = require('mongodb');
const { getApiUrl } = require('../models/tool');
const {
  applyAsCreator,
  updateCreatorProfile,
  getCreators,
  getFeaturedCreators,
  getTrendingCreators,
  getCreatorProfile,
  verifyCreator,
  getCreatorCategories
} = require('../models/creator-utils');

async function routes(fastify, options) {

  // ==========================================
  // PAGE ROUTES
  // ==========================================

  /**
   * GET /creators - Browse creators page
   */
  fastify.get('/creators', async (request, reply) => {
    try {
      const translations = request.translations;
      const db = fastify.mongo.db;
      const currentUser = request.user;

      // Get initial data for the page
      const [featuredResult, trendingResult, creatorsResult] = await Promise.all([
        getFeaturedCreators(db, 6),
        getTrendingCreators(db, 6),
        getCreators(db, { page: 1, limit: 12, sortBy: 'popular' })
      ]);

      const categories = getCreatorCategories();

      return reply.renderWithGtm('/creators/index.hbs', {
        title: translations?.creators?.pageTitle || 'Discover Creators',
        translations,
        mode: process.env.MODE,
        apiurl: getApiUrl(request),
        user: currentUser,
        featuredCreators: featuredResult.success ? featuredResult.creators : [],
        trendingCreators: trendingResult.success ? trendingResult.creators : [],
        creators: creatorsResult.success ? creatorsResult.creators : [],
        pagination: creatorsResult.success ? creatorsResult.pagination : { page: 1, totalPages: 1 },
        categories
      });
    } catch (error) {
      console.error('Error rendering creators page:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /creators/apply - Creator application page
   */
  fastify.get('/creators/apply', async (request, reply) => {
    try {
      if (!request.user || request.user.isTemporary) {
        return reply.redirect('/login?redirect=/creators/apply');
      }

      const translations = request.translations;
      const db = fastify.mongo.db;
      const currentUser = request.user;

      // Check if already a creator
      const user = await db.collection('users').findOne({ 
        _id: new ObjectId(currentUser._id) 
      });

      if (user?.isCreator) {
        return reply.redirect(`/user/${currentUser._id}`);
      }

      const categories = getCreatorCategories();

      return reply.renderWithGtm('/creators/apply.hbs', {
        title: translations?.creators?.applyTitle || 'Become a Creator',
        translations,
        mode: process.env.MODE,
        apiurl: getApiUrl(request),
        user: currentUser,
        categories
      });
    } catch (error) {
      console.error('Error rendering creator application page:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // API ROUTES
  // ==========================================

  /**
   * GET /api/creators - Get paginated list of creators
   */
  fastify.get('/api/creators', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const {
        page = 1,
        limit = 12,
        category = null,
        search = null,
        sortBy = 'popular',
        verified = null
      } = request.query;

      const result = await getCreators(db, {
        page: parseInt(page),
        limit: parseInt(limit),
        category,
        search,
        sortBy,
        verified: verified === 'true' ? true : verified === 'false' ? false : null
      });

      return reply.send(result);
    } catch (error) {
      console.error('Error fetching creators:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /api/creators/featured - Get featured creators
   */
  fastify.get('/api/creators/featured', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const limit = parseInt(request.query.limit) || 6;

      const result = await getFeaturedCreators(db, limit);
      return reply.send(result);
    } catch (error) {
      console.error('Error fetching featured creators:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /api/creators/trending - Get trending creators
   */
  fastify.get('/api/creators/trending', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const limit = parseInt(request.query.limit) || 6;

      const result = await getTrendingCreators(db, limit);
      return reply.send(result);
    } catch (error) {
      console.error('Error fetching trending creators:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /api/creators/categories - Get available categories
   */
  fastify.get('/api/creators/categories', async (request, reply) => {
    try {
      const categories = getCreatorCategories();
      return reply.send({ success: true, categories });
    } catch (error) {
      console.error('Error fetching categories:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * GET /api/creators/:creatorId - Get creator profile
   */
  fastify.get('/api/creators/:creatorId', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const { creatorId } = request.params;

      if (!ObjectId.isValid(creatorId)) {
        return reply.status(400).send({ success: false, error: 'Invalid creator ID' });
      }

      const result = await getCreatorProfile(db, creatorId);
      return reply.send(result);
    } catch (error) {
      console.error('Error fetching creator profile:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/creators/apply - Apply to become a creator
   */
  fastify.post('/api/creators/apply', async (request, reply) => {
    try {
      if (!request.user || request.user.isTemporary) {
        return reply.status(401).send({ success: false, error: 'Authentication required' });
      }

      const db = fastify.mongo.db;
      const userId = request.user._id;
      const applicationData = request.body;

      // Validate required fields
      if (!applicationData.displayName || applicationData.displayName.trim().length < 2) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Display name is required and must be at least 2 characters' 
        });
      }

      const result = await applyAsCreator(db, userId, applicationData);
      
      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    } catch (error) {
      console.error('Error in creator application:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * PUT /api/creators/profile - Update creator profile
   */
  fastify.put('/api/creators/profile', async (request, reply) => {
    try {
      if (!request.user || request.user.isTemporary) {
        return reply.status(401).send({ success: false, error: 'Authentication required' });
      }

      const db = fastify.mongo.db;
      const userId = request.user._id;
      const profileData = request.body;

      const result = await updateCreatorProfile(db, userId, profileData);
      
      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    } catch (error) {
      console.error('Error updating creator profile:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/creators/cover-image - Upload cover image
   */
  fastify.post('/api/creators/cover-image', async (request, reply) => {
    try {
      if (!request.user || request.user.isTemporary) {
        return reply.status(401).send({ success: false, error: 'Authentication required' });
      }

      if (!request.isMultipart?.()) {
        return reply.status(400).send({ success: false, error: 'Request must be multipart/form-data' });
      }

      const { uploadToS3 } = require('../models/tool');
      const { createHash } = require('crypto');
      const db = fastify.mongo.db;
      const userId = request.user._id;

      let coverImageUrl = null;

      for await (const part of request.parts()) {
        if (part.fieldname === 'coverImage' && part.file) {
          const chunks = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const hash = createHash('sha256').update(buffer).digest('hex');

          try {
            coverImageUrl = await uploadToS3(buffer, hash, part.filename || 'cover_image');
          } catch (uploadError) {
            console.error('Failed to upload cover image:', uploadError);
            return reply.status(500).send({ success: false, error: 'Failed to upload image' });
          }
        }
      }

      if (!coverImageUrl) {
        return reply.status(400).send({ success: false, error: 'No image provided' });
      }

      // Update creator profile with new cover image
      const result = await updateCreatorProfile(db, userId, { coverImage: coverImageUrl });
      
      return reply.send({
        success: true,
        coverImage: coverImageUrl,
        message: 'Cover image uploaded successfully'
      });
    } catch (error) {
      console.error('Error uploading cover image:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  /**
   * POST /api/admin/creators/:creatorId/verify - Verify a creator (admin only)
   */
  fastify.post('/api/admin/creators/:creatorId/verify', async (request, reply) => {
    try {
      if (!request.user || request.user.isTemporary) {
        return reply.status(401).send({ success: false, error: 'Authentication required' });
      }

      // Check if user is admin
      const { checkUserAdmin } = require('../models/tool');
      const isAdmin = await checkUserAdmin(fastify, request.user._id);
      
      if (!isAdmin) {
        return reply.status(403).send({ success: false, error: 'Admin access required' });
      }

      const db = fastify.mongo.db;
      const { creatorId } = request.params;

      if (!ObjectId.isValid(creatorId)) {
        return reply.status(400).send({ success: false, error: 'Invalid creator ID' });
      }

      const result = await verifyCreator(db, creatorId);
      return reply.send(result);
    } catch (error) {
      console.error('Error verifying creator:', error);
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });
}

module.exports = routes;
