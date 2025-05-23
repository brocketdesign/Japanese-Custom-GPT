const { ObjectId } = require('mongodb');
const { z } = require("zod");

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
                chat: {
                    _id: chat._id,
                    name: chat.name,
                    description: chat.description,
                    gender: chat.gender,
                    characterPrompt: chat.characterPrompt,
                    details_description: chat.details_description || {},
                    chatImageUrl: chat.chatImageUrl
                }
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
            const { details_description: newDetails } = request.body;
            const userId = request.user._id;

            if (!ObjectId.isValid(chatId)) {
                return reply.status(400).send({ error: 'Invalid chat ID' });
            }

            // Validate the details structure
            const validationResult = details_description.safeParse(newDetails);
            if (!validationResult.success) {
                return reply.status(400).send({ 
                    error: 'Invalid details format', 
                    details: validationResult.error.errors 
                });
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

            // Update the character details
            const updateResult = await collectionChats.updateOne(
                { _id: new ObjectId(chatId) },
                { 
                    $set: { 
                        details_description: validationResult.data,
                        updatedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })
                    } 
                }
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
