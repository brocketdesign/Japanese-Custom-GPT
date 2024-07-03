const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const aws = require('aws-sdk');
const crypto = require('crypto');

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
      const result = await usersCollection.insertOne({ email, password: hashedPassword, createdAt:new Date() });
  
      if (!result.insertedId) {
        return reply.status(500).send({ error: 'ユーザーの登録に失敗しました' });
      }
  
      const newUser = { _id: result.insertedId, email };
  
      // Generate a token for the new user
      const token = jwt.sign(newUser, process.env.JWT_SECRET, { expiresIn: '24h' });
  
      return reply
        .setCookie('token', token, { path: '/', httpOnly: true })
        .send({ status: 'ユーザーが正常に登録されました', redirect: '/dashboard' });
    } catch (err) {
      fastify.log.error(err);
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
      .setCookie('token', token, { path: '/', httpOnly: true })
      .send({ redirect: '/dashboard' });
  });

  fastify.post('/user/logout', async (request, reply) => {
    return reply
      .clearCookie('token', { path: '/' })
      .send({ status: 'ログアウトに成功しました' });
  });

  // Configure AWS S3
  const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });
  fastify.post('/user/update-info', async (request, reply) => {
    const parts = request.parts();
  
    let email, firstname, lastname, address, company, state, zip, profileUrl;
  
    for await (const part of parts) {
      if (part.fieldname === 'email') email = part.value;
      if (part.fieldname === 'firstname') firstname = part.value;
      if (part.fieldname === 'lastname') lastname = part.value;
      if (part.fieldname === 'address') address = part.value;
      if (part.fieldname === 'company') company = part.value;
      if (part.fieldname === 'state') state = part.value;
      if (part.fieldname === 'zip') zip = part.value;
      if (part.fieldname === 'profile' && part.file) {
        // Read the file stream into a buffer
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
  
      const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
  
      const updateData = { email, firstname, lastname, address, company, state, zip };
      if (profileUrl) {
        updateData.profileUrl = profileUrl;
      }
  
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
}

module.exports = routes;
