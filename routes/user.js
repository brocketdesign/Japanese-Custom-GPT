const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function routes(fastify, options) {
  fastify.post('/user/register', async (request, reply) => {
    const { username, password } = request.body;
    const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await usersCollection.findOne({ username });
    if (user) {
      return reply.status(400).send({ error: 'ユーザーはすでに存在します' });
    }
    
    await usersCollection.insertOne({ username, password: hashedPassword });
    
    // Generate a token for the new user
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    reply
      .setCookie('token', token, { path: '/', httpOnly: true })
      .send({ status: 'ユーザーが正常に登録されました', redirect: '/dashboard' });
  });

  fastify.post('/user/login', async (request, reply) => {
    const { username, password } = request.body;
    const usersCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
    
    const user = await usersCollection.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return reply.status(401).send({ error: '無効なユーザー名またはパスワード' });
    }
    
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    reply
      .setCookie('token', token, { path: '/', httpOnly: true })
      .send({ redirect: '/dashboard' });
  });

  fastify.post('/user/logout', async (request, reply) => {
    reply
      .clearCookie('token', { path: '/' })
      .send({ status: 'ログアウトに成功しました' });
  });

}

module.exports = routes;
