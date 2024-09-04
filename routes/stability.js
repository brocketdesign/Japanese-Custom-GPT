const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const aws = require('aws-sdk');
const { createHash } = require('crypto');
const stringSimilarity = require('string-similarity'); 

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
  
      // Append the image message to the user's messages array
      const imageMessage = { "role": "assistant", "content": `[Image] ${imageId}` };
      await userDataCollection.updateOne(
          { userId: new fastify.mongo.ObjectId(userId), _id: new fastify.mongo.ObjectId(userChatId) },
          { 
              $push: { messages: imageMessage }, 
              $set: { updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) }
          }
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
      const imagePrompt = imageDocument.images[0].prompt
      return reply.status(200).send({ imageUrl, imagePrompt});
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
      prompt: `score_10_up, score_9_up, score_8_up, score_7_up, source_anime,,perfect anatomy,masterpiece,(((best quality))),(((ultra-detailed))),(perfect skin),perfect fingers,perfect anatomy,HD,4K quality,(perfect hands:0.1),((nsfw)),((((sexy)))),erotic pose,((sexy pose)),`,
      negative_prompt: "naked pussy,pussy,vagin,sex,dick,rybadimagenegative_v1.3, ng_deepnegative_v1_75t, (ugly face),cross-eyed,sketches, (worst quality:2),(low quality:2), (normal quality:2),normal quality,((monochrome)),((grayscale)), skin spots,acnes,(((skin blemishes))),bad anatomy,(Multiple people),bad hands,,missing fingers,cropped,low quality, jpeg artifacts,burned,(((blurry))),cropped, poorly drawn hands,poorly drawn face,mutation,deformed,worst quality,"
    },
    sfw: {
      prompt: `score_10_up, score_9_up, score_8_up, score_7_up, source_anime,,perfect anatomy,masterpiece,(((best quality))),(((ultra-detailed))),(perfect skin),perfect fingers,perfect anatomy,HD,4K quality,(perfect hands:0.1),((sfw)),`,
      negative_prompt : "nsfw,naked pussy,pussy,((vagin)),vaginal,((((pussy)))),(((nipple))),nude,((naked)),sex,(((genital))), rybadimagenegative_v1.3, ng_deepnegative_v1_75t, (ugly face),cross-eyed,sketches, (worst quality:2),(low quality:2), (normal quality:2),normal quality,((monochrome)),((grayscale)), skin spots,acnes,(((skin blemishes))),bad anatomy,(Multiple people),bad hands,,missing fingers,cropped,low quality, jpeg artifacts,burned,(((blurry))),cropped, poorly drawn hands,poorly drawn face,mutation,deformed,worst quality,"
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
    const { prompt, aspectRatio, userId, chatId, userChatId, character } = request.body;
    try {
      const apiKey = process.env.NOVITA_API_KEY;
      let closestCheckpoint = null
      const query = character ? character.checkpoint : null;
      if(query){
        const novitaApiUrl = `https://api.novita.ai/v3/model?pagination.limit=60&pagination.cursor=c_0&filter.source=civitai&filter.query=${encodeURIComponent(query)}&filter.types=checkpoint&filter.is_nsfw=false&filter.is_inpainting=0`;
        const response = await axios.get(novitaApiUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        const data = response.data;
        /*
        if (data.models && data.models.length > 0) {
          const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
          const modelNames = data.models.map(model => model.sd_name.toLowerCase().replace(/[^a-z0-9]/g, ''));
          let bestMatch = stringSimilarity.findBestMatch(normalizedQuery, modelNames);
          const similarityThreshold = 0.5;
          if (bestMatch.bestMatch.rating >= similarityThreshold) {
            closestCheckpoint = data.models[bestMatch.bestMatchIndex].sd_name;
          }
        }
        */
      }
      const image_request1 = { ...params };
      image_request1.prompt = default_prompt.sfw.prompt + prompt;
      image_request1.negative_prompt = default_prompt.sfw.negative_prompt;
      
      const image_request2 = { ...params };
      image_request2.prompt = default_prompt.nsfw.prompt + prompt;
      image_request2.negative_prompt = default_prompt.nsfw.negative_prompt;
      
      const handleImageRequest = async (image_request) => {
        const taskId = await fetchNovitaMagic(image_request);
        const imageUrls = await fetchNovitaResult(taskId);
        return await Promise.all(imageUrls.map(async (imageUrl) => {
            const { imageId } = await saveImageToDB(userId, chatId, userChatId, image_request.prompt, imageUrl, aspectRatio);
            return { id: imageId, url: imageUrl, prompt: image_request.prompt };
        }));
    };
    
    const [images1, images2] = await Promise.all([
        handleImageRequest(image_request1),
        handleImageRequest(image_request2)
    ]);
    
    reply.send({ images: [...images1, ...images2] });
    
      
    } catch (err) {
      console.error(err);
      reply.status(500).send('Error generating image');
    }
  });
  
}

module.exports = routes;
