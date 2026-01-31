/**
 * Debug script: Detect and analyze duplicate batch messages in userChat
 * 
 * Focuses on messages with the same batchId + batchIndex (especially index 0)
 * Shows timestamps to detect race conditions / multiple saves
 * 
 * Usage:
 *   node debug-batch-duplicates.js [--dry-run] [--userChatId=your_userchat_id_here]
 * 
 * Without --userChatId → scans ALL userChat documents (can be slow)
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const dbName = process.env.MONGODB_NAME || process.env.DB_NAME || 'lamix';

const targetUserChatId = process.argv.find(arg => arg.startsWith('--userChatId=')) 
  ? process.argv.find(arg => arg.startsWith('--userChatId=')).split('=')[1] 
  : null;

async function debugBatchDuplicates() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbName);
    const userChatCollection = db.collection('userChat');

    let matchStage = {};
    if (targetUserChatId) {
      matchStage = { _id: new ObjectId(targetUserChatId) };
      console.log(`🔎 Scanning specific userChat: ${targetUserChatId}`);
    } else {
      console.log(`🔎 Scanning ALL userChat documents (this may take time)`);
    }

    const cursor = userChatCollection.find(matchStage);

    let totalChatsScanned = 0;
    let chatsWithBatchDupes = 0;
    let totalBatchDupesFound = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      totalChatsScanned++;

      if (!doc.messages || !Array.isArray(doc.messages) || doc.messages.length === 0) {
        continue;
      }

      // Group by batchId + batchIndex
      const batchGroups = new Map();

      doc.messages.forEach((msg, index) => {
        if (msg.batchId && msg.batchIndex !== undefined && msg.batchIndex !== null) {
          const key = `${msg.batchId}:${msg.batchIndex}`;
          if (!batchGroups.has(key)) {
            batchGroups.set(key, []);
          }
          batchGroups.get(key).push({
            arrayIndex: index,
            createdAt: msg.createdAt,
            imageUrl: msg.imageUrl || '(missing)',
            type: msg.type || '(unknown)',
            taskId: msg.taskId || '(none)',
            title: msg.title || '(no title)',
            contentPreview: msg.content ? msg.content.substring(0, 60) + '...' : '(no content)'
          });
        }
      });

      // Find groups with duplicates
      const duplicateGroups = [];
      batchGroups.forEach((entries, key) => {
        if (entries.length > 1) {
          duplicateGroups.push({ key, entries });
          totalBatchDupesFound += (entries.length - 1); // count extras
        }
      });

      if (duplicateGroups.length > 0) {
        chatsWithBatchDupes++;
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📄 userChat _id: ${doc._id}`);
        console.log(`   Total messages: ${doc.messages.length}`);
        console.log(`   Duplicate batch groups found: ${duplicateGroups.length}`);
        console.log(`   Total extra messages: ${totalBatchDupesFound} (so far)`);

        duplicateGroups.forEach(group => {
          console.log(`\n→ Duplicate batch key: ${group.key}`);
          console.log(`  Copies: ${group.entries.length}`);

          // Sort by createdAt to detect timing
          group.entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

          group.entries.forEach((entry, i) => {
            const time = new Date(entry.createdAt).toISOString();
            console.log(`  [${i+1}] arrayIndex: ${entry.arrayIndex} | createdAt: ${time}`);
            console.log(`      imageUrl: ${entry.imageUrl}`);
            console.log(`      type: ${entry.type} | taskId: ${entry.taskId}`);
            console.log(`      title: ${entry.title}`);
            console.log(`      content: ${entry.contentPreview}`);
            console.log('  ───────────────────────────────────────');
          });

          // Time delta between first and last duplicate
          if (group.entries.length > 1) {
            const first = new Date(group.entries[0].createdAt);
            const last = new Date(group.entries[group.entries.length - 1].createdAt);
            const deltaMs = last - first;
            console.log(`  Time span of duplicates: ${deltaMs} ms (${(deltaMs/1000).toFixed(2)} seconds)`);
            if (deltaMs < 5000) {
              console.log(`  ⚠️ VERY FAST → strong sign of race condition / multiple handlers`);
            }
          }
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('DEBUG SUMMARY');
    console.log('='.repeat(60));
    console.log(`Chats scanned: ${totalChatsScanned}`);
    console.log(`Chats with batch duplicates: ${chatsWithBatchDupes}`);
    console.log(`Total extra duplicate batch messages found: ${totalBatchDupesFound}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
    console.log('\nDisconnected.');
  }
}

debugBatchDuplicates();