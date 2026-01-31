/**
 * Debug script to investigate merge face IDs
 * Run with: node debug-merge-faces.js
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const MERGE_IDS = [
  '697da46c0f69d1c0b2ece47c',
  '697da65a0f69d1c0b2ece485',
  '697dad002ce214f35154c4ee'
];

async function debug() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    console.log('='.repeat(80));
    console.log('MERGE FACE DEBUG');
    console.log('='.repeat(80));

    for (const mergeId of MERGE_IDS) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`INVESTIGATING MERGE ID: ${mergeId}`);
      console.log('='.repeat(80));

      // 1. Check mergedFaces collection
      console.log('\n--- mergedFaces collection ---');
      const mergedFace = await db.collection('mergedFaces').findOne({
        $or: [
          { _id: new ObjectId(mergeId) },
          { mergeId: mergeId },
          { mergeId: new ObjectId(mergeId) }
        ]
      });
      if (mergedFace) {
        console.log('Found in mergedFaces:', JSON.stringify(mergedFace, null, 2));
      } else {
        console.log('NOT found in mergedFaces');
      }

      // 2. Check mergedResults collection
      console.log('\n--- mergedResults collection ---');
      const mergedResult = await db.collection('mergedResults').findOne({
        $or: [
          { mergeId: mergeId },
          { mergeId: new ObjectId(mergeId) }
        ]
      });
      if (mergedResult) {
        console.log('Found in mergedResults:', JSON.stringify(mergedResult, null, 2));
      } else {
        console.log('NOT found in mergedResults');
      }

      // 3. Check gallery collection for images with this mergeId
      console.log('\n--- gallery collection (images with mergeId) ---');
      const galleryWithMerge = await db.collection('gallery').findOne({
        'images.mergeId': mergeId
      });
      if (galleryWithMerge) {
        const matchingImages = galleryWithMerge.images.filter(img => img.mergeId === mergeId);
        console.log(`Found ${matchingImages.length} image(s) with this mergeId in gallery:`);
        matchingImages.forEach((img, i) => {
          console.log(`  Image ${i + 1}:`, JSON.stringify({
            _id: img._id,
            mergeId: img.mergeId,
            isMerged: img.isMerged,
            imageUrl: img.imageUrl?.substring(0, 80) + '...',
            originalImageUrl: img.originalImageUrl?.substring(0, 80) + '...',
            title: img.title,
            prompt: img.prompt?.substring(0, 50) + '...'
          }, null, 2));
        });
      } else {
        console.log('NOT found in gallery');
      }

      // 4. Check userChat collection for messages with this mergeId
      console.log('\n--- userChat collection (messages with mergeId) ---');
      const userChatWithMerge = await db.collection('userChat').findOne({
        'messages.mergeId': mergeId
      });
      if (userChatWithMerge) {
        const matchingMessages = userChatWithMerge.messages.filter(msg => msg.mergeId === mergeId);
        console.log(`Found ${matchingMessages.length} message(s) with this mergeId in userChat (${userChatWithMerge._id}):`);
        matchingMessages.forEach((msg, i) => {
          console.log(`  Message ${i + 1}:`, JSON.stringify({
            type: msg.type,
            content: msg.content?.substring(0, 50),
            imageUrl: msg.imageUrl?.substring(0, 80) + (msg.imageUrl ? '...' : ''),
            imageId: msg.imageId,
            mergeId: msg.mergeId,
            isMerged: msg.isMerged,
            originalImageUrl: msg.originalImageUrl?.substring(0, 80) + (msg.originalImageUrl ? '...' : ''),
            batchId: msg.batchId,
            batchIndex: msg.batchIndex,
            batchSize: msg.batchSize,
            createdAt: msg.createdAt
          }, null, 2));
        });
      } else {
        console.log('NOT found in userChat messages');
      }

      // 5. Check if there are messages with type 'mergeFace' that have undefined/null imageUrl
      console.log('\n--- Checking for problematic mergeFace messages ---');
      const problematicMessages = await db.collection('userChat').aggregate([
        { $unwind: '$messages' },
        {
          $match: {
            'messages.mergeId': mergeId,
            $or: [
              { 'messages.imageUrl': { $exists: false } },
              { 'messages.imageUrl': null },
              { 'messages.imageUrl': '' },
              { 'messages.imageUrl': 'undefined' }
            ]
          }
        },
        { $project: { 'messages': 1, '_id': 1 } }
      ]).toArray();

      if (problematicMessages.length > 0) {
        console.log(`⚠️ Found ${problematicMessages.length} problematic message(s) with missing imageUrl:`);
        problematicMessages.forEach((doc, i) => {
          console.log(`  Problem ${i + 1}:`, JSON.stringify(doc.messages, null, 2));
        });
      } else {
        console.log('No problematic messages found for this mergeId');
      }
    }

    // 6. General check: Find ALL messages with type 'mergeFace' that have undefined/null imageUrl
    console.log(`\n${'='.repeat(80)}`);
    console.log('GENERAL CHECK: All mergeFace messages with missing imageUrl');
    console.log('='.repeat(80));

    const allProblematicMerge = await db.collection('userChat').aggregate([
      { $unwind: '$messages' },
      {
        $match: {
          'messages.type': 'mergeFace',
          $or: [
            { 'messages.imageUrl': { $exists: false } },
            { 'messages.imageUrl': null },
            { 'messages.imageUrl': '' }
          ]
        }
      },
      { $project: { 'messages': 1, '_id': 1, 'userId': 1, 'chatId': 1 } },
      { $limit: 20 }
    ]).toArray();

    console.log(`Found ${allProblematicMerge.length} mergeFace messages with missing imageUrl:`);
    allProblematicMerge.forEach((doc, i) => {
      console.log(`\n  ${i + 1}. UserChat: ${doc._id}`);
      console.log(`     Message:`, JSON.stringify({
        type: doc.messages.type,
        content: doc.messages.content?.substring(0, 50),
        imageUrl: doc.messages.imageUrl,
        mergeId: doc.messages.mergeId,
        isMerged: doc.messages.isMerged
      }, null, 2));
    });

    // 7. Check for messages with content containing [MergeFace]
    console.log(`\n${'='.repeat(80)}`);
    console.log('GENERAL CHECK: Messages with [MergeFace] in content');
    console.log('='.repeat(80));

    const mergeFaceContentMessages = await db.collection('userChat').aggregate([
      { $unwind: '$messages' },
      {
        $match: {
          'messages.content': { $regex: /^\[MergeFace\]/ }
        }
      },
      { $project: { 'messages': 1, '_id': 1 } },
      { $limit: 10 }
    ]).toArray();

    console.log(`Found ${mergeFaceContentMessages.length} messages with [MergeFace] content:`);
    mergeFaceContentMessages.forEach((doc, i) => {
      console.log(`\n  ${i + 1}. UserChat: ${doc._id}`);
      console.log(`     Message:`, JSON.stringify({
        type: doc.messages.type,
        content: doc.messages.content,
        imageUrl: doc.messages.imageUrl?.substring(0, 80) + (doc.messages.imageUrl ? '...' : '(undefined)'),
        mergeId: doc.messages.mergeId,
        isMerged: doc.messages.isMerged
      }, null, 2));
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

debug();
