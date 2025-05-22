const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const { createHash } = require('crypto');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { checkLimits, checkUserAdmin, getUserData, updateUserLang, listFiles, uploadToS3 } = require('../models/tool');
const { moderateImage } = require('../models/openai');
const { refreshAccessToken, addContactToCampaign } = require('../models/zohomail');

async function routes(fastify, options) {

  fastify.get('/user/clerk-auth', async (request, reply) => {
    try {
      const clerkId = request.headers['x-clerk-user-id'];
      console.log(`clerkId from header: ${clerkId}`);
  
      if (!clerkId) {
        console.warn('No clerkId found in header');
        return reply.status(401).send({ error: 'Unauthorized' });
      }
  
      // Fetch user data from Clerk
      const clerkApiUrl = `https://api.clerk.com/v1/users/${clerkId}`;
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  
      if (!clerkSecretKey) {
        console.error('CLERK_SECRET_KEY is not set in environment variables.');
        return reply.status(500).send({ error: 'Clerk secret key not configured' });
      }
  
      let clerkUserData;
      try {
        const response = await axios.get(clerkApiUrl, {
          headers: {
            'Authorization': `Bearer ${clerkSecretKey}`,
            'Content-Type': 'application/json',
          },
        });
  
        if (response.status !== 200) {
          console.error(`Failed to fetch user data from Clerk API. Status: ${response.status}`);
          return reply.status(500).send({ error: 'Failed to fetch user data from Clerk' });
        }
  
        clerkUserData = response.data;
      } catch (axiosError) {
        console.error('Error fetching user data from Clerk:', axiosError.message);
        return reply.status(500).send({ error: 'Failed to fetch user data from Clerk' });
      }
  
      const usersCollection = fastify.mongo.db.collection('users');
      let user = await usersCollection.findOne({ clerkId });
      console.log(`User found with clerkId ${clerkId}: ${!!user}`);
  
      if (!user) {
        // Create a new user with Clerk data
        user = {
          clerkId,
          createdAt: new Date(),
          coins: 100,
          lang: request.lang,
          username: clerkUserData.username,
          nickname: clerkUserData.username,
          firstName: clerkUserData.first_name,
          lastName: clerkUserData.last_name,
          fullName: clerkUserData.full_name,
          email: clerkUserData.email_addresses[0]?.email_address,
          subscriptionStatus: 'inactive', // Set default subscription status
        };
        const result = await usersCollection.insertOne(user);
        user._id = result.insertedId;
        console.log(`New user created with clerkId ${clerkId} and _id ${user._id}`);
      } else {
        // Check if database username matches Clerk username
        if (user.username !== clerkUserData.username || user.nickname !== clerkUserData.username) {
          // Update database user with Clerk data
          const updateData = {
            username: clerkUserData.username,
            nickname: clerkUserData.username,
            firstName: clerkUserData.first_name,
            lastName: clerkUserData.last_name,
            fullName: clerkUserData.full_name,
            email: clerkUserData.email_addresses[0]?.email_address,
          };
  
          await usersCollection.updateOne(
            { clerkId },
            { $set: updateData }
          );
  
          // Update the user object with the new data
          Object.assign(user, updateData);
          console.log(`Updated user with clerkId ${clerkId} to match Clerk data`);
        }
  
        // Check for subscription status if not present
        if (!user.subscriptionStatus) {
          const subscriptionInfo = await fastify.mongo.db.collection('subscriptions').findOne({
            _id: new fastify.mongo.ObjectId(user._id)
          });
  
          if (subscriptionInfo && subscriptionInfo.subscriptionStatus === 'active') {
            await usersCollection.updateOne(
              { _id: user._id },
              { $set: { subscriptionStatus: 'active' } }
            );
            user.subscriptionStatus = 'active';
          } else {
            await usersCollection.updateOne(
              { _id: user._id },
              { $set: { subscriptionStatus: 'inactive' } }
            );
            user.subscriptionStatus = 'inactive';
          }
        }
      }
  
      await updateUserLang(fastify.mongo.db, user._id, request.lang);
      const token = jwt.sign({ _id: user._id, clerkId: user.clerkId }, process.env.JWT_SECRET, { expiresIn: '24h' });
      console.log(`JWT token created for user ${user._id}`);
  
      // Set the cookie and redirect
      reply.setCookie('token', token, { path: '/', httpOnly: true });
      console.log('Redirect to /chat/')
      return reply.send({ redirectUrl: '/chat/' });
  
    } catch (err) {
      console.log(`Error in /user/clerk-auth: ${err.message}`, err);
      return reply.status(500).send({ error: 'Server error' });
    }
  });

  fastify.post('/user/clerk-update', async (request, reply) => {
    try {
      const clerkUser = request.body;
      if(!clerkUser){
        return reply.send({error:`User not founded`})
      }
      const clerkId = clerkUser.id;

      if (!clerkId) {
        console.warn('No clerkId found in request body');
        return reply.status(400).send({ error: 'clerkId is required' });
      }

      // Fetch user data from Clerk
      const clerkApiUrl = `https://api.clerk.com/v1/users/${clerkId}`;
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;

      if (!clerkSecretKey) {
        console.error('CLERK_SECRET_KEY is not set in environment variables.');
        return reply.status(500).send({ error: 'Clerk secret key not configured' });
      }

      try {
        const response = await axios.get(clerkApiUrl, {
          headers: {
            'Authorization': `Bearer ${clerkSecretKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status !== 200) {
          console.error(`Failed to fetch user data from Clerk API. Status: ${response.status}`);
          return reply.status(500).send({ error: 'Failed to fetch user data from Clerk' });
        }

        const clerkUserData = response.data;

        const usersCollection = fastify.mongo.db.collection('users');
        const user = await usersCollection.findOne({ clerkId });

        if (!user) {
          console.warn(`No user found with clerkId ${clerkId}`);
          return reply.status(404).send({ error: 'User not found' });
        }

        // Update user data in database
        const updateData = {
          username: clerkUserData.username,
          nickname: clerkUserData.username,
          firstName: clerkUserData.first_name,
          lastName: clerkUserData.last_name,
          fullName: clerkUserData.full_name,
          email: clerkUserData.email_addresses[0]?.email_address,
        };
         
        // Check for subscription status
        const subscriptionInfo = await fastify.mongo.db.collection('users').findOne({
          _id: new ObjectId(user._id)
        });
        console.log(`[user/clerk-update] Subscription info for user ${user._id}:`, subscriptionInfo.subscriptionStatus);
        if (subscriptionInfo && subscriptionInfo.subscriptionStatus === 'active') {
          updateData.subscriptionStatus = 'active';
        } else {
          updateData.subscriptionStatus = 'inactive';
        }

        const result = await usersCollection.updateOne(
          { clerkId },
          { $set: updateData }
        );

        if (result.modifiedCount === 0) {
          console.warn(`User with clerkId ${clerkId} not updated`);
        } else {
          console.log(`Database user with clerkId ${clerkId} updated successfully`);
        }

        // If user has updated their nickname in our system, update it in Clerk too
        if (user.nickname && user.nickname !== clerkUserData.username) {
          await updateClerkUsername(clerkId, user.nickname, clerkSecretKey);
        }

        return reply.send({ status: 'User information successfully updated' });
      } catch (axiosError) {
        console.error('Error fetching user data from Clerk:', axiosError.message);
        return reply.status(500).send({ error: 'Failed to fetch user data from Clerk' });
      }
    } catch (err) {
      console.error(`Error in /user/clerk-update: ${err.message}`, err);
      return reply.status(500).send({ error: 'Server error' });
    }
  });

  // Helper function to update Clerk username
  async function updateClerkUsername(clerkId, username, clerkSecretKey) {
    try {
      const clerkApiUrl = `https://api.clerk.com/v1/users/${clerkId}`;
      
      const response = await axios.patch(clerkApiUrl, 
        { username },
        {
          headers: {
            'Authorization': `Bearer ${clerkSecretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status !== 200) {
        console.error(`Failed to update username in Clerk. Status: ${response.status}`);
        return false;
      }
      
      console.log(`Clerk username updated to ${username} for user ${clerkId}`);
      return true;
    } catch (error) {
      console.error('Error updating Clerk username:', error.message);
      return false;
    }
  }

  fastify.post('/user/update-info/:currentUserId', async (request, reply) => {
    try {

      if (!request.isMultipart?.()) {
        console.error('Request is not multipart/form-data');
        return reply.status(400).send({ error: 'Request must be multipart/form-data' });
      }

      const currentUserId = request.params.currentUserId;
      const formData = {
        email: null,
        nickname: null,
        bio: null,
        birthYear: null,
        birthMonth: null,
        birthDay: null,
        gender: null,
        profileUrl: null,
        ageVerification: null
      };

      async function processImage(url, onSuccess) {
        const moderation = await moderateImage(url);
        if (!moderation.results[0].flagged) {
          await onSuccess(url);
          fastify.sendNotificationToUser(request.user._id, 'imageModerationFlagged', { flagged: false, currentUserId });
        } else {
          fastify.sendNotificationToUser(request.user._id, 'imageModerationFlagged', { flagged: true, currentUserId });
        }
      }

      // Process each part as it arrives.
      for await (const part of request.parts()) {
        if (part.fieldname && part.value) {
          formData[part.fieldname] = part.value;
        } else if (part.fieldname === 'profile' && part.file) {
          // Consume file stream immediately.
          const chunks = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const hash = createHash('sha256').update(buffer).digest('hex');
          const awsimages = fastify.mongo.db.collection('awsimages');

          const existingFile = await awsimages.findOne({ hash });
          if (existingFile) {
            const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFile.key}`;
            console.log('Profile image already exists in DB');
            await processImage(imageUrl, async (url) => { formData.profileUrl = url; });
            continue;
          }

          let existingFiles;
          try {
            existingFiles = await listFiles(hash);
          } catch (error) {
            console.error('Failed to list objects in S3:', error);
            return reply.status(500).send({ error: 'Failed to check existing profile images' });
          }

          if (existingFiles.Contents?.length > 0) {
            const imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
            console.log('Profile image already exists in S3');
            await processImage(imageUrl, async (url) => { formData.profileUrl = url; });
          } else {
            const key = `${hash}_${part.filename}`;
            let uploadUrl;
            try {
              uploadUrl = await uploadToS3(buffer, hash, part.filename || 'uploaded_file');
            } catch (error) {
              console.error('Failed to upload profile image:', error);
              return reply.status(500).send({ error: 'Failed to upload profile image' });
            }
            await processImage(uploadUrl, async (url) => {
              formData.profileUrl = url;
              await awsimages.insertOne({ key, hash });
            });
          }
        }
      }

      console.log('All parts processed');

      if (!currentUserId) {
        console.error('Missing currentUserId');
        return reply.status(400).send({ error: 'Missing currentUserId' });
      }
      console.log('currentUserId:', currentUserId);

      const { token } = request.cookies;
      if (!token) {
        return reply.status(401).send({ error: 'Authentication token is missing' });
      }

      const updateData = {};
      if (formData.email) updateData.email = formData.email;
      if (formData.nickname) updateData.nickname = formData.nickname;
      if (formData.bio) updateData.bio = formData.bio;
      if (formData.birthYear && formData.birthMonth && formData.birthDay) {
        updateData.birthDate = {
          year: formData.birthYear,
          month: formData.birthMonth,
          day: formData.birthDay
        };
      }
      if (formData.gender) updateData.gender = formData.gender;
      if (formData.profileUrl) updateData.profileUrl = formData.profileUrl;
      if (formData.ageVerification) updateData.ageVerification = formData.ageVerification === 'true';

      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ error: 'No data to update' });
      }

      console.log('Updating user info:', updateData);
      const usersCollection = fastify.mongo.db.collection('users');
      const updateResult = await usersCollection.updateOne(
        { _id: new fastify.mongo.ObjectId(currentUserId) },
        { $set: updateData }
      );

      if (updateResult.modifiedCount === 0) {
        console.warn('User info update failed');
      }
      const user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(currentUserId) });
      delete user.password;
      delete user.purchasedItems;

      return reply.send({ user, status: 'User information successfully updated' });
    } catch (error) {
      console.error('Error in update-info route:', error);
      return reply.status(500).send({ error: 'An internal server error occurred' });
    }
  });


  // Keep the old update-password route
  fastify.post('/user/update-password', async (request, reply) => {
    try {
      const { oldPassword, newPassword } = request.body;
      const { token } = request.cookies;

      if (!token) {
        return reply.status(401).send({ error: '認証トークンがありません' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded._id;

      const usersCollection = fastify.mongo.db.collection('users');

      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

      if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
        return reply.status(401).send({ error: '無効な古いパスワード' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const updateResult = await usersCollection.updateOne(
        { _id: new fastify.mongo.ObjectId(userId) },
        { $set: { password: hashedPassword } }
      );

      if (updateResult.modifiedCount === 0) {
        return reply.status(500).send({ error: 'パスワードの更新に失敗しました' });
      }

      return reply.send({ status: 'パスワードが正常に更新されました' });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'サーバーエラーが発生しました' });
    }
  });

  fastify.get('/user/plan/:id', async (request, reply) => {
    try {
      const userId = request.params.id;
      console.log(`[GET] /user/plan/:id - [user/plan] called with userId: ${userId}`);
      if (!userId) {
        console.warn('[user/plan] No userId provided in request params');
        return reply.send({ error: `Plan not founded` });
      }
      // Fetch the user from the database using their ObjectId
      console.log(`[user/plan] Looking up subscription for userId: ${userId}`);
      const existingSubscription = await fastify.mongo.db.collection('subscriptions').findOne({
        userId: new fastify.mongo.ObjectId(userId),
        subscriptionStatus: 'active',
      });
      if (!existingSubscription) {
        console.warn(`[user/plan] No active subscription found for userId: ${userId}`);
      } else {
        console.log(`[user/plan] Active subscription found for userId: ${userId}`);
        //console.log(`[user/plan] Subscription details:`, existingSubscription);
      }
      // Show the user object from request.user
      //console.log(`[user/plan] User object from request.user:`, request.user);
      return reply.send({ plan: existingSubscription });
    } catch (error) {
      console.error(`[user/plan] Error in /user/plan/:id:`, error);
      return reply.send({ error: `Plan not founded` });
    }
  });

  fastify.get('/user/limit/:id', async (request, reply) => {
    try {
      const userId = request.params.id;
      const limits = await checkLimits(fastify, userId)
      return reply.send({limits})
    } catch (error) {
      reply.send({error:`Limit not founded`})
      console.log(error)
    }
  });
 
  fastify.get('/user/:userId', async (request, reply) => {
    const { userId } = request.params;
    const db = fastify.mongo.db
    const collectionChat = db.collection('chats');
    const collectionUser = db.collection('users');

    try {
      let currentUser = request.user;
      const currentUserId = currentUser?._id;
      if (!currentUser?.isTemporary && currentUserId) currentUser = await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(currentUserId) });

      const userData = await getUserData(userId, collectionUser, collectionChat, currentUser);

      if (!userData) {
        return reply.redirect('/my-plan');
      }
      let isMyProfile =  userId.toString() === currentUser?._id.toString();
      let isAdmin = false;
      if(!userData.isTemporary){
       isAdmin = await checkUserAdmin(fastify, currentUser._id);
      }

      const translations = request.translations;

      return reply.renderWithGtm('/user-profile.hbs', {
        title: `${userData.nickname}さんのプロフィール`,
        translations,
        mode: process.env.MODE,
        apiurl: process.env.API_URL,
        isAdmin,
        isMyProfile,
        user: request.user,
        userData,
      });
    } catch (error) {
      console.log(error);
      return reply.status(500).send({ error: 'An error occurred' });
    }
  });


  fastify.get('/user/chat-data/:userId', async (request, reply) => {
    const { userId } = request.params;
    const db = fastify.mongo.db
    const collectionChat = db.collection('chats');
    const collectionUser = db.collection('users');

    try {
      let currentUser = request.user
      const currentUserId = currentUser?._id
      if (!currentUser?.isTemporary && currentUserId) await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(currrentUserId) });
      const user = await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(userId) });
      if (!user) return reply.status(404).send({ error: 'User not found' });

      let personas = user.personas || [];
      const validPersonaIds = (await collectionChat.find({ _id: { $in: personas.map(id => new fastify.mongo.ObjectId(id)) } }).toArray()).map(p => p._id.toString());

      if (user.persona && !validPersonaIds.includes(user.persona.toString())) user.persona = null;
      if (user.persona) validPersonaIds.push(user.persona.toString());

      personas = await collectionChat.find({ _id: { $in: [...new Set(validPersonaIds)].map(id => new fastify.mongo.ObjectId(id)) } }).toArray();

      await collectionUser.updateOne(
        { _id: new fastify.mongo.ObjectId(userId) },
        { $set: { personas: validPersonaIds, persona: user.persona || validPersonaIds[0] || null } }
      );

      const chatQuery = {
        $or: [{ userId }, { userId: new fastify.mongo.ObjectId(userId) }],
        visibility: currentUser?._id.toString() === userId ? { $in: ["public", "private"] } : "public"
      };

      const userChats = await collectionChat.find(chatQuery).sort({_id:-1}).toArray();
      const [publicChatCount, privateChatCount] = await Promise.all([
        collectionChat.countDocuments({ ...chatQuery, visibility: "public" }),
        collectionChat.countDocuments({ ...chatQuery, visibility: "private" })
      ]);

      return reply.send({
        isAdmin: currentUser?._id.toString() === userId,
        user: currentUser,
        userData: {
          profileUrl: user.profileUrl,
          nickname: user.nickname,
          coins: user.coins,
        },
        userChats: userChats.map(chat => ({
          _id: chat._id,
          name: chat.name,
          description: chat.description,
          chatImageUrl: chat.chatImageUrl || chat.thumbnailUrl || '',
          tags: chat.tags || [],
          visibility: chat.visibility
        })),
        publicChatCount,
        privateChatCount,
        personas
      });
    } catch (error) {
      console.log(error);
      return reply.status(500).send({ error: 'An error occurred' });
    }
  });
  fastify.post('/user/:userId/follow-toggle', async (request, reply) => {
    const db = fastify.mongo.db
    const usersCollection = db.collection('users');
    const translations = request.translations

    let currentUser = request.user;
    const currentUserId = new fastify.mongo.ObjectId(currentUser?._id);
    const targetUserId = new fastify.mongo.ObjectId(request.params.userId);
    const action = request.body.action == 'true';

    try {
      if (action) {
        await usersCollection.updateOne(
          { _id: currentUserId },
          { $addToSet: { following: targetUserId }, $inc: { followCount: 1 } }
        );
        await usersCollection.updateOne(
          { _id: targetUserId },
          { $addToSet: { followers: currentUserId }, $inc: { followerCount: 1 } }
        );


        // Create a notification for the target user
        const message = `${currentUser?.nickname} ${translations.startFollow} `;
        await fastify.sendNotificationToUser(targetUserId, message, 'info', { followerId: currentUserId });

        reply.send({ message: 'フォローしました！' });
      } else {
        // Check current follow count before decrementing
        let currentUserData = await usersCollection.findOne({ _id: currentUserId });
        let targetUserData = await usersCollection.findOne({ _id: targetUserId });

        if (currentUserData.followCount > 0) {
          await usersCollection.updateOne(
            { _id: currentUserId },
            { $pull: { following: targetUserId }, $inc: { followCount: -1 } }
          );
        }
        if (targetUserData.followerCount > 0) {
          await usersCollection.updateOne(
            { _id: targetUserId },
            { $pull: { followers: currentUserId }, $inc: { followerCount: -1 } }
          );
        }

        reply.send({ message: 'フォローを解除しました！' });
      }
    } catch (err) {
      console.log(err);
      reply.code(500).send({ error: 'リクエストに失敗しました。' });
    }
  });
  fastify.get('/user/:userId/followers-or-followings', async (request, reply) => {
    try {
      const { userId } = request.params;
      const type = request.query.type || 'followers'; // 'followers' or 'following'
      const page = parseInt(request.query.page) || 1;
      const limit = 12; // Number of users per page
      const skip = (page - 1) * limit;

      const db = fastify.mongo.db
      const usersCollection = db.collection('users');

      // Find the user and either get their followers or following list
      const user = await usersCollection.findOne({ _id: new fastify.mongo.ObjectId(userId) });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      const list = type === 'followers' ? user.followers : user.following;
      const totalItems = list ? list.length : 0;

      if (!list || totalItems === 0) {
        return reply.code(404).send({ users: [], page, totalPages: 0 });
      }

      // Get paginated followers or following
      const paginatedUserIds = list.slice(skip, skip + limit);
      const paginatedUsers = await usersCollection
        .find({ _id: { $in: paginatedUserIds.map(id => new fastify.mongo.ObjectId(id)) } })
        .toArray();

      // Format users for response
      const formattedUsers = paginatedUsers.map(user => ({
        userId: user._id,
        userName: user.nickname || 'Unknown User',
        profilePicture: user.profileUrl || '/img/avatar.png',
      }));

      const totalPages = Math.ceil(totalItems / limit);

      // Send paginated response
      reply.send({
        users: formattedUsers,
        page,
        totalPages,
      });
    } catch (err) {
      console.log('Error: ', err);
      reply.code(500).send('Internal Server Error');
    }
  });
  fastify.get('/follower/:userId', async (request, reply) => {
    try {
      // Get current user
      let currentUser = request.user;
      const currentUserId = currentUser?._id;

      const db = fastify.mongo.db
      if (!currentUser?.isTemporary && currentUserId) currentUser = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(currentUserId) });

      const { userId } = request.params;
      const type = request.query.type || 'followers'; // Default to 'followers' if type not provided

      // Find the specified user
      const user = await db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Determine which list to return (followers or following)
      let list = type === 'followers' ? user.followers : user.following;

      if (!list || list.length === 0) {
        list = []; // Ensure it's an empty array if there are no followers or following
      }

      // Fetch the users in the followers or following list
      const users = await db.collection('users')
      .find({ _id: { $in: list.map(id => new fastify.mongo.ObjectId(id)) } })
      .toArray() || [];

      const formattedUsers = users.map(user => ({
        userId: user._id.toString(),
        userName: user.nickname || 'Unknown User',
        profilePicture: user.profileUrl || '/img/avatar.png',
      }));

      const isFollowing = currentUser?.following && currentUser?.following.some(followingId => followingId.toString() === user._id.toString());
      const isFollowedBy = user.following && user.following.some(followingId => followingId.toString() === currentUserId.toString());
      const title = `${user.nickname} の${type === 'followers' ? 'フォロワー' : 'フォロー中'}リスト`;

      const translations = request.translations;
      return reply.view('follower.hbs', {
        title,translations,
      mode: process.env.MODE,
      apiurl: process.env.API_URL,
        currentUser: {
          userId: currentUserId,
          userName: currentUser?.nickname,
          profilePicture: currentUser?.profileUrl || '/img/avatar.png',
          postCount: currentUser?.postCount || 0,
          imageLikeCount: currentUser?.imageLikeCount || 0,
          followCount: currentUser?.followCount || 0,
          followerCount: currentUser?.followerCount || 0,
          coins: currentUser?.coins || 0,
        },
        requestedUser: {
          userId: userId,
          userName: user.nickname,
          profilePicture: user.profileUrl || '/img/avatar.png',
          postCount: user.postCount || 0,
          imageLikeCount: user.imageLikeCount || 0,
          followCount: user.followCount || 0,
          followerCount: user.followerCount || 0,
          coins: user.coins || 0,
          follow: isFollowing,
          followedBy: isFollowedBy
        },
        type: type,
        users: formattedUsers,
      });
    } catch (err) {
      console.error('Error:', err);
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
  fastify.get('/users/', async (request, reply) => {
    try {
      const page = parseInt(request.query.page, 10) || 1;
      const limit = 5;
      const skip = (page - 1) * limit;

      const db = fastify.mongo.db
      const usersCollection = db.collection('users');

      const usersCursor = await usersCollection
        .find({isTemporary: {$exists:false},nickname: {$exists:true},profileUrl: {$exists:true}})
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      if (!usersCursor.length) {
        return reply.code(404).send({ users: [], page, totalPages: 0 });
      }

      const usersData = usersCursor.map(user => ({
        userId: user._id,
        userName: user.nickname || 'Unknown User',
        profilePicture: user.profileUrl || '/img/avatar.png',
      }));

      const totalUsersCount = await usersCollection.countDocuments({});
      const totalPages = Math.ceil(totalUsersCount / limit);

      reply.send({
        users: usersData,
        page,
        totalPages
      });
    } catch (err) {
      reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  fastify.get('/user/is-admin/:userId', async (req, reply) => {
    try {
      let user = req.user;
      if (user.isTemporary){
        return reply.send({ isAdmin : false });
      }
      const isAdmin = await checkUserAdmin(fastify, req.params.userId);
      return reply.send({ isAdmin });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get('/users/:userId/notifications', async (request, reply) => {
    const user = request.user;
    const targetUserId = new ObjectId(request.params.userId);
    const viewed = request.query.viewed;
    const orConditions = [
        { userId: targetUserId },
        { sticky: true, dismissedBy: { $ne: targetUserId } }
    ];

    if (viewed !== undefined) {
        orConditions[0].viewed = viewed === 'true';
    }

    const filter = { $or: orConditions };

    const db = fastify.mongo.db
    const notificationsCollection = db.collection('notifications');
    const notifications = await notificationsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

      reply.send(notifications);
  });
  // Logout route clears the token cookie and other cookies
  fastify.post('/user/logout', async (request, reply) => {
    try {
      const cookies = request.cookies;

      for (const cookieName in cookies) {
        reply.clearCookie(cookieName, { path: '/' });
      }

      // Ensure we're not sending any redirect headers
      return reply.code(200).send({ success: true, message: 'Logout successful' });
    } catch (error) {
      console.log('Logout error:', error);
      return reply.code(500).send({ error: 'Logout failed', message: error.message });
    }
  });

  // Login route to authenticate users with email and password
  fastify.post('/user/login', async (request, reply) => {
    try {
        const { email, password, rememberMe } = request.body;
        const translations = request.translations;
        if (!email || !password) {
            return reply.status(400).send({ error: translations.old_login.missing_credentials });
        }
        
        const usersCollection = fastify.mongo.db.collection('users');
        const user = await usersCollection.findOne({ email });
        
        if (!user) {
            return reply.status(401).send({ error: translations.old_login.invalid_credentials });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return reply.status(401).send({ error: translations.old_login.invalid_credentials });
        }
        
        // Update user's language preference
        await updateUserLang(fastify.mongo.db, user._id, request.lang);
        
        // Set token expiration based on rememberMe
        const expiresIn = rememberMe ? '7d' : '24h';
        
        // Generate JWT token
        const token = jwt.sign(
            { _id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn }
        );
        
        // Set cookie and return success response without redirect
        reply.setCookie('token', token, { 
            path: '/', 
            httpOnly: true,
            maxAge: rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60 // in seconds
        });
        
        return reply.send({ 
            success: true,
            user: {
                _id: user._id,
                nickname: user.nickname,
                email: user.email
            }
        });
            
    } catch (err) {
        console.error(`Error in /user/login: ${err.message}`, err);
        return reply.status(500).send({ error: translations.old_login.server_error });
    }
  });
    
}

module.exports = routes;
