const { ObjectId } = require('mongodb');
const axios = require('axios');
/**
 * Generate video from image using Novita AI
 * @param {Object} params - Parameters for video generation
 * @param {string} params.imageUrl - Base64 encoded image
 * @param {string} params.prompt - Text prompt for video generation
 * @param {string} params.userId - User ID
 * @param {string} params.chatId - Chat ID
 * @param {string} params.placeholderId - Placeholder ID for tracking
 * @returns {Object} Task result from Novita API
 */
async function generateVideoFromImage({ imageUrl, prompt, userId, chatId, placeholderId }) {
  const novitaApiKey = process.env.NOVITA_API_KEY;
  const apiUrl = 'https://api.novita.ai/v3/async/kling-v1.6-i2v';

  const requestData = {
    image_url: imageUrl,
    prompt: prompt || 'Generate a dynamic video from this image',
    negative_prompt: 'blurry, low quality, distorted',
    duration: 5,
    guidance_scale: 0.5,
  };
  console.log(`[generateVideoFromImage] RequestData: ${JSON.stringify(requestData)}`);

  try {
    const response = await axios.post(apiUrl, requestData, {
      headers: {
        'Authorization': `Bearer ${novitaApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.task_id) {
      return {
        success: true,
        taskId: response.data.task_id,
        message: 'Video generation started'
      };
    } else {
      throw new Error('Invalid response from Novita API');
    }
  } catch (error) {
    console.error('Error calling Novita img2video API:', error);
    throw new Error('Failed to start video generation');
  }
}

/**
 * Check video generation task status
 * @param {string} taskId - Task ID from Novita
 * @returns {Object} Task status information
 */
async function checkVideoTaskStatus(taskId) {
  const novitaApiKey = process.env.NOVITA_API_KEY;
  const apiUrl = `https://api.novita.ai/v3/async/task-result?task_id=${taskId}`;

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${novitaApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    
    if (data.task.status === 'TASK_STATUS_SUCCEED') {
        console.log(data);
        console.log(data.videos)
      return {
        status: 'completed',
        result: {
          videoUrl: data.videos?.[0]?.video_url,
          duration: data.videos?.[0]?.duration
        }
      };
    } else if (data.task.status === 'TASK_STATUS_PROCESSING') {
      return {
        status: 'processing',
        progress: data.task.progress || 0
      };
    } else if (data.task.status === 'TASK_STATUS_FAILED') {
      return {
        status: 'failed',
        error: data.task.reason || 'Video generation failed'
      };
    } else {
      return {
        status: 'pending',
        progress: 0
      };
    }
  } catch (error) {
    console.error('Error checking video task status:', error);
    return {
      status: 'failed',
      error: 'Failed to check task status'
    };
  }
}

/**
 * Save video generation task to database
 * @param {Object} params - Task parameters
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Saved task
 */
async function saveVideoTask({
  taskId,
  userId,
  chatId,
  userChatId,
  imageId,
  imageUrl,
  prompt,
  placeholderId,
  fastify
}) {
  const db = fastify.mongo.db;
  const tasksCollection = db.collection('tasks');

  const taskData = {
    taskId,
    userId: new ObjectId(userId),
    chatId: new ObjectId(chatId),
    userChatId,
    imageId: new ObjectId(imageId),
    imageUrl,
    prompt,
    placeholderId,
    type: 'img2video',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await tasksCollection.insertOne(taskData);
  return { ...taskData, _id: result.insertedId };
}

/**
 * Save completed video to database
 * @param {Object} params - Video data parameters
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Saved video data
 */
async function saveVideoToDB({
  taskId,
  userId,
  chatId,
  userChatId,
  imageId,
  videoUrl,
  duration,
  prompt,
  fastify
}) {
  const db = fastify.mongo.db;
  const videosCollection = db.collection('videos');

  // Check multiple conditions to prevent duplicates
  const existingVideo = await videosCollection.findOne({
    $or: [
      { taskId: taskId },
      { 
        userId: new ObjectId(userId),
        imageId: new ObjectId(imageId),
        videoUrl: videoUrl
      }
    ]
  });
  
  console.log(`[saveVideoToDB] Checking for existing video with taskId ${taskId} or matching user/image/url`);
  if (existingVideo) {
    console.log(`[saveVideoToDB] Video already exists with ID ${existingVideo._id}, returning existing video`);
    return existingVideo;
  }

  const videoData = {
    taskId,
    userId: new ObjectId(userId),
    chatId: new ObjectId(chatId),
    userChatId,
    imageId: new ObjectId(imageId),
    videoUrl,
    duration,
    prompt,
    createdAt: new Date()
  };

  // Insert the video document first
  const result = await videosCollection.insertOne(videoData);
  console.log(`[saveVideoToDB] Video saved with ID: ${result.insertedId}`);

  // Check if message already exists in userChat to prevent duplicate messages
  const userDataCollection = db.collection('userChat');
  const userData = await userDataCollection.findOne({ 
    userId: new ObjectId(userId), 
    _id: new ObjectId(userChatId),
    $or: [
      { 'messages.videoId': result.insertedId },
      { 'messages.content': `[Video] ${result.insertedId}` }
    ]
  });

  if (userData) {
    console.log(`[saveVideoToDB] Video message already exists in userChat for videoId ${result.insertedId}`);
  } else {
    // Only add message if it doesn't exist
    const videoMessage = { 
      role: "assistant", 
      content: `[Video] ${result.insertedId}`, 
      hidden: true, 
      type: "video", 
      videoId: result.insertedId, 
      videoUrl, 
      duration, 
      prompt 
    };
    
    await userDataCollection.updateOne(
      { 
        userId: new ObjectId(userId), 
        _id: new ObjectId(userChatId) 
      },
      { 
        $push: { messages: videoMessage }, 
        $set: { updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) } 
      }
    );
    console.log(`[saveVideoToDB] Video message added to userChat for videoId ${result.insertedId}`);
  }

  // Update counts only if this is a new video
  const chatsCollection = db.collection('chats');
  await chatsCollection.updateOne(
    { _id: new ObjectId(chatId) },
    { $inc: { videoCount: 1 } }
  );

  const usersCollection = db.collection('users');
  await usersCollection.updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { videoCount: 1 } }
  );

  return { ...videoData, _id: result.insertedId };
}

/**
 * Set video task to background status for cron job processing
 * @param {string} taskId - Task ID
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Additional options for completion handling
 */
async function pollVideoTaskStatus(taskId, fastify, options = {}) {
  console.log(`[pollVideoTaskStatus] Setting task ${taskId} to background status for cron job processing`);
  console.log(`[pollVideoTaskStatus] Options:`, JSON.stringify(options, null, 2));
  
  const db = fastify.mongo.db;
  
  try {
    // Update task status to 'background' so the cron job will pick it up
    const updateResult = await db.collection('tasks').updateOne(
      { taskId },
      { 
        $set: { 
          status: 'background',
          updatedAt: new Date()
        } 
      }
    );
    
    console.log(`[pollVideoTaskStatus] Task ${taskId} set to background status. Update result:`, updateResult);
    
    if (updateResult.matchedCount === 0) {
      console.warn(`[pollVideoTaskStatus] No task found with taskId: ${taskId}`);
    } else {
      console.log(`[pollVideoTaskStatus] Task ${taskId} will be processed by cron job processBackgroundVideoTasks`);
    }
    
  } catch (error) {
    console.error(`[pollVideoTaskStatus] Error setting task ${taskId} to background:`, error);
    
    // Mark task as failed if we can't set it to background
    await db.collection('tasks').updateOne(
      { taskId },
      { 
        $set: { 
          status: 'failed', 
          result: { error: 'Failed to set task to background' },
          updatedAt: new Date() 
        } 
      }
    );
    
    // Notify user of error via WebSocket
    if (options.userId) {
      console.log(`[pollVideoTaskStatus] Notifying user ${options.userId} of background setup failure`);
      fastify.sendNotificationToUser(options.userId, 'handleVideoLoader', { 
        videoId: options.placeholderId, 
        action: 'remove' 
      });
      const img2videoTranslations = fastify.getImg2videoTranslations(fastify.request?.lang || 'en');
      fastify.sendNotificationToUser(options.userId, 'showNotification', {
        message: img2videoTranslations?.notifications?.generationFailed || 'Video generation failed to start',
        icon: 'error'
      });
    }
  }
}

/**
 * Handle video task completion
 * @param {Object} taskStatus - Task status result
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Additional options
 */
async function handleVideoTaskCompletion(taskStatus, fastify, options = {}) {
  const { userId, chatId, userChatId, placeholderId, imageId, prompt } = options;
  
  console.log(`[handleVideoTaskCompletion] Starting completion handler for task ${taskStatus.taskId} and placeholderId ${placeholderId}`);
  console.log(`[handleVideoTaskCompletion] Options:`, JSON.stringify(options, null, 2));
  console.log(`[handleVideoTaskCompletion] Task status:`, JSON.stringify(taskStatus, null, 2));

  if (typeof fastify.sendNotificationToUser !== 'function') {
    console.error('[handleVideoTaskCompletion] fastify.sendNotificationToUser is not a function');
  }
  
  if (taskStatus.result && taskStatus.result.videoUrl) {
    console.log(`[handleVideoTaskCompletion] Video URL found, saving to database for task ${taskStatus.taskId || placeholderId}`);
    
    try {
        const db = fastify.mongo.db;
        // Check if already processed to prevent duplicate notifications
        const existingTask = await db.collection('tasks').findOne({ 
            $or: [
                { taskId: taskStatus.taskId, status: 'completed' },
                { placeholderId: placeholderId, status: 'completed' }
            ]
        });
        
        if (existingTask) {
            console.log(`Task ${taskStatus.taskId || placeholderId} already completed, skipping duplicate processing`);
            return;
        }

      // Save video to database
      const savedVideo = await saveVideoToDB({
        taskId: taskStatus.taskId || placeholderId,
        userId,
        chatId,
        userChatId,
        imageId,
        videoUrl: taskStatus.result.videoUrl,
        duration: taskStatus.result.duration,
        prompt,
        fastify
      });

      console.log(`[handleVideoTaskCompletion] Video saved to database with ID: ${savedVideo._id}`);

      // Update task as completed in database using both taskId and placeholderId
      const taskUpdateResult = await db.collection('tasks').updateOne(
        { 
          $or: [
            { taskId: taskStatus.taskId },
            { placeholderId: placeholderId }
          ]
        },
        { 
          $set: { 
            status: 'completed', 
            result: { 
              videoUrl: taskStatus.result.videoUrl, 
              videoId: savedVideo._id,
              duration: taskStatus.result.duration
            },
            updatedAt: new Date() 
          } 
        }
      );

      console.log(`[handleVideoTaskCompletion] Task updated in database. Update result:`, taskUpdateResult);

      // Remove loader via WebSocket using placeholderId
      console.log(`[handleVideoTaskCompletion] Sending handleVideoLoader notification to user ${userId}`);
      fastify.sendNotificationToUser(userId, 'handleVideoLoader', { 
        placeholderId: placeholderId, 
        action: 'remove' 
      });

      // Notify user of successful video generation via WebSocket
      console.log(`[handleVideoTaskCompletion] Sending videoGenerated notification to user ${userId}`);
      const videoNotificationData = {
        videoId: savedVideo._id,
        videoUrl: taskStatus.result.videoUrl,
        duration: taskStatus.result.duration,
        userChatId,
        placeholderId,
        taskId: taskStatus.taskId
      };
      console.log(`[handleVideoTaskCompletion] Video notification data:`, JSON.stringify(videoNotificationData, null, 2));
      
      fastify.sendNotificationToUser(userId, 'videoGenerated', videoNotificationData);

      console.log(`[handleVideoTaskCompletion] Video completion handling finished successfully for task ${taskStatus.taskId}`);

    } catch (error) {
      console.error(`[handleVideoTaskCompletion] Error saving video for task ${taskStatus.taskId}:`, error);
      
      // Remove loader and show error
      console.log(`[handleVideoTaskCompletion] Sending error notifications to user ${userId}`);
      fastify.sendNotificationToUser(userId, 'handleVideoLoader', { 
        placeholderId: placeholderId, 
        action: 'remove' 
      });
      const img2videoTranslations = fastify.getImg2videoTranslations(fastify.request?.lang || 'en');
      fastify.sendNotificationToUser(userId, 'showNotification', {
        message: img2videoTranslations?.notifications?.videoSaveFailed || 'Video generated but failed to save',
        icon: 'error'
      });
    }
  } else {
    console.log('[handleVideoTaskCompletion] No video URL in task result:', taskStatus);
    
    // Remove loader and show error
    console.log(`[handleVideoTaskCompletion] Sending no-video-URL error notifications to user ${userId}`);
    fastify.sendNotificationToUser(userId, 'handleVideoLoader', { 
      placeholderId: placeholderId, 
      action: 'remove' 
    });
    const img2videoTranslations = fastify.getImg2videoTranslations(fastify.request?.lang || 'en');
    fastify.sendNotificationToUser(userId, 'showNotification', {
      message: img2videoTranslations?.notifications?.noVideoUrl || 'Video generation completed but no video URL received',
      icon: 'error'
    });
  }
}

/**
 * Resume polling for incomplete video tasks on server startup
 * @param {Object} fastify - Fastify instance
 */
async function resumeIncompleteVideoTasks(fastify) {
  console.log('[resumeIncompleteVideoTasks] Starting resume process for incomplete video tasks');
  
  try {
    const db = fastify.mongo.db;
    const incompleteTasks = await db.collection('tasks').find({
      type: 'img2video',
      status: { $in: ['pending', 'processing'] }
    }).toArray();

    console.log(`[resumeIncompleteVideoTasks] Found ${incompleteTasks.length} incomplete video tasks to resume`);

    if (incompleteTasks.length === 0) {
      console.log('[resumeIncompleteVideoTasks] No incomplete tasks found');
      return 0;
    }

    for (const task of incompleteTasks) {
      console.log(`[resumeIncompleteVideoTasks] Setting task ${task.taskId} to background status`);
      
      // Set tasks to background status so cron job will pick them up
      await db.collection('tasks').updateOne(
        { _id: task._id },
        { 
          $set: { 
            status: 'background',
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`[resumeIncompleteVideoTasks] Task ${task.taskId} set to background for cron processing (user: ${task.userId})`);
    }

    console.log(`[resumeIncompleteVideoTasks] Successfully set ${incompleteTasks.length} tasks to background status`);
    return incompleteTasks.length;
    
  } catch (error) {
    console.error('[resumeIncompleteVideoTasks] Error resuming incomplete video tasks:', error);
    return 0;
  }
}

module.exports = {
  generateVideoFromImage,
  checkVideoTaskStatus,
  saveVideoTask,
  saveVideoToDB,
  pollVideoTaskStatus,
  handleVideoTaskCompletion,
  resumeIncompleteVideoTasks
};
