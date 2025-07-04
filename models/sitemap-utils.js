/**
 * Sitemap utilities for caching character and tag data
 */

/**
 * Fetch and cache character data for sitemap
 * @param {Object} db - MongoDB database instance
 * @returns {Array} Array of character data with slugs
 */
const fetchCharactersForSitemap = async (db) => {
  try {
    const chatsCollection = db.collection('chats');
    
    const characters = await chatsCollection.find({
      slug: { $exists: true, $ne: '' },
      name: { $exists: true, $ne: '' },
      chatImageUrl: { $exists: true, $ne: '' },
      visibility: { $ne: 'private' }
    }, {
      projection: {
        _id: 1,
        slug: 1,
        name: 1,
        chatImageUrl: 1,
        language: 1,
        gender: 1,
        imageStyle: 1,
        updatedAt: 1,
        createdAt: 1
      }
    }).sort({ updatedAt: -1, _id: -1 }).toArray();

    return characters;
  } catch (error) {
    console.error('[fetchCharactersForSitemap] Error fetching characters:', error);
    return [];
  }
};

/**
 * Fetch and cache tag data for sitemap
 * @param {Object} db - MongoDB database instance
 * @returns {Array} Array of tag data
 */
const fetchTagsForSitemap = async (db) => {
  try {
    const tagsCollection = db.collection('tags');
    
    const tags = await tagsCollection.find({
      name: { $exists: true, $ne: '' }
    }, {
      projection: {
        _id: 1,
        name: 1,
        count: 1
      }
    }).sort({ count: -1 }).toArray(); // Limit to top 500 tags

    return tags;
  } catch (error) {
    console.error('[fetchTagsForSitemap] Error fetching tags:', error);
    return [];
  }
};

/**
 * Cache sitemap data
 * @param {Object} db - MongoDB database instance
 */
const cacheSitemapData = async (db) => {
  try {
    console.log('[cacheSitemapData] Starting sitemap data generation...');
    
    const chatsCollection = db.collection('chats');
    const sitemapCacheCollection = db.collection('sitemap_cache');
    
    // Get all public characters with additional metadata
    const characters = await chatsCollection.find({
      visibility: 'public',
      chatImageUrl: { $exists: true, $ne: null }
    }, {
      projection: {
        name: 1,
        slug: 1,
        chatImageUrl: 1,
        gender: 1,
        imageStyle: 1,
        language: 1,
        createdAt: 1,
        updatedAt: 1
      }
    }).toArray();

    // Group characters by language for better organization
    const charactersByLanguage = characters.reduce((acc, char) => {
      const lang = char.language || 'en';
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(char);
      return acc;
    }, {});

    // Get top tags (limit to 500 for performance)
    const topTags = await fetchTagsForSitemap(db);

    const sitemapData = {
      characters: charactersByLanguage,
      tags: topTags,
      totalCharacters: characters.length,
      totalTags: topTags.length,
      lastUpdated: new Date()
    };

    // Cache the sitemap data
    await sitemapCacheCollection.replaceOne(
      { _id: 'sitemap_data' },
      { ...sitemapData, _id: 'sitemap_data' },
      { upsert: true }
    );

    console.log(`[cacheSitemapData] Generated sitemap with ${sitemapData.totalCharacters} characters and ${sitemapData.totalTags} tags`);
    
    return sitemapData;
  } catch (error) {
    console.error('[cacheSitemapData] Error:', error);
    throw error;
  }
};

/**
 * Get cached sitemap data
 * @param {Object} db - MongoDB database instance
 * @returns {Object|null} Cached sitemap data or null if not found/expired
 */
const getCachedSitemapData = async (db) => {
  try {
    const sitemapCacheCollection = db.collection('sitemapCache');
    
    const cachedData = await sitemapCacheCollection.findOne({
      type: 'sitemap',
      expiresAt: { $gt: new Date() }
    });

    // If no cache found or cache expired, generate new cache
    if (!cachedData) {
      console.log('[getCachedSitemapData] No valid cache found, generating new sitemap data...');
      const newSitemapData = await cacheSitemapData(db);
      return newSitemapData;
    }

    return cachedData;
  } catch (error) {
    console.error('[getCachedSitemapData] Error fetching cached sitemap data:', error);
    // Fallback: try to generate new cache even if there's an error
    try {
      const fallbackData = await cacheSitemapData(db);
      return fallbackData;
    } catch (fallbackError) {
      console.error('[getCachedSitemapData] Fallback cache generation failed:', fallbackError);
      return null;
    }
  }
};

module.exports = {
  fetchCharactersForSitemap,
  fetchTagsForSitemap,
  cacheSitemapData,
  getCachedSitemapData
};
