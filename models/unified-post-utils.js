/**
 * Unified Post Model
 * Converts all dashboard outputs (images, videos) to a unified Post format
 */

const { ObjectId } = require('mongodb');

/**
 * Post types
 */
const POST_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  GALLERY_IMAGE: 'gallery_image' // Legacy from gallery
};

/**
 * Post sources (where it was generated)
 */
const POST_SOURCES = {
  IMAGE_DASHBOARD: 'image_dashboard',
  VIDEO_DASHBOARD: 'video_dashboard',
  GALLERY: 'gallery',
  CRON_JOB: 'cron_job',
  API: 'api',
  CHAT: 'chat' // Posts created in chat
};

/**
 * Post statuses
 */
const POST_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  FAILED: 'failed',
  PROCESSING: 'processing'
};

/**
 * Create a unified post from image dashboard generation
 * @param {Object} data - Image generation data
 * @param {Object} db - Database connection
 * @returns {Object} Created post
 */
async function createPostFromImage(data, db) {
  const {
    userId,
    testId, // From imageModelTests
    imageUrl,
    prompt,
    negativePrompt,
    model,
    parameters,
    rating,
    nsfw = false,
    mutationData = null,
    scheduledFor = null,
    autoPublish = false,
    socialPlatforms = []
  } = data;

  const post = {
    userId: new ObjectId(userId),
    type: POST_TYPES.IMAGE,
    source: POST_SOURCES.IMAGE_DASHBOARD,
    
    // Content
    content: {
      imageUrl,
      thumbnailUrl: imageUrl, // Could be optimized later
      prompt,
      negativePrompt,
      model,
      parameters: parameters || {}
    },
    
    // Metadata
    metadata: {
      sourceId: testId ? new ObjectId(testId) : null,
      rating: rating || null,
      nsfw,
      mutationData,
      width: parameters?.width || null,
      height: parameters?.height || null,
      seed: parameters?.seed || null
    },
    
    // Status and publishing
    status: scheduledFor ? POST_STATUSES.SCHEDULED : POST_STATUSES.DRAFT,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    publishedAt: null,
    
    // Social media
    autoPublish,
    socialPlatforms,
    socialPostIds: [],
    
    // Engagement
    likes: 0,
    comments: [],
    views: 0,
    
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('unifiedPosts').insertOne(post);
  
  // Update user's post count
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { postCount: 1 } }
  );

  return { _id: result.insertedId, ...post };
}

/**
 * Create a unified post from video dashboard generation
 * @param {Object} data - Video generation data
 * @param {Object} db - Database connection
 * @returns {Object} Created post
 */
async function createPostFromVideo(data, db) {
  const {
    userId,
    testId, // From videoModelTests
    videoUrl,
    thumbnailUrl,
    prompt,
    inputImageUrl,
    model,
    parameters,
    rating,
    nsfw = false,
    mutationData = null,
    scheduledFor = null,
    autoPublish = false,
    socialPlatforms = []
  } = data;

  const post = {
    userId: new ObjectId(userId),
    type: POST_TYPES.VIDEO,
    source: POST_SOURCES.VIDEO_DASHBOARD,
    
    // Content
    content: {
      videoUrl,
      thumbnailUrl,
      inputImageUrl,
      prompt,
      model,
      parameters: parameters || {}
    },
    
    // Metadata
    metadata: {
      sourceId: testId ? new ObjectId(testId) : null,
      rating: rating || null,
      nsfw,
      mutationData,
      duration: parameters?.duration || null,
      aspectRatio: parameters?.aspectRatio || null
    },
    
    // Status and publishing
    status: scheduledFor ? POST_STATUSES.SCHEDULED : POST_STATUSES.DRAFT,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    publishedAt: null,
    
    // Social media
    autoPublish,
    socialPlatforms,
    socialPostIds: [],
    
    // Engagement
    likes: 0,
    comments: [],
    views: 0,
    
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('unifiedPosts').insertOne(post);
  
  // Update user's post count
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { postCount: 1 } }
  );

  return { _id: result.insertedId, ...post };
}

/**
 * Link an existing test result to a unified post
 * @param {string} testId - Test ID
 * @param {string} testType - 'image' or 'video'
 * @param {Object} db - Database connection
 * @returns {Object} Created post
 */
async function linkTestToPost(testId, testType, db) {
  const collection = testType === 'image' ? 'imageModelTests' : 'videoModelTests';
  const test = await db.collection(collection).findOne({ _id: new ObjectId(testId) });
  
  if (!test) {
    throw new Error(`Test not found: ${testId}`);
  }

  // Check if already linked
  const existingPost = await db.collection('unifiedPosts').findOne({
    'metadata.sourceId': new ObjectId(testId),
    source: testType === 'image' ? POST_SOURCES.IMAGE_DASHBOARD : POST_SOURCES.VIDEO_DASHBOARD
  });

  if (existingPost) {
    return existingPost;
  }

  // Create post based on type
  if (testType === 'image') {
    return await createPostFromImage({
      userId: test.userId,
      testId: test._id,
      imageUrl: test.imageUrl,
      prompt: test.prompt,
      negativePrompt: test.negativePrompt,
      model: test.model,
      parameters: test.parameters,
      rating: test.rating,
      nsfw: test.nsfw || false
    }, db);
  } else {
    return await createPostFromVideo({
      userId: test.userId,
      testId: test._id,
      videoUrl: test.videoUrl,
      thumbnailUrl: test.thumbnailUrl,
      prompt: test.prompt,
      inputImageUrl: test.inputImageUrl,
      model: test.model,
      parameters: test.parameters,
      rating: test.rating,
      nsfw: test.nsfw || false
    }, db);
  }
}

/**
 * Get user's posts with filters
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Object} Posts and pagination
 */
async function getUserPosts(db, userId, filters = {}) {
  const {
    type,
    source,
    status,
    nsfw,
    scheduledOnly = false,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = -1
  } = filters;

  const query = { userId: new ObjectId(userId) };
  
  if (type) query.type = type;
  if (source) query.source = source;
  if (status) query.status = status;
  if (typeof nsfw === 'boolean') query['metadata.nsfw'] = nsfw;
  if (scheduledOnly) {
    query.scheduledFor = { $exists: true, $ne: null };
  }

  const skip = (page - 1) * limit;

  const posts = await db.collection('unifiedPosts')
    .find(query)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .toArray();

  const total = await db.collection('unifiedPosts').countDocuments(query);

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update post status
 * @param {string} postId - Post ID
 * @param {string} status - New status
 * @param {Object} db - Database connection
 */
async function updatePostStatus(postId, status, db) {
  const update = {
    status,
    updatedAt: new Date()
  };

  if (status === POST_STATUSES.PUBLISHED) {
    update.publishedAt = new Date();
  }

  await db.collection('unifiedPosts').updateOne(
    { _id: new ObjectId(postId) },
    { $set: update }
  );
}

/**
 * Schedule a post
 * @param {string} postId - Post ID
 * @param {Date} scheduledFor - Scheduled time
 * @param {Object} db - Database connection
 */
async function schedulePost(postId, scheduledFor, db) {
  await db.collection('unifiedPosts').updateOne(
    { _id: new ObjectId(postId) },
    {
      $set: {
        scheduledFor: new Date(scheduledFor),
        status: POST_STATUSES.SCHEDULED,
        updatedAt: new Date()
      }
    }
  );
}

/**
 * Cancel scheduled post
 * @param {string} postId - Post ID
 * @param {Object} db - Database connection
 */
async function cancelScheduledPost(postId, db) {
  await db.collection('unifiedPosts').updateOne(
    { _id: new ObjectId(postId) },
    {
      $set: {
        scheduledFor: null,
        status: POST_STATUSES.DRAFT,
        updatedAt: new Date()
      }
    }
  );
}

/**
 * Get scheduled posts ready to publish
 * @param {Object} db - Database connection
 * @returns {Array} Posts ready to publish
 */
async function getScheduledPostsToPublish(db) {
  return await db.collection('unifiedPosts')
    .find({
      status: POST_STATUSES.SCHEDULED,
      scheduledFor: { $lte: new Date() }
    })
    .toArray();
}

/**
 * Add social post ID to unified post
 * @param {string} postId - Post ID
 * @param {string} platform - Platform name
 * @param {string} socialPostId - Social media post ID
 * @param {Object} db - Database connection
 */
async function addSocialPostId(postId, platform, socialPostId, db) {
  await db.collection('unifiedPosts').updateOne(
    { _id: new ObjectId(postId) },
    {
      $push: {
        socialPostIds: {
          platform,
          postId: socialPostId,
          publishedAt: new Date()
        }
      },
      $set: { updatedAt: new Date() }
    }
  );
}

/**
 * Delete a post
 * @param {string} postId - Post ID
 * @param {string} userId - User ID (for ownership verification)
 * @param {Object} db - Database connection
 */
async function deletePost(postId, userId, db) {
  const result = await db.collection('unifiedPosts').deleteOne({
    _id: new ObjectId(postId),
    userId: new ObjectId(userId)
  });

  if (result.deletedCount > 0) {
    // Decrement user's post count
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { postCount: -1 } }
    );
  }

  return result.deletedCount > 0;
}

/**
 * Get post by ID
 * @param {string} postId - Post ID
 * @param {Object} db - Database connection
 */
async function getPostById(postId, db) {
  return await db.collection('unifiedPosts').findOne({
    _id: new ObjectId(postId)
  });
}

/**
 * Update post content
 * @param {string} postId - Post ID
 * @param {Object} updates - Content updates
 * @param {Object} db - Database connection
 */
async function updatePost(postId, updates, db) {
  const allowedUpdates = {
    'content.prompt': updates.prompt,
    'content.caption': updates.caption,
    'metadata.nsfw': updates.nsfw,
    autoPublish: updates.autoPublish,
    socialPlatforms: updates.socialPlatforms,
    updatedAt: new Date()
  };

  // Remove undefined values
  Object.keys(allowedUpdates).forEach(key => {
    if (allowedUpdates[key] === undefined) {
      delete allowedUpdates[key];
    }
  });

  await db.collection('unifiedPosts').updateOne(
    { _id: new ObjectId(postId) },
    { $set: allowedUpdates }
  );
}

/**
 * Get user's social posts from late.dev API (stored in socialPosts collection)
 * This is the primary function for the My Posts dashboard
 * @param {Object} db - Database connection
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Object} Social posts and pagination
 */
async function getCombinedUserPosts(db, userId, filters = {}) {
  const {
    type,
    source,
    status,
    nsfw,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = -1
  } = filters;

  const userObjId = new ObjectId(userId);
  
  // Query for social posts (posted via late.dev API)
  const socialQuery = { userId: userObjId };
  if (status) socialQuery.status = status;
  
  // Get social posts
  const socialPosts = await db.collection('socialPosts')
    .find(socialQuery)
    .sort({ [sortBy]: sortOrder })
    .toArray();

  // Transform social posts to unified format for display
  const transformedSocialPosts = socialPosts.map(post => ({
    _id: post._id,
    userId: post.userId,
    type: POST_TYPES.IMAGE,
    source: POST_SOURCES.API,
    content: {
      imageUrl: post.mediaUrls?.[0] || '',
      thumbnailUrl: post.mediaUrls?.[0] || '',
      prompt: '',
      caption: post.text || ''
    },
    metadata: {
      nsfw: false,
      latePostId: post.latePostId
    },
    status: post.status === 'published' ? POST_STATUSES.PUBLISHED : 
            post.scheduledFor ? POST_STATUSES.SCHEDULED : POST_STATUSES.DRAFT,
    scheduledFor: post.scheduledFor || null,
    publishedAt: post.createdAt,
    autoPublish: true,
    socialPlatforms: post.platforms?.map(p => p.platform) || [],
    socialPostIds: [{ platform: post.platforms?.[0]?.platform, postId: post.latePostId }],
    likes: 0,
    comments: [],
    views: 0,
    createdAt: post.createdAt,
    updatedAt: post.createdAt,
    _isSocialPost: true
  }));

  // Also include unified posts that have been scheduled for social publishing
  const unifiedQuery = { userId: userObjId };
  if (type) unifiedQuery.type = type;
  if (source && source !== 'api') unifiedQuery.source = source;
  if (status) unifiedQuery.status = status;
  if (typeof nsfw === 'boolean') unifiedQuery['metadata.nsfw'] = nsfw;
  
  const unifiedPosts = await db.collection('unifiedPosts')
    .find(unifiedQuery)
    .toArray();

  // Combine social posts and unified posts
  let combinedPosts = [...transformedSocialPosts, ...unifiedPosts];
  
  // Remove duplicates (same image might be in both)
  const seenIds = new Set();
  combinedPosts = combinedPosts.filter(post => {
    const id = post._id.toString();
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
  
  // Sort combined posts
  combinedPosts.sort((a, b) => {
    const aVal = a[sortBy] || a.createdAt;
    const bVal = b[sortBy] || b.createdAt;
    return sortOrder === -1 
      ? new Date(bVal) - new Date(aVal)
      : new Date(aVal) - new Date(bVal);
  });

  // Apply pagination
  const total = combinedPosts.length;
  const skip = (page - 1) * limit;
  const paginatedPosts = combinedPosts.slice(skip, skip + limit);

  return {
    posts: paginatedPosts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Create a draft post from image dashboard
 * @param {Object} data - Post data with image info
 * @param {Object} db - Database connection
 * @returns {Object} Created post
 */
async function createDraftPostFromImage(data, db) {
  const {
    userId,
    testId,
    imageUrl,
    prompt,
    negativePrompt,
    caption = '',
    model,
    parameters,
    nsfw = false
  } = data;

  const post = {
    userId: new ObjectId(userId),
    type: POST_TYPES.IMAGE,
    source: POST_SOURCES.IMAGE_DASHBOARD,
    
    content: {
      imageUrl,
      thumbnailUrl: imageUrl,
      prompt,
      negativePrompt,
      caption,
      model,
      parameters: parameters || {}
    },
    
    metadata: {
      sourceId: testId ? new ObjectId(testId) : null,
      nsfw,
      width: parameters?.width || null,
      height: parameters?.height || null,
      seed: parameters?.seed || null
    },
    
    status: POST_STATUSES.DRAFT,
    scheduledFor: null,
    publishedAt: null,
    
    autoPublish: false,
    socialPlatforms: [],
    socialPostIds: [],
    
    likes: 0,
    comments: [],
    views: 0,
    
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection('unifiedPosts').insertOne(post);
  
  return { _id: result.insertedId, ...post };
}

module.exports = {
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
  getScheduledPostsToPublish,
  addSocialPostId,
  deletePost,
  getPostById,
  updatePost
};
