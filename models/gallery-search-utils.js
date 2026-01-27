const { ObjectId } = require('mongodb');
const { getLanguageName } = require('./tool');
const { 
  sequenceCharacters, 
  rotateCharacterImages,
  getColdStartPool 
} = require('./content-sequencing-utils');
const { getUserInteractionState } = require('./user-interaction-utils');

/**
 * Build search pipeline for images
 */
function buildSearchPipeline(queryStr, language, requestLang, skip, limit) {
  // Prepare search words
  const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');
  const hasQuery = queryWords.length > 0;

  // Match only entries with image URLs
  const baseMatch = {
    'images.imageUrl': { $exists: true, $ne: null }
  };

  // Language filter (via $lookup)
  const chatLanguageMatch = [
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
        $or: [
          { 'chat.language': language },
          { 'chat.language': requestLang }
        ]
      }
    }
  ];

  // Build pipeline based on whether we have a query
  const pipeline = [
    { $unwind: '$images' },
    { $match: baseMatch },
    ...chatLanguageMatch
  ];

  if (hasQuery) {
    // Score expressions for relevance
    const scoreExpressions = queryWords.map(word => ({
      $cond: [
        { $eq: [{ $type: "$images.prompt" }, "string"] },
        {
          $cond: [
            { $regexMatch: { input: "$images.prompt", regex: new RegExp(word, "i") } },
            1,
            0
          ]
        },
        0
      ]
    }));

    pipeline.push({
      $addFields: {
        matchScore: { $sum: scoreExpressions }
      }
    });
    pipeline.push({ $match: { matchScore: { $gt: 0 } } });
    pipeline.push({ $sort: { matchScore: -1, _id: -1 } });
  } else {
    // No query: just sort by date
    pipeline.push({ $sort: { _id: -1 } });
  }

  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });
  pipeline.push({
    $project: {
      _id: 0,
      image: '$images',
      chatId: 1,
      chat: 1,
      matchScore: 1
    }
  });

  return pipeline;
}

/**
 * Build count pipeline for images
 */
function buildCountPipeline(queryStr, language, requestLang) {
  const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');
  const hasQuery = queryWords.length > 0;

  const baseMatch = {
    'images.imageUrl': { $exists: true, $ne: null }
  };

  const chatLanguageMatch = [
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
        $or: [
          { 'chat.language': language },
          { 'chat.language': requestLang }
        ]
      }
    }
  ];

  const pipeline = [
    { $unwind: '$images' },
    { $match: baseMatch },
    ...chatLanguageMatch
  ];

  if (hasQuery) {
    const scoreExpressions = queryWords.map(word => ({
      $cond: [
        { $eq: [{ $type: "$images.prompt" }, "string"] },
        {
          $cond: [
            { $regexMatch: { input: "$images.prompt", regex: new RegExp(word, "i") } },
            1,
            0
          ]
        },
        0
      ]
    }));

    pipeline.push({
      $addFields: {
        matchScore: { $sum: scoreExpressions }
      }
    });
    pipeline.push({ $match: { matchScore: { $gt: 0 } } });
  }

  pipeline.push({ $count: 'total' });

  return pipeline;
}

/**
 * Build search pipeline for videos
 */
function buildVideoSearchPipeline(queryStr, language, requestLang, skip, limit) {
  const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');
  const hasQuery = queryWords.length > 0;

  // Match only entries with video URLs
  const baseMatch = {
    'videos.videoUrl': { $exists: true, $ne: null }
  };

  // Language filter
  const chatLanguageMatch = [
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
        $or: [
          { 'chat.language': language },
          { 'chat.language': requestLang }
        ]
      }
    }
  ];

  const pipeline = [
    { $unwind: '$videos' },
    { $match: baseMatch },
    ...chatLanguageMatch
  ];

  if (hasQuery) {
    // Score expressions for relevance
    const scoreExpressions = queryWords.map(word => ({
      $cond: [
        { $eq: [{ $type: "$videos.prompt" }, "string"] },
        {
          $cond: [
            { $regexMatch: { input: "$videos.prompt", regex: new RegExp(word, "i") } },
            1,
            0
          ]
        },
        0
      ]
    }));

    pipeline.push({
      $addFields: {
        matchScore: { $sum: scoreExpressions }
      }
    });
    pipeline.push({ $match: { matchScore: { $gt: 0 } } });
    pipeline.push({ $sort: { matchScore: -1, _id: -1 } });
  } else {
    // No query: just sort by date
    pipeline.push({ $sort: { _id: -1 } });
  }

  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });
  pipeline.push({
    $project: {
      _id: 0,
      video: '$videos',
      chatId: 1,
      chat: 1,
      matchScore: 1
    }
  });

  return pipeline;
}

/**
 * Build count pipeline for videos
 */
function buildVideoCountPipeline(queryStr, language, requestLang) {
  const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');
  const hasQuery = queryWords.length > 0;

  const baseMatch = {
    'videos.videoUrl': { $exists: true, $ne: null }
  };

  const chatLanguageMatch = [
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
        $or: [
          { 'chat.language': language },
          { 'chat.language': requestLang }
        ]
      }
    }
  ];

  const pipeline = [
    { $unwind: '$videos' },
    { $match: baseMatch },
    ...chatLanguageMatch
  ];

  if (hasQuery) {
    const scoreExpressions = queryWords.map(word => ({
      $cond: [
        { $eq: [{ $type: "$videos.prompt" }, "string"] },
        {
          $cond: [
            { $regexMatch: { input: "$videos.prompt", regex: new RegExp(word, "i") } },
            1,
            0
          ]
        },
        0
      ]
    }));

    pipeline.push({
      $addFields: {
        matchScore: { $sum: scoreExpressions }
      }
    });
    pipeline.push({ $match: { matchScore: { $gt: 0 } } });
  }

  pipeline.push({ $count: 'total' });

  return pipeline;
}

/**
 * Process image results with chat data
 */
function processImageResults(docs, limit = 3) {
  // Group and limit images per chat
  const grouped = {};
  const limitedDocs = [];
  
  for (const doc of docs) {
    const chatIdStr = String(doc.chatId);
    if (!grouped[chatIdStr]) grouped[chatIdStr] = 0;
    if (grouped[chatIdStr] < limit) {
      limitedDocs.push(doc);
      grouped[chatIdStr]++;
    }
  }

  return limitedDocs.map(doc => {
    const chat = doc.chat || {};
    return {
      ...doc.image,
      chatId: doc.chatId,
      chatName: chat.name,
      chatImageUrl: chat.chatImageUrl || '/img/default-thumbnail.png',
      chatTags: chat.tags || [],
      chatSlug: chat.slug || '',
      messagesCount: chat.messagesCount || 0,
      first_message: chat.first_message || '',
      description: chat.description || '',
      galleries: chat.galleries || [],
      nickname: chat.nickname || '',
      imageCount: chat.imageCount,
      matchScore: doc.matchScore
    };
  });
}

/**
 * Process video results with chat data
 */
function processVideoResults(docs, limit = 3) {
  // Group and limit videos per chat
  const grouped = {};
  const limitedDocs = [];
  
  for (const doc of docs) {
    const chatIdStr = String(doc.chatId);
    if (!grouped[chatIdStr]) grouped[chatIdStr] = 0;
    if (grouped[chatIdStr] < limit) {
      limitedDocs.push(doc);
      grouped[chatIdStr]++;
    }
  }

  return limitedDocs.map(doc => {
    const chat = doc.chat || {};
    return {
      ...doc.video,
      chatId: doc.chatId,
      chatName: chat.name,
      chatImageUrl: chat.chatImageUrl || '/img/default-thumbnail.png',
      chatTags: chat.tags || [],
      chatSlug: chat.slug || '',
      messagesCount: chat.messagesCount || 0,
      first_message: chat.first_message || '',
      description: chat.description || '',
      galleries: chat.galleries || [],
      nickname: chat.nickname || '',
      imageCount: chat.imageCount,
      matchScore: doc.matchScore
    };
  });
}

/**
 * Search images with pagination
 */
async function searchImages(db, user, queryStr, page = 1, limit = 24) {
  const language = getLanguageName(user?.lang);
  const skip = (page - 1) * limit;
  const chatsGalleryCollection = db.collection('gallery');
  
  const requestLang = user?.lang || 'en';

  const pipeline = buildSearchPipeline(queryStr, language, requestLang, skip, limit);
  const countPipeline = buildCountPipeline(queryStr, language, requestLang);

  const [allChatImagesDocs, totalCountDocs] = await Promise.all([
    chatsGalleryCollection.aggregate(pipeline).toArray(),
    chatsGalleryCollection.aggregate(countPipeline).toArray()
  ]);

  const totalImages = totalCountDocs.length ? totalCountDocs[0].total : 0;
  const totalPages = Math.ceil(totalImages / limit);

  const processedImages = processImageResults(allChatImagesDocs);

  return {
    images: processedImages,
    page,
    totalPages,
    totalCount: totalImages
  };
}

/**
 * Search videos with pagination
 */
async function searchVideos(db, user, queryStr, page = 1, limit = 24) {
  const skip = (page - 1) * limit;
  const videosCollection = db.collection('videos');
  
  const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');
  const hasQuery = queryWords.length > 0;

  // Build base match for videos collection
  let matchStage = {
    videoUrl: { $exists: true, $ne: null }
  };

  // Add search filter if query exists
  if (hasQuery) {
    matchStage = {
      ...matchStage,
      $or: [
        { prompt: { $regex: queryWords[0], $options: 'i' } }
      ]
    };
  }

  // Aggregation pipeline to get videos with chat info and image URL for blurred thumbnails
  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'chats',
        localField: 'chatId',
        foreignField: '_id',
        as: 'chat'
      }
    },
    { $unwind: { path: '$chat', preserveNullAndEmptyArrays: true } },
    // Lookup image URL from gallery collection using imageId
    {
      $lookup: {
        from: 'gallery',
        let: { imageId: '$imageId' },
        pipeline: [
          { $unwind: '$images' },
          { $match: { $expr: { $eq: ['$images._id', '$$imageId'] } } },
          { $project: { imageUrl: '$images.imageUrl', _id: 0 } }
        ],
        as: 'imageData'
      }
    },
    { $unwind: { path: '$imageData', preserveNullAndEmptyArrays: true } },
    { $sort: hasQuery ? { createdAt: -1 } : { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        videoUrl: 1,
        imageUrl: { $ifNull: ['$imageData.imageUrl', null] },
        videoId: '$_id',
        duration: 1,
        prompt: 1,
        title: { $cond: [{ $gt: [{ $strLenCP: '$prompt' }, 0] }, { $substr: ['$prompt', 0, 100] }, 'Video'] },
        nsfw: 1,
        createdAt: 1,
        chatId: 1,
        chatName: '$chat.name',
        chatImageUrl: { $ifNull: ['$chat.chatImageUrl', '/img/default-thumbnail.png'] },
        chatTags: { $ifNull: ['$chat.tags', []] },
        chatSlug: { $ifNull: ['$chat.slug', ''] },
        slug: { $toString: '$_id' }
      }
    }
  ];

  // Count total for pagination
  const countPipeline = [
    { $match: matchStage },
    { $count: 'total' }
  ];

  const [processedVideos, countResult] = await Promise.all([
    videosCollection.aggregate(pipeline).toArray(),
    videosCollection.aggregate(countPipeline).toArray()
  ]);

  const totalVideos = countResult.length ? countResult[0].total : 0;
  const totalPages = Math.ceil(totalVideos / limit);

  return {
    videos: processedVideos,
    page,
    totalPages,
    totalCount: totalVideos
  };
}

/**
 * Search images grouped by character for explore gallery
 * Returns characters with their images for swipe navigation
 * Now with TikTok-style sequencing: weighted randomness + personalization
 */

// Helper to check NSFW value (server-side version)
function isNsfwValue(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

async function searchImagesGroupedByCharacter(db, user, queryStr = '', page = 1, limit = 20, showNSFW = false, userState = null) {
  const language = getLanguageName(user?.lang);
  const requestLang = user?.lang || 'en';
  const chatsGalleryCollection = db.collection('gallery');
  const chatsCollection = db.collection('chats');

  // Prepare search words
  const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');
  const hasQuery = queryWords.length > 0;
  
  // Get user interaction state for personalization
  let interactionState = userState;
  if (!interactionState && user && !user.isTemporary) {
    interactionState = await getUserInteractionState(db, user._id);
  }

  // Use smart sequencing for page 1 (with or without query)
  // For pages > 1, use traditional pagination
  const useSmartSequencing = page === 1;
  
  // Fetch MORE characters than needed if using smart sequencing (for better selection pool)
  const fetchLimit = useSmartSequencing ? limit * 3 : limit;
  const skip = useSmartSequencing ? 0 : (page - 1) * limit;

  // Build the aggregation pipeline to group images by character
  const pipeline = [
    // Unwind images
    { $unwind: '$images' },
    
    // Match images with URLs
    { 
      $match: { 
        'images.imageUrl': { $exists: true, $ne: null }
      } 
    },

    // Lookup chat information
    {
      $lookup: {
        from: 'chats',
        localField: 'chatId',
        foreignField: '_id',
        as: 'chat'
      }
    },
    { $unwind: '$chat' },

    // Filter by language and public visibility
    {
      $match: {
        'chat.visibility': 'public',
        $or: [
          { 'chat.language': language },
          { 'chat.language': requestLang }
        ]
      }
    }
  ];

  // Add search scoring if query exists
  if (hasQuery) {
    const scoreExpressions = queryWords.map(word => ({
      $cond: [
        {
          $or: [
            { $regexMatch: { input: { $ifNull: ['$images.prompt', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.name', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.description', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.first_message', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.nickname', ''] }, regex: new RegExp(word, 'i') } },
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ['$chat.tags', []] },
                      cond: { $regexMatch: { input: '$$this', regex: new RegExp(word, 'i') } }
                    }
                  }
                },
                0
              ]
            }
          ]
        },
        1,
        0
      ]
    }));

    pipeline.push({
      $addFields: {
        matchScore: { $sum: scoreExpressions }
      }
    });
    pipeline.push({ $match: { matchScore: { $gt: 0 } } });
  }

  // Group by character
  pipeline.push({
    $group: {
      _id: '$chatId',
      chatId: { $first: '$chatId' },
      chatName: { $first: '$chat.name' },
      chatSlug: { $first: '$chat.slug' },
      chatImageUrl: { $first: '$chat.chatImageUrl' },
      chatTags: { $first: '$chat.tags' },
      description: { $first: '$chat.description' },
      imageModel: { $first: '$chat.imageModel' },
      images: {
        $push: {
          _id: '$images._id',
          imageUrl: '$images.imageUrl',
          thumbnailUrl: '$images.thumbnailUrl',
          prompt: '$images.prompt',
          title: '$images.title',
          nsfw: '$images.nsfw',
          createdAt: '$images.createdAt'
        }
      },
      imageCount: { $sum: 1 },
      latestImage: { $max: '$images.createdAt' },
      totalScore: { $sum: { $ifNull: ['$matchScore', 0] } }
    }
  });

  // Sort by relevance (if query) or by latest image date
  if (hasQuery) {
    pipeline.push({ $sort: { totalScore: -1, latestImage: -1 } });
  } else {
    pipeline.push({ $sort: { latestImage: -1 } });
  }

  // Pagination
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: fetchLimit });

  // Balance SFW and NSFW images using $filter
  pipeline.push({
    $addFields: {
      sfwImages: {
        $filter: {
          input: '$images',
          cond: { $not: { $in: ['$$this.nsfw', [true, 'true', 'on']] } }
        }
      },
      nsfwImages: {
        $filter: {
          input: '$images',
          cond: { $in: ['$$this.nsfw', [true, 'true', 'on']] }
        }
      }
    }
  });

  // Final projection: take up to 10 SFW + 10 NSFW for balanced mix
  pipeline.push({
    $project: {
      _id: 0,
      chatId: 1,
      chatName: 1,
      chatSlug: 1,
      chatImageUrl: { $ifNull: ['$chatImageUrl', '/img/default-thumbnail.png'] },
      chatTags: { $ifNull: ['$chatTags', []] },
      description: 1,
      imageCount: 1,
      images: {
        $concatArrays: [
          { $slice: ['$sfwImages', 10] },
          { $slice: ['$nsfwImages', 10] }
        ]
      },
      latestImage: 1
    }
  });

  // Count total characters for pagination - mirrors the main pipeline for accuracy
  const countPipeline = [
    { $unwind: '$images' },
    { $match: { 'images.imageUrl': { $exists: true, $ne: null } } },
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
        'chat.visibility': 'public',
        $or: [
          { 'chat.language': language },
          { 'chat.language': requestLang }
        ]
      }
    }
  ];

  // Add search scoring to count pipeline if query exists
  if (hasQuery) {
    const scoreExpressions = queryWords.map(word => ({
      $cond: [
        {
          $or: [
            { $regexMatch: { input: { $ifNull: ['$images.prompt', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.name', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.description', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.first_message', ''] }, regex: new RegExp(word, 'i') } },
            { $regexMatch: { input: { $ifNull: ['$chat.nickname', ''] }, regex: new RegExp(word, 'i') } },
            {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: { $ifNull: ['$chat.tags', []] },
                      cond: { $regexMatch: { input: '$$this', regex: new RegExp(word, 'i') } }
                    }
                  }
                },
                0
              ]
            }
          ]
        },
        1,
        0
      ]
    }));

    countPipeline.push({
      $addFields: {
        matchScore: { $sum: scoreExpressions }
      }
    });
    countPipeline.push({ $match: { matchScore: { $gt: 0 } } });
  }

  countPipeline.push({ $group: { _id: '$chatId' } });
  countPipeline.push({ $count: 'total' });

  try {
    const [characters, countResult] = await Promise.all([
      chatsGalleryCollection.aggregate(pipeline).toArray(),
      chatsGalleryCollection.aggregate(countPipeline).toArray()
    ]);

    const totalCharacters = countResult.length ? countResult[0].total : 0;
    
    // Apply smart sequencing for page 1 without query
    let finalCharacters = characters;
    if (useSmartSequencing && characters.length > 0) {
      // Apply weighted randomness and personalization
      finalCharacters = await sequenceCharacters(characters, interactionState, {
        limit,
        excludeRecent: true
      });
    }
    
    const hasMore = (page * limit) < totalCharacters;

    return {
      characters: finalCharacters,
      page,
      totalCharacters,
      hasMore
    };
  } catch (err) {
    console.error('[gallery-search-utils] Error in searchImagesGroupedByCharacter:', err);
    throw err;
  }
}

module.exports = {
  buildSearchPipeline,
  buildCountPipeline,
  buildVideoSearchPipeline,
  buildVideoCountPipeline,
  processImageResults,
  processVideoResults,
  searchImages,
  searchVideos,
  searchImagesGroupedByCharacter
};
