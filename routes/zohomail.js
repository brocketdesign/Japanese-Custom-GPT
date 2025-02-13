const axios = require('axios');

async function getAccessToken(authCode) {
  const params = {
    code: authCode,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: '/zoho/callback',
    grant_type: 'authorization_code'
  };
  const { data } = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, { params });
  return data; // returns { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const params = {
    refresh_token: refreshToken,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token'
  };
  const { data } = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, { params });
  return data; // returns { access_token, expires_in, [refresh_token] }
}

async function addContactToCampaign(contact, accessToken) {
  const url = 'https://campaigns.zoho.com/api/v1.1/addcontact';
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/json'
  };
  const { data } = await axios.post(url, contact, { headers });
  return data;
}

async function routes(fastify, options) {
  const tokensCollection = fastify.mongo.db.collection('zoho_tokens');

  fastify.get('/zoho/auth', async (request, reply) => {
    const scope = 'ZohoCampaigns.contacts.UPDATE';
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
      const tokenData = await getAccessToken(code);
      await tokensCollection.updateOne(
        { _id: 'zoho' },
        {
          $set: {
            refresh_token: tokenData.refresh_token,
            access_token: tokenData.access_token,
            expires_at: Date.now() + tokenData.expires_in * 1000
          }
        },
        { upsert: true }
      );
      reply.send(tokenData);
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
      // Check if the access token is expired
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
