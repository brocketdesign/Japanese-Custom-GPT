const { ObjectId } = require('mongodb');
const { generateChatScenarios } = require('../models/openai');
const { getLanguageName } = require('../models/tool');
const {
    getChatScenarioData,
    getUserScenariosStats,
    getUserScenariosHistory,
    selectScenario,
    formatScenarioForUI
} = require('../models/chat-scenario-utils');
const { chatDataToString } = require('../models/chat-completion-utils');

async function routes(fastify, options) {
    
    // Get scenario data for a specific user chat
    fastify.get('/api/chat-scenarios/:userChatId', async (request, reply) => {
        try {
            const { userChatId } = request.params;
            const userId = request.user._id;
            
            if (!ObjectId.isValid(userChatId)) {
                return reply.status(400).send({ error: 'Invalid user chat ID format' });
            }

            // Verify the user chat belongs to the authenticated user
            const userChatCollection = fastify.mongo.db.collection('userChat');
            const userChatDoc = await userChatCollection.findOne({
                _id: new ObjectId(userChatId),
                userId: new ObjectId(userId)
            });

            if (!userChatDoc) {
                return reply.status(404).send({ error: 'User chat not found or access denied' });
            }

            const scenarioData = await getChatScenarioData(fastify.mongo.db, userChatId);
            
            // Format scenarios for UI (character name already replaced during generation)
            const formattedAvailableScenarios = scenarioData.availableScenarios.map(s => formatScenarioForUI(s));
            const formattedCurrentScenario = scenarioData.currentScenario ? formatScenarioForUI(scenarioData.currentScenario) : null;
            
            return reply.send({
                currentScenario: formattedCurrentScenario,
                availableScenarios: formattedAvailableScenarios,
                scenarioCreatedAt: scenarioData.scenarioCreatedAt
            });
        } catch (error) {
            console.error('[GET /api/chat-scenarios/:userChatId] Error fetching chat scenarios:', error);
            return reply.status(500).send({ error: 'Failed to fetch chat scenarios' });
        }
    });

    // Generate new scenarios for a chat
    fastify.post('/api/chat-scenarios/:userChatId/generate', async (request, reply) => {
        try {
            const { userChatId } = request.params;
            const userId = request.user._id;
            
            if (!ObjectId.isValid(userChatId)) {
                return reply.status(400).send({ error: 'Invalid user chat ID format' });
            }

            // Verify ownership
            const userChatCollection = fastify.mongo.db.collection('userChat');
            const userChatDoc = await userChatCollection.findOne({
                _id: new ObjectId(userChatId),
                userId: new ObjectId(userId)
            });

            if (!userChatDoc) {
                return reply.status(404).send({ error: 'User chat not found or access denied' });
            }

            // Get chat document for context
            const chatsCollection = fastify.mongo.db.collection('chats');
            const chatDoc = await chatsCollection.findOne({ _id: new ObjectId(userChatDoc.chatId) });

            if (!chatDoc) {
                return reply.status(404).send({ error: 'Chat not found' });
            }

            // Get persona if available
            let personaInfo = null;
            if (userChatDoc.persona) {
                personaInfo = await chatsCollection.findOne({ _id: new ObjectId(userChatDoc.persona) });
            }
            //
            const chatDescriptionString = chatDataToString(chatDoc);
            // Get user's relationship type
            const chatToolSettingsCollection = fastify.mongo.db.collection('chatToolSettings');
            const userSettings = await chatToolSettingsCollection.findOne({
                userId: new ObjectId(userId),
                chatId: new ObjectId(userChatDoc.chatId)
            }) || {};

            // Generate scenarios
            const language = getLanguageName(request.user.lang || 'ja');
            const scenarios = await generateChatScenarios(
                {
                    name: chatDoc.name,
                    description: chatDescriptionString || '',
                    persona: chatDoc.persona || null
                },
                personaInfo,
                userSettings,
                language
            );

            if (!scenarios || scenarios.length === 0) {
                return reply.status(500).send({ error: 'Failed to generate scenarios' });
            }

            // Store scenarios in the user chat
            await userChatCollection.updateOne(
                { _id: new ObjectId(userChatId) },
                { 
                    $set: { 
                        availableScenarios: scenarios,
                        scenarioCreatedAt: new Date()
                    }
                }
            );

            // Format scenarios for UI (character name already replaced by AI)
            const formattedScenarios = scenarios.map(s => formatScenarioForUI(s));

            return reply.send({
                success: true,
                scenarios: formattedScenarios
            });
        } catch (error) {
            console.error('[/api/chat-scenarios/:userChatId/generate] Error generating chat scenarios:', error);
            return reply.status(500).send({ error: 'Failed to generate scenarios' });
        }
    });

    // Select a scenario
    fastify.post('/api/chat-scenarios/:userChatId/select', async (request, reply) => {
        try {
            const { userChatId } = request.params;
            const { scenarioId } = request.body;
            const userId = request.user._id;

            if (!ObjectId.isValid(userChatId)) {
                return reply.status(400).send({ error: 'Invalid user chat ID format' });
            }

            if (!scenarioId) {
                return reply.status(400).send({ error: 'Scenario ID is required' });
            }

            // Verify ownership
            const userChatCollection = fastify.mongo.db.collection('userChat');
            const userChatDoc = await userChatCollection.findOne({
                _id: new ObjectId(userChatId),
                userId: new ObjectId(userId)
            });

            if (!userChatDoc) {
                return reply.status(404).send({ error: 'User chat not found or access denied' });
            }

            // Find the selected scenario
            const selectedScenario = userChatDoc.availableScenarios?.find(
                s => (s._id || s.id)?.toString() === scenarioId || s._id?.toString() === scenarioId
            );

            if (!selectedScenario) {
                return reply.status(404).send({ error: 'Scenario not found' });
            }

            // Create a hidden user message that establishes the scenario context
            // This message is hidden from the UI but helps the assistant understand the scenario
            const scenarioContextMessage = {
                role: 'user',
                content: selectedScenario.system_prompt_addition || selectedScenario.scenario_description,
                hidden: true,
                name: 'context',
                timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
                createdAt: new Date()
            };

            // Update the userChat document to:
            // 1. Select the scenario
            // 2. Add the hidden scenario context message
            // 3. Mark scenario as generated
            const updateResult = await userChatCollection.updateOne(
                { _id: new ObjectId(userChatId) },
                { 
                    $set: { 
                        currentScenario: selectedScenario,
                        scenarioGenerated: true
                    },
                    $push: { messages: scenarioContextMessage },
                    $unset: { availableScenarios: "" }
                }
            );

            console.log(`[/api/chat-scenarios/:userChatId/select] Updated ${updateResult.modifiedCount} document(s)`);
            console.log(`[/api/chat-scenarios/:userChatId/select] Scenario context message created:`, {
                name: scenarioContextMessage.name,
                hidden: scenarioContextMessage.hidden,
                contentPreview: scenarioContextMessage.content?.substring(0, 100)
            });

            // Fetch the updated document to return the new messages
            const updatedUserChatDoc = await userChatCollection.findOne({
                _id: new ObjectId(userChatId),
                userId: new ObjectId(userId)
            });

            console.log(`[/api/chat-scenarios/:userChatId/select] Updated document has ${updatedUserChatDoc?.messages?.length || 0} messages`);
            if (updatedUserChatDoc?.messages) {
                console.log(`[/api/chat-scenarios/:userChatId/select] Message summary:`, updatedUserChatDoc.messages.map(m => ({ role: m.role, name: m.name, hidden: m.hidden })));
            }

            // Notify user of selection
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations?.scenario_selected || 'Scenario selected!',
                icon: 'success' 
            });

            return reply.send({
                success: true,
                scenario: formatScenarioForUI(selectedScenario),
                shouldStartConversation: true,
                autoGenerateResponse: true,  // Signal frontend to immediately call generateChatCompletion
                updatedMessages: updatedUserChatDoc?.messages || []  // Include updated messages
            });
        } catch (error) {
            console.error('Error selecting scenario:', error);
            return reply.status(500).send({ error: 'Failed to select scenario' });
        }
    });

    // Get user's scenario statistics
    fastify.get('/api/user/scenarios-stats', async (request, reply) => {
        try {
            const userId = request.user._id;
            
            const stats = await getUserScenariosStats(fastify.mongo.db, userId);
            
            return reply.send({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Error fetching user scenario stats:', error);
            return reply.status(500).send({ error: 'Failed to fetch scenario statistics' });
        }
    });

    // Get user's scenario history
    fastify.get('/api/user/scenarios-history', async (request, reply) => {
        try {
            const userId = request.user._id;
            const limit = parseInt(request.query.limit) || 20;
            
            const history = await getUserScenariosHistory(fastify.mongo.db, userId, limit);
            
            return reply.send({
                success: true,
                history
            });
        } catch (error) {
            console.error('Error fetching user scenario history:', error);
            return reply.status(500).send({ error: 'Failed to fetch scenario history' });
        }
    });
}

module.exports = routes;
