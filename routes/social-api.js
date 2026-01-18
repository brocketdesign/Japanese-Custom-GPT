/**
 * Social Media API Routes - Late.dev Integration
 * Handles SNS connections (Instagram, X/Twitter) and post publishing
 */

const { ObjectId } = require('mongodb');
const { generateCompletion } = require('../models/openai');

// Late.dev API Configuration
const LATE_API_BASE_URL = 'https://getlate.dev/api/v1';
const LATE_API_KEY = process.env.LATE_API_KEY;

// Supported platforms
const SUPPORTED_PLATFORMS = ['twitter', 'instagram'];

// Account limits based on subscription
const ACCOUNT_LIMITS = {
  free: 1,
  premium: 5
};

/**
 * Helper: Make Late.dev API request
 */
async function lateApiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${LATE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  console.log(`[Social API] ${method} ${LATE_API_BASE_URL}${endpoint}`);
  
  try {
    const response = await fetch(`${LATE_API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[Social API] Late.dev error:`, data);
      throw new Error(data.message || `Late.dev API error: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`[Social API] Request failed:`, error);
    throw error;
  }
}

/**
 * Helper: Get user's connected accounts count
 */
async function getUserAccountsCount(db, userId) {
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { snsConnections: 1 } }
  );
  return user?.snsConnections?.length || 0;
}

/**
 * Helper: Check if user can connect more accounts
 */
function canConnectMoreAccounts(user, currentCount) {
  const isPremium = user?.subscriptionStatus === 'active';
  const limit = isPremium ? ACCOUNT_LIMITS.premium : ACCOUNT_LIMITS.free;
  return currentCount < limit;
}

async function routes(fastify, options) {
  const db = fastify.mongo.db;

  /**
   * GET /api/social/status
   * Get user's SNS connection status
   */
  fastify.get('/api/social/status', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const userId = user._id;
      const userData = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        { projection: { snsConnections: 1, subscriptionStatus: 1 } }
      );

      const connections = userData?.snsConnections || [];
      const isPremium = userData?.subscriptionStatus === 'active';
      const limit = isPremium ? ACCOUNT_LIMITS.premium : ACCOUNT_LIMITS.free;

      console.log(`[Social API] Status check for user ${userId}: ${connections.length}/${limit} connections`);

      return reply.send({
        success: true,
        connections: connections.map(conn => ({
          id: conn.id,
          platform: conn.platform,
          username: conn.username,
          profileUrl: conn.profileUrl,
          connectedAt: conn.connectedAt
        })),
        limits: {
          current: connections.length,
          max: limit,
          isPremium
        }
      });
    } catch (error) {
      console.error('[Social API] Error getting status:', error);
      return reply.code(500).send({ error: 'Failed to get connection status' });
    }
  });

  /**
   * GET /api/social/connect/:platform
   * Get OAuth URL to connect a platform
   */
  fastify.get('/api/social/connect/:platform', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { platform } = request.params;
      if (!SUPPORTED_PLATFORMS.includes(platform)) {
        return reply.code(400).send({ error: `Platform '${platform}' is not supported` });
      }

      // Check account limits
      const currentCount = await getUserAccountsCount(db, user._id);
      if (!canConnectMoreAccounts(user, currentCount)) {
        return reply.code(403).send({ 
          error: 'Account limit reached',
          message: 'Upgrade to premium to connect more accounts',
          needsUpgrade: true
        });
      }

      // Get OAuth URL from Late.dev
      const callbackUrl = `${request.protocol}://${request.hostname}/api/social/callback/${platform}`;
      const response = await lateApiRequest(`/connect/${platform}?callback_url=${encodeURIComponent(callbackUrl)}`);

      console.log(`[Social API] OAuth URL generated for ${platform}`);

      return reply.send({
        success: true,
        authUrl: response.url || response.authUrl,
        platform
      });
    } catch (error) {
      console.error(`[Social API] Error getting connect URL:`, error);
      return reply.code(500).send({ error: 'Failed to initiate connection' });
    }
  });

  /**
   * GET /api/social/callback/:platform
   * OAuth callback handler
   */
  fastify.get('/api/social/callback/:platform', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.redirect('/settings?sns_error=auth_required');
      }

      const { platform } = request.params;
      const { code, state, error: oauthError } = request.query;

      if (oauthError) {
        console.error(`[Social API] OAuth error for ${platform}:`, oauthError);
        return reply.redirect(`/settings?sns_error=${encodeURIComponent(oauthError)}&platform=${platform}`);
      }

      if (!code) {
        return reply.redirect(`/settings?sns_error=missing_code&platform=${platform}`);
      }

      // Exchange code for access token via Late.dev
      const tokenResponse = await lateApiRequest('/oauth/token', 'POST', {
        platform,
        code,
        state
      });

      // Get account info
      const accountInfo = tokenResponse.account || {};

      // Store connection in user document
      const connection = {
        id: accountInfo.id || `${platform}_${Date.now()}`,
        platform,
        username: accountInfo.username || accountInfo.name || 'Unknown',
        profileUrl: accountInfo.profile_url || accountInfo.avatar,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_at,
        connectedAt: new Date(),
        lateAccountId: accountInfo.late_account_id || accountInfo.id
      };

      // Add connection to user (avoid duplicates)
      await db.collection('users').updateOne(
        { _id: new ObjectId(user._id) },
        { 
          $pull: { snsConnections: { platform, id: connection.id } }
        }
      );

      await db.collection('users').updateOne(
        { _id: new ObjectId(user._id) },
        { 
          $push: { snsConnections: connection }
        }
      );

      console.log(`[Social API] Successfully connected ${platform} for user ${user._id}`);

      return reply.redirect(`/settings?sns_success=connected&platform=${platform}`);
    } catch (error) {
      console.error(`[Social API] Callback error:`, error);
      return reply.redirect(`/settings?sns_error=connection_failed&platform=${request.params.platform}`);
    }
  });

  /**
   * DELETE /api/social/disconnect/:platform/:accountId
   * Disconnect a platform account
   */
  fastify.delete('/api/social/disconnect/:platform/:accountId', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { platform, accountId } = request.params;

      const result = await db.collection('users').updateOne(
        { _id: new ObjectId(user._id) },
        { 
          $pull: { 
            snsConnections: { 
              platform,
              $or: [{ id: accountId }, { lateAccountId: accountId }]
            }
          }
        }
      );

      if (result.modifiedCount === 0) {
        return reply.code(404).send({ error: 'Connection not found' });
      }

      console.log(`[Social API] Disconnected ${platform}/${accountId} for user ${user._id}`);

      return reply.send({
        success: true,
        message: `Disconnected from ${platform}`
      });
    } catch (error) {
      console.error(`[Social API] Disconnect error:`, error);
      return reply.code(500).send({ error: 'Failed to disconnect account' });
    }
  });

  /**
   * POST /api/social/post
   * Create a post on connected platforms
   */
  fastify.post('/api/social/post', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { text, mediaUrls, platforms, scheduledFor } = request.body;

      if (!text || !platforms || platforms.length === 0) {
        return reply.code(400).send({ error: 'Text and at least one platform are required' });
      }

      // Get user's connections
      const userData = await db.collection('users').findOne(
        { _id: new ObjectId(user._id) },
        { projection: { snsConnections: 1 } }
      );

      const connections = userData?.snsConnections || [];
      
      // Filter to requested platforms
      const targetConnections = connections.filter(c => platforms.includes(c.platform));
      
      if (targetConnections.length === 0) {
        return reply.code(400).send({ 
          error: 'No connected accounts for selected platforms',
          needsConnection: true
        });
      }

      // Create post via Late.dev
      const postData = {
        text,
        platforms: targetConnections.map(c => c.platform),
        mediaUrls: mediaUrls || []
      };

      if (scheduledFor) {
        postData.scheduledFor = scheduledFor;
      }

      console.log(`[Social API] Creating post for user ${user._id}:`, {
        platforms: postData.platforms,
        hasMedia: mediaUrls?.length > 0,
        scheduled: !!scheduledFor
      });

      const response = await lateApiRequest('/posts', 'POST', postData);

      // Log the post
      await db.collection('socialPosts').insertOne({
        userId: new ObjectId(user._id),
        text,
        mediaUrls,
        platforms: postData.platforms,
        latePostId: response.id,
        status: response.status || 'pending',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        createdAt: new Date()
      });

      console.log(`[Social API] Post created successfully: ${response.id}`);

      return reply.send({
        success: true,
        postId: response.id,
        status: response.status,
        message: scheduledFor ? 'Post scheduled successfully' : 'Post published successfully'
      });
    } catch (error) {
      console.error(`[Social API] Post error:`, error);
      return reply.code(500).send({ error: 'Failed to create post' });
    }
  });

  /**
   * POST /api/social/generate-caption
   * Generate AI caption for social media post
   */
  fastify.post('/api/social/generate-caption', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const { imagePrompt, imageUrl, platform, style, language } = request.body;

      if (!imagePrompt && !imageUrl) {
        return reply.code(400).send({ error: 'Image prompt or URL is required' });
      }

      const lang = language || request.lang || 'en';
      const targetPlatform = platform || 'general';
      const captionStyle = style || 'engaging';

      // Build prompt for caption generation
      const systemPrompt = `You are a social media expert creating captions for ${targetPlatform}. 
Create a ${captionStyle} caption in ${lang === 'ja' ? 'Japanese' : lang === 'fr' ? 'French' : 'English'}.

Guidelines:
- Keep it concise and engaging
- Include 3-5 relevant hashtags at the end
- Match the tone to the platform (${targetPlatform === 'instagram' ? 'visual, aesthetic' : 'conversational, witty'})
- If the image seems to be AI-generated art, subtly reference that
- Make it shareable and engaging

Image context: ${imagePrompt || 'An interesting AI-generated image'}

Return ONLY the caption text with hashtags, nothing else.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate a social media caption for this image.' }
      ];

      console.log(`[Social API] Generating caption for ${targetPlatform} in ${lang}`);

      const caption = await generateCompletion(messages, 200, 'gpt-4o-mini', lang);

      return reply.send({
        success: true,
        caption: caption?.trim() || '',
        platform: targetPlatform,
        language: lang
      });
    } catch (error) {
      console.error(`[Social API] Caption generation error:`, error);
      return reply.code(500).send({ error: 'Failed to generate caption' });
    }
  });

  /**
   * GET /api/social/posts
   * Get user's post history
   */
  fastify.get('/api/social/posts', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const page = parseInt(request.query.page) || 1;
      const limit = parseInt(request.query.limit) || 20;
      const skip = (page - 1) * limit;

      const posts = await db.collection('socialPosts')
        .find({ userId: new ObjectId(user._id) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await db.collection('socialPosts')
        .countDocuments({ userId: new ObjectId(user._id) });

      return reply.send({
        success: true,
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error(`[Social API] Get posts error:`, error);
      return reply.code(500).send({ error: 'Failed to get posts' });
    }
  });
}

module.exports = routes;
