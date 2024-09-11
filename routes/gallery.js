const { ObjectId } = require('mongodb');

async function routes(fastify, options) {
  fastify.post('/gallery/:imageId/like-toggle', async (request, reply) => {
    try {
      const imageId = new fastify.mongo.ObjectId(request.params.imageId);
      const { action } = request.body; // 'like' or 'unlike'
      const user = await fastify.getUser(request, reply);
      const userId = new fastify.mongo.ObjectId(user._id);
  
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const galleryCollection = db.collection('gallery');
      const imagesLikesCollection = db.collection('images_likes'); // Collection to track individual likes
  
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
        await imagesLikesCollection.insertOne({
          imageId,
          userId,
          likedAt: new Date(),
        });
  
        return reply.send({ message: 'Image liked successfully' });
  
      } else if (action === 'unlike') {
        // Check if the user has already liked the image
        const existingLike = await imagesLikesCollection.findOne({ imageId, userId });
  
        if (!existingLike) {
          return reply.code(400).send({ error: 'User has not liked this image yet' });
        }
  
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
  
        return reply.send({ message: 'Image unliked successfully' });
  
      } else {
        return reply.code(400).send({ error: 'Invalid action' });
      }
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  fastify.get('/user/:userId/liked-images', async (request, reply) => {
    try {
      const userId = new ObjectId(request.params.userId);
      const page = parseInt(request.query.page) || 1;
      const limit = 12; // Number of images per page
      const skip = (page - 1) * limit;
  
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const imagesLikesCollection = db.collection('images_likes');
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');
  
      // Find the images liked by the user
      const likedImageIds = await imagesLikesCollection
        .find({ userId })
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
        return {
          ...image,
          chatId: chat?._id,
          chatName: chat ? chat.name : 'Unknown Chat',
          chatThumbnailUrl: chat ? chat.thumbnailUrl : '/img/default-thumbnail.png'
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
  fastify.get('/chats/images', async (request, reply) => {
    try {
      const page = parseInt(request.query.page) || 1;
      const limit = 12; // Number of images per page
      const skip = (page - 1) * limit;
  
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');
  
      // Find and paginate images across all chats where chatThumbnailUrl exists
      const allChatImagesDocs = await chatsGalleryCollection
      .aggregate([
        { $unwind: '$images' },           // Unwind the images array
        { $match: { 'images.imageUrl': { $exists: true, $ne: null }, 'images.nsfw': { $exists: true } } },  // Filter images with valid imageUrl
        { $skip: skip },                  // Skip for pagination
        { $limit: limit },                // Limit the results to the page size
        { $project: { _id: 0, image: '$images', chatId: 1 } }  // Project image and chatId
      ])
      .toArray();    

      // Extract chatIds from the images
      const chatIds = allChatImagesDocs.map(doc => doc.chatId);

      // Fetch the chat data with a non-null chatThumbnailUrl from the chats collection
      const chats = await chatsCollection
        .find({ _id: { $in: chatIds } })
        .toArray();

        // Map the chat data to the images
      const imagesWithChatData = allChatImagesDocs
        .filter(doc => chats.find(c => c._id.equals(doc.chatId)))  // Filter images with valid chatThumbnailUrl
        .map(doc => {
          const image = doc.image;
          const chat = chats.find(c => c._id.equals(doc.chatId));
          return {
            ...image,
            chatId: chat?._id,
            chatName: chat ? chat.name : 'Unknown Chat',
            chatThumbnailUrl: chat ? chat.thumbnailUrl : '/img/default-thumbnail.png'
          };
        });
  
      // Get total image count for pagination info
      const totalImagesCount = imagesWithChatData.length;
      const totalPages = Math.ceil(totalImagesCount / limit);
  
      if (totalImagesCount === 0) {
        return reply.code(404).send({ images: [], page, totalPages: 0 });
      }

      // Send the paginated images response
      reply.send({
        images: imagesWithChatData,
        page,
        totalPages
      });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  
  fastify.get('/chat/:chatId/images', async (request, reply) => {
    try {
      const chatId = new fastify.mongo.ObjectId(request.params.chatId);
      const page = parseInt(request.query.page) || 1;
      const limit = 12; // Number of images per page
      const skip = (page - 1) * limit;
  
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');
  
      // Fetch the chat data (chatName and chatThumbnailUrl)
      const chat = await chatsCollection.findOne({ _id: chatId });
      if (!chat) {
        return reply.code(404).send({ error: 'Chat not found' });
      }
  
      // Find the chat document and paginate the images
      const chatImagesDocs = await chatsGalleryCollection
        .aggregate([
          { $match: { chatId } },           // Match the document by chatId
          { $unwind: '$images' },           // Unwind the images array
          { $skip: skip },                  // Skip for pagination
          { $limit: limit },                // Limit the results to the page size
          { $project: { _id: 0, image: '$images', chatId: 1 } }  // Project image and chatId
        ])
        .toArray();
  
      // Get total image count for pagination info
      const totalImagesCount = await chatsGalleryCollection
        .aggregate([
          { $match: { chatId } },
          { $unwind: '$images' },
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
        chatName: chat.name,
        chatThumbnailUrl: chat.thumbnailUrl || '/img/default-thumbnail.png',
      }));
  
      // Send the paginated images response
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
  
}

module.exports = routes;
