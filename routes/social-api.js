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

/**
 * Helper: Get or create Late.dev profile for user
 */
async function getOrCreateProfile(db, userId, userEmail, userName) {
  // Check if user already has a Late profile ID stored
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { lateProfileId: 1 } }
  );

  if (user?.lateProfileId) {
    return user.lateProfileId;
  }

  // Create a new profile in Late.dev
  try {
    console.log(`[Social API] Creating Late.dev profile for user ${userId}`);
    const profileData = {
      name: userName || `User ${userId}`,
      description: `Profile for user ${userId}`,
      color: '#6E20F4' // Match app's primary color
    };

    const response = await lateApiRequest('/profiles', 'POST', profileData);
    
    // Response format: { message: "...", profile: { _id: "...", ... } }
    const profileId = response.profile?._id || response.profile?.id;

    if (!profileId) {
      console.error(`[Social API] Unexpected response format:`, response);
      throw new Error('Profile ID not returned from Late.dev');
    }

    // Store profile ID in user document
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { lateProfileId: profileId } }
    );

    console.log(`[Social API] Created Late.dev profile: ${profileId}`);
    return profileId;
  } catch (error) {
    console.error(`[Social API] Error creating profile:`, error);
    // Try to list existing profiles as fallback
    try {
      const profilesResponse = await lateApiRequest('/profiles');
      // Response format: { profiles: [{ _id: "...", ... }, ...] }
      const profiles = profilesResponse.profiles || [];
      
      if (profiles.length > 0) {
        const defaultProfileId = profiles[0]._id || profiles[0].id;
        if (defaultProfileId) {
          await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { lateProfileId: defaultProfileId } }
          );
          console.log(`[Social API] Using existing Late.dev profile: ${defaultProfileId}`);
          return defaultProfileId;
        }
      }
    } catch (fallbackError) {
      console.error(`[Social API] Fallback profile fetch failed:`, fallbackError);
    }
    throw error;
  }
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

      // Get or create profile for this user
      const profileId = await getOrCreateProfile(db, user._id, user.email, user.nickname || user.username);
      
      // Get OAuth URL from Late.dev (profileId is required)
      const callbackUrl = `${request.protocol}://${request.hostname}/api/social/callback/${platform}`;
      const queryParams = new URLSearchParams({
        profileId: profileId,
        redirect_url: callbackUrl
      });
      
      const response = await lateApiRequest(`/connect/${platform}?${queryParams.toString()}`);

      console.log(`[Social API] OAuth URL generated for ${platform} with profileId: ${profileId}`);

      return reply.send({
        success: true,
        authUrl: response.url || response.authUrl || response.auth_url,
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
   * Late.dev redirects with: connected=platform&profileId=PROFILE_ID&username=USERNAME
   */
  fastify.get('/api/social/callback/:platform', async (request, reply) => {
    try {
      const user = request.user;
      if (!user || user.isTemporary) {
        return reply.redirect('/settings?sns_error=auth_required');
      }

      const { platform } = request.params;
      const { connected, username, profileId, error: oauthError, tempToken, userProfile, connect_token } = request.query;

      // Check for OAuth errors
      if (oauthError || !connected) {
        const errorMsg = oauthError || 'connection_failed';
        console.error(`[Social API] OAuth error for ${platform}:`, errorMsg);
        return reply.redirect(`/settings?sns_error=${encodeURIComponent(errorMsg)}&platform=${platform}`);
      }

      // Verify the connected platform matches
      if (connected !== platform) {
        console.error(`[Social API] Platform mismatch: expected ${platform}, got ${connected}`);
        return reply.redirect(`/settings?sns_error=platform_mismatch&platform=${platform}`);
      }

      // For headless mode, we might get tempToken and need to finalize connection
      // For now, we'll use the standard flow where Late.dev returns the connection info directly
      
      const profileIdForConnection = profileId || user.lateProfileId;
      
      if (!profileIdForConnection) {
        console.error(`[Social API] No profileId in callback for user ${user._id}`);
        return reply.redirect(`/settings?sns_error=missing_profile&platform=${platform}`);
      }

      // Late.dev redirects back with connection info in query params
      // We can also fetch full connection details if needed later
      // For now, store what we get from the callback
      const connection = {
        id: `${platform}_${username}_${Date.now()}`,
        platform,
        username: username || 'Unknown',
        profileUrl: null, // Can be fetched later if needed
        connectedAt: new Date(),
        lateAccountId: username, // Use username as identifier until we get the actual account ID
        lateProfileId: profileIdForConnection
      };

      // Add connection to user (avoid duplicates)
      await db.collection('users').updateOne(
        { _id: new ObjectId(user._id) },
        { 
          $pull: { snsConnections: { platform } }
        }
      );

      await db.collection('users').updateOne(
        { _id: new ObjectId(user._id) },
        { 
          $push: { snsConnections: connection }
        }
      );

      console.log(`[Social API] Successfully connected ${platform} (@${connection.username}) for user ${user._id}`);

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

      // Get user's connections and profile
      const userData = await db.collection('users').findOne(
        { _id: new ObjectId(user._id) },
        { projection: { snsConnections: 1, lateProfileId: 1 } }
      );

      const connections = userData?.snsConnections || [];
      const profileId = userData?.lateProfileId;
      
      if (!profileId) {
        return reply.code(400).send({ 
          error: 'No profile found. Please connect an account first.',
          needsConnection: true
        });
      }
      
      // Filter to requested platforms
      const targetConnections = connections.filter(c => platforms.includes(c.platform));
      
      if (targetConnections.length === 0) {
        return reply.code(400).send({ 
          error: 'No connected accounts for selected platforms',
          needsConnection: true
        });
      }

      // Create post via Late.dev (profileId is required)
      const postData = {
        profileId: profileId,
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
