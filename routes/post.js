const { ObjectId } = require('mongodb');

async function routes(fastify, options) {
  fastify.post('/posts', async (request, reply) => {
    try {
      const { imageId, comment } = request.body;
      const user = request.user;
      const userId = new fastify.mongo.ObjectId(user._id);
  
      const db = fastify.mongo.db
      const galleryCollection = db.collection('gallery');
      const postsCollection = db.collection('posts');
      const usersCollection = db.collection('users');
  
      // Find the image in the user's gallery
      const userGallery = await galleryCollection.findOne({
        userId: new fastify.mongo.ObjectId(userId),
        'images._id': new fastify.mongo.ObjectId(imageId),
      });
  
      if (!userGallery) {
        return reply.code(404).send({ error: 'Image not found' });
      }
  
      const image = userGallery.images.find(img => img._id.equals(imageId));
      const chatId = userGallery.chatId;
  
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
  
      // Increment the user's postCount field
      await usersCollection.updateOne(
        { _id: userId },
        { $inc: { postCount: 1 } }
      );
  
      reply.code(201).send({ postId: result.insertedId });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  
  fastify.put('/user/posts/:postId/nsfw', async (request, reply) => {
    try {
      const postId = new fastify.mongo.ObjectId(request.params.postId);
      const { nsfw } = request.body; // Expecting nsfw in the request body

      if (typeof nsfw !== 'boolean') {
        return reply.code(400).send({ message: 'Invalid value for nsfw. Must be a boolean.' });
      }
  
      const db = fastify.mongo.db
      const postsCollection = db.collection('posts');
  
      // Update the nsfw attribute of the post
      const result = await postsCollection.updateOne(
        { _id: new fastify.mongo.ObjectId(postId) },
        { $set: { 'image.nsfw': nsfw } }
      );
  
      if (result.modifiedCount === 0) {
        return reply.code(404).send({ message: 'Post not found or nsfw attribute not updated.' });
      }
  
      reply.send({ message: 'NSFW attribute updated successfully.' });
    } catch (err) {
      console.log("Error: ", err);
      reply.code(500).send('Internal Server Error');
    }
  });
  
  fastify.get('/posts/:id', async (request, reply) => {
    try {
      const postId = new fastify.mongo.ObjectId(request.params.id);
      const db = fastify.mongo.db
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
  fastify.get('/user/posts', async (request, reply) => {
    try {
      const page = parseInt(request.query.page) || 1;
      const limit = 12; // Number of posts per page
      const skip = (page - 1) * limit;
  
      const db = fastify.mongo.db
      const postsCollection = db.collection('posts');
      const usersCollection = db.collection('users');
      const chatsCollection = db.collection('chats');
  
      // Fetch paginated posts
      const postsCursor = await postsCollection
        .find({ comment: { $exists: true }, chatId: { $exists: true } })
        .sort({_id:-1})
        .skip(skip)
        .limit(limit)
        .toArray();
  
      if (!postsCursor.length) {
        return reply.code(404).send({ posts: [], page, totalPages: 0 });
      }
  
      const userIds = postsCursor.map(item => item.userId);
      const chatIds = postsCursor.map(item => item.chatId);
  
      const [users, chats] = await Promise.all([
        usersCollection.find({ _id: { $in: userIds } }).toArray(),
        chatsCollection.find({ _id: { $in: chatIds } }).toArray()
      ]);
  
      const validPosts = postsCursor.map(item => {
        const user = users.find(u => u._id.toString() === item.userId.toString());
        const chat = chats.find(c => c._id.toString() === item.chatId.toString());

        return user && chat ? {
          userName: user.nickname || 'Unknown User',
          profilePicture: user.profileUrl || '/img/avatar.png',
          chatId: chat.chatId || null,
          userId: item.userId,
          chatName: chat.name || 'Unknown Chat',
          post: {
            postId: item._id,
            imageUrl: item.image.imageUrl,
            nsfw: item.image.nsfw,
            prompt: item.image.prompt,
            comment: item.comment || '',
            createdAt: item.createdAt,
            likes: item.likes || 0,
            likedBy: item.likedBy || []
          }
        } : null;
      }).filter(Boolean);
  
      // Get total count of posts for pagination
      const totalPostsCount = await postsCollection.countDocuments({
        comment: { $exists: true },
        chatId: { $exists: true }
      });
      const totalPages = Math.ceil(totalPostsCount / limit);
  
      // Send paginated response
      reply.send({
        posts: validPosts,
        page,
        totalPages
      });
    } catch (err) {
      console.log("Error: ", err);
      reply.code(500).send('Internal Server Error');
    }
  });
  fastify.get('/user/:userId/posts', async (request, reply) => {
    try {
      const userId = new fastify.mongo.ObjectId(request.params.userId);
  
      const currentUser = request.user;
      const currentUserId = new fastify.mongo.ObjectId(currentUser._id);
  
      const db = fastify.mongo.db
      const usersCollection = db.collection('users');
      const postsCollection = db.collection('posts');
      const likesCollection = db.collection('posts_likes');
  
      // Pagination settings
      const page = parseInt(request.query.page) || 1;
      const limit = 6;
      const skip = (page - 1) * limit;
  
      // Check if the like parameter is present and set to true
      const isLikeFilter = request.query.like === 'true';
  
      let query, userPosts;
  
      if (isLikeFilter) {
        // Get the posts liked by the user in the URL parameter (userId)
        const likedPosts = await likesCollection
          .find({ userId })
          .toArray();
  
        const likedPostIds = likedPosts.map(like => like.postId);
  
        // Filter posts by liked post IDs
        query = { _id: { $in: likedPostIds } };
      } else {
        // Standard post query based on userId and privacy settings
        query = currentUserId.toString() === userId.toString()
          ? { userId }
          : { userId, $or: [{ isPrivate: false }, { isPrivate: { $exists: false } }] };
      }
  
      // Find posts with pagination
      userPosts = await postsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
  
      // Get the unique userIds from the posts (including liked posts)
      const postOwnerIds = [...new Set(userPosts.map(post => post.userId))];
  
      // Fetch user details for the post owners
      const users = await usersCollection
        .find({ _id: { $in: postOwnerIds } })
        .toArray();
  
      // Attach user details (userName, profilePicture) to the posts
      userPosts = userPosts.map(post => {
        const user = users.find(u => u._id.equals(post.userId));
        return {
          ...post,
          userName: user ? user.nickname : 'Unknown User',
          profilePicture: user ? user.profileUrl : '/img/avatar.png',
        };
      });
  
      // Get total number of posts for pagination info
      const totalPosts = await postsCollection.countDocuments(query);
  
      if (userPosts.length === 0) {
        return reply.code(404).send({ error: 'No posts found' });
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
      const user = request.user;
      const userId = new fastify.mongo.ObjectId(user._id);
  
      const db = fastify.mongo.db
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
  fastify.post('/posts/:id/set-private', async (request, reply) => {
    try {
      const postId = new fastify.mongo.ObjectId(request.params.id);
      const { isPrivate } = request.body; // Expecting a boolean value
      const user = request.user;
      const userId = new fastify.mongo.ObjectId(user._id);
      
      const db = fastify.mongo.db
      const postsCollection = db.collection('posts');
  
      const result = await postsCollection.updateOne(
        { _id: postId, userId: userId }, // Only allow the post owner to update
        { $set: { isPrivate: isPrivate == 'true' } }
      );
  
      if (result.matchedCount === 0) {
        return reply.code(404).send({ error: 'Post not found or you are not the owner' });
      }
  
      reply.send({ message: 'Post privacy updated successfully' });
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  fastify.post('/posts/:id/like-toggle', async (request, reply) => {
    try {
      const postId = new fastify.mongo.ObjectId(request.params.id);
      const { action } = request.body; // 'like' or 'unlike'
      const user = request.user; // Assuming you have a method to get the user
      const userId = new fastify.mongo.ObjectId(user._id);
  
      const db = fastify.mongo.db
      const postsCollection = db.collection('posts');
      const likesCollection = db.collection('posts_likes');
  
      if (action === 'like') {
        // Check if the user already liked the post
        const existingLike = await likesCollection.findOne({ postId, userId });
  
        if (existingLike) {
          return reply.code(400).send({ error: 'User has already liked this post' });
        }
  
        // Add the like in the likes collection
        await likesCollection.insertOne({
          postId,
          userId,
          likedAt: new Date(),
        });
  
        // Increment the like count on the post
        const result = await postsCollection.updateOne(
          { _id: postId },
          { $inc: { likes: 1 }, $addToSet: { likedBy: userId } } // Adding userId to likedBy array
        );
  
        if (result.matchedCount === 0) {
          return reply.code(404).send({ error: 'Post not found' });
        }
  
        return reply.send({ message: 'Post liked successfully' });
  
      } else if (action === 'unlike') {
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
  
        return reply.send({ message: 'Post unliked successfully' });
      } else {
        return reply.code(400).send({ error: 'Invalid action' });
      }
    } catch (err) {
      console.error(err);
      reply.code(500).send('Internal Server Error');
    }
  });
  
  
}

module.exports = routes;
