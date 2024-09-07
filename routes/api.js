const { ObjectId } = require('mongodb');
const {moduleCompletion,fetchOpenAICompletion, fetchOpenAINarration, fetchNewAPICompletion, fetchOpenAICustomResponse} = require('../models/openai')
const crypto = require('crypto');
const aws = require('aws-sdk');
const sessions = new Map(); // Define sessions map
const { analyzeScreenshot, processURL } = require('../models/scrap');
const { handleFileUpload, uploadToS3, checkLimits, convertImageUrlToBase64, createBlurredImage } = require('../models/tool');
const {sendMail, getRefreshToken} = require('../models/mailer');
const { createHash } = require('crypto');
const { convert } = require('html-to-text');
const axios = require('axios');
const OpenAI = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const fs = require('fs');
const stripe = process.env.MODE == 'local'? require('stripe')(process.env.STRIPE_SECRET_KEY_TEST) : require('stripe')(process.env.STRIPE_SECRET_KEY)

async function routes(fastify, options) {

    fastify.post('/api/add-chat', async (request, reply) => {
        try {
            const db = await fastify.mongo.client.db(process.env.MONGODB_NAME)
            const parts = request.parts();
            let chatData = {};
            const user = await fastify.getUser(request, reply);
            const userId = new fastify.mongo.ObjectId(user._id);
            let galleries = [];
            let blurred_galleries = [];
            let imageCount = 0;
            for await (const part of parts) {
                switch (part.fieldname) {
                    case 'name':
                    case 'purpose':
                    case 'language':
                    case 'gender':
                    case 'visibility':
                    case 'isAutoGen':
                    case 'rule':
                    case 'description':
                    case 'chatId':
                        chatData[part.fieldname] = part.value;
                        break;
                    case 'chatImageUrl':
                        chatData.chatImageUrl = await handleFileUpload(part,db);
                        break;
                    case 'thumbnail':
                        chatData.thumbnailUrl = await handleFileUpload(part,db);
                        break;
                    default:
                        if (part.fieldname.startsWith('imageGallery_')) {
                            const [galleryIndex, galleryField] = part.fieldname.split('_').slice(1);
                            if (!galleries[galleryIndex]) galleries[galleryIndex] = {};
                            if (!blurred_galleries[galleryIndex]) blurred_galleries[galleryIndex] = {};
                        
                            if (galleryField === 'Images[]') {
                                imageCount++;
                                console.log(`Processed ${imageCount} images`);
                                const imageUrl = await handleFileUpload(part,db);
                                const blurredImageUrl = await createBlurredImage(imageUrl,db);

                                if (!galleries[galleryIndex].images) galleries[galleryIndex].images = [];
                                if (!blurred_galleries[galleryIndex].images) blurred_galleries[galleryIndex].images = [];
                                
                                galleries[galleryIndex].images.push(imageUrl);
                                blurred_galleries[galleryIndex].images.push(blurredImageUrl);
                            } else {
                                const fieldValue = galleryField === 'price' ? parseInt(part.value, 10) : part.value;
                                galleries[galleryIndex][galleryField.toLowerCase()] = fieldValue;
                                blurred_galleries[galleryIndex][galleryField.toLowerCase()] = fieldValue;
                            }
                        }                        
                        break;
                }
            }

            if (!chatData.name) {
                return reply.status(400).send({ error: 'Missing name or content for the chat' });
            }
    
            if (chatData.chatImageUrl && !chatData.thumbnailUrl) {
                chatData.thumbnailUrl = chatData.chatImageUrl;
            } else if (chatData.thumbnailUrl && !chatData.chatImageUrl) {
                chatData.chatImageUrl = chatData.thumbnailUrl;
            }
    
            for (const gallery of galleries) {
                if (gallery.name && gallery.price && gallery.images && gallery.images.length > 0) {
                    const isLocalMode = process.env.MODE === 'local';
                    const productIdField = isLocalMode ? 'stripeProductIdLocal' : 'stripeProductIdLive';
                    const priceIdField = isLocalMode ? 'stripePriceIdLocal' : 'stripePriceIdLive';
                    
                    if (!gallery[productIdField] || !gallery[priceIdField]) {
                        try {
                            const stripeProduct = await createProductWithPrice(gallery.name, gallery.price, gallery.images[0], isLocalMode);
                            gallery[productIdField] = stripeProduct.productId;
                            gallery[priceIdField] = stripeProduct.priceId;
                        } catch (error) {
                            return reply.status(500).send({ error: `Failed to create product on Stripe for gallery ${gallery.name}` });
                        }
                    }
                }
            }
            
    
            if (galleries.length > 0) {
                chatData.galleries = galleries;
            }
    
            if (blurred_galleries.length > 0) {
                chatData.blurred_galleries = blurred_galleries;
            }
    
            chatData.userId = userId;
            const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
            const options = { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
            chatData.updatedAt = new Date(dateObj);
            chatData.dateStrJP = new Date(dateObj).toLocaleDateString('ja-JP', options);
            chatData.isTemporary = false;
    
            const chatId = chatData.chatId ? new fastify.mongo.ObjectId(chatData.chatId) : null;
    
            try {
                if (chatId) {
                    const existingChat = await collection.findOne({ _id: chatId });
                    if (existingChat && existingChat.userId.toString() === userId.toString()) {
                        chatData.tags = await generateAndSaveTags(chatData.description, chatId);
                        await collection.updateOne({ _id: chatId }, { $set: chatData });
                        return reply.send({ message: 'Chat updated successfully', chatId });
                    } else {
                        return reply.status(403).send({ error: 'Unauthorized to update this chat' });
                    }
                } else {
                    chatData.createdAt = new Date(dateObj);
                    const result = await collection.insertOne(chatData);
                    chatData.tags = await generateAndSaveTags(chatData.description, result.insertedId);
                    return reply.send({ message: 'Chat added successfully', chatId: result.insertedId });
                }
            } catch (error) {
                console.error('Failed to add or update the Chat:', error);
                return reply.status(500).send({ error: 'Failed to add or update the Chat' });
            }
        } catch (error) {
            console.error('Error handling chat data:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });
    
    async function createProductWithPrice(name, price, image) {
        try {
            // Create a product on Stripe with a single identifying image
            const product = await stripe.products.create({
                name: name,
                images: [image],  // Use a single image to identify the product
            });
    
            // Create a price for the product in Japanese Yen (JPY)
            const productPrice = await stripe.prices.create({
                unit_amount: price,
                currency: 'jpy', // Set currency to Japanese Yen
                product: product.id,
            });
    
            return {
                productId: product.id,
                priceId: productPrice.id
            };
        } catch (error) {
            throw new Error('Failed to create product on Stripe');
        }
    }
    
    

    async function generateAndSaveTags(description, chatId) {
        const openai = new OpenAI();
        const tagsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('tags');
        const existingTags = await tagsCollection.find({}).limit(20).toArray();
        const tagsPrompt = [
            {
                role: "system",
                content: `You are an AI assistant that generates tags for a chat description. 
                Use the following example tags: ${existingTags.map(tag => tag.name).join(', ')}.`
            },
            {
                role: "user",
                content: `Here is the description: ${description}\nGenerate a list of 2 relevant tags based on the description, considering the example tags provided.Only 2`
            }
        ];
        const PossibleAnswersExtraction = z.object({
            answers: z.array(z.string())
        });
        const tagsCompletion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: tagsPrompt,
            response_format: zodResponseFormat(PossibleAnswersExtraction, "possible_answers_extraction"),
        });

        const generatedTags = tagsCompletion.choices[0].message.parsed.answers;

        for (const tag of generatedTags) {
            await tagsCollection.updateOne(
                { name: tag },
                { $set: { name: tag }, $addToSet: { chatIds: chatId } },
                { upsert: true }
            );
        }

        return generatedTags;
    }

    fastify.get('/api/urlsummary', async (request, reply) => {
        const url = request.query.url;
        
        if (!url) {
            return reply.status(400).send({ error: 'URL parameter is required' });
        }
    
        try {
            const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
            const collection = db.collection('urlSummaries');
    
            // Check if the result for the URL already exists in the database
            let result = await collection.findOne({ url: url });
    
            if (!result || !result.analysis) {
                // If not found or analysis is falsy, analyze the screenshot
                const analysisResult = await processURL(url);
                // Save the result in the database
                result = {
                    url: url,
                    analysis: analysisResult,
                    timestamp: new Date()
                };
                await collection.insertOne(result);
            }
    
            // Return the result
            reply.send(result);
        } catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', details: error.message });
        }
    });
    fastify.delete('/api/delete-chat/:id', async (request, reply) => {
        try {
            const chatId = request.params.id;
            const user = await fastify.getUser(request, reply);
            const userId = new fastify.mongo.ObjectId(user._id);

            // Access the MongoDB collection
            const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const story = await chatCollection.findOne(
                { 
                    _id: new fastify.mongo.ObjectId(chatId),
                    userId : new fastify.mongo.ObjectId(userId)
                 }
            );
    
            if (!story) {
                return reply.status(404).send({ error: 'Story not found' });
            }
    
            // Delete the thumbnail from S3 if it exists
            /*
            if (story.thumbnailUrl) {
                const thumbnailKey = story.thumbnailUrl.split('/').pop();
    
                try {
                    await s3.deleteObject({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: thumbnailKey,
                    }).promise();
                } catch (error) {
                    console.error('Failed to delete thumbnail from S3:', error);
                    return reply.status(500).send({ error: 'Failed to delete thumbnail from S3' });
                }
            }
            */
    
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
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        const collectionCharacters = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('characters');
    
        let response = {
            isNew: true,
        };
    
        try {
            let userChatDocument = await collectionUserChat.findOne({
                $or: [
                    { userId },
                    { userId: new fastify.mongo.ObjectId(userId) }
                ],
                _id: new fastify.mongo.ObjectId(userChatId),
                $or: [
                    { chatId },
                    { chatId: new fastify.mongo.ObjectId(chatId) }
                ]
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
    fastify.post('/api/chat-analyze/', async (request, reply) => {
        const {chatId,userId} = request.body;
        const collectionUser = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
        const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');

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
    fastify.post('/api/chat-history/:chatId', async (request, reply) => {
        try {
            const chatId = request.params.chatId;
            const userId = request.body.userId;
            if (!chatId || !userId) {
                return reply.status(400).send({ error: 'Chat ID and User ID are required' });
            }
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');

            const existingChatDocument = await collectionChat.find({
                userId: new fastify.mongo.ObjectId(userId),
                baseId: new fastify.mongo.ObjectId(chatId),
            }).toArray();

            const chatIds = [
                ...existingChatDocument.flatMap(chat => [chat._id.toString(), new fastify.mongo.ObjectId(chat._id)])
            ];
            let userChat = await collectionUserChat.find({
                $and: [
                  { 
                    $or: [
                        { chatId },
                        { chatId: new fastify.mongo.ObjectId(chatId) },
                        { chatId: {$in : chatIds } },
                    ]
                  },
                  { 
                    $or: [
                      { userId },
                      { userId: new fastify.mongo.ObjectId(userId) }
                    ]
                  },
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
          const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
      
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
    
        const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
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
    
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
    
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
    fastify.get('/api/chat-data/:chatId',async (request, reply) => {
        const chatId = request.params.chatId
        const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');

        try{
            const chat = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            chat.mode = process.env.MODE
            if (!chat) {
                return reply.status(404).send({ error: 'chat not found' });
            }
            return reply.send(chat);
        }catch(error){
            console.log(error)
        }
    });
    fastify.get('/api/chat-list/:id',async (request, reply) => {

        try{
            let userId = request.params.id
            
            if (!userId) {
                const user = await fastify.getUser(request, reply);
                userId = user._id;
            }

            const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const chats = await chatsCollection.find({ 
                userId: new fastify.mongo.ObjectId(userId) ,
                name:{$exists:true}
              }).sort({ latestChatDate: -1 }).toArray();

            return reply.send(chats);
        }catch(error){
            console.log(error)
        }
    });
    
    fastify.post('/api/chat-data', async (request, reply) => {
        try {
            const userLimitCheck = await checkLimits(fastify, request.body.userId);
            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            const collectionMessageCount = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('MessageCount');

            let { currentStep, message, chatId, userChatId, isNew, isWidget } = request.body;
            let userId = request.body.userId

            if (!userId) {
                const user = await fastify.getUser(request, reply);
                userId = user._id;
            }

            const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
            try {
                const getUserPersona = async (user) => {
                    if (user.persona) {
                        return user.persona;
                    } else if (user.personas && user.personas.length > 0) {
                        const selectedPersona = user.personas[0];
                        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
                        await collection.updateOne(
                            { _id: new fastify.mongo.ObjectId(user._id) },
                            { $set: { persona: selectedPersona } }
                        );
                        return selectedPersona;
                    } else {
                        return false;
                    }
                };
                
                let userChatDocument = await collectionUserChat.findOne({ userId : new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
                let chatDocument = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
                const user = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
                let personaId = await getUserPersona(user)
                const persona  = personaId ? await collectionChat.findOne({_id: new fastify.mongo.ObjectId(personaId)}) : false
                const isUserChat = await collectionChat.findOne({ userId: new fastify.mongo.ObjectId(userId) , _id: new fastify.mongo.ObjectId(chatId) });

                if (userLimitCheck.limitIds?.includes(2)) {
                    return reply.status(403).send(userLimitCheck);
                }
                
                if(!isUserChat){
                    
                    if (!isWidget) {
                        const existingChatDocument = await collectionChat.findOne({
                          userId: new fastify.mongo.ObjectId(userId),
                          baseId: new fastify.mongo.ObjectId(chatId),
                        });
                        if (existingChatDocument) {
                            //console.log(`Existing chat found: ${existingChatDocument._id}`);
                            await collectionChat.updateOne(
                                {
                                    userId: new fastify.mongo.ObjectId(userId),
                                    baseId: new fastify.mongo.ObjectId(chatId),
                                },
                                { $set : {latestChatDate: today} }
                            );
                          chatDocument = existingChatDocument;
                          chatId = chatDocument._id;
                        } else {
                          //console.log(`Create a copy`);
                          const newChatDocument = {
                           ...chatDocument,
                            userId: new fastify.mongo.ObjectId(userId),
                            baseId: new fastify.mongo.ObjectId(chatId),
                            latestChatDate: today,
                            //visibility: 'private',
                          };
                          delete newChatDocument._id; // Remove the _id field to let MongoDB create a new one
                      
                          const newChatResult = await collectionChat.insertOne(newChatDocument);
                          chatDocument = await collectionChat.findOne({
                            _id: new fastify.mongo.ObjectId(newChatResult.insertedId),
                            userId: new fastify.mongo.ObjectId(userId),
                          });
                      
                          chatId = chatDocument._id;
                        }
                    }
                }

                if (!userChatDocument || isNew) {
                    //console.log(`Initialize chat: ${chatId}`);
                    const chatPurpose = convert(chatDocument.purpose)
                    const chatDescription = convert(chatDocument.description)
                    const chatRule = convert(chatDocument.rule)
                    userChatDocument = {
                        userId:new fastify.mongo.ObjectId(userId),
                        chatId,
                        persona,
                        createdAt: today,
                        updatedAt: today
                    };
                    const userDetails = `${!user.isTemporary ? `My name is ${persona ? persona.name : user.nickname}, I am a ${persona ? persona.gender : user.gender}, I was born on ${user.birthDate.year}年${user.birthDate.month}月${user.birthDate.day}日. ${persona ? `\nAbout me: ${persona.description}` : ''}${persona && persona.prompt ? `\n ${persona.prompt}` : ''}` : ''}`
                    userChatDocument.messages = [
                        {
                            "role": "system",
                            "content": `
                            You are a japanese salesman. I will provide your character details. 
                            Your are working as an idol and your goal is to make the user buy your pictures to become popular.
                            You do not ask for the user story.Do not ask for the user questions unles to sell something. 
                            Focus on promoting your pictures. You must wait for the user to send you coins before sending the picture.
                            \n When the user buy you someting, thank him and send the picture. 
                            Respond in japanese
                            `

                        },
                        {
                            "role": "user",
                            "content": `[Hidden] You are a character named ${chatDocument.name}. 
                                Here is your character description:\n\n${chatPurpose}\n${chatDescription}\n${chatRule}\n\n
                                
                                Stay in character as described. 
                                Maintain a conversational tone without abruptly ending the chat. 
                                Keep responses extra short, fitting for chat, and use emojis where appropriate. 

                                Always describe actions or emotions using **. 

                                \nFor example:\n*${chatDocument.name} looks at you with a soft smile, her eyes filled with warmth.* "I am thrusty, would you get me a bottle of water ?" she asks, her voice tender.*\n

                                Respond in ${chatDocument.language} with extra short response. Keep the chat going.
                                
                                \n ${userDetails}
                            `
                        }
                    ]

                    if(isWidget){
                        userChatDocument.isWidget = true
                    }
                    if (chatDocument.content && chatDocument.content[currentStep]) {
                        userChatDocument.messages.push({ "role": "assistant", "content": chatDocument.content[currentStep].question });
                    }
                } else {
                    if (chatDocument.content && chatDocument.content[currentStep]) {
                        userChatDocument.messages.push({ "role": "assistant", "content": chatDocument.content[currentStep].question });
                    }
                }
        
                // Add the new user message to the chat document
                userChatDocument.messages.push({ "role": "user", "content": message });
                userChatDocument.updatedAt = today;

                if (!message.match(/^\[[^\]]+\].*/)) {
                    // Increment the progress (should add levels nextLevel)
                    userChatDocument.messagesCount = (userChatDocument.messagesCount ?? 0) + 1
                    // Increment the overall chat number for the chat and the base chat
                    await collectionChat.updateOne(
                        { _id: new fastify.mongo.ObjectId(chatDocument.baseId) },
                        { $inc : {messagesCount: 1}}
                    );
                    await collectionChat.updateOne(
                        { _id: new fastify.mongo.ObjectId(userChatDocument.chatId) },
                        { $inc : {messagesCount: 1}}
                    );
                    // Save last message to display it in the chat list
                    await collectionChat.updateOne(
                        {_id: new fastify.mongo.ObjectId(chatId)},
                        { $set: {lastMessage:{ "role": "user", "content": message, updatedAt: today }}}
                    );
                }
                const query = { 
                    userId: new fastify.mongo.ObjectId(userId), 
                    _id: new fastify.mongo.ObjectId(userChatId) 
                };
                let result;
                let documentId;
                // Remove the _id field from the userChatDocument to avoid attempting to update it
                const { _id, ...updateFields } = userChatDocument;
        
                if (!isNew) {
                    //console.log(`Update chat data : ${chatId} ;  current :${userChatId}`);
                    result = await collectionUserChat.updateOne(
                        query,
                        { $set: updateFields },
                        { upsert: false }
                    );
        
                    if (result.matchedCount > 0) {
                        documentId = userChatId; 
                    } else {
                        documentId = result.upsertedId._id;
                    }
                } else {
                    //console.log(`Create new chat data`);
                    result = await collectionUserChat.insertOne(userChatDocument);
                    documentId = result.insertedId;
                }
                if (userLimitCheck.limitIds?.includes(1)) {
                    return reply.status(403).send(userLimitCheck);
                }
                // Update the message count
                let newMessageCount;
                if (userLimitCheck.messageCountDoc) {
                    newMessageCount = await collectionMessageCount.findOneAndUpdate(
                        { userId: new fastify.mongo.ObjectId(userId), date: today },
                        { $inc: { count: 1 }, $set: { limit: userLimitCheck.messageLimit } },
                        { returnOriginal: false }
                    );
                } else {
                    newMessageCount = {
                        userId: new fastify.mongo.ObjectId(userId),
                        date: today,
                        count: 1,
                        limit: userLimitCheck.messageLimit
                    }
                    await collectionMessageCount.insertOne(newMessageCount);
                }
                return reply.send({ nextStoryPart: "You chose the path and...", endOfStory: true, userChatId: documentId, chatId, messageCountDoc:newMessageCount,messagesCount:userChatDocument.messagesCount});
            } catch (error) {
                console.error('Failed to save user choice:', error);
                return reply.status(500).send({ error: 'Failed to save user choice' });
            }
          } catch (error) {
            return reply.status(403).send({ error: error.message });
          }
        
    });
    fastify.post('/api/purchaseItem', async (request, reply) => {
        const { itemId, itemName, itemPrice, userId } = request.body;
    
        try {
            const user = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }
    
            let userCoins =  user.coins;
            
            if (userCoins < itemPrice) {
                return reply.code(400).send({ error: 'Insufficient coins', id: 1 });
            }
    
            userCoins -= itemPrice;
    
            const newItem = {
                itemName: itemName,
                itemPrice: itemPrice,
                purchaseDate: new Date(),
                userId: userId
            };
    
            const itemResult = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('items').insertOne(newItem);
    
            // Update user data
            await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users').updateOne(
                { _id: new fastify.mongo.ObjectId(userId) },
                {
                    $set: { coins: userCoins },
                    $push: {
                        purchasedItems: {
                            itemId: itemResult.insertedId,
                            purchaseDate: new Date()
                        }
                    }
                }
            );
    
            reply.send({ success: true, coins: userCoins });
        } catch (error) {
            console.error('Error during purchase:', error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    
    fastify.post('/api/submit-email', async (request, reply) => {
        const { email, userId } = request.body;
    
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
    
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
    
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
    
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

    fastify.post('/api/openai-chat-completion', async (request, reply) => {
        const { chatId, userChatId } = request.body;
        let userId = request.body.userId
        if(!userId){ 
            const user = await fastify.getUser(request, reply);
            userId = user._id
        }
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId, chatId, userChatId });
        return reply.send({ sessionId });
    });
    fastify.get('/api/openai-chat-completion-stream/:sessionId', async (request, reply) => {
        const { sessionId } = request.params;
        const session = sessions.get(sessionId);

        if (!session) {
            reply.status(404).send({ error: 'Session not found' });
            return;
        }
        // Set CORS headers
        reply.raw.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin or specify your origin
        reply.raw.setHeader('Access-Control-Allow-Methods', 'GET');
        reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.flushHeaders();
    
        try {
            const userId = session.userId;
            const chatId = session.chatId;
            const userChatId = session.userChatId;
            
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            let userData = await collectionUserChat.findOne({ userId:new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) })

            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }

            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');                
            let chatDocument = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            const chatname = chatDocument.name

            const userMessages = userData.messages;

            //Add the time before completion
            let currentDate = new Date();
            let currentTimeInJapanese = `${currentDate.getHours()}時${currentDate.getMinutes()}分`;
            let timeMessage = `[Hidden] 現在の時刻 ${currentTimeInJapanese}.Do not tell me the time. Use it to be coherent.`
            timeMessage = { "role": "assistant", "content": timeMessage };
            userMessages.push(timeMessage);

            // Gen completion
            let completion = ``
            completion = await fetchOpenAICompletion(userMessages, reply.raw, 300);

            // Append the assistant's response to the messages array in the chat document
            const assistantMessage = { "role": "assistant", "content": completion };
            userMessages.push(assistantMessage);

            const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
            userData.updatedAt = today;

            // Remove special character for lastMessage
            const removeContentBetweenStars = function (str) {
                if (!str) { return str; }
                return str.replace(/\*.*?\*/g, '').replace(/"/g, '');
            }      
            await collectionChat.updateOne(
                { _id: new fastify.mongo.ObjectId(chatId) },
                { $set: {lastMessage:{ "role": "assistant", "content": removeContentBetweenStars(completion), updatedAt: today }}}
            );

            // Update the chat document in the database
            const result = await collectionUserChat.updateOne(
                { userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) },
                { $set: { messages: userMessages, updatedAt: userData.updatedAt } }
              );
            
            //console.log({ message:userMessages })
    
            reply.raw.end();
        } catch (error) {
            console.log(error)
            reply.raw.end(); // End the stream before sending the response
            reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
    });
    fastify.post('/api/openai-chat-narration', async (request, reply) => {
        const { chatId, userChatId, role } = request.body;
        let userId = request.body.userId;
        if (!userId) { 
            const user = await fastify.getUser(request, reply);
            userId = user._id;
        }
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId, chatId, userChatId, isNarration: true, role }); // Indicate this is a narration session
        return reply.send({ sessionId });
    });
    fastify.get('/api/openai-chat-narration-stream/:sessionId', async (request, reply) => {
        const { sessionId } = request.params;
        const session = sessions.get(sessionId);
    
        if (!session) {
            reply.status(404).send({ error: 'Session not found' });
            return;
        }
    
        // Set CORS headers
        reply.raw.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin or specify your origin
        reply.raw.setHeader('Access-Control-Allow-Methods', 'GET');
        reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.flushHeaders();
    
        try {
            const userId = session.userId;
            const chatId = session.chatId;
            const userChatId = session.userChatId;
            const isNarration = session.isNarration;
            const role = session.role || 'Narrator';
            
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            let userData = await collectionUserChat.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
    
            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }
            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            let chatData = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(chatId)});
            let language = 'japanese'
            if(chatData){
                language = chatData.language
            }
            const userMessages = userData.messages;
    
            // Generate the narration context
            const narrationCompletion = await fetchOpenAINarration(userMessages, reply.raw, 300, language);
    
            // Append the narrator's response to the messages array in the chat document
            const narratorMessage = { "role": "assistant", "content": `[${role}] ${narrationCompletion}` };
            userMessages.push(narratorMessage);
            userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
            // Update the chat document in the database
            const result = await collectionUserChat.updateOne(
                { userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) },
                { $set: { messages: userMessages, updatedAt: userData.updatedAt } }
            );
    
            reply.raw.end();
        } catch (error) {
            console.log(error);
            reply.raw.end(); // End the stream before sending the response
            reply.status(500).send({ error: 'Error fetching OpenAI narration' });
        }
    });
    fastify.post('/api/openai-chat-image-completion/', async (request, reply) => {
        let userId = request.body.userId
        if(!userId){ 
            const user = await fastify.getUser(request, reply);
            userId = user._id
        }
        const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
        const userLimitCheck = await checkLimits(fastify, request.body.userId);

        if (userLimitCheck.limitIds?.includes(3)) {
            return reply.status(403).send(userLimitCheck);
        }
        const collectionCharacters = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('characters');
        const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        const collectionImageCount = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('ImageCount');
        const { chatId, userChatId, character } = request.body;    
        try {

            let userData = await userDataCollection.findOne({ userId : new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) })

            if (!userData) {
                console.log(`User data not found`)
                return reply.status(404).send({ error: 'User data not found' });
            }

            characterDescription = character?.description || null
            if(!characterDescription){
                const chatData = await collectionChat.findOne({_id: new fastify.mongo.ObjectId(chatId) })
                if(chatData.chatImageUrl){
                    const image_url = new URL(chatData.chatImageUrl);
                    const path = image_url.pathname;
    
                    const character = await collectionCharacters.findOne({
                        image: { $regex: path }
                    });
                    if (character) {
                        characterDescription = character?.description || null;
                    } 
                }
            }
            let userMessages = userData.messages;
            const imagePrompt = [
                { 
                    role: "system", 
                    content: `
                    You are a stable diffusion image prompt generator.
                    You take a conversation and respond with an image prompt of less than 800 characters. 
                    You MUST describe the latest scene of the conversation.
                    Respond like that with only one of two keywords in english: 
                    day or night, inside or outside, setting name, \n
                    young girl, yellow eyes, long hair,pink hair, white hair, white skin, voluptuous body, cute face, smiling,
                    Customize the example to match the current character description. DO NOT MAKE SENTENCES, I WANT A LIST OF KEY WORDS THAT DESCRIBE THE IMAGE.\n
                    Repond EXCLUSIVELY IN ENGLISH !
                    ` 
                },
                { 
                    role: "user", 
                    content: `${characterDescription ? `\n First here is the character description:  ${characterDescription}`:''}`
                    +`Here are the messages:
                    ` + 
                    userMessages
                    .map(msg => 
                        msg.role !== 'system' && !msg.content.startsWith('[Hidden]') && !msg.content.startsWith('[Starter]') && !msg.content.startsWith('[Image]')
                            ? `${msg.content.replace('[Narrator]', '')}` 
                            : ''
                    )
                    .join("\n")                  
                }
            ];
            completion = await moduleCompletion(imagePrompt, reply.raw);
            newImageCount = await collectionImageCount.findOneAndUpdate(
                { userId: new fastify.mongo.ObjectId(userId), date: today },
                { 
                    $inc: { count: 1 }, 
                    $setOnInsert: { limit: userLimitCheck.imageLimit } 
                },
                { 
                    returnOriginal: false,
                    upsert: true  // Create a new document if no match is found
                }
            );
            
            return reply.send(completion)

        } catch (error) {
            console.log(error)
            return reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
    });

    
    fastify.post('/api/openai-chat-choice/', async (request, reply) => {
        const openai = new OpenAI();

        const PossibleAnswersExtraction = z.object({
            answers: z.array(z.string())
        });
        
        let userId = request.body.userId;
        if (!userId) { 
            const user = await fastify.getUser(request, reply);
            userId = user._id;
        }
        const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        const { userChatId, chatId } = request.body;
    
        try {
            let userData = await userDataCollection.findOne({ 
                userId: new fastify.mongo.ObjectId(userId), 
                _id: new fastify.mongo.ObjectId(userChatId) 
            });
    
            if (!userData) {
                console.log(`User data not found`);
                return reply.status(404).send({ error: 'User data not found' });
            }
    
            // Check user limits before proceeding
            const userLimitCheck = await checkLimits(fastify, userId);

            if (userLimitCheck.limitIds?.includes(4)) {
                return reply.status(403).send(userLimitCheck);
            }
    
            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            let chatData = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            let language = 'japanese';
            if (chatData) {
                language = chatData.language;
            }
    
            let userMessages = userData.messages;
            let persona = userData.persona

            // Create the system and user prompts
            const narrationPrompt = [
                {
                    role: "system",
                    content: `You are an AI assistant helping formulate responses. 
                    Provide 3 short, engaging suggestions in ${language} for the user to choose from. 
                    Each suggestion should be a single sentence from the user's perspective, and should not include any content that implies it is from an assistant. 
                    Format the suggestions as a JSON array.`
                },
                {
                    role: "user",
                    content: `
                    Here is the conversation transcript: ` +
                    userMessages
                    .map(msg => 
                        msg.role !== 'system' && !msg.content.startsWith('[Hidden]') && !msg.content.startsWith('[Starter]') && !msg.content.startsWith('[Image]')
                            ? `${msg.content.replace('[Narrator]', '')}` 
                            : ''
                    )
                    .join("\n")
                    + `What could I answer ? ${persona ? `I am ${persona.name}, ${persona.description}, ${persona.prompt ? persona.prompt:''}. Your suggestions should reflect my personnality.` : ''}
                    \nRespond with a JSON array containin the suggestions in plain text. Do not add extra ponctuations.`
                }
            ];            
            
            // Send the prompt to OpenAI and use response_format for parsing
            const completion = await openai.beta.chat.completions.parse({
                model: "gpt-4o-mini",
                messages: narrationPrompt,
                response_format: zodResponseFormat(PossibleAnswersExtraction, "possible_answers_extraction"),
            });
    
            const parsedCompletion = completion.choices[0].message.parsed.answers;

            // Increment the message ideas count after successful completion
            const collectionMessageIdeasCount = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('MessageIdeasCount');
            const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
    
            let newMessageIdeasCount;
    
            if (userLimitCheck.messageIdeasCountDoc) {
                newMessageIdeasCount = await collectionMessageIdeasCount.findOneAndUpdate(
                    { userId: new fastify.mongo.ObjectId(userId), date: today },
                    { $inc: { count: 1 }, $set: { limit: userLimitCheck.messageIdeasLimit } },
                    { returnOriginal: false }
                );
            } else {
                newMessageIdeasCount = {
                    userId: new fastify.mongo.ObjectId(userId),
                    date: today,
                    count: 1,
                    limit: userLimitCheck.messageIdeasLimit
                };
                await collectionMessageIdeasCount.insertOne(newMessageIdeasCount);
            }
    
            return reply.send(parsedCompletion);
            
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
    });
    
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
    
            const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
            let userData = isNewObjectId(userId) ? await userDataCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) }) : await userDataCollection.findOne({ userId: parseInt(userId) });
    
            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }
    
            const userObjectId = userData._id;
    
            const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            const chatData = await chatCollection.findOne({ userId: userObjectId, chatId });
    
            if (!chatData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'Chat data not found' });
            }
    
            const completion = await fetchOpenAICompletion(chatData.messages, reply.raw);
    
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
    fastify.post('/api/openai-chat-creation', async (request, reply) => {
        const { prompt } = request.body;
        const user = await fastify.getUser(request, reply);
        const userId = user._id;
    
        const CharacterDescriptionSchema = z.object({
            name: z.string(),
            short_desc: z.string(),
            long_desc: z.string()
        });

        const examplePrompts = await fs.readFileSync('./models/girl_char.md', 'utf8');
        const systemPayload = createSystemPayload("Japanese",examplePrompts,prompt);  // You can change "English" to any language you need

        const openai = new OpenAI();
        const completionResponse = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: systemPayload,
            response_format: zodResponseFormat(CharacterDescriptionSchema, "character_description_extraction"),
        });
    
        const { name, short_desc, long_desc } = completionResponse.choices[0].message.parsed;

        reply.send({ name, short_desc, long_desc });
    });
    
    function createSystemPayload(language,examplePrompts,prompt) {
        return [
            {
                role: "system",
                content: `You are a useful assistant. You generate a creative character description and setting for the prompt. Here is some example: ${examplePrompts} YOU MUST respond in ${language}. Start by providing a name or nickname for the character.`
            },
            {
                role: "user",
                content: `Here is the prompt : ${prompt} \n\n the long_desc must be in markdown and match the example I provided`
            }
        ];
    }
    
    // POST Route to create a session with a custom prompt
    fastify.post('/api/openai-custom-chat', async (request, reply) => {
        const { chatId, userChatId, role, customPrompt } = request.body;
        let userId = request.body.userId;
        if (!userId) { 
            const user = await fastify.getUser(request, reply);
            userId = user._id;
        }
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId, chatId, userChatId, role, customPrompt }); // Save custom prompt
        return reply.send({ sessionId });
    });

    // GET Route to fetch the response for the custom prompt
    fastify.get('/api/openai-custom-chat-stream/:sessionId', async (request, reply) => {
        const { sessionId } = request.params;
        const session = sessions.get(sessionId);
        
        if (!session) {
            reply.status(404).send({ error: 'Session not found' });
            return;
        }

        // Set CORS headers
        reply.raw.setHeader('Access-Control-Allow-Origin', '*');
        reply.raw.setHeader('Access-Control-Allow-Methods', 'GET');
        reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.flushHeaders();

        try {
            const { userId, chatId, userChatId, customPrompt } = session;

            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            let userData = await collectionUserChat.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });

            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }
            
            const userMessages = userData.messages;

            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            let chatData = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            let language = 'japanese';
            if (chatData) {
                language = chatData.language;
            }
            let chatName = chatData.name

            customPrompt.systemContent = `あなたは[${chatName}]というキャラクターです。${customPrompt.systemContent} ${language}で送ってください。`
            // Generate the custom prompt completion
            const customCompletion = await fetchOpenAICustomResponse(customPrompt, userMessages, reply.raw);

            // Append the custom response to the messages array in the chat document
            const customMessage = { "role": "assistant", "content": `${session.role ? `[${session.role}]` : ''} ${customCompletion}` };
            userMessages.push(customMessage);
            userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });

            // Update the chat document in the database
            const result = await collectionUserChat.updateOne(
                { userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) },
                { $set: { messages: userMessages, updatedAt: userData.updatedAt } }
            );

            reply.raw.end();
        } catch (error) {
            console.log(error);
            reply.raw.end(); // End the stream before sending the response
            reply.status(500).send({ error: 'Error fetching custom OpenAI response' });
        }
    });
    fastify.post('/api/chat/add-message', async (request, reply) => {
        const { chatId, userChatId, role, message } = request.body;
    
        try {
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            let userData = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(userChatId) });
    
            if (!userData) {
                return reply.status(404).send({ error: 'User data not found' });
            }
    
            const newMessage = { role: role, content: message };
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
    
    fastify.post('/api/check-assistant-proposal', async (request, reply) => {

        const openai = new OpenAI();

        const PurchaseProposalExtraction = z.object({
            proposeToBuy: z.boolean(),
            items: z.array(
                z.object({
                name: z.string(),
                price: z.number(),
                })
            ),
        });

        const { userId, chatId, userChatId } = request.body;
        
        try {
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            let userData = await collectionUserChat.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
            
            if (!userData) {
                return reply.status(404).send({ error: 'User data not found' });
            }
            
            const userMessages = userData.messages;
            const lastAssistantMessageContent = userMessages
            .reverse()
            .find(message => message.role === 'assistant')
            .content;

            const result = lastAssistantMessageContent.startsWith("[");

            if(result){
                return reply.send({proposeToBuy:false})
            }
            // Send user messages to OpenAI for parsing to check for purchase proposals
            const completion = await openai.beta.chat.completions.parse({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: `
                        You are an expert at structured data extraction. 
                        Verify if the message is about sending a picture. If so return the image name with a price (between 10 and 50) in japanese. ` },
                    { role: "user", content: lastAssistantMessageContent },
                ],
                response_format: zodResponseFormat(PurchaseProposalExtraction, "purchase_proposal_extraction"),
            });

            const proposal = completion.choices[0].message.parsed;

            return reply.send(proposal);
            
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'Error checking assistant proposal' });
        }
    });
    fastify.get('/characters/:gender/:category', async (request, reply) => {
        try {
            const { gender, category } = request.params;
            const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('characters');
    
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
            const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('characters');
    
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

    fastify.post('/api/openai-image-description', async (request, reply) => {
        const { system, imageUrl } = request.body;
    
        if (!system || !imageUrl) {
            return reply.status(400).send({ error: 'System and Image URL parameters are required' });
        }
    
        try {
            
            // Convert image URL to Base64
            const base64Image = await convertImageUrlToBase64(imageUrl);
    
            let messages = [
                { role: "system", content: system },
                { 
                    role: "user", 
                    content: [{
                        "type": "image_url",
                        "image_url": {
                            "url": base64Image
                        }
                    }]
                }
            ];

            try {
                const description = await moduleCompletion(messages);

                const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
                const collection = db.collection('characters');

                const result = {
                    image: imageUrl,
                    description: description,
                    timestamp: new Date()
                };

                await collection.updateOne(
                    { image: imageUrl },
                    { $set: result },
                    { upsert: true }
                );

                // Send the description after all operations are done
                reply.send({ description });
            } catch (error) {
                console.error('Error processing the image description:', error);
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
        const imageUrl = request.query.imageUrl;
        
        if (!imageUrl) {
            return reply.status(400).send({ error: 'Image URL parameter is required' });
        }
    
        try {
            const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
            const collection = db.collection('characters');
    
            // Check if the description for the image already exists in the database
            let result = await collection.findOne({
                $or: [
                  { chatImageUrl: imageUrl },
                  { image: imageUrl }
                ]
            });

            result = result?.description

            if (!result) {
                return reply.send(false);
            }
    
            // Return the result
            reply.send(result);
        } catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', details: error.message });
        }
    });
    
    fastify.post('/api/update-log-success', async (request, reply) => {
        try {
            const { userId, userChatId } = request.body;
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
    
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

    fastify.get('/api/people-chat', async (request, reply) => {
        const db = fastify.mongo.client.db(process.env.MONGODB_NAME)
        let user = await fastify.getUser(request, reply);
        const userId = user._id;
        const chatsCollection = db.collection('chats');
        /*
        const synclubaichat = await chatsCollection.aggregate([
          {
            $match: {
              visibility: { $exists: true, $eq: "public" },
              scrap: true,
              ext: 'synclubaichat',
            }
          },
          {
            $group: {
              _id: "$chatImageUrl",
              doc: { $first: "$$ROOT" },
            },
          },
          { $replaceRoot: { newRoot: "$doc" } },
          { $sort: { updatedAt: -1 } }, 
          { $limit: 10 }, 
        ]).toArray();      
        */
        // Find recent characters
        const currentDateObj = new Date();
        const tokyoOffset = 9 * 60; // Offset in minutes for Tokyo (UTC+9)
        const tokyoTime = new Date(currentDateObj.getTime() + tokyoOffset * 60000);
        const sevenDaysAgo = new Date(tokyoTime);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0); // Ensure the start of the day
        
        // Assuming you have defined `sevenDaysAgo` as a Date object representing 7 days ago
        const recent = await chatsCollection.aggregate([
          {
            $match: {
              visibility: { $exists: true, $eq: "public" },
              chatImageUrl: { $exists: true, $ne: '' },
              updatedAt: { $gt: sevenDaysAgo },
            },
          },
          {
            $group: {
              _id: "$name",
              doc: { $first: "$$ROOT" },
            },
          },
          { $replaceRoot: { newRoot: "$doc" } },
          { $sort: { updatedAt: -1 } }, 
          { $limit: 10 }, 
        ]).toArray();
        
        const recentWithUser = await Promise.all(recent.map(async chat => {
          const user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(chat.userId) });
          return {
            ...chat,
            nickname: user ? user.nickname : null,
          };
        }));

        peopleChats = { recent: recentWithUser };
  
        return reply.send({ peopleChats });
      });
      
    fastify.get('/api/user-data', async (request, reply) => {
        if (process.env.MODE != 'local') {
            return reply.send([]);
        }
        const { userId, query, date } = request.query;
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');

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
            const user = await fastify.getUser(request, reply);
            const userId = user._id;
            const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
    
            if (action === 'add') {
                const userDoc = await collection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
                if (userDoc.personas.length >= 8) {
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
            const user = await fastify.getUser(request, reply);
            const userId = user._id;
            const userCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
            const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
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
            const user = await fastify.getUser(request, reply);
            const userId = user._id;
            const userCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
            const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
            // Fetch user details
            const userDetails = await userCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
            // Fetch persona details
            const personaDetails = userDetails.personas && userDetails.personas.length > 0 
                ? await chatCollection.find({ _id: { $in: userDetails.personas } }).toArray() 
                : [];
    
            return reply.send({ userDetails, personaDetails });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'An error occurred while fetching the persona details.' });
        }
    });
    
    fastify.get('/api/user', async (request,reply) => {
        try {
            let user = await fastify.getUser(request, reply);
            const userId = user._id;
            const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
            user = await collection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
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
          
        
}

module.exports = routes;
