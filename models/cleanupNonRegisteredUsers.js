// cleanupNonRegisteredUsers.js
module.exports = async function cleanupNonRegisteredUsers(db) {
    try {
        const usersCollection = db.collection('users');
        const collectionChat = db.collection('chats');
        const collectionUserChat = db.collection('userChat');
        const collectionMessageCount = db.collection('MessageCount');

        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const nonRegisteredUsers = await usersCollection.find({
            email: { $exists: false },
            isTemporary: true,
            createdAt: { $lte: threeDaysAgo }
        }).toArray();

        const userIds = nonRegisteredUsers.map(user => user._id);

        // Delete non-registered users and their related data
        if (userIds.length > 0) {
            await Promise.all([
                usersCollection.deleteMany({ _id: { $in: userIds } }),
                collectionChat.deleteMany({ userId: { $in: userIds } }),
                collectionUserChat.deleteMany({ userId: { $in: userIds } }),
                collectionMessageCount.deleteMany({ userId: { $in: userIds } })
            ]);
        }

        // Delete orphaned records in other collections
        const allUserIds = await usersCollection.distinct('_id');
        await Promise.all([
            collectionChat.deleteMany({ userId: { $nin: allUserIds, $exists: true } }),
            collectionUserChat.deleteMany({ userId: { $nin: allUserIds, $exists: true } }),
            collectionMessageCount.deleteMany({ userId: { $nin: allUserIds, $exists: true } })
        ]);

        return `${userIds.length} non-registered users and orphaned data deleted.`;
    } catch (error) {
        throw new Error(`Cleanup failed: ${error.message}`);
    }
};
