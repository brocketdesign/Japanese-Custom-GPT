const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const { convertImageUrlToBase64 } = require('../models/tool')
const { generateTxt2img,getPromptById,checkImageDescription } = require('../models/imagen');
const { createPrompt } = require('../models/openai');
async function routes(fastify, options) {

// Endpoint to initiate txt2img for selected image type
fastify.post('/novita/txt2img', async (request, reply) => {
  const { title, prompt, aspectRatio, userId, chatId, userChatId, imageType, placeholderId, customPrompt } = request.body;
  const db = fastify.mongo.db;
  try {
    let newPrompt = prompt
    if(customPrompt){
      const promptId = placeholderId
      const promptData = await getPromptById(db,promptId)
      const customPrompt = promptData.prompt;
      
      let imageDescriptionResponse = await checkImageDescription(db, chatId)
      const imageDescription = imageDescriptionResponse.imageDescription

      newPrompt = await createPrompt(customPrompt, imageDescription)

    }
    const result = await generateTxt2img({ title, prompt:newPrompt, aspectRatio, userId, chatId, userChatId, imageType, fastify })
    .then((taskStatus) => {
      fastify.sendNotificationToUser(userId, 'handleLoader', { imageId:placeholderId, action:'remove' })
      fastify.sendNotificationToUser(userId, 'handleRegenSpin', { imageId:placeholderId, spin: false })
      const { images } = taskStatus;
      for (const image of images) {
          const { imageId, imageUrl, prompt, title, nsfw } = image;
          const { userId, userChatId } = taskStatus;
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


fastify.post('/novita/save-image', async (request, reply) => {
  const { imageUrl, chatId, characterPrompt, enhancedPrompt, modelId, imageStyle, imageModel, imageVersion } = request.body;

  if (!imageUrl || !chatId) {
    return reply.status(400).send({ error: 'imageId, imageUrl, and chatId are required' });
  }

  try {
    const db = fastify.mongo.db
    await saveChatImageToDB(db, chatId, imageUrl, characterPrompt, enhancedPrompt, modelId, imageStyle, imageModel, imageVersion);
    return reply.status(200).send({ message: 'Image saved successfully' });
  } catch (error) {
    console.error('Error saving image:', error);
    return reply.status(500).send({ error: 'Failed to save image to database' });
  }
});

fastify.post('/novita/save-moderation', async (request, reply) => {
  const { moderation, chatId } = request.body;

  if (!moderation || !chatId) {
    return reply.status(400).send({ error: 'moderation and chatId are required' });
  }

  try {
    const db = fastify.mongo.db
    await saveModerationToDB(db, chatId, moderation);
    return reply.status(200).send({ message: 'Moderation saved successfully' });
  } catch (error) {
    console.error('Error saving image:', error);
    return reply.status(500).send({ error: 'Failed to save moderation to database' });
  }
});

  async function saveModerationToDB(db, chatId, moderation){
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
            $set: { moderation } 
        }
    );

    if (updateResult.matchedCount === 0) {
        throw new Error('指定されたチャットが見つかりませんでした。');
    }

    return updateResult;
  }

  async function saveChatImageToDB(db, chatId, imageUrl, characterPrompt, enhancedPrompt, modelId, imageStyle, imageModel, imageVersion) {
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
                chatImageUrl: imageUrl,
                characterPrompt, 
                enhancedPrompt, 
                modelId,
                imageStyle, 
                imageModel, 
                imageVersion
            } 
        }
    );

    if (updateResult.matchedCount === 0) {
        throw new Error('指定されたチャットが見つかりませんでした。');
    }

    return updateResult;
  }


}

module.exports = routes;
