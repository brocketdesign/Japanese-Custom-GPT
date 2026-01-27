/**
 * Task Recovery Utilities
 * Handles recovery of unfinished image and video generation tasks on server restart
 */

const { ObjectId } = require('mongodb');
const { checkTaskStatus } = require('./imagen');
const { checkVideoTaskStatus } = require('./img2video-utils');

/**
 * Recover unfinished image and video generation tasks
 * Checks for tasks with 'pending' or 'processing' status and attempts to complete them
 * 
 * @param {Object} fastify - Fastify instance with MongoDB connection
 * @returns {Object} Recovery statistics
 */
async function recoverUnfinishedTasks(fastify) {
  const db = fastify.mongo.db;
  const tasksCollection = db.collection('tasks');
  
  console.log('\n🔄 [TASK RECOVERY] Starting recovery of unfinished tasks...');
  
  const stats = {
    totalFound: 0,
    imagesRecovered: 0,
    videosRecovered: 0,
    failed: 0,
    stillPending: 0
  };
  
  try {
    // Find all tasks that are not completed or failed
    // Include tasks created within the last 24 hours to avoid processing very old tasks
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const unfinishedTasks = await tasksCollection.find({
      status: { $in: ['pending', 'processing'] },
      createdAt: { $gte: oneDayAgo }
    }).toArray();
    
    stats.totalFound = unfinishedTasks.length;
    
    if (stats.totalFound === 0) {
      console.log('🔄 [TASK RECOVERY] ✅ No unfinished tasks found');
      return stats;
    }
    
    console.log(`🔄 [TASK RECOVERY] Found ${stats.totalFound} unfinished task(s)`);
    
    // Process each task
    for (const task of unfinishedTasks) {
      try {
        const taskType = task.task_type || task.type;
        const taskId = task.taskId;
        
        console.log(`🔄 [TASK RECOVERY] Processing ${taskType} task: ${taskId}`);
        
        // Determine if it's an image or video task
        const videoTaskTypes = ['img2video', 'IMG_TO_VIDEO', 'WAN_2_2_I2V', 'WAN_2_5_I2V_PREVIEW', 
                               'MINIMAX_VIDEO_01', 'WAN_2_2_T2V', 'WAN_2_5_T2V_PREVIEW', 'HUNYUAN_VIDEO_FAST'];
        const isVideoTask = videoTaskTypes.includes(taskType) || taskId.startsWith('img2video-');
        
        if (isVideoTask) {
          // Process video task
          await recoverVideoTask(task, fastify);
          stats.videosRecovered++;
        } else {
          // Process image task
          await recoverImageTask(task, fastify);
          stats.imagesRecovered++;
        }
        
      } catch (taskError) {
        console.error(`🔄 [TASK RECOVERY] ❌ Error recovering task ${task.taskId}:`, taskError.message);
        stats.failed++;
      }
    }
    
    console.log('🔄 [TASK RECOVERY] ✅ Recovery completed');
    console.log(`🔄 [TASK RECOVERY] 📊 Statistics:`, stats);
    
    return stats;
    
  } catch (error) {
    console.error('🔄 [TASK RECOVERY] ❌ Error during task recovery:', error);
    throw error;
  }
}

/**
 * Recover an unfinished image generation task
 * 
 * @param {Object} task - Task document from database
 * @param {Object} fastify - Fastify instance
 */
async function recoverImageTask(task, fastify) {
  const taskId = task.taskId;
  
  try {
    console.log(`🔄 [TASK RECOVERY] 🖼️  Checking image task ${taskId}...`);
    
    // Use existing checkTaskStatus function which handles:
    // - Polling Novita API for task status
    // - Downloading images from Novita
    // - Uploading to S3
    // - Face merging if enabled
    // - Saving to database
    // - Sending notifications
    const result = await checkTaskStatus(taskId, fastify);
    
    if (result && result.status === 'completed') {
      console.log(`🔄 [TASK RECOVERY] ✅ Image task ${taskId} recovered successfully`);
    } else if (result && result.status === 'processing') {
      console.log(`🔄 [TASK RECOVERY] ⏳ Image task ${taskId} still processing`);
    } else if (result && result.status === 'failed') {
      console.log(`🔄 [TASK RECOVERY] ❌ Image task ${taskId} failed`);
    } else {
      console.log(`🔄 [TASK RECOVERY] ⚠️  Image task ${taskId} status unknown`);
    }
    
  } catch (error) {
    console.error(`🔄 [TASK RECOVERY] ❌ Error recovering image task ${taskId}:`, error.message);
    throw error;
  }
}

/**
 * Recover an unfinished video generation task
 * 
 * @param {Object} task - Task document from database
 * @param {Object} fastify - Fastify instance
 */
async function recoverVideoTask(task, fastify) {
  const taskId = task.taskId;
  const db = fastify.mongo.db;
  const tasksCollection = db.collection('tasks');
  
  try {
    console.log(`🔄 [TASK RECOVERY] 🎬 Checking video task ${taskId}...`);
    
    // Use existing checkVideoTaskStatus function which handles:
    // - Polling Novita API for task status
    // - Downloading video from Novita
    // - Uploading to S3
    const result = await checkVideoTaskStatus(taskId);
    
    if (result && result.status === 'completed') {
      console.log(`🔄 [TASK RECOVERY] ✅ Video task ${taskId} completed, updating database...`);
      
      // Update task in database
      await tasksCollection.updateOne(
        { taskId: taskId },
        { 
          $set: { 
            status: 'completed',
            result: result.result,
            updatedAt: new Date()
          } 
        }
      );
      
      // If video was generated in a chat context, update the chat messages
      if (task.userChatId && task.placeholderId) {
        await updateVideoInChat(task, result.result, fastify);
      }
      
    } else if (result && result.status === 'processing') {
      console.log(`🔄 [TASK RECOVERY] ⏳ Video task ${taskId} still processing`);
    } else if (result && result.status === 'failed') {
      console.log(`🔄 [TASK RECOVERY] ❌ Video task ${taskId} failed`);
      
      // Update task status to failed
      await tasksCollection.updateOne(
        { taskId: taskId },
        { 
          $set: { 
            status: 'failed',
            result: result.result || { error: 'Task failed' },
            updatedAt: new Date()
          } 
        }
      );
    } else {
      console.log(`🔄 [TASK RECOVERY] ⚠️  Video task ${taskId} status unknown`);
    }
    
  } catch (error) {
    console.error(`🔄 [TASK RECOVERY] ❌ Error recovering video task ${taskId}:`, error.message);
    throw error;
  }
}

/**
 * Update video in chat messages after recovery
 * 
 * @param {Object} task - Task document from database
 * @param {Object} result - Video generation result with videoUrl
 * @param {Object} fastify - Fastify instance
 */
async function updateVideoInChat(task, result, fastify) {
  const db = fastify.mongo.db;
  const userChatsCollection = db.collection('userChats');
  
  try {
    const userChat = await userChatsCollection.findOne({ 
      _id: task.userChatId 
    });
    
    if (!userChat || !userChat.messages) {
      console.log(`🔄 [TASK RECOVERY] ⚠️  User chat not found for video task ${task.taskId}`);
      return;
    }
    
    // Find the message with the placeholder
    const messageIndex = userChat.messages.findIndex(msg => 
      msg.placeholderId === task.placeholderId
    );
    
    if (messageIndex === -1) {
      console.log(`🔄 [TASK RECOVERY] ⚠️  Message with placeholder ${task.placeholderId} not found`);
      return;
    }
    
    // Update the message with the video URL
    const updateResult = await userChatsCollection.updateOne(
      { _id: task.userChatId },
      { 
        $set: { 
          [`messages.${messageIndex}.videoUrl`]: result.videoUrl,
          [`messages.${messageIndex}.status`]: 'completed',
          [`messages.${messageIndex}.duration`]: result.duration || null
        } 
      }
    );
    
    if (updateResult.modifiedCount > 0) {
      console.log(`🔄 [TASK RECOVERY] ✅ Updated video in chat for task ${task.taskId}`);
      
      // Send WebSocket notification to user if they're connected
      if (fastify.websocketClients && task.userId) {
        const userIdStr = task.userId.toString();
        const client = fastify.websocketClients.get(userIdStr);
        
        if (client && client.readyState === 1) { // 1 = OPEN
          client.send(JSON.stringify({
            type: 'videoGenerated',
            userChatId: task.userChatId.toString(),
            placeholderId: task.placeholderId,
            videoUrl: result.videoUrl,
            duration: result.duration || null
          }));
          
          console.log(`🔄 [TASK RECOVERY] 📡 Sent WebSocket notification to user ${userIdStr}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`🔄 [TASK RECOVERY] ❌ Error updating video in chat:`, error.message);
  }
}

module.exports = {
  recoverUnfinishedTasks,
  recoverImageTask,
  recoverVideoTask
};
