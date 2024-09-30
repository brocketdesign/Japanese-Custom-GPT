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
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
      anime: {
        sfw: {
          model_name: "novaAnimeXL_ponyV20_461138.safetensors",
          sampler_name: "Euler a",
          prompt: `score_9, score_8_up, source_anime, masterpiece, best quality, (ultra-detailed), 1girl, (perfect hands:0.1), (sfw), dressed, clothes, `,
          negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, nipple, topless, nsfw, naked, nude, sex, worst quality, low quality,`,
          loras: []
        },
        nsfw: {
          model_name: "novaAnimeXL_ponyV20_461138.safetensors",
          sampler_name: "Euler a",
          prompt: `score_9, score_8_up, source_anime, anime, masterpiece, best quality, (ultra-detailed), 1girl, (nsfw), uncensored, panty, breasts, erect nipples, (sexy pose), naughty face, almost naked, nude, nudity, `,
          negative_prompt: `score_6, score_5, blurry, signature, username, watermark, jpeg artifacts, normal quality, worst quality, low quality, missing fingers, extra digits, fewer digits, bad eye, pussy, vulva, vagina, sex, dick, worst quality, low quality,`,
          loras: []
        }
      },
      realistic: {
        sfw: {
          model_name: "kanpiromix_v20.safetensors",
          sampler_name: "DPM++ 2M Karras",
          prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, 1girl, beautiful japanese, makeup, (sfw), dressed, clothe on, natural lighting, `,
          negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo, nsfw,nude, topless, worst quality, low quality, `,
          loras: [{"model_name":"more_details_59655.safetensors","strength":0.7}, {"model_name":"JapaneseDollLikeness_v15_28382.safetensors","strength":0.7}],
        },
        nsfw: {
          model_name: "kanpiromix_v20.safetensors",
          sampler_name: "DPM++ 2M Karras",
          prompt: `best quality, ultra high res, (photorealistic:1.4), masterpiece, 1girl, beautiful japanese, makeup, (nsfw), nude, sensual pose, intimate, `,
          negative_prompt: `BraV4Neg,paintings,sketches,(worst quality:2), (low quality:2), (normal quality:2), lowres, normal quality, ((monochrome)), ((grayscale)),logo`,
          loras: [{"model_name":"more_details_59655.safetensors","strength":0.7}, {"model_name":"JapaneseDollLikeness_v15_28382.safetensors","strength":0.7}],
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

    // Endpoint to initiate txt2img with SFW and NSFW
    fastify.post('/novita/txt2img', async (request, reply) => {
      const { prompt, aspectRatio, userId, chatId, userChatId } = request.body;
  
      // Define the schema for validation
      const Txt2ImgSchema = z.object({
        prompt: z.string().min(10, 'Prompt must be at least 10 characters long'),
        aspectRatio: z.string().optional().default('9:16'),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId'),
        chatId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid chatId'),
        userChatId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userChatId')
      });
  
      try {
        const validated = Txt2ImgSchema.parse(request.body);
        const { prompt, aspectRatio, userId, chatId, userChatId } = validated;
  
        // Fetch user subscription status
        const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        const isSubscribed = user && user.subscriptionStatus === 'active';
  
        // Fetch imageStyle
        const chat = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
        const imageStyle = chat.imageStyle

        // Select prompts and model based on imageStyle
        const selectedStyle = default_prompt[imageStyle];

        // Prepare tasks
        const tasks = [];

        // SFW Task
        const image_request_sfw = {
          type: 'sfw',
          model_name: selectedStyle.sfw.model_name,
          sampler_name: selectedStyle.sfw.sampler_name || '',
          loras: selectedStyle.sfw.loras,
          prompt: selectedStyle.sfw.prompt + prompt,
          negative_prompt: selectedStyle.sfw.negative_prompt
        };
        tasks.push({ ...params, ...image_request_sfw });

        // NSFW Task
        const image_request_nsfw = {
          type: 'nsfw',
          model_name: selectedStyle.nsfw.model_name,
          sampler_name: selectedStyle.nsfw.sampler_name || '',
          loras: selectedStyle.nsfw.loras,
          prompt: selectedStyle.nsfw.prompt + prompt,
          negative_prompt: selectedStyle.nsfw.negative_prompt,
          blur: !isSubscribed
        };

        tasks.push({ ...params, ...image_request_nsfw });
  
        // Initiate tasks and collect taskIds
        const taskIds = await Promise.all(tasks.map(async (task) => {
          console.log(`Request ${task.type} image`)
          console.log(`Should be blurry : ${task.blur}`)
          // Send request to Novita and get taskId
          const novitaTaskId = await fetchNovitaMagic(task);
  
          // Store task details in DB
          await db.collection('tasks').insertOne({
            taskId: novitaTaskId,
            type: task.type,
            status: 'pending',
            prompt: prompt, // Original prompt without default
            negative_prompt: task.negative_prompt,
            aspectRatio: aspectRatio,
            userId: new ObjectId(userId),
            chatId: new ObjectId(chatId),
            userChatId: new ObjectId(userChatId),
            blur: task.blur || false,
            createdAt: new Date(),
            updatedAt: new Date()
          });
  
          return { taskId: novitaTaskId, type: task.type };
        }));
  
        // Respond with taskIds
        reply.send({ tasks: taskIds, message: 'Image generation tasks started. Use the taskIds to check status.' });
  
      } catch (err) {
        console.error(err);
        reply.status(500).send({ error: 'Error initiating image generation.' });
      }
    });
      /**
   * Endpoint to check the status of a task
   */
      fastify.get('/novita/task-status/:taskId', async (request, reply) => {
        const { taskId } = request.params;
        try {
          const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
          const tasksCollection = db.collection('tasks');
          const task = await tasksCollection.findOne({ taskId });
      
          if (!task) return reply.status(404).send({ error: 'Task not found.' });
      
          if (['completed', 'failed'].includes(task.status)) {
            return reply.send({
              taskId: task.taskId,
              status: task.status,
              ...(task.status === 'completed' ? { result: task.result } : { error: task.error })
            });
          }
      
          const result = await fetchNovitaResult(task.taskId);
          if (!result) return reply.send({ taskId: task.taskId, status: 'processing' });
      
          const shouldBlur = task.type === 'nsfw' && task.blur;
          let imageUrl = result.imageUrl;
          let blurryImageUrl
          if (shouldBlur) {
            try {
              blurryImageUrl = await createBlurredImage(result.imageUrl, db);
            } catch (blurError) {
              await tasksCollection.updateOne(
                { taskId: task.taskId },
                { $set: { status: 'failed', error: `Blurring failed: ${blurError.message}`, updatedAt: new Date() } }
              );
              return reply.status(500).send({ taskId: task.taskId, status: 'failed', error: `Blurring failed: ${blurError.message}` });
            }
          }
      
          // Attempt to atomically update the task to completed
          const updateResult = await tasksCollection.findOneAndUpdate(
            { taskId: task.taskId, status: { $in: ['pending', 'processing'] } },
            { $set: { status: 'completed', result: { imageId: result.imageId, imageUrl }, updatedAt: new Date() } },
            { returnOriginal: false }
          );
      
          // If the task was already completed, don't skip saving the image, just retrieve and continue
          let taskToSave = updateResult.value || (await tasksCollection.findOne({ taskId }));

          // Save the images to the DB, ensuring this step always occurs
          const saveResult = await saveImageToDB(
            taskToSave.userId,
            taskToSave.chatId,
            taskToSave.userChatId,
            taskToSave.prompt,
            result.imageUrl,
            taskToSave.aspectRatio,
            blurryImageUrl,
            task.type == 'nsfw'
          );
          // Send the correct response with the saved image data
          return reply.send({
            taskId: taskToSave.taskId,
            status: 'completed',
            result: {
              imageId: saveResult.imageId,
              imageUrl: shouldBlur ? blurryImageUrl : imageUrl
            }
          });
      
        } catch (error) {
          try {
            const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
            await db.collection('tasks').updateOne(
              { taskId },
              { $set: { status: 'failed', error: error.message, updatedAt: new Date() } }
            );
          } catch (updateError) {
            console.error(`Failed to update task status to 'failed': ${updateError.message}`);
          }
      
          return reply.send({ taskId, status: 'failed', error: error.message });
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
    imageStyle: z.enum(['anime', 'realistic']).default('anime')
  });

  fastify.post('/novita/generate-image', async (request, reply) => {
    try {
      // Validate the request body
      const { prompt, aspectRatio, chatId, imageStyle } = GenerateImageSchema.parse(request.body);

      // Retrieve user information (Assuming a getUser method exists)
      const user = await fastify.getUser(request, reply);
      const userId = user._id;

      // Select prompts and model based on imageStyle
      const selectedStyle = default_prompt[imageStyle];

      // Combine user prompt with default SFW prompt
      const fullPrompt = selectedStyle.sfw.prompt + prompt;
      const negativePrompt = selectedStyle.sfw.negative_prompt;
      const model_name = selectedStyle.sfw.model_name;
      const loras = selectedStyle.sfw.loras;
      const sampler_name = selectedStyle.sfw.sampler_name

      // Create image_request with the selected model and prompts
      const image_request = { 
        ...params, 
        image_num: 4,
        prompt: fullPrompt, 
        negative_prompt: negativePrompt, 
        aspectRatio: aspectRatio,
        model_name: model_name,
        sampler_name: sampler_name,
        loras: loras,
      };

      // Send request to Novita and get taskId
      const novitaTaskId = await fetchNovitaMagic(image_request);

      // Store task details in DB
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
      const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
          const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
          const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
        const db = fastify.mongo.client.db(process.env.MONGODB_NAME);
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
