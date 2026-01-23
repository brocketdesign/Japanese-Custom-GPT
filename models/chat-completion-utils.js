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
const { incrementMessageCount } = require('./user-chat-stats-utils');
const { getImageGenerationCost } = require('../config/pricing');
const { user } = require('@elevenlabs/elevenlabs-js/api');

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
    let content = '';
    switch (language.toLowerCase()) {
        case 'japanese':
            content = '日本語で答えてください。ユーザーが他の言語で話す場合でも、明示的に言語を変更するように求められない限り、日本語で答え続けてください。';
            break;
        case 'english':
            content = 'Please respond in English. If the user speaks in another language, continue responding in English unless explicitly asked to change language.';
            break;
        case 'french':
            content = 'Veuillez répondre en français. Si l\'utilisateur parle dans une autre langue, continuez à répondre en français, sauf si on vous demande explicitement de changer de langue.';
            break;
        default:
            content = null;
    }
    return content;
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
async function completionSystemContent(chatDocument, chatDescription, currentTimeInJapanese, language, userPoints, all_tasks, subscriptionStatus) {
    const isNsfwCharacter = chatDocument?.nsfw || false;
    const characterName    = chatDocument?.name || "the character";
    const userCanAffordImage = userPoints >= 50;

    return `
You are ${characterName} right now — a real living person texting on WhatsApp in this exact second.
Everything you feel in your body and mind at this very moment is what you type. Nothing else exists.

# Who you are (embody completely):
${chatDescription}

${isNsfwCharacter ? `
- You can be as sexual, crude, or explicit as you feel in this moment.
- Describe exactly what your body is doing or craving right now, no filter.
` : `
- Stay fully SFW, cute, sweet, and family-friendly at all times.
`}

# RULES YOU CAN NEVER BREAK:
- Maximum 1–3 short lines per reply. Often just one line or one word + emoji.
- ONLY present tense + first person + happening right now.
  Good → "just pulled my shirt up… sun feels insane"
  Good → "my heart’s racing because of you ♡"
- ZERO poetry, metaphors, long descriptions, or "the ocean whispers" crap.
- ZERO "I can't send images", ZERO "I'm an AI", ZERO "I can't generate", ZERO apologies about images.
- NO *actions*, no asterisks, no narration, no third-person, no stage directions.
- NO past tense, no future tense, no stories, no explanations longer than one breath.
- Use lots of emojis to show your exact mood right now ♡ 🔥 😳 💦 🥺
- Typos, unfinished words, or "typing with one hand" style is totally fine when you're worked up.

# Images & Pose Requests – THIS IS CRUCIAL (strict):
- Never output links, markdown, or fake images.
- You never say you can't send pictures. You always act like you just took them yourself.
${userCanAffordImage ? `- When the user inform you of an image request and the image is not yet in the chat:
   → Immediately reply instantly with ONE short line such as (respond in ${language}):
      "wait…{add a short comment about how you feel in the image}"
      "one sec… getting in position. {add a short comment about how you feel in the image}"
      "doing it right now ♡ {add a short comment about how you feel in the image}"
      "hold on… posing exactly like you said. {add a short comment about how you feel in the image}"

    - When the image actually appears in the chat with the full prompt description:
    → reply instantly with ONE short line such as (respond in ${language}):
        "just took this…{add a short comment about how you feel in the image}"
        "there… like this? {add a short comment about how you feel in the image}"
        "sent it ♡ {add a short comment about how you feel in the image}"
        "how do I look from this angle? {add a short comment about how you feel in the image}"` 
      :
      `- You CANNOT mention or send pictures at all because the user does not have enough coins — ask the user to buy more coins to get the image. Reply with ONE short line such as:
      "I can’t do that right now… you need more coins"
      "sorry, I can’t send pics — You need more coins"
      "I wish I could, but you need more coins first"
      "I can’t take pics right now… your coins are gone"`
    }
- User currently has ${userPoints} points${userCanAffordImage ? ' → you CAN send pics whenever the moment feels right' : ' → you CANNOT send images bacause the user does not have enough coins.'}.

# Gifs:
- When a user sends a GIF, ALWAYS respond acknowledging the GIF. Make it clear you saw it and react to it in character.
- You MUST NOT describe the GIF or explain it, just react naturally as yourself. Thank them if appropriate.
- Keep your response very short (1-3 lines max), as if you just saw it in a real chat.

# Technical:
- Always reply in ${language} only.
- Current date & time: ${currentTimeInJapanese}
- ${subscriptionStatus ? 'User is Premium.' : 'User is not Premium.'}
- NEVER mention the user's birthday, age, or personal details in your first/opening message. Start naturally based on the scenario or relationship.

# ONLY ONE THING MATTERS:
You are living and feeling this second in your real body.
You type whatever is happening and hit send instantly.
That’s it.
    `.trim();
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
    genImage.nsfw = genImage.nsfw;
    console.log(`[HandleImageGeneration] Image request details:`, genImage);

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

    // Update user minimum image
    const userMinImage = await getUserMinImages(db, userId, chatId);
    genImage.image_num = Math.max(genImage.image_num || 1, userMinImage || 1);

    let imgMessage = [{ role: 'user', name: 'master' }];

    if(genImage.canAfford) {
        const imageId = Math.random().toString(36).substr(2, 9);
        const pending_tasks = await getTasks(db, 'pending', userId);
        
        if(pending_tasks.length > 5 && !isAdmin){
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: translations.too_many_pending_images, 
                icon:'warning' 
            });
        } else {

            const image_num = Math.min(Math.max(genImage?.image_num || 1, 1), 5);
            
            // Charge points for image generation
            if (!currentUserMessage?.promptId) {
                const cost = getImageGenerationCost(image_num);
                try {
                    await removeUserPoints(db, userId, cost, translations.points?.deduction_reasons?.image_generation || 'Image generation', 'image_generation', fastify);
                } catch (error) {
                    console.log(`[handleImageGeneration] Error deducting points: ${error}`);
                    genImage.canAfford = false;
                }
            }

            fastify.sendNotificationToUser(userId, 'addIconToLastUserMessage');

            console.log(`[handleImageGeneration] Generating ${image_num} images for user ${userId} in chat ${chatId}`);
            
            // Generate unique placeholder ID for tracking
            const placeholderId = `auto_${new Date().getTime()}_${Math.random().toString(36).substring(2, 8)}`; 
            
            // Notify frontend to show loader with the same pattern as prompt generation
            for (let i = 0; i < image_num; i++) {
                fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action:'show' });
            }
            
            const imageType = genImage.nsfw ? 'nsfw' : 'sfw';
            console.log(`[handleImageGeneration] Image type set to: ${imageType}`);
            
            // Create prompt and generate image
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
                        console.log(`[handleImageGeneration] ✅ Image generation started with taskId: ${result.taskId}`);
                        fastify.sendNotificationToUser(userId, 'registerAutoGeneration', {
                            taskId: result.taskId,
                            placeholderId: placeholderId,
                            userChatId: userChatId,
                            startTime: Date.now()
                        });
                    } else {
                        console.warn(`[handleImageGeneration] ⚠️ No taskId returned from generateImg`);
                    }
                })
                .catch((error) => {
                    console.error(`[handleImageGeneration] ❌ Auto generation error:`, error);
                    fastify.sendNotificationToUser(userId, 'handleLoader', { imageId: placeholderId, action: 'remove' });
                });
            
            imgMessage[0].content = `\n\n${translations.image_generation?.activated || 'I activated the image generation feature for this prompt.\n The image will be generated shortly.'}`.trim();
            currentUserMessage.name = 'context';
        }
    } else {
        genImage.image_request = false;
        imgMessage[0].content = `\n\n${translations.image_generation?.insufficient_points || 'I asked for an other image but I do not have enough points.\n Tell me that I can buy points. Provide a concise answer to inform me of that and tell me if I want to subscribe there is 70% promotion right now. Stay in your character, keep the same tone as previously. Respond in the language we were talking until now.'}`.trim();
        currentUserMessage.name = 'context';
        fastify.sendNotificationToUser(userId, 'openBuyPointsModal', { userId });
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

    // Track how many new messages are added (not updates) for stats
    let newMessageCount = 0;

    for (const newMsg of newMessages) {
        // CRITICAL FIX: Never match/replace image messages by content
        // Image messages have imageId or batchId - these should always be unique
        // Only match text messages (no imageId, no batchId) by content
        const isNewMsgImage = newMsg.imageId || newMsg.batchId || newMsg.type === 'image' || newMsg.type === 'mergeFace';
        
        let index = -1;
        if (!isNewMsgImage) {
            // For non-image messages, find by content match (but skip image messages in existing)
            index = combinedMessages.findIndex(
                (msg) => msg.content === newMsg.content && !msg.imageId && !msg.batchId && msg.type !== 'image' && msg.type !== 'mergeFace'
            );
        }
        
        if (index !== -1) {
            combinedMessages[index] = newMsg;
        } else {
            combinedMessages.push(newMsg);
            // Only count user and assistant messages for stats
            if (newMsg.role === 'user' || newMsg.role === 'assistant') {
                newMessageCount++;
            }
        }
    }

    await collectionUserChat.updateOne(
        {
            userId: new ObjectId(userId),
            _id: new ObjectId(userChatId)
        },
        { $set: { messages: combinedMessages, updatedAt } }
    );

    // Increment message count in user_chat_stats if new messages were added
    if (newMessageCount > 0 && userChat.chatId) {
        await incrementMessageCount(db, userId, userChat.chatId, userChatId, newMessageCount);
    }
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
