const { ObjectId } = require('mongodb');
const axios = require('axios');
const sharp = require('sharp');

/**
 * Merge face using Novita AI
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

  // Remove data URL prefix if present for face image
  const cleanFaceImage = faceImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
  const cleanOriginalImage = originalImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(cleanFaceImage) || !base64Regex.test(cleanOriginalImage)) {
    throw new Error('Invalid base64 image format');
  }

  // Check image sizes (Novita has limits)
  const faceImageSize = Buffer.from(cleanFaceImage, 'base64').length;
  const originalImageSize = Buffer.from(cleanOriginalImage, 'base64').length;
  
  // Novita typically has a 4MB limit per image
  const maxSize = 4 * 1024 * 1024; // 4MB
  if (faceImageSize > maxSize || originalImageSize > maxSize) {
    throw new Error(`Image too large. Face: ${Math.round(faceImageSize / 1024)}KB, Original: ${Math.round(originalImageSize / 1024)}KB. Max: 4MB per image.`);
  }

  const requestData = {
    face_image_file: cleanFaceImage, // Send clean base64 without data URL prefix
    image_file: cleanOriginalImage,  // Send clean base64 without data URL prefix
    extra: {
      response_image_type: "jpeg"
    }
  };

  try {
    const response = await axios.post(apiUrl, requestData, {
      headers: {
        'Authorization': `Bearer ${novitaApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 120 second timeout
    });

    if (response.data && response.data.image_file) {
      return {
        success: true,
        imageBase64: response.data.image_file,
        imageType: response.data.image_type || 'jpeg',
        message: 'Face merge completed successfully'
      };
    } else {
      console.error('Invalid response from Novita API:', response.data);
      throw new Error('Invalid response from Novita API - no image returned');
    }
  } catch (error) {
    console.error('Error calling Novita merge-face API:', error.response?.data || error.message);
    
    // Provide more specific error messages based on response
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      switch (status) {
        case 400:
          throw new Error(`Invalid request: ${errorData?.message || 'Bad request to Novita API'}`);
        case 401:
          throw new Error('Invalid API key for Novita service');
        case 403:
          throw new Error('Access forbidden - check API key permissions');
        case 429:
          throw new Error('Rate limit exceeded - please try again later');
        case 500:
          if (errorData?.message?.includes('resource not available')) {
            throw new Error('Novita face merge service is temporarily unavailable. Please try again later.');
          }
          throw new Error(`Novita service error: ${errorData?.message || 'Internal server error'}`);
        case 503:
          throw new Error('Novita service is temporarily unavailable');
        default:
          throw new Error(`Novita API error (${status}): ${errorData?.message || 'Unknown error'}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout - the face merge operation took too long');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Novita API service');
    } else {
      throw new Error(`Network error: ${error.message}`);
    }
  }
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
  console.log(`[saveMergedFaceToDB] Merge saved with ID: ${result.insertedId}`);

  return { ...mergeData, _id: result.insertedId };
}
/**
 * Add merge face message to chat
 * @param {string} userChatId - User chat ID
 * @param {string} mergeId - Merge ID
 * @param {string} mergedImageUrl - S3 URL of merged image
 * @param {Object} fastify - Fastify instance
 */
async function addMergeFaceMessageToChat(userChatId, mergeId, mergedImageUrl, fastify) {
  try {
    const db = fastify.mongo.db;
    const collectionUserChat = db.collection('userChat');
    
    // [DEBUG addMergeFaceMessageToChat] Log input parameters
    console.log(`[DEBUG addMergeFaceMessageToChat] CALLED with parameters:`, {
      userChatId,
      mergeId,
      mergedImageUrl: mergedImageUrl?.includes('merged-face') ? 'MERGED_URL' : 'ORIGINAL_URL',
      actualUrl: mergedImageUrl
    });
    
    const userChatDoc = await collectionUserChat.findOne({ 
      _id: new ObjectId(userChatId) 
    });
    
    if (!userChatDoc) {
      console.error(`[addMergeFaceMessageToChat] UserChat not found: ${userChatId}`);
      return;
    }

    console.log(`[DEBUG addMergeFaceMessageToChat] Current message count: ${userChatDoc.messages ? userChatDoc.messages.length : 0}`);

    // Create assistant message for the merged face with unique timestamp
    const assistantMessage = {
      role: 'assistant',
      content: `[MergeFace] ${mergeId}`,
      timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
      isMergeFace: true,
      mergeId: mergeId,
      imageUrl: mergedImageUrl, // Add the merged image URL directly
      mergedImageUrl: mergedImageUrl,
      hidden: true,
      type: 'mergeFace',
      uniqueId: `merge_${mergeId}_${Date.now()}`,
      customLog: `[merge-face-utils.js] addMergeFaceMessageToChat called with userChatId: ${userChatId}, mergeId: ${mergeId}`
    };

    // [DEBUG addMergeFaceMessageToChat] Log message being added
    console.log(`[DEBUG addMergeFaceMessageToChat] Assistant message being added:`, {
      type: assistantMessage.type,
      isMergeFace: assistantMessage.isMergeFace,
      imageUrl: assistantMessage.imageUrl?.includes('merged-face') ? 'MERGED_URL' : 'ORIGINAL_URL',
      content: assistantMessage.content
    });

    // Add the message to the chat
    userChatDoc.messages.push(assistantMessage);
    userChatDoc.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });

    console.log(`[DEBUG addMergeFaceMessageToChat] About to update database with ${userChatDoc.messages.length} messages`);

    // Update the database
    await collectionUserChat.updateOne(
      { _id: new ObjectId(userChatId) },
      { 
        $set: { 
          messages: userChatDoc.messages,
          updatedAt: userChatDoc.updatedAt
        }
      }
    );

    // Verify the update
    const verifyDoc = await collectionUserChat.findOne({ _id: new ObjectId(userChatId) });
    console.log(`[DEBUG addMergeFaceMessageToChat] Verification - message count after update: ${verifyDoc.messages ? verifyDoc.messages.length : 0}`);
    
    const lastMessage = verifyDoc.messages[verifyDoc.messages.length - 1];
    console.log(`[DEBUG addMergeFaceMessageToChat] Last message in chat:`, {
      type: lastMessage.type,
      isMergeFace: lastMessage.isMergeFace,
      imageUrl: lastMessage.imageUrl?.includes('merged-face') ? 'MERGED_URL' : 'ORIGINAL_URL'
    });

    console.log(`[addMergeFaceMessageToChat] Added merge face message to chat ${userChatId}`);
  } catch (error) {
    console.error('[addMergeFaceMessageToChat] Error:', error);
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
  console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] CALLED with:`, {
    userChatId,
    imageId,
    mergeId,
    messageCount: userChatMessages?.messages?.length || 0
  });
  
  if (!userChatMessages || !userChatMessages.messages) {
    console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] No messages found`);
    return;
  }
  
  const messageIndex = userChatMessages.messages.findIndex(msg => {
    const content = msg.content || '';
    const isMatch = (msg.type == "image" && msg.imageId == imageId) || content.startsWith('[Image] ' + imageId.toString()) || content.startsWith('[image] ' + imageId.toString());
    return isMatch;
  });
  
  if (messageIndex !== -1) {
    const message = userChatMessages.messages[messageIndex];
    
    console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] Updating message at index ${messageIndex}`);
    
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
      console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] Created new merge_face action`);
    }
    
    // Add merge ID if not already present
    if (!mergeAction.mergeIds.includes(mergeId.toString())) {
      mergeAction.mergeIds.push(mergeId.toString());
      mergeAction.date = new Date(); // Update date
      
      console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] About to update userChat with new merge action`);
      
      // Update the userChatMessages in the database
      const collectionUserChat = fastify.mongo.db.collection('userChat');
      await collectionUserChat.updateOne(
        { _id: new fastify.mongo.ObjectId(userChatId) },
        { $set: { messages: userChatMessages.messages } }
      );
      
      console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] User chat messages updated with merge action for imageId: ${imageId}, mergeId: ${mergeId}`);
      
      // Verify the update
      const verifyDoc = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(userChatId) });
      console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] Verification - message count: ${verifyDoc.messages.length}`);
    } else {
      console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] Merge action already exists for imageId: ${imageId} with mergeId: ${mergeId}`);
    }
  } else {
    console.log(`[DEBUG findImageMessageAndUpdateWithMergeAction] No matching message found for imageId: ${imageId}`);
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
