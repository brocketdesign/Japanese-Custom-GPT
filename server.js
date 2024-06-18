const fastify = require('fastify')({ logger: false });
const path = require('path');
require('dotenv').config();
const mongodb = require('mongodb');
const cron = require('node-cron');
const fastifyCookie = require('fastify-cookie');
const { getCounter, updateCounter } = require('./models/tool');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const handlebars = require('handlebars');

mongodb.MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((client) => {
    const db = client.db(process.env.MONGODB_NAME);

    // Register plugins
    fastify.register(require('@fastify/static'), {
      root: path.join(__dirname, 'public'),
      prefix: '/',
    });

    const dashboardHeader = fs.readFileSync('views/partials/dashboard-header.hbs', 'utf8');
    handlebars.registerPartial('dashboard-header', dashboardHeader);
    const dashboardNav = fs.readFileSync('views/partials/dashboard-nav.hbs', 'utf8');
    handlebars.registerPartial('dashboard-nav', dashboardNav);
    const dashboardFooter = fs.readFileSync('views/partials/dashboard-footer.hbs', 'utf8');
    handlebars.registerPartial('dashboard-footer', dashboardFooter);

    fastify.register(require('@fastify/view'), {
      engine: { handlebars: require('handlebars') },
      root: path.join(__dirname, 'views'),
    });

    fastify.register(fastifyCookie, {
      secret: "my-secret",
      parseOptions: {},
    });

    fastify.register(require('@fastify/cors'), {
      origin: true,
      methods: ['POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    fastify.register(require('@fastify/mongodb'), { client: client });
    fastify.register(require('fastify-sse'));
    fastify.register(require('@fastify/formbody'));
    fastify.register(require('./routes/api'));
    fastify.register(require('./routes/user'));

    // Authentication decorator
    fastify.decorate('authenticate', async function (request, reply) {
      try {
        const token = request.cookies.token;
        if (!token) {
          return reply.redirect('/authenticate');
        }

        const decoded = await jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded._id) {
          request.user = { _id: decoded._id, ...decoded }; // Attach user _id and other data to request
        } else {
          return reply.redirect('/authenticate');
        }
      } catch (err) {
        return reply.redirect('/authenticate');
      }
    });
 
    // Routes
    fastify.get('/', async (request, reply) => {
      try {
        const activeStory = await db.collection('activeStory').findOne({});
        if (activeStory && activeStory.storyId) {
          reply.redirect(`/story/${activeStory.storyId}`);
        } else {
          reply.status(404).send({ error: 'No active story found' });
        }
      } catch (error) {
        reply.status(500).send({ error: 'Failed to retrieve the active story' });
      }
    });

    fastify.get('/authenticate', (request, reply) => {
      reply.view('authenticate.hbs', { title: 'LAMIX | Powered by Hato,Ltd' });
    });

    fastify.get('/chat', (request, reply) => {
      reply.redirect('chat/');
    });
    fastify.get('/chat/:chatId', (request, reply) => {
      const chatId = request.params.chatId
      if(chatId){
        reply.view('custom-chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd', chatId: chatId });
      }else{
        reply.view('chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd' });
      }
    });
    fastify.get('/chat-list', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      try {
        const userId = new fastify.mongo.ObjectId(request.user._id)
        const chats = await db.collection('chats').find({userId}).sort({"updatedAt":-1}).toArray();
        return reply.view('chat-list', { title: 'LAMIX | Powered by Hato,Ltd', chats: chats, user: request.user  });      
      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'Failed to retrieve stories' });
      }
    });
    fastify.get('/chat/edit/:chatId', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      try {
        const chatId = request.params.chatId
        if(chatId){
          return reply.view('add-chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd', chatId:chatId, user: request.user  });
        }else{
          return reply.view('add-chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd', user: request.user  });
        }
      } catch (error) {
        console.log(error)
        return reply.status(500).send({ error: 'Failed to retrieve chatId' });
      }
    });

    fastify.get('/users', (request, reply) => {
      if (process.env.MODE == 'local') {
        reply.view('user-list.hbs', { title: 'LAMIX | Powered by Hato,Ltd' });
      } else {
        reply.redirect('/');
      }
    });

    fastify.get('/story/:id', (request, reply) => {
      const storyId = request.params.id;
      let variant = request.cookies.variant;
      if (!variant) {
        getCounter(db).then(counter => {
          variant = counter % 2 === 0 ? 'A' : 'B';
          counter++;
          updateCounter(db, counter).then(() => {
            reply
              .setCookie('variant', variant, {
                path: '/',
                sameSite: 'None',
                httpOnly: true,
                maxAge: 60 * 60 * 24,
              })
              .view('index.hbs', { title: 'LAMIX | Powered by Hato,Ltd', storyId: storyId, variant: variant });
          }).catch(err => {
            reply.send(err);
          });
        }).catch(err => {
          reply.send(err);
        });
      } else {
        reply.view('index.hbs', { title: 'LAMIX | Powered by Hato,Ltd', storyId: storyId, variant: variant });
      }
    });

    cron.schedule('0 0 * * *', async () => {
      try {
        await updateCounter(db, 0);
        fastify.log.info('Counter has been reset to 0.');
      } catch (err) {
        fastify.log.error('Failed to reset counter:', err);
      }
    });
    fastify.get('/generate/:userid', (request, reply) => {
      const userId = request.params.userid;
      reply.view('generate.hbs', { title: 'LAMIX | Powered by Hato,Ltd', userId: userId });
    });
    fastify.get('/test-db', async (request, reply) => {
      try {
        await db.command({ ping: 1 });
        reply.send({ message: 'MongoDB connection is healthy' });
      } catch (error) {
        reply.status(500).send({ message: 'MongoDB connection failed', error });
      }
    });
    fastify.get('/dashboard', {
      preHandler: [fastify.authenticate]
    }, (request, reply) => {
      try {
        reply.redirect('/chat-list')
        //reply.view('dashboard.hbs', { title: 'LAMIX | Powered by Hato,Ltd', user: request.user });
      } catch (err) {
        reply.status(500).send({ error: 'Unable to render the dashboard' });
      }
    });
    
    

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
  })
  .catch((err) => {
    throw err;
  });
