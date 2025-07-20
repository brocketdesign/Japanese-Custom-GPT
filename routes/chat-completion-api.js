const { ObjectId } = require('mongodb');
const axios = require('axios');
const {
    checkImageRequest, 
    generateCompletion,
} = require('../models/openai');
const { 
    checkImageDescription,
} = require('../models/imagen');
const { 
    getLanguageName, 
    checkUserAdmin,
    getApiUrl
} = require('../models/tool');
const {
    getUserChatToolSettings,
    applyUserSettingsToPrompt,
} = require('../models/chat-tool-settings-utils');
const { getUserPoints } = require('../models/user-points-utils');
const {
    getUserInfo,
    getUserChatData,
    getPersonaById,
    chatDataToString,
    userDetailsToString,
    completionSystemContent,
    getCurrentTimeInJapanese,
    handleImageGeneration,
    handleChatGoals,
    updateMessagesCount,
    updateChatLastMessage,
    updateUserChat,
    handleGalleryImage
} = require('../models/chat-completion-utils');

// Fetches chat document from 'chats' collection
async function getChatDocument(request, db, chatId) {
    let chatdoc = await db.collection('chats').findOne({ _id: new ObjectId(chatId) });
    
    // Check if chatdoc is updated to the new format
    if(!chatdoc?.system_prompt || !chatdoc?.details_description || !chatdoc?.details_description?.personality?.reference_character) {
        console.log('Updating chat document to new format');

        const purpose = `Her name is, ${chatdoc.name}.\nShe looks like :${chatdoc.enhancedPrompt ? chatdoc.enhancedPrompt : chatdoc.characterPrompt}.\n\n${chatdoc.rule}`;
        const language = chatdoc.language;
        const apiUrl = getApiUrl(request);        
        
        const response = await axios.post(apiUrl+'/api/generate-character-comprehensive', {
            userId: request.user._id,
            chatId,
            name: chatdoc.name,
            prompt: chatdoc.characterPrompt,
            gender: chatdoc.gender,
            nsfw: chatdoc.nsfw,
            chatPurpose: purpose,
            language
        });
        chatdoc = response.chatData;
    }

    return chatdoc;
}

async function routes(fastify, options) {
    fastify.post('/api/openai-chat-completion', async (request, reply) => {
        try {
            const db = fastify.mongo.db;
            const { chatId, userChatId, isHidden, uniqueId } = request.body;
            let userId = request.body.userId;
            
            if (!userId) { 
                const user = request.user;
                userId = user._id;
            }

            // Fetch user information and settings
            const userInfo = await getUserInfo(db, userId);
            const userPoints = await getUserPoints(fastify.mongo.db, userId);
            const userSettings = await getUserChatToolSettings(fastify.mongo.db, userId, chatId);
            let userData = await getUserChatData(db, userId, userChatId);
            const subscriptionStatus = userInfo.subscriptionStatus == 'active' ? true : false;
            
            if (!userData) { 
                return reply.status(404).send({ error: 'User data not found' }); 
            }

            const isAdmin = await checkUserAdmin(fastify, userId);
            const chatDocument = await getChatDocument(request, db, chatId);
            const chatDescription = chatDataToString(chatDocument);
            const characterDescription = await checkImageDescription(db, chatId, chatDocument);
            const language = getLanguageName(userInfo.lang);

            // Filter and prepare user messages
            const userMessages = userData.messages
                .filter(m => m.content && !m.content.startsWith('[Image]') && !m.imageId && !m.videoId && m.role !== 'system' && m.name !== 'context')
                .filter((m,i,a) => m.name !== 'master' || i === a.findLastIndex(x => x.name === 'master'))
                .filter((m) => m.image_request != true);
                
            const lastMsgIndex = userData.messages.length - 1;
            const lastUserMessage = userData.messages[lastMsgIndex];
            const lastAssistantRelation = userData.messages
                .filter(msg => msg.role === 'assistant')
                .slice(-1)
                .map(msg => msg.custom_relation)
                .join(', ');

            // Prepare current user message
            let currentUserMessage = { role: 'user', content: lastUserMessage.content };
            if (lastUserMessage.name) currentUserMessage.name = lastUserMessage.name;
            if (lastUserMessage.trigger_image_request) currentUserMessage.image_request = lastUserMessage.trigger_image_request;
            if (lastUserMessage.image_request) currentUserMessage.image_request = lastUserMessage.image_request;
            if (lastUserMessage.nsfw) currentUserMessage.nsfw = lastUserMessage.nsfw;
            if (lastUserMessage.promptId) currentUserMessage.promptId = lastUserMessage.promptId;

            let genImage = {};

            // Handle image generation
            const imageGenResult = await handleImageGeneration(
                db, currentUserMessage, lastUserMessage, genImage, userData, 
                userInfo, isAdmin, characterDescription, userChatId, chatId, 
                userId, request.translations, fastify
            );
            
            genImage = imageGenResult.genImage;
            const imgMessage = imageGenResult.imgMessage;

            // Handle persona information
            let personaInfo = null;
            try {
                const personaId = userData?.persona || null;
                personaInfo = personaId ? await getPersonaById(db, personaId) : null;
            } catch (error) {
                console.log(`[/api/openai-chat-completion] Error fetching persona: ${error}`);
            }
            
            const userInfo_or_persona = personaInfo || userInfo;

            // Handle chat goals
            const { chatGoal, goalCompletion } = await handleChatGoals(
                db, userData, userChatId, chatDescription, personaInfo, 
                userSettings, language, request, fastify, userId, chatId
            );

            // Generate system content
            let enhancedSystemContent = await completionSystemContent(
                chatDocument,
                chatDescription,
                getCurrentTimeInJapanese(),
                language
            );

            // Apply user settings and goals to system prompt
            enhancedSystemContent = await applyUserSettingsToPrompt(fastify.mongo.db, userId, chatId, enhancedSystemContent);
            
            if (chatGoal) {
                const goalContext = `\n\n# Current Conversation Goal:\n` +
                    `Goal: ${chatGoal.goal_description}\n` +
                    `Type: ${chatGoal.goal_type}\n` +
                    `Completion: ${chatGoal.completion_condition}\n` +
                    `Difficulty: ${chatGoal.difficulty}\n` +
                    `Estimated messages: ${chatGoal.estimated_messages}\n` +
                    `${chatGoal.target_phrase ? `Target phrase to include: ${chatGoal.target_phrase}\n` : ''}` +
                    `${chatGoal.user_action_required ? `User should: ${chatGoal.user_action_required}\n` : ''}` +
                    `Work subtly toward this goal while maintaining natural conversation flow.`;
                
                enhancedSystemContent += goalContext;
            }

            if (goalCompletion && !goalCompletion.completed) {
                enhancedSystemContent += `\n\n# Current Goal Status:\n` +
                    `Status: ${goalCompletion.reason}\n` +
                    `Continue working toward this goal.`;
            }
            
            // Add user points and prepare messages
            enhancedSystemContent = enhancedSystemContent.replace(/{{userPoints}}/g, userPoints.toString());
            const userDetails = userDetailsToString(userInfo_or_persona);
            const custom_relation = await userSettings.relationshipType || lastAssistantRelation || 'Casual';
            
            const systemMsg = [
                { role: 'system', content: enhancedSystemContent },
                { role: 'user', content: userDetails }
            ];

            // Prepare messages for completion
            let messagesForCompletion = [];
            
            if (genImage?.image_request) {
                currentUserMessage.image_request = true;
                userData.messages[lastMsgIndex] = currentUserMessage;
                messagesForCompletion = [
                    ...systemMsg,
                    ...userMessages,
                    ...imgMessage
                ];
            } else {
                messagesForCompletion = [
                    ...systemMsg, 
                    ...userMessages
                ];
            }

            // Generate completion
            const customModel = (language === 'ja' || language === 'japanese') ? 'deepseek' : 'mistral';
            console.log(`[/api/openai-chat-completion] current lang ${language}, customModel: ${customModel}`);
            
            generateCompletion(messagesForCompletion, 600, customModel, language).then(async (completion) => {
                if (completion) {
                    fastify.sendNotificationToUser(userId, 'displayCompletionMessage', { message: completion, uniqueId });
                    
                    const newAssistantMessage = { 
                        role: 'assistant', 
                        content: completion, 
                        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
                        custom_relation: custom_relation ? custom_relation : 'Casual' 
                    };
                    
                    if (currentUserMessage.name) {
                        newAssistantMessage.name = currentUserMessage.name;
                    }
                    if (genImage?.image_request) {
                        newAssistantMessage.image_request = true;
                    }
                    
                    userData.messages.push(newAssistantMessage);
                    userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
                    
                    await updateMessagesCount(db, chatId);
                    await updateChatLastMessage(db, chatId, userId, completion, userData.updatedAt);
                    await updateUserChat(db, userId, userChatId, userData.messages, userData.updatedAt);

                    // Check if the assistant's new message was an image request
                    const assistantImageRequest = await checkImageRequest(newAssistantMessage.content,lastUserMessage.content);
                    console.log(`[/api/openai-chat-completion] Image request detected:`, assistantImageRequest);
                    if (assistantImageRequest && assistantImageRequest.image_request) {
                        lastUserMessage.content += newAssistantMessage.content;

                        handleImageGeneration(
                            db, assistantImageRequest, lastUserMessage, assistantImageRequest, userData,
                            userInfo, isAdmin, characterDescription, userChatId, chatId, userId, request.translations, fastify
                        );
                        
                    }
                } else {
                    fastify.sendNotificationToUser(userId, 'hideCompletionMessage', { uniqueId });
                }

                // Handle gallery image sending
                await handleGalleryImage(db, lastUserMessage, userData, userChatId, userId, fastify);
            });

        } catch (err) {
            console.log(err);
            reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
    });
}

module.exports = routes;
