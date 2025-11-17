const cron = require('node-cron');
const { ObjectId } = require('mongodb');

/**
 * Initialize analytics cron jobs
 * @param {Object} fastify - Fastify instance
 */
function initializeAnalyticsCron(fastify) {
  const db = fastify.mongo.db;
  
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    fastify.log.info('Starting analytics cache update...');
    
    try {
      await updateAnalyticsCache(db);
      fastify.log.info('Analytics cache updated successfully');
    } catch (error) {
      fastify.log.error('Error updating analytics cache:', error);
    }
  });
}

/**
 * Update analytics cache in database
 * @param {Object} db - MongoDB database instance
 */
async function updateAnalyticsCache(db) {
  const usersCollection = db.collection('users');
  const subscriptionsCollection = db.collection('subscriptions');
  const imagesCollection = db.collection('images_generated');
  const userChatCollection = db.collection('userChat'); // Messages are in userChat
  const likesCollection = db.collection('images_likes');
  const analyticsCache = db.collection('analytics_cache');
  
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  console.log('\n📊 [CRON] ▶️  Starting analytics cache update...');
  
  // Count total messages from userChat collection
  const totalMessagesResult = await userChatCollection.aggregate([
    { $unwind: '$messages' },
    { $count: 'total' }
  ]).toArray();
  
  const totalMessages = totalMessagesResult[0]?.total || 0;
  
  console.log('📊 [CRON] 📨 Total messages found:', totalMessages);
  
  // Calculate all statistics
  const [
    totalUsers,
    newUsersLastWeek,
    totalImages,
    newImagesLastWeek,
    premiumUsers,
    totalLikes,
    usersWithImages,
    userGrowth,
    genderDist,
    nationalityDist,
    contentTrends
  ] = await Promise.all([
    usersCollection.countDocuments({ isTemporary: { $ne: true } }),
    usersCollection.countDocuments({ createdAt: { $gte: lastWeek }, isTemporary: { $ne: true } }),
    imagesCollection.aggregate([{ $group: { _id: null, total: { $sum: '$generationCount' } } }]).toArray(),
    imagesCollection.aggregate([
      { $match: { createdAt: { $gte: lastWeek } } },
      { $group: { _id: null, total: { $sum: '$generationCount' } } }
    ]).toArray(),
    subscriptionsCollection.countDocuments({ 
      subscriptionStatus: 'active', 
      subscriptionType: 'subscription' // Only count subscription type, not day-pass
    }),
    likesCollection.countDocuments({}),
    imagesCollection.distinct('userId').then(arr => arr.length),
    calculateUserGrowth(usersCollection),
    calculateGenderDistribution(usersCollection),
    calculateNationalityDistribution(usersCollection),
    calculateContentTrends(imagesCollection, userChatCollection)
  ]);
  
  const totalImagesCount = totalImages[0]?.total || 0;
  const newImagesCount = newImagesLastWeek[0]?.total || 0;
  const prevTotalUsers = totalUsers - newUsersLastWeek;
  const prevTotalImages = totalImagesCount - newImagesCount;
  
  console.log('📊 [CRON] 📈 Cache statistics:', {
    totalMessages,
    totalUsers,
    avgMessagesPerUser: totalUsers > 0 ? (totalMessages / totalUsers).toFixed(2) : 0
  });
  
  const dashboardData = {
    stats: {
      totalUsers,
      userGrowth: prevTotalUsers > 0 ? ((newUsersLastWeek / prevTotalUsers) * 100) : 0,
      totalImages: totalImagesCount,
      imageGrowth: prevTotalImages > 0 ? ((newImagesCount / prevTotalImages) * 100) : 0,
      totalMessages,
      messageGrowth: 0, // Cannot calculate growth without reliable timestamp
      avgMessagesPerUser: totalUsers > 0 ? (totalMessages / totalUsers) : 0,
      premiumUsers,
      totalLikes,
      activeImageGenerators: usersWithImages
    },
    userGrowth,
    genderDistribution: genderDist,
    nationalityDistribution: nationalityDist,
    contentTrends
  };
  
  // Update or insert cache
  await analyticsCache.updateOne(
    { type: 'dashboard' },
    { 
      $set: { 
        type: 'dashboard',
        data: dashboardData,
        updatedAt: now
      }
    },
    { upsert: true }
  );
  
  console.log('📊 [CRON] ✅ Analytics cache updated successfully\n');
}

async function calculateUserGrowth(usersCollection) {
  const labels = [];
  const values = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const count = await usersCollection.countDocuments({
      createdAt: { $gte: date, $lt: nextDate },
      isTemporary: { $ne: true }
    });
    
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    values.push(count);
  }
  
  return { labels, values };
}

async function calculateGenderDistribution(usersCollection) {
  const distribution = await usersCollection.aggregate([
    { $match: { isTemporary: { $ne: true } } },
    { $group: { _id: '$gender', count: { $sum: 1 } } }
  ]).toArray();
  
  const labels = [];
  const values = [];
  
  distribution.forEach(item => {
    labels.push(item._id || 'Unknown');
    values.push(item.count);
  });
  
  return { labels, values };
}

async function calculateNationalityDistribution(usersCollection) {
  const distribution = await usersCollection.aggregate([
    { $match: { isTemporary: { $ne: true } } },
    { $group: { _id: '$lang', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]).toArray();
  
  const labels = [];
  const values = [];
  
  distribution.forEach(item => {
    labels.push(item._id || 'Unknown');
    values.push(item.count);
  });
  
  return { labels, values };
}

async function calculateContentTrends(imagesCollection, userChatCollection) {
  const galleryCollection = userChatCollection.s.db.collection('gallery');
  
  const labels = [];
  const images = [];
  const messages = [];
  
  // Check what fields exist in messages
  const sampleChat = await userChatCollection.findOne({ 'messages.0': { $exists: true } });
  if (sampleChat && sampleChat.messages && sampleChat.messages.length > 0) {
    console.log('[calculateContentTrends CRON] Sample message fields:', Object.keys(sampleChat.messages[0]));
  }
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // Count images from gallery collection
    const imageCount = await galleryCollection.aggregate([
      { $unwind: '$images' },
      { 
        $match: { 
          'images.createdAt': { $gte: date, $lt: nextDate }
        } 
      },
      { $count: 'total' }
    ]).toArray();
    
    // Count messages with createdAt field
    let messageCountValue = 0;
    
    const messageCountWithCreatedAt = await userChatCollection.aggregate([
      { $unwind: '$messages' },
      { 
        $match: { 
          'messages.createdAt': { $exists: true, $gte: date, $lt: nextDate }
        } 
      },
      { $count: 'total' }
    ]).toArray();
    
    if (messageCountWithCreatedAt[0]?.total > 0) {
      messageCountValue = messageCountWithCreatedAt[0].total;
    } else if (i === 0) {
      // Fallback for today only
      const totalTodayMessages = await userChatCollection.aggregate([
        { $match: { updatedAt: { $gte: date.toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' }) } } },
        { $unwind: '$messages' },
        { $count: 'total' }
      ]).toArray();
      
      if (totalTodayMessages[0]?.total > 0) {
        messageCountValue = totalTodayMessages[0].total;
      }
    }
    
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    images.push(imageCount[0]?.total || 0);
    messages.push(messageCountValue);
  }
  
  return { labels, images, messages };
}

module.exports = { initializeAnalyticsCron, updateAnalyticsCache };