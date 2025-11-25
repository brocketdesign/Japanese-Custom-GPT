const axios = require('axios');

async function testImageInfo(imageId) {
  if (!imageId) {
    console.error('Please provide an imageId as a command-line argument.');
    process.exit(1);
  }

  try {
    const response = await axios.get(`http://localhost:3000/gallery/${imageId}/info`);
    console.log('Image Info Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching image info:', error.response ? error.response.data : error.message);
  }
}

// Get imageId from command-line arguments
const imageId = process.argv[2];
testImageInfo(imageId);
