
const { generatePromptTitle } = require('./openai')
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { ObjectId } = require('mongodb');
const axios = require('axios');
const { createHash } = require('crypto');
const { addNotification, saveChatImageToDB } = require('../models/tool')

const default_prompt = {
    sdxl: {
      sfw: {
        sampler_name: "Euler a",
        prompt: `score_9, score_8_up, masterpiece, best quality, (ultra-detailed), (perfect hands:0.1), (sfw), dressed, clothes, `,
        negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, nipple, topless, nsfw, naked, nude, sex, worst quality, low quality,young,child,dick,man`,
        width: 832,
        height: 1216,
        loras: []
      },
      nsfw: {
        sampler_name: "Euler a",
        prompt: `score_9, score_8_up, masterpiece, best quality, (ultra-detailed), (nsfw), uncensored, `,
        negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, worst quality, low quality,young,child,dick,man`,
        width: 832,
        height: 1216,
        loras: []
      }
    },
    sd: {
      sfw: {
        sampler_name: "DPM++ 2M Karras",
        prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (sfw), dressed, clothe on, natural lighting, `,
        negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo, nsfw,nude, topless, worst quality, low quality,disform,weird body,multiple hands,young,child,dick,man `,
        loras: [{"model_name":"more_details_59655.safetensors","strength":0.2},{ model_name: 'JapaneseDollLikeness_v15_28382.safetensors', strength: 0.7 },{"model_name":"PerfectFullBreasts-fCV3_59759.safetensors","strength":0.7}],
      },
      nsfw: {
        sampler_name: "DPM++ 2M Karras",
        prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (nsfw),uncensored, `,
        negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo,disform,weird body,multiple hands,young,child,dick,man`,
        loras: [{"model_name":"more_details_59655.safetensors","strength":0.2},{ model_name: 'JapaneseDollLikeness_v15_28382.safetensors', strength: 0.7 },{"model_name":"PerfectFullBreasts-fCV3_59759.safetensors","strength":0.7}],
      }
    }
  };    
  
  const params = {
    model_name: "novaAnimeXL_ponyV20_461138.safetensors",
    prompt: '',
    negative_prompt: '',
    width: 832,
    height: 1216,
    sampler_name: "Euler a",
    guidance_scale: 7.5,
    steps: 30,
    image_num: 1,
    clip_skip: 0,
    strength: 0.9,
    seed: -1,
    loras: [],
  }

// Module to generate an image
async function generateImg({title, prompt, aspectRatio, userId, chatId, userChatId, imageType, image_num, image_base64, chatCreation, placeholderId, translations, fastify}) {
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
  
    // Select prompts and model based on imageStyle
    const selectedStyle = default_prompt[imageVersion] || default_prompt['sdxl'];
    const imageModel = chat.imageModel || 'novaAnimeXL_ponyV20_461138';
  
    // Prepare task based on imageType
    let image_request;
    if (imageType === 'sfw') {
      image_request = {
        type: 'sfw',
        model_name: imageModel.replace('.safetensors', '') + '.safetensors',
        sampler_name: selectedStyle.sfw.sampler_name || '',
        loras: selectedStyle.sfw.loras,
        prompt: (selectedStyle.sfw.prompt + prompt).replace(/^\s+/gm, '').trim(),
        negative_prompt: selectedStyle.sfw.negative_prompt,
        width: selectedStyle.width || params.width,
        height: selectedStyle.height || params.height,
        blur: false
      };
    } else {
      image_request = {
        type: 'nsfw',
        model_name: imageModel.replace('.safetensors', '') + '.safetensors',
        sampler_name: selectedStyle.nsfw.sampler_name || '',
        loras: selectedStyle.nsfw.loras,
        prompt: selectedStyle.nsfw.prompt + prompt,
        negative_prompt: selectedStyle.nsfw.negative_prompt,
        width: selectedStyle.width || params.width,
        height: selectedStyle.height || params.height,
        blur: !isSubscribed
      };
    }
  
    // Prepare params
    let requestData = { ...params, ...image_request, image_num };
    if(image_base64){
      requestData.image_base64 = image_base64;
    }
    console.log({ model_name: requestData.model_name, prompt: requestData.prompt, nsfw: image_request.type, image_base64: !!requestData.image_base64 });
  
    // Send request to Novita and get taskId
    const novitaTaskId = await fetchNovitaMagic(requestData);
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
      const title_en =  generatePromptTitle(requestData.prompt, 'english');
      const title_ja =  generatePromptTitle(requestData.prompt, 'japanese');
      const title_fr =  generatePromptTitle(requestData.prompt, 'french');
      newTitle = {
        en: title_en,
        ja: title_ja,
        fr: title_fr
      };
      // Wait for all titles and update task with title
      const title_promises = [title_en, title_ja, title_fr];
      Promise.all(title_promises).then((titles) => {
        newTitle = {
          en: titles[0],
          ja: titles[1],
          fr: titles[2]
        };
        updateTitle({ taskId:novitaTaskId , newTitle, fastify, userId, chatId, placeholderId });
      });
    }
  
    // Poll the task status
    pollTaskStatus(novitaTaskId, fastify)
    .then(taskStatus => {
      fastify.sendNotificationToUser(userId, 'handleLoader', { imageId:placeholderId, action:'remove' })
      fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId:placeholderId, spin: false })
      if(chatCreation){ 
        fastify.sendNotificationToUser(userId, 'resetCharacterForm');
        fastify.sendNotificationToUser(userId, 'showNotification', {message:translations.newCharacter.imageCompletionDone_message, icon:'success'});
        // Add notification
        const notification = { title: translations.newCharacter.imageCompletionDone_title , message: translations.newCharacter.imageCompletionDone_message, link: `/chat/edit/${chatId}`, ico: 'success' };
        addNotification(fastify, userId, notification).then(() => {        
          fastify.sendNotificationToUser(userId, 'updateNotificationCountOnLoad', {userId});
        });
       }
      const { images } = taskStatus;
      images.forEach((image, index) => {
          const { imageId, imageUrl, prompt, title, nsfw } = image;
          const { userId, userChatId } = taskStatus;
          if(chatCreation){
            fastify.sendNotificationToUser(userId, 'characterImageGenerated', {
              imageUrl,
              nsfw
            });
            if(index == 0){
              saveChatImageToDB(db, chatId, imageUrl)
            }
          }else{
            fastify.sendNotificationToUser(userId, 'imageGenerated', {
              imageUrl,
              imageId,
              userChatId,
              title,
              prompt,
              nsfw
            });
          }
      });
    })
    .catch(error => {
      // error handling here
      console.error('Error initiating image generation:', error);
      fastify.sendNotificationToUser(userId, 'showNotification', { message:translations.newCharacter.errorInitiatingImageGeneration, icon:'error' });
      fastify.sendNotificationToUser(userId, 'handleLoader', { imageId:placeholderId, action:'remove' })
      fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId:placeholderId, spin: false })
      fastify.sendNotificationToUser(userId, 'resetCharacterForm');
    });

    console.log('Task status:', novitaTaskId);
    return { taskId: novitaTaskId };

  }

// Module to check the status of a task at regular intervals
const completedTasks = new Set();

async function pollTaskStatus(taskId, fastify) {
  const startTime = Date.now();
  const interval = 3000;
  const timeout = 180000; // 3 minutes

  return new Promise((resolve, reject) => {
    const intervalId = setInterval(async () => {
      try {
        const taskStatus = await checkTaskStatus(taskId, fastify);
        if(!taskStatus){
          clearInterval(intervalId);
          reject('Task not found');
        }
        if (taskStatus.status === 'completed') {
          clearInterval(intervalId);
          completedTasks.add(taskId);
          resolve(taskStatus);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(intervalId);
          reject('Task polling timed out.');
        }
      } catch (error) {
        clearInterval(intervalId);
        reject(error);
      }
    }, interval);
  });
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

// Module to delete tasks older than 5 minutes
async function deleteOldPendingAndFailedTasks(db) {
  try {
    const tasksCollection = db.collection('tasks');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = await tasksCollection.deleteMany({ createdAt: { $lt: fiveMinutesAgo }, status: { $in: ['pending', 'failed'] } });
    console.log(`Deleted ${result.deletedCount} old pending or failed tasks.`);
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
    console.log(`Deleted ${result.deletedCount} tasks.`);
  } catch (error) {
    console.error('Error deleting tasks:', error);
  }
} 
async function checkTaskStatus(taskId, fastify) {
  const db = fastify.mongo.db;
  const tasksCollection = db.collection('tasks');
  const task = await tasksCollection.findOne({ taskId });

  if (!task) {
    console.log(`Task not found: ${taskId}`);
    return false;
  }

  if (['completed', 'failed'].includes(task.status)) {
    return task;
  }

  const result = await fetchNovitaResult(task.taskId);
  if (!result) {
    return { taskId: task.taskId, status: 'processing' };
  }
  if(result.error){
    await tasksCollection.updateOne(
      { taskId: task.taskId },
      { $set: { status: 'failed', result: { error: result.error }, updatedAt: new Date() } }
    );
    return false
  }
  const images = Array.isArray(result) ? result : [result];
  const savedImages = await Promise.all(images.map(async (imageData) => {
    let nsfw = task.type === 'nsfw';
    // Check if the image is NSFW with a confidence threshold of 50 and more
    if (imageData.nsfw_detection_result && imageData.nsfw_detection_result.valid && imageData.nsfw_detection_result.confidence >= 50) {
      nsfw = true;
    }
    const saveResult = await saveImageToDB({
      taskId,
      userId: task.userId,
      chatId: task.chatId,
      userChatId: task.userChatId,
      prompt: task.prompt,
      title: task.title,
      imageUrl: imageData.imageUrl,
      aspectRatio: task.aspectRatio,
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
async function fetchNovitaMagic(data) {
    try {
    let apiUrl = 'https://api.novita.ai/v3/async/txt2img';
    if(data.image_base64){
      apiUrl = 'https://api.novita.ai/v3/async/img2img';
    }

    const response = await axios.post(apiUrl, {
        extra: {
          response_image_type: 'jpeg',
          enable_nsfw_detection: true,
          nsfw_detection_level: 0,
        },
        request: data,
    }, {
        headers: {
        Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
        'Content-Type': 'application/json',
        },
    });

    if (response.status !== 200) {
      console.log(`Error - ${response.data}`);
      return false
    }

      return response.data.task_id;
    } catch (error) {
      console.log(error)
      console.error('Error fetching Novita image:', error.message);
      return false
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

    if (taskStatus === 'TASK_STATUS_SUCCEED') {
        const images = response.data.images;
        if (images.length === 0) {
        throw new Error('No images returned from Novita API');
        }

        const s3Urls = await Promise.all(images.map(async (image) => {
          const imageUrl = image.image_url;
          const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(imageResponse.data, 'binary');
          const hash = createHash('md5').update(buffer).digest('hex');
          const uploadedUrl = await uploadToS3(buffer, hash, 'novita_result_image.png');
          return { imageId: hash, imageUrl: uploadedUrl, nsfw_detection_result: image.nsfw_detection_result };
        }));

        return s3Urls.length === 1 ? s3Urls[0] : s3Urls;
    } else if (taskStatus === 'TASK_STATUS_FAILED') {
        console.log(`Task failed with reason: ${response.data.task.reason}`);
        return { error: response.data.task.reason, status: 'failed' };
    } else {
        return null;
    }

    } catch (error) {
    console.error("Error fetching Novita result:", error.message);
    return { error: error.message, status: 'failed' };
    }
}
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
    // Update the front end 
    console.log('Updating title on the front end');
  }
}

async function saveImageToDB({taskId, userId, chatId, userChatId, prompt, title, imageUrl, aspectRatio, blurredImageUrl = null, nsfw = false, fastify}) {
    const db = fastify.mongo.db;
    try {

      if (!userChatId || !ObjectId.isValid(userChatId)) {
        return { imageUrl };
      }
      
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
              imageUrl, 
              blurredImageUrl, 
              aspectRatio, 
              isBlurred: !!blurredImageUrl,
              nsfw,
              createdAt: new Date()
            } 
          },
        },
        { upsert: true }
      );
  
      const chatsCollection = db.collection('chats');
      await chatsCollection.updateOne(
        { _id: new ObjectId(chatId) },
        { $inc: { imageCount: 1 } }
      );
  
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
      console.error(error);
      throw new Error('An error occurred while saving the image');
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

  module.exports = {
    generateImg,
    getPromptById,
    checkImageDescription,
    getTasks,
    deleteOldTasks,
    deleteAllTasks
  };