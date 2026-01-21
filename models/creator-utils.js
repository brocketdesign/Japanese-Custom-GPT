/**
 * Creator Utilities
 * 
 * Functions for managing creator profiles, verification, and discovery.
 * Part of Phase 2: Creator Profile Enhancement
 */

const { ObjectId } = require('mongodb');

/**
 * Creator Profile Schema (embedded in users collection)
 * 
 * creatorProfile: {
 *   displayName: String,
 *   bio: String,
 *   coverImage: String,
 *   category: String,           // 'anime', 'realistic', 'mixed', 'art', 'photography'
 *   tags: [String],
 *   socialLinks: {
 *     instagram: String,
 *     twitter: String,
 *     website: String,
 *     youtube: String,
 *     tiktok: String
 *   },
 *   verified: Boolean,
 *   verifiedAt: Date,
 *   featuredContent: [ObjectId],
 *   subscriberCount: Number,
 *   totalEarnings: Number,
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 */

// Available creator categories
const CREATOR_CATEGORIES = [
  { id: 'anime', label: 'Anime & Manga', icon: 'bi-stars' },
  { id: 'realistic', label: 'Realistic & Photorealistic', icon: 'bi-camera' },
  { id: 'mixed', label: 'Mixed Styles', icon: 'bi-palette' },
  { id: 'art', label: 'Digital Art', icon: 'bi-brush' },
  { id: 'photography', label: 'AI Photography', icon: 'bi-image' },
  { id: 'fantasy', label: 'Fantasy & Sci-Fi', icon: 'bi-rocket' },
  { id: 'characters', label: 'Character Design', icon: 'bi-person-badge' },
  { id: 'nsfw', label: 'Adult Content', icon: 'bi-shield-exclamation' }
];

/**
 * Get default creator profile object
 * @returns {Object} Default creator profile structure
 */
function getDefaultCreatorProfile() {
  return {
    displayName: '',
    bio: '',
    coverImage: '',
    category: 'mixed',
    tags: [],
    socialLinks: {
      instagram: '',
      twitter: '',
      website: '',
      youtube: '',
      tiktok: ''
    },
    verified: false,
    verifiedAt: null,
    featuredContent: [],
    subscriberCount: 0,
    totalEarnings: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Check if user has premium subscription
 * @param {Object} user - User object from database
 * @returns {boolean} Whether user has premium subscription
 */
function isPremiumUser(user) {
  return user?.subscriptionStatus === 'active';
}

/**
 * Apply to become a creator
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {Object} applicationData - Application data
 * @returns {Object} Result of the application
 */
async function applyAsCreator(db, userId, applicationData) {
  try {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.isCreator) {
      return { success: false, error: 'User is already a creator' };
    }

    // Check if user has premium subscription
    if (!isPremiumUser(user)) {
      return { success: false, error: 'Premium subscription required to become a creator', code: 'PREMIUM_REQUIRED' };
    }

    // Create creator profile
    const creatorProfile = {
      ...getDefaultCreatorProfile(),
      displayName: applicationData.displayName || user.nickname,
      bio: applicationData.bio || '',
      category: applicationData.category || 'mixed',
      tags: applicationData.tags || [],
      socialLinks: {
        instagram: applicationData.instagram || '',
        twitter: applicationData.twitter || '',
        website: applicationData.website || '',
        youtube: applicationData.youtube || '',
        tiktok: applicationData.tiktok || ''
      }
    };

    // Update user with creator status
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          isCreator: true,
          creatorProfile: creatorProfile,
          creatorApplicationDate: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: 'Failed to update user' };
    }

    // Log the creator application
    await db.collection('creatorApplications').insertOne({
      userId: new ObjectId(userId),
      applicationData,
      status: 'approved', // Auto-approve for now
      createdAt: new Date()
    });

    return { 
      success: true, 
      message: 'Successfully became a creator',
      creatorProfile 
    };
  } catch (error) {
    console.error('Error in applyAsCreator:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Update creator profile
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Object} Result of the update
 */
async function updateCreatorProfile(db, userId, profileData) {
  try {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.isCreator) {
      return { success: false, error: 'User is not a creator' };
    }

    // Build update object
    const updateFields = {};
    
    if (profileData.displayName !== undefined) {
      updateFields['creatorProfile.displayName'] = profileData.displayName;
    }
    if (profileData.bio !== undefined) {
      updateFields['creatorProfile.bio'] = profileData.bio;
    }
    if (profileData.coverImage !== undefined) {
      updateFields['creatorProfile.coverImage'] = profileData.coverImage;
    }
    if (profileData.category !== undefined) {
      updateFields['creatorProfile.category'] = profileData.category;
    }
    if (profileData.tags !== undefined) {
      updateFields['creatorProfile.tags'] = profileData.tags;
    }
    if (profileData.socialLinks !== undefined) {
      if (profileData.socialLinks.instagram !== undefined) {
        updateFields['creatorProfile.socialLinks.instagram'] = profileData.socialLinks.instagram;
      }
      if (profileData.socialLinks.twitter !== undefined) {
        updateFields['creatorProfile.socialLinks.twitter'] = profileData.socialLinks.twitter;
      }
      if (profileData.socialLinks.website !== undefined) {
        updateFields['creatorProfile.socialLinks.website'] = profileData.socialLinks.website;
      }
      if (profileData.socialLinks.youtube !== undefined) {
        updateFields['creatorProfile.socialLinks.youtube'] = profileData.socialLinks.youtube;
      }
      if (profileData.socialLinks.tiktok !== undefined) {
        updateFields['creatorProfile.socialLinks.tiktok'] = profileData.socialLinks.tiktok;
      }
    }
    if (profileData.featuredContent !== undefined) {
      updateFields['creatorProfile.featuredContent'] = profileData.featuredContent.map(id => new ObjectId(id));
    }

    updateFields['creatorProfile.updatedAt'] = new Date();

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: 'No changes made' };
    }

    const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
    return { 
      success: true, 
      message: 'Profile updated successfully',
      creatorProfile: updatedUser.creatorProfile 
    };
  } catch (error) {
    console.error('Error in updateCreatorProfile:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get creators list with filtering and pagination
 * @param {Object} db - MongoDB database instance
 * @param {Object} options - Query options
 * @returns {Object} List of creators
 */
async function getCreators(db, options = {}) {
  try {
    const {
      page = 1,
      limit = 12,
      category = null,
      search = null,
      sortBy = 'popular', // 'popular', 'newest', 'trending'
      verified = null
    } = options;

    const usersCollection = db.collection('users');
    const query = { isCreator: true };

    // Apply filters
    if (category && category !== 'all') {
      query['creatorProfile.category'] = category;
    }

    if (verified !== null) {
      query['creatorProfile.verified'] = verified;
    }

    if (search) {
      query.$or = [
        { 'creatorProfile.displayName': { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } },
        { 'creatorProfile.tags': { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Determine sort order
    let sortOrder = {};
    switch (sortBy) {
      case 'popular':
        sortOrder = { 'creatorProfile.subscriberCount': -1, followerCount: -1 };
        break;
      case 'newest':
        sortOrder = { 'creatorProfile.createdAt': -1 };
        break;
      case 'trending':
        // For trending, we'd ideally use recent engagement metrics
        sortOrder = { 'creatorProfile.subscriberCount': -1, updatedAt: -1 };
        break;
      default:
        sortOrder = { 'creatorProfile.subscriberCount': -1 };
    }

    const skip = (page - 1) * limit;

    const [creators, totalCount] = await Promise.all([
      usersCollection
        .find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .project({
          _id: 1,
          nickname: 1,
          profileUrl: 1,
          followerCount: 1,
          isCreator: 1,
          creatorProfile: 1
        })
        .toArray(),
      usersCollection.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      creators: creators.map(formatCreatorForDisplay),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore: page < totalPages
      }
    };
  } catch (error) {
    console.error('Error in getCreators:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get featured creators
 * @param {Object} db - MongoDB database instance
 * @param {number} limit - Number of creators to return
 * @returns {Object} List of featured creators
 */
async function getFeaturedCreators(db, limit = 6) {
  try {
    const usersCollection = db.collection('users');
    
    const creators = await usersCollection
      .find({ 
        isCreator: true,
        'creatorProfile.verified': true
      })
      .sort({ 'creatorProfile.subscriberCount': -1, followerCount: -1 })
      .limit(limit)
      .project({
        _id: 1,
        nickname: 1,
        profileUrl: 1,
        followerCount: 1,
        isCreator: 1,
        creatorProfile: 1
      })
      .toArray();

    return {
      success: true,
      creators: creators.map(formatCreatorForDisplay)
    };
  } catch (error) {
    console.error('Error in getFeaturedCreators:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get trending creators (based on recent activity)
 * @param {Object} db - MongoDB database instance
 * @param {number} limit - Number of creators to return
 * @returns {Object} List of trending creators
 */
async function getTrendingCreators(db, limit = 6) {
  try {
    const usersCollection = db.collection('users');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get creators who have been recently active
    const creators = await usersCollection
      .find({ 
        isCreator: true,
        $or: [
          { 'creatorProfile.updatedAt': { $gte: thirtyDaysAgo } },
          { lastActive: { $gte: thirtyDaysAgo } }
        ]
      })
      .sort({ followerCount: -1, 'creatorProfile.subscriberCount': -1 })
      .limit(limit)
      .project({
        _id: 1,
        nickname: 1,
        profileUrl: 1,
        followerCount: 1,
        isCreator: 1,
        creatorProfile: 1
      })
      .toArray();

    return {
      success: true,
      creators: creators.map(formatCreatorForDisplay)
    };
  } catch (error) {
    console.error('Error in getTrendingCreators:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get creator profile by user ID
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID
 * @returns {Object} Creator profile data
 */
async function getCreatorProfile(db, userId) {
  try {
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne(
      { _id: new ObjectId(userId), isCreator: true },
      {
        projection: {
          _id: 1,
          nickname: 1,
          profileUrl: 1,
          bio: 1,
          followerCount: 1,
          followCount: 1,
          isCreator: 1,
          creatorProfile: 1,
          chatCount: 1,
          imageLikeCount: 1
        }
      }
    );

    if (!user) {
      return { success: false, error: 'Creator not found' };
    }

    return {
      success: true,
      creator: formatCreatorForDisplay(user)
    };
  } catch (error) {
    console.error('Error in getCreatorProfile:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Verify a creator (admin function)
 * @param {Object} db - MongoDB database instance
 * @param {string} userId - User ID to verify
 * @returns {Object} Result of verification
 */
async function verifyCreator(db, userId) {
  try {
    const usersCollection = db.collection('users');
    
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId), isCreator: true },
      {
        $set: {
          'creatorProfile.verified': true,
          'creatorProfile.verifiedAt': new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: 'Creator not found or already verified' };
    }

    return { success: true, message: 'Creator verified successfully' };
  } catch (error) {
    console.error('Error in verifyCreator:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Format creator data for display
 * @param {Object} user - User document
 * @returns {Object} Formatted creator data
 */
function formatCreatorForDisplay(user) {
  const profile = user.creatorProfile || {};
  
  return {
    _id: user._id,
    userId: user._id,
    nickname: user.nickname,
    displayName: profile.displayName || user.nickname,
    profileUrl: user.profileUrl || '/img/avatar.png',
    coverImage: profile.coverImage || '',
    bio: profile.bio || user.bio || '',
    category: profile.category || 'mixed',
    categoryLabel: CREATOR_CATEGORIES.find(c => c.id === profile.category)?.label || 'Mixed Styles',
    tags: profile.tags || [],
    socialLinks: profile.socialLinks || {},
    verified: profile.verified || false,
    followerCount: user.followerCount || 0,
    subscriberCount: profile.subscriberCount || 0,
    chatCount: user.chatCount || 0,
    imageLikeCount: user.imageLikeCount || 0,
    createdAt: profile.createdAt
  };
}

/**
 * Increment subscriber count for a creator
 * @param {Object} db - MongoDB database instance
 * @param {string} creatorId - Creator user ID
 * @param {number} increment - Amount to increment (positive or negative)
 */
async function updateSubscriberCount(db, creatorId, increment) {
  try {
    const usersCollection = db.collection('users');
    await usersCollection.updateOne(
      { _id: new ObjectId(creatorId), isCreator: true },
      { $inc: { 'creatorProfile.subscriberCount': increment } }
    );
  } catch (error) {
    console.error('Error updating subscriber count:', error);
  }
}

/**
 * Get creator categories
 * @returns {Array} List of available categories
 */
function getCreatorCategories() {
  return CREATOR_CATEGORIES;
}

module.exports = {
  CREATOR_CATEGORIES,
  getDefaultCreatorProfile,
  applyAsCreator,
  updateCreatorProfile,
  getCreators,
  getFeaturedCreators,
  getTrendingCreators,
  getCreatorProfile,
  verifyCreator,
  formatCreatorForDisplay,
  updateSubscriberCount,
  getCreatorCategories
};
