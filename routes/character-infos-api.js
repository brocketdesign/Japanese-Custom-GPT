const { ObjectId } = require('mongodb');

async function routes(fastify, options) {
    // Get character information for preview modal (read-only)
    fastify.get('/api/character-info/:chatId', async (request, reply) => {
        try {
            const { chatId } = request.params;
            const userId = request.user._id;

            if (!ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            const collectionChats = fastify.mongo.db.collection('chats');
            let chat;
            chat = await collectionChats.findOne({
                _id: new ObjectId(chatId),
                userId: new ObjectId(userId)
            });

            if (!chat) {
                chat = await collectionChats.findOne({
                    _id: new ObjectId(chatId)
                });
            }

            if (!chat) {
                return reply.status(404).send({ error: 'Character not found or access denied' });
            }

            // Get message count
            const collectionMessages = fastify.mongo.db.collection('messages');
            const messageCount = await collectionMessages.countDocuments({
                chatId: new ObjectId(chatId)
            });

            // Get video count
            const collectionVideos = fastify.mongo.db.collection('videos');
            const videoCount = await collectionVideos.countDocuments({
                chatId: new ObjectId(chatId)
            });

            // Get image count from gallery
            let imageCount = 0;
            let galleryImage = null;
            const collectionGallery = fastify.mongo.db.collection('gallery');
            const galleryDoc = await collectionGallery.findOne({ chatId: new ObjectId(chatId) });
            if (galleryDoc && galleryDoc.images && galleryDoc.images.length > 0) {
                imageCount = galleryDoc.images.length;
            }

            reply.send({
                success: true,
                chat: {
                    ...chat,
                    messagesCount: messageCount,
                    imageCount: imageCount,
                    videoCount: videoCount,
                    galleryImage: galleryImage
                }
            });

        } catch (error) {
            console.error('[API/character-info] Error:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Get character stats globally (all messages, images, videos - no user restriction)
    fastify.get('/api/character-stats/:chatId', async (request, reply) => {
        try {
            const { chatId } = request.params;

            if (!ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            // Get chat document to get message count
            const collectionChats = fastify.mongo.db.collection('chats');
            const chat = await collectionChats.findOne({
                _id: new ObjectId(chatId)
            });

            if (!chat) {
                return reply.status(404).send({ error: 'Character not found' });
            }

            const messageCount = chat.messagesCount || 0;

            // Get image count from gallery (aggregating the images array)
            const collectionGallery = fastify.mongo.db.collection('gallery');
            const imageCountResult = await collectionGallery.aggregate([
                { $match: { chatId: new ObjectId(chatId) } },
                { $project: { imageCount: { $size: '$images' } } },
                { $group: { _id: null, totalImages: { $sum: '$imageCount' } } }
            ]).toArray();
            
            const imageCount = imageCountResult.length > 0 ? imageCountResult[0].totalImages : 0;

            // Get video count (all videos for this chat)
            const collectionVideos = fastify.mongo.db.collection('videos');
            const videoCount = await collectionVideos.countDocuments({
                chatId: new ObjectId(chatId)
            });

            reply.send({
                success: true,
                stats: {
                    messagesCount: messageCount,
                    imageCount: imageCount,
                    videoCount: videoCount
                }
            });

        } catch (error) {
            console.error('[API/character-stats] Error:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}

module.exports = routes;
