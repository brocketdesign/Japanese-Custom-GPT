/**
 * Cron Job Manager utility for handling system cron jobs
 */
const cron = require('node-cron');
const { fetchRandomCivitaiPrompt, createModelChat } = require('./civitai-utils');
const parser = require('cron-parser');
const { pollTaskStatus } = require('./imagen');
const { handleTaskCompletion, checkTaskStatus } = require('./imagen'); // <-- import the handler
const { ObjectId } = require('mongodb');
const fs = require('fs');
const { cacheSitemapData } = require('./sitemap-utils'); // <-- import sitemap utils
// Store active cron jobs
const cronJobs = {};

/**
 * Configure a cron job
 * 
 * @param {string} jobName - Unique name for the job
 * @param {string} schedule - Cron schedule expression
 * @param {boolean} enabled - Whether the job should be enabled
 * @param {Function} task - The task function to execute
 * @returns {boolean} - Whether the job was successfully configured
 */
const configureCronJob = (jobName, schedule, enabled, task) => {
  // Stop existing job if it exists
  if (cronJobs[jobName]) {
    // Access the actual cron job object's stop method
    if (cronJobs[jobName].job) {
      cronJobs[jobName].job.stop();
    }
    delete cronJobs[jobName];
  }
  
  // Create new job if enabled
  if (enabled && schedule && task) {
    try {
      // Validate the schedule
      parser.parseExpression(schedule);
      
      const job = cron.schedule(schedule, task, { scheduled: true });
      cronJobs[jobName] = {
        job,
        schedule,
        enabled: true
      };
      console.log(`[configureCronJob]'${jobName}' configured with schedule: ${schedule}`);
      return true;
    } catch (error) {
      console.error(`[configureCronJob] Error configuring cron job '${jobName}':`, error);
      return false;
    }
  }
  
  return false; 
};

/**
 * Clean up expired audio files that weren't deleted by the setTimeout
 * @param {Object} fastify - Fastify instance
 */
const cleanupExpiredAudioFiles = (fastify) => async () => {
  console.log('[cleanupExpiredAudioFiles] Checking for expired audio files...');
  const db = fastify.mongo.db;
  const cleanupCollection = db.collection('audioFileCleanup');
  
  try {
    // Find all expired files
    const expiredFiles = await cleanupCollection.find({
      expiresAt: { $lt: new Date() }
    }).toArray();
    
    console.log(`[cleanupExpiredAudioFiles] Found ${expiredFiles.length} expired audio files`);
    
    // Delete each expired file
    for (const fileRecord of expiredFiles) {
      try {
        const filePath = fileRecord.filePath;
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`[cleanupExpiredAudioFiles] Deleted expired file: ${fileRecord.filename}`);
        }
        
        // Remove from the tracking collection
        await cleanupCollection.deleteOne({ _id: fileRecord._id });
      } catch (err) {
        console.error(`[cleanupExpiredAudioFiles] Error deleting file ${fileRecord.filename}:`, err);
        // If the file doesn't exist, still remove from tracking
        if (err.code === 'ENOENT') {
          await cleanupCollection.deleteOne({ _id: fileRecord._id });
        }
      }
    }
  } catch (err) {
    console.error('[cleanupExpiredAudioFiles] Error cleaning up expired audio files:', err);
  }
};

/**
 * Create a model chat generation task
 * 
 * @param {Object} fastify - Fastify instance
 * @returns {Function} The task function to execute
 */
const createModelChatGenerationTask = (fastify) => {
  return async () => {
    console.log('[createModelChatGenerationTask] Running scheduled model chat generation task...');
    const db = fastify.mongo.db;
    
    try {
      // Check if the database is accessible
      await db.command({ ping: 1 });
      
      // Get current settings
      const settingsCollection = db.collection('systemSettings');
      const modelChatCronSettings = await settingsCollection.findOne({ type: 'modelChatCron' });
      
      if (!modelChatCronSettings || !modelChatCronSettings.enabled) {
        console.log('[createModelChatGenerationTask] Model chat generation is disabled. Skipping task.');
        return;
      }
      
      // Get all available models
      const modelsCollection = db.collection('myModels');
      const models = await modelsCollection.find({}).toArray();
      
      console.log(`[createModelChatGenerationTask] Found ${models.length} models to generate chats for`);
      
      // Find an admin user to use for image generation
      const usersCollection = db.collection('users');
      const adminUser = await usersCollection.findOne({ role: 'admin' });
      
      if (!adminUser) {
        console.log('[createModelChatGenerationTask] No admin user found for automated chat generation');
        return;
      }
      
      // Update last run time
      await settingsCollection.updateOne(
        { type: 'modelChatCron' },
        { $set: { lastRun: new Date() } }
      );
      
      // Create chat for each model
      for (const model of models) {
        try {
          console.log(`[createModelChatGenerationTask] Processing model: ${model.model}`);
          
          // Get prompt from Civitai with strict exclusion of used/skipped prompts and forbidden words filtering
          const prompt = await fetchRandomCivitaiPrompt(
            model, 
            modelChatCronSettings.nsfw, 
            1, // Start from page 1
            0, // Start from index 0
            true, // excludeUsed = true (critical for cron jobs - strictly exclude used/skipped prompts)
            db
          );
          
          if (!prompt) {
            console.log(`[createModelChatGenerationTask] No suitable prompt found for model ${model.model} after exhaustive search. All prompts may have been used or contain forbidden words. Skipping.`);
            continue;
          }
          
          // Create a new chat - Pass admin user for image generation
          const createdChat = await createModelChat(db, model, prompt, 'en', fastify, adminUser, modelChatCronSettings.nsfw);
          
          if (createdChat) {
            console.log(`[createModelChatGenerationTask] Successfully created chat for model ${model.model}: ${createdChat._id}`);
          } else {
            console.log(`[createModelChatGenerationTask] Failed to create chat for model ${model.model}`);
          }
          
          // Wait a bit between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (modelError) {
          console.error(`[createModelChatGenerationTask] Error processing model ${model.model}:`, modelError);
          // Continue with next model
        }
      }
      
      console.log('[createModelChatGenerationTask] Scheduled chat generation completed');
    } catch (err) {
      console.error('[createModelChatGenerationTask] Failed to execute scheduled chat generation:', err);
    }
  };
};

/**
 * Process background image generation tasks every minute
 * @param {Object} fastify - Fastify instance
 */
const processBackgroundTasks = (fastify) => async () => {
  const db = fastify.mongo.db;
  const tasksCollection = db.collection('tasks');
  const backgroundTasks = await tasksCollection.find({ status: 'background' }).toArray();
  if (!backgroundTasks.length) return;
  console.log(`[processBackgroundTasks] Processing ${backgroundTasks.length} background tasks...`);
  for (const task of backgroundTasks) {
    try {
      // Try to poll the task status again (reuse pollTaskStatus from imagen.js)
      const taskStatus = await checkTaskStatus(task.taskId, fastify);

      if (taskStatus && taskStatus.status === 'background') {
        console.log(`[processBackgroundTasks] Task ${task.taskId} still in background, skipping...`);
        continue;
      }
      // If successful, pollTaskStatus will update the task and notify the user
      // If completed, handle notifications and image saving
      if (taskStatus && taskStatus.status === 'completed') {
        const userDoc = await db.collection('users').findOne({ _id: task.userId });
        const translations = fastify.getTranslations(userDoc.language || 'en');
        
        await handleTaskCompletion(
          { ...taskStatus, userId: task.userId, userChatId: task.userChatId },
          fastify,
          {
            chatCreation: task.chatCreation, // <-- use the value from the task document
            translations,
            userId: task.userId.toString(),
            chatId: task.chatId.toString(),
            placeholderId: task.placeholderId // <-- pass the correct placeholderId
          }
        );
      }
    } catch (err) {
      console.log(`[processBackgroundTasks] Task ${task.taskId}:`, err?.message || err);
    }
  }
};

/**
 * Process background video generation tasks
 * @param {Object} fastify - Fastify instance
 */
const processBackgroundVideoTasks = (fastify) => async () => {
  const db = fastify.mongo.db;

    // Add this check at the beginning
    if (!fastify.sendNotificationToUser) {
      console.warn('[processBackgroundVideoTasks] sendNotificationToUser method not available');
    }

  try {
    // Find incomplete video tasks
    const backgroundVideoTasks = await db.collection('tasks').find({ 
      type: 'img2video',
      status: { $in: ['pending', 'processing', 'background'] }
    }).toArray();
    
    
    if (!backgroundVideoTasks.length) {
      return;
    }
    
    const { checkVideoTaskStatus, handleVideoTaskCompletion } = require('./img2video-utils');
    
    for (const task of backgroundVideoTasks) {
      console.log(`[processBackgroundVideoTasks] Processing task ${task.taskId} (status: ${task.status})`);
      console.log(`[processBackgroundVideoTasks] Task details:`, {
        taskId: task.taskId,
        userId: task.userId,
        chatId: task.chatId,
        placeholderId: task.placeholderId,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      });
      
      try {
        console.log(`[processBackgroundVideoTasks] Checking status for video task ${task.taskId}`);
        
        // Check the current status of the video generation
        const taskStatus = await checkVideoTaskStatus(task.taskId);
        
        console.log(`[processBackgroundVideoTasks] Task ${task.taskId} status check result:`, JSON.stringify(taskStatus, null, 2));
        
        if (!taskStatus) {
          console.error(`[processBackgroundVideoTasks] No status returned for task ${task.taskId}`);
          await db.collection('tasks').updateOne(
            { _id: task._id },
            { 
              $set: { 
                status: 'failed', 
                result: { error: 'No status returned from API' },
                updatedAt: new Date() 
              } 
            }
          );
          continue;
        }
        
        if (taskStatus.status === 'processing' || taskStatus.status === 'pending') {
          console.log(`[processBackgroundVideoTasks] Task ${task.taskId} still processing (${taskStatus.status}), will check again next cycle`);
          
          // Update task status and progress if changed
          await db.collection('tasks').updateOne(
            { _id: task._id },
            { 
              $set: { 
                status: taskStatus.status,
                progress: taskStatus.progress || 0,
                updatedAt: new Date() 
              } 
            }
          );
          continue;
        }
        
        if (taskStatus.status === 'failed') {
          console.error(`[processBackgroundVideoTasks] Task ${task.taskId} failed:`, taskStatus.error);
          
          // Update task as failed
          await db.collection('tasks').updateOne(
            { _id: task._id },
            { 
              $set: { 
                status: 'failed', 
                result: { error: taskStatus.error },
                updatedAt: new Date() 
              } 
            }
          );
          
          // Notify user of failure
          if (task.userId && fastify.sendNotificationToUser) {
            console.log(`[processBackgroundVideoTasks] Notifying user ${task.userId} of task failure`);
            fastify.sendNotificationToUser(task.userId.toString(), 'handleVideoLoader', { 
              videoId: task.placeholderId, 
              action: 'remove' 
            });
            fastify.sendNotificationToUser(task.userId.toString(), 'showNotification', {
              message: 'Video generation failed',
              icon: 'error'
            });
          }
          continue;
        }
        
        if (taskStatus.status === 'completed') {
          console.log(`[processBackgroundVideoTasks] Task ${task.taskId} completed successfully!`);
          
          // Handle task completion with all necessary data
          await handleVideoTaskCompletion(
            { ...taskStatus, taskId: task.taskId },
            fastify,
            {
              userId: task.userId.toString(),
              chatId: task.chatId.toString(),
              userChatId: task.userChatId,
              placeholderId: task.placeholderId,
              imageId: task.imageId.toString(),
              prompt: task.prompt
            }
          );
          
          console.log(`[processBackgroundVideoTasks] Task ${task.taskId} completion handling finished`);
          continue;
        }
        
        console.log(`[processBackgroundVideoTasks] Task ${task.taskId} has unknown status: ${taskStatus.status}`);
        
      } catch (err) {
        console.error(`[processBackgroundVideoTasks] Error processing video task ${task.taskId}:`, err);
        
        // Mark task as failed if we can't process it
        try {
          await db.collection('tasks').updateOne(
            { _id: task._id },
            { 
              $set: { 
                status: 'failed', 
                result: { error: err.message || 'Processing error' },
                updatedAt: new Date() 
              } 
            }
          );
          
          // Notify user of error
          if (task.userId && fastify.sendNotificationToUser) {
            console.log(`[processBackgroundVideoTasks] Notifying user ${task.userId} of processing error`);
            fastify.sendNotificationToUser(task.userId.toString(), 'handleVideoLoader', { 
              videoId: task.placeholderId, 
              action: 'remove' 
            });
            fastify.sendNotificationToUser(task.userId.toString(), 'showNotification', {
              message: 'Video generation encountered an error',
              icon: 'error'
            });
          }
        } catch (updateErr) {
          console.error(`[processBackgroundVideoTasks] Failed to update task ${task.taskId} as failed:`, updateErr);
        }
      }
    }
    
    console.log('[processBackgroundVideoTasks] Background video task processing completed');
  } catch (err) {
    console.error('[processBackgroundVideoTasks] Error processing background video tasks:', err);
  }
};

/**
 * Cache popular chats task
 * Fetches top popular chats and stores them in a cache collection, including up to 5 non-NSFW sample images per chat.
 * @param {Object} fastify - Fastify instance
 */
const cachePopularChatsTask = (fastify) => async () => {
  console.log('[cachePopularChatsTask] Starting popular chats caching task...');
  const db = fastify.mongo.db;
  const chatsCollection = db.collection('chats');
  const cacheCollection = db.collection('popularChatsCache');
  const usersCollection = db.collection('users');
  const galleryCollection = db.collection('gallery');

  const pagesToCache = 5;
  const limitPerPage = 50;
  const totalToCache = pagesToCache * limitPerPage;

  try {
    const pipeline = [
      { $match: { chatImageUrl: { $exists: true, $ne: '' }, name: { $exists: true, $ne: '' } } },
      {
        $lookup: {
          from: 'gallery',
          localField: '_id',
          foreignField: 'chatId',
          as: 'gallery'
        }
      },
      {
        $addFields: {
          imageCount: {
            $cond: [
              { $gt: [ { $size: '$gallery' }, 0 ] },
              { $size: { $ifNull: [ { $arrayElemAt: [ '$gallery.images', 0 ] }, [] ] } },
              0
            ]
          }
        }
      },
      { $sort: { imageCount: -1, _id: -1 } },
      { $limit: totalToCache },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $addFields: {
          userInfo: { $arrayElemAt: ['$userInfo', 0] }
        }
      },
      {
        $addFields: {
          nickname: '$userInfo.nickname',
          profileUrl: '$userInfo.profileUrl',
          premium: '$userInfo.subscriptionStatus',
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          chatImageUrl: 1,
          imageCount: 1,
          imageStyle: 1,
          userId: 1,
          nickname: 1,
          gender: 1,
          profileUrl: 1,
          tags: 1,
          chatTags: 1,
          messagesCount: 1,
          premium: { $cond: [ { $eq: ['$premium', 'active'] }, true, false ] },
          nsfw: 1,
          moderation: 1,
          language: 1
        }
      }
    ];

    const popularChats = await chatsCollection.aggregate(pipeline).toArray();

    if (popularChats.length > 0) {
      // For each chat, fetch up to 5 non-NSFW sample images from the gallery
      const chatsWithSamples = await Promise.all(popularChats.map(async (chat) => {
        const galleryDoc = await galleryCollection.findOne({ chatId: chat._id });
        let sampleImages = [];
        if (galleryDoc && Array.isArray(galleryDoc.images)) {
          // Filter out NSFW images (assuming each image has an 'nsfw' boolean property)
          sampleImages = galleryDoc.images.filter(img => !img.nsfw).slice(0, 5);
        }
        return {
          ...chat,
          sampleImages,
        };
      }));

      await cacheCollection.deleteMany({});
      const chatsToInsert = chatsWithSamples.map((chat, index) => ({
        ...chat,
        cacheRank: index,
        cachedAt: new Date()
      }));
      await cacheCollection.insertMany(chatsToInsert);
      console.log(`[cachePopularChatsTask] Successfully cached ${chatsWithSamples.length} popular chats with non-NSFW sample images.`);
    } else {
      console.log('[cachePopularChatsTask] No popular chats found to cache.');
    }

  } catch (err) {
    console.error('[cachePopularChatsTask] Error caching popular chats:', err);
  }
};

/**
 * Cache sitemap data task (characters and tags for SEO)
 * @param {Object} fastify - Fastify instance
 */
const cacheSitemapDataTask = (fastify) => async () => {
  console.log('[cacheSitemapDataTask] Starting sitemap data caching task...');
  const db = fastify.mongo.db;
  
  try {
    // Check if the database is accessible
    await db.command({ ping: 1 });
    
    await cacheSitemapData(db);
    console.log('[cacheSitemapDataTask] Sitemap data caching completed successfully');
  } catch (err) {
    console.error('[cacheSitemapDataTask] Error caching sitemap data:', err);
  }
};

/**
 * Initialize cron jobs from database settings
 * 
 * @param {Object} fastify - Fastify instance
 */
const initializeCronJobs = async (fastify) => {
  try {
    const db = fastify.mongo.db;
    const settingsCollection = db.collection('systemSettings');
    
    // Initialize model chat generation cron job
    let modelChatCronSettings = await settingsCollection.findOne({ type: 'modelChatCron' });
    
    if (!modelChatCronSettings) {
      // Create default settings if they don't exist
      modelChatCronSettings = {
        type: 'modelChatCron',
        schedule: '0 */2 * * *', // Every 2 hours
        enabled: false,
        nsfw: false,
        createdAt: new Date()
      };
      
      await settingsCollection.insertOne(modelChatCronSettings);
      console.log('[initializeCronJobs] Created default model chat cron settings');
    }
    
    // Configure the cron job if enabled
    const modelChatGenerationTask = createModelChatGenerationTask(fastify);
    
    configureCronJob(
      'modelChatGenerator', 
      modelChatCronSettings.schedule, 
      modelChatCronSettings.enabled,
      modelChatGenerationTask
    );

    // Add background task processor (every minute)
    configureCronJob(
      'backgroundTaskProcessor',
      '*/1 * * * *',
      true,
      processBackgroundTasks(fastify)
    );

    // Add video background task processor (every minute)
    configureCronJob(
      'videoBackgroundTaskProcessor',
      '*/1 * * * *',
      true,
      processBackgroundVideoTasks(fastify)
    );

    // Add popular chats caching task (daily at 1 AM)
    configureCronJob(
        'popularChatsCacher',
        '0 1 * * *', // Runs every day at 1:00 AM
        true, // Enable this job
        cachePopularChatsTask(fastify)
    );
    // Add audio files cleanup task (runs every 15 minutes)
    configureCronJob(
        'audioFilesCleanup',
        '*/15 * * * *', // Runs every 15 minutes
        true,
        cleanupExpiredAudioFiles(fastify)
    );
    
    // Add sitemap caching task (daily at 2 AM)
    configureCronJob(
        'sitemapDataCacher',
        '0 2 * * *', // Runs every day at 2:00 AM
        true, // Enable this job
        cacheSitemapDataTask(fastify)
    );
    
  } catch (error) {
    console.error('[initializeCronJobs] Error initializing cron jobs:', error);
  }
};

/**
 * Get the next run time for a job
 * 
 * @param {string} jobName - Name of the job
 * @returns {string|null} - Next run time as a string or null if job not found or disabled
 */
const getNextRunTime = (jobName) => {
  const cronInfo = cronJobs[jobName];
  if (!cronInfo || !cronInfo.enabled || !cronInfo.schedule) return null;
  
  try {
    const interval = parser.parseExpression(cronInfo.schedule);
    return interval.next().toDate().toLocaleString();
  } catch (error) {
    console.error(`[getNextRunTime] Error getting next run time for job '${jobName}':`, error);
    return null;
  }
};

/**
 * Get information about a job
 * 
 * @param {string} jobName - Name of the job
 * @returns {Object|null} - Information about the job or null if not found
 */
const getJobInfo = (jobName) => {
  const cronInfo = cronJobs[jobName];
  if (!cronInfo) return null;
  
  return {
    schedule: cronInfo.schedule,
    enabled: cronInfo.enabled,
    nextRun: getNextRunTime(jobName),
    isRunning: cronInfo.job ? cronInfo.job.running : false
  };
};

module.exports = {
  cronJobs,
  configureCronJob,
  initializeCronJobs,
  createModelChatGenerationTask,
  processBackgroundTasks,
  processBackgroundVideoTasks,
  cachePopularChatsTask,
  cacheSitemapDataTask,
  getJobInfo,
  getNextRunTime
};
