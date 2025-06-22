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

            // Get image count
            const collectionImages = fastify.mongo.db.collection('chatimages');
            const imageCount = await collectionImages.countDocuments({
                chatId: new ObjectId(chatId)
            });

            reply.send({
                success: true,
                chat: {
                    ...chat,
                    messagesCount: messageCount,
                    imageCount: imageCount
                }
            });

        } catch (error) {
            console.error('[API/character-info] Error:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}

module.exports = routes;
