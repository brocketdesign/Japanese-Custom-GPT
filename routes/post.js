const { ObjectId } = require('mongodb');

async function routes(fastify, options) {
  fastify.post('/posts', async (request, reply) => {
    try {
      const { imageId, comment } = request.body;
      const user = await fastify.getUser(request, reply);
      const userId = new fastify.mongo.ObjectId(user._id);
  
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const galleryCollection = db.collection('gallery');
      const postsCollection = db.collection('posts');
  
      // Find the image in the user's gallery
      const userGallery = await galleryCollection.findOne({
        userId: new fastify.mongo.ObjectId(userId),
        'images._id': new fastify.mongo.ObjectId(imageId),
      });
  
      if (!userGallery) {
        return reply.code(404).send({ error: 'Image not found' });
      }
  
      const image = userGallery.images.find(img => img._id.equals(imageId));
      const chatId = userGallery.chatId

      const post = {
        userId: new fastify.mongo.ObjectId(userId),
        chatId,
        image,
        comment: comment || '',
        likes: 0,
        comments: [],
        createdAt: new Date(),
      };

      // Insert the post into the posts collection
      const result = await postsCollection.insertOne(post);
  
      reply.code(201).send({ postId: result.insertedId });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  fastify.get('/posts/:id', async (request, reply) => {
    try {
      const postId = new fastify.mongo.ObjectId(request.params.id);
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const postsCollection = db.collection('posts');
  
      const post = await postsCollection.findOne({ _id: postId });
  
      if (!post) {
        return reply.code(404).send({ error: 'Post not found' });
      }
  
      reply.send(post);
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  fastify.get('/user/:userId/posts', async (request, reply) => {
    try {
      const userId = new fastify.mongo.ObjectId(request.params.userId);
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const postsCollection = db.collection('posts');
  
      // Pagination settings
      const page = parseInt(request.query.page) || 1; // Default to page 1
      const limit = 6; // Fixed to 6 posts per page
      const skip = (page - 1) * limit;
  
      // Find all posts for the specific user with pagination
      const userPosts = await postsCollection
        .find({ userId })
        .sort({ createdAt: -1 }) // Sort by most recent
        .skip(skip)
        .limit(limit)
        .toArray();
  
      // Get total number of posts for this user (for pagination info)
      const totalPosts = await postsCollection.countDocuments({ userId });
  
      if (userPosts.length === 0) {
        return reply.code(404).send({ error: 'No posts found for this user' });
      }
  
      reply.send({
        page,
        totalPages: Math.ceil(totalPosts / limit),
        posts: userPosts,
      });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  
  fastify.post('/posts/:id/comment', async (request, reply) => {
    try {
      const postId = new fastify.mongo.ObjectId(request.params.id);
      const { comment } = request.body;
      const user = await fastify.getUser(request, reply);
      const userId = new fastify.mongo.ObjectId(user._id);
  
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const postsCollection = db.collection('posts');
  
      const commentData = {
        userId: new fastify.mongo.ObjectId(userId),
        comment,
        createdAt: new Date(),
      };
  
      const result = await postsCollection.updateOne(
        { _id: postId },
        { $push: { comments: commentData } }
      );
  
      if (result.matchedCount === 0) {
        return reply.code(404).send({ error: 'Post not found' });
      }
  
      reply.send({ message: 'Comment added successfully' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  fastify.post('/posts/:id/unlike', async (request, reply) => {
    try {
      const postId = new fastify.mongo.ObjectId(request.params.id);
      const user = await fastify.getUser(request, reply); // Assuming you have a method to get the user
      const userId = new fastify.mongo.ObjectId(user._id);
  
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const postsCollection = db.collection('posts');
      const likesCollection = db.collection('likes');
  
      // Check if the user has already liked the post
      const existingLike = await likesCollection.findOne({ postId, userId });
  
      if (!existingLike) {
        return reply.code(400).send({ error: 'User has not liked this post yet' });
      }
  
      // Remove the like from the likes collection
      await likesCollection.deleteOne({ postId, userId });
  
      // Decrement the like count on the post
      const result = await postsCollection.updateOne(
        { _id: postId, likes: { $gt: 0 } }, // Ensure that likes count does not go below 0
        { $inc: { likes: -1 }, $pull: { likedBy: userId } } // Remove userId from likedBy array
      );
  
      if (result.matchedCount === 0) {
        return reply.code(404).send({ error: 'Post not found or no likes to remove' });
      }
  
      reply.send({ message: 'Post unliked successfully' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  
}

module.exports = routes;
