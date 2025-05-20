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
const { deleteOldTasks } = require('./models/imagen');
const { createModelChat, fetchRandomCivitaiPrompt } = require('./models/civitai');
const { cronJobs, configureCronJob, initializeCronJobs, cachePopularChatsTask } = require('./models/cronManager');

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

// Load global plugins
const fastifyPluginGlobals = require('./plugins/globals');
fastify.register(fastifyPluginGlobals);

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
fastify.register(require('./routes/zohomail'));

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

    return reply.renderWithGtm('character.hbs', {
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
fastify.get('/character/:chatId', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const { translations, lang, user } = request;
    const currentUserId = user._id; // Renamed from userId to avoid conflict
    const chatIdParam = request.params.chatId;
    let chatIdObjectId;

    console.log(`[SimilarChats] Processing /character/${chatIdParam} for user ${currentUserId}`);

    try {
      chatIdObjectId = new fastify.mongo.ObjectId(chatIdParam);
    } catch (e) {
      console.error(`[SimilarChats] Invalid Chat ID format: ${chatIdParam}`);
      return reply.code(400).send({ error: 'Invalid Chat ID format' });
    }
    
    const imageId = request.query.imageId ? new fastify.mongo.ObjectId(request.query.imageId) : null;
    const isModal = request.query.modal === 'true';
    
    const chatsCollection = db.collection('chats');
    const galleryCollection = db.collection('gallery');

    let subscriptionStatus = false;
    let currentUserData = user; // Use 'user' from request as initial current user data
    if (!currentUserData.isTemporary && currentUserId) {
      currentUserData = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(currentUserId) });
      if (currentUserData) {
        subscriptionStatus = currentUserData.subscriptionStatus === 'active';
      } else {
        // Handle case where user might have been deleted or ID is stale
        console.warn(`[SimilarChats] User data not found for ID: ${currentUserId}. Treating as non-subscribed.`);
      }
    }

    const chat = await chatsCollection.findOne({ _id: chatIdObjectId });

    if (!chat) {
      console.warn(`[SimilarChats] Chat not found for ID: ${chatIdParam}`);
      return reply.code(404).send({ error: 'Chat not found' });
    }
    console.log(`[SimilarChats] Found current chat: ${chat.name} (ID: ${chat._id})`);

    let image = null;
    let isBlur = false;
    if (imageId) {
      const imageDoc = await galleryCollection
        .aggregate([
          { $match: { chatId: chatIdObjectId } }, // Use chatIdObjectId here
          { $unwind: '$images' },
          { $match: { 'images._id': imageId } },
          { $project: { image: '$images', _id: 0 } },
        ])
        .toArray();
        
        if (imageDoc.length > 0 && imageDoc[0].image && (!imageDoc[0].image.title || !imageDoc[0].image.title.en || !imageDoc[0].image.title.ja || !imageDoc[0].image.title.fr)) {
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
              fastify.sendNotificationToUser(currentUserId, 'updateImageTitle', { title });
            }).catch((err) => {
              console.error('[SimilarChats] Failed to generate titles for image:', err);
            });
        }
      if (imageDoc.length > 0) {
        image = imageDoc[0].image;
        const unlockedItem = currentUserData?.unlockedItems?.map((id) => id.toString()).includes(imageId.toString());
        isBlur = unlockedItem ? false : image?.nsfw && !subscriptionStatus;
      } else {
        console.warn(`[SimilarChats] Image not found for ID: ${imageId} in chat ${chatIdParam}`);
        // Not returning 404 for image not found, page can still render without it.
      }
    }

    let similarChats = [];
    const characterPrompt = chat.enhancedPrompt || chat.characterPrompt; // Using chat.prompt as per latest user version
    console.log(`[SimilarChats] Current character prompt for ${chatIdParam}: "${characterPrompt}"`);

    if (characterPrompt) {
      const mainPromptTokens = tokenizePrompt(characterPrompt);
      console.log(`[SimilarChats] Tokenized main prompt for ${chatIdParam}: ${JSON.stringify(Array.from(mainPromptTokens))}`);

      // Fetch other chats. Consider adding more filters if performance becomes an issue.
      // Project only necessary fields, including 'prompt' for scoring.
      const candidateChatsCursor = chatsCollection.find(
        { _id: { $ne: chatIdObjectId }, chatImageUrl: { $exists: true }, $or: [{enhancedPrompt: { $exists: true, $ne: null, $ne: "" }}, {characterPrompt: { $exists: true, $ne: null, $ne: "" }}] },
        {
          projection: {
        _id: 1, name: 1, chatImageUrl: 1, nsfw: 1, isPremium: 1, userId: 1, gender: 1, imageStyle: 1, enhancedPrompt: 1, characterPrompt: 1
          }
        }
      );
      
      const scoredChats = [];
      let processedCandidates = 0;
      await candidateChatsCursor.forEach(candidate => {
        processedCandidates++;
        const candidateTokens = tokenizePrompt(candidate.enhancedPrompt || candidate.characterPrompt);
        const commonTokens = [...mainPromptTokens].filter(token => candidateTokens.has(token));
        const score = commonTokens.length;

        if (score > 0) {
          scoredChats.push({
            ...candidate, // Spread existing candidate fields
            score: score
          });
          console.debug(`[SimilarChats] Candidate ${candidate._id} (${candidate.name}) - Prompt: "${candidate.characterPrompt?.substring(0,50)}..." - Tokens: ${JSON.stringify(Array.from(candidateTokens))} - Score: ${score}`);
        }
      });
      console.log(`[SimilarChats] Processed ${processedCandidates} candidates. Found ${scoredChats.length} chats with score > 0.`);
      
      scoredChats.sort((a, b) => b.score - a.score); // Sort by score descending
      similarChats = scoredChats.slice(0, 5).map(c => {
        const { characterPrompt, enhancedPrompt, score, ...rest } = c; // Exclude prompt and score from final object passed to template if not needed by displayLatestChats
        return rest;
      });

      if (similarChats.length > 0) {
        console.log(`[SimilarChats] Top ${similarChats.length} similar chats for ${chatIdParam}: ${JSON.stringify(similarChats.map(c => ({id: c._id, name: c.name})))}`);
      } else {
        console.log(`[SimilarChats] No similar chats found for ${chatIdParam} based on prompt matching.`);
      }

    } else {
      console.log(`[SimilarChats] No prompt found for current character ${chatIdParam}. Skipping similar chat search.`);
    }
    
    const template = isModal ? 'character-modal.hbs' : 'character.hbs';
    return reply.renderWithGtm(template, {
      title: `${chat.name} | ${translations.seo.title_character}`,
      chat,
      image,
      chatId: chatIdParam,
      isBlur,
      similarChats, // Pass scored and sorted similar chats
      user: currentUserData, // Pass potentially updated currentUserData
      seo: [
        { name: 'description', content: ` ${image?.title?.[request.lang] ?? chat.description ?? ''} | ${translations.seo.description_character}` },
        { name: 'keywords', content: translations.seo.keywords },
        { property: 'og:title', content: `${chat.name} | ${translations.seo.title_character}` },
        { property: 'og:description', content: `${image?.title?.[request.lang] ?? chat.description ?? ''} | ${translations.seo.description_character}` },
        { property: 'og:image', content: chat.chatImageUrl || '/img/share.png' },
        { property: 'og:url', content: `https://chatlamix/character/${chatIdParam}` },
      ],
    });
  } catch (err) {
    console.error(`[SimilarChats] Error in /character/:chatId route for ${request.params.chatId}:`, err);
    reply.code(500).send('Internal Server Error');
  }
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
    console.log(`[SEARCH] Incoming request from userId: ${userId}, query params:`, request.query);

    user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) }) || request.user;
    console.log(`[SEARCH] Loaded user:`, user ? { _id: user._id, subscriptionStatus: user.subscriptionStatus } : null);

    const page = parseInt(request.query.page) || 1;
    const query = request.query.q || request.query.query || '';
    const limit = 30;

    const baseUrl = process.env.MODE === 'local' ? 'http://localhost:3000' : `${request.protocol}://${request.hostname}`;
    console.log(`[SEARCH] baseUrl resolved as: ${baseUrl}`);

    // Fetch image results (reuse /chats/images/search logic)
    const imageSearchUrl = `${baseUrl}/chats/images/search?page=${page}&query=${encodeURIComponent(query)}&limit=${limit}`;
    console.log(`[SEARCH] Fetching images from: ${imageSearchUrl}`);
    const imageRes = await fetch(imageSearchUrl);
    const imageData = imageRes.ok ? await imageRes.json() : { images: [] };
    if (!imageRes.ok) {
      console.warn(`[SEARCH] Image fetch failed with status: ${imageRes.status}`);
    } else {
      console.log(`[SEARCH] Fetched ${imageData.images?.length || 0} images`);
    }

    // Compute isBlur for each image
    const subscriptionStatus = user && user.subscriptionStatus === 'active';
    const processedImageResults = (imageData.images || []).map(item => {
      const isBlur = item.nsfw && !subscriptionStatus;
      return { ...item, isBlur };
    });
    console.log(`[SEARCH] Processed image results, subscriptionStatus: ${subscriptionStatus}`);
    const totalPages = imageData.totalPages || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    let seoTitle = translations.seo_title_default; 
    let seoDescription = translations.seo_description_default;
    if (query) {
      seoTitle = translations.seo_title_query.replace('${query}', query);
      seoDescription = translations.seo_description_query.replace('${query}', query);
    }
    console.log(`[SEARCH] SEO title: ${seoTitle}, SEO description: ${seoDescription}`);

    // Fetch tags from a random page
    const randomPage = Math.floor(Math.random() * 10) + 1;
    const tagsUrl = `${baseUrl}/api/tags?page=${randomPage}`;
    console.log(`[SEARCH] Fetching tags from: ${tagsUrl}`);
    const tagsRes = await fetch(tagsUrl);
    const tagsData = tagsRes.ok ? await tagsRes.json() : { tags: [] };
    if (!tagsRes.ok) {
      console.warn(`[SEARCH] Tags fetch failed with status: ${tagsRes.status}`);
    } else {
      console.log(`[SEARCH] Fetched ${tagsData.tags?.length || 0} tags`);
    }
    const tags = tagsData.tags || [];

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
