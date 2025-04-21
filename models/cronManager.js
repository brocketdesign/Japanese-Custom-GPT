/**
 * Cron Job Manager utility for handling system cron jobs
 */
const cron = require('node-cron');
const { fetchRandomCivitaiPrompt, createModelChat } = require('./civitai');
const parser = require('cron-parser');
const { pollTaskStatus } = require('./imagen');
const { handleTaskCompletion } = require('./imagen'); // <-- import the handler
const { ObjectId } = require('mongodb'); // <-- Add ObjectId

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
      console.log(`Cron job '${jobName}' configured with schedule: ${schedule}`);
      return true;
    } catch (error) {
      console.error(`Error configuring cron job '${jobName}':`, error);
      return false;
    }
  }
  
  return false; 
};

/**
 * Create a model chat generation task
 * 
 * @param {Object} fastify - Fastify instance
 * @returns {Function} The task function to execute
 */
const createModelChatGenerationTask = (fastify) => {
  return async () => {
    console.log('Running scheduled model chat generation task...');
    const db = fastify.mongo.db;
    
    try {
      // Check if the database is accessible
      await db.command({ ping: 1 });
      
      // Get current settings
      const settingsCollection = db.collection('systemSettings');
      const modelChatCronSettings = await settingsCollection.findOne({ type: 'modelChatCron' });
      
      if (!modelChatCronSettings || !modelChatCronSettings.enabled) {
        console.log('Model chat generation is disabled. Skipping task.');
        return;
      }
      
      // Get all available models
      const modelsCollection = db.collection('myModels');
      const models = await modelsCollection.find({}).toArray();
      
      console.log(`Found ${models.length} models to generate chats for`);
      
      // Find an admin user to use for image generation
      const usersCollection = db.collection('users');
      const adminUser = await usersCollection.findOne({ role: 'admin' });
      
      if (!adminUser) {
        console.log('No admin user found for automated chat generation');
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
          // Get prompt from Civitai
          const prompt = await fetchRandomCivitaiPrompt(model.model, modelChatCronSettings.nsfw);
          
          if (!prompt) {
            console.log(`No suitable prompt found for model ${model.model}. Skipping.`);
            continue;
          }
          
          // Create a new chat - Pass admin user for image generation
          await createModelChat(db, model, prompt, 'en', fastify, adminUser, modelChatCronSettings.nsfw);
          
          // Wait a bit between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 5000));
        } catch (modelError) {
          console.error(`Error processing model ${model.model}:`, modelError);
          // Continue with next model
        }
      }
      
      console.log('Scheduled chat generation completed');
    } catch (err) {
      console.error('Failed to execute scheduled chat generation:', err);
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
  console.log(`[CRON] Found ${backgroundTasks.length} background tasks to process...`);
  if (!backgroundTasks.length) return;
  console.log(`[CRON] Processing ${backgroundTasks.length} background tasks...`);
  for (const task of backgroundTasks) {
    try {
      // Try to poll the task status again (reuse pollTaskStatus from imagen.js)
      const taskStatus = await pollTaskStatus(task.taskId, fastify);
      if (taskStatus && taskStatus.status === 'background') {
        console.log(`[CRON] Task ${task.taskId} still in background, skipping...`);
        continue;
      }
      // If successful, pollTaskStatus will update the task and notify the user
      // If completed, handle notifications and image saving
      if (taskStatus && taskStatus.status === 'completed') {
        const userDoc = await db.collection('users').findOne({ _id: task.userId });
        const chatDoc = await db.collection('chats').findOne({ _id: task.chatId });
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
      // If still not complete, leave as background for next run
      console.log(`[CRON] Task ${task.taskId}:`, err?.message || err);
    }
  }
};

/**
 * Cache popular chats task
 * Fetches top popular chats and stores them in a cache collection, including up to 5 non-NSFW sample images per chat.
 * @param {Object} fastify - Fastify instance
 */
const cachePopularChatsTask = (fastify) => async () => {
  console.log('[CRON] Starting popular chats caching task...');
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
      console.log(`[CRON] Successfully cached ${chatsWithSamples.length} popular chats with non-NSFW sample images.`);
    } else {
      console.log('[CRON] No popular chats found to cache.');
    }

  } catch (err) {
    console.error('[CRON] Error caching popular chats:', err);
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
      console.log('Created default model chat cron settings');
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

    // Add popular chats caching task (daily at 1 AM)
    configureCronJob(
        'popularChatsCacher',
        '0 1 * * *', // Runs every day at 1:00 AM
        true, // Enable this job
        cachePopularChatsTask(fastify)
    );
    
    console.log('Cron jobs initialized');
    
  } catch (error) {
    console.error('Error initializing cron jobs:', error);
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
    console.error(`Error getting next run time for job '${jobName}':`, error);
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
  cachePopularChatsTask,
  getJobInfo,
  getNextRunTime
};
