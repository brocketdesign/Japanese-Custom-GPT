/**
 * Novita AI Webhook Route
 * Handles ASYNC_TASK_RESULT events from Novita AI webhooks
 */

const { ObjectId } = require('mongodb');
const { handleTaskCompletion } = require('../models/imagen');
const { handleVideoTaskCompletion } = require('../models/img2video-utils');
const axios = require('axios');
const { createHash } = require('crypto');
const { uploadImage } = require('../models/tool');
const { IMAGE_TASK_TYPES, VIDEO_TASK_TYPES, isVideoTask } = require('../models/task-types');

async function routes(fastify, options) {
  /**
   * POST /novita/webhook
   * Receive webhook events from Novita AI
   */
  fastify.post('/novita/webhook', async (request, reply) => {
    try {
      const event = request.body;

      // Log the incoming webhook event with full details
      console.log(`[NovitaWebhook] 🔔 Received event type: ${event.event_type || 'unknown'}`);
      console.log(`[NovitaWebhook] 📋 Full event:`, JSON.stringify(event, null, 2));

      // Only process ASYNC_TASK_RESULT events
      if (event.event_type !== 'ASYNC_TASK_RESULT') {
        console.log(`[NovitaWebhook] ⏭️ Ignoring non-ASYNC_TASK_RESULT event type: ${event.event_type}`);
        return reply.send({ received: true });
      }

      const payload = event.payload || {};
      const task = payload.task || {};
      const taskId = task.task_id;
      const taskType = task.task_type;
      const taskStatus = task.status;

      if (!taskId) {
        console.error('[NovitaWebhook] ❌ No task_id in webhook event');
        return reply.status(400).send({ error: 'Missing task_id' });
      }

      console.log(`[NovitaWebhook] 📊 Processing task ${taskId} (type: ${taskType}, status: ${taskStatus})`);

      const db = fastify.mongo.db;
      const tasksCollection = db.collection('tasks');

      // Find the task in database
      const taskDoc = await tasksCollection.findOne({ taskId });
      
      if (!taskDoc) {
        console.warn(`[NovitaWebhook] ⚠️ Task ${taskId} not found in database - webhook arrived before task was stored`);
        return reply.send({ received: true }); // Return success to avoid retries
      }

      console.log(`[NovitaWebhook] ✅ Found task in database:`, {
        taskId,
        status: taskDoc.status,
        isBuiltInModel: taskDoc.isBuiltInModel,
        imageModelId: taskDoc.imageModelId,
        chatCreation: taskDoc.chatCreation
      });

      // Check if already processed
      if (taskDoc.status === 'completed' || taskDoc.completionNotificationSent) {
        console.log(`[NovitaWebhook] ⏭️ Task ${taskId} already processed (status=${taskDoc.status})`);
        return reply.send({ received: true });
      }

      // Check if already processed - but don't lock yet, let checkTaskStatus handle it
      // We'll store webhook data and let the existing handler process it

      // Process based on task type using shared constants
      if (IMAGE_TASK_TYPES.includes(taskType)) {
        // Handle image generation tasks
        console.log(`[NovitaWebhook] 🖼️ Handling as image task type: ${taskType}`);
        await handleImageWebhook(taskId, task, payload, taskDoc, fastify, db);
      } else if (isVideoTask(taskType, taskId)) {
        // Handle video generation tasks
        console.log(`[NovitaWebhook] 🎬 Handling as video task type: ${taskType}`);
        await handleVideoWebhook(taskId, task, payload, taskDoc, fastify, db);
      } else {
        console.warn(`[NovitaWebhook] ⚠️ Unknown task type: ${taskType} for task ${taskId}`);
      }

      // Always return success quickly to prevent retries
      return reply.send({ received: true });
    } catch (error) {
      console.error('[NovitaWebhook] ❌ Error processing webhook:', error.message);
      console.error('[NovitaWebhook] Stack:', error.stack);
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
    console.log(`[NovitaWebhook] 🖼️ Processing image webhook for task ${taskId}`);
    
    if (task.status !== 'TASK_STATUS_SUCCEED') {
      if (task.status === 'TASK_STATUS_FAILED') {
        console.error(`[NovitaWebhook] ❌ Task ${taskId} failed: ${task.reason || 'Unknown error'}`);
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
      } else {
        console.warn(`[NovitaWebhook] ⏳ Task ${taskId} status is ${task.status} (not completed yet)`);
      }
      return;
    }

    console.log(`[NovitaWebhook] ✅ Task ${taskId} succeeded`);
    
    const images = payload.images || [];
    console.log(`[NovitaWebhook] 📸 Found ${images.length} image(s) in response`);
    
    if (images.length === 0) {
      console.error(`[NovitaWebhook] ❌ Task ${taskId} completed but no images in response`);
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
        console.error(`[NovitaWebhook] ❌ No image_url for image ${index} in task ${taskId}`);
        return null;
      }

      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[NovitaWebhook] 📥 Downloading image ${index + 1}/${images.length} for task ${taskId} (attempt ${attempt}/${maxRetries})`);
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 120000
          });
          const buffer = Buffer.from(imageResponse.data, 'binary');
          const hash = createHash('md5').update(buffer).digest('hex');
          console.log(`[NovitaWebhook] 📤 Uploading image ${index + 1} to S3 (hash: ${hash})`);
          const uploadedUrl = await uploadImage(buffer, hash, 'novita_result_image.png');

          console.log(`[NovitaWebhook] ✅ Image ${index + 1} uploaded successfully`);
          return {
            imageId: hash,
            imageUrl: uploadedUrl,
            seed: payload.extra?.seed || 0,
            index
          };
        } catch (error) {
          console.error(`[NovitaWebhook] ❌ Error processing image ${index} for task ${taskId} (attempt ${attempt}/${maxRetries}):`, error.message);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        }
      }
      console.error(`[NovitaWebhook] ❌ All ${maxRetries} attempts failed for image ${index} in task ${taskId}`);
      return null;
    }));

    const validImages = processedImages.filter(img => img !== null);
    console.log(`[NovitaWebhook] 📋 Processed ${validImages.length}/${processedImages.length} images successfully`);
    
    if (validImages.length === 0) {
      console.error(`[NovitaWebhook] ❌ No valid images processed for task ${taskId}`);
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
    console.log(`[NovitaWebhook] 💾 Storing ${validImages.length} processed images in database for task ${taskId}`);
    await tasksCollection.updateOne(
      { taskId },
      { 
        $set: { 
          'result.images': validImages.map(img => ({
            imageUrl: img.imageUrl,
            seed: img.seed || 0,
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
        
        // Build sequentialBatchInfo for proper batch grouping in carousel
        // Models without batch support generate each image as a separate task
        let sequentialBatchInfo = null;
        let effectivePlaceholderId = taskDoc.placeholderId;
        
        if (taskDoc.sequentialParentTaskId || taskDoc.sequentialExpectedCount) {
          // This is a sequential batch task - get batch info
          if (taskDoc.sequentialExpectedCount) {
            // This is the parent task (batchIndex 0)
            sequentialBatchInfo = {
              batchIndex: 0,
              batchSize: taskDoc.sequentialExpectedCount
            };
          } else if (taskDoc.sequentialParentTaskId && typeof taskDoc.sequentialImageIndex === 'number') {
            // This is a child task - get parent info
            // sequentialImageIndex starts at 2 (i + 1 where i starts at 1 in the creation loop)
            // So child tasks have indices 2, 3, 4... which map to batchIndex 1, 2, 3...
            const parentTask = await tasksCollection.findOne({ taskId: taskDoc.sequentialParentTaskId });
            if (parentTask && parentTask.sequentialExpectedCount) {
              sequentialBatchInfo = {
                batchIndex: taskDoc.sequentialImageIndex - 1, // Convert to 0-based (2->1, 3->2, etc.)
                batchSize: parentTask.sequentialExpectedCount
              };
              // CRITICAL: Use parent's placeholderId as batchId for proper grouping
              effectivePlaceholderId = parentTask.placeholderId || taskDoc.sequentialParentTaskId;
            }
          }
          if (sequentialBatchInfo) {
            console.log(`[NovitaWebhook] Sequential batch info for task ${taskId}: index=${sequentialBatchInfo.batchIndex}, size=${sequentialBatchInfo.batchSize}, effectivePlaceholderId=${effectivePlaceholderId}`);
          }
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
          placeholderId: effectivePlaceholderId,
          sequentialBatchInfo
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
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const videoResponse = await axios.get(novitaVideoUrl, {
          responseType: 'arraybuffer',
          timeout: 120000
        });
        const videoBuffer = Buffer.from(videoResponse.data);
        const hash = createHash('md5').update(videoBuffer).digest('hex');
        s3VideoUrl = await uploadImage(videoBuffer, hash, 'novita_result_video.mp4');
        console.log(`[NovitaWebhook] Video uploaded to S3: ${s3VideoUrl}`);
        break;
      } catch (uploadError) {
        console.error(`[NovitaWebhook] Error uploading video to S3 (attempt ${attempt}/${maxRetries}):`, uploadError.message);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        } else {
          console.error(`[NovitaWebhook] ❌ All ${maxRetries} attempts failed for video in task ${taskId}`);
        }
      }
    }

    if (!s3VideoUrl) {
      await tasksCollection.updateOne(
        { taskId },
        { $set: { status: 'failed', result: { error: 'Failed to upload video to S3' }, updatedAt: new Date() } }
      );
      return;
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
