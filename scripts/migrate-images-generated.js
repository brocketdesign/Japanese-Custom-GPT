const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

/**
 * Migration Script: Update images_generated collection based on existing images in gallery
 * This script will:
 * 1. Read all images from gallery collection
 * 2. Group images by userId and chatId
 * 3. Count total images generated per user per chat
 * 4. Update the images_generated collection with proper counts
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

async function migrateImagesGenerated() {
    const startTime = Date.now();
    console.log('🚀 Starting images_generated migration...');
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
        const galleryCollection = db.collection('gallery');
        const imagesGeneratedCollection = db.collection('images_generated');
        const chatsCollection = db.collection('chats');
        const usersCollection = db.collection('users');
        
        // Get total gallery documents to process
        const totalGalleryDocs = await galleryCollection.countDocuments();
        console.log(`📊 Total gallery documents to process: ${totalGalleryDocs}`);
        
        if (totalGalleryDocs === 0) {
            console.log('⚠️ No gallery documents found. Nothing to migrate.');
            return;
        }
        
        // Clear existing images_generated collection for fresh migration
        console.log('🗑️ Clearing existing images_generated collection...');
        const deletedCount = await imagesGeneratedCollection.deleteMany({});
        console.log(`   Deleted ${deletedCount.deletedCount} existing records`);
        
        // Process gallery documents in batches
        const batchSize = 100;
        let processedDocs = 0;
        let totalImagesProcessed = 0;
        let totalUsersProcessed = new Set();
        let totalChatsProcessed = new Set();
        const userChatImageCounts = new Map(); // Map to track image counts per user per chat
        
        console.log(`🔄 Processing gallery documents in batches of ${batchSize}...`);
        
        // Get all gallery documents with pagination
        for (let skip = 0; skip < totalGalleryDocs; skip += batchSize) {
            console.log(`\n📦 Processing batch ${Math.floor(skip / batchSize) + 1}/${Math.ceil(totalGalleryDocs / batchSize)}`);
            console.log(`   Range: ${skip + 1} - ${Math.min(skip + batchSize, totalGalleryDocs)}`);
            
            const galleryBatch = await galleryCollection
                .find({})
                .skip(skip)
                .limit(batchSize)
                .toArray();
            
            console.log(`   📋 Retrieved ${galleryBatch.length} gallery documents from database`);
            
            // Process each gallery document in the batch
            for (const galleryDoc of galleryBatch) {
                try {
                    const { userId, chatId, images } = galleryDoc;
                    
                    if (!userId || !chatId) {
                        console.warn(`   ⚠️ Skipping gallery document with missing userId (${userId}) or chatId (${chatId})`);
                        continue;
                    }
                    
                    if (!images || !Array.isArray(images) || images.length === 0) {
                        console.log(`   📝 Gallery document for user ${userId}, chat ${chatId} has no images`);
                        continue;
                    }
                    
                    // Count images for this user/chat combination
                    const imageCount = images.length;
                    const userChatKey = `${userId.toString()}_${chatId.toString()}`;
                    
                    // Add to our tracking map
                    if (userChatImageCounts.has(userChatKey)) {
                        userChatImageCounts.set(userChatKey, userChatImageCounts.get(userChatKey) + imageCount);
                    } else {
                        userChatImageCounts.set(userChatKey, imageCount);
                    }
                    
                    totalImagesProcessed += imageCount;
                    totalUsersProcessed.add(userId.toString());
                    totalChatsProcessed.add(chatId.toString());
                    
                    console.log(`   ✅ Processed ${imageCount} images for user ${userId}, chat ${chatId}`);
                    
                } catch (error) {
                    console.error(`   ❌ Error processing gallery document:`, error);
                }
            }
            
            processedDocs += galleryBatch.length;
            console.log(`   📊 Batch completed. Processed ${processedDocs}/${totalGalleryDocs} gallery documents`);
        }
        
        console.log(`\n📈 Processing Summary:`);
        console.log(`   Total gallery documents processed: ${processedDocs}`);
        console.log(`   Total images found: ${totalImagesProcessed}`);
        console.log(`   Unique users found: ${totalUsersProcessed.size}`);
        console.log(`   Unique chats found: ${totalChatsProcessed.size}`);
        console.log(`   User-Chat combinations: ${userChatImageCounts.size}`);
        
        // Now create entries in images_generated collection
        console.log(`\n💾 Creating entries in images_generated collection...`);
        
        const insertBatch = [];
        let insertedCount = 0;
        let skippedInvalidCount = 0;
        
        for (const [userChatKey, imageCount] of userChatImageCounts.entries()) {
            try {
                const [userIdStr, chatIdStr] = userChatKey.split('_');
                
                // Validate ObjectIds
                if (!ObjectId.isValid(userIdStr) || !ObjectId.isValid(chatIdStr)) {
                    console.warn(`   ⚠️ Invalid ObjectId format for user ${userIdStr} or chat ${chatIdStr}`);
                    skippedInvalidCount++;
                    continue;
                }
                
                const userId = new ObjectId(userIdStr);
                const chatId = new ObjectId(chatIdStr);
                
                // Verify user and chat exist
                const [userExists, chatExists] = await Promise.all([
                    usersCollection.findOne({ _id: userId }, { projection: { _id: 1 } }),
                    chatsCollection.findOne({ _id: chatId }, { projection: { _id: 1 } })
                ]);
                
                if (!userExists) {
                    console.warn(`   ⚠️ User ${userIdStr} not found, skipping`);
                    skippedInvalidCount++;
                    continue;
                }
                
                if (!chatExists) {
                    console.warn(`   ⚠️ Chat ${chatIdStr} not found, skipping`);
                    skippedInvalidCount++;
                    continue;
                }
                
                // Create document for images_generated collection
                const imageGeneratedDoc = {
                    userId: userId,
                    chatId: chatId,
                    generationCount: imageCount,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                insertBatch.push(imageGeneratedDoc);
                
                // Insert in batches of 1000
                if (insertBatch.length >= 1000) {
                    await imagesGeneratedCollection.insertMany(insertBatch);
                    insertedCount += insertBatch.length;
                    console.log(`   💾 Inserted batch of ${insertBatch.length} records. Total: ${insertedCount}`);
                    insertBatch.length = 0; // Clear the batch
                }
                
            } catch (error) {
                console.error(`   ❌ Error processing user-chat combination ${userChatKey}:`, error);
                skippedInvalidCount++;
            }
        }
        
        // Insert remaining documents
        if (insertBatch.length > 0) {
            await imagesGeneratedCollection.insertMany(insertBatch);
            insertedCount += insertBatch.length;
            console.log(`   💾 Inserted final batch of ${insertBatch.length} records. Total: ${insertedCount}`);
        }
        
        // Create indexes for better performance
        console.log(`\n🔍 Creating indexes on images_generated collection...`);
        try {
            await imagesGeneratedCollection.createIndex({ userId: 1, chatId: 1 }, { unique: true });
            await imagesGeneratedCollection.createIndex({ userId: 1 });
            await imagesGeneratedCollection.createIndex({ chatId: 1 });
            await imagesGeneratedCollection.createIndex({ createdAt: 1 });
            console.log(`   ✅ Indexes created successfully`);
        } catch (error) {
            console.error(`   ⚠️ Error creating indexes:`, error);
        }
        
        // Final verification
        console.log(`\n🔍 Performing final verification...`);
        const finalCount = await imagesGeneratedCollection.countDocuments();
        const totalGeneratedImages = await imagesGeneratedCollection.aggregate([
            { $group: { _id: null, total: { $sum: '$generationCount' } } }
        ]).toArray();
        
        console.log(`\n🎉 Migration completed successfully!`);
        console.log(`📊 Final Statistics:`);
        console.log(`   Records created in images_generated: ${insertedCount}`);
        console.log(`   Records verified in collection: ${finalCount}`);
        console.log(`   Total images counted: ${totalGeneratedImages.length > 0 ? totalGeneratedImages[0].total : 0}`);
        console.log(`   Original images found: ${totalImagesProcessed}`);
        console.log(`   Skipped invalid records: ${skippedInvalidCount}`);
        console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
        
        // Verify data integrity
        if (totalGeneratedImages.length > 0 && totalGeneratedImages[0].total === totalImagesProcessed) {
            console.log(`✅ Data integrity check passed - image counts match!`);
        } else {
            console.warn(`⚠️ Data integrity check failed - image counts don't match!`);
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
        
        console.log(`\n📋 Sample data from images_generated collection:`);
        const sampleDocs = await db.collection('images_generated')
            .find({})
            .sort({ generationCount: -1 })
            .limit(5)
            .toArray();
        
        sampleDocs.forEach((doc, index) => {
            console.log(`   ${index + 1}. User: ${doc.userId}, Chat: ${doc.chatId}, Count: ${doc.generationCount}`);
        });
        
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
        await migrateImagesGenerated();
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
    migrateImagesGenerated,
    displaySampleData
};
