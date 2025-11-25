const { ObjectId } = require('mongodb');
const axios = require('axios');
const sharp = require('sharp');
const mergeInProgressLocks = new Map(); // In-memory lock tracking

/**
 * Create a unique key for a merge operation
 * @param {string} faceImageBase64 - Face image
 * @param {string} originalImageBase64 - Original image
 * @returns {string} Unique merge key
 */
function getMergeKey(faceImageBase64, originalImageBase64) {
  const crypto = require('crypto');
  const combined = faceImageBase64 + originalImageBase64;
  return crypto.createHash('md5').update(combined).digest('hex');
}

/**
 * Merge face using Novita AI with deduplication lock
 * @param {Object} params - Parameters for face merging
 * @param {string} params.faceImageBase64 - Base64 encoded face image
 * @param {string} params.originalImageBase64 - Base64 encoded original image
 * @returns {Object} Result from Novita API
 */
async function mergeFaceWithNovita({ faceImageBase64, originalImageBase64 }) {
  const novitaApiKey = process.env.NOVITA_API_KEY;
  const apiUrl = 'https://api.novita.ai/v3/merge-face';

  // Validate inputs
  if (!faceImageBase64 || !originalImageBase64) {
    throw new Error('Both face image and original image are required');
  }

  if (!novitaApiKey) {
    throw new Error('Novita API key is not configured');
  }

  // ⭐ CREATE UNIQUE KEY FOR THIS MERGE OPERATION
  const mergeKey = getMergeKey(faceImageBase64, originalImageBase64);
  const callId = mergeKey; // Use mergeKey as timespan ID

  // Section header
  console.log(`🧬 [MERGE] ════════════════════════════════════════════`);
  console.log(`🧬 [MERGE] ▶️  FACE MERGE STARTED | Call ID: ${callId}`);

  // ⭐ CHECK IF ALREADY MERGING
  if (mergeInProgressLocks.has(mergeKey)) {
    console.log(`🧬 [MERGE] ⏳ Merge already in progress, waiting... | Call ID: ${callId}`);
    // Wait for the existing merge to complete
    const existingPromise = mergeInProgressLocks.get(mergeKey);
    try {
      const result = await existingPromise;
      console.log(`🧬 [MERGE] ✅ Returning cached result | Call ID: ${callId}`);
      return result;
    } catch (error) {
      console.error(`🧬 [MERGE] ❌ Cached merge failed, retrying... | Call ID: ${callId}`);
      // Fall through to retry
    }
  }

  // ⭐ CREATE MERGE PROMISE
  const mergePromise = (async () => {
    try {
      const cleanFaceImage = faceImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const cleanOriginalImage = originalImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

      // Validate base64 format
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      if (!base64Regex.test(cleanFaceImage) || !base64Regex.test(cleanOriginalImage)) {
        throw new Error('Invalid base64 image format');
      }

      // Check image sizes
      const faceImageSize = Buffer.from(cleanFaceImage, 'base64').length;
      const originalImageSize = Buffer.from(cleanOriginalImage, 'base64').length;
      const maxSize = 4 * 1024 * 1024;
      if (faceImageSize > maxSize || originalImageSize > maxSize) {
        throw new Error(`Image too large. Face: ${Math.round(faceImageSize / 1024)}KB, Original: ${Math.round(originalImageSize / 1024)}KB. Max: 4MB per image.`);
      }

      console.log(`🧬 [MERGE] 🚀 Calling Novita API | Call ID: ${callId}`);

      const requestData = {
        face_image_file: cleanFaceImage,
        image_file: cleanOriginalImage,
        extra: {
          response_image_type: "jpeg"
        }
      };

      const response = await axios.post(apiUrl, requestData, {
        headers: {
          'Authorization': `Bearer ${novitaApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      });

      if (response.data && response.data.image_file) {
        const result = {
          success: true,
          imageBase64: response.data.image_file,
          imageType: response.data.image_type || 'jpeg',
          message: 'Face merge completed successfully'
        };

        console.log(`🧬 [MERGE] 🎉 Merge completed successfully | Call ID: ${callId}`);
        return result;
      } else {
        console.error(`🧬 [MERGE] ❌ Invalid API response | Call ID: ${callId}`);
        throw new Error('Invalid response from Novita API - no image returned');
      }
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        switch (status) {
          case 400:
            console.error(`🧬 [MERGE] ❌ Invalid request: ${errorData?.message || 'Bad request to Novita API'} | Call ID: ${callId}`);
            throw new Error(`Invalid request: ${errorData?.message || 'Bad request to Novita API'}`);
          case 401:
            console.error(`🧬 [MERGE] ❌ Invalid API key | Call ID: ${callId}`);
            throw new Error('Invalid API key for Novita service');
          case 403:
            console.error(`🧬 [MERGE] ❌ Access forbidden | Call ID: ${callId}`);
            throw new Error('Access forbidden - check API key permissions');
          case 429:
            console.error(`🧬 [MERGE] ❌ Rate limit exceeded | Call ID: ${callId}`);
            throw new Error('Rate limit exceeded - please try again later');
          case 500:
            if (errorData?.message?.includes('resource not available')) {
              console.error(`🧬 [MERGE] ❌ Novita service temporarily unavailable | Call ID: ${callId}`);
              throw new Error('Novita face merge service is temporarily unavailable. Please try again later.');
            }
            console.error(`🧬 [MERGE] ❌ Novita service error: ${errorData?.message || 'Internal server error'} | Call ID: ${callId}`);
            throw new Error(`Novita service error: ${errorData?.message || 'Internal server error'}`);
          case 503:
            console.error(`🧬 [MERGE] ❌ Novita service unavailable | Call ID: ${callId}`);
            throw new Error('Novita service is temporarily unavailable');
          default:
            console.error(`🧬 [MERGE] ❌ Novita API error (${status}): ${errorData?.message || 'Unknown error'} | Call ID: ${callId}`);
            throw new Error(`Novita API error (${status}): ${errorData?.message || 'Unknown error'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.error(`🧬 [MERGE] ❌ Request timeout | Call ID: ${callId}`);
        throw new Error('Request timeout - the face merge operation took too long');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error(`🧬 [MERGE] ❌ Cannot connect to Novita API | Call ID: ${callId}`);
        throw new Error('Cannot connect to Novita API service');
      } else {
        console.error(`🧬 [MERGE] ❌ Network error: ${error.message} | Call ID: ${callId}`);
        throw new Error(`Network error: ${error.message}`);
      }
    } finally {
      // ⭐ REMOVE LOCK AFTER COMPLETION (success or failure)
      console.log(`🧬 [MERGE] 🔓 Removing lock | Call ID: ${callId}`);
      mergeInProgressLocks.delete(mergeKey);
      console.log(`🧬 [MERGE] ════════════════════════════════════════════`);
    }
  })();

  // ⭐ STORE LOCK
  mergeInProgressLocks.set(mergeKey, mergePromise);

  return mergePromise;
}

/**
 * Optimize and convert image to JPEG with size limit
 * @param {Buffer} imageBuffer - Input image buffer
 * @param {number} maxSizeKB - Maximum size in KB (default 1MB)
 * @returns {Object} Optimized image data
 */
async function optimizeImageForMerge(imageBuffer, maxSizeKB = 1024) {
  try {
    let quality = 90;
    let optimizedBuffer;
    let sizeKB;

    // Convert to JPEG and optimize
    do {
      optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ quality, progressive: true })
        .resize(1024, 1024, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .toBuffer();
      
      sizeKB = optimizedBuffer.length / 1024;
      
      if (sizeKB > maxSizeKB) {
        quality -= 10;
      }
    } while (sizeKB > maxSizeKB && quality > 20);

    const base64Image = `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
    
    return {
      success: true,
      base64Image,
      sizeKB: Math.round(sizeKB),
      quality
    };
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw new Error('Failed to optimize image');
  }
}

/**
 * Save user face for future use
 * @param {Object} params - Face data parameters
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Saved face data
 */
async function saveUserFace({
  userId,
  faceImageUrl,
  originalFilename,
  fastify
}) {
  const db = fastify.mongo.db;
  const userFacesCollection = db.collection('userFaces');

  const faceData = {
    userId: new ObjectId(userId),
    faceImageUrl, // Only store S3 URL
    originalFilename,
    createdAt: new Date()
  };

  const result = await userFacesCollection.insertOne(faceData);
  console.log(`[saveUserFace] Face saved with ID: ${result.insertedId}`);

  return { ...faceData, _id: result.insertedId };
}

/**
 * Get face image as base64 for API calls
 * @param {string} faceImageUrl - S3 URL of face image
 * @returns {string} Base64 encoded image
 */
async function getFaceImageAsBase64(faceImageUrl) {
  try {
    const response = await axios.get(faceImageUrl, { 
      responseType: 'arraybuffer' 
    });
    const imageBuffer = Buffer.from(response.data);
    
    // Optimize for API calls
    const optimizedResult = await optimizeImageForMerge(imageBuffer);
    return optimizedResult.base64Image;
  } catch (error) {
    console.error('Error converting face image to base64:', error);
    throw new Error('Failed to process face image');
  }
}

/**
 * Save merged face result to database
 * @param {Object} params - Merge result parameters
 * @param {Object} fastify - Fastify instance
 * @returns {Object} Saved merge data
 */

async function saveMergedFaceToDB({
  originalImageId,
  mergedImageUrl,
  userId,
  chatId,
  userChatId,
  fastify
}) {
  const callId = require('crypto').randomUUID();

  try {
    const db = fastify.mongo.db;
    const mergedFacesCollection = db.collection('mergedFaces');
    
    const mergeData = {
      originalImageId: new ObjectId(originalImageId),
      userId: new ObjectId(userId),
      chatId: new ObjectId(chatId),
      userChatId: userChatId ? new ObjectId(userChatId) : null,
      mergedImageUrl, // Only store S3 URL
      createdAt: new Date()
    };

    const result = await mergedFacesCollection.insertOne(mergeData);

    return { ...mergeData, _id: result.insertedId };
  } catch (error) {
    console.error(`[saveMergedFaceToDB] Call ID: ${callId} - Error: ${error.message}`);
    throw error;
  }
}
/**
 * Add merge face message to chat
 * @param {string} userChatId - User chat ID
 * @param {string} mergeId - Merge ID
 * @param {string} mergedImageUrl - S3 URL of merged image
 * @param {Object} fastify - Fastify instance
 */
async function addMergeFaceMessageToChat(userChatId, mergeId, mergedImageUrl, fastify) {
  return
  const callId = require('crypto').randomUUID();
  console.log(`[addMergeFaceMessageToChat] Call ID: ${callId} - Starting add message`);

  try {
    const db = fastify.mongo.db;
    const collectionUserChat = db.collection('userChat');
    
    const userChatDoc = await collectionUserChat.findOne({ 
      _id: new ObjectId(userChatId) 
    });
    
    if (!userChatDoc) {
      console.error(`[addMergeFaceMessageToChat] Call ID: ${callId} - UserChat not found: ${userChatId}`);
      return;
    }

    // Create assistant message for the merged face with unique timestamp
    const assistantMessage = {
      role: 'assistant',
      content: `[MergeFace] ${mergeId}`,
      timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
      isMerged: true, // Use isMerged instead of isMergeFace for consistency
      mergeId: mergeId,
      imageUrl: mergedImageUrl,
      hidden: true,
      type: 'mergeFace',
    };

    // Add the message to the chat using $push for atomicity
    const updateResult = await collectionUserChat.updateOne(
      { _id: new ObjectId(userChatId) },
      { 
        $push: { messages: assistantMessage },
        $set: { updatedAt: new Date() }
      }
    );
    
    console.log(`[addMergeFaceMessageToChat] Call ID: ${callId} - Message added successfully`);
  } catch (error) {
    console.error(`[addMergeFaceMessageToChat] Call ID: ${callId} - Error: ${error.message}`);
  }
}

/**
 * Save merged image to S3 and get URL
 * @param {string} base64Image - Base64 encoded image
 * @param {string} mergeId - Merge ID for filename
 * @param {Object} fastify - Fastify instance
 * @returns {string} S3 URL of uploaded image
 */
async function saveMergedImageToS3(base64Image, mergeId, fastify) {
  try {
    const { uploadToS3 } = require('./tool');
    const { createHash } = require('crypto');
    
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Generate hash for the buffer
    const hash = createHash('sha256').update(imageBuffer).digest('hex');
    
    // Upload to S3 using the tool.js function
    const imageUrl = await uploadToS3(imageBuffer, hash, `merged-face-${mergeId}.jpg`);
    console.log(`[saveMergedImageToS3] ${new Date().toISOString()} Image uploaded to S3: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('[saveMergedImageToS3] Error uploading to S3:', error);
    throw new Error('Failed to save merged image to S3');
  }
}

/**
 * Update image message with merge face action
 * @param {string} userChatId - User chat ID
 * @param {Object} userChatMessages - User chat messages object
 * @param {string} imageId - Image ID that was merged
 * @param {string} mergeId - Generated merge ID
 * @param {Object} fastify - Fastify instance
 */
const findImageMessageAndUpdateWithMergeAction = async (userChatId, userChatMessages, imageId, mergeId, fastify) => {
  const callId = require('crypto').randomUUID();
  console.log(`[findImageMessageAndUpdateWithMergeAction] Call ID: ${callId} - Starting update for imageId: ${imageId}, mergeId: ${mergeId}`);
  
  if (!userChatMessages || !userChatMessages.messages) {
    console.log(`[findImageMessageAndUpdateWithMergeAction] Call ID: ${callId} - No messages found`);
    return;
  }
  
  const messageIndex = userChatMessages.messages.findIndex(msg => {
    const content = msg.content || '';
    const isMatch = (msg.type == "image" && msg.imageId == imageId) || content.startsWith('[Image] ' + imageId.toString()) || content.startsWith('[image] ' + imageId.toString());
    return isMatch;
  });
  
  if (messageIndex !== -1) {
    const message = userChatMessages.messages[messageIndex];
    
    // Initialize actions array if it doesn't exist
    if (!message.actions) {
      message.actions = [];
    }
    
    // Check if merge_face action already exists
    let mergeAction = message.actions.find(action => action.type === 'merge_face');
    if (!mergeAction) {
      // Create new merge_face action
      mergeAction = {
        type: 'merge_face',
        mergeIds: [],
        date: new Date()
      };
      message.actions.push(mergeAction);
    }
    
    // Add merge ID if not already present
    if (!mergeAction.mergeIds.includes(mergeId.toString())) {
      mergeAction.mergeIds.push(mergeId.toString());
      mergeAction.date = new Date(); // Update date
      
      // Update the userChatMessages in the database
      const collectionUserChat = fastify.mongo.db.collection('userChat');
      await collectionUserChat.updateOne(
        { _id: new fastify.mongo.ObjectId(userChatId) },
        { $set: { messages: userChatMessages.messages } }
      );
      
      console.log(`[findImageMessageAndUpdateWithMergeAction] Call ID: ${callId} - Updated successfully`);
    } else {
      console.log(`[findImageMessageAndUpdateWithMergeAction] Call ID: ${callId} - Merge action already exists`);
    }
  } else {
    console.log(`[findImageMessageAndUpdateWithMergeAction] Call ID: ${callId} - No matching message found`);
  }
};

/**
 * Get user's previously uploaded faces
 * @param {string} userId - User ID
 * @param {Object} fastify - Fastify instance
 * @returns {Array} Array of user faces
 */
async function getUserFaces(userId, fastify) {
  const db = fastify.mongo.db;
  const userFacesCollection = db.collection('userFaces');

  const faces = await userFacesCollection.find({
    userId: new ObjectId(userId)
  }).sort({ createdAt: -1 }).limit(10).toArray();

  return faces;
}

module.exports = {
  mergeFaceWithNovita,
  optimizeImageForMerge,
  saveMergedFaceToDB,
  findImageMessageAndUpdateWithMergeAction,
  saveUserFace,
  getUserFaces,
  addMergeFaceMessageToChat,
  saveMergedImageToS3,
  getFaceImageAsBase64
};
