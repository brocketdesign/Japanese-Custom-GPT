const axios = require('axios');
const { refreshAccessToken, addContactToCampaign } = require('../models/zohomail');

async function routes(fastify, options) {
  const tokensCollection = fastify.mongo.db.collection('zoho_tokens');

  fastify.get('/zoho/auth', async (request, reply) => {
    const scope = 'ZohoCampaigns.contact.UPDATE';
    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=${encodeURIComponent(
      scope
    )}&client_id=${process.env.ZOHO_CLIENT_ID}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(
      '/zoho/callback'
    )}`;
    reply.redirect(authUrl);
  });

  fastify.get('/zoho/callback', async (request, reply) => {
    const { code } = request.query;
    try {
      const params = {
        code,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        redirect_uri: '/zoho/callback',
        grant_type: 'authorization_code'
      };
      const { data } = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, { params });
      await tokensCollection.updateOne(
        { _id: 'zoho' },
        {
          $set: {
            refresh_token: data.refresh_token,
            access_token: data.access_token,
            expires_at: Date.now() + data.expires_in * 1000
          }
        },
        { upsert: true }
      );
      reply.send(data);
    } catch (error) {
      reply.code(500).send({ error: error.toString() });
    }
  });

  fastify.get('/zoho/refresh', async (request, reply) => {
    try {
      const tokenDoc = await tokensCollection.findOne({ _id: 'zoho' });
      if (!tokenDoc || !tokenDoc.refresh_token) {
        return reply.code(400).send({ error: 'No refresh token found' });
      }
      const tokenData = await refreshAccessToken(tokenDoc.refresh_token);
      const updateData = {
        access_token: tokenData.access_token,
        expires_at: Date.now() + tokenData.expires_in * 1000
      };
      if (tokenData.refresh_token) {
        updateData.refresh_token = tokenData.refresh_token;
      }
      await tokensCollection.updateOne({ _id: 'zoho' }, { $set: updateData });
      reply.send(tokenData);
    } catch (error) {
      reply.code(500).send({ error: error.toString() });
    }
  });

  fastify.post('/zoho/add-contact', async (request, reply) => {
    const { contact } = request.body;
    try {
      let tokenDoc = await tokensCollection.findOne({ _id: 'zoho' });
      if (!tokenDoc || !tokenDoc.access_token) {
        return reply.code(400).send({ error: 'No access token found' });
      }
      if (Date.now() >= tokenDoc.expires_at) {
        const tokenData = await refreshAccessToken(tokenDoc.refresh_token);
        const updateData = {
          access_token: tokenData.access_token,
          expires_at: Date.now() + tokenData.expires_in * 1000
        };
        if (tokenData.refresh_token) {
          updateData.refresh_token = tokenData.refresh_token;
        }
        await tokensCollection.updateOne({ _id: 'zoho' }, { $set: updateData });
        tokenDoc.access_token = tokenData.access_token;
      }
      const result = await addContactToCampaign(contact, tokenDoc.access_token);
      reply.send(result);
    } catch (error) {
      reply.code(500).send({ error: error.toString() });
    }
  });
}

module.exports = routes;
