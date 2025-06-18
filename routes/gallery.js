const { ObjectId } = require('mongodb');
const { getLanguageName } = require('../models/tool');
const { parse } = require('handlebars');
const { awardLikeMilestoneReward, awardLikeActionReward } = require('../models/user-points-utils');

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

        // Add like to the gallery collection
        const result = await galleryCollection.updateOne(
          { 'images._id': imageId },
          {
            $inc: { 'images.$.likes': 1 },
            $addToSet: { 'images.$.likedBy': userId }
          }
        );

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

        // Fetch the current likes count to ensure it doesn't go below 0
        const image = await galleryCollection.findOne({ 'images._id': imageId });
        const likes = image ? image.images.find(img => img._id.equals(imageId)).likes : 0;

        if (likes > 0) {
          // Remove like from the gallery collection
          const result = await galleryCollection.updateOne(
            { 'images._id': imageId },
            {
              $inc: { 'images.$.likes': -1 },
              $pull: { 'images.$.likedBy': userId }
            }
          );

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
  
      // Pagination parameters
      const page = parseInt(request.query.page) || 1; // Default to page 1
      const limit = parseInt(request.query.limit) || 10; // Default limit of 10
      const skip = (page - 1) * limit;
  
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
  
      // Fetch chat metadata for chat IDs with the language filter and pagination
      const chats = await chatsCollection
        .find({
          _id: { $in: chatIdsWithImages },
          $or: [
        { language: language },
        { language: requestLang }
          ]
        })
        .project({
          _id: 1,
          name: 1,
          thumbnail: 1,
          thumbnailUrl: 1,
          language: 1,
          description: 1,
          first_message: 1,
          slug: 1,
        })
        .sort({ _id: -1 }) // Sort by _id in descending order for latest first
        .skip(skip)
        .limit(limit)
        .toArray();
  
      const totalChatsCount = await chatsCollection.countDocuments({
        _id: { $in: chatIdsWithImages },
        $or: [
          { language: language },
          { language: requestLang }
        ]
      });
  
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
  
      // Merge chats with images
      const result = chats.map(chat => {
        const imageInfo = imagesByChat.find(image => image.chatId.equals(chat._id));
        return {
          ...chat,
          images: imageInfo?.images || [],
          imageCount: imageInfo?.imageCount || 0,
          thumbnail: chat.thumbnail || chat.thumbnailUrl || '/img/default-thumbnail.png'
        };
      });
  
      // Send response with pagination metadata
      reply.send({
        chats: result,
        page,
        limit,
        totalPages,
        totalChatsCount,
        message: 'Chats with images retrieved successfully.'
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

      // Fetch the chat data (chatName and thumbnail)
      const chat = await chatsCollection.findOne({ _id: new ObjectId(chatId) });
      if (!chat) {
        return reply.code(404).send({ error: 'Chat not found' });
      }

      // Find the chat document and paginate the images & filter out image with a scale_factor
      const chatImagesDocs = await chatsGalleryCollection
        .aggregate([
          { $match: { chatId: new ObjectId(chatId) } },           // Match the document by chatId
          { $unwind: '$images' },           // Unwind the images array
          { $match: { 'images.isUpscaled': { $ne: true }} }, // Filter out images with scale_factor
          { $sort: { 'images.createdAt': -1 } }, // Sort by createdAt in descending order
          { $skip: skip },                  // Skip for pagination
          { $limit: limit },                // Limit the results to the page size
          { $project: { _id: 0, image: '$images', chatId: 1 } }  // Project image and chatId
        ])
        .toArray();


      // Get total image count for pagination info
      const totalImagesCount = await chatsGalleryCollection
        .aggregate([
          { $match: { chatId: new ObjectId(chatId) } },
          { $unwind: '$images' },
          { $match: { 'images.isUpscaled': { $ne: true } } }, // Ensure count matches filter above
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
        totalPages
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
  
}

module.exports = routes;
