const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'japanese-custom-gpt';

/**
 * Parse timestamp string to Date object
 * Handles format: "10/2/2025, 3:28:19 PM" (en-US, Asia/Tokyo timezone)
 */
function parseTimestampToDate(timestamp) {
  if (!timestamp) return null;
  
  try {
    // The timestamp is in format "M/D/YYYY, H:MM:SS AM/PM"
    // We'll parse it as a Date object
    const date = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.error(`Invalid timestamp: ${timestamp}`);
      return null;
    }
    
    return date;
  } catch (error) {
    console.error(`Error parsing timestamp "${timestamp}":`, error.message);
    return null;
  }
}

/**
 * Check if a date is today
 */
function isToday(date) {
  if (!date) return false;
  const today = new Date();
  const checkDate = new Date(date);
  return checkDate.getDate() === today.getDate() &&
         checkDate.getMonth() === today.getMonth() &&
         checkDate.getFullYear() === today.getFullYear();
}

async function migrateMessageTimestamps() {
  console.log('🔄 Starting message timestamp migration...\n');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(DB_NAME);
    console.log(`📂 Using database: ${DB_NAME}\n`);
    
    // List all collections to verify
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name).join(', '), '\n');
    
    const userChatCollection = db.collection('userChat');
    
    // Get all userChat documents
    const totalDocs = await userChatCollection.countDocuments();
    console.log(`📊 Found ${totalDocs} userChat documents\n`);
    
    if (totalDocs === 0) {
      console.log('⚠️  No userChat documents found. Please check:');
      console.log('   1. MONGODB_URI environment variable is correct');
      console.log('   2. DB_NAME environment variable matches your database');
      console.log('   3. The collection name is exactly "userChat" (case-sensitive)\n');
      
      console.log('Current connection details:');
      console.log(`   - URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
      console.log(`   - Database: ${DB_NAME}\n`);
      
      return;
    }
    
    let processedChats = 0;
    let processedMessages = 0;
    let updatedMessagesCount = 0;
    let resetMessagesCount = 0;
    let skippedMessages = 0;
    
    // Process in batches for better performance
    const batchSize = 100;
    let skip = 0;
    
    while (skip < totalDocs) {
      const userChats = await userChatCollection
        .find({}) // Only process known roles
        .sort({ _id: -1 }) // Ensure consistent order
        .skip(skip)
        .limit(batchSize)
        .toArray();
      
      for (const userChat of userChats) {
        if (!userChat.messages || userChat.messages.length === 0) {
          processedChats++;
          continue;
        }
        
        let needsUpdate = false;
        const updatedMessages = userChat.messages.map(message => {
          processedMessages++;
          
          // Reset if createdAt is today (from failed migration)
          if (message.createdAt && isToday(message.createdAt)) {
            needsUpdate = true;
            resetMessagesCount++;
            const messageWithoutCreatedAt = { ...message };
            delete messageWithoutCreatedAt.createdAt;
            message = messageWithoutCreatedAt;
          }
          
            // Check only messages with role: { $in: ['user', 'assistant'] }
            if (!message.role || !['user', 'assistant'].includes(message.role)) {
              return message;
            }
            
          // Skip if message already has valid createdAt (not today)
          if (message.createdAt && !isToday(message.createdAt)) {
            return message;
          }

          // Try to parse timestamp
          if (message.timestamp) {
            const createdAt = parseTimestampToDate(message.timestamp);
            
            if (createdAt) {
              needsUpdate = true;
              updatedMessagesCount++;
              return {
                ...message,
                createdAt
              };
            }
          }
          
          // Try to use updatedAt as fallback
          if (message.updatedAt) {
            const createdAt = message.updatedAt instanceof Date ? message.updatedAt : new Date(message.updatedAt);
            
            if (createdAt && !isNaN(createdAt.getTime())) {
              needsUpdate = true;
              updatedMessagesCount++;
              return {
                ...message,
                createdAt
              };
            }
          }
          
          // No valid timestamp found - skip this message (no fallback)
          skippedMessages++;
          return message;
        });
        
        // Update the document if needed
        if (needsUpdate) {
          await userChatCollection.updateOne(
            { _id: userChat._id },
            { $set: { messages: updatedMessages } }
          );
        }
        
        processedChats++;
        
        // Show progress
        if (processedChats % 100 === 0) {
          console.log(`⏳ Progress: ${processedChats}/${totalDocs} chats processed...`);
        }
      }
      
      skip += batchSize;
    }
    
    console.log('\n✅ Migration completed successfully!\n');
    console.log('📈 Migration Statistics:');
    console.log(`   - Total userChat documents: ${totalDocs}`);
    console.log(`   - Total messages processed: ${processedMessages}`);
    console.log(`   - Messages updated with createdAt: ${updatedMessagesCount}`);
    console.log(`   - Messages reset (had today's date): ${resetMessagesCount}`);
    console.log(`   - Messages skipped (no valid timestamp): ${skippedMessages}`);
    console.log(`   - Chats processed: ${processedChats}\n`);
    
    // Verify by sampling
    console.log('🔍 Verification: Sampling 5 random messages...\n');
    const sampleChats = await userChatCollection
      .find({ 'messages.0': { $exists: true } })
      .limit(5)
      .toArray();
    
    sampleChats.forEach((chat, index) => {
      const lastMessage = chat.messages[chat.messages.length - 1];
      console.log(`Sample ${index + 1}:`);
      console.log(`   - Chat ID: ${chat._id}`);
      console.log(`   - Message role: ${lastMessage.role}`);
      console.log(`   - Original timestamp: ${lastMessage.timestamp}`);
      console.log(`   - New createdAt: ${lastMessage.createdAt}`);
      console.log(`   - Has createdAt field: ${!!lastMessage.createdAt}\n`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the migration
migrateMessageTimestamps()
  .then(() => {
    console.log('\n✨ All done! You can now restart your server to see message trends in analytics.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
