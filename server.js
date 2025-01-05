const fastify = require('fastify')({ logger: false });
require('dotenv').config();
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const ip = require('ip');
const handlebars = require('handlebars');
const fastifyMultipart = require('@fastify/multipart');
const translationsPlugin = require('./plugins/translations');

const { updateCounter } = require('./models/tool');
const {
  cleanupNonRegisteredUsers,
  deleteTemporaryChats,
} = require('./models/cleanupNonRegisteredUsers');
const { checkUserAdmin, getUserData } = require('./models/tool');

fastify.register(require('fastify-mongodb'), {
  forceClose: true,
  url: process.env.MONGODB_URI,
  database: process.env.MONGODB_NAME,
});

cron.schedule('0 0 * * *', async () => {
  const db = fastify.mongo.db;
  try {
    cleanupNonRegisteredUsers(db);
    deleteTemporaryChats(db);
    await updateCounter(db, 0);
    fastify.log.info('Counter has been reset to 0.');
  } catch (err) {
    fastify.log.error('Failed to reset counter:', err);
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

fastify.after(() => {
  handlebars.registerHelper('default', (value, fallback) => value || fallback);
  handlebars.registerHelper('eq', (a, b) => a.toString() === b.toString());
  handlebars.registerHelper('json', (context) => JSON.stringify(context));
  handlebars.registerHelper('includesObjectId', (array, userId) =>
    array?.some((id) => id?.toString() === userId?.toString())
  );
  handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });
  handlebars.registerHelper('imagePlaceholder', () => `/img/nsfw-blurred-2.png`);
  handlebars.registerHelper('capitalize', (str) => (typeof str !== 'string' ? '' : str.charAt(0).toUpperCase() + str.slice(1)));
});

fastify.register(require('@fastify/cookie'), {
  secret: 'my-secret',
  parseOptions: {},
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

fastify.register(translationsPlugin);


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
fastify.register(require('./routes/scraper'));
fastify.register(require('./routes/user'));
fastify.register(require('./routes/admin'));
fastify.register(require('./routes/post'));
fastify.register(require('./routes/gallery'));
fastify.register(require('./routes/notifications'));

fastify.decorate('authenticate', async function (request, reply) {
  try {
    const token = request.cookies.token;
    if (!token) {
      return reply.redirect('/authenticate');
    }
    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    if (decoded && decoded._id) {
      //request.user = { _id: decoded._id, ...decoded };
    } else {
      return reply.redirect('/authenticate');
    }
  } catch (err) {
    return reply.redirect('/authenticate');
  }
});

fastify.addHook('onRequest', async (req, reply) => {
  if (process.env.MODE !== 'local' && req.headers['x-forwarded-proto'] !== 'https') {
    reply.redirect(`https://${req.headers['host']}${req.raw.url}`);
  }
});

fastify.get('/', async (request, reply) => {
  const db = fastify.mongo.db;
  let user = request.user;
  const userId = user._id;
  const collectionChat = db.collection('chats');
  if (userId && !user.isTemporary) {
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  }
  let chatCount = await collectionChat.distinct('chatImageUrl', { userId: new fastify.mongo.ObjectId(userId) });
  chatCount = chatCount.length;

  const translations = request.translations;
  const lang = request.lang

  if (user.isTemporary) {
    return reply.renderWithGtm(`index.hbs`, {
      title: translations.seo.title,
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      user: request.user,
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
  const user = request.user;
  const translations = request.translations;
  if (user.isTemporary || request.query.register) {
    return reply.renderWithGtm('authenticate.hbs', {
      title: 'AIフレンズ',
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      register: !!request.query.register,
    });
  } else {
    return reply.redirect('/dashboard');
  }
});

fastify.get('/authenticate/mail', async (request, reply) => {
  const user = request.user;
  const translations = request.translations;
  if (user.isTemporary || request.query.register) {
    return reply.renderWithGtm('authenticate-v1.hbs', {
      title: 'AIフレンズ',
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      register: !!request.query.register,
    });
  } else {
    return reply.redirect('/dashboard');
  }
});

fastify.get('/my-plan', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const db = fastify.mongo.db;
  let user = request.user;
  const userId = user._id;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  const translations = request.translations;
  const lang = request.lang
  return reply.renderWithGtm(`plan.hbs`, {
    title: 'プレミアムプランAI画像生成',
    translations,
    mode: process.env.MODE,
    apiurl: process.env.API_URL,
    user: request.user,
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

fastify.get('/chat', { preHandler: [fastify.authenticate] }, (request, reply) => {
  reply.redirect('/chat/');
});

fastify.get('/chat/:chatId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const db = fastify.mongo.db;

  const user = request.user; // Directly access the enriched user from preHandler
  const userId = user._id;

  const collectionChat = db.collection('chats');
  const collectionUser = db.collection('users');
  const userData = await getUserData(userId, collectionUser, collectionChat, user);

  if (!userData) return reply.status(404).send({ error: 'User not found' });

  if (user.isTemporary) {
    return reply.redirect('/authenticate');
  }

  const isAdmin = await checkUserAdmin(fastify, userId);
  const chatId = request.params.chatId;
  const imageType = request.query.type || false;
  const translations = request.translations;


  const chats = await collectionChat.distinct('chatImageUrl', { userId:new fastify.mongo.ObjectId(request.user._id) });
  if(chats.length === 0){
    return reply.redirect('/chat/edit/');
  }

  const promptData = await db.collection('prompts').find({}).toArray();

  return reply.renderWithGtm('chat.hbs', {
    title: translations.seo.title,
    isAdmin,
    imageType,
    translations,
    mode: process.env.MODE,
    apiurl: process.env.API_URL,
    user,
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

fastify.get('/chat/edit/:chatId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  try {
    const db = fastify.mongo.db;

    const usersCollection = db.collection('users');
    const chatsCollection = db.collection('chats');

    let user = request.user;
    const userId = user._id;

    user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });

    const chats = await chatsCollection.distinct('chatImageUrl', { userId });
    if(user.subscriptionStatus !== 'active' && chats.length > 0){
      return reply.redirect('/my-plan');
    }

    let chatId = request.params.chatId || null;
    const chatImage = request.query.chatImage;
    const isTemporaryChat = !request.params.chatId;

    const translations = request.translations;

    return reply.renderWithGtm('add-chat.hbs', {
      title: 'AIフレンズ',
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      chatId,
      modelId: request.query.modelId,
      isTemporaryChat,
      user: request.user,
    });
  } catch (error) {
    console.log(error);
    return reply.status(500).send({ error: 'Failed to retrieve chatId' });
  }
});
fastify.get('/post', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let user = request.user;
    const userId = user._id;
    if (!user.isTemporary && userId) user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    const translations = request.translations;
    return reply.view('post.hbs', {
      title: translations.seo.title_post,
      user: request.user,
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
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
    let user = request.user;
    const translations = request.translations;
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
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      user: request.user,
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
    let user = request.user;
    const translations = request.translations;
    const userId = user._id;
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

    return reply.view('character.hbs', {
      title: 'AIグラビアから送られてくる特別な写真 | LAMIX | 日本語 | 無料AI画像生成 | 無料AIチャット',
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      user: request.user,
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
    const translations = request.translations;
    let user = request.user;
    const userId = user._id;
    const chatId = new fastify.mongo.ObjectId(request.params.chatId);
    const imageId = request.query.imageId ? new fastify.mongo.ObjectId(request.query.imageId) : null;

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
        console.log(imageDoc)
      if (imageDoc.length > 0) {
        image = imageDoc[0].image;
        const unlockedItem = user?.unlockedItems?.map((id) => id.toString()).includes(imageId.toString());
        isBlur = unlockedItem ? false : image?.nsfw && !subscriptionStatus;
      } else {
        return reply.code(404).send({ error: 'Image not found' });
      }
    }

    return reply.view('character.hbs', {
      title: `${chat.name},${translations.seo.title_character}`,
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      chat,
      image,
      user: request.user,
      chatId,
      isBlur,
      seo: [
        { name: 'description', content: translations.seo.description_character },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: translations.seo.title_character },
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

fastify.get('/search', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let user = request.user;
    const userId = user._id;
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

    const translations = request.translations;
    const page = request.query.page || 1;
    const query = request.query.q || null;
    const imageStyle = request.query.imageStyle || 'anime';

    const baseUrl = `${request.protocol}://${request.hostname}`;
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
      user: request.user,
      data,
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
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
  const translations = request.translations;
  const collectionChats = db.collection('chats');
  const chats = await collectionChats
    .find({ visibility: { $exists: true, $eq: 'public' } })
    .sort({ _id: -1 })
    .limit(10)
    .toArray();

  return reply.renderWithGtm('chat.hbs', {
    title: translations.seo.title,
    translations,
    mode: process.env.MODE,
    apiurl: process.env.API_URL,
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

fastify.get('/chat/list/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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
    const translations = request.translations;

    return reply.renderWithGtm('chat-list', {
      title: translations.seo.title,
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
      chats: sortedChats,
      user: request.user,
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
  let user = request.user;
  const userId = user._id;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  const translations = request.translations;

  return reply.renderWithGtm('discover.hbs', {
    title: translations.seo.titl,
    translations,
    mode: process.env.MODE,
    apiurl: process.env.API_URL,
    user: request.user,
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
    reply.renderWithGtm('user-list.hbs', { title: 'AIフレンズ' });
  } else {
    reply.redirect('/');
  }
});

fastify.get('/generate/:userid', (request, reply) => {
  const userId = request.params.userid;
  reply.renderWithGtm('generate.hbs', { title: 'AIフレンズ', userId });
});

fastify.get('/dashboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
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

fastify.get('/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const userId = request.user._id;
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
    const translations = request.translations;

    return reply.renderWithGtm('/settings', {
      title: 'AIフレンズ',
      translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
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
