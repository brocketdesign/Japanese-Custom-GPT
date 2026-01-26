const { ObjectId } = require('mongodb');
const { getCharacterFollowers, toObjectId } = require('./character-followers-utils');
const fs = require('fs');
const path = require('path');

// Cache for translations
const translationsCache = {};

/**
 * Load translations for a specific language
 * @param {string} lang - Language code (en, fr, ja)
 * @returns {Object} Translations object
 */
function getTranslations(lang = 'en') {
  // Ensure we have a valid language code
  const validLang = lang || 'en';
  
  if (!translationsCache[validLang]) {
    const translationFile = path.join(__dirname, '..', 'locales', `${validLang}.json`);
    try {
      if (fs.existsSync(translationFile)) {
        const fileContent = fs.readFileSync(translationFile, 'utf-8');
        translationsCache[validLang] = JSON.parse(fileContent);
      } else {
        console.warn(`[CharacterFollowers] Translation file not found for language: ${validLang}`);
        translationsCache[validLang] = {};
      }
    } catch (error) {
      console.error(`[CharacterFollowers] Error loading translations for ${validLang}:`, error);
      translationsCache[validLang] = {};
    }
  }
  return translationsCache[validLang];
}

/**
 * Send notifications to character followers when new content is created
 * @param {Object} db - MongoDB database instance
 * @param {Object} fastify - Fastify instance for websocket notifications
 * @param {string|ObjectId} chatId - Character/Chat ID
 * @param {string} contentType - Type of content ('image' or 'video')
 * @param {Object} contentData - Additional content data (imageUrl, title, etc.)
 * @returns {Promise<number>} Number of notifications sent
 */
async function notifyCharacterFollowers(db, fastify, chatId, contentType, contentData = {}) {
  try {
    const chatIdObj = toObjectId(chatId);
    
    // Get the character info
    const chatsCollection = db.collection('chats');
    const character = await chatsCollection.findOne({ _id: chatIdObj });
    
    if (!character) {
      console.warn(`[CharacterFollowers] Character not found: ${chatId}`);
      return 0;
    }
    
    // Get all followers of this character
    const followerIds = await getCharacterFollowers(db, chatId);
    
    if (followerIds.length === 0) {
      console.log(`[CharacterFollowers] No followers to notify for character: ${character.name}`);
      return 0;
    }
    
    // Get user details for each follower to get their language preference
    const usersCollection = db.collection('users');
    const followers = await usersCollection.find({
      _id: { $in: followerIds.map(id => toObjectId(id)) }
    }).toArray();
    
    const notificationsCollection = db.collection('notifications');
    const characterName = character.name || 'Character';
    
    // Determine link based on content type
    let link, imageUrl;
    if (contentType === 'image') {
      link = contentData.imageUrl || `/character/${chatId}`;
      imageUrl = contentData.thumbnailUrl || contentData.imageUrl;
    } else if (contentType === 'video') {
      link = contentData.videoUrl || `/character/${chatId}`;
      imageUrl = contentData.thumbnailUrl;
    } else {
      link = `/character/${chatId}`;
      imageUrl = contentData.thumbnailUrl || contentData.imageUrl;
    }
    
    // Create notifications for each follower with their language
    const notifications = [];
    const liveNotifications = [];
    
    for (const follower of followers) {
      const userLang = follower.lang || 'en';
      const translations = getTranslations(userLang);
      
      // Get translated notification text
      let title, message;
      if (contentType === 'image') {
        title = (translations.follow?.notificationNewImage || 'New image from {characterName}')
          .replace('{characterName}', characterName);
        message = contentData.title || `${characterName} has posted a new image`;
      } else if (contentType === 'video') {
        title = (translations.follow?.notificationNewVideo || 'New video from {characterName}')
          .replace('{characterName}', characterName);
        message = contentData.title || `${characterName} has posted a new video`;
      } else {
        title = `New content from ${characterName}`;
        message = `${characterName} has posted new content`;
      }
      
      // Database notification
      notifications.push({
        userId: toObjectId(follower._id),
        title,
        message,
        type: 'info',
        data: {
          link,
          imageUrl,
          chatId: chatIdObj.toString(),
          contentType
        },
        viewed: false,
        createdAt: new Date().toISOString(),
        sticky: false
      });
      
      // Prepare live notification for websocket
      liveNotifications.push({
        userId: follower._id.toString(),
        title,
        message,
        link,
        imageUrl
      });
    }
    
    // Insert notifications to database
    if (notifications.length > 0) {
      await notificationsCollection.insertMany(notifications);
      console.log(`[CharacterFollowers] Sent ${notifications.length} notifications for ${contentType} from ${characterName}`);
    }
    
    // Send live websocket notifications if fastify is available
    if (fastify && fastify.sendNotificationToUser) {
      for (const liveNotif of liveNotifications) {
        try {
          fastify.sendNotificationToUser(
            liveNotif.userId,
            'showNotification',
            {
              message: liveNotif.title,
              icon: 'info'
            },
            { queue: true }
          );
          
          console.log(`[CharacterFollowers] Sent live notification to user ${liveNotif.userId}`);
        } catch (wsError) {
          console.error(`[CharacterFollowers] Error sending websocket notification:`, wsError);
        }
      }
    }
    
    return notifications.length;
  } catch (error) {
    console.error('[CharacterFollowers] Error sending notifications:', error);
    return 0;
  }
}

/**
 * Hook to call after image is saved to gallery
 * This should be called in the image generation/upload flow
 * 
 * Example usage in routes/stability.js or models/imagen.js:
 * 
 * const { onImageCreated } = require('../models/character-followers-notifications');
 * 
 * // After image is saved to gallery
 * await onImageCreated(db, fastify, chatId, {
 *   imageUrl: imageUrl,
 *   thumbnailUrl: thumbnailUrl,
 *   title: imageTitle
 * });
 */
async function onImageCreated(db, fastify, chatId, imageData) {
  return await notifyCharacterFollowers(db, fastify, chatId, 'image', imageData);
}

/**
 * Hook to call after video is saved
 * This should be called in the video generation/upload flow
 * 
 * Example usage in routes/img2video-api.js or routes/dashboard-video.js:
 * 
 * const { onVideoCreated } = require('../models/character-followers-notifications');
 * 
 * // After video is saved
 * await onVideoCreated(db, fastify, chatId, {
 *   videoUrl: videoUrl,
 *   thumbnailUrl: thumbnailUrl,
 *   title: videoTitle
 * });
 */
async function onVideoCreated(db, fastify, chatId, videoData) {
  return await notifyCharacterFollowers(db, fastify, chatId, 'video', videoData);
}

module.exports = {
  notifyCharacterFollowers,
  onImageCreated,
  onVideoCreated
};
