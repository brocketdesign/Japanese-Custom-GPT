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

            // Get user-specific customizations from userChat (if exists)
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            const userChat = await collectionUserChat.findOne({
                userId: new ObjectId(userId),
                chatId: new ObjectId(chatId)
            });

            // User customizations override the default character data
            const userCustomizations = userChat?.userCustomizations || null;

            reply.send({
                success: true,
                chat: {
                    ...chat,
                    messagesCount: messageCount,
                    imageCount: imageCount,
                    videoCount: videoCount,
                    galleryImage: galleryImage,
                    userCustomizations: userCustomizations,
                    userChatId: userChat?._id || null
                }
            });

        } catch (error) {
            console.error('[API/character-info] Error:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Save user-specific character customizations for a chat
    fastify.post('/api/character-info/:chatId/customizations', async (request, reply) => {
        try {
            const { chatId } = request.params;
            const userId = request.user._id;
            const { userChatId, customizations } = request.body;

            if (!ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            if (!customizations || typeof customizations !== 'object') {
                return reply.status(400).send({ error: 'Customizations object is required' });
            }

            // Validate customizations structure
            const validFields = ['personality', 'relationship', 'occupation', 'preferences', 'customInstructions'];
            const validCustomizations = {};
            
            for (const field of validFields) {
                if (customizations[field] !== undefined) {
                    if (field === 'customInstructions') {
                        // Limit custom instructions to 1000 characters
                        validCustomizations[field] = String(customizations[field] || '').substring(0, 1000);
                    } else {
                        validCustomizations[field] = String(customizations[field] || '');
                    }
                }
            }

            const collectionUserChat = fastify.mongo.db.collection('userChat');
            const now = new Date();

            // Find the userChat document
            let userChat;
            if (userChatId && ObjectId.isValid(userChatId)) {
                userChat = await collectionUserChat.findOne({
                    _id: new ObjectId(userChatId),
                    userId: new ObjectId(userId)
                });
            }

            if (!userChat) {
                // Try to find by chatId
                userChat = await collectionUserChat.findOne({
                    userId: new ObjectId(userId),
                    chatId: new ObjectId(chatId)
                });
            }

            if (userChat) {
                // Update existing userChat with customizations
                await collectionUserChat.updateOne(
                    { _id: userChat._id },
                    { 
                        $set: { 
                            userCustomizations: validCustomizations,
                            customizationsUpdatedAt: now
                        } 
                    }
                );
            } else {
                // Create new userChat document with customizations
                // First verify the chat exists
                const collectionChats = fastify.mongo.db.collection('chats');
                const chat = await collectionChats.findOne({ _id: new ObjectId(chatId) });
                
                if (!chat) {
                    return reply.status(404).send({ error: 'Character not found' });
                }

                const newUserChat = {
                    userId: new ObjectId(userId),
                    chatId: new ObjectId(chatId),
                    messages: [],
                    userCustomizations: validCustomizations,
                    customizationsUpdatedAt: now,
                    createdAt: now,
                    updatedAt: now
                };

                const result = await collectionUserChat.insertOne(newUserChat);
                userChat = { _id: result.insertedId, ...newUserChat };
            }

            reply.send({
                success: true,
                message: 'Customizations saved successfully',
                userChatId: userChat._id,
                customizations: validCustomizations
            });

        } catch (error) {
            console.error('[API/character-info/customizations] Error:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Reset user-specific customizations to character defaults
    fastify.delete('/api/character-info/:chatId/customizations', async (request, reply) => {
        try {
            const { chatId } = request.params;
            const userId = request.user._id;
            const { userChatId } = request.query;

            if (!ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            const collectionUserChat = fastify.mongo.db.collection('userChat');

            // Find and update the userChat document
            const query = { userId: new ObjectId(userId) };
            if (userChatId && ObjectId.isValid(userChatId)) {
                query._id = new ObjectId(userChatId);
            } else {
                query.chatId = new ObjectId(chatId);
            }

            const result = await collectionUserChat.updateOne(
                query,
                { $unset: { userCustomizations: '', customizationsUpdatedAt: '' } }
            );

            reply.send({
                success: true,
                message: 'Customizations reset to character defaults',
                modified: result.modifiedCount > 0
            });

        } catch (error) {
            console.error('[API/character-info/customizations] Error:', error);
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
