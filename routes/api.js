async function routes(fastify, options) {
    fastify.get('/api/data', async (request, reply) => {
      // Your API logic here, e.g., fetching data from MongoDB
      return { hello: 'world' };
    });
  }
  
  module.exports = routes;
  