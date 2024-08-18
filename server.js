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
    fastify.register(fastifyMultipart);

    fastify.register(require('@fastify/mongodb'), { client: client });
    fastify.register(require('fastify-sse'));
    fastify.register(require('@fastify/formbody'));
    fastify.register(require('./routes/api'));
    fastify.register(require('./routes/stability'));
    fastify.register(require('./routes/plan'));
    fastify.register(require('./routes/scraper'));
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
      return reply.redirect('/chat-index')
    });

    fastify.get('/authenticate',async (request, reply) => {
      const user = await fastify.getUser(request, reply);
      if (user.isTemporary || request.query.register ) {
        return reply.view('authenticate.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' , register:!!request.query.register });
      } else {
        return reply.redirect('/dashboard')
      }
    });
    fastify.get('/authenticate/mail',async (request, reply) => {
      const user = await fastify.getUser(request, reply);
      if (user.isTemporary || request.query.register ) {
        return reply.view('authenticate-v1.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' , register:!!request.query.register });
      } else {
        return reply.redirect('/dashboard')
      }
    });
    fastify.get('/my-plan', async (request, reply) => {
      let user = await fastify.getUser(request, reply);
      const userId = user._id;
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      return reply.view('plan.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' , user });
    });
    fastify.get('/chat', (request, reply) => {
      reply.redirect('chat/');
    });
    fastify.get('/chat/:chatId', async (request, reply) => {
      let user = await fastify.getUser(request, reply);
      const chatId = request.params.chatId;
      const userId = user._id;
      const chatsCollection = db.collection('chats');
      const collectionUserChat = db.collection('userChat');

      // Fetch all chats for the given userId from the chats collection
      const userCreatedChats = await chatsCollection.find({ 
        userId: new fastify.mongo.ObjectId(userId) ,
        name:{$exists:true}
      }).sort({ _id: -1 }).toArray();
      //People chats
      
      const gohiai_girl = await chatsCollection.aggregate([
        {
          $match: {
            visibility: { $exists: true, $eq: "public" },
            scrap: true,
            ext: 'gohiai',
            category: '彼女'
          }
        },
        {
          $sample: { size: 50 } // Randomly select 50 documents
        }
      ]).toArray();
      /*
      const gohiai_man = await chatsCollection.aggregate([
        {
          $match: {
            visibility: { $exists: true, $eq: "public" },
            scrap: true,
            ext: 'gohiai',
            category: '彼氏'
          }
        },
        {
          $sample: { size: 50 } // Randomly select 50 documents
        }
      ]).toArray();   
      */
      
      const synclubaichat = await chatsCollection.aggregate([
        {
          $match: {
            visibility: { $exists: true, $eq: "public" },
            scrap: true,
            ext: 'synclubaichat',
          }
        },
        {
          $sample: { size: 50 } // Randomly select 50 documents
        }
      ]).toArray();      
      
      // Find recent characters
      const currentDateObj = new Date();
      const tokyoOffset = 9 * 60; // Offset in minutes for Tokyo (UTC+9)
      const tokyoTime = new Date(currentDateObj.getTime() + tokyoOffset * 60000);
      const sevenDaysAgo = new Date(tokyoTime);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0); // Ensure the start of the day
      
      // Assuming you have defined `sevenDaysAgo` as a Date object representing 7 days ago
      const recent = await chatsCollection.aggregate([
        {
          $match: {
            visibility: { $exists: true, $eq: "public" },
            chatImageUrl: { $exists: true, $ne: '' },
            updatedAt: { $gt: sevenDaysAgo }, // Filter for documents created within the last 7 days
          },
        },
        {
          $group: {
            _id: "$name",
            doc: { $first: "$$ROOT" },
          },
        },
        { $replaceRoot: { newRoot: "$doc" } },
        { $sample: { size: 20 } },
      ]).toArray();
      peopleChats = {gohiai_girl, synclubaichat, recent}
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });      
      return reply.view('custom-chat.hbs', { title: 'LAMIX | AIフレンズ | Powered by Hato,Ltd', user, userId, chatId, chats: userCreatedChats, peopleChats });
    });
    
    fastify.get('/character/:id', async (request, reply) => {
      const chatId = request.params.id;
      const chatsCollection = db.collection('chats');
      let data 
      try{
        data = await chatsCollection.findOne({ _id: new fastify.mongo.ObjectId(chatId) }); 
      }catch{}
      const allData = await chatsCollection.find({}).toArray(); 
      return reply.view('chat-detail.hbs', { title: 'LAMIX | AIフレンズ | Powered by Hato,Ltd', data, allData}); 
    });
    
    fastify.get('/chat-index', async(request, reply) => {
      return reply.redirect('chat/');
      const collectionChats = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
      const peopleChats = await collectionChats.find({
        visibility: { $exists: true, $eq: "public" }
      }).sort({_id:-1}).limit(10).toArray();
      return reply.view('custom-chat.hbs', { title: 'LAMIX | AIフレンズ | Powered by Hato,Ltd', peopleChats });
      //return reply.view('chat.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd',chats });
    });
    fastify.get('/about', async(request, reply) => {
      const collectionChats = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
      const chats = await collectionChats.find({
        visibility: { $exists: true, $eq: "public" }
      }).sort({_id:-1}).limit(10).toArray();
      return reply.view('chat.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd',chats });
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
        // Fetch chats that are not marked as deleted by the owner
        const sortedChats = await chatsCollection.find(query).sort({ "updatedAt": -1 }).toArray();

        return reply.view('chat-list', { title: 'LAMIX | AIフレンズ | Powered by Hato,Ltd', chats: sortedChats, user });
      } catch (err) {
        console.log(err);
        return reply.status(500).send({ error: 'Failed to retrieve chat list' });
      }
    });
    fastify.get('/discover', async (request, reply) => {
      let user = await fastify.getUser(request, reply);
      const userId = user._id;
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      return reply.view('chat-discover.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' , user });
    });

    fastify.get('/chat/edit/:chatId', {
      preHandler: [fastify.authenticate]
    }, async (request, reply) => {

      let chatId = request.params.chatId 
      const chatImage = request.query.chatImage
      if(!chatId && !chatImage){
        return reply.redirect('/discover')
      }
      try {
        let user = await fastify.getUser(request, reply);
        const userId = user._id;
        const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
        user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
       
        const isTemporaryChat = request.params.chatId ? false : true
        if(isTemporaryChat){
          chatId = new fastify.mongo.ObjectId()
          const chatsCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');
          await chatsCollection.insertOne({userId, _id : chatId})
        }
        const prompts = await fs.readFileSync('./models/girl_char.md', 'utf8');
        return reply.view('add-chat.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd', chatId, isTemporaryChat, user, prompts});
      } catch (error) {
        console.log(error)
        return reply.status(500).send({ error: 'Failed to retrieve chatId' });
      }
    });
    fastify.get('/users', (request, reply) => {
      if (process.env.MODE == 'local') {
        reply.view('user-list.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' });
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
              .view('index.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd', storyId: storyId, variant: variant });
          }).catch(err => {
            reply.send(err);
          });
        }).catch(err => {
          reply.send(err);
        });
      } else {
        reply.view('index.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd', storyId: storyId, variant: variant });
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
      reply.view('generate.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd', userId: userId });
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
        console.log(userData)
        return reply.view('/settings', { title: 'AIフレンズ  | Powered by Hato,Ltd', user:userData})
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
