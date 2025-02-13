
const axios = require('axios');

async function getAccessToken(authCode) {
  const params = {
    code: authCode,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: process.env.ZOHO_REDIRECT_URI,
    grant_type: 'authorization_code'
  };
  const { data } = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, { params });
  return data.access_token;
}

async function routes(fastify, options) {
  // Redirect to Zoho's OAuth authorization URL
  fastify.get('/zoho/auth', async (request, reply) => {
    const scope = 'ZohoCampaigns.contacts.UPDATE'; // update scope if needed
    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=${encodeURIComponent(scope)}&client_id=${process.env.ZOHO_CLIENT_ID}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(process.env.ZOHO_REDIRECT_URI)}`;
    reply.redirect(authUrl);
  });

  // Callback endpoint to exchange auth code for access token
  fastify.get('/api/v1/auth/zoho/callback', async (request, reply) => {
    const { code } = request.query;
    try {
      const accessToken = await getAccessToken(code);
      reply.send({ access_token: accessToken });
    } catch (error) {
      reply.code(500).send({ error: error.toString() });
    }
  });
}

module.exports = routes;
