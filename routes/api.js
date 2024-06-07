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
        // Assuming the request body contains `choice` and optionally a `userId`
        const { choice, userId } = request.body;
    
        // Generate a server-side userId if not provided (not recommended for production)
        const serverUserId = userId || 'user_' + Date.now();
    
        // Get client's IP address
        const clientIp = request.headers['x-forwarded-for'] || request.ip;
    
        // Access the MongoDB collection
        const collection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChoices');
    
        // Create a document to insert
        const doc = {
            userId: serverUserId,
            choice: choice,
            ip: clientIp,
            timestamp: new Date()
        };
    
        try {
            // Insert the document into the MongoDB collection
            await collection.insertOne(doc);
            console.log('User choice saved:', doc);
    
            // Return the next part of the story
            return reply.send({ nextStoryPart: "You chose the path and...", endOfStory: true });
        } catch (error) {
            // Handle potential errors
            console.error('Failed to save user choice:', error);
            return reply.status(500).send({ error: 'Failed to save user choice' });
        }
    });
    
    fastify.post('/api/submit-email', async (request, reply) => {
        const  {email , userId } = request.body;
        return { status: 'success' };
    });
}

module.exports = routes;
