/**
 * Admin Image Model Testing Utilities
 * Supports testing multiple Novita AI image generation models:
 * - Z Image Turbo
 * - Flux 2 Flex
 * - Hunyuan Image 3
 * - Seedream 4.5
 */

const axios = require('axios');
const { ObjectId } = require('mongodb');
const { createHash } = require('crypto');
const { uploadToS3 } = require('./tool');

// Model configurations with their API endpoints and parameters
const MODEL_CONFIGS = {
  'z-image-turbo': {
    name: 'Z Image Turbo',
    endpoint: 'https://api.novita.ai/v3/async/z-image-turbo',
    async: true,
    defaultParams: {
      size: '1024*1024',
      seed: -1,
      enable_base64_output: false
    },
    supportedParams: ['prompt', 'size', 'seed', 'enable_base64_output'],
    description: 'High-speed image generation model for rapid, high-quality images'
  },
  'flux-2-flex': {
    name: 'Flux 2 Flex',
    endpoint: 'https://api.novita.ai/v3/async/flux-2-flex',
    async: true,
    defaultParams: {
      size: '1024*1024',
      seed: -1
    },
    supportedParams: ['prompt', 'size', 'seed', 'images'],
    description: 'FLUX.2 model family for fast, flexible text-to-image generation'
  },
  'hunyuan-image-3': {
    name: 'Hunyuan Image 3',
    endpoint: 'https://api.novita.ai/v3/async/hunyuan-image-3',
    async: true,
    defaultParams: {
      size: '1024*1024',
      seed: -1
    },
    supportedParams: ['prompt', 'size', 'seed'],
    description: 'Tencent Hunyuan model for high-quality image generation'
  },
  'seedream-4.5': {
    name: 'Seedream 4.5',
    endpoint: 'https://api.novita.ai/v3/seedream-4.5',
    async: false, // Synchronous API
    defaultParams: {
      size: '2048x2048', // Seedream uses 'x' separator and min 3.6M pixels
      watermark: false,
      sequential_image_generation: 'disabled'
    },
    supportedParams: ['prompt', 'size', 'watermark', 'image', 'optimize_prompt_options', 'sequential_image_generation'],
    sizeFormat: 'x', // Uses 'x' instead of '*'
    description: 'ByteDance Seedream model supporting text-to-image and image editing'
  },
  'sd-txt2img': {
    name: 'SD Text to Image',
    endpoint: 'https://api.novita.ai/v3/async/txt2img',
    async: true,
    defaultParams: {
      width: 1024,
      height: 1024,
      image_num: 1,
      steps: 30,
      guidance_scale: 7.5,
      sampler_name: 'Euler a',
      seed: -1
    },
    supportedParams: ['model_name', 'prompt', 'negative_prompt', 'width', 'height', 'image_num', 'steps', 'guidance_scale', 'sampler_name', 'seed', 'loras', 'sd_vae'],
    requiresModel: true, // This model requires a model_name from active models
    description: 'Stable Diffusion text-to-image with custom models'
  }
};

// Size options for different models
const SIZE_OPTIONS = [
  { value: '512*512', label: '512x512 (Square)', minPixels: 0 },
  { value: '768*768', label: '768x768 (Square)', minPixels: 0 },
  { value: '1024*1024', label: '1024x1024 (Square)', minPixels: 0 },
  { value: '768*1024', label: '768x1024 (Portrait)', minPixels: 0 },
  { value: '1024*768', label: '1024x768 (Landscape)', minPixels: 0 },
  { value: '1024*1360', label: '1024x1360 (Portrait HD)', minPixels: 0 },
  { value: '1360*1024', label: '1360x1024 (Landscape HD)', minPixels: 0 },
  { value: '1920*1920', label: '1920x1920 (Square - Seedream min)', minPixels: 3686400 },
  { value: '2048*2048', label: '2048x2048 (Square HD - Seedream)', minPixels: 3686400 },
  { value: '1536*2048', label: '1536x2048 (Portrait - Seedream)', minPixels: 3686400 },
  { value: '2048*1536', label: '2048x1536 (Landscape - Seedream)', minPixels: 3686400 }
];

// Style presets for character creation
const STYLE_PRESETS = {
  anime: {
    name: 'Anime',
    promptPrefix: 'anime style, illustration, ',
    promptSuffix: ', high quality, detailed'
  },
  photorealistic: {
    name: 'Photorealistic',
    promptPrefix: 'photorealistic, ultra detailed, ',
    promptSuffix: ', professional photography, 8k resolution'
  }
};

/**
 * Initialize a test for a specific model
 * @param {string} modelId - The model identifier
 * @param {Object} params - Generation parameters
 * @returns {Object} - Task info with taskId and startTime
 */
async function initializeModelTest(modelId, params) {
  const config = MODEL_CONFIGS[modelId];
  if (!config) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const startTime = Date.now();
  console.log(`[AdminImageTest] 🚀 Starting ${config.name} generation`);
  console.log(`[AdminImageTest] Prompt: ${params.prompt?.substring(0, 100)}...`);

  try {
    let requestBody;
    
    // SD txt2img uses a different API format (extra.request structure)
    if (modelId === 'sd-txt2img') {
      if (!params.model_name) {
        throw new Error('SD txt2img requires a model_name parameter');
      }
      
      // Parse size from string format (e.g., "1024*1024") to width/height
      const size = params.size || '1024*1024';
      const [width, height] = size.split('*').map(Number);
      
      requestBody = {
        extra: {
          response_image_type: 'jpeg',
          enable_nsfw_detection: false
        },
        request: {
          model_name: params.model_name,
          prompt: params.prompt,
          negative_prompt: params.negative_prompt || '',
          width: width || config.defaultParams.width,
          height: height || config.defaultParams.height,
          image_num: params.image_num || config.defaultParams.image_num,
          steps: params.steps || config.defaultParams.steps,
          guidance_scale: params.guidance_scale || config.defaultParams.guidance_scale,
          sampler_name: params.sampler_name || config.defaultParams.sampler_name,
          seed: params.seed !== undefined ? params.seed : config.defaultParams.seed
        }
      };
      
      // Add optional params if provided
      if (params.sd_vae) requestBody.request.sd_vae = params.sd_vae;
      if (params.loras && Array.isArray(params.loras)) requestBody.request.loras = params.loras;
    } else {
      // Standard format for other models
      requestBody = {
        prompt: params.prompt,
        ...config.defaultParams,
        ...params
      };

      // Handle size format conversion for Seedream (uses 'x' instead of '*')
      if (config.sizeFormat === 'x' && requestBody.size) {
        // Convert 1024*1024 to 2048x2048 format and ensure min pixel count
        const sizeStr = requestBody.size.replace('*', 'x');
        const [width, height] = sizeStr.split('x').map(Number);
        const totalPixels = width * height;
        
        // Seedream requires min 3,686,400 pixels (about 1920x1920)
        if (totalPixels < 3686400) {
          // Scale up to meet minimum requirement
          const scale = Math.ceil(Math.sqrt(3686400 / totalPixels));
          const newWidth = width * scale;
          const newHeight = height * scale;
          requestBody.size = `${newWidth}x${newHeight}`;
          console.log(`[AdminImageTest] Seedream size scaled: ${width}x${height} -> ${newWidth}x${newHeight}`);
        } else {
          requestBody.size = sizeStr;
        }
      }

      // Remove non-supported params
      Object.keys(requestBody).forEach(key => {
        if (!config.supportedParams.includes(key) && key !== 'prompt') {
          delete requestBody[key];
        }
      });
    }

    console.log(`[AdminImageTest] Request body:`, JSON.stringify(requestBody, null, 2));

    // Sync APIs like Seedream need longer timeout (up to 5 minutes)
    const timeout = config.async ? 120000 : 300000;
    
    const response = await axios.post(config.endpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout
    });

    console.log(`[AdminImageTest] Response status: ${response.status}`);
    console.log(`[AdminImageTest] Response data:`, JSON.stringify(response.data, null, 2));

    if (response.status !== 200) {
      const errorMsg = response.data?.message || response.data?.error || `API returned status ${response.status}`;
      throw new Error(errorMsg);
    }

    // Handle synchronous vs async responses
    if (config.async) {
      // Async API returns task_id (check multiple possible locations)
      const taskId = response.data.task_id || response.data.data?.task_id || response.data.id;
      
      if (!taskId) {
        console.error(`[AdminImageTest] No task_id found in response:`, JSON.stringify(response.data, null, 2));
        throw new Error('No task_id returned from API. Response: ' + JSON.stringify(response.data));
      }
      
      console.log(`[AdminImageTest] ✅ Task created with ID: ${taskId}`);
      
      return {
        modelId,
        modelName: config.name,
        taskId,
        startTime,
        status: 'processing',
        async: true
      };
    } else {
      // Sync API returns images directly
      const images = response.data.images || [];
      const endTime = Date.now();
      const generationTime = endTime - startTime;

      console.log(`[AdminImageTest] ✅ ${config.name} completed in ${generationTime}ms`);

      return {
        modelId,
        modelName: config.name,
        taskId: `sync-${Date.now()}`,
        startTime,
        endTime,
        generationTime,
        status: 'completed',
        async: false,
        images: images.map(img => ({
          imageUrl: img,
          isBase64: typeof img === 'string' && img.startsWith('data:')
        }))
      };
    }
  } catch (error) {
    console.error(`[AdminImageTest] ❌ Error with ${config.name}:`, error.message);
    
    let errorMessage = error.message;
    
    if (error.response) {
      console.error(`[AdminImageTest] Response status:`, error.response.status);
      console.error(`[AdminImageTest] Response data:`, JSON.stringify(error.response.data, null, 2));
      
      // Extract error message from various response formats
      const data = error.response.data;
      if (data?.message) {
        errorMessage = data.message;
      } else if (data?.error) {
        errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      } else if (data?.errors && Array.isArray(data.errors)) {
        errorMessage = data.errors.map(e => e.message || e).join(', ');
      } else if (data?.reason) {
        errorMessage = data.reason;
      }
    }
    
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    enhancedError.modelId = modelId;
    throw enhancedError;
  }
}

/**
 * Check the status of an async task (for SD txt2img and other async APIs)
 * @param {string} taskId - The task ID to check
 * @returns {Object} - Task status and results
 */
async function checkTaskResult(taskId) {
  try {
    const response = await axios.get(
      `https://api.novita.ai/v3/async/task-result?task_id=${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`
        },
        timeout: 10000 // 10 second timeout for status checks
      }
    );

    // Handle different response formats
    const taskData = response.data.task || response.data.data?.task || {};
    const taskStatus = taskData.status || response.data.status;
    const progressPercent = taskData.progress_percent || response.data.progress_percent || 0;

    console.log(`[AdminImageTest] Task ${taskId} status: ${taskStatus}, progress: ${progressPercent}%`);

    // Handle all possible task statuses
    if (taskStatus === 'TASK_STATUS_SUCCEED' || taskStatus === 'succeed') {
      // Task completed successfully - extract images
      const images = response.data.images || response.data.data?.images || [];
      
      console.log(`[AdminImageTest] ✅ Task ${taskId} completed with ${images.length} image(s)`);
      
      return {
        status: 'completed',
        progress: 100,
        images: images.map(img => ({
          imageUrl: img.image_url || img.url,
          image_type: img.image_type,
          image_url_ttl: img.image_url_ttl,
          nsfw_detection: img.nsfw_detection_result || null
        })),
        seed: response.data.extra?.seed || null
      };
    } else if (taskStatus === 'TASK_STATUS_FAILED' || taskStatus === 'failed') {
      // Task failed
      const reason = taskData.reason || response.data.reason || response.data.error || 'Unknown error';
      console.error(`[AdminImageTest] ❌ Task ${taskId} failed: ${reason}`);
      
      return {
        status: 'failed',
        error: reason,
        progress: 0
      };
    } else if (taskStatus === 'TASK_STATUS_QUEUED' || taskStatus === 'TASK_STATUS_PROCESSING' || taskStatus === 'queued' || taskStatus === 'processing') {
      // Task is still processing
      return {
        status: 'processing',
        progress: progressPercent,
        eta: taskData.eta || null
      };
    } else {
      // Unknown status - default to processing
      console.warn(`[AdminImageTest] ⚠️ Unknown task status: ${taskStatus} for task ${taskId}`);
      return {
        status: 'processing',
        progress: progressPercent
      };
    }
  } catch (error) {
    console.error(`[AdminImageTest] ❌ Error checking task ${taskId}:`, error.message);
    if (error.response) {
      console.error(`[AdminImageTest] Response status:`, error.response.status);
      console.error(`[AdminImageTest] Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    
    // Return error status instead of throwing to allow retry
    return {
      status: 'error',
      error: error.message || 'Failed to check task status',
      progress: 0
    };
  }
}

/**
 * Save test results to database
 * @param {Object} db - Database instance
 * @param {Object} result - Test result data
 */
async function saveTestResult(db, result) {
  try {
    const collection = db.collection('imageModelTests');
    
    // Check for duplicate saves within the last 30 seconds
    // This prevents duplicate saves from race conditions or multiple calls
    // Increased window to handle network delays and async operations
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30000);
    
    // Normalize prompt for comparison (trim whitespace)
    const normalizedPrompt = (result.prompt || '').trim();
    
    // Check for duplicates with multiple criteria to catch race conditions
    const duplicateCheck = await collection.findOne({
      userId: result.userId,
      modelId: result.modelId,
      prompt: normalizedPrompt,
      testedAt: { $gte: thirtySecondsAgo }
    }, {
      sort: { testedAt: -1 } // Get the most recent one
    });
    
    if (duplicateCheck) {
      console.log(`[AdminImageTest] ⚠️ Duplicate save prevented for ${result.modelName} (found existing test ${duplicateCheck._id} from ${duplicateCheck.testedAt})`);
      return duplicateCheck._id.toString();
    }
    
    // Normalize images array to ensure consistent structure
    let normalizedImages = [];
    if (result.images && Array.isArray(result.images)) {
      normalizedImages = result.images.map(img => {
        if (typeof img === 'string') {
          return { imageUrl: img };
        }
        return {
          imageUrl: img.s3Url || img.imageUrl || img.image_url || img.url || null,
          originalUrl: img.imageUrl || img.image_url || null,
          isBase64: img.isBase64 || false
        };
      }).filter(img => img.imageUrl); // Only keep images with valid URLs
    }
    
    const testRecord = {
      modelId: result.modelId,
      modelName: result.modelName,
      prompt: normalizedPrompt,
      params: result.params,
      generationTime: result.generationTime,
      status: result.status,
      images: normalizedImages,
      error: result.error,
      testedAt: now,
      userId: result.userId
    };

    const insertResult = await collection.insertOne(testRecord);

    // Update model average time
    await updateModelAverage(db, result.modelId, result.generationTime);

    console.log(`[AdminImageTest] 💾 Saved test result for ${result.modelName} with ${normalizedImages.length} images`);
    
    return insertResult.insertedId.toString();
  } catch (error) {
    console.error(`[AdminImageTest] Error saving test result:`, error.message);
    throw error;
  }
}

/**
 * Update model average generation time
 * @param {Object} db - Database instance
 * @param {string} modelId - Model identifier
 * @param {number} generationTime - Generation time in ms
 */
async function updateModelAverage(db, modelId, generationTime) {
  try {
    if (!generationTime || generationTime <= 0) return;

    const collection = db.collection('imageModelStats');
    
    await collection.updateOne(
      { modelId },
      {
        $inc: { 
          totalTests: 1, 
          totalTime: generationTime 
        },
        $set: { 
          modelName: MODEL_CONFIGS[modelId]?.name || modelId,
          lastTested: new Date()
        },
        $push: {
          recentTimes: {
            $each: [generationTime],
            $slice: -100 // Keep last 100 times
          }
        }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[AdminImageTest] Error updating model average:`, error.message);
  }
}

/**
 * Get model statistics
 * @param {Object} db - Database instance
 * @param {string} modelId - Optional model ID filter
 * @returns {Array} - Model statistics
 */
async function getModelStats(db, modelId = null) {
  try {
    const collection = db.collection('imageModelStats');
    const query = modelId ? { modelId } : {};
    
    const stats = await collection.find(query).toArray();
    
    // Separate SD models from other models
    // SD models can have modelId 'sd-txt2img' or prefixed IDs like 'sd-someModelId'
    const sdStats = stats.filter(stat => stat.modelId === 'sd-txt2img' || stat.modelId.startsWith('sd-'));
    const otherStats = stats.filter(stat => stat.modelId !== 'sd-txt2img' && !stat.modelId.startsWith('sd-'));
    
    // Combine all SD model statistics
    let combinedSDStat = null;
    if (sdStats.length > 0) {
      const combinedTotalTests = sdStats.reduce((sum, stat) => sum + (stat.totalTests || 0), 0);
      const combinedTotalTime = sdStats.reduce((sum, stat) => sum + (stat.totalTime || 0), 0);
      const allRecentTimes = sdStats.reduce((arr, stat) => {
        if (stat.recentTimes && Array.isArray(stat.recentTimes)) {
          return arr.concat(stat.recentTimes);
        }
        return arr;
      }, []);
      
      const avgTime = combinedTotalTests > 0 ? Math.round(combinedTotalTime / combinedTotalTests) : 0;
      const recentAvg = allRecentTimes.length > 0 
        ? Math.round(allRecentTimes.reduce((a, b) => a + b, 0) / allRecentTimes.length)
        : avgTime;
      
      // Get the most recent lastTested date
      const lastTested = sdStats.reduce((latest, stat) => {
        if (!latest) return stat.lastTested;
        if (!stat.lastTested) return latest;
        return stat.lastTested > latest ? stat.lastTested : latest;
      }, null);
      
      // Get combined rating stats for SD models (match both exact and prefixed IDs)
      const ratingsCollection = db.collection('imageRatings');
      const sdRatings = await ratingsCollection.find({ 
        $or: [
          { modelId: 'sd-txt2img' },
          { modelId: { $regex: /^sd-/ } }
        ]
      }).toArray();
      const sdTotalRatings = sdRatings.length;
      const sdAverageRating = sdTotalRatings > 0 
        ? Math.round((sdRatings.reduce((sum, r) => sum + r.rating, 0) / sdTotalRatings) * 10) / 10
        : null;

      combinedSDStat = {
        modelId: 'sd-txt2img',
        modelName: 'SD Text to Image',
        totalTests: combinedTotalTests,
        averageTime: avgTime,
        recentAverageTime: recentAvg,
        lastTested: lastTested,
        minTime: allRecentTimes.length > 0 ? Math.min(...allRecentTimes) : 0,
        maxTime: allRecentTimes.length > 0 ? Math.max(...allRecentTimes) : 0,
        averageRating: sdAverageRating,
        totalRatings: sdTotalRatings
      };
    }
    
    // Get all ratings to calculate averages
    const ratingsCollection = db.collection('imageRatings');
    const allRatings = await ratingsCollection.find({}).toArray();
    const ratingsByModel = {};
    allRatings.forEach(rating => {
      if (!ratingsByModel[rating.modelId]) {
        ratingsByModel[rating.modelId] = [];
      }
      ratingsByModel[rating.modelId].push(rating.rating);
    });

    // Process other stats normally
    const processedOtherStats = otherStats.map(stat => {
      const avgTime = stat.totalTests > 0 ? Math.round(stat.totalTime / stat.totalTests) : 0;
      const recentAvg = stat.recentTimes?.length > 0 
        ? Math.round(stat.recentTimes.reduce((a, b) => a + b, 0) / stat.recentTimes.length)
        : avgTime;
      
      // Calculate rating stats from ratings collection
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
    
    // Combine results: other stats first, then combined SD stat if it exists
    const result = [...processedOtherStats];
    if (combinedSDStat) {
      result.push(combinedSDStat);
    }
    
    return result;
  } catch (error) {
    console.error(`[AdminImageTest] Error getting model stats:`, error.message);
    return [];
  }
}

/**
 * Get recent test history
 * @param {Object} db - Database instance
 * @param {number} limit - Number of records to return
 * @param {string} modelId - Optional model ID filter
 * @returns {Array} - Recent test records
 */
async function getRecentTests(db, limit = 50, modelId = null) {
  try {
    const collection = db.collection('imageModelTests');
    const query = {};
    
    // Add model filter if provided
    if (modelId) {
      // For SD models, filter by modelId that starts with 'sd-' or equals 'sd-txt2img'
      // and also check modelName for SD model patterns
      if (modelId === 'sd-txt2img') {
        query.$or = [
          { modelId: 'sd-txt2img' },
          { modelId: { $regex: /^sd-/ } },
          { modelName: { $regex: /^SD Text to Image/ } }
        ];
      } else {
        query.modelId = modelId;
      }
    }
    
    return await collection
      .find(query)
      .sort({ testedAt: -1 })
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error(`[AdminImageTest] Error getting recent tests:`, error.message);
    return [];
  }
}

/**
 * Get default character creation model setting
 * @param {Object} db - Database instance
 * @returns {Object} - Default model settings
 */
async function getDefaultCharacterModels(db) {
  try {
    const collection = db.collection('systemSettings');
    const settings = await collection.findOne({ type: 'defaultCharacterModels' });
    
    return settings || {
      anime: 'z-image-turbo',
      photorealistic: 'flux-2-flex'
    };
  } catch (error) {
    console.error(`[AdminImageTest] Error getting default character models:`, error.message);
    return {
      anime: 'z-image-turbo',
      photorealistic: 'flux-2-flex'
    };
  }
}

/**
 * Set default character creation model
 * @param {Object} db - Database instance
 * @param {string} style - 'anime' or 'photorealistic'
 * @param {string} modelId - Model identifier
 */
async function setDefaultCharacterModel(db, style, modelId) {
  try {
    const collection = db.collection('systemSettings');
    
    await collection.updateOne(
      { type: 'defaultCharacterModels' },
      {
        $set: {
          [style]: modelId,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`[AdminImageTest] ✅ Set default ${style} model to ${modelId}`);
  } catch (error) {
    console.error(`[AdminImageTest] Error setting default character model:`, error.message);
    throw error;
  }
}

/**
 * Upload image to S3 and return URL
 * @param {string} imageUrl - Original image URL or base64
 * @param {string} prefix - Filename prefix
 * @returns {string} - S3 URL
 */
async function uploadTestImageToS3(imageUrl, prefix = 'test') {
  try {
    let buffer;
    
    if (imageUrl.startsWith('data:')) {
      // Handle base64
      const base64Data = imageUrl.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      // Download from URL
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data, 'binary');
    }

    const hash = createHash('md5').update(buffer).digest('hex');
    const s3Url = await uploadToS3(buffer, hash, `${prefix}_${hash}.png`);
    
    return s3Url;
  } catch (error) {
    console.error(`[AdminImageTest] Error uploading to S3:`, error.message);
    return imageUrl; // Return original URL as fallback
  }
}

/**
 * Save image rating
 * @param {Object} db - Database instance
 * @param {string} modelId - Model identifier
 * @param {string} imageUrl - Image URL
 * @param {number} rating - Rating from 1 to 5
 * @param {string} testId - Optional test ID
 * @param {string} userId - User ID
 */
async function saveImageRating(db, modelId, imageUrl, rating, testId = null, userId = null) {
  try {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const collection = db.collection('imageRatings');
    
    // Check if rating already exists for this image
    const existingRating = await collection.findOne({
      imageUrl: imageUrl,
      modelId: modelId
    });

    if (existingRating) {
      // Update existing rating
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
      // Create new rating
      await collection.insertOne({
        modelId: modelId,
        imageUrl: imageUrl,
        rating: rating,
        testId: testId,
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Update model rating statistics
    await updateModelRatingStats(db, modelId);

    console.log(`[AdminImageTest] 💾 Saved rating ${rating} for ${modelId}`);
  } catch (error) {
    console.error(`[AdminImageTest] Error saving image rating:`, error.message);
    throw error;
  }
}

/**
 * Get image rating
 * @param {Object} db - Database instance
 * @param {string} testId - Test ID
 * @returns {Object|null} - Rating object or null
 */
async function getImageRating(db, testId) {
  try {
    const collection = db.collection('imageRatings');
    const rating = await collection.findOne({ testId: testId });
    return rating;
  } catch (error) {
    console.error(`[AdminImageTest] Error getting image rating:`, error.message);
    return null;
  }
}

/**
 * Update model rating statistics
 * @param {Object} db - Database instance
 * @param {string} modelId - Model identifier
 */
async function updateModelRatingStats(db, modelId) {
  try {
    const ratingsCollection = db.collection('imageRatings');
    const statsCollection = db.collection('imageModelStats');
    
    // Get all ratings for this model
    const ratings = await ratingsCollection.find({ modelId: modelId }).toArray();
    
    if (ratings.length === 0) {
      return;
    }

    const totalRatings = ratings.length;
    const sumRatings = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = sumRatings / totalRatings;

    // Update statistics
    await statsCollection.updateOne(
      { modelId: modelId },
      {
        $set: {
          averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
          totalRatings: totalRatings
        }
      },
      { upsert: true }
    );

    console.log(`[AdminImageTest] 📊 Updated rating stats for ${modelId}: ${averageRating.toFixed(1)} (${totalRatings} ratings)`);
  } catch (error) {
    console.error(`[AdminImageTest] Error updating model rating stats:`, error.message);
  }
}

module.exports = {
  MODEL_CONFIGS,
  SIZE_OPTIONS,
  STYLE_PRESETS,
  initializeModelTest,
  checkTaskResult,
  saveTestResult,
  updateModelAverage,
  getModelStats,
  getRecentTests,
  getDefaultCharacterModels,
  setDefaultCharacterModel,
  uploadTestImageToS3,
  saveImageRating,
  getImageRating,
  updateModelRatingStats
};
