/**
 * User Preferences Analyzer
 * 
 * Nightly cron job that analyzes user behavior to enhance explore gallery personalization:
 * - Analyzes user likes on images
 * - Analyzes character type preferences based on chat/messaging behavior
 * - Determines gender preferences
 * - Determines NSFW/SFW preferences
 * - Caches results for fast retrieval during gallery browsing
 * 
 * This module is run nightly to process user data and update the preferences cache.
 */

const { ObjectId } = require('mongodb');
const { normalizeGender } = require('./content-sequencing-utils');

/**
 * Analyze a single user's preferences based on their activity
 * @param {Object} db - MongoDB database instance
 * @param {ObjectId} userId - User ID to analyze
 * @returns {Object} User preferences analysis result
 */
async function analyzeUserPreferences(db, userId) {
  const likesCollection = db.collection('images_likes');
  const userChatCollection = db.collection('userChat');
  const chatsCollection = db.collection('chats');
  const favoritesCollection = db.collection('user_favorites');
  const galleryCollection = db.collection('gallery');
  
  const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
  
  // Initialize preference counters
  const preferences = {
    userId: userIdObj,
    preferredGenders: { female: 0, male: 0, nonbinary: 0, unknown: 0 },
    preferredCharacterTypes: [],
    preferredTags: {},
    nsfwPreference: 0,
    totalInteractions: 0,
    analyzedAt: new Date()
  };
  
  try {
    // 1. Analyze image likes
    const userLikes = await likesCollection.find({ 
      likedBy: userIdObj 
    }).toArray();
    
    // Get chat info for liked images
    const likedChatIds = [...new Set(userLikes.map(like => like.chatId).filter(Boolean))];
    
    if (likedChatIds.length > 0) {
      const likedChats = await chatsCollection.find({
        _id: { $in: likedChatIds }
      }).toArray();
      
      // Create a map for fast lookup
      const chatMap = new Map(likedChats.map(chat => [chat._id.toString(), chat]));
      
      // Count gender preferences from likes
      likedChats.forEach(chat => {
        const gender = normalizeGender(chat.gender);
        preferences.preferredGenders[gender] += 2; // Likes count double
        preferences.totalInteractions += 2;
        
        // Analyze tags from liked characters
        if (chat.tags && Array.isArray(chat.tags)) {
          chat.tags.forEach(tag => {
            const tagLower = tag.toLowerCase();
            preferences.preferredTags[tagLower] = (preferences.preferredTags[tagLower] || 0) + 2;
          });
        }
      });
      
      // Analyze NSFW preference from likes - batch query galleries
      const galleriesForLikes = await galleryCollection.find({
        chatId: { $in: likedChatIds }
      }).toArray();
      
      // Create gallery map for fast lookup
      const galleryMap = new Map(galleriesForLikes.map(g => [g.chatId.toString(), g]));
      
      // Check NSFW status for each like
      for (const like of userLikes) {
        if (like.chatId && like.imageId) {
          const gallery = galleryMap.get(like.chatId.toString());
          if (gallery && gallery.images) {
            const likedImage = gallery.images.find(img => 
              img._id?.toString() === like.imageId?.toString()
            );
            if (likedImage) {
              if (likedImage.nsfw === true || likedImage.nsfw === 'true' || likedImage.nsfw === 'on') {
                preferences.nsfwPreference += 2;
              }
            }
          }
        }
      }
    }
    
    // 2. Analyze chat/messaging behavior
    const userMessages = await userChatCollection.find({
      usersId: userIdObj
    }).toArray();
    
    // Get unique character IDs from user's chat history
    const chattedCharacterIds = [...new Set(userMessages.map(msg => msg.chatId).filter(Boolean))];
    
    if (chattedCharacterIds.length > 0) {
      const chattedChats = await chatsCollection.find({
        _id: { $in: chattedCharacterIds }
      }).toArray();
      
      // Create a map of chatId to total message count
      const messageCountMap = new Map();
      userMessages.forEach(m => {
        if (m.chatId) {
          const chatIdStr = m.chatId.toString();
          const count = m.messages?.length || 0;
          messageCountMap.set(chatIdStr, (messageCountMap.get(chatIdStr) || 0) + count);
        }
      });
      
      // Count gender preferences from chats
      chattedChats.forEach(chat => {
        // Get total message count for this chat
        const messageCount = messageCountMap.get(chat._id.toString()) || 1;
        
        // Weight by message count (more messages = stronger preference)
        const weight = Math.min(Math.log2(messageCount + 1), 5); // Cap at 5
        
        const gender = normalizeGender(chat.gender);
        preferences.preferredGenders[gender] += weight;
        preferences.totalInteractions += weight;
        
        // Analyze tags from chatted characters
        if (chat.tags && Array.isArray(chat.tags)) {
          chat.tags.forEach(tag => {
            const tagLower = tag.toLowerCase();
            preferences.preferredTags[tagLower] = (preferences.preferredTags[tagLower] || 0) + weight;
          });
        }
      });
    }
    
    // 3. Analyze favorites
    const userFavorites = await favoritesCollection.find({
      userId: userIdObj
    }).toArray();
    
    if (userFavorites.length > 0) {
      const favoriteChatIds = userFavorites.map(fav => fav.chatId).filter(Boolean);
      
      const favoriteChats = await chatsCollection.find({
        _id: { $in: favoriteChatIds }
      }).toArray();
      
      favoriteChats.forEach(chat => {
        const gender = normalizeGender(chat.gender);
        preferences.preferredGenders[gender] += 3; // Favorites count triple
        preferences.totalInteractions += 3;
        
        // Analyze tags from favorite characters
        if (chat.tags && Array.isArray(chat.tags)) {
          chat.tags.forEach(tag => {
            const tagLower = tag.toLowerCase();
            preferences.preferredTags[tagLower] = (preferences.preferredTags[tagLower] || 0) + 3;
          });
        }
      });
    }
    
    // 4. Normalize gender preferences to percentages
    const totalGenderScore = Object.values(preferences.preferredGenders).reduce((a, b) => a + b, 0);
    if (totalGenderScore > 0) {
      Object.keys(preferences.preferredGenders).forEach(gender => {
        preferences.preferredGenders[gender] = 
          Math.round((preferences.preferredGenders[gender] / totalGenderScore) * 100) / 100;
      });
    }
    
    // 5. Extract top preferred character types (tags)
    const sortedTags = Object.entries(preferences.preferredTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([tag]) => tag);
    
    preferences.preferredCharacterTypes = sortedTags;
    
    // 6. Calculate NSFW preference ratio
    if (preferences.totalInteractions > 0) {
      preferences.nsfwPreference = 
        Math.round((preferences.nsfwPreference / preferences.totalInteractions) * 100) / 100;
    }
    
    return preferences;
  } catch (error) {
    console.error(`[UserPreferencesAnalyzer] Error analyzing user ${userId}:`, error);
    return null;
  }
}

/**
 * Run the nightly user preferences analysis for all active users
 * @param {Object} db - MongoDB database instance
 * @returns {Object} Statistics about the analysis run
 */
async function runNightlyPreferencesAnalysis(db) {
  console.log('\n🔍 [CRON] ▶️  Starting nightly user preferences analysis...');
  
  const usersCollection = db.collection('users');
  const preferencesCache = db.collection('userPreferencesCache');
  
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  try {
    // Get all non-temporary users who have been active in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const activeUsers = await usersCollection.find({
      isTemporary: { $ne: true },
      $or: [
        { lastLogin: { $gte: thirtyDaysAgo } },
        { updatedAt: { $gte: thirtyDaysAgo } }
      ]
    }).project({ _id: 1 }).toArray();
    
    console.log(`🔍 [CRON] 📊 Found ${activeUsers.length} active users to analyze`);
    
    // Process users in batches to avoid memory issues
    const batchSize = 50;
    let lastLoggedBatch = -1;
    
    for (let i = 0; i < activeUsers.length; i += batchSize) {
      const batch = activeUsers.slice(i, i + batchSize);
      
      // Use Promise.allSettled to ensure all users are processed even if some fail
      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const preferences = await analyzeUserPreferences(db, user._id);
          
          if (preferences && preferences.totalInteractions > 0) {
            // Validate preferences before storing
            if (typeof preferences.nsfwPreference === 'number' && 
                preferences.nsfwPreference >= 0 && 
                preferences.nsfwPreference <= 1) {
              // Upsert the preferences cache
              await preferencesCache.updateOne(
                { userId: user._id },
                { $set: preferences },
                { upsert: true }
              );
              return { status: 'processed' };
            }
          }
          return { status: 'skipped' };
        })
      );
      
      // Count results
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'processed') {
            processedCount++;
          } else {
            skippedCount++;
          }
        } else {
          console.error(`[UserPreferencesAnalyzer] Error processing user:`, result.reason?.message || result.reason);
          errorCount++;
        }
      });
      
      // Log progress every 100 users or at the end
      const currentBatch = Math.floor((i + batchSize) / 100);
      if (currentBatch > lastLoggedBatch || i + batchSize >= activeUsers.length) {
        lastLoggedBatch = currentBatch;
        console.log(`🔍 [CRON] 📈 Progress: ${Math.min(i + batchSize, activeUsers.length)}/${activeUsers.length} users`);
      }
    }
    
    // Clean up old preferences cache entries (users inactive for > 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const cleanupResult = await preferencesCache.deleteMany({
      analyzedAt: { $lt: ninetyDaysAgo }
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const stats = {
      totalUsers: activeUsers.length,
      processedCount,
      skippedCount,
      errorCount,
      cleanedUp: cleanupResult.deletedCount,
      durationSeconds: parseFloat(duration)
    };
    
    console.log(`🔍 [CRON] ✅ User preferences analysis completed:`);
    console.log(`   📊 Total users: ${stats.totalUsers}`);
    console.log(`   ✅ Processed: ${stats.processedCount}`);
    console.log(`   ⏭️  Skipped (no activity): ${stats.skippedCount}`);
    console.log(`   ❌ Errors: ${stats.errorCount}`);
    console.log(`   🗑️  Cleaned up old entries: ${stats.cleanedUp}`);
    console.log(`   ⏱️  Duration: ${stats.durationSeconds}s\n`);
    
    // Store analysis run metadata
    const analysisMetadata = db.collection('systemMetadata');
    await analysisMetadata.updateOne(
      { type: 'userPreferencesAnalysis' },
      { 
        $set: { 
          lastRun: new Date(),
          stats,
          type: 'userPreferencesAnalysis'
        }
      },
      { upsert: true }
    );
    
    return stats;
  } catch (error) {
    console.error('🔍 [CRON] ❌ Error in nightly preferences analysis:', error);
    throw error;
  }
}

/**
 * Get aggregate statistics about user preferences across the platform
 * Useful for understanding overall user behavior patterns
 * @param {Object} db - MongoDB database instance
 * @returns {Object} Aggregate preference statistics
 */
async function getAggregatePreferenceStats(db) {
  const preferencesCache = db.collection('userPreferencesCache');
  
  try {
    const stats = await preferencesCache.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          avgFemalePreference: { $avg: '$preferredGenders.female' },
          avgMalePreference: { $avg: '$preferredGenders.male' },
          avgNonbinaryPreference: { $avg: '$preferredGenders.nonbinary' },
          avgNsfwPreference: { $avg: '$nsfwPreference' },
          avgInteractions: { $avg: '$totalInteractions' }
        }
      }
    ]).toArray();
    
    if (stats.length === 0) {
      return null;
    }
    
    // Get top tags across all users
    const topTagsResult = await preferencesCache.aggregate([
      { $unwind: '$preferredCharacterTypes' },
      { $group: { _id: '$preferredCharacterTypes', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();
    
    return {
      ...stats[0],
      topTags: topTagsResult.map(t => ({ tag: t._id, count: t.count }))
    };
  } catch (error) {
    console.error('[UserPreferencesAnalyzer] Error getting aggregate stats:', error);
    return null;
  }
}

module.exports = {
  analyzeUserPreferences,
  runNightlyPreferencesAnalysis,
  getAggregatePreferenceStats
};
