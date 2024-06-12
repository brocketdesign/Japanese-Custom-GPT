const { ObjectId } = require('mongodb');
const {moduleCompletion,fetchOpenAICompletion} = require('../models/openai')
const sessions = new Map(); // Define sessions map
async function routes(fastify, options) {
    fastify.post('/api/add-story', async (request, reply) => {
        const { name, content } = request.body;

        // Check if the name and content are provided
        if (!name || !content) {
            return reply.status(400).send({ error: 'Missing name or content for the story' });
        }
    
        // Access the MongoDB collection
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('stories');
    
        // Check if a story with the same name already exists
        const existingStory = await collection.findOne({ name: name });
        if (existingStory) {
            return reply.status(409).send({ error: 'A story with this name already exists' });
        }
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        // Create a document to insert
        const storyDocument = {
            name: name,
            content: content,
            createdAt: dateObj
        };
    
        try {
            // Insert the new story into the MongoDB collection
            await collection.insertOne(storyDocument);
            console.log('New story added:', storyDocument);
            return reply.send({ message: 'Story added successfully', name: name });
        } catch (error) {
            // Handle potential errors
            console.error('Failed to add the story:', error);
            return reply.status(500).send({ error: 'Failed to add the story' });
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
            console.error('Failed to retrieve story:', error);
            reply.status(500).send({ error: 'Failed to retrieve story' });
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
        const { choice, userId, userIp, storyId } = request.body;

        const serverUserId = parseInt(userId) || 'user_' + Date.now();
    
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
    
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        const query = { userId: serverUserId };
        const update = {
            $push: { choices: { choice, storyId, timestamp: dateObj } },
            $setOnInsert: { userId: serverUserId, userIp: userIp, createdAt: dateObj },
            $set: { storyId: storyId }
        };
        const options = { upsert: true };
    
        try {
            await collection.updateOne(query, update, options);
            console.log('User choice updated:', { userId: serverUserId, choice, userIp: userIp, storyId:storyId });
            //const userData = await collection.findOne(query);
            //console.log(userData)
            return reply.send({ nextStoryPart: "You chose the path and...", endOfStory: true });
        } catch (error) {
            console.error('Failed to save user choice:', error);
            return reply.status(500).send({ error: 'Failed to save user choice' });
        }
    });

    fastify.post('/api/custom-data', async (request, reply) => {
        const { userId, customData } = request.body;
    
        const serverUserId = parseInt(userId) || 'user_' + Date.now();
        
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
    
        const dateObj = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
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
    
            console.log('User data updated:', { userId: serverUserId, customData, createdAt: dateObj });
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
        console.log({sessionId})
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
            フィードバックの構成
            メッセージ: お祝いの言葉を入れてリッチマインド、バランスマインド、奴隷マインドに対する参加者の結果を肯定的に伝える。
            強み: フィードバックとして、性格の強みを簡潔に説明。
            弱み：フィードバックとして、性格の弱みを簡潔に説明。
            アドバイス: 具体的な改善点や維持方法を提案。
            リソースの紹介: 参考になる書籍、セミナー、オンラインコースなどのリソースを紹介。
            最後の言葉：最初の一歩を踏み出す言葉を紹介。\n\n`;
    
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
    
        
    fastify.get('/api/user-data', async (request, reply) => {
        if(process.env.MODE != 'local'){
            return reply.send([]);
        }
        const { userId } = request.query;
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');

        try {
            if (userId) {
                // Fetch specific user's data
                const userData = await collection.findOne({ userId: parseInt(userId) });
                if (!userData) {
                    return reply.status(404).send({ error: 'User not found' });
                }
                return reply.send(userData);
            } else {
                // Fetch all users' data
                const allUsersData = await collection.find({}).toArray();
                return reply.send(allUsersData);
            }
        } catch (error) {
            console.error('Failed to retrieve user data:', error);
            return reply.status(500).send({ error: 'Failed to retrieve user data' });
        }
    });
    
        
}

module.exports = routes;
