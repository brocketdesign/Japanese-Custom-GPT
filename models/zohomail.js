const axios = require('axios');

async function refreshAccessToken(refreshToken) {
  const params = {
    refresh_token: refreshToken,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token'
  };
  const { data } = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, { params });
  return data;
}

async function addContactToCampaign(contact, accessToken) {
  const url = 'https://campaigns.zoho.com/api/v1.1/json/listsubscribe';
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  const params = new URLSearchParams(contact);
  const { data } = await axios.post(url, params, { headers });
  return data;
}

module.exports = { refreshAccessToken, addContactToCampaign };
