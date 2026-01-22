/**
 * Dashboard Integration API
 * Connects Image Dashboard, Video Dashboard, and Character Creation
 * 
 * Features:
 * - Create character from generated image
 * - Add video to existing character
 * - Add images/videos to character gallery
 * - External API for character creation and gallery management
 */

const { ObjectId } = require('mongodb');
const { generateCompletion } = require('../models/openai');
const { generateUniqueSlug } = require('../models/slug-utils');
const { uploadTestImageToS3 } = require('../models/admin-image-test-utils');
const OpenAI = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");
const crypto = require('crypto');

/**
 * Hash an API key for comparison
 */
function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key and return userId if valid
 */
async function validateApiKey(db, apiKey) {
    if (!apiKey) return null;
    
    const keyHash = hashApiKey(apiKey);
    const apiKeysCollection = db.collection('apiKeys');
    
    const keyDoc = await apiKeysCollection.findOne({
        key: keyHash,
        active: true
    });

    if (keyDoc) {
        // Update usage stats
        await apiKeysCollection.updateOne(
            { _id: keyDoc._id },
            {
                $set: { lastUsedAt: new Date() },
                $inc: { usageCount: 1 }
            }
        );

        return keyDoc.userId;
    }

    return null;
}

// Schema for character generation from image prompt
const characterFromImageSchema = z.object({
    name: z.string(),
    short_intro: z.string(),
    system_prompt: z.string(),
    tags: z.array(z.string()),
    first_message: z.string(),
});

const detailsFromImageSchema = z.object({
    appearance: z.object({
        age: z.string(),
        gender: z.enum(['male', 'female']),
        ethnicity: z.string(),
        height: z.string(),
        weight: z.string(),
        bodyType: z.enum(['slim', 'athletic', 'average', 'curvy', 'muscular', 'heavy']),
    }),
    face: z.object({
        faceShape: z.enum(['oval', 'round', 'square', 'heart', 'long', 'diamond']),
        skinColor: z.string(),
        eyeColor: z.string(),
        eyeShape: z.enum(['almond', 'round', 'hooded', 'monolid', 'upturned', 'downturned']),
        eyeSize: z.enum(['small', 'medium', 'large']),
        facialFeatures: z.string(),
    }),
    hair: z.object({
        hairColor: z.string(),
        hairLength: z.enum(['very short', 'short', 'medium', 'long', 'very long']),
        hairStyle: z.string(),
        hairTexture: z.enum(['straight', 'wavy', 'curly', 'coily']),
    }),
    body: z.object({
        breastSize: z.enum(['small', 'medium', 'large', 'very large']),
        assSize: z.enum(['small', 'medium', 'large', 'very large']),
        bodyCurves: z.enum(['minimal', 'subtle', 'pronounced', 'very pronounced']),
        chestBuild: z.enum(['slim', 'average', 'muscular', 'broad']),
        shoulderWidth: z.enum(['narrow', 'average', 'broad', 'very broad']),
        absDefinition: z.enum(['none', 'slight', 'defined', 'very defined']),
        armMuscles: z.enum(['slim', 'toned', 'muscular', 'very muscular']),
    }),
    style: z.object({
        clothingStyle: z.string(),
        accessories: z.string(),
        tattoos: z.string(),
        piercings: z.string(),
        scars: z.string(),
    }),
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

/**
 * Generate character details from image prompt
 */
async function generateCharacterFromImagePrompt(imagePrompt, personalityInput, language = 'english') {
    const openai = new OpenAI();
    
    // First, extract details from the image prompt
    const detailsPayload = [
        {
            role: "system",
            content: `You are an expert character creator. Analyze the image prompt and user personality input to create a detailed character profile.
            Extract physical appearance details from the image prompt and combine with the personality traits provided.
            
            IMPORTANT: Create a character that is consistent with the visual description in the image prompt.
            Respond with a properly formatted JSON object matching the schema.`
        },
        {
            role: "user",
            content: `Image Prompt (visual description): ${imagePrompt}
            
            User Personality Input: ${personalityInput || 'Create an interesting and engaging personality'}
            
            Extract and structure all details to create a complete character profile.`
        }
    ];

    const detailsResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: detailsPayload,
        response_format: zodResponseFormat(detailsFromImageSchema, "character_details"),
    });

    const extractedDetails = JSON.parse(detailsResponse.choices[0].message.content);
    const gender = extractedDetails.appearance.gender;

    // Generate character personality data
    const characterPayload = [
        {
            role: "system",
            content: `You are a helpful assistant creating detailed character descriptions in ${language}.
            
            Character Requirements:
            - name: Provide an authentic name that matches the character's gender and background
            - short_intro: A compelling 1 sentence that captures the essence of the character
            - system_prompt: Start with "I want you to act as..." and define their specific role/archetype
            - first_message: Demonstrate their unique speech pattern and personality
            - tags: 5 relevant tags for character discovery
            
            Ensure consistency between physical description and personality traits.
            Respond entirely in ${language}.`
        },
        {
            role: "user",
            content: `Character Details:
            Gender: ${gender}
            Visual Appearance: ${imagePrompt}
            Personality: ${extractedDetails.personality.personality}
            Background: ${extractedDetails.personality.background}
            Occupation: ${extractedDetails.personality.occupation}
            
            Create a character profile that maintains consistency across all attributes.`
        }
    ];

    const characterResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: characterPayload,
        response_format: zodResponseFormat(characterFromImageSchema, "character_data"),
    });

    const characterData = JSON.parse(characterResponse.choices[0].message.content);

    return {
        characterData,
        extractedDetails,
        gender
    };
}

async function routes(fastify, options) {
    const db = fastify.mongo.db;

    /**
     * POST /api/dashboard/create-character-from-image
     * Create a new character from a generated image
     */
    fastify.post('/api/dashboard/create-character-from-image', async (request, reply) => {
        console.log('[DashboardIntegration] ===== CREATE CHARACTER FROM IMAGE =====');
        
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const {
                imageUrl,
                imagePrompt,
                personalityInput,
                name: providedName,
                language: requestLanguage,
                nsfw = false,
                useImageAsBaseFace = false,
                // Model information for consistent image generation in chat
                modelId = null,
                modelName = null,
                imageModel = null,
                imageVersion = 'sdxl',
                imageStyle = 'general'
            } = request.body;

            const language = requestLanguage || request.lang || 'english';
            const userId = user._id;

            if (!imageUrl || !imagePrompt) {
                return reply.status(400).send({ error: 'Image URL and prompt are required' });
            }

            // If imageUrl is a base64 data URL, upload to S3 first
            let finalImageUrl = imageUrl;
            if (imageUrl.startsWith('data:')) {
                console.log(`[DashboardIntegration] Base64 image detected, uploading to S3...`);
                try {
                    finalImageUrl = await uploadTestImageToS3(imageUrl, 'character');
                    console.log(`[DashboardIntegration] Image uploaded to S3: ${finalImageUrl.substring(0, 80)}...`);
                } catch (uploadError) {
                    console.error(`[DashboardIntegration] Failed to upload image to S3:`, uploadError);
                    return reply.status(500).send({ error: 'Failed to upload image. Please try again.' });
                }
            }

            console.log(`[DashboardIntegration] Creating character from image for user ${userId}`);
            console.log(`[DashboardIntegration] Image prompt: ${imagePrompt.substring(0, 100)}...`);
            console.log(`[DashboardIntegration] Use image as base face: ${useImageAsBaseFace}`);
            console.log(`[DashboardIntegration] Model info: modelId=${modelId}, imageModel=${imageModel}, imageVersion=${imageVersion}, imageStyle=${imageStyle}`);

            // Generate character data from image prompt
            const { characterData, extractedDetails, gender } = await generateCharacterFromImagePrompt(
                imagePrompt,
                personalityInput,
                language
            );

            // Use provided name or generated name
            characterData.name = providedName && providedName.trim() !== '' 
                ? providedName 
                : characterData.name;

            // Create new chat document
            const collectionChats = db.collection('chats');
            const now = new Date();

            const chatDocument = {
                ...characterData,
                userId: new ObjectId(userId),
                language,
                gender,
                characterPrompt: imagePrompt,
                imageDescription: imagePrompt,
                enhancedPrompt: imagePrompt,
                details_description: extractedDetails,
                chatImageUrl: imageUrl,
                thumbnail: imageUrl,
                thumbnailUrl: imageUrl,
                nsfw: nsfw,
                thumbIsPortrait: true,
                createdAt: now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
                updatedAt: now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
                createdFromImageDashboard: true,
                // Save model information for consistent image generation in chat
                ...(imageModel && { imageModel: imageModel }),
                ...(modelId && { modelId: modelId }),
                imageStyle: imageStyle || 'general',
                imageVersion: imageVersion || 'sdxl'
            };
            
            // If useImageAsBaseFace is true, set the image as baseFaceUrl for auto-merge
            if (useImageAsBaseFace) {
                chatDocument.baseFaceUrl = finalImageUrl;
                console.log(`[DashboardIntegration] Setting baseFaceUrl for auto-merge: ${finalImageUrl.substring(0, 50)}...`);
            }

            const insertResult = await collectionChats.insertOne(chatDocument);
            const chatId = insertResult.insertedId;

            // Generate unique slug
            try {
                const slug = await generateUniqueSlug(
                    characterData.name,
                    chatId,
                    db,
                    'chats'
                );
                await collectionChats.updateOne(
                    { _id: chatId },
                    { $set: { slug } }
                );
                chatDocument.slug = slug;
            } catch (slugError) {
                console.error('[DashboardIntegration] Error generating slug:', slugError);
            }

            // Add image to gallery
            const galleryCollection = db.collection('gallery');
            const imageDoc = {
                _id: new ObjectId(),
                imageUrl: finalImageUrl,
                prompt: imagePrompt,
                nsfw: nsfw,
                createdAt: now,
                likes: 0,
                likedBy: [],
                isCharacterImage: true
            };

            await galleryCollection.updateOne(
                { chatId: chatId },
                {
                    $setOnInsert: { chatId: chatId, chatSlug: chatDocument.slug },
                    $push: { images: imageDoc }
                },
                { upsert: true }
            );

            // Update tags collection
            const tagsCollection = db.collection('tags');
            for (const tag of (characterData.tags || [])) {
                try {
                    await tagsCollection.updateOne(
                        { name: tag },
                        { $set: { name: tag, language }, $addToSet: { chatIds: chatId.toString() } },
                        { upsert: true }
                    );
                } catch (tagError) {
                    console.error(`[DashboardIntegration] Error updating tag "${tag}":`, tagError);
                }
            }

            console.log(`[DashboardIntegration] Character created successfully: ${chatId}`);

            return reply.send({
                success: true,
                chatId: chatId.toString(),
                slug: chatDocument.slug,
                characterData: {
                    ...chatDocument,
                    _id: chatId
                },
                message: 'Character created successfully'
            });

        } catch (error) {
            console.error('[DashboardIntegration] Error creating character:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/dashboard/add-video-to-character
     * Add a generated video to an existing character
     */
    fastify.post('/api/dashboard/add-video-to-character', async (request, reply) => {
        console.log('[DashboardIntegration] ===== ADD VIDEO TO CHARACTER =====');
        
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const {
                chatId,
                videoUrl,
                prompt,
                duration,
                aspectRatio,
                modelName
            } = request.body;

            if (!chatId || !videoUrl) {
                return reply.status(400).send({ error: 'Chat ID and video URL are required' });
            }

            const userId = user._id;
            const chatObjectId = new ObjectId(chatId);

            // Verify character exists
            const collectionChats = db.collection('chats');
            const chat = await collectionChats.findOne({ _id: chatObjectId });
            
            if (!chat) {
                return reply.status(404).send({ error: 'Character not found' });
            }

            console.log(`[DashboardIntegration] Adding video to character ${chatId} for user ${userId}`);

            // Add video to videos collection
            const videosCollection = db.collection('videos');
            const now = new Date();

            const videoDocument = {
                chatId: chatObjectId,
                userId: new ObjectId(userId),
                videoUrl: videoUrl,
                prompt: prompt || '',
                duration: duration || '5',
                aspectRatio: aspectRatio || '16:9',
                modelName: modelName || 'unknown',
                createdAt: now,
                addedFromDashboard: true
            };

            const insertResult = await videosCollection.insertOne(videoDocument);

            console.log(`[DashboardIntegration] Video added successfully: ${insertResult.insertedId}`);

            return reply.send({
                success: true,
                videoId: insertResult.insertedId.toString(),
                message: 'Video added to character successfully'
            });

        } catch (error) {
            console.error('[DashboardIntegration] Error adding video:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/dashboard/add-image-to-gallery
     * Add an image to a character's gallery
     */
    fastify.post('/api/dashboard/add-image-to-gallery', async (request, reply) => {
        console.log('[DashboardIntegration] ===== ADD IMAGE TO GALLERY =====');
        
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const {
                chatId,
                imageUrl,
                prompt,
                nsfw = false,
                title
            } = request.body;

            if (!chatId || !imageUrl) {
                return reply.status(400).send({ error: 'Chat ID and image URL are required' });
            }

            const chatObjectId = new ObjectId(chatId);

            // Verify character exists
            const collectionChats = db.collection('chats');
            const chat = await collectionChats.findOne({ _id: chatObjectId });
            
            if (!chat) {
                return reply.status(404).send({ error: 'Character not found' });
            }

            console.log(`[DashboardIntegration] Adding image to gallery for character ${chatId}`);

            const galleryCollection = db.collection('gallery');
            const now = new Date();

            const imageDoc = {
                _id: new ObjectId(),
                imageUrl: imageUrl,
                prompt: prompt || '',
                title: title || null,
                nsfw: nsfw,
                createdAt: now,
                likes: 0,
                likedBy: [],
                addedFromDashboard: true,
                addedBy: new ObjectId(user._id)
            };

            await galleryCollection.updateOne(
                { chatId: chatObjectId },
                {
                    $setOnInsert: { chatId: chatObjectId, chatSlug: chat.slug },
                    $push: { images: imageDoc }
                },
                { upsert: true }
            );

            console.log(`[DashboardIntegration] Image added to gallery: ${imageDoc._id}`);

            return reply.send({
                success: true,
                imageId: imageDoc._id.toString(),
                message: 'Image added to gallery successfully'
            });

        } catch (error) {
            console.error('[DashboardIntegration] Error adding image to gallery:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /api/dashboard/search-characters
     * Search for characters to add videos/images to
     */
    fastify.get('/api/dashboard/search-characters', async (request, reply) => {
        try {
            const user = request.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            const { query, limit = 20 } = request.query;
            const userId = user._id;

            const collectionChats = db.collection('chats');
            
            // Build search query
            let searchQuery = {
                $or: [
                    { userId: new ObjectId(userId) }, // User's own characters
                    { isPublic: true } // Public characters
                ]
            };

            if (query && query.trim() !== '') {
                searchQuery.$and = [
                    {
                        $or: [
                            { name: { $regex: query, $options: 'i' } },
                            { tags: { $regex: query, $options: 'i' } },
                            { short_intro: { $regex: query, $options: 'i' } }
                        ]
                    }
                ];
            }

            const characters = await collectionChats.find(searchQuery)
                .project({
                    _id: 1,
                    name: 1,
                    short_intro: 1,
                    chatImageUrl: 1,
                    thumbnail: 1,
                    thumbnailUrl: 1,
                    slug: 1,
                    tags: 1,
                    gender: 1
                })
                .limit(parseInt(limit))
                .sort({ updatedAt: -1 })
                .toArray();

            return reply.send({
                success: true,
                characters: characters.map(c => ({
                    ...c,
                    thumbnail: c.chatImageUrl || c.thumbnail || c.thumbnailUrl || '/img/default-thumbnail.png'
                }))
            });

        } catch (error) {
            console.error('[DashboardIntegration] Error searching characters:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    // ==========================================
    // EXTERNAL API ROUTES
    // ==========================================

    /**
     * POST /api/external/create-character
     * External API to create a character with image and personality data
     * 
     * Required: API key in header (X-API-Key)
     * Body: {
     *   imageUrl: string (required),
     *   imagePrompt: string (required),
     *   name: string (optional),
     *   personalityInput: string (optional),
     *   language: string (optional, default: 'english'),
     *   nsfw: boolean (optional, default: false)
     * }
     */
    fastify.post('/api/external/create-character', async (request, reply) => {
        console.log('[ExternalAPI] ===== CREATE CHARACTER =====');
        
        try {
            // Verify API key or user authentication
            const user = request.user;
            const apiKey = request.headers['x-api-key'];

            if (!user && !apiKey) {
                return reply.status(401).send({ error: 'Unauthorized. Provide authentication or API key.' });
            }

            // If API key is provided, validate it (with hash)
            let userId;
            if (apiKey) {
                userId = await validateApiKey(db, apiKey);
                if (!userId) {
                    return reply.status(401).send({ error: 'Invalid API key' });
                }
            } else {
                userId = user._id;
            }

            const {
                imageUrl,
                imagePrompt,
                personalityInput,
                name: providedName,
                language = 'english',
                nsfw = false,
                // Model information for consistent image generation in chat
                modelId = null,
                imageModel = null,
                imageVersion = 'sdxl',
                imageStyle = 'general'
            } = request.body;

            if (!imageUrl || !imagePrompt) {
                return reply.status(400).send({ 
                    error: 'Missing required fields',
                    required: ['imageUrl', 'imagePrompt']
                });
            }

            console.log(`[ExternalAPI] Creating character for user ${userId}`);
            console.log(`[ExternalAPI] Model info: modelId=${modelId}, imageModel=${imageModel}, imageVersion=${imageVersion}, imageStyle=${imageStyle}`);

            // Generate character data
            const { characterData, extractedDetails, gender } = await generateCharacterFromImagePrompt(
                imagePrompt,
                personalityInput,
                language
            );

            characterData.name = providedName && providedName.trim() !== '' 
                ? providedName 
                : characterData.name;

            // Create chat document
            const collectionChats = db.collection('chats');
            const now = new Date();

            const chatDocument = {
                ...characterData,
                userId: new ObjectId(userId),
                language,
                gender,
                characterPrompt: imagePrompt,
                imageDescription: imagePrompt,
                enhancedPrompt: imagePrompt,
                details_description: extractedDetails,
                chatImageUrl: imageUrl,
                thumbnail: imageUrl,
                thumbnailUrl: imageUrl,
                nsfw: nsfw,
                thumbIsPortrait: true,
                createdAt: now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
                updatedAt: now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }),
                createdFromExternalAPI: true,
                // Save model information for consistent image generation in chat
                ...(imageModel && { imageModel: imageModel }),
                ...(modelId && { modelId: modelId }),
                imageStyle: imageStyle || 'general',
                imageVersion: imageVersion || 'sdxl'
            };

            const insertResult = await collectionChats.insertOne(chatDocument);
            const chatId = insertResult.insertedId;

            // Generate slug
            try {
                const slug = await generateUniqueSlug(characterData.name, chatId, db, 'chats');
                await collectionChats.updateOne({ _id: chatId }, { $set: { slug } });
                chatDocument.slug = slug;
            } catch (slugError) {
                console.error('[ExternalAPI] Error generating slug:', slugError);
            }

            // Add image to gallery
            const galleryCollection = db.collection('gallery');
            await galleryCollection.updateOne(
                { chatId: chatId },
                {
                    $setOnInsert: { chatId: chatId, chatSlug: chatDocument.slug },
                    $push: {
                        images: {
                            _id: new ObjectId(),
                            imageUrl: imageUrl,
                            prompt: imagePrompt,
                            nsfw: nsfw,
                            createdAt: now,
                            likes: 0,
                            likedBy: [],
                            isCharacterImage: true
                        }
                    }
                },
                { upsert: true }
            );

            // Update tags
            const tagsCollection = db.collection('tags');
            for (const tag of (characterData.tags || [])) {
                await tagsCollection.updateOne(
                    { name: tag },
                    { $set: { name: tag, language }, $addToSet: { chatIds: chatId.toString() } },
                    { upsert: true }
                ).catch(() => {});
            }

            console.log(`[ExternalAPI] Character created: ${chatId}`);

            return reply.send({
                success: true,
                chatId: chatId.toString(),
                slug: chatDocument.slug,
                character: {
                    _id: chatId,
                    name: chatDocument.name,
                    short_intro: chatDocument.short_intro,
                    gender: chatDocument.gender,
                    tags: chatDocument.tags,
                    thumbnail: chatDocument.thumbnail
                }
            });

        } catch (error) {
            console.error('[ExternalAPI] Error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/external/character/:chatId/add-image
     * External API to add an image to a character's gallery
     */
    fastify.post('/api/external/character/:chatId/add-image', async (request, reply) => {
        console.log('[ExternalAPI] ===== ADD IMAGE TO CHARACTER =====');
        
        try {
            const user = request.user;
            const apiKey = request.headers['x-api-key'];

            if (!user && !apiKey) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            let userId;
            if (apiKey) {
                userId = await validateApiKey(db, apiKey);
                if (!userId) {
                    return reply.status(401).send({ error: 'Invalid API key' });
                }
            } else {
                userId = user._id;
            }

            const { chatId } = request.params;
            const { imageUrl, prompt, nsfw = false, title } = request.body;

            if (!imageUrl) {
                return reply.status(400).send({ error: 'Image URL is required' });
            }

            const chatObjectId = new ObjectId(chatId);
            
            // Verify character exists
            const chat = await db.collection('chats').findOne({ _id: chatObjectId });
            if (!chat) {
                return reply.status(404).send({ error: 'Character not found' });
            }

            const galleryCollection = db.collection('gallery');
            const imageDoc = {
                _id: new ObjectId(),
                imageUrl: imageUrl,
                prompt: prompt || '',
                title: title || null,
                nsfw: nsfw,
                createdAt: new Date(),
                likes: 0,
                likedBy: [],
                addedFromExternalAPI: true,
                addedBy: new ObjectId(userId)
            };

            await galleryCollection.updateOne(
                { chatId: chatObjectId },
                {
                    $setOnInsert: { chatId: chatObjectId, chatSlug: chat.slug },
                    $push: { images: imageDoc }
                },
                { upsert: true }
            );

            console.log(`[ExternalAPI] Image added to character ${chatId}`);

            return reply.send({
                success: true,
                imageId: imageDoc._id.toString(),
                message: 'Image added to gallery'
            });

        } catch (error) {
            console.error('[ExternalAPI] Error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * POST /api/external/character/:chatId/add-video
     * External API to add a video to a character
     */
    fastify.post('/api/external/character/:chatId/add-video', async (request, reply) => {
        console.log('[ExternalAPI] ===== ADD VIDEO TO CHARACTER =====');
        
        try {
            const user = request.user;
            const apiKey = request.headers['x-api-key'];

            if (!user && !apiKey) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            let userId;
            if (apiKey) {
                userId = await validateApiKey(db, apiKey);
                if (!userId) {
                    return reply.status(401).send({ error: 'Invalid API key' });
                }
            } else {
                userId = user._id;
            }

            const { chatId } = request.params;
            const { videoUrl, prompt, duration, aspectRatio, modelName } = request.body;

            if (!videoUrl) {
                return reply.status(400).send({ error: 'Video URL is required' });
            }

            const chatObjectId = new ObjectId(chatId);
            
            // Verify character exists
            const chat = await db.collection('chats').findOne({ _id: chatObjectId });
            if (!chat) {
                return reply.status(404).send({ error: 'Character not found' });
            }

            const videosCollection = db.collection('videos');
            const videoDocument = {
                chatId: chatObjectId,
                userId: new ObjectId(userId),
                videoUrl: videoUrl,
                prompt: prompt || '',
                duration: duration || '5',
                aspectRatio: aspectRatio || '16:9',
                modelName: modelName || 'external',
                createdAt: new Date(),
                addedFromExternalAPI: true
            };

            const insertResult = await videosCollection.insertOne(videoDocument);

            console.log(`[ExternalAPI] Video added to character ${chatId}`);

            return reply.send({
                success: true,
                videoId: insertResult.insertedId.toString(),
                message: 'Video added to character'
            });

        } catch (error) {
            console.error('[ExternalAPI] Error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });

    /**
     * GET /api/external/characters
     * External API to list user's characters
     */
    fastify.get('/api/external/characters', async (request, reply) => {
        try {
            const user = request.user;
            const apiKey = request.headers['x-api-key'];

            if (!user && !apiKey) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }

            let userId;
            if (apiKey) {
                userId = await validateApiKey(db, apiKey);
                if (!userId) {
                    return reply.status(401).send({ error: 'Invalid API key' });
                }
            } else {
                userId = user._id;
            }

            const { limit = 50, skip = 0 } = request.query;

            const characters = await db.collection('chats')
                .find({ userId: new ObjectId(userId) })
                .project({
                    _id: 1,
                    name: 1,
                    short_intro: 1,
                    slug: 1,
                    tags: 1,
                    gender: 1,
                    chatImageUrl: 1,
                    thumbnail: 1,
                    createdAt: 1
                })
                .skip(parseInt(skip))
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .toArray();

            return reply.send({
                success: true,
                characters: characters.map(c => ({
                    ...c,
                    thumbnail: c.chatImageUrl || c.thumbnail || '/img/default-thumbnail.png'
                })),
                count: characters.length
            });

        } catch (error) {
            console.error('[ExternalAPI] Error:', error);
            return reply.status(500).send({ error: error.message });
        }
    });
}

module.exports = routes;
