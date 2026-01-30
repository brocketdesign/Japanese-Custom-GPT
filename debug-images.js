/**
 * Debug script to analyze image generation data in the database
 * Usage: node debug-images.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.MONGODB_NAME || process.env.DB_NAME || 'lamix';

// IDs from user's debug session
const DEBUG_IDS = {
  chatId: '6971a436b839017c6d217ec4',
  userChatId: '697c95195e3e8e627c695aad',
  userId: '6678ff065ec30fd44a6777da'
};

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbName);

    // 1. Query userChat messages
    console.log('=' .repeat(80));
    console.log('📝 USERCHAT MESSAGES');
    console.log('=' .repeat(80));

    const userChat = await db.collection('userChat').findOne({
      _id: new ObjectId(DEBUG_IDS.userChatId)
    });

    if (userChat) {
      console.log(`Found userChat with ${userChat.messages?.length || 0} messages\n`);

      // Filter for image-related messages
      const imageMessages = userChat.messages?.filter(m =>
        m.type === 'image' || m.type === 'mergeFace' || m.type === 'bot-image-slider'
      ) || [];

      console.log(`Found ${imageMessages.length} image-related messages:\n`);

      imageMessages.forEach((msg, idx) => {
        console.log(`--- Message ${idx + 1} ---`);
        console.log(`  type: ${msg.type}`);
        console.log(`  imageUrl: ${msg.imageUrl || 'UNDEFINED'}`);
        console.log(`  imageId: ${msg.imageId || 'UNDEFINED'}`);
        console.log(`  batchId: ${msg.batchId || 'UNDEFINED'}`);
        console.log(`  batchIndex: ${msg.batchIndex ?? 'UNDEFINED'}`);
        console.log(`  batchSize: ${msg.batchSize || 'UNDEFINED'}`);
        console.log(`  isMerged: ${msg.isMerged || false}`);
        console.log(`  hidden: ${msg.hidden || false}`);
        console.log(`  content: ${msg.content?.substring(0, 50) || 'UNDEFINED'}...`);
        console.log(`  createdAt: ${msg.createdAt}`);
        console.log('');
      });

      // Check for undefined/problematic messages
      const problematicMessages = imageMessages.filter(m =>
        !m.imageUrl || m.imageUrl === 'undefined' || m.imageUrl === ''
      );

      if (problematicMessages.length > 0) {
        console.log('\n🚨 PROBLEMATIC MESSAGES (no imageUrl):');
        console.log(JSON.stringify(problematicMessages, null, 2));
      }
    } else {
      console.log('❌ UserChat not found!');
    }

    // 2. Query gallery images
    console.log('\n' + '=' .repeat(80));
    console.log('🖼️ GALLERY IMAGES');
    console.log('=' .repeat(80));

    const gallery = await db.collection('gallery').findOne({
      userId: new ObjectId(DEBUG_IDS.userId),
      chatId: new ObjectId(DEBUG_IDS.chatId)
    });

    if (gallery) {
      console.log(`Found gallery with ${gallery.images?.length || 0} images\n`);

      gallery.images?.slice(-10).forEach((img, idx) => {
        console.log(`--- Gallery Image ${idx + 1} ---`);
        console.log(`  _id: ${img._id}`);
        console.log(`  taskId: ${img.taskId || 'UNDEFINED'}`);
        console.log(`  imageUrl: ${img.imageUrl?.substring(0, 80) || 'UNDEFINED'}...`);
        console.log(`  thumbnailUrl: ${img.thumbnailUrl ? 'EXISTS' : 'UNDEFINED'}`);
        console.log(`  isMerged: ${img.isMerged || false}`);
        console.log(`  createdAt: ${img.createdAt}`);
        console.log('');
      });

      // Check for problematic gallery images
      const problematicGallery = gallery.images?.filter(img =>
        !img.imageUrl || img.imageUrl === 'undefined' || img.imageUrl === ''
      );

      if (problematicGallery?.length > 0) {
        console.log('\n🚨 PROBLEMATIC GALLERY IMAGES (no imageUrl):');
        console.log(JSON.stringify(problematicGallery, null, 2));
      }
    } else {
      console.log('❌ Gallery not found!');
    }

    // 3. Query recent tasks
    console.log('\n' + '=' .repeat(80));
    console.log('📋 RECENT TASKS');
    console.log('=' .repeat(80));

    const tasks = await db.collection('tasks').find({
      userId: new ObjectId(DEBUG_IDS.userId),
      chatId: new ObjectId(DEBUG_IDS.chatId)
    }).sort({ createdAt: -1 }).limit(10).toArray();

    console.log(`Found ${tasks.length} recent tasks\n`);

    tasks.forEach((task, idx) => {
      console.log(`--- Task ${idx + 1} ---`);
      console.log(`  taskId: ${task.taskId}`);
      console.log(`  status: ${task.status}`);
      console.log(`  placeholderId: ${task.placeholderId || 'UNDEFINED'}`);
      console.log(`  shouldAutoMerge: ${task.shouldAutoMerge || false}`);
      console.log(`  enableMergeFace: ${task.enableMergeFace || false}`);
      console.log(`  webhookProcessed: ${task.webhookProcessed || false}`);
      console.log(`  sequentialParentTaskId: ${task.sequentialParentTaskId || 'N/A'}`);
      console.log(`  result.images count: ${task.result?.images?.length || 0}`);
      if (task.result?.images?.length > 0) {
        task.result.images.forEach((img, imgIdx) => {
          console.log(`    image[${imgIdx}].imageUrl: ${img.imageUrl?.substring(0, 60) || 'UNDEFINED'}...`);
        });
      }
      console.log(`  createdAt: ${task.createdAt}`);
      console.log('');
    });

    // 4. Check mergedResults
    console.log('\n' + '=' .repeat(80));
    console.log('🔀 MERGED RESULTS');
    console.log('=' .repeat(80));

    const mergedResults = await db.collection('mergedResults').find({}).sort({ createdAt: -1 }).limit(5).toArray();

    console.log(`Found ${mergedResults.length} recent merged results\n`);

    mergedResults.forEach((mr, idx) => {
      console.log(`--- MergedResult ${idx + 1} ---`);
      console.log(`  originalImageUrl: ${mr.originalImageUrl?.substring(0, 60) || 'UNDEFINED'}...`);
      console.log(`  mergedImageUrl: ${mr.mergedImageUrl?.substring(0, 60) || 'UNDEFINED'}...`);
      console.log(`  mergeId: ${mr.mergeId || 'UNDEFINED'}`);
      console.log(`  createdAt: ${mr.createdAt}`);
      console.log('');
    });

    // 5. Check mergedFaces
    console.log('\n' + '=' .repeat(80));
    console.log('👤 MERGED FACES');
    console.log('=' .repeat(80));

    const mergedFaces = await db.collection('mergedFaces').find({
      userId: new ObjectId(DEBUG_IDS.userId)
    }).sort({ createdAt: -1 }).limit(5).toArray();

    console.log(`Found ${mergedFaces.length} recent merged faces\n`);

    mergedFaces.forEach((mf, idx) => {
      console.log(`--- MergedFace ${idx + 1} ---`);
      console.log(`  originalImageId: ${mf.originalImageId}`);
      console.log(`  mergedImageUrl: ${mf.mergedImageUrl?.substring(0, 60) || 'UNDEFINED'}...`);
      console.log(`  userChatId: ${mf.userChatId}`);
      console.log(`  createdAt: ${mf.createdAt}`);
      console.log('');
    });

    // 6. Summary analysis
    console.log('\n' + '=' .repeat(80));
    console.log('📊 SUMMARY ANALYSIS');
    console.log('=' .repeat(80));

    if (userChat) {
      const allImageMessages = userChat.messages?.filter(m =>
        m.type === 'image' || m.type === 'mergeFace' || m.type === 'bot-image-slider'
      ) || [];

      const withImageUrl = allImageMessages.filter(m => m.imageUrl && m.imageUrl !== 'undefined');
      const withoutImageUrl = allImageMessages.filter(m => !m.imageUrl || m.imageUrl === 'undefined');

      console.log(`Total image messages: ${allImageMessages.length}`);
      console.log(`With valid imageUrl: ${withImageUrl.length}`);
      console.log(`Without valid imageUrl: ${withoutImageUrl.length} ⚠️`);

      if (withoutImageUrl.length > 0) {
        console.log('\n🔍 MESSAGES WITHOUT imageUrl:');
        withoutImageUrl.forEach((msg, idx) => {
          console.log(`\n  [${idx + 1}] Full message data:`);
          console.log(JSON.stringify(msg, null, 4));
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

main();
