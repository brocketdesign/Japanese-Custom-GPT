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
  console.log('[cacheSitemapData] Starting sitemap data caching...');
  
  try {
    const sitemapCacheCollection = db.collection('sitemapCache');
    
    // Fetch characters and tags in parallel
    const [characters, tags] = await Promise.all([
      fetchCharactersForSitemap(db),
      fetchTagsForSitemap(db)
    ]);

    // Group characters by language for better organization
    const charactersByLanguage = characters.reduce((acc, char) => {
      const lang = char.language || 'en';
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(char);
      return acc;
    }, {});

    const sitemapData = {
      type: 'sitemap',
      characters: charactersByLanguage,
      tags,
      totalCharacters: characters.length,
      totalTags: tags.length,
      lastUpdated: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    // Replace existing cache
    await sitemapCacheCollection.deleteMany({ type: 'sitemap' });
    await sitemapCacheCollection.insertOne(sitemapData);

    console.log(`[cacheSitemapData] Successfully cached ${characters.length} characters and ${tags.length} tags`);
    return sitemapData;
  } catch (error) {
    console.error('[cacheSitemapData] Error caching sitemap data:', error);
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

    return cachedData;
  } catch (error) {
    console.error('[getCachedSitemapData] Error fetching cached sitemap data:', error);
    return null;
  }
};

module.exports = {
  fetchCharactersForSitemap,
  fetchTagsForSitemap,
  cacheSitemapData,
  getCachedSitemapData
};
