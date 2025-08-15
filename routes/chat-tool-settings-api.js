const { ObjectId } = require('mongodb');
const { getVoiceSettings } = require('../models/chat-tool-settings-utils');
async function routes(fastify, options) {
    
    // Get user's chat tool settings
    fastify.get('/api/chat-tool-settings/:userId', async (request, reply) => {
        try {
            const { userId } = request.params;
            
            if (!userId || !ObjectId.isValid(userId)) {
                return reply.status(400).send({ error: 'Invalid user ID' });
            }

            const collection = fastify.mongo.db.collection('chatToolSettings');
            const settings = await collection.findOne({ 
                userId: new ObjectId(userId),
                chatId: { $exists: false }
            });
            
            if (!settings) {
                // Return default settings if none exist
                const defaultSettings = {
                    minImages: 3,
                    videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
                    characterTone: 'casual',
                    relationshipType: 'companion',
                    selectedVoice: 'nova',
                    voiceProvider: 'openai', // new field
                    evenLabVoice: 'sakura', // new field
                    autoMergeFace: true, // new field
                    selectedModel: 'mistral', // new field
                    suggestionsEnabled: true // new field
                };
                return reply.send({ success: true, settings: defaultSettings });
            }

            // Remove MongoDB specific fields from response
            const { _id, userId: userIdField, createdAt, updatedAt, ...userSettings } = settings;
            
            reply.send({ success: true, settings: userSettings });
            
        } catch (error) {
            console.error('Error fetching chat tool settings:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Save/Update user's chat tool settings (supports both global and chat-specific)
    fastify.post('/api/chat-tool-settings/:userId', async (request, reply) => {
        try {
            const { userId } = request.params;
            const { settings, chatId } = request.body;
            
            if (!userId || !ObjectId.isValid(userId)) {
                return reply.status(400).send({ error: 'Invalid user ID' });
            }

            if (!settings || typeof settings !== 'object') {
                return reply.status(400).send({ error: 'Settings object is required' });
            }

            // Validate chatId if provided
            if (chatId && !ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            // Validate settings structure
            const validSettings = {
                minImages: Number(settings.minImages) || 3,
                videoPrompt: String(settings.videoPrompt || 'Generate a short, engaging video with smooth transitions and vibrant colors.'),
                characterTone: String(settings.characterTone || 'casual'),
                relationshipType: String(settings.relationshipType || 'companion'),
                selectedVoice: String(settings.selectedVoice || 'nova'),
                voiceProvider: String(settings.voiceProvider || 'openai'),
                evenLabVoice: String(settings.evenLabVoice || 'sakura'),
                autoMergeFace: Boolean(settings.autoMergeFace !== undefined ? settings.autoMergeFace : true),
                selectedModel: String(settings.selectedModel || 'mistral'),
                suggestionsEnabled: Boolean(settings.suggestionsEnabled !== undefined ? settings.suggestionsEnabled : true)
            };

            // Validate ranges and constraints
            if (validSettings.minImages < 1 || validSettings.minImages > 20) {
                return reply.status(400).send({ error: 'minImages must be between 1 and 20' });
            }

            if (validSettings.videoPrompt.length > 500) {
                return reply.status(400).send({ error: 'videoPrompt must be less than 500 characters' });
            }

            const collection = fastify.mongo.db.collection('chatToolSettings');
            const now = new Date();

            // Build query for upsert
            const query = { userId: new ObjectId(userId) };
            if (chatId) {
                query.chatId = new ObjectId(chatId);
            } else {
                query.chatId = { $exists: false };
            }

            const updateDoc = {
                $set: {
                    ...validSettings,
                    updatedAt: now
                },
                $setOnInsert: {
                    userId: new ObjectId(userId),
                    createdAt: now
                }
            };

            if (chatId) {
                updateDoc.$setOnInsert.chatId = new ObjectId(chatId);
            }

            const result = await collection.updateOne(query, updateDoc, { upsert: true });

            reply.send({ 
                success: true, 
                message: chatId ? 'Chat-specific settings saved successfully' : 'Settings saved successfully',
                settings: validSettings,
                isChatSpecific: !!chatId
            });
            
        } catch (error) {
            console.error('Error saving chat tool settings:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Reset user's chat tool settings to default
    fastify.delete('/api/chat-tool-settings/:userId', async (request, reply) => {
        try {
            const { userId } = request.params;
            const { chatId } = request.query;
            
            if (!userId || !ObjectId.isValid(userId)) {
                return reply.status(400).send({ error: 'Invalid user ID' });
            }

            if (chatId && !ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            const collection = fastify.mongo.db.collection('chatToolSettings');
            const query = { userId: new ObjectId(userId) };
            
            if (chatId) {
                query.chatId = new ObjectId(chatId);
            } else {
                query.chatId = { $exists: false };
            }

            await collection.deleteOne(query);

            const defaultSettings = {
                minImages: 3,
                videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
                characterTone: 'casual',
                relationshipType: 'companion',
                selectedVoice: 'nova',
                voiceProvider: 'openai',
                evenLabVoice: 'sakura',
                autoMergeFace: true,
                selectedModel: 'mistral',
                suggestionsEnabled: true
            };

            reply.send({ 
                success: true, 
                message: chatId ? 'Chat-specific settings reset to default' : 'Settings reset to default',
                settings: defaultSettings,
                isChatSpecific: !!chatId
            });
            
        } catch (error) {
            console.error('Error resetting chat tool settings:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Get settings for specific chat/userChat (with user defaults as fallback)
    fastify.get('/api/chat-tool-settings/:userId/:chatId', async (request, reply) => {
        try {
            const { userId, chatId } = request.params;
            
            if (!userId || !ObjectId.isValid(userId) || !chatId || !ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid user ID or chat ID' });
            }

            const collection = fastify.mongo.db.collection('chatToolSettings');
            
            // First try to get chat-specific settings
            const chatSettings = await collection.findOne({ 
                userId: new ObjectId(userId),
                chatId: new ObjectId(chatId)
            });

            if (chatSettings) {
                const { _id, userId: userIdField, chatId: chatIdField, createdAt, updatedAt, ...settings } = chatSettings;
                return reply.send({ success: true, settings, isChatSpecific: true });
            }

            // Fallback to user default settings
            const userSettings = await collection.findOne({ 
                userId: new ObjectId(userId),
                chatId: { $exists: false }
            });

            if (userSettings) {
                const { _id, userId: userIdField, createdAt, updatedAt, ...settings } = userSettings;
                return reply.send({ success: true, settings, isChatSpecific: false });
            }

            // Return default settings if none exist
            const defaultSettings = {
                minImages: 3,
                videoPrompt: 'Generate a short, engaging video with smooth transitions and vibrant colors.',
                characterTone: 'casual',
                relationshipType: 'companion',
                selectedVoice: 'nova',
                voiceProvider: 'openai',
                evenLabVoice: 'sakura',
                autoMergeFace: true,
                selectedModel: 'mistral',
                suggestionsEnabled: true
            };

            reply.send({ success: true, settings: defaultSettings, isChatSpecific: false });
            
        } catch (error) {
            console.error('Error fetching chat-specific settings:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Get available models based on user subscription status
    fastify.get('/api/chat-tool-settings/models/:userId', async (request, reply) => {
        try {
            const { userId } = request.params;
            
            if (!userId || !ObjectId.isValid(userId)) {
                return reply.status(400).send({ error: 'Invalid user ID' });
            }

            // Check user subscription status
            const usersCollection = fastify.mongo.db.collection('users');
            const user = await usersCollection.findOne({ 
                _id: new ObjectId(userId) 
            });
            
            const isPremium = user?.subscriptionStatus === 'active';
            
            // Import model configuration from openai.js
            const { getAllAvailableModels } = require('../models/openai');
            const availableModels = getAllAvailableModels(isPremium);
            
            reply.send({ 
                success: true, 
                models: availableModels,
                isPremium: isPremium
            });
            
        } catch (error) {
            console.error('Error fetching available models:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}

module.exports = routes;
