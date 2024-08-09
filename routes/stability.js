const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const aws = require('aws-sdk');
const { createHash } = require('crypto');

async function routes(fastify, options) {
  // Configure AWS S3
  const s3 = new aws.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
  });
  const STABILITY_API_URL = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
  const diffusionHeaders = {
    'Authorization': `Bearer ${process.env.STABLE_DIFFUSION_API_KEY}`,
    'Accept': 'image/*'
  };

  async function fetchStabilityMagic(data) {
    try {
      const formData = new FormData();
      formData.append('prompt', data.prompt);
      formData.append('output_format', 'jpeg');

      const response = await axios.post(
        STABILITY_API_URL,
        formData,
        {
          headers: {
            ...diffusionHeaders,
            ...formData.getHeaders(),
          },
          responseType: 'arraybuffer',
          validateStatus: (status) => status < 500,
        }
      );

      if (response.status !== 200) {
        throw new Error(`${response.status}: ${response.data.toString()}`);
      }

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Oopsie-daisy! Trouble in paradise: ', error.message);
      if (error.response) {
        console.error('Error response status: ', error.response.status);
        console.error('Error response headers: ', error.response.headers);
        console.error('Error response data: ', error.response.data);
      } else {
        console.error('Error without response: ', error);
      }
      throw error;
    }
  }

  async function transmogrifyImage(data) {
    try {
      const response = await axios.post(
        STABILITY_API_URL,
        data,
        {
          headers: {
            ...data.getHeaders(),
            Accept: 'image/*',
            Authorization: `Bearer ${process.env.STABLE_DIFFUSION_API_KEY}`
          },
          responseType: 'arraybuffer',
          validateStatus: (status) => status < 500,
        }
      );

      if (response.status !== 200) {
        throw new Error(`The server is being a bit grumpy: ${response.status}: ${response.data ? response.data.toString() : 'No response data'}`);
      }

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Whoops! Hit a snag: ', error.message);
      if (error.response) {
        console.error('Error response status: ', error.response.status);
        console.error('Error response headers: ', error.response.headers);
        console.error('Error response data: ', error.response.data);
      } else {
        console.error('Error without response: ', error);
      }
      throw error;
    }
  }

  function createStabilityPayload(imagePath, prompt) {
    const formData = new FormData();

    formData.append('init_image', fs.readFileSync(imagePath), 'init_image.png');
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', 0.35);
    formData.append('steps', 40);
    formData.append('seed', 0);
    formData.append('cfg_scale', 5);
    formData.append('samples', 1);
    formData.append('prompt', prompt);
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', 1);
    formData.append('text_prompts[1][text]', 'blurry, bad');
    formData.append('text_prompts[1][weight]', -1);

    return formData;
  }
  const uploadToS3 = async (buffer, hash, filename) => {
      const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: `${hash}_${filename}`,
          Body: buffer,
          ACL: 'public-read'
      };
      const uploadResult = await s3.upload(params).promise();
      return uploadResult.Location;
  };

  const handleFileUpload = async (part) => {
      const chunks = [];
      for await (const chunk of part.file) {
          chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const hash = createHash('md5').update(buffer).digest('hex');
      const existingFiles = await s3.listObjectsV2({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Prefix: hash,
      }).promise();
      if (existingFiles.Contents.length > 0) {
          return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
      } else {
          return uploadToS3(buffer, hash, part.filename);
      }
  };
  async function saveImageToDB(userId, chatId, userChatId, prompt, imageUrl, aspectRatio, reply) {
    try {
      const chatsGalleryCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('gallery');
  
      const imageId = new fastify.mongo.ObjectId(); // Generate a new ObjectId for the image
  
      await chatsGalleryCollection.updateOne(
        { 
          userId: new fastify.mongo.ObjectId(userId),
          chatId: new fastify.mongo.ObjectId(chatId),
        },
        { 
          $push: { 
            images: { _id: imageId, prompt, imageUrl, aspectRatio } 
          } 
        },
        { upsert: true }
      );
  
      const userDataCollection = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('userChat');
      let userData = await userDataCollection.findOne({ userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) });
  
      if (!userData) {
        console.log(`User data not found`);
        return reply.status(404).send({ error: 'User data not found' });
      }
  
      let userMessages = userData.messages || [];
      const imageMessage = { "role": "assistant", "content": `[Image] ${imageId}` };
      userMessages.push(imageMessage);
      userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
  
      // Update the chat document in the database
      await userDataCollection.updateOne(
        { userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) },
        { $set: { messages: userMessages, updatedAt: userData.updatedAt } }
      );
  
      return { imageId, imageUrl }; // Return both the imageId and imageUrl
  
    } catch (error) {
      console.log(error);
      return reply.status(500).send({ error: 'An error occurred while saving the image' });
    }
  }
  
  

  function getClosestAllowedDimension(height, ratio) {
    const [widthRatio, heightRatio] = ratio.split(':').map(Number);
    const targetAspectRatio = widthRatio / heightRatio;
  
    // Define allowed dimensions
    const allowedDimensions = [
      { width: 1024, height: 1024 }, { width: 1152, height: 896 },
      { width: 1216, height: 832 }, { width: 1344, height: 768 },
      { width: 1536, height: 640 }, { width: 640, height: 1536 },
      { width: 768, height: 1344 }, { width: 832, height: 1216 },
      { width: 896, height: 1152 }
    ];
  
    // Sort dimensions by closeness to the target aspect ratio
    const sortedDimensions = allowedDimensions.sort((a, b) => {
      const ratioA = a.width / a.height;
      const ratioB = b.width / b.height;
      return Math.abs(ratioA - targetAspectRatio) - Math.abs(ratioB - targetAspectRatio);
    });
  
    // Return the first (closest) dimension
    return sortedDimensions[0];
  }
  async function convertImageToBase64(imagePath) {
    const imageBuffer = await fs.promises.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    return base64Image;
  }
  async function ensureFolderExists(folderPath) {
    try {
      // Check if the folder exists
      await fs.promises.access(folderPath, fs.constants.F_OK);
    } catch (error) {
      // Folder does not exist, create it
      await fs.promises.mkdir(folderPath, { recursive: true });
    }
  }

  fastify.post('/stability/txt2img', async (request, reply) => {
    const { prompt, aspectRatio, userId, chatId, userChatId } = request.body;
    const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
  
    const closestDimension = getClosestAllowedDimension(1024, aspectRatio);
    const stableDiffusionPayload = {
      prompt: prompt,
      width: closestDimension.width,
      height: closestDimension.height,
      steps: 20,
      seed: 0,
      cfg_scale: 5,
      samples: 1,
      text_prompts: [
        { text: prompt, weight: 1 },
        { text: 'bad,blurry', weight: -1 }
      ]
    };
  
    console.log(stableDiffusionPayload);
    console.log(`txt2img`);
  
    try {
  
      const imageBuffer = await fetchStabilityMagic(stableDiffusionPayload);
      const imageUrl = await handleFileUpload({
        file: [imageBuffer], // Convert buffer to an iterable for handleFileUpload
        filename: `${Date.now()}.png`
      });
  
      const { imageId } = await saveImageToDB(userId, chatId, userChatId, prompt, imageUrl, aspectRatio);
      console.log({ imageId, imageUrl });
  
      reply.send({ image_id: imageId, image: imageUrl });
    } catch (err) {
      console.error(err);
      reply.status(500).send('Error generating image');
    }
  });
  


  fastify.post('/stability/img2img', async (request, res) => {
    const { prompt, negative_prompt, aspectRatio, imagePath } = request.body;

    if (!imagePath) {
      return res.status(400).send('An image path must be provided for img2img.');
    }

    try {
      
      console.log(`img2img`)
      const stabilityPayload = createStabilityPayload(imagePath, prompt);
      const resultImageBuffer = await transmogrifyImage(stabilityPayload);
      const imageID = await saveImageToDB(global.db, request.user._id, prompt, resultImageBuffer, aspectRatio);

      await ensureFolderExists('./public/output');
      const outputImagePath = `./public/output/${imageID}.png`;
      await fs.promises.writeFile(outputImagePath, resultImageBuffer);

      const base64ResultImage = await convertImageToBase64(outputImagePath);
      reply.send({ image_id: imageID, image: base64ResultImage });
    } catch (err) {
      console.error(err);
      reply.status(500).send('Error generating image');
    }
  });

  fastify.get('/image/:imageId', async (request, reply) => {
    try {
      const { imageId } = request.params;
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const galleryCollection = db.collection('gallery');
  
      // Convert the imageId string to a MongoDB ObjectId
      const objectId = new fastify.mongo.ObjectId(imageId);
  
      // Find the image document containing this imageId in the gallery
      const imageDocument = await galleryCollection.findOne({
        "images._id": objectId
      }, {
        projection: { "images.$": 1 } // Only return the matching image
      });
  
      if (!imageDocument || !imageDocument.images || imageDocument.images.length === 0) {
        return reply.status(404).send({ error: 'Image not found' });
      }
  
      const imageUrl = imageDocument.images[0].imageUrl;
      return reply.status(200).send({ imageUrl });
    } catch (error) {
      console.error('Error fetching image URL:', error);
      return reply.status(500).send({ error: 'An error occurred while fetching the image URL' });
    }
  });
  
}

module.exports = routes;
