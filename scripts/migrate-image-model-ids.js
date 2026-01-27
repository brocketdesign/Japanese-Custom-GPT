const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

/**
 * Migration Script: Add imageModelId to existing images in gallery collection
 * This script will:
 * 1. Read all images from gallery collection
 * 2. For each image with a taskId, look up the task to get imageModelId
 * 3. If task doesn't have imageModelId, fall back to chat's imageModel
 * 4. Update the image document with the imageModelId
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

async function migrateImageModelIds() {
    const startTime = Date.now();
    console.log('🚀 Starting imageModelId migration...');
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
        const tasksCollection = db.collection('tasks');
        const chatsCollection = db.collection('chats');
        
        // Get total gallery documents to process
        const totalGalleryDocs = await galleryCollection.countDocuments();
        console.log(`📊 Total gallery documents to process: ${totalGalleryDocs}`);
        
        if (totalGalleryDocs === 0) {
            console.log('⚠️ No gallery documents found. Nothing to migrate.');
            return;
        }
        
        // Statistics
        let processedDocs = 0;
        let totalImagesProcessed = 0;
        let imagesUpdated = 0;
        let imagesUpdatedFromTask = 0;
        let imagesUpdatedFromChat = 0;
        let imagesSkipped = 0;
        let imagesNoTask = 0;
        let imagesAlreadyHaveModel = 0;
        let taskNotFound = 0;
        let taskNoModelId = 0;
        let chatNoModelId = 0;
        
        // Build a cache of taskId -> imageModelId for efficiency
        console.log('\n📦 Building task cache for imageModelId lookups...');
        const taskCache = new Map();
        
        const tasksCursor = tasksCollection.find(
            { imageModelId: { $exists: true, $ne: null } },
            { projection: { taskId: 1, imageModelId: 1 } }
        );
        
        let tasksCached = 0;
        for await (const task of tasksCursor) {
            if (task.taskId && task.imageModelId) {
                taskCache.set(task.taskId, task.imageModelId);
                tasksCached++;
            }
        }
        console.log(`   ✅ Cached ${tasksCached} tasks with imageModelId`);
        
        // Build a cache of chatId -> imageModel for fallback
        console.log('\n📦 Building chat cache for imageModel fallback...');
        const chatCache = new Map();
        
        const chatsCursor = chatsCollection.find(
            { imageModel: { $exists: true, $ne: null } },
            { projection: { _id: 1, imageModel: 1 } }
        );
        
        let chatsCached = 0;
        for await (const chat of chatsCursor) {
            if (chat._id && chat.imageModel) {
                chatCache.set(chat._id.toString(), chat.imageModel);
                chatsCached++;
            }
        }
        console.log(`   ✅ Cached ${chatsCached} chats with imageModel`);
        
        // Process gallery documents in batches
        const batchSize = 50;
        console.log(`\n🔄 Processing gallery documents in batches of ${batchSize}...`);
        
        for (let skip = 0; skip < totalGalleryDocs; skip += batchSize) {
            const batchNum = Math.floor(skip / batchSize) + 1;
            const totalBatches = Math.ceil(totalGalleryDocs / batchSize);
            console.log(`\n📦 Processing batch ${batchNum}/${totalBatches}`);
            console.log(`   Range: ${skip + 1} - ${Math.min(skip + batchSize, totalGalleryDocs)}`);
            
            const galleryBatch = await galleryCollection
                .find({})
                .skip(skip)
                .limit(batchSize)
                .toArray();
            
            // Process each gallery document in the batch
            for (const galleryDoc of galleryBatch) {
                try {
                    const { _id: galleryId, chatId, images } = galleryDoc;
                    
                    if (!images || !Array.isArray(images) || images.length === 0) {
                        processedDocs++;
                        continue;
                    }
                    
                    // Get chat's imageModel as fallback
                    const chatIdStr = chatId ? chatId.toString() : null;
                    const chatImageModel = chatIdStr ? chatCache.get(chatIdStr) : null;
                    
                    let docUpdated = false;
                    const updatedImages = [];
                    
                    for (let i = 0; i < images.length; i++) {
                        const image = images[i];
                        totalImagesProcessed++;
                        
                        // Skip if image already has imageModelId
                        if (image.imageModelId) {
                            imagesAlreadyHaveModel++;
                            updatedImages.push(image);
                            continue;
                        }
                        
                        let foundModelId = null;
                        let source = null;
                        
                        // First try: Look up imageModelId from task
                        if (image.taskId) {
                            foundModelId = taskCache.get(image.taskId);
                            
                            if (!foundModelId) {
                                // Try direct lookup if not in cache
                                const task = await tasksCollection.findOne(
                                    { taskId: image.taskId },
                                    { projection: { imageModelId: 1 } }
                                );
                                
                                if (task && task.imageModelId) {
                                    foundModelId = task.imageModelId;
                                    taskCache.set(image.taskId, task.imageModelId);
                                }
                            }
                            
                            if (foundModelId) {
                                source = 'task';
                            }
                        }
                        
                        // Second try: Fall back to chat's imageModel
                        if (!foundModelId && chatImageModel) {
                            foundModelId = chatImageModel;
                            source = 'chat';
                        }
                        
                        // Update image if we found a model ID
                        if (foundModelId) {
                            image.imageModelId = foundModelId;
                            docUpdated = true;
                            imagesUpdated++;
                            
                            if (source === 'task') {
                                imagesUpdatedFromTask++;
                            } else {
                                imagesUpdatedFromChat++;
                            }
                        } else {
                            // Could not find a model ID from any source
                            if (!image.taskId) {
                                imagesNoTask++;
                            } else {
                                taskNoModelId++;
                            }
                            if (!chatImageModel) {
                                chatNoModelId++;
                            }
                        }
                        
                        updatedImages.push(image);
                    }
                    
                    // Update the gallery document if any images were modified
                    if (docUpdated) {
                        await galleryCollection.updateOne(
                            { _id: galleryId },
                            { $set: { images: updatedImages } }
                        );
                    }
                    
                    processedDocs++;
                    
                } catch (error) {
                    console.error(`   ❌ Error processing gallery document:`, error);
                    processedDocs++;
                }
            }
            
            // Progress update
            const progress = ((processedDocs / totalGalleryDocs) * 100).toFixed(1);
            console.log(`   📊 Progress: ${progress}% (${processedDocs}/${totalGalleryDocs} docs, ${imagesUpdated} images updated)`);
        }
        
        // Final statistics
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎉 Migration completed!`);
        console.log(`${'='.repeat(60)}`);
        console.log(`\n📊 Final Statistics:`);
        console.log(`   Gallery documents processed: ${processedDocs}`);
        console.log(`   Total images processed: ${totalImagesProcessed}`);
        console.log(`   Images updated with imageModelId: ${imagesUpdated}`);
        console.log(`      - From task: ${imagesUpdatedFromTask}`);
        console.log(`      - From chat (fallback): ${imagesUpdatedFromChat}`);
        console.log(`   Images already had imageModelId: ${imagesAlreadyHaveModel}`);
        console.log(`   Images could not be updated: ${totalImagesProcessed - imagesUpdated - imagesAlreadyHaveModel}`);
        console.log(`   Duration: ${duration} seconds`);
        
        // Verification
        console.log(`\n🔍 Verifying migration...`);
        const verifyPipeline = [
            { $unwind: '$images' },
            {
                $group: {
                    _id: null,
                    totalImages: { $sum: 1 },
                    withModelId: {
                        $sum: {
                            $cond: [{ $ifNull: ['$images.imageModelId', false] }, 1, 0]
                        }
                    }
                }
            }
        ];
        
        const verifyResult = await galleryCollection.aggregate(verifyPipeline).toArray();
        if (verifyResult.length > 0) {
            const { totalImages, withModelId } = verifyResult[0];
            const percentage = ((withModelId / totalImages) * 100).toFixed(1);
            console.log(`   Total images in gallery: ${totalImages}`);
            console.log(`   Images with imageModelId: ${withModelId} (${percentage}%)`);
        }
        
        // Show sample of models found
        console.log(`\n📋 Sample of imageModelIds found:`);
        const modelSample = await galleryCollection.aggregate([
            { $unwind: '$images' },
            { $match: { 'images.imageModelId': { $exists: true, $ne: null } } },
            { $group: { _id: '$images.imageModelId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();
        
        modelSample.forEach((model, idx) => {
            console.log(`   ${idx + 1}. ${model._id}: ${model.count} images`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Dry run mode - just shows statistics without making changes
async function dryRun() {
    console.log('🔍 Running in DRY RUN mode (no changes will be made)...\n');
    
    let client;
    
    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db(MONGODB_NAME);
        
        const galleryCollection = db.collection('gallery');
        const tasksCollection = db.collection('tasks');
        
        // Count images with and without imageModelId
        const imageStats = await galleryCollection.aggregate([
            { $unwind: '$images' },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    withModelId: {
                        $sum: { $cond: [{ $ifNull: ['$images.imageModelId', false] }, 1, 0] }
                    },
                    withTaskId: {
                        $sum: { $cond: [{ $ifNull: ['$images.taskId', false] }, 1, 0] }
                    }
                }
            }
        ]).toArray();
        
        if (imageStats.length > 0) {
            const { total, withModelId, withTaskId } = imageStats[0];
            console.log(`📊 Current Image Statistics:`);
            console.log(`   Total images: ${total}`);
            console.log(`   Already have imageModelId: ${withModelId} (${((withModelId/total)*100).toFixed(1)}%)`);
            console.log(`   Have taskId (can be migrated): ${withTaskId} (${((withTaskId/total)*100).toFixed(1)}%)`);
            console.log(`   Without taskId (cannot be migrated): ${total - withTaskId}`);
        }
        
        // Count tasks with imageModelId
        const tasksWithModelId = await tasksCollection.countDocuments({
            imageModelId: { $exists: true, $ne: null }
        });
        console.log(`\n📋 Tasks with imageModelId: ${tasksWithModelId}`);
        
        // Sample of task imageModelIds
        const taskModels = await tasksCollection.aggregate([
            { $match: { imageModelId: { $exists: true, $ne: null } } },
            { $group: { _id: '$imageModelId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();
        
        console.log(`\n📋 Top imageModelIds in tasks collection:`);
        taskModels.forEach((model, idx) => {
            console.log(`   ${idx + 1}. ${model._id}: ${model.count} tasks`);
        });
        
    } catch (error) {
        console.error('Error in dry run:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--dry-run') || args.includes('-d')) {
        await dryRun();
    } else {
        console.log('💡 Tip: Run with --dry-run to see statistics without making changes\n');
        await migrateImageModelIds();
    }
}

// Execute the script
if (require.main === module) {
    main();
}

module.exports = {
    migrateImageModelIds,
    dryRun
};
