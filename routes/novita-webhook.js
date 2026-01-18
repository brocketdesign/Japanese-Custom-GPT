/**
 * Novita AI Webhook Route
 * Handles ASYNC_TASK_RESULT events from Novita AI webhooks
 */

const { ObjectId } = require('mongodb');
const { handleTaskCompletion } = require('../models/imagen');
const { handleVideoTaskCompletion } = require('../models/img2video-utils');
const axios = require('axios');
const { createHash } = require('crypto');
const { uploadToS3 } = require('../models/tool');

async function routes(fastify, options) {
  /**
   * POST /novita/webhook
   * Receive webhook events from Novita AI
   */
  fastify.post('/novita/webhook', async (request, reply) => {
    try {
      const event = request.body;

      // Log the incoming webhook event
      console.log(`[NovitaWebhook] Received event: ${event.event_type || 'unknown'}`);

      // Only process ASYNC_TASK_RESULT events
      if (event.event_type !== 'ASYNC_TASK_RESULT') {
        console.log(`[NovitaWebhook] Ignoring event type: ${event.event_type}`);
        return reply.send({ received: true });
      }

      const payload = event.payload || {};
      const task = payload.task || {};
      const taskId = task.task_id;
      const taskType = task.task_type;

      if (!taskId) {
        console.error('[NovitaWebhook] No task_id in webhook event');
        return reply.status(400).send({ error: 'Missing task_id' });
      }

      console.log(`[NovitaWebhook] Processing task ${taskId} (type: ${taskType})`);

      const db = fastify.mongo.db;
      const tasksCollection = db.collection('tasks');

      // Find the task in database
      const taskDoc = await tasksCollection.findOne({ taskId });
      
      if (!taskDoc) {
        console.warn(`[NovitaWebhook] Task ${taskId} not found in database`);
        return reply.send({ received: true }); // Return success to avoid retries
      }

      // Check if already processed
      if (taskDoc.status === 'completed' || taskDoc.completionNotificationSent) {
        console.log(`[NovitaWebhook] Task ${taskId} already processed`);
        return reply.send({ received: true });
      }

      // Check if already processed - but don't lock yet, let checkTaskStatus handle it
      // We'll store webhook data and let the existing handler process it

      // Process based on task type
      if (taskType === 'TXT_TO_IMG' || taskType === 'IMG_TO_IMG') {
        // Handle image generation tasks
        await handleImageWebhook(taskId, task, payload, taskDoc, fastify, db);
      } else if (taskType === 'IMG_TO_VIDEO' || taskId.startsWith('img2video-')) {
        // Handle video generation tasks
        await handleVideoWebhook(taskId, task, payload, taskDoc, fastify, db);
      } else {
        console.warn(`[NovitaWebhook] Unknown task type: ${taskType} for task ${taskId}`);
      }

      // Always return success quickly to prevent retries
      return reply.send({ received: true });
    } catch (error) {
      console.error('[NovitaWebhook] Error processing webhook:', error);
      // Return success to prevent retries on our end (we'll log and handle gracefully)
      return reply.send({ received: true });
    }
  });
}

/**
 * Handle image generation webhook
 */
async function handleImageWebhook(taskId, task, payload, taskDoc, fastify, db) {
  const tasksCollection = db.collection('tasks');

  try {
    if (task.status !== 'TASK_STATUS_SUCCEED') {
      if (task.status === 'TASK_STATUS_FAILED') {
        console.error(`[NovitaWebhook] Task ${taskId} failed: ${task.reason || 'Unknown error'}`);
        await tasksCollection.updateOne(
          { taskId },
          { 
            $set: { 
              status: 'failed', 
              result: { error: task.reason || 'Task failed' },
              updatedAt: new Date() 
            } 
          }
        );
      }
      return;
    }

    const images = payload.images || [];
    if (images.length === 0) {
      console.error(`[NovitaWebhook] Task ${taskId} completed but no images in response`);
      await tasksCollection.updateOne(
        { taskId },
        { 
          $set: { 
            status: 'failed', 
            result: { error: 'No images in response' },
            updatedAt: new Date() 
          } 
        }
      );
      return;
    }

    // Process images: download from Novita and upload to S3
    const processedImages = await Promise.all(images.map(async (image, index) => {
      const imageUrl = image.image_url || image.imageUrl;
      if (!imageUrl) {
        console.error(`[NovitaWebhook] No image_url for image ${index} in task ${taskId}`);
        return null;
      }

      try {
        const imageResponse = await axios.get(imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 120000
        });
        const buffer = Buffer.from(imageResponse.data, 'binary');
        const hash = createHash('md5').update(buffer).digest('hex');
        const uploadedUrl = await uploadToS3(buffer, hash, 'novita_result_image.png');
        
        return {
          imageId: hash,
          imageUrl: uploadedUrl,
          nsfw_detection_result: image.nsfw_detection_result || null,
          seed: payload.extra?.seed || 0,
          index
        };
      } catch (error) {
        console.error(`[NovitaWebhook] Error processing image ${index} for task ${taskId}:`, error);
        // Fallback to original URL
        return {
          imageId: createHash('md5').update(imageUrl).digest('hex'),
          imageUrl: imageUrl,
          nsfw_detection_result: image.nsfw_detection_result || null,
          seed: payload.extra?.seed || 0,
          index
        };
      }
    }));

    const validImages = processedImages.filter(img => img !== null);
    
    if (validImages.length === 0) {
      console.error(`[NovitaWebhook] No valid images processed for task ${taskId}`);
      await tasksCollection.updateOne(
        { taskId },
        { 
          $set: { 
            status: 'failed', 
            result: { error: 'Failed to process images' },
            updatedAt: new Date() 
          } 
        }
      );
      return;
    }

    // Store processed images with webhookProcessed flag
    // checkTaskStatus will use these images instead of polling Novita
    await tasksCollection.updateOne(
      { taskId },
      { 
        $set: { 
          'result.images': validImages.map(img => ({
            imageUrl: img.imageUrl,
            seed: img.seed || 0,
            nsfw_detection_result: img.nsfw_detection_result,
            imageId: img.imageId
          })),
          'webhookProcessed': true, // Flag to skip polling in checkTaskStatus
          updatedAt: new Date() 
        } 
      }
    );

    // Process the task using checkTaskStatus (it will use webhook images, skip polling)
    // This handles merge face, saving to DB
    const { checkTaskStatus, handleTaskCompletion } = require('../models/imagen');
    const taskStatus = await checkTaskStatus(taskId, fastify);
    
    // Handle task completion notifications (sends characterImageGenerated for character creation)
    if (taskStatus && taskStatus.status === 'completed' && taskStatus.images && taskStatus.images.length > 0) {
      try {
        // Get task document to access chatCreation and other metadata
        const taskDoc = await tasksCollection.findOne({ taskId });
        
        if (!taskDoc) {
          console.warn(`[NovitaWebhook] Task document not found for ${taskId} after checkTaskStatus`);
          return;
        }
        
        // Get translations if available (from request or default)
        let translations = null;
        if (taskDoc.translations) {
          translations = taskDoc.translations;
        }
        
        // Ensure userId and chatId are strings for handleTaskCompletion
        const userId = taskStatus.userId?.toString() || taskDoc.userId?.toString();
        const chatId = taskDoc.chatId?.toString();
        
        if (!userId || !chatId) {
          console.warn(`[NovitaWebhook] Missing userId or chatId for task ${taskId}`);
          return;
        }
        
        // Update taskStatus to have string userId for handleTaskCompletion
        const formattedTaskStatus = {
          ...taskStatus,
          userId: userId,
          userChatId: taskStatus.userChatId?.toString() || taskDoc.userChatId?.toString() || null
        };
        
        await handleTaskCompletion(formattedTaskStatus, fastify, {
          chatCreation: taskDoc.chatCreation || false,
          translations: translations,
          userId: userId,
          chatId: chatId,
          placeholderId: taskDoc.placeholderId
        });
      } catch (error) {
        console.error(`[NovitaWebhook] Error calling handleTaskCompletion for task ${taskId}:`, error);
        // Don't fail the webhook - images are already saved
      }
    }

    console.log(`[NovitaWebhook] ✅ Successfully processed image task ${taskId}`);
  } catch (error) {
    console.error(`[NovitaWebhook] Error handling image webhook for task ${taskId}:`, error);
    await tasksCollection.updateOne(
      { taskId },
      { 
        $set: { 
          status: 'failed', 
          result: { error: error.message || 'Processing error' },
          updatedAt: new Date() 
        } 
      }
    );
  }
}

/**
 * Handle video generation webhook
 */
async function handleVideoWebhook(taskId, task, payload, taskDoc, fastify, db) {
  const tasksCollection = db.collection('tasks');

  try {
    if (task.status !== 'TASK_STATUS_SUCCEED') {
      if (task.status === 'TASK_STATUS_FAILED') {
        console.error(`[NovitaWebhook] Video task ${taskId} failed: ${task.reason || 'Unknown error'}`);
        await tasksCollection.updateOne(
          { taskId },
          { 
            $set: { 
              status: 'failed', 
              result: { error: task.reason || 'Video generation failed' },
              updatedAt: new Date() 
            } 
          }
        );

        // Notify user of failure
        if (taskDoc.userId && fastify.sendNotificationToUser) {
          fastify.sendNotificationToUser(taskDoc.userId.toString(), 'handleVideoLoader', { 
            videoId: taskDoc.placeholderId, 
            placeholderId: taskDoc.placeholderId,
            action: 'remove' 
          });
          fastify.sendNotificationToUser(taskDoc.userId.toString(), 'showNotification', {
            message: 'Video generation failed',
            icon: 'error'
          });
        }
      }
      return;
    }

    const videos = payload.videos || [];
    if (videos.length === 0) {
      console.error(`[NovitaWebhook] Video task ${taskId} completed but no videos in response`);
      await tasksCollection.updateOne(
        { taskId },
        { 
          $set: { 
            status: 'failed', 
            result: { error: 'No videos in response' },
            updatedAt: new Date() 
          } 
        }
      );
      return;
    }

    const videoData = videos[0];
    const novitaVideoUrl = videoData.video_url;

    if (!novitaVideoUrl) {
      console.error(`[NovitaWebhook] No video_url in response for task ${taskId}`);
      await tasksCollection.updateOne(
        { taskId },
        { 
          $set: { 
            status: 'failed', 
            result: { error: 'No video URL in response' },
            updatedAt: new Date() 
          } 
        }
      );
      return;
    }

    // Download video and upload to S3
    let s3VideoUrl;
    try {
      const videoResponse = await axios.get(novitaVideoUrl, { 
        responseType: 'arraybuffer',
        timeout: 120000
      });
      const videoBuffer = Buffer.from(videoResponse.data);
      const hash = createHash('md5').update(videoBuffer).digest('hex');
      s3VideoUrl = await uploadToS3(videoBuffer, hash, 'novita_result_video.mp4');
      console.log(`[NovitaWebhook] Video uploaded to S3: ${s3VideoUrl}`);
    } catch (uploadError) {
      console.error(`[NovitaWebhook] Error uploading video to S3, using original URL:`, uploadError);
      s3VideoUrl = novitaVideoUrl; // Fallback to original URL
    }

    // Create task status object
    const taskStatus = {
      taskId: taskId,
      status: 'completed',
      result: {
        videoUrl: s3VideoUrl,
        duration: videoData.duration
      }
    };

    // Handle video completion
    await handleVideoTaskCompletion(taskStatus, fastify, {
      userId: taskDoc.userId.toString(),
      chatId: taskDoc.chatId.toString(),
      userChatId: taskDoc.userChatId,
      placeholderId: taskDoc.placeholderId,
      imageId: taskDoc.imageId.toString(),
      prompt: taskDoc.prompt,
      nsfw: taskDoc.nsfw
    });

    console.log(`[NovitaWebhook] ✅ Successfully processed video task ${taskId}`);
  } catch (error) {
    console.error(`[NovitaWebhook] Error handling video webhook for task ${taskId}:`, error);
    await tasksCollection.updateOne(
      { taskId },
      { 
        $set: { 
          status: 'failed', 
          result: { error: error.message || 'Processing error' },
          updatedAt: new Date() 
        } 
      }
    );

    // Notify user of error
    if (taskDoc.userId && fastify.sendNotificationToUser) {
      fastify.sendNotificationToUser(taskDoc.userId.toString(), 'handleVideoLoader', { 
        videoId: taskDoc.placeholderId, 
        placeholderId: taskDoc.placeholderId,
        action: 'remove' 
      });
      fastify.sendNotificationToUser(taskDoc.userId.toString(), 'showNotification', {
        message: 'Video generation encountered an error',
        icon: 'error'
      });
    }
  }
}

module.exports = routes;
