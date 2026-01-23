/**
 * Content Sequencing & Discovery Engine
 * 
 * Implements TikTok-style content discovery with:
 * - Weighted randomness (not pure random)
 * - Seen state tracking
 * - Tag-based personalization
 * - Time-based decay
 * - Fresh content boosting
 */

const { ObjectId } = require('mongodb');

/**
 * Time constants for decay logic (in milliseconds)
 */
const TIME_CONSTANTS = {
  RECENTLY_SEEN: 24 * 60 * 60 * 1000,      // 1 day - avoid completely
  SHORT_TERM: 7 * 24 * 60 * 60 * 1000,     // 1 week - reduce weight
  MEDIUM_TERM: 30 * 24 * 60 * 60 * 1000,   // 1 month - neutral
  FRESH_CONTENT: 7 * 24 * 60 * 60 * 1000,  // Content from last week is "fresh"
};

/**
 * Weight multipliers for scoring
 */
const WEIGHTS = {
  TAG_MATCH: 2.0,           // Boost for matching user's preferred tags
  FRESH_CONTENT: 1.5,       // Boost for recently created content
  POPULAR: 1.2,             // Slight boost for popular content
  RECENTLY_SEEN: 0.1,       // Heavy penalty for recently seen
  SHORT_TERM_SEEN: 0.5,     // Medium penalty for seen this week
  NEW_IMAGES: 1.3,          // Boost for characters with new images
};

/**
 * Calculate time-based decay multiplier
 * Content seen longer ago has less penalty
 */
function getDecayMultiplier(lastSeenTimestamp) {
  if (!lastSeenTimestamp) return 1.0;
  
  const now = Date.now();
  const timeSince = now - lastSeenTimestamp;
  
  if (timeSince < TIME_CONSTANTS.RECENTLY_SEEN) {
    return WEIGHTS.RECENTLY_SEEN; // Heavy penalty
  } else if (timeSince < TIME_CONSTANTS.SHORT_TERM) {
    return WEIGHTS.SHORT_TERM_SEEN; // Medium penalty
  } else if (timeSince < TIME_CONSTANTS.MEDIUM_TERM) {
    return 0.8; // Light penalty
  }
  
  return 1.0; // No penalty after a month
}

/**
 * Calculate freshness boost for new content
 */
function getFreshnessBoost(createdAt) {
  if (!createdAt) return 1.0;
  
  const now = Date.now();
  const contentAge = now - new Date(createdAt).getTime();
  
  if (contentAge < TIME_CONSTANTS.FRESH_CONTENT) {
    return WEIGHTS.FRESH_CONTENT;
  }
  
  return 1.0;
}

/**
 * Calculate tag relevance score
 * Higher score for tags that match user's interaction history
 */
function getTagRelevanceScore(characterTags, userPreferredTags) {
  if (!characterTags || characterTags.length === 0) return 1.0;
  if (!userPreferredTags || userPreferredTags.length === 0) return 1.0;
  
  const matchCount = characterTags.filter(tag => 
    userPreferredTags.some(userTag => 
      userTag.toLowerCase() === tag.toLowerCase()
    )
  ).length;
  
  if (matchCount === 0) return 1.0;
  
  // More matches = higher boost (but capped)
  return 1.0 + (matchCount * (WEIGHTS.TAG_MATCH - 1.0) / characterTags.length);
}

/**
 * Calculate weighted score for a character
 */
function calculateCharacterScore(character, userState) {
  const {
    seenCharacters = {},
    preferredTags = [],
  } = userState || {};
  
  let score = 1.0;
  
  // 1. Apply time-based decay for seen characters
  const lastSeen = seenCharacters[character.chatId?.toString()];
  if (lastSeen) {
    score *= getDecayMultiplier(lastSeen);
  }
  
  // 2. Apply freshness boost
  score *= getFreshnessBoost(character.latestImage || character.createdAt);
  
  // 3. Apply tag relevance
  score *= getTagRelevanceScore(character.chatTags, preferredTags);
  
  // 4. Apply popularity boost (based on image count as proxy)
  if (character.imageCount > 10) {
    score *= WEIGHTS.POPULAR;
  }
  
  // 5. Boost for characters with new images
  if (character.hasNewImages) {
    score *= WEIGHTS.NEW_IMAGES;
  }
  
  // Add small random factor to prevent complete determinism
  score *= (0.9 + Math.random() * 0.2);
  
  return score;
}

/**
 * Select top N characters from scored pool
 * Uses weighted random selection from top candidates
 */
function selectTopCharacters(scoredCharacters, count) {
  if (scoredCharacters.length === 0) return [];
  
  // Sort by score descending
  scoredCharacters.sort((a, b) => b.score - a.score);
  
  // Take top 3x the requested count as candidate pool
  const poolSize = Math.min(scoredCharacters.length, count * 3);
  const candidatePool = scoredCharacters.slice(0, poolSize);
  
  // Weighted random selection from pool
  const selected = [];
  const remaining = [...candidatePool];
  
  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Calculate total score once per iteration
    const totalScore = remaining.reduce((sum, char) => sum + char.score, 0);
    
    // Random weighted selection
    let random = Math.random() * totalScore;
    let selectedIndex = 0;
    
    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].score;
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }
    
    selected.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }
  
  return selected.map(char => char.character);
}

/**
 * Rotate images within a character to show fresh ones first
 */
function rotateCharacterImages(character, seenImages = {}) {
  if (!character.images || character.images.length === 0) {
    return character;
  }
  
  const chatIdStr = character.chatId?.toString();
  const seenImageIds = seenImages[chatIdStr] || [];
  
  // Split into seen and unseen
  const unseenImages = [];
  const seenImagesList = [];
  
  character.images.forEach(image => {
    const imageId = image._id?.toString() || image.imageUrl;
    if (seenImageIds.includes(imageId)) {
      seenImagesList.push(image);
    } else {
      unseenImages.push(image);
    }
  });
  
  // Sort unseen by newest first
  unseenImages.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });
  
  // Sort seen by oldest first (to re-show old ones before recent ones)
  seenImagesList.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateA - dateB;
  });
  
  // Combine: unseen first, then seen
  character.images = [...unseenImages, ...seenImagesList];
  
  return character;
}

/**
 * Get curated pool for cold start (new users)
 */
async function getColdStartPool(db, limit = 20) {
  const chatsGalleryCollection = db.collection('gallery');
  
  // Get popular characters with diverse content
  const pipeline = [
    { $unwind: '$images' },
    { 
      $match: { 
        'images.imageUrl': { $exists: true, $ne: null }
      } 
    },
    {
      $lookup: {
        from: 'chats',
        localField: 'chatId',
        foreignField: '_id',
        as: 'chat'
      }
    },
    { $unwind: '$chat' },
    {
      $match: {
        'chat.visibility': 'public'
      }
    },
    {
      $group: {
        _id: '$chatId',
        imageCount: { $sum: 1 },
        latestImage: { $max: '$images.createdAt' }
      }
    },
    // Mix of popular and recent
    { $sort: { imageCount: -1, latestImage: -1 } },
    { $limit: limit * 2 } // Get 2x to ensure diversity
  ];
  
  const characters = await chatsGalleryCollection.aggregate(pipeline).toArray();
  
  // Randomly shuffle to create diversity
  for (let i = characters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  
  return characters.slice(0, limit).map(c => c._id);
}

/**
 * Main sequencing function - applies weighted randomness to character list
 */
async function sequenceCharacters(characters, userState, options = {}) {
  const {
    limit = 20,
    excludeRecent = true,
  } = options;
  
  // Score each character
  const scoredCharacters = characters.map(character => ({
    character,
    score: calculateCharacterScore(character, userState)
  }));
  
  // Filter out very recently seen if requested
  let filteredCharacters = scoredCharacters;
  if (excludeRecent && userState?.seenCharacters) {
    const recentThreshold = Date.now() - TIME_CONSTANTS.RECENTLY_SEEN;
    filteredCharacters = scoredCharacters.filter(({ character }) => {
      const lastSeen = userState.seenCharacters[character.chatId?.toString()];
      return !lastSeen || lastSeen < recentThreshold;
    });
  }
  
  // If we filtered too much, include some recent ones with low scores
  if (filteredCharacters.length < limit && filteredCharacters.length < scoredCharacters.length) {
    filteredCharacters = scoredCharacters;
  }
  
  // Select top characters using weighted random selection
  const selectedCharacters = selectTopCharacters(filteredCharacters, limit);
  
  // Rotate images within each character
  if (userState?.seenImages) {
    selectedCharacters.forEach(character => {
      rotateCharacterImages(character, userState.seenImages);
    });
  }
  
  return selectedCharacters;
}

/**
 * Parse user state from browser storage or database
 */
function parseUserState(storageData) {
  try {
    if (typeof storageData === 'string') {
      return JSON.parse(storageData);
    }
    return storageData || {};
  } catch (error) {
    console.error('[ContentSequencing] Error parsing user state:', error);
    return {};
  }
}

/**
 * Update user's seen state
 */
function updateSeenState(userState, characterId, imageIds = []) {
  const state = userState || {};
  const now = Date.now();
  
  // Update seen characters
  if (!state.seenCharacters) state.seenCharacters = {};
  state.seenCharacters[characterId.toString()] = now;
  
  // Update seen images
  if (imageIds.length > 0) {
    if (!state.seenImages) state.seenImages = {};
    const chatIdStr = characterId.toString();
    if (!state.seenImages[chatIdStr]) state.seenImages[chatIdStr] = [];
    
    // Use Set for faster lookups
    const seenSet = new Set(state.seenImages[chatIdStr]);
    imageIds.forEach(imageId => {
      seenSet.add(imageId.toString());
    });
    state.seenImages[chatIdStr] = Array.from(seenSet);
    
    // Limit stored images per character to prevent bloat (keep last 50)
    if (state.seenImages[chatIdStr].length > 50) {
      state.seenImages[chatIdStr] = state.seenImages[chatIdStr].slice(-50);
    }
  }
  
  // Clean up old seen data (remove entries older than MEDIUM_TERM)
  const cleanupThreshold = now - TIME_CONSTANTS.MEDIUM_TERM;
  Object.keys(state.seenCharacters).forEach(charId => {
    if (state.seenCharacters[charId] < cleanupThreshold) {
      delete state.seenCharacters[charId];
      if (state.seenImages && state.seenImages[charId]) {
        delete state.seenImages[charId];
      }
    }
  });
  
  return state;
}

/**
 * Update user's tag preferences based on interaction
 */
function updateTagPreferences(userState, tags, interactionStrength = 1.0) {
  const state = userState || {};
  if (!state.tagPreferences) state.tagPreferences = {};
  if (!state.preferredTags) state.preferredTags = [];
  
  tags.forEach(tag => {
    const tagLower = tag.toLowerCase();
    
    // Increase tag score
    if (!state.tagPreferences[tagLower]) {
      state.tagPreferences[tagLower] = 0;
    }
    state.tagPreferences[tagLower] += interactionStrength;
  });
  
  // Update preferred tags list (top 10 tags)
  const sortedTags = Object.entries(state.tagPreferences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
  
  state.preferredTags = sortedTags;
  
  // Decay old tag preferences over time
  Object.keys(state.tagPreferences).forEach(tag => {
    state.tagPreferences[tag] *= 0.95; // 5% decay
    if (state.tagPreferences[tag] < 0.1) {
      delete state.tagPreferences[tag];
    }
  });
  
  return state;
}

module.exports = {
  sequenceCharacters,
  rotateCharacterImages,
  getColdStartPool,
  parseUserState,
  updateSeenState,
  updateTagPreferences,
  calculateCharacterScore,
  TIME_CONSTANTS,
  WEIGHTS,
};
