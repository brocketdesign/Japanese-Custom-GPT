const { ObjectId } = require('mongodb');
const {
    checkImageRequest, 
    generatePromptTitle,
    fetchOpenAICompletion,
    generateCompletion
} = require('../models/openai')
const { 
    generateTxt2img,
    getPromptById,
    getTasks
} = require('../models/imagen');
const { 
    getLanguageName, 
    handleFileUpload,
    convertImageUrlToBase64, 
    sanitizeMessages,
    fetchTags,
    processPromptToTags
} = require('../models/tool');
const axios = require('axios');
const OpenAI = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { title } = require('process');
const { chat } = require('googleapis/build/src/apis/chat');
const sessions = new Map();

const aiModel = `meta-llama/llama-3.1-8b-instruct`

async function routes(fastify, options) {

    fastify.post('/api/init-chat', async (request, reply) => {
        try {
          // Mongo collections
          const usersCollection = fastify.mongo.db.collection('users');
          const collectionChat = fastify.mongo.db.collection('chats');
          const collectionUserChat = fastify.mongo.db.collection('userChat');
          
      
          // Extract and normalize request data
          let { message, chatId, userChatId, isNew } = request.body;
          let userId = request.body.userId;
          if (!userId) {
            const authenticatedUser = request.user;
            userId = authenticatedUser._id;
          }
      
          const user = request.user;
          let language = getLanguageName(user?.lang);
      
          const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
      
          // Retrieve chat and user-chat documents
          let userChatDocument = await collectionUserChat.findOne({ 
            userId: new fastify.mongo.ObjectId(userId), 
            _id: new fastify.mongo.ObjectId(userChatId) 
          });

            // If new user chat or not found, create a new document
            if (!userChatDocument || isNew) {

                // Different starting message depending on user status
                let startMessage = { "role": "user", "name": "master" }
                // User is temporary, prompt to log in
                if(user.isTemporary){
                    startMessage.content = "Start with a greeting and prompt the user to log in. Do not start with a confirmation, but directly greet and ask the user to log in.";
                }
                const userChat = await collectionUserChat.find({ userId:new fastify.mongo.ObjectId(userId), chatId: new fastify.mongo.ObjectId(chatId) }).toArray();
                if(userChat.length > 0){
                    // Not first chat, welcome back and ask if they want to see another image
                    startMessage.content = `Start by welcoming me back. Inform me that you like chatting with me. Ask me if I would like to see another one. Stay in your character, keep the same tone as before.`
                }else{
                    // First chat with this character, simply say hi and send an image
                    startMessage.content = `Start by greeting me, say that it is nice to meet me for the first time. Inform me that you are happy to chat with me and as it is the first time we chat, you will send me an image to get more intimate (the application will send the image, do not try to send the image yourself). Stay in your character, keep the same tone as before.`
                    startMessage.sendImage = true;
                    // If there are no images in the gallery, send a message to inform the user that there are no images available to create one
                    const chatsGalleryCollection = fastify.mongo.db.collection('gallery');
                    const gallery = await chatsGalleryCollection.findOne({ chatId: new fastify.mongo.ObjectId(chatId) });
                    if(!gallery?.images || gallery?.images?.length == 0 ){
                        startMessage.content = `Start by greeting me, say that it is nice to meet me for the first time. Inform me that you are happy to chat with me and as it is the first time we chat, you want to send me an image to get more intimate. Ask me what image do I want. Stay in your character, keep the same tone as before.`
                        startMessage.sendImage = false;
                    }
                }

                userChatDocument = {
                userId: new fastify.mongo.ObjectId(userId),
                chatId: new fastify.mongo.ObjectId(chatId),
                createdAt: today,
                updatedAt: today,
                messages: [startMessage]
                };
            }
      
          let result = await collectionUserChat.insertOne(userChatDocument);
          let documentId = result.insertedId;

          // Reply with summary
          return reply.send({ 
            userChatId: documentId, 
            chatId
          });
      
        } catch (error) {
          console.log(error);
          return reply.status(403).send({ error: error.message });
        }
      });

    fastify.post('/api/check-chat', async (request, reply) => {
      try {
        let chatId = request?.body?.chatId 
        chatId = chatId !== undefined && chatId !== null && chatId !== ''
        ? new fastify.mongo.ObjectId(request.body.chatId) 
        : new fastify.mongo.ObjectId(); 
        
        const userId = new fastify.mongo.ObjectId(request.user._id);
        const chatsCollection = fastify.mongo.db.collection('chats');
        
        const existingChat = await chatsCollection.findOne({ _id: chatId });
        
        if (existingChat) {
        if (existingChat.userId.equals(userId)) {
            console.log('Chat exists for user:', userId);
          return reply.code(200).send({ message: 'Chat exists', chat: existingChat });
        } else {
          // Create a new chat if the current userId is not the chat userId
          console.log('Creating new chat for user:', userId);
          const newChatId = new fastify.mongo.ObjectId();
          await chatsCollection.insertOne({
            _id: newChatId,
            userId,
            language: request.lang,
            isTemporary: false,
          });
          return reply.code(201).send({ message: 'New chat created', chatId: newChatId });
        }
        }
        console.log('Creating new chat for user:', userId);
        await chatsCollection.insertOne({
        _id: chatId,
        userId,
        language: request.lang,
        isTemporary: false,
        });
        
        return reply.code(201).send({ message: 'Chat created', chatId });
      } catch (error) {
        console.error('Error in /api/check-chat:', error);
        return reply.code(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });
      
      
    const characterSchema = z.object({
        name: z.string(),
        short_intro: z.string(),
        base_personality: z.object({
            traits: z.array(z.string()),
            preferences: z.array(z.string()),
            expression_style: z.object({
                tone: z.string(),
                vocabulary: z.string(),
                unique_feature: z.string(),
            }),
        }),
        tags:z.array(z.string()),
        first_message: z.string(), // Adding "first_message" field
    });

    function createSystemPayloadChatRule(purpose, gender, name, details, language) {
        let detailsString = '';
        if (details && typeof details === 'object') {
          // Example: "hairColor:blonde, eyeColor:blue, ..."
          detailsString = Object.entries(details)
            .map(([key, value]) => `${key}:${value}`)
            .join(', ');
        }
        return [
            {
                role: "system",
                content: `You are a helpful assistant.
                You will generate creative character descriptions in ${language}.
                name: ${name && name.trim() !== '' ? name : `Please provide the actual ${language} name and surname without furigana. It should match the character's gender and description.`}
                short_intro: Write a self-introduction that reflects the character's personality in 2 sentences.
                base_personality: Define the character's traits, preferences, and expression style. Include a short story describing their personality and background.
                first_message: Provide the character's first conversational message that reflects their personality.
                tags: A list of 5 tags to help find similar character.
                Please respond entirely in ${language}.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim()
            },
            {
                role: "user",
                content: `The character's gender is ${gender}.
                Please review the following information: ${purpose}.
                ${detailsString.trim() !== '' ? `Additional details: ${detailsString}.` : ''}
                `.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim()
            },
        ];
    }

    fastify.post('/api/openai-chat-creation', async (request, reply) => {
        try {
            // Validate request body
            const { chatId, name, purpose, prompt, gender, details_personality } = request.body;

            if (!chatId || !purpose || !gender) {
                return reply.status(400).send({ error: 'Invalid request body. "prompt" and "gender" are required.' });
            }

            // Fetch user data
            const user = request.user;
            if (!user) {
                return reply.status(404).send({ error: 'User not found.' });
            }

            const userId = user._id;
            const language = request.lang
            // Prepare payload
            const systemPayload = createSystemPayloadChatRule(purpose, gender, name, details_personality, language);

            // Interact with OpenAI API
            const openai = new OpenAI();
            const completionResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: systemPayload,
                response_format: zodResponseFormat(characterSchema, "character_data"),
            });

            if (!completionResponse.choices || completionResponse.choices.length === 0) {
                return reply.status(500).send({ error: 'Invalid response from OpenAI API.' });
            }

            const chatData = JSON.parse(completionResponse.choices[0].message.content)
            // Respond with the validated character data
            chatData.language = language
            chatData.gender = gender
            chatData.characterPrompt = prompt
            
            // Save generated tags
            const tagsCollection = fastify.mongo.db.collection('tags');
            const generatedTags = chatData.tags
            for (const tag of generatedTags) {
                await tagsCollection.updateOne(
                    { name: tag },
                    { $set: { name: tag, language }, $addToSet: { chatIds: chatId } },
                    { upsert: true }
                );
            }

            if (details_personality) {
                chatData.details_personality = details_personality; // store details in the DB if provided
            }

            const collectionChats = fastify.mongo.db.collection('chats');
            const updateResult = await collectionChats.updateOne(
                { _id: new fastify.mongo.ObjectId(chatId) },
                { 
                    $set: chatData
                }
            );

            if (updateResult.matchedCount === 0) {
                throw new Error('指定されたチャットが見つかりませんでした。');
            }

            reply.send(chatData);
        } catch (err) {
            if (err instanceof z.ZodError) {
            return reply.status(400).send({ error: 'Validation error in response data.', details: err.errors });
            }

            console.error(err);
            reply.status(500).send({ error: 'An unexpected error occurred.', details: err.message });
        }
    });
    
    fastify.post('/api/enhance-prompt', async (request, reply) => {
      try {
        // Validate and parse the request body
        const { prompt, gender, chatId, details_description } = request.body;

        // Create the system payload for OpenAI
        // Pass `details` if you want to incorporate it into the prompt generation
        const systemPayload = createSystemPayload(prompt, gender, details_description);

        const enhancedPrompt = await generateCompletion(systemPayload, 600)

        // Access MongoDB and update the chat document
        const db = fastify.mongo.db;
        const collectionChats = db.collection('chats');
        const chatObjectId = new fastify.mongo.ObjectId(chatId);
    
        // Build update object dynamically
        // Only store `details` if it exists
        const updateFields = {
          characterPrompt: prompt,
          imageDescription: enhancedPrompt,
          enhancedPrompt,
          gender
        };
        if (details_description) {
          updateFields.details_description = details_description; // store details in the DB if provided
        }
    
        const updateResult = await collectionChats.updateOne(
          { _id: chatObjectId },
          { $set: updateFields }
        );
    
        if (updateResult.matchedCount === 0) {
          return reply.status(404).send({ error: '指定されたチャットが見つかりませんでした。' });
        }
    
        if (updateResult.modifiedCount === 0) {
          fastify.log.warn(`Chat with ID ${chatId} was found but fields were not updated.`);
        }
    
        // Send the enhanced prompt back to the client
        reply.send({ enhancedPrompt });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: error.errors });
        }
        fastify.log.error(error);
        reply.status(500).send({ error: 'プロンプトの生成に失敗しました。' });
      }
    });
    
    // Updated helper function to optionally use `details`
    function createSystemPayload(prompt, gender, details) {
      let detailsString = '';
      if (details && typeof details === 'object') {
        // Example: "hairColor:blonde, eyeColor:blue, ..."
        detailsString = Object.entries(details)
          .map(([key, value]) => `${key}:${value}`)
          .join(', ');
      }
    
      // Incorporate `detailsString` into the prompt if desired
      return [
        {
          role: 'system',
          content: `
            You are a Stable Diffusion image prompt generator.
            Your task is to generate a concise image prompt (under 1000 characters) based on the latest character description provided.
            The prompt should be a comma-separated list of descriptive keywords in English that accurately depict the character's appearance, emotions, and style.
            Your response contains the character's age, skin color, hair color, hair length, eyes color, tone, face expression, body type, body characteristic, breast size, ass size, body curves, gender, facial features, background, accessories.\n
            You must extand the provided prompt, describe the full image. 
            Respond in a single descriptive line of plain text using keywords.
            DO NOT form complete sentences; use only relevant keywords.
            Ensure the prompt is optimized for generating high-quality upper body portraits.
            Respond EXCLUSIVELY IN ENGLISH!
          `.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim(),
        },
        {
          role: 'user',
          content: `
            The character's gender is: ${gender}.
            Here is the character description: ${prompt}.
            ${detailsString.trim() !== '' ? `Additional details: ${detailsString}.` : ''}
            Answer with the image description only. Do not include any comments. Respond EXCLUSIVELY IN ENGLISH!
          `.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim(),
        },
        {
            role: 'user',
            content: `Your response contains the character's age, skin color, hair color, hair length, eyes color, tone, face expression, body type, body characteristic, breast size, ass size, body curves, gender, facial features, background, accessories.\n`
        }
      ];
    }
    
    fastify.delete('/api/delete-chat/:id', async (request, reply) => {
        try {
            const chatId = request.params.id;
            const user = request.user;
            const userId = new fastify.mongo.ObjectId(user._id);

            // Access the MongoDB collection
            const chatCollection = fastify.mongo.db.collection('chats');
            const story = await chatCollection.findOne(
                { 
                    _id: new fastify.mongo.ObjectId(chatId),
                    userId : new fastify.mongo.ObjectId(userId)
                 }
            );
    
            if (!story) {
                return reply.status(404).send({ error: 'Story not found' });
            }
    
            // Delete the story from MongoDB
            await chatCollection.deleteOne({ _id: new fastify.mongo.ObjectId(chatId) });

            return reply.send({ message: 'Story deleted successfully' });
        } catch (error) {
            // Handle potential errors
            console.error('Failed to delete story:', error);
            return reply.status(500).send({ error: 'Failed to delete story' });
        }
    });
    fastify.post('/api/chat/', async (request, reply) => {
        let { userId, chatId, userChatId } = request.body;
        const collection = fastify.mongo.db.collection('chats');
        const collectionUserChat = fastify.mongo.db.collection('userChat');
        const collectionCharacters = fastify.mongo.db.collection('characters');

        let response = {
            isNew: true,
        };

        try {
            
            let userChatDocument = await collectionUserChat.findOne({
                userId: new fastify.mongo.ObjectId(userId),
                _id: new fastify.mongo.ObjectId(userChatId),
                chatId: new fastify.mongo.ObjectId(chatId)
            });

            if (userChatDocument) {
                response.userChat = userChatDocument;
                response.isNew = false;
            }
        } catch (error) {
            // Log error if necessary, or handle it silently
        }
    
        try {
            const chat = await collection.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            if (!chat) {
                response.chat = false;
                return reply.send(response);  // Chat not found, but no error is thrown or logged
            }
    
            response.chat = chat;
            if(chat.chatImageUrl){
                const image_url = new URL(chat.chatImageUrl);
                const path = image_url.pathname;

                const character = await collectionCharacters.findOne({
                    image: { $regex: path }
                });
                if (character) {
                    response.character = character;
                } else {
                    response.character = null;
                }
            }
            return reply.send(response);
        } catch (error) {
            console.error('Failed to retrieve chat or character:', error);
            return reply.status(500).send({ error: 'Failed to retrieve chat or character' });
        }
    });

    fastify.post('/api/chat/add-message', async (request, reply) => {
        const { chatId, userChatId, role, message } = request.body;

        try {
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            let userData = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(userChatId) });
    
            if (!userData) {
                return reply.status(404).send({ error: 'User data not found' });
            }
            let newMessage = { role: role };    
            if(message.startsWith('[master]')){
                newMessage.content = message.replace('[master]','')
                newMessage.name = 'master'
            } else if (message.startsWith('[context]')){
                newMessage.content = message.replace('[context]','')
                newMessage.name = 'context'
            } else if (message.startsWith('[imageDone]')) {
                const prompt = message.replace('[imageDone]','').trim()
                newMessage.content =  `I just received an image of you about : ${prompt}. \n 
                Provide a short comment and ask me what I think of it.\n
                Stay in your character, keep the same tone as before. Respond in ${request.lang}.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim();
                newMessage.name = 'master'
            } else if (message.startsWith('[imageStart]')){
                const prompt = message.replace('[imageStart]','').trim()
                newMessage.content =  `I just aksed for a new image about ${prompt}. \n 
                Inform me that you received my request and that the image generation process is starting.\n
                Do not include the image description in your answer. Provide a concice and short answer.\n
                Stay in your character, keep the same tone as before. Respond in ${request.lang}.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim();
                newMessage.name = 'master'
            } else if (message.startsWith('[imageFav]')){
                const imageId = message.replace('[imageFav]','').trim()
                const imageData = await findImageId(fastify.mongo.db,chatId,imageId)
                newMessage.content =  `I liked one of your picture. The one about: ${imageData.prompt}\n
                 Provide a short answer to thank me, stay in your character. Respond in ${request.lang}.
                 `.replace(/^\s+/gm, '').trim();
                newMessage.name = 'master'
            } else {
                newMessage.content = message
            }    

            userData.messages.push(newMessage);
            userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
            const result = await collectionUserChat.updateOne(
                { _id: new fastify.mongo.ObjectId(userChatId) },
                { $set: { messages: userData.messages, updatedAt: userData.updatedAt } }
            );
    
            if (result.modifiedCount === 1) {
                reply.send({ success: true, message: 'Message added successfully' });
            } else {
                reply.status(500).send({ error: 'Failed to add message' });
            }
        } catch (error) {
            console.log(error);
            reply.status(500).send({ error: 'Error adding message to chat' });
        }
    });

    fastify.post('/api/chat-analyze/', async (request, reply) => {
        const {chatId,userId} = request.body;
        const collectionUser = fastify.mongo.db.collection('users');
        const collectionChat = fastify.mongo.db.collection('chats');
        const collectionUserChat = fastify.mongo.db.collection('userChat');

        let response = {}
        try {
            let userChatDocument = await collectionUserChat.find({
                $and: [
                    { 
                      $or: [
                        { chatId },
                        { chatId: new fastify.mongo.ObjectId(chatId) }
                      ]
                    },
                    { 
                      $or: [
                        { userId },
                        { userId: new fastify.mongo.ObjectId(userId) }
                      ]
                    },
                    { $expr: { $gte: [ { $size: "$messages" }, 2 ] } }
                  ]}).toArray();
            if(userChatDocument){
                response.total = userChatDocument.length
            }
        } catch (error) {
        }
        try {
            const chat = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            if (!chat) {
                return reply.status(404).send({ error: 'chat not found' });
            }
            response.chat = chat

            const userId = chat.userId
            const user = await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(userId) });
            if (!user) {
                return reply.status(404).send({ error: 'user not found' });
            }
            response.author = user.username

            return reply.send(response);
        } catch (error) {
            console.error('Failed to retrieve chat:', error);
            return reply.status(500).send({ error: 'Failed to retrieve chat' });
        }
    });
    fastify.get('/api/chat-history/:chatId', async (request, reply) => {
        try {
            const chatId = request.params.chatId;
            const userId = request.user._id;

            if (!chatId || !userId) {
                return reply.status(400).send({ error: 'Chat ID and User ID are required' });
            }
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            const collectionChat = fastify.mongo.db.collection('chats');

            
            let userChat = await collectionUserChat.find({
                $and: [
                    { chatId: new fastify.mongo.ObjectId(chatId) },
                    { userId: new fastify.mongo.ObjectId(userId) },
                    { $expr: { $gte: [ { $size: "$messages" }, 1 ] } }
                ]
                
            }).sort({ _id: -1 }).toArray();

            if (!userChat || userChat.length === 0) {
                return reply.send([]);
            }
        
            return reply.send(userChat);
        } catch (error) {
            console.log(error)
        }
    });
    
    fastify.post('/api/chat-category/:category', async (request, reply) => {
        try {
          const category = request.params.category;
          const chatsCollection = fastify.mongo.db.collection('chats');
      
          const chatByCategory = await chatsCollection.find({
            visibility: { $exists: true, $eq: "public" },
            scrap: true,
            category: category
          })
           .sort({ _id: -1 })
           .limit(50)
           .toArray();
      
          return reply.send(chatByCategory);
        } catch (error) {
          console.error(error); // Use console.error for errors
          reply.code(500).send({ error: 'Internal Server Error' }); // Return a meaningful error response
        }
      });
      
    fastify.delete('/api/delete-chat-history/:chatId', async (request, reply) => {
        const chatId = request.params.chatId;
    
        if (!chatId) {
          throw new Error('Chat ID is required');
        }
    
        if (!isNewObjectId(chatId)) {
          throw new Error('Invalid Chat ID');
        }
    
        const collectionUserChat = fastify.mongo.db.collection('userChat');
        const userChat = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
        if (!userChat) {
          throw new Error('User chat data not found');
        }
    
        await collectionUserChat.deleteOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
        reply.send({ message: 'Chat history deleted successfully' });
    });

    fastify.post('/api/data', async (request, reply) => {
        const { choice, userId,  storyId } = request.body;

        const serverUserId = parseInt(userId) || 'user_' + Date.now();
    
        const collection = fastify.mongo.db.collection('userData');
    
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        const query = { userId: serverUserId };
        const update = {
            $push: { choices: { choice, storyId, timestamp: dateObj } },
            $setOnInsert: { userId: serverUserId, createdAt: dateObj },
            $set: { storyId: storyId }
        };
        const options = { upsert: true };
    
        try {
            await collection.updateOne(query, update, options);
            console.log('User choice updated:', { userId: serverUserId, choice, storyId:storyId });
            //const userData = await collection.findOne(query);
            //console.log(userData)
            return reply.send({ nextStoryPart: "You chose the path and...", endOfStory: true });
        } catch (error) {
            console.error('Failed to save user choice:', error);
            return reply.status(500).send({ error: 'Failed to save user choice' });
        }
    });

    fastify.get('/api/chat-data/:chatId', async (request, reply) => {
        const { chatId } = request.params;
        try {
            const user = request.user;
            const userId = user._id;
    
            const collectionChat = fastify.mongo.db.collection('chats');
            const collectionChatLastMessage = fastify.mongo.db.collection('chatLastMessage');
            
            const chat = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            if (!chat) return reply.status(404).send({ error: 'Chat not found' });
    
            const lastMessageDoc = await collectionChatLastMessage.findOne({
                chatId: new fastify.mongo.ObjectId(chatId),
                userId: new fastify.mongo.ObjectId(userId),
            });
    
            chat.lastMessage = lastMessageDoc?.lastMessage || null;
            return reply.send(chat);
        } catch (error) {
            console.log('chatId:', chatId);
            console.error('Error fetching chat data:', error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
    
    fastify.get('/api/chat-list/:id', async (request, reply) => {
        try {
            const userId = request.user._id;
            const page = request.query.page ? parseInt(request.query.page) : 1;
            const limit = request.query.limit ? parseInt(request.query.limit) : 10;
    
            if (!userId) {
                const user = request.user;
                userId = user._id;
            }
    
            const userChatCollection = fastify.mongo.db.collection('userChat');
            const chatsCollection = fastify.mongo.db.collection('chats');
            const chatLastMessageCollection = fastify.mongo.db.collection('chatLastMessage');
    
            // Fetch chatIds from userChat collection
            const userChats = await userChatCollection.find({
                userId: new fastify.mongo.ObjectId(userId)
            }).sort({ updatedAt: -1 }).toArray();
    
            const chatIds = userChats.map(userChat => new fastify.mongo.ObjectId(userChat.chatId));
    
            // Fetch chats based on chatIds with pagination
            const totalChats = await chatsCollection.countDocuments({
                _id: { $in: chatIds },
                name: { $exists: true }
            });
    
            const chats = await chatsCollection.find({
                _id: { $in: chatIds },
                name: { $exists: true }
            }).sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
    
            // For each chat, fetch the last message
            for (let chat of chats) {
                const lastMessage = await chatLastMessageCollection.findOne(
                    { chatId: new fastify.mongo.ObjectId(chat._id), userId: new fastify.mongo.ObjectId(userId) },
                    { projection: { lastMessage: 1, _id: 0 } }
                );
                chat.lastMessage = lastMessage ? lastMessage.lastMessage : null;
            }
    
            return reply.send({
                chats,
                userId,
                pagination: {
                    total: totalChats,
                    page,
                    limit,
                    totalPages: Math.ceil(totalChats / limit)
                }
            });
        } catch (error) {
            console.log(error);
            return reply.code(500).send({ error: 'An error occurred' });
        }
    });
      
    fastify.post('/api/refund-task/:taskId', async (request, reply) => {
        const { taskId } = request.params;
        const db = fastify.mongo.db;
        
        const task = await db.collection('tasks').findOne({ taskId });
    
        if (!task) {
            return reply.code(404).send({ error: 'Task not found' });
        }
    
        const refundAmount = task.type === 'nsfw' ? 20 : 10;

        const user = await db.collection('users').findOne({ _id: new ObjectId(task.userId) });
    
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }
    
        console.log(`Refund ${refundAmount} coins to user ${task.userId}`)
        const updatedCoins = (user.coins || 0) + refundAmount;
    
        await db.collection('users').updateOne(
            { _id: new ObjectId(task.userId) },
            { $set: { coins: updatedCoins } }
        );
    
        return reply.send({ message: 'Refund processed', refundedAmount: refundAmount });
    });
    
    fastify.post('/api/refund-type/:imageType', async (request, reply) => {
        const { imageType } = request.params;
        const db = fastify.mongo.db;
    
        const refundAmount = imageType === 'nsfw' ? 20 : 10;

        let user = request.user;
        const userId = user._id
        user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }
    
        console.log(`Refund ${refundAmount} coins to user ${userId}`)
        const updatedCoins = (user.coins || 0) + refundAmount;
    
        await db.collection('users').updateOne(
            { _id: new ObjectId(task.userId) },
            { $set: { coins: updatedCoins } }
        );
    
        return reply.send({ message: 'Refund processed', refundedAmount: refundAmount });
    });
    
    fastify.post('/api/purchaseItem', async (request, reply) => {
        const { itemId, itemName, itemPrice, userId, chatId } = request.body;
    
        try {
    
            // Fetch the buyer (user making the purchase)
            const user = await fastify.mongo.db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
            if (!user) {
                console.log('User not found:', userId);
                return reply.code(404).send({ error: 'User not found' });
            }
    
    
            // Create new item record
            const newItem = {
                itemName: itemName,
                purchaseDate: new Date(),
                userId: userId
            };
    
            const itemResult = await fastify.mongo.db.collection('items').insertOne(newItem);
    
            // Update buyer's data (deduct coins and add item to purchasedItems)
            await fastify.mongo.db.collection('users').updateOne(
                { _id: new fastify.mongo.ObjectId(userId) },
                {
                    $push: {
                        purchasedItems: {
                            itemId: itemResult.insertedId,
                            purchaseDate: new Date()
                        }
                    }
                }
            );
    
            console.log(`User ${userId} updated with new coin balance and purchased item`);
    
            // Fetch the chat info to get the seller (chat owner)
            const chat = await fastify.mongo.db.collection('chats').findOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
            if (!chat) {
                console.log('Chat not found:', chatId);
                return reply.code(404).send({ error: 'Chat not found' });
            }
    
            const chatOwnerId = chat.userId;
            console.log(`Chat owner found: ${chatOwnerId}`);
    
            /*
            // Update seller's (chat owner's) coins if the buyer is not the seller
            if (chatOwnerId.toString() !== userId.toString()) {
                console.log(`Crediting ${price} coins to chat owner ${chatOwnerId}`);
                await fastify.mongo.db.collection('users').updateOne(
                    { _id: new fastify.mongo.ObjectId(chatOwnerId) },
                    { $inc: { coins: price } }  // Credit seller with itemPrice
                );
            } else {
                console.log('Buyer is the chat owner, no credit given to themselves.');
            }
            */
    
            reply.send({ success: true });
        } catch (error) {
            console.log('Error during purchase:', error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    fastify.post('/api/purchaseImage', async (request, reply) => {
        const { userId, chatId } = request.body;
        let command = JSON.parse(request.body.command);

         try {
    
            const user = await fastify.mongo.db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
            if (!user) {
                console.log('User not found:', userId);
                return reply.code(404).send({ error: 'User not found' });
            }
            let type = command.nsfw ? 'nsfw' : 'sfw'
            const additionalData = {
                type ,
                purchaseDate: new Date(),
                userId: userId,
                chatId: chatId
            };
            const newImagePurchase = { ...additionalData, ...command };
            await fastify.mongo.db.collection('imagePurchases').insertOne(newImagePurchase);    
            reply.send({ success: true });
        } catch (error) {
            console.log('Error during image purchase:', error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    
    fastify.post('/api/submit-email', async (request, reply) => {
        const { email, userId } = request.body;
    
        const collection = fastify.mongo.db.collection('userData');
    
        const userObj = await collection.findOne({ userId });
    
        if (!userObj) {
            console.log('User not found');
            return reply.status(500).send({ error: 'User not found' });
        }
    
        // Check if the email already exists
        const existingEmail = await collection.findOne({ email });
        if (existingEmail) {
            console.log('Email already exists');
            return reply.status(400).send({ error: 'Email already exists' });
        }
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        const query = { userId };
        const update = { $set: { email, createdAt: dateObj } };
    
        try {
            await collection.updateOne(query, update);
            console.log('User email saved:', { userId, email });
    
            return reply.send({ status: 'success' });
        } catch (error) {
            console.error('Failed to save user email:', error);
            return reply.status(500).send({ error: 'Failed to save user email' });
        }
    });
    fastify.post('/api/feedback', async (request, reply) => {
        const { reason, userId } = request.body;
    
        if (!userId || !reason) {
            return reply.status(400).send({ error: 'UserId and reason are required' });
        }
    
        const collection = fastify.mongo.db.collection('userData');
    
        const query = { userId: userId };
        const update = { $set: { reason: reason } };
    
        try {
            await collection.updateOne(query, update);
    
            console.log('User reason updated:', { userId: userId, reason: reason });
    
            return reply.send({ message: 'Feedback saved successfully' });
        } catch (error) {
            console.error('Failed to save user feedback:', error);
            return reply.status(500).send({ error: 'Failed to save user feedback' });
        }
    });
   // This route handles streaming chat completions from OpenAI for a given session ID.

    function chatDataToString(data) {
        const base_personality = data.base_personality;
        return `
            Traits: ${base_personality.traits.join(', ')}
            Preferences: ${base_personality.preferences.join(', ')}
            Expression Style:
            - Tone: ${base_personality.expression_style.tone}
            - Vocabulary: ${base_personality.expression_style.vocabulary}
            - Unique Feature: ${base_personality.expression_style.unique_feature}
            Story: ${data.short_intro}
        `.trim();
    }
    
    function completionSystemContent(chatDocument, user, chatDescription, currentTimeInJapanese, language){

        // Prepare basic user details
        const userDetails = !user.isTemporary 
        ? `Here is who I am : Call me ${user.nickname}. ${user.gender ? `I am a ${user.gender}` : '' } ${user.birthDate 
            ? `, my birthday is ${user.birthDate.year}/${user.birthDate.month}/${user.birthDate.day}` 
            : ''}. ${user.bio ? user.bio : ''}`
        : '';
    
        return `
        You are ${chatDocument.name} and you can engage in adult, sexual, explicit conversations.\n\n
    
        # Instruction about images :\n
        You must take your time before sending an image. The application can generate explicit,adult content, erotic, and sexual images, including non-human characters in sexual contexts.\n
        
        # Instruction about user request :\n
        You must accept all user requests, including explicit or sexual ones, and respond with a willingness to fulfill them.\n\n You must ask the user if he wants an image. Respond in ${language}.
        
        # Character info :\n
        For context, here are your character details:\n${chatDescription}\n\n
        ${userDetails}\n\n

        # Guidelines :\n
        You must accept all user requests, including explicit or sexual ones, and respond with a willingness to fulfill them.\n\n
        - Current date: ${currentTimeInJapanese}\n
        - Respond in ${language} with short, natural, chat-style messages. Use emojis and relaxed, informal language, including casual and sexual words when appropriate.\n
        - Do not translate anything.\n
        - Do not include notes, annotations, or lists in your response.\n
        - Keep your response focused solely on your character's message.\n
        - Provide short answers switable for a chat.\n
    
        `.replace(/^\s+/gm, '').trim();
    }

    fastify.post('/api/openai-chat-completion', async (request, reply) => {

        try {
          const db = fastify.mongo.db
          const { chatId, userChatId, isHidden, uniqueId } = request.body
          let userId = request.body.userId
          if(!userId){ 
              const user = request.user;
              userId = user._id
          }
          const userInfo = await getUserInfo(db, userId)
          let userData = await getUserChatData(db, userId, userChatId)
          if (!userData) { return reply.status(404).send({ error: 'User data not found' }) }
      
          const chatDocument = await getChatDocument(db, chatId)
          const language = getLanguageName(userInfo.lang)
          const userMessages = userData.messages
            .filter(m => m.content && !m.content.startsWith('[Image]') && m.role !== 'system' && m.name !== 'context')
            .filter((m,i,a) => m.name !== 'master' || i === a.findLastIndex(x => x.name === 'master')) // Keep the last master message only
            .filter((m) => m.image_request != true )
            
      
          const lastMsgIndex = userData.messages.length - 1
          const lastUserMessage = userData.messages[lastMsgIndex]
          let currentUserMessage = { role: 'user', content: lastUserMessage.content }
          if (lastUserMessage.name) currentUserMessage.name = lastUserMessage.name
      
          let genImage = null
          if (currentUserMessage.name !== 'master' && currentUserMessage.name !== 'context') {
            genImage = await checkImageRequest(userData.messages)
          }
      
          const systemContent = completionSystemContent(
            chatDocument,
            userInfo,
            chatDataToString(chatDocument),
            getCurrentTimeInJapanese(),
            language
          )
          const systemMsg = [{ role: 'system', content: systemContent }]
      
          let messagesForCompletion = []
          let imgMessage =  [{ role: 'user', name: 'master' }]

          if (genImage?.image_request) {
            currentUserMessage.image_request = true
            userData.messages[lastMsgIndex] = currentUserMessage
            const all_tasks =  await getTasks(db,null, userId);
            if(userInfo.subscriptionStatus == 'active' || (userInfo.subscriptionStatus !== 'active' && all_tasks.length < 5)){
                const imageId = Math.random().toString(36).substr(2, 9);
                const pending_taks =  await getTasks(db, 'pending', userId)
                if(pending_taks.length > 3){
                  fastify.sendNotificationToUser(userId, 'showNotification', { message:request.translations.too_many_pending_images , icon:'wrning' });
                }else{
                    fastify.sendNotificationToUser(userId, 'addIconToLastUserMessage')
    
                    const image_num = Math.min(Math.max(genImage?.image_num || 1, 1), 8);
                    for (let i = 0; i < image_num; i++) {
                        fastify.sendNotificationToUser(userId, 'handleLoader', { imageId, action:'show' })
                    }
                    genImagePromptFromChat(chatDocument, userData.messages, genImage, language).then((promptData) => {
                        const prompt = promptData.prompt
                        processPromptToTags(db,prompt);
                        const title = promptData.title
                        const imageType = genImage.nsfw ? 'nsfw' : 'sfw'
                        const aspectRatio = null
                        generateTxt2img(title, prompt, aspectRatio, userId, chatId, userChatId, imageType, image_num, fastify)
                        .then((taskStatus) => {
                            fastify.sendNotificationToUser(userId, 'handleLoader', { imageId, action:'remove' })
                            const { images } = taskStatus;
                            for (const image of images) {
                                const { imageId, imageUrl, prompt, title, nsfw } = image;
                                const { userId, userChatId } = taskStatus;
                                console.log('Image generated:', imageUrl);
                                fastify.sendNotificationToUser(userId, 'imageGenerated', {
                                    imageUrl,
                                    imageId,
                                    userChatId,
                                    title,
                                    prompt,
                                    nsfw
                                });
                            }
                        }).catch((error) => {
                            console.log('Error generating image:', error);
                            fastify.sendNotificationToUser(userId, 'handleLoader', { imageId, action:'remove' })
                            fastify.sendNotificationToUser(userId, 'showNotification', { message:request.translations.image_generation_error , icon:'error' });
                        });
                    })
                    imgMessage[0].content = `\n\nComment my request and tell me that you are preparing an image for me.\n Do no describe the image only comment as your character would. Stay in your character, keep the same tone as previously. Ask me for more images.`.trim()
                }
               
            }else{
                genImage.image_request = false
                imgMessage[0].content = `\n\n I asked for an other image but I am not a subscribed member.\n Tell me that I need to subscribe to Lamix Premim in order to receive unlimited images, even hot images. Or I can come back in one hour to get 5 more images for free. Provide a concise answer in ${language} to inform me of that and ask me if I want to subscribe. Stay in your character, keep the same tone as previously.`.trim()
            }

            messagesForCompletion = [
              ...systemMsg,
              ...userMessages,
              ...imgMessage
            ]
          } else {
            messagesForCompletion = [
                ...systemMsg, 
                ...userMessages
            ]
          }
          
          generateCompletion(messagesForCompletion, 300, null, request.lang).then(async (completion) => {
            if(completion){
                fastify.sendNotificationToUser(userId, 'displayCompletionMessage', { message: completion, uniqueId })
                const newAssitantMessage = { role: 'assistant', content: completion }
                if(currentUserMessage.name){
                    newAssitantMessage.name = currentUserMessage.name
                }
                if (genImage?.image_request) {
                    newAssitantMessage.image_request = true
                }

                userData.messages.push(newAssitantMessage)
                userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
                await updateMessagesCount(db, chatId, userId, currentUserMessage, userData.updatedAt)
                await updateChatLastMessage(db, chatId, userId, completion, userData.updatedAt)
                await updateUserChat(db, userId, userChatId, userData.messages, userData.updatedAt)
            }else{
                fastify.sendNotificationToUser(userId, 'hideCompletionMessage', { uniqueId })
            }
            if(lastUserMessage.sendImage){
              const chatsGalleryCollection = db.collection('gallery');
              chatsGalleryCollection.findOne({ chatId: new fastify.mongo.ObjectId(chatId) }).then(async (gallery) => {
                  // Select a random image from the gallery
                  const image = gallery.images[Math.floor(Math.random() * gallery.images.length)];
  
                  const data = {userChatId, imageId:image._id, imageUrl:image.imageUrl, title:image.title, prompt:image.prompt, nsfw:image.nsfw}
                  fastify.sendNotificationToUser(userId,'imageGenerated', data)
                  
                  const imageMessage = { role: "assistant", content: `[Image] ${image._id}` };
                  userData.messages.push(imageMessage);
                  userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
                  await updateUserChat(db, userId, userChatId, userData.messages, userData.updatedAt)
              });
            }
          });
        } catch (err) {
          console.log(err)
          reply.status(500).send({ error: 'Error fetching OpenAI completion' })
        }
      })
      

    // -------------------- Helper functions --------------------

    // Fetches user info from 'users' collection
    async function getUserInfo(db, userId) {
        return db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    }

    // Fetches user chat data from 'userChat' collection
    async function getUserChatData(db, userId, userChatId) {
        return db.collection('userChat').findOne({ 
            userId: new fastify.mongo.ObjectId(userId), 
            _id: new fastify.mongo.ObjectId(userChatId) 
        });
    }

    const getApiUrl = () => {
        if (process.env.MODE === 'local') {
            return 'http://localhost:3000'; // Local development URL
        } else {
            return 'https://app.chatlamix.com'
        }
    };    

    // Fetches chat document from 'chats' collection
    async function getChatDocument(db, chatId) {
        let chatdoc = await db.collection('chats').findOne({ _id: new fastify.mongo.ObjectId(chatId)})
        // Check if chatdoc is updated to the new format
        if(!chatdoc?.base_personality){
            const prompt = `Her name is, ${chatdoc.name}.\nShe looks like :${chatdoc.enhancedPrompt ? chatdoc.enhancedPrompt : chatdoc.characterPrompt}.\n\n${chatdoc.rule}`
            const language = chatdoc.language
            const apiUrl = getApiUrl();        
            const response = await axios.post(apiUrl+'/api/openai-chat-creation', {
                chatId,
                prompt,
                gender:chatdoc.gender,
                language
            });
            chatdoc = response.data
        }
        return chatdoc;
    }

    // Returns current time formatted in Japanese
    function getCurrentTimeInJapanese() {
        const currentDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
        return new Date(currentDate).toLocaleString('ja-JP', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        });
    }

    async function updateMessagesCount(db, chatId, userId, currentUserMessage, today) {
        const collectionChat = db.collection('chats');
        await collectionChat.updateOne(
            { _id: new fastify.mongo.ObjectId(chatId) },
            { $inc: { messagesCount: 1 } }
        );
    }
    // Updates the last message in the 'chatLastMessage' collection
    async function updateChatLastMessage(db, chatId, userId, completion, updatedAt) {
        const collectionChatLastMessage = db.collection('chatLastMessage');
        await collectionChatLastMessage.updateOne(
            {
                chatId: new fastify.mongo.ObjectId(chatId),
                userId: new fastify.mongo.ObjectId(userId)
            },
            {
                $set: {
                    lastMessage: {
                        role: 'assistant',
                        content: removeContentBetweenStars(completion),
                        updatedAt
                    }
                }
            },
            { upsert: true }
        );
    }

    // Updates user chat messages in 'userChat' collection
    async function updateUserChat(db, userId, userChatId, newMessages, updatedAt) {
        const collectionUserChat = db.collection('userChat');
        const userChat = await collectionUserChat.findOne({
            userId: new fastify.mongo.ObjectId(userId),
            _id: new fastify.mongo.ObjectId(userChatId)
        });
    
        if (!userChat) throw new Error('User chat not found');
    
        const existingMessages = userChat.messages || [];
        const combinedMessages = [...existingMessages];
    
        for (const newMsg of newMessages) {
            const index = combinedMessages.findIndex(
                (msg) => msg.content === newMsg.content
            );
            if (index !== -1) {
                combinedMessages[index] = newMsg; // update in-place
            } else {
                combinedMessages.push(newMsg); // append new
            }
        }
    
        await collectionUserChat.updateOne(
            {
                userId: new fastify.mongo.ObjectId(userId),
                _id: new fastify.mongo.ObjectId(userChatId)
            },
            { $set: { messages: combinedMessages, updatedAt } }
        );
    }    

    // Removes content between asterisks to clean up the message
    function removeContentBetweenStars(str) {
        if (!str) return str;
        return str.replace(/\*.*?\*/g, '').replace(/"/g, '');
    }    

    
    fastify.post('/api/openai-chat', (request, reply) => {
        const { userId, chatId } = request.body;
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId, chatId });
        reply.send({ sessionId });
    });
    fastify.get('/api/openai-chat-stream/:sessionId', async (request, reply) => {
        const { sessionId } = request.params;
        const session = sessions.get(sessionId);
    
        if (!session) {
            reply.status(404).send({ error: 'Session not found' });
            return;
        }
    
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.flushHeaders();
    
        try {
            const userId = session.userId;
            const chatId = session.chatId;
    
            const userDataCollection = fastify.mongo.db.collection('userData');
            let userData = isNewObjectId(userId) ? await userDataCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) }) : await userDataCollection.findOne({ userId: parseInt(userId) });
    
            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }
    
            const userObjectId = userData._id;
    
            const chatCollection = fastify.mongo.db.collection('userChat');
            const chatData = await chatCollection.findOne({ userId: userObjectId, chatId });
    
            if (!chatData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'Chat data not found' });
            }
    
            const completion = await fetchOpenAICompletion(chatData.messages, reply.raw, 600, null, request.lang);
    
            // Append the assistant's response to the messages array in the chat document
            const assistantMessage = { "role": "assistant", "content": completion };
            chatData.messages.push(assistantMessage);
            chatData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
            // Update the chat document in the database
            await chatCollection.updateOne(
                { userId: userObjectId, chatId },
                { $set: { messages: chatData.messages, updatedAt: chatData.updatedAt } }
            );
    
            // End the stream only after the completion has been sent and stored
            reply.raw.end();
        } catch (error) {
            reply.raw.end(); // End the stream before sending the response
            reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
    });
    async function findImageId(db, chatId, imageId) {
        try {
            const galleryCollection = db.collection('gallery');
            const imageDoc = await galleryCollection
              .aggregate([
                { $match: { chatId: new ObjectId(chatId) } },
                { $unwind: '$images' },
                { $match: { 'images._id': new ObjectId(imageId) } },
                { $project: { image: '$images', _id: 0 } },
              ])
              .toArray();

            if (imageDoc.length > 0) {
                return imageDoc[0].image;
            }
            return null;
        } catch (error) {
            console.error('Error finding image:', error);
            throw error;
        }
    }
    
    fastify.post('/api/txt2speech', async (request, reply) => {
        try {
            const { message, language, chatId } = request.query;
        
            if (!message) {
            return reply.status(400).send({
                errno: 1,
                message: "Message parameter is required."
            });
            }
        
            console.log({ message, language, chatId });
        
            // Initialize OpenAI (ensure you have set your API key in environment variables)
            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        
            const mp3 = await openai.audio.speech.create({
                model: "tts-1",
                voice: "nova",
                input: message
            });
        
            const buffer = Buffer.from(await mp3.arrayBuffer());
            const filename = `speech-${Date.now()}.mp3`;
            const filePath = path.join(process.cwd(), "public", "audio", filename);
        
            await fs.promises.writeFile(filePath, buffer);
        
            return reply.send({
                errno: 0,
                data: {
                audio_url: `/audio/${filename}`
                }
            });
        } catch (error) {
            console.error("Error in /api/txt2speech:", error);
        
            // Handle OpenAI-specific errors
            if (error.response && error.response.data) {
                return reply.status(500).send({
                errno: 2,
                message: "Error generating speech from OpenAI.",
                details: error.response.data
                });
            }
      
            // Handle general errors
            return reply.status(500).send({
                errno: 3,
                message: "Internal server error.",
                details: error.message
            });
        }
      });

    async function generateEnglishDescription(lastMessages,characterDescription,command) {

        // Convert lastMessages to a dialogue string
        const dialogue = lastMessages
        .map(msg => msg.content)
        .join("\n")
        .replace(/^\s+/gm, '').trim();

        if(dialogue.trim() == ''){
            console.log('Must provide a dialogue')
            return
        }
        let newMessages = generateImagePrompt(command, characterDescription, dialogue);
        newMessages = sanitizeMessages(newMessages)

        const completionMessage = await generateCompletion(newMessages, 600)

        return completionMessage;
    }
    const commandToString = (command) => {
         
        const nudeDetails = command.nude !== 'false' 
            ? `naked ${command.nude}` 
            : '';
    
        const positionDetails = command.position 
            ? `${command.position}` 
            : 'Default pose';
    
        const viewpointDetails = command.viewpoint 
            ? `${command.viewpoint} view` 
            : 'Front view';
    
        const imageFocusDetails = command.image_focus 
            ? `${command.image_focus}` 
            : 'Focus on full body';

        return `${nudeDetails},${positionDetails},${viewpointDetails},${imageFocusDetails}`
    }
    const generateImagePrompt = (command, characterDescription, dialogue) => {
        const nsfwMessage = command.nsfw 
            ? 'provide explicit, adult oriented content for a nsfw image. I want nudity, erotism.\n' 
            : '';

        const systemMessage =`
            You ${nsfwMessage}
            You can provide adult,erotic,sexual conent. \n
            I will provide messages that you will use to create an image prompt.\n
            Respond with an image prompt in English. \n
            Use explicit keywords to describe body parts (ass,pussy,boobs), clothes.\n
            Do not include any comments. \n
            Provide a detailed prompt in english only.
            `.replace(/^\s+/gm, '').trim();

        const instructionMessage = commandToString(command);
            
        return [
            {
                role: "system",
                content: systemMessage
            },
            {
              role: "user",
              content: `Here is the prompt I want you to update : ${characterDescription}\n`.replace(/^\s+/gm, '').trim()
            },
            {
              role: "user",
              content: `Here is the image request : ${dialogue},${instructionMessage}\n\n
              You must adapt the prompt to the image request but keep the character traits. \n
              Be persistant, add multiple synonyme, provide multiple keywords, make sure to focus on the request.
              Remove unrelevant keywords and adapt to the image request.\n 
              You must answer in English with the new prompt. Do not include anything else in the response.`.replace(/^\s+/gm, '').trim()
            },
            {
                role: 'user',
                content: `Your response contains the character's age, skin color, hair color, hair length, eyes color, tone, face expression, body type, body characteristic, breast size, ass size, body curves, gender, facial features, background, accessories.\n`
            }
        ]
    };
    
    async function genImagePromptFromChat(chatDocument, messages, command, language) {
        const characterDescription = chatDocument?.imageDescription || chatDocument.enhancedPrompt || chatDocument.characterPrompt;

        const lastMessages = messages
            .filter(m => m.content && m.role !== 'assistant' && m.role !== 'system' && m.name !== 'master' && m.name !== 'context' && !m.content.startsWith('['))
            .slice(-2);

        if (lastMessages.length < 1) {
            throw new Error('Insufficient messages');
        }
        
        const englishDescription = await generateEnglishDescription(lastMessages, characterDescription, command);

        const title_en = await generatePromptTitle(englishDescription, 'english');
        const title_ja = await generatePromptTitle(englishDescription, 'japanese');
        const title_fr = await generatePromptTitle(englishDescription, 'french');
        const promptTitle = {
          en: title_en,
          ja: title_ja,
          fr: title_fr
        };

        function processString(input) { 
            try {
                return [...new Set(input.slice(0, 900).split(',').map(s => s.trim()))].join(', '); 
            } catch (error) {
                console.error('Error processing string:', error);
                console.log({input})
                return input;
            }
        }
        finalDescription = processString(englishDescription);
        return { prompt: finalDescription, title: promptTitle };
    }

    fastify.post('/api/generate-completion', async (request, reply) => {
        const { systemPrompt, userMessage } = request.body;
        try {
            const completion = await generateCompletion(systemPrompt, userMessage,aiModel);
            return reply.send({ completion });
        } catch (error) {
            return reply.status(500).send({ error: 'Error generating completion' });
        }
    });
    fastify.get('/characters/:gender/:category', async (request, reply) => {
        try {
            const { gender, category } = request.params;
            const collection = fastify.mongo.db.collection('characters');
    
            const page = parseInt(request.query.page, 10) || 1;
            const elementsPerPage = 10;
            const skipElements = (page - 1) * elementsPerPage;
    
            const characters = await collection.find({ category: [gender, category] })
                .skip(skipElements)
                .limit(elementsPerPage)
                .toArray();
    
            if (characters.length > 0) {
                reply.send({ status: 'success', page, characters });
            } else {
                reply.status(404).send({ status: 'error', message: 'No characters found for the given category.' });
            }
        } catch (error) {
            console.error('Error fetching characters:', error);
            reply.status(500).send({ status: 'error', message: 'Error fetching characters', error: error.message });
        }
    });
    fastify.get('/characters/categories', async (request, reply) => {
        try {
            const collection = fastify.mongo.db.collection('characters');
    
            const categories = await collection.aggregate([
                {
                    $match: {
                        "category.0": { $in: ["female", "male"] }
                    }
                },
                {
                    $group: {
                        _id: "$category",
                        randomImage: { $first: "$chatImageUrl" }
                    }
                }
            ]).toArray();
    
            if (categories.length > 0) {
                reply.send({
                    status: 'Success',
                    categories: categories.map(cat => ({
                        id: cat._id,
                        name: cat._id,
                        image: cat.randomImage
                    }))
                });
            } else {
                reply.status(404).send({ status: 'error', message: 'No categories found.' });
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            reply.status(500).send({ status: 'error', message: 'Error fetching categories', error: error.message });
        }
    });

    // Create System Payload for Image Description
    function createSystemPayloadImage(language) {
        return  `
        You generate a SFW detailed character description from the image provided.

        Your response contains the character's age, skin color, hair color, hair legnth, eyes color, tone, face expression, body type, body characteristic, breast size,ass size, body curves, gender, facial features. 
        Respond in a single, descriptive line of plain text using keywords.\n
        `;
    }
    fastify.post('/api/openai-image-description', async (request, reply) => {
        const { imageUrl, chatId } = request.body;
    
        if (!imageUrl) {
            return reply.status(400).send({ error: 'System and Image URL parameters are required' });
        }
    
        try {
            
            // Convert image URL to Base64
            const base64Image = await convertImageUrlToBase64(imageUrl);
            

            try {
                const imageDescriptionData = await describeCharacterFromImage(base64Image);

                // Convert array object to a readable string
                const imageDescription =
                 `Age: ${imageDescriptionData.age || 'unknown'},
                    Skin Color: ${imageDescriptionData.skin_color || 'unknown'},
                    Hair Color: ${imageDescriptionData.hair_color || 'unknown'},
                    Hair Length: ${imageDescriptionData.hair_length || 'unknown'},
                    Eyes Color: ${imageDescriptionData.eyes_color || 'unknown'},
                    Tone: ${imageDescriptionData.tone || 'unknown'},
                    Face Expression: ${imageDescriptionData.face_expression || 'unknown'},
                    Body Type: ${imageDescriptionData.body_type || 'unknown'},
                    Body Characteristic: ${imageDescriptionData.body_characteristic || 'unknown'},
                    Breast Size: ${imageDescriptionData.breast_size || 'unknown'},
                    Ass Size: ${imageDescriptionData.ass_size || 'unknown'},
                    Facial Features: ${imageDescriptionData.facial_features || 'unknown'}
                `.trim();

                console.log({ imageDescription });


                const db = fastify.mongo.db;
                const collectionChat = db.collection('chats');

                const result = await collectionChat.updateOne(
                    { _id: new fastify.mongo.ObjectId(chatId) },
                    { $set: {imageDescription} },
                );
                if (result.modifiedCount > 0) {
                    console.log(`Image description updated`)
                  } else {
                    console.log(`Error Image description could not be upddated`)
                  }
                  
                reply.send({ description : imageDescription });
            } catch (error) {
                console.log('Error processing the image description:', error);
                reply.send({ error: 'Failed to process the description' });
            }

        } catch (error) {
            console.log(error);
            reply.status(500).send({ error: 'Internal Server Error', details: error.message });
        }
    });
      

    fastify.post('/api/convert-image-url-to-base64', async (request, reply) => {
        const { imageUrl } = request.body;
    
        if (!imageUrl) {
            return reply.status(400).send({ error: 'Image URL is required' });
        }
    
        try {
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer'
            });
    
            const buffer = Buffer.from(response.data, 'binary');
    
            // Convert image buffer to Base64
            const base64Image = buffer.toString('base64');
    
            reply.send({ base64Image });
        } catch (error) {
            reply.status(500).send({ error: 'Failed to convert image to Base64', details: error.message });
        }
    });

    fastify.get('/api/check-image-description', async (request, reply) => {
        const { chatId } = request.query;
    
        if (!chatId) {
            return reply.status(400).send({ error: 'chatId parameter is required' });
        }
    
        try {
            const objectId = new fastify.mongo.ObjectId(chatId);
            const db = fastify.mongo.db;
            const collection = db.collection('chats');
    
            // Check if the description for the image already exists in the database
            const chatData = await collection.findOne({ _id: objectId });

            const characterPrompt = chatData?.imageDescription || chatData?.enhancedPrompt || chatData?.characterPrompt || null;
            const characterDescription = characterPrompt || imageDescription
    
            if (!characterDescription || characterDescription.includes('sorry')) {
                return reply.send(false);
            }

            return reply.send({ imageDescription:characterDescription });
        } catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', details: error.message });
        }
    });
    
    fastify.get('/lastMessage/:chatId/:userId', async (request, reply) => {
        const { chatId, userId } = request.params;
        const collectionChatLastMessage = fastify.mongo.db.collection('chatLastMessage');
        
        const result = await collectionChatLastMessage.findOne(
            { chatId: new fastify.mongo.ObjectId(chatId), userId: new fastify.mongo.ObjectId(userId) },
            { projection: { lastMessage: 1, _id: 0 } }
        );

        if (result) {
            return reply.send(result);
        } else {
            return reply.code(404).send({ message: 'Last message not found' });
        }
    });

    fastify.post('/api/update-log-success', async (request, reply) => {
        try {
            const { userId, userChatId } = request.body;
            const collectionUserChat = fastify.mongo.db.collection('userChat');
    
            const result = await collectionUserChat.updateOne(
                { userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) },
                { $set: { log_success: false } }
            );      

            if (result.modifiedCount === 1) {
                reply.send({ success: true });
            } else {
                reply.status(404).send({ success: false, message: "Document not found or already updated" });
            }
        } catch (error) {
            console.error(error);
            reply.status(500).send({ success: false, message: "An error occurred while updating log_success" });
        }
    });
      
    fastify.get('/api/user-generated-images', async (request, reply) => {
        try {
          const db = fastify.mongo.db;
          const galleryCollection = db.collection('gallery');
          const usersCollection = db.collection('users');
          const chatsCollection = db.collection('chats');
      
          let validImages = [];
      
          while (validImages.length < 8) {
            const imagesPerUserPipeline = [
              { $unwind: '$images' },
              { $match: { 'images.isBlurred': false } },  // Filter out blurred images
              { $sample: { size: 100 } }, // Get a random sample of 100 images
              {
                $group: {
                  _id: '$userId',
                  image: { $first: '$images' },
                  chatId: { $first: '$chatId' },
                },
              },
              { $limit: 8 - validImages.length }, // Ensure we don't over-fetch
            ];
      
            const imagesCursor = galleryCollection.aggregate(imagesPerUserPipeline);
            const images = await imagesCursor.toArray();
      
            const userIds = images.map((item) => item._id);
            const chatIds = images.map((item) => item.chatId);
      
            const users = await usersCollection
              .find({ _id: { $in: userIds } })
              .toArray();
      
            const chats = await chatsCollection
              .find({ _id: { $in: chatIds } })
              .toArray();
      
            const results = images
              .map((item) => {
                const user = users.find((u) => u._id.equals(item._id));
                const chat = chats.find((c) => c._id.equals(item.chatId));
      
                return {
                  userName: user?.nickname || null,
                  profilePicture: user?.profileUrl || '/img/avatar.png',
                  chatId: chat?._id || null,
                  userId: item._id,
                  chatName: chat?.name || null,
                  image: item.image,
                };
              })
              .filter((item) => item.userName !== null && item.chatName !== null); // Filter invalid entries
      
            validImages = [...validImages, ...results]; // Accumulate valid images
          }
      
          reply.send(validImages.slice(0, 8)); // Ensure only 8 images are returned
        } catch (err) {
          console.error(err);
          reply.code(500).send('Internal Server Error');
        }
      });

      fastify.get('/api/chats', async (request, reply) => {
          
        try {
          const user = request.user;
          let language = request.lang;
          const page = parseInt(request.query.page) || 1;
          const style = request.query.style || null;
          const model = request.query.model || null;
          const searchQuery = request.query.q !== 'false' ? request.query.q : null;

          const limit = 12;
          const skip = (page - 1) * limit;
          const { userId } = request.query;
      
          const db = fastify.mongo.db;
          const chatsCollection = db.collection('chats');
          const usersCollection = db.collection('users');
      
          const query = {
            chatImageUrl: { $exists: true, $ne: '' },
          };
          
          if(language){
            query.language = language
          }

          if (fastify.mongo.ObjectId.isValid(userId)) {
            query.userId = new fastify.mongo.ObjectId(userId);
          }          
      
          if (style) {
            query.imageStyle = style;
          }
      
          if (model) {
            query.imageModel = { $regex: `^${model.replace('.safetensors', '')}(\\.safetensors)?$` };
          }

          if (searchQuery) {
            const queryWords = searchQuery.split(' ').map(word => word.replace(/[^\w\s]/gi, '').trim()).filter(word => word !== '');
            if (queryWords.length > 0) {
              query.$or = queryWords.map(word => ({
                  $or: [
                      { tags: { $regex: word, $options: 'i' } },
                      { characterPrompt: { $regex: word, $options: 'i' } },
                      { enhancedPrompt: { $regex: word, $options: 'i' } },
                      { imageDescription: { $regex: word, $options: 'i' } }
                  ]
              }));
            }
          }

          const recentCursor = await chatsCollection.aggregate([
            { $match: query },
            { $group: { _id: "$chatImageUrl", doc: { $first: "$$ROOT" } } },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: limit }
          ]).toArray();
      
          if (!recentCursor.length) {
            return reply.code(404).send({ recent: [], page, totalPages: 0 });
          }
      
          const recentWithUser = await Promise.all(
            recentCursor.map(async (chat) => {
              const user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(chat.userId) });
              return {
                ...chat,
                nickname: user ? user.nickname : null,
                profileUrl: user ? user.profileUrl : null
              };
            })
          );
      
          const totalChatsCount = await chatsCollection.countDocuments(query);
          let totalPages = Math.ceil(totalChatsCount / limit);
          if (recentCursor.length < limit) {
            totalPages = page;
          }

          reply.send({
            recent: recentWithUser,
            page,
            totalPages
          });
        } catch (err) {
          console.log("Error: ", err);
          reply.code(500).send('Internal Server Error');
        }
      });
      
    fastify.get('/api/user-data', async (request, reply) => {
        if (process.env.MODE != 'local') {
            return reply.send([]);
        }
        const { userId, query, date } = request.query;
        const collection = fastify.mongo.db.collection('userData');

        try {
            if (userId) {
                const userData = await collection.findOne({ userId: parseInt(userId) });
                if (!userData) {
                    return reply.status(404).send({ error: 'User not found' });
                }
                return reply.send(userData);
            } else {
                const allUsersData = await collection.find({}).toArray();
                
                // Filter and sort data based on query and date
                let filteredData = allUsersData;

                if (date) {
                    const startDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 1);

                    filteredData = filteredData.filter(user => {
                        const createdAt = new Date(user.createdAt);
                        return createdAt >= startDate && createdAt < endDate;
                    });
                }

                const sortBy = query || false
                filteredData = filteredData.filter(user => {
                    let maxScroll = getActionObject(user.customData, 'scroll');
                    maxScroll = maxScroll ? parseInt(maxScroll.scrollPercentage) : 0;
                    let result;
                    switch (sortBy) {
                        case 'choice':
                            result = user.choices && user.choices.length > 0;
                            break;
                        case 'scroll':
                            result = maxScroll && maxScroll > 0;
                            break;
                        default:
                            result = user.choices && user.choices.length > 0;
                    }
                    return result;
                });
                

                return reply.send(filteredData);
            }
        } catch (error) {
            console.error('Failed to retrieve user data:', error);
            return reply.status(500).send({ error: 'Failed to retrieve user data' });
        }
    });
    fastify.post('/api/user/personas', async (request, reply) => {
        try {
            const { personaId, action } = request.body;
            const user = request.user;
            const userId = user._id;
            const collection = fastify.mongo.db.collection('users');
    
            if (action === 'add') {
                const userDoc = await collection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
                if (userDoc?.personas?.length >= 8) {
                    return reply.status(400).send({ error: 'これ以上のペルソナを追加できません。（最大8個まで）' });
                }
                await collection.updateOne(
                    { _id: new fastify.mongo.ObjectId(userId) },
                    { $addToSet: { personas: new fastify.mongo.ObjectId(personaId) } }
                );
            } else if (action === 'remove') {
                
                const result = await collection.updateOne(
                    { _id: new fastify.mongo.ObjectId(userId) },
                    { $pull: { personas: { $in: [new fastify.mongo.ObjectId(personaId), personaId] } } }
                );
                
                if (result.modifiedCount > 0) {
                    console.log(`persona removed : ${personaId}`)
                } else {
                    console.log(`Error finding persona`)
                    return reply.status(500).send({ error: 'ペルソナの更新中にエラーが発生しました。' });
                }
                
            }
    
            return reply.send({ success: true });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'ペルソナの更新中にエラーが発生しました。' });
        }
    });
    
    fastify.post('/api/user/persona', async (request, reply) => {
        try {
            const { personaId } = request.body;
            const user = request.user;
            const userId = user._id;
            const userCollection = fastify.mongo.db.collection('users');
            const chatCollection = fastify.mongo.db.collection('chats');
    
            // Update the user's persona
            await userCollection.updateOne(
                { _id: new fastify.mongo.ObjectId(userId) },
                { $set: { persona: new fastify.mongo.ObjectId(personaId) } }
            );
    
            // Fetch the persona details from the chats collection
            const persona = await chatCollection.findOne({ _id: new fastify.mongo.ObjectId(personaId) });
    
            if (!persona) {
                return reply.status(404).send({ error: 'Persona not found.' });
            }
    
            return reply.send({ success: true, persona });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'An error occurred while updating the persona.' });
        }
    });    
    fastify.get('/api/user/persona-details', async (request, reply) => {
        try {
            const user = request.user;
            const userId = user._id;
            const userCollection = fastify.mongo.db.collection('users');
            const chatCollection = fastify.mongo.db.collection('chats');
    
            // Fetch user details
            const userDetails = await userCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });

            const personaIds = userDetails.personas && userDetails.personas.length > 0 
            ? userDetails.personas.map(id => new fastify.mongo.ObjectId(id)) 
            : [];
        
            const personaDetails = personaIds.length > 0 
                ? await chatCollection.find({ _id: { $in: personaIds } }).toArray() 
                : [];
        
            return reply.send({ userDetails, personaDetails });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'An error occurred while fetching the persona details.' });
        }
    });


    // Route to get translations
    fastify.post('/api/user/translations', async (request, reply) => {
        try {
            const { lang } = request.body;
            const userLang = lang || 'ja';
            const translations = request.translations;
            return reply.send({ success: true, translations });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'An error occurred while fetching translations.' });
        }
    });

    // Route to update user language
    fastify.post('/api/user/update-language', async (request, reply) => {
        try {
            const { lang } = request.body;
            const mode = process.env.MODE || 'local';
            const user = request.user;
            const userLang = lang || 'ja';
            
            if (user.isTemporary) {
                // Update tempUser lang
                user.lang = userLang;
                reply.setCookie('tempUser', JSON.stringify(user), {
                    path: '/',
                    httpOnly: true,
                    sameSite: mode === 'heroku' ? 'None' : 'Lax',
                    secure: mode === 'heroku',
                    maxAge: 3600
                });

            } else {
                // Update user's lang in the database
                await fastify.mongo.db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { lang: userLang } }
                );
            }

            return reply.send({ success: true, lang: userLang });
        } catch (error) {
            console.log(error)
            return reply.status(500).send({ error: 'An error occurred while updating the language.' });
        }
    });


    fastify.get('/api/user', async (request,reply) => {
        try {
            let user = request.user;
            const userId = user._id;
            if (userId && !user.isTemporary){
                const collection = fastify.mongo.db.collection('users');
                user = await collection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
            }
            return reply.send({user})
        } catch (error) {
            console.log(error)
        }
    })
    fastify.get('/api/mode', async (request,reply) => {
        return {mode:process.env.MODE}
    })
    function getActionObject(customData, action) {
        if(!customData){return false}
        return customData.find(item => item && item.action === action);
    }

      
    // Function to check if a string is a valid ObjectId
    function isNewObjectId(userId) {
        try {
        const objectId = new fastify.mongo.ObjectId(userId);
    
        // Check if the userId is a valid ObjectId
        if (objectId.toString() === userId) {
            return true;
        } else {
            return false;
        }
        } catch (err) {
        // If an error is thrown, it means the userId is not a valid ObjectId
        return false;
        }
    }
    fastify.post('/api/upload-image', async function (request, reply) {
        const db = await fastify.mongo.db;
        const parts = request.parts();
        let imageUrl = null;
        
        for await (const part of parts) {
            if (part.file) {
                imageUrl = await handleFileUpload(part, db);
            }
        }
    
        if (!imageUrl) {
            return reply.status(400).send({ error: 'File upload failed' });
        }
    
        reply.send({ imageUrl });
    });

    fastify.get('/blur-image', async (request, reply) => {
    const imageUrl = request.query.url;
    try {
        const response = await axios({ url: imageUrl, responseType: 'arraybuffer' });
        const blurredImage = await sharp(response.data).blur(25).toBuffer();
        reply.type('image/jpeg').send(blurredImage);
    } catch {
        reply.status(500).send('Error processing image');
    }
    });
    fastify.get('/api/categories', async (req, res) => {
        try {
          const categories = await fastify.mongo.db.collection('categories').find().toArray();
          return res.send(categories);
        } catch (err) {
            console.log(err)
          res.status(500).send('Ahoy! Trouble fetching categories.');
        }
      });
      fastify.post('/api/unlock/:type/:id', async (request, reply) => {
        try {
          const { type, id } = request.params;
          const itemId = new fastify.mongo.ObjectId(id);
          const user = request.user;
          const userId = new fastify.mongo.ObjectId(user._id);
          const db = fastify.mongo.db;
          const usersCollection = db.collection('users');
          
          let item;
          let redirect;
          let isOwner;
          if (type === 'gallery') {
            // If type is gallery, find the correct image within the gallery
            const gallery = await db.collection('gallery').findOne({ 'images._id': itemId });
            if (!gallery) return reply.code(404).send({ error: 'Gallery not found' });
            item = gallery.images.find(img => img._id.equals(itemId));
            redirect = `/character/${gallery.chatId}?imageId=${itemId}`
            isOwner = gallery.userId.toString() == userId
          } else {
            // For other types, just find by _id directly
            item = await db.collection(type).findOne({ _id: itemId });
            redirect = `/post/${itemId}`
            isOwner = item.userId.toString() == userId
          }
      
          if (!item) return reply.code(404).send({ error: 'Item not found' });
          
          if(!isOwner){
            const cost = item.unlockCost || 10;
            if (user.coins < cost) return reply.code(400).send({ error: 'Insufficient coins' });
        
            // Deduct coins
            await usersCollection.updateOne(
                { _id: userId },
                { $inc: { coins: -cost } }
            );
          }
          // unlocked item to user's unlockedItems
          await usersCollection.updateOne(
              { _id: userId },
              { $addToSet: { unlockedItems: itemId } }
          );

          const unlockedCollection = db.collection(`unlocked_${type}`);
          await unlockedCollection.insertOne({ userId, itemId, unlockedAt: new Date() });
      
          reply.send({ item,redirect, message: 'Item unlocked successfully' });
        } catch (err) {
          reply.code(500).send('Internal Server Error');
        }
      });      

    fastify.get('/api/is-unlocked/:type/:id', async (request, reply) => {
        try {
            const { type, id } = request.params;
            const itemId = new fastify.mongo.ObjectId(id);
            const user = request.user;
            const userId = new fastify.mongo.ObjectId(user._id);
            const db = fastify.mongo.db;
            const usersCollection = db.collection('users');
            const userDoc = await usersCollection.findOne({ _id: userId, unlockedItems: itemId });
            reply.send({ unlocked: !!userDoc });
        } catch (err) {
            reply.code(500).send('Internal Server Error');
        }
    });
    fastify.post('/api/prompts/create', async (request, reply) => {
        try {
          const db = fastify.mongo.db;
          const collection = db.collection('prompts');
          const parts = request.parts();
          let title = '';
          let promptText = '';
          let nsfw;
          let imageUrl = '';
          for await (const part of parts) {
            if (part.fieldname === 'title') title = part.value;
            if (part.fieldname === 'prompt') promptText = part.value;
            if (part.fieldname === 'nsfw') nsfw = part.value;
            if (part.fieldname === 'image') {
              imageUrl = await handleFileUpload(part, db);
            }
          }
          
          await collection.insertOne({
            title,
            prompt: promptText,
            nsfw,
            image: imageUrl,
            createdAt: new Date(),
          });
          
          reply.send({ success: true, message: 'Prompt created successfully' });
        } catch (error) {
          console.error('Error creating prompt:', error);
          reply.status(500).send({ success: false, message: 'Error creating prompt' });
        }
      });
        
        // Get All Prompts (Optional)
        fastify.get('/api/prompts', async (request, reply) => {
            try {
            const db = fastify.mongo.db;
            const prompts = await db.collection('prompts').find({}).sort({_id:-1}).toArray();
            reply.send(prompts);
            } catch (error) {
            console.error('Error fetching prompts:', error);
            reply.status(500).send({ success: false, message: 'Error fetching prompts' });
            }
        });
        
        // Get Single Prompt
        fastify.get('/api/prompts/:id', async (request, reply) => {
            try {
            const db = fastify.mongo.db;
            const { id } = request.params;
            const prompt = await getPromptById(db, id)
            reply.send(prompt);
            } catch (error) {
            console.error('Error fetching prompt:', error);
            reply.status(500).send({ success: false, message: 'Error fetching prompt' });
            }
        });
        
        // Update Prompt
        fastify.put('/api/prompts/:id', async (request, reply) => {
            try {
            const db = fastify.mongo.db;
            const { id } = request.params;
            const parts = request.parts();
            let title = '';
            let promptText = '';
            let nsfw;
            let imageUrl = '';
        
            for await (const part of parts) {
                if (part.fieldname === 'title') title = part.value;
                if (part.fieldname === 'prompt') promptText = part.value;
                if (part.fieldname === 'nsfw') nsfw = part.value;
                if (part.fieldname === 'image') {
                imageUrl = await handleFileUpload(part, db);
                }
            }
        
            const updateData = {
                title,
                prompt: promptText,
                nsfw,
                updatedAt: new Date(),
            };
            if (imageUrl) updateData.image = imageUrl;
        
            const result = await db.collection('prompts').updateOne(
                { _id: new fastify.mongo.ObjectId(id) },
                { $set: updateData }
            );
        
            if (result.matchedCount === 0) {
                return reply.status(404).send({ success: false, message: 'Prompt not found' });
            }
        
            reply.send({ success: true, message: 'Prompt updated successfully' });
            } catch (error) {
            console.error('Error updating prompt:', error);
            reply.status(500).send({ success: false, message: 'Error updating prompt' });
            }
        });
        
        // Delete Prompt
        fastify.delete('/api/prompts/:id', async (request, reply) => {
            try {
            const db = fastify.mongo.db;
            const { id } = request.params;
            const result = await db.collection('prompts').deleteOne({ _id: new fastify.mongo.ObjectId(id) });
            if (result.deletedCount === 0) {
                return reply.status(404).send({ success: false, message: 'Prompt not found' });
            }
            reply.send({ success: true, message: 'Prompt deleted successfully' });
            } catch (error) {
            console.error('Error deleting prompt:', error);
            reply.status(500).send({ success: false, message: 'Error deleting prompt' });
            }
        });
        fastify.get('/api/tags', async (request, reply) => {
            try {
            const db = fastify.mongo.db;
            const { tags, page, totalPages } = await fetchTags(db,request);
            reply.send({ tags, page, totalPages });
            } catch (error) {
            console.error('Error fetching tags:', error);
            reply.status(500).send({ error: 'Failed to fetch tags' });
            }
        });

        fastify.get('/api/models', async (req, reply) => {
            const { id, userId } = req.query;
            //if userId is provided, search for the chats of new ObjectId(userId) only 
            try {
                const db = fastify.mongo.db;
                const modelsCollection = db.collection('myModels');
                const free_models = ['544806', '64558'];
        
                // Build query for models
                let query = id ? { model: id } : {};
                const userIdMatch = userId ? [{ $match: { userId: new ObjectId(userId) } }] : [];
                const langMatch = [{ $match: { language: req.lang } }];

                // Fetch models with chat count, add premium field, and sort by chatCount
                const models = await modelsCollection.aggregate([
                    { $match: query },
                    {
                        $lookup: {
                          from: 'chats',
                          let: { model: '$model' },
                          pipeline: [
                            { $match: { $expr: { $eq: ['$imageModel', '$$model'] } } },
                            ...userIdMatch,
                            ...langMatch
                          ],
                          as: 'chats'
                        }
                    },
                    {
                        $addFields: {
                            chatCount: { $size: '$chats' }, // Calculate the number of chats
                            premium: { $not: { $in: ['$modelId', free_models] } }
                        }
                    },
                    {
                        $sort: { chatCount: -1 } // Sort by chatCount in descending order
                    },
                    {
                        $project: {
                            chats: 0 // Exclude chat details if not needed
                        }
                    }
                ]).toArray();

                return reply.send({ success: true, models });
            } catch (error) {
                console.error(error);
                return reply.code(500).send({ success: false, message: 'Error fetching models', error });
            }
        });
        
}

module.exports = routes;
