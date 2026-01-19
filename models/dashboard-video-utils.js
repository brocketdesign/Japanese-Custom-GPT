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
  // =============== IMAGE TO VIDEO (I2V) MODELS ===============
  'kling-v2.1-i2v': {
    name: 'Kling V2.1 I2V',
    endpoint: 'https://api.novita.ai/v3/async/kling-v2.1-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      mode: 'Standard',
      duration: '5',
      guidance_scale: 0.5,
      negative_prompt: 'blurry, low quality, distorted'
    },
    supportedParams: ['image', 'prompt', 'mode', 'duration', 'guidance_scale', 'negative_prompt'],
    description: 'Kling V2.1 model for generating videos from images with natural motion'
  },
  'kling-v2.1-i2v-master': {
    name: 'Kling V2.1 Master I2V',
    endpoint: 'https://api.novita.ai/v3/async/kling-v2.1-i2v-master',
    async: true,
    category: 'i2v',
    defaultParams: {
      mode: 'Standard',
      duration: '5',
      guidance_scale: 0.5,
      negative_prompt: 'blurry, low quality, distorted'
    },
    supportedParams: ['image', 'prompt', 'mode', 'duration', 'guidance_scale', 'negative_prompt'],
    description: 'Kling V2.1 Master model with enhanced quality for image-to-video generation'
  },
  'kling-v1.6-i2v': {
    name: 'Kling V1.6 I2V',
    endpoint: 'https://api.novita.ai/v3/async/kling-v1.6-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      mode: 'Standard',
      duration: '5',
      guidance_scale: 0.5
    },
    supportedParams: ['image', 'prompt', 'mode', 'duration', 'guidance_scale', 'negative_prompt'],
    description: 'Kling V1.6 model for image-to-video generation'
  },
  'wan-i2v': {
    name: 'Wan 2.1 I2V',
    endpoint: 'https://api.novita.ai/v3/async/wan-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['image', 'prompt', 'duration', 'resolution', 'seed'],
    description: 'Wan 2.1 model for image-to-video generation with smooth motion'
  },
  'wan-2.2-i2v': {
    name: 'Wan 2.2 I2V',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.2-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['image', 'prompt', 'duration', 'resolution', 'seed'],
    description: 'Wan 2.2 model with improved quality for image-to-video'
  },
  'wan-2.5-i2v-preview': {
    name: 'Wan 2.5 I2V Preview',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.5-i2v-preview',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['image', 'prompt', 'duration', 'resolution', 'seed'],
    description: 'Wan 2.5 preview model with next-gen image-to-video capabilities'
  },
  'wan2.6-i2v': {
    name: 'Wan 2.6 I2V',
    endpoint: 'https://api.novita.ai/v3/async/wan2.6-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['image', 'prompt', 'duration', 'resolution', 'seed'],
    description: 'Wan 2.6 latest model for high-quality image-to-video generation'
  },
  'minimax-i2v': {
    name: 'Minimax I2V',
    endpoint: 'https://api.novita.ai/v3/async/minimax-video-01',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '6'
    },
    supportedParams: ['image', 'prompt', 'duration'],
    description: 'Minimax Video model for image-to-video generation'
  },
  'vidu-i2v': {
    name: 'Vidu I2V',
    endpoint: 'https://api.novita.ai/v3/async/vidu-1.5-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '4'
    },
    supportedParams: ['image', 'prompt', 'duration', 'resolution'],
    description: 'Vidu 1.5 model for creative image-to-video transformations'
  },
  'pixverse-i2v': {
    name: 'PixVerse I2V',
    endpoint: 'https://api.novita.ai/v3/async/pixverse-v4.5-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5'
    },
    supportedParams: ['image', 'prompt', 'duration', 'aspect_ratio'],
    description: 'PixVerse V4.5 model for anime-style image-to-video'
  },
  'seedance-i2v': {
    name: 'Seedance I2V',
    endpoint: 'https://api.novita.ai/v3/async/seedance-1.0-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5'
    },
    supportedParams: ['image', 'prompt', 'duration', 'resolution'],
    description: 'Seedance 1.0 model for dance and motion video generation'
  },
  'luma-i2v': {
    name: 'Luma Dream Machine I2V',
    endpoint: 'https://api.novita.ai/v3/async/luma-dream-machine-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5'
    },
    supportedParams: ['image', 'prompt', 'duration', 'aspect_ratio'],
    description: 'Luma Dream Machine for cinematic image-to-video generation'
  },
  
  // =============== TEXT TO VIDEO (T2V) MODELS ===============
  'kling-v2.1-t2v-master': {
    name: 'Kling V2.1 Master T2V',
    endpoint: 'https://api.novita.ai/v3/async/kling-v2.1-t2v-master',
    async: true,
    category: 't2v',
    defaultParams: {
      mode: 'Standard',
      duration: '5',
      guidance_scale: 0.5,
      aspect_ratio: '16:9'
    },
    supportedParams: ['prompt', 'mode', 'duration', 'guidance_scale', 'aspect_ratio', 'negative_prompt'],
    description: 'Kling V2.1 Master model for high-quality text-to-video generation'
  },
  'kling-v1.6-t2v': {
    name: 'Kling V1.6 T2V',
    endpoint: 'https://api.novita.ai/v3/async/kling-v1.6-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      mode: 'Standard',
      duration: '5',
      guidance_scale: 0.5,
      aspect_ratio: '16:9'
    },
    supportedParams: ['prompt', 'mode', 'duration', 'guidance_scale', 'aspect_ratio', 'negative_prompt'],
    description: 'Kling V1.6 model for text-to-video generation'
  },
  'hunyuan-video-fast': {
    name: 'Hunyuan Video Fast',
    endpoint: 'https://api.novita.ai/v3/async/hunyuan-video-fast',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['prompt', 'duration', 'resolution', 'aspect_ratio', 'seed'],
    description: 'Tencent Hunyuan fast video generation model'
  },
  'wan-t2v': {
    name: 'Wan 2.1 T2V',
    endpoint: 'https://api.novita.ai/v3/async/wan-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['prompt', 'duration', 'resolution', 'aspect_ratio', 'seed'],
    description: 'Wan 2.1 model for text-to-video generation'
  },
  'wan-2.2-t2v': {
    name: 'Wan 2.2 T2V',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.2-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['prompt', 'duration', 'resolution', 'aspect_ratio', 'seed'],
    description: 'Wan 2.2 model with improved text-to-video quality'
  },
  'wan-2.5-t2v-preview': {
    name: 'Wan 2.5 T2V Preview',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.5-t2v-preview',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['prompt', 'duration', 'resolution', 'aspect_ratio', 'seed'],
    description: 'Wan 2.5 preview for next-gen text-to-video'
  },
  'wan2.6-t2v': {
    name: 'Wan 2.6 T2V',
    endpoint: 'https://api.novita.ai/v3/async/wan2.6-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5',
      resolution: '720p'
    },
    supportedParams: ['prompt', 'duration', 'resolution', 'aspect_ratio', 'seed'],
    description: 'Wan 2.6 latest model for text-to-video generation'
  },
  'minimax-t2v': {
    name: 'Minimax T2V',
    endpoint: 'https://api.novita.ai/v3/async/minimax-video-01-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '6'
    },
    supportedParams: ['prompt', 'duration', 'aspect_ratio'],
    description: 'Minimax Video model for text-to-video generation'
  },
  'vidu-t2v': {
    name: 'Vidu T2V',
    endpoint: 'https://api.novita.ai/v3/async/vidu-1.5-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '4'
    },
    supportedParams: ['prompt', 'duration', 'resolution'],
    description: 'Vidu 1.5 model for creative text-to-video generation'
  },
  'pixverse-t2v': {
    name: 'PixVerse T2V',
    endpoint: 'https://api.novita.ai/v3/async/pixverse-v4.5-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5'
    },
    supportedParams: ['prompt', 'duration', 'aspect_ratio'],
    description: 'PixVerse V4.5 model for anime-style text-to-video'
  },
  'luma-t2v': {
    name: 'Luma Dream Machine T2V',
    endpoint: 'https://api.novita.ai/v3/async/luma-dream-machine-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5'
    },
    supportedParams: ['prompt', 'duration', 'aspect_ratio'],
    description: 'Luma Dream Machine for cinematic text-to-video generation'
  },
  
  // =============== VIDEO MERGE FACE ===============
  'video-merge-face': {
    name: 'Video Merge Face',
    endpoint: 'https://api.novita.ai/v3/async/video-merge-face',
    async: true,
    category: 'face',
    defaultParams: {},
    supportedParams: ['video_file', 'face_image_file'],
    description: 'Merge a face into an existing video - replace faces in videos with a source face'
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
  console.log(`[VideoDashboard] Category: ${config.category}`);

  // Validate requirements based on category
  if (config.category === 'i2v' && !params.imageUrl && !params.image) {
    throw new Error(`${config.name} requires an image input`);
  }
  
  if (config.category === 'face' && (!params.video_file || !params.face_image_file)) {
    throw new Error(`${config.name} requires both a video file and a face image`);
  }

  try {
    const webhookUrl = config.async ? getWebhookUrl() : null;
    
    // Validate and truncate prompt
    const validatedPrompt = validateAndTruncatePrompt(params.prompt);
    
    let requestBody = {};
    
    // Build request body based on model category and type
    if (config.category === 'face') {
      // Video Merge Face
      requestBody = {
        video_file: params.video_file,
        face_image_file: params.face_image_file
      };
    } else if (config.category === 't2v') {
      // Text-to-Video models
      requestBody = {
        prompt: validatedPrompt
      };
      
      // Add duration
      if (params.duration || config.defaultParams.duration) {
        requestBody.duration = params.duration || config.defaultParams.duration;
      }
      
      // Add aspect ratio
      if (params.aspectRatio || config.defaultParams.aspect_ratio) {
        requestBody.aspect_ratio = params.aspectRatio || config.defaultParams.aspect_ratio;
      }
      
      // Add resolution for models that support it
      if (config.supportedParams.includes('resolution')) {
        requestBody.resolution = params.resolution || config.defaultParams.resolution || '720p';
      }
      
      // Add Kling-specific params
      if (modelId.startsWith('kling')) {
        if (params.mode || config.defaultParams.mode) {
          requestBody.mode = params.mode || config.defaultParams.mode;
        }
        if (params.guidance_scale !== undefined || config.defaultParams.guidance_scale !== undefined) {
          requestBody.guidance_scale = params.guidance_scale !== undefined ? params.guidance_scale : config.defaultParams.guidance_scale;
        }
        if (params.negative_prompt || config.defaultParams.negative_prompt) {
          requestBody.negative_prompt = params.negative_prompt || config.defaultParams.negative_prompt || '';
        }
      }
      
      // Add seed if provided
      if (params.seed !== undefined) {
        requestBody.seed = params.seed;
      }
    } else if (config.category === 'i2v') {
      // Image-to-Video models
      requestBody = {
        image: params.imageUrl || params.image,
        prompt: validatedPrompt
      };
      
      // Add duration
      if (params.duration || config.defaultParams.duration) {
        requestBody.duration = params.duration || config.defaultParams.duration;
      }
      
      // Add resolution for models that support it
      if (config.supportedParams.includes('resolution')) {
        requestBody.resolution = params.resolution || config.defaultParams.resolution || '720p';
      }
      
      // Add aspect ratio if supported
      if (config.supportedParams.includes('aspect_ratio') && (params.aspectRatio || config.defaultParams.aspect_ratio)) {
        requestBody.aspect_ratio = params.aspectRatio || config.defaultParams.aspect_ratio;
      }
      
      // Add Kling-specific params
      if (modelId.startsWith('kling')) {
        if (params.mode || config.defaultParams.mode) {
          requestBody.mode = params.mode || config.defaultParams.mode;
        }
        if (params.guidance_scale !== undefined || config.defaultParams.guidance_scale !== undefined) {
          requestBody.guidance_scale = params.guidance_scale !== undefined ? params.guidance_scale : config.defaultParams.guidance_scale;
        }
        if (params.negative_prompt || config.defaultParams.negative_prompt) {
          requestBody.negative_prompt = params.negative_prompt || config.defaultParams.negative_prompt || '';
        }
      }
      
      // Add seed if provided
      if (params.seed !== undefined) {
        requestBody.seed = params.seed;
      }
    }
    
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
      category: config.category,
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
 * @param {Object} db - Database instance
 * @param {number} limit - Number of records to return
 * @param {string} modelId - Optional model ID filter
 * @param {string} userId - Optional user ID filter (for non-admin users to see only their own videos)
 * @returns {Array} - Recent test records
 */
async function getRecentVideoTests(db, limit = 50, modelId = null, userId = null) {
  try {
    const collection = db.collection('videoModelTests');
    const query = {};
    
    // Add user filter if provided (for non-admin users)
    if (userId) {
      query.userId = userId;
    }
    
    // Add model filter if provided
    if (modelId) {
      query.modelId = modelId;
    }
    
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
