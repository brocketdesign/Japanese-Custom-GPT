const { ObjectId } = require('mongodb');
const {moduleCompletion,fetchOpenAICompletion, fetchOpenAINarration} = require('../models/openai')
const crypto = require('crypto');
const aws = require('aws-sdk');
const sessions = new Map(); // Define sessions map
const { analyzeScreenshot, processURL } = require('../models/scrap');
const { createHash } = require('crypto');
const { convert } = require('html-to-text');

async function routes(fastify, options) {

    // Configure AWS S3
    const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    });

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


    fastify.post('/api/add-chat', async (request, reply) => {
        const parts = request.parts();
        let chatData = {};
        const user = await fastify.getUser(request, reply);
        const userId = new fastify.mongo.ObjectId(user._id);

        const uploadToS3 = async (buffer, hash, filename) => {
            const params = {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: `${hash}_${filename}`,
                Body: buffer,
                ACL: 'public-read'
            };
            const uploadResult = await s3.upload(params).promise();
            return uploadResult.Location;
        };

        const handleFileUpload = async (part) => {
            const chunks = [];
            for await (const chunk of part.file) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const hash = createHash('md5').update(buffer).digest('hex');
            const existingFiles = await s3.listObjectsV2({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Prefix: hash,
            }).promise();
            if (existingFiles.Contents.length > 0) {
                return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
            } else {
                return uploadToS3(buffer, hash, part.filename);
            }
        };

        for await (const part of parts) {
            switch (part.fieldname) {
                case 'name':
                case 'purpose':
                case 'language':
                case 'chatImageUrl':
                case 'visibility':
                case 'category':
                case 'rule':
                case 'url':
                case 'description':
                case 'chatId':
                    chatData[part.fieldname] = part.value;
                    break;
                case 'content':
                    chatData.content = JSON.parse(part.value);
                    break;
                case 'thumbnail':
                    chatData.thumbnailUrl = await handleFileUpload(part);
                    break;
                case 'pdf':
                    chatData.pdfUrl = await handleFileUpload(part);
                    break;
            }
        }

        if (!chatData.name || !chatData.content) {
            return reply.status(400).send({ error: 'Missing name or content for the chat' });
        }

        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        const options = { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false };
        chatData.updatedAt = new Date(dateObj);
        chatData.dateStrJP = new Date(dateObj).toLocaleDateString('ja-JP', options);

        try {
            const existingChat = await collection.findOne({ _id: new fastify.mongo.ObjectId(chatData.chatId) });
            if (!existingChat) {
                return reply.status(404).send({ error: 'Chat not found' });
            }
            if (existingChat.userId.toString() == userId.toString()) {
                await collection.updateOne({ _id: new fastify.mongo.ObjectId(chatData.chatId) }, { $set: chatData });
                return reply.send({ message: 'Chat updated successfully', chatId: chatData.chatId });
            } else {
                chatData.userId = userId;
                chatData.createdAt = new Date(dateObj);
                const result = await collection.insertOne(chatData);
                console.log('New Chat added:', result.insertedId);
                return reply.send({ message: 'Chat added successfully', chatId: result.insertedId });
            }
        } catch (error) {
            console.error('Failed to add or update the Chat:', error);
            return reply.status(500).send({ error: 'Failed to add or update the Chat' });
        }
    });

    fastify.delete('/api/delete-chat/:id', async (request, reply) => {
        try {
            const chatId = request.params.id;
            const user = await fastify.getUser(request, reply);
            const userId = new fastify.mongo.ObjectId(user._id);

            // Access the MongoDB collection
            const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const story = await chatCollection.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
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
            return reply.send(response);
        } catch (error) {
            console.error('Failed to retrieve chat:', error);
            return reply.status(500).send({ error: 'Failed to retrieve chat' });
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
        
            const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const isUserChat = await chatsCollection.findOne({ 
                $or: [
                    { userId },
                    { userId: new fastify.mongo.ObjectId(userId) }
                ],
                 _id: new fastify.mongo.ObjectId(chatId) 
            });    
            
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        
            let userChat;
            if (isUserChat) {
                userChat = await collectionUserChat.find({ 
                    $and: [
                      { $or: [
                        { chatId },
                        { chatId: new fastify.mongo.ObjectId(chatId) },
                      ]},
                      { $expr: { $gte: [ { $size: "$messages" }, 2 ] } }
                    ]
                  }).sort({ _id: -1 }).toArray();
                //Check for other derivate
                /*
                const collectionUser = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
                const derivedChats = await collectionUser.find({
                    $or: [
                        { baseId : chatId },
                        { baseId: new fastify.mongo.ObjectId(chatId) },
                        { name: isUserChat.name}
                    ]
                })
                .project({ _id: 1 }) // extract only the _id field
                .sort({ _id: -1 })
                .toArray();
                const chatIds = derivedChats.map(chat => chat._id);
                const userChats = await collectionUserChat.find({ chatId: { $in: chatIds } }).toArray();
                console.log(userChats)
                */
            } else {
                userChat = await collectionUserChat.find({
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
                    ]
                    
                  }).sort({ _id: -1 }).toArray();
            }
        
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
    fastify.get('/api/story/:id', async (request, reply) => {
        const storyId = request.params.id;
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('stories');
    
        try {
            const story = await collection.findOne({ _id: new fastify.mongo.ObjectId(storyId) });
            if (!story) {
                return reply.status(404).send({ error: 'Story not found' });
            }
            reply.send(story);
        } catch (error) {
            console.error('Failed to retrieve chat:', error);
            reply.status(500).send({ error: 'Failed to retrieve Story' });
        }
    });
    fastify.post('/api/set-story', async (request, reply) => {
        const storyId = request.body.storyId;

        if (!storyId) {
            return reply.status(400).send({ error: 'Story ID is required' });
        }

        const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
        const activeStoryCollection = db.collection('activeStory');
        const storiesCollection = db.collection('stories');

        try {
            // Convert storyId to ObjectId
            const objectId = new fastify.mongo.ObjectId(storyId);

            // Find the story with the given _id
            const story = await storiesCollection.findOne({ _id: objectId });

            if (!story) {
            return reply.status(404).send({ error: 'Story not found' });
            }

            // Remove any existing active story in the activeStory collection
            await activeStoryCollection.deleteMany({});

            // Set the new active story in the activeStory collection
            await activeStoryCollection.insertOne({ storyId });

            // Set isActive to true for the selected story and false for all others
            await storiesCollection.updateOne({ _id: objectId }, { $set: { isActive: true } });
            await storiesCollection.updateMany({ _id: { $ne: objectId } }, { $set: { isActive: false } });

            reply.send({ message: 'Story activated successfully', storyId });
        } catch (err) {
            request.log.error(err);
            reply.status(500).send({ error: 'An error occurred while setting the active story' });
        }
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
    async function checkLimits(userId) {
        const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
    
        // Get the user's data
        const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
        const user = await userDataCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
      
        // Get the message count and chat count
        const messageCountCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('MessageCount');
        const messageCountDoc = await messageCountCollection.findOne({ userId: new fastify.mongo.ObjectId(userId), date: today });
    
        const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const chatCount = await chatCollection.countDocuments({ userId: new fastify.mongo.ObjectId(userId) });
      
        // Get the image count
        const imageCountCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('ImageCount');
        const imageCountDoc = await imageCountCollection.findOne({ userId: new fastify.mongo.ObjectId(userId), date: today });
    
        // Check the limits
        const isTemporary = user.isTemporary;
        let messageLimit = isTemporary ? 10 : 50;
        let chatLimit = isTemporary ? 1 : 3;
        let imageLimit = isTemporary ? 1 : 3;
    
        if (!isTemporary) {
            existingSubscription = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').findOne({
                _id: new fastify.mongo.ObjectId(userId),
                subscriptionStatus: 'active',
            });
            
            if (existingSubscription) {
                const billingCycle = existingSubscription.billingCycle + 'ly';
                const currentPlanId = existingSubscription.currentPlanId;
                const plansFromDb = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('plans').findOne();
                const plans = plansFromDb.plans;
                const plan = plans.find((plan) => plan[`${billingCycle}_id`] === currentPlanId);
                messageLimit = plan.messageLimit || messageLimit;
                chatLimit = plan.chatLimit || chatLimit;
                imageLimit = plan.imageLimit || imageLimit;
            }
        }
      
        if (messageCountDoc && messageCountDoc.count >= messageLimit) {
            return { error: 'Message limit reached for today.', id: 1, messageCountDoc, chatCount, imageCountDoc, messageLimit, chatLimit, imageLimit };
        } 
        /*
        if (chatCount >= chatLimit) {
            return { error: 'Chat limit reached.', id: 2, messageCountDoc, chatCount, imageCountDoc, messageLimit, chatLimit, imageLimit };
        }
        */
        if (imageCountDoc && imageCountDoc.count >= imageLimit) {
            return { error: 'Image generation limit reached for today.', id: 3, messageCountDoc, chatCount, imageCountDoc, messageLimit, chatLimit, imageLimit };
        }
        
        return { messageCountDoc, chatCount, imageCountDoc, messageLimit, chatLimit, imageLimit };
    }
    
    fastify.post('/api/chat-data', async (request, reply) => {
        try {
            const userLimitCheck = await checkLimits(request.body.userId);
            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            const collectionMessageCount = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('MessageCount');

            let { currentStep, message, chatId, userChatId, isNew, isWidget } = request.body;
            //console.log(`data for chat : ${chatId} userchat : ${userChatId}`)
            let userId = request.body.userId
            if (!userId) {
                const user = await fastify.getUser(request, reply);
                userId = user._id;
            }
            const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
            try {
                // Find or create the chat document
                let userChatDocument = await collectionUserChat.findOne({ userId : new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
                let chatDocument = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
                const isUserChat = await collectionChat.findOne({ userId: new fastify.mongo.ObjectId(userId) , _id: new fastify.mongo.ObjectId(chatId) });
                
                if(!isUserChat){
                    if (userLimitCheck.id === 2) {
                        //return reply.status(403).send(userLimitCheck);
                    }
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
                            visibility: 'private',
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
                        messages: [
                            { "role": "system", "content": `You are a real character, your name is ${chatDocument.name}. You act as natural as possible. Your answers ar short, it is a chat.I will provide the character description. You are not omniscient. Always stay in your role. Do not answer with lists unless specifically requested. This is a casual chat, so use short messages and emojis. Communicate naturally in ${chatDocument.language}.` 
                            },
                            { "role": "user", "content": `Here is your character description :\n\n${chatPurpose}\n${chatDescription}\n${chatRule}\n\n`
                            },
                        ],
                        createdAt: today,
                        updatedAt: today
                    };
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
                if (userLimitCheck.id === 1) {
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
                return reply.send({ nextStoryPart: "You chose the path and...", endOfStory: true, userChatId: documentId, chatId, messageCountDoc:newMessageCount});
            } catch (error) {
                console.error('Failed to save user choice:', error);
                return reply.status(500).send({ error: 'Failed to save user choice' });
            }
          } catch (error) {
            return reply.status(403).send({ error: error.message });
          }
        
    });
    
    fastify.post('/api/custom-data', async (request, reply) => {
        const { userId, customData } = request.body;
    
        const serverUserId = parseInt(userId) || 'user_' + Date.now();
        
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
    
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        customData.date = dateObj
        const query = { userId: serverUserId };
        
        try {
            const userData = await collection.findOne(query);
            
            if (userData) {
                // Check if the action already exists
                const existingActionIndex = userData.customData.findIndex(data => data && data.action === customData.action);
    
                if (existingActionIndex !== -1) {
                    // Update the existing action
                    userData.customData[existingActionIndex] = customData;
                } else {
                    // Add the new action
                    userData.customData.push(customData);
                }
    
                // Remove duplicate actions if any (only the first occurrence should remain)
                const uniqueActions = [];
                userData.customData = userData.customData.filter(data => {
                    if (data === null) return false;
                    const isDuplicate = uniqueActions.includes(data.action);
                    if (!isDuplicate) uniqueActions.push(data.action);
                    return !isDuplicate;
                });                
    
                await collection.updateOne(query, { $set: { customData: userData.customData } });
            } else {
                // Insert new user data if it doesn't exist
                const update = {
                    $push: { customData: customData },
                    $setOnInsert: { userId: serverUserId, createdAt: dateObj }
                };
                const options = { upsert: true };
                await collection.updateOne(query, update, options);
            }
    
            //console.log('User data updated:', { userId: serverUserId, customData, createdAt: dateObj });
            //const newUuserData = await collection.findOne({ userId: serverUserId });
            //console.log(newUuserData)
            return reply.status(200).send(true);
        } catch (error) {
            console.error('Failed to save user data:', error);
            return reply.status(500).send({ error: 'Failed to save user data' });
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
    fastify.post('/api/generate', async (request, reply) => {
        const { userId } = request.body;

        try {
            // Retrieve user data
            const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
            const userData = await userDataCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
            if (!userData) {
                return reply.status(404).send({ error: 'User data not found' });
            }
    
            // Extract storyId from user data
            const { storyId, choices } = userData;

            // Retrieve story
            const storiesCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('stories');
            const story = await storiesCollection.findOne({ _id: new fastify.mongo.ObjectId(storyId) });
    
            if (!story) {
                return reply.status(404).send({ error: 'Story not found' });
            }

            // Construct the prompt with story introduction and user choices
            let prompt = `
            下記の内容を入れてこの人にピッタリの収入増を目指す方法を診断してください。診断の結果だけを出してください。
            性格の強みと弱みを明確にする
            具体的な行動ステップを提案する
            目標設定の支援
            リソースの提供
            継続的なフィードバックとサポートの提案
            最後にコメントで「さあ、新しい収入の道が見えてきました。」のようなスタートするための励ましコメントを入れて、友好的で励みになる分析とアドバイスを提供してください。\n\n`;
    

            for (const step in story.content.story) {
                const storyStep = story.content.story[step];
                const userChoice = choices.find(choice => storyStep.choices.some(choiceOption => choiceOption.choiceId === choice.choice));

                if (userChoice) {
                    const selectedChoice = storyStep.choices.find(choice => choice.choiceId === userChoice.choice);
                    prompt += `Q: ${storyStep.introduction}\n`;
                    prompt += `A: ${selectedChoice.choiceText}\n\n`;
                }
            }
            
            // Call the moduleCompletion function
            const analysis = await moduleCompletion({
                model: "gpt-4o",
                role: '友好的で励みになるアドバイザー',
                prompt: prompt,
                max_tokens: 600
            });
    
            // Send the analysis as the response
            return reply.send({ analysis: analysis });
        } catch (error) {
            console.error('Failed to generate analysis:', error);
            return reply.status(500).send({ error: 'Failed to generate analysis' });
        }
    });
    fastify.post('/api/openai-completion', (request, reply) => {
        const { userId } = request.body;
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId });
        reply.send({ sessionId });
    });
    fastify.get('/api/openai-completion-stream/:sessionId', async (request, reply) => {
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
            console.log({userId})

            const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
            let userData = isNewObjectId(userId) ? await userDataCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) }) : await userDataCollection.findOne({ userId: parseInt(userId) });
    

            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }

            const { storyId, choices } = userData;
            console.log({ storyId, choices })
            const storiesCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('stories');
            const story = await storiesCollection.findOne({ _id: new fastify.mongo.ObjectId(storyId) });

            if (!story) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'Story not found' });
            }
    
            let prompt = `
            下記の内容を入れてフィードバックを出してください。フィードバックの構成:
            メッセージ: お祝いの言葉
            強み: フィードバックとして、性格の強みを簡潔に説明。
            弱み：フィードバックとして、性格の弱みを簡潔に説明。
            アドバイス: 具体的な改善点や維持方法を提案。
            リソースの紹介: 参考になる書籍、セミナー、オンラインコースなどのリソースを紹介。
            最後の言葉：最初の一歩を踏み出す言葉を紹介。\n
            Respond in japanese and in a friendly tone. Like you would with a friend.
            \n`;
    
            for (const step in story.content.story) {
                const storyStep = story.content.story[step];
                const userChoice = choices.find(choice => storyStep.choices.some(choiceOption => choiceOption.choiceId === choice.choice));
    
                if (userChoice) {
                    const selectedChoice = storyStep.choices.find(choice => choice.choiceId === userChoice.choice);
                    prompt += `Q: ${storyStep.introduction}\n`;
                    prompt += `A: ${selectedChoice.choiceText}\n\n`;
                }
            }
    
            const messages = [
                { "role": "system", "content": "友好的で励みになるアドバイザー" },
                { "role": "user", "content": prompt },
            ];

            console.log(`Start completion`)
            const completion = await fetchOpenAICompletion(messages, reply.raw);

            // End the stream only after the completion has been sent
            reply.raw.end();
        } catch (error) {
            reply.raw.end(); // End the stream before sending the response
            reply.status(500).send({ error: 'Error fetching OpenAI completion' });
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

            const userMessages = userData.messages;
            const completion = await fetchOpenAICompletion(userMessages, reply.raw, 300);

            // Append the assistant's response to the messages array in the chat document
            const assistantMessage = { "role": "assistant", "content": completion };
            userMessages.push(assistantMessage);
            userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
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
        const userLimitCheck = await checkLimits(request.body.userId);
        console.log(userLimitCheck)
        if (userLimitCheck.id === 3) {
            return reply.status(403).send(userLimitCheck);
        }
        const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        const collectionImageCount = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('ImageCount');
        const { chatId, userChatId } = request.body;    
        
        try {

            let userData = await userDataCollection.findOne({ userId : new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) })

            if (!userData) {
                console.log(`User data not found`)
                return reply.status(404).send({ error: 'User data not found' });
            }

            let userMessages = userData.messages;
            const imagePrompt = [
                { 
                    role: "system", 
                    content: `You are an image prompt. You take a conversation and respond with an image description of less than 300 characters.You respond in english.
                    ` 
                },
                { 
                    role: "user", 
                    content: `Use the conversation below to generate an image desciption of the current situation in english:
                    ` + userMessages.map(msg => msg.role != 'system' ? `${msg.content.replace('[Narrator]','')}`: '').join("\n") 
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
        let userId = request.body.userId
        if(!userId){ 
            const user = await fastify.getUser(request, reply);
            userId = user._id
        }
        const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        const { chatId } = request.body;    
        console.log({userId,chatId})
        try {

            let userData = await userDataCollection.findOne({ userId, chatId })

            if (!userData) {
                console.log(`User data not found`)
                return reply.status(404).send({ error: 'User data not found' });
            }

            let userMessages = userData.messages;
            userMessages.push({role:'user',content:'Provide a JSON array containing 3 choices to prompt the user answer. The array contain keywords.Use the following structure : ["string1","string2","string3"]'})
            const completion = await moduleCompletion(userMessages, reply.raw);
            console.log(completion)
            return reply.send(completion)

        } catch (error) {
            console.log(error)
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

            console.log({ userId, chatId });
    
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
    
            console.log(chatData.messages)
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
        const { chatId, message, system } = request.body;
        const user = await fastify.getUser(request, reply);
        const userId = user._id
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId, chatId, message, system });
        return reply.send({ sessionId });
    });
    fastify.get('/api/openai-chat-creation-stream/:sessionId', async (request, reply) => {
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
            const message = session.message;
            const system = session.system;
    
            const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
            let userData = await userDataCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) }) 

            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }
    
            const userObjectId = userData._id;
    
            const chatCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
    
            let messages = [
                { role: "system", content: system },
                { role: "user", content: message },
            ]

            const completion = await fetchOpenAICompletion(messages, reply.raw);

            messages.push({ role: "system", content: completion })
            // Update the chat document in the database
            /*
                await chatCollection.updateOne(
                    { userId: userObjectId, chatId },
                    { $set: { messages: messages, updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) } },
                    {upsert:true}
                );
            */
    
            // End the stream only after the completion has been sent and stored
            reply.raw.end();
        } catch (error) {
            reply.raw.end(); // End the stream before sending the response
            reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
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
    fastify.get('/api/user', async (request,reply) => {
        const user = await fastify.getUser(request, reply);
        return reply.send({user})
    })
    fastify.get('/api/mode', async (request,reply) => {
        return process.env.MODE
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
