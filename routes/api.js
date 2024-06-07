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
    
        // Create a document to insert
        const storyDocument = {
            name: name,
            content: content,
            createdAt: new Date()
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
    
    fastify.post('/api/data', async (request, reply) => {
        const { choice, userId, userIp } = request.body;

        const serverUserId = userId || 'user_' + Date.now();
    
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userData');
    
        const query = { userId: serverUserId };
        const update = {
            $push: { choices: { choice, timestamp: new Date() } },
            $setOnInsert: { userId: serverUserId, userIp: userIp, createdAt: new Date() }
        };
        const options = { upsert: true };
    
        try {
            await collection.updateOne(query, update, options);
            console.log('User choice updated:', { userId: serverUserId, choice, userIp: userIp });
 
            return reply.send({ nextStoryPart: "You chose the path and...", endOfStory: true });
        } catch (error) {
            console.error('Failed to save user choice:', error);
            return reply.status(500).send({ error: 'Failed to save user choice' });
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
    
        const query = { userId };
        const update = { $set: { email, createdAt: new Date() } };
    
        try {
            await collection.updateOne(query, update);
            console.log('User email saved:', { userId, email });
    
            return reply.send({ status: 'success' });
        } catch (error) {
            console.error('Failed to save user email:', error);
            return reply.status(500).send({ error: 'Failed to save user email' });
        }
    });
    
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
