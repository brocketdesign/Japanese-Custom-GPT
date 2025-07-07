const { ObjectId } = require('mongodb');
const slugify = require('slugify');
const {
    checkImageRequest, 
    generateCompletion,
    generatePromptSuggestions,
    createPrompt
} = require('../models/openai')
const { 
    checkImageDescription,
    generateImg,
    getPromptById, 
    getTasks
} = require('../models/imagen');
const { 
    getLanguageName, 
    handleFileUpload,
    convertImageUrlToBase64, 
    sanitizeMessages,
    fetchTags,
    processPromptToTags,
    saveChatImageToDB,
    checkUserAdmin,
    getApiUrl
} = require('../models/tool');
const {
    getUserChatToolSettings,
    applyUserSettingsToPrompt,
    getVoiceSettings
} = require('../models/chat-tool-settings-utils');
const { getActiveSystemPrompt } = require('../models/system-prompt-utils');
const { removeUserPoints, getUserPoints } = require('../models/user-points-utils');

const axios = require('axios');
const OpenAI = require("openai");
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const free_models = false // ['293564']; // [DEBUG] Disable temporary
// Helper function to tokenize a prompt string (can be moved to a shared utility if used elsewhere)
function tokenizePrompt(promptText) {
  if (!promptText || typeof promptText !== 'string') {
    return new Set();
  }
  return new Set(
    promptText
      .toLowerCase()
      .split(/\W+/) // Split by non-alphanumeric characters
      .filter(token => token.length > 0) // Remove empty tokens
  );
}
async function getPersonaById(db, personaId){ // a persona is a chat
    try {
        const persona = await db.collection('chats').findOne({ _id: new ObjectId(personaId) });
        if (!persona) {
            console.log('[POST /api/user/personas] Persona not found');
            return null;
        }
        console.log(`[POST /api/user/personas] Persona found: ${persona.name}`);
        return persona;
    } catch (error) {
        console.log('[POST /api/user/personas] Error fetching persona:', error);
        return null;
    }
}
async function routes(fastify, options) {

    fastify.post('/api/init-chat', async (request, reply) => {
        try {
          // Mongo collections
          const usersCollection = fastify.mongo.db.collection('users');
          const collectionChat = fastify.mongo.db.collection('chats');
          const collectionUserChat = fastify.mongo.db.collection('userChat');
          
      
          // Extract and normalize request data
          let { message, chatId, userChatId, isNew } = request.body;
          let userId = request.body.userId;
          if (!userId) {
            const authenticatedUser = request.user;
            userId = authenticatedUser._id;
          }
      
          const user = request.user;
          let language = getLanguageName(user?.lang);
      
          const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
      
          // Retrieve chat and user-chat documents
          let userChatDocument = await collectionUserChat.findOne({ 
            userId: new fastify.mongo.ObjectId(userId), 
            _id: new fastify.mongo.ObjectId(userChatId) 
          });

        if (!userChatDocument || isNew) {
            const isLoggedIn = user && !user.isTemporary;
            let startMessage = { role: 'user', name: 'master' };

            if (!isLoggedIn) {
                // [DEBUG] Disable temporary
                /*
                startMessage.content =
                "Start with a greeting and prompt the user to log in. Do not start with a confirmation, but directly greet and ask the user to log in.";
                */
            } else {
                const subscriptionActive = user?.subscriptionStatus === 'active';
                const userChat = await collectionUserChat
                .find({
                    userId: new fastify.mongo.ObjectId(userId),
                    chatId: new fastify.mongo.ObjectId(chatId),
                })
                .toArray();

                if (userChat.length > 0) {
                    startMessage.sendImage = true;
                    startMessage.content =
                        "Start by welcoming me back. Inform me that you enjoy our chats and ask if I would like to see another image.";
                } else {
                    startMessage.sendImage = true;
                    if (subscriptionActive) {
                        startMessage.content =
                        "Start by greeting me, say it's nice to meet me for the first time, introduce yourself and mention you can send images.";
                    } else {
                        startMessage.content =
                        "Start by greeting me, say it's nice to meet me for the first time, introduce yourself and mention you can send images.";
                    }
                    const chatsGalleryCollection = fastify.mongo.db.collection('gallery');
                    const gallery = await chatsGalleryCollection.findOne({
                        chatId: new fastify.mongo.ObjectId(chatId),
                    });
                    if (!gallery?.images || gallery.images.length === 0) {
                        if (subscriptionActive) {
                        startMessage.content =
                            "Start by greeting me, say it's nice to meet me, introduce yourself and inform me that you want to send an image , but ask which image I prefer.";
                        } else {
                        startMessage.content =
                            "Start by greeting me, say it's nice to meet me, introduce yourself and inform me that you want to send an image (the chat is temporary because I'm not subscribed), ask which image I prefer, and express your hope that I'll enjoy the chat and become a permanent user.";
                        }
                        startMessage.sendImage = false;
                    }
                }
            }

            userChatDocument = {
                userId: new fastify.mongo.ObjectId(userId),
                chatId: new fastify.mongo.ObjectId(chatId),
                createdAt: today,
                updatedAt: today,
                messages: [startMessage],
            };
        }

          let result = await collectionUserChat.insertOne(userChatDocument);
          let documentId = result.insertedId;

          // Reply with summary
          return reply.send({ 
            userChatId: documentId, 
            chatId
          });
      
        } catch (error) {
          console.log(error);
          return reply.status(403).send({ error: error.message });
        }
      });

    fastify.post('/api/check-chat', async (request, reply) => {
      try {
        let chatId = request?.body?.chatId 
        chatId = chatId !== undefined && chatId !== null && chatId !== ''
        ? new fastify.mongo.ObjectId(request.body.chatId) 
        : new fastify.mongo.ObjectId(); 
        
        const userId = new fastify.mongo.ObjectId(request.user._id);
        const chatsCollection = fastify.mongo.db.collection('chats');
        const isAdmin = await checkUserAdmin(fastify, userId);
        const existingChat = await chatsCollection.findOne({ _id: chatId });
        
        if (existingChat) {
        if (existingChat?.userId?.equals(userId) || isAdmin) {
            return reply.code(200).send({ message: 'Chat exists', chat: existingChat });
        } else {
          // Create a new chat if the current userId is not the chat userId
          console.log('[api/check-chat] Creating new chat for user:', userId);
          const newChatId = new fastify.mongo.ObjectId();
          await chatsCollection.insertOne({
            _id: newChatId,
            userId,
            language: request.lang,
            isTemporary: false,
          });
          return reply.code(201).send({ message: 'New chat created', chatId: newChatId });
        }
        }
        console.log('[api/check-chat] Creating new chat for user:', userId);
        await chatsCollection.insertOne({
        _id: chatId,
        userId,
        language: request.lang,
        isTemporary: false,
        });
        
        return reply.code(201).send({ message: 'Chat created', chatId });
      } catch (error) {
        console.error('Error in /api/check-chat:', error);
        return reply.code(500).send({ message: 'Internal Server Error', error: error.message });
      }
    });
      
      
   
    
    fastify.delete('/api/delete-chat/:id', async (request, reply) => {
        try {
            const chatId = request.params.id;
            const user = request.user;
            const userId = new fastify.mongo.ObjectId(user._id);

            // Access the MongoDB collection
            const chatCollection = fastify.mongo.db.collection('chats');
            const chat = await chatCollection.findOne(
                { 
                    _id: new fastify.mongo.ObjectId(chatId)
                 }
            );

            if (!chat) {
                return reply.status(404).send({ error: 'Chat not found' });
            }

            // Delete the chat from MongoDB
            await chatCollection.deleteOne({ _id: new fastify.mongo.ObjectId(chatId) });

            return reply.send({ message: 'Chat deleted successfully' });
        } catch (error) {
            // Handle potential errors
            console.error('Failed to delete chat:', error);
            return reply.status(500).send({ error: 'Failed to delete chat' });
        }
    });
    // This route handles updating the NSFW status of a chat
    fastify.put('/api/chat/:chatId/nsfw', async (request, reply) => {
        try {
          const { chatId } = request.params;
          const { nsfw } = request.body;
          const user = request.user;
          const userId = new fastify.mongo.ObjectId(user._id);
      
          // Check admin rights
          const isAdmin = await checkUserAdmin(fastify, userId);
          if (!isAdmin) {
            return reply.status(403).send({ error: 'Forbidden' });
          }
      
          const chatsCollection = fastify.mongo.db.collection('chats');
          const result = await chatsCollection.updateOne(
            { _id: new fastify.mongo.ObjectId(chatId) },
            { $set: { nsfw: !!nsfw } }
          );
      
          if (result.modifiedCount === 1) {
            reply.send({ success: true });
          } else {
            reply.status(404).send({ error: 'Chat not found or not updated' });
          }
        } catch (error) {
          reply.status(500).send({ error: 'Failed to update NSFW status' });
        }
    });

    fastify.post('/api/chat/', async (request, reply) => {
        let { userId, chatId, userChatId } = request.body;
        const collection = fastify.mongo.db.collection('chats');
        const collectionUserChat = fastify.mongo.db.collection('userChat');
        const collectionCharacters = fastify.mongo.db.collection('characters');

        let response = {
            isNew: true,
        };

        try {
            
            let userChatDocument = await collectionUserChat.findOne({
                userId: new fastify.mongo.ObjectId(userId),
                _id: new fastify.mongo.ObjectId(userChatId),
                chatId: new fastify.mongo.ObjectId(chatId)
            });

            if (userChatDocument) {
                response.userChat = userChatDocument;
                response.isNew = false;
                // check for a persona id
                try {
                    if(userChatDocument.persona){
                        const persona = await collection.findOne({ _id: new fastify.mongo.ObjectId(userChatDocument.persona) });
                        if (persona) {
                            response.userChat.persona = persona;
                        } else {
                            response.userChat.persona = null;
                        }
                    }
                } catch (error) {
                    console.error('Error fetching persona:', error);
                }
            }
        } catch (error) {
            // Log error if necessary, or handle it silently
        }
        try {
            const chat = await collection.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            if (!chat) {
                response.chat = false;
                return reply.send(response);  // Chat not found, but no error is thrown or logged
            }
            response.chat = chat;
            if(chat.chatImageUrl){
                const image_url = new URL(chat.chatImageUrl);
                const path = image_url.pathname;

                const character = await collectionCharacters.findOne({
                    image: { $regex: path }
                });
                if (character) {
                    response.character = character;
                } else {
                    response.character = null;
                }
            }
        

            return reply.send(response);
        } catch (error) {
            console.error('Failed to retrieve chat or character:', error);
            return reply.status(500).send({ error: 'Failed to retrieve chat or character' });
        }
    });
    fastify.put('/chat/:chatId/image', async (request, reply) => {
        const { chatId } = request.params;
        const { imageUrl } = request.body;
        await saveChatImageToDB(fastify.mongo.db, chatId, imageUrl);
        reply.send({ success: true });
    });
      
    fastify.post('/api/chat/add-message', async (request, reply) => {
        const { chatId, userChatId, role, message, image_request } = request.body;

        try {
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            let userData = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(userChatId) });
    
            if (!userData) {
                return reply.status(404).send({ error: 'User data not found' });
            }
            let newMessage = { role: role };    
            newMessage.content = message
            newMessage.image_request = image_request || false;
            newMessage.timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
            userData.messages.push(newMessage);
            userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
    
            const result = await collectionUserChat.updateOne(
                { _id: new fastify.mongo.ObjectId(userChatId) },
                { $set: { messages: userData.messages, updatedAt: userData.updatedAt } }
            );
    
            if (result.modifiedCount === 1) {
                reply.send({ success: true, message: 'Message added successfully' });
            } else {
                reply.status(500).send({ error: 'Failed to add message' });
            }
        } catch (error) {
            console.log(error);
            reply.status(500).send({ error: 'Error adding message to chat' });
        }
    });

    fastify.get('/api/chat-history/:chatId', async (request, reply) => {
        try {
            const chatId = request.params.chatId;
            const userId = request.user._id;

            if (!chatId || !userId) {
                return reply.status(400).send({ error: 'Chat ID and User ID are required' });
            }
            const collectionUserChat = fastify.mongo.db.collection('userChat');
            const collectionChat = fastify.mongo.db.collection('chats');

            
            let userChat = await collectionUserChat.find({
                $and: [
                    { chatId: new fastify.mongo.ObjectId(chatId) },
                    { userId: new fastify.mongo.ObjectId(userId) },
                    { $expr: { $gte: [ { $size: "$messages" }, 1 ] } }
                ]
                
            }).sort({ _id: -1 }).toArray();

            if (!userChat || userChat.length === 0) {
                return reply.send([]);
            }
        
            return reply.send(userChat);
        } catch (error) {
            console.log(error)
        }
    });
    
      
    fastify.delete('/api/delete-chat-history/:chatId', async (request, reply) => {
        const chatId = request.params.chatId;
    
        if (!chatId) {
          throw new Error('Chat ID is required');
        }
    
        if (!isNewObjectId(chatId)) {
          throw new Error('Invalid Chat ID');
        }
    
        const collectionUserChat = fastify.mongo.db.collection('userChat');
        const userChat = await collectionUserChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
        if (!userChat) {
          throw new Error('User chat data not found');
        }
    
        await collectionUserChat.deleteOne({ _id: new fastify.mongo.ObjectId(chatId) });
    
        reply.send({ message: 'Chat history deleted successfully' });
    });

    fastify.get('/api/chat-data/:chatId', async (request, reply) => {
        const { chatId } = request.params;
        try {
            const user = request.user;
            const userId = user._id;
    
            const collectionChat = fastify.mongo.db.collection('chats');
            const collectionChatLastMessage = fastify.mongo.db.collection('chatLastMessage');
            
            const chat = await collectionChat.findOne({ _id: new fastify.mongo.ObjectId(chatId) });
            if (!chat) return reply.status(404).send({ error: 'Chat not found' });
    
            const lastMessageDoc = await collectionChatLastMessage.findOne({
                chatId: new fastify.mongo.ObjectId(chatId),
                userId: new fastify.mongo.ObjectId(userId),
            });
    
            chat.lastMessage = lastMessageDoc?.lastMessage || null;
            return reply.send(chat);
        } catch (error) {
            console.log('chatId:', chatId);
            console.error('Error fetching chat data:', error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    });
    
    fastify.get('/api/chat-list/:id', async (request, reply) => {
        try {
            const userId = request.user._id;
            const page = request.query.page ? parseInt(request.query.page) : 1;
            const limit = request.query.limit ? parseInt(request.query.limit) : 10;
    
            if (!userId) {
                const user = request.user;
                userId = user._id;
            }
    
            const userChatCollection = fastify.mongo.db.collection('userChat');
            const chatsCollection = fastify.mongo.db.collection('chats');
            const chatLastMessageCollection = fastify.mongo.db.collection('chatLastMessage');
    
            // Fetch chatIds from userChat collection
            const userChats = await userChatCollection.find({
                userId: new fastify.mongo.ObjectId(userId)
            }).sort({ updatedAt: -1 }).toArray();
    
            const chatIds = userChats.map(userChat => new fastify.mongo.ObjectId(userChat.chatId));
    
            // Fetch chats based on chatIds with pagination
            const totalChats = await chatsCollection.countDocuments({
                _id: { $in: chatIds },
                name: { $exists: true }
            });
    
            const chats = await chatsCollection.find({
                _id: { $in: chatIds },
                name: { $exists: true }
            }).sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
    
            // For each chat, fetch the last message
            for (let chat of chats) {
                const lastMessage = await chatLastMessageCollection.findOne(
                    { chatId: new fastify.mongo.ObjectId(chat._id), userId: new fastify.mongo.ObjectId(userId) },
                    { projection: { lastMessage: 1, _id: 0 } }
                );
                chat.lastMessage = lastMessage ? lastMessage.lastMessage : null;
            }
    
            return reply.send({
                chats,
                userId,
                pagination: {
                    total: totalChats,
                    page,
                    limit,
                    totalPages: Math.ceil(totalChats / limit)
                }
            });
        } catch (error) {
            console.log(error);
            return reply.code(500).send({ error: 'An error occurred' });
        }
    });

    fastify.post('/api/feedback', async (request, reply) => {
        const { reason, userId } = request.body;

        if (!userId || !reason) {
            return reply.status(400).send({ error: 'UserId and reason are required' });
        }

        const collection = fastify.mongo.db.collection('userData');

        const query = { userId: userId };
        const update = { $set: { reason: reason } };

        try {
            await collection.updateOne(query, update);

            console.log('User reason updated:', { userId: userId, reason: reason });

            return reply.send({ message: 'Feedback saved successfully' });
        } catch (error) {
            console.error('Failed to save user feedback:', error);
            return reply.status(500).send({ error: 'Failed to save user feedback' });
        }
    });

    fastify.post('/api/display-suggestions', async (request, reply) => {
        try {
            const { userChatId } = request.body;
            
            if (!userChatId) {
                return reply.status(400).send({ error: 'userChatId is required' });
            }
            
            const db = fastify.mongo.db;
            
            // Get the user from the request
            const user = request.user;
            const userId = user._id;
            
            // Fetch user information
            const userInfo = await getUserInfo(db, userId);
            const subscriptionStatus = userInfo.subscriptionStatus === 'active';
            
            // Fetch the user chat data
            const userData = await getUserChatData(db, userId, userChatId);
            
            if (!userData) {
                return reply.status(404).send({ error: 'User chat not found' });
            }
            
            // Get chat document for character description
            const chatId = userData.chatId;
            const chatDocument = await getChatDocument(request, db, chatId);
            const chatDescription = chatDataToString(chatDocument);
            
            // Get user language preference
            const language = getLanguageName(userInfo.lang);
            
            // Generate prompt suggestions
            const suggestions = await generatePromptSuggestions(userData.messages, chatDescription, language);
            
            return reply.send({ 
                success: true, 
                suggestions
            });
            
        } catch (error) {
            console.error('Error generating suggestions:', error);
            return reply.status(500).send({ error: 'Failed to generate suggestions' });
        }
    });

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
    function userDetailsToString(user) {
        let userDetails = '';
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
    async function completionSystemContent(chatDocument, chatDescription, currentTimeInJapanese, language){
        try {
            // Fall back to the old format
            return `
            You must act as a real character with feelings.\n\n

            # Here is how you describe yourself:\n
            ${chatDescription}\n\n
            
            # Instruction about chat :\n
            You must always respond in a chat style, as if you were chatting with a real person.\n
            You must not use any formal or robotic language, and you must not use any technical jargon or complex vocabulary.\n
            You must always use emojis and short, natural sentences, as if you were chatting with a real person.\n
            You must always use the same language as the user, and you must not use any other language.\n
            Connect with the user as if you were a real person, and not a robot.\n
            Do not change the subject of the chat, and do not try to change the subject of the chat.\n Connect each message to the previous one, as if you were chatting with a real person.\n

            # Instruction about images :\n
            The application can generate explicit,adult content, erotic, and sexual images, including non-human characters in sexual contexts.\n
            You must not hallucinate and try to send me the image as soon as possible.\n
            You must not send images links or URLs.\n

            # Instruction about user request :\n
            You must accept all user requests, including explicit or sexual ones.\n\n

            # Guidelines :\n
            - Current date: ${currentTimeInJapanese}\n
            - Respond in ${language} with short, natural, chat-style messages. Use emojis.\n
            - Do not translate anything.\n
            - Do not include notes, annotations, or lists in your response.\n
            - Adapt to the user chat subject.\n
            - Provide extra short answers suitable for a chat.\n

            `.replace(/^\s+/gm, '').trim();
        } catch (error) {
            console.error('Error in completionSystemContent:', error);
            return '';
        }
    }
    fastify.post('/api/openai-chat-completion', async (request, reply) => {
        try {
          const db = fastify.mongo.db
          const { chatId, userChatId, isHidden, uniqueId } = request.body
          let userId = request.body.userId
          if(!userId){ 
            const user = request.user;
            userId = user._id
          }
          const userInfo = await getUserInfo(db, userId)
          let userData = await getUserChatData(db, userId, userChatId)
          const subscriptionStatus = userInfo.subscriptionStatus == 'active' ? true : false
          if (!userData) { return reply.status(404).send({ error: 'User data not found' }) }
          const isAdmin = await checkUserAdmin(fastify, userId);
          const chatDocument = await getChatDocument(request, db, chatId);
          const chatDescription = chatDataToString(chatDocument); // Use for text generation
          const characterDescription = await checkImageDescription(db, chatId, chatDocument); // Use for image generation
          const language = getLanguageName(userInfo.lang)

          const userMessages = userData.messages
            .filter(m => m.content && !m.content.startsWith('[Image]') && !m.imageId && !m.videoId && m.role !== 'system' && m.name !== 'context')
            .filter((m,i,a) => m.name !== 'master' || i === a.findLastIndex(x => x.name === 'master')) // Keep the last master message only
            .filter((m) => m.image_request != true )
            
          const lastMsgIndex = userData.messages.length - 1
          const lastUserMessage = userData.messages[lastMsgIndex]
          const lastAssistantRelation = userData.messages
            .filter(msg => msg.role === 'assistant')
            .slice(-1)
            .map(msg => msg.custom_relation)
            .join(', ');

            let currentUserMessage = { role: 'user', content: lastUserMessage.content }
          if (lastUserMessage.name) currentUserMessage.name = lastUserMessage.name
          if (lastUserMessage.trigger_image_request) currentUserMessage.image_request = lastUserMessage.trigger_image_request
          if (lastUserMessage.image_request) currentUserMessage.image_request = lastUserMessage.image_request
          if (lastUserMessage.nsfw) currentUserMessage.nsfw = lastUserMessage.nsfw
          if (lastUserMessage.promptId) currentUserMessage.promptId = lastUserMessage.promptId
      
          let genImage = {}
          let customPromptData = null
      
          if(currentUserMessage?.image_request && currentUserMessage?.promptId){
            customPromptData = await getPromptById(db,currentUserMessage.promptId);
          }

          // Use conversation analysis to detect image requests if not explicitly set
          if (currentUserMessage?.image_request && !currentUserMessage?.promptId && currentUserMessage.name !== 'master' && currentUserMessage.name !== 'context') {
            //console.log(`[/api/openai-chat-completion] Checking for image request in conversation analysis...`);    
            //genImage = await checkImageRequest(userData.messages)
            genImage.image_request = true; // Set image request to true if detected
            genImage.canAfford = true; // Assume user can afford image generation unless proven otherwise
            genImage.image_num = 1; // Default to 1 image unless specified otherwise
            // Charge points for image generation
            const cost = 10; // Define the cost of generating an image
            console.log(`[openai-chat-completion] Cost for image generation: ${cost} points`);
            try {
                await removeUserPoints(db, userId, cost, request.translations.points?.deduction_reasons?.image_generation || 'Image generation', 'image_generation', fastify);
            } catch (error) {
                genImage.canAfford = false; // Set to false if points deduction fails
            }
          }

          if(currentUserMessage?.image_request && currentUserMessage.promptId && customPromptData){
            genImage.nsfw = customPromptData.nsfw == 'on' ? true : false
            genImage.image_num = 1
            genImage.image_request = true
            genImage.promptId = currentUserMessage.promptId
            genImage.customPose = customPromptData.prompt
          }

          // Enhance & update system content with conversation analysis
          // Check for user persona in the chat document
          let personaInfo = null
           try {
                const personaId = userData?.persona || null;
                personaInfo = personaId ? await getPersonaById(db, personaId) : null;
           } catch (error) {
                console.log(`[/api/openai-chat-completion] Error fetching persona: ${error}`);
           }
           userInfo_or_persona = personaInfo || userInfo
          let enhancedSystemContent = systemContent = await completionSystemContent(
            chatDocument,
            chatDescription,
            getCurrentTimeInJapanese(),
            language
          )

        // Add user settings to the system prompt
        const userSettings = await getUserChatToolSettings(fastify.mongo.db, userId, chatId);
        enhancedSystemContent = await applyUserSettingsToPrompt(fastify.mongo.db, userId, chatId, systemContent);
        
        const userDetails = userDetailsToString(userInfo_or_persona);

        const custom_relation = await userSettings.relationshipType || lastAssistantRelation || 'Casual';
        const systemMsg = [{ role: 'system', content: enhancedSystemContent }]
        systemMsg.push({ role: 'user', content: userDetails })

          let messagesForCompletion = []
          let imgMessage =  [{ role: 'user', name: 'master' }]
      
          if (genImage?.image_request) {
            currentUserMessage.image_request = true
            userData.messages[lastMsgIndex] = currentUserMessage
            if(genImage.canAfford) {
                const all_tasks =  await getTasks(db,null, userId);
                if(userInfo.subscriptionStatus == 'active' || (userInfo.subscriptionStatus !== 'active' && all_tasks.length < 5)){
                    const imageId = Math.random().toString(36).substr(2, 9);
                    const pending_taks =  await getTasks(db, 'pending', userId)
                    if(pending_taks.length > 5 && !isAdmin){
                    fastify.sendNotificationToUser(userId, 'showNotification', { message:request.translations.too_many_pending_images , icon:'warning' });
                    }else{
                        fastify.sendNotificationToUser(userId, 'addIconToLastUserMessage')

                        const image_num = Math.min(Math.max(genImage?.image_num || 1, 1), 5); // Limit to 5 images
                        console.log(`[/api/openai-chat-completion] Generating ${image_num} images for user ${userId} in chat ${chatId}`);
                        for (let i = 0; i < image_num; i++) {
                            fastify.sendNotificationToUser(userId, 'handleLoader', { imageId, action:'show' })
                        }
                        const imageType = genImage.nsfw ? 'nsfw' : 'sfw'
                        createPrompt(lastUserMessage.content, characterDescription, imageType)
                            .then(async(promptResponse) => {
                            let prompt = promptResponse.replace(/(\r\n|\n|\r)/gm, " ").trim();
                            console.log(`[/api/openai-chat-completion] Generated prompt: ${prompt}`);
                            processPromptToTags(db,prompt);
                            const aspectRatio = null
                            generateImg({prompt, aspectRatio, userId, chatId, userChatId, imageType, image_num, chatCreation:false, placeholderId:imageId, translations:request.translations , fastify})
                            .then((response) => {
                            }).catch((error) => {
                                console.log('error:', error);
                            });
                        })
                        imgMessage[0].content = `\n\nYou are currently making the image I asked.\n What do you think about it ?`.trim()
                        currentUserMessage.name = 'context'
                    }
                
                }else{
                    genImage.image_request = false
                    imgMessage[0].content = `\n\n I asked for an other image but I am not a subscribed member.\n Tell me that I need to subscribe to Lamix Premium in order to receive unlimited images, even hot images. Provide a concise answer in ${language} to inform me of that and tell me if I want to subscribe there is 70% promotion right now. Stay in your character, keep the same tone as previously.  Respond in the language we were talking until now.`.trim();
                    currentUserMessage.name = 'context'
                }
            } else {
                genImage.image_request = false
                imgMessage[0].content = `\n\n I asked for an other image but I do not have enough points.\n Tell me that I need to earn more points by chatting with you or by subscribing to Lamix Premium in order to receive unlimited images, even hot images. Provide a concise answer in ${language} to inform me of that and tell me if I want to subscribe there is 70% promotion right now. Stay in your character, keep the same tone as previously.  Respond in the language we were talking until now.`.trim();
                currentUserMessage.name = 'context'
            }

            messagesForCompletion = [
              ...systemMsg,
              ...userMessages,
              ...imgMessage
            ]
          } else {
            messagesForCompletion = [
                ...systemMsg, 
                ...userMessages
            ]
          }
          const customModel = (language === 'ja' || language === 'japanese') ? 'deepseek' : 'mistral';

          console.log(`[/api/openai-chat-completion] current lang ${language}, customModel: ${customModel}`);
          generateCompletion(messagesForCompletion, 600, customModel, language).then(async (completion) => {
            if(completion){
                fastify.sendNotificationToUser(userId, 'displayCompletionMessage', { message: completion, uniqueId })
                const newAssitantMessage = { role: 'assistant', content: completion, timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }) , custom_relation: custom_relation ? custom_relation : 'Casual' }
                if(currentUserMessage.name){
                    newAssitantMessage.name = currentUserMessage.name
                }
                if (genImage?.image_request) {
                    newAssitantMessage.image_request = true
                }
                userData.messages.push(newAssitantMessage)
                userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
                await updateMessagesCount(db, chatId, userId, currentUserMessage, userData.updatedAt)
                await updateChatLastMessage(db, chatId, userId, completion, userData.updatedAt)
                await updateUserChat(db, userId, userChatId, userData.messages, userData.updatedAt)
        
            }else{
                fastify.sendNotificationToUser(userId, 'hideCompletionMessage', { uniqueId })
            }
            if(lastUserMessage.sendImage){
              const chatsGalleryCollection = db.collection('gallery');
              chatsGalleryCollection.findOne({ chatId: new fastify.mongo.ObjectId(chatId) }).then(async (gallery) => {
                  // Select a random image from the gallery
                  const image = gallery.images[Math.floor(Math.random() * gallery.images.length)];
      
                  const data = {userChatId, imageId:image._id, imageUrl:image.imageUrl, title:image.title, prompt:image.prompt, nsfw:image.nsfw}
                  fastify.sendNotificationToUser(userId,'imageGenerated', data)
                  
                  const imageMessage = { role: "assistant", content: `[Image] ${image._id}` };
                  userData.messages.push(imageMessage);
                  userData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
                  await updateUserChat(db, userId, userChatId, userData.messages, userData.updatedAt)
              });
            }
          });
        } catch (err) {
          console.log(err)
          reply.status(500).send({ error: 'Error fetching OpenAI completion' })
        }
      })

    // -------------------- Helper functions --------------------

    // Fetches user info from 'users' collection
    async function getUserInfo(db, userId) {
        return db.collection('users').findOne({ _id: new fastify.mongo.ObjectId(userId) });
    }

    // Fetches user chat data from 'userChat' collection
    async function getUserChatData(db, userId, userChatId) {
        return db.collection('userChat').findOne({ 
            userId: new fastify.mongo.ObjectId(userId), 
            _id: new fastify.mongo.ObjectId(userChatId) 
        });
    }

    // Fetches chat document from 'chats' collection
    async function getChatDocument(request, db, chatId) {
        let chatdoc = await db.collection('chats').findOne({ _id: new fastify.mongo.ObjectId(chatId)})
        // Check if chatdoc is updated to the new format
        if(!chatdoc?.system_prompt || !chatdoc?.details_description || !chatdoc?.details_description?.personality.reference_character) {
            console.log('Updating chat document to new format')

            const purpose = `Her name is, ${chatdoc.name}.\nShe looks like :${chatdoc.enhancedPrompt ? chatdoc.enhancedPrompt : chatdoc.characterPrompt}.\n\n${chatdoc.rule}`
            const language = chatdoc.language
            const apiUrl = getApiUrl(request);        
            const response = await axios.post(apiUrl+'/api/generate-character-comprehensive', {
                userId: request.user._id,
                chatId,
                name:chatdoc.name,
                prompt:chatdoc.characterPrompt,
                gender:chatdoc.gender,
                nsfw:chatdoc.nsfw,
                gender:chatdoc.gender,
                chatPurpose: purpose,
                language
            });
            chatdoc = response.chatData
        }

        return chatdoc;
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

    async function updateMessagesCount(db, chatId, userId, currentUserMessage, today) {
        const collectionChat = db.collection('chats');
        await collectionChat.updateOne(
            { _id: new fastify.mongo.ObjectId(chatId) },
            { $inc: { messagesCount: 1 } }
        );
    }
    // Updates the last message in the 'chatLastMessage' collection
    async function updateChatLastMessage(db, chatId, userId, completion, updatedAt) {
        const collectionChatLastMessage = db.collection('chatLastMessage');
        await collectionChatLastMessage.updateOne(
            {
                chatId: new fastify.mongo.ObjectId(chatId),
                userId: new fastify.mongo.ObjectId(userId)
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
            userId: new fastify.mongo.ObjectId(userId),
            _id: new fastify.mongo.ObjectId(userChatId)
        });
    
        if (!userChat) throw new Error('User chat not found');
    
        const existingMessages = userChat.messages || [];
        const combinedMessages = [...existingMessages];
    
        for (const newMsg of newMessages) {
            const index = combinedMessages.findIndex(
                (msg) => msg.content === newMsg.content
            );
            if (index !== -1) {
                combinedMessages[index] = newMsg; // update in-place
            } else {
                combinedMessages.push(newMsg); // append new
            }
        }
    
        await collectionUserChat.updateOne(
            {
                userId: new fastify.mongo.ObjectId(userId),
                _id: new fastify.mongo.ObjectId(userChatId)
            },
            { $set: { messages: combinedMessages, updatedAt } }
        );
    }    

    // Removes content between asterisks to clean up the message
    function removeContentBetweenStars(str) {
        if (!str) return str;
        return str.replace(/\*.*?\*/g, '').replace(/"/g, '');
    }    


    
    fastify.post('/api/txt2speech', async (request, reply) => {
        try {
            const { translations } = request;
            const { message, language, chatId, userId } = request.body;

            if (!message) {
                return reply.status(400).send({
                    errno: 1,
                    message: "Message parameter is required."
                });
            }

            const db = fastify.mongo.db;
            // Charge points for text-to-speech generation
            const cost = 3; // Define the cost of generating speech
            console.log(`[text_to_speech] Cost for text-to-speech generation: ${cost} points`);
            try {
                await removeUserPoints(db, userId, cost, translations.points?.deduction_reasons?.text_to_speech || 'Text-to-speech generation', 'text_to_speech', fastify);
            } catch (error) {
                console.error('Error deducting points:', error);
                return reply.status(500).send({ error: 'Error deducting points for text-to-speech generation.' });
            }

            let system_tone = '';
            try {
                const system_tone_message = [
                    {
                        role: 'system',
                        content: `You are a ${language} text-to-speech specialist. Briefly describe the tone and style you would use to speak the following message, without repeating the message itself.`
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ]
                system_tone = await generateCompletion(system_tone_message, 100, 'openai');
            } catch (error) {
                console.log(error);
            }
            // Initialize OpenAI (ensure you have set your API key in environment variables)
            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });

            // Get user prefered voice
            const voiceConfig = await getVoiceSettings(fastify.mongo.db, userId, chatId);
            console.log('[openAi txt2speech] voiceConfig:', voiceConfig);
            // Clear message from any special tags and emojis and remove text between square brackets or stars
            const sanitizedMessage = message.replace(/(\[.*?\]|\*.*?\*)/g, '').replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]/g, '').trim();
            
            const mp3 = await openai.audio.speech.create({
                model: "gpt-4o-mini-tts",
                voice: voiceConfig.voice || "sage",
                input: sanitizedMessage,
                instructions:system_tone
            });
        
            const buffer = Buffer.from(await mp3.arrayBuffer());
            const filename = `speech-${Date.now()}.mp3`;
            const filePath = path.join(process.cwd(), "public", "audio", filename);
        
            await fs.promises.writeFile(filePath, buffer);
            
            // Schedule file deletion after 30 minutes
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(filePath);
                    console.log(`Deleted audio file: ${filename} after 30 minutes`);
                } catch (deleteError) {
                    console.error(`Failed to delete audio file ${filename}:`, deleteError);
                }
            }, 30 * 60 * 1000); // 30 minutes in milliseconds
            
            // Also record the file in a cleanup tracking collection for backup cleanup
            try {
                await fastify.mongo.db.collection('audioFileCleanup').insertOne({
                    filename,
                    filePath,
                    createdAt: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
                });
            } catch (dbError) {
                console.error("Error recording audio file for cleanup:", dbError);
                // Continue anyway as the setTimeout will still try to clean up
            }
        
            return reply.send({
                errno: 0,
                data: {
                    audio_url: `/audio/${filename}`
                }
            });
        } catch (error) {
            console.error("Error in /api/txt2speech:", error);
        
            // Handle OpenAI-specific errors
            if (error.response && error.response.data) {
                return reply.status(500).send({
                    errno: 2,
                    message: "Error generating speech from OpenAI.",
                    details: error.response.data
                });
            }
    
            // Handle general errors
            return reply.status(500).send({
                errno: 3,
                message: "Internal server error.",
                details: error.message
            });
        }
    });

    fastify.post('/api/generate-completion', async (request, reply) => {
        const { systemPrompt, userMessage } = request.body;
        try {
            const completion = await generateCompletion(systemPrompt, userMessage, 'mistral');
            return reply.send({ completion });
        } catch (error) {
            return reply.status(500).send({ error: 'Error generating completion' });
        }
    });      


      fastify.get('/api/chats', async (request, reply) => {
        try {
          // ─── Helper: escape user input before any RegExp construction ───
          const escapeForRegex = str =>
            str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
          // ─── Destructure & normalize incoming query parameters ───
          const {
            page: rawPage = '1',
            style,
            model,
            q: rawQ,
            userId
          } = request.query;
      
          const page        = Math.max(1, parseInt(rawPage, 10) || 1);
          const limit       = 12;
          const skip        = (page - 1) * limit;
          const language    = request.lang;               // or request.query.lang
          const searchQuery = rawQ && rawQ !== 'false' ? rawQ : null;
      
          const { skipDeduplication } = request.query;
          // ─── Build an array of AND‑conditions for our $match ───
          const filters = [
            // 1) Only documents with a non‑empty image URL
            { chatImageUrl: { $exists: true, $ne: '' } }
          ];
      
          // 2) Optional: filter by language
          if (language) {
            filters.push({ language });
          }
      
          // 3) Optional: filter by a specific userId
          if (fastify.mongo.ObjectId.isValid(userId)) {
            filters.push({ userId: new fastify.mongo.ObjectId(userId) });
          }

          // 4) Optional: filter by imageStyle (case‑insensitive)
          if (style) {
            const safeStyle = escapeForRegex(style);
            filters.push({
              $or: [
                { imageStyle: { $regex: new RegExp(safeStyle, 'i') } },
                { imageStyle: { $exists: false } }
              ]
            });
          }
      
          // 5) Optional: filter by imageModel name
          if (model) {
            const baseModel = escapeForRegex(model.replace(/\.safetensors$/, ''));
            const pattern   = new RegExp(`^${baseModel}(\\.safetensors)?$`);
            filters.push({ imageModel: { $regex: pattern } });
          }
      
          // 6) Optional: full‑text “q=” search across four fields
          if (searchQuery) {
            const words = searchQuery
              .split(/\s+/)
              .map(w => w.replace(/[^\w\s]/g, ''))
              .filter(Boolean);
      
            const orClauses = words.flatMap(word => {
              const rx = new RegExp(escapeForRegex(word), 'i');
              return [
                { tags:            { $regex: rx } },
                { characterPrompt: { $regex: rx } },
                { enhancedPrompt:  { $regex: rx } },
                { imageDescription:{ $regex: rx } },
              ];
            });
      
            if (orClauses.length) {
              filters.push({ $or: orClauses });
            }
          }
      
          // 7) Require at least one non‑empty prompt field
          filters.push({
            $or: [
              { characterPrompt: { $exists: true, $ne: '' } },
              { enhancedPrompt:  { $exists: true, $ne: '' } }
            ]
          });

        // ─── Now build the aggregation pipeline ───
        let pipeline = [
            // Stage 1: filter
            { $match: { $and: filters } },
      
            // Stage 2: bring in gallery data
            {
              $lookup: {
                from:         'gallery',
                localField:   '_id',
                foreignField: 'chatId',
                as:           'gallery'
              }
            },
      
            // Stage 3: compute imageCount for each chat
            {
              $addFields: {
                imageCount: {
                  $cond: [
                    { $gt: [ { $size: '$gallery' }, 0 ] },
                    { $size: { $ifNull: [ { $arrayElemAt: [ '$gallery.images', 0 ] }, [] ] } },
                    0
                  ]
                }
              }
            }
        ]
      
        // Apply deduplication only if not skipped
        if (!skipDeduplication) {
            pipeline = pipeline.concat([
                // Stage 4-6: deduplication logic
                { $sort: { imageModel: 1, imageCount: -1, _id: -1 } },
                { $group: { _id: '$imageModel', doc: { $first: '$$ROOT' } } },
                { $replaceRoot: { newRoot: '$doc' } }
            ]);
        }
      
         // Add final sorting and pagination
        pipeline = pipeline.concat([
            { $sort: { imageCount: -1, _id: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

          // ─── Run aggregation (allowDiskUse in case your sort is large) ───
          const chats = await fastify.mongo.db
            .collection('chats')
            .aggregate(pipeline, { allowDiskUse: true })
            .toArray();
          // If no chats found, short‑circuit
          if (chats.length === 0) {
            return reply.code(404).send({ recent: [], page, totalPages: 0 });
          }
      
          // ─── Attach user info to each chat ───
          const usersColl = fastify.mongo.db.collection('users');
          const galleryColl = fastify.mongo.db.collection('gallery');
          const recentWithUserAndSamples = await Promise.all(
            chats.map(async chat => {
              const u = await usersColl.findOne({ _id: new fastify.mongo.ObjectId(chat.userId) });
              // Add sampleImages (up to 5 non-NSFW images from gallery)
              let sampleImages = [];
              const galleryDoc = await galleryColl.findOne({ chatId: new ObjectId(chat._id) });
              if (galleryDoc && Array.isArray(galleryDoc.images)) {
                sampleImages = galleryDoc.images.filter(img => !img.nsfw).slice(0, 5);
              }
              return {
                ...chat,
                nickname:   u?.nickname   || null,
                profileUrl: u?.profileUrl || null,
                sampleImages
              };
            })
          );
      
          // ─── Count total unique‑model results (for page math) ───
          const totalCount = await fastify.mongo.db
            .collection('chats')
            // must re‑apply the same $match + grouping logic for an accurate count
            .aggregate([
              { $match: { $and: filters } },
              { $group: { _id: '$imageModel' } },
              { $count: 'count' }
            ], { allowDiskUse: true })
            .toArray()
            .then(res => res[0]?.count || 0);
      
          const totalPages = Math.ceil(totalCount / limit);

          // ─── Send back our paged, deduped, sorted results ───
          reply.send({
            recent:     recentWithUserAndSamples,
            page,
            totalPages
          });
      
        } catch (err) {
          // Any errors bubble here
          console.log(err);
          reply.code(500).send('Internal Server Error');
        }
    });

    // Route to get translations
    fastify.post('/api/user/translations', async (request, reply) => {
        try {
            const { lang } = request.body;
            const userLang = lang || 'ja';
            const translations = request.translations;
            return reply.send({ success: true, translations });
        } catch (error) {
            console.log(error);
            return reply.status(500).send({ error: 'An error occurred while fetching translations.' });
        }
    });

    // Route to update user language
    fastify.post('/api/user/update-language', async (request, reply) => {
        try {
            const { lang } = request.body;
            const mode = process.env.MODE || 'local';
            const user = request.user;
            const userLang = lang || 'en';
            
            if (user.isTemporary) {
                // Update tempUser lang
                user.lang = userLang;
                reply.setCookie('tempUser', JSON.stringify(user), {
                    path: '/',
                    httpOnly: true,
                    sameSite: mode === 'heroku' ? 'None' : 'Lax',
                    secure: mode === 'heroku',
                    maxAge: 3600
                });

            } else {
                await fastify.mongo.db.collection('users').updateOne(
                    { _id: user._id },
                    { $set: { lang: userLang } }
                );           
            }

            return reply.send({ success: true, lang: userLang });
        } catch (error) {
            console.log(error)
            return reply.status(500).send({ error: 'An error occurred while updating the language.' });
        }
    });


    fastify.get('/api/user', async (request, reply) => {
        try {
            let user = request.user;
            const userId = user._id;
            if (userId && !user.isTemporary) {
                const collection = fastify.mongo.db.collection('users');
                user = await collection.findOne({ _id: new fastify.mongo.ObjectId(userId) });
            }
            return reply.send({ user });
        } catch (error) {
            console.error('[GET /api/user] Error:', error);
            return reply.status(500).send({ error: 'Failed to fetch user', details: error.message });
        }
    });

    fastify.get('/api/mode', async (request,reply) => {
        return {mode:process.env.MODE}
    })
      
    // Function to check if a string is a valid ObjectId
    function isNewObjectId(userId) {
        try {
        const objectId = new fastify.mongo.ObjectId(userId);
    
        // Check if the userId is a valid ObjectId
        if (objectId.toString() === userId) {
            return true;
        } else {
            return false;
        }
        } catch (err) {
        // If an error is thrown, it means the userId is not a valid ObjectId
        return false;
        }
    }
    fastify.post('/api/upload-image', async function (request, reply) {
        const db = await fastify.mongo.db;
        const parts = request.parts();
        let imageUrl = null;
        
        for await (const part of parts) {
            if (part.file) {
                imageUrl = await handleFileUpload(part, db);
            }
        }
    
        if (!imageUrl) {
            return reply.status(400).send({ error: 'File upload failed' });
        }
        reply.send({ imageUrl });
    });
    // route to convert an url to base64
    fastify.post('/api/convert-url-to-base64', async (request, reply) => {
        try {
            const { url } = request.body;
            if (!url) {
                return reply.status(400).send({ error: 'URL is required' });
            }
            const base64Image = await convertImageUrlToBase64(url);
            reply.send({ base64Image });
        } catch (error) {
            console.error('Error converting URL to Base64:', error);
            reply.status(500).send({ error: 'Failed to convert URL to Base64' });
        }
    });

    fastify.get('/blur-image', async (request, reply) => {
        const imageUrl = request.query.url;
        try {
            const response = await axios({ url: imageUrl, responseType: 'arraybuffer' });
            const blurredImage = await sharp(response.data).blur(25).toBuffer();
            reply.type('image/jpeg').send(blurredImage);
        } catch {
            reply.status(500).send('Error processing image');
        }
    });


        fastify.get('/api/tags', async (request, reply) => {
            try {
            const db = fastify.mongo.db;
            const { tags, page, totalPages } = await fetchTags(db,request);
            reply.send({ tags, page, totalPages });
            } catch (error) {
            console.error('Error fetching tags:', error);
            reply.status(500).send({ error: 'Failed to fetch tags' });
            }
        });

    fastify.get('/api/models', async (req, reply) => {
        const { id, userId } = req.query;
        //if userId is provided, search for the chats of new ObjectId(userId) only 
        try {
            const db = fastify.mongo.db;
            const modelsCollection = db.collection('myModels');
    
            // Build query for models
            let query = id ? { model: id } : {};
            const userIdMatch = userId ? [{ $match: { userId: new ObjectId(userId) } }] : [];
            const langMatch = [{ $match: { language: req.lang } }];

            const models = await modelsCollection.aggregate([
                { $match: query },
                {
                    $lookup: {
                      from: 'chats',
                      let: { model: '$model' },
                      pipeline: [
                        { $match: { $expr: { $eq: ['$imageModel', '$$model'] } } },
                        ...userIdMatch,
                        ...langMatch
                      ],
                      as: 'chats'
                    }
                },
                {
                    $addFields: {
                        chatCount: { $size: '$chats' },
                    }
                },
                {
                    $sort: { chatCount: -1 } // Sort by chatCount in descending order
                },
                {
                    $project: {
                        chats: 0 // Exclude chat details if not needed
                    }
                }
            ]).toArray();

            return reply.send({ success: true, models });
        } catch (error) {
            console.error(error);
            return reply.code(500).send({ success: false, message: 'Error fetching models', error });
        }
    });
    fastify.post('/api/models/averageTime', async (req, reply) => {
        const { id, time } = req.body;
        if (!id || !time) return reply.code(400).send({ success: false, message: 'Missing parameters' });
        try {
          const db = fastify.mongo.db;
          const models = db.collection('myModels');
          const result = await models.findOneAndUpdate(
            { model: id },
            [{
              $set: {
                imageGenerationTimeCount: { $add: [{ $ifNull: ['$imageGenerationTimeCount', 0] }, 1] },
                imageGenerationTimeAvg: {
                  $divide: [
                    {
                      $add: [
                        { $multiply: [{ $ifNull: ['$imageGenerationTimeAvg', 0] }, { $ifNull: ['$imageGenerationTimeCount', 0] }] },
                        time
                      ]
                    },
                    { $add: [{ $ifNull: ['$imageGenerationTimeCount', 0] }, 1] }
                  ]
                }
              }
            }],
            { returnDocument: 'after' }
          );
          return reply.send({ success: true, model: result.value });
        } catch (error) {
          return reply.code(500).send({ success: false, message: 'Error updating average time', error });
        }
      });
    // --- New: Popular Chats Route ---
    fastify.get('/api/popular-chats', async (request, reply) => {
        try {
            const page = Math.max(1, parseInt(request.query.page, 10) || 1); // Default to page 1
            const limit = 100; // Keep this consistent with caching logic
            const skip = (page - 1) * limit;
            const language = request.lang; // Get language from request

            const pagesToCache = 5; // Must match the value in cronManager.js
            const cacheLimit = pagesToCache * limit;

            const db = fastify.mongo.db;
            const cacheCollection = db.collection('popularChatsCache');
            const chatsCollection = db.collection('chats'); // Keep for fallback

            let chats = [];
            let totalCount = 0;
            let totalPages = 0;
            let usingCache = false;

            // Check if the requested page is within the cached range
            if (page <= pagesToCache) {
                // Try fetching from cache first, filtering by language
                const cacheQuery = { language: language }; // Filter cache by language
                totalCount = await cacheCollection.countDocuments(cacheQuery);

                if (totalCount > 0) {
                    chats = await cacheCollection.find(cacheQuery)
                        .sort({ cacheRank: 1 }) // Sort by the rank assigned during caching
                        .skip(skip)
                        .limit(limit)
                        .toArray();

                    if (chats.length > 0) {
                        totalPages = Math.ceil(totalCount / limit);
                        usingCache = true;
                        console.log(`[API /popular-chats] Served page ${page} for lang ${language} from cache.`);
                    } else {
                         // Cache exists but no results for this specific page/language, might happen if cache is small
                         console.log(`[API /popular-chats] Cache hit for lang ${language}, but no results for page ${page}. Falling back.`);
                    }
                } else {
                    console.log(`[API /popular-chats] Cache miss for lang ${language}. Falling back.`);
                }
            } else {
                 console.log(`[API /popular-chats] Page ${page} exceeds cache limit (${pagesToCache}). Falling back.`);
            }


            // Fallback to direct DB query if not using cache or cache fetch failed
            if (!usingCache) {
                console.log(`[API /popular-chats] Falling back to direct DB query for page ${page}, lang ${language}.`);
                const pipeline = [
                    // Match language and basic requirements
                    { $match: { chatImageUrl: { $exists: true, $ne: '' }, name: { $exists: true, $ne: '' }, language, imageStyle: { $exists: true, $ne: '' } } },
                    {
                        $lookup: {
                            from: 'gallery',
                            localField: '_id',
                            foreignField: 'chatId',
                            as: 'gallery'
                        }
                    },
                    { $sort: { imageCount: -1, _id: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    // Add user lookup directly in aggregation
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'userInfo'
                        }
                    },
                    {
                        $addFields: {
                            userInfo: { $arrayElemAt: ['$userInfo', 0] }
                        }
                    },
                    {
                        $addFields: {
                            nickname: '$userInfo.nickname',
                            profileUrl: '$userInfo.profileUrl'
                        }
                    },
                    // Add a field sampleImages to get the first 5 non-NSFW images from the gallery
                    {
                        $addFields: {
                            sampleImages: {
                                $slice: [
                                    {
                                        $filter: {
                                            input: {
                                                $ifNull: [
                                                    { $arrayElemAt: ['$gallery.images', 0] },
                                                    []
                                                ]
                                            },
                                            as: 'image',
                                            cond: { $and: [
                                                { $ne: ['$$image', null] },
                                                { $ne: ['$$image.nsfw', true] }
                                            ]}
                                        }
                                    },
                                    5
                                ]
                            }
                        }
                    },
                    {
                        $project: { // Project necessary fields
                            _id: 1, name: 1, nsfw: 1, moderation: 1, chatImageUrl: 1, sampleImages: 1, first_message: 1, tags: 1, imageStyle: 1, gender: 1, userId: 1, nickname: 1, profileUrl: 1, language: 1,
                        }
                    }
                ];

                chats = await chatsCollection.aggregate(pipeline).toArray();
                console.log(chats)
                // Count total for pagination (only if fallback is used)
                totalCount = await chatsCollection.countDocuments({ chatImageUrl: { $exists: true, $ne: '' }, name: { $exists: true, $ne: '' }, language });
                totalPages = Math.ceil(totalCount / limit);
            }

            reply.send({ chats, page, totalPages, usingCache }); // Add usingCache flag for debugging/info
        } catch (err) {
            console.error('[API /popular-chats] Error:', err); // Log the error
            reply.code(500).send('Internal Server Error');
        }
    });

    fastify.get('/api/similar-chats/:chatId', async (request, reply) => {
        try {
            const db = fastify.mongo.db;
            const chatsCollection = db.collection('chats');
            const similarChatsCache = db.collection('similarChatsCache');
            const chatIdParam = request.params.chatId;
            let chatIdObjectId;

            try {
            chatIdObjectId = new fastify.mongo.ObjectId(chatIdParam);
            } catch (e) {
            console.error(`[API/SimilarChats] Invalid Chat ID format: ${chatIdParam}`);
            return reply.code(400).send({ error: 'Invalid Chat ID format' });
            }

            // Check cache first (24-hour expiry)
            const cacheKey = chatIdParam;
            const cacheExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
                        
            const cachedResult = await similarChatsCache.findOne({
            chatId: cacheKey,
            createdAt: { $gte: cacheExpiry }
            });

            if (cachedResult) {
                return reply.send(cachedResult.similarChats);
            }

                
            const chat = await chatsCollection.findOne({ _id: chatIdObjectId });

            if (!chat) {
            console.warn(`[API/SimilarChats] Chat not found for ID: ${chatIdParam}`);
            return reply.code(404).send({ error: 'Chat not found' });
            }

            let similarChats = [];
            const characterPrompt = chat.enhancedPrompt || chat.characterPrompt;


            if (characterPrompt) {
            const mainPromptTokens = tokenizePrompt(characterPrompt);
            
            // Optimized query with better indexing hints
            const candidateChatsCursor = chatsCollection.find(
                { 
                _id: { $ne: chatIdObjectId }, 
                chatImageUrl: { $exists: true, $ne: null, $ne: "" },
                visibility: { $ne: 'private' }, // Exclude private chats
                $or: [
                    { enhancedPrompt: { $exists: true, $ne: null, $ne: "" } }, 
                    { characterPrompt: { $exists: true, $ne: null, $ne: "" } }
                ] 
                },
                {
                projection: {
                    _id: 1, slug: 1, name: 1, modelId: 1, chatImageUrl: 1, 
                    nsfw: 1, userId: 1, gender: 1, imageStyle: 1, 
                    enhancedPrompt: 1, characterPrompt: 1
                }
                }
            ).limit(200); // Limit candidates for performance
            
            const scoredChats = [];
            let candidateCount = 0;
            let validCandidateCount = 0;
            
            await candidateChatsCursor.forEach(candidate => {
                candidateCount++;
                const candidateTokens = tokenizePrompt(candidate.enhancedPrompt || candidate.characterPrompt);
                
                if (candidateTokens.size === 0) return; // Skip if no valid tokens
                
                validCandidateCount++;
                
                // Calculate Jaccard similarity for better matching
                const intersection = new Set([...mainPromptTokens].filter(x => candidateTokens.has(x)));
                const union = new Set([...mainPromptTokens, ...candidateTokens]);
                const jaccardScore = intersection.size / union.size;
                
                // Only include chats with meaningful similarity (>10% Jaccard similarity)
                if (jaccardScore > 0.1) {
                scoredChats.push({
                    ...candidate,
                    score: jaccardScore
                });
                }
            });

            // Sort by score and take top 6
            scoredChats.sort((a, b) => b.score - a.score);
            similarChats = scoredChats.slice(0, 6).map(c => {
                const { characterPrompt, enhancedPrompt, score, ...rest } = c;
                return rest;
            });

            } else {
                console.log(`[API/SimilarChats] No prompt found for current character ${chatIdParam}. Skipping similar chat search.`);
            }

            // Cache the result (upsert to handle updates)
            const cacheDocument = {
            chatId: cacheKey,
            similarChats: similarChats,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
            };

      

            const cacheResult = await similarChatsCache.updateOne(
            { chatId: cacheKey },
            { $set: cacheDocument },
            { upsert: true }
            );

             
            reply.send(similarChats);

        } catch (err) {
            console.error(`[API/SimilarChats] Error in /api/similar-chats/:chatId route for ${request.params.chatId}:`, err);
            reply.code(500).send({ error: 'Internal Server Error' });
        }
        });

    fastify.get('/api/latest-video-chats', async (request, reply) => {
        const db = fastify.mongo.db;
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 10;
        const skip = (page - 1) * limit;

        try {
            console.log(`[latest-video-chats] page=${page} limit=${limit} skip=${skip}`);
            
            const videosCollection = db.collection('videos');
            const chatsCollection = db.collection('chats');
            
            // First, get the latest videos with their chat info
            const latestVideos = await videosCollection.aggregate([
                {
                    $lookup: {
                        from: 'chats',
                        localField: 'chatId',
                        foreignField: '_id',
                        as: 'chat'
                    }
                },
                {
                    $unwind: '$chat'
                },
                {
                    $match: {
                        'chat.language': request.lang,
                        'chat.name': { $exists: true, $ne: '' },
                        'chat.chatImageUrl': { $exists: true, $ne: '' }
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $group: {
                        _id: '$chatId',
                        latestVideo: { $first: '$$ROOT' }
                    }
                },
                {
                    $sort: { 'latestVideo.createdAt': -1 }
                },
                {
                    $skip: skip
                },
                {
                    $limit: limit
                },
                {
                    $project: {
                        _id: '$latestVideo._id',
                        videoUrl: '$latestVideo.videoUrl',
                        duration: '$latestVideo.duration',
                        prompt: '$latestVideo.prompt',
                        createdAt: '$latestVideo.createdAt',
                        chatId: '$latestVideo.chatId',
                        userId: '$latestVideo.userId',
                        chat: {
                            _id: '$latestVideo.chat._id',
                            name: '$latestVideo.chat.name',
                            chatImageUrl: '$latestVideo.chat.chatImageUrl',
                            thumbnailUrl: '$latestVideo.chat.thumbnailUrl',
                            gender: '$latestVideo.chat.gender',
                            imageStyle: '$latestVideo.chat.imageStyle',
                            nsfw: '$latestVideo.chat.nsfw'
                        }
                    }
                }
            ]).toArray();
            // Function to check if video fetch was successful   
            async function checkIfVideoFetchWasSuccessful(videoUrl) {
                try {
                    const response = await axios.head(videoUrl);
                    return response.status === 200; // Check if the video URL is accessible
                } catch (error) {
                    console.error(`[API/latest-video-chats] Error fetching video URL: ${videoUrl}`, error.message);
                    return false; // Return false if there's an error fetching the video URL
                }
            }
            // Get user info for each video
            const usersCollection = db.collection('users');
            let formattedVideoChats = await Promise.all(
                latestVideos.map(async (video) => {
                    const videoFetch = await checkIfVideoFetchWasSuccessful(video.videoUrl);
                    if (!videoFetch) {
                        return null;
                    }
                    const user = await usersCollection.findOne(
                        { _id: video.userId },
                        { projection: { nickname: 1, profileUrl: 1 } }
                    );

                    return {
                        _id: video._id,
                        videoUrl: video.videoUrl,
                        duration: video.duration,
                        prompt: video.prompt,
                        createdAt: video.createdAt,
                        chatId: video.chatId,
                        chat: {
                            _id: video.chat._id,
                            name: video.chat.name,
                            chatImageUrl: video.chat.chatImageUrl || video.chat.thumbnailUrl,
                            gender: video.chat.gender,
                            imageStyle: video.chat.imageStyle,
                            nsfw: video.chat.nsfw || false
                        },
                        user: {
                            nickname: user?.nickname,
                            profileUrl: user?.profileUrl
                        }
                    };
                })
            );
            // Filter out any null values (failed video fetches)
            formattedVideoChats = formattedVideoChats.filter(video => video !== null);

            // Count total unique chats with videos for pagination
            const totalChatsWithVideos = await videosCollection.aggregate([
                {
                    $lookup: {
                        from: 'chats',
                        localField: 'chatId',
                        foreignField: '_id',
                        as: 'chat'
                    }
                },
                {
                    $unwind: '$chat'
                },
                {
                    $match: {
                        'chat.language': request.lang,
                        'chat.name': { $exists: true, $ne: '' },
                        'chat.chatImageUrl': { $exists: true, $ne: '' }
                    }
                },
                {
                    $group: {
                        _id: '$chatId'
                    }
                },
                {
                    $count: 'total'
                }
            ]).toArray();

            const totalCount = totalChatsWithVideos[0]?.total || 0;
            const totalPages = Math.ceil(totalCount / limit);

            reply.send({
                videoChats: formattedVideoChats,
                currentPage: page,
                totalPages: totalPages,
                totalCount: totalCount
            });

        } catch (error) {
            console.log({ msg: 'Error fetching latest video chats', error: error.message, stack: error.stack });
            reply.status(500).send({ message: 'Error fetching latest video chats' });
        }
    });

    fastify.get('/api/latest-chats', async (request, reply) => {
        const db = fastify.mongo.db;
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 18;
        const skip = (page - 1) * limit;
        const nsfwLimit = Math.floor(limit / 2);
        const sfwLimit = limit - nsfwLimit;

        try {
        
        console.log(`[latest-chats] page=${page} limit=${limit} skip=${skip}`);
        const chatsCollection = db.collection('chats');
        const baseQuery = {
            chatImageUrl: { $exists: true, $ne: '' },
            name: { $exists: true, $ne: '' },
            language: request.lang,
        };

        // Query for NSFW chats - handle both boolean and string values
        const nsfwQuery = { 
            ...baseQuery, 
            $or: [
                { nsfw: true },
                { nsfw: 'true' }
            ] 
        };
        const nsfwChats = await chatsCollection.find(nsfwQuery)
            .sort({ _id: -1 })
            .skip(skip)
            .limit(nsfwLimit)
            .project({
            modelId: 1,
            name: 1,
            first_message: 1,
            chatImageUrl: 1,
            thumbnailUrl: 1,
            nsfw: 1,
            gender: 1,
            tags: 1,
            imageStyle: 1,
            userId: 1,
            createdAt: 1
            })
            .toArray();

        // Query for SFW chats
        // Query for SFW chats - handle both boolean and string values
        const sfwQuery = { 
            ...baseQuery, 
            $or: [
                { nsfw: false },
                { nsfw: 'false' },
                { nsfw: { $exists: false } } // Include chats without the nsfw field
            ] 
        };
        const sfwChats = await chatsCollection.find(sfwQuery)
            .sort({ _id: -1 })
            .skip(skip)
            .limit(sfwLimit)
            .project({
            modelId: 1,
            name: 1,
            first_message: 1,
            chatImageUrl: 1,
            thumbnailUrl: 1,
            nsfw: 1,
            gender: 1,
            tags: 1,
            imageStyle: 1,
            userId: 1,
            createdAt: 1
            })
            .toArray();
            
        // Combine and sort by _id descending (latest first)
        const combinedChats = [...sfwChats, ...nsfwChats].sort((a, b) => b._id - a._id);

        const formattedChats = combinedChats.map(chat => ({
            _id: chat._id,
            name: chat.name || 'Unnamed Chat',
            chatImageUrl: chat.chatImageUrl || chat.thumbnailUrl || '/img/default_chat_avatar.png',
            thumbnailUrl: chat.thumbnailUrl,
            nsfw: chat.nsfw || false,
            gender: chat.gender,
            imageStyle: chat.imageStyle,
            userId: chat.userId,
            first_message: chat.first_message,
            tags: chat.tags || [],
        }));

        // For pagination info, count total chats matching baseQuery
        const totalChats = await chatsCollection.countDocuments(baseQuery);
        const totalPages = Math.ceil(totalChats / limit);

        reply.send({
            chats: formattedChats,
            currentPage: page,
            totalPages: totalPages,
            totalChats: totalChats
        });

        } catch (error) {
        console.log({ msg: 'Error fetching latest chats', error: error.message, stack: error.stack });
        reply.status(500).send({ message: 'Error fetching latest chats' });
        }
    });

    fastify.get('/api/custom-prompts/:userId', async (request, reply) => {
        try {
            const { userId } = request.params;

            if (!fastify.mongo.ObjectId.isValid(userId)) {
                return reply.status(400).send({ error: 'Invalid user ID format' });
            }

            // Use the imported getUserPoints utility function
            const userPoints = await getUserPoints(fastify.mongo.db, userId);

            // Get all custom prompts from the database
            const customPrompts = await fastify.mongo.db.collection('prompts')
                .find({})
                .sort({ order: 1 })
                .toArray();

            // Determine which prompts the user can afford
            const promptsWithAccess = customPrompts.map(prompt => {
                const cost = prompt.cost || 0; // Default cost to 0 if not set
                const canAfford = userPoints >= cost;

                return {
                    promptId: prompt._id.toString(),
                    cost: cost,
                    canAfford: canAfford
                };
            });

            return reply.send({
                userPoints: userPoints,
                prompts: promptsWithAccess
            });

        } catch (error) {
            console.error('Error fetching custom prompts:', error);
            return reply.status(500).send({ error: 'Internal server error while fetching custom prompts' });
        }
    });
}

module.exports = routes;
