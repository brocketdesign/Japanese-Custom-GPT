/**
 * Task Recovery Utilities
 * Handles recovery of unfinished image and video generation tasks on server restart
 */

const { ObjectId } = require('mongodb');
const { checkTaskStatus } = require('./imagen');
const { checkVideoTaskStatus, handleVideoTaskCompletion } = require('./img2video-utils');

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
      console.log(`🔄 [TASK RECOVERY] ✅ Video task ${taskId} completed, processing with handleVideoTaskCompletion...`);
      
      // Use handleVideoTaskCompletion to process the video properly
      // This handles saving to DB, updating chat messages, and sending notifications
      const taskStatus = {
        taskId: taskId,
        status: 'completed',
        result: result.result
      };
      
      const options = {
        userId: task.userId,
        chatId: task.chatId,
        userChatId: task.userChatId,
        placeholderId: task.placeholderId,
        imageId: task.imageId,
        prompt: task.prompt,
        nsfw: task.nsfw
      };
      
      await handleVideoTaskCompletion(taskStatus, fastify, options);
      
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

module.exports = {
  recoverUnfinishedTasks,
  recoverImageTask,
  recoverVideoTask
};
