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
            imageModel: 'novaAnimeXL_ponyV20_461138',
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
    listChats
}