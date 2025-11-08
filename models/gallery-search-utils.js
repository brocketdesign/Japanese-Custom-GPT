const { ObjectId } = require('mongodb');
const { getLanguageName } = require('./tool');

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

module.exports = {
  buildSearchPipeline,
  buildCountPipeline,
  buildVideoSearchPipeline,
  buildVideoCountPipeline,
  processImageResults,
  processVideoResults,
  searchImages,
  searchVideos
};
