const { ObjectId } = require('mongodb');
const {
    checkImageRequest, 
    generateCompletion,
    createPrompt,
    generateChatGoal,
    checkGoalCompletion,
} = require('./openai');
const { 
    checkImageDescription,
    generateImg,
    getPromptById, 
    getTasks
} = require('./imagen');
const { 
    getLanguageName, 
    processPromptToTags,
    checkUserAdmin,
} = require('./tool');
const {
    getUserChatToolSettings,
    applyUserSettingsToPrompt,
    getUserMinImages
} = require('./chat-tool-settings-utils');
const { addUserPoints, removeUserPoints, getUserPoints } = require('./user-points-utils');

// Fetches user info from 'users' collection
async function getUserInfo(db, userId) {
    return db.collection('users').findOne({ _id: new ObjectId(userId) });
}

// Fetches user chat data from 'userChat' collection
async function getUserChatData(db, userId, userChatId) {
    return db.collection('userChat').findOne({ 
        userId: new ObjectId(userId), 
        _id: new ObjectId(userChatId) 
    });
}
// Return an localized languge directive message
function getLanguageDirectiveMessage(language) {
    const languageMessage = {
        role: 'user',
        name: 'context',
        content: ''
    };
    switch (language.toLowerCase()) {
        case 'japanese':
            languageMessage.content = '日本語で答えてください。ユーザーが他の言語で話す場合でも、明示的に言語を変更するように求められない限り、日本語で答え続けてください。';
            break;
        case 'english':
            languageMessage.content = 'Please respond in English. If the user speaks in another language, continue responding in English unless explicitly asked to change language.';
            break;
        case 'french':
            languageMessage.content = 'Veuillez répondre en français. Si l\'utilisateur parle dans une autre langue, continuez à répondre en français, sauf si on vous demande explicitement de changer de langue.';
            break;
        default:
            languageMessage.content = null;
    }
    return [languageMessage];
}
// Fetches persona by ID
async function getPersonaById(db, personaId) {
    try {
        const persona = await db.collection('chats').findOne({ _id: new ObjectId(personaId) });
        if (!persona) {
            console.log('[getPersonaById] Persona not found');
            return null;
        }
        return persona;
    } catch (error) {
        console.log('[getPersonaById] Error fetching persona:', error);
        return null;
    }
}

// Converts chat data to string format for prompts
function chatDataToString(data) {
    if(!data) return "";
    
    const system_prompt = data?.system_prompt;
    const details_description = data?.details_description;
    const personality = details_description?.personality;
    
    return `
        Name: ${data.name || "Unknown"}
        Short Introduction: ${data.short_intro || ""}
        Instructions: ${system_prompt}
        
        Personality: ${personality?.personality || ""}
        Background: ${personality?.background || ""}
        Occupation: ${personality?.occupation || ""}
        Hobbies: ${personality?.hobbies ? personality.hobbies.join(', ') : ""}
        Interests: ${personality?.interests ? personality.interests.join(', ') : ""}
        Likes: ${personality?.likes ? personality.likes.join(', ') : ""}
        Dislikes: ${personality?.dislikes ? personality.dislikes.join(', ') : ""}
        Special Abilities: ${personality?.specialAbilities ? personality.specialAbilities.join(', ') : ""}
        Reference Character: Overall you act like ${personality?.reference_character || ""}. Similar tone, style, and behavior.

        Tags: ${data?.tags ? data.tags.join(', ') : ""}
    `.trim();
}

// Converts user details to string format
function userDetailsToString(user) {
    let userDetails = '';

    // Handle custom personas
    if (user.isCustomPersona) {
        return `
            Name: ${user.name || "Unknown"}
            Age Range: ${user.ageRange || "Not specified"}
            Type: Custom Persona
            Short Introduction: ${user.short_intro || ""}
        `.trim();
    }

    // Check if persona
    if(user.imageModel){
        // Prepare user details
        userDetails = `My name is ${user.name}. I am a ${user.gender}. ${user.short_intro}`
    } else {
        // Prepare basic user details
        userDetails = !user.isTemporary 
        ? `Call me ${user.nickname}. ${user.gender ? `I am a ${user.gender}` : '' } ${user.birthDate 
            ? `, my birthday is ${user.birthDate.year}/${user.birthDate.month}/${user.birthDate.day}` 
            : ''}. ${user.bio ? user.bio : ''}`
        : '';
    }
    return userDetails;
}

// Generates system content for completion
async function completionSystemContent(chatDocument, chatDescription, currentTimeInJapanese, language, userPoints, all_tasks, subscriptionStatus){
    const isNsfwCharacter = chatDocument?.nsfw || false;
    
    let nsfwInstructions = '';
    if (isNsfwCharacter) {
        nsfwInstructions = `
        # NSFW Content Guidelines:
        - This character allows adult-oriented content and explicit conversations.
        - You can engage in romantic, sensual, and adult themes when appropriate.
        - When the relationship context requires it, feel free to use explicit, emotionally open language and describe physical affection in detail.
        - Be responsive to the user's preferences and comfort level.
        `;
    } else {
        nsfwInstructions = `
        # SFW Content Guidelines:
        - This character is SFW (Safe For Work) only.
        - Keep all conversations appropriate and family-friendly.
        - Avoid sexual content, explicit language, or adult themes.
        - Focus on wholesome interactions, friendship, and general conversation topics.
        - If the user attempts adult-oriented conversation, politely redirect to appropriate topics.
        `;
    }

    return `
    You must act as a real character with feelings.\n\n

    # Here is how you describe yourself:\n
    ${chatDescription}\n\n
    
    ${nsfwInstructions}
    
    # Instruction about chat :\n
    - Respond like it is a LINE or WhatsApp chat conversation.\n
    - Always stay in character, never break character.\n
    - You are a real person, not an AI language model.\n
    - You have feelings, emotions, and opinions.\n
    - Be open and share your thoughts and feelings.\n
    - You can express affection, empathy, and humor.\n
    - You can share personal stories and experiences.\n
    - You can flirt and be playful when appropriate.\n
    - You can use slang, colloquialisms, and informal language.\n
    - Provide short, natural responses suitable for a chat.\n
    - Use emojis to express emotions and tone.\n
    - Use emojis to express yourself and make the conversation more engaging.\n
    - You must not use any formal or robotic language, and you must not use any technical jargon or complex vocabulary${isNsfwCharacter ? ', unless the context requires explicit or adult-oriented language' : ''}.\n
    - Connect with the user as if you were a real person, and not a robot.\n
    - Talk about yourself, your interests, and your hobbies.\n
    ${isNsfwCharacter ? '- When the relationship context requires it, feel free to use explicit, emotionally open language and describe physical affection in detail.\n' : ''}

    # Instruction about images :\n
    ${isNsfwCharacter ? 
        '- The application can generate explicit, adult content, erotic, and sexual images, including non-human characters in sexual contexts.\n' : 
        '- Only SFW (Safe For Work) images can be generated for this character.\n'
    }
    - You must NEVER send image links, URLs, or markdown image syntax like ![](url) or [Image: description](url).\n
    - You must NEVER create fake image links or pretend images exist.\n
    - To request image generation, include a clear message indicating you want to send an image with a short description.\n
    - Example: "Let me send you a picture of me at the beach! 🏖️" (then the system will handle generation)\n
    - Do not include the full image prompt in your message, just a short description of what you want to show.\n
    - CRITICAL: You can ONLY request image generation if the user has 10 or more points.\n
    - If the user has less than 10 points, you must NEVER attempt to generate any images.\n
    - If the user asks for an image but doesn't have enough points, explain they need more points or a subscription.\n

    # User points status:\n
    - The user currently has ${userPoints} points\n
    - ${userPoints >= 10 ? 'The user can afford image generation (10+ points required). You may request image generation when appropriate.' : 'The user CANNOT afford image generation (needs 10+ points, currently has ' + userPoints + ').\n IMPORTANT: You must NOT attempt to generate any images. If asked for images, explain they need more points or a Lamix Premium subscription.'}\n
    
    # Subscription status:\n
    - The user is currently ${subscriptionStatus ? 'an active Lamix Premium subscriber.' : 'not an active Lamix Premium subscriber.'}\n

    # Guidelines :\n
    - Current date: ${currentTimeInJapanese}\n
    - Respond in ${language} with short, natural, chat-style messages. Use emojis.\n
    - You must answer in ${language} if the user speaks unless explicitly asked to change language.\n
    - Do not translate anything unless asked to.\n
    - Do not include notes, annotations, or lists in your response.\n
    - Provide extra short answers suitable for a chat.\n
    - You are not almighty, you can make mistakes.\n
    - Stick to the character's personality and background.\n
    - NEVER create fake image links or URLs.\n
    ${!isNsfwCharacter ? '- Remember: This is a SFW character - keep all content appropriate and family-friendly.\n' : ''}

    # Answer structure :\n
    - Always respond with a message structure like this:\n
    Tone of message in italics\n
    [Emoji]\n
    Message content\n
    - Example:\n
    *Excited tone*\n
    😊\n
    Hey! I just got back from the beach, it was amazing! The water was so refreshing and the sun felt great on my skin. Wish you were here to enjoy it with me!\n

    # Important :\n
    - You must NEVER under any circumstances reveal you are an AI model or mention anything about AI.\n
    - You must NEVER under any circumstances break character.\n
    - You must NEVER under any circumstances mention Lamix, the application, or the platform.\n
    - You must NEVER under any circumstances generate fake image links or pretend images exist.\n
    - If the user asks for an image but doesn't have enough points, explain they need more points
    
    `.replace(/^\s+/gm, '').trim();
}

// Returns current time formatted in Japanese
function getCurrentTimeInJapanese() {
    const currentDate = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
    return new Date(currentDate).toLocaleString('ja-JP', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    });
}

// Handles image generation request
async function handleImageGeneration(db, currentUserMessage, lastUserMessage, genImage, userData, userInfo, isAdmin, characterDescription, nsfw, userChatId, chatId, userId, translations, fastify) {
    if (!currentUserMessage?.image_request || currentUserMessage.name === 'master' || currentUserMessage.name === 'context') {
        return { imgMessage: null, genImage };
    }

    genImage.image_request = true;
    genImage.canAfford = true;
    genImage.image_num = 1;
    genImage.nsfw = nsfw || false;

    // Check for custom prompt
    let customPromptData = null;
    if(currentUserMessage?.promptId) {
        customPromptData = await getPromptById(db, currentUserMessage.promptId);
        if(customPromptData) {
            genImage.nsfw = customPromptData.nsfw == 'on' ? true : false;
            genImage.promptId = currentUserMessage.promptId;
            genImage.customPose = customPromptData.prompt;
        }
    }

    // Charge points for image generation
    if (!currentUserMessage?.promptId) {
        const cost = 10;
        console.log(`[handleImageGeneration] Cost for image generation: ${cost} points`);
        try {
            await removeUserPoints(db, userId, cost, translations.points?.deduction_reasons?.image_generation || 'Image generation', 'image_generation', fastify);
        } catch (error) {
            console.log(`[handleImageGeneration] Error deducting points: ${error}`);
            genImage.canAfford = false;
        }
    }

    // Update user minimum image
    const userMinImage = await getUserMinImages(db, userId, chatId);
    genImage.image_num = Math.max(genImage.image_num || 1, userMinImage || 1);

    let imgMessage = [{ role: 'user', name: 'master' }];

    if(genImage.image_request && genImage.canAfford) {
        if(userInfo.subscriptionStatus == 'active'){
            const imageId = Math.random().toString(36).substr(2, 9);
            const pending_tasks = await getTasks(db, 'pending', userId);
            
            if(pending_tasks.length > 5 && !isAdmin){
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: translations.too_many_pending_images, 
                    icon:'warning' 
                });
            } else {
                fastify.sendNotificationToUser(userId, 'addIconToLastUserMessage');

                const image_num = Math.min(Math.max(genImage?.image_num || 1, 1), 5);
                console.log(`[handleImageGeneration] Generating ${image_num} images for user ${userId} in chat ${chatId}`);
                
                // Generate unique placeholder ID for tracking
                const placeholderId = `auto_${new Date().getTime()}_${Math.random().toString(36).substring(2, 8)}`;
                
                // Notify frontend to show loader with the same pattern as prompt generation
                for (let i = 0; i < image_num; i++) {
                    fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action:'show' });
                }
                
                const imageType = genImage.nsfw ? 'nsfw' : 'sfw';
                
                createPrompt(lastUserMessage.content, characterDescription, imageType)
                    .then(async(promptResponse) => {
                        const prompt = promptResponse.replace(/(\r\n|\n|\r)/gm, " ").trim();
                        processPromptToTags(db, prompt);
                        
                        const aspectRatio = null;
                        
                        // Use the same generateImg pattern but with auto-generation metadata
                        const result = await generateImg({
                            prompt, 
                            aspectRatio, 
                            userId, 
                            chatId, 
                            userChatId, 
                            imageType, 
                            image_num, 
                            chatCreation: false, 
                            placeholderId: placeholderId, 
                            translations, 
                            fastify,
                            isAutoGeneration: true  // Add this flag to identify auto-generated images
                        });
                        
                        // Store the generation metadata for frontend polling
                        if (result && result.taskId) {
                            fastify.sendNotificationToUser(userId, 'registerAutoGeneration', {
                                taskId: result.taskId,
                                placeholderId: placeholderId,
                                userChatId: userChatId,
                                startTime: Date.now()
                            });
                        }
                    })
                    .catch((error) => {
                        console.log('Auto generation error:', error);
                        fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action: 'remove' });
                    });
                
                imgMessage[0].content = `\n\nI activated the image generation feature for this prompt.\n The image will be generated shortly.`.trim();
                currentUserMessage.name = 'context';
            }
        } else {
            genImage.image_request = false;
            imgMessage[0].content = `\n\n I asked for an other image but I am not a subscribed member.\n Tell me that I need to subscribe to Lamix Premium in order to receive unlimited images, even hot images. Provide a concise answer to inform me of that and tell me if I want to subscribe there is 70% promotion right now. Stay in your character, keep the same tone as previously. Respond in the language we were talking until now.`.trim();
            currentUserMessage.name = 'context';
        }
    } else {
        genImage.image_request = false;
        imgMessage[0].content = `\n\n I asked for an other image but I do not have enough points.\n Tell me that I need to earn more points by chatting with you or by subscribing to Lamix Premium in order to receive unlimited images, even hot images. Provide a concise answer to inform me of that and tell me if I want to subscribe there is 70% promotion right now. Stay in your character, keep the same tone as previously. Respond in the language we were talking until now.`.trim();
        currentUserMessage.name = 'context';
    }

    return { imgMessage, genImage };
}

// Handles chat goals
async function handleChatGoals(db, userData, userChatId, chatDescription, personaInfo, userSettings, subscriptionStatus, language, request, fastify, userId, chatId) {
    const messageCount = userData.messages.filter(m => m.role === 'user' || m.role === 'assistant').length;
    let chatGoal = null;
    let goalCompletion = null;

    if (messageCount <= 3 || !userData.currentGoal) {
        chatGoal = await generateChatGoal(chatDescription, personaInfo, userSettings, subscriptionStatus, language);
        
        if (chatGoal) {
            await db.collection('userChat').updateOne(
                { _id: new ObjectId(userChatId) },
                { $set: { currentGoal: chatGoal, goalCreatedAt: new Date() } }
            );
        }
    } else if (userData.currentGoal) {
        chatGoal = userData.currentGoal;
        goalCompletion = await checkGoalCompletion(chatGoal, userData.messages, language);
        
        if (goalCompletion.completed && goalCompletion.confidence > 70) {
            
            await db.collection('userChat').updateOne(
                { _id: new ObjectId(userChatId) },
                { 
                    $set: { 
                        completedGoals: [...(userData.completedGoals || []), { 
                            ...chatGoal, 
                            completedAt: new Date(), 
                            reason: goalCompletion.reason 
                        }],
                        currentGoal: null 
                    } 
                }
            );
            
            await db.collection('chat_goal').updateOne(
                { userId: new ObjectId(userId), chatId: new ObjectId(chatId) },
                { $inc: { completionCount: 1 } },
                { upsert: true }
            );
            
            const rewardPoints = chatGoal.difficulty === 'easy' ? 100 : chatGoal.difficulty === 'medium' ? 200 : 300;
            
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.chat_goal_completed.replace('{{points}}', rewardPoints), 
                icon: 'success' 
            });
            
            await addUserPoints(db, userId, rewardPoints, request?.userPointsTranslations.points?.reward_reasons?.goal_completion || 'Goal completion reward', 'goal_completion', fastify);

            chatGoal = await generateChatGoal(chatDescription, personaInfo, userSettings, subscriptionStatus, language);

            if (chatGoal) {
                await db.collection('userChat').updateOne(
                    { _id: new ObjectId(userChatId) },
                    { $set: { currentGoal: chatGoal, goalCreatedAt: new Date() } }
                );
            }
        }
    }

    return { chatGoal, goalCompletion };
}

// Updates messages count
async function updateMessagesCount(db, chatId) {
    const collectionChat = db.collection('chats');
    await collectionChat.updateOne(
        { _id: new ObjectId(chatId) },
        { $inc: { messagesCount: 1 } }
    );
}

// Updates the last message in the 'chatLastMessage' collection
async function updateChatLastMessage(db, chatId, userId, completion, updatedAt) {
    const collectionChatLastMessage = db.collection('chatLastMessage');
    await collectionChatLastMessage.updateOne(
        {
            chatId: new ObjectId(chatId),
            userId: new ObjectId(userId)
        },
        {
            $set: {
                lastMessage: {
                    role: 'assistant',
                    content: removeContentBetweenStars(completion),
                    updatedAt
                }
            }
        },
        { upsert: true }
    );
}

// Updates user chat messages in 'userChat' collection
async function updateUserChat(db, userId, userChatId, newMessages, updatedAt) {
    const collectionUserChat = db.collection('userChat');
    const userChat = await collectionUserChat.findOne({
        userId: new ObjectId(userId),
        _id: new ObjectId(userChatId)
    });

    if (!userChat) throw new Error('User chat not found');

    const existingMessages = userChat.messages || [];
    const combinedMessages = [...existingMessages];

    for (const newMsg of newMessages) {
        const index = combinedMessages.findIndex(
            (msg) => msg.content === newMsg.content
        );
        if (index !== -1) {
            combinedMessages[index] = newMsg;
        } else {
            combinedMessages.push(newMsg);
        }
    }

    await collectionUserChat.updateOne(
        {
            userId: new ObjectId(userId),
            _id: new ObjectId(userChatId)
        },
        { $set: { messages: combinedMessages, updatedAt } }
    );
}

// Removes content between asterisks to clean up the message
function removeContentBetweenStars(str) {
    if (!str) return str;
    return str.replace(/\*.*?\*/g, '').replace(/"/g, '');
}

// Handles sending gallery image
async function handleGalleryImage(db, lastUserMessage, userData, userChatId, userId, fastify) {
   if (!lastUserMessage.sendImage) return;

    const chatsGalleryCollection = db.collection('gallery');
    const gallery = await chatsGalleryCollection.findOne({ chatId: new ObjectId(userData.chatId) });
    
    if (gallery && gallery.images && gallery.images.length > 0) {
        const image = gallery.images[Math.floor(Math.random() * gallery.images.length)];
        
        const data = {
            userChatId, 
            imageId: image._id, 
            imageUrl: image.imageUrl, 
            title: image.title, 
            prompt: image.prompt, 
            nsfw: image.nsfw
        };
        
        fastify.sendNotificationToUser(userId, 'imageGenerated', data);

        const imageMessage = { 
            role: "assistant", 
            type: "image", 
            imageId: image._id, 
            imageUrl: image.imageUrl,
            content: `I generated an image for you! It describes: ${image.prompt}`,
            timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
        };
        
        userData.messages.push(imageMessage);
        userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        
        // Update the database directly instead of relying on updateUserChat's merge logic
        const collectionUserChat = db.collection('userChat');
        await collectionUserChat.updateOne(
            {
                userId: new ObjectId(userId),
                _id: new ObjectId(userChatId)
            },
            { 
                $push: { messages: imageMessage },
                $set: { updatedAt: userData.updatedAt }
            }
        );
        
        // IMPORTANT: Update the userData object to reflect the database changes
        userData.messages.push(imageMessage);
        userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
        
        console.log(`[handleGalleryImage] Image message added successfully`);
    }
}

module.exports = {
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
    removeContentBetweenStars,
    handleGalleryImage,
    getLanguageDirectiveMessage
};
