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
    
    const criticalSfwInstruction = imageType === 'sfw' ? 
    `CRITICAL SFW REQUIREMENTS:
    - NO nudity, NO exposed skin beyond neck/shoulders/arms
    - Character MUST be fully clothed and modestly dressed
    - NO exposed breasts, NO nudity
    - NO sexual or suggestive content whatsoever
    - The prompt must be strictly SFW (safe for work), no explicit or NSFW content`:
    `CRITICAL NSFW REQUIREMENTS:
    - Nudity is allowed as per NSFW guidelines
    - Ensure the character's appearance aligns with NSFW themes appropriately
    - Use explicit descriptive keywords suitable for NSFW content`;

    return [
        {
            role: 'system',
            content: `You are an expert Stable Diffusion prompt engineer specializing in SFW character portraits.
            Generate a detailed, keyword-based image prompt (under 1000 characters) for character visualization.

            ${criticalSfwInstruction}
            - The image MUST be ONLY a upper body portrait
            - Use comma-separated descriptive keywords in English
            - Include facial features, emotion, hairstyle, and appropriate clothing
            - Optimize for high-quality, detailed character face generation
            - Maintain consistency with provided character details
            - NO complete sentences, only relevant keywords
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
            CRITICAL: Only generate an upper body portrait.No full body or background.
            
            REMEMBER: Output ONLY the keywords, no introduction or explanation.`.replace(/^\s+/gm, '').replace(/\s+/g, ' ').trim(),
        },
        {
            role: 'user',
            content: `FINAL REQUIREMENTS:
            - Output ONLY comma-separated keywords - NO other text
            - Ensure the prompt is under 1000 characters
            - Formatted for Stable Diffusion with comma-separated keywords only
            - Only an upper body portrait
            - No background or full body
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
        console.log('\x1b[36m🚀 ===== CHARACTER CREATION START =====\x1b[0m');
        
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
                nsfw = false, // Add this parameter
                // Model selection data
                modelId = null,
                imageStyle = null,
                imageModel = null,
                imageVersion = null,
                isUserModel = false
            } = request.body;
            let gender = request.body.gender || null;
            let chatId = request.body.chatId || request.query.chatId || request.params.chatId || null;
            
            const userId = request.body.userId || request.user._id;
            const language = requestLanguage || request.lang;
            
            // ==========================================
            // DETAILED INPUT LOGGING
            // ==========================================
            console.log('\x1b[36m📦 ===== REQUEST BODY RECEIVED =====\x1b[0m');
            console.log('\x1b[33m📝 Character Data:\x1b[0m');
            console.log(`   - prompt: ${prompt ? prompt.substring(0, 100) + '...' : 'MISSING'}`);
            console.log(`   - name: ${name || 'not provided'}`);
            console.log(`   - gender: ${gender || 'not provided'}`);
            console.log(`   - chatPurpose: ${chatPurpose ? chatPurpose.substring(0, 50) + '...' : 'not provided'}`);
            console.log(`   - language: ${requestLanguage || 'default'}`);
            console.log('\x1b[33m🖼️ Model Data:\x1b[0m');
            console.log(`   - modelId: ${modelId || 'NOT PROVIDED - will use default'}`);
            console.log(`   - imageStyle: ${imageStyle || 'NOT PROVIDED'}`);
            console.log(`   - imageModel: ${imageModel || 'NOT PROVIDED'}`);
            console.log(`   - imageVersion: ${imageVersion || 'NOT PROVIDED'}`);
            console.log(`   - isUserModel: ${isUserModel}`);
            console.log('\x1b[33m⚙️ Options:\x1b[0m');
            console.log(`   - imageType: ${imageType || 'sfw'}`);
            console.log(`   - nsfw: ${nsfw}`);
            console.log(`   - enableEnhancedPrompt: ${enableEnhancedPrompt}`);
            console.log(`   - enableMergeFace: ${enableMergeFace || false}`);
            console.log(`   - chatId: ${chatId || 'new chat'}`);
            console.log('\x1b[36m====================================\x1b[0m');
            
            // Check user subscription for NSFW content
            const user = await fastify.mongo.db.collection('users').findOne({ 
                _id: new ObjectId(userId) 
            });
            const isPremium = user?.subscriptionStatus === 'active';
            
            // Enforce NSFW restrictions for non-premium users
            const allowNsfw = isPremium && nsfw;
            const finalImageType = allowNsfw ? imageType : 'sfw';
            
            console.log(`\x1b[33m⚙️ NSFW: premium=${isPremium}, requested=${nsfw}, allowed=${allowNsfw}\x1b[0m`);
            console.log(`\x1b[34m📝 Input: chatId=${chatId || 'new'}, gender=${gender || 'auto'}, lang=${language}, prompt=${prompt ? prompt.substring(0, 30) + '...' : 'none'}\x1b[0m`);

            if (!prompt || prompt.trim() === '') {
                fastify.sendNotificationToUser(userId, 'showNotification', { message: 'Please provide a valid prompt.', icon: 'error' });
                console.log('\x1b[31m❌ Missing prompt\x1b[0m');
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
                console.log(`\x1b[32m🆕 New chatId: ${chatId}\x1b[0m`);
            }
            // Step 1: Extract details from prompt
            console.log('\x1b[34m📋 Step 1: Extracting Details\x1b[0m');

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
                console.log('\x1b[32m✅ Details extracted\x1b[0m');
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.character_analysis_complete, 
                    icon: 'success' 
                });
            } catch (parseError) {
                console.error('\x1b[31m❌ Details extraction failed\x1b[0m');
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.character_analysis_error, 
                    icon: 'error' 
                });
            }

            // Step 2: Generate enhanced prompt
            let enhancedPrompt = prompt || null;

            if(enableEnhancedPrompt) {
                console.log(`\x1b[34m🎨 Step 2: Generating ${finalImageType} prompt\x1b[0m`);

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
                
                // Enforce Novita API limit: max 1024 characters
                const MAX_PROMPT_LENGTH = 1024;
                if (enhancedPrompt.length > MAX_PROMPT_LENGTH) {
                    // Truncate to max length, trying to cut at a comma to avoid breaking words
                    let truncatedPrompt = enhancedPrompt.substring(0, MAX_PROMPT_LENGTH);
                    const lastCommaIndex = truncatedPrompt.lastIndexOf(',');
                    if (lastCommaIndex > MAX_PROMPT_LENGTH - 100) {
                        // If comma is close to end, truncate at comma
                        truncatedPrompt = truncatedPrompt.substring(0, lastCommaIndex).trim();
                    }
                    console.log(`\x1b[33m⚠️ Prompt truncated: ${enhancedPrompt.length} → ${truncatedPrompt.length} chars\x1b[0m`);
                    enhancedPrompt = truncatedPrompt;
                }
                
                console.log(`\x1b[32m✅ Prompt ready: ${enhancedPrompt.length} chars\x1b[0m`);
                
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.enhancedPrompt_complete, 
                    icon: 'success' 
                });
                
                fastify.sendNotificationToUser(userId, 'updateEnhancedPrompt', {
                    enhancedPrompt
                });
            } else {
                console.log('\x1b[33m⏭️ Skipping prompt enhancement\x1b[0m');
                fastify.sendNotificationToUser(userId, 'showNotification', {
                    message: request.translations.newCharacter.enhancedPrompt_skipped,
                    icon: 'info'
                });
            }

            // Step 2.5: Trigger image generation immediately after enhanced prompt is available
            console.log('\x1b[34m🖼️ Step 2.5: Triggering Image Gen\x1b[0m');

            try {
                // First, save gender AND model info to chat BEFORE generating images
                const chatUpdateData = { gender: gender };
                
                // Add model data if provided
                if (modelId) {
                    chatUpdateData.modelId = modelId;
                    chatUpdateData.imageStyle = imageStyle || 'general';
                    chatUpdateData.imageModel = imageModel;
                    chatUpdateData.imageVersion = imageVersion || 'sdxl';
                    console.log(`\x1b[32m✓ Model data to save: modelId=${modelId}, style=${imageStyle}, model=${imageModel}, version=${imageVersion}\x1b[0m`);
                } else {
                    console.log(`\x1b[33m⚠️ No modelId provided - using default model\x1b[0m`);
                }
                
                await fastify.mongo.db.collection('chats').updateOne(
                    { _id: new ObjectId(chatId) },
                    { $set: chatUpdateData }
                );
                console.log(`\x1b[32m✓ Chat updated with gender and model info\x1b[0m`);

                const { generateImg } = require('../models/imagen');
                
                // Generate placeholder ID for tracking
                const placeholderId = new fastify.mongo.ObjectId().toString();

                console.log('\x1b[36m🖼️ ===== IMAGE GENERATION PARAMS =====\x1b[0m');
                console.log(`   - prompt: ${enhancedPrompt ? enhancedPrompt.substring(0, 80) + '...' : 'MISSING'}`);
                console.log(`   - modelId: ${modelId || 'DEFAULT (not provided)'}`);
                console.log(`   - chatId: ${chatId}`);
                console.log(`   - userId: ${userId}`);
                console.log(`   - imageType: sfw`);
                console.log(`   - image_num: 4`);
                console.log(`   - chatCreation: true`);
                console.log('\x1b[36m=====================================\x1b[0m');
                
                    generateImg({
                        prompt: enhancedPrompt,
                        negativePrompt: negativePrompt || null,
                        modelId: modelId || null, // Pass modelId to generateImg
                        userId: userId,
                        chatId: chatId,
                        userChatId: null,
                        image_num: 4,
                        imageType: 'sfw',
                        image_base64: image_base64 || null,
                        chatCreation: true,
                        placeholderId: placeholderId,
                        translations: request.translations,
                        fastify: fastify,
                        enableMergeFace: enableMergeFace || false
                    }).then(() => {
                        console.log('\x1b[32m✅ Image gen done\x1b[0m');
                    }).catch(error => {
                        console.error('\x1b[31m❌ Image gen failed\x1b[0m');
                        fastify.sendNotificationToUser(userId, 'showNotification', { 
                            message: request.translations.newCharacter.image_generation_error || 'Image generation failed', 
                            icon: 'error' 
                        });
                    });
                
                console.log('\x1b[32m✓ Image gen queued\x1b[0m');
                
            } catch (imageError) {
                console.error('\x1b[31m⚠️ Image queue failed\x1b[0m');
                // Don't throw - image generation is not critical for chat to start
                fastify.sendNotificationToUser(userId, 'showNotification', { 
                    message: request.translations.newCharacter.image_generation_error || 'Image generation failed', 
                    icon: 'error' 
                });
            }

            // Step 3: Generate character personality
            console.log('\x1b[34m👤 Step 3: Generating Personality\x1b[0m');
            const finalPurpose = chatPurpose && chatPurpose.trim() !== '' ? chatPurpose : prompt;
            const systemPayloadChat = createSystemPayloadChatRule(finalPurpose, gender, name, extractedDetails, language);
            const personalityResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: systemPayloadChat,
                response_format: zodResponseFormat(characterSchema, "character_data"),
            });

            let chatData = JSON.parse(personalityResponse.choices[0].message.content);
            // show personnality data in console for debugging
            console.log('\x1b[34m👤 Generated Personality Data:\x1b[0m');
            console.log(chatData);
            console.log('\x1b[32m✅ Personality generated\x1b[0m');

            // Step 4: Save to database
            console.log('\x1b[34m💾 Step 4: Saving to DB\x1b[0m');

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
            
            const collectionChats = fastify.mongo.db.collection('chats');
            
            // Convert chatId to ObjectId once and reuse
            const chatObjectId = new ObjectId(chatId);
            
            // Update chat document
            const firstUpdate = await collectionChats.updateOne(
                { _id: chatObjectId },
                { $set: chatData }
            );

            if (firstUpdate.matchedCount === 0) {
                console.error('\x1b[31m❌ DB update failed\x1b[0m');
                throw new Error('Chat not found.');
            }

            console.log('\x1b[32m✅ DB saved\x1b[0m');

            // Step 5: Generate unique slug if name is provided
            if (chatData.name) {
                const baseSlug = slugify(chatData.name, { lower: true, strict: true });
                let slug = baseSlug;
                
                const slugExists = await collectionChats.findOne({ 
                    slug: baseSlug, 
                    _id: { $ne: chatObjectId } 
                });
                
                if (slugExists) {
                    const randomStr = Math.random().toString(36).substring(2, 6);
                    slug = `${baseSlug}-${randomStr}`;
                }
                
                chatData.slug = slug;
            }

            // Step 6: Update tags in the database
            const tagsCollection = fastify.mongo.db.collection('tags');
            const generatedTags = chatData.tags;
            
            for (const tag of (generatedTags || [])) {
                try {
                    await tagsCollection.updateOne(
                        { name: tag },
                        { $set: { name: tag, language }, $addToSet: { chatIds: chatObjectId.toString() } },
                        { upsert: true }
                    );
                } catch (tagError) {
                    console.error(`[API/generate-character-comprehensive] Error updating tag "${tag}": ${tagError.message}`);
                }
            }

            fastify.sendNotificationToUser(userId, 'updateChatData', {
                chatData
            });

            // Update chat document with slug and tags
            const secondUpdate = await collectionChats.updateOne(
                { _id: chatObjectId },
                { $set: chatData }
            );

            if (secondUpdate.matchedCount === 0) {
                console.error('\x1b[31m❌ DB final update failed\x1b[0m');
                throw new Error(`Second database update failed - chat document may have been deleted`);
            }

            // Fetch final document from database
            const finalChatDocument = await collectionChats.findOne({
                _id: chatObjectId
            });

            if (!finalChatDocument) {
                console.error('\x1b[31m❌ DB retrieval failed\x1b[0m');
                throw new Error('Failed to retrieve final chat document from database');
            }

            if (!finalChatDocument.system_prompt || !finalChatDocument.details_description?.personality?.reference_character) {
                console.error('\x1b[31m❌ Critical fields missing\x1b[0m');
                throw new Error('Final document missing required fields');
            }

            const totalTime = Date.now() - startTime;
            console.log(`\x1b[32m✅ ===== CHARACTER CREATION COMPLETE ===== (${totalTime}ms)\x1b[0m`);
            
            fastify.sendNotificationToUser(userId, 'showNotification', { 
                message: request.translations.newCharacter.character_generation_complete || 'Character generation completed successfully!', 
                icon: 'success' 
            });

            return reply.send({
                success: true,
                chatId,
                chatData: finalChatDocument,
                enhancedPrompt,
                imageGenerationTriggered: true
            });

        } catch (err) {
            const totalTime = Date.now() - startTime;
            console.log(`\x1b[31m❌ ===== CHARACTER CREATION ERROR ===== (${totalTime}ms)\x1b[0m`);
            console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
            
            if (err.cause) {
                console.error(`[API/generate-character-comprehensive] Cause:`, err.cause);
            }
            
            fastify.sendNotificationToUser(request.user._id, 'showNotification', { 
                message: request.translations.newCharacter.character_generation_error, 
                icon: 'error' 
            });

            if (err instanceof z.ZodError) {
                console.error('\x1b[31m❌ Validation error\x1b[0m');
                return reply.status(400).send({ error: 'Validation error in response data.', details: err.errors });
            }

            console.error('\x1b[31mSending 500 error\x1b[0m');
            reply.status(500).send({ error: 'An unexpected error occurred.', details: err.message });
        }
    });
}
module.exports = routes;
