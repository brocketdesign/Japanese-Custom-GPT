/**
 * Migration script to generate thumbnails for existing images
 * 
 * Usage:
 *   node models/migrate-thumbnails.js [options]
 * 
 * Options:
 *   --batch-size=N    Process N images at a time (default: 10)
 *   --skip=N          Skip first N galleries (default: 0)
 *   --limit=N         Process only N galleries (default: all)
 *   --dry-run         Don't actually update the database, just log what would be done
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { generateThumbnailFromUrl } = require('./tool');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
    return acc;
}, {});

const BATCH_SIZE = parseInt(args['batch-size']) || 10;
const SKIP = parseInt(args['skip']) || 0;
const LIMIT = parseInt(args['limit']) || 0;
const DRY_RUN = args['dry-run'] === true;

console.log('='.repeat(60));
console.log('Thumbnail Migration Script');
console.log('='.repeat(60));
console.log(`Configuration:`);
console.log(`  - Batch Size: ${BATCH_SIZE}`);
console.log(`  - Skip: ${SKIP}`);
console.log(`  - Limit: ${LIMIT || 'All'}`);
console.log(`  - Dry Run: ${DRY_RUN}`);
console.log('='.repeat(60));

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateGalleryThumbnails() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('Error: MONGODB_URI environment variable is not set');
        process.exit(1);
    }

    const client = new MongoClient(mongoUri);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db();
        const galleryCollection = db.collection('gallery');
        
        // Count total galleries
        const totalGalleries = await galleryCollection.countDocuments();
        console.log(`Total galleries in database: ${totalGalleries}`);
        
        // Build query options
        const queryOptions = {};
        if (SKIP > 0) {
            queryOptions.skip = SKIP;
        }
        if (LIMIT > 0) {
            queryOptions.limit = LIMIT;
        }
        
        // Get all galleries
        const galleries = await galleryCollection.find({}, queryOptions).toArray();
        console.log(`Processing ${galleries.length} galleries (skipped: ${SKIP})`);
        
        let processedImages = 0;
        let skippedImages = 0;
        let failedImages = 0;
        let updatedImages = 0;
        
        for (let g = 0; g < galleries.length; g++) {
            const gallery = galleries[g];
            const galleryId = gallery._id;
            
            console.log(`\n[Gallery ${g + 1}/${galleries.length}] Processing gallery: ${galleryId}`);
            
            if (!gallery.images || !Array.isArray(gallery.images)) {
                console.log('  No images array found, skipping');
                continue;
            }
            
            const images = gallery.images;
            console.log(`  Found ${images.length} images`);
            
            // Process images in batches
            for (let i = 0; i < images.length; i += BATCH_SIZE) {
                const batch = images.slice(i, i + BATCH_SIZE);
                console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(images.length / BATCH_SIZE)}`);
                
                const batchPromises = batch.map(async (image, batchIndex) => {
                    const imageIndex = i + batchIndex;
                    
                    // Skip if already has thumbnail
                    if (image.thumbnailUrl) {
                        skippedImages++;
                        return { status: 'skipped', imageId: image._id };
                    }
                    
                    // Skip if no imageUrl
                    if (!image.imageUrl) {
                        console.log(`    [${imageIndex}] No imageUrl, skipping`);
                        skippedImages++;
                        return { status: 'skipped', imageId: image._id };
                    }
                    
                    processedImages++;
                    
                    if (DRY_RUN) {
                        console.log(`    [${imageIndex}] [DRY-RUN] Would generate thumbnail for: ${image.imageUrl.substring(0, 60)}...`);
                        return { status: 'dry-run', imageId: image._id };
                    }
                    
                    try {
                        console.log(`    [${imageIndex}] Generating thumbnail for image ${image._id}...`);
                        const { thumbnailUrl } = await generateThumbnailFromUrl(image.imageUrl);
                        
                        if (thumbnailUrl) {
                            // Update the specific image in the gallery
                            await galleryCollection.updateOne(
                                { _id: galleryId, 'images._id': image._id },
                                { $set: { 'images.$.thumbnailUrl': thumbnailUrl } }
                            );
                            updatedImages++;
                            console.log(`    [${imageIndex}] ✓ Thumbnail generated and saved`);
                            return { status: 'success', imageId: image._id, thumbnailUrl };
                        } else {
                            console.log(`    [${imageIndex}] ✗ Failed to generate thumbnail (no URL returned)`);
                            failedImages++;
                            return { status: 'failed', imageId: image._id };
                        }
                    } catch (error) {
                        console.error(`    [${imageIndex}] ✗ Error: ${error.message}`);
                        failedImages++;
                        return { status: 'error', imageId: image._id, error: error.message };
                    }
                });
                
                // Wait for batch to complete
                await Promise.all(batchPromises);
                
                // Small delay between batches to avoid overwhelming the system
                if (i + BATCH_SIZE < images.length) {
                    await sleep(100);
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('Migration Complete!');
        console.log('='.repeat(60));
        console.log(`Summary:`);
        console.log(`  - Total processed: ${processedImages}`);
        console.log(`  - Successfully updated: ${updatedImages}`);
        console.log(`  - Skipped (already had thumbnail): ${skippedImages}`);
        console.log(`  - Failed: ${failedImages}`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('MongoDB connection closed');
    }
}

// Run the migration
migrateGalleryThumbnails().catch(console.error);
