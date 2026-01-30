/**
 * Cleanup script to remove duplicate image messages from userChat collection
 *
 * The bug was in MongoDB queries that checked for batchId AND batchIndex separately,
 * which could match different array elements instead of the same one.
 *
 * Usage: node cleanup-duplicate-messages.js [--dry-run]
 *   --dry-run: Show what would be cleaned without making changes
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.MONGODB_NAME || process.env.DB_NAME || 'lamix';

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    console.log(isDryRun ? '🔍 DRY RUN MODE - No changes will be made\n' : '⚠️  LIVE MODE - Changes will be applied\n');

    const db = client.db(dbName);
    const userChatCollection = db.collection('userChat');

    // Get all userChat documents
    const cursor = userChatCollection.find({});

    let totalDocuments = 0;
    let documentsWithDuplicates = 0;
    let totalDuplicatesRemoved = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      totalDocuments++;

      if (!doc.messages || !Array.isArray(doc.messages)) {
        continue;
      }

      const originalCount = doc.messages.length;

      // Deduplicate messages
      const seenKeys = new Set();
      const deduplicatedMessages = [];
      let duplicatesInDoc = 0;

      for (const msg of doc.messages) {
        // Create a unique key for each message
        let key;

        if (msg.type === 'image' || msg.type === 'mergeFace' || msg.type === 'bot-image-slider') {
          // For image messages, use combination of identifiers
          if (msg.batchId && msg.batchIndex !== undefined && msg.batchIndex !== null) {
            // Batch messages: unique by batchId + batchIndex
            key = `batch:${msg.batchId}:${msg.batchIndex}`;
          } else if (msg.mergeId) {
            // Merge messages: unique by mergeId
            key = `merge:${msg.mergeId}`;
          } else if (msg.imageId) {
            // Regular image messages: unique by imageId
            key = `image:${msg.imageId}`;
          } else if (msg.imageUrl) {
            // Fallback to imageUrl if no other identifier
            key = `url:${msg.imageUrl}`;
          } else {
            // No identifier, keep the message (shouldn't happen for valid messages)
            deduplicatedMessages.push(msg);
            continue;
          }
        } else {
          // Non-image messages: always keep
          deduplicatedMessages.push(msg);
          continue;
        }

        // Check if we've seen this key before
        if (seenKeys.has(key)) {
          duplicatesInDoc++;
          if (isDryRun) {
            console.log(`  [DUPLICATE] ${key}`);
          }
        } else {
          seenKeys.add(key);
          deduplicatedMessages.push(msg);
        }
      }

      if (duplicatesInDoc > 0) {
        documentsWithDuplicates++;
        totalDuplicatesRemoved += duplicatesInDoc;

        console.log(`\n📄 Document: ${doc._id}`);
        console.log(`   Original messages: ${originalCount}`);
        console.log(`   Duplicates found: ${duplicatesInDoc}`);
        console.log(`   After cleanup: ${deduplicatedMessages.length}`);

        if (!isDryRun) {
          // Update the document with deduplicated messages
          const result = await userChatCollection.updateOne(
            { _id: doc._id },
            {
              $set: {
                messages: deduplicatedMessages,
                updatedAt: new Date()
              }
            }
          );

          if (result.modifiedCount > 0) {
            console.log(`   ✅ Cleaned successfully`);
          } else {
            console.log(`   ⚠️  No changes made`);
          }
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total documents scanned: ${totalDocuments}`);
    console.log(`Documents with duplicates: ${documentsWithDuplicates}`);
    console.log(`Total duplicates ${isDryRun ? 'found' : 'removed'}: ${totalDuplicatesRemoved}`);

    if (isDryRun && totalDuplicatesRemoved > 0) {
      console.log('\n💡 Run without --dry-run to apply changes');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

main();
