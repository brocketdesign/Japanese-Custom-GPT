const { ObjectId } = require('mongodb');
const { z } = require("zod");

// Updated schema to handle the complete form structure
const details_description = z.object({
    // Physical Appearance - Core Features
    appearance: z.object({
        age: z.string().nullable(),
        ethnicity: z.string().nullable(),
        height: z.string().nullable(),
        weight: z.string().nullable(),
        bodyType: z.enum(['slim', 'athletic', 'average', 'curvy', 'muscular', 'heavy']).nullable(),
    }).optional(),
    
    // Facial Features
    face: z.object({
        faceShape: z.enum(['oval', 'round', 'square', 'heart', 'long', 'diamond']).nullable(),
        skinColor: z.string().nullable(),
        eyeColor: z.string().nullable(),
        eyeShape: z.enum(['almond', 'round', 'hooded', 'monolid', 'upturned', 'downturned']).nullable(),
        eyeSize: z.enum(['small', 'medium', 'large']).nullable(),
        facialFeatures: z.string().nullable(),
        makeup: z.string().nullable(),
    }).optional(),
    
    // Hair
    hair: z.object({
        hairColor: z.string().nullable(),
        hairLength: z.enum(['very short', 'short', 'medium', 'long', 'very long']).nullable(),
        hairStyle: z.string().nullable(),
        hairTexture: z.enum(['straight', 'wavy', 'curly', 'coily']).nullable(),
    }).optional(),
    
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
    }).optional(),
    
    // Style & Fashion
    style: z.object({
        clothingStyle: z.string().nullable(),
        accessories: z.string().nullable(),
        tattoos: z.string().nullable(),
        piercings: z.string().nullable(),
        scars: z.string().nullable(),
    }).optional(),
    
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
    }).optional(),
}).optional();

async function routes(fastify, options) {
    // Get character details for editing
    fastify.get('/api/character-details/:chatId', async (request, reply) => {
        try {
            const { chatId } = request.params;
            const userId = request.user._id;

            if (!ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            const collectionChats = fastify.mongo.db.collection('chats');
            const chat = await collectionChats.findOne({
                _id: new ObjectId(chatId),
                userId: new ObjectId(userId)
            });

            if (!chat) {
                return reply.status(404).send({ error: 'Character not found or access denied' });
            }

            reply.send({
                success: true,
                chat
            });

        } catch (error) {
            console.error('[API/character-details] Error:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });

    // Update character details
    fastify.put('/api/character-details/:chatId', async (request, reply) => {
        try {
            const { chatId } = request.params;
            const { details_description: newDetails, basicData, prompts, modelUpdate } = request.body;
            const userId = request.user._id;

            if (!ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            // Validate the details structure if provided
            if (newDetails) {
                const validationResult = details_description.safeParse(newDetails);
                if (!validationResult.success) {
                    return reply.status(400).send({ 
                        error: 'Invalid details format', 
                        details: validationResult.error.errors 
                    });
                }
            }

            const collectionChats = fastify.mongo.db.collection('chats');
            
            // Check if user owns this character
            const existingChat = await collectionChats.findOne({
                _id: new ObjectId(chatId),
                userId: new ObjectId(userId)
            });

            if (!existingChat) {
                return reply.status(404).send({ error: 'Character not found or access denied' });
            }

            // Prepare update object
            const updateData = { 
                updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
            };

            // Handle details_description update if provided
            if (newDetails) {
                updateData.details_description = newDetails;
            }

            // Handle basic character information updates
            if (basicData) {
                if (basicData.name !== undefined) updateData.name = basicData.name;
                if (basicData.slug !== undefined) updateData.slug = basicData.slug;
                if (basicData.short_intro !== undefined) updateData.short_intro = basicData.short_intro;
                if (basicData.description !== undefined) updateData.description = basicData.description;
                if (basicData.gender !== undefined) updateData.gender = basicData.gender;
                if (basicData.nsfw !== undefined) updateData.nsfw = basicData.nsfw;
            }

            // Handle prompt updates
            if (prompts) {
                if (prompts.characterPrompt !== undefined) updateData.characterPrompt = prompts.characterPrompt;
                if (prompts.enhancedPrompt !== undefined) updateData.enhancedPrompt = prompts.enhancedPrompt;
                if (prompts.system_prompt !== undefined) updateData.system_prompt = prompts.system_prompt;
                if (prompts.first_message !== undefined) updateData.first_message = prompts.first_message;
                if (prompts.tags !== undefined) updateData.tags = prompts.tags;
            }

            // Handle model updates if provided
            if (modelUpdate && modelUpdate.modelId) {
                updateData.modelId = modelUpdate.modelId;
                updateData.imageModel = modelUpdate.imageModel;
                updateData.imageStyle = modelUpdate.imageStyle;
                updateData.imageVersion = modelUpdate.imageVersion || 'SDXL 1.0';
            }

            // Update the character details
            const updateResult = await collectionChats.updateOne(
                { _id: new ObjectId(chatId) },
                { $set: updateData }
            );

            if (updateResult.matchedCount === 0) {
                return reply.status(404).send({ error: 'Character not found' });
            }

            reply.send({
                success: true,
                message: 'Character details updated successfully'
            });

        } catch (error) {
            console.error('[API/character-update] Error:', error);
            reply.status(500).send({ error: 'Internal server error' });
        }
    });
}

module.exports = routes;
