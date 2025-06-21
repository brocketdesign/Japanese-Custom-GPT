const { generatePromptTitle } = require('./openai')
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { ObjectId } = require('mongodb');
const axios = require('axios');
const { createHash } = require('crypto');
const { addNotification, saveChatImageToDB, getLanguageName, uploadToS3 } = require('../models/tool')
const { getUserMinImages, getAutoMergeFaceSetting } = require('../models/chat-tool-settings-utils')
const { awardImageGenerationReward, awardImageMilestoneReward } = require('./user-points-utils');
const slugify = require('slugify');
const sharp = require('sharp');
const { time } = require('console');
const default_prompt = {
    sdxl: {
      sfw: {
        sampler_name: "Euler a",
        prompt: `score_9, score_8_up, masterpiece, best quality, (ultra-detailed), (perfect hands:0.1), (sfw), uncensored, `,
        negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, nipple, topless, nsfw, naked, nude, sex, worst quality, low quality,young,child,dick,bad quality,worst quality,worst detail,sketch`,
        width: 1024,
        height: 1360,
        seed: -1,
        loras: []
      },
      nsfw: {
        sampler_name: "Euler a",
        prompt: `score_9, score_8_up, masterpiece, best quality, (ultra-detailed), (perfect hands:0.1),`,
        negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, worst quality, low quality,child,bad quality,worst quality,worst detail,sketch`,
        width: 1024,
        height: 1360,
        seed: -1,
        loras: []
      }
    },
    sd: {
      sfw: {
        sampler_name: "DPM++ 2M Karras",
        prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (sfw), dressed, clothe on, natural lighting, `,
        negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo, nsfw,nude, topless, worst quality, low quality,disform,weird body,multiple hands,young,child,dick,bad quality,worst quality,worst detail,sketch `,
        loras: [{"model_name":"more_details_59655.safetensors","strength":0.2},{ model_name: 'JapaneseDollLikeness_v15_28382.safetensors', strength: 0.7 },{"model_name":"PerfectFullBreasts-fCV3_59759.safetensors","strength":0.7}],
        seed: -1,
      },
      nsfw: {
        sampler_name: "DPM++ 2M Karras",
        prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (nsfw),uncensored, `,
        negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo,disform,weird body,multiple hands,child,bad quality,worst quality,worst detail,sketch`,
        loras: [{"model_name":"more_details_59655.safetensors","strength":0.2},{ model_name: 'JapaneseDollLikeness_v15_28382.safetensors', strength: 0.7 },{"model_name":"PerfectFullBreasts-fCV3_59759.safetensors","strength":0.7}],
        seed: -1,
      }
    },
    flux: {
      sfw:{
        sampler_name: 'euler',
        prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (sfw), dressed, clothe on, natural lighting, `,
        seed: 0,
      },
      nsfw:{
        sampler_name: 'euler',
        prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (nsfw),uncensored, `,
        seed: 0,
      }
    }
  };    
  
  const params = {
    model_name: "novaAnimeXL_ponyV20_461138.safetensors",
    prompt: '',
    negative_prompt: '',
    width: 701,
    height: 1024,
    sampler_name: "Euler a",
    guidance_scale: 7,
    steps: 30,
    image_num: 1,
    clip_skip: 0,
    strength: 0.65,
    loras: [],
  } 

// Module to generate an image
async function generateImg({title, prompt, negativePrompt, aspectRatio, imageSeed, modelId, regenerate, userId, chatId, userChatId, imageType, image_num, image_base64, chatCreation, placeholderId, translations, fastify, flux = false, customPromptId = null, customGiftId = null, enableMergeFace = false}) {
    const db = fastify.mongo.db;

    // Fetch the user
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new Error('User not found');
    }
  
    // Fetch user subscription status
    const isSubscribed = user.subscriptionStatus === 'active';
  
    // Fetch imageVersion from chat or use default
    const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
    const imageVersion = chat.imageVersion || 'sdxl';
    const selectedStyle = !flux ? default_prompt[imageVersion] || default_prompt['sdxl'] : default_prompt.flux;
    
    let imageModel = chat.imageModel || 'novaAnimeXL_ponyV20_461138';
    if(modelId && regenerate){
      try {
          const modelData = await db.collection('myModels').findOne({ modelId:modelId.toString() });
          imageModel = modelData?.model || imageModel;
      } catch (error) {
        console.error('Error fetching model data:', error);
      }
    }

    
    const gender = chat.gender

    // Custom negative prompt by gender
    let genderNegativePrompt = '';
    if(gender == 'female'){
      genderNegativePrompt = 'muscular,manly,'
    }
    if(gender == 'male'){
      genderNegativePrompt = 'feminine,womanly,'
    }
    if(gender == 'nonBinary'){
      genderNegativePrompt = 'manly,womanly,'
    }

    // Prepare task based on imageType
    let image_request;
    if (imageType === 'sfw') {
      image_request = {
        type: 'sfw',
        model_name: imageModel.replace('.safetensors', '') + '.safetensors',
        sampler_name: selectedStyle.sfw.sampler_name || '',
        loras: selectedStyle.sfw.loras,
        prompt: (selectedStyle.sfw.prompt ? selectedStyle.sfw.prompt + prompt : prompt).replace(/^\s+/gm, '').trim(),
        negative_prompt: ((negativePrompt || selectedStyle.sfw.negative_prompt) ? (negativePrompt || selectedStyle.sfw.negative_prompt)  + ',' : '') + genderNegativePrompt,
        width: selectedStyle.sfw.width || params.width,
        height: selectedStyle.sfw.height || params.height,
        blur: false,
        seed: imageSeed || selectedStyle.sfw.seed,
        steps: regenerate ? params.steps + 10 : params.steps,
      };
    } else {
      image_request = {
        type: 'nsfw',
        model_name: imageModel.replace('.safetensors', '') + '.safetensors',
        sampler_name: selectedStyle.nsfw.sampler_name || '',
        loras: selectedStyle.nsfw.loras,
        prompt: (selectedStyle.nsfw.prompt ? selectedStyle.nsfw.prompt + prompt : prompt),
        negative_prompt: ((negativePrompt || selectedStyle.nsfw.negative_prompt) ? (negativePrompt || selectedStyle.nsfw.negative_prompt)  + ',' : '') + genderNegativePrompt,
        width: selectedStyle.nsfw.width || params.width,
        height: selectedStyle.nsfw.height || params.height,
        blur: !isSubscribed,
        seed: imageSeed || selectedStyle.nsfw.seed,
        steps: regenerate ? params.steps + 10 : params.steps,
      };
    }
    // Log imageModel
    console.log(`[generateImg] Using imageModel: ${imageModel}, imageType: ${imageType}`);
    // Add number of images to request
    const userMinImage = await getUserMinImages(db, userId, chatId);
    console.log(`[generateImg] userMinImage: ${userMinImage}, image_num: ${image_num}`);
    image_num = Math.max(image_num || 1, userMinImage || 1); // Ensure at least 1 image is requested and respect user setting

    // Prepare params
    let requestData = { ...params, ...image_request, image_num };

    if(image_base64){
      // Get target dimensions from the selected style
      const targetWidth = image_request.width;
      const targetHeight = image_request.height;
      
      // Center crop the image to match the target aspect ratio
      const croppedImage = await centerCropImage(image_base64, targetWidth, targetHeight);
      requestData.image_base64 = croppedImage;
    }

    // Send request to Novita and get taskId
    const novitaTaskId = await fetchNovitaMagic(requestData, flux);

    // Find modelId style
    let modelData = await db.collection('myModels').findOne({ model: imageModel }); 
    imageStyle = modelData ? modelData.style : 'anime';
    chat.imageStyle = chat.imageStyle || imageStyle; // Use chat image style or default to model style

    // Check if auto merge should be applied
    const autoMergeFaceEnabled = await getAutoMergeFaceSetting(db, userId.toString(), chatId.toString());
    console.log(`[generateImg] autoMergeFaceEnabled: ${autoMergeFaceEnabled}, userId: ${userId}, chatId: ${chatId}`);
    const isPhotorealistic = chat && chat.imageStyle === 'photorealistic' || chat && chat.imageStyle !== 'anime';
    console.log(`[generateImg] isPhotorealistic: ${isPhotorealistic}, chat.imageStyle: ${chat.imageStyle}`);
    
    // For character creation, use enableMergeFace setting if provided, otherwise use auto merge logic
    const shouldAutoMerge = chatCreation 
        ? (enableMergeFace && image_base64) // Only merge on character creation if explicitly enabled and has uploaded image
        : (!chatCreation && autoMergeFaceEnabled && isPhotorealistic && chat.chatImageUrl.length > 0); // Regular auto merge logic for non-character creation
    
    console.log(`[generateImg] shouldAutoMerge: ${!!shouldAutoMerge}, chatCreation: ${chatCreation}, enableMergeFace: ${enableMergeFace}, hasUploadedImage: ${!!image_base64}`);

    // Store task details in DB
    const taskData = {
        taskId: novitaTaskId,
        type: imageType,
        status: 'pending',
        prompt: prompt,
        title: {},
        negative_prompt: image_request.negative_prompt,
        aspectRatio: aspectRatio,
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId),
        userChatId: userChatId ? new ObjectId(userChatId) : null,
        blur: image_request.blur,
        chatCreation,
        placeholderId,
        createdAt: new Date(),
        updatedAt: new Date(),
        shouldAutoMerge,
        enableMergeFace: enableMergeFace || false
    };
    
    // Store original request data for character creation tasks with merge face enabled
    if (chatCreation && enableMergeFace && image_base64) {
        taskData.originalRequestData = {
            image_base64: image_base64
        };
        console.log('[generateImg] Stored original request data for character creation merge');
    }
    
    // Add custom prompt ID if provided
    if (customPromptId) {
        taskData.customPromptId = customPromptId;
    }
    
    // Add custom gift ID if provided
    if (customGiftId) {
        taskData.customGiftId = customGiftId;
    }

    await db.collection('tasks').insertOne(taskData);

    let newTitle = title;
    if (!title) {
      const lang = getLanguageName(user.lang || 'en');
      const userLangTitle = await generatePromptTitle(requestData.prompt, lang);

      // Create title object with just the user's language
      newTitle = {
        en: lang === 'english' ? userLangTitle : '',
        ja: lang === 'japanese' ? userLangTitle : '',
        fr: lang === 'french' ? userLangTitle : ''
      };
      
      // Update task with the title
      updateTitle({ taskId: novitaTaskId, newTitle, fastify, userId, chatId, placeholderId });
    }

    // Generate a slug from the prompt or title
    let taskSlug = '';
    if (title && typeof title === 'object') {
      // If title is an object with language keys, use the first available title
      const firstAvailableTitle = title.en || title.ja || title.fr || '';
      taskSlug = slugify(firstAvailableTitle.substring(0, 50), { lower: true, strict: true });
    } else if (title) {
      // If title is a string
      taskSlug = slugify(title.substring(0, 50), { lower: true, strict: true });
    } else {
      // Use the first 50 chars of the prompt if no title
      taskSlug = slugify(prompt.substring(0, 50), { lower: true, strict: true });
    }
    if(chat.slug){
      taskSlug = chat.slug + '-' + taskSlug;
    }
    // Ensure slug is unique by appending random string if needed
    const existingTask = await db.collection('tasks').findOne({ slug: taskSlug });
    if (existingTask) {
      const randomStr = Math.random().toString(36).substring(2, 6);
      taskSlug = `${taskSlug}-${randomStr}`;
    }
    
    // Update task with the slug
    updateSlug({ taskId: novitaTaskId, taskSlug, fastify, userId, chatId, placeholderId });

    if(chatCreation){
      fastify.sendNotificationToUser(userId, 'showNotification', { message:translations.character_image_generation_started , icon:'success' });
    }

    // Poll the task status
    pollTaskStatus(novitaTaskId, fastify) 
    .then(taskStatus => {
      if (taskStatus.status === 'background') {
        console.log(`[pollTaskStatus] Task ${taskStatus.taskId} moved to background`);
        return;
      }
    })
    .catch(error => {
      // error handling here
      console.error('Error initiating image generation:', error);
      fastify.sendNotificationToUser(userId, 'handleLoader', { imageId:placeholderId, action:'remove' })
      fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId:placeholderId, spin: false })
      fastify.sendNotificationToUser(userId, 'resetCharacterForm');
    });

    return { taskId: novitaTaskId };

  }

// Add this function to your code
async function centerCropImage(base64Image, targetWidth, targetHeight) {
  try {
    // Decode base64 image
    const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64');
    
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    
    // Calculate target aspect ratio
    const targetRatio = targetWidth / targetHeight;
    const sourceRatio = metadata.width / metadata.height;
    
    let extractWidth, extractHeight, left, top;
    
    if (sourceRatio > targetRatio) {
      // Source image is wider than target, crop width
      extractHeight = metadata.height;
      extractWidth = Math.round(metadata.height * targetRatio);
      top = 0;
      left = Math.round((metadata.width - extractWidth) / 2);
    } else {
      // Source image is taller than target, crop height
      extractWidth = metadata.width;
      extractHeight = Math.round(metadata.width / targetRatio);
      left = 0;
      top = Math.round((metadata.height - extractHeight) / 2);
    }
    
    // Extract the center portion and resize to target dimensions
    const croppedImageBuffer = await sharp(imageBuffer)
      .extract({ left, top, width: extractWidth, height: extractHeight })
      .resize(targetWidth, targetHeight)
      .toBuffer();
    
    // Convert back to base64
    return `data:image/${metadata.format};base64,${croppedImageBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error cropping image:', error);
    return base64Image; // Return original if error occurs
  }
}
    // Module to check the status of a task at regular intervals
    const completedTasks = new Set();

    async function pollTaskStatus(taskId, fastify) {
      let startTime = Date.now();
      const interval = 3000;
      const timeout = 2 * 60 * 1000; // 2 minutes
      let taskStarted = false;
      const db = fastify.mongo.db;
      let zeroProgressAttempts = 0;
      const maxZeroProgressAttempts = 0;

      return new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
          try {
            const taskStatus = await checkTaskStatus(taskId, fastify);
            //console.log (`[pollTaskStatus] ${taskStatus.progress != undefined ? `progress_percent: ${taskStatus.progress};`:''} status: ${taskStatus.status}; attempts: ${zeroProgressAttempts +1}/${maxZeroProgressAttempts}`);
            if(!taskStatus){
              clearInterval(intervalId);
              reject('Task not found');
              return;
            }
            if(taskStatus.status === 'failed') {
              clearInterval(intervalId);
              const taskRec = await db.collection('tasks').findOne({ taskId });
              const userDoc = await db.collection('users').findOne({ _id: taskRec.userId });
              await db.collection('tasks').updateOne({ taskId }, { $set: { status: 'failed', updatedAt: new Date() } });
              reject({ status: 'failed', taskId });
              return;
            }
            if (taskStatus.status === 'processing' && !taskStarted) {
              console.log(`[pollTaskStatus] Task ${taskId} started`);
              startTime = Date.now();
              taskStarted = true;
            }

            // Check for zero progress attempts
            if (taskStatus.status === 'processing' && (taskStatus.progress === 0 || taskStatus.progress === undefined)) {
              zeroProgressAttempts++;
              if (zeroProgressAttempts >= maxZeroProgressAttempts) {
                clearInterval(intervalId);
                // notify user and move to background processing
                const taskRec = await db.collection('tasks').findOne({ taskId });
                const userDoc = await db.collection('users').findOne({ _id: taskRec.userId });
                await db.collection('tasks').updateOne({ taskId }, { $set: { status: 'background', updatedAt: new Date() } });
                resolve({ status: 'background', taskId });
                return;
              }
            } else if (taskStatus.status === 'processing') {
              zeroProgressAttempts = 0; // Reset if progress moves
            }

            if (taskStatus.status === 'completed') {
              clearInterval(intervalId);
              if (!completedTasks.has(taskId)) {
                completedTasks.add(taskId);
                // Access requestData from the scope where it's defined
                const task = await db.collection('tasks').findOne({ taskId });
                if (task) {
                  saveAverageTaskTime(db, Date.now() - startTime, task.model_name);
                  // log the taskId and time taken
                  console.log(`[pollTaskStatus] Task ${taskId} completed in ${Date.now() - startTime} ms`);
                }
                resolve(taskStatus);
              } 
            } else if (Date.now() - startTime > timeout && taskStarted) {
              clearInterval(intervalId);
              // notify user and move to background processing
              const taskRec = await db.collection('tasks').findOne({ taskId });
              const userDoc = await db.collection('users').findOne({ _id: taskRec.userId });
              await db.collection('tasks').updateOne({ taskId }, { $set: { status: 'background', updatedAt: new Date() } });
              resolve({ status: 'background', taskId });
            }
          } catch (error) {
            clearInterval(intervalId);
            reject(error);
          }
        }, interval);
      });
    }

// Handle task completion: send notifications and save images as needed
async function handleTaskCompletion(taskStatus, fastify, options = {}) {
  const { chatCreation, translations, userId, chatId, placeholderId } = options;

  console.log('[handleTaskCompletion] Starting task completion handling with options:', {
    chatCreation,
    userId,
    chatId,
    placeholderId,
    hasTranslations: !!translations
  });

  // CRITICAL FIX: Always use the images from the current task result
  let images = [];
  
  // Try multiple ways to get the correct images with merge data
  if (taskStatus.result && Array.isArray(taskStatus.result.images)) {
    images = taskStatus.result.images;
  } else if (Array.isArray(taskStatus.images)) {
    images = taskStatus.images;
  } else if (taskStatus.result && taskStatus.result.images && !Array.isArray(taskStatus.result.images)) {
    images = [taskStatus.result.images];
  }

  console.log('[handleTaskCompletion] Processing images:', {
    imageCount: images.length,
    images: images.map((img, index) => ({
      index,
      imageId: img.imageId,
      hasImageUrl: !!img.imageUrl,
      isMerged: img.isMerged,
      hasPrompt: !!img.prompt,
      hasTitle: !!img.title,
      nsfw: img.nsfw
    }))
  });

  if (typeof fastify.sendNotificationToUser !== 'function') {
    console.error('fastify.sendNotificationToUser is not a function');
    return;
  }

  fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action: 'remove' });
  fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId: placeholderId, spin: false });

  if (Array.isArray(images)) {
    for (let index = 0; index < images.length; index++) {
      const image = images[index];
      const { imageId, imageUrl, prompt, title, nsfw, isMerged } = image;
      const { userId: taskUserId, userChatId } = taskStatus;

      console.log(`[handleTaskCompletion] Processing image ${index + 1}/${images.length}:`, {
        imageId,
        hasImageUrl: !!imageUrl,
        hasPrompt: !!prompt,
        hasTitle: !!title,
        nsfw,
        isMerged,
        userChatId,
        chatCreation
      });

      if (chatCreation) {
        fastify.sendNotificationToUser(userId, 'characterImageGenerated', { imageUrl, nsfw });
        if (index === 0) {
          console.log('[handleTaskCompletion] Saving image as character thumbnail:', userId, imageUrl);
          await saveChatImageToDB(fastify.mongo.db, chatId, imageUrl);
        }
      } else {
        const notificationData = {
          id: imageId,
          imageId,
          imageUrl,
          userChatId,
          title,
          prompt,
          nsfw,
          isMergeFace: isMerged || false,
          isAutoMerge: isMerged || false,
          url: imageUrl // Add url field for compatibility
        };
        
        console.log(`[handleTaskCompletion] Sending notification for image ${imageId}:`, {
          ...notificationData,
          imageUrl: notificationData.imageUrl?.includes('merged-face') ? 'MERGED_URL' : 'ORIGINAL_URL'
        });
        
        fastify.sendNotificationToUser(userId, 'imageGenerated', notificationData);
      }
    }
  }

  if (chatCreation) {
    fastify.sendNotificationToUser(userId, 'resetCharacterForm');
    fastify.sendNotificationToUser(userId, 'showNotification', {
      message: translations.newCharacter.imageCompletionDone_message,
      icon: 'success'
    });
    const notification = {
      title: translations.newCharacter.imageCompletionDone_title,
      message: translations.newCharacter.imageCompletionDone_message,
      link: `/chat/edit/${chatId}`,
      ico: 'success'
    };
    addNotification(fastify, userId, notification).then(() => {
      fastify.sendNotificationToUser(userId, 'updateNotificationCountOnLoad', { userId });
    });
  }

  console.log('[handleTaskCompletion] Task completion handling finished');
}

/**
 * Perform auto merge face with base64 image data (for character creation)
 * @param {Object} originalImage - Original generated image object
 * @param {string} faceImageBase64 - Base64 face image data
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Merged image object or null if failed
 */
async function performAutoMergeFaceWithBase64(originalImage, faceImageBase64, fastify) {
  try {
    const { 
      mergeFaceWithNovita, 
      optimizeImageForMerge, 
      saveMergedImageToS3
    } = require('./merge-face-utils');

    // Convert generated image URL to base64 (original image)
    const axios = require('axios');
    const generatedImageResponse = await axios.get(originalImage.imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const generatedImageBuffer = Buffer.from(generatedImageResponse.data);
    const optimizedGeneratedImage = await optimizeImageForMerge(generatedImageBuffer, 2048);
    const originalImageBase64 = optimizedGeneratedImage.base64Image;

    // Merge the faces using Novita API
    const mergeResult = await mergeFaceWithNovita({
      faceImageBase64,
      originalImageBase64
    });

    if (!mergeResult || !mergeResult.success) {
      console.error('[performAutoMergeFaceWithBase64] Face merge failed:', mergeResult?.error || 'Unknown error');
      return null;
    }

    // Generate unique merge ID
    const mergeId = new ObjectId();

    // Save merged image to S3
    const mergedImageUrl = await saveMergedImageToS3(
      `data:image/${mergeResult.imageType};base64,${mergeResult.imageBase64}`,
      mergeId.toString(),
      fastify
    );

    // Return merged image data with ALL original fields preserved
    return {
      ...originalImage, // Preserve all original image data
      imageUrl: mergedImageUrl, // Update with merged URL
      mergeId: mergeId.toString(),
      originalImageUrl: originalImage.imageUrl, // Keep reference to original
      isMerged: true
    };

  } catch (error) {
    console.error('[performAutoMergeFaceWithBase64] Error in auto merge:', error);
    return null;
  }
}

/**
 * Fetch original task data including uploaded image base64
 * @param {string} taskId - Task ID
 * @param {Object} db - Database instance
 * @returns {Object} Original task request data or null
 */
async function fetchOriginalTaskData(taskId, db) {
  try {
    const task = await db.collection('tasks').findOne({ taskId });
    
    if (!task || !task.originalRequestData) {
      console.log('[fetchOriginalTaskData] No original request data found for task:', taskId);
      return null;
    }

    return task.originalRequestData;
  } catch (error) {
    console.error('[fetchOriginalTaskData] Error fetching original task data:', error);
    return null;
  }
}

/**
 * Perform auto merge face with chat image (standalone function)
 * @param {Object} originalImage - Original generated image object
 * @param {string} chatImageUrl - Chat character image URL
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Merged image object or null if failed
 */
async function performAutoMergeFace(originalImage, chatImageUrl, fastify) {
  try {
    const { 
      mergeFaceWithNovita, 
      optimizeImageForMerge, 
      saveMergedImageToS3
    } = require('./merge-face-utils');
    

    // Convert chat image URL to base64 (face image)
    const axios = require('axios');
    const chatImageResponse = await axios.get(chatImageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const chatImageBuffer = Buffer.from(chatImageResponse.data);
    const optimizedChatImage = await optimizeImageForMerge(chatImageBuffer, 2048);
    const faceImageBase64 = optimizedChatImage.base64Image;

    // Convert generated image URL to base64 (original image)
    const generatedImageResponse = await axios.get(originalImage.imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const generatedImageBuffer = Buffer.from(generatedImageResponse.data);
    const optimizedGeneratedImage = await optimizeImageForMerge(generatedImageBuffer, 2048);
    const originalImageBase64 = optimizedGeneratedImage.base64Image;

    // Merge the faces using Novita API
    const mergeResult = await mergeFaceWithNovita({
      faceImageBase64,
      originalImageBase64
    });

    if (!mergeResult || !mergeResult.success) {
      console.error('[performAutoMergeFace] Face merge failed:', mergeResult?.error || 'Unknown error');
      return null;
    }

    // Generate unique merge ID
    const mergeId = new ObjectId();

    // Save merged image to S3
    const mergedImageUrl = await saveMergedImageToS3(
      `data:image/${mergeResult.imageType};base64,${mergeResult.imageBase64}`,
      mergeId.toString(),
      fastify
    );

    // Return merged image data with ALL original fields preserved
    return {
      ...originalImage, // Preserve all original image data
      imageUrl: mergedImageUrl, // Update with merged URL
      mergeId: mergeId.toString(),
      originalImageUrl: originalImage.imageUrl, // Keep reference to original
      isMerged: true
    };

  } catch (error) {
    console.error('[performAutoMergeFace] Error in auto merge:', error);
    return null;
  }
}

// Module to check the status of a task
async function getTasks(db, status, userId) {
  try {
    await deleteOldPendingAndFailedTasks(db) // Delete old tasks before fetching
    const tasksCollection = db.collection('tasks');
    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = new ObjectId(userId);
    const tasks = await tasksCollection.find(query).toArray();
    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
};

// Module to save the average task time
async function saveAverageTaskTime(db, time, modelName) {
  try {
    const models = db.collection('myModels');
    const result = await models.findOneAndUpdate(
      { model: modelName },
      [{
        $set: {
          taskTimeCount: { $add: [{ $ifNull: ['$taskTimeCount', 0] }, 1] },
          taskTimeAvg: {
            $divide: [
              {
                $add: [
                  { $multiply: [{ $ifNull: ['$taskTimeAvg', 0] }, { $ifNull: ['$taskTimeCount', 0] }] },
                  time
                ]
              },
              { $add: [{ $ifNull: ['$taskTimeCount', 0] }, 1] }
            ]
          }
        }
      }],
      { returnDocument: 'after' }
    );
    return result.value;
  } catch (error) {
    console.error('Error saving average task time:', error);
  }
}

// Module to delete tasks older than 5 minutes
async function deleteOldPendingAndFailedTasks(db) {
  try {
    const tasksCollection = db.collection('tasks');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = await tasksCollection.deleteMany({ createdAt: { $lt: fiveMinutesAgo }, status: { $in: ['pending', 'failed'] } });
  } catch (error) {
    console.error('Error deleting old pending or failed tasks:', error);
  }
}

// Module to delete tasks older than 24 hours
async function deleteOldTasks(db) {
  try {
    const tasksCollection = db.collection('tasks');
    const aDayAgo = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
    const result = await tasksCollection.deleteMany({ createdAt: { $lt: aDayAgo } });
    console.log(`Deleted ${result.deletedCount} old tasks.`);
  } catch (error) {
    console.error('Error deleting old tasks:', error);
  }
}
// Delete all tasks
async function deleteAllTasks(db) {
  try {
    const tasksCollection = db.collection('tasks');
    const result = await tasksCollection.deleteMany({});
  } catch (error) {
    console.error('Error deleting tasks:', error);
  }
}

async function checkTaskStatus(taskId, fastify) {
  const db = fastify.mongo.db;
  const tasksCollection = db.collection('tasks');
  const task = await tasksCollection.findOne({ taskId });
  const chat = await db.collection('chats').findOne({ _id: task.chatId });

  let processingPercent = 0;

  if (!task) {
    console.log(`Task not found: ${taskId}`);
    return false;
  }

  // CRITICAL: If task is already completed, return it immediately 
  if (task.status === 'completed') {
    // Check if the existing result has proper merge information
    if (task.result && task.result.images) {
      const hasProperMergeInfo = task.result.images.some(img => img.isMerged !== undefined);
      
      if (hasProperMergeInfo) {
        return task;
      } else {
        // Continue with reprocessing to add merge information
      }
    }
  }

  if (task.status === 'failed') {
    return task;
  }

  const result = await fetchNovitaResult(task.taskId);

  if (result && result.status === 'processing') {
    processingPercent = result.progress;
    return { taskId: task.taskId, status: 'processing', progress: processingPercent};
  }
  
  if(result.error){
    await tasksCollection.updateOne(
      { taskId: task.taskId },
      { $set: { status: 'failed', result: { error: result.error }, updatedAt: new Date() } }
    );
    return false
  }

const images = Array.isArray(result) ? result : [result];
  
  // Process auto merge for ALL images if enabled
  let processedImages = images;
  if (task.shouldAutoMerge) {
    // For character creation with merge face, we need to get the uploaded image data
    if (task.chatCreation && task.enableMergeFace) {
      console.log('[checkTaskStatus] Character creation merge enabled, getting uploaded face image');
      
      // Get the original task data to access the uploaded image
      const originalTaskRequest = await fetchOriginalTaskData(task.taskId, db);
      
      if (originalTaskRequest && originalTaskRequest.image_base64) {
        // Use the uploaded image as the face source for merging
        const mergedImages = [];
        
        for (const imageData of images) {
          try {
            const mergedResult = await performAutoMergeFaceWithBase64(
              { 
                imageUrl: imageData.imageUrl, 
                imageId: null,
                seed: imageData.seed,
                nsfw_detection_result: imageData.nsfw_detection_result
              }, 
              originalTaskRequest.image_base64, 
              fastify
            );
            
            if (mergedResult && mergedResult.imageUrl) {
              // Only keep the merged image
              mergedImages.push({
                ...mergedResult,
                isMerged: true,
                originalImageUrl: imageData.imageUrl // Keep reference to original
              });
            } else {
              // If merge fails, fall back to original
              mergedImages.push({ ...imageData, isMerged: false });
            }
          } catch (error) {
            console.error(`Character creation merge error:`, error.message);
            // If merge fails, fall back to original
            mergedImages.push({ ...imageData, isMerged: false });
          }
        }
        
        processedImages = mergedImages; // Only use merged images
      } else {
        console.log('[checkTaskStatus] No uploaded image found for character creation merge, skipping merge');
        processedImages = images.map(imageData => ({ ...imageData, isMerged: false }));
      }
    } else {
      // Regular auto merge logic for existing chats
      const faceImageUrl = chat.chatImageUrl;
      
      if (!faceImageUrl || faceImageUrl.length === 0) {
        console.log('[checkTaskStatus] No chat image available for auto merge, skipping merge');
        processedImages = images.map(imageData => ({ ...imageData, isMerged: false }));
      } else {
        processedImages = await Promise.all(images.map(async (imageData, arrayIndex) => {
          try {
            const mergedResult = await performAutoMergeFace(
              { 
                imageUrl: imageData.imageUrl, 
                imageId: null,
                seed: imageData.seed,
                nsfw_detection_result: imageData.nsfw_detection_result
              }, 
              faceImageUrl, 
              fastify
            );
            
            if (mergedResult && mergedResult.imageUrl) {
              return {
                ...imageData, // Preserve original data
                ...mergedResult, // Apply merge updates
                isMerged: true
              };
            } else {
              return { ...imageData, isMerged: false };
            }
          } catch (error) {
            console.error(`Auto merge error:`, error.message);
            return { ...imageData, isMerged: false };
          }
        }));
      }
    }
  } else {
    // Ensure all images have isMerged flag set to false when no auto merge
    processedImages = images.map(imageData => ({ ...imageData, isMerged: false }));
  }
  
  // Save processed images to database
  const savedImages = await Promise.all(processedImages.map(async (imageData, arrayIndex) => {
    let nsfw = task.type === 'nsfw';
    if (imageData.nsfw_detection_result && imageData.nsfw_detection_result.valid && imageData.nsfw_detection_result.confidence >= 50) {
      nsfw = true;
    }
    
    let uniqueSlug = task.slug;
    if (processedImages.length > 1) {
      uniqueSlug = `${task.slug}-${arrayIndex + 1}`;
    }

    const imageResult = await saveImageToDB({
      taskId: task.taskId,
      userId: task.userId,
      chatId: task.chatId,
      userChatId: task.userChatId,
      prompt: task.prompt,
      title: task.title,
      slug: uniqueSlug,
      imageUrl: imageData.imageUrl,
      aspectRatio: task.aspectRatio,
      seed: imageData.seed,
      blurredImageUrl: imageData.blurredImageUrl,
      nsfw: nsfw,
      fastify,
      isMerged: imageData.isMerged,
      originalImageUrl: imageData.originalImageUrl,
      mergeId: imageData.mergeId,
      shouldAutoMerge: task.shouldAutoMerge
    });

    // When saving auto-merged results, make sure to create the relationship
    if (task.shouldAutoMerge && imageData.isMerged && imageData.mergeId) {
      try {
        const { saveMergedFaceToDB } = require('./merge-face-utils');
        await saveMergedFaceToDB({
          originalImageId: imageResult.imageId, // Original image ID before merge
          mergedImageUrl: imageData.imageUrl,   // Merged image URL
          userId: task.userId,
          chatId: task.chatId,
          userChatId: task.userChatId,
          fastify
        });
        console.log(`[checkTaskStatus] Created merge relationship for auto-merged image: ${imageData.mergeId}`);
      } catch (error) {
        console.error(`[checkTaskStatus] Error creating merge relationship:`, error);
      }
    }

    return {
      ...imageResult,
      status: 'completed'};
  }));

  // Update task status to completed with proper merge information
  const updateResult = await tasksCollection.findOneAndUpdate(
    { 
      taskId: task.taskId,
      status: { $ne: 'completed' }
    },
    { 
      $set: { 
        status: 'completed', 
        result: { images: savedImages }, 
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );

  if (!updateResult.value) {
    const existingTask = await tasksCollection.findOne({ taskId: task.taskId });
    
    // FIXED: Always return the processed/merged images for character creation
    if (task.chatCreation && task.shouldAutoMerge) {
      return { 
        taskId: task.taskId, 
        userId: task.userId, 
        userChatId: task.userChatId, 
        status: 'completed', 
        images: savedImages, // Use our processed merged images
        result: { images: savedImages }
      };
    }
    // CRITICAL FIX: If the existing task has proper merge data, return it
    // If not, return our processed result
    if (existingTask?.result?.images?.some(img => img.isMerged !== undefined)) {
      return existingTask;
    } else {
      return { 
        taskId: task.taskId, 
        userId: task.userId, 
        userChatId: task.userChatId, 
        status: 'completed', 
        images: savedImages,
        result: { images: savedImages }
      };
    }
  }

  const finalResult = { 
    taskId: task.taskId, 
    userId: task.userId, 
    userChatId: task.userChatId, 
    status: 'completed', 
    images: savedImages,
    result: { images: savedImages }
  };

  return finalResult;
}

// Function to trigger the Novita API for text-to-image generation
async function fetchNovitaMagic(data, flux = false) {
  try {
    let apiUrl = 'https://api.novita.ai/v3/async/txt2img';
    if (data.image_base64) {
      apiUrl = 'https://api.novita.ai/v3/async/img2img';
    }
    if (flux) {
      apiUrl = 'https://api.novita.ai/v3beta/flux-1-schnell';
      data.response_image_type = 'jpeg';
    }
    
    let requestBody = {
      headers: {
        Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
    if (flux) {
      requestBody.data = data
    }else{
      requestBody.data = {
        extra: {
          response_image_type: 'jpeg',
          enable_nsfw_detection: true,
          nsfw_detection_level: 0,
        },
        request: data,
      }
    }

    const response = await axios.post(apiUrl, requestBody.data, {
      headers: requestBody.headers,
    });
    if (response.status !== 200) {
      console.log(`Error - ${response.data.reason}`);
      return false;
    }

    const taskId = !flux ? response.data.task_id : response.data.task.task_id;
    return taskId;
  } catch (error) {
    console.error('Error fetching Novita image:', error.message);
    console.log(error)
    return false;
  }
}
  
// Function to fetch Novita's task result (single check)
async function fetchNovitaResult(task_id) {
    try {
    const response = await axios.get(`https://api.novita.ai/v3/async/task-result?task_id=${task_id}`, {
        headers: {
        Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
        },
    });

    if (response.status !== 200) {
        throw new Error(`Non-200 response: ${await response.text()}`);
    }

    const taskStatus = response.data.task.status;
    const progressPercent = response.data.task.progress_percent;

    if (taskStatus === 'TASK_STATUS_SUCCEED') {
        const images = response.data.images;
        if (images.length === 0) {
        throw new Error('No images returned from Novita API');
        }

        const s3Urls = await Promise.all(images.map(async (image, index) => {
          const imageUrl = image.image_url;
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(imageResponse.data, 'binary');
          const hash = createHash('md5').update(buffer).digest('hex');
          const uploadedUrl = await uploadToS3(buffer, hash, 'novita_result_image.png');
          return { 
            imageId: hash, 
            imageUrl: uploadedUrl, 
            nsfw_detection_result: image.nsfw_detection_result, 
            seed: response.data.extra.seed,
            index
          };
          }));

        return s3Urls.length === 1 ? s3Urls[0] : s3Urls;
    } else if (taskStatus === 'TASK_STATUS_FAILED') {
        console.log(`Task failed with reason: ${response.data.task.reason}`);
        return { error: response.data.task.reason, status: 'failed' };
    } else {
        return {status: 'processing', progress: progressPercent};
    }

    } catch (error) {
    console.error("Error fetching Novita result:", error.message);
    return { error: error.message, status: 'failed' };
    }
}

// Function to update the slug of a task
async function updateSlug({ taskId, taskSlug, fastify, userId, chatId, placeholderId }) {
  const db = fastify.mongo.db; 
  const tasksCollection = db.collection('tasks');
  const galleryCollection = db.collection('gallery');

  const task = await tasksCollection.findOne({ taskId });
  if (task && task.status !== 'completed') {
    await tasksCollection.updateOne(
      { taskId },
      { $set: { slug: taskSlug, updatedAt: new Date() } }
    );
  } else {
    await galleryCollection.updateOne(
      { userId: new ObjectId(userId), chatId: new ObjectId(chatId), "images.taskId": taskId },
      { $set: { "images.$.slug": taskSlug } }
    );
  }
}
// Function to update the title of a task
async function updateTitle({ taskId, newTitle, fastify, userId, chatId, placeholderId }) {
  const db = fastify.mongo.db; 
  const tasksCollection = db.collection('tasks');
  const galleryCollection = db.collection('gallery');

  const task = await tasksCollection.findOne({ taskId });
  if (task && task.status !== 'completed') {
    await tasksCollection.updateOne(
      { taskId },
      { $set: { title: newTitle, updatedAt: new Date() } }
    );
  } else {
    await galleryCollection.updateOne(
      { userId: new ObjectId(userId), chatId: new ObjectId(chatId), "images.taskId": taskId },
      { $set: { "images.$.title": newTitle } }
    );
  }
}

// Function to get a prompt by its ID
async function getPromptById(db, id) {
  try {
    // Validate and parse the id
    if (!ObjectId.isValid(id)) {
      throw new Error('Invalid ID format');
    }

    const prompt = await db.collection('prompts').findOne({ _id: new ObjectId(id) });

    if (!prompt) {
      return { success: false, message: 'Prompt not found', data: null };
    }

    return prompt;
  } catch (error) {
    console.error('Error fetching prompt:', error);
    throw new Error('Error fetching prompt'); // Re-throw error to be handled by the caller
  }
}

async function checkImageDescription(db, chatId) {
  if (!ObjectId.isValid(chatId)) {
    throw new Error('Invalid chatId format');
  }

  const objectId = new ObjectId(chatId);
  const collection = db.collection('chats');

  const chatData = await collection.findOne({ _id: objectId });
  const characterPrompt = chatData?.imageDescription || chatData?.enhancedPrompt || chatData?.characterPrompt || null;
  const characterDescription = characterPrompt;

  if (!characterDescription || characterDescription.includes('sorry')) {
    return false;
  }

  return { imageDescription: characterDescription };
}

async function getImageSeed(db, imageId) {
  // Always return -1
  return -1;
  
  // Original logic kept inside unreachable code block
  if (false) {
    if (!ObjectId.isValid(imageId)) {
      throw new Error('Invalid imageId format');
    }
    try {
      const objectId = new ObjectId(imageId);
      const imageDocument = await db.collection('gallery').findOne(
        { "images._id": objectId },
        { projection: { "images.$": 1 } }
      );

      if (!imageDocument || !imageDocument.images?.length) {
        return null;
      }

      const image = imageDocument.images[0];
      return Number.isInteger(image.seed) ? image.seed : parseInt(image.seed, 10);
    }
    catch (error) {
      return null;
    }
  }
}

async function saveImageToDB({taskId, userId, chatId, userChatId, prompt, title, slug, imageUrl, aspectRatio, seed, blurredImageUrl = null, nsfw = false, fastify, isMerged = false, originalImageUrl = null, mergeId = null, shouldAutoMerge = false}) {
    
  const db = fastify.mongo.db;
    
    try {
      const chatsGalleryCollection = db.collection('gallery');

      // Check if the image has already been saved for this task
      const existingImage = await chatsGalleryCollection.findOne({
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId),
        'images.imageUrl': imageUrl
      });
      

      if (existingImage) {
        const image = existingImage.images.find(img => img.imageUrl === imageUrl);
        console.log('[saveImageToDB] Image already exists, returning existing data:', {
          imageId: image._id,
          imageUrl: image.imageUrl,
          prompt: image.prompt,
          title: image.title,
          nsfw: image.nsfw,
          isMerged: image.isMerged
        });
        return { 
          imageId: image._id, 
          imageUrl: image.imageUrl,
          prompt: image.prompt,
          title: image.title,
          nsfw: image.nsfw,
          isMerged: image.isMerged || false
        };
      }

      // Generate slug if not provided
      if (!slug) {
        if (title && typeof title === 'object') {
          const firstAvailableTitle = title.en || title.ja || title.fr || '';
          slug = slugify(firstAvailableTitle.substring(0, 50), { lower: true, strict: true });
        } else {
          slug = slugify(prompt.substring(0, 50), { lower: true, strict: true });
        }
        
        const existingImage_check = await chatsGalleryCollection.findOne({
          "images.slug": slug
        });
        
        if (existingImage_check) {
          const randomStr = Math.random().toString(36).substring(2, 6);
          slug = `${slug}-${randomStr}`;
        }
      }

      const imageId = new ObjectId();
      const imageDocument = { 
        _id: imageId, 
        taskId,
        prompt, 
        title,
        slug,
        imageUrl, 
        blurredImageUrl, 
        aspectRatio, 
        seed,
        isBlurred: !!blurredImageUrl,
        nsfw,
        createdAt: new Date()
      };

      // Add merge-specific fields if this is a merged image
      if (isMerged) {
        imageDocument.isMerged = true;
        imageDocument.originalImageUrl = originalImageUrl;
        if (mergeId) {
          imageDocument.mergeId = mergeId;
        }
      }

      await chatsGalleryCollection.updateOne(
        { 
          userId: new ObjectId(userId),
          chatId: new ObjectId(chatId),
        },
        { 
          $push: { 
            images: imageDocument
          },
        },
        { upsert: true }
      );

      // Update counters
      const chatsCollection = db.collection('chats');
      await chatsCollection.updateOne(
        { _id: new ObjectId(chatId) },
        { $inc: { imageCount: 1 } }
      );

      const usersCollection = db.collection('users');
      await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $inc: { imageCount: 1 } }
      );
      
      try {
        // Award base points for image generation
        await awardImageGenerationReward(db, userId, fastify);
        // Check for image generation milestones
        await awardImageMilestoneReward(db, userId, fastify);
      } catch (error) {
        console.error('Error awarding image generation points:', error);
      }
      
      if (!userChatId || !ObjectId.isValid(userChatId)) {
        console.log('[saveImageToDB] Returning data for non-user chat:', {
          imageId,
          imageUrl,
          prompt,
          title,
          nsfw,
          isMerged
        });
        return { 
          imageId, 
          imageUrl,
          prompt,
          title,
          nsfw,
          isMerged: isMerged || false
        };
      }

      const userDataCollection = db.collection('userChat');
      const userData = await userDataCollection.findOne({ 
        userId: new ObjectId(userId), 
        _id: new ObjectId(userChatId) 
      });
  
      if (!userData) {
        throw new Error('User data not found');
      }

      function normalizeImageUrl(url) {
        // Match both .../hash_novita_result_image.png and .../hash/novita_result_image.png
        const match = url.match(/([a-f0-9]{32})[_\/]novita_result_image\.png$/);
        return match ? match[1] : url;
      }
      const updateOriginalMessageWithMerge = async (mergeMessage) => {
        try {
          const userChatData = await userDataCollection.findOne({
            userId: new ObjectId(userId),
            _id: new ObjectId(userChatId),
          });
          console.log({ "mergeMessage.originalImageUrl" : mergeMessage.originalImageUrl });
          // Find the index of the original message for merge
          const originalIndex = userChatData.messages.findIndex(msg => {
            if (msg.imageUrl && msg.role === 'assistant' && msg.type === 'image') {
              const isImageMatch = normalizeImageUrl(msg.imageUrl) === normalizeImageUrl(mergeMessage.originalImageUrl);
              console.log(`[updateOriginalMessageWithMerge] Checking message: imageUrl: ${msg.imageUrl}, originalImageUrl: ${mergeMessage.originalImageUrl}, isImageMatch: ${isImageMatch}`);
              return isImageMatch && msg.role === 'assistant' && msg.type === 'image';
            }
          });
          console.log('[updateOriginalMessageWithMerge] Found originalMessage index:', originalIndex);

          if (originalIndex !== -1) {
            // Combine originalMessage with mergeMessage
            const originalMessage = userChatData.messages[originalIndex];
            const resultMessage = {
              ...originalMessage,
              imageUrl: mergeMessage.imageUrl,
              imageId: mergeMessage.imageId,
              type: "mergeFace",
              role: "assistant",
              hidden: true,
              isMerged: true,
              mergeId: mergeMessage.mergeId,
              originalImageUrl: mergeMessage.originalImageUrl,
            };
            // Update the message in the array
            userChatData.messages[originalIndex] = resultMessage;
            console.log({resultMessage})
            // Update the whole messages array in the database
            await userDataCollection.updateOne(
              {
                userId: new ObjectId(userId),
                _id: new ObjectId(userChatId),
              },
              {
                $set: { messages: userChatData.messages },
              }
            );
          }
        } catch (error) {
          console.error('Error updating original message with merge:', error.message);
        }
      };
      
      const addImageMessageToChat = async (userId, userChatId, imageUrl, imageId, prompt, title) => {
        try {
          // Push a new image message to the user's chat messages array
          const userData = await userDataCollection.findOne({
            userId: new ObjectId(userId),
            _id: new ObjectId(userChatId),
          });
          if (!userData) {
            throw new Error('User data not found');
          }   
          const imageMessage = {
            role: "assistant",
            content: title.en || title.ja || title.fr || prompt,
            imageUrl,
            imageId,
            type: isMerged ? "mergeFace" : "image",
            hidden: true,
            prompt,
            title,
            timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
          };
          const imagePromptMessage = {
            role: "assistant",
            content: `I just sent you an image based on the prompt: "${prompt}".`,
            type: "text",
            hidden: true,
            timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
          };
          // Add the new message to the chat
          userData.messages.push(imageMessage);
          userData.messages.push(imagePromptMessage);
          // Update the user's chat with the new message
          await userDataCollection.updateOne(
            { userId: new ObjectId(userId), _id: new ObjectId(userChatId) },
            { $set: { messages: userData.messages } }
          );
        } catch (error) {
          console.error('Error adding image message to chat:', error.message);
          
        }
      };

      const firstAvailableTitle = title.en || title.ja || title.fr || '';
      
      const shouldAddMessage = !shouldAutoMerge || (shouldAutoMerge && isMerged);
      
      if (shouldAddMessage && isMerged) {
        const imageMessage = {
          role: "assistant", 
          content: isMerged ? `[MergeFace] ${mergeId}` : `${firstAvailableTitle}`, 
          hidden: true, 
          type: isMerged ? "mergeFace" : "image", 
          imageId: isMerged ? mergeId : imageId, 
          imageUrl,
          prompt, 
          slug, 
          aspectRatio, 
          seed, 
          nsfw,
        };

        // Add merge-specific fields consistently
        if (isMerged) {
          imageMessage.isMerged = true;
          imageMessage.mergeId = mergeId;
          imageMessage.originalImageUrl = originalImageUrl;
          imageMessage.originalImageId = imageId;
        }

        updateOriginalMessageWithMerge(imageMessage);
      } else {
        addImageMessageToChat(
          userId, 
          userChatId, 
          imageUrl, 
          imageId, 
          prompt, 
          title,
        );
      }

      console.log('[saveImageToDB] Returning saved image data:', {
        imageId,
        imageUrl,
        prompt,
        title,
        nsfw,
        isMerged: isMerged || false
      });

      return { 
        imageId, 
        imageUrl,
        prompt,
        title,
        nsfw,
        isMerged: isMerged || false
      };
      
    } catch (error) {
      console.log('Error saving image to DB:', error.message);
      return false
    }
  }

  module.exports = {
    generateImg,
    getPromptById,
    getImageSeed,
    checkImageDescription,
    getTasks,
    deleteOldTasks,
    deleteAllTasks,
    pollTaskStatus,
    handleTaskCompletion,
    checkTaskStatus,
    performAutoMergeFace,
    performAutoMergeFaceWithBase64,
    centerCropImage,
    saveImageToDB,
    updateSlug,
    updateTitle,
    fetchNovitaMagic,
    fetchNovitaResult,
    fetchOriginalTaskData
  };