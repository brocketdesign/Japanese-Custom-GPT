const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const crypto = require('crypto');
const axios = require('axios');
const { checkLimits } = require('../models/tool');

async function routes(fastify, options) {
  fastify.post('/user/register', async (request, reply) => {
    try {
      const { email, password } = request.body;
      
      // Validate request data
      if (!email || !password) {
        return reply.status(400).send({ error: 'ユーザー名とパスワードは必須です' });
      }
  
      const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
      
      // Check if the user already exists
      const user = await usersCollection.findOne({ email });
      if (user) {
        return reply.status(400).send({ error: 'ユーザーはすでに存在します' });
      }
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user into the database
      const TempUser = await fastify.getUser(request, reply);
      let tempUserId = TempUser._id
      
      const result = await usersCollection.insertOne(
        { 
          email, 
          password: hashedPassword, 
          createdAt:new Date(), 
          tempUserId,
          coins: 100
        });
  
      if (!result.insertedId) {
        return reply.status(500).send({ error: 'ユーザーの登録に失敗しました' });
      }
  
      const newUser = { _id: result.insertedId, email };

      // Transfer temp chat to new user
      const userId = newUser._id
      const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
      const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');

      const updateUserId = async (collectionChat, collectionUserChat, userId, tempUserId) => {
    
        // Update collectionUserChat
        const userChatResult = await collectionUserChat.updateMany(
            { userId: new fastify.mongo.ObjectId(tempUserId) },
            { $set: { userId: new fastify.mongo.ObjectId(userId), log_success:true } }
        );
        // Update collectionChat
        const chatResult = await collectionChat.updateMany(
            { userId: new fastify.mongo.ObjectId(tempUserId) },
            { $set: { userId: new fastify.mongo.ObjectId(userId) } }
        );
        return {
            userChatUpdated: userChatResult.modifiedCount,
            chatUpdated: chatResult.modifiedCount
        };
    };
    
      await updateUserId(collectionChat, collectionUserChat, userId, tempUserId)

      // Generate a token for the new user
      const token = jwt.sign(newUser, process.env.JWT_SECRET, { expiresIn: '24h' });
  
      return reply
        .setCookie('token', token, { path: '/', httpOnly: true })
        .send({ status: 'ユーザーが正常に登録されました', redirect: '/dashboard' });
    } catch (err) {
      console.log(err);
      return reply.status(500).send({ error: 'サーバーエラーが発生しました' });
    }
  });

  fastify.post('/user/login', async (request, reply) => {
    const { email, password } = request.body;
    const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
    
    const user = await usersCollection.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return reply.status(401).send({ error: '無効なユーザー名またはパスワード' });
    }
    
    const token = jwt.sign({ _id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    return reply
      .clearCookie('tempUser', { path: '/' }) // Clear the tempUser cookie
      .setCookie('token', token, { path: '/', httpOnly: true })
      .send({ redirect: '/dashboard' });
  });  

  // Google authentication configuration
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;


// Google authentication route
fastify.get('/user/google-auth', async (request, reply) => {
  const protocol = 'https';
  const host = request.headers.host.replace('192.168.10.115', 'localhost');
  const googleRedirectUri = `${protocol}://${host}/user/google-auth/callback`;
  
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${googleClientId}&` +
    `redirect_uri=${encodeURIComponent(googleRedirectUri)}&` +
    `response_type=code&` +
    `scope=openid%20email%20profile`;

  return reply.redirect(url);
});

// Google authentication callback route
fastify.get('/user/google-auth/callback', async (request, reply) => {
  try {
    const protocol = 'https';
    const host = request.headers.host.replace('192.168.10.115', 'localhost');
    const googleRedirectUri = `${protocol}://${host}/user/google-auth/callback`;
    
    const code = request.query.code;
    const tokenResponse = await axios.post(`https://oauth2.googleapis.com/token`, {
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: googleRedirectUri,
      grant_type: 'authorization_code',
    });

    const token = tokenResponse.data.access_token;
    const userInfoResponse = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const userInfo = userInfoResponse.data;
    const email = userInfo.email;
    const googleId = userInfo.sub; // Get the Google ID from the user info response
    const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');

    // Check if the user already exists
    const user = await usersCollection.findOne({ email });
    if (!user) {
      // Create a new user if they don't exist
      const hashedPassword = await bcrypt.hash(Math.random().toString(36).substr(2, 10), 10);
      
      const TempUser = await fastify.getUser(request, reply);
      let tempUserId = TempUser._id
      const result = await usersCollection.insertOne({ 
        email, 
        password: hashedPassword, 
        googleId, 
        createdAt: new Date() , 
        tempUserId,
        coins: 100
      });
      const userId = result.insertedId;
      // Transfer temp chat to new user
      const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
      const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');

      const updateUserId = async (collectionChat, collectionUserChat, userId, tempUserId) => {
    
        // Update collectionUserChat
        const userChatResult = await collectionUserChat.updateMany(
            { userId: new fastify.mongo.ObjectId(tempUserId) },
            { $set: { userId: new fastify.mongo.ObjectId(userId), log_success: true } }
        );
        // Update collectionChat
        const chatResult = await collectionChat.updateMany(
            { userId: new fastify.mongo.ObjectId(tempUserId) },
            { $set: { userId: new fastify.mongo.ObjectId(userId) } }
        );
        return {
            userChatUpdated: userChatResult.modifiedCount,
            chatUpdated: chatResult.modifiedCount
        };
    };
    
      await updateUserId(collectionChat, collectionUserChat, userId, tempUserId)
      const token = jwt.sign({ _id: userId, email }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return reply
      .setCookie('token', token, { path: '/', httpOnly: true })
      .redirect('/dashboard')
      .send({ status: 'ユーザーが正常に登録されました' });
    } else {
      // Update the user's Google ID if it's not already set
      if (!user.googleId) {
        await usersCollection.updateOne({ _id: user._id }, { $set: { googleId } });
      }
      // Login the user if they already exist
      const token = jwt.sign({ _id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return reply
      .setCookie('token', token, { path: '/', httpOnly: true })
      .redirect('/dashboard')
    }
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'サーバーエラーが発生しました' });
  }
});

fastify.get('/user/line-auth', async (request, reply) => {
  const protocol = 'https';
  const host = request.headers.host.replace('192.168.10.115', 'localhost');
  const lineConfig = {
    channelId: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    redirectUri: `${protocol}://${host}/user/line-auth/callback`,
  };
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const scope = 'profile openid email';
  const response_type = 'code';

  const url = `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=${response_type}&` +
    `client_id=${lineConfig.channelId}&` +
    `redirect_uri=${encodeURIComponent(lineConfig.redirectUri)}&` +
    `scope=${scope}&` +
    `state=${state}&` +
    `nonce=${nonce}`;

  return reply.redirect(url);
});

fastify.get('/user/line-auth/callback', async (request, reply) => {
  try {
    const protocol = 'https';
    const host = request.headers.host.replace('192.168.10.115', 'localhost');
    const lineConfig = {
      channelId: process.env.LINE_CHANNEL_ID,
      channelSecret: process.env.LINE_CHANNEL_SECRET,
      redirectUri: `${protocol}://${host}/user/line-auth/callback`,
    };
    const { code, state, nonce } = request.query;

    const tokenResponse = await axios.post(`https://api.line.me/oauth2/v2.1/token`, 
    `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(lineConfig.redirectUri)}&client_id=${lineConfig.channelId}&client_secret=${lineConfig.channelSecret}`, 
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const token = tokenResponse.data.access_token;
    const idToken = tokenResponse.data.id_token;

    const decodedIdToken = jwt.verify(idToken, lineConfig.channelSecret, {
      algorithms: ['HS256'],
    });

    const userId = decodedIdToken.sub;
    const email = decodedIdToken.email;  // Get the email from the decoded ID token

    const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');

    // Check if the user already exists
    const user = await usersCollection.findOne({ userId });
    if (!user) {
      // Create a new user if they don't exist
      const hashedPassword = await bcrypt.hash(Math.random().toString(36).substr(2, 10), 10);
      
      const TempUser = await fastify.getUser(request, reply);
      let tempUserId = TempUser._id
      const result = await usersCollection.insertOne({ 
        userId, 
        email, 
        password: hashedPassword, 
        createdAt: new Date(), 
        tempUserId ,
        coins: 100
      });
      const newUserId = result.insertedId;
      // Transfer temp chat to new user
      const userId = newUserId
      const collectionUserChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
      const collectionChat = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('chats');

      const updateUserId = async (collectionChat, collectionUserChat, userId, tempUserId) => {
    
        // Update collectionUserChat
        const userChatResult = await collectionUserChat.updateMany(
            { userId: new fastify.mongo.ObjectId(tempUserId) },
            { $set: { userId: new fastify.mongo.ObjectId(userId), log_success:true } }
        );
        // Update collectionChat
        const chatResult = await collectionChat.updateMany(
            { userId: new fastify.mongo.ObjectId(tempUserId) },
            { $set: { userId: new fastify.mongo.ObjectId(userId) } }
        );
        return {
            userChatUpdated: userChatResult.modifiedCount,
            chatUpdated: chatResult.modifiedCount
        };
    };
    
      await updateUserId(collectionChat, collectionUserChat, userId, tempUserId)

      const token = jwt.sign({ _id: newUserId, userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return reply
        .setCookie('token', token, { path: '/', httpOnly: true })
        .redirect('/dashboard')
        .send({ status: 'ユーザーが正常に登録されました' });
    } else {
      // Login the user if they already exist
      const token = jwt.sign({ _id: user._id, userId: user.userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
      return reply
        .setCookie('token', token, { path: '/', httpOnly: true })
        .redirect('/dashboard');
    }
  } catch (err) {
    fastify.log.error(err.response ? err.response.data : err.message);
    return reply.status(500).send({ error: 'サーバーエラーが発生しました' });
  }
});

  // Keep the old logout route
  fastify.post('/user/logout', async (request, reply) => {
    return reply
     .clearCookie('token', { path: '/' })
     .send({ status: 'ログアウトに成功しました' });
  });

  // Keep the old update-info route
   // Configure AWS S3
   const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });
  fastify.post('/user/update-info', async (request, reply) => {
    const parts = request.parts();
  
    // Initialize variables for the incoming form data
    let email, nickname, birthYear, birthMonth, birthDay, gender, profileUrl;
  
    for await (const part of parts) {
      if (part.fieldname === 'email' && part.value) email = part.value;
      if (part.fieldname === 'nickname' && part.value) nickname = part.value;
      if (part.fieldname === 'birthYear' && part.value) birthYear = part.value;
      if (part.fieldname === 'birthMonth' && part.value) birthMonth = part.value;
      if (part.fieldname === 'birthDay' && part.value) birthDay = part.value;
      if (part.fieldname === 'gender' && part.value) gender = part.value;
  
      if (part.fieldname === 'profile' && part.file) {
        // Process file input for the profile image
        const chunks = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
  
        // Calculate the hash of the profile image
        const hash = crypto.createHash('md5');
        hash.update(buffer);
        const profileHash = hash.digest('hex');
  
        // Check if a file with this hash already exists in S3
        let existingFiles;
        try {
          existingFiles = await s3.listObjectsV2({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Prefix: profileHash,
          }).promise();
        } catch (error) {
          console.error('Failed to list objects in S3:', error);
          return reply.status(500).send({ error: 'Failed to check existing profile images' });
        }
  
        if (existingFiles.Contents.length > 0) {
          // File already exists, use its URL
          profileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
        } else {
          // Upload the profile image to S3
          const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: `${profileHash}_${part.filename}`,
            Body: buffer,
          };
  
          try {
            const uploadResult = await s3.upload(params).promise();
            profileUrl = uploadResult.Location;
          } catch (error) {
            console.error('Failed to upload profile image:', error);
            return reply.status(500).send({ error: 'Failed to upload profile image' });
          }
        }
      }
    }
  
    try {
      const { token } = request.cookies;
  
      if (!token) {
        return reply.status(401).send({ error: '認証トークンがありません' });
      }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded._id;
  
      // Access the MongoDB collection
      const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
  
      // Construct the data object to update in the database
      const updateData = {};

      if (email) updateData.email = email;
      if (nickname) updateData.nickname = nickname;
      if (birthYear && birthMonth && birthDay) {
        updateData.birthDate = { year: birthYear, month: birthMonth, day: birthDay };
      }
      if (gender) updateData.gender = gender;
      if (profileUrl) updateData.profileUrl = profileUrl;
      
      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ error: '更新するデータがありません' });
      }
      // Perform the update operation
      const updateResult = await usersCollection.updateOne(
        { _id: new fastify.mongo.ObjectId(userId) },
        { $set: updateData }
      );
  
      if (updateResult.modifiedCount === 0) {
        return reply.status(500).send({ error: 'ユーザー情報の更新に失敗しました' });
      }
  
      return reply.send({ status: 'ユーザー情報が正常に更新されました' });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'サーバーエラーが発生しました' });
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

      const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');

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
      if(!userId){
        return reply.send({error:`Plan not founded`})
      }
      // Fetch the user from the database using their ObjectId
      existingSubscription = await fastify.mongo.client.db(process.env.MONGODB_NAME).collection('subscriptions').findOne({
        _id: new fastify.mongo.ObjectId(userId),
        subscriptionStatus: 'active',
      });
      return reply.send({plan:existingSubscription})
    } catch (error) {
      return reply.send({error:`Plan not founded`})
      console.log(error)
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
  
    const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
    const collectionChat = db.collection('chats');
    const collectionUser = db.collection('users');
  
    try {
  
      let currentUser = await fastify.getUser(request, reply);
      const currentUserId = currentUser._id;
      currentUser = await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(currentUserId) });
  
      const user = await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(userId) });
  
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
  
      const chatQuery = {
        $or: [
          { userId },
          { userId: new fastify.mongo.ObjectId(userId) }
        ],
        visibility: "public"
      };
  
      let isAdmin = false;
  
      if (currentUserId.toString() === userId) {
        isAdmin = true;
      }

  
      return reply.view('/user-profile.hbs', {
        isAdmin,
        user: currentUser,
        userData: {
          _id : user._id,
          profileUrl: user.profileUrl,
          nickname: user.nickname,
          coins: user.coins,
        },
      });
    } catch (error) {
      console.log(error)
      return reply.status(500).send({ error: 'An error occurred' });
    }
  });
  fastify.get('/user/chat-data/:userId', async (request, reply) => {

    const { userId } = request.params;
  
    const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
    const collectionChat = db.collection('chats');
    const collectionUser = db.collection('users');
  
    try {
  
      let currentUser = await fastify.getUser(request, reply);
      const currentUserId = currentUser._id;
      currentUser = await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(currentUserId) });
  
      const user = await collectionUser.findOne({ _id: new fastify.mongo.ObjectId(userId) });
  
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }
  
      // Fetch and validate personas including selected persona
      let personas = user.personas || [];
      let validPersonaIds = [];
  
      for (const personaId of personas) {
        const personaExists = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(personaId) });
        if (personaExists) {
          validPersonaIds.push(personaId);
        }
      }
  
      // Validate selected persona
      if (user.persona && !validPersonaIds.includes(user.persona)) {
        user.persona = null; // Reset if invalid
      } else if (user.persona) {
        validPersonaIds.push(user.persona); // Ensure selected persona is included
      }
  
      // Ensure unique persona IDs
      validPersonaIds = [...new Set(validPersonaIds)];
  
      // Fetch the actual persona objects
      personas = await collectionChat.find({ _id: { $in: validPersonaIds.map(id => new fastify.mongo.ObjectId(id)) } }).toArray();
  
      // Update the user document with valid personas and selected persona
      await collectionUser.updateOne(
        { _id: new fastify.mongo.ObjectId(userId) },
        { 
          $set: { 
            personas: validPersonaIds, 
            persona: user.persona || (validPersonaIds.length > 0 ? validPersonaIds[0] : null) // Set default if needed
          } 
        }
      );
  
      const chatQuery = {
        $or: [
          { userId },
          { userId: new fastify.mongo.ObjectId(userId) }
        ],
        visibility: "public"
      };
  
      let isAdmin = false;
  
      if (currentUserId.toString() === userId) {
        isAdmin = true;
        chatQuery.visibility = { $in: ["public", "private"] };
      }
  
      const userChats = await collectionChat.find(chatQuery).sort({_id:-1}).toArray();
  
      const publicChatCount = await collectionChat.countDocuments({
        $or: [
          { userId },
          { userId: new fastify.mongo.ObjectId(userId) }
        ],
        visibility: "public"
      });
  
      const privateChatCount = await collectionChat.countDocuments({
        $or: [
          { userId },
          { userId: new fastify.mongo.ObjectId(userId) }
        ],
        visibility: "private"
      });
  
      return reply.send({
        isAdmin,
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
          chatImageUrl: chat.chatImageUrl != undefined && chat.chatImageUrl != '' ? chat.chatImageUrl : chat.thumbnailUrl,
          tags: chat.tags || [],
          visibility: chat.visibility
        })),
        publicChatCount,
        privateChatCount,
        personas
      });
    } catch (error) {
      console.log(error)
      return reply.status(500).send({ error: 'An error occurred' });
    }
  });
  
}

module.exports = routes;
