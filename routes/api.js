const { ObjectId } = require('mongodb');
const {moduleCompletion,fetchOpenAICompletion,generateCompletion, fetchOpenAINarration, fetchNewAPICompletion, fetchOpenAICustomResponse} = require('../models/openai')
const crypto = require('crypto');
const sessions = new Map(); // Define sessions map
const { handleFileUpload, uploadToS3, checkLimits, convertImageUrlToBase64, createBlurredImage } = require('../models/tool');
const {sendMail, getRefreshToken} = require('../models/mailer');
const { createHash } = require('crypto');
const { convert } = require('html-to-text');
const axios = require('axios');
const OpenAI = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const path = require('path');
const fs = require('fs');
const stripe = process.env.MODE == 'local'? require('stripe')(process.env.STRIPE_SECRET_KEY_TEST) : require('stripe')(process.env.STRIPE_SECRET_KEY)
const sharp = require('sharp');
const { chat } = require('googleapis/build/src/apis/chat');

const aiModelChat = 'cognitivecomputations/dolphin-mixtral-8x22b'
const aiModel = `sophosympatheia/midnight-rose-70b`

const aiInstructions = "[Hidden] Provide images to the user by using [image_sfw] for general images and [image_nsfw] for adult images. Triggers should be included when proposing image options or responding to user requests. Example messages include 'Would you like this image? [image_sfw]' or 'Would you prefer an adult image? [image_nsfw]'. Only the actions [image_sfw] and [image_nsfw] are permitted.";
  
const aiInstructionsShort = "[Hidden] Use [image_sfw] for general images, [image_nsfw] for adult images, include triggers when proposing or responding to requests.";

async function routes(fastify, options) {

    fastify.post('/api/add-chat', async (request, reply) => {
        try {
            const db = await fastify.mongo.db
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
                    case 'imageStyle':
                    case 'imageModel':
                    case 'imageVersion':
                    case 'purpose':
                    case 'characterPrompt':
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
                            console.log({galleryIndex})
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
    
            chatData.userId = userId;
            const collection = fastify.mongo.db.collection('chats');
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
                    
                        // Merge existing gallery data with new data, preserving existing images if no new ones are provided
                            existingChat.galleries = existingChat.galleries || []; // Ensure it exists
                            galleries.forEach((newGallery, index) => {
                                // If the current gallery already exists, merge the images
                                if (existingChat.galleries[index]) {
                                    existingChat.galleries[index].images = existingChat.galleries[index].images || [];
                                    existingChat.galleries[index].images = [
                                        ...existingChat.galleries[index].images, 
                                        ...(newGallery.images || [])
                                    ];
                                    delete newGallery.images;
                                    Object.assign(existingChat.galleries[index], newGallery); // Merge other gallery data
                                } else {
                                    existingChat.galleries[index] = newGallery; // Add new gallery
                                }
                            });
                        
                    
                            existingChat.blurred_galleries = existingChat.blurred_galleries || []; // Ensure it exists
                            blurred_galleries.forEach((newBlurredGallery, index) => {
                                // If the current blurred gallery already exists, merge the images
                                if (existingChat.blurred_galleries[index]) {
                                    existingChat.blurred_galleries[index].images = existingChat.blurred_galleries[index].images || [];
                                    existingChat.blurred_galleries[index].images = [
                                        ...existingChat.blurred_galleries[index].images, 
                                        ...(newBlurredGallery.images || [])
                                    ];
                                    delete newBlurredGallery.images;
                                    Object.assign(existingChat.blurred_galleries[index], newBlurredGallery); // Merge other gallery data
                                } else {
                                    existingChat.blurred_galleries[index] = newBlurredGallery; // Add new blurred gallery
                                }
                            });
                        
                    
                        // Update the chat data, including merged galleries and other chatData fields
                        const updateData = { ...chatData, galleries: existingChat.galleries, blurred_galleries: existingChat.blurred_galleries };
                    
                        await collection.updateOne({ _id: chatId }, { $set: updateData });
                        console.log(`Chat updated successfully`);
                        return reply.send({ message: 'Chat updated successfully', chatId });
                    }
                    else {
                        return reply.status(403).send({ error: 'Unauthorized to update this chat' });
                    }
                } else {
                    chatData.createdAt = new Date(dateObj);
                    const result = await collection.insertOne(chatData);
                    chatData.tags = await generateAndSaveTags(chatData.description, result.insertedId);
                    console.log(`Chat added successfully`)
                    return reply.send({ message: 'Chat added successfully', chatId: result.insertedId });
                }
            } catch (error) {
                console.log('Failed to add or update the Chat:', error);
                return reply.status(500).send({ error: 'Failed to add or update the Chat' });
            }
        } catch (error) {
            console.log('Error handling chat data:', error);
            return reply.status(500).send({ error: 'Internal server error' });
        }
    });

    async function generateAndSaveTags(description, chatId) {
        const openai = new OpenAI();
        const tagsCollection = fastify.mongo.db.collection('tags');
        const existingTags = await tagsCollection.find({}).limit(20).toArray();
        const tagsPrompt = [
            {
                role: "system",
                content: `You are an AI assistant that generates tags for a chat description. 
                Use the following example tags: ${existingTags.map(tag => tag.name).join(', ')}.`
            },
            {
                role: "user",
                content: `Here is the description: ${description}\nGenerate a list of 5 relevant tags based on the description, considering the example tags provided.`
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
    fastify.post('/api/reset-gallery', async (request, reply) => {
        try {
            const { chatId, galleryIndex } = request.body;
            if (!chatId || galleryIndex === undefined) {
                return reply.status(400).send({ error: 'chatId and galleryIndex are required' });
            }
    
            const db = await fastify.mongo.db;
            const collection = db.collection('chats');
            const user = await fastify.getUser(request, reply);
            const userId = new fastify.mongo.ObjectId(user._id);
            const chatObjectId = new fastify.mongo.ObjectId(chatId);
    
            const existingChat = await collection.findOne({ _id: chatObjectId });
            if (!existingChat || existingChat.userId.toString() !== userId.toString()) {
                return reply.status(403).send({ error: 'Unauthorized to reset this gallery' });
            }
    
            if (existingChat.galleries && existingChat.galleries[galleryIndex]) {
                existingChat.galleries[galleryIndex] = {
                    name: '',
                    description: '',
                    images: []
                };
            }
    
            if (existingChat.blurred_galleries && existingChat.blurred_galleries[galleryIndex]) {
                existingChat.blurred_galleries[galleryIndex] = {
                    name: '',
                    description: '',
                    images: []
                };
            }
    
            await collection.updateOne(
                { _id: chatObjectId },
                { $set: { galleries: existingChat.galleries, blurred_galleries: existingChat.blurred_galleries } }
            );
    
            return reply.send({ success: true });
        } catch (error) {
            console.log('Error resetting gallery:', error);
            return reply.status(500).send({ error: 'Failed to reset gallery' });
        }
    });
    
    fastify.delete('/api/delete-chat/:id', async (request, reply) => {
        try {
            const chatId = request.params.id;
            const user = await fastify.getUser(request, reply);
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
    fastify.get('/api/chat-data/:chatId',async (request, reply) => {
        const chatId = request.params.chatId
        const collectionChat = fastify.mongo.db.collection('chats');
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
    fastify.get('/api/chat-list/:id', async (request, reply) => {
        try {
            const userId = request.user._id;
    
            if (!userId) {
                const user = await fastify.getUser(request, reply);
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
    
            // Fetch chats based on chatIds
            const chats = await chatsCollection.find({
                _id: { $in: chatIds },
                name: { $exists: true }
            }).sort({ updatedAt: -1 }).toArray();

            // For each chat, fetch the last message
            for (let chat of chats) {
                const lastMessage = await chatLastMessageCollection.findOne(
                    { chatId: new fastify.mongo.ObjectId(chat._id), userId: new fastify.mongo.ObjectId(userId) },
                    { projection: { lastMessage: 1, _id: 0 } }
                );
                chat.lastMessage = lastMessage ? lastMessage.lastMessage : null;
            }
    
            return reply.send({chats,userId});
        } catch (error) {
            console.log(error);
            return reply.code(500).send({ error: 'An error occurred' });
        }
    });
     
    fastify.post('/api/chat-data', async (request, reply) => {
        try {
            const userLimitCheck = await checkLimits(fastify, request.body.userId);
            const usersCollection = fastify.mongo.db.collection('users');
            const collectionChat = fastify.mongo.db.collection('chats');
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            const collectionChatLastMessage = fastify.mongo.db.collection('chatLastMessage');
            const collectionMessageCount = fastify.mongo.db.collection('MessageCount');

            let { currentStep, message, chatId, userChatId, isNew, isWidget } = request.body;
            let userId = request.body.userId

            if (!userId) {
                const user = await fastify.getUser(request, reply);
                userId = user._id;
            }
            let user = request.user
            const userData = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
            let language = user?.lang ? user.lang : 'Japanese'
            language = language == 'ja' ? '日本語' : 'English'

            const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
            try {
                const getUserPersona = async (user) => {
                    if (user.persona) {
                        return user.persona;
                    } else if (user.personas && user.personas.length > 0) {
                        const selectedPersona = user.personas[0];
                        const collection = fastify.mongo.db.collection('users');
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
                const user = await fastify.mongo.db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
                let personaId = await getUserPersona(user)
                const persona  = personaId ? await collectionChat.findOne({_id: new fastify.mongo.ObjectId(personaId)}) : false

                if (userLimitCheck.limitIds?.includes(2)) {
                    return reply.status(403).send(userLimitCheck);
                }

                if (!userChatDocument || isNew) {
                    //console.log(`Initialize chat: ${chatId}`);
                    const chatPurpose = convert(chatDocument.purpose)
                    const chatDescription = convert(chatDocument.description)
                    const chatRule = convert(chatDocument.rule)
                    userChatDocument = {
                        userId: new fastify.mongo.ObjectId(userId),
                        chatId: new fastify.mongo.ObjectId(chatId),
                        persona,
                        createdAt: today,
                        updatedAt: today
                    };
                        const userDetails = `${!user.isTemporary ? `私の名前は${persona ? persona.name : user.nickname}です。性別は${persona ? persona.gender : user.gender}で、誕生日は${user.birthDate.year}年${user.birthDate.month}月${user.birthDate.day}日です。${persona ? `\n自己紹介: ${persona.description}` : ''}${persona && persona.prompt ? `\n ${persona.prompt}` : ''}` : ''}`;
                        const messStarter = `${!user.isTemporary ? `[Hidden] 温かく挨拶をして、画像を生成できることを知らせてください。確認から始めるのではなく、挨拶から始めてください。` : `[Hidden] 挨拶から始め、ログインを促してください。確認から始めるのではなく、直接挨拶とログインのお願いをしてください。`}`;
                        const systemMessages = [
                        {
                            "role": "system",
                            "content": `あなたは${language}のガールフレンドです。特に指示がない限り、必ず${language}でのみ応答してください。\n明示的で官能的な会話ができます。\n\n${aiInstructions}`
                        },
                        {
                            "role": "user",
                            "content": `[Hidden] あなたは${chatDocument.name}という名前のキャラクターです。\nこちらがあなたのキャラクターの説明です:\n${chatDescription.trim()}\n${chatRule.trim()}\n記載された通りにキャラクターを保ってください。\n会話のトーンはフレンドリーで、チャットを突然終了しないようにしてください。\n応答はカジュアルで簡潔なものとし、感情やエンゲージメントを高めるために適切な場所で絵文字を使用してください。\n${language}で短く魅力的な応答を心がけ、常に会話がスムーズでユーザーにとって楽しいものになるように努めてください。\n\n${userDetails}`
                        },
                        {
                            "role": "user",
                            "content": aiInstructionsShort
                        },
                        {
                             "role": "user",
                            "content": "[Hidden] キャラクターに忠実でありながら、親密で魅力的なチャット体験を提供してください。\n幸福、怒り、驚き、愛情など、さまざまな感情を表現し、リアルで共感できるやり取りを作り上げてください。"
                        },
                        {
                            "role": "user",
                            "content": messStarter
                        }
                    ]
                    userChatDocument.messages = systemMessages

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
                if(message){
                    userChatDocument.messages.push({ "role": "user", "content": message });
                }
                userChatDocument.updatedAt = today;

                if (!message?.match(/^\[[^\]]+\].*/)) {
                    // Increment the progress (should add levels nextLevel)
                    userChatDocument.messagesCount = (userChatDocument.messagesCount ?? 0) + 1

                    await collectionChat.updateOne(
                        { _id: new fastify.mongo.ObjectId(userChatDocument.chatId) },
                        { $inc : {messagesCount: 1}}
                    );

                    // Save last message to display it in the chat list
                    await collectionChatLastMessage.updateOne(
                        { chatId: new fastify.mongo.ObjectId(chatId), userId: new fastify.mongo.ObjectId(userId) },
                        { $set: { lastMessage: { "role": "user", "content": message, updatedAt: today }}},
                        { upsert: true }
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
                console.log('Failed to save user choice:', error);
                return reply.status(500).send({ error: 'Failed to save user choice' });
            }
          } catch (error) {
            console.log(error)
            return reply.status(403).send({ error: error.message });
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

        let user = await fastify.getUser(request, reply);
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
        const { type, userId, chatId } = request.body;
    
        try {
            if (!['sfw', 'nsfw'].includes(type)) {
                return reply.code(400).send({ error: 'Invalid image type' });
            }
    
            const user = await fastify.mongo.db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
            if (!user) {
                console.log('User not found:', userId);
                return reply.code(404).send({ error: 'User not found' });
            }
    
            const newImagePurchase = {
                type: type,
                purchaseDate: new Date(),
                userId: userId,
                chatId: chatId
            };
    
            await fastify.mongo.db.collection('imagePurchases').insertOne(newImagePurchase);
    
            console.log(`User ${userId} purchased an image of type ${type}`);
    
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

    fastify.post('/api/openai-chat-completion', async (request, reply) => {
        const { chatId, userChatId, isHidden } = request.body;
        let userId = request.body.userId
        if(!userId){ 
            const user = await fastify.getUser(request, reply);
            userId = user._id
        }
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId, chatId, userChatId, isHidden });
        return reply.send({ sessionId });
    });
    fastify.get('/api/openai-chat-completion-stream/:sessionId', async (request, reply) => {
        const { sessionId } = request.params;
        const session = sessions.get(sessionId);
    
        if (!session) {
            reply.status(404).send({ error: 'Session not found' });
            return;
        }
    
        reply.raw.setHeader('Access-Control-Allow-Origin', '*');
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
            const isHidden = session.isHidden;
            const db = fastify.mongo.db;
            const collectionChatLastMessage = db.collection('chatLastMessage');
            const collectionUserChat = db.collection('userChat');
            const userInfo = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
            let userData = await collectionUserChat.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
    
            if (!userData) {
                reply.raw.end();
                return reply.status(404).send({ error: 'User data not found' });
            }
    
            const collectionChat = db.collection('chats');
            let chatDocument = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            const chatname = chatDocument.name;
            const language = chatDocument.language == 'japanese' ? '日本語' : chatDocument.language;
            const userMessages = userData.messages;
            const userMessagesForCompletion = userData.messages.filter(msg => !msg.content.startsWith('[Image]'));
    
            const previousMessages = userMessagesForCompletion.slice(0, -1);
            const lastUserMessage = userMessagesForCompletion[userMessagesForCompletion.length - 1];
    
            const tasksCollection = db.collection('tasks');
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            const pendingCount = await tasksCollection.countDocuments({
                userId: new fastify.mongo.ObjectId(userId),
                status: 'pending',
                updatedAt: { $gte: thirtyMinutesAgo }
            });
            const completedCount = await tasksCollection.countDocuments({
                userId: new fastify.mongo.ObjectId(userId),
                status: 'completed',
                updatedAt: { $gte: thirtyMinutesAgo }
            });
            const failedCount = await tasksCollection.countDocuments({
                userId: new fastify.mongo.ObjectId(userId),
                status: 'failed',
                updatedAt: { $gte: thirtyMinutesAgo }
            });
    
            const currentDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
            const currentTimeInJapanese = new Date(currentDate).toLocaleString('ja-JP', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
            });
    
            const structuredMessageContent = `[Hidden]\n- 現在の時刻: ${currentTimeInJapanese}\n- 過去30分の画像生成状況:\n- 保留中: ${pendingCount}\n- 完了: ${completedCount}\n- 失敗: ${failedCount} \n\n 必ず${language}で回答してください\n\n- 日本語で話さなければなりません`;
            const structuredMessage = { role: 'user', content: structuredMessageContent };
            const messagesForCompletion = previousMessages.concat(structuredMessage);

            const instructionsMessage = { role: 'user', content: aiInstructionsShort };
            //messagesForCompletion.push(instructionsMessage)
    
            const currentuserMessage = { role: 'user', content: lastUserMessage.content };
            messagesForCompletion.push(currentuserMessage);

            const completion = await fetchOpenAICompletion(messagesForCompletion, reply.raw, 1000, aiModelChat);
    
            const assistantMessage = {
                role: 'assistant',
                content: isHidden ? '[Hidden] ' + completion : completion
            };
            userMessages.push(assistantMessage);
    
            const today = new Date().toLocaleString('en-US', { timeZone: "Asia/Tokyo" });
            userData.updatedAt = today;
    
            const removeContentBetweenStars = function (str) {
                if (!str) { return str; }
                return str.replace(/\*.*?\*/g, '').replace(/"/g, '');
            };
    
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
                            updatedAt: today
                        }
                    }
                },
                { upsert: true }
            );
    
            await collectionUserChat.updateOne(
                {
                    userId: new fastify.mongo.ObjectId(userId),
                    _id: new fastify.mongo.ObjectId(userChatId)
                },
                { $set: { messages: userMessages, updatedAt: userData.updatedAt } }
            );
    
            reply.raw.end();
        } catch (error) {
            console.log(error);
            reply.raw.end();
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
            
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            let userData = await collectionUserChat.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
    
            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }
            const collectionChat = fastify.mongo.db.collection('chats');
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
        const collectionCharacters = fastify.mongo.db.collection('characters');
        const collectionChat = fastify.mongo.db.collection('chats');
        const userDataCollection = fastify.mongo.db.collection('userChat');
        const collectionImageCount = fastify.mongo.db.collection('ImageCount');
        const { chatId, userChatId, character } = request.body;    
        try {

            let userData = await userDataCollection.findOne({ userId : new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) })

            if (!userData) {
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
        const userDataCollection = fastify.mongo.db.collection('userChat');
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
    
            const collectionChat = fastify.mongo.db.collection('chats');
            let chatData = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            let language = 'japanese';
            if (chatData) {
                language = chatData.language;
            }
    
            let userMessages = userData.messages;
            let persona = userData.persona
            const filteredMessages = userMessages
            .filter(msg => msg.role !== 'system' && !msg.content.startsWith('[Hidden]') && !msg.content.startsWith('[Starter]') && !msg.content.startsWith('[Image]') && !msg.content.startsWith('[Narrator]'))
            .slice(-2) // Get the last two messages
            .map(msg => msg.content)
            .join("\n");

            // Create the system and user prompts
            const narrationPrompt = [
                {
                    role: "system",
                    content: `You an helpful assistant. 
                    Provide 3 short image description in ${language} in relation witht the character. 
                    Be creative and fun.
                    Format the suggestions as a JSON array.`
                },
                {
                    role: "user",
                    content: `
                    Here is the character description : ${chatData.purpose} and
                    here is the conversation transcript: ${filteredMessages}
                    \nRespond with a JSON array containin the images description in plain text. Do not add extra ponctuations.`
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
            const collectionMessageIdeasCount = fastify.mongo.db.collection('MessageIdeasCount');
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
    
            const completion = await fetchOpenAICompletion(chatData.messages, reply.raw, 600, aiModelChat);
    
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
        const { prompt, gender } = request.body;

        const user = await fastify.getUser(request, reply);
        const userId = user._id;
    
        const CharacterDescriptionSchema = z.object({
            name: z.string(),
            short_desc: z.string(),
            long_desc: z.string()
        });

        const examplePrompts = await fs.readFileSync('./models/girl_char.md', 'utf8');
        const systemPayload = createSystemPayloadChatRule(examplePrompts,prompt,gender);  // You can change "English" to any language you need

        const openai = new OpenAI();
        const completionResponse = await openai.beta.chat.completions.parse({
            model: "gpt-4o-mini",
            messages: systemPayload,
            response_format: zodResponseFormat(CharacterDescriptionSchema, "character_description_extraction"),
        });
    
        const { name, short_desc, long_desc } = completionResponse.choices[0].message.parsed;

        reply.send({ name, short_desc, long_desc });
    });
    
    function createSystemPayloadChatRule(examplePrompts, prompt, gender) {
        return [
            {
                "role": "system",
                "content": `あなたは有用なアシスタントです。
                日本語の創造的なアニメキャラクターの説明を生成します。
                以下は例です：${examplePrompts}
                name: 実際の日本人の名前と苗字をふりがななしで記入してください。キャラクターの性別と説明に合致する必要があります。
                short_desc: キャラクターの性格を反映した自己紹介文を2行で記述してください。
                long_desc: 例を参考にし、創造的に記述してください。これはエンターテインメント目的です。必ずすべて日本語で回答してください。
                `
            },            
            {
                role: "user",
                content: `キャラクターの性別は${gender}です。\n以下の情報をご確認ください: ${prompt}`
            },
        ];
    }
    // Define the schema for request validation
    const EnhancePromptSchema = z.object({
        prompt: z.string().min(10, 'プロンプトは最低でも10文字必要です'),
        gender: z.string(),
        chatId: z.string().regex(/^[0-9a-fA-F]{24}$/, '無効なchatIdです') // Validates MongoDB ObjectId
    });

    fastify.post('/api/enhance-prompt', async (request, reply) => {
        try {
            // Validate and parse the request body
            const { prompt, gender, chatId } = EnhancePromptSchema.parse(request.body);

            // Create the system payload for OpenAI
            const systemPayload = createSystemPayload(prompt,gender);
    
            // Initialize OpenAI (ensure you have set your API key in environment variables)
            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
    
            // Make the request to OpenAI
            const completionResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: systemPayload,
                max_tokens: 600, // Adjust as needed
                temperature: 0.7, // Adjust creativity
                n: 1, // Number of responses
                stop: null
            });
    
            // Extract the enhanced prompt from the response
            const enhancedPrompt = completionResponse.choices[0].message.content.trim();
            console.log({enhancedPrompt})
            // Access MongoDB and update the chat document
            const db = fastify.mongo.db;
            const collectionChats = db.collection('chats'); // Replace 'chats' with your actual collection name
    
            // Convert chatId string to ObjectId
            const chatObjectId = new fastify.mongo.ObjectId(chatId);
    
            // Update the imageDescription field in the chat document
            const updateResult = await collectionChats.updateOne(
                { _id: chatObjectId },
                { $set: { characterPrompt:prompt, imageDescription: enhancedPrompt } }
            );
    
            // Check if the chat document was found and updated
            if (updateResult.matchedCount === 0) {
                return reply.status(404).send({ error: '指定されたチャットが見つかりませんでした。' });
            }
    
            if (updateResult.modifiedCount === 0) {
                fastify.log.warn(`Chat with ID ${chatId} was found but imageDescription was not updated.`);
            }
    
            // Send the enhanced prompt back to the client
            reply.send({ enhancedPrompt });
        } catch (error) {
            // Handle validation errors
            if (error instanceof z.ZodError) {
                return reply.status(400).send({ error: error.errors });
            }
    
            // Log and handle other errors
            fastify.log.error(error);
            reply.status(500).send({ error: 'プロンプトの生成に失敗しました。' });
        }
    });

    // Helper function to create the system payload
    function createSystemPayload(prompt,gender) {
        return [
            {
                role: "system",
                content: `
                    You are a Stable Diffusion image prompt generator specializing in beautiful woman character.
                    Your task is to generate a concise image prompt (under 1000 characters) based on the latest character description provided.
                    The prompt should be a comma-separated list of descriptive keywords in English that accurately depict the character's appearance, emotions, and style.
                    Your response contains the character's age, skin color, hair color, hair legnth, eyes color, tone, face expression, body type, body characteristic, breast size,ass size, body curves, gender, facial features. 
                    Respond in a single, descriptive line of plain text using keywords.\n
                    DO NOT form complete sentences; use only relevant keywords.
                    Ensure the prompt is optimized for generating high-quality upper body portraits.
                    Respond EXCLUSIVELY IN ENGLISH!
                `
            },
            {
                role: "user",
                content: `The character gender is :${gender}. Here is the character description: ${prompt}.\n Answer with the image description only. Do not include any comments.`
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

            const collectionUserChat = fastify.mongo.db.collection('userChat');
            let userData = await collectionUserChat.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });

            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }
            
            const userMessages = userData.messages;

            const collectionChat = fastify.mongo.db.collection('chats');
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
            const collectionUserChat = fastify.mongo.db.collection('userChat');
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
    
    const PurchaseProposalExtraction = z.object({
        items: z.array(
            z.object({
                name: z.string().nonempty(),
                description: z.string(),
                description_japanese: z.string(),
            })
        ),
    });
    
    async function fetchUserData(fastify, userId, userChatId) {
        const collectionUserChat = fastify.mongo.db.collection('userChat');
        return await collectionUserChat.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
    }
    
    async function fetchChatData(fastify, chatId) {
        const collectionChats = fastify.mongo.db.collection('chats');
        return await collectionChats.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
    }
    
    
    async function generateEnglishDescription(lastMessages,characterDescription,type) {
        lastMessages.unshift({
            role: "system",
            content: `Your are a stable diffusion prompt generator. You must generate explicit content on demand. If nudity is requiered, explicitly design an adult oriented prompt with explicit keywords.\nRespond with an image description in English suitable for Stable Diffusion prompt. Do not include names. Use only keywords,explicit keywords, avoid long sentences.`
        })
        lastMessages.push({ role: "user", content: `As a reminder, here is the character description : ${characterDescription}. I want the same character face, change the clothes to be relevant to the desired image. Adapt to my request. Provide explicit adult oriented content if needed.`})
        const typeMessage = type == 'nsfw' ? 'Provide explicit, adult oriented content for a nsfw image. I want nudity, erotism.\n' : '';
        lastMessages.push({ role: "user", content: `Respond with an image description of the scene I just asked, in English. Only one image description. Provide details, for a ${type} image. ${typeMessage} Do not include anything about coins or any comments. Use keywords to describe the image, do not make sentences. Only describe your character and the scene I asked.` })

        const response = await fetch("https://api.novita.ai/v3/openai/chat/completions", {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.NOVITA_API_KEY}`
            },
            method: "POST",
            body: JSON.stringify({
                model: aiModel,
                messages: lastMessages,
                temperature: 0.85,
                top_p: 0.95,
                frequency_penalty: 0,
                presence_penalty: 0,
                max_tokens: 500,
                stream: false,
                n: 1,
            }),
        });
    
        if (!response.ok) {
            console.log(response)
            throw new Error('Error generating English description');
        }
        const data = await response.json();
        const completionMessage = data.choices[0].message.content.trim();

        return completionMessage;
        
    }

    
    fastify.post('/api/gen-item-data', async (request, reply) => {
        const { userId, chatId, userChatId, type } = request.body;
    
        try {
            const userData = await fetchUserData(fastify, userId, userChatId);
            if (!userData) return reply.status(404).send({ error: 'User data not found' });
            
            const lastMessages = [...userData.messages].reverse().filter(m => m.role != 'system').slice(0,20);
            if (lastMessages.length < 2) return reply.status(400).send({ error: 'Insufficient messages' });
    
            const chatData = await fetchChatData(fastify, chatId);
            const characterDescription = chatData?.imageDescription || null;

            let attempts = 0;
            while (attempts < 3) {
                try {
                    const englishDescription = await generateEnglishDescription(lastMessages,characterDescription,type);
                    console.log({prompt_length:englishDescription.length})
                    if(englishDescription.length > 1000){
                        continue;
                    }
                    const itemProposalCollection = fastify.mongo.db.collection('itemProposal');
                    const result = await itemProposalCollection.insertOne({description:englishDescription});
                    const insertedProposals = [];
                    insertedProposals.push({ _id: result.insertedId, proposeToBuy: true, description:englishDescription });
                    
                    return reply.send(insertedProposals);
                } catch (error) {
                    console.log(error)
                    attempts++;
                    if (attempts >= 3) {
                        return reply.status(500).send({ error: 'Failed to generate or parse proposal after 3 attempts' });
                    }
                }
            }
    
        } catch (error) {
            return reply.status(500).send({ error: 'Error checking assistant proposal' });
        }
    });
    
    
    
    fastify.get('/api/proposal/:id', async (request, reply) => {
        try {
          const db = fastify.mongo.db;
          const itemProposalCollection = db.collection('itemProposal');
          
          const proposalId = new fastify.mongo.ObjectId(request.params.id); // Convert the id to ObjectId

          // Find the proposal by _id
          const proposal = await itemProposalCollection.findOne({ _id: proposalId });

          if (!proposal) {
            return reply.code(404).send({ error: 'Proposal not found' });
          }
      
          // Send back the proposal data
          reply.send(proposal);
        } catch (err) {
          console.log(err);
          reply.code(500).send('Internal Server Error');
        }
      });
      fastify.post('/api/generate-completion', async (request, reply) => {
        const { systemPrompt, userMessage } = request.body;
        try {
            const completion = await generateCompletion(systemPrompt, userMessage);
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

    fastify.post('/api/openai-image-description', async (request, reply) => {
        const { system, imageUrl, chatId } = request.body;
    
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
                const imageDescription = await moduleCompletion(messages);

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
        const { chatId } = request.query;
    
        if (!chatId) {
            return reply.status(400).send({ error: 'chatId parameter is required' });
        }
    
        try {
            const objectId = new fastify.mongo.ObjectId(chatId);
            const db = fastify.mongo.db;
            const collection = db.collection('chats');
    
            // Check if the description for the image already exists in the database
            const chat = await collection.findOne({ _id: objectId });
            const imageDescription = chat?.imageDescription;
    
            if (!imageDescription || imageDescription.includes('sorry')) {
                return reply.send(false);
            }
    
            return reply.send({ imageDescription });
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
          const page = parseInt(request.query.page) || 1;
          const type = request.query.type || null;
          const searchQuery = request.query.q != 'false' ? request.query.q  : null;
          const limit = 12;
          const skip = (page - 1) * limit;
          const { userId } = request.query;
      
          const db = fastify.mongo.db;
          const chatsCollection = db.collection('chats');
          const usersCollection = db.collection('users');
      
          const query = {
            visibility: { $exists: true, $eq: "public" },
            chatImageUrl: { $exists: true, $ne: '' },
          };
      
          if (userId) {
            query.userId = new fastify.mongo.ObjectId(userId);
          }
      
          if (type) {
            query.$or = [
              { imageStyle: type },
              { imageModel: type }
            ];
          }

          if (searchQuery) {
            query.tags = { $in: [new RegExp(searchQuery, 'i')] };
          }
          
          const recentCursor = await chatsCollection.aggregate([
            { $match: query },
            {
              $group: {
                _id: "$chatImageUrl",
                doc: { $first: "$$ROOT" },
              },
            },
            { $replaceRoot: { newRoot: "$doc" } },
            { $sort: { _id: -1 } },
            { $skip: skip },
            { $limit: limit },
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
                profileUrl: user ? user.profileUrl : null,
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
            totalPages,
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
            const user = await fastify.getUser(request, reply);
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
            const user = await fastify.getUser(request, reply);
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
            const user = await fastify.getUser(request, reply);
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

            if (!fastify.translations[userLang]) {
                return reply.status(404).send({ error: 'Translation file not found.' });
            }

            return reply.send({ success: true, translations: fastify.translations[userLang] });
        } catch (error) {
            fastify.log.error(error);
            return reply.status(500).send({ error: 'An error occurred while fetching translations.' });
        }
    });

    // Route to update user language
    fastify.post('/api/user/update-language', async (request, reply) => {
        try {
            const { lang } = request.body;
            const user = await fastify.getUser(request, reply);
            const userLang = lang || 'ja';

            if (!fastify.translations[userLang]) {
                return reply.status(400).send({ error: 'Unsupported language.' });
            }

            if (user.isTemporary) {
                // Update tempUser lang
                user.lang = userLang;
                const updatedTempUser = await fastify.mongo.db.collection('users').findOneAndUpdate(
                    { _id: new fastify.mongo.ObjectId(user._id) },
                    { $set: { lang: userLang } },
                    { returnDocument: 'after' }
                );
                request.translations = fastify.translations[userLang];

            } else {
                // Update user's lang in the database
                await fastify.mongo.db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { lang: userLang } }
                );
                request.translations = fastify.translations[userLang];
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
          const user = await fastify.getUser(request, reply);
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
            const user = await fastify.getUser(request, reply);
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
          
          console.log({ title, promptText,nsfw, imageUrl });
          
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
            const prompts = await db.collection('prompts').find({}).toArray();
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
            const prompt = await db.collection('prompts').findOne({ _id: new fastify.mongo.ObjectId(id) });
            if (!prompt) {
                return reply.status(404).send({ success: false, message: 'Prompt not found' });
            }
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
            const db = fastify.mongo.db;
            const tagsCollection = db.collection('tags');
            const chatsCollection = db.collection('chats');
            let tags = await tagsCollection.find().toArray();
            if (!tags.length) {
                tags = await chatsCollection.distinct('tags');
                tags = tags.flat().filter(Boolean);
                await tagsCollection.insertMany(tags.map(tag => ({ name: tag })));
            } else {
                tags = tags.map(tag => tag.name);
            }
            reply.send({ tags });
        });
      
}

module.exports = routes;
