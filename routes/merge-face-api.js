const { ObjectId } = require('mongodb');
const {
  mergeFaceWithNovita,
  mergeFaceWithSegmind,
  optimizeImageForMerge,
  saveMergedFaceToDB,
  findImageMessageAndUpdateWithMergeAction,
  saveUserFace,
  getUserFaces,
  addMergeFaceMessageToChat,
  saveMergedImageToS3,
  getFaceImageAsBase64
} = require('../models/merge-face-utils');
const { handleFileUpload } = require('../models/tool');
const { removeUserPoints } = require('../models/user-points-utils');
const { getFaceMergeCost } = require('../config/pricing');

async function routes(fastify, options) {

  // Get user's uploaded faces
  fastify.get('/api/merge-face/user-faces', async (request, reply) => {
    try {
      const user = request.user;
      const userId = user._id;

      const faces = await getUserFaces(userId, fastify);
      
      return reply.send({ 
        success: true, 
        faces: faces.map(face => ({
          _id: face._id,
          originalFilename: face.originalFilename,
          faceImageUrl: face.faceImageUrl, // S3 URL for preview
          createdAt: face.createdAt
        }))
      });
    } catch (error) {
      console.error('Error fetching user faces:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch user faces' 
      });
    }
  });

  // Upload and save new face
  fastify.post('/api/merge-face/upload-face', async (request, reply) => {
    try {
      const user = request.user;
      const userId = user._id;
      const parts = request.parts();
      
      let uploadedPart = null;

      for await (const part of parts) {
        if (part.file) {
          uploadedPart = part;
          break;
        }
      }

      if (!uploadedPart) {
        return reply.status(400).send({ 
          success: false, 
          error: 'No image file provided' 
        });
      }

      // Check file size before upload
      const chunks = [];
      for await (const chunk of uploadedPart.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      if (fileBuffer.length > 10 * 1024 * 1024) {
        return reply.status(400).send({ 
          success: false, 
          error: request.mergeFaceTranslations?.fileTooLarge || 'File too large' 
        });
      }

      // Create a new readable stream for handleFileUpload
      const { Readable } = require('stream');
      const bufferStream = new Readable({
        read() {
          this.push(fileBuffer);
          this.push(null);
        }
      });

      // Create part object for handleFileUpload
      const partForUpload = {
        file: bufferStream,
        filename: uploadedPart.filename
      };

      // Use handleFileUpload to save to S3
      const faceImageUrl = await handleFileUpload(partForUpload, fastify.mongo.db);

      // Get size info for response (without storing base64)
      const optimizedResult = await optimizeImageForMerge(fileBuffer);

      // Save the face (only S3 URL)
      const savedFace = await saveUserFace({
        userId,
        faceImageUrl: faceImageUrl,
        originalFilename: uploadedPart.filename,
        fastify
      });

      return reply.send({ 
        success: true, 
        faceId: savedFace._id,
        faceImageUrl: faceImageUrl,
        sizeKB: optimizedResult.sizeKB,
        quality: optimizedResult.quality,
        message: 'Face uploaded successfully'
      });

    } catch (error) {
      console.error('Error uploading face:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to upload face' 
      });
    }
  });

  // Merge faces
  fastify.post('/api/merge-face/merge', async (request, reply) => {
    try {
      const user = request.user;
      const userId = user._id;
      const { imageId, faceId, userChatId, provider = 'segmind' } = request.body;

      console.log(`🧬 [merge-face-api] ════════════════════════════════════════════`);
      console.log(`🧬 [merge-face-api] Merge request received:`);
      console.log(`🧬 [merge-face-api]   - userId: ${userId}`);
      console.log(`🧬 [merge-face-api]   - imageId: ${imageId}`);
      console.log(`🧬 [merge-face-api]   - faceId: ${faceId}`);
      console.log(`🧬 [merge-face-api]   - userChatId: ${userChatId}`);
      console.log(`🧬 [merge-face-api]   - provider: ${provider}`);

      if (!imageId || !faceId) {
        console.error(`🧬 [merge-face-api] ❌ Missing required fields - imageId: ${imageId}, faceId: ${faceId}`);
        return reply.status(400).send({ 
          success: false, 
          error: 'Image ID and Face ID are required' 
        });
      }

      // Check subscription status
      const isSubscribed = user.subscriptionStatus === 'active';
      if (!isSubscribed) {
        return reply.status(403).send({ 
          success: false, 
          error: 'Premium subscription required for face merge feature' 
        });
      }

      const db = fastify.mongo.db;
      
      const cost = getFaceMergeCost();
      console.log(`[merge-face] Cost for merge face: ${cost} points`);
      try {
          await removeUserPoints(db, userId, cost, request.translations?.points?.deduction_reasons?.merge_face || 'Merge face', 'merge_face', fastify);
      } catch (error) {
          console.error('Error deducting points:', error);
          return reply.status(500).send({ error: request.translations?.points?.error_deducting_points || 'Error deducting points for merge face.' });
      }

      // Get the original image
      const galleryCollection = db.collection('gallery');
      let galleryDoc = await galleryCollection.findOne({
        'images._id': new ObjectId(imageId)
      }); 
      if (!galleryDoc) {
        galleryDoc = await galleryCollection.findOne({
        'images.mergeId': new ObjectId(imageId)
        });
      }

      if (!galleryDoc) {
        console.error(`🧬 [merge-face-api] ❌ Gallery document not found for imageId: ${imageId}`);
        return reply.status(404).send({ 
          success: false, 
          error: 'Original image not found' 
        });
      }

      console.log(`🧬 [merge-face-api] ✓ Gallery document found, chatId: ${galleryDoc.chatId}`);

      const originalImage = galleryDoc.images.find(img => img._id.toString() === imageId);
      if (!originalImage) {
        console.error(`🧬 [merge-face-api] ❌ Image not found in gallery images array`);
        return reply.status(404).send({ 
          success: false, 
          error: 'Original image not found in gallery' 
        });
      }

      console.log(`🧬 [merge-face-api] ✓ Original image found, URL: ${originalImage.imageUrl?.substring(0, 50)}...`);

      // Get the face image
      const userFacesCollection = db.collection('userFaces');
      const faceDoc = await userFacesCollection.findOne({
        _id: new ObjectId(faceId),
        userId: new ObjectId(userId)
      });

      if (!faceDoc) {
        console.error(`🧬 [merge-face-api] ❌ Face document not found for faceId: ${faceId}, userId: ${userId}`);
        return reply.status(404).send({ 
          success: false, 
          error: 'Face image not found' 
        });
      }

      console.log(`🧬 [merge-face-api] ✓ Face document found, URL: ${faceDoc.faceImageUrl?.substring(0, 50)}...`);
      console.log(`🧬 [merge-face-api] Starting merge process for user ${userId}, imageId: ${imageId}, faceId: ${faceId}`);

      // Convert original image URL to base64 with size optimization
      let originalImageBase64;
      try {
        const axios = require('axios');
        const originalImageResponse = await axios.get(originalImage.imageUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000
        });
        
        // Optimize the original image for merge
        const originalImageBuffer = Buffer.from(originalImageResponse.data);
        const optimizedOriginal = await optimizeImageForMerge(originalImageBuffer, 2048); // 2MB limit
        originalImageBase64 = optimizedOriginal.base64Image;
        
        console.log(`[merge-face] Original image optimized: ${optimizedOriginal.sizeKB}KB at ${optimizedOriginal.quality}% quality`);
      } catch (error) {
        console.error('Error processing original image:', error);
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to process original image' 
        });
      }

      // Convert face image URL to base64 for API call with optimization
      let faceImageBase64;
      try {
        faceImageBase64 = await getFaceImageAsBase64(faceDoc.faceImageUrl);
        console.log(`[merge-face] Face image processed successfully`);
      } catch (error) {
        console.error('Error processing face image:', error);
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to process face image' 
        });
      }

      // Merge the faces using selected provider with retry logic
      let mergeResult;
      const maxRetries = 2;
      let lastError;

      // Select merge function based on provider
      const mergeFaceFunction = provider === 'segmind' ? mergeFaceWithSegmind : mergeFaceWithNovita;
      const providerName = provider === 'segmind' ? 'Segmind' : 'Novita';

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[merge-face] Merge attempt ${attempt}/${maxRetries} using ${providerName}`);
          
          mergeResult = await mergeFaceFunction({
            faceImageBase64,
            originalImageBase64
          });
          
          if (mergeResult.success) {
            console.log(`[merge-face] Merge successful on attempt ${attempt} using ${providerName}`);
            break;
          }
        } catch (error) {
          lastError = error;
          console.error(`[merge-face] Attempt ${attempt} failed with ${providerName}:`, error.message);
          
          // Don't retry on certain errors
          if (error.message.includes('Invalid API key') || 
              error.message.includes('Access forbidden') ||
              error.message.includes('Bad request') ||
              error.message.includes('Invalid request') ||
              error.message.includes('Insufficient') ||
              error.message.includes('credits')) {
            break;
          }
          
          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s
            console.log(`[merge-face] Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      if (!mergeResult || !mergeResult.success) {
        console.error(`🧬 [merge-face-api] ❌ All merge attempts failed:`, lastError?.message);
        return reply.status(500).send({ 
          success: false, 
          error: lastError?.message || 'Face merge failed after multiple attempts'
        });
      }

      console.log(`🧬 [merge-face-api] ✓ Merge API call successful, image type: ${mergeResult.imageType}`);

      // Generate unique merge ID
      const mergeId = new ObjectId();
      console.log(`🧬 [merge-face-api] Generated mergeId: ${mergeId}`);

      // Save merged image to S3
      let mergedImageUrl;
      try {
        mergedImageUrl = await saveMergedImageToS3(
          `data:image/${mergeResult.imageType};base64,${mergeResult.imageBase64}`,
          mergeId.toString(),
          fastify
        );
        console.log(`[merge-face] Merged image saved to S3: ${mergedImageUrl}`);
      } catch (error) {
        console.error('Error saving merged image to S3:', error);
        return reply.status(500).send({ 
          success: false, 
          error: 'Failed to save merged image' 
        });
      }

      // Save merge result to database (only S3 URL)
      const savedMerge = await saveMergedFaceToDB({
        originalImageId: imageId,
        mergedImageUrl, // S3 URL only
        userId,
        chatId: galleryDoc.chatId,
        userChatId,
        fastify
      });

      // Add message to chat
      if (userChatId) {
        await addMergeFaceMessageToChat(
          userChatId,
          savedMerge._id.toString(),
          mergedImageUrl,
          fastify
        );

        // Update original image with merge action
        const userDataCollection = db.collection('userChat');
        const userChatMessages = await userDataCollection.findOne({ 
          _id: new ObjectId(userChatId) 
        });
        
        if (userChatMessages) {
          await findImageMessageAndUpdateWithMergeAction(
            userChatId, 
            userChatMessages, 
            imageId, 
            savedMerge._id, 
            fastify
          );
        }
      }

      // Send WebSocket notification to user with isMergeFace flag
      const notificationData = {
        imageId: savedMerge._id.toString(),
        imageUrl: mergedImageUrl,
        title: originalImage.title || originalImage.prompt || 'Face Merge Result', // Use original title if available
        prompt: originalImage.prompt || 'Face merge completed',
        nsfw: false,
        userChatId,
        isMergeFace: true,
        originalImageId: imageId
      };
      
      console.log(`🧬 [merge-face-api] Sending imageGenerated WebSocket notification:`, JSON.stringify(notificationData, null, 2));
      fastify.sendNotificationToUser(userId, 'imageGenerated', notificationData);

      // Also send merge completion notification
      const mergeCompletedData = {
        imageId,
        mergeId: savedMerge._id,
        mergedImageUrl,
        userChatId
      };
      console.log(`🧬 [merge-face-api] Sending mergeFaceCompleted WebSocket notification:`, JSON.stringify(mergeCompletedData, null, 2));
      fastify.sendNotificationToUser(userId, 'mergeFaceCompleted', mergeCompletedData);

      console.log(`🧬 [merge-face-api] ✓ Process completed successfully for merge ID: ${savedMerge._id}`);
      console.log(`🧬 [merge-face-api] ════════════════════════════════════════════`);

      return reply.send({ 
        success: true, 
        mergeId: savedMerge._id,
        mergedImageUrl,
        message: request.mergeFaceTranslations?.success || 'Face merge completed successfully'
      });

    } catch (error) {
      console.error('Error in merge-face endpoint:', error);
      return reply.status(500).send({ 
        success: false, 
        error: request.mergeFaceTranslations?.error || 'Face merge failed' 
      });
    }
  });

    // Get individual merge result by merge ID
    fastify.get('/api/merge-face/result/:mergeId', async (request, reply) => {
    try {
        const user = request.user;
        const userId = user._id;
        const { mergeId } = request.params;

        const db = fastify.mongo.db;
        const mergedFacesCollection = db.collection('mergedFaces');

        const mergeResult = await mergedFacesCollection.findOne({
        _id: new ObjectId(mergeId),
        userId: new ObjectId(userId)
        });

        if (!mergeResult) {
        return reply.status(404).send({ 
            success: false, 
            error: 'Merge result not found' 
        });
        }

        return reply.send({ 
        success: true, 
        result: mergeResult 
        });

    } catch (error) {
        console.error('Error fetching merge result:', error);
        return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch merge result' 
        });
    }
    });

  // Get merge results for an image
  fastify.get('/api/merge-face/results/:imageId', async (request, reply) => {
    try {
      const user = request.user;
      const userId = user._id;
      const { imageId } = request.params;

      const db = fastify.mongo.db;
      const mergedFacesCollection = db.collection('mergedFaces');

      const mergeResults = await mergedFacesCollection.find({
        originalImageId: new ObjectId(imageId),
        userId: new ObjectId(userId)
      }).sort({ createdAt: -1 }).toArray();

      return reply.send({ 
        success: true, 
        results: mergeResults 
      });

    } catch (error) {
      console.error('Error fetching merge results:', error);
      return reply.status(500).send({ 
        success: false, 
        error: 'Failed to fetch merge results' 
      });
    }
  });
}

module.exports = routes;

