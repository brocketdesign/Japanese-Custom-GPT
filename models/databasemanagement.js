const  { deleteObjectFromUrl } = require('./tool')
const crypto = require('crypto');
const fastify = require('fastify');
const { ObjectId } = require('mongodb');

async function cleanupNonRegisteredUsers(db) {
    try {
        const usersCollection = db.collection('users');
        const collectionChat = db.collection('chats');
        const collectionUserChat = db.collection('userChat');
        const collectionMessageCount = db.collection('MessageCount');

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        console.log('Fetching non-registered users...');
        const nonRegisteredUsers = await usersCollection.find({
            email: { $exists: false },
            isTemporary: true,
        }).toArray();
        console.log(`Non-registered users found: ${nonRegisteredUsers.length}`);

        const userIds = nonRegisteredUsers.map(user => user._id);

        // Delete non-registered users and their related data
        if (userIds.length > 0) {
            console.log('Deleting users and related data...');
            await Promise.all([
                usersCollection.deleteMany({ _id: { $in: userIds } }),
                collectionChat.deleteMany({ userId: { $in: userIds } }),
                collectionUserChat.deleteMany({ userId: { $in: userIds } }),
                collectionMessageCount.deleteMany({ userId: { $in: userIds } })
            ]);
            console.log(`Deleted ${userIds.length} users and related data.`);
        } else {
            console.log('No users to delete.');
        }

        console.log('Fetching all user IDs...');
        const allUserIds = await usersCollection.distinct('_id');
        console.log(`All user IDs: ${allUserIds.length}`);
        
        /*
        console.log('Deleting orphaned records...');
        await Promise.all([
            collectionChat.deleteMany({ userId: { $nin: allUserIds, $exists: true } }),
            collectionUserChat.deleteMany({ userId: { $nin: allUserIds, $exists: true } }),
            collectionMessageCount.deleteMany({ userId: { $nin: allUserIds, $exists: true } })
        ]);

        console.log('Orphaned records deleted.');
        */
        return `${userIds.length} non-registered users and orphaned data deleted.`;
    } catch (error) {
        console.error(`Cleanup failed: ${error.message}`);
        throw new Error(`Cleanup failed: ${error.message}`);
    }
};
async function deleteOldRecords(db) {
    try {
        const collections = [
            db.collection('MessageIdeasCount'),
            db.collection('MessageCount'),
            db.collection('ImageCount')
        ];

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date to compare only the date, not time

        console.log('Deleting records with a date not from today...');

        await Promise.all(
            collections.map(async (collection) => {
                const result = await collection.deleteMany({
                    $expr: {
                        $lt: [
                            {
                                $dateFromString: {
                                    dateString: '$date',
                                    onError: today // Handles invalid date strings by defaulting to today's date
                                }
                            },
                            today
                        ]
                    }
                });
                console.log(`Deleted ${result.deletedCount} records from ${collection.collectionName}`);
            })
        );

        console.log('Old records deleted successfully.');
    } catch (error) {
        console.error(`Failed to delete old records: ${error.message}`);
        throw new Error(`Failed to delete old records: ${error.message}`);
    }
};
async function deleteCharactersWithoutDescription(db) {
    try {
        const charactersCollection = db.collection('characters');
        
        console.log('Deleting characters without a description...');
        const result = await charactersCollection.deleteMany({
            description: { $exists: false }
        });
        
        console.log(`Deleted ${result.deletedCount} characters without a description.`);
    } catch (error) {
        console.error(`Failed to delete characters: ${error.message}`);
        throw new Error(`Failed to delete characters: ${error.message}`);
    }
};
async function deleteClientsWithoutProductId(db) {
    try {
        const clientsCollection = db.collection('clients');
        
        console.log('Deleting clients without a productId...');
        const result = await clientsCollection.deleteMany({
            productId: { $exists: false }
        });
        
        console.log(`Deleted ${result.deletedCount} clients without a productId.`);
    } catch (error) {
        console.error(`Failed to delete clients: ${error.message}`);
        throw new Error(`Failed to delete clients: ${error.message}`);
    }
};
async function deleteUserChatsWithoutMessages(db) {
    try {
        const userChatCollection = db.collection('userChat');
        
        console.log('Deleting userChat documents without a messages field...');
        const result = await userChatCollection.deleteMany({
            messages: { $exists: false }
        });
        
        console.log(`Deleted ${result.deletedCount} userChat documents without a messages field.`);
    } catch (error) {
        console.error(`Failed to delete userChat documents: ${error.message}`);
        throw new Error(`Failed to delete userChat documents: ${error.message}`);
    }
};
async function cleanUpDatabase(db) {
    try {
      const chatsGalleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');
  
      // Step 1: Delete all images without an imageUrl
      console.log('Step 1: Deleting images without imageUrl...');
      const resultImages = await chatsGalleryCollection.updateMany(
        {},
        { $pull: { images: { imageUrl: { $exists: false } } } }
      );
      console.log(`Images without imageUrl deleted: ${resultImages.modifiedCount} documents modified.`);
  
      // Step 2: Delete chats without thumbnailUrl
      console.log('Step 2: Deleting chats without thumbnailUrl...');
      const resultChats = await chatsCollection.deleteMany({
        thumbnailUrl: { $exists: false },
        chatImageUrl: { $exists: false },
      });
      console.log(`Chats without thumbnailUrl deleted: ${resultChats.deletedCount} documents deleted.`);
  
      // Step 3: Delete orphan galleries (galleries with chatId that do not exist in chats)
      console.log('Step 3: Deleting orphan galleries...');
      
      // Find all valid chatIds
      const validChatIds = await chatsCollection.distinct('_id');
      console.log(`Valid chatIds: ${validChatIds.length}`);
  
      // Delete galleries whose chatId is not in the valid chatIds
      const resultOrphanGalleries = await chatsGalleryCollection.deleteMany({
        chatId: { $nin: validChatIds }
      });
      console.log(`Orphan galleries deleted: ${resultOrphanGalleries.deletedCount} documents deleted.`);
  
      console.log('Clean up complete.');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };
  async function updateAllUsersImageLikeCount(db) {
    try {
      const usersCollection = db.collection('users');
      const imagesLikesCollection = db.collection('images_likes');
  
      // Fetch distinct userIds from the images_likes collection
      const userIds = await imagesLikesCollection.distinct('userId');
      let userCount = 0;
  
      console.log('Starting to update imageLikeCount for users who liked images...');
  
      // Iterate through users who have liked images
      for (const userId of userIds) {
        userCount++;
  
        // Log the current user being processed
        console.log(`Processing user ${userId} (${userCount})...`);
  
        // Count the number of likes by this user in the images_likes collection
        const imageLikeCount = await imagesLikesCollection.countDocuments({ userId: userId });
  
        // Update the user's imageLikeCount in the users collection
        const result = await usersCollection.updateOne(
          { _id: userId },
          { $set: { imageLikeCount: imageLikeCount } }
        );
  
        // Log the update result
        if (result.modifiedCount > 0) {
          console.log(`User ${userId} imageLikeCount updated to ${imageLikeCount}`);
        } else {
          console.log(`No update needed for user ${userId}`);
        }
      }
  
      console.log(`Finished updating imageLikeCount for ${userCount} users who liked images.`);
    } catch (error) {
      console.log('Error updating imageLikeCount for users:', error);
    }
  }
  
  async function initializeAllUsersPostCount(db) {
    try {
      const usersCollection = db.collection('users');
      const postsCollection = db.collection('posts');
      
      // Fetch distinct userIds from the posts collection (only users who have posts)
      const userIds = await postsCollection.distinct('userId');
      let userCount = 0;
  
      console.log('Starting to initialize postCount for users with posts...');
  
      // Iterate through users who have posts
      for (const userId of userIds) {
        userCount++;
  
        // Log the current user being processed
        console.log(`Processing user ${userId} (${userCount})...`);
  
        // Count the number of posts by this user in the posts collection
        const postCount = await postsCollection.countDocuments({ userId: userId });
  
        // Update the user's postCount in the users collection
        const result = await usersCollection.updateOne(
          { _id: userId },
          { $set: { postCount: postCount } }
        );
  
        // Log the update result
        if (result.modifiedCount > 0) {
          console.log(`User ${userId} postCount initialized to ${postCount}`);
        } else {
          console.log(`No update needed for user ${userId}`);
        }
      }
  
      console.log(`Finished initializing postCount for ${userCount} users.`);
    } catch (error) {
      console.log('Error initializing postCount for users:', error);
    }
  }
  async function updateImageCount(db) {
    try {
      const galleryCollection = db.collection('gallery');
      const chatsCollection = db.collection('chats');
    
      console.log('Fetching unique chatIds with images...');
      const uniqueChatsWithImages = await galleryCollection.aggregate([
        { $match: { images: { $exists: true, $not: { $size: 0 } } } },
        { $group: { _id: "$chatId" } }
      ]).toArray();
    
      console.log(`Found ${uniqueChatsWithImages.length} unique chatIds with images.`);
      
      for (const gallery of uniqueChatsWithImages) {
        const chatId = gallery._id;
        const galleryData = await galleryCollection.findOne({ chatId });
        const imageCount = galleryData.images.length;
    
        console.log(`Updating imageCount for chatId: ${chatId}, imageCount: ${imageCount}`);
    
        await chatsCollection.updateOne(
          { _id: chatId },
          { $set: { imageCount: imageCount } }
        );
    
        console.log(`Updated imageCount for chatId: ${chatId}`);
      }
    
      console.log('Image count update process completed.');
      return { success: true };
    } catch (error) {
      console.log('Error occurred:', error);
      return { error: 'An error occurred while updating image count' };
    }
  }
  
  async function deleteTemporaryChats(db) {
    try {
      const chatsCollection = db.collection("chats");
      const tempCollectionName = "chats_temp";
      const tempChatsCollection = db.collection(tempCollectionName);
  
      console.log("Starting the process to remove temporary chats.");
  
      // Drop temp collections if they already exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(col => col.name);
  
      if (collectionNames.includes(tempCollectionName)) {
        console.log(`Dropping existing temporary collection: ${tempCollectionName}`);
        await tempChatsCollection.drop();
      }
  
      // Copy non-temporary chats to the temporary collection
      console.log("Copying non-temporary chats to temporary collection.");
      await chatsCollection.aggregate([
        { $match: { isTemporary: { $ne: true } } },
        { $out: tempCollectionName }
      ]).toArray();
      console.log("Non-temporary chats copied to temporary collection.");
  
      // Drop the original chats collection
      console.log("Dropping original chats collection.");
      await chatsCollection.drop();
      console.log("Original chats collection dropped.");
  
      // Rename the temporary collection back to 'chats'
      console.log("Renaming temporary collection back to 'chats'.");
      await tempChatsCollection.rename('chats');
      console.log("Process completed: Temporary chats removed, and collection updated.");
  
    } catch (error) {
      console.error("Error during temporary chat removal process:", error);
    }
  }
  function listChats(db) {
    return db.collection('chats').find({
        imageStyle: { $exists: true },
        $or: [
            { imageModel: { $exists: false } },
            { imageVersion: { $exists: false } }
        ]
    }).toArray();
}

function updateChats(db) {
    const collection = db.collection('chats');
    return collection.find({
        imageStyle: { $exists: true },
        $or: [
            { imageModel: { $exists: false } },
            { imageVersion: { $exists: false } }
        ]
    }).forEach(chat => {
        const updates = chat.imageStyle === 'anime' ? {
            imageModel: 'prefectPonyXL_v50_1128833',
            imageVersion: 'sdxl'
        } : chat.imageStyle === 'realistic' ? {
            imageModel: 'kanpiromix_v20',
            imageVersion: 'sd'
        } : {};
        if (Object.keys(updates).length) {
            collection.updateOne({ _id: chat._id }, { $set: updates });
        }
    });
}

/**
 * Updates the database by adding and fixing slugs for chats and images.
 * This function will:
 * 1. Add slugs to chats and images that don't have them
 * 2. Fix invalid slugs that start with a dash
 * 
 * @param {Object} db - MongoDB database connection
 * @param {Object} options - Configuration options
 * @param {number} options.batchSize - Number of records to process in each batch (default: 50)
 * @param {number} options.delay - Milliseconds to delay between batches (default: 1000)
 * @param {boolean} options.dryRun - If true, logs changes without applying them (default: false)
 * @param {boolean} options.fixInvalidSlugs - If true, also fix invalid slugs (default: true)
 * @returns {Promise<Object>} - Results of the update operation
 */
async function updateDatabaseWithSlugs(db, options = {}) {
  // Default options
  const {
    batchSize = 50,
    delay = 1000,
    dryRun = false,
    fixInvalidSlugs = true
  } = options;

  // Initialize counters
  const results = {
    chats: { processed: 0, updated: 0, failed: 0, fixed: 0 },
    images: { processed: 0, updated: 0, failed: 0, fixed: 0 }
  };

  const slugify = require('slugify');
  const { ObjectId } = require('mongodb');

  console.log(`[updateDatabaseWithSlugs] Starting database slug update${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`[updateDatabaseWithSlugs] Batch size: ${batchSize}, Delay between batches: ${delay}ms`);
  console.log(`[updateDatabaseWithSlugs] Will ${fixInvalidSlugs ? '' : 'not '}fix invalid slugs with leading dashes`);

  try {
    const chatsCollection = db.collection('chats');
    
    // Step 1: Update chats without slugs
    console.log('[updateDatabaseWithSlugs] Counting chats without slugs...');
    const totalChatsWithoutSlugs = await chatsCollection.countDocuments({
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: "" }
      ]
    });
    
    console.log(`[updateDatabaseWithSlugs] Found ${totalChatsWithoutSlugs} chats without slugs`);
    
    if (totalChatsWithoutSlugs > 0) {
      // Process chats in batches
      let skip = 0;
      let processedCount = 0;

      while (processedCount < totalChatsWithoutSlugs) {
        console.log(`[updateDatabaseWithSlugs] Processing chat batch: ${skip + 1} to ${Math.min(skip + batchSize, totalChatsWithoutSlugs)} of ${totalChatsWithoutSlugs}`);
        
        const chats = await chatsCollection
          .find({
            $or: [
              { slug: { $exists: false } },
              { slug: null },
              { slug: "" }
            ]
          })
          .skip(skip)
          .limit(batchSize)
          .toArray();
        
        if (chats.length === 0) break;
        
        for (const chat of chats) {
          results.chats.processed++;
          
          try {
            // Generate a slug from the chat name
            let newSlug = "";
            if (chat.name) {
              newSlug = slugify(chat.name, { lower: true, strict: true });
              
              // Check if slugify produced an empty string or just dashes
              if (!newSlug || newSlug.trim() === '' || newSlug === '-') {
                // Generate a fallback slug
                newSlug = `ai-character-${Math.random().toString(36).substring(2, 10)}`;
                console.log(`[updateDatabaseWithSlugs] Slugify produced empty result for chat ${chat._id}, using fallback: ${newSlug}`);
              }
              
              // Remove any leading dashes
              newSlug = newSlug.replace(/^-+/, '');
              
              // Check if this slug already exists
              const slugExists = await chatsCollection.findOne({
                slug: newSlug,
                _id: { $ne: chat._id }
              });
              
              if (slugExists) {
                // Append a random string to make it unique
                const randomStr = Math.random().toString(36).substring(2, 6);
                newSlug = `${newSlug}-${randomStr}`;
                console.log(`[updateDatabaseWithSlugs] Slug collision detected for chat ${chat._id}, adding random suffix: ${newSlug}`);
              }
            } else {
              // If no name, generate a random slug
              newSlug = `ai-character-${Math.random().toString(36).substring(2, 10)}`;
              console.log(`[updateDatabaseWithSlugs] No name found for chat ${chat._id}, generated random slug: ${newSlug}`);
            }
            
            // Final check to ensure no leading dash
            if (newSlug.startsWith('-')) {
              newSlug = `ai-character${newSlug}`;
              console.log(`[updateDatabaseWithSlugs] Corrected slug with leading dash for chat ${chat._id}: ${newSlug}`);
            }
            
            console.log(`[updateDatabaseWithSlugs] Setting slug for chat ${chat._id}: ${newSlug}`);
            
            if (!dryRun) {
              await chatsCollection.updateOne(
                { _id: chat._id },
                { $set: { slug: newSlug } }
              );
            }
            
            results.chats.updated++;
          } catch (error) {
            console.error(`[updateDatabaseWithSlugs] Error updating slug for chat ${chat._id}:`, error);
            results.chats.failed++;
          }
        }
        
        processedCount += chats.length;
        skip += batchSize;
        
        // Delay between batches to avoid overloading the database
        if (processedCount < totalChatsWithoutSlugs && chats.length === batchSize) {
          console.log(`[updateDatabaseWithSlugs] Pausing for ${delay}ms before next chat batch`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      console.log(`[updateDatabaseWithSlugs] Completed updating chat slugs. Updated: ${results.chats.updated}, Failed: ${results.chats.failed}`);
    }
    
    // Step 2: Fix invalid chat slugs (if enabled)
    if (fixInvalidSlugs) {
      console.log('[updateDatabaseWithSlugs] Counting chats with invalid slugs (starting with dash)...');
      
      const invalidChatSlugsCount = await chatsCollection.countDocuments({
        slug: { $regex: /^-/ }
      });
      
      console.log(`[updateDatabaseWithSlugs] Found ${invalidChatSlugsCount} chats with invalid slugs`);
      
      if (invalidChatSlugsCount > 0) {
        let skip = 0;
        let processedCount = 0;
        
        while (processedCount < invalidChatSlugsCount) {
          console.log(`[updateDatabaseWithSlugs] Processing invalid chat slug batch: ${skip + 1} to ${Math.min(skip + batchSize, invalidChatSlugsCount)} of ${invalidChatSlugsCount}`);
          
          const chatsWithInvalidSlugs = await chatsCollection
            .find({ slug: { $regex: /^-/ } })
            .skip(skip)
            .limit(batchSize)
            .toArray();
          
          if (chatsWithInvalidSlugs.length === 0) break;
          
          for (const chat of chatsWithInvalidSlugs) {
            results.chats.processed++;
            
            try {
              // Fix the slug by adding "chat" prefix
              let fixedSlug = `ai-character${chat.slug}`;
              
              // Check if this fixed slug already exists
              const slugExists = await chatsCollection.findOne({
                slug: fixedSlug,
                _id: { $ne: chat._id }
              });
              
              if (slugExists) {
                // Append a random string to make it unique
                const randomStr = Math.random().toString(36).substring(2, 6);
                fixedSlug = `${fixedSlug}-${randomStr}`;
                console.log(`[updateDatabaseWithSlugs] Fixed slug collision detected for chat ${chat._id}, adding random suffix: ${fixedSlug}`);
              }
              
              console.log(`[updateDatabaseWithSlugs] Fixing invalid slug for chat ${chat._id}: "${chat.slug}" → "${fixedSlug}"`);
              
              if (!dryRun) {
                await chatsCollection.updateOne(
                  { _id: chat._id },
                  { $set: { slug: fixedSlug } }
                );
              }
              
              results.chats.fixed++;
            } catch (error) {
              console.error(`[updateDatabaseWithSlugs] Error fixing invalid slug for chat ${chat._id}:`, error);
              results.chats.failed++;
            }
          }
          
          processedCount += chatsWithInvalidSlugs.length;
          skip += batchSize;
          
          // Delay between batches
          if (processedCount < invalidChatSlugsCount && chatsWithInvalidSlugs.length === batchSize) {
            console.log(`[updateDatabaseWithSlugs] Pausing for ${delay}ms before next invalid chat slug batch`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        console.log(`[updateDatabaseWithSlugs] Completed fixing invalid chat slugs. Fixed: ${results.chats.fixed}`);
      }
    }

    // Step 3: Update images without slugs
    const galleryCollection = db.collection('gallery');
    
    console.log('[updateDatabaseWithSlugs] Finding galleries with images lacking slugs...');
    
    // Find all galleries that have images without slugs
    const galleries = await galleryCollection.find({
      "images": { $elemMatch: { $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: "" }
      ]}}
    }).toArray();
    
    console.log(`[updateDatabaseWithSlugs] Found ${galleries.length} galleries with images needing slug updates`);
    
    if (galleries.length > 0) {
      // Process each gallery
      let galleryCount = 0;
      
      for (const gallery of galleries) {
        galleryCount++;
        console.log(`[updateDatabaseWithSlugs] Processing gallery ${galleryCount}/${galleries.length} (chatId: ${gallery.chatId})`);
        
        // Get the chat to access its slug
        const chat = await chatsCollection.findOne({ _id: gallery.chatId });
        if (!chat) {
          console.warn(`[updateDatabaseWithSlugs] Chat not found for gallery with chatId ${gallery.chatId}, skipping`);
          continue;
        }
        
        // If chat doesn't have a slug, generate one
        let chatSlug = chat.slug;
        if (!chatSlug) {
          chatSlug = slugify(chat.name || `ai-character-${chat._id}`, { lower: true, strict: true });
          
          // Remove any leading dashes from chat slug
          chatSlug = chatSlug.replace(/^-+/, '');
          if (!chatSlug || chatSlug.trim() === '') {
            chatSlug = `ai-character-${Math.random().toString(36).substring(2, 8)}`;
          }
          
          console.log(`[updateDatabaseWithSlugs] Chat ${chat._id} doesn't have a slug, generated: ${chatSlug}`);
          
          if (!dryRun) {
            await chatsCollection.updateOne(
              { _id: chat._id },
              { $set: { slug: chatSlug } }
            );
          }
        } else if (chatSlug.startsWith('-') && fixInvalidSlugs) {
          // Fix chat slug if it starts with dash
          const oldChatSlug = chatSlug;
          chatSlug = `ai-character${chatSlug}`;
          console.log(`[updateDatabaseWithSlugs] Fixing chat slug with leading dash: "${oldChatSlug}" → "${chatSlug}"`);
          
          if (!dryRun) {
            await chatsCollection.updateOne(
              { _id: chat._id },
              { $set: { slug: chatSlug } }
            );
            results.chats.fixed++;
          }
        }
        
        let imageCount = 0;
        let batchCounter = 0;
        
        // Go through each image in the gallery
        for (let i = 0; i < gallery.images.length; i++) {
          const image = gallery.images[i];
          
          // Process if image has no slug or fix if it has an invalid slug
          if (!image.slug || (image.slug.startsWith('-') && fixInvalidSlugs)) {
            imageCount++;
            batchCounter++;
            results.images.processed++;
            
            try {
              // Handle existing invalid slug or generate new one
              let imageSlug;
              let isFixing = false;
              
              if (image.slug && image.slug.startsWith('-')) {
                isFixing = true;
                const oldSlug = image.slug;
                imageSlug = `${chatSlug}${image.slug}`; // Prepend chatSlug to fix
                console.log(`[updateDatabaseWithSlugs] Fixing invalid image slug: "${oldSlug}" → "${imageSlug}" for image ${image._id}`);
              } else {
                // Make sure we have a valid chatSlug first
                if (!chatSlug || chatSlug.trim() === '' || chatSlug.startsWith('-')) {
                  // Fix or generate a new chat slug if it's invalid
                  chatSlug = chatSlug && chatSlug.startsWith('-') ? `chat${chatSlug}` : `chat-${Math.random().toString(36).substring(2, 8)}`;
                  
                  console.log(`[updateDatabaseWithSlugs] Using corrected chat slug: ${chatSlug}`);
                  
                  // Update the chat with the fixed slug
                  if (!dryRun) {
                    await chatsCollection.updateOne(
                      { _id: chat._id },
                      { $set: { slug: chatSlug } }
                    );
                  }
                }
                
                // Try to use the title for the slug
                const imageTitle = typeof image.title === 'string'
                  ? image.title
                  : (image.title?.en || image.title?.ja || image.title?.fr || '');
                
                if (imageTitle) {
                  const titleSlug = slugify(imageTitle, { lower: true, strict: true });
                  const shortTitleSlug = titleSlug.substring(0, 30);
                  imageSlug = `${chatSlug}-${shortTitleSlug}-${i + 1}`;
                } else if (image.prompt) {
                  const promptWords = image.prompt.split(',')[0].substring(0, 30);
                  const promptSlug = slugify(promptWords, { lower: true, strict: true });
                  imageSlug = `${chatSlug}-${promptSlug}-${i + 1}`;
                } else {
                  imageSlug = `${chatSlug}-image-${i + 1}-${Math.random().toString(36).substring(2, 6)}`;
                }
              }
              
              // Remove any remaining leading dashes (just to be sure)
              if (imageSlug.startsWith('-')) {
                imageSlug = `${chatSlug}-image-${i + 1}`;
              }
              
              // Check for slug collisions
              const slugExists = await galleryCollection.findOne({
                'images.slug': imageSlug,
                'images._id': { $ne: image._id }
              });
              
              if (slugExists) {
                const randomStr = Math.random().toString(36).substring(2, 6);
                imageSlug = `${imageSlug}-${randomStr}`;
                console.log(`[updateDatabaseWithSlugs] Slug collision detected for image ${image._id}, adding random suffix: ${imageSlug}`);
              }
              
              console.log(`[updateDatabaseWithSlugs] ${isFixing ? 'Fixing' : 'Setting'} slug for image ${image._id}: ${imageSlug}`);
              
              if (!dryRun) {
                await galleryCollection.updateOne(
                  { 'images._id': image._id },
                  { $set: { 'images.$.slug': imageSlug } }
                );
              }
              
              if (isFixing) {
                results.images.fixed++;
              } else {
                results.images.updated++;
              }
              
              // Batch delay to avoid overloading the database
              if (batchCounter >= batchSize) {
                console.log(`[updateDatabaseWithSlugs] Processed ${batchCounter} images, pausing for ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                batchCounter = 0;
              }
            } catch (error) {
              console.error(`[updateDatabaseWithSlugs] Error updating/fixing slug for image ${image._id}:`, error);
              results.images.failed++;
            }
          }
        }
        
        console.log(`[updateDatabaseWithSlugs] Processed ${imageCount} images in gallery for chat ${chat._id}`);
        
        // Delay between galleries
        if (galleryCount < galleries.length) {
          console.log(`[updateDatabaseWithSlugs] Pausing for ${delay}ms before next gallery`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Step 4: Fix remaining images with invalid slugs (if enabled)
    if (fixInvalidSlugs) {
      console.log('[updateDatabaseWithSlugs] Finding galleries with images having invalid slugs...');
      
      // Find all galleries that have images with slugs starting with dash
      const galleriesWithInvalidSlugs = await galleryCollection.find({
        "images": { $elemMatch: { slug: { $regex: /^-/ } } }
      }).toArray();
      
      console.log(`[updateDatabaseWithSlugs] Found ${galleriesWithInvalidSlugs.length} galleries with images having invalid slugs`);
      
      if (galleriesWithInvalidSlugs.length > 0) {
        let galleryCount = 0;
        
        for (const gallery of galleriesWithInvalidSlugs) {
          galleryCount++;
          console.log(`[updateDatabaseWithSlugs] Processing gallery with invalid image slugs ${galleryCount}/${galleriesWithInvalidSlugs.length} (chatId: ${gallery.chatId})`);
          
          // Get the chat to access its slug
          const chat = await chatsCollection.findOne({ _id: gallery.chatId });
          if (!chat) {
            console.warn(`[updateDatabaseWithSlugs] Chat not found for gallery with chatId ${gallery.chatId}, skipping`);
            continue;
          }
          
          // Get chat slug, generate if missing
          let chatSlug = chat.slug;
          if (!chatSlug || chatSlug.startsWith('-')) {
            if (chatSlug && chatSlug.startsWith('-')) {
              chatSlug = `ai-character${chatSlug}`;
            } else {
              chatSlug = `ai-character-${chat._id.toString().substring(0, 8)}`;
            }
            
            console.log(`[updateDatabaseWithSlugs] Using corrected chat slug: ${chatSlug}`);
            
            if (!dryRun) {
              await chatsCollection.updateOne(
                { _id: chat._id },
                { $set: { slug: chatSlug } }
              );
              results.chats.fixed++;
            }
          }
          
          let fixedCount = 0;
          let batchCounter = 0;
          
          // Go through each image in the gallery
          for (let i = 0; i < gallery.images.length; i++) {
            const image = gallery.images[i];
            
            if (image.slug && image.slug.startsWith('-')) {
              fixedCount++;
              batchCounter++;
              results.images.processed++;
              
              try {
                // Fix the slug
                const oldSlug = image.slug;
                let fixedSlug = `${chatSlug}${oldSlug}`;
                
                // Check for collisions
                const slugExists = await galleryCollection.findOne({
                  'images.slug': fixedSlug,
                  'images._id': { $ne: image._id }
                });
                
                if (slugExists) {
                  const randomStr = Math.random().toString(36).substring(2, 6);
                  fixedSlug = `${fixedSlug}-${randomStr}`;
                }
                
                console.log(`[updateDatabaseWithSlugs] Fixing invalid image slug: "${oldSlug}" → "${fixedSlug}" for image ${image._id}`);
                
                if (!dryRun) {
                  await galleryCollection.updateOne(
                    { 'images._id': image._id },
                    { $set: { 'images.$.slug': fixedSlug } }
                  );
                }
                
                results.images.fixed++;
                
                // Batch delay
                if (batchCounter >= batchSize) {
                  console.log(`[updateDatabaseWithSlugs] Processed ${batchCounter} invalid image slugs, pausing for ${delay}ms`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  batchCounter = 0;
                }
              } catch (error) {
                console.error(`[updateDatabaseWithSlugs] Error fixing invalid slug for image ${image._id}:`, error);
                results.images.failed++;
              }
            }
          }
          
          console.log(`[updateDatabaseWithSlugs] Fixed ${fixedCount} invalid image slugs in gallery for chat ${chat._id}`);
          
          // Delay between galleries
          if (galleryCount < galleriesWithInvalidSlugs.length) {
            console.log(`[updateDatabaseWithSlugs] Pausing for ${delay}ms before next gallery with invalid slugs`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }
    
    console.log('[updateDatabaseWithSlugs] Database slug update completed');
    console.log('[updateDatabaseWithSlugs] Results:', JSON.stringify(results, null, 2));
    
    return results;
  } catch (error) {
    console.error('[updateDatabaseWithSlugs] Error updating slugs:', error);
    throw error;
  }
}

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function updateDatabaseWithSlugs_go() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(process.env.MONGODB_NAME);
    
    // First run a dry run to see what would be updated
    console.log('\n--- PERFORMING RUN ---\n');
    await updateDatabaseWithSlugs(db, { 
      batchSize: 50,
      delay: 1000,
      dryRun: false,
      fixInvalidSlugs: true
    });
    
  } catch (error) {
    console.error('Script failed:', error);
    await client.close();
    process.exit(1);
  }
}
  

module.exports = { 
    cleanupNonRegisteredUsers,
    deleteOldRecords,
    deleteCharactersWithoutDescription,
    deleteClientsWithoutProductId, 
    deleteUserChatsWithoutMessages,
    cleanUpDatabase,
    updateAllUsersImageLikeCount,
    initializeAllUsersPostCount,
    updateImageCount,
    deleteTemporaryChats,
    updateChats,
    listChats,
    updateDatabaseWithSlugs
}