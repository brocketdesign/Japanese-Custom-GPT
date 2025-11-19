const { ObjectId } = require('mongodb');

/**
 * Build an index of popular query tags from chats that have images.
 * Only tags whose string length is >= minLength are included.
 * The result is an array of objects: { tag, count }
 *
 * @param {import('mongodb').Db} db
 * @param {number} minLength
 * @param {number} limit
 */
/**
 * @param {string|null} language Optional language code to filter chats by `chat.language` field
 */
async function buildQueryTagsIndex(db, minLength = 10, limit = 50, language = null) {
  if (!db) throw new Error('Database handle required');

  const chatsCollection = db.collection('chats');

  try {
    // Build the index directly from the `chats` collection tags (character tags).
    // Optionally filter chats by language if `language` is provided.
    const pipeline = [];

    if (language) {
      pipeline.push({ $match: { language } });
    }

    pipeline.push(
      { $match: { tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      // Ensure tag is a string
      { $match: { tags: { $type: 'string' } } },
      // Only include tags with required minimum length
      { $addFields: { tagLength: { $strLenCP: '$tags' } } },
      { $match: { tagLength: { $gte: minLength } } },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, tag: '$_id', count: 1 } }
    );

    const results = await chatsCollection.aggregate(pipeline).toArray();
    return results || [];
  } catch (err) {
    console.error('[query-tags-utils] Error building tags index:', err);
    return [];
  }
}

/**
 * Persist the query tags into the `queryTags` collection (replace existing docs).
 * @param {import('mongodb').Db} db
 * @param {number} minLength
 * @param {number} limit
 */
async function persistQueryTags(db, minLength = 10, limit = 50) {
  const coll = db.collection('queryTags');
  const tags = await buildQueryTagsIndex(db, minLength, limit);

  if (!tags || !tags.length) {
    // If nothing found, keep existing data and return empty
    return [];
  }

  // Prepare docs with rank and timestamp
  const docs = tags.map((t, idx) => ({
    tag: t.tag,
    count: t.count,
    rank: idx,
    updatedAt: new Date()
  }));

  try {
    await coll.deleteMany({});
    await coll.insertMany(docs);
    return docs;
  } catch (err) {
    console.error('[query-tags-utils] Error persisting query tags:', err);
    return [];
  }
}

module.exports = {
  buildQueryTagsIndex,
  persistQueryTags
};
