const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

/**
 * Migration Script: Migrate posts collection to unifiedPosts
 * 
 * This script will:
 * 1. Read all posts from the legacy 'posts' collection
 * 2. Transform them to the unified post schema
 * 3. Add new Phase 1 fields (visibility, requiredTier, isProfilePost)
 * 4. Insert into unifiedPosts collection
 * 5. Keep original posts collection for safety (can be deleted later)
 * 
 * Phase 1: Clean Up In-App Posts
 */

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_NAME = process.env.MONGODB_NAME;

// Post constants (matching unified-post-utils.js)
const POST_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  GALLERY_IMAGE: 'gallery_image'
};

const POST_SOURCES = {
  IMAGE_DASHBOARD: 'image_dashboard',
  VIDEO_DASHBOARD: 'video_dashboard',
  GALLERY: 'gallery',
  CRON_JOB: 'cron_job',
  API: 'api',
  CHAT: 'chat',
  PROFILE: 'profile'
};

const POST_STATUSES = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  FAILED: 'failed',
  PROCESSING: 'processing'
};

const POST_VISIBILITY = {
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  SUBSCRIBERS: 'subscribers',
  PRIVATE: 'private'
};

/**
 * Transform a legacy post to unified format
 */
function transformLegacyPost(legacyPost) {
  const { 
    _id,
    userId, 
    chatId, 
    image, 
    comment, 
    likes, 
    likedBy,
    comments, 
    createdAt,
    isPrivate 
  } = legacyPost;

  // Determine visibility from old isPrivate field
  const visibility = isPrivate === true ? POST_VISIBILITY.PRIVATE : POST_VISIBILITY.PUBLIC;

  return {
    // Keep original _id for reference, but we'll generate new _id
    legacyId: _id,
    userId: userId,
    type: POST_TYPES.IMAGE,
    source: POST_SOURCES.CHAT, // Legacy posts came from chat/gallery
    
    // Content - map from legacy structure
    content: {
      imageUrl: image?.imageUrl || '',
      thumbnailUrl: image?.imageUrl || '', // No separate thumbnail in old format
      prompt: image?.prompt || '',
      negativePrompt: '',
      caption: comment || '',
      model: image?.model || 'unknown'
    },
    
    // Metadata
    metadata: {
      sourceId: null,
      nsfw: image?.nsfw || false,
      chatId: chatId, // Keep reference to original chat
      width: null,
      height: null,
      seed: null,
      legacyMigrated: true // Flag to identify migrated posts
    },
    
    // Phase 1: Visibility and access control
    visibility: visibility,
    requiredTier: null,
    isProfilePost: true, // Make all legacy posts visible on profile
    
    // Status - all legacy posts are considered published
    status: POST_STATUSES.PUBLISHED,
    scheduledFor: null,
    publishedAt: createdAt || new Date(),
    
    // Social media
    autoPublish: false,
    socialPlatforms: [],
    socialPostIds: [],
    
    // Engagement - preserve existing data
    likes: likes || 0,
    likedBy: likedBy || [],
    comments: comments || [],
    views: 0,
    
    // Timestamps
    createdAt: createdAt || new Date(),
    updatedAt: new Date()
  };
}

async function migratePostsToUnified() {
  const startTime = Date.now();
  console.log('🚀 Starting posts migration to unifiedPosts...');
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
    const postsCollection = db.collection('posts');
    const unifiedPostsCollection = db.collection('unifiedPosts');
    const usersCollection = db.collection('users');
    
    // Get total posts to process
    const totalPosts = await postsCollection.countDocuments();
    console.log(`📊 Total legacy posts to process: ${totalPosts}`);
    
    if (totalPosts === 0) {
      console.log('⚠️ No posts found in legacy collection. Nothing to migrate.');
      return;
    }

    // Check for already migrated posts
    const alreadyMigrated = await unifiedPostsCollection.countDocuments({
      'metadata.legacyMigrated': true
    });
    console.log(`📋 Already migrated posts in unifiedPosts: ${alreadyMigrated}`);

    // Process posts in batches
    const batchSize = 100;
    let processedPosts = 0;
    let migratedPosts = 0;
    let skippedPosts = 0;
    let errorPosts = 0;
    const userPostCounts = new Map();
    
    console.log(`🔄 Processing posts in batches of ${batchSize}...`);
    
    for (let skip = 0; skip < totalPosts; skip += batchSize) {
      console.log(`\n📦 Processing batch ${Math.floor(skip / batchSize) + 1}/${Math.ceil(totalPosts / batchSize)}`);
      console.log(`   Range: ${skip + 1} - ${Math.min(skip + batchSize, totalPosts)}`);
      
      const postsBatch = await postsCollection
        .find({})
        .skip(skip)
        .limit(batchSize)
        .toArray();
      
      console.log(`   📋 Retrieved ${postsBatch.length} posts from database`);
      
      const postsToInsert = [];
      
      for (const legacyPost of postsBatch) {
        try {
          // Check if already migrated (by legacyId)
          const existingPost = await unifiedPostsCollection.findOne({
            legacyId: legacyPost._id
          });
          
          if (existingPost) {
            console.log(`   ⏩ Skipping already migrated post: ${legacyPost._id}`);
            skippedPosts++;
            continue;
          }
          
          // Validate required fields
          if (!legacyPost.userId) {
            console.warn(`   ⚠️ Skipping post with missing userId: ${legacyPost._id}`);
            errorPosts++;
            continue;
          }
          
          if (!legacyPost.image?.imageUrl) {
            console.warn(`   ⚠️ Skipping post with missing image URL: ${legacyPost._id}`);
            errorPosts++;
            continue;
          }
          
          // Transform to unified format
          const unifiedPost = transformLegacyPost(legacyPost);
          postsToInsert.push(unifiedPost);
          
          // Track user post count for update
          const userIdStr = legacyPost.userId.toString();
          userPostCounts.set(userIdStr, (userPostCounts.get(userIdStr) || 0) + 1);
          
        } catch (error) {
          console.error(`   ❌ Error processing post ${legacyPost._id}:`, error.message);
          errorPosts++;
        }
      }
      
      // Bulk insert for this batch
      if (postsToInsert.length > 0) {
        try {
          const result = await unifiedPostsCollection.insertMany(postsToInsert);
          migratedPosts += result.insertedCount;
          console.log(`   💾 Inserted ${result.insertedCount} posts in this batch`);
        } catch (insertError) {
          console.error(`   ❌ Error inserting batch:`, insertError.message);
          // Try inserting one by one as fallback
          for (const post of postsToInsert) {
            try {
              await unifiedPostsCollection.insertOne(post);
              migratedPosts++;
            } catch (singleError) {
              console.error(`   ❌ Failed to insert individual post:`, singleError.message);
              errorPosts++;
            }
          }
        }
      }
      
      processedPosts += postsBatch.length;
      console.log(`   📊 Batch completed. Processed ${processedPosts}/${totalPosts} posts`);
    }
    
    // Create indexes for better performance
    console.log(`\n🔍 Creating indexes on unifiedPosts collection...`);
    try {
      await unifiedPostsCollection.createIndex({ userId: 1 });
      await unifiedPostsCollection.createIndex({ userId: 1, isProfilePost: 1, visibility: 1 });
      await unifiedPostsCollection.createIndex({ userId: 1, status: 1 });
      await unifiedPostsCollection.createIndex({ visibility: 1, status: 1 });
      await unifiedPostsCollection.createIndex({ createdAt: -1 });
      await unifiedPostsCollection.createIndex({ 'metadata.legacyMigrated': 1 });
      await unifiedPostsCollection.createIndex({ legacyId: 1 }, { sparse: true });
      console.log(`   ✅ Indexes created successfully`);
    } catch (indexError) {
      console.error(`   ⚠️ Error creating indexes:`, indexError.message);
    }
    
    // Final verification
    console.log(`\n🔍 Performing final verification...`);
    const finalCount = await unifiedPostsCollection.countDocuments();
    const migratedCount = await unifiedPostsCollection.countDocuments({
      'metadata.legacyMigrated': true
    });
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Final Statistics:`);
    console.log(`   Total legacy posts: ${totalPosts}`);
    console.log(`   Posts processed: ${processedPosts}`);
    console.log(`   Posts migrated: ${migratedPosts}`);
    console.log(`   Posts skipped (already migrated): ${skippedPosts}`);
    console.log(`   Posts with errors: ${errorPosts}`);
    console.log(`   Total unified posts now: ${finalCount}`);
    console.log(`   Migrated posts in collection: ${migratedCount}`);
    console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(2)} seconds`);
    
    // Verify integrity
    const expectedTotal = migratedPosts + skippedPosts + errorPosts;
    if (expectedTotal === processedPosts) {
      console.log(`✅ Data integrity check passed!`);
    } else {
      console.warn(`⚠️ Data integrity check: ${processedPosts} processed != ${expectedTotal} (migrated + skipped + errors)`);
    }
    
    console.log(`\n📝 Note: The original 'posts' collection has been preserved.`);
    console.log(`   You can delete it later after verifying the migration.`);
    
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

/**
 * Display sample migrated data
 */
async function displaySampleData() {
  let client;
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_NAME);
    
    console.log(`\n📋 Sample migrated posts from unifiedPosts collection:`);
    const sampleDocs = await db.collection('unifiedPosts')
      .find({ 'metadata.legacyMigrated': true })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    
    if (sampleDocs.length === 0) {
      console.log('   No migrated posts found.');
      return;
    }
    
    sampleDocs.forEach((doc, index) => {
      console.log(`\n   ${index + 1}. Post ID: ${doc._id}`);
      console.log(`      Legacy ID: ${doc.legacyId}`);
      console.log(`      User: ${doc.userId}`);
      console.log(`      Type: ${doc.type}`);
      console.log(`      Source: ${doc.source}`);
      console.log(`      Visibility: ${doc.visibility}`);
      console.log(`      Status: ${doc.status}`);
      console.log(`      Caption: ${(doc.content?.caption || '').substring(0, 50)}...`);
      console.log(`      Likes: ${doc.likes}`);
      console.log(`      Created: ${doc.createdAt}`);
    });
    
  } catch (error) {
    console.error('Error displaying sample data:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Rollback migration - removes migrated posts from unifiedPosts
 */
async function rollbackMigration() {
  let client;
  try {
    console.log('⚠️ Starting migration rollback...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_NAME);
    
    const result = await db.collection('unifiedPosts').deleteMany({
      'metadata.legacyMigrated': true
    });
    
    console.log(`🗑️ Rollback completed. Deleted ${result.deletedCount} migrated posts.`);
    
  } catch (error) {
    console.error('Rollback failed:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--rollback')) {
    await rollbackMigration();
  } else if (args.includes('--sample')) {
    await displaySampleData();
  } else {
    await migratePostsToUnified();
    await displaySampleData();
  }
}

// Execute the script
if (require.main === module) {
  main().catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  migratePostsToUnified,
  displaySampleData,
  rollbackMigration,
  transformLegacyPost
};
