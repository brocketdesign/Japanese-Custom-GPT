const { MongoClient } = require('mongodb');
require('dotenv').config();

/**
 * Script to check and display all found imageModel values in chats
 * This script will:
 * 1. Connect to MongoDB
 * 2. Query the chats collection for distinct imageModel values
 * 3. Display the list of all found imageModel values
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

async function listImageModels() {
    const startTime = Date.now();
    console.log('🚀 Starting imageModel check...');
    console.log(`📅 Started at: ${new Date().toISOString()}`);

    let client;

    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(MONGODB_NAME);

        console.log('✅ Connected to MongoDB successfully');

        // Get chats collection
        const chatsCollection = db.collection('chats');

        // Get distinct imageModel values
        console.log('🔍 Finding distinct imageModel values...');
        const distinctImageModels = await chatsCollection.distinct('imageModel', { imageModel: { $exists: true, $ne: null } });

        console.log('📋 Found imageModel values:');
        console.log('=====================================');

        if (distinctImageModels.length === 0) {
            console.log('❌ No imageModel values found in chats collection.');
        } else {
            distinctImageModels.forEach((model, index) => {
                console.log(`${index + 1}. ${model}`);
            });
            console.log('=====================================');
            console.log(`✅ Total unique imageModel values: ${distinctImageModels.length}`);
        }

        // Also get count of chats per imageModel
        console.log('\n📊 Count of chats per imageModel:');
        console.log('=====================================');

        const pipeline = [
            { $match: { imageModel: { $exists: true, $ne: null } } },
            { $group: { _id: '$imageModel', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ];

        const modelCounts = await chatsCollection.aggregate(pipeline).toArray();

        if (modelCounts.length === 0) {
            console.log('❌ No chats with imageModel found.');
        } else {
            modelCounts.forEach((item, index) => {
                console.log(`${index + 1}. ${item._id}: ${item.count} chats`);
            });
        }

        const totalTime = Date.now() - startTime;
        console.log(`\n✅ Script completed in ${totalTime}ms`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            await client.close();
            console.log('🔌 Disconnected from MongoDB');
        }
    }
}

// Run the script
if (require.main === module) {
    listImageModels().catch(console.error);
}

module.exports = { listImageModels };