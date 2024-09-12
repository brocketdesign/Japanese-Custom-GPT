const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const aws = require('aws-sdk');
const { createHash } = require('crypto');
const stringSimilarity = require('string-similarity'); 
const { createBlurredImage } = require('../models/tool')

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

  async function saveImageToDB(userId, chatId, userChatId, prompt, imageUrl, aspectRatio, blurredImageUrl = null,nsfw = false, reply) {
    try {
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
      const chatsGalleryCollection = db.collection('gallery');
      const imageId = new fastify.mongo.ObjectId();
      await chatsGalleryCollection.updateOne(
        { 
          userId: new fastify.mongo.ObjectId(userId),
          chatId: new fastify.mongo.ObjectId(chatId),
        },
        { 
          $push: { 
            images: { 
              _id: imageId, 
              prompt, 
              imageUrl, 
              blurredImageUrl, 
              aspectRatio, 
              isBlurred: !!blurredImageUrl,
              nsfw,
              createdAt : new Date()
            } 
          } 
        },
        { upsert: true }
      );
  
      const userDataCollection = db.collection('userChat');
      const userData = await userDataCollection.findOne({ 
        userId: new fastify.mongo.ObjectId(userId), 
        _id: new fastify.mongo.ObjectId(userChatId) 
      });
  
      if (!userData) {
        return reply.status(404).send({ error: 'User data not found' });
      }
  
      const imageMessage = { role: "assistant", content: `[Image] ${imageId}` };
      await userDataCollection.updateOne(
        { 
          userId: new fastify.mongo.ObjectId(userId), 
          _id: new fastify.mongo.ObjectId(userChatId) 
        },
        { 
          $push: { messages: imageMessage }, 
          $set: { updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) } 
        }
      );
  
      return { imageId, imageUrl };
  
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

  // Hugging Face API Configuration
const API_URL_HUGGINGFACE = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev";
const HuggingFaceHeaders = {
  Authorization: "Bearer "+process.env.HUGGINGFACE_API_KEY
};

async function queryHuggingFaceAPI(data) {
  try {
    const response = await fetch(API_URL_HUGGINGFACE, {
      HuggingFaceHeaders,
      method: "POST",
      body: JSON.stringify(data),
    });

    // Check if the response is successful
    if (!response.ok) {
      //throw new Error(`HTTP error! status: ${response.status}`);
      throw new Error(`Non-200 response: ${await response.text()}`)

    }

    const imageBytes = await response.arrayBuffer();

    return Buffer.from(imageBytes);
  } catch (error) {
    console.error("Oops! Ran into an issue: ", error.message);
    throw error; // or return something else
  }
}
fastify.post('/huggingface/txt2img', async (request, reply) => {
  const { prompt, aspectRatio, userId, chatId, userChatId } = request.body;
  
  const huggingFacePayload = {
    inputs: prompt,
    parameters: {
        "num_inference_steps": 20, 
        "width": 768,              
        "height": 1280,            
        "negative_prompt": "(worst quality:2),(low quality:2),(normal quality:2),lowres,watermark",
    }
  };
  try {
    const imageBuffer = await queryHuggingFaceAPI(huggingFacePayload);
    const imageUrl = await handleFileUpload({
      file: [imageBuffer],
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
  // STABLE DIFFUSION
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
  
      const objectId = new fastify.mongo.ObjectId(imageId);
  
      const imageDocument = await galleryCollection.findOne({
        "images._id": objectId
      }, {
        projection: { "images.$": 1 }
      });
  
      if (!imageDocument || !imageDocument.images || imageDocument.images.length === 0) {
        return reply.status(404).send({ error: 'Image not found' });
      }
  
      const imageDetails = imageDocument.images[0];

      let imageUrl = imageDetails.imageUrl;
      const imagePrompt = imageDetails.prompt;
  
      const collectionUser = db.collection('users');
      let user = await fastify.getUser(request, reply);
      const userId = new fastify.mongo.ObjectId(user._id);
      user = await collectionUser.findOne({ _id: userId });
  
      let isBlur = false
      if (imageDetails.isBlurred && user.subscriptionStatus !== 'active') {
        imageUrl = imageDetails.blurredImageUrl; 
        isBlur = true
      }
  
      return reply.status(200).send({ imageDetails, imageUrl, imagePrompt, isBlur });
  
    } catch (error) {
      console.error('Error fetching image URL:', error);
      return reply.status(500).send({ error: 'An error occurred while fetching the image URL' });
    }
  });
  
  // NOVITA
    // Function to trigger the Novita API for text-to-image generation
    async function fetchNovitaMagic(data) {
      try {
        const response = await axios.post('https://api.novita.ai/v3/async/txt2img', {
          extra: {
            response_image_type: 'jpeg',
            enable_nsfw_detection: false,
            nsfw_detection_level: 0,
          },
          request: data,
        }, {
          headers: {
            Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });
  
        if (response.status !== 200) {
          throw new Error(`Error: ${response.status} - ${response.data}`);
        }
  
        return response.data.task_id;
      } catch (error) {
        console.error('Error fetching Novita image:', error.message);
        throw error;
      }
    }
  
// Function to retrieve the result from Novita API using task_id with polling and upload it to S3
async function fetchNovitaResult(task_id) {
  const pollInterval = 1000; // Poll every 1 second
  const maxAttempts = 120; // Set a maximum number of attempts to avoid infinite loops

  let attempts = 0;

  return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
          attempts++;

          try {
              const response = await axios.get(`https://api.novita.ai/v3/async/task-result?task_id=${task_id}`, {
                  headers: {
                      Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
                  },
              });

              if (response.status !== 200) {
                  throw new Error(`Error fetching result: ${response.status} - ${response.data}`);
              }

              const taskStatus = response.data.task.status;

              if (taskStatus === 'TASK_STATUS_SUCCEED') {
                clearInterval(timer);
                const images = response.data.images;
                if (images.length === 0) {
                    throw new Error('No images returned from Novita API');
                }
            
                const s3Urls = await Promise.all(images.map(async (image) => {
                    const imageUrl = image.image_url;
                    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(imageResponse.data, 'binary');
                    const hash = createHash('md5').update(buffer).digest('hex');
                    return uploadToS3(buffer, hash, 'novita_result_image.png');
                }));
            
                resolve(s3Urls);
            } else if (taskStatus === 'TASK_STATUS_FAILED') {
                  clearInterval(timer);
                  reject(`Task failed with reason: ${response.data.task.reason}`);
              } else if (attempts >= maxAttempts) {
                  clearInterval(timer);
                  reject('Task timed out.');
              }

              // Optionally, you can log the progress or queue status
              if (taskStatus === 'TASK_STATUS_QUEUED') {
                  //console.log("Queueing...");
              } else if (taskStatus === 'TASK_STATUS_RUNNING') {
                  //console.log(`Progress: ${response.data.task.progress_percent}%`);
              }

          } catch (error) {
              clearInterval(timer);
              console.error('Error fetching Novita result:', error.message);
              reject(error);
          }
      }, pollInterval);
  });
}

  const default_prompt ={
    nsfw: {
      prompt: `score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up, source_anime,1girl,(nsfw),uncensored,breasts,erect nipples,panty,large breast,(sexy pose), naughty face, sexy micro clothes, `,
      negative_prompt: "score_6, score_5, score_4, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye,pussy,vulve,vagin,sex,dick,blurry,signature,username,watermark,jpeg artifacts,normal quality,worst quality,low quality"
    },
    sfw: {
      prompt: `score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up, source_anime,1girl,HD,4K quality,(perfect hands:0.1),(sfw),dressed,clothes ,`,
      negative_prompt : "score_6, score_5, score_4, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, nipple,topless,nsfw,naked,pussy,vulve,vagin,,nude,sex,worst quality,low quality,"
    }
  }
  const params = {
    model_name: "novaAnimeXL_xlV10_341799.safetensors",
    prompt: '',
    negative_prompt: '',
    width: 768,
    height: 1024,
    sampler_name: "Euler a",
    guidance_scale: 10,
    steps: 30,
    image_num: 1,
    clip_skip: 0,
    seed: -1,
    loras: [],
  }

  
  fastify.post('/novita/txt2img', async (request, reply) => {
    const { prompt, aspectRatio, userId, chatId, userChatId } = request.body;
    try {
      const db = await fastify.mongo.client.db(process.env.MONGODB_NAME)
      const collectionUser = fastify.mongo.client.db(process.env.MONGODB_NAME).collection('users');
      let user = await fastify.getUser(request, reply);
      const userIdObj = new fastify.mongo.ObjectId(user._id);
      user = await collectionUser.findOne({ _id: userIdObj });
  
      const isSubscribed = user.subscriptionStatus === 'active';

      const truncate = (text, maxLength = 1024) => [...text].slice(0, maxLength).join('');

      const image_request1 = { 
        ...params, 
        prompt: truncate(default_prompt.sfw.prompt + prompt), 
        negative_prompt: truncate(default_prompt.sfw.negative_prompt)
      };
      
      const image_request2 = { 
        ...params, 
        prompt: truncate(default_prompt.nsfw.prompt + prompt), 
        negative_prompt: truncate(default_prompt.nsfw.negative_prompt)
      };
       
      console.log(image_request1,image_request2)
  
      const handleImageRequest = async (image_request, blur = false, nsfw = false) => {
        try {
          const taskId = await fetchNovitaMagic(image_request);
          let imageUrls = await fetchNovitaResult(taskId);
      
          return await Promise.all(imageUrls.map(async (imageUrl) => {
            let blurredImageUrl = null;
      
            // If blur is requested, create a blurred version
            if (blur) {
              blurredImageUrl = await createBlurredImage(imageUrl, db);
            }
      
            // Save both the original and blurred (if exists) URLs in the DB
            const { imageId } = await saveImageToDB(
              userId, 
              chatId, 
              userChatId, 
              image_request.prompt, 
              imageUrl,  // original image
              aspectRatio, 
              blurredImageUrl,  // blurred image (if exists)
              nsfw
            );
      
            // Return the correct URL based on the blur flag
            const returnUrl = blur && blurredImageUrl ? blurredImageUrl : imageUrl;
      
            return { id: imageId, url: returnUrl, prompt: image_request.prompt, nsfw };
          }));
        } catch (error) {
          console.log(`Failed to handle image request: ${image_request.prompt}`, error);
          return {}; // Return an empty object to avoid breaking Promise.all
        }
      }; 
  
      const [result1, result2] = await Promise.allSettled([
        handleImageRequest(image_request1),
        handleImageRequest(image_request2, !isSubscribed, true)
      ]);
      
      const images1 = result1.status === 'fulfilled' ? result1.value : [];
      const images2 = result2.status === 'fulfilled' ? result2.value : [];
      
      reply.send({ images: [...images1, ...images2] });
  
    } catch (err) {
      console.log(err);
      reply.status(500).send('Error generating image');
    }
  });
  
  
}

module.exports = routes;
