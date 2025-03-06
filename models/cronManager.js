/**
 * Cron Job Manager utility for handling system cron jobs
 */
const cron = require('node-cron');
const { fetchRandomCivitaiPrompt, createModelChat } = require('./civitai');
const parser = require('cron-parser');

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
  getJobInfo,
  getNextRunTime
};
