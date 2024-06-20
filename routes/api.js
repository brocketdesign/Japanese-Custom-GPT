const { ObjectId } = require('mongodb');
const {moduleCompletion,fetchOpenAICompletion} = require('../models/openai')
const crypto = require('crypto');
const aws = require('aws-sdk');
const fastifyMultipart = require('fastify-multipart');
const sessions = new Map(); // Define sessions map

async function routes(fastify, options) {
    fastify.register(fastifyMultipart);

    // Configure AWS S3
    const s3 = new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    });
    fastify.post('/api/add-chat', async (request, reply) => {
        const parts = request.parts();
        let name, description, content, thumbnailUrl, chatId, thumbnailHash;
        const user = await fastify.getUser(request, reply);
        const userId = new fastify.mongo.ObjectId(user._id);
    
        for await (const part of parts) {
            if (part.fieldname === 'name') {
                name = part.value;
            } else if (part.fieldname === 'content') {
                content = JSON.parse(part.value);
            } else if (part.fieldname === 'description') {
                description = part.value;
            } else if (part.fieldname === 'thumbnail') {
                // Read the file stream into a buffer
                const chunks = [];
                for await (const chunk of part.file) {
                    chunks.push(chunk);
                }
                const buffer = Buffer.concat(chunks);
    
                // Calculate the hash of the thumbnail
                const hash = crypto.createHash('md5');
                hash.update(buffer);
                thumbnailHash = hash.digest('hex');
    
                // Check if a file with this hash already exists in S3
                let existingFiles;
                try {
                    existingFiles = await s3.listObjectsV2({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Prefix: thumbnailHash,
                    }).promise();
                } catch (error) {
                    console.error('Failed to list objects in S3:', error);
                    return reply.status(500).send({ error: 'Failed to check existing thumbnails' });
                }
    
                if (existingFiles.Contents.length > 0) {
                    // File already exists, use its URL
                    thumbnailUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
                } else {
                    // Upload the thumbnail to S3
                    const params = {
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: `${thumbnailHash}_${part.filename}`,
                        Body: buffer,
                    };
    
                    try {
                        const uploadResult = await s3.upload(params).promise();
                        thumbnailUrl = uploadResult.Location;
                    } catch (error) {
                        console.error('Failed to upload thumbnail:', error);
                        return reply.status(500).send({ error: 'Failed to upload thumbnail' });
                    }
                }
            } else if (part.fieldname === 'chatId') {
                chatId = part.value;
            }
        }
    
        // Check if the name and content are provided
        if (!name || !content) {
            return reply.status(400).send({ error: 'Missing name or content for the story' });
        }
    
        // Access the MongoDB collection
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
        // Create a document to insert or update
        const storyDocument = {
            name: name,
            description: description,
            content: content,
            thumbnailUrl: thumbnailUrl,
            userId: userId,
            updatedAt: dateObj
        };
    
        try {
            if (chatId) {
                // Update the existing story
                const existingStory = await collection.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
                if (!existingStory) {
                    return reply.status(404).send({ error: 'Story not found' });
                }
    
                // Update only the provided fields
                if (thumbnailUrl) {
                    storyDocument.thumbnailUrl = thumbnailUrl;
                } else {
                    delete storyDocument.thumbnailUrl;
                }
    
                await collection.updateOne({ _id: new fastify.mongo.ObjectId(chatId) }, { $set: storyDocument });
                console.log('Chat updated', chatId);
                return reply.send({ message: 'Chat updated successfully', name: name });
            } else {
                // Check if a story with the same name already exists
                const existingStory = await collection.findOne({ name: name });
                if (existingStory) {
                    return reply.status(409).send({ error: 'A story with this name already exists' });
                }
    
                storyDocument.createdAt = dateObj;
    
                // Insert the new story into the MongoDB collection
                await collection.insertOne(storyDocument);
                console.log('New Chat added');
                return reply.send({ message: 'Chat added successfully', name: name });
            }
        } catch (error) {
            // Handle potential errors
            console.error('Failed to add or update the Chat:', error);
            return reply.status(500).send({ error: 'Failed to add or update the Chat' });
        }
    });
    fastify.delete('/api/delete-chat/:id', async (request, reply) => {
        const chatId = request.params.id;
    
        try {
            // Access the MongoDB collection
            const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
            // Find the story by ID
            const story = await collection.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
            if (!story) {
                return reply.status(404).send({ error: 'Story not found' });
            }
    
            // Delete the thumbnail from S3 if it exists
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
    
            // Delete the story from MongoDB
            await collection.deleteOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
            console.log('Story deleted');
            return reply.send({ message: 'Story deleted successfully' });
        } catch (error) {
            // Handle potential errors
            console.error('Failed to delete story:', error);
            return reply.status(500).send({ error: 'Failed to delete story' });
        }
    });
    fastify.get('/api/chat/:id', async (request, reply) => {
        const chatId = request.params.id;
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
    
        try {
            const chat = await collection.findOne({ _id: new fastify.mongo.ObjectId(chatId) });

            if (!chat) {
                return reply.status(404).send({ error: 'chat not found' });
            }
            reply.send(chat);
        } catch (error) {
            console.error('Failed to retrieve chat:', error);
            reply.status(500).send({ error: 'Failed to retrieve chat' });
        }
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
    fastify.post('/api/chat-data',async (request, reply) => {

        const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
        const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        
        const { currentStep, message, chatId } = request.body;    
        let userId = req.body.userId
        if(!userId){ 
            const user = await fastify.getUser(request, reply);
            userId = user._id
        }
        try {
            // Find or create the chat document
            let userChatDocument = await collectionUserChat.findOne({ userId, chatId });
            let chatDocument = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });

            if (!userChatDocument || currentStep == 1) {
                // Initialize chat document if it doesn't exist
                userChatDocument = {
                    userId,
                    chatId,
                    messages: [
                        { "role": "system", "content": 'You are a japanese assistant about : ' + chatDocument.description  +'You provide short and friendly answers. You never answer with lists. You always prompt the user to help continue the conversation smoothly.'},
                        { "role": "assistant", "content": chatDocument.content.story[`step${currentStep}`].introduction }
                    ],
                    createdAt: dateObj,
                    updatedAt: dateObj
                };
            }else{
                if(chatDocument.content.story[`step${currentStep}`]){
                    userChatDocument.messages.push({ "role": "assistant", "content": chatDocument.content.story[`step${currentStep}`].introduction });
                }
            }

            // Add the new user message to the chat document
            userChatDocument.messages.push({ "role": "user", "content": message });
            userChatDocument.updatedAt = dateObj;

            const query = { userId, chatId }
            // Update or insert the chat document
            await collectionUserChat.updateOne(
                query,
                { $set: userChatDocument },
                { upsert: true }
            );

            const userData = await collectionUserChat.findOne(query);
            console.log(userData);

            return reply.send({ nextStoryPart: "You chose the path and...", endOfStory: true });
        } catch (error) {
            console.log(error)
            console.error('Failed to save user choice:', error);
            return reply.status(500).send({ error: 'Failed to save user choice' });
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
        const { chatId } = request.body;
        let userId = req.body.userId
        if(!userId){ 
            const user = await fastify.getUser(request, reply);
            userId = user._id
        }
        const sessionId = Math.random().toString(36).substring(2, 15); // Generate a unique session ID
        sessions.set(sessionId, { userId, chatId });
        return reply.send({ sessionId });
    });
    fastify.get('/api/openai-chat-completion-stream/:sessionId', async (request, reply) => {
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
            console.log({userId,chatId})
            const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            let userData = await collectionUserChat.findOne({ userId, chatId })

            if (!userData) {
                reply.raw.end(); // End the stream before sending the response
                return reply.status(404).send({ error: 'User data not found' });
            }

            const userMessages = userData.messages;
            //console.log({ message:userMessages })

            const completion = await fetchOpenAICompletion(userMessages, reply.raw);

            // Append the assistant's response to the messages array in the chat document
            const assistantMessage = { "role": "assistant", "content": completion };
            userMessages.push(assistantMessage);
            userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
            // Update the chat document in the database
            await collectionUserChat.updateOne(
                { userId , chatId },
                { $set: { messages: userMessages, updatedAt: userData.updatedAt } }
            );
    
            reply.raw.end();
        } catch (error) {
            console.log(error)
            reply.raw.end(); // End the stream before sending the response
            reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
    });
    fastify.post('/api/openai-chat-choice/', async (request, reply) => {
        let userId = req.body.userId
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
    fastify.post('/api/chat',async (request, reply) => {
        try {
            const { currentStep, message, chatId } = request.body;
            const user = await fastify.getUser(request, reply);
            const userId = user._id
            console.log({ userId, message, chatId });
    
            const collectionUser = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
            const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
            
            const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
            // Find the user document
            let userDocument = await collectionUser.findOne({ userId });
    
            if (!userDocument) {
                // Initialize user document if it doesn't exist
                userDocument = {
                    userId,
                    createdAt: dateObj,
                    updatedAt: dateObj
                };
    
                // Insert the user document and get the _id
                const result = await collectionUser.insertOne(userDocument);
                userDocument._id = result.insertedId;
            }
    
            // Find or create the chat document
            let chatDocument = await collectionChat.findOne({ userId, chatId });
    
            if (!chatDocument) {
                // Initialize chat document if it doesn't exist
                chatDocument = {
                    userId,
                    chatId,
                    messages: [
                        { "role": "system", "content": `You are the promoter of the service LAMIXボット. LAMIXボット, developed by Hato Ltd., is a sophisticated chatbot management platform designed to empower users to create and manage custom chatbots with ease. This intuitive dashboard, built with Bootstrap 5 and Font Awesome, offers a seamless user experience for handling various aspects of chatbot functionality. Users can effortlessly navigate through sections such as the dashboard overview, chatbot lists, new chatbot creation, and user settings. The platform provides real-time statistics on chatbot activity, including total, active, and error-prone bots, ensuring comprehensive monitoring and management. Additionally, features like editing, deleting, and creating chatbots are readily accessible, with responsive feedback mechanisms such as pop-up alerts for logout confirmations. LAMIXボット, backed by Hato Ltd., aims to streamline and enhance the efficiency of chatbot operations for businesses and developers alike. Use a friendly tone. Avoid responding with lists. The client is Japanese so respond in Japanese. Alway propt the user.` }
                    ],
                    createdAt: dateObj,
                    updatedAt: dateObj
                };
            }
            console.log(chatDocument)
            // Add the new user message to the chat document
            chatDocument.messages.push({ "role": "user", "content": message });
            chatDocument.updatedAt = dateObj;
    
            // Update or insert the chat document
            await collectionChat.updateOne(
                { userId, chatId },
                { $set: chatDocument },
                { upsert: true }
            );
    
            reply.send({ userId, chatId });
        } catch (err) {
            console.log(err);
            fastify.log.error(err);
            reply.status(500).send({ error: 'An error occurred while saving the message.' });
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

            console.log({ userId, chatId, message });
    
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
            await chatCollection.insertOne(
                { userId: userObjectId, chatId },
                { $set: { messages: messages, updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) } }
            );
    
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
