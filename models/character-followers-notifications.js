const { ObjectId } = require('mongodb');
const { getCharacterFollowers, toObjectId } = require('./character-followers-utils');

/**
 * Send notifications to character followers when new content is created
 * @param {Object} db - MongoDB database instance
 * @param {string|ObjectId} chatId - Character/Chat ID
 * @param {string} contentType - Type of content ('image' or 'video')
 * @param {Object} contentData - Additional content data (imageUrl, title, etc.)
 * @returns {Promise<number>} Number of notifications sent
 */
async function notifyCharacterFollowers(db, chatId, contentType, contentData = {}) {
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
    const followers = await getCharacterFollowers(db, chatId);
    
    if (followers.length === 0) {
      console.log(`[CharacterFollowers] No followers to notify for character: ${character.name}`);
      return 0;
    }
    
    // Prepare notification content
    const notificationsCollection = db.collection('notifications');
    const characterName = character.name || 'Character';
    
    let title, message, link, imageUrl;
    
    if (contentType === 'image') {
      title = `New image from ${characterName}`;
      message = contentData.title || `${characterName} has posted a new image`;
      link = contentData.imageUrl || `/character/${chatId}`;
      imageUrl = contentData.thumbnailUrl || contentData.imageUrl;
    } else if (contentType === 'video') {
      title = `New video from ${characterName}`;
      message = contentData.title || `${characterName} has posted a new video`;
      link = contentData.videoUrl || `/character/${chatId}`;
      imageUrl = contentData.thumbnailUrl;
    } else {
      title = `New content from ${characterName}`;
      message = `${characterName} has posted new content`;
      link = `/character/${chatId}`;
    }
    
    // Create notifications for all followers
    const notifications = followers.map(userId => ({
      userId: toObjectId(userId),
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
    }));
    
    // Insert notifications
    if (notifications.length > 0) {
      await notificationsCollection.insertMany(notifications);
      console.log(`[CharacterFollowers] Sent ${notifications.length} notifications for ${contentType} from ${characterName}`);
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
 * const { notifyCharacterFollowers } = require('../models/character-followers-notifications');
 * 
 * // After image is saved to gallery
 * await notifyCharacterFollowers(db, chatId, 'image', {
 *   imageUrl: imageUrl,
 *   thumbnailUrl: thumbnailUrl,
 *   title: imageTitle
 * });
 */
async function onImageCreated(db, chatId, imageData) {
  return await notifyCharacterFollowers(db, chatId, 'image', imageData);
}

/**
 * Hook to call after video is saved
 * This should be called in the video generation/upload flow
 * 
 * Example usage in routes/img2video-api.js or routes/dashboard-video.js:
 * 
 * const { notifyCharacterFollowers } = require('../models/character-followers-notifications');
 * 
 * // After video is saved
 * await notifyCharacterFollowers(db, chatId, 'video', {
 *   videoUrl: videoUrl,
 *   thumbnailUrl: thumbnailUrl,
 *   title: videoTitle
 * });
 */
async function onVideoCreated(db, chatId, videoData) {
  return await notifyCharacterFollowers(db, chatId, 'video', videoData);
}

module.exports = {
  notifyCharacterFollowers,
  onImageCreated,
  onVideoCreated
};
