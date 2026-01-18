/**
 * Scheduled Tasks Processor
 * Executes scheduled single tasks and recurring cron jobs
 */

const {
  getPendingSingleSchedules,
  getActiveRecurringSchedules,
  markSingleScheduleExecuted,
  markRecurringScheduleExecuted,
  ACTION_TYPES
} = require('./scheduling-utils');

const {
  createPostFromImage,
  createPostFromVideo,
  updatePostStatus,
  POST_STATUSES
} = require('./unified-post-utils');

const {
  mutatePrompt,
  applyTemplate
} = require('./prompt-mutation-utils');

/**
 * Execute a scheduled action
 * @param {Object} schedule - Schedule object
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Execution result
 */
async function executeScheduledAction(schedule, fastify) {
  const db = fastify.mongo.db;
  
  try {
    console.log(`[Scheduled Tasks] Executing ${schedule.actionType} for schedule ${schedule._id}`);
    
    let result;
    
    switch (schedule.actionType) {
      case ACTION_TYPES.GENERATE_IMAGE:
        result = await executeImageGeneration(schedule, fastify);
        break;
        
      case ACTION_TYPES.GENERATE_VIDEO:
        result = await executeVideoGeneration(schedule, fastify);
        break;
        
      case ACTION_TYPES.PUBLISH_POST:
        result = await executePostPublishing(schedule, fastify);
        break;
        
      default:
        throw new Error(`Unknown action type: ${schedule.actionType}`);
    }
    
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    console.error(`[Scheduled Tasks] Error executing schedule ${schedule._id}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute image generation task
 * @param {Object} schedule - Schedule object
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Generation result
 */
async function executeImageGeneration(schedule, fastify) {
  const db = fastify.mongo.db;
  const { actionData } = schedule;
  
  // Apply prompt mutation if enabled
  let prompt = actionData.prompt;
  let mutationData = null;
  
  if (schedule.mutationEnabled || actionData.mutationEnabled) {
    if (actionData.templateId) {
      // Apply template
      const templateResult = await applyTemplate(actionData.templateId, db, actionData.mutationOptions || {});
      prompt = templateResult.mutatedPrompt;
      mutationData = {
        templateId: actionData.templateId,
        templateName: templateResult.templateName,
        mutations: templateResult.mutations,
        seed: templateResult.seed
      };
    } else {
      // Direct mutation
      const mutationResult = mutatePrompt(prompt, actionData.mutationOptions || {});
      prompt = mutationResult.mutatedPrompt;
      mutationData = {
        mutations: mutationResult.mutations,
        seed: mutationResult.seed
      };
    }
  }
  
  // Import image generation utilities
  const { generateImage } = require('./admin-image-test-utils');
  
  // Generate image
  const generationResult = await generateImage({
    prompt,
    negativePrompt: actionData.negativePrompt,
    model: actionData.model,
    parameters: actionData.parameters,
    userId: schedule.userId.toString()
  }, db);
  
  // Create unified post
  const post = await createPostFromImage({
    userId: schedule.userId.toString(),
    testId: generationResult._id,
    imageUrl: generationResult.imageUrl,
    prompt,
    negativePrompt: actionData.negativePrompt,
    model: actionData.model,
    parameters: actionData.parameters,
    nsfw: actionData.nsfw || false,
    mutationData,
    autoPublish: actionData.autoPublish || false,
    socialPlatforms: actionData.socialPlatforms || []
  }, db);
  
  // If auto-publish is enabled, publish to social media
  if (actionData.autoPublish && actionData.socialPlatforms && actionData.socialPlatforms.length > 0) {
    await publishToSocial(post, fastify);
  }
  
  return {
    postId: post._id,
    imageUrl: generationResult.imageUrl,
    mutationData
  };
}

/**
 * Execute video generation task
 * @param {Object} schedule - Schedule object
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Generation result
 */
async function executeVideoGeneration(schedule, fastify) {
  const db = fastify.mongo.db;
  const { actionData } = schedule;
  
  // Apply prompt mutation if enabled
  let prompt = actionData.prompt;
  let mutationData = null;
  
  if (schedule.mutationEnabled || actionData.mutationEnabled) {
    if (actionData.templateId) {
      // Apply template
      const templateResult = await applyTemplate(actionData.templateId, db, actionData.mutationOptions || {});
      prompt = templateResult.mutatedPrompt;
      mutationData = {
        templateId: actionData.templateId,
        templateName: templateResult.templateName,
        mutations: templateResult.mutations,
        seed: templateResult.seed
      };
    } else {
      // Direct mutation
      const mutationResult = mutatePrompt(prompt, actionData.mutationOptions || {});
      prompt = mutationResult.mutatedPrompt;
      mutationData = {
        mutations: mutationResult.mutations,
        seed: mutationResult.seed
      };
    }
  }
  
  // Import video generation utilities
  const { generateVideo } = require('./dashboard-video-utils');
  
  // Generate video
  const generationResult = await generateVideo({
    inputImageUrl: actionData.inputImageUrl,
    prompt,
    model: actionData.model,
    parameters: actionData.parameters,
    userId: schedule.userId.toString()
  }, db, fastify);
  
  // Create unified post
  const post = await createPostFromVideo({
    userId: schedule.userId.toString(),
    testId: generationResult._id,
    videoUrl: generationResult.videoUrl,
    thumbnailUrl: generationResult.thumbnailUrl,
    prompt,
    inputImageUrl: actionData.inputImageUrl,
    model: actionData.model,
    parameters: actionData.parameters,
    nsfw: actionData.nsfw || false,
    mutationData,
    autoPublish: actionData.autoPublish || false,
    socialPlatforms: actionData.socialPlatforms || []
  }, db);
  
  // If auto-publish is enabled, publish to social media
  if (actionData.autoPublish && actionData.socialPlatforms && actionData.socialPlatforms.length > 0) {
    await publishToSocial(post, fastify);
  }
  
  return {
    postId: post._id,
    videoUrl: generationResult.videoUrl,
    mutationData
  };
}

/**
 * Execute post publishing task
 * @param {Object} schedule - Schedule object
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Publishing result
 */
async function executePostPublishing(schedule, fastify) {
  const db = fastify.mongo.db;
  const { postId } = schedule.actionData;
  
  // Get post
  const { getPostById } = require('./unified-post-utils');
  const post = await getPostById(postId, db);
  
  if (!post) {
    throw new Error('Post not found');
  }
  
  // Publish to social media
  const result = await publishToSocial(post, fastify);
  
  // Update post status
  await updatePostStatus(postId, POST_STATUSES.PUBLISHED, db);
  
  return result;
}

/**
 * Publish post to social media using Late.dev
 * @param {Object} post - Unified post object
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Publishing result
 */
async function publishToSocial(post, fastify) {
  const db = fastify.mongo.db;
  
  if (!post.socialPlatforms || post.socialPlatforms.length === 0) {
    console.log('[Scheduled Tasks] No social platforms configured for post');
    return { published: false, reason: 'no_platforms' };
  }
  
  // Get user data
  const { ObjectId } = require('mongodb');
  const userData = await db.collection('users').findOne(
    { _id: new ObjectId(post.userId) },
    { projection: { snsConnections: 1, lateProfileId: 1 } }
  );
  
  if (!userData || !userData.lateProfileId) {
    console.log('[Scheduled Tasks] No Late.dev profile found for user');
    return { published: false, reason: 'no_profile' };
  }
  
  // Prepare media URLs
  const mediaUrls = [];
  if (post.type === 'image' && post.content.imageUrl) {
    mediaUrls.push(post.content.imageUrl);
  } else if (post.type === 'video' && post.content.videoUrl) {
    mediaUrls.push(post.content.videoUrl);
  }
  
  // Generate caption if not provided
  let caption = post.content.prompt || '';
  
  // Check NSFW and filter platforms
  const allowedPlatforms = post.socialPlatforms.filter(platform => {
    // Instagram doesn't allow NSFW content
    if (post.metadata.nsfw && platform === 'instagram') {
      return false;
    }
    return true;
  });
  
  if (allowedPlatforms.length === 0) {
    console.log('[Scheduled Tasks] No allowed platforms after NSFW filtering');
    return { published: false, reason: 'nsfw_filtered' };
  }
  
  try {
    // Use social-api to publish
    const lateApiRequest = require('../routes/social-api').lateApiRequest;
    
    // Resolve platform connections
    const connections = userData.snsConnections || [];
    const targetConnections = connections.filter(c => allowedPlatforms.includes(c.platform));
    
    if (targetConnections.length === 0) {
      console.log('[Scheduled Tasks] No connected accounts for selected platforms');
      return { published: false, reason: 'no_connections' };
    }
    
    // Prepare platforms data
    const platformsData = targetConnections.map(conn => ({
      platform: conn.platform,
      accountId: conn.lateAccountId,
      platformSpecificData: {}
    }));
    
    // Create post via Late.dev
    const postData = {
      content: caption,
      mediaItems: mediaUrls.map(url => ({
        url,
        type: post.type === 'video' ? 'video' : 'image'
      })),
      platforms: platformsData
    };
    
    // Make API request
    const LATE_API_BASE_URL = 'https://getlate.dev/api/v1';
    const LATE_API_KEY = process.env.LATE_API_KEY;
    
    const response = await fetch(`${LATE_API_BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.message || `Late.dev API error: ${response.status}`);
    }
    
    const latePostId = responseData.id || responseData._id || responseData.postId;
    
    // Log social post
    await db.collection('socialPosts').insertOne({
      userId: new ObjectId(post.userId),
      unifiedPostId: post._id,
      text: caption,
      mediaUrls,
      platforms: platformsData,
      latePostId,
      status: 'published',
      createdAt: new Date()
    });
    
    // Update unified post with social post ID
    const { addSocialPostId } = require('./unified-post-utils');
    for (const platform of allowedPlatforms) {
      await addSocialPostId(post._id.toString(), platform, latePostId, db);
    }
    
    console.log(`[Scheduled Tasks] Published post ${post._id} to social media`);
    
    return {
      published: true,
      latePostId,
      platforms: allowedPlatforms
    };
    
  } catch (error) {
    console.error('[Scheduled Tasks] Error publishing to social:', error);
    return {
      published: false,
      error: error.message
    };
  }
}

/**
 * Process pending single schedules
 * @param {Object} fastify - Fastify instance
 */
async function processPendingSchedules(fastify) {
  const db = fastify.mongo.db;
  
  try {
    const pendingSchedules = await getPendingSingleSchedules(db);
    
    if (pendingSchedules.length === 0) {
      return;
    }
    
    console.log(`[Scheduled Tasks] Processing ${pendingSchedules.length} pending schedules`);
    
    for (const schedule of pendingSchedules) {
      const result = await executeScheduledAction(schedule, fastify);
      await markSingleScheduleExecuted(schedule._id.toString(), result, db);
    }
    
  } catch (error) {
    console.error('[Scheduled Tasks] Error processing pending schedules:', error);
  }
}

/**
 * Process active recurring schedules
 * @param {Object} fastify - Fastify instance
 */
async function processRecurringSchedules(fastify) {
  const db = fastify.mongo.db;
  
  try {
    const activeSchedules = await getActiveRecurringSchedules(db);
    
    if (activeSchedules.length === 0) {
      return;
    }
    
    console.log(`[Scheduled Tasks] Processing ${activeSchedules.length} recurring schedules`);
    
    for (const schedule of activeSchedules) {
      const result = await executeScheduledAction(schedule, fastify);
      await markRecurringScheduleExecuted(schedule._id.toString(), result, db);
    }
    
  } catch (error) {
    console.error('[Scheduled Tasks] Error processing recurring schedules:', error);
  }
}

/**
 * Main task processor - runs every minute
 * @param {Object} fastify - Fastify instance
 */
const createScheduledTasksProcessor = (fastify) => {
  return async () => {
    console.log('[Scheduled Tasks] Running task processor...');
    
    try {
      // Process both pending and recurring schedules
      await Promise.all([
        processPendingSchedules(fastify),
        processRecurringSchedules(fastify)
      ]);
      
      console.log('[Scheduled Tasks] Task processor completed');
    } catch (error) {
      console.error('[Scheduled Tasks] Task processor error:', error);
    }
  };
};

module.exports = {
  executeScheduledAction,
  executeImageGeneration,
  executeVideoGeneration,
  executePostPublishing,
  publishToSocial,
  processPendingSchedules,
  processRecurringSchedules,
  createScheduledTasksProcessor
};
