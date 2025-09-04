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
} = require('./models/databasemanagement');
const { checkUserAdmin, getUserData, updateCounter, fetchTags } = require('./models/tool');
const { deleteOldTasks } = require('./models/imagen');
const { cronJobs, cacheSitemapDataTask, configureCronJob, initializeCronJobs } = require('./models/cronManager');

// Expose cron jobs and configuration to routes
fastify.decorate('cronJobs', cronJobs);
fastify.decorate('configureCronJob', configureCronJob);

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


// Wait for the database connection to be established 
fastify.ready(async () => { 
  const awsimages = fastify.mongo.db.collection('awsimages');
  awsimages.deleteMany({}, function(err, obj) {
    if (err) throw err;
    if(obj?.result){
      console.log(obj.result.n + " document(s) deleted");
    }
  });

  // Initialize configured cron jobs
  await initializeCronJobs(fastify);
});

// Every 3 cron jobs for cleanup and maintenance
cron.schedule('0 0 * * *', async () => {
  const db = fastify.mongo.db; // Access the database object after plugin registration
  try {
    // Check if the database is accessible
    await db.command({ ping: 1 });
    console.log('Database connection is healthy.');

    // Call your cleanup and update functions
    cleanupNonRegisteredUsers(db);
    deleteTemporaryChats(db);
    deleteOldTasks(db);
    updateCounter(db, 0);
    

  } catch (err) {
    console.log('Failed to execute cron tasks or access database:', err);
  }
});

fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
});

// Create partials for Handlebars
const partials = [
  'dashboard-header',
  'dashboard-nav',
  'dashboard-footer',
  'dashboard-avatar',
  'chat-header',
  'chat-footer',
  'chat-list',
  'dashboard-modals',
  'translations',
  'footer-toolbar',
  'onboarding-modals'
];

partials.forEach(partial => {
  const partialPath = path.join(__dirname, 'views', 'partials', `${partial}.hbs`);
  const partialContent = fs.readFileSync(partialPath, 'utf8');
  handlebars.registerPartial(partial, partialContent);
});

fastify.register(require('@fastify/view'), {
  engine: { handlebars: require('handlebars') },
  root: path.join(__dirname, 'views'),
});

const registerHelpers = require('./plugins/handlebars-helpers');
fastify.after(() => {
  registerHelpers();
});

fastify.register(require('@fastify/cors'), {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return cb(null, true);
    // In local development, you might want to allow your specific local frontend origin
    // For production, you'd list your allowed frontend domains
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      `http://${ip.address()}:3000`,
      'https://app.chatlamix.com',
      'https://chat.lamixapp.com',
      'https://chatlamix.com',
      'https://en.chatlamix.com',
      'https://fr.chatlamix.com',
      'https://ja.chatlamix.com',
      'https://jp.chatlamix.com',
      'https://www.chatlamix.com'
    ];
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.MODE === 'local') {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const slugify = require('slugify');
fastify.register(require('fastify-sse'));
fastify.register(require('@fastify/formbody'));

// Register WebSocket plugin BEFORE loading other plugins that depend on it
const websocketPlugin = require('@fastify/websocket');
fastify.register(websocketPlugin);
fastify.register(require('./plugins/websocket')); // Add this line

// Load global plugins
const fastifyPluginGlobals = require('./plugins/globals');
fastify.register(fastifyPluginGlobals);

// Register all routes from the routes plugin
fastify.register(require('./plugins/routes'));

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

  const signOut = request.query.signOut == 'true' || false;

  if (signOut || user.isTemporary) {
    let bannerNumber = parseInt(request.query.banner) || 0;
    bannerNumber = Math.min(bannerNumber, 3);
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
      bannerNumber
    });
  } else {
    return reply.redirect('/chat');
  }
});

fastify.get('/signin-redirection', async (request, reply) => {
  const db = fastify.mongo.db;
  let { translations, lang, user } = request;
  const userId = user._id;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

  return reply.renderWithGtm(`signin.hbs`, {
    title: 'LAMIXAI画像生成',
  });
});

fastify.get('/signout-redirection', async (request, reply) => {
  console.log('signout-redirection')
  const db = fastify.mongo.db;
  let { translations, lang, user } = request;
  const userId = user._id;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

  return reply.renderWithGtm(`signout.hbs`, {
    title: 'LAMIXAI画像生成',
  });
});

// old login
fastify.get('/login', async (request, reply) => {
  const db = fastify.mongo.db;
  let { translations, lang, user } = request;
  const userId = user._id;
  user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

  return reply.renderWithGtm(`login.hbs`, {
    title: 'LAMIXAI画像生成',
  });
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

  const signIn = request.query.signIn == 'true' || false;
  const signOut = request.query.signOut == 'true' || false;

  if (!signIn && (signOut || user.isTemporary || !userData)) {
    return reply.redirect('/');
  }

  const isAdmin = await checkUserAdmin(fastify, userId);
  const chatId = request.params.chatId;
  const imageType = request.query.type || false;
  const newSubscription = request.query.newSubscription || false;

  const promptData = await db.collection('prompts').find({}).sort({order: 1}).toArray();
  const giftData = await db.collection('gifts').find({}).sort({order: 1}).toArray();

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
    giftData,
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

    if((user && user.subscriptionStatus !== 'active') && chats.length > 0){
      return false;
    }

    let chatId = request.params.chatId || null;
    const chatImage = request.query.chatImage;
    const isTemporaryChat = !request.params.chatId;

    request.query.limit = 20;
    request.query.page = 'random';
    const { tags, page, totalPages } = await fetchTags(db,request);
    // Assure that tags are unique by first converting them to lowercasing and then to a set then back to an array
    const uniqueTags = [...new Set(tags.map(tag => tag.toLowerCase()))];
    

    return reply.view('character-creation.hbs', {
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

fastify.get('/character-update/:chatId', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    let { translations, lang, user } = request;
    const userId = user._id;
    const { chatId } = request.params;
    console.log(`[/character-update/:chatId] User ID: ${userId}, Chat ID: ${chatId}`);
    if (!fastify.mongo.ObjectId.isValid(chatId)) {
      return reply.status(400).send({ error: 'Invalid chat ID' });
    }

    // Check if user owns this character
    const chat = await db.collection('chats').findOne({
      _id: new fastify.mongo.ObjectId(chatId),
      userId: new fastify.mongo.ObjectId(userId)
    });

    if (!chat) {
      return reply.status(404).send({ error: 'Character not found or access denied' });
    }

    return reply.view('character-update.hbs', {
      title: `${translations.characterUpdate?.updateCharacter || 'Update Character'} - ${chat.name}`,
      chatId,
      chat
    });
  } catch (error) {
    console.error('Error loading character update page:', error);
    return reply.status(500).send({ error: 'Failed to load character update page' });
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

    return reply.renderWithGtm('character.hbs', {
      title: translations.seo.title_character || 'Ai images generator & Ai chat',
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


// Helper function to tokenize a prompt string
function tokenizePrompt(promptText) {
  if (!promptText || typeof promptText !== 'string') {
    return new Set();
  }
  return new Set(
    promptText
      .toLowerCase()
      .split(/\W+/) // Split by non-alphanumeric characters
      .filter(token => token.length > 0) // Remove empty tokens
  );
}

// Route to handle character slug
fastify.get('/character/slug/:slug', async (request, reply) => {
  const startTime = Date.now();
  
  try {
    const db = fastify.mongo.db;
    const { translations, lang, user } = request;
    const currentUserId = user._id; 
    const { slug } = request.params;
    const imageSlug = request.query.imageSlug || null;
    const isModal = request.query.modal === 'true';

    console.time(`character-slug-${slug}`);

    // Parallel query execution for independent data
    const [chat, currentUserData] = await Promise.all([
      db.collection('chats').findOne({ 
        slug,
        chatImageUrl: { $exists: true, $ne: null },
      }),
      !user.isTemporary && currentUserId ? 
        db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(currentUserId) }) : 
        Promise.resolve(user)
    ]);

    if (!chat) {
      console.warn(`[/character/:slug] Chat not found for slug: ${slug}`);
      return reply.code(404).send({ error: 'Chat not found' });
    }

    let chatIdObjectId = chat._id;
    let chatIdParam = chat._id.toString();
    try {
      chatIdObjectId = new fastify.mongo.ObjectId(chatIdParam);
    } catch (e) {
      console.error(`[/character/:slug] Invalid Chat ID format: ${chatIdParam}`);
      return reply.code(400).send({ error: 'Invalid Chat ID format' });
    }

    // Determine subscription status
    let subscriptionStatus = false;
    if (currentUserData && !currentUserData.isTemporary) {
      subscriptionStatus = currentUserData.subscriptionStatus === 'active';
    }

    // Optimized image lookup
    let image = null;
    let isBlur = false;
    let imageId = null;
    
    if (imageSlug) {
      // More efficient image query using findOne with array filtering
      const gallery = await db.collection('gallery').findOne(
        { 
          chatId: chatIdObjectId,
          'images.slug': imageSlug 
        },
        { 
          projection: { 
            'images.$': 1 // This returns only the matching image
          } 
        }
      );

      if (gallery?.images?.[0]) {
        image = gallery.images[0];
        imageId = image._id;

        try {
          imageId = new fastify.mongo.ObjectId(imageId);
        } catch (e) {
          console.error(`[/character/:slug] Invalid Image ID format: ${imageId}`);
          return reply.code(400).send({ error: 'Invalid Image ID format' });
        }

        // Check if this is an upscaled image with an originalImageId
        if (image.isUpscaled && image.originalImageId) {
          try {
            const originalImageId = new fastify.mongo.ObjectId(image.originalImageId);
            
            // Find the original image in the gallery
            const originalGallery = await db.collection('gallery').findOne(
              { 
                chatId: chatIdObjectId,
                'images._id': originalImageId 
              },
              { 
                projection: { 
                  'images.$': 1
                } 
              }
            );
            
            if (originalGallery?.images?.[0]?.slug) {
              // Redirect to the original image with the same query parameters
              const { modal } = request.query;
              let queryString = `?imageSlug=${originalGallery.images[0].slug}`;
              if (modal) {
                queryString += `&modal=${modal}`;
              }
              
              return reply.redirect(`/character/slug/${chat.slug}${queryString}`);
            }
          } catch (err) {
            console.error(`[/character/:slug] Error processing originalImageId: ${image.originalImageId}`, err);
            // Continue with the upscaled image if we can't find the original
          }
        }

        // Async title generation (non-blocking)
        if (
          !image.title ||
          typeof image.title !== 'object' ||
          !image.title.en ||
          !image.title.ja ||
          !image.title.fr
        ) {
          const existingTitle = image.title || {};
          const generateTitles = async () => {
            const title = { ...existingTitle };
            if (!title.en) title.en = await generatePromptTitle(image.prompt, 'english');
            if (!title.ja) title.ja = await generatePromptTitle(image.prompt, 'japanese');  
            if (!title.fr) title.fr = await generatePromptTitle(image.prompt, 'french');
            return title;
          };

          // Don't await this - let it run in background
          generateTitles().then((title) => {
            db.collection('gallery').updateOne(
              { 'images._id': imageId },
              { $set: { 'images.$.title': title } }
            );

          }).catch((err) => {
            console.error('[SimilarChats] Failed to generate titles for image:', err);
          });
        }
        
        const unlockedItem = currentUserData?.unlockedItems?.map((id) => id.toString()).includes(imageId.toString());
        isBlur = unlockedItem ? false : image?.nsfw && !subscriptionStatus;
      } else {
        console.warn(`[SimilarChats] Image not found for slug: ${imageSlug} in chat ${chatIdParam}`);
      }
    }

    // Render immediately
    const template = isModal ? 'character-modal.hbs' : 'character.hbs';
    const response = reply.renderWithGtm(template, {
      title: `${chat.name} | ${translations.seo.title_character}`,
      chat,
      image,
      chatId: chatIdParam,
      isBlur,
      similarChats: [], // Will be populated via websocket
      user: currentUserData,
      seo: [
        { name: 'description', content: ` ${image?.title?.[request.lang] ?? chat.description ?? ''} | ${translations.seo.description_character}` },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: `${chat.name} | ${translations.seo.title_character}` },
        { property: 'og:description', content: `${image?.title?.[request.lang] ?? chat.description ?? ''} | ${translations.seo.description_character}` },
        { property: 'og:image', content: chat.chatImageUrl || '/img/share.png' },
        { property: 'og:url', content: `https://chatlamix/character/${chatIdParam}` },
      ],
    });
    
    return response;

  } catch (err) {
    console.log(`[/character/slug/:slug] Request failed after: ${Date.now() - startTime}ms`);
    console.error(`[SimilarChats] Error in /character/slug/:slug route for ${request.params.slug}:`, err);
    reply.code(500).send('Internal Server Error');
  }
});

fastify.get('/character/:chatId', async (request, reply) => {
  const db = fastify.mongo.db;
  let chatId = request.params.chatId;
  let chat;
  try {
    chat = await db.collection('chats').findOne({ _id: new fastify.mongo.ObjectId(chatId) });
  } catch (e) {
    // If not a valid ObjectId, treat as slug
    console.error(`[character/:chatId] Invalid Chat ID format: ${chatId}. Error:`, e);
    return reply.redirect(`/character/`);
  }
  if (!chat) {
    console.warn(`[character/:chatId] No chat found for chatId: ${chatId}. Redirecting to /character/`);
    return reply.redirect(`/character/`);
  }
  
  // Check if a slug is present; if not use slugify to create one and save it
  if (!chat.slug) {
    let slug = slugify(chat.name, { lower: true, strict: true });
    // Check for duplicate slug
    const slugExists = await db.collection('chats').findOne({ slug, _id: { $ne: chat._id } });
    if (slugExists) {
      // Append short random string for uniqueness
      const randomStr = Math.random().toString(36).substring(2, 6);
      slug = `${slug}-${randomStr}`;
    }

    await db.collection('chats').updateOne({ _id: new fastify.mongo.ObjectId(chatId) }, { $set: { slug } });
    chat.slug = slug;

  }

  let imageId = request.query.imageId ? request.query.imageId : null;
  let imageSlug;
  if (imageId) {
    try {
      imageId = new fastify.mongo.ObjectId(imageId);
      const galleryCollection = db.collection('gallery');
      
      // Find the image in the gallery
      const imageDoc = await galleryCollection.aggregate([
        { $match: { chatId: chat._id } },
        { $unwind: '$images' },
        { $match: { 'images._id': imageId } },
        { $project: { image: '$images', _id: 0 } }
      ]).toArray();

      if (imageDoc.length > 0 && imageDoc[0].image) {
        // Check if image already has a slug
        if (!imageDoc[0].image.slug) {
          // Get a title to use for the slug
          const imageTitle = typeof imageDoc[0].image.title === 'string'
            ? imageDoc[0].image.title
            : (imageDoc[0].image.title?.en || imageDoc[0].image.title?.ja || imageDoc[0].image.title?.fr || '');

          if (imageTitle) {
            // Create slug with chat slug prefix and limit length
            const titleSlug = slugify(imageTitle, { lower: true, strict: true });
            // Limit the title part to 30 chars max
            const shortTitleSlug = titleSlug.substring(0, 30);
            imageSlug = `${chat.slug}-${shortTitleSlug}`;
            
            // Check if this image slug already exists
            const slugExists = await galleryCollection.findOne({
              'images.slug': imageSlug,
              'images._id': { $ne: imageId }
            });
            
            if (slugExists) {
              // Add unique suffix
              const randomStr = Math.random().toString(36).substring(2, 6);
              imageSlug = `${imageSlug}-${randomStr}`;
            }
            
            await galleryCollection.updateOne(
              { 'images._id': imageId },
              { $set: { 'images.$.slug': imageSlug } }
            );
          }
        } else {
          imageSlug = imageDoc[0].image.slug;
        }
      }
    } catch (err) {
      console.error(`[character/:chatId] Error processing imageId: ${imageId}`, err);
    }
  }
  // Check all query parameters
  const { modal } = request.query;

  // Preserve original query parameters
  let queryString = '';
  if (imageSlug) {
    queryString = `?imageSlug=${imageSlug}`;
    if (modal) {
      queryString += `&modal=${modal}`;
    }
  } else if (modal) {
    queryString = `?modal=${modal}`;
  }

  // Redirect to slug route for SEO, keeping query params
  return reply.redirect(`/character/slug/${chat.slug}${queryString}`);
});

fastify.get('/tags', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const { translations, lang, user } = request;
    const { tags, page, totalPages } = await fetchTags(db,request);
    return reply.renderWithGtm('tags.hbs', {
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

    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) }) || request.user;

    const page = parseInt(request.query.page) || 1;
    const query = request.query.q || request.query.query || '';
    const limit = 30;

    const baseUrl = process.env.MODE === 'local' ? `http://${ip.address()}:3000` : `${request.protocol}://${request.hostname}`;

    // Fetch image results (reuse /chats/images/search logic)
    const imageSearchUrl = `${baseUrl}/chats/images/search?page=${page}&query=${encodeURIComponent(query)}&limit=${limit}`;

    const imageRes = await fetch(imageSearchUrl);
    const imageData = imageRes.ok ? await imageRes.json() : { images: [] };
    if (!imageRes.ok) {
      console.warn(`[SEARCH] Image fetch failed with status: ${imageRes.status}`);
    }

    // Compute isBlur for each image
    const subscriptionStatus = user && user.subscriptionStatus === 'active';
    const processedImageResults = (imageData.images || []).map(item => {
      const isBlur = item.nsfw && !subscriptionStatus;
      return { ...item, isBlur };
    });

    const totalPages = imageData.totalPages || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    let seoTitle = translations.seo_title_default; 
    let seoDescription = translations.seo_description_default;
    if (query) {
      seoTitle = translations.seo_title_query.replace('${query}', query);
      seoDescription = translations.seo_description_query.replace('${query}', query);
    }

    // Fetch tags from a random page
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const tagsUrl = `${baseUrl}/api/tags?page=${randomPage}`;
    const tagsRes = await fetch(tagsUrl);
    const tagsData = tagsRes.ok ? await tagsRes.json() : { tags: [] };
    if (!tagsRes.ok) {
      console.warn(`[SEARCH] Tags fetch failed with status: ${tagsRes.status}`);
    } 
    const tags = tagsData.tags || [];
console.log(processedImageResults[0])
    return reply.renderWithGtm('search.hbs', {
      title: seoTitle,
      imageResults: processedImageResults,
      totalPages,
      currentPage: page,
      hasPrevPage,
      hasNextPage,
      query,
      tags,
      user,
      translations,
      seo: [
        { name: 'description', content: seoDescription },
        { name: 'keywords', content: `${query ? query + ', ' : ''}${translations.seo.keywords}` },
        { property: 'og:title', content: seoTitle },
        { property: 'og:description', content: seoDescription },
        { property: 'og:image', content: '/img/share.png' },
      ],
    });
  } catch (error) {
    console.error('[SEARCH] Error occurred:', error);
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

fastify.get('/debug/tasks-status', async (request, reply) => {
  const db = fastify.mongo.db;
  
  const recentTasks = await db.collection('tasks').find({
    createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 minutes
  }).sort({ createdAt: -1 }).toArray();
  
  const pendingTasks = await db.collection('tasks').find({ status: 'pending' }).toArray();
  const backgroundTasks = await db.collection('tasks').find({ status: 'background' }).toArray();
  
  return {
    recentTasks: recentTasks.length,
    pendingTasks: pendingTasks.length,
    backgroundTasks: backgroundTasks.length,
    tasks: recentTasks.map(task => ({
      taskId: task.taskId,
      status: task.status,
      chatCreation: task.chatCreation,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      processedAt: task.processedAt
    }))
  };
});

fastify.get('/settings', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const userId = request.user._id;
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
    const isAdmin = await checkUserAdmin(fastify, userId);

    return reply.view('/settings', {
      title: 'AIフレンズ',
      isAdmin,
      user: userData,
    });
  } catch (err) {
    return reply.status(500).send({ error: 'Unable to render the settings' });
  }
});

// Add sitemap route before the existing routes
fastify.get('/sitemap', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const { getCachedSitemapData } = require('./models/sitemap-utils');
    let { translations, lang, user } = request;
    
    // Get cached sitemap data (this will generate if not found)
    let sitemapData = await getCachedSitemapData(db);
    
    // If still no cached data after generation attempt, provide fallback
    if (!sitemapData) {
      console.log('[/sitemap] No cached data available, using empty fallback');
      sitemapData = {
        characters: {},
        tags: [],
        totalCharacters: 0,
        totalTags: 0,
        lastUpdated: new Date()
      };
    }
    
    return reply.renderWithGtm('sitemap.hbs', {
      title: `${translations.sitemap?.title || 'Sitemap'} | ${translations.seo.title}`,
      characters: sitemapData.characters,
      tags: sitemapData.tags,
      totalCharacters: sitemapData.totalCharacters,
      totalTags: sitemapData.totalTags,
      lastUpdated: sitemapData.lastUpdated,
      seo: [
        { name: 'description', content: translations.sitemap?.description || 'Complete sitemap of all characters and tags' },
        { name: 'keywords', content: `sitemap, characters, tags, ${translations.seo.keywords}` },
        { property: 'og:title', content: `${translations.sitemap?.title || 'Sitemap'} | ${translations.seo.title}` },
        { property: 'og:description', content: translations.sitemap?.description || 'Complete sitemap of all characters and tags' },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/sitemap' },
      ],
    });
  } catch (error) {
    console.error('[/sitemap] Error:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

// Add robots.txt route before the existing routes
fastify.get('/robots.txt', async (request, reply) => {
  const baseUrl = process.env.MODE === 'local' ? 
    `http://${ip.address()}:3000` : 
    'https://chatlamix.com';
    
  const robotsTxt = `User-agent: *
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/
Disallow: /settings/
Disallow: /generate/
Disallow: /search
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;

  reply.type('text/plain');
  return reply.send(robotsTxt);
});

// Add legal routes before the existing routes
fastify.get('/terms', async (request, reply) => {
  try {
    const { translations, legalTranslations, lang } = request;
    
    return reply.renderWithGtm('legal/terms.hbs', {
      title: `${legalTranslations.terms?.title || 'Terms of Service'} | ${translations.seo.title}`,
      seo: [
        { name: 'description', content: `${legalTranslations.terms?.title || 'Terms of Service'} - ${translations.seo.description}` },
        { name: 'keywords', content: `terms, service, legal, ${translations.seo.keywords}` },
        { property: 'og:title', content: `${legalTranslations.terms?.title || 'Terms of Service'} | ${translations.seo.title}` },
        { property: 'og:description', content: `${legalTranslations.terms?.title || 'Terms of Service'} - ${translations.seo.description}` },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/terms' },
      ],
    });
  } catch (error) {
    console.error('[/terms] Error:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});

fastify.get('/privacy', async (request, reply) => {
  try {
    const { translations, legalTranslations, lang } = request;
    
    return reply.renderWithGtm('legal/privacy.hbs', {
      title: `${legalTranslations.privacy?.title || 'Privacy Policy'} | ${translations.seo.title}`,
      seo: [
        { name: 'description', content: `${legalTranslations.privacy?.title || 'Privacy Policy'} - ${translations.seo.description}` },
        { name: 'keywords', content: `privacy, policy, legal, ${translations.seo.keywords}` },
        { property: 'og:title', content: `${legalTranslations.privacy?.title || 'Privacy Policy'} | ${translations.seo.title}` },
        { property: 'og:description', content: `${legalTranslations.privacy?.title || 'Privacy Policy'} - ${translations.seo.description}` },
        { property: 'og:image', content: '/img/share.png' },
        { property: 'og:url', content: 'https://chatlamix/privacy' },
      ],
    });
  } catch (error) {
    console.error('[/privacy] Error:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
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
