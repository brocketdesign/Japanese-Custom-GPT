const { generatePromptTitle } = require('./openai')
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { ObjectId } = require('mongodb');
const axios = require('axios');
const { createHash } = require('crypto');
const { addNotification, saveChatImageToDB } = require('../models/tool')
const slugify = require('slugify');
const sharp = require('sharp');
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
async function generateImg({title, prompt, negativePrompt, aspectRatio, imageSeed, regenerate, userId, chatId, userChatId, imageType, image_num, image_base64, chatCreation, placeholderId, translations, fastify, flux = false}) {
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
    const imageModel = chat.imageModel || 'novaAnimeXL_ponyV20_461138';
    
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
    console.log(`[generateImg] new request for ${imageType} with prompt:`, requestData.prompt);

    // Send request to Novita and get taskId
    const novitaTaskId = await fetchNovitaMagic(requestData, flux);
    
    // Store task details in DB
    const checkTaskValidity = await db.collection('tasks').insertOne({
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
      updatedAt: new Date()
    });
    
    // Check if the task has been saved
    if (!checkTaskValidity.insertedId) {
      console.log('Error saving task to DB');
      // error handling here
      fastify.sendNotificationToUser(userId, 'showNotification', { message:translations.newCharacter.errorInitiatingImageGeneration, icon:'error' });
      fastify.sendNotificationToUser(userId, 'handleLoader', { imageId:placeholderId, action:'remove' })
      fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId:placeholderId, spin: false })
      fastify.sendNotificationToUser(userId, 'resetCharacterForm');
      return false;
    }

    let newTitle = title;
    if (!title) {
      const lang = user.language || 'english';
      // Only generate title for user's language
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
    
    console.log(`[generateImg] Generated slug: ${taskSlug}`);
    // Update task with the slug
    updateSlug({ taskId: novitaTaskId, taskSlug, fastify, userId, chatId, placeholderId });

    // Poll the task status
    pollTaskStatus(novitaTaskId, fastify) 
    .then(taskStatus => {
      if (taskStatus.status === 'background') {
        console.log(`[pollTaskStatus] Task ${taskStatus.taskId} moved to background`);
        return;
      }
      handleTaskCompletion(taskStatus, fastify, { chatCreation, translations, userId, chatId, placeholderId });
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
      const maxZeroProgressAttempts = 5;

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
  const images = (taskStatus.result && Array.isArray(taskStatus.result.images))
    ? taskStatus.result.images
    : (Array.isArray(taskStatus.images) ? taskStatus.images : []);

  if (typeof fastify.sendNotificationToUser !== 'function') {
    console.error('fastify.sendNotificationToUser is not a function');
    return;
  }

  fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action: 'remove' });
  fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId: placeholderId, spin: false });

  if (Array.isArray(images)) {
    for (let index = 0; index < images.length; index++) {
      const image = images[index];
      const { imageId, imageUrl, prompt, title, nsfw } = image;
      const { userId: taskUserId, userChatId } = taskStatus;

      if (chatCreation) {
        fastify.sendNotificationToUser(userId, 'characterImageGenerated', { imageUrl, nsfw });
        if (index === 0) {
          console.log('[handleTaskCompletion] Saving image as character thumbnail fastify.sendNotificationToUser:', userId, imageUrl);
          await saveChatImageToDB(fastify.mongo.db, chatId, imageUrl);
        }
      } else {
        console.log('[handleTaskCompletion] Sending image to user:', userId, imageUrl);
        fastify.sendNotificationToUser(userId, 'imageGenerated', {
          imageUrl,
          imageId,
          userChatId,
          title,
          prompt,
          nsfw
        });
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
  let processingPercent = 0;
  if (!task) {
    console.log(`Task not found: ${taskId}`);
    return false;
  }

  if (['completed', 'failed'].includes(task.status)) {
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
  const savedImages = await Promise.all(images.map(async (imageData, arrayIndex) => {  // Added arrayIndex parameter here
    let nsfw = task.type === 'nsfw';
    // Check if the image is NSFW with a confidence threshold of 50 and more
    if (imageData.nsfw_detection_result && imageData.nsfw_detection_result.valid && imageData.nsfw_detection_result.confidence >= 50) {
      nsfw = true;
    }
    
    // Generate a unique slug for each image when there are multiple
    let uniqueSlug = task.slug;
    if (images.length > 1) {
      // Append index to slug for uniqueness
      uniqueSlug = `${task.slug}-${arrayIndex + 1}`;  // Now arrayIndex is defined!
      
      // Ensure slug is unique by checking against existing slugs
      const existingWithSlug = await db.collection('gallery').findOne({
        "images.slug": uniqueSlug
      });
      
      if (existingWithSlug) {
        const randomStr = Math.random().toString(36).substring(2, 6);
        uniqueSlug = `${uniqueSlug}-${randomStr}`;
      }
    }

    const saveResult = await saveImageToDB({
      taskId,
      userId: task.userId,
      chatId: task.chatId,
      userChatId: task.userChatId,
      prompt: task.prompt,
      title: task.title,
      slug: uniqueSlug,
      imageUrl: imageData.imageUrl,
      aspectRatio: task.aspectRatio,
      seed: imageData.seed,
      blurredImageUrl: null,
      nsfw,
      fastify
    });

    return { nsfw, imageId: saveResult.imageId, imageUrl: imageData.imageUrl, prompt: task.prompt, title: task.title };
  }));

  await tasksCollection.updateOne(
    { taskId: task.taskId },
    { $set: { status: 'completed', result: { images: savedImages }, updatedAt: new Date() } }
  );

  return { taskId: task.taskId, userId: task.userId, userChatId: task.userChatId, status: 'completed', images: savedImages };
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

  // Configure AWS S3
  const s3 = new S3Client({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    });
  const uploadToS3 = async (buffer, hash, filename) => {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `${hash}_${filename}`,
      Body: buffer,
      ACL: 'public-read', // Optionally remove if you manage this via bucket policy
    };
    
    const command = new PutObjectCommand(params);
    const uploadResult = await s3.send(command);
    return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
  };
  
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

async function saveImageToDB({taskId, userId, chatId, userChatId, prompt, title, slug, imageUrl, aspectRatio, seed, blurredImageUrl = null, nsfw = false, fastify}) {
    const db = fastify.mongo.db;
    try {
      const chatsGalleryCollection = db.collection('gallery');

      // Check if the image has already been saved for this task
      const existingImage = await chatsGalleryCollection.findOne({
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId),
        'images.imageUrl': imageUrl // Assuming imageUrl is unique per image
      });
      

      if (existingImage) {
        // Image already exists, return existing imageId and imageUrl
        const image = existingImage.images.find(img => img.imageUrl === imageUrl);
        return { imageId: image._id, imageUrl: image.imageUrl };
      }

      // If no slug provided, generate one
      if (!slug) {
        console.log(`[saveImageToDB] Generating slug for image with prompt: ${prompt}`);
        if (title && typeof title === 'object') {
          const firstAvailableTitle = title.en || title.ja || title.fr || '';
          slug = slugify(firstAvailableTitle.substring(0, 50), { lower: true, strict: true });
        } else {
          slug = slugify(prompt.substring(0, 50), { lower: true, strict: true });
        }
        
        // Ensure slug is unique
        const existingImage_check = await chatsGalleryCollection.findOne({
          "images.slug": slug
        });
        
        if (existingImage_check) {
          const randomStr = Math.random().toString(36).substring(2, 6);
          slug = `${slug}-${randomStr}`;
        }
      }

      const imageId = new ObjectId();
      await chatsGalleryCollection.updateOne(
        { 
          userId: new ObjectId(userId),
          chatId: new ObjectId(chatId),
        },
        { 
          $push: { 
            images: { 
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
            } 
          },
        },
        { upsert: true }
      );
      // log the inserted image for debugging
      console.log(`[saveImageToDB] Image saved with ID: ${imageId}`);
      const imageData = await chatsGalleryCollection.findOne({ userId: new ObjectId(userId), chatId: new ObjectId(chatId), "images._id": imageId });
      if (!imageData) {
        console.log(`[saveImageToDB] Image not found after saving: ${imageId}`);
        return false;
      }

      const chatsCollection = db.collection('chats');
      await chatsCollection.updateOne(
        { _id: new ObjectId(chatId) },
        { $inc: { imageCount: 1 } }
      );
  
      if (!userChatId || !ObjectId.isValid(userChatId)) {
        return { imageUrl };
      }

      const userDataCollection = db.collection('userChat');
      const userData = await userDataCollection.findOne({ 
        userId: new ObjectId(userId), 
        _id: new ObjectId(userChatId) 
      });
  
      if (!userData) {
        throw new Error('User data not found');
      }
  
      const imageMessage = { role: "assistant", content: `[Image] ${imageId}` };
      await userDataCollection.updateOne(
        { 
          userId: new ObjectId(userId), 
          _id: new ObjectId(userChatId) 
        },
        { 
          $push: { messages: imageMessage }, 
          $set: { updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) } 
        }
      );
  
      return { imageId, imageUrl };
  
    } catch (error) {
      console.log(error);
      console.log('Error saving image to DB:', error.message);
      return false
    }
  }

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
  console.log('[getImageSeed] Called with imageId:', imageId);
  if (!ObjectId.isValid(imageId)) {
    console.error('[getImageSeed] Invalid imageId format:', imageId);
    throw new Error('Invalid imageId format');
  }
  try {
    const objectId = new ObjectId(imageId);
    console.log('[getImageSeed] Searching for image with _id:', objectId);
    const imageDocument = await db.collection('gallery').findOne(
      { "images._id": objectId },
      { projection: { "images.$": 1 } }
    );

    if (!imageDocument || !imageDocument.images?.length) {
      console.warn('[getImageSeed] No image found for imageId:', imageId);
      return null;
    }

    const image = imageDocument.images[0];
    console.log('[getImageSeed] Found image, seed:', image.seed);
    return Number.isInteger(image.seed) ? image.seed : parseInt(image.seed, 10);
  }
  catch (error) {
    console.error('[getImageSeed] Error fetching image seed:', error);
    return null;
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
    checkTaskStatus
  };