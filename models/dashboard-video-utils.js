/**
 * Dashboard Video Generation Utilities
 * Supports testing video generation models from Novita AI
 */

const axios = require('axios');
const { ObjectId } = require('mongodb');
const { createHash } = require('crypto');
const { uploadToS3 } = require('./tool');

/**
 * Get webhook URL for Novita tasks
 */
function getWebhookUrl() {
  if (process.env.NOVITA_WEBHOOK_URL) {
    return process.env.NOVITA_WEBHOOK_URL;
  }
  if (process.env.MODE === 'local') {
    if (process.env.LOCAL_WEBHOOK_URL) {
      return process.env.LOCAL_WEBHOOK_URL;
    }
    return 'http://localhost:3000/novita/webhook';
  } else {
    const baseDomain = process.env.PUBLIC_BASE_DOMAIN || 'chatlamix.com';
    return `https://app.${baseDomain}/novita/webhook`;
  }
}

// Video model configurations
const VIDEO_MODEL_CONFIGS = {
  'kling-v2.1-i2v': {
    name: 'Kling V2.1 (Image to Video)',
    endpoint: 'https://api.novita.ai/v3/async/kling-v2.1-i2v',
    async: true,
    defaultParams: {
      mode: 'Standard',
      duration: '5',
      guidance_scale: 0.5,
      negative_prompt: 'blurry, low quality, distorted'
    },
    supportedParams: ['image', 'prompt', 'mode', 'duration', 'guidance_scale', 'negative_prompt'],
    description: 'Kling V2.1 model for generating videos from images with natural motion'
  }
};

// Duration options for video generation
const DURATION_OPTIONS = [
  { value: '5', label: '5 seconds' },
  { value: '10', label: '10 seconds' }
];

// Aspect ratio options
const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' }
];

/**
 * Validate and truncate prompt to meet Novita API requirements
 */
function validateAndTruncatePrompt(prompt, defaultPrompt = 'Generate a dynamic video from this image') {
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    prompt = defaultPrompt;
  }
  
  prompt = prompt.trim();
  
  // Count runes (Unicode code points)
  const runeCount = Array.from(prompt).length;
  
  // If prompt is too long, truncate it to 2000 runes
  if (runeCount > 2000) {
    const runes = Array.from(prompt);
    prompt = runes.slice(0, 2000).join('').trim();
    console.warn(`[validateAndTruncatePrompt] Prompt truncated from ${runeCount} to ${Array.from(prompt).length} runes`);
  }
  
  if (Array.from(prompt).length < 1) {
    prompt = defaultPrompt;
  }
  
  return prompt;
}

/**
 * Initialize a video test for a specific model
 * @param {string} modelId - The model identifier
 * @param {Object} params - Generation parameters
 * @returns {Object} - Task info with taskId and startTime
 */
async function initializeVideoTest(modelId, params) {
  const config = VIDEO_MODEL_CONFIGS[modelId];
  if (!config) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const startTime = Date.now();
  console.log(`[VideoDashboard] 🚀 Starting ${config.name} generation`);
  console.log(`[VideoDashboard] Prompt: ${params.prompt?.substring(0, 100)}...`);

  try {
    const webhookUrl = config.async ? getWebhookUrl() : null;
    
    // Validate and truncate prompt
    const validatedPrompt = validateAndTruncatePrompt(params.prompt);
    
    const requestBody = {
      image: params.imageUrl,
      prompt: validatedPrompt,
      mode: params.mode || config.defaultParams.mode,
      duration: params.duration || config.defaultParams.duration,
      guidance_scale: params.guidance_scale !== undefined ? params.guidance_scale : config.defaultParams.guidance_scale,
      negative_prompt: params.negative_prompt || config.defaultParams.negative_prompt
    };
    
    // Add webhook for async models
    if (config.async && webhookUrl) {
      requestBody.extra = {
        webhook: {
          url: webhookUrl
        }
      };
    }

    console.log(`[VideoDashboard] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await axios.post(config.endpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutes timeout
    });

    console.log(`[VideoDashboard] Response status: ${response.status}`);

    if (response.status !== 200) {
      const errorMsg = response.data?.message || response.data?.error || `API returned status ${response.status}`;
      throw new Error(errorMsg);
    }

    // Async API returns task_id
    const taskId = response.data.task_id || response.data.data?.task_id || response.data.id;
    
    if (!taskId) {
      console.error(`[VideoDashboard] No task_id found in response:`, JSON.stringify(response.data, null, 2));
      throw new Error('No task_id returned from API. Response: ' + JSON.stringify(response.data));
    }
    
    console.log(`[VideoDashboard] ✅ Task created with ID: ${taskId}`);
    
    return {
      modelId,
      modelName: config.name,
      taskId,
      startTime,
      status: 'processing',
      async: true
    };
  } catch (error) {
    console.error(`[VideoDashboard] ❌ Error with ${config.name}:`, error.message);
    
    let errorMessage = error.message;
    
    if (error.response) {
      console.error(`[VideoDashboard] Response status:`, error.response.status);
      console.error(`[VideoDashboard] Response data:`, JSON.stringify(error.response.data, null, 2));
      
      const data = error.response.data;
      if (data?.message) {
        errorMessage = data.message;
      } else if (data?.error) {
        errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
    }
    
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.modelId = modelId;
    throw enhancedError;
  }
}

/**
 * Check the status of a video task
 * @param {string} taskId - The task ID to check
 * @returns {Object} - Task status and results
 */
async function checkVideoTaskResult(taskId) {
  try {
    const response = await axios.get(
      `https://api.novita.ai/v3/async/task-result?task_id=${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`
        },
        timeout: 10000
      }
    );

    const taskData = response.data.task || response.data.data?.task || {};
    const taskStatus = taskData.status || response.data.status;
    const progressPercent = taskData.progress_percent || response.data.progress_percent || 0;

    console.log(`[VideoDashboard] Task ${taskId} status: ${taskStatus}, progress: ${progressPercent}%`);

    if (taskStatus === 'TASK_STATUS_SUCCEED' || taskStatus === 'succeed') {
      const videos = response.data.videos || response.data.data?.videos || [];
      
      console.log(`[VideoDashboard] ✅ Task ${taskId} completed with ${videos.length} video(s)`);
      
      // Download video and upload to S3
      let s3VideoUrl = null;
      if (videos.length > 0 && videos[0].video_url) {
        try {
          const videoResponse = await axios.get(videos[0].video_url, { 
            responseType: 'arraybuffer',
            timeout: 120000
          });
          const videoBuffer = Buffer.from(videoResponse.data);
          const hash = createHash('md5').update(videoBuffer).digest('hex');
          s3VideoUrl = await uploadToS3(videoBuffer, hash, 'dashboard_video.mp4');
          console.log(`[VideoDashboard] Video uploaded to S3: ${s3VideoUrl}`);
        } catch (uploadError) {
          console.error(`[VideoDashboard] Failed to upload to S3:`, uploadError.message);
          s3VideoUrl = videos[0].video_url; // Fallback to Novita URL
        }
      }
      
      return {
        status: 'completed',
        progress: 100,
        videos: videos.map(video => ({
          videoUrl: s3VideoUrl || video.video_url || video.url,
          duration: video.duration
        }))
      };
    } else if (taskStatus === 'TASK_STATUS_FAILED' || taskStatus === 'failed') {
      const reason = taskData.reason || response.data.reason || response.data.error || 'Unknown error';
      console.error(`[VideoDashboard] ❌ Task ${taskId} failed: ${reason}`);
      
      return {
        status: 'failed',
        error: reason,
        progress: 0
      };
    } else if (taskStatus === 'TASK_STATUS_QUEUED' || taskStatus === 'TASK_STATUS_PROCESSING' || taskStatus === 'queued' || taskStatus === 'processing') {
      return {
        status: 'processing',
        progress: progressPercent,
        eta: taskData.eta || null
      };
    } else {
      console.warn(`[VideoDashboard] ⚠️ Unknown task status: ${taskStatus} for task ${taskId}`);
      return {
        status: 'processing',
        progress: progressPercent
      };
    }
  } catch (error) {
    console.error(`[VideoDashboard] ❌ Error checking task ${taskId}:`, error.message);
    return {
      status: 'error',
      error: error.message || 'Failed to check task status',
      progress: 0
    };
  }
}

/**
 * Save video test results to database
 * @param {Object} db - Database instance
 * @param {Object} result - Test result data
 */
async function saveVideoTestResult(db, result) {
  try {
    const collection = db.collection('videoModelTests');
    
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30000);
    
    const normalizedPrompt = (result.prompt || '').trim();
    
    // Check for duplicates
    const duplicateCheck = await collection.findOne({
      userId: result.userId,
      modelId: result.modelId,
      prompt: normalizedPrompt,
      testedAt: { $gte: thirtySecondsAgo }
    }, {
      sort: { testedAt: -1 }
    });
    
    if (duplicateCheck) {
      console.log(`[VideoDashboard] ⚠️ Duplicate save prevented for ${result.modelName}`);
      return duplicateCheck._id.toString();
    }
    
    const testRecord = {
      modelId: result.modelId,
      modelName: result.modelName,
      prompt: normalizedPrompt,
      params: result.params,
      generationTime: result.generationTime,
      status: result.status,
      videos: result.videos || [],
      error: result.error,
      testedAt: now,
      userId: result.userId
    };

    const insertResult = await collection.insertOne(testRecord);

    // Update model average time
    await updateVideoModelAverage(db, result.modelId, result.generationTime);

    console.log(`[VideoDashboard] 💾 Saved test result for ${result.modelName}`);
    
    return insertResult.insertedId.toString();
  } catch (error) {
    console.error(`[VideoDashboard] Error saving test result:`, error.message);
    throw error;
  }
}

/**
 * Update model average generation time
 */
async function updateVideoModelAverage(db, modelId, generationTime) {
  try {
    if (!generationTime || generationTime <= 0) return;

    const collection = db.collection('videoModelStats');
    
    await collection.updateOne(
      { modelId },
      {
        $inc: { 
          totalTests: 1, 
          totalTime: generationTime 
        },
        $set: { 
          modelName: VIDEO_MODEL_CONFIGS[modelId]?.name || modelId,
          lastTested: new Date()
        },
        $push: {
          recentTimes: {
            $each: [generationTime],
            $slice: -100
          }
        }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[VideoDashboard] Error updating model average:`, error.message);
  }
}

/**
 * Get video model statistics
 */
async function getVideoModelStats(db) {
  try {
    const collection = db.collection('videoModelStats');
    const stats = await collection.find({}).toArray();
    
    // Get all ratings
    const ratingsCollection = db.collection('videoRatings');
    const allRatings = await ratingsCollection.find({}).toArray();
    const ratingsByModel = {};
    allRatings.forEach(rating => {
      if (!ratingsByModel[rating.modelId]) {
        ratingsByModel[rating.modelId] = [];
      }
      ratingsByModel[rating.modelId].push(rating.rating);
    });

    return stats.map(stat => {
      const avgTime = stat.totalTests > 0 ? Math.round(stat.totalTime / stat.totalTests) : 0;
      const recentAvg = stat.recentTimes?.length > 0 
        ? Math.round(stat.recentTimes.reduce((a, b) => a + b, 0) / stat.recentTimes.length)
        : avgTime;
      
      const modelRatings = ratingsByModel[stat.modelId] || [];
      const totalRatings = modelRatings.length;
      const averageRating = totalRatings > 0 
        ? Math.round((modelRatings.reduce((sum, r) => sum + r, 0) / totalRatings) * 10) / 10
        : null;
      
      return {
        modelId: stat.modelId,
        modelName: stat.modelName,
        totalTests: stat.totalTests || 0,
        averageTime: avgTime,
        recentAverageTime: recentAvg,
        lastTested: stat.lastTested,
        minTime: stat.recentTimes?.length > 0 ? Math.min(...stat.recentTimes) : 0,
        maxTime: stat.recentTimes?.length > 0 ? Math.max(...stat.recentTimes) : 0,
        averageRating: averageRating,
        totalRatings: totalRatings
      };
    });
  } catch (error) {
    console.error(`[VideoDashboard] Error getting model stats:`, error.message);
    return [];
  }
}

/**
 * Get recent video test history
 */
async function getRecentVideoTests(db, limit = 50, modelId = null) {
  try {
    const collection = db.collection('videoModelTests');
    const query = modelId ? { modelId } : {};
    
    return await collection
      .find(query)
      .sort({ testedAt: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error(`[VideoDashboard] Error getting recent tests:`, error.message);
    return [];
  }
}

/**
 * Save video rating
 */
async function saveVideoRating(db, modelId, videoUrl, rating, testId = null, userId = null) {
  try {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const collection = db.collection('videoRatings');
    
    const existingRating = await collection.findOne({
      videoUrl: videoUrl,
      modelId: modelId
    });

    if (existingRating) {
      await collection.updateOne(
        { _id: existingRating._id },
        {
          $set: {
            rating: rating,
            testId: testId,
            userId: userId,
            updatedAt: new Date()
          }
        }
      );
    } else {
      await collection.insertOne({
        modelId: modelId,
        videoUrl: videoUrl,
        rating: rating,
        testId: testId,
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    console.log(`[VideoDashboard] 💾 Saved rating ${rating} for ${modelId}`);
  } catch (error) {
    console.error(`[VideoDashboard] Error saving video rating:`, error.message);
    throw error;
  }
}

/**
 * Get video rating
 */
async function getVideoRating(db, testId) {
  try {
    const collection = db.collection('videoRatings');
    const rating = await collection.findOne({ testId: testId });
    return rating;
  } catch (error) {
    console.error(`[VideoDashboard] Error getting video rating:`, error.message);
    return null;
  }
}

module.exports = {
  VIDEO_MODEL_CONFIGS,
  DURATION_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  initializeVideoTest,
  checkVideoTaskResult,
  saveVideoTestResult,
  getVideoModelStats,
  getRecentVideoTests,
  saveVideoRating,
  getVideoRating
};
