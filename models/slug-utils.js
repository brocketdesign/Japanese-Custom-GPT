const slugify = require('slugify');
const crypto = require('crypto');

/**
 * Generates an enhanced, SEO-friendly slug for a character
 * - Longer slugs (min 15 chars, max 80 chars) for better SEO
 * - Includes character name
 * - Uses ObjectId for guaranteed uniqueness
 * - Format: character-name-objectid (e.g., "sakura-chan-507f1f77bcf86cd799439011")
 * 
 * @param {string} name - Character name
 * @param {ObjectId|string} chatId - Chat ObjectId for uniqueness
 * @param {Object} options - Optional parameters
 * @param {number} options.minLength - Minimum slug length (default: 15)
 * @param {number} options.maxLength - Maximum slug length (default: 80)
 * @returns {string} Enhanced slug
 */
function generateEnhancedSlug(name, chatId, options = {}) {
  const { minLength = 15, maxLength = 80 } = options;
  
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new Error('Character name is required for slug generation');
  }
  
  if (!chatId) {
    throw new Error('Chat ID is required for slug generation');
  }
  
  // Convert ObjectId to string if needed
  const chatIdStr = typeof chatId === 'object' ? chatId.toString() : chatId;
  
  // Generate base slug from name (longer, more descriptive)
  const baseSlug = slugify(name.trim(), { 
    lower: true, 
    strict: true,
    remove: /[*+~.()'"!:@]/g // Remove special characters
  });
  
  // Ensure base slug has minimum length by padding if needed
  let finalSlug = baseSlug;
  if (baseSlug.length < minLength) {
    // Use a short hash from the ObjectId to pad if name is too short
    const idHash = chatIdStr.substring(chatIdStr.length - 6); // Last 6 chars of ObjectId
    finalSlug = `${baseSlug}-${idHash}`;
  } else {
    // For longer names, append ObjectId for guaranteed uniqueness
    finalSlug = `${baseSlug}-${chatIdStr}`;
  }
  
  // Trim to max length if needed, but keep ObjectId at the end
  if (finalSlug.length > maxLength) {
    const idPart = `-${chatIdStr}`;
    const maxNameLength = maxLength - idPart.length - 1; // -1 for the dash
    const namePart = baseSlug.substring(0, Math.max(maxNameLength, minLength - idPart.length - 1));
    finalSlug = `${namePart}${idPart}`;
  }
  
  // Remove any leading/trailing dashes
  finalSlug = finalSlug.replace(/^-+|-+$/g, '');
  
  // Ensure we have at least minLength
  if (finalSlug.length < minLength) {
    const padding = chatIdStr.substring(chatIdStr.length - (minLength - finalSlug.length));
    finalSlug = `${finalSlug}-${padding}`;
  }
  
  return finalSlug;
}

/**
 * Generates a unique slug and checks for duplicates in the database
 * If duplicate exists, appends additional characters from ObjectId
 * 
 * @param {string} name - Character name
 * @param {ObjectId|string} chatId - Chat ObjectId
 * @param {Object} db - MongoDB database instance
 * @param {string} collectionName - Collection name (default: 'chats')
 * @param {Object} options - Optional parameters
 * @returns {Promise<string>} Unique slug
 */
async function generateUniqueSlug(name, chatId, db, collectionName = 'chats', options = {}) {
  const collection = db.collection(collectionName);
  const chatIdObj = typeof chatId === 'string' ? chatId : chatId.toString();
  
  // Generate base enhanced slug
  let slug = generateEnhancedSlug(name, chatIdObj, options);
  
  // Check for duplicates (excluding current chat if updating)
  const existingChat = await collection.findOne({ 
    slug,
    _id: { $ne: typeof chatId === 'object' ? chatId : require('mongodb').ObjectId(chatId) }
  });
  
  // If duplicate exists, the ObjectId in the slug should make it unique
  // But if somehow there's still a duplicate (edge case), add more entropy
  if (existingChat) {
    // This should rarely happen since ObjectId is unique, but handle it
    const timestamp = Date.now().toString(36).substring(7); // Last 5 chars of timestamp
    slug = `${slug}-${timestamp}`;
  }
  
  return slug;
}

/**
 * Generates an enhanced slug for an image
 * Format: chat-slug-image-title-objectid
 * 
 * @param {string} imageTitle - Image title
 * @param {string} chatSlug - Chat slug
 * @param {ObjectId|string} imageId - Image ObjectId
 * @param {Object} options - Optional parameters
 * @returns {string} Enhanced image slug
 */
function generateImageSlug(imageTitle, chatSlug, imageId, options = {}) {
  const { maxTitleLength = 40, maxLength = 100 } = options;
  
  if (!chatSlug) {
    throw new Error('Chat slug is required for image slug generation');
  }
  
  if (!imageId) {
    throw new Error('Image ID is required for image slug generation');
  }
  
  const imageIdStr = typeof imageId === 'object' ? imageId.toString() : imageId;
  
  // Generate title slug
  let titleSlug = '';
  if (imageTitle && typeof imageTitle === 'string' && imageTitle.trim() !== '') {
    titleSlug = slugify(imageTitle.trim(), { 
      lower: true, 
      strict: true,
      remove: /[*+~.()'"!:@]/g
    }).substring(0, maxTitleLength);
  } else {
    // Use part of ObjectId if no title
    titleSlug = imageIdStr.substring(imageIdStr.length - 8);
  }
  
  // Combine: chat-slug-title-imageid
  let imageSlug = `${chatSlug}-${titleSlug}-${imageIdStr}`;
  
  // Trim to max length if needed
  if (imageSlug.length > maxLength) {
    const idPart = `-${imageIdStr}`;
    const chatPart = `${chatSlug}-`;
    const maxTitlePartLength = maxLength - chatPart.length - idPart.length;
    const trimmedTitle = titleSlug.substring(0, Math.max(maxTitlePartLength, 8));
    imageSlug = `${chatPart}${trimmedTitle}${idPart}`;
  }
  
  // Remove any leading/trailing dashes
  imageSlug = imageSlug.replace(/^-+|-+$/g, '');
  
  return imageSlug;
}

module.exports = {
  generateEnhancedSlug,
  generateUniqueSlug,
  generateImageSlug
};
