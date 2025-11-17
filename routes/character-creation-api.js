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
        age: z.string(),
        gender: z.enum(['male', 'female']),
        ethnicity: z.string(),
        height: z.string(),
        weight: z.string(),
        bodyType: z.enum(['slim', 'athletic', 'average', 'curvy', 'muscular', 'heavy']),
    }),
    
    // Facial Features
    face: z.object({
        faceShape: z.enum(['oval', 'round', 'square', 'heart', 'long', 'diamond']),
        skinColor: z.string(),
        eyeColor: z.string(),
        eyeShape: z.enum(['almond', 'round', 'hooded', 'monolid', 'upturned', 'downturned']),
        eyeSize: z.enum(['small', 'medium', 'large']),
        facialFeatures: z.string(),
    }),
    
    // Hair
    hair: z.object({
        hairColor: z.string(),
        hairLength: z.enum(['very short', 'short', 'medium', 'long', 'very long']),
        hairStyle: z.string(),
        hairTexture: z.enum(['straight', 'wavy', 'curly', 'coily']),
    }),
    
    // Body Features (Gender-specific)
    body: z.object({
        // Female-specific
        breastSize: z.enum(['small', 'medium', 'large', 'very large']),
        assSize: z.enum(['small', 'medium', 'large', 'very large']),
        bodyCurves: z.enum(['minimal', 'subtle', 'pronounced', 'very pronounced']),
        // Male-specific
        chestBuild: z.enum(['slim', 'average', 'muscular', 'broad']),
        shoulderWidth: z.enum(['narrow', 'average', 'broad', 'very broad']),
        absDefinition: z.enum(['none', 'slight', 'defined', 'very defined']),
        armMuscles: z.enum(['slim', 'toned', 'muscular', 'very muscular']),
    }),
    
    // Style & Fashion
    style: z.object({
        clothingStyle: z.string(),
        accessories: z.string(),
        tattoos: z.string(),
        piercings: z.string(),
        scars: z.string(),
    }),
    
    // Personality & Character
    personality: z.object({
        personality: z.string(),
        hobbies: z.array(z.string()),
        interests: z.array(z.string()),
        likes: z.array(z.string()),
        dislikes: z.array(z.string()),
        background: z.string(),
        occupation: z.string(),
        specialAbilities: z.array(z.string()),
        reference_character: z.string(),
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
            - short_intro: A compelling 1 sentence that captures the essence of the character. Example: "A brave warrior from the mountains, seeking redemption."
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
        {
            role: "user",
            content: `Ensure the character's system prompt and short introduction are original and engaging.
            Avoid generic phrases and fashion cliches.
            Use the provided reference_character to inspire unique traits and characteristics.  
            The character should feel authentic and relatable, with a well-defined personality and background.      
            The character's first message should reflect their unique speech pattern and personality.`
        },
    ];
}
// Enhanced image prompt generation with structured details
function createSystemPayload(prompt, gender, details, imageType) {
    const detailsString = flattenDetailsForPrompt(details);
    
    // Gender-specific instructions to prevent unwanted features
    const genderInstruction = gender === 'female' ?
        'Include feminine facial features, elegant makeup, and feminine hairstyle. Avoid masculine traits. IMPORTANT: Ensure clothing fully covers chest and body - no cleavage, no exposed breasts, no bikini or revealing clothing.' : 
        'Include masculine facial features, confident expression, and masculine hairstyle. Avoid feminine traits. IMPORTANT: Ensure the character is fully clothed with appropriate masculine clothing like shirts, jackets, or formal wear - no exposed chest.';

    return [
        {
            role: 'system',
            content: `You are an expert Stable Diffusion prompt engineer specializing in SFW character portraits.
            Generate a detailed, keyword-based image prompt (under 1000 characters) for character visualization.

            CRITICAL SFW REQUIREMENTS:
            - The image MUST be ONLY a face and upper body portrait (shoulders to head, no lower body)
            - NO nudity, NO exposed skin beyond neck/shoulders/arms
            - Character MUST be fully clothed and modestly dressed
            - NO cleavage, NO exposed breasts, NO revealing clothing
            - NO sexual or suggestive content whatsoever
            - Use comma-separated descriptive keywords in English
            - Include facial features, emotion, hairstyle, and appropriate clothing
            - Optimize for high-quality, detailed character face generation
            - Maintain consistency with provided character details
            - NO complete sentences, only relevant keywords
            - The prompt must be strictly SFW (safe for work), no explicit or NSFW content
            - ${genderInstruction}

            IMPORTANT OUTPUT REQUIREMENTS:
            - Respond ONLY with the comma-separated keywords
            - NO introductory text like "Here is the prompt:" or "Here is the comprehensive..."
            - NO headers, no explanations, no preamble
            - Start directly with the first keyword
            - Keep it under 1000 characters
            - Do not include colons, dashes, or any formatting except commas between keywords`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim(),
        },
        {
            role: 'user',
            content: `Base prompt: ${prompt}
            Gender: ${gender}
            ${detailsString ? `Character details: ${detailsString}` : ''}

            Create a comprehensive image prompt that captures all aspects of the given base prompt. 
            CRITICAL: Only generate an upper body portrait (head and shoulders), no full body or background.
            CRITICAL: The character must be fully clothed and modest - no nudity or revealing clothing.
            
            REMEMBER: Output ONLY the keywords, no introduction or explanation.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim(),
        },
        {
            role: 'user',
            content: `FINAL REQUIREMENTS:
            - Output ONLY comma-separated keywords - NO other text
            - Ensure the prompt is under 1000 characters
            - Formatted for Stable Diffusion with comma-separated keywords only
            - The image MUST be strictly SFW - no nudity, no exposed breasts, no bikini
            - Only an upper body portrait (head, neck, shoulders, fully clothed upper torso)
            - No background or full body
            - The character must be wearing appropriate clothing that fully covers the body
            - START WITH THE KEYWORDS DIRECTLY - do not write "Here is" or "The prompt is" or any introduction`
        }
    ];
}

// Enhanced function for extracting details from prompt
function extractDetailsFromPrompt(prompt, chatPurpose = '', gender ='female') {
    return [
        {
            role: "system",
            content: `You are an expert character creator analyst. 
            Extract and imagine detailed physical and personality attributes from the given character description.

            Analyze the prompt and return structured details in the exact format required by the details_description schema.
            Focus on extracting:
            - Physical appearance (age, ethnicity, height, body type)
            - Facial features (face shape, skin color, eyes, hair)
            - Body characteristics based on gender
            - Style and fashion choices
            - Personality traits and background
            - Reference character : Provide a reference character. It could be a real person, fictional character, or any other reference that fits the description.
            
            IMPORTANT: The character gender MUST be "${gender}". Do NOT change this based on the description. Always use the provided gender.
            If the description seems to contradict the gender, adapt other characteristics to match the specified gender instead.
            
            Provide creative data for unclear attributes.
            Respond with a properly formatted JSON object matching the details_description schema.`
        },
        {
            role: "user", 
            content: `CHARACTER GENDER (MUST USE THIS): ${gender}
            
            ${chatPurpose && chatPurpose.trim() !== '' ? `Character Purpose: ${chatPurpose}` : ''}
            Character Description: ${prompt}
            
            Extract and structure all available details from this description.
            REMEMBER: The gender MUST be "${gender}" - use this gender regardless of how the description reads.
            All the fields should be filled based on the description & not left empty.
            If a detail is not mentioned, you must imagine it while respecting the enforced gender.`
        }
    ];
}

async function routes(fastify, options) {
    fastify.post('/api/generate-character-comprehensive', async (request, reply) => {
        const startTime = Date.now();
        console.log('[API/generate-character-comprehensive] Starting comprehensive character generation');
        
        try {
            const { 
                prompt, 
                negativePrompt = null, 
                name, 
                chatPurpose, 
                language: requestLanguage, 
                imageType, 
                image_base64, 
                enableMergeFace, 
                enableEnhancedPrompt = true,
                nsfw = false // Add this parameter
            } = request.body;
            let gender = request.body.gender || null;
            let chatId = request.body.chatId || request.query.chatId || request.params.chatId || null;
            
            const userId = request.body.userId || request.user._id;
            const language = requestLanguage || request.lang;
            // Check user subscription for NSFW content
            const user = await fastify.mongo.db.collection('users').findOne({ 
                _id: new ObjectId(userId) 
            });
            const isPremium = user?.subscriptionStatus === 'active';
            
            // Enforce NSFW restrictions for non-premium users
            const allowNsfw = isPremium && nsfw;
            const finalImageType = allowNsfw ? imageType : 'sfw';
            
            console.log(`[API/generate-character-comprehensive] NSFW settings - isPremium: ${isPremium}, requested: ${nsfw}, allowed: ${allowNsfw}`);
            console.log(`[API/generate-character-comprehensive] Input parameters - chatId: ${chatId || 'undefined'}, gender: ${gender || 'undefined'}, language: ${language}, prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'undefined'}, name: ${name || 'undefined'}, hasImageBase64: ${!!image_base64}, enableMergeFace: ${!!enableMergeFace}`);
            console.log(`Translations Language: ${request.translations.lang}`);

            if (!prompt || prompt.trim() === '') {
                fastify.sendNotificationToUser(userId, 'showNotification', { message: 'Please provide a valid prompt.', icon: 'error' });
                console.log('[API/generate-character-comprehensive] Missing required fields');
                return reply.status(400).send({ error: 'Missing required fields: prompt is required.' });
            }

            if(!chatId || !ObjectId.isValid(chatId)) {
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
                console.log(`[API/generate-character-comprehensive] New chatId created: ${chatId}`);
            }
            // Step 1: Extract details from prompt
            console.log('[API/generate-character-comprehensive] Step 1: Extracting details from prompt');

            const detailsExtractionPayload = extractDetailsFromPrompt(prompt, chatPurpose, gender);
            const openai = new OpenAI();
            
            const detailsResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: detailsExtractionPayload,
                response_format: zodResponseFormat(details_description, "character_details"),
            });

            let extractedDetails = null;
            try {
                extractedDetails = JSON.parse(detailsResponse.choices[0].message.content);
                gender = extractedDetails.appearance.gender || gender;
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
            let enhancedPrompt = prompt || null;

            if(enableEnhancedPrompt) {
                console.log(`[API/generate-character-comprehensive] Step 2: Generating ${finalImageType} enhanced prompt`);
                console.log(`[API/generate-character-comprehensive] Gender for prompt: ${gender}`);

                const systemPayload = createSystemPayload(prompt, gender, extractedDetails, finalImageType);
                enhancedPrompt = await generateCompletion(systemPayload, 600, 'llama-3-70b');
                
                // Clean up the enhanced prompt: remove any comments, headers, or preamble
                enhancedPrompt = enhancedPrompt
                    .split('\n')
                    .filter(line => line.trim() && !line.trim().startsWith('Here is') && !line.trim().startsWith('here is') && !line.trim().match(/^(The|This|Based|Following|.*:)(\s|.*prompt)/i))
                    .join(', ')
                    .replace(/^[^\w]*/i, '') // Remove leading non-word characters
                    .replace(/,+/g, ',') // Remove duplicate commas
                    .trim();
                
                console.log(`[API/generate-character-comprehensive] Cleaned enhanced prompt: ${enhancedPrompt.substring(0, 100)}...`);
                
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.enhancedPrompt_complete, 
                    icon: 'success' 
                });
                
                fastify.sendNotificationToUser(userId, 'updateEnhancedPrompt', {
                    enhancedPrompt
                });
            } else {
                console.log('[API/generate-character-comprehensive] Step 2: Skipping enhanced prompt generation');
                fastify.sendNotificationToUser(userId, 'showNotification', {
                    message: request.translations.newCharacter.enhancedPrompt_skipped,
                    icon: 'info'
                });
            }

            // Step 2.5: Trigger image generation immediately after enhanced prompt is available
            console.log('[API/generate-character-comprehensive] Step 2.5: Triggering image generation with enhanced prompt');

            try {
                // First, save gender to chat BEFORE generating images
                await fastify.mongo.db.collection('chats').updateOne(
                    { _id: new ObjectId(chatId) },
                    { $set: { gender: gender } }
                );
                console.log(`[API/generate-character-comprehensive] ✓ Saved gender to chat: ${gender}`);

                const { generateImg } = require('../models/imagen');
                
                // Generate placeholder ID for tracking
                const placeholderId = new fastify.mongo.ObjectId().toString();

                // Trigger image generation asynchronously with enhanced prompt
                console.log(`[API/generate-character-comprehensive] 🖼️  Triggering async image generation:`);
                console.log(`  - Enhanced prompt length: ${enhancedPrompt?.length || 0} chars`);
                console.log(`  - Image type: sfw`);
                console.log(`  - Placeholder ID: ${placeholderId}`);
                
                // Use setImmediate or process.nextTick to ensure image generation runs after response is sent
                setImmediate(() => {
                    console.log(`[API/generate-character-comprehensive] 🔄 Image generation started in background (async)`);
                    
                    generateImg({
                        prompt: enhancedPrompt,
                        negativePrompt: negativePrompt || null,
                        userId: userId,
                        chatId: chatId,
                        userChatId: null,
                        image_num: 1,
                        imageType: 'sfw', // All character profile images are SFW
                        image_base64: image_base64 || null,
                        chatCreation: true,
                        placeholderId: placeholderId,
                        translations: request.translations,
                        fastify: fastify,
                        enableMergeFace: enableMergeFace || false
                    }).then(() => {
                        console.log(`[API/generate-character-comprehensive] ✅ Image generation completed successfully`);
                    }).catch(error => {
                        console.error(`[API/generate-character-comprehensive] ❌ Image generation error: ${error.message}`);
                        console.error(`[API/generate-character-comprehensive] Stack:`, error.stack);
                        fastify.sendNotificationToUser(userId, 'showNotification', { 
                            message: request.translations.newCharacter.image_generation_error || 'Image generation failed', 
                            icon: 'error' 
                        });
                    });
                });
                
                console.log(`[API/generate-character-comprehensive] ✓ Image generation queued (will run in background)`);
                
            } catch (imageError) {
                console.error(`[API/generate-character-comprehensive] ⚠️  Error queuing image generation: ${imageError.message}`);
                // Don't throw - image generation is not critical for chat to start
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.image_generation_error || 'Image generation failed', 
                    icon: 'error' 
                });
            }

            // Step 3: Generate character personality
            console.log('[API/generate-character-comprehensive] Step 3: Generating character personality');

            const systemPayloadChat = createSystemPayloadChatRule(prompt, gender, name, extractedDetails, language);
            const personalityResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: systemPayloadChat,
                response_format: zodResponseFormat(characterSchema, "character_data"),
            });

            let chatData = JSON.parse(personalityResponse.choices[0].message.content);
            console.log('[API/generate-character-comprehensive] Character personality generated');

            // Step 4: Save to database
            console.log('[API/generate-character-comprehensive] Step 4: Saving to database');

            // Prepare final data
            chatData.language = language;
            chatData.gender = gender;
            chatData.characterPrompt = prompt;
            chatData.imageDescription = enhancedPrompt;
            chatData.enhancedPrompt = enhancedPrompt;
            chatData.details_description = extractedDetails;
            chatData.createdAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
            chatData.updatedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
            chatData.nsfw = allowNsfw;
            chatData.imageType = finalImageType;
            chatData.thumbIsPortrait = true;
            
            console.log('[API/generate-character-comprehensive] Prepared chatData for database:');
            console.log(`  - system_prompt length: ${chatData.system_prompt?.length || 0} chars`);
            console.log(`  - details_description: ${chatData.details_description ? '✓' : '✗'}`);
            console.log(`  - details_description.personality: ${chatData.details_description?.personality ? '✓' : '✗'}`);
            console.log(`  - reference_character: ${chatData.details_description?.personality?.reference_character || 'N/A'}`);
            console.log(`  - tags: ${chatData.tags?.length || 0} tags`);
            
            const collectionChats = fastify.mongo.db.collection('chats');
            
            // Update chat document
            console.log('[API/generate-character-comprehensive] Executing first database update...');
            const firstUpdate = await collectionChats.updateOne(
                { _id: new fastify.mongo.ObjectId(chatId) },
                { $set: chatData }
            );

            if (firstUpdate.matchedCount === 0) {
                console.error(`[API/generate-character-comprehensive] ❌ Chat not found for ID: ${chatId}`);
                throw new Error('Chat not found.');
            }

            console.log(`[API/generate-character-comprehensive] ✓ First update successful: ${firstUpdate.modifiedCount} document(s) modified`);

            // Step 5: Generate unique slug if name is provided
            console.log('[API/generate-character-comprehensive] Step 5: Generating unique slug if name is provided');
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
                } else {
                    console.log(`[API/generate-character-comprehensive] Using base slug: ${slug}`);
                }
                
                chatData.slug = slug;
            }

            // Step 6: Update tags in the database
            console.log('[API/generate-character-comprehensive] Step 6: Updating tags in the database');

            const tagsCollection = fastify.mongo.db.collection('tags');
            const generatedTags = chatData.tags;
            
            console.log(`[API/generate-character-comprehensive] Processing ${generatedTags?.length || 0} tags...`);
            for (const tag of (generatedTags || [])) {
                try {
                    await tagsCollection.updateOne(
                        { name: tag },
                        { $set: { name: tag, language }, $addToSet: { chatIds: chatId } },
                        { upsert: true }
                    );
                    console.log(`  - Tag "${tag}" updated`);
                } catch (tagError) {
                    console.error(`  - ❌ Error updating tag "${tag}":`, tagError.message);
                }
            }

            fastify.sendNotificationToUser(userId, 'updateChatData', {
                chatData
            });

            // Update chat document with slug and tags
            console.log('[API/generate-character-comprehensive] Executing second database update with slug and tags...');
            const secondUpdate = await collectionChats.updateOne(
                { _id: new fastify.mongo.ObjectId(chatId) },
                { $set: chatData }
            );

            if (secondUpdate.matchedCount === 0) {
                console.error(`[API/generate-character-comprehensive] ❌ Chat not found for ID: ${chatId}`);
                throw new Error('Chat not found.');
            }

            console.log(`[API/generate-character-comprehensive] ✓ Second update successful: ${secondUpdate.modifiedCount} document(s) modified`);

            // Fetch final document from database
            console.log('[API/generate-character-comprehensive] Fetching final document from database...');
            const finalChatDocument = await collectionChats.findOne({
                _id: new fastify.mongo.ObjectId(chatId)
            });

            if (!finalChatDocument) {
                console.error(`[API/generate-character-comprehensive] ❌ Could not retrieve final document from database`);
                throw new Error('Failed to retrieve final chat document from database');
            }

            // Validate final document
            console.log('[API/generate-character-comprehensive] Validating final document:');
            console.log(`  - _id: ${finalChatDocument._id ? '✓' : '✗'}`);
            console.log(`  - name: ${finalChatDocument.name ? '✓' : '✗'} (${finalChatDocument.name || 'N/A'})`);
            console.log(`  - system_prompt: ${finalChatDocument.system_prompt ? '✓' : '✗'} (${finalChatDocument.system_prompt?.length || 0} chars)`);
            console.log(`  - details_description: ${finalChatDocument.details_description ? '✓' : '✗'}`);
            console.log(`  - personality: ${finalChatDocument.details_description?.personality ? '✓' : '✗'}`);
            console.log(`  - reference_character: ${finalChatDocument.details_description?.personality?.reference_character ? '✓' : '✗'}`);
            console.log(`  - slug: ${finalChatDocument.slug ? '✓' : '✗'} (${finalChatDocument.slug || 'N/A'})`);
            console.log(`  - tags: ${Array.isArray(finalChatDocument.tags) ? '✓' : '✗'} (${finalChatDocument.tags?.length || 0} tags)`);
            console.log(`  - enhancedPrompt: ${finalChatDocument.enhancedPrompt ? '✓' : '✗'}`);
            console.log(`  - gender: ${finalChatDocument.gender ? '✓' : '✗'} (${finalChatDocument.gender || 'N/A'})`);

            const totalTime = Date.now() - startTime;
            console.log(`[API/generate-character-comprehensive] ✅ Process completed successfully in ${totalTime}ms`);
            
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.character_generation_complete || 'Character generation completed successfully!', 
                icon: 'success' 
            });

            console.log('[API/generate-character-comprehensive] 📤 Sending final response to client');
            return reply.send({
                success: true,
                chatId,
                chatData: finalChatDocument,
                enhancedPrompt,
                imageGenerationTriggered: true
            });

        } catch (err) {
            const totalTime = Date.now() - startTime;
            console.error(`[API/generate-character-comprehensive] ❌ ERROR after ${totalTime}ms`);
            console.error(`[API/generate-character-comprehensive] Error type: ${err.constructor.name}`);
            console.error(`[API/generate-character-comprehensive] Error message: ${err.message}`);
            console.error(`[API/generate-character-comprehensive] Stack trace:`);
            console.error(err.stack);
            
            if (err.cause) {
                console.error(`[API/generate-character-comprehensive] Cause:`, err.cause);
            }
            
            fastify.sendNotificationToUser(request.user._id, 'showNotification', { 
                message: request.translations.newCharacter.character_generation_error, 
                icon: 'error' 
            });

            if (err instanceof z.ZodError) {
                console.error('[API/generate-character-comprehensive] Validation errors:');
                err.errors.forEach((error, index) => {
                    console.error(`  ${index + 1}. Path: ${error.path.join('.')} - ${error.message}`);
                });
                return reply.status(400).send({ error: 'Validation error in response data.', details: err.errors });
            }

            console.error(`[API/generate-character-comprehensive] Sending 500 error to client`);
            reply.status(500).send({ error: 'An unexpected error occurred.', details: err.message });
        }
    });
}
module.exports = routes;
