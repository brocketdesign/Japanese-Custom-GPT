const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

/**
 * Migration Script: Create user_chat_stats collection based on existing userChat data
 * This script will:
 * 1. Read all userChat documents
 * 2. Count messages per user per chat (filtering to only user/assistant roles)
 * 3. Create/update the user_chat_stats collection with proper counts
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

async function migrateUserChatStats() {
    const startTime = Date.now();
    console.log('🚀 Starting user_chat_stats migration...');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    
    let client;
    
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(MONGODB_NAME);
        
        console.log('✅ Connected to MongoDB successfully');
        
        // Get collections
        const userChatCollection = db.collection('userChat');
        const userChatStatsCollection = db.collection('user_chat_stats');
        const usersCollection = db.collection('users');
        const chatsCollection = db.collection('chats');
        
        // Get total userChat documents to process
        const totalUserChatDocs = await userChatCollection.countDocuments();
        console.log(`📊 Total userChat documents to process: ${totalUserChatDocs}`);
        
        if (totalUserChatDocs === 0) {
            console.log('⚠️ No userChat documents found. Nothing to migrate.');
            return;
        }
        
        // Clear existing user_chat_stats collection for fresh migration
        console.log('🗑️ Clearing existing user_chat_stats collection...');
        const deletedCount = await userChatStatsCollection.deleteMany({});
        console.log(`   Deleted ${deletedCount.deletedCount} existing records`);
        
        // Process userChat documents in batches
        const batchSize = 100;
        let processedDocs = 0;
        let totalMessagesProcessed = 0;
        let totalUsersProcessed = new Set();
        let totalChatsProcessed = new Set();
        const insertBatch = [];
        let insertedCount = 0;
        let skippedInvalidCount = 0;
        
        console.log(`🔄 Processing userChat documents in batches of ${batchSize}...`);
        
        // Get all userChat documents with pagination
        for (let skip = 0; skip < totalUserChatDocs; skip += batchSize) {
            console.log(`\n📦 Processing batch ${Math.floor(skip / batchSize) + 1}/${Math.ceil(totalUserChatDocs / batchSize)}`);
            console.log(`   Range: ${skip + 1} - ${Math.min(skip + batchSize, totalUserChatDocs)}`);
            
            const userChatBatch = await userChatCollection
                .find({})
                .skip(skip)
                .limit(batchSize)
                .toArray();
            
            console.log(`   📋 Retrieved ${userChatBatch.length} userChat documents from database`);
            
            // Process each userChat document in the batch
            for (const userChatDoc of userChatBatch) {
                try {
                    const { _id: userChatId, userId, chatId, messages } = userChatDoc;
                    
                    if (!userId || !chatId) {
                        console.warn(`   ⚠️ Skipping userChat document with missing userId (${userId}) or chatId (${chatId})`);
                        skippedInvalidCount++;
                        continue;
                    }
                    
                    // Normalize IDs (handle both ObjectId and string formats)
                    let userIdObj, chatIdObj;
                    try {
                        userIdObj = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
                        chatIdObj = ObjectId.isValid(chatId) ? new ObjectId(chatId) : null;
                        
                        if (!userIdObj || !chatIdObj) {
                            console.warn(`   ⚠️ Invalid ObjectId format for userId (${userId}) or chatId (${chatId})`);
                            skippedInvalidCount++;
                            continue;
                        }
                    } catch (e) {
                        console.warn(`   ⚠️ Error parsing ObjectId: ${e.message}`);
                        skippedInvalidCount++;
                        continue;
                    }
                    
                    // Count messages (only user and assistant roles)
                    let messageCount = 0;
                    if (messages && Array.isArray(messages)) {
                        messageCount = messages.filter(msg => 
                            msg.role === 'user' || msg.role === 'assistant'
                        ).length;
                    }
                    
                    totalMessagesProcessed += messageCount;
                    totalUsersProcessed.add(userIdObj.toString());
                    totalChatsProcessed.add(chatIdObj.toString());
                    
                    // Create stats document
                    const statsDoc = {
                        userId: userIdObj,
                        chatId: chatIdObj,
                        userChatId: userChatId,
                        messageCount: messageCount,
                        createdAt: userChatDoc.createdAt || new Date(),
                        updatedAt: new Date()
                    };
                    
                    insertBatch.push(statsDoc);
                    
                    // Insert in batches of 1000
                    if (insertBatch.length >= 1000) {
                        await userChatStatsCollection.insertMany(insertBatch);
                        insertedCount += insertBatch.length;
                        console.log(`   💾 Inserted batch of ${insertBatch.length} records. Total: ${insertedCount}`);
                        insertBatch.length = 0; // Clear the batch
                    }
                    
                } catch (error) {
                    console.error(`   ❌ Error processing userChat document:`, error);
                    skippedInvalidCount++;
                }
            }
            
            processedDocs += userChatBatch.length;
            console.log(`   📊 Batch completed. Processed ${processedDocs}/${totalUserChatDocs} userChat documents`);
        }
        
        // Insert remaining documents
        if (insertBatch.length > 0) {
            await userChatStatsCollection.insertMany(insertBatch);
            insertedCount += insertBatch.length;
            console.log(`   💾 Inserted final batch of ${insertBatch.length} records. Total: ${insertedCount}`);
        }
        
        console.log(`\n📈 Processing Summary:`);
        console.log(`   Total userChat documents processed: ${processedDocs}`);
        console.log(`   Total messages counted: ${totalMessagesProcessed}`);
        console.log(`   Unique users found: ${totalUsersProcessed.size}`);
        console.log(`   Unique chats found: ${totalChatsProcessed.size}`);
        
        // Create indexes for better performance
        console.log(`\n🔍 Creating indexes on user_chat_stats collection...`);
        try {
            await userChatStatsCollection.createIndex({ userId: 1, chatId: 1 }, { unique: true });
            await userChatStatsCollection.createIndex({ userId: 1 });
            await userChatStatsCollection.createIndex({ chatId: 1 });
            await userChatStatsCollection.createIndex({ userChatId: 1 });
            await userChatStatsCollection.createIndex({ messageCount: -1 });
            console.log(`   ✅ Indexes created successfully`);
        } catch (error) {
            console.error(`   ⚠️ Error creating indexes:`, error);
        }
        
        // Final verification
        console.log(`\n🔍 Performing final verification...`);
        const finalCount = await userChatStatsCollection.countDocuments();
        const totalMessages = await userChatStatsCollection.aggregate([
            { $group: { _id: null, total: { $sum: '$messageCount' } } }
        ]).toArray();
        
        console.log(`\n🎉 Migration completed successfully!`);
        console.log(`📊 Final Statistics:`);
        console.log(`   Records created in user_chat_stats: ${insertedCount}`);
        console.log(`   Records verified in collection: ${finalCount}`);
        console.log(`   Total messages counted: ${totalMessages.length > 0 ? totalMessages[0].total : 0}`);
        console.log(`   Original messages found: ${totalMessagesProcessed}`);
        console.log(`   Skipped invalid records: ${skippedInvalidCount}`);
        console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
        
        // Verify data integrity
        if (totalMessages.length > 0 && totalMessages[0].total === totalMessagesProcessed) {
            console.log(`✅ Data integrity check passed - message counts match!`);
        } else {
            console.warn(`⚠️ Data integrity check: Found ${totalMessages.length > 0 ? totalMessages[0].total : 0} vs processed ${totalMessagesProcessed}`);
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 Database connection closed');
        }
    }
}

// Helper function to display sample data
async function displaySampleData() {
    let client;
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(MONGODB_NAME);
        
        console.log(`\n📋 Sample data from user_chat_stats collection (top 10 by message count):`);
        const sampleDocs = await db.collection('user_chat_stats')
            .find({})
            .sort({ messageCount: -1 })
            .limit(10)
            .toArray();
        
        for (const doc of sampleDocs) {
            // Get user and chat names for display
            const user = await db.collection('users').findOne(
                { _id: doc.userId },
                { projection: { nickname: 1, email: 1 } }
            );
            const chat = await db.collection('chats').findOne(
                { _id: doc.chatId },
                { projection: { name: 1 } }
            );
            
            console.log(`   User: ${user?.nickname || user?.email || doc.userId}, Chat: ${chat?.name || doc.chatId}, Messages: ${doc.messageCount}`);
        }
        
        // Show statistics
        const stats = await db.collection('user_chat_stats').aggregate([
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    totalMessages: { $sum: '$messageCount' },
                    avgMessages: { $avg: '$messageCount' },
                    maxMessages: { $max: '$messageCount' }
                }
            }
        ]).toArray();
        
        if (stats.length > 0) {
            console.log(`\n📊 Collection Statistics:`);
            console.log(`   Total user-chat combinations: ${stats[0].totalRecords}`);
            console.log(`   Total messages: ${stats[0].totalMessages}`);
            console.log(`   Average messages per chat: ${stats[0].avgMessages.toFixed(2)}`);
            console.log(`   Max messages in a single chat: ${stats[0].maxMessages}`);
        }
        
    } catch (error) {
        console.error('Error displaying sample data:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Main execution
async function main() {
    try {
        await migrateUserChatStats();
        await displaySampleData();
    } catch (error) {
        console.error('Script execution failed:', error);
        process.exit(1);
    }
}

// Execute the script
if (require.main === module) {
    main();
}

module.exports = {
    migrateUserChatStats,
    displaySampleData
};
