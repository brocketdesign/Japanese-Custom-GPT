/**
 * Calendar Queue Processor
 * Processes queued content and publishes at scheduled calendar slot times
 */

const { ObjectId } = require('mongodb');
const {
  QUEUE_STATUSES,
  getReadyQueueItems,
  markAsPublished,
  markAsFailed
} = require('./calendar-queue-utils');

const { incrementPublishCount } = require('./calendar-utils');
const { updatePostStatus, POST_STATUSES } = require('./unified-post-utils');
const { publishToSocial } = require('./scheduled-tasks-processor');

/**
 * Process a single queue item
 * @param {Object} item - Queue item to process
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Processing result
 */
async function processQueueItem(item, fastify) {
  const db = fastify.mongo.db;

  try {
    console.log(`[Calendar Queue] Processing queue item ${item._id} for post ${item.postId}`);

    // Get the post to publish
    const post = await db.collection('unifiedPosts').findOne({
      _id: new ObjectId(item.postId)
    });

    if (!post) {
      throw new Error('Post not found');
    }

    // Check if post is already published
    if (post.status === POST_STATUSES.PUBLISHED) {
      console.log(`[Calendar Queue] Post ${item.postId} is already published, marking queue item as published`);
      await markAsPublished(item._id.toString(), db);
      return { success: true, alreadyPublished: true };
    }

    // Override social platforms from queue item if specified
    const postToPublish = {
      ...post,
      socialPlatforms: item.socialPlatforms && item.socialPlatforms.length > 0
        ? item.socialPlatforms
        : post.socialPlatforms
    };

    // Publish to social media
    const result = await publishToSocial(postToPublish, fastify);

    if (result.published) {
      // Mark queue item as published
      await markAsPublished(item._id.toString(), db);

      // Update post status to published
      await updatePostStatus(item.postId.toString(), POST_STATUSES.PUBLISHED, db);

      // Increment calendar publish count
      await incrementPublishCount(item.calendarId.toString(), db);

      console.log(`[Calendar Queue] Successfully published post ${item.postId} via calendar ${item.calendarId}`);

      return {
        success: true,
        published: true,
        platforms: result.platforms
      };
    } else {
      throw new Error(result.reason || result.error || 'Publishing failed');
    }

  } catch (error) {
    console.error(`[Calendar Queue] Error processing queue item ${item._id}:`, error);

    // Mark as failed (with retry logic)
    await markAsFailed(item._id.toString(), error.message, db);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process all ready queue items
 * @param {Object} fastify - Fastify instance
 */
async function processCalendarQueue(fastify) {
  const db = fastify.mongo.db;

  try {
    // Get items ready to publish (scheduledPublishAt <= now)
    const readyItems = await getReadyQueueItems(db);

    if (readyItems.length === 0) {
      return;
    }

    console.log(`[Calendar Queue] Processing ${readyItems.length} ready queue items`);

    // Process items sequentially to avoid rate limits
    for (const item of readyItems) {
      // Update status to processing
      await db.collection('calendarQueue').updateOne(
        { _id: item._id },
        {
          $set: {
            status: QUEUE_STATUSES.PROCESSING,
            lastAttemptAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Process the item
      await processQueueItem(item, fastify);

      // Small delay between posts to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[Calendar Queue] Finished processing queue items`);

  } catch (error) {
    console.error('[Calendar Queue] Error processing calendar queue:', error);
  }
}

/**
 * Main calendar queue processor - runs every minute
 * @param {Object} fastify - Fastify instance
 */
const createCalendarQueueProcessor = (fastify) => {
  return async () => {
    console.log('[Calendar Queue] Running queue processor...');

    try {
      await processCalendarQueue(fastify);
      console.log('[Calendar Queue] Queue processor completed');
    } catch (error) {
      console.error('[Calendar Queue] Queue processor error:', error);
    }
  };
};

module.exports = {
  processQueueItem,
  processCalendarQueue,
  createCalendarQueueProcessor
};
