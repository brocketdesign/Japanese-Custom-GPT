const fastify = require('fastify')({ logger: true });
const path = require('path');
require('dotenv').config();

// Register static file plugin
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/', // serving static files from 'public'
});

// Register Handlebars as view engine
fastify.register(require('fastify-handlebars'), {
  viewPath: path.join(__dirname, 'views')
});

// Register API routes
fastify.register(require('./routes/api'));

// A simple root route
fastify.get('/', (request, reply) => {
  reply.view('/views/index.hbs', { title: 'Quiz App' });
});

// Run the server
const start = async () => {
  try {
    await fastify.listen(3000);
    fastify.log.info(`server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
