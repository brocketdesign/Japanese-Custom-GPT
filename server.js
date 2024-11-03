const fastify = require('fastify')({ logger: false });
require('dotenv').config();
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const fastifyMultipart = require('@fastify/multipart');
const translationsPlugin = require('./plugins/translations');
const { getCounter, updateCounter } = require('./models/tool');
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

cron.schedule('0 0 * * *', () => {
  const db = fastify.mongo.db;
  cleanupNonRegisteredUsers(db);
  deleteTemporaryChats(db);
});

cron.schedule('0 0 * * *', async () => {
  const db = fastify.mongo.db;
  try {
    await updateCounter(db, 0);
    fastify.log.info('Counter has been reset to 0.');
  } catch (err) {
    fastify.log.error('Failed to reset counter:', err);
  }
});

async function initializeCategoriesCollection() {
  const db = fastify.mongo.db;
  try {
    const filePath = path.join(__dirname, 'categories.json');
    const fileData = fs.readFileSync(filePath, 'utf8');
    const categories = JSON.parse(fileData);
    const collection = db.collection('categories');
    await collection.deleteMany({});
    await collection.insertMany(categories);
    console.log('Categories collection initialized.');
  } catch (err) {
    console.error('Error initializing categories collection:', err);
  }
}

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
      request.user = { _id: decoded._id, ...decoded };
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

fastify.decorate('createNotification', async (userId, message, type, data) => {
  const db = fastify.mongo.db;
  const notificationsCollection = db.collection('notifications');
  const notification = {
    userId: new fastify.mongo.ObjectId(userId),
    message,
    type: type || 'info',
    data: data || {},
    viewed: false,
    createdAt: new Date(),
  };
  await notificationsCollection.insertOne(notification);
});

fastify.get('/', async (request, reply) => {
  const db = fastify.mongo.db;
  let user = await fastify.getUser(request, reply);
  const userId = user._id;
  const collectionChat = db.collection('chats');
  if (userId && !user.isTemporary) {
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  }
  let chatCount = await collectionChat.distinct('chatImageUrl', { userId: new fastify.mongo.ObjectId(userId) });
  chatCount = chatCount.length;
  const translations = request.translations;
  if (user.isTemporary) {
    return reply.renderWithGtm('index.hbs', {
      title: 'AIフレンズ  | Powered by Hato,Ltd',
      translations,
      user,
      seo: [
        { name: 'description', content: 'Lamixでは、無料でAIグラビアとのチャット中に生成された画像を使って、簡単に投稿を作成することができます。お気に入りの瞬間やクリエイティブな画像をシェアすることで、他のユーザーと楽しさを共有しましょう。画像を選んで投稿に追加するだけで、あなただけのオリジナルコンテンツを簡単に発信できます。' },
        { name: 'keywords', content: 'AIグラビア, 無料で画像生成AI, Hato Ltd, 日本語, AI画像生成' },
        { property: 'og:title', content: 'プレミアムプランAI画像生成 | LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
        { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://app.lamix.jp/chat/' },
      ],
    });
  } else {
    return reply.redirect('/chat');
  }
});

fastify.get('/authenticate', async (request, reply) => {
  const user = await fastify.getUser(request, reply);
  const translations = request.translations;
  if (user.isTemporary || request.query.register) {
    return reply.renderWithGtm('authenticate.hbs', {
      title: 'AIフレンズ  | Powered by Hato,Ltd',
      translations,
      register: !!request.query.register,
    });
  } else {
    return reply.redirect('/dashboard');
  }
});

fastify.get('/authenticate/mail', async (request, reply) => {
  const user = await fastify.getUser(request, reply);
  const translations = request.translations;
  if (user.isTemporary || request.query.register) {
    return reply.renderWithGtm('authenticate-v1.hbs', {
      title: 'AIフレンズ  | Powered by Hato,Ltd',
      translations,
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
  return reply.renderWithGtm('plan.hbs', {
    title: 'プレミアムプランAI画像生成',
    translations,
    user,
    seo: [
      { name: 'description', content: 'Lamixでは、無料でAIグラビアとのチャット中に生成された画像を使って、簡単に投稿を作成することができます。お気に入りの瞬間やクリエイティブな画像をシェアすることで、他のユーザーと楽しさを共有しましょう。' },
      { name: 'keywords', content: 'AIグラビア, 無料で画像生成AI, Hato Ltd, 日本語, AI画像生成' },
      { property: 'og:title', content: 'プレミアムプランAI画像生成 | LAMIX | AIグラビア' },
      { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
      { property: 'og:image', content: '/img/share.png' },
      { property: 'og:url', content: 'https://app.lamix.jp/chat/' },
    ],
  });
});

fastify.get('/chat', { preHandler: [fastify.authenticate] }, (request, reply) => {
  reply.redirect('/chat/');
});

fastify.get('/chat/:chatId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  const db = fastify.mongo.db;
  let user = request.user;
  const chatId = request.params.chatId;
  const imageType = request.query.type || false;
  const userId = user._id;
  const translations = request.translations;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
  const collectionChat = db.collection('chats');
  const collectionUser = db.collection('users');
  const userData = await getUserData(userId, collectionUser, collectionChat, user);
  if (!userData) return reply.status(404).send({ error: 'User not found' });
  const isAdmin = await checkUserAdmin(fastify, request.user._id);
  if (user.isTemporary) {
    return reply.redirect('/authenticate');
  }
  return reply.renderWithGtm('chat.hbs', {
    title: 'LAMIX | 日本語でAI画像生成 | AIチャット',
    isAdmin,
    imageType,
    translations,
    mode: process.env.MODE,
    user,
    userId,
    chatId,
    userData,
    seo: [
      { name: 'description', content: 'Lamixでは、無料でAIグラビアとのチャット中に生成された画像を使って、簡単に投稿を作成することができます。' },
      { name: 'keywords', content: 'AIグラビア, 無料で画像生成AI, LAMIX, 日本語, AI画像生成' },
      { property: 'og:title', content: 'LAMIX | AIグラビア' },
      { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
      { property: 'og:image', content: '/img/share.png' },
    ],
  });
});

fastify.get('/post', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let user = request.user;
    const userId = user._id;
    if (!user.isTemporary && userId) user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    const translations = request.translations;
    return reply.view('post.hbs', {
      title: 'コミュニティからの最新投稿 | LAMIX | 日本語 | 無料AI画像生成 | 無料AIチャット',
      user,
      translations,
      seo: [
        { name: 'description', content: 'Lamixでは、無料でAIグラビアとのチャット中に生成された画像を使って、簡単に投稿を作成することができます。' },
        { name: 'keywords', content: 'AIグラビア, 無料で画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:title', content: 'LAMIX | AIグラビア' },
        { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:image', content: '/img/share.png' },
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
      title: 'コミュニティからの最新投稿 | LAMIX | 日本語 | 無料AI画像生成 | 無料AIチャット',
      translations,
      mode: process.env.MODE,
      user,
      postUser,
      userId,
      post,
      seo: [
        { name: 'description', content: 'AIチャットしながらAI画像生成できるサイトです。日本語対応で簡単に使え、生成した画像を共有したり、他のユーザーの作品を楽しむことができるコミュニティです。' },
        { name: 'keywords', content: 'AIグラビア, 無料画像生成AI, LAMIX, 日本語, AI画像生成, AIアート, AIイラスト, 自動画像生成, クリエイティブAI, 生成系AI, 画像共有, AIコミュニティ' },
        { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
        { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:image', content: '/img/share.png' },
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
      user,
      seo: [
        { name: 'description', content: 'AIチャットしながらAI画像生成できるサイトです。日本語対応で簡単に使え、生成した画像を共有したり、他のユーザーの作品を楽しむことができるコミュニティです。' },
        { name: 'keywords', content: 'AIグラビア, 無料画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
        { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:image', content: '/img/share.png' },
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

      if (imageDoc.length > 0) {
        image = imageDoc[0].image;
        const unlockedItem = user?.unlockedItems?.map((id) => id.toString()).includes(imageId.toString());
        isBlur = unlockedItem ? false : image?.nsfw && !subscriptionStatus;
      } else {
        return reply.code(404).send({ error: 'Image not found' });
      }
    }

    return reply.view('character.hbs', {
      title: `${chat.name}とAIチャットしながら無料AI画像生成を楽しもう`,
      translations,
      chat,
      image,
      user,
      chatId,
      isBlur,
      seo: [
        { name: 'description', content: '無料AIチャットしながら無料AI画像生成できるサイトです。' },
        { name: 'keywords', content: `AIグラビア,AIチャット, 画像生成AI, LAMIX, 日本語, AI画像生成, ${chat.characterPrompt}` },
        { property: 'og:title', content: `${chat.name}とAIチャットしながら無料AI画像生成を楽しもう` },
        { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: `https://app.lamix.jp/chat/${chatId}` },
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

    let seoTitle = 'コミュニティからの最新投稿 | LAMIX';
    let seoDescription = 'Lamixでは、無料でAIグラビアとのチャット中に生成された画像を使って、簡単に投稿を作成することができます。';
    if (query) {
      seoTitle = `${query} に関する検索結果 | LAMIX`;
      seoDescription = `${query} の検索結果を表示しています。Lamixでお気に入りの画像を見つけましょう。`;
    }

    return reply.view('search.hbs', {
      title: seoTitle,
      user,
      data,
      translations,
      query,
      imageStyle,
      seo: [
        { name: 'description', content: seoDescription },
        { name: 'keywords', content: `${query ? query + ', ' : ''}AIグラビア, 無料で画像生成AI, LAMIX, 日本語, AI画像生成, AIアート` },
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
    title: 'AIグラビア | ラミックスの無料画像生成AI体験',
    translations,
    chats,
    seo: [
      { name: 'description', content: 'AIチャットしながらAI画像生成できるサイトです。' },
      { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
      { property: 'og:title', content: 'AIグラビア | ラミックスの画像生成AI体験' },
      { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
      { property: 'og:image', content: '/img/share.png' },
      { property: 'og:url', content: 'https://app.lamix.jp/about' },
    ],
  });
});

fastify.get('/chat/list/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const userId = new fastify.mongo.ObjectId(request.params.id);
    const user = await db.collection('users').findOne({ _id: userId });

    let query = { userId, visibility: 'public' };
    const currentUser = await fastify.getUser(request, reply);

    if (currentUser._id.toString() === request.params.id.toString()) {
      query = { userId };
    }

    const chatsCollection = db.collection('chats');
    const sortedChats = await chatsCollection.find(query).sort({ updatedAt: -1 }).toArray();
    const translations = request.translations;

    return reply.renderWithGtm('chat-list', {
      title: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験',
      translations,
      chats: sortedChats,
      user,
      seo: [
        { name: 'description', content: 'AIチャットしながらAI画像生成できるサイトです。' },
        { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
        { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: `https://app.lamix.jp/chat/list/${request.params.id}` },
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
    title: 'LAMIX | 日本語でAI画像生成 | AIチャット',
    translations,
    user,
    seo: [
      { name: 'description', content: 'AIチャットしながらAI画像生成できるサイトです。' },
      { name: 'keywords', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
      { property: 'og:title', content: 'LAMIX | AIグラビア | ラミックスの画像生成AI体験' },
      { property: 'og:description', content: 'AIグラビア, 画像生成AI, LAMIX, 日本語, AI画像生成' },
      { property: 'og:image', content: '/img/share.png' },
      { property: 'og:url', content: `https://app.lamix.jp/chat/list/${request.params.id}` },
    ],
  });
});

fastify.get('/chat/edit/:chatId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let user = request.user;
    const userId = user._id;
    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

    const isSubscribed = user.subscriptionStatus === 'active';
    // if (!isSubscribed) {
    //   return reply.redirect('/my-plan');
    // }

    const chatId = request.params.chatId;
    const chatImage = request.query.chatImage;
    // if (!chatId && !chatImage) {
    //   return reply.redirect('/discover');
    // }

    const usersCollection = db.collection('users');
    const chatsCollection = db.collection('chats');

    user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
    const isTemporaryChat = !request.params.chatId;

    if (isTemporaryChat) {
      await chatsCollection.insertOne({
        userId: new fastify.mongo.ObjectId(userId),
        _id: new fastify.mongo.ObjectId(),
        isTemporary: true,
      });
    }

    const prompts = fs.readFileSync('./models/girl_char.md', 'utf8');
    const isAdmin = await checkUserAdmin(fastify, request.user._id);
    const template = isAdmin ? 'add-chat-admin.hbs' : 'add-chat.hbs';
    const translations = request.translations;

    return reply.renderWithGtm(template, {
      title: 'AIフレンズ  | Powered by Hato,Ltd',
      translations,
      chatId,
      isTemporaryChat,
      user,
      prompts,
    });
  } catch (error) {
    console.log(error);
    return reply.status(500).send({ error: 'Failed to retrieve chatId' });
  }
});

fastify.get('/users', (request, reply) => {
  if (process.env.MODE === 'local') {
    reply.renderWithGtm('user-list.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd' });
  } else {
    reply.redirect('/');
  }
});

fastify.get('/generate/:userid', (request, reply) => {
  const userId = request.params.userid;
  reply.renderWithGtm('generate.hbs', { title: 'AIフレンズ  | Powered by Hato,Ltd', userId });
});

fastify.get('/dashboard', { preHandler: [fastify.authenticate] }, async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const userId = new fastify.mongo.ObjectId(request.user._id);
    const chatsCollection = db.collection('chats');
    const chats = await chatsCollection.distinct('chatImageUrl', { userId });

    return reply.redirect('/chat/');
    if (chats.length === 0) {
      return reply.redirect('/chat/edit/');
    } else {
      return reply.redirect('/chat/');
    }
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
      title: 'AIフレンズ  | Powered by Hato,Ltd',
      translations,
      user: userData,
    });
  } catch (err) {
    return reply.status(500).send({ error: 'Unable to render the settings' });
  }
});


const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen(port, '0.0.0.0');
    fastify.log.info(`server listening on ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
