const fastify = require('fastify')({ logger: false });
const path = require('path');
require('dotenv').config();
const mongodb = require('mongodb');
const cron = require('node-cron');
const { getCounter, updateCounter } = require('./models/tool');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const handlebars = require('handlebars');
const { v4: uuidv4 } = require('uuid');

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

    fastify.register(require('fastify-cookie'), {
      secret: "my-secret",
      parseOptions: {},
    });
    fastify.register(require('@fastify/cors'), {
      origin: '*', // replace with the domain you want to allow
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    });
    fastify.register(require('@fastify/mongodb'), { client: client });
    fastify.register(require('fastify-sse'));
    fastify.register(require('@fastify/formbody'));
    fastify.register(require('./routes/api'));
    fastify.register(require('./routes/user'));
    fastify.register(require('./routes/admin'));
 
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
    
  // User decorator
  fastify.decorate('getUser', async function (request, reply) {
    try {
      const token = request.cookies.token;
      if (token) {
        const decoded = await jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded._id) {
          request.user = { _id: decoded._id, ...decoded }; // Attach user _id and other data to request
          return request.user;
        }
      }
    } catch (err) {
      // If any error occurs during token verification, fall through to handle temporary user
    }
    // Handle temporary user
    let tempUser = request.cookies.tempUser;
    if (!tempUser) {
      tempUser = {
        _id: uuidv4(),
        isTemporary: true,
        role: 'guest',
        // Add any other temporary user properties if needed
      };
      reply.setCookie('tempUser', JSON.stringify(tempUser), {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 1 week
        sameSite: 'None', // Allows cross-domain cookies
        secure: true // Ensures the cookie is only sent over HTTPS
      });
    } else {
      tempUser = JSON.parse(tempUser);
    }

    request.user = tempUser;
    return tempUser;
  });
    
    // Routes
    fastify.get('/', async (request, reply) => {
      return reply.view('chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd' });
    });

    fastify.get('/authenticate',async (request, reply) => {
      const user = await fastify.getUser(request, reply);
      if (user.isTemporary) {
        return reply.view('authenticate.hbs', { title: 'LAMIX | Powered by Hato,Ltd' });
      } else {
        return reply.redirect('/dashboard')
      }
    });

    fastify.get('/chat', (request, reply) => {
      reply.redirect('chat/');
    });
    fastify.get('/chat/:chatId', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      const chatId = request.params.chatId
      if(chatId){
        const userId = request.user._id
        const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
        let userChat = await collectionUserChat.find({ chatId }).toArray();
        return reply.view('custom-chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd', userId, chatId, userChat });
      }else{
        return reply.view('chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd' });
      }
    });
    fastify.get('/chat-index', (request, reply) => {
      reply.view('chat.hbs', { title: 'LAMIX | Powered by Hato,Ltd' });
    });
    fastify.get('/chat-list', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      try {
        const userId = new fastify.mongo.ObjectId(request.user._id)
        const chatsCollection = db.collection('chats');
        const sortedChats = await chatsCollection.find({ userId }).sort({ "updatedAt": -1 }).toArray();
        
        return reply.view('chat-list', { title: 'LAMIX | Powered by Hato,Ltd', chats: sortedChats, user: request.user  });      
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
    }, async (request, reply) => {
      try {

        const userId = new fastify.mongo.ObjectId(request.user._id)
        const chatsCollection = db.collection('chats');
        const chats = await chatsCollection.find({ userId }).toArray();
        if(chats.length == 0){
          return reply.redirect('/chat/edit/')
        }else{
          return reply.redirect('/chat-list')
        }
      } catch (err) {
        return reply.status(500).send({ error: 'Unable to render the dashboard' });
      }
    });
    fastify.get('/settings', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      try {
        const userId = request.user._id
        const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
        const userData = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
        return reply.view('/settings', { title: 'LAMIX | Powered by Hato,Ltd', user:userData})
      } catch (err) {
        return reply.status(500).send({ error: 'Unable to render the settings' });
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
