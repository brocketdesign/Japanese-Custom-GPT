const { ObjectId } = require('mongodb');
 const slugify = require('slugify');
 const {
     generateCompletion,
 } = require('../models/openai')
 const { getApiUrl } = require('../models/tool');
 const axios = require('axios');
 const OpenAI = require("openai");
 const { z, custom, union } = require("zod");
 const { zodResponseFormat, zodResponsesFunction } = require("openai/helpers/zod");
 
 const characterSchema = z.object({
        name: z.string(),
        short_intro: z.string(),
        system_prompt: z.string(),
        tags:z.array(z.string()),
        first_message: z.string(),
 });

const details_description = z.object({
    // Physical Appearance - Core Features
    appearance: z.object({
        age: z.string().nullable(),
        gender: z.enum(['male', 'female', 'non-binary']).nullable(),
        ethnicity: z.string().nullable(),
        height: z.string().nullable(),
        weight: z.string().nullable(),
        bodyType: z.enum(['slim', 'athletic', 'average', 'curvy', 'muscular', 'heavy']).nullable(),
    }),
    
    // Facial Features
    face: z.object({
        faceShape: z.enum(['oval', 'round', 'square', 'heart', 'long', 'diamond']).nullable(),
        skinColor: z.string().nullable(),
        eyeColor: z.string().nullable(),
        eyeShape: z.enum(['almond', 'round', 'hooded', 'monolid', 'upturned', 'downturned']).nullable(),
        eyeSize: z.enum(['small', 'medium', 'large']).nullable(),
        facialFeatures: z.string().nullable(),
        makeup: z.string().nullable(),
    }),
    
    // Hair
    hair: z.object({
        hairColor: z.string().nullable(),
        hairLength: z.enum(['very short', 'short', 'medium', 'long', 'very long']).nullable(),
        hairStyle: z.string().nullable(),
        hairTexture: z.enum(['straight', 'wavy', 'curly', 'coily']).nullable(),
    }),
    
    // Body Features (Gender-specific)
    body: z.object({
        // Female-specific
        breastSize: z.enum(['small', 'medium', 'large', 'very large']).nullable(),
        assSize: z.enum(['small', 'medium', 'large', 'very large']).nullable(),
        bodyCurves: z.enum(['minimal', 'subtle', 'pronounced', 'very pronounced']).nullable(),
        // Male-specific
        chestBuild: z.enum(['slim', 'average', 'muscular', 'broad']).nullable(),
        shoulderWidth: z.enum(['narrow', 'average', 'broad', 'very broad']).nullable(),
        absDefinition: z.enum(['none', 'slight', 'defined', 'very defined']).nullable(),
        armMuscles: z.enum(['slim', 'toned', 'muscular', 'very muscular']).nullable(),
    }),
    
    // Style & Fashion
    style: z.object({
        clothingStyle: z.string().nullable(),
        accessories: z.string().nullable(),
        tattoos: z.string().nullable(),
        piercings: z.string().nullable(),
        scars: z.string().nullable(),
    }),
    
    // Personality & Character
    personality: z.object({
        personality: z.string().nullable(),
        hobbies: z.array(z.string()).nullable(),
        interests: z.array(z.string()).nullable(),
        likes: z.array(z.string()).nullable(),
        dislikes: z.array(z.string()).nullable(),
        background: z.string().nullable(),
        occupation: z.string().nullable(),
        specialAbilities: z.array(z.string()).nullable(),
    }),
});

// Helper function to flatten details for prompt generation
function flattenDetailsForPrompt(details) {
    if (!details || typeof details !== 'object') return '';
    
    const flatDetails = [];
    
    const processObject = (obj, prefix = '') => {
        Object.entries(obj).forEach(([key, value]) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                processObject(value, prefix ? `${prefix}.${key}` : key);
            } else if (value !== undefined && value !== null && value !== '') {
                const displayKey = prefix ? `${prefix}.${key}` : key;
                if (Array.isArray(value)) {
                    flatDetails.push(`${displayKey}: ${value.join(', ')}`);
                } else {
                    flatDetails.push(`${displayKey}: ${value}`);
                }
            }
        });
    };
    
    processObject(details);
    return flatDetails.join(', ');
}

// Enhanced function for character creation with better detail handling
function createSystemPayloadChatRule(purpose, gender, name, details, language) {
    const detailsString = flattenDetailsForPrompt(details);
    
    return [
        {
            role: "system",
            content: `You are a helpful assistant creating detailed character descriptions in ${language}.
            
            Character Requirements:
            - name: ${name && name.trim() !== '' ? name : `Provide an authentic ${language} name that matches the character's gender and background`}
            - short_intro: A compelling 2-sentence self-introduction showcasing personality
            - system_prompt: Start with "I want you to act as..." and define their specific role/archetype
            - first_message: Demonstrate their unique speech pattern and personality
            - tags: 5 relevant tags for character discovery
            
            Ensure consistency between physical description and personality traits.
            Use the provided details to create a cohesive character.
            Respond entirely in ${language}.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim()
        },
        {
            role: "user",
            content: `Character Creation Details:
            Name: ${name}
            Gender: ${gender}
            Purpose/Role: ${purpose}
            ${detailsString ? `Physical & Personality Details: ${detailsString}` : ''}
            
            Create a character that maintains consistency across all attributes.
            The character's speech pattern should reflect their background and personality.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim()
        },
    ];
}

// Enhanced image prompt generation with structured details
function createSystemPayload(prompt, gender, details) {
    const detailsString = flattenDetailsForPrompt(details);
    
    return [
        {
            role: 'system',
            content: `You are an expert Stable Diffusion prompt engineer.
            Generate a detailed, keyword-based image prompt (under 1000 characters) for character visualization.
            
            Requirements:
            - Use comma-separated descriptive keywords in English
            - Include physical appearance, emotion, style, and environment
            - Optimize for high-quality, detailed character generation
            - Maintain consistency with provided character details
            - NO complete sentences, only relevant keywords
            
            Respond with the enhanced prompt only in English.
            
            You need to be concise.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim(),
        },
        {
            role: 'user',
            content: `Base prompt: ${prompt}
            Gender: ${gender}
            ${detailsString ? `Character details: ${detailsString}` : ''}
            
            Create a comprehensive image prompt that captures all visual elements.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim(),
        },
        {
            role: 'user',
            content: `Include these essential elements:
            - Age, skin tone, hair (color, length, style), eye details
            - Facial expression, body type, physique characteristics
            ${gender === 'female' ? 
                '- Breast size, body curves, feminine features' : 
                gender === 'male' ? 
                '- Chest build, shoulder width, masculine features' : 
                '- Gender-appropriate physical characteristics'
            }
            - Clothing style, accessories, background setting
            - Art style, lighting, image quality descriptors`
        },
        {
            role: 'user',
            content: `Ensure the prompt is under 1000 characters and formatted for Stable Diffusion.
            Avoid any extraneous information or context.`
        }
    ];
}

// Enhanced function for extracting details from prompt
function extractDetailsFromPrompt(prompt, gender ='female') {
    return [
        {
            role: "system",
            content: `You are an expert character analyst. Extract detailed physical and personality attributes from the given character description.
            
            Analyze the prompt and return structured details in the exact format required by the details_description schema.
            Focus on extracting:
            - Physical appearance (age, ethnicity, height, body type)
            - Facial features (face shape, skin color, eyes, hair)
            - Body characteristics based on gender
            - Style and fashion choices
            - Personality traits and background
            
            Return only valid data that can be inferred from the prompt. Use "undefined" for unclear attributes.
            Respond with a properly formatted JSON object matching the details_description schema.`
        },
        {
            role: "user", 
            content: `Character Description: ${prompt}
            
            Extract and structure all available details from this description.`
        }
    ];
}

async function routes(fastify, options) {
    fastify.post('/api/generate-character-comprehensive', async (request, reply) => {
        const startTime = Date.now();
        console.log('[API/generate-character-comprehensive] Starting comprehensive character generation');
        
        try {
            const { prompt, gender, name, language: requestLanguage } = request.body;
            let chatId = request.body.chatId || request.query.chatId || request.params.chatId || null;
            const userId = request.user._id;
            const language = requestLanguage || request.lang;
 
            console.log(`[API/generate-character-comprehensive] Input parameters - chatId: ${chatId || 'undefined'}, gender: ${gender || 'undefined'}, language: ${language}, prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'undefined'}, name: ${name || 'undefined'}`);
            
            if (!prompt || prompt.trim() === '') {
                fastify.sendNotificationToUser(userId, 'showNotification', { message: 'Please provide a valid prompt.', icon: 'error' });
                console.log('[API/generate-character-comprehensive] Missing required fields');
                return reply.status(400).send({ error: 'Missing required fields: prompt is required.' });
            }

            if(!chatId || !ObjectId.isValid(chatId)) {
                console.log('[API/generate-character-comprehensive] Invalid chatId');
                const apiUrl = getApiUrl(request);   
                const checkChat = async (chatCreationId) => {
                    try {
                        const response = await axios.post(apiUrl + '/api/check-chat', { chatId: chatCreationId });
                        if (response.data.message === 'Chat exists') {
                            return false;
                        } else {
                            return response.data.chatId;
                        }
                    } catch (error) {
                        console.error('Request failed:', error);
                        throw error;
                    }
                };
                chatId = await checkChat(chatId);
                console.log(`[API/generate-character-comprehensive] Validated chatId: ${chatId}`);
            }
            // Step 1: Extract details from prompt
            console.log('[API/generate-character-comprehensive] Step 1: Extracting details from prompt');
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.character_analysis_started, 
                icon: 'info' 
            });

            const detailsExtractionPayload = extractDetailsFromPrompt(prompt, gender);
            const openai = new OpenAI();
            
            const detailsResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: detailsExtractionPayload,
                response_format: zodResponseFormat(details_description, "character_details"),
            });

            let extractedDetails = null;
            try {
                extractedDetails = JSON.parse(detailsResponse.choices[0].message.content);
                console.log('[API/generate-character-comprehensive] Successfully extracted details');
                
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.character_analysis_complete, 
                    icon: 'success' 
                });
            } catch (parseError) {
                console.error('[API/generate-character-comprehensive] Error parsing extracted details:', parseError);
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.character_analysis_error, 
                    icon: 'error' 
                });
            }

            // Step 2: Generate enhanced prompt
            console.log('[API/generate-character-comprehensive] Step 2: Generating enhanced prompt');
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.enhanced_prompt_generation_started, 
                icon: 'info' 
            });

            const systemPayload = createSystemPayload(prompt, gender, extractedDetails);
            const enhancedPrompt = await generateCompletion(systemPayload, 600, 'mistral');
            
            console.log('[API/generate-character-comprehensive] Enhanced prompt generated:', enhancedPrompt.substring(0, 100) + '...');
            console.log('[API/generate-character-comprehensive] Enhanced prompt length:', enhancedPrompt.length);
            if (enhancedPrompt.length > 1000) {
                console.log('[API/generate-character-comprehensive] Enhanced prompt exceeds 1000 characters');
            }
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.enhancedPrompt_complete, 
                icon: 'success' 
            });

            // Step 3: Generate character personality
            console.log('[API/generate-character-comprehensive] Step 3: Generating character personality');
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.personality_generation_started, 
                icon: 'info' 
            });

            const systemPayloadChat = createSystemPayloadChatRule(prompt, gender, name, extractedDetails, language);
            const personalityResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: systemPayloadChat,
                response_format: zodResponseFormat(characterSchema, "character_data"),
            });

            let chatData = JSON.parse(personalityResponse.choices[0].message.content);
            console.log('[API/generate-character-comprehensive] Character personality generated');
            
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.chatData_complete, 
                icon: 'success' 
            });

            // [SKIP] Step 4: Optional debrided enhancement
            const skip_step_4 = true; // Set to true to skip debrided enhancement
            if(!skip_step_4){
                try {
                    console.log('[API/generate-character-comprehensive] Step 4: Attempting debrided enhancement');
                    fastify.sendNotificationToUser(userId, 'showNotification', { 
                        message: request.translations.newCharacter.debrided_generation_started, 
                        icon: 'info' 
                    });

                    const debridedSystemMessage = [
                        {
                            role: "system",
                            content: `You are a helpful NSFW assistant. You will take a JSON object and update it to make it more human-like and spicy. You must answer with a JSON object.`
                        },
                        {
                            role: "user",
                            content: `Here is the JSON object to enhance: ${JSON.stringify(chatData)}
                            Make it more human-like and spicy.`
                        },
                    ];
                    
                    let debridedResponse = await generateCompletion(debridedSystemMessage, 1000, 'mistral', language);
                    console.log(`[API/generate-character-comprehensive] Debrided response received`);
                    
                    const JSONCleaner = (str) => {  
                        const start = str.indexOf('{');
                        const end = str.lastIndexOf('}');
                        if (start === -1 || end === -1) {
                            return null;
                        }
                        return str.substring(start, end + 1);
                    };
                    
                    debridedResponse = JSONCleaner(debridedResponse);
                    const debridedChatData = JSON.parse(debridedResponse);
                    const validationResult = characterSchema.safeParse(debridedChatData);
                    
                    if (!validationResult.success) {
                        console.log('[API/generate-character-comprehensive] Validation error in debrided response:', validationResult.error);
                    } else {
                        chatData = debridedChatData;
                        console.log('[API/generate-character-comprehensive] Debrided enhancement successful');
                        fastify.sendNotificationToUser(userId, 'showNotification', { 
                            message: request.translations.newCharacter.debridedChatData_complete, 
                            icon: 'success' 
                        });
                    }
                } catch (error) {
                    console.log('[API/generate-character-comprehensive] Error in debrided enhancement:', error);
                    fastify.sendNotificationToUser(userId, 'showNotification', { 
                        message: request.translations.newCharacter.debrided_generation_error, 
                        icon: 'warning' 
                    });
                }
            } else {
                console.log('[API/generate-character-comprehensive] Skipping debrided enhancement step');
            }

            // Step 5: Save to database
            console.log('[API/generate-character-comprehensive] Step 5: Saving to database');
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.saving_character_data, 
                icon: 'info' 
            });

            // Prepare final data
            chatData.language = language;
            chatData.gender = gender;
            chatData.characterPrompt = prompt;
            chatData.imageDescription = enhancedPrompt;
            chatData.enhancedPrompt = enhancedPrompt;
            chatData.details_description = extractedDetails;
            chatData.createdAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
            chatData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });

            const collectionChats = fastify.mongo.db.collection('chats');
            // Generate slug
            if (chatData.name) {
                const baseSlug = slugify(chatData.name, { lower: true, strict: true });
                let slug = baseSlug;
                
                const slugExists = await collectionChats.findOne({ 
                    slug: baseSlug, 
                    _id: { $ne: new fastify.mongo.ObjectId(chatId) } 
                });
                
                if (slugExists) {
                    const randomStr = Math.random().toString(36).substring(2, 6);
                    slug = `${baseSlug}-${randomStr}`;
                    console.log(`[API/generate-character-comprehensive] Generated unique slug: ${slug}`);
                }
                
                chatData.slug = slug;
            }

            // Save generated tags
            const tagsCollection = fastify.mongo.db.collection('tags');
            const generatedTags = chatData.tags;
            
            for (const tag of generatedTags) {
                await tagsCollection.updateOne(
                    { name: tag },
                    { $set: { name: tag, language }, $addToSet: { chatIds: chatId } },
                    { upsert: true }
                );
            }

            // Update chat document
            const updateResult = await collectionChats.updateOne(
                { _id: new fastify.mongo.ObjectId(chatId) },
                { $set: chatData }
            );

            if (updateResult.matchedCount === 0) {
                console.error(`[API/generate-character-comprehensive] Chat not found for ID: ${chatId}`);
                throw new Error('Chat not found.');
            }

            const totalTime = Date.now() - startTime;
            console.log(`[API/generate-character-comprehensive] Process completed successfully in ${totalTime}ms`);
            
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.character_generation_complete || 'Character generation completed successfully!', 
                icon: 'success' 
            });

            reply.send({
                success: true,
                chatId,
                chatData,
                extractedDetails,
                enhancedPrompt,
                processingTime: totalTime
            });

        } catch (err) {
            const totalTime = Date.now() - startTime;
            console.error(`[API/generate-character-comprehensive] Error after ${totalTime}ms:`, err);
            
            fastify.sendNotificationToUser(request.user._id, 'showNotification', { 
                message: request.translations.newCharacter.character_generation_error, 
                icon: 'error' 
            });

            if (err instanceof z.ZodError) {
                console.error('[API/generate-character-comprehensive] Validation error:', err.errors);
                return reply.status(400).send({ error: 'Validation error in response data.', details: err.errors });
            }

            reply.status(500).send({ error: 'An unexpected error occurred.', details: err.message });
        }
    });
}
module.exports = routes;
