const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const { processPromptToTags, saveChatImageToDB } = require('../models/tool')
const { generateImg, getPromptById, getImageSeed, checkImageDescription,getTasks } = require('../models/imagen');
const { createPrompt, moderateText } = require('../models/openai');
async function routes(fastify, options) {

// Endpoint to initiate generate-img for selected image type
fastify.post('/novita/generate-img', async (request, reply) => {
  const { title, prompt, aspectRatio, userId, chatId, userChatId, placeholderId, promptId, customPrompt, image_base64, chatCreation, regenerate } = request.body;
  let imageType = request.body.imageType
  const db = fastify.mongo.db;
  const translations = request.translations
  try {
    const all_tasks =  await getTasks(db,null, userId)
    if(request.user.subscriptionStatus !== 'active' && all_tasks.length >= 5){
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
        if(request.user.subscriptionStatus !== 'active'){
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
      // Prompt must be shorter than 900 characters
      if (newPrompt.length > 900) {
        const shorterPrompt = await createPrompt(customPrompt, imageDescription, nsfw)
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
    const result = generateImg({title, prompt:newPrompt, aspectRatio, imageSeed, regenerate, userId, chatId, userChatId, imageType, image_num: chatCreation ? 4 : 1 , image_base64, chatCreation, placeholderId, translations:request.translations , fastify})
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
    const { imageUrl, prompt: imagePrompt, title, nsfw, likedBy = [] } = image;
    const { chatId } = imageDocument;

    let chatData = {};
    if (chatId) {
      chatData = await chatsCollection.findOne(
        { _id: chatId },
        { projection: { imageModel: 1, imageStyle: 1, imageVersion: 1 } }
      ) || {};
    }

    return reply.status(200).send({ imageUrl, imagePrompt, title, likedBy, nsfw, ...chatData });
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

async function savePromptIdtoChat(db, chatId, userChatId, promptId) {
  const collectionUserChats = db.collection('userChat');

  console.log('[savePromptIdtoChat] called with:', { chatId, userChatId, promptId });

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

    console.log('[savePromptIdtoChat] Update result for userChat collection:', userChatUpdateResult);
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

}

module.exports = routes;
