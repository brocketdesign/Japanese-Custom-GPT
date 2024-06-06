const fastify = require('fastify')({ logger: false });
const path = require('path');
require('dotenv').config();

// Register static file plugin
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/', // serving static files from 'public'
});

// Register Handlebars as view engine using @fastify/view
fastify.register(require('@fastify/view'), {
  engine: {
    handlebars: require('handlebars')
  },
  viewPath: path.join(__dirname, 'views')
});

// Register MongoDB
fastify.register(require('@fastify/mongodb'), {
  forceClose: true,
  url: process.env.MONGODB_URI
});

// Register API routes
fastify.register(require('./routes/api'));

// A simple root route
fastify.get('/', (request, reply) => {
  reply.view('/views/index.hbs', { title: 'Quiz App' });
});
fastify.get('/story/:id', (request, reply) => {
    // Retrieve the story ID from the URL parameter
    const storyId = request.params.id;
    // Pass the story ID to the Handlebars template
    reply.view('/views/index.hbs', { title: 'LAMIX | Powered by Hato,Ltd', storyId: storyId });
  });
  
fastify.get('/stories', async (request, reply) => {
    const db = fastify.mongo.db;
    const collection = db.collection('stories');
    try {
        const stories = await collection.find({}).toArray();
        return reply.view('/views/story-list', { stories: stories }); // Make sure the template name is correct
    } catch (error) {
        fastify.log.error('Failed to retrieve stories:', error);
        return reply.status(500).send({ error: 'Failed to retrieve stories' });
    }
});


fastify.get('/add-story', (request, reply) => {
    // Render the add-story.hbs view
    reply.view('/views/add-story.hbs', { title: 'Add New Story' });
});

// MongoDB Connection Test Route
fastify.get('/test-db', async (request, reply) => {
  const db = fastify.mongo.db;
  try {
    await db.command({ ping: 1 });
    console.log('MongoDB connection is healthy');
    reply.send({ message: 'MongoDB connection is healthy' });
  } catch (error) {
    console.log('MongoDB connection failed', error);
    reply.status(500).send({ message: 'MongoDB connection failed', error });
  }
});

// Run the server
// Run the server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen(port, '0.0.0.0');
    fastify.log.info(`server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

