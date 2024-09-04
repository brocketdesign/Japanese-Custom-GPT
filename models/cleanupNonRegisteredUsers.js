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
        console.log(`User IDs to delete: ${userIds}`);

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

        console.log('Deleting orphaned records...');
        await Promise.all([
            collectionChat.deleteMany({ userId: { $nin: allUserIds, $exists: true } }),
            collectionUserChat.deleteMany({ userId: { $nin: allUserIds, $exists: true } }),
            collectionMessageCount.deleteMany({ userId: { $nin: allUserIds, $exists: true } })
        ]);

        console.log('Orphaned records deleted.');
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
module.exports = { cleanupNonRegisteredUsers,deleteOldRecords,deleteCharactersWithoutDescription,deleteClientsWithoutProductId, deleteUserChatsWithoutMessages }