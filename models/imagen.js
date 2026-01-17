const { generatePromptTitle } = require('./openai')
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { ObjectId } = require('mongodb');
const axios = require('axios');
const { createHash } = require('crypto');
const { addNotification, saveChatImageToDB, getLanguageName, uploadToS3 } = require('../models/tool')
const { getAutoMergeFaceSetting } = require('../models/chat-tool-settings-utils')
const { awardImageGenerationReward, awardCharacterImageMilestoneReward } = require('./user-points-utils');
const slugify = require('slugify');
const { generateImageSlug } = require('./slug-utils');
const sharp = require('sharp');
const { time } = require('console');


const default_prompt = {
    sdxl: {
      sfw: {
        sampler_name: "Euler a",
        prompt: `score_9, score_8_up, masterpiece, best quality, (sfw), clothed, `,
        negative_prompt: `nipple, topless, nsfw, naked, nude, sex, young, child, dick, exposed breasts, cleavage, bikini, revealing clothing, lower body`,
        width: 1024,
        height: 1360,
        seed: -1,
        loras: []
      },
      nsfw: {
        sampler_name: "Euler a",
        prompt: `score_9, score_8_up, masterpiece, best quality, nsfw, uncensored, explicit,`,
        negative_prompt: `child,censored`,
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
        negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo, nsfw, nude, topless, exposed breasts, cleavage, bikini, revealing clothing, worst quality, low quality, disform, weird body, multiple hands, young, child, dick, bad quality, worst quality, worst detail, sketch, lower body, full body`,
        loras: [{"model_name":"more_details_59655.safetensors","strength":0.2},{ model_name: 'JapaneseDollLikeness_v15_28382.safetensors', strength: 0.7 }],
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
        negative_prompt: `nipple, topless, nude, naked, exposed breasts, cleavage, bikini, nsfw, uncensored, revealing clothing, lower body, full body`,
        seed: 0,
      },
      nsfw:{
        sampler_name: 'euler',
        prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (nsfw),uncensored, `,
        negative_prompt: ``,
        seed: 0,
      }
    }
  };    
  
const params = {
  model_name: "prefectPonyXL_v50_1128833.safetensors",
  prompt: '',
  negative_prompt: '',
  width: 1024,
  height: 1360,
  sampler_name: "Euler a",
  guidance_scale: 7,
  steps: 30,
  image_num: 1,
  clip_skip: 0,
  strength: 0.65,
  loras: [],
} 

function getTitleForLang(title, lang = 'en') {
  if (!title) return '';
  if (typeof title === 'string') return title;
  const map = {
    english: 'en',
    japanese: 'ja',
    french: 'fr'
  };
  const key = (lang && typeof lang === 'string') ? (map[lang.toLowerCase()] || lang.toLowerCase()) : 'en';
  return title[key] || title.en || title.ja || title.fr || Object.values(title).find(v => !!v) || '';
}

/**
 * Handle FLUX immediate completion processing
 * @param {Object} params - All parameters needed for FLUX processing
 * @returns {Object} Task completion result
 */
async function handleFluxCompletion({
  novitaResult,
  newTitle,
  taskSlug,
  prompt,
  imageType,
  image_request,
  aspectRatio,
  userId,
  chatId,
  userChatId,
  chatCreation,
  placeholderId,
  shouldAutoMerge,
  enableMergeFace,
  image_base64,
  chat,
  customPromptId,
  customGiftId,
  fastify,
  translations
}) {
  const db = fastify.mongo.db;
  
  // Process images immediately for FLUX with proper merge handling
  let processedImages = Array.isArray(novitaResult.images) ? novitaResult.images : [novitaResult.images];
  
  // Handle auto merge for FLUX if enabled
  if (shouldAutoMerge) {
    if (chatCreation && enableMergeFace && image_base64) {
      // Character creation with uploaded face image
      
      const mergedImages = [];
      for (const imageData of processedImages) {
        try {
          const mergedResult = await performAutoMergeFaceWithBase64(
            { 
              imageUrl: imageData.imageUrl, 
              imageId: null,
              seed: imageData.seed || 0,
              nsfw_detection_result: null
            }, 
            image_base64, 
            fastify
          );
          
          if (mergedResult && mergedResult.imageUrl) {
            mergedImages.push({
              ...mergedResult,
              isMerged: true
            });
          } else {
            mergedImages.push({ ...imageData, isMerged: false });
          }
        } catch (error) {
          console.error(`FLUX character creation merge error:`, error.message);
          mergedImages.push({ ...imageData, isMerged: false });
        }
      }
      processedImages = mergedImages;
    } else if (!chatCreation && chat.chatImageUrl && chat.chatImageUrl.length > 0) {
      // Regular auto merge with chat image
      
      const mergedImages = [];
      for (const imageData of processedImages) {
        try {
          const mergedResult = await performAutoMergeFace(
            { 
              imageUrl: imageData.imageUrl, 
              imageId: null,
              seed: imageData.seed || 0,
              nsfw_detection_result: null
            }, 
            chat.chatImageUrl, 
            fastify
          );
          
          if (mergedResult && mergedResult.imageUrl) {
            mergedImages.push({
              ...imageData,
              ...mergedResult,
              isMerged: true
            });
          } else {
            mergedImages.push({ ...imageData, isMerged: false });
          }
        } catch (error) {
          console.error(`FLUX auto merge error:`, error.message);
          mergedImages.push({ ...imageData, isMerged: false });
        }
      }
      processedImages = mergedImages;
    } else {
      processedImages = processedImages.map(imageData => ({ ...imageData, isMerged: false }));
    }
  } else {
    processedImages = processedImages.map(imageData => ({ ...imageData, isMerged: false }));
  }

  // Store basic task data with title and slug
  const taskData = {
    taskId: novitaResult.taskId,
    type: imageType,
    status: 'completed',
    prompt: prompt,
    title: newTitle,
    slug: taskSlug,
    negative_prompt: image_request.negative_prompt || '',
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
    enableMergeFace: enableMergeFace || false,
    result: { images: processedImages }
  };

  // Add custom prompt/gift IDs if provided
  if (customPromptId) taskData.customPromptId = customPromptId;
  if (customGiftId) taskData.customGiftId = customGiftId;

  // Store original request data for character creation tasks with merge face enabled
  if (chatCreation && enableMergeFace && image_base64) {
    taskData.originalRequestData = {
      image_base64: image_base64
    };
  }

  await db.collection('tasks').insertOne(taskData);

  // Save processed images to database directly (bypass checkTaskStatus)
  const savedImages = [];
  for (let arrayIndex = 0; arrayIndex < processedImages.length; arrayIndex++) {
    const imageData = processedImages[arrayIndex];
    
    let nsfw = imageType === 'nsfw';
    
    let uniqueSlug = taskSlug;
    if (processedImages.length > 1) {
      uniqueSlug = `${taskSlug}-${arrayIndex + 1}`;
    }

    const imageResult = await saveImageToDB({
      taskId: novitaResult.taskId,
      userId: new ObjectId(userId),
      chatId: new ObjectId(chatId),
      userChatId: userChatId ? new ObjectId(userChatId) : null,
      prompt: prompt,
      title: newTitle,
      slug: uniqueSlug,
      imageUrl: imageData.imageUrl,
      aspectRatio: aspectRatio,
      seed: imageData.seed || 0,
      blurredImageUrl: null, // FLUX doesn't support blurred images
      nsfw: nsfw,
      fastify,
      isMerged: imageData.isMerged || false,
      originalImageUrl: imageData.originalImageUrl,
      mergeId: imageData.mergeId,
      shouldAutoMerge: shouldAutoMerge
    });

    // Handle merge face relationships for FLUX
    if (shouldAutoMerge && imageData.isMerged && imageData.mergeId) {
      try {
        const { saveMergedFaceToDB } = require('./merge-face-utils');
        await saveMergedFaceToDB({
          originalImageId: imageResult.imageId,
          mergedImageUrl: imageData.imageUrl,
          userId: new ObjectId(userId),
          chatId: new ObjectId(chatId),
          userChatId: userChatId ? new ObjectId(userChatId) : null,
          fastify
        });
      } catch (error) {
        console.error(`[handleFluxCompletion] Error creating merge relationship:`, error);
      }
    }

    savedImages.push({
      ...imageResult,
      status: 'completed'
    });
  }

  // Update task with saved images
  await db.collection('tasks').updateOne(
    { taskId: novitaResult.taskId },
    { 
      $set: { 
        status: 'completed', 
        result: { images: savedImages }, 
        updatedAt: new Date() 
      } 
    }
  );

  // Create the completed task status object for handleTaskCompletion
  const completedTaskStatus = {
    taskId: novitaResult.taskId,
    userId: userId,
    userChatId: userChatId,
    status: 'completed',
    images: savedImages,
    result: { images: savedImages }
  };

  // Handle task completion using the standard flow
  try {
    await handleTaskCompletion(completedTaskStatus, fastify, {
      chatCreation,
      translations,
      userId,
      chatId,
      placeholderId
    });
  } catch (error) {
    console.error('Error handling FLUX task completion:', error);
    fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action: 'remove' });
    fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId: placeholderId, spin: false });
    fastify.sendNotificationToUser(userId, 'resetCharacterForm');
    throw error;
  }

  return { taskId: novitaResult.taskId };
}

// Simplified generateImg function
async function generateImg({
    title, 
    prompt, 
    negativePrompt, 
    aspectRatio, 
    imageSeed, 
    modelId, 
    regenerate, 
    userId, 
    chatId, 
    userChatId, 
    imageType, 
    image_num, 
    image_base64, 
    chatCreation, 
    placeholderId, 
    translations, 
    fastify, 
    flux = false, 
    customPromptId = null, 
    customGiftId = null, 
    enableMergeFace = false,
    editStrength = 'medium'
}) {
    const db = fastify.mongo.db;
    
    // Validate required parameters (prompt)
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
        fastify.sendNotificationToUser(userId, 'showNotification', {
            message: translations.newCharacter.prompt_missing,
            icon: 'error'
        });
        return;
    }

    console.log('\x1b[36m🔧 [generateImg] ===== STARTING IMAGE GENERATION =====\x1b[0m');
    console.log(`\x1b[33m[generateImg] Input modelId: ${modelId || 'NOT PROVIDED'}\x1b[0m`);

    // Fetch the user
    let user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      userId = await db.collection('chats').findOne({ _id: new ObjectId(chatId) }).then(chat => chat.userId);
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    
    // Fetch user subscription status
    const isSubscribed = user?.subscriptionStatus === 'active' || false;
  
    // Fetch imageVersion from chat or use default
    const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
    console.log(`\x1b[33m[generateImg] Chat model data: modelId=${chat?.modelId}, imageModel=${chat?.imageModel}, imageVersion=${chat?.imageVersion}\x1b[0m`);
    
    const imageVersion = chat?.imageVersion || 'sdxl';
    const selectedStyle = !flux ? default_prompt[imageVersion] || default_prompt['sdxl'] : default_prompt.flux;
    
    // Priority: 1) modelId param, 2) chat.modelId, 3) default
    let effectiveModelId = modelId || chat?.modelId || null;
    let imageModel = chat?.imageModel || 'prefectPonyXL_v50_1128833';
    let modelData = null;
    
    console.log(`\x1b[33m[generateImg] Effective modelId: ${effectiveModelId || 'NONE - using default'}\x1b[0m`);
    console.log(`\x1b[33m[generateImg] Initial imageModel: ${imageModel}\x1b[0m`);
    
    // For FLUX, use default flux settings instead of fetching model data
    if (!flux) {
        try {
          // First try to find by modelId
          if (effectiveModelId) {
            modelData = await db.collection('myModels').findOne({ modelId: effectiveModelId.toString() });
            console.log(`\x1b[33m[generateImg] Found model by modelId: ${modelData ? modelData.model : 'NOT FOUND'}\x1b[0m`);
          }
          // If not found by modelId, try by model name
          if (!modelData && imageModel) {
            modelData = await db.collection('myModels').findOne({ model: imageModel });
            console.log(`\x1b[33m[generateImg] Found model by name: ${modelData ? modelData.model : 'NOT FOUND'}\x1b[0m`);
          }
        } catch (error) {
          console.error('[generateImg] Error fetching modelData:', error);
          modelData = null;
        }
    }

    // Update imageModel if we found model data
    if (modelData) {
        imageModel = modelData.model;
        console.log(`\x1b[32m[generateImg] ✓ Using model: ${imageModel}\x1b[0m`);
    } else {
        console.log(`\x1b[33m[generateImg] ⚠️ No model data found, using default: ${imageModel}\x1b[0m`);
    }

    // Set default model if not found (non-FLUX only)
    if(modelId && regenerate && !flux){
      try {
          imageModel = modelData?.model || imageModel;
      } catch (error) {
        console.error('Error fetching model data:', error);
      }
    }

    const gender = chat?.gender
    console.log(`\x1b[33m[generateImg] Gender: ${gender || 'not set'}\x1b[0m`);

    // Custom negative prompt by gender (not used for FLUX)
    let genderNegativePrompt = '';
    if (!flux) {
        if(gender == 'female'){
          genderNegativePrompt = 'muscular,manly,'
        }
        if(gender == 'male'){
          genderNegativePrompt = 'feminine,womanly,'
        }
        if(gender == 'nonBinary'){
          genderNegativePrompt = 'manly,womanly,'
        }
    }

    // Prepare task based on imageType and model
    console.log(`\x1b[36m[generateImg] Preparing image generation request for user ${userId} (Type: ${imageType.toUpperCase()}, FLUX: ${flux})\x1b[0m`);
    let image_request;
    if (flux) {
        // FLUX-specific request structure
        const seed = typeof imageSeed === 'number' && imageSeed >= 0 ? imageSeed : selectedStyle[imageType].seed;
        image_request = {
            type: imageType,
            prompt: (selectedStyle[imageType].prompt ? selectedStyle[imageType].prompt + prompt : prompt).replace(/^\s+/gm, '').trim(),
            negative_prompt: selectedStyle[imageType].negative_prompt || '',
            width: 768, // FLUX portrait dimensions
            height: 1024,
            seed: imageSeed || selectedStyle[imageType].seed,
            steps: 4, // FLUX uses fewer steps
            blur: false, // FLUX doesn't support blurring
            ...(typeof seed === 'number' && seed >= 0 ? { seed } : {}),
        };
    } else {
        // Regular model request structure
        let modelNegativePrompt = modelData?.negativePrompt || '';
        let finalNegativePrompt = imageType === 'sfw' ? modelNegativePrompt +','+ selectedStyle.sfw.negative_prompt : modelNegativePrompt +','+ selectedStyle.nsfw.negative_prompt;
        finalNegativePrompt = ((negativePrompt || finalNegativePrompt) ? (negativePrompt || finalNegativePrompt)  + ',' : '') + genderNegativePrompt;
        finalNegativePrompt = finalNegativePrompt.replace(/,+/g, ',').replace(/^\s*,|\s*,\s*$/g, '').trim();

        const modelSampler = modelData?.defaultSampler || selectedStyle[imageType].sampler_name;
        // Determine LoRAs: For character creation with SFW, remove feminine-only LoRAs and handle gender-specific ones
        let selectedLoras = imageType === 'sfw' ? [...selectedStyle.sfw.loras] : [...selectedStyle.nsfw.loras];
        
        // For character creation SFW images, exclude feminine-specific LoRAs
        if (chatCreation && imageType === 'sfw') {
            selectedLoras = selectedLoras.filter(lora => 
                !lora.model_name.toLowerCase().includes('breast') && 
                !lora.model_name.toLowerCase().includes('feminine')
            );
            
            // For male characters in SFW character creation, further restrict feminine LoRAs
            if (gender === 'male') {
                selectedLoras = selectedLoras.filter(lora => 
                    !lora.model_name.toLowerCase().includes('doll') && 
                    !lora.model_name.toLowerCase().includes('japan')
                );
            }
        }
        
        if (imageType === 'sfw') {
          image_request = {
            type: 'sfw',
            model_name: imageModel.replace('.safetensors', '') + '.safetensors',
            sampler_name: modelSampler || selectedStyle.sfw.sampler_name || '',
            loras: selectedLoras,
            prompt: (selectedStyle.sfw.prompt ? selectedStyle.sfw.prompt + prompt : prompt).replace(/^\s+/gm, '').trim(),
            negative_prompt: finalNegativePrompt,
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
            sampler_name: modelSampler || selectedStyle.nsfw.sampler_name || '',
            loras: selectedLoras,
            prompt: (selectedStyle.nsfw.prompt ? selectedStyle.nsfw.prompt + prompt : prompt).replace(/^\s+/gm, '').trim(),
            negative_prompt: finalNegativePrompt,
            width: selectedStyle.nsfw.width || params.width,
            height: selectedStyle.nsfw.height || params.height,
            blur: !isSubscribed,
            seed: imageSeed || selectedStyle.nsfw.seed,
            steps: regenerate ? params.steps + 10 : params.steps,
          };
        }
    }

    if(image_base64){
      // Get target dimensions from the selected style
      const targetWidth = image_request.width;
      const targetHeight = image_request.height;
      
      // Center crop the image to match the target aspect ratio
      const croppedImage = await centerCropImage(image_base64, targetWidth, targetHeight);
      image_request.image_base64 = croppedImage;

      // [TEST] Remove negative prompt when uploading image & use prompt only
      image_request.negative_prompt = '';
      // Set guidance_scale based on edit strength
      let guidance_scale = 8.5; // default medium
      if (editStrength === 'low') guidance_scale = 5;
      else if (editStrength === 'high') guidance_scale = 12;
      image_request.guidance_scale = guidance_scale;
      // End [TEST]
    }
    // Prepare params
    // Validate and ensure prompt length is within API limits (1-1024 characters)
    if (!image_request.prompt || image_request.prompt.trim() === '') {
        fastify.sendNotificationToUser(userId, 'showNotification', {
            message: translations.newCharacter.prompt_missing || 'Prompt cannot be empty',
            icon: 'error'
        });
        return;
    }
    
    // Trim the prompt and ensure it's within the 1024 character limit
    image_request.prompt = image_request.prompt.trim();
    if (image_request.prompt.length > 1024) {
      image_request.prompt = image_request.prompt.substring(0, 1024).trim();
    }
    
    // Final validation: ensure prompt is not empty after trimming
    if (image_request.prompt.length === 0) {
        fastify.sendNotificationToUser(userId, 'showNotification', {
            message: translations.newCharacter.prompt_missing || 'Prompt cannot be empty',
            icon: 'error'
        });
        return;
    }
    let requestData = flux ? { ...image_request, image_num } : { ...params, ...image_request, image_num };
    
    if(process.env.MODE !== 'production'){
      // Log prompt & negative prompt
      console.log(`\x1b[36m=== 🎨 Image Generation Details ===\x1b[0m`);
      console.log(`📝 \x1b[32mPrompt:\x1b[0m ${image_request.prompt}`);
      console.log(`🚫 \x1b[33mNegative Prompt:\x1b[0m ${image_request.negative_prompt}`);
      console.log(`📸 \x1b[35mImage Base64 Present:\x1b[0m ${!!image_request.image_base64 ? '✅ Yes' : '❌ No'}`);
      console.log(`\x1b[36m===================================\x1b[0m`);
    }
    // Find modelId style
    const imageStyle = modelData ? modelData.style : 'anime';
    chat.imageStyle = chat.imageStyle || imageStyle; // Use chat image style or default to model style

    // Check if auto merge should be applied
    const autoMergeFaceEnabled = await getAutoMergeFaceSetting(db, userId.toString(), chatId.toString());
    const isPhotorealistic = chat && chat.imageStyle === 'photorealistic' || chat && chat.imageStyle !== 'anime';
    
    // For character creation, use enableMergeFace setting if provided, otherwise use auto merge logic
    const shouldAutoMerge = chatCreation 
        ? (enableMergeFace && image_base64) // Only merge on character creation if explicitly enabled and has uploaded image
        : (!chatCreation && autoMergeFaceEnabled && isPhotorealistic && chat?.chatImageUrl?.length > 0); // Regular auto merge logic for non-character creation
    
    // Generate title if not provided
    let newTitle = title;
    if (!title) {
      const lang = getLanguageName(user?.lang || 'en');
      const userLangTitle = await generatePromptTitle(requestData.prompt, lang);
      // Create title object with just the user's language
      newTitle = {
        en: lang === 'english' ? userLangTitle : '',
        ja: lang === 'japanese' ? userLangTitle : '',
        fr: lang === 'french' ? userLangTitle : ''
      };
    }

    // Generate a slug from the prompt or title
    let taskSlug = '';
    if (newTitle && typeof newTitle === 'object') {
      // If title is an object with language keys, use the first available title
      const firstAvailableTitle = newTitle.en || newTitle.ja || newTitle.fr || '';
      taskSlug = slugify(firstAvailableTitle.substring(0, 50), { lower: true, strict: true });
    } else if (newTitle) {
      // If title is a string
      taskSlug = slugify(newTitle.substring(0, 50), { lower: true, strict: true });
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

    // Send request to Novita and get taskId
    const novitaResult = await fetchNovitaMagic(requestData, flux);

    if (!novitaResult) {
        fastify.sendNotificationToUser(userId, 'showNotification', {
            message: 'Failed to initiate image generation',
            icon: 'error'
        });
        return;
    }

    // Handle FLUX immediate completion with dedicated function
    if (flux && novitaResult && novitaResult.isFluxComplete) {
      return await handleFluxCompletion({
        novitaResult,
        newTitle,
        taskSlug,
        prompt,
        imageType,
        image_request,
        aspectRatio,
        userId,
        chatId,
        userChatId,
        chatCreation,
        placeholderId,
        shouldAutoMerge,
        enableMergeFace,
        image_base64,
        chat,
        customPromptId,
        customGiftId,
        fastify,
        translations
      });
    }

    // For non-FLUX, continue with regular polling
    const novitaTaskId = typeof novitaResult === 'string' ? novitaResult : novitaResult.taskId;
    
    // Store task details in DB with title and slug
    const taskData = {
        taskId: novitaTaskId,
        type: imageType,
        task_type: 'txt2img',
        status: 'pending',
        prompt: prompt,
        title: newTitle,
        slug: taskSlug,
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

    if(chatCreation){
      fastify.sendNotificationToUser(userId, 'showNotification', { message:translations.character_image_generation_started , icon:'success' });
    }

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
    
    const db = fastify.mongo.db;
    const originalGeneratedImageUrl = originalImage.imageUrl;
    const startTs = Date.now();
    console.log(`🧬 [Merge] ${new Date().toISOString()} Start auto-merge for original=${originalGeneratedImageUrl}`);

    // Idempotent cache: reuse if a merged result already exists for this original
    const mergedStore = db.collection('mergedResults');
    try { await mergedStore.createIndex({ originalImageUrl: 1 }, { unique: true }); } catch (e) {}
    const cached = await mergedStore.findOne({ originalImageUrl: originalGeneratedImageUrl });
    if (cached && cached.mergedImageUrl && cached.mergeId) {
      console.log(`🗂️  [MergeCache] ${new Date().toISOString()} Cache hit, reuse merged result ⏱️ ${Date.now() - startTs}ms`);
      return {
        ...originalImage,
        imageUrl: cached.mergedImageUrl,
        mergeId: cached.mergeId,
        originalImageUrl: originalGeneratedImageUrl,
        isMerged: true
      };
    }

    // Acquire per-original lock to prevent concurrent duplicate merges
    const locks = db.collection('mergeLocks');
    try { await locks.createIndex({ key: 1 }, { unique: true }); } catch (e) {}
    const lockKey = `merge:${originalGeneratedImageUrl}`;
    try {
      await locks.insertOne({ key: lockKey, createdAt: new Date() });
    } catch (e) {
      if (e && e.code === 11000) {
        // Another worker is merging this original; wait briefly for result and reuse
        for (let i = 0; i < 20; i++) {
          // Check idempotent cache first
          const cachedWhileWaiting = await mergedStore.findOne({ originalImageUrl: originalGeneratedImageUrl });
          if (cachedWhileWaiting && cachedWhileWaiting.mergedImageUrl && cachedWhileWaiting.mergeId) {
            console.log(`🗂️  [MergeCache] ${new Date().toISOString()} Cache hit during wait ⏱️ ${Date.now() - startTs}ms`);
            return {
              ...originalImage,
              imageUrl: cachedWhileWaiting.mergedImageUrl,
              mergeId: cachedWhileWaiting.mergeId,
              originalImageUrl: originalGeneratedImageUrl,
              isMerged: true
            };
          }
          const existingMergeWait = await db.collection('gallery').findOne({
            'images.originalImageUrl': originalGeneratedImageUrl,
            'images.isMerged': true
          });
          if (existingMergeWait) {
            const mergedImage = existingMergeWait.images.find(img => img.originalImageUrl === originalGeneratedImageUrl && img.isMerged === true);
            if (mergedImage) {
              return {
                ...originalImage,
                imageUrl: mergedImage.imageUrl,
                mergeId: mergedImage.mergeId,
                originalImageUrl: originalGeneratedImageUrl,
                isMerged: true
              };
            }
          }
          await new Promise(r => setTimeout(r, 250));
        }
        return null;
      }
      throw e;
    }
    console.log(`🔒 [MergeLock] ${new Date().toISOString()} Acquired lock ⏱️ ${Date.now() - startTs}ms`);

    // ⭐ CRITICAL: Check if a merge already exists for this original image URL
    // This prevents duplicate Novita API calls for the same original
    const existingMerge = await db.collection('gallery').findOne({
      'images.originalImageUrl': originalGeneratedImageUrl,
      'images.isMerged': true
    });

    if (existingMerge) {
      const mergedImage = existingMerge.images.find(img => 
        img.originalImageUrl === originalGeneratedImageUrl && img.isMerged === true
      );
      
      if (mergedImage) {
        try {
          await mergedStore.updateOne(
            { originalImageUrl: originalGeneratedImageUrl },
            { $set: { mergedImageUrl: mergedImage.imageUrl, mergeId: mergedImage.mergeId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          );
        } catch (_) {}
        await db.collection('mergeLocks').deleteOne({ key: lockKey });
        console.log(`🔁 [MergeReuse] ${new Date().toISOString()} Reused from gallery ⏱️ ${Date.now() - startTs}ms`);
        return {
          ...originalImage,
          imageUrl: mergedImage.imageUrl,
          mergeId: mergedImage.mergeId,
          originalImageUrl: originalGeneratedImageUrl,
          isMerged: true
        };
      }
    }

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

    // Save merged image to S3 add upload emoji at the beginning
    console.log(`🚀 [performAutoMergeFace] ${new Date().toISOString()} Saving merged image to S3 with mergeId:`, mergeId.toString());
    let mergedImageUrl;
    try {
      mergedImageUrl = await saveMergedImageToS3(
        `data:image/${mergeResult.imageType};base64,${mergeResult.imageBase64}`,
        mergeId.toString(),
        fastify
      );
      // Save to idempotent cache BEFORE releasing lock
      try {
        await mergedStore.updateOne(
          { originalImageUrl: originalGeneratedImageUrl },
          { $set: { mergedImageUrl, mergeId: mergeId.toString(), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        console.log(`🗂️  [MergeCache] ${new Date().toISOString()} Saved idempotent entry ⏱️ ${Date.now() - startTs}ms`);
      } catch (e) {}
    } finally {
      await db.collection('mergeLocks').deleteOne({ key: lockKey });
      console.log(`🔓 [MergeLock] ${new Date().toISOString()} Released lock ⏱️ ${Date.now() - startTs}ms`);
    }


    // Return merged image data with ALL original fields preserved
    const returnData = {
      ...originalImage,
      imageUrl: mergedImageUrl,
      mergeId: mergeId.toString(),
      originalImageUrl: originalGeneratedImageUrl,
      isMerged: true
    };
    console.log(`✅ [Merge] ${new Date().toISOString()} Completed ⏱️ ${Date.now() - startTs}ms`);
    
    return returnData;

  } catch (error) {
    console.error('[performAutoMergeFace] Error in auto merge:', error);
    return null;
  }
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
    
    const db = fastify.mongo.db;
    const originalGeneratedImageUrl = originalImage.imageUrl;
    const startTs = Date.now();
    console.log(`🧬 [Merge] ${new Date().toISOString()} Start auto-merge (base64) for original=${originalGeneratedImageUrl}`);

    // Idempotent cache: reuse if a merged result already exists for this original
    const mergedStore = db.collection('mergedResults');
    try { await mergedStore.createIndex({ originalImageUrl: 1 }, { unique: true }); } catch (e) {}
    const cached = await mergedStore.findOne({ originalImageUrl: originalGeneratedImageUrl });
    if (cached && cached.mergedImageUrl && cached.mergeId) {
      console.log(`🗂️  [MergeCache] ${new Date().toISOString()} Cache hit, reuse merged result ⏱️ ${Date.now() - startTs}ms`);
      return {
        ...originalImage,
        imageUrl: cached.mergedImageUrl,
        mergeId: cached.mergeId,
        originalImageUrl: originalGeneratedImageUrl,
        isMerged: true
      };
    }

    // Acquire per-original lock to prevent concurrent duplicate merges
    const locks = db.collection('mergeLocks');
    try { await locks.createIndex({ key: 1 }, { unique: true }); } catch (e) {}
    const lockKey = `merge:${originalGeneratedImageUrl}`;
    try {
      await locks.insertOne({ key: lockKey, createdAt: new Date() });
    } catch (e) {
      if (e && e.code === 11000) {
        // Another worker is merging this original; wait briefly for result and reuse
        for (let i = 0; i < 20; i++) {
          // Check idempotent cache first
          const cachedWhileWaiting = await mergedStore.findOne({ originalImageUrl: originalGeneratedImageUrl });
          if (cachedWhileWaiting && cachedWhileWaiting.mergedImageUrl && cachedWhileWaiting.mergeId) {
            console.log(`🗂️  [MergeCache] ${new Date().toISOString()} Cache hit during wait ⏱️ ${Date.now() - startTs}ms`);
            return {
              ...originalImage,
              imageUrl: cachedWhileWaiting.mergedImageUrl,
              mergeId: cachedWhileWaiting.mergeId,
              originalImageUrl: originalGeneratedImageUrl,
              isMerged: true
            };
          }
          const existingMergeWait = await db.collection('gallery').findOne({
            'images.originalImageUrl': originalGeneratedImageUrl,
            'images.isMerged': true
          });
          if (existingMergeWait) {
            const mergedImage = existingMergeWait.images.find(img => img.originalImageUrl === originalGeneratedImageUrl && img.isMerged === true);
            if (mergedImage) {
              return {
                ...originalImage,
                imageUrl: mergedImage.imageUrl,
                mergeId: mergedImage.mergeId,
                originalImageUrl: originalGeneratedImageUrl,
                isMerged: true
              };
            }
          }
          await new Promise(r => setTimeout(r, 250));
        }
        return null;
      }
      throw e;
    }
    console.log(`🔒 [MergeLock] ${new Date().toISOString()} Acquired lock ⏱️ ${Date.now() - startTs}ms`);

    // ⭐ CRITICAL: Check if a merge already exists for this original image URL
    const existingMerge = await db.collection('gallery').findOne({
      'images.originalImageUrl': originalGeneratedImageUrl,
      'images.isMerged': true
    });

    if (existingMerge) {
      const mergedImage = existingMerge.images.find(img => 
        img.originalImageUrl === originalGeneratedImageUrl && img.isMerged === true
      );
      
      if (mergedImage) {
        try {
          await mergedStore.updateOne(
            { originalImageUrl: originalGeneratedImageUrl },
            { $set: { mergedImageUrl: mergedImage.imageUrl, mergeId: mergedImage.mergeId, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
          );
        } catch (_) {}
        await db.collection('mergeLocks').deleteOne({ key: lockKey });
        console.log(`🔁 [MergeReuse] ${new Date().toISOString()} Reused from gallery ⏱️ ${Date.now() - startTs}ms`);
        return {
          ...originalImage,
          imageUrl: mergedImage.imageUrl,
          mergeId: mergedImage.mergeId,
          originalImageUrl: originalGeneratedImageUrl,
          isMerged: true
        };
      }
    }

    const { 
      mergeFaceWithNovita, 
      optimizeImageForMerge, 
      saveMergedImageToS3
    } = require('./merge-face-utils');

    // Convert generated image URL to base64
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
    console.log(`🚀 [performAutoMergeFaceWithBase64] ${new Date().toISOString()} Saving merged image to S3 with mergeId:`, mergeId.toString());
    let mergedImageUrl;
    try {
      mergedImageUrl = await saveMergedImageToS3(
        `data:image/${mergeResult.imageType};base64,${mergeResult.imageBase64}`,
        mergeId.toString(),
        fastify
      );
      // Save to idempotent cache BEFORE releasing lock
      try {
        await mergedStore.updateOne(
          { originalImageUrl: originalGeneratedImageUrl },
          { $set: { mergedImageUrl, mergeId: mergeId.toString(), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
          { upsert: true }
        );
        console.log(`🗂️  [MergeCache] ${new Date().toISOString()} Saved idempotent entry ⏱️ ${Date.now() - startTs}ms`);
      } catch (e) {}
    } finally {
      await db.collection('mergeLocks').deleteOne({ key: lockKey });
      console.log(`🔓 [MergeLock] ${new Date().toISOString()} Released lock ⏱️ ${Date.now() - startTs}ms`);
    }


    // Return merged image data with ALL original fields preserved
    const returnData = {
      ...originalImage,
      imageUrl: mergedImageUrl,
      mergeId: mergeId.toString(),
      originalImageUrl: originalGeneratedImageUrl,
      isMerged: true
    };
    
    console.log(`✅ [Merge] ${new Date().toISOString()} Completed ⏱️ ${Date.now() - startTs}ms`);
    return returnData;

  } catch (error) {
    console.error('[performAutoMergeFaceWithBase64] Error in auto merge:', error);
    return null;
  }
}

// Add this helper function before saveImageToDB
function getTitleString(title) {
  if (!title) return '';
  if (typeof title === 'string') return title;
  if (typeof title === 'object') {
    return title.en || title.ja || title.fr || Object.values(title).find(v => !!v) || '';
  }
  return '';
}

// Add this helper function before saveImageToDB
async function addImageMessageToChatHelper(userDataCollection, userId, userChatId, imageUrl, imageId, prompt, title, nsfw, isMerged, mergeId, originalImageUrl) {
  try {
    const titleString = getTitleString(title);
    const imageIdStr = imageId.toString();
    
    // CRITICAL FIX: Check if message with this imageId already exists to prevent duplicates
    const existingMessage = await userDataCollection.findOne({
      userId: new ObjectId(userId),
      _id: new ObjectId(userChatId),
      'messages.imageId': imageIdStr
    });
    
    if (existingMessage) {
      console.log(`💾 [addImageMessageToChatHelper] Message with imageId ${imageIdStr} already exists, skipping duplicate`);
      return true;
    }
    
    const imageMessage = {
      role: "assistant",
      content: titleString || prompt,
      imageUrl,
      imageId: imageIdStr,
      type: isMerged ? "mergeFace" : "image",
      hidden: true,
      prompt,
      title: titleString,
      nsfw,
      isMerged: isMerged || false,
      createdAt: new Date(),
      timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
    };

    if (isMerged) {
      imageMessage.mergeId = mergeId;
      imageMessage.originalImageUrl = originalImageUrl;
    }
    await userDataCollection.updateOne(
      { userId: new ObjectId(userId), _id: new ObjectId(userChatId) },
      { $push: { messages: imageMessage } }
    );

    console.log(`💾 [addImageMessageToChatHelper] Successfully added message for imageId: ${imageIdStr}`);
    return true;
  } catch (error) {
    console.error('Error adding image message to chat:', error.message);
    return false;
  }
}

// Add this helper function before saveImageToDB
async function updateOriginalMessageWithMerge(userDataCollection, taskId, userId, userChatId, mergeMessage) {
  try {
    // Idempotency: if a merged message with this mergeId already exists, do nothing
    const existing = await userDataCollection.findOne({
      userId: new ObjectId(userId),
      _id: new ObjectId(userChatId),
      'messages.mergeId': mergeMessage.mergeId
    });
    if (existing) {
      console.log(`🧩 mergeId ${mergeMessage.mergeId} already present in chat ${userChatId}`);
      return true;
    }
    //  ===========================
    // DEBUG LOGGING START
    //  ===========================
    console.log(`🧩 [MergeUpdate] ${new Date().toISOString()} === START: Logging userDataCollection messages ===`);
    const chatDoc = await userDataCollection.findOne({ userId: new ObjectId(userId), _id: new ObjectId(userChatId) });
    if (!chatDoc) {
      console.log(`🧩 [MergeUpdate] ${new Date().toISOString()} Chat ${userChatId} not found for user ${userId}`);
      console.log(`🧩 [MergeUpdate] ${new Date().toISOString()} === END: Logging userDataCollection messages ===`);
      return false;
    }
    console.log(`🧩 [MergeUpdate] ${new Date().toISOString()} Searching messages in chat ${userChatId} for originalImageUrl=${mergeMessage.originalImageUrl}`);
    const matchingMessages = chatDoc.messages.filter(m => m.imageUrl === mergeMessage.originalImageUrl && m.isMerged !== true);
    console.log(`🧩 [MergeUpdate] ${new Date().toISOString()} Found ${matchingMessages.length} matching messages for originalImageUrl=${mergeMessage.originalImageUrl}`);
    // Only log image details for messages with imageId or mergeId
    chatDoc.messages.forEach(msg => {
      if (msg.imageId || msg.mergeId) {
      console.log(
      '🕒 createdAt:', msg.createdAt, '\n' +
      '⚙️ type:', msg.type || 'N/A', '\n' +
      '🖼️ imageId:', msg.imageId || '', '\n' +
      '🔗 mergeId:', msg.mergeId || '', '\n' +
      '🌐 imageUrl:', msg.imageUrl || '', '\n' +
      '🏷️ originalImageUrl:', msg.originalImageUrl || ''
      );
      console.log('------------------------------');
      }
    });
    console.log(`🧩 [MergeUpdate] ${new Date().toISOString()} === END: Logging userDataCollection messages ===`);
    //  ===========================
    // DEBUG LOGGING END
    //  ===========================

    // Update the specific original message by matching its imageUrl (the original, unmerged URL)
    const updateResult = await userDataCollection.updateOne(
      { userId: new ObjectId(userId), _id: new ObjectId(userChatId) },
      {
        $set: {
          'messages.$[m].imageUrl': mergeMessage.imageUrl,
          'messages.$[m].type': 'mergeFace',
          'messages.$[m].isMerged': true,
          'messages.$[m].mergeId': mergeMessage.mergeId,
          'messages.$[m].originalImageUrl': mergeMessage.originalImageUrl
        }
      },
      {
        arrayFilters: [
          { 'm.imageUrl': mergeMessage.originalImageUrl, 'm.isMerged': { $ne: true } }
        ]
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(`🧩 Updated original message → merged (mergeId ${mergeMessage.mergeId})`);
      return true;
    }
    console.log(`🧩 No original message matched imageUrl=${mergeMessage.originalImageUrl} to update`);
    return false;
  } catch (error) {
    console.error(`Error updating message:`, error.message);
    return false;
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



  // CRITICAL: Check if already completed FIRST, before any processing
  if (task?.status === 'completed' || task?.completionNotificationSent === true && task?.result?.images?.length > 0) {
    console.log(`[checkTaskStatus] Task ${taskId} is already completed or notification sent.`);
    return {
      taskId: task.taskId,
      userId: task.userId,
      userChatId: task.userChatId,
      status: task.status,
      images: task.result?.images || [],
      result: task.result || { images: [] }
    };
  }

  if (task?.completionNotificationSent === true && task?.result?.images?.length > 0) {
    console.log(`[checkTaskStatus] Task ${taskId} has completion notification sent and images available.`);
    return {
      taskId: task.taskId,
      userId: task.userId,
      userChatId: task.userChatId,
      status: 'completed',
      images: task.result?.images || [],
      result: task.result || { images: [] }
    };
  }

  let processingPercent = 0;

  if (!task) {
    return false;
  }

  if (task.status === 'failed') {
    console.log(`[checkTaskStatus] Task ${taskId} has failed status`);
    return task;
  }

  // Check if webhook already provided the result (skip polling)
  let images;
  if (task.webhookProcessed && task.result?.images) {
    console.log(`[checkTaskStatus] Using webhook-provided images for task ${task.taskId}`);
    // Use images from webhook, convert to array format expected below
    images = Array.isArray(task.result.images) ? task.result.images : [task.result.images];
  } else {
    // Poll Novita for status (legacy/fallback path)
    const result = await fetchNovitaResult(task.taskId);
    console.log(`[checkTaskStatus fetchNovitaResult] Result for task ${task.taskId}:`, result);

    if (result && result.status === 'processing') {
      processingPercent = result.progress;
      return { taskId: task.taskId, status: 'processing', progress: processingPercent};
    }
    
    if(result.error){
      console.log(`[checkTaskStatus] Task ${taskId} returned error: ${result.error}`);
      await tasksCollection.updateOne(
        { taskId: task.taskId },
        { $set: { status: 'failed', result: { error: result.error }, updatedAt: new Date() } }
      );
      return false
    }

    images = Array.isArray(result) ? result : [result];
  }

  if (result && result.status === 'processing') {
    processingPercent = result.progress;
    return { taskId: task.taskId, status: 'processing', progress: processingPercent};
  }
  
  if(result.error){
    console.log(`[checkTaskStatus] Task ${taskId} returned error: ${result.error}`);
    await tasksCollection.updateOne(
      { taskId: task.taskId },
      { $set: { status: 'failed', result: { error: result.error }, updatedAt: new Date() } }
    );
    return false
  }

  // CRITICAL: Lock the task BEFORE processing to prevent parallel execution
  const lockResult = await tasksCollection.findOneAndUpdate(
    { 
      taskId: task.taskId,
      completionNotificationSent: { $ne: true }  // Only lock if not already locked
    },
    { 
      $set: { 
        completionNotificationSent: true,
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'before' }
  );

  if (!lockResult.value) {
    const lockedTask = await tasksCollection.findOne({ taskId: task.taskId });
    return {
      taskId: lockedTask.taskId,
      userId: lockedTask.userId,
      userChatId: lockedTask.userChatId,
      status: 'completed',
      images: lockedTask.result?.images || [],
      result: lockedTask.result || { images: [] }
    };
  }


  // Process auto merge for ALL images if enabled
  let processedImages = images;
  if (task.shouldAutoMerge) {
    // For character creation with merge face, we need to get the uploaded image data
    if (task.chatCreation && task.enableMergeFace) {
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
        processedImages = images.map(imageData => ({ ...imageData, isMerged: false }));
      }
    } else {
      // Regular auto merge logic for existing chats
      const faceImageUrl = chat.chatImageUrl;
      
      if (!faceImageUrl || faceImageUrl.length === 0) {
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

  // Save processed images to database with timeout to prevent overlapping
  const savedImages = [];
  for (let arrayIndex = 0; arrayIndex < processedImages.length; arrayIndex++) {
    const imageData = processedImages[arrayIndex];
    
    let nsfw = task.type === 'nsfw';
    if (imageData.nsfw_detection_result && imageData.nsfw_detection_result.valid && imageData.nsfw_detection_result.confidence >= 50) {
      nsfw = true;
    }
    
    let uniqueSlug = task.slug;
    if (processedImages.length > 1) {
      uniqueSlug = `${task.slug}-${arrayIndex + 1}`;
    }

    // CRITICAL FIX: For merged images, save the ORIGINAL image first to establish a message in chat
    if (task.shouldAutoMerge && imageData.isMerged && imageData.originalImageUrl) {
      
      try {
        await saveImageToDB({
          taskId: task.taskId,
          userId: task.userId,
          chatId: task.chatId,
          userChatId: task.userChatId,
          prompt: task.prompt,
          title: task.title,
          slug: `${uniqueSlug}-original`,
          imageUrl: imageData.originalImageUrl, // Save original URL first
          aspectRatio: task.aspectRatio,
          seed: imageData.seed,
          blurredImageUrl: imageData.blurredImageUrl,
          nsfw: nsfw,
          fastify,
          isMerged: false, // Original is not merged
          originalImageUrl: null,
          mergeId: null,
          shouldAutoMerge: false
        });
      } catch (error) {
        console.error(`[checkTaskStatus] Error saving original image:`, error);
      }
    }

    // Now save the merged/processed image
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
          originalImageId: imageResult.imageId,
          mergedImageUrl: imageData.imageUrl,
          userId: task.userId,
          chatId: task.chatId,
          userChatId: task.userChatId,
          fastify
        });
        
      } catch (error) {
        console.error(`[checkTaskStatus] Error creating merge relationship:`, error);
      }
    }

    savedImages.push({
      ...imageResult,
      status: 'completed'
    });

    // Add small delay between saves to prevent overlapping (except for the last image)
    if (arrayIndex < processedImages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Update task status to completed with proper merge information
  const updateResult = await tasksCollection.findOneAndUpdate(
    { 
      taskId: task.taskId
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
/**
 * Get webhook URL for Novita tasks
 * Uses environment variable or constructs from base domain
 */
function getWebhookUrl() {
  // Check for explicit webhook URL in environment
  if (process.env.NOVITA_WEBHOOK_URL) {
    return process.env.NOVITA_WEBHOOK_URL;
  }
  
  // Construct from base URL
  if (process.env.MODE === 'local') {
    // For local development, use ngrok or local tunnel URL if provided
    if (process.env.LOCAL_WEBHOOK_URL) {
      return process.env.LOCAL_WEBHOOK_URL;
    }
    // Fallback: localhost (may not work - webhook should be publicly accessible)
    return 'http://localhost:3000/novita/webhook';
  } else {
    // Production: use the main domain
    const baseDomain = process.env.PUBLIC_BASE_DOMAIN || 'chatlamix.com';
    return `https://app.${baseDomain}/novita/webhook`;
  }
}

// Function to trigger the Novita API for text-to-image generation
async function fetchNovitaMagic(data, flux = false) {
  try {
    // Validate prompt before sending to API (must be 1-1024 characters)
    if (!data.prompt || typeof data.prompt !== 'string') {
      console.error('[fetchNovitaMagic] Invalid prompt: prompt is missing or not a string');
      return false;
    }
    
    const trimmedPrompt = data.prompt.trim();
    if (trimmedPrompt.length === 0 || trimmedPrompt.length > 1024) {
      console.error(`[fetchNovitaMagic] Invalid prompt length: ${trimmedPrompt.length} (must be 1-1024 characters)`);
      return false;
    }
    
    // Ensure prompt is trimmed and within limits
    data.prompt = trimmedPrompt.length > 1024 ? trimmedPrompt.substring(0, 1024).trim() : trimmedPrompt;
    
    let apiUrl = 'https://api.novita.ai/v3/async/txt2img';
    if (data.image_base64) {
      apiUrl = 'https://api.novita.ai/v3/async/img2img';
    }
    if (flux) {
      apiUrl = 'https://api.novita.ai/v3beta/flux-1-schnell';
      data.response_image_type = 'jpeg';
    }
    
    // Get webhook URL
    const webhookUrl = getWebhookUrl();
    console.log(`[fetchNovitaMagic] 🔗 Webhook URL: ${webhookUrl}`);
    if (webhookUrl.includes('localhost')) {
      console.warn(`[fetchNovitaMagic] ⚠️ WARNING: Using localhost webhook URL - Novita cannot reach this! Set LOCAL_WEBHOOK_URL env variable with ngrok URL.`);
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
          webhook: {
            url: webhookUrl
          }
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
        
    // For FLUX, return the complete response with images
    if (flux) {
      const taskId = response.data.task.task_id;
      console.log(`Flux task completed immediately with ID: ${taskId}`);
      
      // Process images immediately for FLUX
      const images = response.data.images;
      if (images && images.length > 0) {
        const processedImages = await Promise.all(images.map(async (image, index) => {
          const imageUrl = image.image_url;
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(imageResponse.data, 'binary');
          const hash = createHash('md5').update(buffer).digest('hex');
          const uploadedUrl = await uploadToS3(buffer, hash, 'novita_result_image.png');
          console.log(`[fetchNovitaMagic] Uploaded image ${index + 1} with hash: ${hash}`);
          return { 
            imageId: hash, 
            imageUrl: uploadedUrl, 
            nsfw_detection_result: null, // FLUX doesn't return NSFW detection
            seed: 0, // FLUX uses seed 0
            index
          };
        }));
        
        return {
          taskId,
          status: 'completed',
          images: processedImages.length === 1 ? processedImages[0] : processedImages,
          isFluxComplete: true // Flag to indicate immediate completion
        };
      }
    }
    
    // For non-FLUX, return just the task ID for polling
    const taskId = response.data.task_id;
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
          console.log(`🚀 [fetchNovitaResult] Uploaded image ${index + 1} with hash: ${hash}`);
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

function characterDescriptionToString(data) {
    if(!data) return "";
    
    const details = data?.details_description;
    const appearance = details?.appearance;
    const face = details?.face;
    const hair = details?.hair;
    const body = details?.body;
    const style = details?.style;
    
    // Build physical description string
    let description = [];
    
    // Basic appearance
    if (appearance?.age) description.push(`Age: ${appearance.age}`);
    if (appearance?.gender) description.push(`Gender: ${appearance.gender}`);
    if (appearance?.ethnicity) description.push(`Ethnicity: ${appearance.ethnicity}`);
    if (appearance?.height) description.push(`Height: ${appearance.height}`);
    if (appearance?.weight) description.push(`Weight: ${appearance.weight}`);
    if (appearance?.bodyType) description.push(`Body Type: ${appearance.bodyType}`);
    
    // Face features
    if (face?.faceShape) description.push(`Face Shape: ${face.faceShape}`);
    if (face?.skinColor) description.push(`Skin: ${face.skinColor}`);
    if (face?.eyeColor) description.push(`Eyes: ${face.eyeColor}`);
    if (face?.eyeShape) description.push(`Eye Shape: ${face.eyeShape}`);
    if (face?.eyeSize) description.push(`Eye Size: ${face.eyeSize}`);
    if (face?.facialFeatures) description.push(`Facial Features: ${face.facialFeatures}`);
    
    // Hair
    if (hair?.hairColor) description.push(`Hair Color: ${hair.hairColor}`);
    if (hair?.hairLength) description.push(`Hair Length: ${hair.hairLength}`);
    if (hair?.hairStyle) description.push(`Hair Style: ${hair.hairStyle}`);
    if (hair?.hairTexture) description.push(`Hair Texture: ${hair.hairTexture}`);
    
    // Body details
    if (body?.breastSize) description.push(`Breast Size: ${body.breastSize}`);
    if (body?.assSize) description.push(`Ass Size: ${body.assSize}`);
    if (body?.bodyCurves) description.push(`Body Curves: ${body.bodyCurves}`);
    if (body?.chestBuild) description.push(`Chest Build: ${body.chestBuild}`);
    if (body?.shoulderWidth) description.push(`Shoulders: ${body.shoulderWidth}`);
    if (body?.absDefinition) description.push(`Abs: ${body.absDefinition}`);
    if (body?.armMuscles) description.push(`Arms: ${body.armMuscles}`);
    
    // Style and accessories
    if (style?.clothingStyle) description.push(`Clothing Style: ${style.clothingStyle}`);
    if (style?.accessories) description.push(`Accessories: ${style.accessories}`);
    if (style?.tattoos && style.tattoos !== 'none') description.push(`Tattoos: ${style.tattoos}`);
    if (style?.piercings && style.piercings !== 'none') description.push(`Piercings: ${style.piercings}`);
    if (style?.scars && style.scars !== 'none') description.push(`Scars: ${style.scars}`);
    
    // Fallback to existing description fields if no structured data
    if (description.length === 0) {
        const fallbackDescription = data?.enhancedPrompt || data?.imageDescription || data?.characterPrompt || "";
        return fallbackDescription;
    }
    
    return description.join(', ');
}
async function checkImageDescription(db, chatId = null, chatRawData = null) {
  try {
    let chatData = chatRawData;
    if (!chatData) {
      chatData = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
    }
    const characterPrompt = chatData?.enhancedPrompt || chatData?.imageDescription || chatData?.characterPrompt || null;
    const characterDescriptionString = characterDescriptionToString(chatData);
    characterDescription = (characterPrompt ? ` ${characterPrompt}` : '') +' '+ (characterDescriptionString ? ` ${characterDescriptionString}` : '');
    
    return characterDescription;

  } catch (error) {
    console.error('Error checking image description:', error);
    return { imageDescription: null };
    
  }
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

    // More flexible duplicate check for character creation and merged images
    let existingImage;
    
    if (isMerged && mergeId) {
      existingImage = await chatsGalleryCollection.findOne({
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId),
        'images.taskId': taskId,
        'images.mergeId': mergeId
      });
      
      if (existingImage) {
        const image = existingImage.images.find(img => img.mergeId === mergeId);
        if (image) {
          // CRITICAL FIX: Even if image exists in gallery, ensure chat message exists
          if (userChatId && ObjectId.isValid(userChatId)) {
            const userDataCollection = db.collection('userChat');
            const existingMessage = await userDataCollection.findOne({
              userId: new ObjectId(userId),
              _id: new ObjectId(userChatId),
              'messages.mergeId': mergeId
            });
            if (!existingMessage) {
              console.log(`💾 [saveImageToDB] Image exists in gallery but message missing - adding message for mergeId: ${mergeId}`);
              const mergeMessage = {
                imageUrl: image.imageUrl,
                mergeId: mergeId,
                originalImageUrl: originalImageUrl
              };
              await updateOriginalMessageWithMerge(userDataCollection, taskId, userId, userChatId, mergeMessage);
            }
          }
          return { 
            imageId: image._id, 
            imageUrl: image.imageUrl,
            prompt: image.prompt,
            title: image.title,
            nsfw: image.nsfw,
            isMerged: image.isMerged || false
          };
        }
      } 
    } else {
      existingImage = await chatsGalleryCollection.findOne({
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId),
        'images.taskId': taskId,
        'images.imageUrl': imageUrl
      });

      if (existingImage) {
        const image = existingImage.images.find(img => 
          img.imageUrl === imageUrl && img.taskId === taskId
        );
        if (image) {
          // CRITICAL FIX: Even if image exists in gallery, ensure chat message exists
          if (userChatId && ObjectId.isValid(userChatId)) {
            const userDataCollection = db.collection('userChat');
            const existingMessage = await userDataCollection.findOne({
              userId: new ObjectId(userId),
              _id: new ObjectId(userChatId),
              'messages.imageId': image._id.toString()
            });
            if (!existingMessage) {
              console.log(`💾 [saveImageToDB] Image exists in gallery but message missing - adding message for imageId: ${image._id}`);
              await addImageMessageToChatHelper(
                userDataCollection,
                userId, 
                userChatId, 
                image.imageUrl, 
                image._id, 
                image.prompt, 
                image.title,
                image.nsfw,
                false,
                null,
                null
              );
            }
          }
          return { 
            imageId: image._id, 
            imageUrl: image.imageUrl,
            prompt: image.prompt,
            title: image.title,
            nsfw: image.nsfw,
            isMerged: image.isMerged || false
          };
        }
      } 
    }

    // Generate imageId first (needed for slug generation)
    const imageId = new ObjectId();
    
    // Generate enhanced slug if not provided
    if (!slug) {
      try {
        // Get chat to access its slug for enhanced image slug generation
        const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
        const chatSlug = chat?.slug || '';
        
        // Get title for slug
        const imageTitle = title && typeof title === 'object' 
          ? (title.en || title.ja || title.fr || '')
          : (title || '');
        
        // Generate enhanced image slug using the actual imageId
        slug = generateImageSlug(imageTitle || prompt.substring(0, 50), chatSlug, imageId);
        
        // Double-check for duplicates (shouldn't happen with ObjectId, but be safe)
        const existingImage_check = await chatsGalleryCollection.findOne({
          "images.slug": slug
        });
        
        if (existingImage_check) {
          // Edge case: append timestamp if somehow duplicate
          const timestamp = Date.now().toString(36).substring(7);
          slug = `${slug}-${timestamp}`;
        }
      } catch (err) {
        console.error('[saveImageToDB] Error generating enhanced image slug, using fallback:', err);
        // Fallback to basic slug generation
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
          const randomStr = Math.random().toString(36).substring(2, 8);
          slug = `${slug}-${randomStr}`;
        }
      }
    }
    const imageDocument = { 
      _id: imageId, 
      taskId,
      prompt, 
      title,
      slug,
      imageUrl, 
      originalImageUrl: imageUrl,
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
    } else {
      imageDocument.isMerged = false;
    }
    

    const updateResult = await chatsGalleryCollection.updateOne(
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
    const chatUpdateResult = await chatsCollection.updateOne(
      { _id: new ObjectId(chatId) },
      { $inc: { imageCount: 1 } }
    );

    const usersCollection = db.collection('users');
    const userUpdateResult = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { imageCount: 1 } }
    );
    
    try {
      await awardImageGenerationReward(db, userId, fastify);
      await awardCharacterImageMilestoneReward(db, userId, chatId, fastify);
    } catch (error) {
      console.error('Error awarding image generation milestones:', error);
    }
    
    if (!userChatId || !ObjectId.isValid(userChatId)) {
      console.log(`[saveImageToDB] Invalid or missing userChatId: ${userChatId}`);
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

    const titleString = getTitleString(title);

    if (userChatId && isMerged) {
      
      const mergeMessage = {
        imageUrl,
        mergeId: mergeId,
        originalImageUrl: originalImageUrl
      };

      const wasUpdated = await updateOriginalMessageWithMerge(userDataCollection, taskId, userId, userChatId, mergeMessage);
      console.log(`updateOriginalMessageWithMerge returned: ${wasUpdated}`);
   
    } else if (userChatId) {
      console.log(`💾 Adding image (non merged) message to chat for userChatId: ${userChatId}`)
      await addImageMessageToChatHelper(
        userDataCollection,
        userId, 
        userChatId, 
        imageUrl, 
        imageId, 
        prompt, 
        title,
        nsfw,
        false,
        null,
        null
      );
      
    }

    return { 
      imageId, 
      imageUrl,
      prompt,
      title,
      nsfw,
      isMerged: isMerged || false
    };
    
  } catch (error) {
    return false;
  }
}

// Handle task completion: send notifications and save images as needed
async function handleTaskCompletion(taskStatus, fastify, options = {}) {
  const { chatCreation, translations, userId, chatId, placeholderId } = options;
  let images = [];
  let characterImageUrls = [];
  // Try multiple ways to get the correct images with merge data
  if (taskStatus.result && Array.isArray(taskStatus.result.images)) {
    images = taskStatus.result.images;
  } else if (Array.isArray(taskStatus.images)) {
    images = taskStatus.images;
  } else if (taskStatus.result && taskStatus.result.images && !Array.isArray(taskStatus.result.images)) {
    images = [taskStatus.result.images];
  }
  if (typeof fastify.sendNotificationToUser !== 'function') {
    console.error('fastify.sendNotificationToUser is not a function');
    return;
  }
  
  fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action: 'remove' });
  fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId: placeholderId, spin: false });
  fastify.sendNotificationToUser(userId, 'updateImageCount', { chatId, count: images.length });

  if (images || Array.isArray(images)) {

    try {
      // Increment image generation count once per task, not per image
      await fastify.mongo.db.collection('images_generated').updateOne(
        { userId: new ObjectId(taskStatus.userId), chatId: chatId ? new ObjectId(chatId) : null },
        { $inc: { generationCount: images.length } }, // Increment by the number of images
        { upsert: true }
      );
    } catch (error) {
      console.error('[handleTaskCompletion] Error incrementing image generation count:', error);
    }

    let characterImageUrls = [];

    for (let index = 0; index < images.length; index++) {
      const image = images[index];
      const { imageId, imageUrl, prompt, title, nsfw, isMerged } = image;
      const { userId: taskUserId, userChatId } = taskStatus;
            
      if (chatCreation) {
        fastify.sendNotificationToUser(userId, 'characterImageGenerated', { imageUrl, nsfw, chatId });
        characterImageUrls.push(imageUrl);
      } else {
        const notificationData = {
          id: imageId?.toString(),
          imageId: imageId?.toString(),
          imageUrl,
          userChatId,
          title: getTitleString(title),
          prompt,
          nsfw,
          isMergeFace: isMerged || false,
          isAutoMerge: isMerged || false,
          url: imageUrl
        };

        fastify.sendNotificationToUser(userId, 'imageGenerated', notificationData);
      
        // ===========================
        // == User Chat Message Image Debug ==
        // ===========================
        const userChatCollection = fastify.mongo.db.collection('userChat');
        try {
          const userChatData = await userChatCollection.findOne({ userId: new ObjectId(userId), _id: new ObjectId(userChatId) });
          if (false && userChatData) {
            console.log('\n==============================');
            console.log(`== User Chat Message (${userChatId}) Image Debug ==`);
            console.log('==============================');
            const imageMessage = userChatData.messages.find(msg => msg.imageId && msg.imageId.toString() === imageId?.toString());
            console.log(`🖼️ imageMessage for imageId ${imageId}:`, imageMessage);
            const testMergeId = imageId
            const mergeMessage = userChatData.messages.find(msg => msg.mergeId && msg.mergeId === testMergeId);
            console.log(`🔗 mergeMessage for mergeId ${testMergeId}:`, mergeMessage);
            // Check for imageUrl again originalImageUrl in case of merge
            const imageUrlMessage = userChatData.messages.find(msg => msg.imageUrl === imageUrl || msg.imageUrl === image.originalImageUrl);
            console.log(`🌐 imageUrlMessage for imageUrl ${imageUrl} or originalImageUrl ${image.originalImageUrl}:`, imageUrlMessage);
            
            console.log('\n==============================');
            console.log(`== Log Image in chat (${userChatId}) ==`);
            console.log('==============================');
            userChatData.messages.forEach(msg => {
          if (msg.imageId || msg.mergeId) {
              console.log(
            '🕒 createdAt:', msg.createdAt, '\n' +
            '⚙️ type:', msg.type || 'N/A', '\n' +
            '🖼️ imageId:', msg.imageId || '', '\n' +
            '🔗 mergeId:', msg.mergeId || '', '\n' +
            '🌐 imageUrl:', msg.imageUrl || '', '\n' +
            '🏷️ originalImageUrl:', msg.originalImageUrl || ''
              );
              console.log('------------------------------');
          }
            });
            console.log(`==============================\n`);
            console.log(`== End Log ==`);
            console.log(`==============================\n`);
          } else {
            console.log(`⚠️ No UserChat data found for userId ${userId} and userChatId ${userChatId}`);
          }
        } catch (error) {
          console.error(`[handleTaskCompletion] Error fetching UserChat data for logging:`, error);
        }
        // ===========================
        // == End Section ==
        // ===========================
      }
    }
  }

  // For character creation, update the chat with all image URLs
  if (chatCreation && characterImageUrls.length > 0) {
    const collectionChats = fastify.mongo.db.collection('chats');
    await collectionChats.updateOne(
      { _id: new ObjectId(chatId) },
      { 
        $set: { 
          chatImageUrl: characterImageUrls
        } 
      }
    );
  }

  if (chatCreation) {
    fastify.sendNotificationToUser(userId, 'resetCharacterForm');
    fastify.sendNotificationToUser(userId, 'showNotification', {
      message: translations?.newCharacter?.imageCompletionDone_message || 'Your image has been generated successfully.',
      icon: 'success'
    });
    const notification = {
      title: translations?.newCharacter?.imageCompletionDone_title || 'Image generation completed',
      message: translations?.newCharacter?.imageCompletionDone_message || 'Your image has been generated successfully.',
      type: 'image',
      link: `/chat/${chatId}`,
      ico: 'success'
    };
    addNotification(fastify, userId, notification).then(() => {
      fastify.sendNotificationToUser(userId, 'updateNotificationCountOnLoad', { userId });
    });
  }
}

module.exports = {
  generateImg,
  getPromptById,
  getImageSeed,
  checkImageDescription,
  characterDescriptionToString,
  getTasks,
  deleteOldTasks,
  deleteAllTasks,
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
  fetchOriginalTaskData,
  getTitleString
};