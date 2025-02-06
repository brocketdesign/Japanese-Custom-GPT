const fastify = require('fastify')({ logger: false });
require('dotenv').config();
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const handlebars = require('handlebars');
const fastifyMultipart = require('@fastify/multipart');
const { generatePromptTitle } = require('./models/openai');
const {
  cleanupNonRegisteredUsers,
  deleteTemporaryChats,
} = require('./models/cleanupNonRegisteredUsers');
const { checkUserAdmin, getUserData, updateCounter, fetchTags } = require('./models/tool');
const { deleteOldTasks, deleteAllTasks } = require('./models/imagen');

fastify.register(require('@fastify/mongodb'), {
  forceClose: true,
  url: process.env.MONGODB_URI,
  database: process.env.MONGODB_NAME,
}, (err) => {
  if (err) {
    console.log('Failed to connect to database:', err);
    process.exit(1); // Exit the process if the database connection fails
  }
});

fastify.register(require('@fastify/cookie'), {
  secret: process.env.JWT_SECRET,
  parseOptions: {},
});

// Load global plugins
const fastifyPluginGlobals = require('./plugins/globals');
fastify.register(fastifyPluginGlobals);

// Wait for the database connection to be established 
fastify.ready(() => { 
  deleteAllTasks(fastify.mongo.db);
  const awsimages = fastify.mongo.db.collection('awsimages');
  awsimages.deleteMany({}, function(err, obj) {
    if (err) throw err;
    if(obj?.result){
      console.log(obj.result.n + " document(s) deleted");
    }
  });
});

cron.schedule('0 0 * * *', async () => {
  const db = fastify.mongo.db; // Access the database object after plugin registration
  try {
    // Check if the database is accessible
    await db.command({ ping: 1 });
    console.log('Database connection is healthy.');

    // Call your cleanup and update functions
    await cleanupNonRegisteredUsers(db);
    await deleteTemporaryChats(db);
    await deleteOldTasks(db);
    await updateCounter(db, 0);
    console.log('Counter has been reset to 0.');
  } catch (err) {
    console.log('Failed to execute cron tasks or access database:', err);
  }
});

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

const registerHelpers = require('./plugins/handlebars-helpers');
fastify.after(() => {
  registerHelpers();
});

fastify.register(require('@fastify/cors'), {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});


const websocketPlugin = require('@fastify/websocket');
fastify.register(websocketPlugin);
fastify.register(require('./plugins/websocket'));

fastify.decorateReply('renderWithGtm', function (template, data) {
  data = data || {};
  data.gtmId = process.env.GTM_ID;
  return this.view(template, data);
});

fastify.register(require('fastify-sse'));
fastify.register(require('@fastify/formbody'));
fastify.register(require('./routes/api'));
fastify.register(require('./routes/stability'));
fastify.register(require('./routes/plan'));
fastify.register(require('./routes/user'));
fastify.register(require('./routes/admin'));
fastify.register(require('./routes/post'));
fastify.register(require('./routes/notifications'));
fastify.register(require('./routes/gallery'));

fastify.get('/', async (request, reply) => {
  const db = fastify.mongo.db;
  let { translations, lang, user } = request;
  const userId = user._id;
  const collectionChat = db.collection('chats');
  if (userId && !user.isTemporary) {
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  }
  let chatCount = await collectionChat.distinct('chatImageUrl', { userId: new fastify.mongo.ObjectId(userId) });
  chatCount = chatCount.length;

  
  if (user.isTemporary) {
    return reply.renderWithGtm(`index.hbs`, {
      title: translations.seo.title,
      seo: [
        { name: 'description', content: translations.seo.description },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: translations.seo.title },
        { property: 'og:description', content: translations.seo.description },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/' },
      ],
    });
  } else {
    return reply.redirect('/chat');
  }
});

fastify.get('/authenticate', async (request, reply) => {
  let { translations, lang, user } = request;
  const withMail = request.query.withMail;
  const template = withMail ? 'authenticate-v1.hbs' : 'authenticate.hbs';
  if (user.isTemporary || request.query.register) {
    return reply.renderWithGtm(template, {
      title: 'AIフレンズ',
      register: !!request.query.register,
    });
  } else {
    return reply.redirect('/dashboard');
  }
});

fastify.get('/my-plan', async (request, reply) => {
  const db = fastify.mongo.db;
  let { translations, lang, user } = request;
  const userId = user._id;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

  return reply.renderWithGtm(`plan.hbs`, {
    title: 'プレミアムプランAI画像生成',
    
    seo: [
      { name: 'description', content: translations.seo.description_plan },
      { name: 'keywords', content: translations.seo.keywords },
      { property: 'og:title', content: translations.seo.title_plan },
      { property: 'og:description', content: translations.seo.description_plan },
      { property: 'og:image', content: '/img/share.png' },
      { property: 'og:url', content: 'https://chatlamix/' },
    ],
  });
});

fastify.get('/chat', (request, reply) => {
  reply.redirect('/chat/');
});

fastify.get('/chat/:chatId', async (request, reply) => {
  const db = fastify.mongo.db;
  
  let { translations, lang, user } = request;
  const userId = user._id;

  const collectionChat = db.collection('chats');
  const collectionUser = db.collection('users');
  const userData = await getUserData(userId, collectionUser, collectionChat, user);

  if (user.isTemporary || !userData) {
    return reply.redirect('/');
  }

  const isAdmin = await checkUserAdmin(fastify, userId);
  const chatId = request.params.chatId;
  const imageType = request.query.type || false;
  const newSubscription = request.query.newSubscription || false;

  const promptData = await db.collection('prompts').find({}).toArray();

  return reply.view('chat.hbs', {
    title: translations.seo.title,
    isAdmin,
    imageType,
    user,
    newSubscription,
    userId,
    chatId,
    userData,
    promptData,
    seo: [
      { name: 'description', content: translations.seo.description },
      { name: 'keywords', content: translations.seo.keywords },
      { property: 'og:title', content: translations.seo.title },
      { property: 'og:description', content: translations.seo.description },
      { property: 'og:image', content: '/img/share.png' },
      { property: 'og:url', content: 'https://chatlamix/' },
    ],
  });
});

fastify.get('/chat/edit/:chatId', async (request, reply) => {
  try {
    const db = fastify.mongo.db;

    const usersCollection = db.collection('users');
    const chatsCollection = db.collection('chats');

    let { translations, lang, user } = request;
    const userId = user._id;

    user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });

    const chats = await chatsCollection.distinct('chatImageUrl', { userId });

    if(user.subscriptionStatus !== 'active' && chats.length > 0){
      return false;
    }

    let chatId = request.params.chatId || null;
    const chatImage = request.query.chatImage;
    const isTemporaryChat = !request.params.chatId;

    request.query.limit = 20;
    const { tags, page, totalPages } = await fetchTags(db,request);
    // Assure that tags are unique by first converting them to lowercasing and then to a set then back to an array
    const uniqueTags = [...new Set(tags.map(tag => tag.toLowerCase()))];
    

    return reply.view('add-chat.hbs', {
      title: 'AIフレンズ',
      tags,
      
      
      chatId,
      modelId: request.query.modelId,
      isTemporaryChat,
      
    });
  } catch (error) {
    console.log(error);
    return reply.status(500).send({ error: 'Failed to retrieve chatId' });
  }
});
fastify.get('/post', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let { translations, lang, user } = request;
    const userId = user._id;
    if (!user.isTemporary && userId) user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    
    return reply.view('post.hbs', {
      title: translations.seo.title_post,
      seo: [
        { name: 'description', content: translations.seo.description_post },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: translations.seo.title_post },
        { property: 'og:description', content: translations.seo.description_post },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/' },
      ],
    });
  } catch (error) {
    console.log(error);
  }
});

fastify.get('/post/:postId', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let { translations, lang, user } = request;
    
    const userId = user._id;
    const postId = request.params.postId;

    if (!user.isTemporary && userId) user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    const post = await db.collection('posts').findOne({ _id: new fastify.mongo.ObjectId(postId) });

    if (!post) {
      return reply.code(404).send({ error: 'Post not found' });
    }

    const postUserId = post.userId;
    const postUser = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(postUserId) });

    return reply.renderWithGtm('post.hbs', {
      title: translations.seo.title_post,
      
      
      
      postUser,
      userId,
      post,
      seo: [
        { name: 'description', content: translations.seo.description_post },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: translations.seo.title_post },
        { property: 'og:description', content: translations.seo.description_post },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/' },
      ],
    });
  } catch (err) {
    console.log(err);
    return reply.code(500).send('Internal Server Error');
  }
});

fastify.get('/character', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let { translations, lang, user } = request;
    
    const userId = user._id;
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

    return reply.view('character.hbs', {
      title: 'AIグラビアから送られてくる特別な写真 | LAMIX | 日本語 | 無料AI画像生成 | 無料AIチャット',
      
      
      
      seo: [
        { name: 'description', content: translations.seo.description_character },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: translations.seo.title_character },
        { property: 'og:description', content: translations.seo.description_character },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/' },
      ],
    });
  } catch (error) {
    console.log(error);
    return reply.code(500).send('Internal Server Error');
  }
});

fastify.get('/character/:chatId', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    
    let { translations, lang, user } = request;
    const userId = user._id;
    const chatId = new fastify.mongo.ObjectId(request.params.chatId);
    const imageId = request.query.imageId ? new fastify.mongo.ObjectId(request.query.imageId) : null;
    const isModal = request.query.modal === 'true';
    
    const chatsCollection = db.collection('chats');
    const galleryCollection = db.collection('gallery');

    let subscriptionStatus = false;
    if (!user.isTemporary && userId) {
      user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
      subscriptionStatus = user.subscriptionStatus === 'active';
    }

    const chat = await chatsCollection.findOne({ _id: chatId });
    if (!chat) {
      return reply.code(404).send({ error: 'Chat not found' });
    }

    let image = null;
    let isBlur = false;
    if (imageId) {
      const imageDoc = await galleryCollection
        .aggregate([
          { $match: { chatId: chatId } },
          { $unwind: '$images' },
          { $match: { 'images._id': imageId } },
          { $project: { image: '$images', _id: 0 } },
        ])
        .toArray();
        // Generate prompt title if it doesn't exist and save it to the image doc in the db then send it using websocket
        if (!imageDoc[0].image.title || !imageDoc[0].image.title.en || !imageDoc[0].image.title.ja || !imageDoc[0].image.title.fr) {
            const generateTitles = async () => {
              const title_en = await generatePromptTitle(imageDoc[0].image.prompt, 'english');
              const title_ja = await generatePromptTitle(imageDoc[0].image.prompt, 'japanese');
              const title_fr = await generatePromptTitle(imageDoc[0].image.prompt, 'french');
              return {
                en: title_en,
                ja: title_ja,
                fr: title_fr
              };
            };

            generateTitles().then((title) => {

              galleryCollection.updateOne(
                { 'images._id': imageId },
                { $set: { 'images.$.title': title } }
              );

              fastify.sendNotificationToUser(userId, 'updateImageTitle', { title });
            }).catch((err) => {
            console.error('Failed to generate titles:', err);
            });
        }
      if (imageDoc.length > 0) {
        image = imageDoc[0].image;
        const unlockedItem = user?.unlockedItems?.map((id) => id.toString()).includes(imageId.toString());
        isBlur = unlockedItem ? false : image?.nsfw && !subscriptionStatus;
      } else {
        return reply.code(404).send({ error: 'Image not found' });
      }
    }
    // Log user activity 
    console.log(`Visiting Character ${chat.name}, ${image?.title?.en || ''}, /character/${chatId.toString()}${imageId ? `?imageId=${imageId}` : ''}`);
    const template = isModal ? 'character-modal.hbs' : 'character.hbs';
    return reply.renderWithGtm(template, {
      title: `${chat.name} | ${image?.title?.[request.lang] ?? ''} ${translations.seo.title_character}`,
      chat,
      image,
      chatId,
      isBlur,
      seo: [
        { name: 'description', content: translations.seo.description_character },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content:  `${chat.name} | ${image?.title?.[request.lang]} | ${translations.seo.title_character}` },
        { property: 'og:description', content: translations.seo.description_character },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/' },
      ],
    });
  } catch (err) {
    console.error(err);
    reply.code(500).send('Internal Server Error');
  }
});


fastify.get('/tags', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    
    const { tags, page, totalPages } = await fetchTags(db,request);
    return reply.view('tags.hbs', {
      title: `${translations.seo.title_tags} ${translations.seo.page} ${page}`,
      
      tags,
      page,
      totalPages,
      
      
      seo: [
        { name: 'description', content: translations.seo.description_tags },
        { name: 'keywords', content: `${translations.seo.keywords}` },
        { property: 'og:title', content: translations.seo.title_tags },
        { property: 'og:description', content: translations.seo.description_tags },
        { property: 'og:image', content: '/img/share.png' },
      ],
    });
  } catch (error) {
  console.error('Error displaying tags:', error);
  reply.status(500).send({ error: 'Failed to display tags' });
  }
});

fastify.get('/search', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let { translations, lang, user } = request;
    const userId = user._id;
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

    
    const page = request.query.page || 1;
    const query = request.query.q || request.query.query || null;
    const imageStyle = request.query.imageStyle || 'anime';

    console.log('Page: ', page);
    console.log('Query: ', query);
    console.log('Image Style: ', imageStyle);

    const baseUrl = process.env.MODE === 'local' ? 'http://localhost:3000' : `${request.protocol}://${request.hostname}`;
    const response = await fetch(`${baseUrl}/api/chats?page=${page}&type=${imageStyle}&q=${encodeURIComponent(query)}`);

    if (!response.ok) {
      console.log(`Failed to fetch chats: ${response.statusText}`);
    }

    const data = await response.json();

    let seoTitle = translations.seo_title_default; 
    let seoDescription = translations.seo_description_default;
    
    if (query) {
      seoTitle = translations.seo_title_query.replace('${query}', query);
      seoDescription = translations.seo_description_query.replace('${query}', query);
    }
    

    return reply.view('search.hbs', {
      title: seoTitle,
      
      data,
      
      
      query,
      imageStyle,
      seo: [
        { name: 'description', content: seoDescription },
        { name: 'keywords', content: `${query ? query + ', ' : ''}${translations.seo.keywords}` },
        { property: 'og:title', content: seoTitle },
        { property: 'og:description', content: seoDescription },
        { property: 'og:image', content: '/img/share.png' },
      ],
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/about', async (request, reply) => {
  const db = fastify.mongo.db;
  
  const collectionChats = db.collection('chats');
  const chats = await collectionChats
    .find({ visibility: { $exists: true, $eq: 'public' } })
    .sort({ _id: -1 })
    .limit(10)
    .toArray();

  return reply.renderWithGtm('chat.hbs', {
    title: translations.seo.title,
   
    
    
    chats,
    seo: [
      { name: 'description', content: translations.seo.description },
      { name: 'keywords', content: translations.seo.keywords },
      { property: 'og:title', content: translations.seo.title },
      { property: 'og:description', content: translations.seo.description },
      { property: 'og:image', content: '/img/share.png' },
      { property: 'og:url', content: 'https://chatlamix/' },
    ],
  });
});

fastify.get('/chat/list/:id', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const userId = new fastify.mongo.ObjectId(request.params.id);
    const user = await db.collection('users').findOne({ _id: userId });

    let query = { userId, visibility: 'public' };
    const currentUser = request.user;

    if (currentUser._id.toString() === request.params.id.toString()) {
      query = { userId };
    }

    const chatsCollection = db.collection('chats');
    const sortedChats = await chatsCollection.find(query).sort({ updatedAt: -1 }).toArray();
    

    return reply.view('chat-list', {
      title: translations.seo.title,
      
      
      chats: sortedChats,
      
      seo: [
        { name: 'description', content: translations.seo.description },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: translations.seo.title },
        { property: 'og:description', content: translations.seo.description },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/' },
      ],
    });
  } catch (err) {
    console.log(err);
    return reply.status(500).send({ error: 'Failed to retrieve chat list' });
  }
});

fastify.get('/discover', async (request, reply) => {
  const db = fastify.mongo.db;
  let { translations, lang, user } = request;
  const userId = user._id;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  

  return reply.renderWithGtm('discover.hbs', {
    title: translations.seo.titl,
   
    
    
    
    seo: [
      { name: 'description', content: translations.seo.description },
      { name: 'keywords', content: translations.seo.keywords },
      { property: 'og:title', content: translations.seo.title },
      { property: 'og:description', content: translations.seo.description },
      { property: 'og:image', content: '/img/share.png' },
      { property: 'og:url', content: 'https://chatlamix/' },
    ],
  });
});



fastify.get('/users', (request, reply) => {
  if (process.env.MODE === 'local') {
    reply.view('user-list.hbs', { title: 'AIフレンズ' });
  } else {
    reply.redirect('/');
  }
});

fastify.get('/generate/:userid', (request, reply) => {
  const userId = request.params.userid;
  reply.view('generate.hbs', { title: 'AIフレンズ', userId });
});

fastify.get('/dashboard', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const userId = new fastify.mongo.ObjectId(request.user._id);
    const chatsCollection = db.collection('chats');
    const chats = await chatsCollection.distinct('chatImageUrl', { userId });
    if(chats.length === 0){
      return reply.redirect('/chat/edit/');
    }
    return reply.redirect('/chat/');
  } catch (err) {
    return reply.status(500).send({ error: 'Unable to render the dashboard' });
  }
});

fastify.get('/settings', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const userId = request.user._id;
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
    

    return reply.view('/settings', {
      title: 'AIフレンズ',
      
      
      user: userData,
    });
  } catch (err) {
    return reply.status(500).send({ error: 'Unable to render the settings' });
  }
});


const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`Fastify running → PORT http://${ip.address()}:${port}`);
    });
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
};

start();
