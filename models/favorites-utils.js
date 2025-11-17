const { ObjectId } = require('mongodb');

/**
 * Convert value to ObjectId
 */
function toObjectId(id) {
  if (id instanceof ObjectId) {
    return id;
  }
  try {
    return new ObjectId(id);
  } catch (error) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
}

/**
 * Add a chat to user's favorites
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID to favorite
 * @returns {Promise<Object>} Result of the operation
 */
async function addFavorite(db, userId, chatId) {
  const userIdObj = toObjectId(userId);
  const chatIdObj = toObjectId(chatId);
  
  const favoritesCollection = db.collection('user_favorites');
  
  // Check if already favorited
  const existing = await favoritesCollection.findOne({
    userId: userIdObj,
    chatId: chatIdObj
  });
  
  if (existing) {
    return {
      success: false,
      message: 'Chat is already in favorites',
      alreadyExists: true
    };
  }
  
  const result = await favoritesCollection.insertOne({
    userId: userIdObj,
    chatId: chatIdObj,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  return {
    success: true,
    message: 'Chat added to favorites',
    id: result.insertedId
  };
}

/**
 * Remove a chat from user's favorites
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID to remove from favorites
 * @returns {Promise<Object>} Result of the operation
 */
async function removeFavorite(db, userId, chatId) {
  const userIdObj = toObjectId(userId);
  const chatIdObj = toObjectId(chatId);
  
  const favoritesCollection = db.collection('user_favorites');
  
  const result = await favoritesCollection.deleteOne({
    userId: userIdObj,
    chatId: chatIdObj
  });
  
  if (result.deletedCount === 0) {
    return {
      success: false,
      message: 'Favorite not found',
      notFound: true
    };
  }
  
  return {
    success: true,
    message: 'Chat removed from favorites',
    deletedCount: result.deletedCount
  };
}

/**
 * Check if a chat is favorited by user
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID
 * @returns {Promise<boolean>} True if chat is favorited
 */
async function isFavorited(db, userId, chatId) {
  const userIdObj = toObjectId(userId);
  const chatIdObj = toObjectId(chatId);
  
  const favoritesCollection = db.collection('user_favorites');
  
  const favorite = await favoritesCollection.findOne({
    userId: userIdObj,
    chatId: chatIdObj
  });
  
  return !!favorite;
}

/**
 * Get all favorites for a user
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 12)
 * @returns {Promise<Object>} Paginated favorites with chat data
 */
async function getUserFavorites(db, userId, options = {}) {
  const userIdObj = toObjectId(userId);
  const page = options.page || 1;
  const limit = options.limit || 12;
  const skip = (page - 1) * limit;
  
  const favoritesCollection = db.collection('user_favorites');
  const chatsCollection = db.collection('chats');
  
  // Get total count
  const totalCount = await favoritesCollection.countDocuments({ userId: userIdObj });
  
  // Get favorites with pagination
  const favoriteDocs = await favoritesCollection
    .find({ userId: userIdObj })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  
  // Extract chat IDs
  const chatIds = favoriteDocs.map(fav => fav.chatId);
  
  // Fetch chat data
  const chats = await chatsCollection
    .find({ _id: { $in: chatIds } })
    .toArray();

  // Fetch last messages for these chats for the requesting user
  const chatLastMessageColl = db.collection('chatLastMessage');
  const lastMessages = await chatLastMessageColl
    .find({ chatId: { $in: chatIds }, userId: userIdObj })
    .toArray();

  const lastMessageMap = {};
  lastMessages.forEach(msg => {
    lastMessageMap[msg.chatId.toString()] = msg.lastMessage;
  });
  
  // Map favorites with chat data
  const favorites = favoriteDocs.map(fav => {
    const chat = chats.find(c => c._id.toString() === fav.chatId.toString());
    if (!chat) return null;

    // Normalize ObjectId and date values similar to /api/chat-list
    const normalizedChat = {
      ...chat,
      _id: chat._id.toString(),
      userId: chat.userId && typeof chat.userId.toString === 'function' ? chat.userId.toString() : chat.userId,
      lastMessage: lastMessageMap[chat._id.toString()] || null,
      updatedAt: chat.updatedAt instanceof Date ? chat.updatedAt.toISOString() : chat.updatedAt,
      createdAt: chat.createdAt instanceof Date ? chat.createdAt.toISOString() : chat.createdAt
    };

    return {
      favoriteId: fav._id.toString(),
      ...normalizedChat,
      favoritedAt: fav.createdAt instanceof Date ? fav.createdAt.toISOString() : fav.createdAt
    };
  }).filter(Boolean);
  
  return {
    data: favorites,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}

/**
 * Check favorites status for multiple chats
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Array<string|ObjectId>} chatIds - Array of Chat IDs
 * @returns {Promise<Map>} Map of chatId -> isFavorited
 */
async function checkFavoritesStatus(db, userId, chatIds) {
  const userIdObj = toObjectId(userId);
  const chatIdObjs = chatIds.map(id => toObjectId(id));
  
  const favoritesCollection = db.collection('user_favorites');
  
  const favorites = await favoritesCollection
    .find({
      userId: userIdObj,
      chatId: { $in: chatIdObjs }
    })
    .toArray();
  
  const statusMap = new Map();
  chatIds.forEach(id => {
    const isFav = favorites.some(fav => 
      fav.chatId.toString() === toObjectId(id).toString()
    );
    statusMap.set(id.toString(), isFav);
  });
  
  return statusMap;
}

/**
 * Toggle favorite status for a chat
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Chat ID
 * @returns {Promise<Object>} Result with new favorite status
 */
async function toggleFavorite(db, userId, chatId) {
  const isFav = await isFavorited(db, userId, chatId);
  
  if (isFav) {
    const result = await removeFavorite(db, userId, chatId);
    return {
      ...result,
      isFavorited: false
    };
  } else {
    const result = await addFavorite(db, userId, chatId);
    return {
      ...result,
      isFavorited: true
    };
  }
}

/**
 * Get favorite count for a user
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<number>} Total number of favorites
 */
async function getFavoriteCount(db, userId) {
  const userIdObj = toObjectId(userId);
  const favoritesCollection = db.collection('user_favorites');
  
  return await favoritesCollection.countDocuments({ userId: userIdObj });
}

/**
 * Delete all favorites for a user (used when deleting user account)
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object>} Result of deletion
 */
async function deleteUserFavorites(db, userId) {
  const userIdObj = toObjectId(userId);
  const favoritesCollection = db.collection('user_favorites');
  
  const result = await favoritesCollection.deleteMany({ userId: userIdObj });
  
  return {
    success: true,
    deletedCount: result.deletedCount
  };
}

module.exports = {
  addFavorite,
  removeFavorite,
  isFavorited,
  getUserFavorites,
  checkFavoritesStatus,
  toggleFavorite,
  getFavoriteCount,
  deleteUserFavorites,
  toObjectId
};
