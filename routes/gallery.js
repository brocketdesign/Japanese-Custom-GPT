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
      const galleryCollection = db.collection('gallery');

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

      // Fetch the images from the gallery collection
      const likedImages = await galleryCollection
        .aggregate([
          { $unwind: '$images' },
          { $match: { 'images._id': { $in: likedImageIds } } },
          { $project: { image: '$images', _id: 0 } }
        ])
        .toArray();

      // Total liked images by user
      const totalLikedCount = await imagesLikesCollection.countDocuments({ userId });
      const totalPages = Math.ceil(totalLikedCount / limit);

      return reply.send({
        images: likedImages.map(doc => doc.image),
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
