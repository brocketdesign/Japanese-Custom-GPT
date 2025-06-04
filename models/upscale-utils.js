const { ObjectId } = require('mongodb');
const axios = require('axios');
const { createHash } = require('crypto');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// Configure AWS S3
const s3 = new S3Client({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const uploadToS3 = async (buffer, hash, filename) => {
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `upscaled_${hash}_${filename}`,
        Body: buffer,
        ACL: 'public-read',
    };
    
    const command = new PutObjectCommand(params);
    await s3.send(command);
    return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
};

async function upscaleImg({
    userId,
    chatId,
    userChatId,
    originalImageId,
    image_base64,
    originalImageUrl,
    placeholderId,
    scale_factor = 2,
    model_name = 'RealESRGAN_x4plus_anime_6B',
    fastify
}) {
    try {
        // Call Novita upscale API
        const taskId = await fetchNovitaUpscale({
            image_base64,
            scale_factor,
            model_name
        });

        if (!taskId) {
            throw new Error('Failed to get task ID from Novita');
        }

        // Store upscale task in database
        const db = fastify.mongo.db;
        const taskData = {
            taskId,
            type: 'upscale',
            status: 'pending',
            userId: new ObjectId(userId),
            chatId: new ObjectId(chatId),
            userChatId: userChatId ? new ObjectId(userChatId) : null,
            originalImageId,
            originalImageUrl,
            placeholderId,
            scale_factor,
            model_name,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection('upscale_tasks').insertOne(taskData);

        // Start polling for completion
        pollUpscaleTask(taskId, fastify);

        return { taskId, status: 'initiated' };

    } catch (error) {
        console.error('Error in upscaleImg:', error);
        throw error;
    }
}

async function fetchNovitaUpscale({ image_base64, scale_factor, model_name }) {
    try {
        const response = await axios.post('https://api.novita.ai/v3/async/upscale', {
            extra: {
                response_image_type: 'jpeg'
            },
            request: {
                model_name,
                image_base64,
                scale_factor
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Novita API error: ${response.statusText}`);
        }

        return response.data.task_id;
    } catch (error) {
        console.error('Error calling Novita upscale API:', error);
        throw error;
    }
}

async function fetchNovitaUpscaleResult(task_id) {
    try {
        const response = await axios.get(`https://api.novita.ai/v3/async/task-result?task_id=${task_id}`, {
            headers: {
                'Authorization': `Bearer ${process.env.NOVITA_API_KEY}`
            }
        });

        if (response.status !== 200) {
            throw new Error(`Non-200 response: ${response.statusText}`);
        }

        const taskStatus = response.data.task.status;
        const progressPercent = response.data.task.progress_percent;

        if (taskStatus === 'TASK_STATUS_SUCCEED') {
            const images = response.data.images;
            if (images.length === 0) {
                throw new Error('No images returned from Novita upscale API');
            }

            // Download and upload to S3
            const image = images[0];
            const imageResponse = await axios.get(image.image_url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(imageResponse.data, 'binary');
            const hash = createHash('md5').update(buffer).digest('hex');
            const uploadedUrl = await uploadToS3(buffer, hash, 'upscaled_image.jpg');

            return {
                status: 'completed',
                imageUrl: uploadedUrl,
                original_url: image.image_url
            };
        } else if (taskStatus === 'TASK_STATUS_FAILED') {
            return {
                status: 'failed',
                error: response.data.task.reason || 'Unknown error'
            };
        } else {
            return {
                status: 'processing',
                progress: progressPercent
            };
        }
    } catch (error) {
        console.error('Error fetching upscale result:', error);
        return {
            status: 'failed',
            error: error.message
        };
    }
}

async function pollUpscaleTask(taskId, fastify) {
    const db = fastify.mongo.db;
    const maxAttempts = 40; // 2 minutes with 3-second intervals
    let attempts = 0;

    const pollInterval = setInterval(async () => {
        try {
            attempts++;
            
            const result = await fetchNovitaUpscaleResult(taskId);
            
            if (result.status === 'completed') {
                clearInterval(pollInterval);
    
                // Check if already processed to prevent duplicate notifications
                const existingTask = await db.collection('upscale_tasks').findOne({ 
                    taskId, 
                    status: 'completed' 
                });
                
                if (existingTask) {
                    console.log(`Task ${taskId} already completed, skipping duplicate processing`);
                    return;
                }
                
                // Update task status
                await db.collection('upscale_tasks').updateOne(
                    { taskId },
                    { 
                        $set: { 
                            status: 'completed', 
                            result: result,
                            updatedAt: new Date() 
                        } 
                    }
                );

                // Get task details
                const task = await db.collection('upscale_tasks').findOne({ taskId });
                
                // Save upscaled image and notify user
                const savedImage = await saveUpscaledImage({
                    taskId,
                    userId: task.userId,
                    chatId: task.chatId,
                    userChatId: task.userChatId,
                    originalImageId: task.originalImageId,
                    imageUrl: result.imageUrl,
                    placeholderId: task.placeholderId,
                    scale_factor: task.scale_factor,
                    fastify
                });

                // Send notification to user
                fastify.sendNotificationToUser(task.userId.toString(), 'handleLoader', { 
                    imageId: task.placeholderId, 
                    action: 'remove' 
                });
                
                fastify.sendNotificationToUser(task.userId.toString(), 'imageGenerated', {
                    imageUrl: result.imageUrl,
                    imageId: savedImage.imageId,
                    userChatId: task.userChatId,
                    title: { en: 'Upscaled Image', ja: 'アップスケール画像' },
                    prompt: `Upscaled version (${task.scale_factor}x)`,
                    isUpscaled: true,
                    nsfw: false
                });

            } else if (result.status === 'failed') {
                clearInterval(pollInterval);
                
                await db.collection('upscale_tasks').updateOne(
                    { taskId },
                    { 
                        $set: { 
                            status: 'failed', 
                            error: result.error,
                            updatedAt: new Date() 
                        } 
                    }
                );

                const task = await db.collection('upscale_tasks').findOne({ taskId });
                fastify.sendNotificationToUser(task.userId.toString(), 'handleLoader', { 
                    imageId: task.placeholderId, 
                    action: 'remove' 
                });
                fastify.sendNotificationToUser(task.userId.toString(), 'showNotification', {
                    message: 'Failed to upscale image',
                    icon: 'error'
                });

            } else if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                
                await db.collection('upscale_tasks').updateOne(
                    { taskId },
                    { 
                        $set: { 
                            status: 'timeout',
                            updatedAt: new Date() 
                        } 
                    }
                );
            }
            
        } catch (error) {
            console.error(`Error polling upscale task ${taskId}:`, error);
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
            }
        }
    }, 3000);
}

/**
 * Find and update image message with upscale action
 * @param {string} userChatId - User chat ID
 * @param {Object} userChatMessages - User chat messages object
 * @param {string} originalImageId - Original image ID that was upscaled
 * @param {string} upscaledImageId - Generated upscaled image ID
 * @param {number} scale_factor - Scale factor used for upscaling
 * @param {Object} fastify - Fastify instance
 */
const findImageMessageAndUpdateWithUpscaleAction = async (userChatId, userChatMessages, originalImageId, upscaledImageId, scale_factor, fastify) => {
  if (!userChatMessages || !userChatMessages.messages) return;
  
  const messageIndex = userChatMessages.messages.findIndex(msg => {
    const content = msg.content || '';
    return (msg.type == "image" && msg.imageId == originalImageId) || content.startsWith('[Image] ' + originalImageId.toString()) || content.startsWith('[image] ' + originalImageId.toString());
  });
  
  if (messageIndex !== -1) {
    const message = userChatMessages.messages[messageIndex];
    // Add upscale action to the image message
    userChatMessages.messages[messageIndex].action = { 
      type: 'upscaled',
      upscaledImageId: upscaledImageId,
      scale_factor: scale_factor,
      date: new Date() 
    };
    
    // Update the userChatMessages in the database
    const collectionUserChat = fastify.mongo.db.collection('userChat');
    await collectionUserChat.updateOne(
      { _id: new fastify.mongo.ObjectId(userChatId) },
      { $set: { messages: userChatMessages.messages } }
    );
    console.log(`User chat messages updated with upscale action for originalImageId: ${originalImageId}, upscaledImageId: ${upscaledImageId}, scale: ${scale_factor}x`);
  }
};

async function saveUpscaledImage({
    taskId,
    userId,
    chatId,
    userChatId,
    originalImageId,
    imageUrl,
    placeholderId,
    scale_factor,
    fastify
}) {
    const db = fastify.mongo.db;
    
    try {
        const imageId = new ObjectId();
        const galleryCollection = db.collection('gallery');
        
        await galleryCollection.updateOne(
            { 
                userId: userId,
                chatId: chatId,
            },
            { 
                $push: { 
                    images: { 
                        _id: imageId,
                        taskId,
                        prompt: `Upscaled version (${scale_factor}x)`,
                        title: {
                            en: 'Upscaled Image',
                            ja: 'アップスケール画像'
                        },
                        slug: `upscaled-${originalImageId}-${scale_factor}x-${Date.now()}`,
                        imageUrl,
                        blurredImageUrl: null,
                        aspectRatio: '1:1',
                        seed: null,
                        isBlurred: false,
                        nsfw: false,
                        isUpscaled: true,
                        originalImageId,
                        scale_factor,
                        createdAt: new Date()
                    } 
                },
            },
            { upsert: true }
        );

        // Update chat image count
        await db.collection('chats').updateOne(
            { _id: chatId },
            { $inc: { imageCount: 1 } }
        );

        // Update user image count
        await db.collection('users').updateOne(
            { _id: userId },
            { $inc: { imageCount: 1 } }
        );

        // Add to user chat messages if userChatId exists
        if (userChatId && ObjectId.isValid(userChatId)) {
            const imageMessage = { role: "assistant", content: `[Image] ${imageId}` };
            await db.collection('userChat').updateOne(
                { 
                    userId: userId, 
                    _id: userChatId 
                },
                { 
                    $push: { messages: imageMessage }, 
                    $set: { updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) } 
                }
            );
        }

        // Update the original image message with upscale action
        if (userChatId && ObjectId.isValid(userChatId)) {
            const userDataCollection = db.collection('userChat');
            const userChatMessages = await userDataCollection.findOne({ _id: new ObjectId(userChatId) });
            await findImageMessageAndUpdateWithUpscaleAction(userChatId, userChatMessages, originalImageId, imageId, scale_factor, fastify);
        }

        return { imageId, imageUrl };
        
    } catch (error) {
        console.error('Error saving upscaled image:', error);
        throw error;
    }
}

module.exports = {
    upscaleImg,
    pollUpscaleTask,
    saveUpscaledImage
};
