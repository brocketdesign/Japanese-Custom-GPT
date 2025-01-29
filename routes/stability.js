const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const { processPromptToTags, addNotification } = require('../models/tool')
const { generateTxt2img,getPromptById,checkImageDescription,getTasks } = require('../models/imagen');
const { createPrompt, moderateText } = require('../models/openai');
async function routes(fastify, options) {

// Endpoint to initiate txt2img for selected image type
fastify.post('/novita/txt2img', async (request, reply) => {
  const { title, prompt, aspectRatio, userId, chatId, userChatId, placeholderId, customPrompt, chatCreation } = request.body;
  let imageType = request.body.imageType
  const db = fastify.mongo.db;
  const translations = request.translations
  try {
    const all_tasks =  await getTasks(db,null, userId)
    console.log('All tasks: ',all_tasks.length)
    if(request.user.subscriptionStatus !== 'active' && all_tasks.length >= 5){
      fastify.sendNotificationToUser(userId, 'showNotification', { message:request.translations.free_usage_image_limit , icon:'warning' })
      return reply.status(500).send({ error: 'You reached the limit of the free usage' });
    }
    const pending_taks =  await getTasks(db, 'pending', userId)
    console.log('Pending tasks: ',pending_taks.length)
    if(pending_taks.length > 3){
      fastify.sendNotificationToUser(userId, 'showNotification', { message:request.translations.too_many_pending_images , icon:'warning' })
      return reply.status(500).send({ error: 'You have too many pending images, please wait for them to finish' });
    }

    let newPrompt = prompt
    if(customPrompt){
      const promptId = placeholderId
      const promptData = await getPromptById(db,promptId);
      const customPrompt = promptData.prompt;
      const nsfw = promptData.nsfw == 'on' ? true : false;
      imageType = nsfw ? 'nsfw' : 'sfw'
      processPromptToTags(db,customPrompt);
      
      let imageDescriptionResponse = await checkImageDescription(db, chatId);
      const imageDescription = imageDescriptionResponse.imageDescription
      console.log('Image description: ',imageDescription) 
      newPrompt = imageDescription +','+ customPrompt 
    }

    const result = generateTxt2img(title, newPrompt, aspectRatio, userId, chatId, userChatId, imageType, chatCreation ? 2 : 1 , fastify )
    .then((taskStatus) => {
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
    .catch((error) => {
      console.error('Error initiating image generation:', error);
      fastify.sendNotificationToUser(userId, 'handleLoader', { imageId:placeholderId, action:'remove' })
      fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId:placeholderId, spin: false })
    });
    reply.send(result);
  } catch (err) {
    console.error(err);
    reply.status(500).send({ error: 'Error initiating image generation.' });
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

  async function saveChatImageToDB(db, chatId, imageUrl) {
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
            $set: { 
                chatImageUrl: imageUrl
            } 
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
