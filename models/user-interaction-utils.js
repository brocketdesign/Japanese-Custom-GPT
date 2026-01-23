/**
 * User Interaction Tracking Utilities
 * 
 * Tracks user interactions with content for personalization:
 * - Character views
 * - Image views
 * - Tag interactions
 * - Dwell time
 */

const { ObjectId } = require('mongodb');

/**
 * Get user's interaction state from database
 */
async function getUserInteractionState(db, userId) {
  if (!userId) return null;
  
  const userInteractionsCollection = db.collection('userInteractions');
  
  try {
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const interaction = await userInteractionsCollection.findOne({ userId: userIdObj });
    
    if (!interaction) {
      // Initialize new interaction state
      return {
        userId: userIdObj,
        seenCharacters: {},
        seenImages: {},
        preferredTags: [],
        tagPreferences: {},
        lastUpdated: new Date()
      };
    }
    
    return interaction;
  } catch (error) {
    console.error('[UserInteraction] Error fetching interaction state:', error);
    return null;
  }
}

/**
 * Save user's interaction state to database
 */
async function saveUserInteractionState(db, userId, state) {
  if (!userId) return false;
  
  const userInteractionsCollection = db.collection('userInteractions');
  
  try {
    const userIdObj = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    await userInteractionsCollection.updateOne(
      { userId: userIdObj },
      {
        $set: {
          ...state,
          userId: userIdObj,
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );
    
    return true;
  } catch (error) {
    console.error('[UserInteraction] Error saving interaction state:', error);
    return false;
  }
}

/**
 * Record that a user viewed a character
 */
async function recordCharacterView(db, userId, characterId, imageIds = [], tags = []) {
  if (!userId) return null;
  
  const state = await getUserInteractionState(db, userId);
  if (!state) return null;
  
  const now = Date.now();
  const charIdStr = characterId.toString();
  
  // Update seen characters
  if (!state.seenCharacters) state.seenCharacters = {};
  state.seenCharacters[charIdStr] = now;
  
  // Update seen images
  if (imageIds.length > 0) {
    if (!state.seenImages) state.seenImages = {};
    if (!state.seenImages[charIdStr]) state.seenImages[charIdStr] = [];
    
    imageIds.forEach(imageId => {
      const imgIdStr = imageId.toString();
      if (!state.seenImages[charIdStr].includes(imgIdStr)) {
        state.seenImages[charIdStr].push(imgIdStr);
      }
    });
    
    // Limit to last 50 images per character
    if (state.seenImages[charIdStr].length > 50) {
      state.seenImages[charIdStr] = state.seenImages[charIdStr].slice(-50);
    }
  }
  
  // Update tag preferences if tags provided
  if (tags.length > 0) {
    if (!state.tagPreferences) state.tagPreferences = {};
    if (!state.preferredTags) state.preferredTags = [];
    
    tags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (!state.tagPreferences[tagLower]) {
        state.tagPreferences[tagLower] = 0;
      }
      state.tagPreferences[tagLower] += 0.5; // Viewing adds small weight
    });
    
    // Update preferred tags list (top 10)
    const sortedTags = Object.entries(state.tagPreferences)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
    
    state.preferredTags = sortedTags;
  }
  
  await saveUserInteractionState(db, userId, state);
  return state;
}

/**
 * Record tag interaction (user clicked on a tag, scrolled through tag content, etc.)
 */
async function recordTagInteraction(db, userId, tags, strength = 1.0) {
  if (!userId || !tags || tags.length === 0) return null;
  
  const state = await getUserInteractionState(db, userId);
  if (!state) return null;
  
  if (!state.tagPreferences) state.tagPreferences = {};
  if (!state.preferredTags) state.preferredTags = [];
  
  tags.forEach(tag => {
    const tagLower = tag.toLowerCase();
    if (!state.tagPreferences[tagLower]) {
      state.tagPreferences[tagLower] = 0;
    }
    state.tagPreferences[tagLower] += strength;
  });
  
  // Update preferred tags list (top 10)
  const sortedTags = Object.entries(state.tagPreferences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
  
  state.preferredTags = sortedTags;
  
  // Decay old preferences
  Object.keys(state.tagPreferences).forEach(tag => {
    state.tagPreferences[tag] *= 0.95;
    if (state.tagPreferences[tag] < 0.1) {
      delete state.tagPreferences[tag];
    }
  });
  
  await saveUserInteractionState(db, userId, state);
  return state;
}

/**
 * Clean up old interaction data
 */
async function cleanupOldInteractions(db, daysToKeep = 90) {
  const userInteractionsCollection = db.collection('userInteractions');
  const threshold = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  try {
    // Remove interactions not updated in the specified period
    const result = await userInteractionsCollection.deleteMany({
      lastUpdated: { $lt: threshold }
    });
    
    console.log(`[UserInteraction] Cleaned up ${result.deletedCount} old interaction records`);
    return result.deletedCount;
  } catch (error) {
    console.error('[UserInteraction] Error cleaning up old interactions:', error);
    return 0;
  }
}

/**
 * Get aggregated interaction stats for a user
 */
async function getUserInteractionStats(db, userId) {
  if (!userId) return null;
  
  const state = await getUserInteractionState(db, userId);
  if (!state) return null;
  
  const totalCharactersSeen = Object.keys(state.seenCharacters || {}).length;
  const totalImagesSeen = Object.values(state.seenImages || {})
    .reduce((sum, images) => sum + images.length, 0);
  const topTags = state.preferredTags || [];
  
  return {
    totalCharactersSeen,
    totalImagesSeen,
    topTags,
    lastUpdated: state.lastUpdated
  };
}

module.exports = {
  getUserInteractionState,
  saveUserInteractionState,
  recordCharacterView,
  recordTagInteraction,
  cleanupOldInteractions,
  getUserInteractionStats,
};
