const { ObjectId } = require('mongodb');
async function routes(fastify, options) {
    // Get user personas
    fastify.get('/api/user/personas', async (req, res) => {
        try {
            const userId = req.user._id;
            const db = fastify.mongo.db; // Access MongoDB connection
            
            const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
            
            if (!user) {
                console.log('[GET /api/user/personas] User not found');
                return res.status(404).send({ success: false, error: 'User not found' });
            }
            
            // Get detailed persona information from Chat collection
            const personaIds = user.personas || [];
            const objectIdPersonaIds = personaIds.map(id => new ObjectId(id));
            
            const personas = await db.collection('chats')
                .find({ _id: { $in: objectIdPersonaIds } })
                .project({ name: 1, chatImageUrl: 1, character: 1 })
                .toArray();
            
            res.send({ success: true, personas });
        } catch (error) {
            console.error('[GET /api/user/personas] Error:', error);
            res.status(500).send({ success: false, error: 'Internal server error' });
        }
    });

    // Add or remove persona from user
    fastify.post('/api/user/personas', async (req, res) => {
        try {
            const userId = req.user._id;
            const { personaId, action } = req.body;
            
            
            if (!personaId || !action) {
                console.log('[POST /api/user/personas] Missing required fields');
                return res.status(400).send({ success: false, error: 'Missing required fields' });
            }
            
            const db = fastify.mongo.db; // Access MongoDB connection
            
            // Verify the persona exists
            const persona = await db.collection('chats').findOne({ _id: new ObjectId(personaId) });
            if (!persona) {
                console.log('[POST /api/user/personas] Persona not found');
                return res.status(404).send({ success: false, error: 'Persona not found' });
            }
            
            const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
            if (!user) {
                console.log('[POST /api/user/personas] User not found');
                return res.status(404).send({ success: false, error: 'User not found' });
            }
            
            // Initialize personas array if it doesn't exist
            if (!user.personas) {
                user.personas = [];
            }
            
            if (action === 'add') {
                // Add persona if not already present
                if (!user.personas.includes(personaId)) {
                    console.log(`[POST /api/user/personas] Adding persona ${personaId} to user ${userId}`);
                    await db.collection('users').updateOne(
                        { _id: new ObjectId(userId) },
                        { $push: { personas: personaId } }
                    );
                } else {
                    console.log(`[POST /api/user/personas] Persona ${personaId} already exists for user ${userId}`);
                }
            } else if (action === 'remove') {
                // Remove persona
                console.log(`[POST /api/user/personas] Removing persona ${personaId} from user ${userId}`);
                await db.collection('users').updateOne(
                    { _id: new ObjectId(userId) },
                    { $pull: { personas: personaId } }
                );
            } else {
                console.log(`[POST /api/user/personas] Invalid action: ${action}`);
                return res.status(400).send({ success: false, error: 'Invalid action' });
            }
            
            // Get updated user
            const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
            
            res.send({ 
                success: true, 
                message: action === 'add' ? 'Persona added successfully' : 'Persona removed successfully',
                personas: updatedUser.personas || []
            });
        } catch (error) {
            console.error('[POST /api/user/personas] Error:', error);
            res.status(500).send({ success: false, error: 'Internal server error' });
        }
    });

    // Add persona to a specific user chat
    fastify.post('/api/user-chat/add-persona', async (req, res) => {
        try {
            const userId = req.user._id;
            const { userChatId, personaId } = req.body;
            
            
            if (!userChatId || !personaId) {
                console.log('[POST /api/user-chat/add-persona] Missing required fields');
                return res.status(400).send({ success: false, error: 'Missing required fields' });
            }
            
            const db = fastify.mongo.db;
            
            // Verify the persona exists
            const persona = await db.collection('chats').findOne({ _id: new ObjectId(personaId) });
            if (!persona) {
                console.log('[POST /api/user-chat/add-persona] Persona not found');
                return res.status(404).send({ success: false, error: 'Persona not found' });
            }
            
            // Find and update the user chat
            const userChat = await db.collection('userChat').findOne({ 
                _id: new ObjectId(userChatId), 
                userId: new ObjectId(userId) 
            });
            
            if (!userChat) {
                console.log('[POST /api/user-chat/add-persona] User chat not found');
                return res.status(404).send({ success: false, error: 'User chat not found' });
            }
            
            // Update the persona field
            await db.collection('userChat').updateOne(
                { _id: new ObjectId(userChatId) },
                { $set: { persona: personaId } }
            );
            
            const updatedUserChat = await db.collection('userChat').findOne({ _id: new ObjectId(userChatId) });
            
            res.send({ 
                success: true, 
                message: 'Persona added to chat successfully',
                userChat: updatedUserChat
            });
        } catch (error) {
            console.error('[POST /api/user-chat/add-persona] Error:', error);
            res.status(500).send({ success: false, error: 'Internal server error' });
        }
    });
}
module.exports = routes;
