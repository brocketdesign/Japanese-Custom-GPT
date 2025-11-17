const { ObjectId } = require('mongodb');
const { getLanguageName } = require('../models/tool');
const { removeUserPoints, awardLikeMilestoneReward, awardLikeActionReward } = require('../models/user-points-utils');
const { hasUserChattedWithCharacter } = require('../models/chat-tool-settings-utils');
const {
  getGalleryImageById,
  buildChatImageMessage,
  appendMessageToUserChat,
  getUserChatForUser,
  toObjectId
} = require('../models/gallery-utils');


async function routes(fastify, options) {
  fastify.post('/gallery/:imageId/like-toggle', async (request, reply) => { 
    try {
      const imageId = new fastify.mongo.ObjectId(request.params.imageId);
      const { action, userChatId } = request.body; // 'like' or 'unlike'
      const user = request.user;
      const userId = new fastify.mongo.ObjectId(user._id);

      const db = fastify.mongo.db;
      const galleryCollection = db.collection('gallery');
      const imagesLikesCollection = db.collection('images_likes');
      const usersCollection = db.collection('users'); // Collection to update user's imageLikeCount
      const collectionUserChat = db.collection('userChat');

      // Declare a function that will find the object with content that starts with [Image] or [image] followed by a space and then the imageId and update it with the like action field
      const findImageMessageandUpdateLikeAction = async (userChatId, userChatMessages, imageId, action) => {
        if (!userChatMessages || !userChatMessages.messages) {
          return;
        }
        
        const messageIndex = userChatMessages.messages.findIndex(msg => {
          const content = msg.content || '';
          const isMatch = (msg.type == "image" && msg.imageId == imageId) || 
                         content.startsWith('[Image] ' + imageId.toString()) || 
                         content.startsWith('[image] ' + imageId.toString());
          return isMatch;
        });
        
        if (messageIndex !== -1) {
          const message = userChatMessages.messages[messageIndex];
          
          // Initialize actions array if it doesn't exist
          if (!message.actions) {
            message.actions = [];
          }
          
          if (action === 'like') {
            // Check if like action already exists
            const existingLikeAction = message.actions.find(action => action.type === 'like');
            
            if (!existingLikeAction) {
              // Add like action to the actions array
              message.actions.push({
                type: 'like',
                date: new Date()
              });
            }
          } else if (action === 'unlike') {
            // Remove like action from actions array
            message.actions = message.actions.filter(action => action.type !== 'like');
          }
          
          // Update the userChatMessages in the database
          await collectionUserChat.updateOne(
            { _id: new fastify.mongo.ObjectId(userChatId) },
            { $set: { messages: userChatMessages.messages } }
          );
        }
      }

      if (action === 'like') {
        // Check if the user already liked the image
        const existingLike = await imagesLikesCollection.findOne({ imageId, userId });

        if (existingLike) {
          return reply.code(400).send({ error: 'User has already liked this image' });
        }

        // Try to find and update by _id first (regular images)
        let result = await galleryCollection.updateOne(
          { 'images._id': imageId },
          {
            $inc: { 'images.$.likes': 1 },
            $addToSet: { 'images.$.likedBy': userId }
          }
        );

        // If no match by _id, try by mergeId (for merged images)
        if (result.matchedCount === 0) {
          result = await galleryCollection.updateOne(
            { 'images.mergeId': imageId.toString() },
            {
              $inc: { 'images.$.likes': 1 },
              $addToSet: { 'images.$.likedBy': userId }
            }
          );
        }

        if (result.matchedCount === 0) {
          return reply.code(404).send({ error: 'Image not found' });
        }

        // Add like to the images_likes collection
        const likeDoc = {
          imageId,
          userId,
          likedAt: new Date(),
        };
        await imagesLikesCollection.insertOne(likeDoc);

        // Increment user's imageLikeCount
        await usersCollection.updateOne(
          { _id: userId },
          { $inc: { imageLikeCount: 1 } }
        );

        // Award points for like action and check for milestones
        try {
          await Promise.all([
            awardLikeActionReward(db, userId, fastify),
            awardLikeMilestoneReward(db, userId, fastify)
          ]);
        } catch (rewardError) {
          console.error('Error awarding like rewards:', rewardError);
          // Don't fail the like action if reward fails
        }

        if(userChatId && userChatId.trim() != ''){
          const userChatMessages = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(userChatId) });
          await findImageMessageandUpdateLikeAction(userChatId, userChatMessages, imageId, 'like');
        }

        return reply.send({ message: 'Image liked successfully' });

      } else if (action === 'unlike') {
        // Check if the user has already liked the image
        const existingLike = await imagesLikesCollection.findOne({ imageId, userId });

        if (!existingLike) {
          return reply.code(400).send({ error: 'User has not liked this image yet' });
        }

        // Try to find image by _id first (regular images)
        let image = await galleryCollection.findOne({ 'images._id': imageId });
        
        // If not found by _id, try by mergeId (for merged images)
        if (!image) {
          image = await galleryCollection.findOne({ 'images.mergeId': imageId.toString() });
        }
        
        const likes = image ? image.images.find(img => 
          img._id.equals(imageId) || img.mergeId === imageId.toString()
        )?.likes : 0;

        if (likes > 0) {
          // Try to remove like by _id first
          let result = await galleryCollection.updateOne(
            { 'images._id': imageId },
            {
              $inc: { 'images.$.likes': -1 },
              $pull: { 'images.$.likedBy': userId }
            }
          );

          // If no match by _id, try by mergeId
          if (result.matchedCount === 0) {
            result = await galleryCollection.updateOne(
              { 'images.mergeId': imageId.toString() },
              {
                $inc: { 'images.$.likes': -1 },
                $pull: { 'images.$.likedBy': userId }
              }
            );
          }

          if (result.matchedCount === 0) {
            return reply.code(404).send({ error: 'Image not found' });
          }

          // Remove like from the images_likes collection
          await imagesLikesCollection.deleteOne({ imageId, userId });

          // Decrement user's imageLikeCount, ensuring it doesn't go below 0
          const userDoc = await usersCollection.findOne({ _id: userId });
          
          if (userDoc.imageLikeCount > 0) {
            await usersCollection.updateOne(
              { _id: userId },
              { $inc: { imageLikeCount: -1 } }
            );
          }

          const cost = 5; // Cost for unliking an image (removing 5 points)
          console.log(`[gallery-like-toggle] Deducting ${cost} point for unliking image: ${imageId}`);
          try {
            await removeUserPoints(db, userId, cost, request.userPointsTranslations.points?.deduction_reasons?.unlike_image || 'Unlike image', 'unlike_image', fastify);
          } catch (error) {
            console.error('[gallery-like-toggle] Failed to deduct point for unlike:', error);
            // Optionally handle if you want to revert the unlike action or notify the user
          }

          if(userChatId && userChatId.trim() != ''){
            const userChatMessages = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(userChatId) });
            await findImageMessageandUpdateLikeAction(userChatId, userChatMessages, imageId, 'unlike');
          }

          return reply.send({ message: 'Image unliked successfully' });
        } else {
          return reply.code(400).send({ error: 'Cannot decrease like count below 0' });
        }
      } else {
        return reply.code(400).send({ error: 'Invalid action' });
      }
    } catch (err) {
      console.error('Error in like-toggle endpoint:', err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.post('/gallery/:imageId/add-to-chat', async (request, reply) => {
    try {
      const { imageId } = request.params;
      const { chatId, userChatId } = request.body || {};
      const user = request.user;

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      if (!chatId || !userChatId) {
        return reply.code(400).send({ error: 'chatId and userChatId are required' });
      }

      const db = fastify.mongo.db;
      const currentUserId = toObjectId(user._id);
      let targetChatId;
      let targetUserChatId;

      try {
        targetChatId = toObjectId(chatId);
        targetUserChatId = toObjectId(userChatId);
      } catch (conversionError) {
        return reply.code(400).send({ error: 'Invalid identifier format' });
      }

      const [userChat, galleryImage] = await Promise.all([
        getUserChatForUser(db, targetUserChatId, currentUserId),
        getGalleryImageById(db, imageId)
      ]);

      if (!userChat) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }

      const userChatTargetId = userChat.chatId instanceof ObjectId ? userChat.chatId : toObjectId(userChat.chatId);
      if (userChatTargetId.toString() !== targetChatId.toString()) {
        return reply.code(403).send({ error: 'Chat mismatch' });
      }

      if (!galleryImage || !galleryImage.image || !galleryImage.image.imageUrl) {
        return reply.code(404).send({ error: 'Image not found' });
      }

      const { image, chatId: sourceChatId, chatSlug } = galleryImage;

      const chatMessage = buildChatImageMessage(image, { fromGallery: true });
      chatMessage.targetChatId = targetChatId.toString();

  const updateResult = await appendMessageToUserChat(db, targetUserChatId, chatMessage);

      if (!updateResult.modifiedCount) {
        return reply.code(500).send({ error: 'Failed to add image to chat' });
      }

      const isLiked = Array.isArray(image.likedBy)
        ? image.likedBy.some(likedUserId => likedUserId.toString() === currentUserId.toString())
        : false;

      const responsePayload = {
        _id: image._id.toString(),
        imageUrl: image.imageUrl || image.url,
        prompt: image.prompt || '',
        title: image.title || null,
        nsfw: !!image.nsfw,
        slug: image.slug || null,
        aspectRatio: image.aspectRatio || null,
        seed: typeof image.seed !== 'undefined' ? image.seed : null,
        isUpscaled: !!image.isUpscaled,
        actions: chatMessage.actions,
        chatId: targetChatId.toString(),
        sourceChatId: sourceChatId ? sourceChatId.toString() : null,
        chatSlug: chatSlug || image.chatSlug || null,
        isLiked,
        mergeId: image.mergeId || null,
        isMergeFace: !!(image.isMerged || image.type === 'mergeFace'),
        originalImageUrl: image.originalImageUrl || null,
      };

      return reply.send({
        success: true,
        message: 'Image added to chat',
        image: responsePayload
      });

    } catch (error) {
      console.error('Error in /gallery/:imageId/add-to-chat:', error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
  
  fastify.get('/user/:userId/liked-images', async (request, reply) => {
    try {
      const userId = new ObjectId(request.params.userId);
      const page = parseInt(request.query.page) || 1;
      const limit = 12; // Number of images per page
      const skip = (page - 1) * limit;
  
      const db = fastify.mongo.db;
      const imagesLikesCollection = db.collection('images_likes');
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');
  
      // Find the images liked by the user
      const likedImageIds = await imagesLikesCollection
        .find({ userId })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .map(doc => doc.imageId)
        .toArray();
  
      // If no images liked by user
      if (!likedImageIds.length) {
        return reply.send({ images: [], page, totalPages: 0 });
      }
  
      // Fetch the documents that contain the liked images from the gallery collection
      const likedImagesDocs = await chatsGalleryCollection
        .aggregate([
          { $match: { 'images._id': { $in: likedImageIds } } },  // Match only documents where the liked image IDs exist
          { $unwind: '$images' },  // Unwind to get individual images
          { $match: { 'images._id': { $in: likedImageIds } } },  // Match the images specifically with the liked IDs
          { $project: { image: '$images', chatId: 1, _id: 0 } }  // Project image and chatId
        ])
        .toArray();
  
      // Extract chatIds from the liked images
      const chatIds = likedImagesDocs.map(doc => doc.chatId);
  
      // Fetch the chat data from the chats collection
      const chats = await chatsCollection
        .find({ _id: { $in: chatIds } })
        .toArray();
  
      // Map the chat data to the images
      const imagesWithChatData = likedImagesDocs.map(doc => {
        const image = doc.image;
        const chat = chats.find(c => c._id.equals(doc.chatId));
        image.chatSlug =  chat?.slug || ''
        
        return {
          ...image,
          chatId: chat?._id,
          chatName: chat ? chat.name : 'Unknown Chat',
          thumbnail: chat ? chat?.chatImageUrl || chat?.thumbnail || chat?.thumbnailUrl : '/img/default-thumbnail.png'
        };
      });
  
      // Total liked images by user
      const totalLikedCount = await imagesLikesCollection.countDocuments({ userId });
      const totalPages = Math.ceil(totalLikedCount / limit);

      return reply.send({
        images: imagesWithChatData,
        page,
        totalPages
      });
  
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

fastify.get('/chats/images/search', async (request, reply) => {
  try {
    const user = request.user;
    const language = getLanguageName(user?.lang);
    const queryStr = request.query.query || '';
    const page = parseInt(request.query.page) || 1;
    const limit = parseInt(request.query.limit) || 24;
    const skip = (page - 1) * limit;
    const db = fastify.mongo.db;
    const chatsGalleryCollection = db.collection('gallery');

    // Prepare search words
    const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');

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
            { 'chat.language': request.lang }
          ]
        }
      }
    ];

    // Score expressions
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

    const scoringStage = {
      $addFields: {
        matchScore: { $sum: scoreExpressions }
      }
    };

    const pipeline = [
      { $unwind: '$images' },
      { $match: baseMatch },
      ...chatLanguageMatch,
      scoringStage,
      { $match: queryWords.length > 0 ? { matchScore: { $gt: 0 } } : {} },
      { $sort: { matchScore: -1, _id: -1 } }, // Secondary sort by _id for stability
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          image: '$images',
          chatId: 1,
          chat: 1,
          matchScore: 1
        }
      }
    ];

    const [allChatImagesDocs, totalCountDocs] = await Promise.all([
      chatsGalleryCollection.aggregate(pipeline).toArray(),
      chatsGalleryCollection.aggregate([
        { $unwind: '$images' },
        { $match: baseMatch },
        ...chatLanguageMatch,
        scoringStage,
        { $match: queryWords.length > 0 ? { matchScore: { $gt: 0 } } : {} },
        { $count: 'total' }
      ]).toArray()
    ]);

    // Group and limit 3 images per chat
    const grouped = {};
    const limitedDocs = [];
    for (const doc of allChatImagesDocs) {
      const chatIdStr = String(doc.chatId);
      if (!grouped[chatIdStr]) grouped[chatIdStr] = 0;
      if (grouped[chatIdStr] < 3) {
        limitedDocs.push(doc);
        grouped[chatIdStr]++;
      }
    }

    const totalImages = totalCountDocs.length ? totalCountDocs[0].total : 0;
    const totalPages = Math.ceil(totalImages / limit);
    if (!totalImages) {
      return reply.code(404).send({ images: [], page, totalPages: 0 });
    }

    const imagesWithChatData = limitedDocs.map(doc => {
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

    reply.send({
      images: imagesWithChatData,
      page,
      totalPages
    });

  } catch (err) {
    console.error('Error in /chats/images/search:', err);
    reply.code(500).send('Internal Server Error');
  }
});


  fastify.get('/chats/images', async (request, reply) => {
    try {
      const user = request.user;
      let language = getLanguageName(user?.lang);
      const page = parseInt(request.query.page) || 1;
      const limit = 12;
      const skip = (page - 1) * limit;
  
      const db = fastify.mongo.db;
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');
  
      const chatIds = await chatsCollection
        .find({ 
          $or: [
          { language },
          { language: request.lang }
          ]
        })
        .project({ _id: 1 })
        .toArray()
        .then(chats => chats.map(c => c._id));
  
      const [allChatImagesDocs, totalCountDocs] = await Promise.all([
        chatsGalleryCollection.aggregate([
          { $unwind: '$images' },
          { $match: { 'images.imageUrl': { $exists: true, $ne: null }, chatId: { $in: chatIds } } },
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 0, image: '$images', chatId: 1 } }
        ]).toArray(),
        chatsGalleryCollection.aggregate([
          { $unwind: '$images' },
          { $match: { 'images.imageUrl': { $exists: true, $ne: null }, chatId: { $in: chatIds } } },
          { $count: 'total' }
        ]).toArray()
      ]);
  
      const totalImages = totalCountDocs.length ? totalCountDocs[0].total : 0;
      if (!totalImages) {
        return reply.code(404).send({ images: [], page, totalPages: 0 });
      }
      const totalPages = Math.ceil(totalImages / limit);
  
      const chatsData = await chatsCollection
        .find({ _id: { $in: chatIds } })
        .toArray();
  
      const images = allChatImagesDocs.map(doc => {
        const chat = chatsData.find(c => c._id.equals(doc.chatId));
        return {
          ...doc.image,
          chatId: doc.chatId,
          chatName: chat?.name,
          thumbnail: chat?.thumbnail || chat?.thumbnailUrl || '/img/default-thumbnail.png'
        };
      });
  
      reply.send({ images, page, totalPages });
    } catch (err) {
      reply.code(500).send('Internal Server Error');
    }
  });  
fastify.get('/chats/horizontal-gallery', async (request, reply) => {
  try {
    const db = fastify.mongo.db;
    const chatsGalleryCollection = db.collection('gallery');
    const chatsCollection = db.collection('chats');
    const userId = request.user?._id;

    // Pagination parameters
    const page = parseInt(request.query.page) || 1; // Default to page 1
    const limit = parseInt(request.query.limit) || 10; // Default limit of 10
    const skip = (page - 1) * limit;

    // Search query parameter
    const queryStr = request.query.query || '';
    const queryWords = queryStr.split(' ').filter(word => word.replace(/[^\w\s]/gi, '').trim() !== '');

    // Get the requested language
    const language = getLanguageName(request.user?.lang);
    const requestLang = request.lang; // Language inferred from the request

    // Fetch chat IDs that have images
    const chatsWithImages = await chatsGalleryCollection
      .aggregate([
        { $match: { 'images.0': { $exists: true } } }, // Only chats with images
        { $sort: { _id: -1 } }, // Sort by _id in descending order for latest first
        { $project: { chatId: 1 } }
      ])
      .toArray();

    const chatIdsWithImages = chatsWithImages.map(c => c.chatId);

    // Build search filter for chat metadata
    let searchFilter = {
      _id: { $in: chatIdsWithImages },
      $or: [
        { language: language },
        { language: requestLang }
      ]
    };

    // Add search functionality if query is provided
    if (queryWords.length > 0) {
      const searchConditions = queryWords.map(word => ({
        $or: [
          { name: { $regex: new RegExp(word, 'i') } },
          { description: { $regex: new RegExp(word, 'i') } },
          { first_message: { $regex: new RegExp(word, 'i') } },
          { tags: { $regex: new RegExp(word, 'i') } },
          { nickname: { $regex: new RegExp(word, 'i') } }
        ]
      }));

      searchFilter.$and = searchConditions;
    }

    // Fetch chat metadata with search filter and pagination
    const chats = await chatsCollection
      .find(searchFilter)
      .project({
        _id: 1,
        name: 1,
        thumbnail: 1,
        thumbnailUrl: 1,
        language: 1,
        description: 1,
        first_message: 1,
        slug: 1,
        tags: 1,
        nickname: 1
      })
      .sort({ _id: -1 }) // Sort by _id in descending order for latest first
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalChatsCount = await chatsCollection.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalChatsCount / limit);

    // Fetch images for the filtered chats
    const imagesByChat = await chatsGalleryCollection
      .find({ chatId: { $in: chats.map(chat => chat._id) } })
      .project({
        chatId: 1,
        images: 1,
        imageCount: { $size: '$images' }
      })
      .toArray();

    // Fetch user chat history for the current user to determine if they've chatted with each character
    // Using the same hasUserChattedWithCharacter utility function for consistency
    const result = [];
    for (const chat of chats) {
      const imageInfo = imagesByChat.find(image => image.chatId.equals(chat._id));
      const hasChatted = userId ? await hasUserChattedWithCharacter(db, userId, chat._id.toString()) : false;
      
      result.push({
        ...chat,
        images: imageInfo?.images || [],
        imageCount: imageInfo?.imageCount || 0,
        thumbnail: chat.thumbnail || chat.thumbnailUrl || '/img/default-thumbnail.png',
        hasUserChatted: hasChatted
      });
    }

    // Send response with pagination metadata
    reply.send({
      chats: result,
      page,
      limit,
      totalPages,
      totalChatsCount,
      query: queryStr,
      message: queryStr ? 'Search results retrieved successfully.' : 'Chats with images retrieved successfully.'
    });
  } catch (err) {
    console.error(err);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});
  fastify.get('/chat/:chatId/images', async (request, reply) => {
    const { chatId } = request.params;
    const page = parseInt(request.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    try {
      const db = fastify.mongo.db;
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');

      // Get user information for filtering
      const user = request.user;
      const subscriptionStatus = user?.subscriptionStatus === 'active';
      const isTemporary = !!user?.isTemporary;

      // Fetch the chat data (chatName and thumbnail)
      const chat = await chatsCollection.findOne({ _id: new ObjectId(chatId) });
      if (!chat) {
        return reply.code(404).send({ error: 'Chat not found' });
      }

      // Note: Do NOT filter NSFW images here - return them all so frontend can display them blurred for non-subscribed users
      // The frontend will handle showing blurred overlays for NSFW content based on subscription status

      // Find the chat document and paginate the images (do not filter NSFW - return all)
      const chatImagesDocs = await chatsGalleryCollection
        .aggregate([
          { $match: { chatId: new ObjectId(chatId) } },           // Match the document by chatId
          { $unwind: '$images' },           // Unwind the images array
          { $match: { 
              'images.imageUrl': { $exists: true, $ne: null },    // Ensure image has a valid URL
              'images.isUpscaled': { $ne: true }                  // Filter out upscaled duplicates
            } 
          }, 
          { $sort: { 'images.createdAt': -1 } }, // Sort by createdAt in descending order
          { $skip: skip },                  // Skip for pagination
          { $limit: limit },                // Limit the results to the page size
          { $project: { _id: 0, image: '$images', chatId: 1 } }  // Project image and chatId
        ])
        .toArray();


      // Get total image count for pagination info (do not filter NSFW - count all)
      const totalImagesCount = await chatsGalleryCollection
        .aggregate([
          { $match: { chatId: new ObjectId(chatId) } },
          { $unwind: '$images' },
          { $match: { 
              'images.imageUrl': { $exists: true, $ne: null },    // Ensure image has a valid URL
              'images.isUpscaled': { $ne: true }                  // Filter out upscaled duplicates
            } 
          }, 
          { $count: 'total' }
        ])
        .toArray();

      const totalImages = totalImagesCount.length > 0 ? totalImagesCount[0].total : 0;
      const totalPages = Math.ceil(totalImages / limit);

      // If no images found
      if (chatImagesDocs.length === 0) {
        return reply.code(404).send({ images: [], page, totalPages: 0 });
      }

      // Map the chat data to the images
      const imagesWithChatData = chatImagesDocs.map(doc => ({
        ...doc.image,
        chatId: chat._id,
        chatSlug: chat.slug,
        chatName: chat.name,
        thumbnail: chat?.thumbnail || chat?.thumbnailUrl || '/img/default-thumbnail.png',
      }));

      // Send the paginated images response
      return reply.send({
        images: imagesWithChatData,
        page,
        totalPages,
        totalImages
      });
    } catch (err) {
      console.error('Error in /chat/:chatId/images:', err);
      reply.code(500).send('Internal Server Error');
    }
  });  
  
  fastify.get('/chat/:chatId/users', async (request, reply) => {
    try {
      // Extract chatId from URL parameters and validate it
      const chatIdParam = request.params.chatId;
      let chatId;
      try {
        chatId = new fastify.mongo.ObjectId(chatIdParam);
      } catch (e) {
        return reply.code(400).send({ error: 'Invalid chatId format' });
      }
  
      // Handle pagination parameters
      const page = parseInt(request.query.page, 10) || 1;
      const limit = 20; // Number of users per page
      const skip = (page - 1) * limit;
  
      const db = fastify.mongo.db;
      const userChatCollection = db.collection('userChat');
      const usersCollection = db.collection('users');
      const chatsCollection = db.collection('chats');
  
      // Verify that the chat exists
      const chat = await chatsCollection.findOne({ _id: chatId });
      if (!chat) {
        return reply.code(404).send({ error: 'Chat not found' });
      }
  
      // Find userChat documents for the chat
      const userChatDocs = await userChatCollection
      .find({ 
        $or: [
            { chatId: chatId.toString() },
            { chatId: new fastify.mongo.ObjectId(chatId) }
        ] })
      .skip(skip).limit(limit).toArray();

      if (userChatDocs.length === 0) {
        return reply.code(200).send({
          users: [],
          page,
          totalPages: 0
        });
      }
  
      // Extract userIds and exclude temporary users
      const userIds = userChatDocs.map(doc => new fastify.mongo.ObjectId(doc.userId));
  
      // Fetch user details from usersCollection
      const users = await usersCollection.find({
        _id: { $in: userIds },
        isTemporary: { $ne: true }
      }).toArray();
  
      // Get total users count excluding temporary users
      const totalUsers = await userChatCollection.countDocuments({
        chatId: chatId
        // Note: This count does not exclude temporary users. To exclude, use aggregation or adjust accordingly.
      });
  
      const totalPages = Math.ceil(totalUsers / limit);
  
      // Format the response data
      const formattedUsers = users.map(user => ({
        userId: user._id,
        nickname: user.nickname,
        email: user.email,
        profileUrl: user.profileUrl || '/img/avatar.png',
        createdAt: user.createdAt,
      }));

      return reply.send({
        users: formattedUsers,
        page,
        totalPages
      });
    } catch (err) {
      console.error('Error fetching users for chat:', err);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
  
  
  fastify.put('/images/:imageId/nsfw', async (request, reply) => {
    try {
      const imageId = new fastify.mongo.ObjectId(request.params.imageId);
      const { nsfw } = request.body;

      if (typeof nsfw !== 'boolean') {
        return reply.code(400).send({ error: 'Invalid NSFW value. It must be a boolean.' });
      }
  
      const db = fastify.mongo.db;
      const galleryCollection = db.collection('gallery');
  
      // Update the nsfw field of the specific image in the gallery
      const result = await galleryCollection.updateOne(
        { 'images._id': imageId },       // Match the specific image by imageId
        { $set: { 'images.$.nsfw': nsfw } }  // Update the nsfw field
      );
  
      if (result.matchedCount === 0) {
        return reply.code(404).send({ error: 'Image not found.' });
      }
  
      reply.send({ message: 'NSFW status updated successfully.' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });

  fastify.get('/categories/images', async (request, reply) => {
    try {
      const db = fastify.mongo.db;
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');

      // Get translations for categories
      const translations = request.translations || {};
      const categoryTranslations = translations.categories || {};

      // Define 6 categories with their associated tags/keywords
      const categories = [
        { 
          nameKey: 'maid',
          name: categoryTranslations.maid || 'Maid', 
          tags: ['maid', 'maid dress', 'maid outfit', 'maid costume'], 
          icon: 'bi-bucket' 
        },
        { 
          nameKey: 'princess',
          name: categoryTranslations.princess || 'Princess', 
          tags: ['princess', 'zelda'], 
          icon: 'bi-gem' 
        },
        { 
          nameKey: 'fantasy',
          name: categoryTranslations.fantasy || 'Fantasy', 
          tags: ['forest elfe', 'forest elf', 'fantasy', 'magical'], 
          icon: 'bi-emoji-smile' 
        },
        { 
          nameKey: 'ninja',
          name: categoryTranslations.ninja || 'Ninja', 
          tags: ['ninja', 'shinobi', 'stealth', 'assassin'], 
          icon: 'bi-person-dash' 
        },
        { 
          nameKey: 'robot',
          name: categoryTranslations.robot || 'Robot', 
          tags: ['robot', 'android', 'cyborg', 'mecha'], 
          icon: 'bi-robot' 
        },
        { 
          nameKey: 'demon',
          name: categoryTranslations.demon || 'Demon', 
          tags: ['demon', 'devil', 'fiend', 'satanic'], 
          icon: 'bi-emoji-angry' 
        }
      ];

      const categoryResults = [];

      // Get user language for filtering
      const user = request.user;
      const language = getLanguageName(user?.lang);
      const requestLang = request.lang;

      for (const category of categories) {
        try {
          // Create regex patterns for each tag
          const tagRegexes = category.tags.map(tag => new RegExp(tag, 'i'));
          
          // Find images that match category tags and are SFW
          const pipeline = [
            { $unwind: '$images' },
            {
              $match: {
                'images.imageUrl': { $exists: true, $ne: null },
                'images.nsfw': { $ne: true }, // Only SFW content
                $or: [
                  { 'images.prompt': { $in: tagRegexes } },
                  { 'images.style': { $in: category.tags } }
                ]
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
                $or: [
                  { 'chat.language': language },
                  { 'chat.language': requestLang }
                ],
                'chat.nsfw': { $ne: true } // Only SFW chats
              }
            },
            { $sample: { size: 1 } }, // Get random image
            {
              $project: {
                image: '$images',
                chatId: '$chatId',
                chatName: '$chat.name',
                chatSlug: '$chat.slug',
                thumbnail: '$chat.thumbnail'
              }
            }
          ];

          const result = await chatsGalleryCollection.aggregate(pipeline).toArray();
          
          if (result.length > 0) {
            const imageData = result[0];
            categoryResults.push({
              category: category.name,
              icon: category.icon,
              image: {
                ...imageData.image,
                chatId: imageData.chatId,
                chatName: imageData.chatName,
                chatSlug: imageData.chatSlug,
                thumbnail: imageData.thumbnail || '/img/default-thumbnail.png'
              }
            });
          } else {
            // Fallback: get any SFW image if no tagged images found
            const fallbackPipeline = [
              { $unwind: '$images' },
              {
                $match: {
                  'images.imageUrl': { $exists: true, $ne: null },
                  'images.nsfw': { $ne: true }
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
                  $or: [
                    { 'chat.language': language },
                    { 'chat.language': requestLang }
                  ],
                  'chat.nsfw': { $ne: true }
                }
              },
              { $sample: { size: 1 } },
              {
                $project: {
                  image: '$images',
                  chatId: '$chatId',
                  chatName: '$chat.name',
                  chatSlug: '$chat.slug',
                  thumbnail: '$chat.thumbnail'
                }
              }
            ];

            const fallbackResult = await chatsGalleryCollection.aggregate(fallbackPipeline).toArray();
            
            if (fallbackResult.length > 0) {
              const imageData = fallbackResult[0];
              categoryResults.push({
                category: category.name,
                icon: category.icon,
                image: {
                  ...imageData.image,
                  chatId: imageData.chatId,
                  chatName: imageData.chatName,
                  chatSlug: imageData.chatSlug,
                  thumbnail: imageData.thumbnail || '/img/default-thumbnail.png'
                }
              });
            }
          }
        } catch (categoryError) {
          console.error(`Error fetching category ${category.name}:`, categoryError);
        }
      }

      reply.send({
        categories: categoryResults,
        success: true
      });

    } catch (err) {
      console.error('Error in /categories/images:', err);
      reply.code(500).send('Internal Server Error');
    }
  });

fastify.get('/api/query-tags', async (request, reply) => {
    try {
        const db = fastify.mongo.db;
        const chatsCollection = db.collection('chats');
        
        // Get user language for filtering
        const user = request.user;
        const language = getLanguageName(user?.lang);
        const requestLang = request.lang;
        
        // Aggregate tags from chats
        const tagResults = await chatsCollection.aggregate([
            {
                $match: {
                    $or: [
                        { language: language },
                        { language: requestLang }
                    ],
                    tags: { $exists: true, $not: { $size: 0 } }
                }
            },
            { $unwind: '$tags' },
            {
                $group: {
                    _id: '$tags',
                    count: { $sum: 1 }
                }
            },
            { $sample: { size: 20 } },
            { $sort: { count: -1 } },
            { $limit: 20 }, // Limit to top 20 most popular tags
            {
                $project: {
                    _id: 0,
                    tag: '$_id',
                    count: 1
                }
            }
        ]).toArray();
        
        // Extract just the tag names
        const tags = tagResults.map(result => result.tag).filter(tag => tag && tag.trim() !== '');
        
        reply.send({
            tags: tags,
            success: true
        });
        
    } catch (err) {
        console.error('Error in /api/query-tags:', err);
        reply.code(500).send({ error: 'Internal Server Error' });
    }
});
}

module.exports = routes;
