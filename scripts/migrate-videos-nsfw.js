// Filename: migrate-videos-nsfw.js

const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

if (!MONGODB_URI || !MONGODB_NAME) {
  console.error('Missing MONGODB_URI or MONGODB_NAME in environment');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');

async function detectImageNsfw(image) {
  if (!image) return false;
  // common possible fields
  if (typeof image.nsfw === 'boolean') return image.nsfw;
  if (typeof image.nsfw === 'string') return image.nsfw === 'true';
  if (typeof image.isNSFW === 'boolean') return image.isNSFW;
  if (typeof image.tags === 'object' && image.tags?.nsfw) return true;
  return false;
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  let updatedCount = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  try {
    console.log(`[migrate-videos-nsfw] Connecting to ${MONGODB_NAME}...`);
    await client.connect();
    const db = client.db(MONGODB_NAME);
    const videos = db.collection('videos');
    const gallery = db.collection('gallery');

    // Find videos missing nsfw field or null
    const cursor = videos.find({ $or: [ { nsfw: { $exists: false } }, { nsfw: null } ] });
    const total = await cursor.count();
    console.log(`[migrate-videos-nsfw] Found ${total} videos missing nsfw`);

    while (await cursor.hasNext()) {
      const video = await cursor.next();
      processedCount++;

      try {
        const imageId = video.imageId;
        if (!imageId) {
          console.warn(`[${processedCount}] Video ${video._id} has no imageId, skipping`);
          skippedCount++;
          continue;
        }

        const imageObjectId = ObjectId.isValid(imageId) ? new ObjectId(imageId) : null;
        if (!imageObjectId) {
          console.warn(`[${processedCount}] Video ${video._id} has invalid imageId (${imageId}), skipping`);
          skippedCount++;
          continue;
        }

        // Find the gallery doc that contains this image, return only the matched image element
        const galleryDoc = await gallery.findOne(
          { 'images._id': imageObjectId },
          { projection: { 'images.$': 1, _id: 1 } }
        );

        if (!galleryDoc || !Array.isArray(galleryDoc.images) || galleryDoc.images.length === 0) {
          console.warn(`[${processedCount}] No gallery image found for imageId ${imageObjectId} (video ${video._id})`);
          notFoundCount++;
          continue;
        }

        const img = galleryDoc.images[0];
        const nsfwFlag = !!(await detectImageNsfw(img));

        console.log(`[${processedCount}] Video ${video._id} -> image ${imageObjectId} nsfw=${nsfwFlag}`);

        if (!dryRun) {
          const res = await videos.updateOne(
            { _id: video._id },
            { $set: { nsfw: nsfwFlag, updatedAt: new Date() } }
          );
          if (res.modifiedCount === 1) {
            updatedCount++;
          } else {
            console.warn(`[${processedCount}] Failed to update video ${video._id}`);
          }
        }

      } catch (err) {
        console.error(`[${processedCount}] Error processing video ${video._id}:`, err);
      }

      if (processedCount % 100 === 0) {
        console.log(`[migrate-videos-nsfw] Progress: processed ${processedCount}/${total} videos`);
      }
    }

    console.log('--- Summary ---');
    console.log(`Processed: ${processedCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (invalid/missing imageId): ${skippedCount}`);
    console.log(`Image not found in gallery: ${notFoundCount}`);
    console.log(`Dry run: ${dryRun}`);
    console.log('--- Done ---');

  } catch (err) {
    console.error('[migrate-videos-nsfw] Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
    console.log('[migrate-videos-nsfw] Database connection closed');
  }
}

if (require.main === module) {
  migrate();
}

module.exports