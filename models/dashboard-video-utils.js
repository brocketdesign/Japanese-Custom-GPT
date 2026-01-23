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
    // Wan 2.1 uses flat structure: image_url, prompt, width, height, steps, guidance_scale, flow_shift, seed, negative_prompt
    supportedParams: ['image_url', 'prompt', 'width', 'height', 'steps', 'guidance_scale', 'flow_shift', 'seed', 'negative_prompt'],
    description: 'Wan 2.1 model for image-to-video generation with smooth motion'
  },
  'wan-2.2-i2v': {
    name: 'Wan 2.2 I2V',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.2-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: 5,
      resolution: '720P'
    },
    // Wan 2.2 uses nested structure: input.img_url, input.prompt, input.negative_prompt, parameters.resolution, parameters.duration, parameters.seed, parameters.prompt_extend
    supportedParams: ['img_url', 'prompt', 'negative_prompt', 'resolution', 'duration', 'seed', 'prompt_extend'],
    description: 'Wan 2.2 model with improved quality for image-to-video'
  },
  'wan-2.5-i2v-preview': {
    name: 'Wan 2.5 I2V Preview',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.5-i2v-preview',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: 5,
      resolution: '720P'
    },
    // Wan 2.5 uses nested structure with audio support: input.img_url, input.prompt, input.audio_url, parameters.resolution, parameters.duration, parameters.audio, parameters.seed
    supportedParams: ['img_url', 'prompt', 'negative_prompt', 'audio_url', 'resolution', 'duration', 'audio', 'seed', 'prompt_extend'],
    description: 'Wan 2.5 preview model with next-gen image-to-video capabilities and audio support'
  },
  'wan2.6-i2v': {
    name: 'Wan 2.6 I2V',
    endpoint: 'https://api.novita.ai/v3/async/wan2.6-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: 5,
      resolution: '720P'
    },
    // Wan 2.6 uses nested structure: input.img_url, input.prompt, parameters.resolution (720P/1080P), parameters.duration (5/10/15), shot_type, watermark, audio
    supportedParams: ['img_url', 'prompt', 'negative_prompt', 'audio_url', 'template', 'resolution', 'duration', 'shot_type', 'watermark', 'audio', 'seed', 'prompt_extend'],
    description: 'Wan 2.6 latest model for high-quality image-to-video generation with extended duration support (up to 15s)'
  },
  'minimax-i2v': {
    name: 'Minimax I2V',
    endpoint: 'https://api.novita.ai/v3/async/minimax-video-01',
    async: true,
    category: 'i2v',
    defaultParams: {
      enable_prompt_expansion: true
    },
    // Minimax uses image_url (not image), fixed 6-second 720p output
    supportedParams: ['image_url', 'prompt', 'enable_prompt_expansion'],
    description: 'Minimax Video model for image-to-video generation (fixed 6s, 720p)'
  },
  'vidu-i2v': {
    name: 'Vidu Q1 I2V',
    endpoint: 'https://api.novita.ai/v3/async/vidu-q1-img2video',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: 5,
      resolution: '1080p',
      aspect_ratio: '16:9',
      movement_amplitude: 'auto',
      style: 'general'
    },
    // Vidu Q1 uses image (singular), fixed 5s duration, 1080p only
    supportedParams: ['image', 'prompt', 'style', 'resolution', 'aspect_ratio', 'movement_amplitude', 'duration', 'seed', 'bgm'],
    description: 'Vidu Q1 model for creative image-to-video transformations (1080p, 5s)'
  },
  'pixverse-i2v': {
    name: 'PixVerse V4.5 I2V',
    endpoint: 'https://api.novita.ai/v3/async/pixverse-v4.5-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      resolution: '540p',
      fast_mode: false
    },
    // PixVerse uses image, supports 360p/540p/720p/1080p (1080p only in normal mode)
    supportedParams: ['image', 'prompt', 'resolution', 'negative_prompt', 'fast_mode', 'style', 'seed'],
    description: 'PixVerse V4.5 model for high-quality image-to-video (5-8s)'
  },
  'seedance-i2v': {
    name: 'Seedance 1.5 Pro I2V',
    endpoint: 'https://api.novita.ai/v3/async/seedance-v1.5-pro-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: 5,
      resolution: '720p',
      ratio: 'adaptive',
      fps: 24,
      generate_audio: true,
      camera_fixed: false
    },
    // Seedance uses image (URL or Base64), duration 4-12s, resolution 480p/720p
    supportedParams: ['image', 'prompt', 'duration', 'resolution', 'ratio', 'seed', 'fps', 'watermark', 'last_image', 'camera_fixed', 'generate_audio'],
    description: 'Seedance 1.5 Pro model for dance and motion video generation with audio (4-12s)'
  },
  'luma-i2v': {
    name: 'Luma Dream Machine I2V',
    endpoint: 'https://api.novita.ai/v3/async/luma-dream-machine-i2v',
    async: true,
    category: 'i2v',
    defaultParams: {
      duration: '5s',
      resolution: '720p',
      aspect_ratio: '16:9',
      model: 'ray-2'
    },
    // Luma uses keyframes structure: keyframes.frame0.type="image", keyframes.frame0.url
    supportedParams: ['keyframes', 'prompt', 'model', 'resolution', 'duration', 'aspect_ratio', 'loop'],
    description: 'Luma Dream Machine for cinematic image-to-video generation'
  },
  'wan-2.2-i2v-fast': {
    name: 'Wan 2.2 I2V Fast (Segmind)',
    endpoint: 'https://api.segmind.com/v1/wan-2.2-i2v-fast',
    async: false, // Segmind returns video directly
    provider: 'segmind', // Custom provider flag to differentiate from Novita
    category: 'i2v',
    defaultParams: {
      go_fast: true,
      num_frames: 81,
      resolution: '480p',
      aspect_ratio: '16:9',
      sample_shift: 12,
      frames_per_second: 16
    },
    // Wan 2.2 I2V Fast (Segmind) parameters
    supportedParams: ['image', 'prompt', 'go_fast', 'num_frames', 'resolution', 'aspect_ratio', 'sample_shift', 'frames_per_second', 'negative_prompt', 'last_image', 'seed'],
    description: 'Wan 2.2 I2V Fast via Segmind - optimized for speed with go_fast mode (81-100 frames, 480p/720p)'
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
      model_name: 'hunyuan-video-fast',
      width: 1280,
      height: 720,
      steps: 20
    },
    // Hunyuan uses width/height (720x1280 or 1280x720), steps (2-30), seed, no duration param
    supportedParams: ['prompt', 'model_name', 'width', 'height', 'steps', 'seed'],
    description: 'Tencent Hunyuan fast video generation model'
  },
  'wan-t2v': {
    name: 'Wan 2.1 T2V',
    endpoint: 'https://api.novita.ai/v3/async/wan-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      resolution: '720p'
    },
    // Wan 2.1 T2V uses flat structure with width/height
    supportedParams: ['prompt', 'width', 'height', 'seed', 'negative_prompt'],
    description: 'Wan 2.1 model for text-to-video generation'
  },
  'wan-2.2-t2v': {
    name: 'Wan 2.2 T2V',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.2-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: 5,
      resolution: '720P'
    },
    // Wan 2.2 T2V uses nested input/parameters structure with size param
    supportedParams: ['prompt', 'negative_prompt', 'size', 'duration', 'seed', 'prompt_extend'],
    description: 'Wan 2.2 model with improved text-to-video quality'
  },
  'wan-2.5-t2v-preview': {
    name: 'Wan 2.5 T2V Preview',
    endpoint: 'https://api.novita.ai/v3/async/wan-2.5-t2v-preview',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: 5,
      resolution: '720P'
    },
    // Wan 2.5 T2V uses nested structure with audio support
    supportedParams: ['prompt', 'negative_prompt', 'audio_url', 'size', 'duration', 'audio', 'seed', 'prompt_extend'],
    description: 'Wan 2.5 preview for next-gen text-to-video with audio support'
  },
  'wan2.6-t2v': {
    name: 'Wan 2.6 T2V',
    endpoint: 'https://api.novita.ai/v3/async/wan2.6-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: 5,
      resolution: '720P'
    },
    // Wan 2.6 T2V uses nested structure, supports 5/10/15s, shot_type, watermark
    supportedParams: ['prompt', 'negative_prompt', 'audio_url', 'size', 'duration', 'shot_type', 'watermark', 'audio', 'seed', 'prompt_extend'],
    description: 'Wan 2.6 latest model for text-to-video generation (up to 15s)'
  },
  'minimax-t2v': {
    name: 'Minimax T2V',
    endpoint: 'https://api.novita.ai/v3/async/minimax-video-01',
    async: true,
    category: 't2v',
    defaultParams: {
      enable_prompt_expansion: true
    },
    // Minimax T2V uses same endpoint as I2V, just without image_url. Fixed 6s, 720p
    supportedParams: ['prompt', 'enable_prompt_expansion'],
    description: 'Minimax Video model for text-to-video generation (fixed 6s, 720p)'
  },
  'vidu-t2v': {
    name: 'Vidu Q1 T2V',
    endpoint: 'https://api.novita.ai/v3/async/vidu-q1-text2video',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: 5,
      resolution: '1080p',
      aspect_ratio: '16:9',
      style: 'general',
      movement_amplitude: 'auto'
    },
    // Vidu Q1 T2V - fixed 5s, 1080p
    supportedParams: ['prompt', 'style', 'resolution', 'aspect_ratio', 'movement_amplitude', 'duration', 'seed', 'bgm'],
    description: 'Vidu Q1 model for creative text-to-video generation (1080p, 5s)'
  },
  'pixverse-t2v': {
    name: 'PixVerse V4.5 T2V',
    endpoint: 'https://api.novita.ai/v3/async/pixverse-v4.5-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      resolution: '540p',
      aspect_ratio: '16:9',
      fast_mode: false
    },
    // PixVerse T2V requires aspect_ratio and resolution
    supportedParams: ['prompt', 'aspect_ratio', 'resolution', 'negative_prompt', 'fast_mode', 'style', 'seed'],
    description: 'PixVerse V4.5 model for high-quality text-to-video (5-8s)'
  },
  'luma-t2v': {
    name: 'Luma Dream Machine T2V',
    endpoint: 'https://api.novita.ai/v3/async/luma-dream-machine-t2v',
    async: true,
    category: 't2v',
    defaultParams: {
      duration: '5s',
      resolution: '720p',
      aspect_ratio: '16:9',
      model: 'ray-2'
    },
    // Luma T2V uses prompt, model, resolution, duration, aspect_ratio
    supportedParams: ['prompt', 'model', 'resolution', 'duration', 'aspect_ratio', 'loop'],
    description: 'Luma Dream Machine for cinematic text-to-video generation'
  },
  'ltx-2-19b-t2v': {
    name: 'LTX-2 19B T2V (Segmind)',
    endpoint: 'https://api.segmind.com/v1/ltx-2-19b-t2v',
    async: false, // Segmind returns video directly (synchronous)
    provider: 'segmind', // Custom provider flag to differentiate from Novita
    category: 't2v',
    defaultParams: {
      width: 1024,
      height: 768,
      num_frames: 161,
      fps: 24,
      seed: 1234567890,
      guidance_scale: 4
    },
    // LTX-2 19B T2V parameters based on Segmind API documentation
    supportedParams: ['prompt', 'negative_prompt', 'width', 'height', 'num_frames', 'fps', 'seed', 'guidance_scale'],
    description: 'LTX-2 via Segmind - generates synchronized video from text prompts (up to 400 frames, 24fps)'
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
  console.log('[VideoDashboard-Utils] ========== initializeVideoTest START ==========');
  console.log('[VideoDashboard-Utils] Model ID:', modelId);
  console.log('[VideoDashboard-Utils] Params received:', {
    prompt: params.prompt?.substring(0, 100) + (params.prompt?.length > 100 ? '...' : ''),
    duration: params.duration,
    aspectRatio: params.aspectRatio,
    imageUrl: params.imageUrl ? `[BASE64 - ${params.imageUrl.length} chars]` : 'NOT PROVIDED',
    image: params.image ? `[BASE64 - ${params.image.length} chars]` : 'NOT PROVIDED',
    video_file: params.video_file ? `[BASE64 - ${params.video_file.length} chars]` : 'NOT PROVIDED',
    face_image_file: params.face_image_file ? `[BASE64 - ${params.face_image_file.length} chars]` : 'NOT PROVIDED'
  });
  
  const config = VIDEO_MODEL_CONFIGS[modelId];
  if (!config) {
    console.log('[VideoDashboard-Utils] ❌ Unknown model:', modelId);
    throw new Error(`Unknown model: ${modelId}`);
  }

  console.log('[VideoDashboard-Utils] Model config found:', config.name);
  console.log('[VideoDashboard-Utils] Endpoint:', config.endpoint);
  console.log('[VideoDashboard-Utils] Category:', config.category);
  console.log('[VideoDashboard-Utils] Async:', config.async);

  const startTime = Date.now();
  console.log(`[VideoDashboard-Utils] 🚀 Starting ${config.name} generation at ${new Date().toISOString()}`);
  console.log(`[VideoDashboard-Utils] Prompt: ${params.prompt?.substring(0, 100)}${params.prompt?.length > 100 ? '...' : ''}`);
  console.log(`[VideoDashboard-Utils] Category: ${config.category}`);

  // Validate requirements based on category
  if (config.category === 'i2v' && !params.imageUrl && !params.image) {
    console.log('[VideoDashboard-Utils] ❌ I2V mode but no image provided');
    throw new Error(`${config.name} requires an image input`);
  }
  
  if (config.category === 'face' && (!params.video_file || !params.face_image_file)) {
    console.log('[VideoDashboard-Utils] ❌ Face mode but missing video or face image');
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
      // Text-to-Video models - handle different API structures
      
      if (modelId === 'hunyuan-video-fast') {
        // Hunyuan uses model_name, width, height, steps structure
        requestBody = {
          model_name: config.defaultParams.model_name || 'hunyuan-video-fast',
          prompt: validatedPrompt,
          width: params.width || config.defaultParams.width || 1280,
          height: params.height || config.defaultParams.height || 720,
          steps: params.steps || config.defaultParams.steps || 20,
          seed: params.seed !== undefined ? params.seed : -1
        };
        
      } else if (modelId === 'wan-t2v') {
        // Wan 2.1 T2V - flat structure with width/height
        requestBody = {
          prompt: validatedPrompt
        };
        
        // Wan 2.1 uses width/height
        const resolution = params.resolution || config.defaultParams.resolution || '720p';
        if (resolution === '720p' || resolution === '720P') {
          requestBody.width = 1280;
          requestBody.height = 720;
        } else if (resolution === '480p' || resolution === '480P') {
          requestBody.width = 832;
          requestBody.height = 480;
        }
        
        if (params.seed !== undefined) requestBody.seed = params.seed;
        if (params.negative_prompt) requestBody.negative_prompt = params.negative_prompt;
        
      } else if (modelId === 'wan-2.2-t2v' || modelId === 'wan-2.5-t2v-preview' || modelId === 'wan2.6-t2v') {
        // Wan 2.2, 2.5, 2.6 T2V - nested input/parameters structure
        const resolution = params.resolution || config.defaultParams.resolution || '720P';
        const duration = parseInt(params.duration || config.defaultParams.duration || '5', 10);
        
        // Wan T2V uses "size" parameter like "1280*720" or "1920*1080"
        let size = '1280*720'; // default 720p
        if (resolution === '1080p' || resolution === '1080P') {
          size = '1920*1080';
        } else if (resolution === '480p' || resolution === '480P') {
          size = '832*480';
        }
        
        requestBody = {
          input: {
            prompt: validatedPrompt
          },
          parameters: {
            size: size,
            duration: duration
          }
        };
        
        // Add negative_prompt
        if (params.negative_prompt) {
          requestBody.input.negative_prompt = params.negative_prompt;
        }
        
        // Add optional parameters
        if (params.seed !== undefined) {
          requestBody.parameters.seed = params.seed;
        }
        if (params.prompt_extend !== undefined) {
          requestBody.parameters.prompt_extend = params.prompt_extend;
        }
        
        // Wan 2.5 and 2.6 support audio
        if (modelId === 'wan-2.5-t2v-preview' || modelId === 'wan2.6-t2v') {
          if (params.audio_url) {
            requestBody.input.audio_url = params.audio_url;
          }
          if (params.audio !== undefined) {
            requestBody.parameters.audio = params.audio;
          }
        }
        
        // Wan 2.6 specific params
        if (modelId === 'wan2.6-t2v') {
          if (params.shot_type) requestBody.parameters.shot_type = params.shot_type;
          if (params.watermark !== undefined) requestBody.parameters.watermark = params.watermark;
        }
        
      } else if (modelId === 'ltx-2-19b-t2v') {
        // LTX-2 19B T2V via Segmind API - flat structure
        requestBody = {
          prompt: validatedPrompt,
          width: params.width || config.defaultParams.width || 1024,
          height: params.height || config.defaultParams.height || 768,
          num_frames: params.num_frames || config.defaultParams.num_frames || 161,
          fps: params.fps || config.defaultParams.fps || 24,
          guidance_scale: params.guidance_scale !== undefined ? params.guidance_scale : (config.defaultParams.guidance_scale || 4)
        };
        
        // Add negative prompt if provided
        if (params.negative_prompt) {
          requestBody.negative_prompt = params.negative_prompt;
        }
        
        // Add seed if provided
        if (params.seed !== undefined && params.seed !== null) {
          requestBody.seed = params.seed;
        } else {
          requestBody.seed = config.defaultParams.seed || 1234567890;
        }
        
      } else {
        // Generic T2V models (Kling, Minimax, PixVerse, Luma, etc.)
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
      }
    } else if (config.category === 'i2v') {
      // Image-to-Video models
      const imageData = params.imageUrl || params.image;
      
      // Handle different Wan model versions - they have different API structures
      if (modelId === 'wan-i2v') {
        // Wan 2.1 uses flat structure with image_url parameter
        requestBody = {
          image_url: imageData,
          prompt: validatedPrompt
        };
        
        // Wan 2.1 uses width/height instead of resolution string
        // Supported: 480x832, 832x480, 720x1280, 1280x720
        const resolution = params.resolution || config.defaultParams.resolution || '720p';
        if (resolution === '720p' || resolution === '720P') {
          requestBody.width = 1280;
          requestBody.height = 720;
        } else if (resolution === '480p' || resolution === '480P') {
          requestBody.width = 832;
          requestBody.height = 480;
        }
        
        // Add optional Wan 2.1 params
        if (params.steps) requestBody.steps = params.steps;
        if (params.guidance_scale !== undefined) requestBody.guidance_scale = params.guidance_scale;
        if (params.flow_shift !== undefined) requestBody.flow_shift = params.flow_shift;
        if (params.seed !== undefined) requestBody.seed = params.seed;
        if (params.negative_prompt) requestBody.negative_prompt = params.negative_prompt;
        
      } else if (modelId === 'wan-2.2-i2v' || modelId === 'wan-2.5-i2v-preview' || modelId === 'wan2.6-i2v') {
        // Wan 2.2, 2.5, 2.6 use nested input/parameters structure with img_url
        const resolution = params.resolution || config.defaultParams.resolution || '720p';
        const duration = parseInt(params.duration || config.defaultParams.duration || '5', 10);
        
        requestBody = {
          input: {
            img_url: imageData,
            prompt: validatedPrompt
          },
          parameters: {
            resolution: resolution.toUpperCase().replace('P', 'P'), // Ensure format like "720P"
            duration: duration
          }
        };
        
        // Add negative_prompt to input if provided
        if (params.negative_prompt) {
          requestBody.input.negative_prompt = params.negative_prompt;
        }
        
        // Add optional parameters
        if (params.seed !== undefined) {
          requestBody.parameters.seed = params.seed;
        }
        if (params.prompt_extend !== undefined) {
          requestBody.parameters.prompt_extend = params.prompt_extend;
        }
        
        // Wan 2.5 and 2.6 support audio
        if (modelId === 'wan-2.5-i2v-preview' || modelId === 'wan2.6-i2v') {
          if (params.audio_url) {
            requestBody.input.audio_url = params.audio_url;
          }
          if (params.audio !== undefined) {
            requestBody.parameters.audio = params.audio;
          }
        }
        
        // Wan 2.6 specific params
        if (modelId === 'wan2.6-i2v') {
          if (params.template) requestBody.template = params.template;
          if (params.shot_type) requestBody.shot_type = params.shot_type;
          if (params.watermark !== undefined) requestBody.watermark = params.watermark;
        }
        
      } else if (modelId === 'minimax-i2v') {
        // Minimax uses image_url parameter, fixed 6-second output
        requestBody = {
          prompt: validatedPrompt,
          image_url: imageData
        };
        
        // Add enable_prompt_expansion
        if (params.enable_prompt_expansion !== undefined) {
          requestBody.enable_prompt_expansion = params.enable_prompt_expansion;
        } else if (config.defaultParams.enable_prompt_expansion !== undefined) {
          requestBody.enable_prompt_expansion = config.defaultParams.enable_prompt_expansion;
        }
        
      } else if (modelId === 'vidu-i2v') {
        // Vidu Q1 uses image parameter (singular), fixed 5s duration, 1080p only
        requestBody = {
          image: imageData,
          prompt: validatedPrompt
        };
        
        // Add Vidu-specific params
        if (params.style || config.defaultParams.style) {
          requestBody.style = params.style || config.defaultParams.style;
        }
        if (params.resolution || config.defaultParams.resolution) {
          requestBody.resolution = params.resolution || config.defaultParams.resolution;
        }
        if (params.aspectRatio || params.aspect_ratio || config.defaultParams.aspect_ratio) {
          requestBody.aspect_ratio = params.aspectRatio || params.aspect_ratio || config.defaultParams.aspect_ratio;
        }
        if (params.movement_amplitude || config.defaultParams.movement_amplitude) {
          requestBody.movement_amplitude = params.movement_amplitude || config.defaultParams.movement_amplitude;
        }
        if (params.duration || config.defaultParams.duration) {
          requestBody.duration = parseInt(params.duration || config.defaultParams.duration, 10);
        }
        if (params.seed !== undefined) {
          requestBody.seed = params.seed;
        }
        if (params.bgm !== undefined) {
          requestBody.bgm = params.bgm;
        }
        
      } else if (modelId === 'pixverse-i2v') {
        // PixVerse uses image parameter, supports resolution/style/fast_mode
        requestBody = {
          image: imageData,
          prompt: validatedPrompt
        };
        
        // Add resolution (required)
        requestBody.resolution = params.resolution || config.defaultParams.resolution || '540p';
        
        // Add optional params
        if (params.negative_prompt) {
          requestBody.negative_prompt = params.negative_prompt;
        }
        if (params.fast_mode !== undefined) {
          requestBody.fast_mode = params.fast_mode;
        } else if (config.defaultParams.fast_mode !== undefined) {
          requestBody.fast_mode = config.defaultParams.fast_mode;
        }
        if (params.style) {
          requestBody.style = params.style;
        }
        if (params.seed !== undefined) {
          requestBody.seed = params.seed;
        }
        
      } else if (modelId === 'seedance-i2v') {
        // Seedance 1.5 Pro uses image parameter (URL or Base64)
        requestBody = {
          image: imageData,
          prompt: validatedPrompt
        };
        
        // Add duration (4-12 seconds)
        const duration = parseInt(params.duration || config.defaultParams.duration || '5', 10);
        requestBody.duration = Math.max(4, Math.min(12, duration));
        
        // Add resolution (480p or 720p only)
        requestBody.resolution = params.resolution || config.defaultParams.resolution || '720p';
        
        // Add optional params
        if (params.ratio || config.defaultParams.ratio) {
          requestBody.ratio = params.ratio || config.defaultParams.ratio;
        }
        if (params.fps || config.defaultParams.fps) {
          requestBody.fps = params.fps || config.defaultParams.fps;
        }
        if (params.seed !== undefined) {
          requestBody.seed = params.seed;
        }
        if (params.watermark !== undefined) {
          requestBody.watermark = params.watermark;
        }
        if (params.last_image) {
          requestBody.last_image = params.last_image;
        }
        if (params.camera_fixed !== undefined) {
          requestBody.camera_fixed = params.camera_fixed;
        } else if (config.defaultParams.camera_fixed !== undefined) {
          requestBody.camera_fixed = config.defaultParams.camera_fixed;
        }
        if (params.generate_audio !== undefined) {
          requestBody.generate_audio = params.generate_audio;
        } else if (config.defaultParams.generate_audio !== undefined) {
          requestBody.generate_audio = config.defaultParams.generate_audio;
        }
        
      } else if (modelId === 'luma-i2v') {
        // Luma Dream Machine uses keyframes structure for I2V
        requestBody = {
          prompt: validatedPrompt,
          keyframes: {
            frame0: {
              type: 'image',
              url: imageData
            }
          }
        };
        
        // Add model
        if (params.model || config.defaultParams.model) {
          requestBody.model = params.model || config.defaultParams.model;
        }
        
        // Add resolution
        if (params.resolution || config.defaultParams.resolution) {
          requestBody.resolution = params.resolution || config.defaultParams.resolution;
        }
        
        // Add duration (format: "5s", "10s")
        if (params.duration || config.defaultParams.duration) {
          const dur = params.duration || config.defaultParams.duration;
          requestBody.duration = typeof dur === 'string' && dur.endsWith('s') ? dur : `${dur}s`;
        }
        
        // Add aspect ratio
        if (params.aspectRatio || params.aspect_ratio || config.defaultParams.aspect_ratio) {
          requestBody.aspect_ratio = params.aspectRatio || params.aspect_ratio || config.defaultParams.aspect_ratio;
        }
        
        // Add loop
        if (params.loop !== undefined) {
          requestBody.loop = params.loop;
        }
        
      } else if (modelId === 'wan-2.2-i2v-fast') {
        // Wan 2.2 I2V Fast via Segmind API
        // Uses flat structure with image URL and specific parameters
        // Segmind requires a URL, not base64 data - upload to S3 first
        let imageUrl = imageData;
        if (imageData && imageData.startsWith('data:')) {
          console.log('[VideoDashboard-Utils] 📤 Uploading base64 image to S3 for Segmind...');
          try {
            // Extract base64 data from data URI
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const hash = createHash('md5').update(imageBuffer).digest('hex');
            imageUrl = await uploadToS3(imageBuffer, hash, 'segmind_input.jpg');
            console.log('[VideoDashboard-Utils] ✅ Image uploaded to S3:', imageUrl.substring(0, 100) + '...');
          } catch (uploadError) {
            console.error('[VideoDashboard-Utils] ❌ Failed to upload image to S3:', uploadError.message);
            throw new Error('Failed to upload image for video generation: ' + uploadError.message);
          }
        }
        
        requestBody = {
          image: imageUrl,
          prompt: validatedPrompt,
          go_fast: params.go_fast !== undefined ? params.go_fast : config.defaultParams.go_fast,
          num_frames: params.num_frames || config.defaultParams.num_frames || 81,
          resolution: params.resolution || config.defaultParams.resolution || '480p',
          aspect_ratio: params.aspectRatio || params.aspect_ratio || config.defaultParams.aspect_ratio || '16:9',
          sample_shift: params.sample_shift || config.defaultParams.sample_shift || 12,
          frames_per_second: params.frames_per_second || config.defaultParams.frames_per_second || 16
        };
        
        // Add negative prompt if provided
        if (params.negative_prompt) {
          requestBody.negative_prompt = params.negative_prompt;
        }
        
        // Add optional last_image for guiding final frame
        if (params.last_image) {
          requestBody.last_image = params.last_image;
        }
        
        // Add seed if provided
        if (params.seed !== undefined && params.seed !== null) {
          requestBody.seed = params.seed;
        }
        
        // LoRA scale parameters (keep defaults)
        requestBody.high_noise_lora_scale = 1;
        requestBody.low_noise_lora_scale = 1;
        requestBody.high_noise_lora_scale_2 = 1;
        requestBody.low_noise_lora_scale_2 = 1;
        requestBody.high_noise_lora_scale_3 = 1;
        requestBody.low_noise_lora_scale_3 = 1;
        
      } else {
        // Kling and other generic I2V models - use image parameter
        requestBody = {
          image: imageData,
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
    }
    
    // Add webhook for async models
    if (config.async && webhookUrl) {
      requestBody.extra = {
        webhook: {
          url: webhookUrl
        }
      };
      console.log(`[VideoDashboard-Utils] Added webhook URL: ${webhookUrl}`);
    }

    // Log the request body (with truncated base64 data for readability)
    const logSafeRequestBody = JSON.stringify(requestBody, (key, value) => {
      if (typeof value === 'string' && value.length > 200 && (value.startsWith('data:') || value.startsWith('http'))) {
        return value.substring(0, 100) + `... [${value.length} chars total]`;
      }
      return value;
    }, 2);
    console.log(`[VideoDashboard-Utils] Request body (truncated):`, logSafeRequestBody);
    console.log(`[VideoDashboard-Utils] Full request body size:`, JSON.stringify(requestBody).length, 'chars');

    console.log(`[VideoDashboard-Utils] 📤 Sending POST request to: ${config.endpoint}`);
    
    const requestStartTime = Date.now();
    
    // Handle Segmind provider differently
    if (config.provider === 'segmind') {
      console.log(`[VideoDashboard-Utils] Using Segmind API`);
      console.log(`[VideoDashboard-Utils] Segmind API Key present: ${!!process.env.SEGMIND_API_KEY}`);
      
      // Segmind returns raw video binary data, not a URL
      const response = await axios.post(config.endpoint, requestBody, {
        headers: {
          'x-api-key': process.env.SEGMIND_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer', // Expect binary data
        timeout: 300000 // 5 minutes timeout for video generation
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log(`[VideoDashboard-Utils] 📥 Segmind response received in ${requestDuration}ms`);
      console.log(`[VideoDashboard-Utils] Response status: ${response.status}`);
      console.log(`[VideoDashboard-Utils] Response content-type: ${response.headers['content-type']}`);
      console.log(`[VideoDashboard-Utils] Response data size: ${response.data?.byteLength || response.data?.length} bytes`);
      
      if (response.status !== 200) {
        // Try to parse error message from response
        let errorMsg = `Segmind API returned status ${response.status}`;
        try {
          const errorText = Buffer.from(response.data).toString('utf-8');
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.message || errorJson.error || errorMsg;
        } catch (e) {
          // Ignore parsing errors
        }
        console.log(`[VideoDashboard-Utils] ❌ Non-200 status: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Segmind returns raw video binary data directly
      const videoBuffer = Buffer.from(response.data);
      
      // Check if it's actually video data (MP4 starts with 'ftyp' signature)
      const headerStr = videoBuffer.slice(0, 12).toString('utf-8');
      const isVideo = headerStr.includes('ftyp') || headerStr.includes('moov');
      
      if (!isVideo && videoBuffer.length < 1000) {
        // Small response might be an error message
        const responseText = videoBuffer.toString('utf-8');
        console.error(`[VideoDashboard-Utils] ❌ Unexpected Segmind response:`, responseText.substring(0, 500));
        throw new Error('Unexpected response from Segmind API: ' + responseText.substring(0, 200));
      }
      
      console.log(`[VideoDashboard-Utils] ✅ Segmind video generated successfully`);
      console.log(`[VideoDashboard-Utils]   - Video size: ${videoBuffer.length} bytes`);
      console.log(`[VideoDashboard-Utils]   - Is video: ${isVideo}`);
      
      // Upload video binary directly to S3
      let finalVideoUrl;
      try {
        console.log(`[VideoDashboard-Utils] 📤 Uploading video to S3...`);
        const hash = createHash('md5').update(videoBuffer).digest('hex');
        finalVideoUrl = await uploadToS3(videoBuffer, hash, 'segmind_video.mp4');
        console.log(`[VideoDashboard-Utils] ✅ Video uploaded to S3: ${finalVideoUrl.substring(0, 100)}...`);
      } catch (uploadError) {
        console.error(`[VideoDashboard-Utils] ❌ Failed to upload to S3:`, uploadError.message);
        throw new Error('Failed to upload video to S3: ' + uploadError.message);
      }
      
      console.log('[VideoDashboard-Utils] ========== initializeVideoTest END (Segmind) ==========');
      
      // For Segmind, we return completed status since it's synchronous
      const taskId = `segmind_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      return {
        modelId,
        modelName: config.name,
        category: config.category,
        taskId,
        startTime,
        status: 'completed',
        async: false,
        videoUrl: finalVideoUrl,
        generationTime: requestDuration
      };
    }
    
    // Novita and other async APIs
    console.log(`[VideoDashboard-Utils] API Key present: ${!!process.env.NOVITA_API_KEY}`);
    console.log(`[VideoDashboard-Utils] API Key (first 10 chars): ${process.env.NOVITA_API_KEY?.substring(0, 10)}...`);
    
    const response = await axios.post(config.endpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutes timeout
    });

    const requestDuration = Date.now() - requestStartTime;
    console.log(`[VideoDashboard-Utils] 📥 Response received in ${requestDuration}ms`);
    console.log(`[VideoDashboard-Utils] Response status: ${response.status}`);
    console.log(`[VideoDashboard-Utils] Response headers:`, JSON.stringify(response.headers, null, 2));
    console.log(`[VideoDashboard-Utils] Response data:`, JSON.stringify(response.data, null, 2));

    if (response.status !== 200) {
      const errorMsg = response.data?.message || response.data?.error || `API returned status ${response.status}`;
      console.log(`[VideoDashboard-Utils] ❌ Non-200 status: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Async API returns task_id
    const taskId = response.data.task_id || response.data.data?.task_id || response.data.id;
    console.log(`[VideoDashboard-Utils] Looking for task_id in response...`);
    console.log(`[VideoDashboard-Utils]   - response.data.task_id: ${response.data.task_id}`);
    console.log(`[VideoDashboard-Utils]   - response.data.data?.task_id: ${response.data.data?.task_id}`);
    console.log(`[VideoDashboard-Utils]   - response.data.id: ${response.data.id}`);
    console.log(`[VideoDashboard-Utils]   - Resolved task_id: ${taskId}`);
    
    if (!taskId) {
      console.error(`[VideoDashboard-Utils] ❌ No task_id found in response:`, JSON.stringify(response.data, null, 2));
      throw new Error('No task_id returned from API. Response: ' + JSON.stringify(response.data));
    }
    
    console.log(`[VideoDashboard-Utils] ✅ Task created successfully`);
    console.log(`[VideoDashboard-Utils]   - Task ID: ${taskId}`);
    console.log(`[VideoDashboard-Utils]   - Model: ${config.name}`);
    console.log(`[VideoDashboard-Utils]   - Category: ${config.category}`);
    console.log('[VideoDashboard-Utils] ========== initializeVideoTest END ==========');
    
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
    console.error(`[VideoDashboard-Utils] ❌ Error with ${config.name}:`, error.message);
    
    let errorMessage = error.message;
    
    if (error.response) {
      console.error(`[VideoDashboard-Utils] Response status:`, error.response.status);
      console.error(`[VideoDashboard-Utils] Response data:`, JSON.stringify(error.response.data, null, 2));
      console.error(`[VideoDashboard-Utils] Response headers:`, JSON.stringify(error.response.headers, null, 2));
      
      const data = error.response.data;
      if (data?.message) {
        errorMessage = data.message;
      } else if (data?.error) {
        errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
    } else if (error.request) {
      console.error(`[VideoDashboard-Utils] No response received (request made but no response)`);
      console.error(`[VideoDashboard-Utils] Request config:`, {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
    } else {
      console.error(`[VideoDashboard-Utils] Error setting up request:`, error.message);
    }
    
    console.error(`[VideoDashboard-Utils] Error stack:`, error.stack);
    console.log('[VideoDashboard-Utils] ========== initializeVideoTest END (ERROR) ==========');
    
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
  console.log('[VideoDashboard-Utils] ========== checkVideoTaskResult START ==========');
  console.log('[VideoDashboard-Utils] Task ID:', taskId);
  console.log('[VideoDashboard-Utils] Timestamp:', new Date().toISOString());
  
  try {
    const apiUrl = `https://api.novita.ai/v3/async/task-result?task_id=${taskId}`;
    console.log('[VideoDashboard-Utils] 📤 Fetching task status from:', apiUrl);
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`
      },
      timeout: 10000
    });

    console.log('[VideoDashboard-Utils] 📥 Response received');
    console.log('[VideoDashboard-Utils] Response status:', response.status);
    console.log('[VideoDashboard-Utils] Response data:', JSON.stringify(response.data, null, 2));

    const taskData = response.data.task || response.data.data?.task || {};
    const taskStatus = taskData.status || response.data.status;
    const progressPercent = taskData.progress_percent || response.data.progress_percent || 0;

    console.log('[VideoDashboard-Utils] Parsed task data:');
    console.log('[VideoDashboard-Utils]   - taskStatus:', taskStatus);
    console.log('[VideoDashboard-Utils]   - progressPercent:', progressPercent);
    console.log('[VideoDashboard-Utils]   - taskData.reason:', taskData.reason);
    console.log('[VideoDashboard-Utils]   - taskData.eta:', taskData.eta);

    if (taskStatus === 'TASK_STATUS_SUCCEED' || taskStatus === 'succeed') {
      const videos = response.data.videos || response.data.data?.videos || [];
      
      console.log(`[VideoDashboard-Utils] ✅ Task ${taskId} completed with ${videos.length} video(s)`);
      console.log('[VideoDashboard-Utils] Videos array:', JSON.stringify(videos, null, 2));
      
      // Download video and upload to S3
      let s3VideoUrl = null;
      if (videos.length > 0 && videos[0].video_url) {
        console.log('[VideoDashboard-Utils] 📥 Downloading video from:', videos[0].video_url);
        try {
          const videoResponse = await axios.get(videos[0].video_url, { 
            responseType: 'arraybuffer',
            timeout: 120000
          });
          console.log('[VideoDashboard-Utils] Video downloaded, size:', videoResponse.data.length, 'bytes');
          
          const videoBuffer = Buffer.from(videoResponse.data);
          const hash = createHash('md5').update(videoBuffer).digest('hex');
          console.log('[VideoDashboard-Utils] Video hash:', hash);
          
          console.log('[VideoDashboard-Utils] 📤 Uploading to S3...');
          s3VideoUrl = await uploadToS3(videoBuffer, hash, 'dashboard_video.mp4');
          console.log(`[VideoDashboard-Utils] ✅ Video uploaded to S3: ${s3VideoUrl}`);
        } catch (uploadError) {
          console.error(`[VideoDashboard-Utils] ❌ Failed to upload to S3:`, uploadError.message);
          console.error(`[VideoDashboard-Utils] Upload error stack:`, uploadError.stack);
          s3VideoUrl = videos[0].video_url; // Fallback to Novita URL
          console.log('[VideoDashboard-Utils] Using fallback Novita URL:', s3VideoUrl);
        }
      } else {
        console.log('[VideoDashboard-Utils] ⚠️ No videos or no video_url in response');
        console.log('[VideoDashboard-Utils] videos.length:', videos.length);
        console.log('[VideoDashboard-Utils] videos[0]?.video_url:', videos[0]?.video_url);
      }
      
      const result = {
        status: 'completed',
        progress: 100,
        videos: videos.map(video => ({
          videoUrl: s3VideoUrl || video.video_url || video.url,
          duration: video.duration
        }))
      };
      console.log('[VideoDashboard-Utils] Returning completed result:', JSON.stringify(result, null, 2));
      console.log('[VideoDashboard-Utils] ========== checkVideoTaskResult END ==========');
      return result;
      
    } else if (taskStatus === 'TASK_STATUS_FAILED' || taskStatus === 'failed') {
      const reason = taskData.reason || response.data.reason || response.data.error || 'Unknown error';
      console.error(`[VideoDashboard-Utils] ❌ Task ${taskId} failed: ${reason}`);
      console.error('[VideoDashboard-Utils] Full taskData:', JSON.stringify(taskData, null, 2));
      
      const result = {
        status: 'failed',
        error: reason,
        progress: 0
      };
      console.log('[VideoDashboard-Utils] Returning failed result:', JSON.stringify(result, null, 2));
      console.log('[VideoDashboard-Utils] ========== checkVideoTaskResult END ==========');
      return result;
      
    } else if (taskStatus === 'TASK_STATUS_QUEUED' || taskStatus === 'TASK_STATUS_PROCESSING' || taskStatus === 'queued' || taskStatus === 'processing') {
      const result = {
        status: 'processing',
        progress: progressPercent,
        eta: taskData.eta || null
      };
      console.log('[VideoDashboard-Utils] Task still processing:', JSON.stringify(result, null, 2));
      console.log('[VideoDashboard-Utils] ========== checkVideoTaskResult END ==========');
      return result;
      
    } else {
      console.warn(`[VideoDashboard-Utils] ⚠️ Unknown task status: ${taskStatus} for task ${taskId}`);
      console.warn('[VideoDashboard-Utils] Full response.data:', JSON.stringify(response.data, null, 2));
      const result = {
        status: 'processing',
        progress: progressPercent
      };
      console.log('[VideoDashboard-Utils] Returning processing (unknown status):', JSON.stringify(result, null, 2));
      console.log('[VideoDashboard-Utils] ========== checkVideoTaskResult END ==========');
      return result;
    }
  } catch (error) {
    console.error(`[VideoDashboard-Utils] ❌ Error checking task ${taskId}:`, error.message);
    console.error('[VideoDashboard-Utils] Error stack:', error.stack);
    
    if (error.response) {
      console.error('[VideoDashboard-Utils] Response status:', error.response.status);
      console.error('[VideoDashboard-Utils] Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('[VideoDashboard-Utils] No response received');
    }
    
    const result = {
      status: 'error',
      error: error.message || 'Failed to check task status',
      progress: 0
    };
    console.log('[VideoDashboard-Utils] Returning error result:', JSON.stringify(result, null, 2));
    console.log('[VideoDashboard-Utils] ========== checkVideoTaskResult END (ERROR) ==========');
    return result;
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
