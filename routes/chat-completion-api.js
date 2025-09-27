const { ObjectId } = require('mongodb');
const axios = require('axios');
const {
    checkImageRequest, 
    generateCompletion,
} = require('../models/openai');
const { 
    checkImageDescription,
    getTasks
} = require('../models/imagen');
const { 
    getLanguageName, 
    checkUserAdmin,
    getApiUrl
} = require('../models/tool');
const {
    getUserChatToolSettings,
    applyUserSettingsToPrompt,
    getAutoImageGenerationSetting,
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
    handleGalleryImage,
    getLanguageDirectiveMessage
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
// Helper function to transform user messages for completion
function transformUserMessages(messages, translations = {}) {
    //console.log(`[/api/openai-chat-completion] Original messages:`, messages)
    const transformedMessages = [];
    
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        // Skip system messages and context messages
        if (message.role === 'system' || message.name === 'context') {
            continue;
        }
        
        // Skip messages with image requests (they're handled separately)
        if (message.image_request === true) {
            continue;
        }
        
        // Handle image messages
        if (message.type === 'image' && message.imageUrl) {
            let imageContent = translations?.sent_image || 'I sent you the image.';

            imageContent += message.content ? ` ${message.content}` : '';

            if (message.prompt) {
                const userDetailMessage = 
                {
                    role: 'user',
                    content: `I asked for the following image : " ${message.prompt} " ]`,
                    hidden: true
                };
                transformedMessages.push(userDetailMessage);
            }
            
            const imageMessage = {
                role: message.role,
                content: imageContent
            };
            
            if (message.name) imageMessage.name = message.name;
            if (message.timestamp) imageMessage.timestamp = message.timestamp;
            if (message.custom_relation) imageMessage.custom_relation = message.custom_relation;
            
            transformedMessages.push(imageMessage);
            
            // Check for actions (like) and add user response
            if (message.actions && message.actions.length > 0) {
                const likeAction = message.actions.find(action => action.type === 'like');
                if (likeAction) {
                    const likeMessage = {
                        role: 'user',
                        content: translations.image_liked || '👍 I liked this image',
                        timestamp: likeAction.date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
                    };
                    
                    transformedMessages.push(likeMessage);
                }
            }
            continue;
        }
        
        // Handle video messages
        if (message.type === 'video' && message.videoUrl) {
            let videoContent = `[Video] ${message.videoId}`;
            if (message.description) {
                videoContent += ` - ${message.description}`;
            }
            
            const videoMessage = {
                role: message.role,
                content: videoContent
            };
            
            if (message.name) videoMessage.name = message.name;
            if (message.timestamp) videoMessage.timestamp = message.timestamp;
            if (message.custom_relation) videoMessage.custom_relation = message.custom_relation;
            
            transformedMessages.push(videoMessage);
            
            // Check for actions on video
            if (message.actions && message.actions.length > 0) {
                const likeAction = message.actions.find(action => action.type === 'like');
                if (likeAction) {
                    const likeMessage = {
                        role: 'user',
                        content: translations.video_liked || '👍 I liked this video',
                        timestamp: likeAction.date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
                    };
                    
                    transformedMessages.push(likeMessage);
                }
            }
            continue;
        }
        
        // Handle regular text messages
        if (message.content && !message.content.startsWith('[Image]') && !message.content.startsWith('[Video]') && !message.imageId && !message.videoId) {
            const textMessage = {
                role: message.role,
                content: message.content
            };
            
            if (message.name) textMessage.name = message.name;
            if (message.timestamp) textMessage.timestamp = message.timestamp;
            if (message.custom_relation) textMessage.custom_relation = message.custom_relation;
            if (message.nsfw) textMessage.nsfw = message.nsfw;
            if (message.promptId) textMessage.promptId = message.promptId;
            
            transformedMessages.push(textMessage);

            // Handle actions on text messages (for both assistant and user messages)
            if (message.actions && message.actions.length > 0) {
                const likeAction = message.actions.find(action => action.type === 'like');
                const dislikeAction = message.actions.find(action => action.type === 'dislike');
                
                if (likeAction) {
                    const feedbackMessage = {
                        role: 'user',
                        content: message.role === 'assistant' 
                            ? (translations.message_liked || '👍 I liked your response')
                            : (translations.message_liked || '👍 I liked this message'),
                        timestamp: likeAction.date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
                    };
                    
                    transformedMessages.push(feedbackMessage);
                } else if (dislikeAction) {
                    const feedbackMessage = {
                        role: 'user',
                        content: message.role === 'assistant' 
                            ? (translations.message_disliked || '👎 I didn\'t like your response')
                            : (translations.message_disliked || '👎 I didn\'t like this message'),
                        timestamp: dislikeAction.date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
                    };
                    
                    transformedMessages.push(feedbackMessage);
                }
            }
            
            continue;
        }
    }
    
    // Ensure only the last 'master' message is kept
    const filteredMessages = transformedMessages.filter((m, i, a) => 
        m.name !== 'master' || i === a.findLastIndex(x => x.name === 'master')
    );
    
    return filteredMessages;
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
            const userSettings = await getUserChatToolSettings(fastify.mongo.db, userId, chatId);
            let userData = await getUserChatData(db, userId, userChatId);
            const subscriptionStatus = userInfo.subscriptionStatus == 'active' ? true : false;
            
            if (!userData) { 
                return reply.status(404).send({ error: 'User data not found' }); 
            }

            const isAdmin = await checkUserAdmin(fastify, userId);
            const chatDocument = await getChatDocument(request, db, chatId);
            const nsfw = chatDocument?.nsfw || false;
            const characterNsfw = chatDocument?.nsfw || false;
            const chatDescription = chatDataToString(chatDocument);
            const characterDescription = await checkImageDescription(db, chatId, chatDocument);
            const language = getLanguageName(userInfo.lang);
            
            // Get the last message and related info
            const lastMsgIndex = userData.messages.length - 1;
            const lastUserMessage = userData.messages[lastMsgIndex];
            const lastAssistantRelation = userData.messages
                .filter(msg => msg.role === 'assistant')
                .slice(-1)
                .map(msg => msg.custom_relation)
                .join(', ');

            let genImage = {};

            // Transform messages for completion (excluding the last message which we handle separately)
            const userMessages = transformUserMessages(userData.messages, request.translations);
            //console.log(`[/api/openai-chat-completion] Transformed user messages:`, userMessages);
            
            // Handle image generation with the last message
            const imageGenResult = await handleImageGeneration(
                db, lastUserMessage, lastUserMessage, genImage, userData, 
                userInfo, isAdmin, characterDescription, characterNsfw, userChatId, chatId, 
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

            
            // Handle chat goals - Update this section
            let chatGoal = null;
            let goalCompletion = null;
            
            // Check if goals are enabled for this chat
            const goalsEnabled = userSettings.goalsEnabled !== false; // Default to true if not set
            
            if (goalsEnabled) {
                const goalResult = await handleChatGoals(
                    db, userData, userChatId, chatDescription, personaInfo, 
                    userSettings, subscriptionStatus, language, request, fastify, userId, chatId
                );
                chatGoal = goalResult.chatGoal;
                goalCompletion = goalResult.goalCompletion;
            }

            // Check the user's points balance after handling goals in case the user completed a goal
            const userPoints = await getUserPoints(fastify.mongo.db, userId);
            const all_tasks = await getTasks(db, null, userId);

            // Generate system content
            let enhancedSystemContent = await completionSystemContent(
                chatDocument,
                chatDescription,
                getCurrentTimeInJapanese(),
                language,
                userPoints,
                all_tasks,
                subscriptionStatus
            );

            // Apply user settings and goals to system prompt
            enhancedSystemContent = await applyUserSettingsToPrompt(fastify.mongo.db, userId, chatId, enhancedSystemContent);
      
            if (goalsEnabled && chatGoal) {
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

            if (goalsEnabled && goalCompletion && !goalCompletion.completed) {
                enhancedSystemContent += `\n\n# Current Goal Status:\n` +
                    `Status: ${goalCompletion.reason}\n` +
                    `Continue working toward this goal.`;
            }
            
            // Generate the langugage directive message
            const languageDirective = getLanguageDirectiveMessage(language);

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
                // Mark the last message as having an image request
                lastUserMessage.image_request = true;
                userData.messages[lastMsgIndex] = lastUserMessage;
                
                messagesForCompletion = [
                    ...systemMsg,
                    ...languageDirective,
                    ...userMessages,
                    ...imgMessage
                ];
            } else {
                messagesForCompletion = [
                    ...systemMsg, 
                    ...languageDirective,
                    ...userMessages
                ];
            }

            // Generate completion
            const customModel = (language === 'ja' || language === 'japanese') ? 'deepseek' : 'mistral';
            const selectedModel = userSettings.selectedModel || customModel;
            const isPremium = subscriptionStatus;
            
            //console.log(`[/api/openai-chat-completion] Using model: ${selectedModel}, Language: ${language}, Premium: ${isPremium}`);
            //console.log(`[/api/openai-chat-completion] System message:`, messagesForCompletion[0]);
            //console.log(`[/api/openai-chat-completion] Messages for completion:`, messagesForCompletion);
            
            generateCompletion(messagesForCompletion, 600, selectedModel, language, selectedModel, isPremium).then(async (completion) => {
                if (completion) {
                    fastify.sendNotificationToUser(userId, 'displayCompletionMessage', { message: completion, uniqueId });
                    
                    const newAssistantMessage = { 
                        role: 'assistant', 
                        content: completion, 
                        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
                        custom_relation: custom_relation ? custom_relation : 'Casual' 
                    };
                    
                    if (lastUserMessage.name) {
                        newAssistantMessage.name = lastUserMessage.name;
                    }
                    if (genImage?.image_request) {
                        newAssistantMessage.image_request = true;
                    }
                    
                    userData.messages.push(newAssistantMessage);
                    userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
                    
                    await updateMessagesCount(db, chatId);
                    await updateChatLastMessage(db, chatId, userId, completion, userData.updatedAt);
                    await updateUserChat(db, userId, userChatId, userData.messages, userData.updatedAt);

                    // Check if the assistant's new message was an image request [ONLY IF THE USER SETTING IS ENABLED] // New Update
                    const newUserPointsBalance = await getUserPoints(db, userId);
                    const autoImageGenerationEnabled = await getAutoImageGenerationSetting(db, userId, chatId);

                    if( messagesForCompletion.length > 4 && newUserPointsBalance >= 10 && autoImageGenerationEnabled ) {
                        const assistantImageRequest = await checkImageRequest(newAssistantMessage.content, lastUserMessage.content);
                        //console.log(`[/api/openai-chat-completion] Image request detected:`, assistantImageRequest);
                        if (assistantImageRequest && assistantImageRequest.image_request) {
                            lastUserMessage.content += ' ' + newAssistantMessage.content;

                            const imageResult = await handleImageGeneration(
                                db, assistantImageRequest, lastUserMessage, assistantImageRequest, userData,
                                userInfo, isAdmin, characterDescription, nsfw, userChatId, chatId, userId, request.translations, fastify
                            );
                            
                            if(!imageResult.genImage.canAfford) {
                                fastify.sendNotificationToUser(userId, 'showNotification', { message: request.userPointsTranslations.insufficientFunds.replace('{{points}}', 10), icon: 'warning' });
                            }   
                        }
                    } else {
                        console.log(`[/api/openai-chat-completion] Auto image generation disabled, insufficient points, or not enough context.`);
                    }
                } else {
                    fastify.sendNotificationToUser(userId, 'hideCompletionMessage', { uniqueId });
                }

                // Handle sendImage from gallery on startup
                await handleGalleryImage(db, lastUserMessage, userData, userChatId, userId, fastify);
            });

        } catch (err) {
            console.log(err);
            reply.status(500).send({ error: 'Error fetching OpenAI completion' });
        }
    });
}

module.exports = routes;
