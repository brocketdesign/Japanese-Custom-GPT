const { ObjectId } = require('mongodb');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { createHash } = require('crypto');
const stringSimilarity = require('string-similarity'); 
const { createBlurredImage } = require('../models/tool')
const { z } = require("zod");

async function routes(fastify, options) {
  // Configure AWS S3
  const s3 = new S3Client({
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
      ACL: 'public-read', // Optionally remove if you manage this via bucket policy
    };
    
    const command = new PutObjectCommand(params);
    const uploadResult = await s3.send(command);
    return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
  };
  

  const handleFileUpload = async (part) => {
    const chunks = [];
    for await (const chunk of part.file) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const hash = createHash('md5').update(buffer).digest('hex');
    
    const listParams = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: hash,
    };
    const existingFiles = await s3.send(new ListObjectsV2Command(listParams));
    
    if (existingFiles.Contents && existingFiles.Contents.length > 0) {
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${existingFiles.Contents[0].Key}`;
    } else {
        return uploadToS3(buffer, hash, part.filename);
    }
  };

  async function saveImageToDB(userId, chatId, userChatId, prompt, imageUrl, aspectRatio, blurredImageUrl = null, nsfw = false) {
    try {
      const db = fastify.mongo.db
      const chatsGalleryCollection = db.collection('gallery');
  
      // Check if the image has already been saved for this task
      const existingImage = await chatsGalleryCollection.findOne({
        userId: new fastify.mongo.ObjectId(userId),
        chatId: new fastify.mongo.ObjectId(chatId),
        'images.imageUrl': imageUrl // Assuming imageUrl is unique per image
      });
  
      if (existingImage) {
        // Image already exists, return existing imageId and imageUrl
        const image = existingImage.images.find(img => img.imageUrl === imageUrl);
        return { imageId: image._id, imageUrl: image.imageUrl };
      }
  
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
              createdAt: new Date()
            } 
          },
        },
        { upsert: true }
      );
  
      const chatsCollection = db.collection('chats');
      await chatsCollection.updateOne(
        { _id: new fastify.mongo.ObjectId(chatId) },
        { $inc: { imageCount: 1 } }
      );
  
      const userDataCollection = db.collection('userChat');
      const userData = await userDataCollection.findOne({ 
        userId: new fastify.mongo.ObjectId(userId), 
        _id: new fastify.mongo.ObjectId(userChatId) 
      });
  
      if (!userData) {
        throw new Error('User data not found');
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
      console.error(error);
      throw new Error('An error occurred while saving the image');
    }
  }
  

  
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
          throw new Error(`Error - ${response.data}`);
        }
  
        return response.data.task_id;
      } catch (error) {
        console.error('Error fetching Novita image:', error.message);
        throw '';
      }
    }
  
    // Function to fetch Novita's task result (single check)
    async function fetchNovitaResult(task_id) {
      try {
        const response = await axios.get(`https://api.novita.ai/v3/async/task-result?task_id=${task_id}`, {
          headers: {
            Authorization: `Bearer ${process.env.NOVITA_API_KEY}`,
          },
        });

        if (response.status !== 200) {
          throw new Error(`Non-200 response: ${await response.text()}`);
        }

        const taskStatus = response.data.task.status;

        if (taskStatus === 'TASK_STATUS_SUCCEED') {
          const images = response.data.images;
          if (images.length === 0) {
            throw new Error('No images returned from Novita API');
          }

          const s3Urls = await Promise.all(images.map(async (image) => {
            const imageUrl = image.image_url;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(imageResponse.data, 'binary');
            const hash = createHash('md5').update(buffer).digest('hex');
            const uploadedUrl = await uploadToS3(buffer, hash, 'novita_result_image.png');
            return { imageId: hash, imageUrl: uploadedUrl };
          }));

          return s3Urls.length === 1 ? s3Urls[0] : s3Urls;
        } else if (taskStatus === 'TASK_STATUS_FAILED') {
          throw new Error(`Task failed with reason: ${response.data.task.reason}`);
        } else {
          // Task is still processing or queued
          return null;
        }

      } catch (error) {
        console.error("Error fetching Novita result:", error.message);
        throw error;
      }
    }

    const default_prompt = {
      sdxl: {
        sfw: {
          sampler_name: "Euler a",
          prompt: `score_9, score_8_up, masterpiece, best quality, (ultra-detailed), (perfect hands:0.1), (sfw), dressed, clothes, `,
          negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, nipple, topless, nsfw, naked, nude, sex, worst quality, low quality,young,child,dick,man`,
          width: 832,
          height: 1216,
          loras: []
        },
        nsfw: {
          sampler_name: "Euler a",
          prompt: `score_9, score_8_up, masterpiece, best quality, (ultra-detailed), (nsfw), uncensored, `,
          negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, worst quality, low quality,young,child,dick,man`,
          width: 832,
          height: 1216,
          loras: []
        }
      },
      sd: {
        sfw: {
          sampler_name: "DPM++ 2M Karras",
          prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (sfw), dressed, clothe on, natural lighting, `,
          negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo, nsfw,nude, topless, worst quality, low quality,disform,weird body,multiple hands,young,child,dick,man `,
          loras: [{"model_name":"more_details_59655.safetensors","strength":0.2},{ model_name: 'JapaneseDollLikeness_v15_28382.safetensors', strength: 0.7 },{"model_name":"PerfectFullBreasts-fCV3_59759.safetensors","strength":0.7}],
        },
        nsfw: {
          sampler_name: "DPM++ 2M Karras",
          prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, (nsfw),uncensored, `,
          negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo,disform,weird body,multiple hands,young,child,dick,man`,
          loras: [{"model_name":"more_details_59655.safetensors","strength":0.2},{ model_name: 'JapaneseDollLikeness_v15_28382.safetensors', strength: 0.7 },{"model_name":"PerfectFullBreasts-fCV3_59759.safetensors","strength":0.7}],
        }
      }
    };    
    
    const params = {
      model_name: "novaAnimeXL_ponyV20_461138.safetensors",
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

  fastify.get('/image/:imageId', async (request, reply) => {
    try {
      const { imageId } = request.params;
      const db = fastify.mongo.db
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
  
      const image = imageDocument.images[0];
      const imageUrl = image.imageUrl;
      const imagePrompt = image.prompt;
      const likedBy = image.likedBy || [];
  
      return reply.status(200).send({ imageUrl, imagePrompt, likedBy });
    } catch (error) {
      console.error('Error fetching image URL:', error);
      return reply.status(500).send({ error: 'An error occurred while fetching the image URL' });
    }
  });
  // Endpoint to initiate txt2img with SFW and NSFW
  fastify.post('/novita/product2img', async (request, reply) => {
    const { prompt, aspectRatio, userId, chatId, userChatId, imageType } = request.body;

    const Txt2ImgSchema = z.object({
        prompt: z.string().min(10, 'Prompt must be at least 10 characters long'),
        aspectRatio: z.string().optional().default('9:16'),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId'),
        chatId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid chatId'),
        userChatId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userChatId'),
        imageType: z.enum(['sfw', 'nsfw'])
    });

    try {
        const validated = Txt2ImgSchema.parse(request.body);
        const { prompt, aspectRatio, userId, chatId, userChatId, imageType } = validated;

        const db = fastify.mongo.db
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        const isSubscribed = user && user.subscriptionStatus === 'active';

        const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
        const imageVersion = chat.imageVersion;

        const selectedStyle = default_prompt[imageVersion] || default_prompt['sdxl'];
        const style = selectedStyle[imageType];

        const imageModel = chat.imageModel || 'novaAnimeXL_ponyV20_461138';

        const image_request = {
            type: imageType,
            model_name: imageModel + '.safetensors',
            sampler_name: style.sampler_name || '',
            loras: style.loras,
            prompt: style.prompt + prompt,
            negative_prompt: style.negative_prompt,
            aspectRatio: aspectRatio,
            width: style.width || params.width,
            height: style.height || params.height,
            blur: imageType === 'nsfw' && !isSubscribed
        };

        const requestData = { ...params, ...image_request };
        console.log(requestData)
        const novitaTaskId = await fetchNovitaMagic(requestData);

        await db.collection('tasks').insertOne({
            taskId: novitaTaskId,
            type: image_request.type,
            status: 'pending',
            prompt: prompt,
            negative_prompt: image_request.negative_prompt,
            aspectRatio: aspectRatio,
            userId: new ObjectId(userId),
            chatId: new ObjectId(chatId),
            userChatId: new ObjectId(userChatId),
            blur: image_request.blur || false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        reply.send({ taskId: novitaTaskId, message: 'Image generation task started. Use the taskId to check status.' });

    } catch (err) {
        console.error(err);
        reply.status(500).send({ error: 'Error initiating image generation.' });
    }
});

// Endpoint to initiate txt2img for selected image type
fastify.post('/novita/txt2img', async (request, reply) => {
  const { prompt, aspectRatio, userId, chatId, userChatId, imageType, price } = request.body;

  // Define the schema for validation
  const Txt2ImgSchema = z.object({
      prompt: z.string().min(10, 'Prompt must be at least 10 characters long'),
      aspectRatio: z.string().optional().default('9:16'),
      userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId'),
      chatId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid chatId'),
      userChatId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userChatId'),
      imageType: z.enum(['sfw', 'nsfw']),
      price: z.number().positive()
  });

  try {
      const validated = Txt2ImgSchema.parse(request.body);
      const { prompt, aspectRatio, userId, chatId, userChatId, imageType, price } = validated;

      const db = fastify.mongo.db

      // Fetch the user
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

      if (!user) {
          return reply.code(404).send({ error: 'User not found' });
      }

      let userCoins = user.coins || 0;

      if (userCoins < price) {
          return reply.code(400).send({ message: 'Insufficient coins', id: 1 });
      }

      // Deduct coins
      userCoins -= price;
      await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { coins: userCoins } }
      );

      // Fetch user subscription status
      const isSubscribed = user.subscriptionStatus === 'active';

      // Fetch imageVersion from chat or use default
      const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
      const imageVersion = chat.imageVersion || 'sdxl';

      // Select prompts and model based on imageStyle
      const selectedStyle = default_prompt[imageVersion] || default_prompt['sdxl'];

      const imageModel = chat.imageModel || 'novaAnimeXL_ponyV20_461138';

      // Prepare task based on imageType
      let image_request;
      if (imageType === 'sfw') {
          image_request = {
              type: 'sfw',
              model_name: imageModel + '.safetensors',
              sampler_name: selectedStyle.sfw.sampler_name || '',
              loras: selectedStyle.sfw.loras,
              prompt: selectedStyle.sfw.prompt + prompt,
              negative_prompt: selectedStyle.sfw.negative_prompt,
              width: selectedStyle.width || params.width,
              height: selectedStyle.height || params.height,
              blur: false
          };
      } else {
          image_request = {
              type: 'nsfw',
              model_name: imageModel + '.safetensors',
              sampler_name: selectedStyle.nsfw.sampler_name || '',
              loras: selectedStyle.nsfw.loras,
              prompt: selectedStyle.nsfw.prompt + prompt,
              negative_prompt: selectedStyle.nsfw.negative_prompt,
              width: selectedStyle.width || params.width,
              height: selectedStyle.height || params.height,
              blur: !isSubscribed
          };
      }

      // Prepare params
      const requestData = { ...params, ...image_request, image_num: 1 };
      console.log(requestData)
      // Send request to Novita and get taskId
      const novitaTaskId = await fetchNovitaMagic(requestData);

      // Store task details in DB
      await db.collection('tasks').insertOne({
          taskId: novitaTaskId,
          type: imageType,
          status: 'pending',
          prompt: prompt,
          negative_prompt: image_request.negative_prompt,
          aspectRatio: aspectRatio,
          userId: new ObjectId(userId),
          chatId: new ObjectId(chatId),
          userChatId: new ObjectId(userChatId),
          blur: image_request.blur,
          createdAt: new Date(),
          updatedAt: new Date()
      });

      // Respond with taskId
      reply.send({ taskId: novitaTaskId, message: 'Image generation task started. Use the taskId to check status.' });

  } catch (err) {
      console.error(err);
      reply.status(500).send({ error: 'Error initiating image generation.' });
  }
});
fastify.get('/novita/tasks', async (request, reply) => {
  const { status, userId } = request.query;
  try {
    const db = fastify.mongo.db;
    const tasksCollection = db.collection('tasks');
    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    const tasks = await tasksCollection.find(query).toArray();
    return reply.send(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  }
});
      /**
   * Endpoint to check the status of a task
   */
// Endpoint to check the status of a task without blurring images
fastify.get('/novita/task-status/:taskId', async (request, reply) => {
  const { taskId } = request.params;

  try {
      const db = fastify.mongo.db
      const tasksCollection = db.collection('tasks');
      const task = await tasksCollection.findOne({ taskId });

      if (!task) {

          return reply.status(404).send({ error: 'Task not found.' });
      }

      if (['completed', 'failed'].includes(task.status)) {
          return reply.send({
              taskId: task.taskId,
              status: task.status,
              ...(task.status === 'completed' ? { images: task.result?.images } : { error: task.error })
          });
      }

      // Fetch the result from Novita API
      const result = await fetchNovitaResult(task.taskId);
      if (!result) {
          // Task is still processing
          return reply.send({ taskId: task.taskId, status: 'processing' });
      }

      // Since we no longer need to blur images, we'll use the images as they are
      let images = Array.isArray(result) ? result : [result]; // `result` is an array of image data { imageId, imageUrl }

      // Save images to the database
      console.log(`Save images to the database`)
      const savedImages = await Promise.all(images.map(async (imageData) => {
          const saveResult = await saveImageToDB(
              task.userId,
              task.chatId,
              task.userChatId,
              task.prompt,
              imageData.imageUrl,
              task.aspectRatio,
              null, // blurredImageUrl is null since we're not blurring images
              task.type === 'nsfw' // nsfw flag
          );
          return { imageId: saveResult.imageId, imageUrl: imageData.imageUrl, prompt:task.prompt};
      }));

      // Update the task status to 'completed' and store the result
      await tasksCollection.updateOne(
          { taskId: task.taskId },
          { $set: { status: 'completed', result: { images: savedImages }, updatedAt: new Date() } }
      );

      // Send the response with the images
      return reply.send({
          taskId: task.taskId,
          status: 'completed',
          images: savedImages
      });

  } catch (error) {
      console.error('Error checking task status:', error);

      // Update the task status to 'failed' and store the error message
      await tasksCollection.updateOne(
          { taskId: taskId },
          { $set: { status: 'failed', error: error.message, updatedAt: new Date() } }
      );

      // Send the error response
      return reply.send({ taskId: taskId, status: 'failed', error: error.message });
  }
});

      
  async function saveChatImageToDB(db, chatId, imageUrl) {
    const collectionChats = db.collection('chats'); // Replace 'chats' with your actual collection name

    // Convert chatId string to ObjectId
    let chatObjectId;
    try {
        chatObjectId = new ObjectId(chatId);
    } catch (error) {
        throw new Error('無効なchatIdです。');
    }

    // Update the 'chats' collection with chatImageUrl and thumbnail
    const updateResult = await collectionChats.updateOne(
        { _id: chatObjectId },
        { 
            $set: { 
                chatImageUrl: imageUrl,
                thumbnail: imageUrl
            } 
        }
    );

    if (updateResult.matchedCount === 0) {
        throw new Error('指定されたチャットが見つかりませんでした。');
    }

    return updateResult;
  }

  const GenerateImageSchema = z.object({
    prompt: z.string().min(10, 'プロンプトは最低でも10文字必要です'),
    aspectRatio: z.string().optional().default('9:16'),
    chatId: z.string().regex(/^[0-9a-fA-F]{24}$/, '無効なchatIdです'),
    imageModel: z.string().default('novaAnimeXL_ponyV20_461138'),
    imageVersion: z.enum(['sdxl', 'sd']).default('sdxl')
  });

  fastify.post('/novita/generate-image', async (request, reply) => {
    try {
      // Validate the request body
      const { prompt, aspectRatio, chatId, imageStyle, imageModel, imageVersion } = GenerateImageSchema.parse(request.body);

      // Retrieve user information (Assuming a getUser method exists)
      const user = await fastify.getUser(request, reply);
      const userId = user._id;

      // Select prompts and model based on imageStyle
      const selectedStyle = default_prompt[imageVersion];

      // Combine user prompt with default SFW prompt
      const fullPrompt = selectedStyle.sfw.prompt + prompt;
      const negativePrompt = selectedStyle.sfw.negative_prompt;
      const model_name = imageModel;
      const loras = selectedStyle.sfw.loras;
      const sampler_name = selectedStyle.sfw.sampler_name

      // Create image_request with the selected model and prompts
      const image_request = { 
        ...params, 
        image_num: 4,
        prompt: fullPrompt, 
        negative_prompt: negativePrompt, 
        aspectRatio: aspectRatio,
        model_name: model_name + '.safetensors',
        sampler_name: sampler_name,
        width: selectedStyle.sfw.width || params.width,
        height: selectedStyle.sfw.height || params.height,
        loras: loras,
      };
      console.log(image_request)
      // Send request to Novita and get taskId
      const novitaTaskId = await fetchNovitaMagic(image_request);

      // Store task details in DB
      const db = fastify.mongo.db
      await db.collection('tasks').insertOne({
        taskId: novitaTaskId,
        type: 'sfw',
        status: 'pending',
        prompt: prompt, // Original prompt without default
        negative_prompt: negativePrompt,
        aspectRatio: aspectRatio,
        userId: new ObjectId(userId),
        chatId: new ObjectId(chatId),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Respond with taskId
      reply.send({ taskId: novitaTaskId, message: '画像生成タスクが開始されました。taskIdを使用してステータスを確認してください。' });

    } catch (err) {
      console.log(err);
      reply.status(500).send({ error: '画像生成の開始中にエラーが発生しました。' });
    }
  });
  fastify.get('/novita/chat-thumb-task-status/:taskId', async (request, reply) => {
    const { taskId } = request.params;

    try {
      const db = fastify.mongo.db
      const task = await db.collection('tasks').findOne({ taskId });

      if (!task) {
        return reply.status(404).send({ error: 'タスクが見つかりません。' });
      }

      if (task.status === 'completed') {
        return reply.send({
          taskId: task.taskId,
          status: task.status,
          result: task.result
        });
      }

      if (task.status === 'failed') {
        return reply.send({
          taskId: task.taskId,
          status: task.status,
          error: task.error
        });
      }

      // Task is still pending or in progress, check with Novita
      const result = await fetchNovitaResult(task.taskId);

      if (result === null) {
        // Task is still processing
        return reply.send({
          taskId: task.taskId,
          status: 'processing'
        });
      }

      // Update task in DB
      await db.collection('tasks').updateOne(
        { taskId },
        { 
          $set: { 
            status: 'completed',
            result: { imageUrls: result },
            updatedAt: new Date()
          } 
        }
      );

      return reply.send({
        taskId: task.taskId,
        status: 'completed',
        result: { imageUrls: result }
      });

    } catch (error) {
      console.error('タスクステータス確認エラー:', error);

      // Update task as failed
      const db = fastify.mongo.db
      await db.collection('tasks').updateOne(
        { taskId },
        { 
          $set: { 
            status: 'failed',
            error: error.message,
            updatedAt: new Date()
          } 
        }
      );

      return reply.send({
        taskId: taskId,
        status: 'failed',
        error: error.message
      });
    }
  });
  fastify.post('/novita/save-image', async (request, reply) => {
    const { imageUrl, chatId } = request.body;
  
    if (!imageUrl || !chatId) {
      return reply.status(400).send({ error: 'imageId, imageUrl, and chatId are required' });
    }
  
    try {
      const db = fastify.mongo.db
      await saveChatImageToDB(db, chatId, imageUrl);
  
      return reply.status(200).send({ message: 'Image saved successfully' });
  
    } catch (error) {
      console.error('Error saving image:', error);
      return reply.status(500).send({ error: 'Failed to save image to database' });
    }
  });
  fastify.get('/novita/img2img-task-status/:taskId', async (request, reply) => {
      const { taskId } = request.params;

      try {
          const db = fastify.mongo.db
          const task = await db.collection('tasks').findOne({ taskId });

          if (!task) {
              return reply.status(404).send({ error: 'タスクが見つかりません。' });
          }

          if (task.status === 'completed') {
              return reply.send({
                  taskId: task.taskId,
                  status: task.status,
                  result: task.result
              });
          }

          if (task.status === 'failed') {
              return reply.send({
                  taskId: task.taskId,
                  status: task.status,
                  error: task.error
              });
          }

          // Task is still pending or in progress, check with Novita
          const result = await fetchNovitaResult(task.taskId);

          if (result === null) {
              // Task is still processing
              return reply.send({
                  taskId: task.taskId,
                  status: 'processing'
              });
          }

          // Update task in DB
          await db.collection('tasks').updateOne(
              { taskId },
              { 
                  $set: { 
                      status: 'completed',
                      result: { imageUrls: result },
                      updatedAt: new Date()
                  } 
              }
          );

          return reply.send({
              taskId: task.taskId,
              status: 'completed',
              result: { imageUrls: result }
          });

      } catch (error) {
          console.error('タスクステータス確認エラー:', error);

          // Update task as failed
          const db = fastify.mongo.db
          await db.collection('tasks').updateOne(
              { taskId },
              { 
                  $set: { 
                      status: 'failed',
                      error: error.message,
                      updatedAt: new Date()
                  } 
              }
          );

          return reply.send({
              taskId: taskId,
              status: 'failed',
              error: error.message
          });
      }
    });

  async function fetchNovitaImg2ImgMagic(data) {
      try {
          const response = await axios.post('https://api.novita.ai/v3/async/img2img', {
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
          console.error('Error fetching Novita img2img:', error.message);
          throw error;
      }
  }
    
  fastify.post('/novita/img2img', async (request, reply) => {
    const { image_base64, prompt, aspectRatio, userId, chatId } = request.body;

    // Define the schema for validation
    const Img2ImgSchema = z.object({
        image_base64: z.string().nonempty('Image is required'),
        prompt: z.string().min(10, 'Prompt must be at least 10 characters long'),
        aspectRatio: z.string().optional().default('9:16'),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId'),
        chatId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid chatId'),
    });

    try {
        const validated = Img2ImgSchema.parse(request.body);

        // Prepare the request data for the Novita API
        const novitaRequestData = {
            model_name: default_prompt.sfw.model_name,
            image_base64: validated.image_base64,
            prompt: default_prompt.sfw.prompt + validated.prompt,
            negative_prompt: default_prompt.sfw.negative_prompt,
            width: 768,
            height: 1024,
            sampler_name: "Euler a",
            guidance_scale: 7,
            steps: 30,
            image_num: 4,
            clip_skip: 0,
            seed: -1,
            loras: [],
        };
        
        // Send request to Novita API and get taskId
        const novitaTaskId = await fetchNovitaImg2ImgMagic(novitaRequestData);

        // Store task details in DB
        const db = fastify.mongo.db
        await db.collection('tasks').insertOne({
            taskId: novitaTaskId,
            type: 'img2img',
            status: 'pending',
            prompt: validated.prompt,
            negative_prompt: default_prompt.sfw.negative_prompt,
            aspectRatio: validated.aspectRatio,
            userId: new ObjectId(validated.userId),
            chatId: new ObjectId(validated.chatId),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Respond with taskId
        reply.send({ taskId: novitaTaskId, message: '画像生成タスクが開始されました。taskIdを使用してステータスを確認してください。' });

    } catch (err) {
        console.log(err);
        reply.status(500).send({ error: '画像生成の開始中にエラーが発生しました。' });
    }
  });

}

module.exports = routes;
