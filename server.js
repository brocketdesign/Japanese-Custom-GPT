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
const fastifyMultipart = require('fastify-multipart');

const {
  cleanupNonRegisteredUsers,
  deleteOldRecords, 
  deleteCharactersWithoutDescription,
  deleteClientsWithoutProductId,
  deleteUserChatsWithoutMessages,
  saveAllImageHashesToDB,
  cleanUpDatabase
 } = require('./models/cleanupNonRegisteredUsers');

mongodb.MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((client) => {
    const db = client.db(process.env.MONGODB_NAME);

    // Schedule the cleanup to run every day at midnight
    cron.schedule('0 0 * * *', () => {
      cleanupNonRegisteredUsers(db);
      deleteOldRecords(db)
      deleteCharactersWithoutDescription(db)
      deleteClientsWithoutProductId(db)
      deleteUserChatsWithoutMessages(db)
      cleanUpDatabase(db)
    });

    cron.schedule('0 0 * * *', async () => {
      try {
        await updateCounter(db, 0);
        fastify.log.info('Counter has been reset to 0.');
      } catch (err) {
        fastify.log.error('Failed to reset counter:', err);
      }
    });
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
    const dashboardAvatar = fs.readFileSync('views/partials/dashboard-avatar.hbs', 'utf8');
    handlebars.registerPartial('dashboard-avatar', dashboardAvatar);
    
    fastify.register(require('@fastify/view'), {
      engine: { handlebars: require('handlebars') },
      root: path.join(__dirname, 'views'),
    });
    fastify.after(() => {
      handlebars.registerHelper('default', function(value, fallback) {
        return value || fallback;
      });
      handlebars.registerHelper('eq', function (a, b) {
        return a.toString() === b.toString();
      });
      handlebars.registerHelper('json', function(context) {
        return JSON.stringify(context);
      });
      handlebars.registerHelper('includesObjectId', function (array, userId) {
        // Check if any ObjectId in the array matches the userId after converting both to strings
        return array?.some(id => id?.toString() === userId?.toString());
      });      
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
    fastify.register(fastifyMultipart, {
      limits: {
          fileSize: 10 * 1024 * 1024, // Limit file size to 10MB
      },
    });
    fastify.decorateReply('renderWithGtm', function(template, data) {
        data = data || {};
        data.gtmId = process.env.GTM_ID;
        return this.view(template, data);
    });

    fastify.register(require('@fastify/mongodb'), { client: client });
    fastify.register(require('fastify-sse'));
    fastify.register(require('@fastify/formbody'));
    fastify.register(require('./routes/api'));
    fastify.register(require('./routes/stability'));
    fastify.register(require('./routes/plan'));
    fastify.register(require('./routes/scraper'));
    fastify.register(require('./routes/user'));
    fastify.register(require('./routes/admin'));
    fastify.register(require('./routes/post'));
    fastify.register(require('./routes/gallery'));
 
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
    const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');

    if (!tempUser) {
      tempUser = {
        _id: new fastify.mongo.ObjectId(), // Use fastify.mongo.ObjectId for tempUser ID
        isTemporary: true,
        role: 'guest',
        createdAt: new Date()
        // Add any other temporary user properties if needed
      };
      await userDataCollection.insertOne(tempUser); // Insert tempUser into the users collection
      reply.setCookie('tempUser', JSON.stringify(tempUser), {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24, // 24 Hour
        sameSite: 'None', // Allows cross-domain cookies
        //secure: true // Ensures the cookie is only sent over HTTPS
      });

    } else {
      tempUser = JSON.parse(tempUser);
    }

    request.user = tempUser;
    return tempUser;
  });
    
    // Routes
    fastify.get('/', async (request, reply) => {
      const user = await fastify.getUser(request, reply);
      if (user.isTemporary) {
        return reply.redirect('/discover')
      }else{
        return reply.redirect('/chat/')
      }
    });

    fastify.get('/authenticate',async (request, reply) => {
      const user = await fastify.getUser(request, reply);
      if (user.isTemporary || request.query.register ) {
        return reply.renderWithGtm('authenticate.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' , register:!!request.query.register });
      } else {
        return reply.redirect('/dashboard')
      }
    });
    fastify.get('/authenticate/mail',async (request, reply) => {
      const user = await fastify.getUser(request, reply);
      if (user.isTemporary || request.query.register ) {
        return reply.renderWithGtm('authenticate-v1.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' , register:!!request.query.register });
      } else {
        return reply.redirect('/dashboard')
      }
    });
    fastify.get('/my-plan', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      let user = await fastify.getUser(request, reply);
      const userId = user._id;
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      return reply.renderWithGtm('plan.hbs', { 
        title: 'AIグラビア | Powered by Hato,Ltd', 
        user, 
        seo: [
          { name: 'description', content: 'AIグラビアは、Hato,Ltdによって提供される画像生成AI体験をお楽しみいただけます。' },
          { name: 'keywords', content: 'AIグラビア, 画像生成AI, Hato Ltd, 日本語, AI画像生成' },
          { property: 'og:title', content: 'AIグラビア | Powered by Hato,Ltd' },
          { property: 'og:description', content: 'AIグラビアは、リアルタイム画像生成AI体験を提供します。' },
          { property: 'og:image', content: '/img/share.png' },
          { property: 'og:url', content: 'https://app.lamix.jp/chat/' }
        ]
      });      
    }); 
    fastify.get('/chat', (request, reply) => {
      reply.redirect('chat/');
    });
    fastify.get('/chat/:chatId', async (request, reply) => {
      let user = await fastify.getUser(request, reply);
      const chatId = request.params.chatId;
      const userId = user._id;

      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      const totalUsers = await db.collection('users').countDocuments({ email: { $exists: true } });

      return reply.renderWithGtm('custom-chat.hbs', { title: 'LAMIX | AIフレンズ | Powered by Hato,Ltd',mode:process.env.MODE, user, userId, chatId});
    });
    
    fastify.get('/post', async (request, reply) => {
      try {
        let user = await fastify.getUser(request, reply);
        const userId = user._id;
        user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

        return reply.view('post.hbs', {
          user,
          seo: [
            { name: 'description', content: 'AIグラビアは、ラミックスが提供する画像生成AI体験です。' },
            { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
            { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
            { property: 'og:description', content: 'AIグラビアは、リアルタイム画像生成AI体験を提供します。' },
            { property: 'og:image', content: '/img/share.png' },
          ]
        });
      } catch (error) {
        console.log(error)
      }
    });

    fastify.get('/post/:postId', async (request, reply) => {
      try {
        let user = await fastify.getUser(request, reply);
        const userId = user._id;
        const postId = request.params.postId;
        
        const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
        user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
        const post = await db.collection('posts').findOne({ _id: new fastify.mongo.ObjectId(postId) });

        const postUserId = post.userId;
        postUser = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(postUserId) });

        if (!post) {
          return reply.code(404).send({ error: 'Post not found' });
        }

        return reply.renderWithGtm('post.hbs', {
          title: 'LAMIX | AIフレンズ | Powered by Hato,Ltd',
          mode: process.env.MODE,
          user,
          postUser,
          userId,
          post,
        });
      } catch (err) {
        console.log(err);
        return reply.code(500).send('Internal Server Error');
      }
    });
    
    fastify.get('/character', async (request, reply) => {
      try {
        let user = await fastify.getUser(request, reply);
        const userId = user._id;
        user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

        return reply.view('character.hbs', {
          user,
          seo: [
            { name: 'description', content: 'AIグラビアは、ラミックスが提供する画像生成AI体験です。' },
            { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
            { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
            { property: 'og:description', content: 'AIグラビアは、リアルタイム画像生成AI体験を提供します。' },
            { property: 'og:image', content: '/img/share.png' },
          ]
        });
      } catch (error) {
        console.log(error)
      }
    });
    fastify.get('/character/:chatId', async (request, reply) => {
      try {
        let user = await fastify.getUser(request, reply);
        const userId = user._id;


        const chatId = new fastify.mongo.ObjectId(request.params.chatId);
        const imageId = request.query.imageId ? new fastify.mongo.ObjectId(request.query.imageId) : null;
    
        const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
        const chatsCollection = db.collection('chats');
        const galleryCollection = db.collection('gallery');

        user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
        const subscriptionStatus = user.subscriptionStatus === 'active';

        // Fetch chat profile data
        const chat = await chatsCollection.findOne({ _id: chatId });
    
        if (!chat) {
          return reply.code(404).send({ error: 'Chat not found' });
        }
    
        let image = null;
        let isBlur = false;
        // Fetch the specific image if imageId is provided, otherwise leave image null
        if (imageId) {
          const imageDoc = await galleryCollection
            .aggregate([
              { $match: { chatId: chatId } },
              { $unwind: '$images' },
              { $match: { 'images._id': imageId } },
              { $project: { image: '$images', _id: 0 } }
            ])
            .toArray();
    
          if (imageDoc.length > 0) {
            image = imageDoc[0].image;
            isBlur = image?.nsfw && !subscriptionStatus;
          } else {
            return reply.code(404).send({ error: 'Image not found' });
          }
        }

        // Render the page with chat and image data (image can be null if no imageId was provided)
        return reply.view('character.hbs', {
          chat,
          image,
          chatId,
          isBlur,
          seo: [
            { name: 'description', content: 'AIグラビアは、ラミックスが提供する画像生成AI体験です。' },
            { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
            { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
            { property: 'og:description', content: 'AIグラビアは、リアルタイム画像生成AI体験を提供します。' },
            { property: 'og:image', content: '/img/share.png' },
            { property: 'og:url', content: `https://app.lamix.jp/chat/${chatId}` }
          ]
        });
    
      } catch (err) {
        console.error(err);
        reply.code(500).send('Internal Server Error');
      }
    });
    
    fastify.get('/about', async(request, reply) => {
      const collectionChats = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
      const chats = await collectionChats.find({
        visibility: { $exists: true, $eq: "public" }
      }).sort({_id:-1}).limit(10).toArray();
      return reply.renderWithGtm('chat.hbs', { 
        title: 'AIグラビア | ラミックスの画像生成AI体験', 
        chats,
        seo: [
          { name: 'description', content: 'AIグラビアは、ラミックスが提供する画像生成AI体験です。' },
          { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
          { property: 'og:title', content: 'AIグラビア | ラミックスの画像生成AI体験' },
          { property: 'og:description', content: 'AIグラビアは、リアルタイム画像生成AI体験を提供します。' },
          { property: 'og:image', content: '/img/share.png' },
          { property: 'og:url', content: 'https://app.lamix.jp/about' }
        ]
      });
    });
    fastify.get('/chat/list/:id', async (request, reply) => {
      try {
        const userId = new fastify.mongo.ObjectId(request.params.id);
        const user = await db.collection('users').findOne({ _id: userId });

        let query = {
          userId,
          visibility: 'public'
        }

        const currentUser = await fastify.getUser(request, reply);

        if(currentUser._id.toString() == request.params.id.toString()){
          query = {userId}
        }
        
        const chatsCollection = db.collection('chats');
        const sortedChats = await chatsCollection.find(query).sort({ "updatedAt": -1 }).toArray();

        return reply.renderWithGtm('chat-list', { 
          title: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験', 
          chats: sortedChats, 
          user,
          seo: [
            { name: 'description', content: 'AIグラビアは、ラミックスが提供する画像生成AI体験です。' },
            { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
            { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
            { property: 'og:description', content: 'AIグラビアは、リアルタイム画像生成AI体験を提供します。' },
            { property: 'og:image', content: '/img/share.png' },
            { property: 'og:url', content: `https://app.lamix.jp/chat/list/${request.params.id}` }
          ]
        });
       } catch (err) {
        console.log(err);
        return reply.status(500).send({ error: 'Failed to retrieve chat list' });
      }
    });
    fastify.get('/discover', async (request, reply) => {
      let user = await fastify.getUser(request, reply);
      const userId = user._id;
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      return reply.renderWithGtm('discover.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' , user });
    });

    fastify.get('/chat/edit/:chatId', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {

      let user = await fastify.getUser(request, reply);
      const userId = user._id;
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

      const isSubscribed = user.subscriptionStatus === 'active';
      if(!isSubscribed){
        return reply.redirect('/my-plan');
      }

      let chatId = request.params.chatId 
      const chatImage = request.query.chatImage
      //Must have an image 
      if(!chatId && !chatImage){
        //return reply.redirect('/discover')
      }

      try {
        const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
        const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');

        let user = await fastify.getUser(request, reply);
        const userId = user._id;
        user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
        const isTemporaryChat = request.params.chatId ? false : true
        if(isTemporaryChat){
          chatId = new fastify.mongo.ObjectId()
          await chatsCollection.insertOne({userId:new fastify.mongo.ObjectId(userId), _id : chatId, isTemporary:true})
        }
        const prompts = await fs.readFileSync('./models/girl_char.md', 'utf8');
        return reply.renderWithGtm('add-chat.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd', chatId, isTemporaryChat, user, prompts});
      } catch (error) {
        console.log(error)
        return reply.status(500).send({ error: 'Failed to retrieve chatId' });
      }
    });
    fastify.get('/users', (request, reply) => {
      if (process.env.MODE == 'local') {
        reply.renderWithGtm('user-list.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' });
      } else {
        reply.redirect('/');
      }
    });

    fastify.get('/generate/:userid', (request, reply) => {
      const userId = request.params.userid;
      reply.renderWithGtm('generate.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd', userId: userId });
    });
    fastify.get('/dashboard', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {
      try {
        const userId = new fastify.mongo.ObjectId(request.user._id)
        const chatsCollection = db.collection('chats');
        const chats = await chatsCollection.find({ userId }).toArray();
        if(chats.length == 0){
          return reply.redirect('/chat/')
        }else{
          return reply.redirect('/chat/')
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
        return reply.renderWithGtm('/settings', { title: 'AIフレンズ  | Powered by Hato,Ltd', user:userData})
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
