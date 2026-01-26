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
 * Follow a character
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Character/Chat ID to follow
 * @returns {Promise<Object>} Result of the operation
 */
async function followCharacter(db, userId, chatId) {
  const userIdObj = toObjectId(userId);
  const chatIdObj = toObjectId(chatId);
  
  const followersCollection = db.collection('character_followers');
  
  // Check if already following
  const existing = await followersCollection.findOne({
    userId: userIdObj,
    chatId: chatIdObj
  });
  
  if (existing) {
    return {
      success: false,
      message: 'Already following this character',
      alreadyExists: true
    };
  }
  
  const result = await followersCollection.insertOne({
    userId: userIdObj,
    chatId: chatIdObj,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  return {
    success: true,
    message: 'Character followed successfully',
    id: result.insertedId
  };
}

/**
 * Unfollow a character
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Character/Chat ID to unfollow
 * @returns {Promise<Object>} Result of the operation
 */
async function unfollowCharacter(db, userId, chatId) {
  const userIdObj = toObjectId(userId);
  const chatIdObj = toObjectId(chatId);
  
  const followersCollection = db.collection('character_followers');
  
  const result = await followersCollection.deleteOne({
    userId: userIdObj,
    chatId: chatIdObj
  });
  
  if (result.deletedCount === 0) {
    return {
      success: false,
      message: 'Follow relationship not found',
      notFound: true
    };
  }
  
  return {
    success: true,
    message: 'Character unfollowed successfully',
    deletedCount: result.deletedCount
  };
}

/**
 * Check if user is following a character
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Character/Chat ID
 * @returns {Promise<boolean>} True if user is following the character
 */
async function isFollowing(db, userId, chatId) {
  const userIdObj = toObjectId(userId);
  const chatIdObj = toObjectId(chatId);
  
  const followersCollection = db.collection('character_followers');
  
  const follow = await followersCollection.findOne({
    userId: userIdObj,
    chatId: chatIdObj
  });
  
  return !!follow;
}

/**
 * Toggle follow status for a character
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {string|ObjectId} chatId - Character/Chat ID
 * @returns {Promise<Object>} Result with new follow status
 */
async function toggleFollow(db, userId, chatId) {
  const isCurrentlyFollowing = await isFollowing(db, userId, chatId);
  
  if (isCurrentlyFollowing) {
    const result = await unfollowCharacter(db, userId, chatId);
    return {
      ...result,
      isFollowing: false
    };
  } else {
    const result = await followCharacter(db, userId, chatId);
    return {
      ...result,
      isFollowing: true
    };
  }
}

/**
 * Get follower count for a character
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} chatId - Character/Chat ID
 * @returns {Promise<number>} Total number of followers
 */
async function getFollowerCount(db, chatId) {
  const chatIdObj = toObjectId(chatId);
  const followersCollection = db.collection('character_followers');
  
  return await followersCollection.countDocuments({ chatId: chatIdObj });
}

/**
 * Get all followers of a character
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} chatId - Character/Chat ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of follower user IDs
 */
async function getCharacterFollowers(db, chatId, options = {}) {
  const chatIdObj = toObjectId(chatId);
  const page = options.page || 1;
  const limit = options.limit || 100;
  const skip = (page - 1) * limit;
  
  const followersCollection = db.collection('character_followers');
  
  const followers = await followersCollection
    .find({ chatId: chatIdObj })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  
  return followers.map(f => f.userId);
}

/**
 * Get all characters a user is following
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated list of followed characters
 */
async function getUserFollowedCharacters(db, userId, options = {}) {
  const userIdObj = toObjectId(userId);
  const page = options.page || 1;
  const limit = options.limit || 12;
  const skip = (page - 1) * limit;
  
  const followersCollection = db.collection('character_followers');
  
  // Get total count
  const totalCount = await followersCollection.countDocuments({ userId: userIdObj });
  
  // Get followed characters with pagination
  const follows = await followersCollection
    .find({ userId: userIdObj })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();
  
  // Extract chat IDs
  const chatIds = follows.map(f => f.chatId);
  
  // Fetch character data
  const chatsCollection = db.collection('chats');
  const characters = await chatsCollection
    .find({ _id: { $in: chatIds } })
    .toArray();
  
  return {
    data: follows.map(follow => {
      const character = characters.find(c => c._id.toString() === follow.chatId.toString());
      return {
        ...character,
        followedAt: follow.createdAt
      };
    }).filter(Boolean),
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}

/**
 * Delete all follows for a user (used when deleting user account)
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} userId - User ID
 * @returns {Promise<Object>} Result of deletion
 */
async function deleteUserFollows(db, userId) {
  const userIdObj = toObjectId(userId);
  const followersCollection = db.collection('character_followers');
  
  const result = await followersCollection.deleteMany({ userId: userIdObj });
  
  return {
    success: true,
    deletedCount: result.deletedCount
  };
}

module.exports = {
  followCharacter,
  unfollowCharacter,
  isFollowing,
  toggleFollow,
  getFollowerCount,
  getCharacterFollowers,
  getUserFollowedCharacters,
  deleteUserFollows,
  toObjectId
};
