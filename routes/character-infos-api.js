const { ObjectId } = require('mongodb');
const { getMessageCount } = require('../models/user-chat-stats-utils');

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

            // Get user-specific data from userChat
            // Handle both ObjectId and string formats for chatId lookup
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            const userChat = await collectionUserChat.findOne({
                $or: [
                    { userId: new ObjectId(userId), chatId: new ObjectId(chatId) },
                    { userId: new ObjectId(userId), chatId: chatId.toString() }
                ]
            });

            // Get message count from user_chat_stats collection (fast lookup)
            const messageCount = await getMessageCount(fastify.mongo.db, userId, chatId);

            // Get video count for this user's chat with this character
            const collectionVideos = fastify.mongo.db.collection('videos');
            const videoCount = await collectionVideos.countDocuments({
                userId: new ObjectId(userId),
                chatId: new ObjectId(chatId)
            });

            // Get image count from gallery for this character
            // Gallery is typically stored per-character (chatId), not per-user
            let imageCount = 0;
            const collectionGallery = fastify.mongo.db.collection('gallery');
            const galleryDoc = await collectionGallery.findOne({ 
                chatId: new ObjectId(chatId)
            });
            if (galleryDoc && galleryDoc.images && Array.isArray(galleryDoc.images)) {
                imageCount = galleryDoc.images.length;
            }

            // User customizations override the default character data
            const userCustomizations = userChat?.userCustomizations || null;
            
            console.log(`[API/character-info] User ${userId} for chat ${chatId}: messages: ${messageCount}, videos: ${videoCount}, images: ${imageCount}`);

            reply.send({
                success: true,
                chat: {
                    ...chat,
                    messagesCount: messageCount,
                    imageCount: imageCount,
                    videoCount: videoCount,
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
                // Try to find by chatId (handle both ObjectId and string formats)
                userChat = await collectionUserChat.findOne({
                    $or: [
                        { userId: new ObjectId(userId), chatId: new ObjectId(chatId) },
                        { userId: new ObjectId(userId), chatId: chatId.toString() }
                    ]
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

            // Find and update the userChat document (handle both ObjectId and string formats)
            let query;
            if (userChatId && ObjectId.isValid(userChatId)) {
                query = { 
                    _id: new ObjectId(userChatId),
                    userId: new ObjectId(userId) 
                };
            } else {
                query = {
                    userId: new ObjectId(userId),
                    $or: [
                        { chatId: new ObjectId(chatId) },
                        { chatId: chatId.toString() }
                    ]
                };
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
