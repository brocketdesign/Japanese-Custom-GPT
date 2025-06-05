const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const { processPromptToTags, saveChatImageToDB } = require('../models/tool')
const { generateImg, getPromptById, getImageSeed, checkImageDescription, getTasks } = require('../models/imagen');
const { createPrompt, moderateText } = require('../models/openai');
const { upscaleImg } = require('../models/upscale-utils');

async function routes(fastify, options) {

  // Endpoint to initiate generate-img for selected image type
  fastify.post('/novita/generate-img', async (request, reply) => {
    const { title, prompt, aspectRatio, userId, chatId, userChatId, placeholderId, promptId, giftId, customPrompt, image_base64, chatCreation, regenerate } = request.body;
    let imageType = request.body.imageType
    const db = fastify.mongo.db;
    const translations = request.translations
    try {
      // Get fresh user data from database to check subscription
      const freshUserData = await db.collection('users').findOne(
        { _id: new fastify.mongo.ObjectId(userId) },
        { projection: { subscriptionStatus: 1 } }
      );
      
      const subscriptionStatus = freshUserData?.subscriptionStatus;
      const all_tasks = await getTasks(db, null, userId)
      
      if(subscriptionStatus !== 'active' && all_tasks.length >= 5){
        fastify.sendNotificationToUser(userId, 'loadPlanPage')
        return reply.status(500).send({ error: 'You reached the limit of the free usage' });
      }

      const pending_taks =  await getTasks(db, 'pending', userId)
      if(pending_taks.length > 10){
        fastify.sendNotificationToUser(userId, 'showNotification', { message:request.translations.too_many_pending_images , icon:'warning' })
        return reply.status(500).send({ error: 'You have too many pending images, please wait for them to finish' });
      }

      let newPrompt = prompt
      if(customPrompt && promptId){
        const promptData = await getPromptById(db,promptId);
        savePromptIdtoChat(db, chatId, userChatId, promptId)
        .then((response) => {
          if(subscriptionStatus !== 'active'){
            fastify.sendNotificationToUser(userId, 'updateCustomPrompt', { promptId: promptId })
          }
        })
        const customPrompt = promptData.prompt;
        const nsfw = promptData.nsfw == 'on' ? true : false;
        imageType = nsfw ? 'nsfw' : 'sfw'
        processPromptToTags(db,customPrompt);
        
        let imageDescriptionResponse = await checkImageDescription(db, chatId);
        const imageDescription = imageDescriptionResponse.imageDescription
        newPrompt = !!imageDescription ? imageDescription +','+ customPrompt : customPrompt;
        newPrompt = await createPrompt(customPrompt, imageDescription, nsfw);
        // Prompt must be shorter than 900 characters
        if (newPrompt.length > 900) {
          console.log('[generate-img] Prompt is too long, shortening it...');
          const shorterPrompt = await createPrompt(customPrompt, imageDescription, nsfw)
          if(shorterPrompt){
            newPrompt = shorterPrompt.substring(0, 900);
          }else{
            newPrompt = newPrompt.substring(0, 900);
          }
        }
      } else if(giftId) {
        // New gift handling logic
        const giftData = await getGiftById(db, giftId);
        if (!giftData) {
          return reply.status(404).send({ error: 'Gift not found' });
        }
        
        saveGiftIdToChat(db, chatId, userChatId, giftId)
        .then((response) => {
          if(subscriptionStatus !== 'active'){
            fastify.sendNotificationToUser(userId, 'updateCustomGift', { giftId: giftId })
          }
        })
        
        const giftPrompt = giftData.prompt || giftData.description;
        processPromptToTags(db, giftPrompt);
        
        let imageDescriptionResponse = await checkImageDescription(db, chatId);
        const imageDescription = imageDescriptionResponse.imageDescription
        newPrompt = !!imageDescription ? imageDescription + ',' + giftPrompt : giftPrompt;
        newPrompt = await createPrompt(giftPrompt, imageDescription, false); // Assuming gifts are SFW by default
        // Prompt must be shorter than 900 characters
        if (newPrompt.length > 900) {
          console.log('[generate-img] Gift prompt is too long, shortening it...');
          const shorterPrompt = await createPrompt(giftPrompt, imageDescription, false)
          if(shorterPrompt){
            newPrompt = shorterPrompt.substring(0, 900);
          }else{
            newPrompt = newPrompt.substring(0, 900);
          }
        }
      }
      let imageSeed = -1
      if(regenerate){
        imageSeed = await getImageSeed(db, placeholderId);
      }
      const result = generateImg({
          title, 
          prompt: newPrompt, 
          aspectRatio, 
          imageSeed, 
          regenerate, 
          userId, 
          chatId, 
          userChatId, 
          imageType, 
          image_num: chatCreation ? 4 : 1, 
          image_base64, 
          chatCreation, 
          placeholderId, 
          translations: request.translations, 
          fastify,
          customPromptId: promptId
      })      
      .then((response) => {
      })
      .catch((error) => {
        console.log('error:', error);
      });
      reply.send(result);
    } catch (err) {
      console.error(err);
      reply.status(500).send({ error: 'Error initiating image generation.' });
    }
  });

    fastify.post('/novita/upscale-img', async (request, reply) => {
        try {
            const { userId, chatId, userChatId, originalImageId, image_base64, originalImageUrl, placeholderId, scale_factor, model_name } = request.body;
            // console.log('Upscale request received on backend:', request.body);
            const data = await upscaleImg({
                userId,
                chatId,
                userChatId,
                originalImageId,
                image_base64,
                originalImageUrl,
                placeholderId,
                scale_factor,
                model_name,
                fastify
            });
            reply.send(data);
        } catch (error) {
            console.error('Error in /novita/upscale-img:', error);
            reply.status(500).send({ message: error.message || 'Internal Server Error' });
        }
    });
  fastify.get('/image/:imageId', async (request, reply) => {
    try {
      const { imageId } = request.params;
      const db = fastify.mongo.db;
      const galleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');

      const objectId = new fastify.mongo.ObjectId(imageId);
      const imageDocument = await galleryCollection.findOne(
        { "images._id": objectId },
        { projection: { "images.$": 1, chatId: 1 } }
      );

      if (!imageDocument || !imageDocument.images?.length) {
        return reply.status(404).send({ error: 'Image not found' });
      }

      const image = imageDocument.images[0];
      const { imageUrl, prompt: imagePrompt, isUpscaled, title, nsfw, likedBy = [], actions } = image;
      const { chatId } = imageDocument;

      let chatData = {};
      if (chatId) {
        chatData = await chatsCollection.findOne(
          { _id: chatId },
          { projection: { imageModel: 1, imageStyle: 1, imageVersion: 1 } }
        ) || {};
      }

      return reply.status(200).send({ imageUrl, imagePrompt, isUpscaled, title, likedBy, nsfw, actions, ...chatData });
    } catch (error) {
      console.error('Error fetching image details:', error);
      return reply.status(500).send({ error: 'An error occurred while fetching the image details' });
    }
  });

  fastify.post('/novita/save-image-model', async (request, reply) => {
    const { chatId, modelId, imageModel, imageStyle, imageVersion } = request.body;

    if (!chatId || !modelId || !imageModel || !imageStyle || !imageVersion) {
      return reply.status(400).send({ error: 'chatId, imageModel, imageStyle, and imageVersion are required' });
    }

    try {
      const db = fastify.mongo.db
      await saveImageModel(db, chatId, { modelId, imageModel, imageStyle, imageVersion });
      return reply.status(200).send({ message: 'Image model saved successfully' });
    } catch (error) {
      console.error('Error saving image model:', error);
      return reply.status(500).send({ error: 'Failed to save image model to database' });
    }
  });

  fastify.post('/novita/save-image', async (request, reply) => {
    const { imageUrl, chatId } = request.body;

    if (!imageUrl || !chatId) {
      return reply.status(400).send({ error: 'imageId, imageUrl, and chatId are required' });
    }

    try {
      const db = fastify.mongo.db
      await saveChatImageToDB(db, chatId, imageUrl);
      return reply.status(200).send({ message: 'Image saved successfully' });
    } catch (error) {
      console.error('Error saving image:', error);
      return reply.status(500).send({ error: 'Failed to save image to database' });
    }
  });

  fastify.post('/novita/moderate', async (request, reply) => {
    try {
    const { chatId, content } = request.body;

    if (!content) {
        return reply.status(400).send({ error: 'Text is required' });
    }

    const moderationResult = await moderateText(content);

    const db = fastify.mongo.db
    await saveModerationToDB(db, chatId, moderationResult, content);

    reply.send(moderationResult);
    } catch (error) {
    console.error("Error moderating text:", error);
    reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

// Add helper functions
async function getGiftById(db, id) {
  try {
    if (!fastify.mongo.ObjectId.isValid(id)) {
      throw new Error('Invalid ID format');
    }

    const gift = await db.collection('gifts').findOne({ _id: new fastify.mongo.ObjectId(id) });

    if (!gift) {
      return { success: false, message: 'Gift not found', data: null };
    }

    return gift;
  } catch (error) {
    console.error('Error fetching gift:', error);
    throw new Error('Error fetching gift');
  }
}

async function saveGiftIdToChat(db, chatId, userChatId, giftId) {
  const collectionUserChats = db.collection('userChat');

  let userChatObjectId;
  try {
      userChatObjectId = new ObjectId(userChatId);
  } catch (error) {
      console.error('[saveGiftIdToChat] Invalid userChatId:', userChatId, error);
      throw new Error(`Invalid ID format (userChatId: ${userChatId})`);
  }

  try {
    const userChatUpdateResult = await collectionUserChats.updateOne(
        { _id: userChatObjectId },
        { $addToSet: { giftId } }
    );

    if (userChatUpdateResult.matchedCount === 0) {
        const errorMessage = `User chat not found (userChatId: ${userChatId})`;
        console.error(`[saveGiftIdToChat] ${errorMessage}`);
        throw new Error(errorMessage);
    }
    
    return { userChatUpdateResult };

  } catch (err) {
    console.error('[saveGiftIdToChat] Error during database update:', err.message);
    throw err; 
  }
}
  async function savePromptIdtoChat(db, chatId, userChatId, promptId) {
    const collectionUserChats = db.collection('userChat');

    let userChatObjectId;
    try {
        userChatObjectId = new ObjectId(userChatId);
    } catch (error) {
        console.error('[savePromptIdtoChat] Invalid userChatId:', userChatId, error);
        throw new Error(`無効なID形式です (userChatId: ${userChatId})`);
    }

    try {
      const userChatUpdateResult = await collectionUserChats.updateOne(
          { _id: userChatObjectId },
          { $addToSet: { customPromptIds: promptId } }
      );

      if (userChatUpdateResult.matchedCount === 0) {
          const errorMessage = `指定されたユーザーチャットが見つかりませんでした (userChatId: ${userChatId})`;
          console.error(`[savePromptIdtoChat] ${errorMessage}`);
          throw new Error(errorMessage);
      }
      
      return { userChatUpdateResult };

    } catch (err) {
      console.error('[savePromptIdtoChat] Error during database update:', err.message);
      throw err; 
    }
  }

    async function saveModerationToDB(db, chatId, moderation, characterPrompt){
      const collectionChats = db.collection('chats'); // Replace 'chats' with your actual collection name

      // Convert chatId string to ObjectId
      let chatObjectId;
      try {
          chatObjectId = new ObjectId(chatId);
      } catch (error) {
          throw new Error('無効なchatIdです。');
      }

      // Update the 'chats' collection with chatImageUrl and thumbnail
      const updateResult = await collectionChats.updateOne(
          { _id: chatObjectId },
          { 
              $set: { moderation, characterPrompt } 
          }
      );

      if (updateResult.matchedCount === 0) {
          throw new Error('指定されたチャットが見つかりませんでした。');
      }

      return updateResult;
    }

    async function saveImageModel(db, chatId, option) {
      const collectionChats = db.collection('chats');
      const { modelId, imageModel, imageStyle, imageVersion } = option;
      // Convert chatId string to ObjectId
      let chatObjectId;
      try {
          chatObjectId = new ObjectId(chatId);
      } catch (error) {
          throw new Error('無効なchatIdです。');
      }
      const updateResult = await collectionChats.updateOne(
          { _id: chatObjectId },
          { 
              $set: { modelId, imageModel, imageStyle, imageVersion } 
          }
      );

      if (updateResult.matchedCount === 0) {
          throw new Error('指定されたチャットが見つかりませんでした。');
      }

      return updateResult;
    }
  // ...existing code...

  fastify.get('/api/background-tasks/:userChatId', async (request, reply) => {
      try {
          const { userChatId } = request.params;
          const db = fastify.mongo.db;
          
          if (!userChatId || !ObjectId.isValid(userChatId)) {
              return reply.status(400).send({ error: 'Invalid userChatId' });
          }
          
          const tasks = await db.collection('tasks').find({
              userChatId: new ObjectId(userChatId),
              status: { $in: ['pending', 'processing', 'background'] }
          }).toArray();
          
          // Just return the tasks with their existing customPromptId
          const tasksWithPrompts = tasks.map(task => {
              console.log(`[tasksWithPrompts] Custom prompt ID for task ${task.taskId}:`, task.customPromptId);
              return {
                  ...task,
                  customPromptId: task.customPromptId || null
              };
          });
            
          reply.send({ tasks: tasksWithPrompts });
      } catch (error) {
          console.error('Error fetching background tasks:', error);
          reply.status(500).send({ error: 'Internal Server Error' });
      }
  });

  fastify.get('/api/task-status/:taskId', async (request, reply) => {
      try {
          const { taskId } = request.params;
          const db = fastify.mongo.db;
          
          const task = await db.collection('tasks').findOne({ taskId });
          
          if (!task) {
              return reply.status(404).send({ error: 'Task not found' });
          }
          
          if (task.status === 'completed' && task.result && task.result.images) {
              return reply.send({
                  status: 'completed',
                  userChatId: task.userChatId,
                  images: task.result.images
              });
          }
          
          reply.send({ 
              status: task.status,
              taskId: task.taskId,
              userChatId: task.userChatId
          });
      } catch (error) {
          console.error('Error fetching task status:', error);
          reply.status(500).send({ error: 'Internal Server Error' });
      }
  });
}

module.exports = routes;
